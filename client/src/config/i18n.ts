/**
 * i18n Configuration
 * Internationalization setup for English, Spanish (Mexico), and Simplified Chinese
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from '../i18n/en.json';
import esTranslations from '../i18n/es-MX.json';
import zhTranslations from '../i18n/zh-CN.json';

const resources = {
  en: { translation: enTranslations },
  'es-MX': { translation: esTranslations },
  'zh-CN': { translation: zhTranslations },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'es-MX',
    fallbackLng: 'es-MX',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
