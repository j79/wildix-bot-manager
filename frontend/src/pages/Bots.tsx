import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus, Copy, Trash2, Bot, ChevronDown,
  PhoneForwarded, UserCheck, PhoneOff, Clock, Globe, Wrench,
  Scale, RotateCcw, Lock, Eye, EyeOff, Loader2,
} from 'lucide-react'
import { pbxApi } from '@/api/pbx'
import { botsApi, toolsApi } from '@/api/bots'
import { authApi } from '@/api/auth'
import { trashApi } from '@/api/trash'
import type { TrashedBot } from '@/api/trash'
import type { VoiceBot, ChatBot, VoiceBotEmbeddedTool, WimTool } from '@/types/wildix'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { usePbxStore } from '@/stores/pbx'
import ComparePanel from '@/components/ComparePanel'

// ── Embedded tool chips ───────────────────────────────────────────────────────

const EMBEDDED_ICONS: Record<string, React.ElementType> = {
  TRANSFER:    PhoneForwarded,
  DELEGATE:    UserCheck,
  HANGUP:      PhoneOff,
  WAIT:        Clock,
  HANDOVER:    UserCheck,
  SUGGESTIONS: Wrench,
}

const EMBEDDED_COLORS: Record<string, string> = {
  TRANSFER:    'bg-blue-500/10 text-blue-600 border-blue-200',
  DELEGATE:    'bg-purple-500/10 text-purple-600 border-purple-200',
  HANGUP:      'bg-red-500/10 text-red-600 border-red-200',
  WAIT:        'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  HANDOVER:    'bg-purple-500/10 text-purple-600 border-purple-200',
  SUGGESTIONS: 'bg-gray-500/10 text-gray-600 border-gray-200',
}

function EmbeddedChip({ tool }: { tool: VoiceBotEmbeddedTool }) {
  const Icon = EMBEDDED_ICONS[tool.type] ?? Wrench
  const color = EMBEDDED_COLORS[tool.type] ?? 'bg-muted text-muted-foreground border-border'
  const label = tool.type === 'TRANSFER' && tool.parameters?.extension
    ? `→ ${tool.parameters.extension}`
    : tool.type === 'DELEGATE' ? 'Déléguer'
    : tool.type === 'HANGUP'   ? 'Raccrocher'
    : tool.type === 'WAIT'     ? 'Attendre'
    : tool.type

  return (
    <span
      className={`flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 ${color}`}
      title={tool.parameters?.description ?? tool.name}
    >
      <Icon size={10} /> {label}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Bots() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const pbxId = usePbxStore((s) => s.selectedPbxId)

  const [tab, setTab]               = useState<'voicebots' | 'chatbots'>('voicebots')
  const [compareMode, setCompareMode] = useState(false)

  // Clone dialog
  const [cloneOpen, setCloneOpen]       = useState(false)
  const [cloneBot, setCloneBot]         = useState<{ id: string; name: string } | null>(null)
  const [targetPbxId, setTargetPbxId]   = useState('')
  const [cloneName, setCloneName]       = useState('')

  // Secure delete dialog
  const [deleteTarget, setDeleteTarget]   = useState<VoiceBot | ChatBot | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError]     = useState('')
  const [showPassword, setShowPassword]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Trash panel
  const [trashOpen, setTrashOpen]       = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<TrashedBot | null>(null)
  const [restoreName, setRestoreName]   = useState('')

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: pbxList = [] } = useQuery({ queryKey: ['pbx'], queryFn: pbxApi.list })

  const { data: wimTools = [] } = useQuery({
    queryKey: ['tools', pbxId],
    queryFn: () => toolsApi.list(pbxId),
    enabled: !!pbxId,
    retry: false,
  })

  const { data: bots, isLoading } = useQuery({
    queryKey: ['bots', pbxId],
    queryFn: () => botsApi.list(pbxId),
    enabled: !!pbxId,
  })

  const { data: trashList = [], isLoading: trashLoading, refetch: refetchTrash } = useQuery({
    queryKey: ['trash', pbxId],
    queryFn: () => trashApi.list(pbxId),
    enabled: trashOpen && !!pbxId,
  })

  // ── Mutations ────────────────────────────────────────────────────────────────

  const cloneMut = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      botsApi.clone(
        id, pbxId, targetPbxId || pbxId,
        tab === 'chatbots' ? 'chatbot' : 'voicebot',
        cloneName.trim() || undefined,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] })
      setCloneOpen(false)
      toast.success('Bot cloné avec succès')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const trashRemoveMut = useMutation({
    mutationFn: (id: string) => trashApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash', pbxId] })
      toast.success('Supprimé définitivement')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openClone(bot: VoiceBot | ChatBot) {
    setCloneBot({ id: bot.id, name: bot.name })
    setTargetPbxId(pbxId)
    setCloneName(`${bot.name} (copie)`)
    setCloneOpen(true)
  }

  function openDelete(bot: VoiceBot | ChatBot) {
    setDeleteTarget(bot)
    setDeletePassword('')
    setDeleteError('')
    setShowPassword(false)
  }

  function closeDelete() {
    setDeleteTarget(null)
    setDeletePassword('')
    setDeleteError('')
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
      const botType = tab === 'chatbots' ? 'chatbot' : 'voicebot'
      await trashApi.save({
        pbxId,
        botType,
        botId: deleteTarget.id,
        botName: deleteTarget.name,
        config: deleteTarget,
      })
      await botsApi.delete(deleteTarget.id, pbxId, botType)
      qc.invalidateQueries({ queryKey: ['bots', pbxId] })
      toast.success(`"${deleteTarget.name}" supprimé`)
      closeDelete()
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

  // ── Derived data ─────────────────────────────────────────────────────────────

  const items: (VoiceBot | ChatBot)[] = tab === 'voicebots'
    ? (bots?.voicebots ?? [])
    : (bots?.chatbots ?? [])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bots</h1>
          <p className="text-sm text-muted-foreground">VoiceBots WILMA et ChatBots X-Bees</p>
        </div>
        <div className="flex items-center gap-2">
          {pbxId && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setTrashOpen(true); setRestoreTarget(null) }}
              >
                <Trash2 size={14} /> Corbeille
              </Button>
              <Button
                variant={compareMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompareMode((m) => !m)}
              >
                <Scale size={14} /> Comparer
              </Button>
            </>
          )}
          <Button
            onClick={() => navigate(`/bots/create${pbxId ? `?pbxId=${pbxId}` : ''}`)}
            disabled={!pbxId}
          >
            <Plus size={16} /> Créer un bot
          </Button>
        </div>
      </div>

      {pbxId && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {(['voicebots', 'chatbots'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setCompareMode(false) }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'voicebots' ? 'VoiceBots WILMA' : 'ChatBots X-Bees'}
                {bots && (
                  <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                    {t === 'voicebots' ? bots.voicebots.length : bots.chatbots.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Compare panel */}
          {compareMode && <ComparePanel bots={items} />}

          {isLoading && <p className="text-sm text-muted-foreground py-4">Chargement…</p>}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <Bot size={36} className="mb-2 text-muted-foreground/50" />
              <p className="text-sm">Aucun bot sur ce PBX</p>
            </div>
          )}

          {/* Bot list */}
          <div className="space-y-2">
            {items.map((bot) => {
              const isVoice = tab === 'voicebots'
              const vbot = isVoice ? (bot as VoiceBot) : null
              const embedded = vbot?.endpoint?.llm?.embeddedTools ?? []
              const inlineTools = vbot?.endpoint?.llm?.tools ?? []
              const wimToolIds = vbot?.capabilities?.filter((c) => c.tool?.id).map((c) => c.tool!.id) ?? []
              const usedWimTools = (wimTools as WimTool[]).filter((t) => wimToolIds.includes(t.id))
              const hasTools = embedded.length > 0 || inlineTools.length > 0 || usedWimTools.length > 0

              return (
                <div
                  key={bot.id}
                  className="rounded-lg border bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Bot size={18} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{bot.name}</p>
                        {bot.description && (
                          <p className="text-xs text-muted-foreground truncate">{bot.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant={bot.enabled === false ? 'muted' : 'success'}>
                        {bot.enabled === false ? 'Inactif' : 'Actif'}
                      </Badge>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => navigate(`/bots/${bot.id}?pbxId=${pbxId}&type=${tab === 'chatbots' ? 'chatbot' : 'voicebot'}`)}
                      >
                        Éditer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openClone(bot)}>
                        <Copy size={12} />
                      </Button>
                      <Button
                        size="sm" variant="destructive"
                        onClick={() => openDelete(bot)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>

                  {/* Tool chips — VoiceBots only */}
                  {isVoice && hasTools && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                      {embedded.map((t, i) => <EmbeddedChip key={i} tool={t} />)}
                      {usedWimTools.map((t) => (
                        <span
                          key={t.id}
                          className="flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 bg-green-500/10 text-green-700 border-green-200"
                          title={t.description}
                        >
                          <Wrench size={10} /> {t.name}
                        </span>
                      ))}
                      {inlineTools.map((t, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 bg-orange-500/10 text-orange-700 border-orange-200"
                          title={t.function.description}
                        >
                          <Globe size={10} /> {t.function.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Clone dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent title={`Cloner "${cloneBot?.name}"`}>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nom du clone *</label>
              <Input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Nom du nouveau bot"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">PBX destination</label>
              <div className="relative">
                <select
                  className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                  value={targetPbxId}
                  onChange={(e) => setTargetPbxId(e.target.value)}
                >
                  {pbxList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.id === pbxId ? ' (même PBX)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2.5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={() => cloneBot && cloneMut.mutate({ id: cloneBot.id })}
                disabled={cloneMut.isPending || !cloneName.trim()}
              >
                {cloneMut.isPending ? 'Clonage…' : 'Cloner'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Secure delete dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) closeDelete() }}>
        <DialogContent title={`Supprimer "${deleteTarget?.name}" ?`}>
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <Lock size={13} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive leading-relaxed">
                Le bot sera placé en corbeille (10 entrées max). Saisissez votre mot de passe administrateur pour confirmer.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Mot de passe</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                  placeholder="Votre mot de passe"
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
                <Button variant="outline" disabled={deleteLoading}>Annuler</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Vérification…</>
                  : <><Trash2 size={13} /> Supprimer</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Trash panel dialog ───────────────────────────────────────────────── */}
      <Dialog open={trashOpen} onOpenChange={(open) => { setTrashOpen(open); if (!open) setRestoreTarget(null) }}>
        <DialogContent title="Corbeille">
          <div className="space-y-3">

            {/* Rename conflict section */}
            {restoreTarget && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-900">
                  Un bot nommé «&nbsp;{restoreTarget.botName}&nbsp;» existe déjà. Choisissez un nouveau nom :
                </p>
                <Input
                  value={restoreName}
                  onChange={(e) => setRestoreName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRestoreTarget(null)}>
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRestore(restoreTarget, restoreName.trim())}
                    disabled={!restoreName.trim()}
                  >
                    <RotateCcw size={12} /> Restaurer
                  </Button>
                </div>
              </div>
            )}

            {trashLoading && (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            )}

            {!trashLoading && trashList.length === 0 && (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Trash2 size={32} className="mb-2 opacity-30" />
                <p className="text-sm">Aucun bot en corbeille</p>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {trashList.map((trashed) => (
                <div
                  key={trashed.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{trashed.botName}</p>
                      <span className={`text-xs rounded-full px-2 py-0.5 border shrink-0 ${
                        trashed.botType === 'voicebot'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-secondary text-secondary-foreground border-border'
                      }`}>
                        {trashed.botType === 'voicebot' ? 'VoiceBot' : 'ChatBot'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Par {trashed.deletedBy} · {new Date(trashed.deletedAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleRestore(trashed)}
                    >
                      <RotateCcw size={12} /> Restaurer
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
