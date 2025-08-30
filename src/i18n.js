import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './locales/en.json';
import frTranslations from './locales/fr.json';
import esTranslations from './locales/es.json';
import zhTranslations from './locales/zh.json';
import arTranslations from './locales/ar.json';
import ruTranslations from './locales/ru.json';
import jaTranslations from './locales/ja.json';
import deTranslations from './locales/de.json';
import trTranslations from './locales/tr.json';
import itTranslations from './locales/it.json';
import ptTranslations from './locales/pt.json';
import nlTranslations from './locales/nl.json';
import plTranslations from './locales/pl.json';

const languageDetector = new LanguageDetector(null, {
  
})
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations
      },
      fr: {
        translation: frTranslations
      },
      es: {
        translation: esTranslations
      },
      zh: {
        translation: zhTranslations
      },
      ar: {
        translation: arTranslations
      },
      ru: {
        translation: ruTranslations
      },
      ja: {
        translation: jaTranslations
      },
      de: {
        translation: deTranslations
      },
      tr: {
        translation: trTranslations
      },
      it: {
        translation: itTranslations
      },
      pt: {
        translation: ptTranslations
      },
      nl: {
        translation: nlTranslations
      },
      pl: {
        translation: plTranslations
      },
    },
    fallbackLng: 'en',
    debug: true,
  });

export default i18n;