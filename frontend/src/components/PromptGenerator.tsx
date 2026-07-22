import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Plus, Trash2, ChevronLeft, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { aiApi, type GeneratePromptParams } from '@/api/ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const LANG_MAP: Record<string, string> = {
  fr: 'Français', en: 'English', it: 'Italiano', es: 'Español', de: 'Deutsch',
}

const EMBEDDED_TOOLS = ['Transfer', 'Hangup', 'Wait']
const OPTIONAL_TOOLS = ['SendMessage', 'SendSMS', 'SendEmail', 'WebSearch', 'Webhooks', 'MCP']

const TOOL_LABELS: Record<string, string> = {
  Transfer:    'Transfer',
  Hangup:      'Hangup',
  Wait:        'Wait',
  Delegate:    'Delegate',
  SendMessage: 'SendMessage',
  SendSMS:     'SendSMS',
  SendEmail:   'SendEmail',
  WebSearch:   'WebSearch',
  Webhooks:    'Webhooks',
  MCP:         'MCP',
}

const TOOL_DESCS: Record<string, string> = {
  Transfer:    'Transfert d\'appel',
  Hangup:      'Raccrocher',
  Wait:        'Mise en attente',
  Delegate:    'Déléguer à un agent IA',
  SendMessage: 'Message interne Wildix',
  SendSMS:     'SMS externe',
  SendEmail:   'Email sortant',
  WebSearch:   'Recherche web',
  Webhooks:    'Appel API / Webhook',
  MCP:         'Intégration MCP',
}

interface Props {
  pbxId?: string
  botType: 'voicebot' | 'chatbot'
  onGenerated?: (prompt: string, welcomeMessage: string) => void
  onRapportGenerated?: (rapport: string) => void
  extraContextAdditions?: string
  defaultCompanyName?: string
}

interface Section {
  key: string
  title: string
  content: string
  optional?: boolean
}

const SECTION_HINTS: Record<string, string> = {
  identite:     'Ex : "Tu es Sophie, assistante de [Entreprise]. Mission : qualifier et orienter. Tu PEUX : prendre RDV, transférer, envoyer message. Tu NE PEUX PAS : confirmer prix, garantir disponibilité. Priorité : 1. Urgence → Transfer immédiat. 2. Demande d\'humain → Transfer. 3. Cas principal. 4. FAQ. 5. Prise de message."',
  comportement: 'Ex : Professionnel et chaleureux. Une seule question à la fois. 2 phrases max par tour. Appels outils silencieux. Confirmer numéros par groupes de 2. NE JAMAIS : 2 questions, inventer, annoncer outil, raccrocher sans clôture, Hangup() après Transfer().',
  informations: 'Ex : Horaires d\'ouverture, contacts, produits/services clés. Règle absolue : ne jamais inventer ni proposer une information absente de ce prompt.',
  outils:       'Ex : Transfer(FWD_commercial) — quand l\'appelant demande le commercial. SendMessage([groupe], "Rappel : {NOM} {NUMERO} — {MOTIF}") — après collecte validée. Hangup() — après confirmation.',
  scenarios:    'Ex : 1. ACCUEIL. 2. QUALIFICATION. SI commercial → Transfer(FWD_commercial). SI support → collecter nom/tel/motif → SendMessage → Hangup. Incompréhension ×2 → "Pouvez-vous reformuler ?". Incompréhension ×3 → Transfer(FWD_standard).',
  exemples:     'Ex :\nAppelant : Bonjour, je voudrais prendre rendez-vous.\nBot : Bien sûr ! Quel jour vous conviendrait ?\n\nAppelant : Pardon ?\nBot : Je vous demandais quelle date vous préférez pour votre rendez-vous.',
}

const TONES = ['Professionnel et courtois', 'Chaleureux et empathique', 'Formel et institutionnel', 'Dynamique et commercial']
const LANGUAGES = ['Français', 'English', 'Español', 'Italiano', 'Deutsch']

type Step = 'input' | 'generating' | 'editing'

function assemblePrompt(sections: Section[]): string {
  return sections
    .filter(s => !s.optional || s.content.trim())
    .map(s => `#### ${s.title}\n${s.content}`)
    .join('\n\n---\n\n')
}

export default function PromptGenerator({ pbxId, botType, onGenerated, onRapportGenerated, extraContextAdditions, defaultCompanyName }: Props) {
  const { i18n } = useTranslation()
  const defaultLang = LANG_MAP[i18n.language?.slice(0, 2)] ?? 'Français'
  const [step, setStep] = useState<Step>('input')
  const [form, setForm] = useState<Omit<GeneratePromptParams, 'pbxId' | 'botType' | 'declaredTools'>>({
    companyName: defaultCompanyName ?? '',
    industry: '',
    useCase: '',
    language: defaultLang,
    tone: 'Professionnel et courtois',
    extraContext: '',
  })
  const [selectedTools, setSelectedTools] = useState<string[]>([...EMBEDDED_TOOLS])
  const [sections, setSections] = useState<Section[]>([])
  const [welcomeMsg, setWelcomeMsg] = useState('')
  const [rapport, setRapport] = useState('')
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [rapportOpen, setRapportOpen] = useState(true)

  function toggleTool(tool: string) {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    )
  }

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  // Synchronize sections to parent draft on every edit (so 'Suivant' always sends current content)
  useEffect(() => {
    if (step !== 'editing' || sections.length === 0) return
    // eslint-disable-next-line react-hooks/exhaustive-deps
    onGenerated?.(assemblePrompt(sections), welcomeMsg)
  }, [sections, welcomeMsg, step]) // onGenerated intentionally omitted (stable ref not guaranteed)

  async function handleGenerate() {
    if (!form.companyName || !form.industry || !form.useCase) {
      toast.error('Veuillez remplir les champs obligatoires')
      return
    }
    setStep('generating')
    try {
      const mergedExtraContext = [form.extraContext, extraContextAdditions].filter(Boolean).join('\n\n')
      const result = await aiApi.generatePrompt({ ...form, extraContext: mergedExtraContext, pbxId, botType, declaredTools: selectedTools })
      setSections(result.sections)
      setWelcomeMsg(result.welcomeMessage ?? '')
      setRapport(result.rapport ?? '')
      setRapportOpen(true)
      onRapportGenerated?.(result.rapport ?? '')
      setStep('editing')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de génération')
      setStep('input')
    }
  }

  function updateSection(key: string, field: 'title' | 'content', val: string) {
    setSections(s => s.map(sec => sec.key === key ? { ...sec, [field]: val } : sec))
  }

  function deleteSection(key: string) {
    setSections(s => s.filter(sec => sec.key !== key))
  }

  function addSection() {
    if (!newSectionTitle.trim()) return
    setSections(s => [...s, { key: `custom_${Date.now()}`, title: newSectionTitle.trim().toUpperCase(), content: '' }])
    setNewSectionTitle('')
    setAddingSection(false)
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-500">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium">Génération du prompt en cours…</p>
        <p className="text-xs text-gray-400">Le LLM construit les 6 sections de votre prompt</p>
      </div>
    )
  }

  // ── Editing state ─────────────────────────────────────────────────────────────
  if (step === 'editing') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep('input')}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft size={13} /> Régénérer
          </button>
        </div>

        {/* Rapport de génération */}
        {rapport && (
          <div className="rounded-lg border border-blue-200 bg-blue-50">
            <button
              onClick={() => setRapportOpen(v => !v)}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-left"
            >
              <Info size={13} className="text-blue-500 shrink-0" />
              <span className="text-xs font-semibold text-blue-800 flex-1">Rapport de génération</span>
              <span className="text-[10px] text-blue-400">{rapportOpen ? '▲' : '▼'}</span>
            </button>
            {rapportOpen && (
              <div className="px-4 pb-3">
                <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">{rapport}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {sections.map((sec) => (
            <div key={sec.key} className="rounded-lg border bg-white p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  className="flex-1 text-xs font-semibold uppercase tracking-widest text-gray-600 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-200 rounded px-1 py-0.5"
                  value={sec.title}
                  onChange={(e) => updateSection(sec.key, 'title', e.target.value.toUpperCase())}
                />
                <button
                  onClick={() => deleteSection(sec.key)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  title="Supprimer cette section"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <textarea
                className="w-full text-sm bg-gray-50 rounded-md border border-input px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                rows={Math.max(4, sec.content.split('\n').length + 1)}
                value={sec.content}
                onChange={(e) => updateSection(sec.key, 'content', e.target.value)}
              />
              {SECTION_HINTS[sec.key] && (
                <p className="text-[11px] italic text-gray-400 leading-snug">
                  {SECTION_HINTS[sec.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        {addingSection ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 bg-gray-50">
            <Input
              autoFocus
              placeholder="Titre de la section (ex : ESCALADE, TARIFS, HORAIRES…)"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addSection()
                if (e.key === 'Escape') { setAddingSection(false); setNewSectionTitle('') }
              }}
              className="text-xs h-8"
            />
            <Button size="sm" onClick={addSection} disabled={!newSectionTitle.trim()} className="text-xs h-8 shrink-0">
              Ajouter
            </Button>
            <button
              onClick={() => { setAddingSection(false); setNewSectionTitle('') }}
              className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingSection(true)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <Plus size={13} /> Ajouter une section
          </button>
        )}
      </div>
    )
  }

  // ── Input state ───────────────────────────────────────────────────────────────
  const canGenerate = !!form.companyName && !!form.industry && !!form.useCase

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">Nom de l'entreprise *</label>
          <Input
            placeholder="Acme Corp"
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Secteur d'activité *</label>
          <Input
            placeholder="Santé, Services, Retail, Finance…"
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Cas d'usage / Objectif *</label>
          <Input
            placeholder="Accueil téléphonique et prise de rendez-vous pour un cabinet médical"
            value={form.useCase}
            onChange={(e) => set('useCase', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Langue</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.language}
            onChange={(e) => set('language', e.target.value)}
          >
            {LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Ton</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.tone}
            onChange={(e) => set('tone', e.target.value)}
          >
            {TONES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Contexte supplémentaire</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={2}
            placeholder="Informations complémentaires (horaires, produits phares, procédures d'escalade, règles spécifiques…)"
            value={form.extraContext}
            onChange={(e) => set('extraContext', e.target.value)}
          />
        </div>

        {/* Tool selector */}
        <div className="space-y-2 sm:col-span-2">
          <label className="text-xs font-medium">Outils disponibles sur ce bot</label>
          <div className="rounded-lg border border-input bg-background p-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Embarqués — toujours disponibles</p>
              <div className="flex flex-wrap gap-2">
                {EMBEDDED_TOOLS.map(tool => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={`flex flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                      selectedTools.includes(tool)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-xs font-semibold">{TOOL_LABELS[tool]}</span>
                    <span className="text-[10px] opacity-70">{TOOL_DESCS[tool]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Optionnels — cocher ceux configurés</p>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_TOOLS.map(tool => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={`flex flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                      selectedTools.includes(tool)
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-input text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-xs font-semibold">{TOOL_LABELS[tool]}</span>
                    <span className="text-[10px] opacity-70">{TOOL_DESCS[tool]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={!canGenerate}>
        <Sparkles size={16} /> Générer le prompt IA
      </Button>
    </div>
  )
}
