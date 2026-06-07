import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Wrench, MessageSquare, Globe, Mail, MessageCircle,
  ExternalLink, Bot, ChevronUp, ChevronDown, Code2, Search,
} from 'lucide-react'
import { toolsApi, botsApi } from '@/api/bots'
import { pbxApi } from '@/api/pbx'
import type { WimTool, VoiceBot } from '@/types/wildix'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { usePbxStore } from '@/stores/pbx'

// -- Tool type detection -------------------------------------------------------

type ToolKind = 'sendmessage' | 'sendemail' | 'sendsms' | 'websearch' | 'webhook' | 'mcp' | 'unknown'
type SortField = 'name' | 'created'
type SortDir = 'asc' | 'desc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolKind(tool: WimTool): ToolKind {
  const h = tool.handler as Record<string, unknown>
  if (h?.chat)      return 'sendmessage'
  if (h?.email)     return 'sendemail'
  if (h?.sms)       return 'sendsms'
  if (h?.websearch) return 'websearch'
  if (h?.mcp)       return 'mcp'
  if (h?.webhook)   return 'webhook'
  const cat = (tool.category ?? '').toLowerCase()
  if (cat === 'mcp')       return 'mcp'
  if (cat === 'websearch') return 'websearch'
  return 'unknown'
}

const KIND_LABELS: Record<ToolKind, string> = {
  sendmessage: 'Sendmessage',
  sendemail:   'Sendemail',
  sendsms:     'Sendsms',
  websearch:   'Websearch',
  webhook:     'Webhook',
  mcp:         'MCP',
  unknown:     'Other',
}

const KIND_COLORS: Record<ToolKind, string> = {
  sendmessage: 'bg-blue-100 text-blue-700',
  sendemail:   'bg-purple-100 text-purple-700',
  sendsms:     'bg-green-100 text-green-700',
  websearch:   'bg-cyan-100 text-cyan-700',
  webhook:     'bg-orange-100 text-orange-700',
  mcp:         'bg-pink-100 text-pink-700',
  unknown:     'bg-gray-100 text-gray-600',
}

const KIND_ICONS: Record<ToolKind, React.ElementType> = {
  sendmessage: MessageSquare,
  sendemail:   Mail,
  sendsms:     MessageCircle,
  websearch:   Search,
  webhook:     Globe,
  mcp:         Code2,
  unknown:     Wrench,
}

function toolDate(tool: WimTool): string {
  return (tool as unknown as Record<string, string>).createdAt
    ?? (tool as unknown as Record<string, string>).created
    ?? ''
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  try {
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr))
  } catch { return dateStr }
}

function botUsesWimTool(bot: VoiceBot, toolId: string): boolean {
  return bot.capabilities?.some((c) => c.tool?.id === toolId) ?? false
}

// -- Detail dialog -------------------------------------------------------------

function ToolDetail({
  tool, bots, wildixUrl, onClose,
}: {
  tool: WimTool
  bots: VoiceBot[]
  wildixUrl: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const kind = getToolKind(tool)
  const Icon = KIND_ICONS[kind]
  const variables = tool.input?.variables ?? []
  const usedBy = bots.filter(b => botUsesWimTool(b, tool.id))
  const h = tool.handler as Record<string, unknown>

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent title={tool.name}>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon size={18} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold">{tool.name}</h2>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${KIND_COLORS[kind]}`}>
                  {KIND_LABELS[kind]}
                </span>
                {tool.category && tool.category.toLowerCase() !== kind && (
                  <span className="text-xs rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                    {tool.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{tool.id}</p>
            </div>
          </div>

          {/* Description */}
          {tool.description && (
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          )}

          {/* Handler details */}
          {!!h.webhook && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Webhook</p>
              <div className="rounded-md bg-muted/60 px-3 py-2 font-mono text-xs">
                <span className="font-semibold text-foreground">
                  {((h.webhook as Record<string,string>).method ?? 'POST').toUpperCase()}
                </span>{' '}
                <span className="text-muted-foreground break-all">
                  {(h.webhook as Record<string,string>).url ?? '--'}
                </span>
              </div>
            </div>
          )}

          {!!h.chat && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Message</p>
              <pre className="rounded-md bg-muted/60 px-3 py-2 text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(h.chat, null, 2)}
              </pre>
            </div>
          )}

          {/* Variables */}
          {variables.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Parametres ({variables.length})
              </p>
              <div className="space-y-1.5">
                {variables.map((v) => (
                  <div key={v.name} className="flex items-start gap-2 rounded-md border px-3 py-2 bg-background text-xs">
                    <span className="font-mono font-medium shrink-0">
                      {v.name}
                      {v.optional && <span className="text-muted-foreground ml-0.5">?</span>}
                    </span>
                    <span className="text-muted-foreground rounded bg-muted px-1 py-0.5 text-[10px] shrink-0">{v.type}</span>
                    {v.description && (
                      <span className="text-muted-foreground leading-relaxed">{v.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bots using this tool */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {usedBy.length === 0 ? t('tools.usedByNone') : t(usedBy.length > 1 ? 'tools.usedByPlural' : 'tools.usedBy', { count: usedBy.length })}
            </p>
            {usedBy.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {usedBy.map((b) => (
                  <span key={b.id}
                    className="flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 bg-primary/10 text-primary">
                    <Bot size={10} /> {b.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Date */}
          {toolDate(tool) && (
            <p className="text-xs text-muted-foreground">
              {t('tools.createdOn')} {formatDate(toolDate(tool))}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-1 border-t">
            <DialogClose asChild>
              <Button variant="outline" size="sm">{t('common.close')}</Button>
            </DialogClose>
            {wildixUrl ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => window.open(wildixUrl, '_blank', 'noopener')}
              >
                <ExternalLink size={13} />
                {t('tools.openInWildix')}
              </Button>
            ) : (
              <Button size="sm" disabled className="gap-1.5">
                <ExternalLink size={13} />
                {t('tools.openInWildix')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// -- Tool row ------------------------------------------------------------------

function ToolRow({
  tool, onClick,
}: {
  tool: WimTool
  onClick: () => void
}) {
  const kind = getToolKind(tool)
  const Icon = KIND_ICONS[kind]

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card px-4 py-3 hover:bg-accent/40 transition-colors flex items-center gap-3"
    >
      <div className="shrink-0 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon size={14} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{tool.name}</span>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${KIND_COLORS[kind]}`}>
            {KIND_LABELS[kind]}
          </span>
          {tool.category && (
            <span className="text-xs rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {tool.category}
            </span>
          )}
        </div>
        {tool.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{tool.description}</p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-3 ml-2">
        {toolDate(tool) && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            {formatDate(toolDate(tool))}
          </span>
        )}
        <ExternalLink size={13} className="text-muted-foreground/50" />
      </div>
    </button>
  )
}

// -- Main page -----------------------------------------------------------------

const KIND_FILTER_VALUES: (ToolKind | 'all')[] = ['all', 'webhook', 'sendmessage', 'sendemail', 'sendsms', 'websearch', 'mcp']

export default function Tools() {
  const { t } = useTranslation()
  const pbxId = usePbxStore((s) => s.selectedPbxId)
  const [kindFilter, setKindFilter] = useState<ToolKind | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selected, setSelected] = useState<WimTool | null>(null)

  const { data: pbxList = [] } = useQuery({ queryKey: ['pbx'], queryFn: pbxApi.list })
  const currentPbx = pbxList.find(p => p.id === pbxId)
  const wildixUrl = (toolId: string) =>
    currentPbx ? `https://${currentPbx.pbx_host}/#/integrations/tools/${toolId}` : null

  const { data: tools = [], isLoading, isError, error } = useQuery({
    queryKey: ['tools', pbxId],
    queryFn: () => toolsApi.list(pbxId),
    enabled: !!pbxId,
    retry: false,
  })

  const { data: bots } = useQuery({
    queryKey: ['bots', pbxId],
    queryFn: () => botsApi.list(pbxId),
    enabled: !!pbxId,
  })
  const voicebots: VoiceBot[] = bots?.voicebots ?? []

  // Count per kind (for filter pills)
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tool of tools as WimTool[]) {
      const k = getToolKind(tool)
      counts[k] = (counts[k] ?? 0) + 1
    }
    return counts
  }, [tools])

  // Filter + sort
  const displayed = useMemo(() => {
    let list = tools as WimTool[]
    if (kindFilter !== 'all') list = list.filter(t => getToolKind(t) === kindFilter)
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
      } else {
        const da = toolDate(a)
        const db = toolDate(b)
        cmp = da < db ? -1 : da > db ? 1 : 0
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [tools, kindFilter, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
          active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:bg-accent'
        }`}
      >
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          : <ChevronDown size={11} className="opacity-40" />}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">WIM Tools</h1>
          <p className="text-sm text-muted-foreground">
            {t('tools.subtitle')}
            {tools.length > 0 && ` — ${t(tools.length > 1 ? 'tools.toolsCountPlural' : 'tools.toolsCount', { count: tools.length })}`}
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium mb-1">{t('tools.loadError')}</p>
          <p className="text-xs text-muted-foreground">{(error as Error)?.message}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Le token API doit etre une Company API Key avec le scope <code>tools:*</code>.
          </p>
        </div>
      )}

      {!isLoading && !isError && tools.length > 0 && (
        <>
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {KIND_FILTER_VALUES.map((value) => {
                const label = value === 'all' ? t('tools.filterAll') : KIND_LABELS[value]
                const count = value === 'all'
                  ? (tools as WimTool[]).length
                  : (kindCounts[value] ?? 0)
                if (value !== 'all' && count === 0) return null
                return (
                  <button
                    key={value}
                    onClick={() => setKindFilter(value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      kindFilter === value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {label}
                    <span className={`ml-1.5 ${kindFilter === value ? 'opacity-80' : 'text-muted-foreground'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">{t('tools.sortLabel')}</span>
              <SortBtn field="name" label={t('bots.sortByName')} />
              <SortBtn field="created" label={t('bots.sortByDate')} />
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {displayed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t('tools.noToolsFilter')}
              </p>
            ) : (
              displayed.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  onClick={() => setSelected(tool)}
                />
              ))
            )}
          </div>
        </>
      )}

      {!isLoading && !isError && tools.length === 0 && pbxId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Wrench size={36} className="mb-2 text-muted-foreground/50" />
          <p className="text-sm">{t('tools.noTools')}</p>
        </div>
      )}

      {/* Detail dialog */}
      {selected && (
        <ToolDetail
          tool={selected}
          bots={voicebots}
          wildixUrl={wildixUrl(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
