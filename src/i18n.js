import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './locales/en.json';

// English (the fallback) is bundled, the other languages are loaded when used: only one of them is needed, and all
// together they were most of the launch bundle (~800 KB)
const locales = {
  fr: () => import('./locales/fr.json'),
  es: () => import('./locales/es.json'),
  zh: () => import('./locales/zh.json'),
  ar: () => import('./locales/ar.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  de: () => import('./locales/de.json'),
  tr: () => import('./locales/tr.json'),
  it: () => import('./locales/it.json'),
  pt: () => import('./locales/pt.json'),
  nl: () => import('./locales/nl.json'),
  pl: () => import('./locales/pl.json'),
  uk: () => import('./locales/uk.json'),
  'zh-Hant': () => import('./locales/zh-Hant.json'),
};
const lazyLocales = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = locales[language];
    if (!load) return callback(null, {}); // e.g. "fr-FR": i18next falls back to "fr", then "en"
    load()
      .then((module) => callback(null, module.default))
      .catch((err) => callback(err, null));
  },
};

const languageDetector = new LanguageDetector(null, {
  
})
/** Resolves once the language of the user is loaded (the app renders after it, see Popup.tsx). */
export const i18nReady = i18n
  .use(languageDetector)
  .use(lazyLocales)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations
      },
    },
    partialBundledLanguages: true, // en bundled, the others from lazyLocales
    fallbackLng: 'en',
    debug: false,
    // never suspend while a language loads (changing it in the settings): English shows until then, as before
    react: { useSuspense: false },
  })
  .catch((err) => console.error('i18n init failed', err));

export default i18n;
