import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import type { Language } from '@/lib/api/types'

import { en } from './en'
import { es } from './es'

export const LANG_STORAGE_KEY = 'sevenone-lang'
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'es']

function initialLanguage(): Language {
  const stored = localStorage.getItem(LANG_STORAGE_KEY)
  return stored === 'es' || stored === 'en' ? stored : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

/** Change language app-wide and remember it locally for the next visit. */
export function setLanguage(lang: Language): void {
  void i18n.changeLanguage(lang)
  localStorage.setItem(LANG_STORAGE_KEY, lang)
}

export default i18n
