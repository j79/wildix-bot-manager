import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import fr from './locales/fr.json'
import en from './locales/en.json'
import it from './locales/it.json'
import es from './locales/es.json'
import de from './locales/de.json'

const STORAGE_KEY = 'wilma_lang'

const savedLang = localStorage.getItem(STORAGE_KEY) ?? 'fr'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      it: { translation: it },
      es: { translation: es },
      de: { translation: de },
    },
    lng: savedLang,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
