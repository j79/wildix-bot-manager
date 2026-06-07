import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Bot, Mic, Search, RefreshCw, Sparkles, SortAsc, SortDesc,
  Phone, Copy, Plane, Pencil, Trash2, LayoutGrid,
  MessageSquare, Zap, Code2, ChevronDown,
  PhoneForwarded, UserCheck, PhoneOff, Clock, Globe, Wrench,
  BookOpen, Layers, GitCompare, Plus,
  Lock, Eye, EyeOff, Loader2, RotateCcw,
} from 'lucide-react'
import { botsApi, toolsApi, dialplanApi } from '@/api/bots'
import { pbxApi } from '@/api/pbx'
import { authApi } from '@/api/auth'
import { trashApi } from '@/api/trash'
import type { TrashedBot } from '@/api/trash'
import ComparePanel from '@/components/ComparePanel'
import type {
  VoiceBot, ChatBot, WimTool,
  VoiceBotEmbeddedTool, VoiceBotEmbeddedToolParams, VoiceBotCapability,
  DialplanDetail,
} from '@/types/wildix'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { usePbxStore } from '@/stores/pbx'

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'voicebots' | 'chatbots'
type DetailTab = 'overview' | 'prompt' | 'capabilities' | 'json'
type BotItem = VoiceBot | ChatBot

function isVoice(bot: BotItem): bot is VoiceBot {
  return 'endpoint' in bot || 'pipeline' in bot
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(iso?: string, locale = 'fr-FR') {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Embedded tool chips ───────────────────────────────────────────────────────

const EMB_ICON: Record<string, React.ElementType> = {
  TRANSFER: PhoneForwarded, DELEGATE: UserCheck,
  HANGUP: PhoneOff, WAIT: Clock, HANDOVER: UserCheck, SUGGESTIONS: Wrench,
}
const EMB_COLOR: Record<string, string> = {
  TRANSFER: 'bg-blue-50 text-blue-700 border-blue-200',
  DELEGATE: 'bg-purple-50 text-purple-700 border-purple-200',
  HANGUP:   'bg-red-50 text-red-700 border-red-200',
  WAIT:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  HANDOVER: 'bg-purple-50 text-purple-700 border-purple-200',
  SUGGESTIONS: 'bg-gray-50 text-gray-600 border-gray-200',
}

function EmbChip({ t }: { t: VoiceBotEmbeddedTool }) {
  const Icon = EMB_ICON[t.type] ?? Wrench
  const color = EMB_COLOR[t.type] ?? 'bg-muted text-muted-foreground border-border'
  const { t: tr } = useTranslation()
  const label = t.type === 'TRANSFER' && t.parameters?.extension
    ? `→ ${t.parameters.extension}`
    : t.type === 'DELEGATE' ? tr('bots.embDelegate')
    : t.type === 'HANGUP'   ? tr('bots.embHangup')
    : t.type === 'WAIT'     ? tr('bots.embWait')
    : t.type
  return (
    <span className={`flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 ${color}`}
      title={t.parameters?.description ?? t.name}>
      <Icon size={10} /> {label}
    </span>
  )
}

// ── Sidebar list item ─────────────────────────────────────────────────────────

function BotListItem({
  bot, mode, active, onClick, wimTools,
}: {
  bot: BotItem; mode: Mode; active: boolean
  onClick: () => void; wimTools: WimTool[]
}) {
  const vbot = isVoice(bot) ? bot : null
  const embedded = vbot?.endpoint?.llm?.embeddedTools ?? []
  const wimIds = vbot?.capabilities?.filter((c): c is VoiceBotCapability & { tool: { id: string } } => !!c.tool?.id)
    .map(c => c.tool!.id) ?? []
  const usedTools = wimTools.filter(t => wimIds.includes(t.id))
  const inlineTools = vbot?.endpoint?.llm?.tools ?? []
  const category = (bot as VoiceBot).category

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 transition-colors border-l-4 ${
        active
          ? 'bg-blue-50 border-l-blue-600'
          : 'border-l-transparent hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
          active ? 'bg-blue-100' : 'bg-gray-100'
        }`}>
          {mode === 'voicebots'
            ? <Mic size={13} className={active ? 'text-blue-600' : 'text-gray-500'} />
            : <Bot size={13} className={active ? 'text-blue-600' : 'text-gray-500'} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium truncate">{bot.name}</p>
            {category && (
              <span className="shrink-0 text-[10px] rounded bg-gray-100 text-gray-500 px-1.5 py-0.5">
                {category}
              </span>
            )}
          </div>
          <p className="font-mono text-[10px] text-gray-400 mt-0.5 truncate">{bot.id}</p>
          {mode === 'voicebots' && (embedded.length > 0 || usedTools.length > 0 || inlineTools.length > 0 || !!vbot?.message) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {!!vbot?.message && (
                <span title="Message d'accueil configuré"
                  className="flex items-center gap-0.5 text-[10px] rounded-full border px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                  <MessageSquare size={8} />
                </span>
              )}
              {embedded.map((e, i) => {
                const Icon = EMB_ICON[e.type] ?? Wrench
                const color = EMB_COLOR[e.type] ?? 'bg-muted text-muted-foreground border-border'
                return (
                  <span key={i} className={`flex items-center gap-0.5 text-[10px] rounded-full border px-1.5 py-0.5 ${color}`}>
                    <Icon size={8} />
                  </span>
                )
              })}
              {usedTools.map(t => (
                <span key={t.id} className="flex items-center gap-0.5 text-[10px] rounded-full border px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200">
                  <Wrench size={8} />
                </span>
              ))}
              {inlineTools.map(function(_t, idx) { return (
                <span key={"inline-" + idx} className="flex items-center gap-0.5 text-[10px] rounded-full border px-1.5 py-0.5 bg-orange-50 text-orange-700 border-orange-200">
                  <Globe size={8} />
                </span>
              ); })}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Detail — empty state ──────────────────────────────────────────────────────

function EmptyDetail() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-muted-foreground">
      <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Bot size={32} className="text-gray-300" />
      </div>
      <p className="font-medium text-gray-500">{t('bots.selectBot')}</p>
      <p className="text-sm text-gray-400 mt-1">{t('bots.selectBotDesc')}</p>
    </div>
  )
}

// ── Detail — Overview tab ─────────────────────────────────────────────────────

function OverviewTab({ bot, mode, wimTools }: { bot: BotItem; mode: Mode; wimTools: WimTool[] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.slice(0, 2).replace('fr', 'fr-FR').replace('en', 'en-GB').replace('de', 'de-DE').replace('it', 'it-IT').replace('es', 'es-ES') ?? 'fr-FR'
  const vbot = isVoice(bot) ? bot : null
  const wimIds = vbot?.capabilities?.filter(c => !!c.tool?.id).map(c => c.tool!.id) ?? []
  const usedWimTools = wimTools.filter(t => wimIds.includes(t.id))
  const kbCaps = vbot?.capabilities?.filter(c => !!c.kb) ?? []
  const inlineTools = vbot?.endpoint?.llm?.tools ?? []

  return (
    <div className="space-y-6">
      {/* Infos générales */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
          {t('bots.infoSection', { type: mode === 'voicebots' ? 'VoiceBot' : 'ChatBot' })}
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{t('common.name')}</p>
            <p className="font-medium">{bot.name}</p>
          </div>
          {vbot?.category && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('bots.categoryLabel')}</p>
              <p className="font-medium">{vbot.category}</p>
            </div>
          )}
          {!isVoice(bot) && (bot as ChatBot).integrationType && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('bots.integrationType')}</p>
              <p className="font-medium">{(bot as ChatBot).integrationType}</p>
            </div>
          )}
          {!isVoice(bot) && (bot as ChatBot).access && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('bots.accessLabel')}</p>
              <p className="font-medium">{(bot as ChatBot).access}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{t('bots.createdAt')}</p>
            <p className="font-medium text-orange-600">{fmtDate(bot.createdAt, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{t('bots.updatedAt')}</p>
            <p className="font-medium text-orange-600">{fmtDate(bot.updatedAt, locale)}</p>
          </div>
        </div>
      </section>

      {/* Message d'accueil */}
      {vbot?.message && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            {t('bots.welcomeMsg')}
          </p>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
            {vbot.message}
          </p>
        </section>
      )}

      {/* Pipeline */}
      {vbot?.pipeline && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">{t('bots.pipelineSection')}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('botCreate.interruptions'), value: vbot.pipeline.interuptionsEnabled ? t('bots.interruptionsEnabled') : t('bots.interruptionsDisabled') },
              { label: t('bots.maxDurationLabel'), value: vbot.pipeline.maximumDuration ? `${vbot.pipeline.maximumDuration}s` : '—' },
              { label: t('bots.silenceTimeoutLabel'), value: vbot.pipeline.silenceTimeout ? `${vbot.pipeline.silenceTimeout}s` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Capabilities */}
      {vbot && ((vbot.endpoint?.llm?.embeddedTools?.length ?? 0) > 0 || usedWimTools.length > 0) && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Capabilities
          </p>
          <div className="space-y-2">
            {(vbot.endpoint?.llm?.embeddedTools ?? []).map((t, i) => (
              <div key={i} className={`rounded-lg border p-2.5 text-xs ${EMB_COLOR[t.type] ?? 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                <div className="flex items-center gap-1.5 font-medium">
                  {(() => { const Icon = EMB_ICON[t.type] ?? Wrench; return <Icon size={12} /> })()}
                  {t.type}
                  <span className="text-[10px] font-normal opacity-50 ml-1">embedded</span>
                </div>
                {t.parameters?.extension && (
                  <p className="mt-0.5 font-mono text-[10px] opacity-80">→ {t.parameters.extension}</p>
                )}
                {t.parameters?.description && (
                  <p className="mt-1 text-[10px] opacity-70 max-w-[220px] leading-tight">{t.parameters.description}</p>
                )}
              </div>
            ))}
            {usedWimTools.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border bg-green-50 border-green-200 px-3 py-2">
                <Wrench size={12} className="text-green-700 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-green-800">{t.name}</p>
                  {t.description && <p className="text-[10px] text-green-700 opacity-80 truncate">{t.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inline tools */}
      {inlineTools.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
            Fonctions tierces ({inlineTools.length})
            <span className="text-[10px] rounded bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 font-normal normal-case tracking-normal">deprecated</span>
          </p>
          <div className="space-y-1.5">
            {inlineTools.map((t, i) => (
              <div key={i} className="rounded-lg border bg-orange-50 border-orange-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-orange-700 shrink-0" />
                  <p className="text-xs font-medium text-orange-800">{t.function.name}</p>
                </div>
                {t.function.description && (
                  <p className="text-[10px] text-orange-700 opacity-80 mt-0.5 ml-[20px]">{t.function.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Knowledge bases */}
      {kbCaps.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Bases de connaissances ({kbCaps.length})
          </p>
          <div className="space-y-1.5">
            {kbCaps.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-indigo-50 border-indigo-200 px-3 py-2">
                <BookOpen size={12} className="text-indigo-700 shrink-0" />
                <p className="font-mono text-[10px] text-indigo-700">{c.kb?.knowledgeBaseId}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Detail — Prompt tab ───────────────────────────────────────────────────────

function PromptTab({ bot }: { bot: BotItem }) {
  const vbot = isVoice(bot) ? bot : null
  const prompt = vbot?.endpoint?.llm?.prompt

  if (!prompt) return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <MessageSquare size={32} className="mb-3 opacity-40" />
      <p className="text-sm">Aucun prompt système défini</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{prompt.length} caractères</p>
        <button
          onClick={() => { navigator.clipboard.writeText(prompt); toast.success('Prompt copié') }}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <Copy size={11} /> Copier
        </button>
      </div>
      <pre className="text-xs leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border font-mono text-gray-700 max-h-[60vh] overflow-y-auto">
        {prompt}
      </pre>
    </div>
  )
}

// ── Detail — Capabilities tab ─────────────────────────────────────────────────

﻿function CapabilitiesTab({ bot, mode, wimTools, pbxId }: { bot: BotItem; mode: Mode; wimTools: WimTool[]; pbxId: string }) {
  const qc = useQueryClient()
  const vbot = mode === 'voicebots' ? (isVoice(bot) ? bot : null) : null
  const caps = vbot?.capabilities ?? []
  const inlineTools = vbot?.endpoint?.llm?.tools ?? []
  const embeddedTools = vbot?.endpoint?.llm?.embeddedTools ?? []

  const { data: allBotsData } = useQuery({ queryKey: ['bots', pbxId], queryFn: () => botsApi.list(pbxId), enabled: !!pbxId })
  const allVoicebots: VoiceBot[] = allBotsData?.voicebots ?? []

  const { data: dialplan } = useQuery({
    queryKey: ['dialplan', pbxId],
    queryFn: () => dialplanApi.list(pbxId),
    enabled: !!pbxId && mode === 'voicebots',
    retry: false,
  })
  const dlDialplans = dialplan?.dialplans ?? []


  const EDITABLE_TYPES = ['HANGUP', 'WAIT', 'TRANSFER', 'DELEGATE'] as const
  type EditableType = typeof EDITABLE_TYPES[number]
  const TYPE_DEFAULTS: Record<EditableType, string> = { HANGUP: 'hangup', WAIT: 'wait', TRANSFER: 'transfer', DELEGATE: 'delegate' }

  const [formOpen, setFormOpen] = useState(false)
  const [formIdx, setFormIdx] = useState<number | null>(null)
  const [formType, setFormType] = useState<EditableType>('HANGUP')
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formExt, setFormExt] = useState('')
  const [formCtx, setFormCtx] = useState('')
  const [formBotId, setFormBotId] = useState('')
  const [formCtxDialplanId, setFormCtxDialplanId] = useState<number | null>(null)

  const { data: dialplanDetail, isFetching: loadingNumbers } = useQuery({
    queryKey: ['dialplan-detail', pbxId, formCtxDialplanId],
    queryFn: () => dialplanApi.getDetail(pbxId, formCtxDialplanId!),
    enabled: !!pbxId && formCtxDialplanId !== null && formOpen && formType === 'TRANSFER',
    retry: false,
  })
  const dlNumbers: DialplanDetail['numbers'] = dialplanDetail?.numbers ?? []
  const [formPipelineType, setFormPipelineType] = useState('')
  const [formPipelineInst, setFormPipelineInst] = useState('')

  const updateMut = useMutation({
    mutationFn: (newTools: VoiceBotEmbeddedTool[]) =>
      botsApi.update(bot.id, pbxId, { endpoint: { llm: { ...vbot!.endpoint!.llm!, embeddedTools: newTools } } }, 'voicebot'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bots', pbxId] }); toast.success(formIdx !== null ? 'Outil mis à jour' : 'Outil ajouté'); setFormOpen(false) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (idx: number) => {
      const newTools = embeddedTools.filter((_, i) => i !== idx) as VoiceBotEmbeddedTool[]
      return botsApi.update(bot.id, pbxId, { endpoint: { llm: { ...vbot!.endpoint!.llm!, embeddedTools: newTools } } }, 'voicebot')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bots', pbxId] }); toast.success('Outil supprimé') },
    onError: (e: Error) => toast.error(e.message),
  })

  function openAdd() {
    setFormIdx(null); setFormType('HANGUP'); setFormName('hangup')
    setFormDesc(''); setFormExt(''); setFormCtx(''); setFormBotId('')
    setFormPipelineType(''); setFormPipelineInst(''); setFormCtxDialplanId(null)
    setFormOpen(true)
  }

  function openEdit(idx: number) {
    const t = embeddedTools[idx]
    const type = (EDITABLE_TYPES as readonly string[]).includes(t.type) ? t.type as EditableType : 'HANGUP'
    setFormIdx(idx); setFormType(type); setFormName(t.name ?? '')
    setFormDesc(t.parameters?.description ?? '')
    setFormExt(t.parameters?.extension ?? '')
    const ctx = t.parameters?.context ?? ''
    setFormCtx(ctx)
    const matchedDp = dlDialplans.find(d => d.name === ctx)
    setFormCtxDialplanId(matchedDp?.id ?? null)
    setFormBotId(t.parameters?.id ?? '')
    setFormPipelineType(t.parameters?.pipeline?.type ?? '')
    setFormPipelineInst(t.parameters?.pipeline?.instructions ?? '')
    setFormOpen(true)
  }

  function saveTool() {
    if (!vbot) return
    const params: VoiceBotEmbeddedToolParams = {}
    if (formDesc) params.description = formDesc
    if (formType === 'TRANSFER') {
      if (formExt) params.extension = formExt
      if (formCtx) params.context = formCtx
    }
    if (formType === 'DELEGATE') {
      if (formBotId) params.id = formBotId
      if (formPipelineType || formPipelineInst) {
        params.pipeline = {}
        if (formPipelineType) params.pipeline.type = formPipelineType
        if (formPipelineInst) params.pipeline.instructions = formPipelineInst
      }
    }
    const tool: VoiceBotEmbeddedTool = {
      type: formType,
      name: formName.trim() || TYPE_DEFAULTS[formType],
      parameters: Object.keys(params).length > 0 ? params : undefined,
    }
    const newTools = formIdx !== null
      ? (embeddedTools.map((t, i) => i === formIdx ? tool : t) as VoiceBotEmbeddedTool[])
      : ([...embeddedTools, tool] as VoiceBotEmbeddedTool[])
    updateMut.mutate(newTools)
  }

  if (!vbot) return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Zap size={32} className="mb-3 opacity-40" />
      <p className="text-sm">Capabilities disponibles pour les VoiceBots uniquement</p>
    </div>
  )

  return (
    <>
    <div className="space-y-6">

      {/* Embedded Tools */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Embedded Tools ({embeddedTools.length})
          </p>
          <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={openAdd}>
            <Plus size={11} /> Ajouter
          </Button>
        </div>
        {embeddedTools.length === 0 && (
          <p className="text-xs text-gray-400 italic">Aucun embedded tool configuré</p>
        )}
        <div className="space-y-2">
          {embeddedTools.map((t, i) => {
            const Icon = EMB_ICON[t.type] || Wrench
            const colorCls = EMB_COLOR[t.type] || 'bg-gray-50 border-gray-200 text-gray-700'
            const isEditable = (EDITABLE_TYPES as readonly string[]).includes(t.type)
            const delegateBot = t.type === 'DELEGATE' && t.parameters?.id ? allVoicebots.find(b => b.id === t.parameters!.id) : null
            return (
              <div key={i} className={'rounded-lg border p-3 ' + colorCls}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={13} className="shrink-0" />
                    <span className="text-xs font-semibold">{t.type}</span>
                    {t.name && <span className="text-xs opacity-60 truncate">{t.name}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditable && (
                      <button onClick={() => openEdit(i)}
                        className="flex items-center gap-1 text-[10px] rounded border px-2 py-0.5 bg-white/60 hover:bg-white/90 transition-colors">
                        <Pencil size={9} /> Éditer
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm('Supprimer cet outil ?')) deleteMut.mutate(i) }}
                      disabled={deleteMut.isPending}
                      className="flex items-center gap-1 text-[10px] rounded border px-2 py-0.5 bg-white/60 hover:bg-red-50 text-red-600 border-red-200 transition-colors">
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>
                {t.parameters?.extension && (
                  <p className="text-xs mt-1 ml-5 font-mono">
                    {'→'} {t.parameters.extension}
                    {t.parameters.context ? <span className="opacity-60"> ({t.parameters.context})</span> : null}
                  </p>
                )}
                {delegateBot ? (
                  <p className="text-xs mt-1 ml-5 flex items-center gap-1 opacity-80"><Bot size={10} /> {delegateBot.name}</p>
                ) : t.parameters?.id ? (
                  <p className="text-[10px] mt-1 ml-5 font-mono opacity-60">{t.parameters.id}</p>
                ) : null}
                {t.parameters?.description && (
                  <p className="text-xs mt-1 ml-5 opacity-75 leading-snug">{t.parameters.description}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* WIM Tools & KB */}
      {caps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            WIM Tools & Bases de connaissances ({caps.length})
          </p>
          <div className="space-y-2">
            {caps.map((c, i) => {
              if (c.tool) {
                const tool = wimTools.find(t => t.id === c.tool!.id)
                return (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wrench size={13} className="text-green-600" />
                      <span className="text-xs font-semibold text-green-700">WIM Tool</span>
                      <span className="font-mono text-xs text-gray-400">{c.tool.id}</span>
                    </div>
                    {tool && (
                      <p className="text-xs text-gray-600 ml-5">{tool.name}{tool.description ? ` — ${tool.description}` : ''}</p>
                    )}
                    {c.tool.variables && (c.tool.variables as Array<{ name: string }>).length > 0 && (
                      <div className="ml-5 flex flex-wrap gap-1.5">
                        {(c.tool.variables as Array<{ name: string }>).map(v => (
                          <span key={v.name} className="text-[10px] rounded border px-1.5 py-0.5 font-mono bg-gray-50">{v.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              if (c.kb) {
                return (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <BookOpen size={13} className="text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-700">Knowledge Base</span>
                      <span className="font-mono text-xs text-gray-400">{c.kb.knowledgeBaseId}</span>
                    </div>
                    {c.kb.instructions && (
                      <p className="text-xs text-gray-600 mt-1 ml-5">{c.kb.instructions}</p>
                    )}
                  </div>
                )
              }
              return (
                <div key={i} className="rounded-lg border p-3">
                  <pre className="text-xs text-gray-500">{JSON.stringify(c, null, 2)}</pre>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inline tools (deprecated) */}
      {inlineTools.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
            Fonctions tierces ({inlineTools.length})
            <span className="text-[10px] rounded bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 font-normal normal-case tracking-normal">deprecated</span>
          </p>
          <div className="space-y-3">
            {inlineTools.map((t, i) => (
              <div key={i} className="rounded-lg border bg-orange-50 border-orange-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-orange-700 shrink-0" />
                  <span className="text-sm font-semibold text-orange-900">{t.function.name}</span>
                  <span className="text-[10px] rounded bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5">deprecated</span>
                </div>
                {t.function.description && (
                  <p className="text-xs text-orange-700 ml-5">{t.function.description}</p>
                )}
                {t.function.integration?.webhook && (
                  <p className="text-[10px] font-mono bg-white/70 rounded px-2 py-1.5 border border-orange-200 break-all ml-5">
                    {(t.function.integration.webhook.method || 'POST').toUpperCase()} {t.function.integration.webhook.url}
                  </p>
                )}
                {t.function.parameters && (
                  <div className="ml-5">
                    <p className="text-[10px] font-medium text-orange-700 mb-1">Paramètres</p>
                    <pre className="text-[10px] font-mono bg-white/70 rounded p-2 border border-orange-200 overflow-auto max-h-48">{JSON.stringify(t.function.parameters, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Add/Edit embedded tool modal */}
    <Dialog open={formOpen} onOpenChange={(v) => { if (!v) setFormOpen(false) }}>
      <DialogContent title={formIdx !== null ? `Modifier ${formType}` : 'Ajouter un embedded tool'}>
        <div className="space-y-4">

          {/* Type picker — add mode only */}
          {formIdx === null && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {EDITABLE_TYPES.map(type => {
                  const Icon = type === 'HANGUP' ? PhoneOff : type === 'WAIT' ? Clock : type === 'TRANSFER' ? PhoneForwarded : UserCheck
                  return (
                    <button key={type}
                      onClick={() => { setFormType(type); setFormName(TYPE_DEFAULTS[type]) }}
                      className={'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ' + (formType === type ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted')}>
                      <Icon size={13} /> {type}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Nom <span className="text-gray-400 font-normal">(identifiant technique)</span></label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="ex: transfer_support" />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Description <span className="text-gray-400 font-normal">(instruction pour le LLM)</span></label>
            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Quand et pourquoi utiliser cet outil" />
          </div>

          {/* TRANSFER fields */}
          {formType === 'TRANSFER' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Contexte Asterisk <span className="text-gray-400 font-normal">(dialplan)</span></label>
                {dlDialplans.length > 0 ? (
                  <>
                    <div className="relative">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                        value={dlDialplans.some(d => d.name === formCtx) ? formCtx : ''}
                        onChange={(e) => {
                          const name = e.target.value
                          setFormCtx(name)
                          setFormExt('')
                          const dp = dlDialplans.find(d => d.name === name)
                          setFormCtxDialplanId(dp?.id ?? null)
                        }}
                      >
                        <option value="">Selectionner un dialplan</option>
                        {dlDialplans.map(d => (
                          <option key={d.id} value={d.name}>
                            {d.name}{d.description ? ` - ${d.description}` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2.5 text-muted-foreground" />
                    </div>
                    <Input value={formCtx} onChange={(e) => { setFormCtx(e.target.value); setFormCtxDialplanId(null) }} placeholder="Ou saisir manuellement" />
                  </>
                ) : (
                  <Input value={formCtx} onChange={(e) => setFormCtx(e.target.value)} placeholder="ex: from-internal" />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Extension / Destination</label>
                {formCtxDialplanId !== null ? (
                  loadingNumbers ? (
                    <p className="text-xs text-gray-400 italic">Chargement des extensions...</p>
                  ) : dlNumbers.length > 0 ? (
                    <>
                      <div className="relative">
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                          value={dlNumbers.some(n => n.number === formExt) ? formExt : ''}
                          onChange={(e) => setFormExt(e.target.value)}
                        >
                          <option value="">Selectionner une extension</option>
                          {dlNumbers.map((n, i) => (
                            <option key={i} value={n.number}>
                              {n.number}{n.comment ? ` - ${n.comment}` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2.5 text-muted-foreground" />
                      </div>
                      <Input value={formExt} onChange={(e) => setFormExt(e.target.value)} placeholder="Ou saisir manuellement" />
                    </>
                  ) : (
                    <>
                      <Input value={formExt} onChange={(e) => setFormExt(e.target.value)} placeholder="ex: 100 ou +33123456789" />
                      <p className="text-[10px] text-amber-600">Aucune extension dans ce dialplan</p>
                    </>
                  )
                ) : (
                  <>
                    <Input value={formExt} onChange={(e) => setFormExt(e.target.value)} placeholder="ex: 100 ou +33123456789" />
                    {!dialplan?.configured && (
                      <p className="text-[10px] text-amber-600">
                        PBX Simple Token non configure - allez dans Parametres
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* DELEGATE fields */}
          {formType === 'DELEGATE' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium">Bot cible</label>
                {allVoicebots.length > 0 ? (
                  <div className="relative">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                      value={formBotId}
                      onChange={(e) => setFormBotId(e.target.value)}>
                      <option value="">— Sélectionner un bot —</option>
                      {allVoicebots.filter(b => b.id !== bot.id).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2.5 text-muted-foreground" />
                  </div>
                ) : (
                  <Input value={formBotId} onChange={(e) => setFormBotId(e.target.value)} placeholder="ID du bot cible" />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Pipeline type <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <Input value={formPipelineType} onChange={(e) => setFormPipelineType(e.target.value)} placeholder="ex: standard" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Instructions pipeline <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <Input value={formPipelineInst} onChange={(e) => setFormPipelineInst(e.target.value)} placeholder="Instructions contextuelles pour le bot cible" />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={saveTool} disabled={updateMut.isPending || !formName.trim()}>
              {updateMut.isPending ? 'Enregistrement…' : (formIdx !== null ? 'Mettre à jour' : 'Ajouter')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}


// ── Detail — JSON tab ─────────────────────────────────────────────────────────

function JsonTab({ bot }: { bot: BotItem }) {
  return (
    <div className="relative">
      <button
        onClick={() => { navigator.clipboard.writeText(JSON.stringify(bot, null, 2)); toast.success('JSON copié') }}
        className="absolute top-2 right-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white rounded px-2 py-1 border"
      >
        <Copy size={11} /> Copier
      </button>
      <pre className="text-xs leading-relaxed bg-gray-50 rounded-lg p-4 border font-mono text-gray-700 overflow-auto max-h-[65vh]">
        {JSON.stringify(bot, null, 2)}
      </pre>
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  bot, mode, wimTools, pbxList, pbxId,
  onEdit, onDelete, onCompare, onClone,
}: {
  bot: BotItem; mode: Mode; wimTools: WimTool[]
  pbxList: Array<{ id: string; name: string; pbx_host?: string }>
  pbxId: string
  onEdit: () => void
  onDelete: () => void
  onCompare: () => void
  onClone: (toOther: boolean) => void
}) {
  const [tab, setTab] = useState<DetailTab>('overview')
  const { t } = useTranslation()
  const vbot = isVoice(bot) ? bot : null
  const capCount = (vbot?.capabilities?.length ?? 0) + (vbot?.endpoint?.llm?.embeddedTools?.length ?? 0)

  const tabs: Array<{ id: DetailTab; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'overview',      label: t('bots.tabOverview'),      icon: LayoutGrid },
    { id: 'prompt',        label: t('bots.tabPrompt'),        icon: MessageSquare },
    { id: 'capabilities',  label: t('bots.tabCapabilities'),  icon: Zap, badge: capCount },
    { id: 'json',          label: t('bots.tabJson'),          icon: Code2 },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Bot header */}
      <div className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
              {mode === 'voicebots'
                ? <Phone size={18} className="text-gray-500" />
                : <Bot size={18} className="text-gray-500" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{bot.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {mode === 'voicebots'
                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500 text-white">VoiceBot</span>
                  : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">ChatBot</span>}
                <span className="font-mono text-xs text-gray-400">{bot.id}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={onCompare}>
              <GitCompare size={12} /> {t('bots.compare')}
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => onClone(false)}>
              <Copy size={12} /> {t('bots.duplicateHere')}
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => onClone(true)}>
              <Plane size={12} /> {t('bots.otherPbx')}
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={onEdit}>
              <Pencil size={12} /> {t('common.edit')}
            </Button>
            <Button size="sm" variant="destructive" className="text-xs gap-1" onClick={onDelete}>
              <Trash2 size={12} /> {t('common.delete')}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 -mb-4 border-b-0">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon size={12} /> {label}
              {badge !== undefined && badge > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  tab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50">
        {tab === 'overview'     && <OverviewTab bot={bot} mode={mode} wimTools={wimTools} />}
        {tab === 'prompt'       && <PromptTab bot={bot} />}
        {tab === 'capabilities' && <CapabilitiesTab bot={bot} mode={mode} wimTools={wimTools} pbxId={pbxId} />}
        {tab === 'json'         && <JsonTab bot={bot} />}
      </div>
    </div>
  )
}

// ── Clone dialog ──────────────────────────────────────────────────────────────

function CloneDialog({
  bot, mode, pbxId, pbxList, open, onClose,
}: {
  bot: BotItem | null; mode: Mode; pbxId: string
  pbxList: Array<{ id: string; name: string; pbx_host?: string }>
  open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [targetPbxId, setTargetPbxId] = useState(pbxId)
  const [cloneName, setCloneName] = useState('')

  const { t } = useTranslation()
  const cloneMut = useMutation({
    mutationFn: () => botsApi.clone(
      bot!.id, pbxId, targetPbxId,
      mode === 'voicebots' ? 'voicebot' : 'chatbot',
      cloneName.trim() || undefined,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] })
      toast.success(t('bots.cloneSuccess'))
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!bot) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent title={`${t('bots.cloneTitle')} "${bot.name}"`}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('bots.cloneName')}</label>
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder={`${bot.name} (copie)`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('bots.pbxDestination')}</label>
            <div className="relative">
              <select
                className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                value={targetPbxId}
                onChange={(e) => setTargetPbxId(e.target.value)}
              >
                {pbxList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.id === pbxId ? ` ${t('bots.thisPbx')}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2.5 text-muted-foreground" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              onClick={() => cloneMut.mutate()}
              disabled={cloneMut.isPending}
            >
              {cloneMut.isPending ? t('bots.cloning') : t('bots.clone')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main BotManager ───────────────────────────────────────────────────────────

export default function BotManager() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const pbxId = usePbxStore((s) => s.selectedPbxId)
  const { t } = useTranslation()

  const [mode, setMode] = useState<Mode>('voicebots')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [toolFilter, setToolFilter] = useState('')
  const [sortField, setSortField] = useState<'name' | 'date'>('name')
  const [cloneOpen, setCloneOpen] = useState(false)

  // Compare
  const [compareOpen, setCompareOpen] = useState(false)

  // Secure delete
  const [deleteTarget, setDeleteTarget] = useState<BotItem | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Trash
  const [trashOpen, setTrashOpen] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<TrashedBot | null>(null)
  const [restoreName, setRestoreName] = useState('')

  // ── Queries
  const { data: bots, isLoading, refetch } = useQuery({
    queryKey: ['bots', pbxId],
    queryFn: () => botsApi.list(pbxId),
    enabled: !!pbxId,
  })
  const { data: tools = [] } = useQuery({
    queryKey: ['tools', pbxId],
    queryFn: () => toolsApi.list(pbxId),
    enabled: !!pbxId,
    retry: false,
  })
  const { data: pbxList = [] } = useQuery({ queryKey: ['pbx'], queryFn: pbxApi.list })
  const { data: trashList = [], isLoading: trashLoading, refetch: refetchTrash } = useQuery({
    queryKey: ['trash', pbxId],
    queryFn: () => trashApi.list(pbxId),
    enabled: trashOpen && !!pbxId,
  })

  // ── Mutations
  const trashRemoveMut = useMutation({
    mutationFn: (id: string) => trashApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash', pbxId] })
      toast.success('Supprimé définitivement')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      botsApi.delete(id, pbxId, mode === 'voicebots' ? 'voicebot' : 'chatbot'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots', pbxId] })
      setSelectedId(null)
      toast.success('Bot supprimé')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Handlers
  function openDelete(bot: BotItem) {
    setDeleteTarget(bot)
    setDeletePassword('')
    setDeleteError('')
    setShowPassword(false)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || !deletePassword) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const { valid } = await authApi.verifyPassword(deletePassword)
      if (!valid) {
        setDeleteError('Mot de passe incorrect')
        return
      }
      const botType = mode === 'voicebots' ? 'voicebot' : 'chatbot'
      await trashApi.save({
        pbxId,
        botType,
        botId: deleteTarget.id,
        botName: deleteTarget.name,
        config: deleteTarget,
      })
      await botsApi.delete(deleteTarget.id, pbxId, botType)
      qc.invalidateQueries({ queryKey: ['bots', pbxId] })
      setSelectedId(null)
      toast.success(`"${deleteTarget.name}" supprimé`)
      setDeleteTarget(null)
      setDeletePassword('')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleRestore(trashed: TrashedBot, nameOverride?: string) {
    const name = nameOverride ?? trashed.botName
    const allBots = [...(bots?.voicebots ?? []), ...(bots?.chatbots ?? [])]
    if (!nameOverride && allBots.some((b) => b.name === name)) {
      setRestoreTarget(trashed)
      setRestoreName(`${trashed.botName} (restauré)`)
      return
    }
    try {
      const config = trashed.config as Record<string, unknown>
      const { id: _id, ...rest } = config as { id: string } & Record<string, unknown>
      await botsApi.create(pbxId, { ...rest, name } as Partial<VoiceBot | ChatBot>, trashed.botType)
      await trashApi.remove(trashed.id)
      qc.invalidateQueries({ queryKey: ['bots', pbxId] })
      qc.invalidateQueries({ queryKey: ['trash', pbxId] })
      toast.success(`"${name}" restauré`)
      setRestoreTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur restauration')
    }
  }

  // ── Derived
  const voicebots: VoiceBot[] = bots?.voicebots ?? []
  const chatbots: ChatBot[]   = bots?.chatbots ?? []
  const rawItems = mode === 'voicebots' ? voicebots : chatbots

  const categories = useMemo(
    () => [...new Set(voicebots.map(b => b.category).filter(Boolean))].sort() as string[],
    [voicebots],
  )

  const filtered = useMemo(() => {
    let list = rawItems.slice()
    if (search) list = list.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    if (categoryFilter && mode === 'voicebots') {
      list = list.filter(b => (b as VoiceBot).category === categoryFilter)
    }
    if (toolFilter && mode === 'voicebots') {
      list = list.filter(b =>
        (b as VoiceBot).capabilities?.some(c => c.tool?.id === toolFilter)
      )
    }
    list.sort((a, b) => {
      if (sortField === 'date') {
        const da = new Date(a.createdAt).getTime()
        const db = new Date(b.createdAt).getTime()
        return sortDir === 'asc' ? da - db : db - da
      }
      return sortDir === 'asc'
        ? a.name.localeCompare(b.name, 'fr')
        : b.name.localeCompare(a.name, 'fr')
    })
    return list
  }, [rawItems, search, categoryFilter, toolFilter, sortDir, sortField, mode])

  const selectedBot = filtered.find(b => b.id === selectedId)
    ?? rawItems.find(b => b.id === selectedId)

  // ── Layout
  return (
    <div className="-m-6 h-full flex flex-col overflow-hidden bg-gray-50">

      {/* ── Page header ── */}
      <div className="bg-white border-b shadow-sm shrink-0 px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Title */}
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">{t('bots.managementTitle')}</h1>
            <p className="text-xs text-gray-500">{t('bots.managementSubtitle')}</p>
          </div>

          {/* Toggle */}
          <div className="flex rounded-lg border bg-gray-50 p-0.5 gap-0.5">
            <button
              onClick={() => { setMode('voicebots'); setSelectedId(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'voicebots'
                  ? 'bg-white shadow-sm text-blue-600 border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mic size={13} /> VoiceBots
              {voicebots.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  mode === 'voicebots' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}>{voicebots.length}</span>
              )}
            </button>
            <button
              onClick={() => { setMode('chatbots'); setSelectedId(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'chatbots'
                  ? 'bg-white shadow-sm text-blue-600 border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bot size={13} /> ChatBots
              {chatbots.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  mode === 'chatbots' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}>{chatbots.length}</span>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm" variant="outline" className="text-xs gap-1.5"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              {t('bots.refresh')}
            </Button>
            <Button
              size="sm" variant="outline" className="text-xs gap-1.5"
              onClick={() => { setTrashOpen(true); setRestoreTarget(null) }}
            >
              <Trash2 size={12} /> {t('bots.trash')}
            </Button>
            <Button
              size="sm" className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate(`/bots/create`)}
            >
              <Bot size={12} /> {t('bots.create')}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main area: sidebar + detail ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left sidebar ── */}
        <div className="w-72 shrink-0 bg-white border-r flex flex-col overflow-hidden">

          {/* Search */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder={t('bots.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-7 pr-3 text-xs rounded-md border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Filters row */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="h-7 w-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50 shrink-0"
                title={sortField === 'date' ? (sortDir === 'asc' ? '+ ancien' : '+ récent') : (sortDir === 'asc' ? 'A → Z' : 'Z → A')}
              >
                {sortDir === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />}
              </button>

              <div className="relative">
                <select
                  className="h-7 pl-2 pr-6 text-xs rounded border border-gray-200 bg-gray-50 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as 'name' | 'date')}
                >
                  <option value="name">{t('bots.sortByName')}</option>
                  <option value="date">{t('bots.sortByDate')}</option>
                </select>
                <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-2 text-gray-400" />
              </div>

              {mode === 'voicebots' && categories.length > 0 && (
                <div className="relative flex-1">
                  <select
                    className="w-full h-7 pl-2 pr-6 text-xs rounded border border-gray-200 bg-gray-50 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">{t('bots.filterCategory')}</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-2 text-gray-400" />
                </div>
              )}

              {mode === 'voicebots' && (tools as WimTool[]).length > 0 && (
                <div className="relative flex-1">
                  <select
                    className="w-full h-7 pl-2 pr-6 text-xs rounded border border-gray-200 bg-gray-50 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={toolFilter}
                    onChange={(e) => setToolFilter(e.target.value)}
                  >
                    <option value="">{t('bots.filterTool')}</option>
                    {(tools as WimTool[]).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-2 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Bot list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-xs text-gray-400 text-center">{t('common.loading')}</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="p-4 text-xs text-gray-400 text-center">{t('bots.noResults')}</div>
            )}
            {filtered.map(bot => (
              <BotListItem
                key={bot.id}
                bot={bot}
                mode={mode}
                active={bot.id === selectedId}
                onClick={() => setSelectedId(bot.id)}
                wimTools={tools as WimTool[]}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t bg-gray-50">
            <p className="text-xs text-gray-400">
              {filtered.length} / {rawItems.length} {mode === 'voicebots' ? 'voicebot' : 'chatbot'}{rawItems.length > 1 ? 's' : ''}
              {(categoryFilter || toolFilter || search) ? ` ${t('bots.filtered')}` : ''}
            </p>
          </div>
        </div>

        {/* ── Detail panel ── */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {!selectedBot ? (
            <EmptyDetail />
          ) : (
            <DetailPanel
              bot={selectedBot}
              mode={mode}
              wimTools={tools as WimTool[]}
              pbxList={pbxList}
              pbxId={pbxId}
              onEdit={() => navigate(`/bots/${selectedBot.id}?pbxId=${pbxId}&type=${mode === 'chatbots' ? 'chatbot' : 'voicebot'}`)}
              onDelete={() => openDelete(selectedBot)}
              onCompare={() => setCompareOpen(true)}
              onClone={() => setCloneOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Clone to other PBX dialog */}
      <CloneDialog
        bot={selectedBot ?? null}
        mode={mode}
        pbxId={pbxId}
        pbxList={pbxList}
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
      />

      {/* ── Compare dialog ──────────────────────────────────────────────────── */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent title="Comparaison de bots" className="max-w-4xl w-[90vw]">
          <ComparePanel bots={rawItems} />
        </DialogContent>
      </Dialog>

      {/* ── Secure delete dialog ────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeletePassword(''); setDeleteError('') } }}>
        <DialogContent title={`${t('common.delete')} "${deleteTarget?.name}" ?`}>
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <Lock size={13} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive leading-relaxed">
                {t('bots.deleteConfirmDesc')}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('bots.passwordLabel')}</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                  placeholder={t('bots.passwordPlaceholder')}
                  className={deleteError ? 'border-destructive pr-9' : 'pr-9'}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteConfirm()}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" disabled={deleteLoading}>{t('common.cancel')}</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading
                  ? <><Loader2 size={13} className="animate-spin" /> {t('bots.verifying')}</>
                  : <><Trash2 size={13} /> {t('common.delete')}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Trash panel dialog ──────────────────────────────────────────────── */}
      <Dialog open={trashOpen} onOpenChange={(open) => { setTrashOpen(open); if (!open) setRestoreTarget(null) }}>
        <DialogContent title={t('bots.trash')}>
          <div className="space-y-3">

            {restoreTarget && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-900">
                  {t('bots.trashConflict', { name: restoreTarget.botName })}
                </p>
                <Input
                  value={restoreName}
                  onChange={(e) => setRestoreName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRestoreTarget(null)}>{t('common.cancel')}</Button>
                  <Button size="sm" onClick={() => handleRestore(restoreTarget, restoreName.trim())} disabled={!restoreName.trim()}>
                    <RotateCcw size={12} /> {t('bots.restore')}
                  </Button>
                </div>
              </div>
            )}

            {trashLoading && (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> {t('common.loading')}
              </div>
            )}

            {!trashLoading && trashList.length === 0 && (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Trash2 size={32} className="mb-2 opacity-30" />
                <p className="text-sm">{t('bots.noBotsInTrash')}</p>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {trashList.map((trashed) => (
                <div key={trashed.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{trashed.botName}</p>
                      <span className={`text-xs rounded-full px-2 py-0.5 border shrink-0 ${
                        trashed.botType === 'voicebot'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {trashed.botType === 'voicebot' ? 'VoiceBot' : 'ChatBot'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('bots.deletedBy')} {trashed.deletedBy} · {new Date(trashed.deletedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleRestore(trashed)}>
                      <RotateCcw size={12} /> {t('bots.restore')}
                    </Button>
                    <Button
                      size="sm" variant="destructive"
                      onClick={() => trashRemoveMut.mutate(trashed.id)}
                      disabled={trashRemoveMut.isPending}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
