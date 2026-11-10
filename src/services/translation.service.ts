import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { LanguageIdentification } from "@capacitor-mlkit/language-identification";
import { Language, Translation } from "@capacitor-mlkit/translation";
import { Network } from "@capacitor/network";
import { Modal, Toast } from "antd-mobile";
import i18n from "i18next";

export const SUPPORTED_LANGUAGES = Object.values(Language) as string[];

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

// mlkit: on-device (Android + iOS), models downloaded by the app
// apple: on-device, iOS 18+ Translation framework (system-managed models)
// google: free Google Translate endpoint (translate.googleapis.com, client=gtx).
//         Unofficial (no API key): it can rate limit or change without notice.
export type TranslationProvider = "mlkit" | "apple" | "google";

export const CLOUD_PROVIDERS: TranslationProvider[] = ["google"];
export const isCloudProvider = (provider: TranslationProvider) =>
  CLOUD_PROVIDERS.includes(provider);

export const PROVIDER_NAMES: Record<TranslationProvider, string> = {
  mlkit: "ML Kit",
  apple: "Apple",
  google: "Google Translate",
};

interface AppleTranslationPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  getSupportedLanguages(): Promise<{ languages: string[] }>;
  translate(options: {
    text: string;
    targetLanguage: string;
    interactive: boolean;
  }): Promise<{ text: string | null }>;
}

const AppleTranslation = registerPlugin<AppleTranslationPlugin>("AppleTranslation");

let appleAvailable: boolean | null = null;
// Resolves whether Apple's Translation framework can be used (iOS 18+)
export const checkAppleTranslationAvailable = async (): Promise<boolean> => {
  if (appleAvailable !== null) return appleAvailable;
  if (Capacitor.getPlatform() !== "ios") return (appleAvailable = false);
  try {
    appleAvailable = (await AppleTranslation.isAvailable()).available;
  } catch {
    appleAvailable = false;
  }
  return appleAvailable;
};

let appleLanguages: string[] | null = null;
export const getAppleSupportedLanguages = async (): Promise<string[]> => {
  if (appleLanguages) return appleLanguages;
  try {
    // keep the ML Kit naming used for the stored target language
    appleLanguages = (await AppleTranslation.getSupportedLanguages()).languages.filter(
      (language) => SUPPORTED_LANGUAGES.includes(language),
    );
  } catch {
    appleLanguages = [];
  }
  return appleLanguages;
};

// Providers usable on the current platform (apple needs checkAppleTranslationAvailable)
export const getPlatformProviders = (): TranslationProvider[] => {
  if (!Capacitor.isNativePlatform()) return ["google"];
  if (Capacitor.getPlatform() === "ios") {
    return appleAvailable === false
      ? ["mlkit", "google"]
      : ["mlkit", "apple", "google"];
  }
  return ["mlkit", "google"];
};

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
};

export const getDefaultProvider = (): TranslationProvider =>
  Capacitor.isNativePlatform() ? "mlkit" : "google";

export const getProvider = (): TranslationProvider => {
  const stored = readJSON<TranslationProvider | null>("translateProvider", null);
  if (stored && getPlatformProviders().includes(stored)) return stored;
  return getDefaultProvider();
};

// Translation can run with this provider on this platform
export const isTranslationAvailable = (provider: TranslationProvider = getProvider()) =>
  getPlatformProviders().includes(provider);

/* ------------------------------------------------------------------ */
/* Languages                                                           */
/* ------------------------------------------------------------------ */

const toGoogleTarget = (language: string) => (language === "zh" ? "zh-CN" : language);

// Target languages offered for a provider (apple needs getAppleSupportedLanguages first)
export const getProviderLanguages = (provider: TranslationProvider): string[] => {
  return provider === "apple" ? appleLanguages ?? [] : SUPPORTED_LANGUAGES;
};

export const getDefaultTargetLanguage = (): Language => {
  const appLanguage = (i18n.language || "en").split("-")[0];
  return (
    SUPPORTED_LANGUAGES.includes(appLanguage) ? appLanguage : "en"
  ) as Language;
};

export const getTargetLanguage = (): Language => {
  const stored = readJSON<string | null>("translateTargetLanguage", null);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored as Language;
  return getDefaultTargetLanguage();
};

export const isAutoTranslateEnabled = (): boolean =>
  readJSON<boolean>("autoTranslateMessages", false) === true;

export const languageName = (code: string): string => {
  try {
    const name = new Intl.DisplayNames([i18n.language || "en"], {
      type: "language",
    }).of(code);
    if (name && name !== code) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {}
  return code;
};

/* ------------------------------------------------------------------ */
/* ML Kit model downloads                                              */
/* ------------------------------------------------------------------ */

const MODEL_SIZE_MB = 30; // approximate size of one ML Kit language model

// thrown by translateText when the user refused to download a model on mobile data
export class ModelDownloadDeclinedError extends Error {
  constructor() {
    super("language model download declined");
    this.name = "ModelDownloadDeclinedError";
  }
}

// thrown by online providers when the service refuses requests (rate limited / blocked)
export class TranslationRateLimitError extends Error {
  constructor(message = "translation service rate limited") {
    super(message);
    this.name = "TranslationRateLimitError";
  }
}

const isOnMobileData = async () => {
  try {
    const { connectionType } = await Network.getStatus();
    return connectionType === "cellular";
  } catch {
    return false;
  }
};

const getMissingModels = async (languages: string[]) => {
  const { languages: downloaded } = await Translation.getDownloadedModels();
  return [...new Set(languages)].filter((language) => !(downloaded as string[]).includes(language));
};

// Asks before downloading language models when not on Wi-Fi.
// Resolves true when the download can go ahead.
export const confirmModelDownload = async (languages: string[]): Promise<boolean> => {
  if (languages.length === 0 || !(await isOnMobileData())) return true;
  Toast.clear(); // a loading toast would cover the modal
  return Modal.confirm({
    title: i18n.t("downloadModelMobileDataTitle"),
    content: i18n.t("downloadModelMobileDataContent", {
      languages: languages.map(languageName).join(", "),
      size: MODEL_SIZE_MB * languages.length,
    }),
    confirmText: i18n.t("download"),
    cancelText: i18n.t("cancel"),
  });
};

/* ------------------------------------------------------------------ */
/* Translation                                                         */
/* ------------------------------------------------------------------ */

// Local language detection (native only). Returns null when unknown/unavailable.
const detectLanguage = async (text: string): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { language } = await LanguageIdentification.identifyLanguage({ text });
    const code = language.split("-")[0];
    return code === "und" ? null : code;
  } catch {
    return null;
  }
};

const translateMlkit = async (
  text: string,
  sourceLanguage: string | null,
  targetLanguage: Language,
  interactive: boolean,
): Promise<string | null> => {
  if (!sourceLanguage || !SUPPORTED_LANGUAGES.includes(sourceLanguage)) return null;
  const missing = await getMissingModels([sourceLanguage, targetLanguage]);
  if (missing.length > 0) {
    if (!interactive) {
      if (await isOnMobileData()) return null;
    } else {
      if (!(await confirmModelDownload(missing))) throw new ModelDownloadDeclinedError();
      Toast.show({ icon: "loading", content: i18n.t("downloadingLanguageModel"), duration: 0 });
    }
  }
  // translate() downloads the missing language models automatically
  const result = await Translation.translate({
    text,
    sourceLanguage: sourceLanguage as Language,
    targetLanguage,
  });
  return result.text;
};

type HttpResponse = { status: number; data: any };

const parseBody = (body: any) => {
  if (typeof body !== "string") return body;
  try { return JSON.parse(body); } catch { return body; }
};

// HTTP request: native HTTP client on native (no CORS, custom headers),
// fetch on web. `body` strings are sent unchanged.
const request = async (
  method: "GET" | "POST",
  url: string,
  { body, headers = {} }: { body?: string; headers?: Record<string, string> } = {},
): Promise<HttpResponse> => {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      method,
      url,
      headers,
      data: body,
      responseType: "text",
    });
    return { status: response.status, data: parseBody(response.data) };
  }
  const response = await fetch(url, { method, headers, body });
  return { status: response.status, data: parseBody(await response.text()) };
};

const checkStatus = ({ status, data }: HttpResponse) => {
  if (status === 429 || status === 403) throw new TranslationRateLimitError();
  if (status < 200 || status >= 300 || data?.error) {
    throw new Error(`translation request failed (${status}) ${JSON.stringify(data)?.slice(0, 200)}`);
  }
};

const translateGoogle = async (text: string, targetLanguage: string) => {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: toGoogleTarget(targetLanguage),
    dt: "t",
    q: text,
  });
  const response = await request(
    "GET",
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
  );
  checkStatus(response);
  // [[[translated, original, ...], ...segments], null, detectedSourceLanguage, ...]
  const segments = response.data?.[0];
  if (!Array.isArray(segments)) throw new Error("unexpected Google translation response");
  const detected = String(response.data?.[2] || "").split("-")[0].toLowerCase();
  if (detected === targetLanguage) return null;
  const translated = segments.map((segment: any[]) => segment?.[0] ?? "").join("");
  return translated || null;
};

// Translate text to the target language with the selected provider.
// Returns null when there is nothing to translate (undetermined language,
// unsupported language or text already in the target language).
// ML Kit: missing language models are downloaded first: on mobile data,
// `interactive` asks the user (throws ModelDownloadDeclinedError if refused),
// otherwise the translation is skipped until the device is on Wi-Fi.
// Apple: missing languages are only downloaded (system sheet) when `interactive`.
// Online providers throw TranslationRateLimitError when the service refuses requests.
export const translateText = async (
  text: string,
  targetLanguage: Language = getTargetLanguage(),
  {
    interactive = false,
    provider = getProvider(),
  }: { interactive?: boolean; provider?: TranslationProvider } = {},
): Promise<string | null> => {
  if (!text?.trim()) return null;
  if (!getPlatformProviders().includes(provider)) return null;

  if (provider === "apple") {
    // language detection is done natively (NaturalLanguage framework)
    const { text: result } = await AppleTranslation.translate({ text, targetLanguage, interactive });
    return result;
  }

  // detect locally first: skips text already in the target language
  // without sending it to a cloud service
  const sourceLanguage = await detectLanguage(text);
  if (sourceLanguage === targetLanguage) return null;

  switch (provider) {
    case "mlkit":
      return translateMlkit(text, sourceLanguage, targetLanguage, interactive);
    case "google":
      return translateGoogle(text, targetLanguage);
  }
};
