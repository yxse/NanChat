// On-device transcription of voice messages with Whisper (see worker/transcription.worker.ts).
// Audio is decoded here (the worker has no AudioContext) and sent to the worker as 16 kHz mono.
import { useSyncExternalStore } from "react";
import { Network } from "@capacitor/network";
import { Modal, Toast } from "antd-mobile";
import i18n from "i18next";
import type { WorkerModelSpec, WorkerRequest, WorkerResponse } from "../worker/transcription.worker";

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

export type TranscriptionModel = "small" | "base" | "tiny";
export type TranscriptionModelSetting = "auto" | TranscriptionModel;

const SAMPLE_RATE = 16000;
const MAX_DURATION_S = 10 * 60;
const RUNTIME_MB = 27; // onnxruntime WebAssembly binary, downloaded once
const TOKENIZER_MB = 5; // tokenizer + configs

type ModelVariant = { device: "webgpu" | "wasm"; dtype: Record<string, string>; sizeMB: number };

// Pinned revisions: the model files can't change under us.
// small needs WebGPU (too slow on CPU); base and tiny run on CPU (WebAssembly, int8).
const MODELS: Record<TranscriptionModel, { repo: string; revision: string; variant: (f16: boolean) => ModelVariant }> = {
  small: {
    repo: "onnx-community/whisper-small",
    revision: "36050c46d777d46dc4b5f43f6d90574fc38f8732",
    variant: (f16) => f16
      ? { device: "webgpu", dtype: { encoder_model: "fp16", decoder_model_merged: "q4" }, sizeMB: 177 + 233 }
      : { device: "webgpu", dtype: { encoder_model: "q4", decoder_model_merged: "q4" }, sizeMB: 66 + 233 },
  },
  base: {
    repo: "onnx-community/whisper-base",
    revision: "27a07b4b52b3a4c5886134bb4320e93e1a4bbc7c",
    variant: () => ({ device: "wasm", dtype: { encoder_model: "q8", decoder_model_merged: "q8" }, sizeMB: 23 + 54 }),
  },
  tiny: {
    repo: "onnx-community/whisper-tiny",
    revision: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
    variant: () => ({ device: "wasm", dtype: { encoder_model: "q8", decoder_model_merged: "q8" }, sizeMB: 10 + 31 }),
  },
};

const DTYPE_SUFFIX: Record<string, string> = { fp32: "", fp16: "_fp16", q8: "_quantized", q4: "_q4" };

/* ------------------------------------------------------------------ */
/* Support / settings                                                  */
/* ------------------------------------------------------------------ */

export const isTranscriptionSupported = () =>
  typeof Worker !== "undefined" &&
  typeof WebAssembly !== "undefined" &&
  typeof caches !== "undefined" && // models must be cached, not downloaded on every launch
  typeof OfflineAudioContext !== "undefined";

type Gpu = { webgpu: boolean; f16: boolean };
let gpu: Promise<Gpu> | null = null;
export const detectGpu = () =>
  (gpu ??= (async () => {
    try {
      const adapter = await (navigator as any).gpu?.requestAdapter();
      if (!adapter) return { webgpu: false, f16: false };
      return { webgpu: true, f16: adapter.features.has("shader-f16") };
    } catch {
      return { webgpu: false, f16: false };
    }
  })());

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
};

export const MODEL_SETTING_KEY = "voiceTranscriptionModel";
export const AUTO_TRANSCRIBE_KEY = "autoTranscribeVoiceMessages";

export const getModelSetting = (): TranscriptionModelSetting => {
  const stored = readJSON<string>(MODEL_SETTING_KEY, "auto");
  return stored === "small" || stored === "base" || stored === "tiny" ? stored : "auto";
};

export const isAutoTranscribeEnabled = () => readJSON<boolean>(AUTO_TRANSCRIBE_KEY, false) === true;

// small is only offered with WebGPU
export const getAvailableModels = async (): Promise<TranscriptionModel[]> =>
  (await detectGpu()).webgpu ? ["small", "base", "tiny"] : ["base", "tiny"];

export const resolveModel = async (setting = getModelSetting()): Promise<TranscriptionModel> => {
  const available = await getAvailableModels();
  if (setting !== "auto" && available.includes(setting)) return setting;
  return available[0];
};

const getSpec = async (model: TranscriptionModel): Promise<WorkerModelSpec & { sizeMB: number }> => {
  const { f16 } = await detectGpu();
  const { repo, revision, variant } = MODELS[model];
  return { repo, revision, ...variant(f16) };
};

// approximate download size, runtime included
export const getModelSizeMB = async (model: TranscriptionModel) =>
  (await getSpec(model)).sizeMB + TOKENIZER_MB + RUNTIME_MB;

/* ------------------------------------------------------------------ */
/* Model cache (transformers.js stores files in the Cache API)         */
/* ------------------------------------------------------------------ */

const TRANSFORMERS_CACHE = "transformers-cache";
const RUNTIME_CACHE = "nanchat-onnxruntime";

const weightUrls = (spec: WorkerModelSpec) =>
  Object.entries(spec.dtype).map(
    ([name, dtype]) =>
      `https://huggingface.co/${spec.repo}/resolve/${spec.revision}/onnx/${name}${DTYPE_SUFFIX[dtype] ?? `_${dtype}`}.onnx`,
  );

export const isModelDownloaded = async (model: TranscriptionModel): Promise<boolean> => {
  if (!isTranscriptionSupported()) return false;
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE);
    const urls = weightUrls(await getSpec(model));
    return (await Promise.all(urls.map((url) => cache.match(url)))).every(Boolean);
  } catch {
    return false;
  }
};

// Removes every downloaded Whisper file (all models) and the runtime
export const deleteModels = async () => {
  terminateWorker();
  const cache = await caches.open(TRANSFORMERS_CACHE);
  for (const request of await cache.keys()) {
    if (Object.values(MODELS).some(({ repo }) => request.url.includes(`/${repo}/`))) await cache.delete(request);
  }
  await caches.delete(RUNTIME_CACHE);
  transcripts.clear();
  setState({ status: "idle", progress: 0, error: null });
};

/* ------------------------------------------------------------------ */
/* State (download progress, shared with the UI)                       */
/* ------------------------------------------------------------------ */

export type TranscriptionState = {
  status: "idle" | "downloading" | "ready" | "error";
  progress: number; // 0..1 while downloading
  error: string | null;
};

let state: TranscriptionState = { status: "idle", progress: 0, error: null };
const listeners = new Set<() => void>();
const setState = (next: Partial<TranscriptionState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const useTranscriptionState = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );

/* ------------------------------------------------------------------ */
/* Worker                                                              */
/* ------------------------------------------------------------------ */

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();

const terminateWorker = () => {
  worker?.terminate();
  worker = null;
  pending.forEach(({ reject }) => reject(new Error("transcription stopped")));
  pending.clear();
};

const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL("../worker/transcription.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === "progress") {
      if (message.total > 0 && message.loaded < message.total) {
        setState({ status: "downloading", progress: message.loaded / message.total, error: null });
      }
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.type === "error") {
      setState({ status: "error", error: message.message });
      request.reject(new Error(message.message));
    } else {
      setState({ status: "ready", progress: 1, error: null });
      request.resolve(message);
    }
  };
  worker.onerror = (event) => {
    console.error("transcription worker error", event);
    setState({ status: "error", error: event.message || "worker error" });
    terminateWorker();
  };
  return worker;
};

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

const call = <T extends WorkerResponse>(request: WithoutId<WorkerRequest>, transfer: Transferable[] = []) =>
  new Promise<T>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...request, id }, transfer);
  });

/* ------------------------------------------------------------------ */
/* Download                                                            */
/* ------------------------------------------------------------------ */

export class TranscriptionDeclinedError extends Error {
  constructor() {
    super("speech model download declined");
    this.name = "TranscriptionDeclinedError";
  }
}

const isOnMobileData = async () => {
  try {
    return (await Network.getStatus()).connectionType === "cellular";
  } catch {
    return false;
  }
};

// Asks before downloading the model (always: it is large). Resolves true when accepted.
export const confirmModelDownload = async (model: TranscriptionModel): Promise<boolean> => {
  Toast.clear();
  const size = await getModelSizeMB(model);
  const mobileData = await isOnMobileData();
  return Modal.confirm({
    title: i18n.t("transcriptionDownloadTitle"),
    content: i18n.t(mobileData ? "transcriptionDownloadContentMobileData" : "transcriptionDownloadContent", { size }),
    confirmText: i18n.t("download"),
    cancelText: i18n.t("cancel"),
  });
};

// Downloads (if needed) and loads the model
export const loadModel = async (model?: TranscriptionModel) => {
  model ??= await resolveModel();
  if (!(await isModelDownloaded(model))) setState({ status: "downloading", progress: 0, error: null });
  await call({ type: "load", model: await getSpec(model) });
};

/* ------------------------------------------------------------------ */
/* Transcription                                                       */
/* ------------------------------------------------------------------ */

const decodeAudio = async (src: string): Promise<Float32Array> => {
  const buffer = await (await fetch(src)).arrayBuffer();
  // decodeAudioData resamples to the context rate: 16 kHz as Whisper expects
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const audio: AudioBuffer = await new Promise((resolve, reject) => {
    const promise = context.decodeAudioData(buffer, resolve, reject);
    promise?.catch?.(reject); // old Safari only has the callback form
  });
  const length = Math.min(audio.length, SAMPLE_RATE * MAX_DURATION_S);
  const mono = new Float32Array(length);
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const data = audio.getChannelData(channel);
    for (let i = 0; i < length; i++) mono[i] += data[i] / audio.numberOfChannels;
  }
  return mono;
};

export type Transcript = { text: string; language: string | null };

// in memory only: transcripts of end-to-end encrypted messages are not written to disk
const transcripts = new Map<string, Promise<Transcript>>();

export const getCachedTranscript = (key: string) => transcripts.get(key);

// Transcribes a voice message. `interactive`: asks to download the model when missing
// (throws TranscriptionDeclinedError if refused); otherwise throws when it isn't downloaded.
export const transcribe = async (
  key: string,
  src: string,
  { interactive = false }: { interactive?: boolean } = {},
): Promise<Transcript> => {
  const cached = transcripts.get(key);
  if (cached) return cached;
  const model = await resolveModel();
  if (!(await isModelDownloaded(model))) {
    if (!interactive) throw new Error("speech model not downloaded");
    if (!(await confirmModelDownload(model))) throw new TranscriptionDeclinedError();
    setState({ status: "downloading", progress: 0, error: null });
  }
  const result = (async () => {
    const audio = await decodeAudio(src);
    const { text, language } = await call<Extract<WorkerResponse, { type: "result" }>>(
      { type: "transcribe", model: await getSpec(model), audio },
      [audio.buffer as ArrayBuffer],
    );
    return { text, language };
  })();
  transcripts.set(key, result);
  result.catch(() => transcripts.delete(key));
  return result;
};
