import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { aiApi } from '@/api/ai'
import { templatesApi, type BotTemplate, type BotTemplateInput } from '@/api/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DialogClose } from '@/components/ui/dialog'

// ── Constants ─────────────────────────────────────────────────────────────────

export const EMPTY_TEMPLATE_SECTIONS = [
  { key: 'identite',     title: 'IDENTITÉ & MISSION',            content: '' },
  { key: 'comportement', title: 'COMPORTEMENT & RÈGLES',          content: '' },
  { key: 'informations', title: 'INFORMATIONS MÉTIER',            content: '' },
  { key: 'outils',       title: 'OUTILS & ACTIONS AUTOMATIQUES',  content: '' },
  { key: 'scenarios',    title: 'SCÉNARIOS & DÉROULÉ',            content: '' },
  { key: 'exemples',     title: 'EXEMPLES DE DIALOGUES',          content: '' },
]

const LANG_FLAGS: Record<string, string> = {
  fr: '🇫🇷', en: '🇬🇧', it: '🇮🇹', es: '🇪🇸', de: '🇩🇪',
}

// ── TemplateSectionRow ────────────────────────────────────────────────────────

export function TemplateSectionRow({
  sec, onChange,
}: {
  sec: { key: string; title: string; content: string }
  onChange: (field: 'title' | 'content', val: string) => void
}) {
  const [open, setOpen]             = useState(sec.content.length > 0)
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineReq, setRefineReq]   = useState('')
  const [refining, setRefining]     = useState(false)

  async function handleRefine() {
    if (!refineReq.trim()) return
    setRefining(true)
    try {
      const res = await aiApi.refineSection({
        sectionTitle: sec.title,
        sectionContent: sec.content,
        userRequest: refineReq.trim(),
      })
      onChange('content', res.content)
      setRefineOpen(false)
      setRefineReq('')
    } catch { /* keep open */ }
    finally { setRefining(false) }
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-muted/50">
        {open
          ? <ChevronUp size={13} className="text-muted-foreground shrink-0" />
          : <ChevronDown size={13} className="text-muted-foreground shrink-0" />}
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-600 flex-1">{sec.title}</span>
        {sec.content && <span className="text-[10px] text-muted-foreground">{sec.content.length} car.</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t space-y-2">
          <textarea
            className="w-full text-xs bg-gray-50 rounded-md border border-input px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
            rows={Math.max(4, sec.content.split('\n').length + 1)}
            value={sec.content}
            onChange={e => onChange('content', e.target.value)}
            placeholder="Contenu de la section…"
          />
          {refineOpen ? (
            <div className="rounded-md border border-purple-200 bg-purple-50/50 p-2.5 space-y-2">
              <textarea autoFocus rows={2}
                className="w-full text-xs rounded-md border border-input bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Décrivez la modification…"
                value={refineReq}
                onChange={e => setRefineReq(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine() }
                  if (e.key === 'Escape') { setRefineOpen(false); setRefineReq('') }
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-xs gap-1" onClick={handleRefine} disabled={!refineReq.trim() || refining}>
                  {refining ? <><Loader2 size={10} className="animate-spin" /> Génération…</> : <><Sparkles size={10} /> Affiner</>}
                </Button>
                <button type="button" onClick={() => { setRefineOpen(false); setRefineReq('') }}
                  className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setRefineOpen(true)}
              className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-800 font-medium transition-colors">
              <Sparkles size={10} /> Affiner avec l'IA
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── TemplateModal ─────────────────────────────────────────────────────────────

export function TemplateModal({
  editing, onClose,
}: {
  editing: BotTemplate | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { i18n } = useTranslation()
  const lc = i18n.language?.slice(0, 2) ?? 'fr'
  const isNotFrench = lc !== 'fr'

  // For non-French UI: show translated values if available, otherwise French base
  const initName    = isNotFrench && editing?.translations?.[lc]?.name
    ? editing.translations[lc]!.name!
    : (editing?.name ?? '')
  const initSector  = isNotFrench && editing?.translations?.[lc]?.sector
    ? editing.translations[lc]!.sector!
    : (editing?.sector ?? '')
  const initUseCase = isNotFrench && editing?.translations?.[lc]?.useCase
    ? editing.translations[lc]!.useCase!
    : (editing?.useCase ?? '')

  const [form, setForm] = useState<BotTemplateInput>({
    name:         initName,
    icon:         editing?.icon         ?? '🤖',
    sector:       initSector,
    useCase:      initUseCase,
    sections:     (isNotFrench && editing?.translations?.[lc]?.sections?.length)
      ? editing.translations[lc]!.sections!.map(s => ({ ...s }))
      : (editing?.sections ?? EMPTY_TEMPLATE_SECTIONS.map(s => ({ ...s }))),
    translations: editing?.translations ?? {},
  })

  // Languages for which sections are already translated
  const translatedLangs = editing
    ? ['fr', ...Object.keys(editing.translations ?? {}).filter(k => !!(editing.translations?.[k]?.sections?.length))]
    : ['fr']

  // When not French: the French base name/sector/useCase comes from `editing`, form holds the current language values
  const baseName    = isNotFrench && editing ? (editing.name    ?? form.name)    : form.name
  const baseSector  = isNotFrench && editing ? (editing.sector  ?? form.sector)  : form.sector
  const baseUseCase = isNotFrench && editing ? (editing.useCase ?? form.useCase) : form.useCase

  const saveMut = useMutation({
    mutationFn: () => {
      const fullForm = {
        ...form,
        name:    baseName,
        sector:  baseSector,
        useCase: baseUseCase,
        sections: editing?.sections ?? form.sections,
      }
      return editing
        ? templatesApi.update(editing.id, fullForm)
        : templatesApi.create(fullForm)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success(editing ? 'Template mis à jour' : 'Template créé')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function updateSection(key: string, field: 'title' | 'content', val: string) {
    setForm(f => ({ ...f, sections: f.sections.map(s => s.key === key ? { ...s, [field]: val } : s) }))
  }

  const sec = (key: string) =>
    form.sections.find(s => s.key === key) ?? { key, title: key.toUpperCase(), content: '' }

  const fieldFlag = isNotFrench ? ` ${LANG_FLAGS[lc] ?? ''}` : ''

  return (
    <form onSubmit={e => { e.preventDefault(); saveMut.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Nom *{fieldFlag}</label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Garage automobile" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Icône (emoji)</label>
          <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
            placeholder="🔧" className="text-lg" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Secteur{fieldFlag}</label>
          <Input value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
            placeholder="Automobile" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Cas d'usage{fieldFlag}</label>
          <Input value={form.useCase} onChange={e => setForm(f => ({ ...f, useCase: e.target.value }))}
            placeholder="Prise de RDV, devis…" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sections du prompt 🇫🇷
          </p>
          <div className="flex items-center gap-1" title="Langues disponibles">
            {(['fr', 'en', 'it', 'es', 'de'] as const).map(code => (
              <span key={code} className={`text-sm leading-none ${translatedLangs.includes(code) ? '' : 'opacity-20'}`}>
                {LANG_FLAGS[code]}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {form.sections.map(s => (
            <TemplateSectionRow key={s.key} sec={sec(s.key)}
              onChange={(field, val) => updateSection(s.key, field, val)} />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </DialogClose>
        <Button type="submit" disabled={saveMut.isPending || !form.name.trim()}>
{saveMut.isPending
            ? <><Loader2 size={12} className="animate-spin" /> Enregistrement…</>
            : editing ? 'Mettre à jour' : 'Créer'
          }
        </Button>
      </div>
    </form>
  )
}
