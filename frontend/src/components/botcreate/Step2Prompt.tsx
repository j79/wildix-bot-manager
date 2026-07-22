import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Loader2, Check, Pencil, Eye, X, Sparkles } from 'lucide-react'
import { templatesApi, type BotTemplate } from '@/api/templates'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import PromptGenerator from '@/components/PromptGenerator'
import { TemplateModal } from '@/components/TemplateModal'
import { SectionEditor, EMPTY_SECTIONS } from '@/components/botcreate/SectionEditor'
import { LANG_MAP } from '@/components/botcreate/helpers'
import { Button } from '@/components/ui/button'
import type { BotDraft, CreateMode, Section } from '@/types/botCreate'

const LANG_FLAGS: Record<string, string> = {
  fr: '🇫🇷', en: '🇬🇧', it: '🇮🇹', es: '🇪🇸', de: '🇩🇪',
}

interface Props {
  draft: BotDraft
  set: (p: Partial<BotDraft>) => void
  createMode: CreateMode
  setCreateMode: (m: CreateMode) => void
  aiGenerated: boolean
  onAiGenerated: () => void
  manualSections: Section[]
  setManualSections: (s: Section[]) => void
  onRapportGenerated?: (rapport: string) => void
}

export function Step2({
  draft, set, createMode, setCreateMode,
  aiGenerated, onAiGenerated, manualSections, setManualSections,
  onRapportGenerated,
}: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(null)
  const [editingTemplate, setEditingTemplate]   = useState<BotTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate]   = useState<BotTemplate | null>(null)
  const { i18n } = useTranslation()
  const langCode    = i18n.language?.slice(0, 2) ?? 'fr'
  const currentLang = LANG_MAP[langCode] ?? 'Français'

  const { data: apiTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.list,
    staleTime: 60_000,
  })

  function applyTemplateSections(t: BotTemplate, sections: Array<{ key: string; title: string; content: string }>) {
    setSelectedTemplate(t)
    const finalSections = sections.map(s => {
      let content = s.content
      if (draft.botFirstName.trim()) content = content.split('[PRENOM]').join(draft.botFirstName.trim())
      if (draft.companyName.trim())  content = content.split('[ENTREPRISE]').join(draft.companyName.trim())
      return { ...s, content }
    })
    setManualSections(finalSections)
  }

  function applyTemplate(t: BotTemplate) {
    const sections = (langCode !== 'fr' && t.translations?.[langCode]?.sections?.length)
      ? t.translations[langCode].sections!
      : t.sections
    applyTemplateSections(t, sections)
  }

  // ── Mode choice ──────────────────────────────────────────────────────────────
  if (createMode === null) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold mb-1">Comment souhaitez-vous créer votre bot ?</p>
          <p className="text-xs text-muted-foreground">Choisissez le mode le plus adapté à votre situation.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button type="button"
            onClick={() => {
              setCreateMode('manual')
              setManualSections(EMPTY_SECTIONS.map(s => {
                if (s.key !== 'contexte') return s
                const who     = draft.botFirstName.trim() ? `Tu es ${draft.botFirstName.trim()}` : "Tu es un(e) assistant(e)"
                const company = draft.companyName.trim()  ? ` de ${draft.companyName.trim()}`    : ''
                return { ...s, content: `${who}${company}.\nMission : ` }
              }))
            }}
            className="flex flex-col items-start gap-3 rounded-xl border-2 border-border hover:border-gray-400 bg-card hover:bg-accent p-5 text-left transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl">✏️</div>
            <div>
              <p className="text-sm font-semibold">Création manuelle</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Rédigez vous-même chaque section du prompt. Idéal si vous avez déjà vos instructions.</p>
            </div>
          </button>

          <button type="button" onClick={() => setCreateMode('assisted')}
            className="flex flex-col items-start gap-3 rounded-xl border-2 border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 p-5 text-left transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl">🧩</div>
            <div>
              <p className="text-sm font-semibold text-primary">Création assistée</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Choisissez un template métier — les sections sont pré-remplies et affinables avec l'IA.</p>
            </div>
            <span className="text-[10px] font-semibold bg-primary/15 text-primary rounded-full px-2.5 py-0.5">Recommandé</span>
          </button>

          <button type="button" onClick={() => setCreateMode('ai')}
            className="flex flex-col items-start gap-3 rounded-xl border-2 border-border hover:border-purple-400/60 bg-card hover:bg-purple-50/40 p-5 text-left transition-all">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-xl">✨</div>
            <div>
              <p className="text-sm font-semibold">Créer avec l'IA</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Décrivez votre contexte en détail et l'IA construit les 9 sections du prompt.</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Manual ───────────────────────────────────────────────────────────────────
  if (createMode === 'manual') {
    return (
      <SectionEditor
        sections={manualSections}
        setSections={setManualSections}
        onBack={() => { setCreateMode(null); setManualSections([]) }}
        welcomeMessage={draft.welcomeMessage || undefined}
        language={currentLang}
      />
    )
  }

  // ── AI ────────────────────────────────────────────────────────────────────────
  if (createMode === 'ai') {
    return (
      <div className="space-y-4">
        <button onClick={() => setCreateMode(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft size={13} /> Changer de mode
        </button>
        <PromptGenerator
          pbxId={draft.pbxId}
          botType={draft.botType}
          onRapportGenerated={onRapportGenerated}
          extraContextAdditions={[
            draft.botFirstName.trim() ? `Prénom du bot : ${draft.botFirstName.trim()}` : '',
            draft.companyName.trim()  ? `Nom de la société : ${draft.companyName.trim()}` : '',
          ].filter(Boolean).join('\n') || undefined}
          defaultCompanyName={draft.companyName}
          onGenerated={(prompt, wm) => {
            set({ systemPrompt: prompt, welcomeMessage: wm || draft.welcomeMessage })
            onAiGenerated()
          }}
        />
        {aiGenerated && (
          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
            <Check size={12} /> Prompt récupéré — passez à l'étape suivante.
          </p>
        )}
      </div>
    )
  }

  // ── Assisted — sections affichées ─────────────────────────────────────────────
  if (manualSections.length > 0 && selectedTemplate) {
    return (
      <SectionEditor
        sections={manualSections}
        setSections={setManualSections}
        onBack={() => { setManualSections([]); setSelectedTemplate(null) }}
        backLabel="← Changer de template"
        welcomeMessage={draft.welcomeMessage || undefined}
        language={currentLang}
      />
    )
  }

  // ── Assisted — grille templates ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <button onClick={() => setCreateMode(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft size={13} /> Changer de mode
      </button>
      <div>
        <p className="text-sm font-medium mb-0.5">Choisissez un template métier</p>
        <p className="text-xs text-muted-foreground">
          Les sections sont pré-remplies dans la langue de l'interface. Modifiez-les ou affinez avec{' '}
          <span className="text-purple-600 font-medium">✨ IA</span>.
        </p>
      </div>

      {templatesLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 size={13} className="animate-spin" /> Chargement des templates…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {apiTemplates.map(t => {
            const displayName    = t.translations?.[langCode]?.name    ?? t.name
            const displayUseCase = t.translations?.[langCode]?.useCase ?? t.useCase
            const availableCodes = (['fr', 'en', 'it', 'es', 'de'] as const).filter(code =>
              code === 'fr' || !!(t.translations?.[code]?.name)
            )
            return (
              <div key={t.id} className="group relative rounded-lg border border-border hover:border-primary/50 bg-card hover:bg-accent transition-all">
                <button type="button" onClick={() => setPreviewTemplate(t)} className="flex items-start gap-2.5 p-3 text-left w-full">
                  <span className="text-2xl shrink-0 leading-none mt-0.5">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">{displayUseCase}</p>
                    <div className="flex gap-0.5 mt-1.5">
                      {availableCodes.map(code => (
                        <span
                          key={code}
                          className={`text-[11px] leading-none ${code === langCode ? '' : 'opacity-40'}`}
                          title={code}
                        >
                          {LANG_FLAGS[code]}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setEditingTemplate(t) }}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-all"
                  title="Modifier ce template"
                >
                  <Pencil size={11} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!editingTemplate} onOpenChange={v => { if (!v) setEditingTemplate(null) }}>
        <DialogContent title={editingTemplate ? `Modifier — ${editingTemplate.name}` : ''}>
          <TemplateModal editing={editingTemplate} onClose={() => setEditingTemplate(null)} />
        </DialogContent>
      </Dialog>

      {/* Preview template avant application */}
      <Dialog open={!!previewTemplate} onOpenChange={v => { if (!v) setPreviewTemplate(null) }}>
        <DialogContent title={previewTemplate ? `${previewTemplate.icon} ${previewTemplate.translations?.[langCode]?.name ?? previewTemplate.name}` : ''}>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-blue-50 border-blue-200 p-3">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-widest mb-1.5">Ce que fait ce bot</p>
                <p className="text-sm text-blue-900 leading-relaxed">
                  {previewTemplate.translations?.[langCode]?.useCase ?? previewTemplate.useCase}
                </p>
              </div>
              {(() => {
                const prompt = (previewTemplate.translations?.[langCode]?.sections ?? previewTemplate.sections)
                  .map(s => s.content).join(' ')
                const tools = [...new Set(
                  [...prompt.matchAll(/\[\[OUTIL_([^\]]+)\]\]/g)].map(m => m[1])
                )]
                return tools.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={11} /> Outils & intégrations requis
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map(tool => (
                        <span key={tool} className="text-[11px] font-mono bg-muted rounded px-2 py-0.5 text-muted-foreground">
                          {tool.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
              <div className="flex gap-2 pt-1 border-t justify-end">
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5"
                >
                  Annuler
                </button>
                <Button onClick={() => { applyTemplate(previewTemplate); setPreviewTemplate(null) }}>
                  Utiliser ce template
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
