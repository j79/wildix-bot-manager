import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronLeft, Bot, Save, ChevronRight, PhoneCall, PhoneOff, Clock,
  Sparkles, Plus, Trash2, Wrench, Loader2, AlertTriangle, Wand2, PenLine,
} from 'lucide-react'
import { botsApi, toolsApi, dialplanApi } from '@/api/bots'
import { aiApi } from '@/api/ai'
import type { VoiceBot, ChatBot, WimTool, VoiceBotEmbeddedTool } from '@/types/wildix'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types locaux ──────────────────────────────────────────────────────────────

interface TransferRule {
  id: string; name: string; description: string; context: string; extension: string
}
interface EmbToolDraft {
  enabled: boolean; description: string; context: string
}
interface EmbeddedDraft {
  transfer: TransferRule[]; hangup: EmbToolDraft; wait: EmbToolDraft
}
interface WimToolDraft {
  toolId: string; variables: Record<string, string>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiToEmbedded(tools: VoiceBotEmbeddedTool[] | undefined): EmbeddedDraft {
  const arr = tools ?? []
  return {
    transfer: arr
      .filter((t: VoiceBotEmbeddedTool) => t.type === 'TRANSFER')
      .map((t: VoiceBotEmbeddedTool, i: number) => ({
        id: `t_${i}`,
        name: t.name ?? '',
        description: t.parameters?.description ?? '',
        context: t.parameters?.context ?? '',
        extension: t.parameters?.extension ?? '',
      })),
    hangup: (() => {
      const h = arr.find((t: VoiceBotEmbeddedTool) => t.type === 'HANGUP')
      return h
        ? { enabled: true,  description: h.parameters?.description ?? "Fin d'appel",    context: h.parameters?.context ?? '' }
        : { enabled: true,  description: "Fin d'appel",                                  context: '' }
    })(),
    wait: (() => {
      const w = arr.find((t: VoiceBotEmbeddedTool) => t.type === 'WAIT')
      return w
        ? { enabled: true,  description: w.parameters?.description ?? 'Mise en attente', context: w.parameters?.context ?? '' }
        : { enabled: false, description: 'Mise en attente',                               context: '' }
    })(),
  }
}

function buildEmbedded(d: EmbeddedDraft) {
  const result: Array<{ type: string; name: string; parameters?: Record<string, string> }> = []
  for (const r of d.transfer) {
    if (!r.extension) continue  // Wildix requiert une extension pour tout TRANSFER
    result.push({ type: 'TRANSFER', name: r.name || 'Transfer', parameters: {
      extension:                    r.extension,
      ...(r.context     && { context:     r.context }),
      ...(r.description && { description: r.description }),
    }})
  }
  if (d.hangup.enabled) result.push({ type: 'HANGUP', name: 'Hangup', parameters: {
    ...(d.hangup.context && { context: d.hangup.context }),
    ...(d.hangup.description && { description: d.hangup.description }),
  }})
  if (d.wait.enabled) result.push({ type: 'WAIT', name: 'Wait', parameters: {
    ...(d.wait.context && { context: d.wait.context }),
    ...(d.wait.description && { description: d.wait.description }),
  }})
  return result
}

// ── CollapsibleSection ────────────────────────────────────────────────────────

function Section({ title, icon, badge, defaultOpen = true, children }: {
  title: string; icon: React.ReactNode; badge?: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex items-center gap-2 w-full px-4 py-3 text-left">
        {icon}
        <span className="text-sm font-semibold flex-1">{title}</span>
        {badge && <span className="text-xs text-muted-foreground mr-2">{badge}</span>}
        <ChevronRight size={14} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t space-y-4">{children}</div>}
    </div>
  )
}

// ── DialplanPicker (inline) ───────────────────────────────────────────────────

function DialplanPicker({ pbxId, value, onSelect }: { pbxId: string; value: string; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [expandedId, setExpanded] = useState<number | null>(null)
  const { data: dl } = useQuery({ queryKey: ['dialplan', pbxId], queryFn: () => dialplanApi.list(pbxId), enabled: !!pbxId && open, staleTime: 60_000 })
  const { data: detail, isLoading: loadingDetail } = useQuery({ queryKey: ['dialplan-detail', pbxId, expandedId], queryFn: () => dialplanApi.getDetail(pbxId, expandedId!), enabled: !!expandedId, staleTime: 60_000 })
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input className="font-mono text-xs flex-1" placeholder="Ex: 100, sales_queue" value={value} onChange={e => onSelect(e.target.value)} />
        {pbxId && <button type="button" onClick={() => setOpen(v => !v)}
          className={`shrink-0 px-2.5 rounded-md border text-xs transition-colors ${open ? 'bg-primary/10 border-primary/30 text-primary' : 'border-input text-muted-foreground hover:bg-muted'}`}>
          Dialplan
        </button>}
      </div>
      {open && (
        <div className="rounded-md border bg-card shadow-sm max-h-48 overflow-y-auto text-xs">
          {!dl ? <p className="px-3 py-2 text-muted-foreground flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Chargement…</p>
            : !dl.dialplans?.length ? <p className="px-3 py-2 text-muted-foreground">Aucune règle dialplan</p>
            : dl.dialplans.map(dp => (
              <div key={dp.id} className="border-b last:border-b-0">
                <button type="button" className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted"
                  onClick={() => setExpanded(expandedId === dp.id ? null : dp.id)}>
                  <ChevronRight size={11} className={`shrink-0 transition-transform ${expandedId === dp.id ? 'rotate-90' : ''}`} />
                  <span className="font-medium flex-1 text-left">{dp.name || `#${dp.id}`}</span>
                  {dp.description && <span className="text-muted-foreground truncate max-w-[140px]">{dp.description}</span>}
                </button>
                {expandedId === dp.id && (
                  loadingDetail ? <div className="pl-7 py-1.5 text-muted-foreground flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Chargement…</div>
                    : detail?.numbers?.length ? detail.numbers.map(n => (
                      <button key={n.number} type="button" className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 hover:bg-blue-50 text-left"
                        onClick={() => { onSelect(n.number); setOpen(false); setExpanded(null) }}>
                        <span className="font-mono text-primary">{n.number}</span>
                        {n.comment && <span className="text-muted-foreground ml-1">{n.comment}</span>}
                      </button>
                    )) : <p className="pl-7 py-1.5 text-muted-foreground">Aucun numéro</p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ── Main BotEdit ──────────────────────────────────────────────────────────────

export default function BotEdit() {
  const { id }         = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const qc             = useQueryClient()

  const pbxId     = searchParams.get('pbxId') ?? ''
  const type      = (searchParams.get('type') ?? 'voicebot') as 'voicebot' | 'chatbot'
  const isVoice   = type === 'voicebot'

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', description: '', enabled: true,
    systemPrompt: '', welcomeMessage: '',
    interruptionsEnabled: true, silenceTimeout: 3, maxCallDuration: 300,
  })
  const [embedded, setEmbedded]   = useState<EmbeddedDraft>({ transfer: [], hangup: { enabled: true, description: "Fin d'appel", context: '' }, wait: { enabled: false, description: 'Mise en attente', context: '' } })
  const [wimDraft, setWimDraft]   = useState<WimToolDraft[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [toolsSnapshot, setToolsSnapshot] = useState<string>('')
  const [toolsChanged, setToolsChanged] = useState(false)
  const [revising, setRevising] = useState(false)
  const [revisionMode, setRevisionMode] = useState<'analysis' | 'auto' | null>(null)
  const [revisionResult, setRevisionResult] = useState<string>('')

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: bot, isLoading, error } = useQuery({
    queryKey: ['bots', pbxId, id, type],
    queryFn: () => botsApi.get(id!, pbxId, type),
    enabled: !!id && !!pbxId,
  })

  const { data: wimTools = [] } = useQuery({
    queryKey: ['tools', pbxId],
    queryFn: () => toolsApi.list(pbxId),
    enabled: !!pbxId,
  })

  // ── Initialize from bot data ───────────────────────────────────────────────
  useEffect(() => {
    if (!bot) return
    const v = bot as VoiceBot
    setForm({
      name:                 bot.name ?? '',
      description:          bot.description ?? '',
      enabled:              bot.enabled ?? true,
      systemPrompt:         v.endpoint?.llm?.prompt ?? '',
      welcomeMessage:       v.message ?? '',
      interruptionsEnabled: v.pipeline?.interuptionsEnabled ?? true,
      silenceTimeout:       v.pipeline?.silenceTimeout ?? 3,
      maxCallDuration:      v.pipeline?.maximumDuration ?? 300,
    })
    if (isVoice) {
      const emb = apiToEmbedded(v.endpoint?.llm?.embeddedTools as VoiceBotEmbeddedTool[] | undefined)
      setEmbedded(emb)
      setToolsSnapshot(JSON.stringify(emb))
      setWimDraft(
        (v.capabilities ?? [])
          .filter(c => !!c.tool?.id)
          .map(c => ({
            toolId: c.tool!.id,
            variables: Object.fromEntries(
              ((c.tool!.variables ?? []) as { name: string; value: string }[]).map(vv => [vv.name, vv.value])
            ),
          }))
      )
    }
  }, [bot, isVoice])

  // ── Detect tool changes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!toolsSnapshot) return
    const changed = JSON.stringify(embedded) !== toolsSnapshot
    setToolsChanged(changed)
    if (!changed) { setRevisionMode(null); setRevisionResult('') }
  }, [embedded, toolsSnapshot])

  // ── Revision IA du prompt ──────────────────────────────────────────────────
  async function handleRevise(mode: 'analysis' | 'auto') {
    setRevising(true)
    setRevisionMode(mode)
    setRevisionResult('')
    try {
      const toolsBefore = JSON.parse(toolsSnapshot)
      const toolsAfter  = embedded
      const prompt = mode === 'analysis'
        ? `Analyse le prompt système ci-dessous et les changements d'outils apportés. Liste précisément les parties du prompt à modifier, ajouter ou supprimer pour refléter les nouveaux outils. Sois concis et opérationnel.\n\nOutils AVANT :\n${JSON.stringify(toolsBefore, null, 2)}\n\nOutils APRÈS :\n${JSON.stringify(toolsAfter, null, 2)}\n\nPrompt actuel :\n${form.systemPrompt}`
        : `Révise le prompt système ci-dessous pour le mettre en cohérence avec les nouveaux outils configurés. Retourne UNIQUEMENT le prompt révisé, sans explication, en conservant exactement la même structure en sections.\n\nOutils AVANT :\n${JSON.stringify(toolsBefore, null, 2)}\n\nOutils APRÈS :\n${JSON.stringify(toolsAfter, null, 2)}\n\nPrompt à réviser :\n${form.systemPrompt}`

      let result = ''
      await aiApi.chatStream(
        [{ role: 'user', content: prompt }],
        'Tu es un expert en configuration de VoiceBots Wildix WILMA. Réponds en français.',
        chunk => { result += chunk; setRevisionResult(result) }
      )
      if (mode === 'auto') {
        set('systemPrompt', result.trim())
        setToolsSnapshot(JSON.stringify(embedded))
        setToolsChanged(false)
        setRevisionMode(null)
        setRevisionResult('')
        toast.success('Prompt mis à jour automatiquement')
      }
    } catch { toast.error('Erreur lors de la révision') }
    finally { setRevising(false) }
  }

  // ── AI suggest tools ───────────────────────────────────────────────────────
  async function suggest() {
    if (!form.systemPrompt.trim()) return
    setSuggesting(true)
    try {
      const res = await aiApi.suggestEmbeddedTools({ systemPrompt: form.systemPrompt })
      setEmbedded({
        transfer: (res.transfer ?? []).map((t, i) => ({
          id: `t_${Date.now()}_${i}`,
          name: t.name ?? '', description: t.description ?? '',
          context: t.context ?? '', extension: '',
        })),
        hangup: res.hangup ? { enabled: true, description: res.hangup.description ?? "Fin d'appel", context: res.hangup.context ?? '' } : { enabled: true, description: "Fin d'appel", context: '' },
        wait:   res.wait   ? { enabled: true, description: res.wait.description   ?? 'Mise en attente', context: res.wait.context ?? '' }   : { enabled: false, description: 'Mise en attente', context: '' },
      })
    } catch { toast.error("Erreur lors de l'analyse du prompt") }
    finally { setSuggesting(false) }
  }

  // ── Embedded tool helpers ──────────────────────────────────────────────────
  function setEmb(patch: Partial<EmbeddedDraft>) { setEmbedded(e => ({ ...e, ...patch })) }
  function addRule() { setEmbedded(e => ({ ...e, transfer: [...e.transfer, { id: `t_${Date.now()}`, name: '', description: '', context: '', extension: '' }] })) }
  function updateRule(id: string, f: keyof TransferRule, v: string) { setEmbedded(e => ({ ...e, transfer: e.transfer.map(r => r.id === id ? { ...r, [f]: v } : r) })) }
  function removeRule(id: string) { setEmbedded(e => ({ ...e, transfer: e.transfer.filter(r => r.id !== id) })) }

  // ── WIM tool helpers ───────────────────────────────────────────────────────
  function toggleWim(toolId: string) {
    setWimDraft(d => d.some(t => t.toolId === toolId) ? d.filter(t => t.toolId !== toolId) : [...d, { toolId, variables: {} }])
  }
  function updateWimVar(toolId: string, varName: string, value: string) {
    setWimDraft(d => d.map(t => t.toolId === toolId ? { ...t, variables: { ...t.variables, [varName]: value } } : t))
  }

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => {
      if (isVoice) {
        const embTools = buildEmbedded(embedded)
        const capabilities = wimDraft.map(t => ({
          tool: {
            id: t.toolId,
            ...(Object.keys(t.variables).length > 0 && {
              variables: Object.entries(t.variables).filter(([, v]) => v !== '').map(([name, value]) => ({ name, value })),
            }),
          },
        }))
        return botsApi.update(id!, pbxId, {
          name:        form.name.trim(),
          description: form.description.trim() || null,
          enabled:     form.enabled,
          message:     form.welcomeMessage.trim() || null,
          endpoint:    { llm: { prompt: form.systemPrompt.trim(), embeddedTools: embTools } },
          pipeline:    { interuptionsEnabled: form.interruptionsEnabled, silenceTimeout: form.silenceTimeout, maximumDuration: form.maxCallDuration },
          ...(capabilities.length > 0 && { capabilities }),
        } as Partial<VoiceBot>, 'voicebot')
      }
      return botsApi.update(id!, pbxId, {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        enabled:     form.enabled,
      } as Partial<ChatBot>, 'chatbot')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots', pbxId] })
      toast.success('Bot mis à jour')
      navigate(`/bots?pbxId=${pbxId}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!pbxId || !id) return <div className="text-sm text-muted-foreground">Paramètres manquants dans l'URL.</div>
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>
  if (error) return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      Impossible de charger le bot : {(error as Error).message}
    </div>
  )

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) { setForm(f => ({ ...f, [key]: val })) }

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="flex items-center gap-2 mb-2">
        <Bot size={20} />
        <h1 className="text-xl font-semibold">
          Modifier — {bot?.name}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {isVoice ? 'VoiceBot WILMA' : 'ChatBot X-Bees'}
          </span>
        </h1>
      </div>

      {/* ── Identité ─────────────────────────────────────────────────────── */}
      <Section title="Identité" icon={<Bot size={14} className="text-muted-foreground" />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nom *</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Input value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input id="enabled" type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} className="h-4 w-4" />
          <label htmlFor="enabled" className="text-sm">Bot actif</label>
        </div>
      </Section>

      {/* ── Prompt système ───────────────────────────────────────────────── */}
      <Section title="Prompt système" icon={<span className="text-xs font-mono text-muted-foreground">{ '{' }{ '}' }</span>}>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          rows={14}
          value={form.systemPrompt}
          onChange={e => set('systemPrompt', e.target.value)}
          placeholder="Instructions système pour le LLM…"
        />
      </Section>

      {/* ── Paramètres de l'appel (VoiceBot) ─────────────────────────────── */}
      {isVoice && (
        <Section title="Paramètres de l'appel" icon={<PhoneCall size={14} className="text-muted-foreground" />} defaultOpen={false}>
          <div className="space-y-1">
            <label className="text-sm font-medium">Message d'accueil</label>
            <Input value={form.welcomeMessage} onChange={e => set('welcomeMessage', e.target.value)} placeholder="Bonjour, comment puis-je vous aider ?" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Timeout silence (s)</label>
              <Input type="number" min={1} max={30} value={form.silenceTimeout} onChange={e => set('silenceTimeout', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Durée max appel (s)</label>
              <Input type="number" min={60} max={3600} value={form.maxCallDuration} onChange={e => set('maxCallDuration', Number(e.target.value))} />
            </div>
            <div className="space-y-1 flex flex-col justify-start">
              <label className="text-xs font-medium">Interruptions</label>
              <div className="flex items-center gap-2 mt-2">
                <input id="interruptions" type="checkbox" checked={form.interruptionsEnabled} onChange={e => set('interruptionsEnabled', e.target.checked)} className="h-4 w-4" />
                <label htmlFor="interruptions" className="text-sm">Autoriser</label>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Outils embarqués (VoiceBot) ───────────────────────────────────── */}
      {isVoice && (
        <Section title="Outils embarqués WILMA" icon={<PhoneCall size={14} className="text-blue-500" />}
          badge={`${embedded.transfer.length} transfert(s)`} defaultOpen={false}>

          {suggesting ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Analyse du prompt en cours…
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={suggest} disabled={!form.systemPrompt} className="gap-1.5">
                <Sparkles size={12} /> Analyser le prompt
              </Button>
            </div>
          )}

          {/* TRANSFER */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PhoneCall size={13} className="text-blue-500" />
              <p className="text-sm font-semibold">Transferts d'appel</p>
              <span className="ml-auto text-xs text-muted-foreground">{embedded.transfer.length} règle(s)</span>
            </div>
            {embedded.transfer.map(rule => (
              <div key={rule.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Input className="text-sm font-medium flex-1" placeholder="Nom (ex: Commercial, Support)" value={rule.name} onChange={e => updateRule(rule.id, 'name', e.target.value)} />
                  <button type="button" onClick={() => removeRule(rule.id)} className="mt-2 text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={14} /></button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Extension / Destination *</label>
                  <DialplanPicker pbxId={pbxId} value={rule.extension} onSelect={v => updateRule(rule.id, 'extension', v)} />
                  {!rule.extension && (
                    <p className="text-[11px] text-amber-600">⚠ Extension requise — cette règle ne sera pas enregistrée sans destination.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contexte — instructions LLM</label>
                  <textarea className="w-full text-xs bg-muted/30 rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none" rows={2}
                    placeholder="Quand déclencher ce transfert…" value={rule.context} onChange={e => updateRule(rule.id, 'context', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input className="text-xs" placeholder="Courte description" value={rule.description} onChange={e => updateRule(rule.id, 'description', e.target.value)} />
                </div>
              </div>
            ))}
            <button type="button" onClick={addRule} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus size={13} /> Ajouter une règle de transfert
            </button>
          </div>

          {/* HANGUP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PhoneOff size={13} className="text-red-500" />
              <p className="text-sm font-semibold">Raccrocher (Hangup)</p>
              <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="h-3.5 w-3.5" checked={embedded.hangup.enabled}
                  onChange={e => setEmb({ hangup: { ...embedded.hangup, enabled: e.target.checked } })} />
                <span className="text-xs text-muted-foreground">{embedded.hangup.enabled ? 'Activé' : 'Désactivé'}</span>
              </label>
            </div>
            {embedded.hangup.enabled && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contexte</label>
                  <textarea className="w-full text-xs bg-muted/30 rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none" rows={3}
                    placeholder="Quand raccrocher…" value={embedded.hangup.context}
                    onChange={e => setEmb({ hangup: { ...embedded.hangup, context: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input className="text-xs" value={embedded.hangup.description}
                    onChange={e => setEmb({ hangup: { ...embedded.hangup, description: e.target.value } })} placeholder="Fin d'appel" />
                </div>
              </div>
            )}
          </div>

          {/* WAIT */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-amber-500" />
              <p className="text-sm font-semibold">Mise en attente (Wait)</p>
              <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" className="h-3.5 w-3.5" checked={embedded.wait.enabled}
                  onChange={e => setEmb({ wait: { ...embedded.wait, enabled: e.target.checked } })} />
                <span className="text-xs text-muted-foreground">{embedded.wait.enabled ? 'Activé' : 'Désactivé'}</span>
              </label>
            </div>
            {embedded.wait.enabled && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contexte</label>
                  <textarea className="w-full text-xs bg-muted/30 rounded-md border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none" rows={2}
                    placeholder="Quand utiliser la mise en attente…" value={embedded.wait.context}
                    onChange={e => setEmb({ wait: { ...embedded.wait, context: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input className="text-xs" value={embedded.wait.description}
                    onChange={e => setEmb({ wait: { ...embedded.wait, description: e.target.value } })} placeholder="Mise en attente musicale" />
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── WIM Tools (VoiceBot) ──────────────────────────────────────────── */}
      {isVoice && (
        <Section title="WIM Tools" icon={<Wrench size={14} className="text-purple-500" />}
          badge={wimDraft.length > 0 ? `${wimDraft.length} sélectionné(s)` : undefined} defaultOpen={false}>
          {(wimTools as WimTool[]).length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Aucun WIM Tool disponible pour ce PBX.</p>
          ) : (
            <div className="space-y-2">
              {(wimTools as WimTool[]).map(tool => {
                const selected = wimDraft.find(t => t.toolId === tool.id)
                const vars = tool.input?.variables ?? []
                return (
                  <div key={tool.id} className={`rounded-lg border transition-colors ${selected ? 'border-purple-200 bg-purple-50/30' : 'bg-card'}`}>
                    <label className="flex items-start gap-3 p-3 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 mt-0.5 accent-purple-600" checked={!!selected} onChange={() => toggleWim(tool.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{tool.name}</p>
                          {tool.method && <span className="text-[10px] font-mono bg-muted rounded px-1.5 py-0.5">{tool.method}</span>}
                        </div>
                        {tool.description && <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>}
                      </div>
                    </label>
                    {selected && vars.length > 0 && (
                      <div className="px-4 pb-3 border-t pt-3 space-y-2">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Variables</p>
                        {vars.map(v => (
                          <div key={v.name} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              {v.name}{!v.optional && <span className="text-red-500 ml-0.5">*</span>}
                              {v.description && <span className="font-normal ml-1 text-[11px]">— {v.description}</span>}
                            </label>
                            <Input className="text-xs h-8" placeholder={`${v.type}${v.optional ? ' (optionnel)' : ''}`}
                              value={selected.variables[v.name] ?? ''}
                              onChange={e => updateWimVar(tool.id, v.name, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name.trim()}>
          <Save size={14} />
          {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
