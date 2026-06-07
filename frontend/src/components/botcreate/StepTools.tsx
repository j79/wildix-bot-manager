import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PhoneCall, PhoneOff, Clock, Sparkles, Plus, Trash2, Wrench, MessageSquare, Loader2 } from 'lucide-react'
import { toolsApi } from '@/api/bots'
import { aiApi } from '@/api/ai'
import type { WimTool } from '@/types/wildix'
import type { BotDraft, TransferRuleDraft, EmbeddedToolDraft } from '@/types/botCreate'
import { CollapsibleSection } from '@/components/botcreate/CollapsibleSection'
import { DialplanPicker } from '@/components/botcreate/DialplanPicker'
import { SendMessageRecipientsPicker } from '@/components/botcreate/SendMessagePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function StepOutilsEtParametres({ draft, set }: { draft: BotDraft; set: (p: Partial<BotDraft>) => void }) {
  const tools = draft.embeddedToolsDraft
  const [suggesting, setSuggesting]   = useState(false)
  const [hasSuggested, setHasSuggested] = useState(false)

  const { data: wimTools = [] } = useQuery({
    queryKey: ['tools', draft.pbxId],
    queryFn: () => toolsApi.list(draft.pbxId),
    enabled: !!draft.pbxId,
  })

  async function suggest() {
    if (!draft.systemPrompt.trim()) return
    setSuggesting(true)
    try {
      const res = await aiApi.suggestEmbeddedTools({ systemPrompt: draft.systemPrompt })
      set({
        embeddedToolsDraft: {
          transfer: (res.transfer ?? []).map((t, i) => ({
            id: `t_${Date.now()}_${i}`, name: t.name ?? '', description: t.description ?? '',
            context: t.context ?? '', extension: '',
          })),
          hangup: res.hangup ? { enabled: true, description: res.hangup.description ?? "Fin d'appel", context: res.hangup.context ?? '' } : { enabled: true, description: "Fin d'appel", context: '' },
          wait:   res.wait   ? { enabled: true, description: res.wait.description   ?? 'Mise en attente', context: res.wait.context ?? '' }   : { enabled: false, description: 'Mise en attente', context: '' },
        },
      })
      setHasSuggested(true)
    } catch { toast.error("Erreur lors de l'analyse du prompt") }
    finally { setSuggesting(false) }
  }

  useEffect(() => {
    if (!hasSuggested && !suggesting && draft.systemPrompt.trim() && tools.transfer.length === 0 && !tools.hangup.context) suggest()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function addRule() { set({ embeddedToolsDraft: { ...tools, transfer: [...tools.transfer, { id: `t_${Date.now()}`, name: '', description: '', context: '', extension: '' }] } }) }
  function updateRule(id: string, f: keyof TransferRuleDraft, v: string) { set({ embeddedToolsDraft: { ...tools, transfer: tools.transfer.map(r => r.id === id ? { ...r, [f]: v } : r) } }) }
  function removeRule(id: string) { set({ embeddedToolsDraft: { ...tools, transfer: tools.transfer.filter(r => r.id !== id) } }) }
  function setHangup(f: keyof EmbeddedToolDraft, v: string | boolean) { set({ embeddedToolsDraft: { ...tools, hangup: { ...tools.hangup, [f]: v } } }) }
  function setWait(f: keyof EmbeddedToolDraft, v: string | boolean)   { set({ embeddedToolsDraft: { ...tools, wait:   { ...tools.wait,   [f]: v } } }) }

  function toggleWimTool(toolId: string) {
    const current = draft.wimToolsDraft
    if (current.some(t => t.toolId === toolId)) set({ wimToolsDraft: current.filter(t => t.toolId !== toolId) })
    else set({ wimToolsDraft: [...current, { toolId, variables: {} }] })
  }
  function updateWimVariable(toolId: string, varName: string, value: string) {
    set({ wimToolsDraft: draft.wimToolsDraft.map(t => t.toolId === toolId ? { ...t, variables: { ...t.variables, [varName]: value } } : t) })
  }

  if (suggesting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-500">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium">Analyse du prompt en cours…</p>
        <p className="text-xs text-gray-400">Configuration des outils Transfer, Hangup et Wait</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">Configurez les outils et les paramètres du bot.</p>
        {draft.botType === 'voicebot' && (
          <Button variant="outline" size="sm" onClick={suggest} disabled={!draft.systemPrompt} className="gap-1.5 shrink-0">
            <Sparkles size={12} /> Analyser le prompt
          </Button>
        )}
      </div>

      {/* Outils embarqués WILMA — voicebot only */}
      {draft.botType === 'voicebot' && (
        <CollapsibleSection
          title="Outils embarqués WILMA"
          icon={<PhoneCall size={14} className="text-blue-500" />}
          badge={`${tools.transfer.length} transfert(s)`}
        >
          {/* TRANSFER */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PhoneCall size={14} className="text-blue-500" />
              <p className="text-sm font-semibold">Transfert d'appel</p>
              <span className="ml-auto text-xs text-muted-foreground">{tools.transfer.length} règle(s)</span>
            </div>
            {tools.transfer.map(rule => (
              <div key={rule.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Input className="text-sm font-medium flex-1" placeholder="Nom (ex: Commercial, Support)"
                    value={rule.name} onChange={e => updateRule(rule.id, 'name', e.target.value)} />
                  <button type="button" onClick={() => removeRule(rule.id)} className="mt-2 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Extension / Destination *</label>
                  <DialplanPicker pbxId={draft.pbxId} value={rule.extension} onSelect={v => updateRule(rule.id, 'extension', v)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contexte — instructions LLM</label>
                  <textarea className="w-full text-xs bg-muted/30 rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed" rows={3}
                    placeholder="Quand déclencher ce transfert…" value={rule.context} onChange={e => updateRule(rule.id, 'context', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input className="text-xs" placeholder="Courte description" value={rule.description} onChange={e => updateRule(rule.id, 'description', e.target.value)} />
                </div>
              </div>
            ))}
            <button type="button" onClick={addRule} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
              <Plus size={13} /> Ajouter une règle de transfert
            </button>
          </div>

          {/* HANGUP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PhoneOff size={14} className="text-red-500" />
              <p className="text-sm font-semibold">Raccrocher (Hangup)</p>
              <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="h-3.5 w-3.5" checked={tools.hangup.enabled}
                  onChange={e => setHangup('enabled', e.target.checked)} />
                <span className="text-xs text-muted-foreground">{tools.hangup.enabled ? 'Activé' : 'Désactivé'}</span>
              </label>
            </div>
            {tools.hangup.enabled && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contexte — circonstances autorisées</label>
                  <textarea className="w-full text-xs bg-muted/30 rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed" rows={3}
                    placeholder="Quand raccrocher : fin de demande résolue, au revoir…"
                    value={tools.hangup.context} onChange={e => setHangup('context', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input className="text-xs" value={tools.hangup.description}
                    onChange={e => setHangup('description', e.target.value)} placeholder="Fin d'appel" />
                </div>
              </div>
            )}
          </div>

          {/* WAIT */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              <p className="text-sm font-semibold">Mise en attente (Wait)</p>
              <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="h-3.5 w-3.5" checked={tools.wait.enabled}
                  onChange={e => setWait('enabled', e.target.checked)} />
                <span className="text-xs text-muted-foreground">{tools.wait.enabled ? 'Activé' : 'Désactivé'}</span>
              </label>
            </div>
            {tools.wait.enabled && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contexte — quand utiliser</label>
                  <textarea className="w-full text-xs bg-muted/30 rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed" rows={2}
                    placeholder="Mettre en attente si un traitement prend plus de quelques secondes…"
                    value={tools.wait.context} onChange={e => setWait('context', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input className="text-xs" value={tools.wait.description}
                    onChange={e => setWait('description', e.target.value)} placeholder="Mise en attente musicale" />
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* WIM Tools */}
      <CollapsibleSection
        title="WIM Tools"
        icon={<Wrench size={14} className="text-purple-500" />}
        badge={draft.wimToolsDraft.length > 0 ? `${draft.wimToolsDraft.length} sélectionné(s)` : undefined}
        defaultOpen={false}
      >
        {(wimTools as WimTool[]).length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Aucun WIM Tool disponible pour ce PBX.</p>
        ) : (
          <div className="space-y-2">
            {(wimTools as WimTool[]).map(tool => {
              const selected = draft.wimToolsDraft.find(t => t.toolId === tool.id)
              const vars = tool.input?.variables ?? []
              return (
                <div key={tool.id} className={`rounded-lg border transition-colors ${selected ? 'border-purple-200 bg-purple-50/30' : 'bg-card'}`}>
                  <label className="flex items-start gap-3 p-3 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 mt-0.5 accent-purple-600" checked={!!selected} onChange={() => toggleWimTool(tool.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{tool.name}</p>
                        {tool.method && <span className="text-[10px] font-mono bg-muted rounded px-1.5 py-0.5">{tool.method}</span>}
                      </div>
                      {tool.description && <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>}
                    </div>
                  </label>
                  {selected && vars.length > 0 && (
                    <div className="px-4 pb-3 space-y-2 border-t pt-3">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Variables</p>
                      {vars.map(v => (
                        <div key={v.name} className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            {v.name}{!v.optional && <span className="text-red-500 ml-0.5">*</span>}
                            {v.description && <span className="font-normal ml-1 text-[11px]">— {v.description}</span>}
                          </label>
                          <Input className="text-xs h-8" placeholder={`${v.type}${v.optional ? ' (optionnel)' : ''}`}
                            value={selected.variables[v.name] ?? ''} onChange={e => updateWimVariable(tool.id, v.name, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* SendMessage — destinataires */}
      <CollapsibleSection
        title="SendMessage — Destinataires"
        icon={<MessageSquare size={14} className="text-green-600" />}
        badge={draft.sendMessageTargets.length > 0 ? `${draft.sendMessageTargets.length} configuré(s)` : undefined}
        defaultOpen={false}
      >
        <SendMessageRecipientsPicker
          pbxId={draft.pbxId}
          targets={draft.sendMessageTargets}
          onChange={t => set({ sendMessageTargets: t })}
        />
      </CollapsibleSection>

      {/* Paramètres de l'appel — voicebot only */}
      {draft.botType === 'voicebot' && (
        <CollapsibleSection
          title="Paramètres de l'appel"
          icon={<Clock size={14} className="text-muted-foreground" />}
          defaultOpen={true}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Message d'accueil</label>
              <Input placeholder="Bonjour, comment puis-je vous aider ?" value={draft.welcomeMessage}
                onChange={(e) => set({ welcomeMessage: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Timeout silence (s)</label>
                <Input type="number" min={1} max={30} value={draft.silenceTimeout}
                  onChange={(e) => set({ silenceTimeout: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">Délai avant relance après silence</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Durée max appel (s)</label>
                <Input type="number" min={60} max={3600} value={draft.maxCallDuration}
                  onChange={(e) => set({ maxCallDuration: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">Ex : 300 = 5 minutes</p>
              </div>
              <div className="space-y-1 flex flex-col justify-start">
                <label className="text-xs font-medium">Interruptions</label>
                <div className="flex items-center gap-2 mt-2">
                  <input id="interruptions" type="checkbox" checked={draft.interruptionsEnabled}
                    onChange={(e) => set({ interruptionsEnabled: e.target.checked })} className="h-4 w-4" />
                  <label htmlFor="interruptions" className="text-sm">Autoriser l'interruption du bot</label>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
