import { useState } from 'react'
import { ChevronLeft, Sparkles, Plus, Trash2, Loader2 } from 'lucide-react'
import { aiApi } from '@/api/ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Section } from '@/types/botCreate'

// ── Constants ─────────────────────────────────────────────────────────────────

export const SECTION_HINTS: Record<string, string> = {
  identite:     "Ex : \"Tu es Sophie, assistante de [Entreprise]. Mission : qualifier et orienter. Tu PEUX : prendre RDV, transférer, envoyer message. Tu NE PEUX PAS : confirmer prix, garantir disponibilité. Priorité : 1. Urgence → Transfer. 2. Demande d'un humain → Transfer. 3. Cas principal. 4. FAQ. 5. Prise de message.\"",
  comportement: "Ex : Professionnel et chaleureux. Une seule question à la fois. 2 phrases max par tour. Appels d'outils silencieux. Confirmer numéros par groupes de 2. NE JAMAIS : 2 questions, inventer, annoncer outil, raccrocher sans clôture, Hangup() après Transfer().",
  informations: "Ex : Horaires d'ouverture, contacts, produits/services clés. Règle absolue : ne jamais inventer ni proposer une information absente de ce prompt.",
  outils:       "Ex : Transfer(FWD_commercial) — quand l'appelant demande le commercial. SendMessage([groupe], \"Rappel : {NOM} {NUMERO} — {MOTIF}\") — après collecte validée. Hangup() — après confirmation.",
  scenarios:    "Ex : 1. ACCUEIL. 2. QUALIFICATION. SI commercial → Transfer(FWD_commercial). SI support → collecter nom/tel/motif → SendMessage → Hangup. Incompréhension × 2 → \"Pouvez-vous reformuler ?\". Incompréhension × 3 → Transfer(FWD_standard).",
  exemples:     "Ex :\nAppelant : Bonjour, je voudrais prendre rendez-vous.\nBot : Bien sûr ! Quel jour vous conviendrait ?\n\nAppelant : Pardon ?\nBot : Je vous demandais quelle date vous préférez.",
}

export const EMPTY_SECTIONS: Section[] = [
  { key: 'identite',     title: 'IDENTITÉ & MISSION',             content: '' },
  { key: 'comportement', title: 'COMPORTEMENT & RÈGLES',           content: '' },
  { key: 'informations', title: 'INFORMATIONS MÉTIER',             content: '' },
  { key: 'outils',       title: 'OUTILS & ACTIONS AUTOMATIQUES',   content: '' },
  { key: 'scenarios',    title: 'SCÉNARIOS & DÉROULÉ',             content: '' },
  { key: 'exemples',     title: 'EXEMPLES DE DIALOGUES',           content: '', optional: true },
]

// ── SectionCard ───────────────────────────────────────────────────────────────

export function SectionCard({
  sec, language, onUpdate, onDelete,
}: {
  sec: Section
  language: string
  onUpdate: (field: 'title' | 'content', val: string) => void
  onDelete: () => void
}) {
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineReq,  setRefineReq]  = useState('')
  const [refining,   setRefining]   = useState(false)

  async function handleRefine() {
    if (!refineReq.trim()) return
    setRefining(true)
    try {
      const res = await aiApi.refineSection({
        sectionTitle: sec.title,
        sectionContent: sec.content,
        userRequest: refineReq.trim(),
        language,
      })
      onUpdate('content', res.content)
      setRefineOpen(false)
      setRefineReq('')
    } catch { /* keep open on error */ }
    finally { setRefining(false) }
  }

  return (
    <div className={`rounded-lg border bg-white p-4 space-y-2 ${sec.optional ? 'border-dashed border-gray-300' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            className="flex-1 text-xs font-semibold uppercase tracking-widest text-gray-600 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-200 rounded px-1 py-0.5"
            value={sec.title}
            onChange={(e) => onUpdate('title', e.target.value.toUpperCase())}
          />
          {sec.optional && (
            <span className="text-[10px] font-medium text-gray-400 border border-gray-300 border-dashed rounded px-1.5 py-0.5 shrink-0">
              optionnel
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setRefineOpen(v => !v); setRefineReq('') }}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
              refineOpen
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
            }`}
            title="Affiner avec l'IA"
          >
            <Sparkles size={11} /> IA
          </button>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <textarea
        className="w-full text-sm bg-gray-50 rounded-md border border-input px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        rows={Math.max(4, sec.content.split('\n').length + 1)}
        value={sec.content}
        placeholder={sec.optional ? 'Optionnel — laisser vide pour ne pas inclure dans le prompt' : undefined}
        onChange={(e) => onUpdate('content', e.target.value)}
      />

      {refineOpen && (
        <div className="rounded-md border border-purple-200 bg-purple-50/50 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-widest">{sec.title}</p>
          <textarea
            autoFocus
            className="w-full text-xs rounded-md border border-input bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={2}
            placeholder="Décrivez la modification souhaitée…"
            value={refineReq}
            onChange={e => setRefineReq(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine() }
              if (e.key === 'Escape') { setRefineOpen(false); setRefineReq('') }
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleRefine} disabled={!refineReq.trim() || refining}>
              {refining ? <><Loader2 size={11} className="animate-spin" /> Génération…</> : <><Sparkles size={11} /> Affiner</>}
            </Button>
            <button onClick={() => { setRefineOpen(false); setRefineReq('') }} className="text-xs text-gray-400 hover:text-gray-600">
              Annuler
            </button>
          </div>
        </div>
      )}

      {!refineOpen && SECTION_HINTS[sec.key] && (
        <p className="text-[11px] italic text-gray-400 leading-snug">{SECTION_HINTS[sec.key]}</p>
      )}
    </div>
  )
}

// ── SectionEditor ─────────────────────────────────────────────────────────────

export function SectionEditor({
  sections, setSections, onBack, backLabel = '← Changer de mode', welcomeMessage, language = 'Français',
}: {
  sections: Section[]
  setSections: (s: Section[]) => void
  onBack: () => void
  backLabel?: string
  welcomeMessage?: string
  language?: string
}) {
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [addingSection, setAddingSection]     = useState(false)

  function updateSection(key: string, field: 'title' | 'content', val: string) {
    setSections(sections.map(s => s.key === key ? { ...s, [field]: val } : s))
  }
  function deleteSection(key: string) {
    setSections(sections.filter(s => s.key !== key))
  }
  function addSection() {
    if (!newSectionTitle.trim()) return
    setSections([...sections, { key: `custom_${Date.now()}`, title: newSectionTitle.trim().toUpperCase(), content: '' }])
    setNewSectionTitle('')
    setAddingSection(false)
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft size={13} /> {backLabel}
      </button>

      {welcomeMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-[11px] font-semibold text-green-700 uppercase tracking-widest mb-1">Message d'accueil</p>
          <p className="text-sm text-green-900 italic">« {welcomeMessage} »</p>
        </div>
      )}

      <div className="space-y-3">
        {sections.map((sec) => (
          <SectionCard
            key={sec.key}
            sec={sec}
            language={language}
            onUpdate={(field, val) => updateSection(sec.key, field, val)}
            onDelete={() => deleteSection(sec.key)}
          />
        ))}
      </div>

      {addingSection ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 bg-gray-50">
          <Input
            autoFocus
            placeholder="Titre de la section…"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addSection()
              if (e.key === 'Escape') { setAddingSection(false); setNewSectionTitle('') }
            }}
            className="text-xs h-8"
          />
          <Button size="sm" onClick={addSection} disabled={!newSectionTitle.trim()} className="text-xs h-8 shrink-0">Ajouter</Button>
          <button onClick={() => { setAddingSection(false); setNewSectionTitle('') }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Annuler</button>
        </div>
      ) : (
        <button onClick={() => setAddingSection(true)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
          <Plus size={13} /> Ajouter une section
        </button>
      )}
    </div>
  )
}
