/// <reference types="vite/client" />
// Voice message transcription with Whisper (transformers.js), fully on device.
// Runs in a worker so the model never blocks the UI.
import { env, pipeline, Tensor } from "@huggingface/transformers";
import ortAsyncifyMjs from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import ortPlainMjs from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";

declare const __ORT_WASM__: { version: string; asyncify: string; plain: string };

export type WorkerModelSpec = {
  repo: string;
  revision: string;
  device: "webgpu" | "wasm";
  dtype: Record<string, string>;
};

export type WorkerRequest =
  | { type: "load"; id: number; model: WorkerModelSpec }
  | { type: "transcribe"; id: number; model: WorkerModelSpec; audio: Float32Array };

export type WorkerResponse =
  | { type: "progress"; id: number; loaded: number; total: number }
  | { type: "loaded"; id: number }
  | { type: "result"; id: number; text: string; language: string | null }
  | { type: "error"; id: number; message: string };

const SAMPLE_RATE = 16000;
const ORT_CACHE = "nanchat-onnxruntime";

env.allowLocalModels = false;
env.useBrowserCache = typeof caches !== "undefined";
env.useWasmCache = false; // the WebAssembly binary is fetched and checked below

/* ------------------------------------------------------------------ */
/* ONNX Runtime WebAssembly                                            */
/* ------------------------------------------------------------------ */

// Same choice as transformers.js: the asyncify build (needed for WebGPU) everywhere,
// except Safari < 26 without WebGPU, which only runs the plain build.
const isOldSafari = () => {
  const ua = navigator.userAgent;
  if (!/Safari\//.test(ua) || /Chrome|Chromium|Android/.test(ua)) return false;
  const version = Number(ua.match(/Version\/(\d+)/)?.[1] || 0);
  return version > 0 && version < 26;
};

let ortReady: Promise<void> | null = null;

// The JS glue (.mjs) is bundled with the app; the large .wasm binary is downloaded once
// from jsDelivr, verified against the hash of the installed onnxruntime-web, and cached.
const setupOrt = (webgpu: boolean) =>
  (ortReady ??= (async () => {
    const asyncify = webgpu || !isOldSafari();
    const file = asyncify ? "ort-wasm-simd-threaded.asyncify.wasm" : "ort-wasm-simd-threaded.wasm";
    const integrity = asyncify ? __ORT_WASM__.asyncify : __ORT_WASM__.plain;
    const url = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${__ORT_WASM__.version}/dist/${file}`;

    const verify = async (buffer: ArrayBuffer) => {
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hash = "sha256-" + btoa(String.fromCharCode(...new Uint8Array(digest)));
      return hash === integrity;
    };

    const cache = typeof caches !== "undefined" ? await caches.open(ORT_CACHE).catch(() => null) : null;
    let binary: ArrayBuffer | null = null;
    const cached = await cache?.match(url);
    if (cached) {
      binary = await cached.arrayBuffer();
      if (!(await verify(binary))) {
        binary = null;
        await cache?.delete(url);
      }
    }
    if (!binary) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`could not download the speech runtime (${response.status})`);
      binary = await response.arrayBuffer();
      if (!(await verify(binary))) throw new Error("speech runtime integrity check failed");
      // drop the binaries of older onnxruntime versions
      for (const request of (await cache?.keys()) ?? []) await cache?.delete(request);
      await cache?.put(url, new Response(binary, { headers: { "Content-Type": "application/wasm" } }));
    }

    const wasm = env.backends.onnx.wasm!;
    wasm.wasmBinary = binary;
    wasm.wasmPaths = { mjs: new URL(asyncify ? ortAsyncifyMjs : ortPlainMjs, self.location.href).href };
  })().catch((error) => {
    ortReady = null;
    throw error;
  }));

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

type Asr = Awaited<ReturnType<typeof loadPipeline>>;
let current: { key: string; asr: Promise<Asr> } | null = null;

const specKey = (spec: WorkerModelSpec) =>
  `${spec.repo}@${spec.revision}:${spec.device}:${JSON.stringify(spec.dtype)}`;

const loadPipeline = async (spec: WorkerModelSpec, onProgress: (loaded: number, total: number) => void) => {
  await setupOrt(spec.device === "webgpu");
  const files = new Map<string, { loaded: number; total: number }>();
  return pipeline("automatic-speech-recognition", spec.repo, {
    revision: spec.revision,
    device: spec.device,
    dtype: spec.dtype as any,
    progress_callback: (info: any) => {
      if (info.status !== "progress" || !info.file) return;
      files.set(info.file, { loaded: info.loaded ?? 0, total: info.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const file of files.values()) {
        loaded += file.loaded;
        total += file.total;
      }
      onProgress(loaded, total);
    },
  });
};

const getPipeline = (spec: WorkerModelSpec, onProgress: (loaded: number, total: number) => void) => {
  const key = specKey(spec);
  if (current?.key !== key) {
    const previous = current?.asr;
    current = { key, asr: loadPipeline(spec, onProgress) };
    previous?.then((asr) => asr.dispose()).catch(() => {});
    const loading = current;
    loading.asr.catch(() => {
      if (current === loading) current = null;
    });
  }
  return current!.asr;
};

/* ------------------------------------------------------------------ */
/* Language detection                                                  */
/* ------------------------------------------------------------------ */

// transformers.js falls back to English when no language is given, so the language is
// detected first, like openai-whisper does: one decoder step after <|startoftranscript|>,
// keeping the most likely language token.
const detectLanguage = async (asr: Asr, audio: Float32Array): Promise<string | null> => {
  const config = (asr.model as any).generation_config;
  const langToId: Record<string, number> | undefined = config?.lang_to_id;
  if (!langToId) return null;
  const { input_features } = await (asr.processor as any)(audio.subarray(0, SAMPLE_RATE * 30));
  const decoder_input_ids = new Tensor("int64", BigInt64Array.from([BigInt(config.decoder_start_token_id)]), [1, 1]);
  const { logits } = await (asr.model as any)({ input_features, decoder_input_ids });
  const vocab = logits.dims.at(-1);
  const data = logits.data as Float32Array;
  const row = data.subarray(data.length - vocab);
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const [token, id] of Object.entries(langToId)) {
    if (row[id] > bestScore) {
      bestScore = row[id];
      best = token.slice(2, -2); // "<|fr|>" -> "fr"
    }
  }
  return best;
};

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

const post = (message: WorkerResponse) => self.postMessage(message);

// one request at a time: model sessions are not re-entrant
let queue: Promise<unknown> = Promise.resolve();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  const onProgress = (loaded: number, total: number) => post({ type: "progress", id: request.id, loaded, total });
  queue = queue.then(async () => {
    try {
      const asr = await getPipeline(request.model, onProgress);
      if (request.type === "load") {
        post({ type: "loaded", id: request.id });
        return;
      }
      const { audio } = request;
      const language = await detectLanguage(asr, audio);
      const output: any = await asr(audio, {
        language: language ?? undefined,
        task: "transcribe",
        ...(audio.length > SAMPLE_RATE * 30 ? { chunk_length_s: 30, stride_length_s: 5 } : {}),
      });
      const text = (Array.isArray(output) ? output.map((o) => o.text).join(" ") : output.text).trim();
      post({ type: "result", id: request.id, text, language });
    } catch (error: any) {
      post({ type: "error", id: request.id, message: error?.message || String(error) });
    }
  });
};
