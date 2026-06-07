import { useState, useRef } from 'react'
import { Scale, Loader2, Sparkles, StopCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { aiApi } from '@/api/ai'
import { Button } from '@/components/ui/button'
import type { VoiceBot, ChatBot } from '@/types/wildix'

type AnyBot = VoiceBot | ChatBot

function isVoiceBot(bot: AnyBot): bot is VoiceBot {
  return 'pipeline' in bot || 'endpoint' in bot || 'message' in bot
}

// -- Champs de comparaison pour le tableau Apercu ----------------------------

interface Field {
  label: string
  get: (bot: AnyBot) => string
}

const VOICEBOT_FIELDS: Field[] = [
  { label: 'Nom',            get: b => b.name },
  { label: 'Actif',          get: b => ((b as VoiceBot).enabled !== false ? 'Oui' : 'Non') },
  { label: 'Message accueil',get: b => (b as VoiceBot).message?.slice(0, 60) ?? '--' },
  { label: 'Prompt',         get: b => {
    const p = (b as VoiceBot).endpoint?.llm?.prompt ?? ''
    return p ? `${p.length} car.` : '--'
  }},
  { label: 'Timeout silence',get: b => {
    const t = (b as VoiceBot).pipeline?.silenceTimeout
    return t != null ? `${t}s` : '--'
  }},
  { label: 'Durée max',      get: b => {
    const d = (b as VoiceBot).pipeline?.maximumDuration
    return d != null ? `${d}s` : '--'
  }},
  { label: 'Interruptions',  get: b => {
    const i = (b as VoiceBot).pipeline?.interuptionsEnabled
    return i != null ? (i ? 'Activées' : 'Désactivées') : '--'
  }},
  { label: 'Outils embarqués',get: b => String((b as VoiceBot).endpoint?.llm?.embeddedTools?.length ?? 0) },
  { label: 'WIM Tools',      get: b => String((b as VoiceBot).capabilities?.filter(c => c.tool?.id).length ?? 0) },
]

const CHATBOT_FIELDS: Field[] = [
  { label: 'Nom',        get: b => b.name },
  { label: 'Actif',      get: b => ((b as ChatBot).enabled !== false ? 'Oui' : 'Non') },
  { label: 'Description',get: b => (b as ChatBot).description?.slice(0, 60) ?? '--' },
  { label: 'Prompt',     get: b => {
    const p = (b as ChatBot).systemPrompt ?? ''
    return p ? `${p.length} car.` : '--'
  }},
  { label: 'Type intégration', get: b => (b as ChatBot).integrationType ?? '--' },
  { label: 'Accès',      get: b => (b as ChatBot).access ?? '--' },
]

// -- Tab: Apercu (tableau de comparaison) ------------------------------------

function OverviewTab({ botA, botB }: { botA: AnyBot; botB: AnyBot }) {
  const fields = isVoiceBot(botA) ? VOICEBOT_FIELDS : CHATBOT_FIELDS

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground w-36">Champ</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-primary">{botA.name}</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-primary">{botB.name}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(({ label, get }) => {
            const a = get(botA)
            const b = get(botB)
            const diff = a !== b
            return (
              <tr key={label} className={`border-b last:border-0 ${diff ? 'bg-amber-50' : ''}`}>
                <td className="py-2 px-3 text-xs text-muted-foreground">{label}</td>
                <td className={`py-2 px-3 text-xs ${diff ? 'font-medium text-amber-900' : ''}`}>{a}</td>
                <td className={`py-2 px-3 text-xs ${diff ? 'font-medium text-amber-900' : ''}`}>{b}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// -- Tab: Prompt (comparaison texte côte à côte) -----------------------------

function PromptTab({ botA, botB }: { botA: AnyBot; botB: AnyBot }) {
  const promptA = isVoiceBot(botA)
    ? (botA.endpoint?.llm?.prompt ?? '')
    : ((botA as ChatBot).systemPrompt ?? '')
  const promptB = isVoiceBot(botB)
    ? (botB.endpoint?.llm?.prompt ?? '')
    : ((botB as ChatBot).systemPrompt ?? '')

  const same = promptA === promptB

  return (
    <div className="space-y-2">
      {same && (
        <p className="text-xs text-green-600 font-medium">Les prompts sont identiques.</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-primary mb-1">{botA.name}</p>
          <pre className="text-xs bg-gray-50 rounded-lg border p-3 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed font-mono">
            {promptA || '(aucun prompt)'}
          </pre>
        </div>
        <div>
          <p className="text-xs font-medium text-primary mb-1">{botB.name}</p>
          <pre className="text-xs bg-gray-50 rounded-lg border p-3 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed font-mono">
            {promptB || '(aucun prompt)'}
          </pre>
        </div>
      </div>
    </div>
  )
}

// -- Tab: Config JSON --------------------------------------------------------

function ConfigTab({ botA, botB }: { botA: AnyBot; botB: AnyBot }) {
  function clean(bot: AnyBot) {
    const { id: _id, ...rest } = bot as AnyBot & { id: string }
    return rest
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-xs font-medium text-primary mb-1">{botA.name}</p>
        <pre className="text-xs bg-gray-50 rounded-lg border p-3 overflow-auto max-h-80 font-mono">
          {JSON.stringify(clean(botA), null, 2)}
        </pre>
      </div>
      <div>
        <p className="text-xs font-medium text-primary mb-1">{botB.name}</p>
        <pre className="text-xs bg-gray-50 rounded-lg border p-3 overflow-auto max-h-80 font-mono">
          {JSON.stringify(clean(botB), null, 2)}
        </pre>
      </div>
    </div>
  )
}

// -- Analyse IA --------------------------------------------------------------

function AIAnalysis({ botA, botB }: { botA: AnyBot; botB: AnyBot }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)

  async function analyze() {
    setText('')
    setLoading(true)

    const promptA = isVoiceBot(botA)
      ? (botA.endpoint?.llm?.prompt ?? '')
      : ((botA as ChatBot).systemPrompt ?? '')
    const promptB = isVoiceBot(botB)
      ? (botB.endpoint?.llm?.prompt ?? '')
      : ((botB as ChatBot).systemPrompt ?? '')

    const userMsg = [
      `Compare ces deux bots Wildix :`,
      ``,
      `Bot A : ${botA.name}`,
      promptA ? `Prompt (extrait) : ${promptA.slice(0, 700)}` : `(pas de prompt)`,
      ``,
      `Bot B : ${botB.name}`,
      promptB ? `Prompt (extrait) : ${promptB.slice(0, 700)}` : `(pas de prompt)`,
      ``,
      `Quelles sont les différences principales ? Si les deux bots n'ont aucun rapport, signale-le. Réponds en français en 3 à 5 phrases.`,
    ].join('\n')

    const systemPrompt =
      `Tu es un expert en configuration de VoiceBots Wildix WILMA. ` +
      `Tu analyses les différences entre deux bots de manière concise et pertinente. ` +
      `Tu réponds toujours en français.`

    let cancelled = false
    abortRef.current = () => { cancelled = true; setLoading(false) }

    try {
      await aiApi.chatStream(
        [{ role: 'user', content: userMsg }],
        systemPrompt,
        (chunk) => {
          if (!cancelled) setText(t => t + chunk)
        },
      )
    } catch (e) {
      if (!cancelled) setText(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  function stop() {
    abortRef.current?.()
    abortRef.current = null
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Sparkles size={13} className="text-primary" />
          {t('bots.compareAnalyze')}
        </p>
        {loading ? (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={stop}>
            <StopCircle size={12} /> {t('bots.compareStop')}
          </Button>
        ) : (
          <Button size="sm" className="h-7 text-xs gap-1" onClick={analyze}>
            <Sparkles size={12} /> {t('bots.compareAnalyze')}
          </Button>
        )}
      </div>
      {(text || loading) && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm leading-relaxed min-h-[60px]">
          {text || ''}
          {loading && <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse rounded-sm" />}
        </div>
      )}
    </div>
  )
}

// -- Composant principal ComparePanel ----------------------------------------

interface ComparePanelProps {
  bots: AnyBot[]
}

type TabKey = 'apercu' | 'prompt' | 'config'

export default function ComparePanel({ bots }: ComparePanelProps) {
  const { t } = useTranslation()
  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('apercu')

  const botA = bots.find(b => b.id === idA) ?? null
  const botB = bots.find(b => b.id === idB) ?? null
  const ready = !!botA && !!botB

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'apercu', label: t('bots.compareTabOverview') },
    { key: 'prompt', label: t('bots.compareTabPrompt') },
    { key: 'config', label: t('bots.compareTabConfig') },
  ]

  return (
    <div className="rounded-lg border bg-card">
      {/* Header avec sélecteurs */}
      <div className="flex items-center gap-3 p-4 border-b flex-wrap">
        <Scale size={16} className="text-muted-foreground shrink-0" />
        <p className="text-sm font-medium mr-1">Comparaison</p>

        <select
          className="flex-1 min-w-[180px] h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          value={idA}
          onChange={e => { setIdA(e.target.value); setActiveTab('apercu') }}
        >
          <option value="">{t('bots.compareSelectA')}</option>
          {bots.map(b => (
            <option key={b.id} value={b.id} disabled={b.id === idB}>{b.name}</option>
          ))}
        </select>

        <span className="text-xs text-muted-foreground">vs</span>

        <select
          className="flex-1 min-w-[180px] h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          value={idB}
          onChange={e => { setIdB(e.target.value); setActiveTab('apercu') }}
        >
          <option value="">{t('bots.compareSelectB')}</option>
          {bots.map(b => (
            <option key={b.id} value={b.id} disabled={b.id === idA}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Contenu */}
      {!ready ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Scale size={32} className="mb-2 opacity-30" />
          <p className="text-sm">{t('bots.comparePrompt')}</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Onglets */}
          <div className="flex gap-0 border-b">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenu de l'onglet actif */}
          {activeTab === 'apercu' && <OverviewTab botA={botA} botB={botB} />}
          {activeTab === 'prompt' && <PromptTab botA={botA} botB={botB} />}
          {activeTab === 'config' && <ConfigTab botA={botA} botB={botB} />}

          {/* Analyse IA */}
          <AIAnalysis botA={botA} botB={botB} />
        </div>
      )}
    </div>
  )
}
