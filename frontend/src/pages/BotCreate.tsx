import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, ChevronLeft, Bot } from 'lucide-react'
import { botsApi } from '@/api/bots'
import { usePbxStore } from '@/stores/pbx'
import type { VoiceBot, ChatBot } from '@/types/wildix'
import { Button } from '@/components/ui/button'
import { type BotDraft, type Section, type CreateMode, INITIAL } from '@/types/botCreate'
import { assemblePrompt, buildEmbeddedTools } from '@/components/botcreate/helpers'
import { StepHeader, STEPS } from '@/components/botcreate/StepHeader'
import { Step1 } from '@/components/botcreate/Step1Identity'
import { Step2 } from '@/components/botcreate/Step2Prompt'
import { StepOutilsEtParametres } from '@/components/botcreate/StepTools'
import { StepVoix } from '@/components/botcreate/StepVoice'
import { StepRecap } from '@/components/botcreate/StepRecap'

export default function BotCreate() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const qc             = useQueryClient()
  const { selectedPbxId } = usePbxStore()

  const [step, setStep]   = useState(0)
  const [draft, setDraft] = useState<BotDraft>({
    ...INITIAL,
    pbxId: searchParams.get('pbxId') ?? selectedPbxId,
  })

  const [createMode, setCreateMode]         = useState<CreateMode>(null)
  const [aiGenerated, setAiGenerated]       = useState(false)
  const [manualSections, setManualSections] = useState<Section[]>([])
  const [rapport, setRapport]               = useState('')

  function set(partial: Partial<BotDraft>) {
    setDraft((d) => ({ ...d, ...partial }))
  }

  // Sync sections → systemPrompt for manual/assisted modes
  useEffect(() => {
    if ((createMode !== 'manual' && createMode !== 'assisted') || manualSections.length === 0) return
    set({ systemPrompt: assemblePrompt(manualSections) })
  }, [manualSections, createMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = [
    draft.pbxId !== '' && draft.name.trim() !== '',
    createMode === 'manual' ? true : createMode === 'ai' ? aiGenerated : createMode === 'assisted' ? manualSections.length > 0 : false,
    true,
    true,
    true,
  ]

  const createMut = useMutation({
    mutationFn: async () => {
      if (draft.botType === 'voicebot') {
        const embeddedTools = buildEmbeddedTools(draft.embeddedToolsDraft)
        const capabilities = draft.wimToolsDraft.map(t => ({
          tool: {
            id: t.toolId,
            ...(Object.keys(t.variables).length > 0 && {
              variables: Object.entries(t.variables)
                .filter(([, v]) => v !== '')
                .map(([name, value]) => ({ name, value })),
            }),
          },
        }))
        return botsApi.create(draft.pbxId, {
          name:        draft.name.trim(),
          description: draft.description.trim() || undefined,
          message:     draft.welcomeMessage.trim() || undefined,
          endpoint:    { llm: { prompt: draft.systemPrompt.trim(), ...(embeddedTools.length > 0 && { embeddedTools }) } },
          pipeline:    { interuptionsEnabled: draft.interruptionsEnabled, silenceTimeout: draft.silenceTimeout, maximumDuration: draft.maxCallDuration },
          ...(capabilities.length > 0 && { capabilities }),
        } as Partial<VoiceBot>)
      }
      return botsApi.create(draft.pbxId, {
        name:        draft.name.trim(),
        description: draft.description.trim() || undefined,
      } as Partial<ChatBot>)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] })
      toast.success(`Bot "${draft.name}" créé avec succès`)
      navigate(`/bots?pbxId=${draft.pbxId}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="max-w-3xl space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1"
        >
          <ChevronLeft size={16} /> Retour
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Bot size={20} />
        <h1 className="text-xl font-semibold">Créer un bot</h1>
      </div>

      <StepHeader current={step} />

      <div className="rounded-lg border bg-card p-6 min-h-[320px]">
        {step === 0 && <Step1 draft={draft} set={set} />}
        {step === 1 && (
          <Step2
            draft={draft} set={set}
            createMode={createMode} setCreateMode={setCreateMode}
            aiGenerated={aiGenerated}
            onAiGenerated={() => setAiGenerated(true)}
            manualSections={manualSections} setManualSections={setManualSections}
            onRapportGenerated={(r) => setRapport(r)}
          />
        )}
        {step === 2 && <StepOutilsEtParametres draft={draft} set={set} />}
        {step === 3 && <StepVoix draft={draft} set={set} />}
        {step === 4 && (
          <StepRecap
            draft={draft} set={set}
            onSubmit={() => createMut.mutate()}
            submitting={createMut.isPending}
            rapport={rapport}
          />
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => step === 0 ? navigate(-1) : setStep((s) => s - 1)}>
          <ChevronLeft size={16} />
          {step === 0 ? 'Annuler' : 'Précédent'}
        </Button>
        {step < STEPS.length - 1 && (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext[step]}>
            Suivant <ChevronRight size={16} />
          </Button>
        )}
      </div>
    </div>
  )
}
