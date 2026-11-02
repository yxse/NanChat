import { Capacitor } from "@capacitor/core";
import { LanguageIdentification } from "@capacitor-mlkit/language-identification";
import { Language, Translation } from "@capacitor-mlkit/translation";
import { Network } from "@capacitor/network";
import { Modal, Toast } from "antd-mobile";
import i18n from "i18next";

export const SUPPORTED_LANGUAGES = Object.values(Language) as string[];

// ML Kit translation only works on Android and iOS
export const isTranslationAvailable = () => Capacitor.isNativePlatform();

export const getDefaultTargetLanguage = (): Language => {
  const appLanguage = (i18n.language || "en").split("-")[0];
  return (
    SUPPORTED_LANGUAGES.includes(appLanguage) ? appLanguage : "en"
  ) as Language;
};

export const getTargetLanguage = (): Language => {
  try {
    const stored = JSON.parse(
      localStorage.getItem("translateTargetLanguage") || "null",
    );
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored as Language;
    }
  } catch {}
  return getDefaultTargetLanguage();
};

export const isAutoTranslateEnabled = (): boolean => {
  try {
    return (
      JSON.parse(localStorage.getItem("autoTranslateMessages") || "false") ===
      true
    );
  } catch {
    return false;
  }
};

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

const MODEL_SIZE_MB = 30; // approximate size of one ML Kit language model

// thrown by translateText when the user refused to download a model on mobile data
export class ModelDownloadDeclinedError extends Error {
  constructor() {
    super("language model download declined");
    this.name = "ModelDownloadDeclinedError";
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

// Translate text to the target language, fully on-device.
// Returns null when there is nothing to translate (undetermined language,
// unsupported language or text already in the target language).
// Missing language models are downloaded first: on mobile data, `interactive`
// asks the user (throws ModelDownloadDeclinedError if refused), otherwise the
// translation is skipped until the device is on Wi-Fi.
export const translateText = async (
  text: string,
  targetLanguage: Language = getTargetLanguage(),
  { interactive = false }: { interactive?: boolean } = {},
): Promise<string | null> => {
  if (!isTranslationAvailable() || !text?.trim()) return null;
  const { language } = await LanguageIdentification.identifyLanguage({ text });
  const sourceLanguage = language.split("-")[0];
  if (sourceLanguage === "und" || !SUPPORTED_LANGUAGES.includes(sourceLanguage))
    return null;
  if (sourceLanguage === targetLanguage) return null;
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
