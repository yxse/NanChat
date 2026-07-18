import { Capacitor } from "@capacitor/core";
import { LanguageIdentification } from "@capacitor-mlkit/language-identification";
import { Language, Translation } from "@capacitor-mlkit/translation";
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

// Translate text to the target language, fully on-device.
// Returns null when there is nothing to translate (undetermined language,
// unsupported language or text already in the target language).
export const translateText = async (
  text: string,
  targetLanguage: Language = getTargetLanguage(),
): Promise<string | null> => {
  if (!isTranslationAvailable() || !text?.trim()) return null;
  const { language } = await LanguageIdentification.identifyLanguage({ text });
  const sourceLanguage = language.split("-")[0];
  if (sourceLanguage === "und" || !SUPPORTED_LANGUAGES.includes(sourceLanguage))
    return null;
  if (sourceLanguage === targetLanguage) return null;
  // translate() downloads the missing language models automatically
  const result = await Translation.translate({
    text,
    sourceLanguage: sourceLanguage as Language,
    targetLanguage,
  });
  return result.text;
};
