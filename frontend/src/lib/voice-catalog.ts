export type VoiceProvider = 'elevenlabs' | 'google'
export type VoiceGender = 'Female' | 'Male'

export interface VoiceEntry {
  id: string
  name: string
  provider: VoiceProvider
  gender: VoiceGender
  language: 'all'
  locale: string
  voiceId: string
  description?: string
}

export interface LanguageOption {
  code: string
  label: string
  locale: string
  flag: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'Francais',  locale: 'fr-FR', flag: '🇫🇷' },
  { code: 'en', label: 'English',   locale: 'en-US', flag: '🇬🇧' },
  { code: 'es', label: 'Espanol',   locale: 'es-ES', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano',  locale: 'it-IT', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch',   locale: 'de-DE', flag: '🇩🇪' },
  { code: 'pt', label: 'Portugues', locale: 'pt-BR', flag: '🇧🇷' },
]

// ── ElevenLabs — 12 voix multilingues ─────────────────────────────────────────

const EL_VOICES: VoiceEntry[] = [
  { id: 'el-rachel',  name: 'Rachel',  provider: 'elevenlabs', gender: 'Female', language: 'all', locale: '', voiceId: '21m00Tcm4TlvDq8ikWAM', description: 'Chaleureuse et naturelle' },
  { id: 'el-aria',    name: 'Aria',    provider: 'elevenlabs', gender: 'Female', language: 'all', locale: '', voiceId: '9BWtsMINqrJLrRacOk9x', description: 'Expressive et confiante' },
  { id: 'el-sarah',   name: 'Sarah',   provider: 'elevenlabs', gender: 'Female', language: 'all', locale: '', voiceId: 'EXAVITQu4vr4xnSDxMaL', description: 'Douce et professionnelle' },
  { id: 'el-matilda', name: 'Matilda', provider: 'elevenlabs', gender: 'Female', language: 'all', locale: '', voiceId: 'XrExE9yKIg1WjnnlVkGX', description: 'Amicale et chaleureuse' },
  { id: 'el-alice',   name: 'Alice',   provider: 'elevenlabs', gender: 'Female', language: 'all', locale: '', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', description: 'Assuree et claire' },
  { id: 'el-freya',   name: 'Freya',   provider: 'elevenlabs', gender: 'Female', language: 'all', locale: '', voiceId: 'jsCqWAovK2LkecY7zXl4', description: 'Naturelle et dynamique' },
  { id: 'el-josh',    name: 'Josh',    provider: 'elevenlabs', gender: 'Male',   language: 'all', locale: '', voiceId: 'TxGEqnHWrfWFTfGW9XjX', description: 'Profond et pose' },
  { id: 'el-roger',   name: 'Roger',   provider: 'elevenlabs', gender: 'Male',   language: 'all', locale: '', voiceId: 'CwhRBWXHgEFdSjDUdU9x', description: 'Confiant et professionnel' },
  { id: 'el-charlie', name: 'Charlie', provider: 'elevenlabs', gender: 'Male',   language: 'all', locale: '', voiceId: 'IKne3meq5aSn9XLyUdCD', description: 'Decontracte et accessible' },
  { id: 'el-george',  name: 'George',  provider: 'elevenlabs', gender: 'Male',   language: 'all', locale: '', voiceId: 'JBFqnCBsd6RMkjVDRZzb', description: 'Chaleureux et fiable' },
  { id: 'el-callum',  name: 'Callum',  provider: 'elevenlabs', gender: 'Male',   language: 'all', locale: '', voiceId: 'N2lVS1w4EtoT3dr4eOWO', description: 'Intense et memorable' },
  { id: 'el-liam',    name: 'Liam',    provider: 'elevenlabs', gender: 'Male',   language: 'all', locale: '', voiceId: 'TX3LPaxmHKxFdv7VOQHJ', description: 'Jeune et dynamique' },
]

// ── Google Chirp3-HD — 30 voix, toutes langues ────────────────────────────────
// URL API : {locale}-Chirp3-HD-{voiceId}  ex: fr-FR-Chirp3-HD-Aoede

const G_VOICES: VoiceEntry[] = [
  { id: 'g-achernar',      name: 'Achernar',      provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Achernar',      description: 'Brillante et precise' },
  { id: 'g-achird',        name: 'Achird',         provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Achird',         description: 'Chaleureux et naturel' },
  { id: 'g-algenib',       name: 'Algenib',        provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Algenib',        description: 'Clair et direct' },
  { id: 'g-algieba',       name: 'Algieba',        provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Algieba',        description: 'Grave et pose' },
  { id: 'g-alnilam',       name: 'Alnilam',        provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Alnilam',        description: 'Doux et expressif' },
  { id: 'g-aoede',         name: 'Aoede',          provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Aoede',          description: 'Claire et naturelle' },
  { id: 'g-autonoe',       name: 'Autonoe',        provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Autonoe',        description: 'Legere et melodieuse' },
  { id: 'g-callirrhoe',    name: 'Callirrhoe',     provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Callirrhoe',     description: 'Douce et fluide' },
  { id: 'g-charon',        name: 'Charon',         provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Charon',         description: 'Profond et assure' },
  { id: 'g-despina',       name: 'Despina',        provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Despina',        description: 'Vive et chaleureuse' },
  { id: 'g-enceladus',     name: 'Enceladus',      provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Enceladus',      description: 'Fort et clair' },
  { id: 'g-erinome',       name: 'Erinome',        provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Erinome',        description: 'Elegante et posee' },
  { id: 'g-fenrir',        name: 'Fenrir',         provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Fenrir',         description: 'Intense et marque' },
  { id: 'g-gacrux',        name: 'Gacrux',         provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Gacrux',         description: 'Expressive et coloree' },
  { id: 'g-iapetus',       name: 'Iapetus',        provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Iapetus',        description: 'Serieux et fiable' },
  { id: 'g-kore',          name: 'Kore',           provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Kore',           description: 'Douce et professionnelle' },
  { id: 'g-laomedeia',     name: 'Laomedeia',      provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Laomedeia',      description: 'Melodieuse et claire' },
  { id: 'g-leda',          name: 'Leda',           provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Leda',           description: 'Fine et distincte' },
  { id: 'g-orus',          name: 'Orus',           provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Orus',           description: 'Energique et dynamique' },
  { id: 'g-pulcherrima',   name: 'Pulcherrima',    provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Pulcherrima',    description: 'Riche et chaleureuse' },
  { id: 'g-puck',          name: 'Puck',           provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Puck',           description: 'Leger et agreable' },
  { id: 'g-rasalgethi',    name: 'Rasalgethi',     provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Rasalgethi',     description: 'Assure et marque' },
  { id: 'g-sadachbia',     name: 'Sadachbia',      provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Sadachbia',      description: 'Ample et resonant' },
  { id: 'g-sadaltager',    name: 'Sadaltager',     provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Sadaltager',     description: 'Solide et fiable' },
  { id: 'g-schedar',       name: 'Schedar',        provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Schedar',        description: 'Robuste et clair' },
  { id: 'g-sulafat',       name: 'Sulafat',        provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Sulafat',        description: 'Brillante et expressive' },
  { id: 'g-umbriel',       name: 'Umbriel',        provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Umbriel',        description: 'Doux et serieux' },
  { id: 'g-vindemiatrix',  name: 'Vindemiatrix',   provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Vindemiatrix',   description: 'Vive et precise' },
  { id: 'g-zephyr',        name: 'Zephyr',         provider: 'google', gender: 'Female', language: 'all', locale: '', voiceId: 'Zephyr',         description: 'Legere et chaleureuse' },
  { id: 'g-zubenelgenubi', name: 'Zubenelgenubi',  provider: 'google', gender: 'Male',   language: 'all', locale: '', voiceId: 'Zubenelgenubi',  description: 'Profond et distinctif' },
]

export const ALL_VOICES = [...EL_VOICES, ...G_VOICES]

// Pour Google : toutes les 30 voix sont disponibles dans toutes les langues.
// Le selecteur de langue determine uniquement le locale de l'URL et de la synthese.
export function getVoicesFor(provider: VoiceProvider): VoiceEntry[] {
  if (provider === 'elevenlabs') return EL_VOICES
  return G_VOICES
}

export function getLanguagesFor(_provider: VoiceProvider): LanguageOption[] {
  return LANGUAGES
}

// locale est obligatoire pour Google (ex: 'fr-FR') → construit google://fr-FR-Chirp3-HD-Aoede
export function buildWildixVoiceUrl(voice: VoiceEntry, locale?: string): string {
  if (voice.provider === 'elevenlabs') return `elevenlabs://${voice.voiceId}`
  return `google://${locale ?? 'fr-FR'}-Chirp3-HD-${voice.voiceId}`
}

export function defaultPreviewText(language: string): string {
  const texts: Record<string, string> = {
    fr: "Bonjour, vous etes bien chez nous. Comment puis-je vous aider ?",
    en: 'Hello, welcome to our company. How can I help you today?',
    es: 'Hola, bienvenido. Como puedo ayudarle?',
    it: 'Ciao, benvenuto. Come posso aiutarla?',
    de: 'Hallo, willkommen. Wie kann ich Ihnen helfen?',
    pt: 'Ola, bem-vindo. Como posso ajuda-lo hoje?',
  }
  return texts[language] ?? texts['fr']
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-amber-100 text-amber-700',
]

export function voiceAvatarClass(voice: VoiceEntry): string {
  let hash = 0
  for (const ch of voice.id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function voiceInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}