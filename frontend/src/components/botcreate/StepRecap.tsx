import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Info } from 'lucide-react'
import { dialplanApi } from '@/api/bots'
import type { BotDraft } from '@/types/botCreate'
import { Button } from '@/components/ui/button'

export function StepRecap({
  draft, set, onSubmit, submitting, rapport,
}: {
  draft: BotDraft
  set: (p: Partial<BotDraft>) => void
  onSubmit: () => void
  submitting: boolean
  rapport?: string
}) {
  const [promptOpen, setPromptOpen]   = useState(false)
  const [rapportOpen, setRapportOpen] = useState(true)

  const { data: dialplanData } = useQuery({
    queryKey: ['dialplan', draft.pbxId],
    queryFn: () => dialplanApi.list(draft.pbxId),
    enabled: !!draft.pbxId && draft.botType === 'voicebot',
  })
  const selectedDialplan = dialplanData?.dialplans.find(d => d.id === draft.dialplanId)

  return (
    <div className="space-y-6">
      {/* Summary table */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Récapitulatif</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{draft.botType === 'voicebot' ? 'VoiceBot WILMA' : 'ChatBot X-Bees'}</dd>

          <dt className="text-muted-foreground">Nom</dt>
          <dd className="font-medium">{draft.name || '--'}</dd>

          {draft.description && <>
            <dt className="text-muted-foreground">Description</dt>
            <dd className="truncate">{draft.description}</dd>
          </>}

          <dt className="text-muted-foreground">Etat</dt>
          <dd>{draft.enabled ? 'Actif' : 'Inactif'}</dd>

          <dt className="text-muted-foreground">Prompt</dt>
          <dd>
            {draft.systemPrompt
              ? `${draft.systemPrompt.length} caractères`
              : <span className="text-amber-600 text-xs">Non renseigné</span>}
          </dd>

          {draft.botType === 'voicebot' && draft.welcomeMessage && <>
            <dt className="text-muted-foreground">Message d'accueil</dt>
            <dd className="truncate">{draft.welcomeMessage}</dd>
          </>}

          {draft.botType === 'voicebot' && draft.voiceUrl && <>
            <dt className="text-muted-foreground">Voix</dt>
            <dd className="truncate font-mono text-xs">{draft.voiceUrl}</dd>
          </>}

          {draft.botType === 'voicebot' && <>
            <dt className="text-muted-foreground">Dialplan</dt>
            <dd>{selectedDialplan ? selectedDialplan.name : <span className="text-amber-600 text-xs">A configurer manuellement</span>}</dd>
          </>}

          {draft.botType === 'voicebot' && draft.embeddedToolsDraft.transfer.length > 0 && <>
            <dt className="text-muted-foreground">Transferts</dt>
            <dd>{draft.embeddedToolsDraft.transfer.filter(t => t.extension).length}/{draft.embeddedToolsDraft.transfer.length} configuré(s)</dd>
          </>}

          {draft.sendMessageTargets.length > 0 && <>
            <dt className="text-muted-foreground">SendMessage</dt>
            <dd>{draft.sendMessageTargets.length} destinataire(s)</dd>
          </>}

          {draft.wimToolsDraft.length > 0 && <>
            <dt className="text-muted-foreground">WIM Tools</dt>
            <dd>{draft.wimToolsDraft.length} associé(s)</dd>
          </>}
        </dl>
      </div>

      {/* Rapport de génération IA */}
      {rapport && (
        <div className="rounded-lg border border-blue-200 bg-blue-50">
          <button type="button" onClick={() => setRapportOpen(v => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-left">
            <Info size={13} className="text-blue-500 shrink-0" />
            <span className="text-xs font-semibold text-blue-800 flex-1">Rapport de génération IA</span>
            <span className="text-[10px] text-blue-400">{rapportOpen ? '▲' : '▼'}</span>
          </button>
          {rapportOpen && (
            <div className="px-4 pb-3 border-t border-blue-200">
              <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap mt-2">{rapport}</p>
            </div>
          )}
        </div>
      )}

      {/* System prompt collapsible editor */}
      <div className="rounded-lg border bg-card">
        <button type="button" onClick={() => setPromptOpen(v => !v)}
          className="flex items-center gap-2 w-full px-4 py-3 text-left">
          <span className="text-sm font-semibold flex-1">Prompt système</span>
          <span className="text-xs text-muted-foreground mr-2">
            {draft.systemPrompt ? `${draft.systemPrompt.length} car.` : 'Vide'}
          </span>
          <ChevronRight size={14} className={`shrink-0 transition-transform text-muted-foreground ${promptOpen ? 'rotate-90' : ''}`} />
        </button>
        {promptOpen && (
          <div className="px-4 pb-4 pt-1 border-t">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              rows={20}
              placeholder="Prompt système vide — revenez à l'étape Prompt pour le générer."
              value={draft.systemPrompt}
              onChange={(e) => set({ systemPrompt: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Dialplan warning */}
      {draft.botType === 'voicebot' && draft.dialplanId === null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Dialplan non configuré</p>
          <p>Aucune entrée dialplan n'a été associée. Après création du bot, configurez une entrée dialplan dans votre PBX Wildix.</p>
        </div>
      )}

      <Button onClick={onSubmit} disabled={submitting || !draft.name} className="w-full sm:w-auto">
        {submitting ? 'Création en cours...' : 'Créer le bot'}
      </Button>
    </div>
  )
}
