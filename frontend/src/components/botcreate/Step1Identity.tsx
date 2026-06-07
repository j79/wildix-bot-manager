import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Mic, MessageSquare } from 'lucide-react'
import { pbxApi } from '@/api/pbx'
import { Input } from '@/components/ui/input'
import type { BotDraft } from '@/types/botCreate'

export function Step1({ draft, set }: { draft: BotDraft; set: (p: Partial<BotDraft>) => void }) {
  const { data: pbxList = [] } = useQuery({ queryKey: ['pbx'], queryFn: pbxApi.list })
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium mb-3">Type de bot *</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {(['voicebot', 'chatbot'] as const).map((type) => (
            <button key={type} type="button" onClick={() => set({ botType: type })}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                draft.botType === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}>
              {type === 'voicebot'
                ? <Mic size={24} className={draft.botType === type ? 'text-primary' : 'text-muted-foreground'} />
                : <MessageSquare size={24} className={draft.botType === type ? 'text-primary' : 'text-muted-foreground'} />}
              <span className="text-sm font-medium">{type === 'voicebot' ? 'VoiceBot WILMA' : 'ChatBot X-Bees'}</span>
              <span className="text-xs text-muted-foreground text-center">
                {type === 'voicebot' ? 'Bot telephonique vocal' : 'Bot de messagerie X-Bees'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 max-w-sm">
        <label className="text-sm font-medium">PBX cible *</label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={draft.pbxId}
          onChange={(e) => set({ pbxId: e.target.value })}
        >
          <option value="">-- Selectionner --</option>
          {pbxList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-sm">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nom du bot *</label>
          <Input
            placeholder={draft.botType === 'voicebot' ? 'Accueil Standard' : 'Support X-Bees'}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <Input
            placeholder="Courte description visible dans la liste"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Prénom du bot <span className="text-muted-foreground font-normal">(optionnel)</span></label>
          <Input
            placeholder="Ex : Sophie, Alex, Emma…"
            value={draft.botFirstName}
            onChange={(e) => {
              const name = e.target.value
              set({
                botFirstName: name,
                welcomeMessage: name.trim()
                  ? t('botCreate.welcomeGreeting', { name: name.trim() })
                  : '',
              })
            }}
          />
          {draft.botFirstName.trim() && (
            <p className="text-[11px] text-muted-foreground">
              {t('botCreate.botWelcomePreview')}{' '}
              <span className="italic">« {t('botCreate.welcomeGreeting', { name: draft.botFirstName.trim() })} »</span>
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Nom de la société <span className="text-muted-foreground font-normal">(optionnel)</span></label>
          <Input
            placeholder="Ex : Garage Dupont, Cabinet Martin…"
            value={draft.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="enabled" type="checkbox"
            checked={draft.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <label htmlFor="enabled" className="text-sm">Activer le bot a la creation</label>
        </div>
      </div>
    </div>
  )
}
