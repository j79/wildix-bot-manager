import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PhoneCall, Volume2, Loader2 } from 'lucide-react'
import { dialplanApi } from '@/api/bots'
import { aiApi } from '@/api/ai'
import type { BotDraft } from '@/types/botCreate'
import { Button } from '@/components/ui/button'
import {
  type VoiceProvider, type VoiceGender, type VoiceEntry,
  LANGUAGES, getVoicesFor, getLanguagesFor,
  buildWildixVoiceUrl, defaultPreviewText,
  voiceAvatarClass, voiceInitials, ALL_VOICES,
} from '@/lib/voice-catalog'

export function StepVoix({ draft, set }: { draft: BotDraft; set: (p: Partial<BotDraft>) => void }) {
  const [provider, setProvider]         = useState<VoiceProvider>('google')
  const [language, setLanguage]         = useState('fr')
  const [genderFilter, setGenderFilter] = useState<VoiceGender | 'all'>('all')
  const [selectedVoice, setSelectedVoice] = useState<VoiceEntry | null>(null)
  const [previewText, setPreviewText]   = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { data: dialplanData, isLoading: dialplanLoading } = useQuery({
    queryKey: ['dialplan', draft.pbxId],
    queryFn: () => dialplanApi.list(draft.pbxId),
    enabled: !!draft.pbxId && draft.botType === 'voicebot',
  })

  useEffect(() => {
    if (!draft.voiceUrl || selectedVoice) return
    if (draft.voiceUrl.startsWith('elevenlabs://')) {
      const voiceId = draft.voiceUrl.slice('elevenlabs://'.length)
      const found = ALL_VOICES.find(v => v.provider === 'elevenlabs' && v.voiceId === voiceId)
      if (found) { setSelectedVoice(found); setProvider('elevenlabs') }
    } else if (draft.voiceUrl.startsWith('google://')) {
      const inner = draft.voiceUrl.slice('google://'.length)
      const idx = inner.indexOf('-Chirp3-HD-')
      if (idx !== -1) {
        const locale = inner.slice(0, idx)
        const voiceName = inner.slice(idx + '-Chirp3-HD-'.length)
        const lang = LANGUAGES.find(l => l.locale === locale)?.code ?? 'fr'
        setLanguage(lang); setProvider('google')
        const found = ALL_VOICES.find(v => v.provider === 'google' && v.voiceId === voiceName)
        if (found) setSelectedVoice(found)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const voices      = getVoicesFor(provider)
  const filtered    = genderFilter === 'all' ? voices : voices.filter(v => v.gender === genderFilter)
  const langs       = getLanguagesFor(provider)
  const currentLocale = langs.find(l => l.code === language)?.locale ?? 'fr-FR'

  function handleProviderChange(p: VoiceProvider) { setProvider(p); setSelectedVoice(null); set({ voiceUrl: '' }) }

  function selectVoice(v: VoiceEntry) {
    setSelectedVoice(v)
    set({ voiceUrl: buildWildixVoiceUrl(v, currentLocale) })
    if (!previewText) setPreviewText(draft.welcomeMessage || defaultPreviewText(language))
  }

  useEffect(() => {
    if (selectedVoice?.provider === 'google') set({ voiceUrl: buildWildixVoiceUrl(selectedVoice, currentLocale) })
  }, [language]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePreview() {
    if (!selectedVoice || !previewText.trim()) return
    setPreviewLoading(true)
    try {
      const result = await aiApi.ttsPreview({
        provider: selectedVoice.provider, voiceId: selectedVoice.voiceId,
        locale: currentLocale, text: previewText.trim(),
      })
      const bytes = Uint8Array.from(atob(result.audioBase64), ch => ch.charCodeAt(0))
      const blob = new Blob([bytes], { type: result.contentType })
      const url = URL.createObjectURL(blob)
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play().catch(() => {}) }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erreur de previsualisation') }
    finally { setPreviewLoading(false) }
  }

  if (draft.botType === 'chatbot') {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
        La sélection de voix et l'entrée Dialplan concernent uniquement les VoiceBots WILMA.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Voice selector */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Voix du bot <span className="text-muted-foreground font-normal">(optionnel)</span></p>
        <div className="flex gap-2">
          {(['google', 'elevenlabs'] as VoiceProvider[]).map(p => (
            <button key={p} onClick={() => handleProviderChange(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                provider === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40 text-muted-foreground'
              }`}>
              {p === 'google' ? 'Google Chirp3-HD' : 'ElevenLabs'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={language} onChange={(e) => setLanguage(e.target.value)}>
            {langs.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">
            {provider === 'google' ? '30 voix — langue choisie pour la synthese' : '12 voix multilingues'}
          </span>
          <div className="flex gap-1 rounded-md border border-input overflow-hidden ml-auto">
            {(['all', 'Female', 'Male'] as const).map(g => (
              <button key={g} onClick={() => setGenderFilter(g)}
                className={`px-2.5 py-1 text-xs transition-colors ${genderFilter === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                {g === 'all' ? 'Tous' : g === 'Female' ? 'Feminin' : 'Masculin'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1 rounded">
          {filtered.map(v => (
            <button key={v.id} onClick={() => selectVoice(v)}
              className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-all ${
                selectedVoice?.id === v.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40 hover:bg-accent'
              }`}>
              <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${voiceAvatarClass(v)}`}>
                {voiceInitials(v.name)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{v.name}</p>
                {v.description && <p className="text-[10px] text-muted-foreground truncate leading-tight">{v.description}</p>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-4 text-xs text-muted-foreground py-4 text-center">Aucune voix disponible pour cette selection</p>
          )}
        </div>
        {selectedVoice && (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Previsualisation — <span className="text-foreground">{selectedVoice.name}</span>
              {selectedVoice.provider === 'google' && (
                <span className="ml-2 text-[10px] font-mono text-muted-foreground/70">{currentLocale}</span>
              )}
            </p>
            <div className="flex gap-2">
              <input className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Texte a ecouter..." value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
              <Button size="sm" className="h-8 text-xs shrink-0 gap-1" onClick={handlePreview}
                disabled={previewLoading || !previewText.trim()}>
                {previewLoading ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />} Ecouter
              </Button>
            </div>
            <audio ref={audioRef} controls className="w-full h-8" />
          </div>
        )}
      </div>

      {/* Dialplan entry */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <PhoneCall size={14} className="text-muted-foreground" />
          <p className="text-sm font-medium">Entree Dialplan <span className="text-muted-foreground font-normal">(optionnel)</span></p>
        </div>
        <p className="text-xs text-muted-foreground">Associez ce bot a une entree dialplan existante sur votre PBX.</p>
        {dialplanLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="space-y-1 max-h-44 overflow-y-auto rounded-md border p-1">
            <label className="flex items-center gap-2 rounded p-2 hover:bg-accent cursor-pointer">
              <input type="radio" name="dialplan" checked={draft.dialplanId === null}
                onChange={() => set({ dialplanId: null })} className="h-3.5 w-3.5 accent-primary" />
              <span className="text-xs text-muted-foreground italic">Aucune — a configurer manuellement dans le PBX</span>
            </label>
            {(dialplanData?.dialplans ?? []).map(d => (
              <label key={d.id} className="flex items-center gap-2 rounded p-2 hover:bg-accent cursor-pointer">
                <input type="radio" name="dialplan" checked={draft.dialplanId === d.id}
                  onChange={() => set({ dialplanId: d.id })} className="h-3.5 w-3.5 accent-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{d.name || `Dialplan ${d.id}`}</p>
                  {d.description && <p className="text-[10px] text-muted-foreground truncate">{d.description}</p>}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
