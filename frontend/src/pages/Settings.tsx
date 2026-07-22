import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Copy, Shield, User as UserIcon, Server, AlertCircle, RefreshCw, Brain, Eye, EyeOff, CheckCircle2, XCircle, Loader2, LayoutGrid, Globe } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { usersApi } from '@/api/users'
import { pbxApi } from '@/api/pbx'
import { aiConfigApi, aiApi, type AiProvider, type AiConfigInput, PROVIDER_LABELS, DEFAULT_MODELS } from '@/api/ai'
import { templatesApi, type BotTemplate } from '@/api/templates'
import { TemplateModal } from '@/components/TemplateModal'
import type { AppUser, PbxCredential } from '@/types/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'

// ── User form modal ───────────────────────────────────────────────────────────

interface UserFormProps {
  editing: AppUser | null
  onClose: () => void
}

function UserForm({ editing, onClose }: UserFormProps) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [form, setForm] = useState({
    email: editing?.email ?? '',
    name:  editing?.name  ?? '',
    role:  (editing?.role ?? 'user') as 'admin' | 'user',
    password: '',
  })

  const createMut = useMutation({
    mutationFn: () => usersApi.create({ email: form.email, password: form.password, name: form.name, role: form.role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); toast.success(t('settings.userCreated')) },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () => usersApi.update(editing!.id, {
      name: form.name || undefined,
      role: form.role,
      password: form.password || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); toast.success(t('settings.userUpdated')) },
    onError: (e: Error) => toast.error(e.message),
  })

  const saving = createMut.isPending || updateMut.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing && (!form.email || !form.password)) {
      toast.error(t('settings.userEmailRequired'))
      return
    }
    editing ? updateMut.mutate() : createMut.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!editing && (
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('settings.userEmailLabel')}</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs font-medium">{t('settings.userNameLabel')}</label>
        <Input
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder={t('settings.userNamePlaceholder')}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">{t('settings.userRoleLabel')}</label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={form.role}
          onChange={(e) => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
        >
          <option value="user">{t('settings.userRoleUser')}</option>
          <option value="admin">{t('settings.userRoleAdmin')}</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">
          {editing ? t('settings.userPasswordEdit') : t('settings.userPasswordLabel')}
        </label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
          required={!editing}
          placeholder={editing ? '••••••••' : ''}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {saving ? t('settings.userSaving') : editing ? t('settings.userUpdate') : t('settings.userCreate')}
        </Button>
      </div>
    </form>
  )
}

// ── PBX form modal ────────────────────────────────────────────────────────────

const PBX_EMPTY: Omit<PbxCredential, 'id' | 'user' | 'created' | 'updated'> = {
  name: '', pbx_host: '', api_token: '', pbx_serial: '', pbx_local_token: '', shared: false,
}

function PbxForm({ editing, onClose }: { editing: PbxCredential | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [form, setForm] = useState(
    editing
      ? { name: editing.name, pbx_host: editing.pbx_host, api_token: editing.api_token,
          pbx_serial: editing.pbx_serial ?? '', pbx_local_token: editing.pbx_local_token ?? '', shared: editing.shared ?? false }
      : PBX_EMPTY,
  )
  const [apiTest,   setApiTest]   = useState<{ ok: boolean; message: string } | null>(null)
  const [localTest, setLocalTest] = useState<{ ok: boolean; message: string } | null>(null)

  const createMut = useMutation({
    mutationFn: () => pbxApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pbx'] }); onClose(); toast.success(t('settings.pbxAdded')) },
    onError: (e: Error) => toast.error(e.message),
  })
  const updateMut = useMutation({
    mutationFn: () => pbxApi.update(editing!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pbx'] }); onClose(); toast.success(t('settings.pbxUpdated')) },
    onError: (e: Error) => toast.error(e.message),
  })

  const apiTestMut = useMutation({
    mutationFn: () => pbxApi.test({ api_token: form.api_token, type: 'api' }),
    onSuccess: (res) => setApiTest(res),
    onError: (e: Error) => setApiTest({ ok: false, message: e.message }),
  })
  const localTestMut = useMutation({
    mutationFn: () => pbxApi.test({ pbx_host: form.pbx_host, pbx_local_token: form.pbx_local_token, type: 'local' }),
    onSuccess: (res) => setLocalTest(res),
    onError: (e: Error) => setLocalTest({ ok: false, message: e.message }),
  })

  const saving = createMut.isPending || updateMut.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    editing ? updateMut.mutate() : createMut.mutate()
  }

  function TestBadge({ result }: { result: { ok: boolean; message: string } | null }) {
    if (!result) return null
    return (
      <p className={'text-[11px] mt-1 flex items-center gap-1 ' + (result.ok ? 'text-green-600' : 'text-red-500')}>
        {result.ok ? '✓' : '✗'} {result.message}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium">{t('settings.pbxNameLabel')}</label>
        <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="PBX Paris" required />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">{t('settings.pbxHostLabel')}</label>
        <Input value={form.pbx_host} onChange={(e) => { setForm(f => ({ ...f, pbx_host: e.target.value })); setLocalTest(null) }} placeholder="client.wildixin.com" required />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">{t('settings.pbxApiKeyLabel')}</label>
          <button
            type="button"
            onClick={() => { setApiTest(null); apiTestMut.mutate() }}
            disabled={!form.api_token || apiTestMut.isPending}
            className="text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-40 flex items-center gap-1 transition-colors"
          >
            {apiTestMut.isPending ? t('settings.pbxTesting') : t('settings.pbxTestLink')}
          </button>
        </div>
        <Input
          type="password"
          value={form.api_token}
          onChange={(e) => { setForm(f => ({ ...f, api_token: e.target.value })); setApiTest(null) }}
          placeholder="wsk-v1-…"
          required
        />
        <TestBadge result={apiTest} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Serial PBX <span className="font-normal text-muted-foreground">(X-Bees userId)</span></label>
        <Input value={form.pbx_serial} onChange={(e) => setForm(f => ({ ...f, pbx_serial: e.target.value }))} placeholder="" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">{t('settings.pbxLocalTokenLabel')}</label>
          <button
            type="button"
            onClick={() => { setLocalTest(null); localTestMut.mutate() }}
            disabled={!form.pbx_local_token || !form.pbx_host || localTestMut.isPending}
            className="text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-40 flex items-center gap-1 transition-colors"
          >
            {localTestMut.isPending ? t('settings.pbxTesting') : t('settings.pbxTestLink')}
          </button>
        </div>
        <Input
          type="password"
          value={form.pbx_local_token}
          onChange={(e) => { setForm(f => ({ ...f, pbx_local_token: e.target.value })); setLocalTest(null) }}
          placeholder="access_…"
        />
        <TestBadge result={localTest} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {saving ? t('settings.pbxSaving') : editing ? t('settings.pbxUpdate') : t('settings.pbxCreate')}
        </Button>
      </div>
    </form>
  )
}

// ── AI configuration section ──────────────────────────────────────────────────

const PROVIDERS: AiProvider[] = ['ollama', 'openai', 'gemini', 'anthropic', 'groq']

function AiSection() {
  const qc = useQueryClient()
  const { t } = useTranslation()

  const PROVIDER_DESCS: Record<AiProvider, string> = {
    ollama:    t('settings.providerLocal'),
    openai:    t('settings.providerOpenAI'),
    gemini:    t('settings.providerGemini'),
    anthropic: t('settings.providerAnthropic'),
    groq:      t('settings.providerGroq'),
  }

  const { data: current, isLoading: loadingCurrent } = useQuery({
    queryKey: ['ai-config'],
    queryFn: aiConfigApi.get,
  })

  // savedProviders : Record<provider, { hasKey, model, ollama_url }>
  const savedProviders = current?.savedProviders ?? {}

  const [provider,   setProvider]   = useState<AiProvider | null>(null)
  const [apiKey,     setApiKey]     = useState('')
  const [model,      setModel]      = useState('')
  const [ollamaUrl,  setOllamaUrl]  = useState('')
  const [showKey,    setShowKey]    = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing,    setTesting]    = useState(false)

  const activeProvider = provider ?? current?.provider ?? 'ollama'
  const needsKey = activeProvider !== 'ollama'

  // True if the selected provider already has a saved key (even if not the active one)
  const selectedHasSavedKey = needsKey && !!(savedProviders[activeProvider]?.hasKey)

  const saveMut = useMutation({
    mutationFn: () => {
      const data: AiConfigInput = { provider: activeProvider }
      if (needsKey && apiKey.trim()) data.api_key = apiKey.trim()
      else if (!needsKey) data.api_key = ''
      // If no key entered but provider has saved key: backend will use it
      if (model.trim()) data.model = model.trim()
      if (activeProvider === 'ollama' && ollamaUrl.trim()) data.ollama_url = ollamaUrl.trim()
      return aiConfigApi.update(data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-config'] })
      setProvider(null)
      setApiKey('')
      setModel('')
      setOllamaUrl('')
      setTestResult(null)
      toast.success(t('settings.aiSaved'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const data: AiConfigInput = { provider: activeProvider }
      if (needsKey) data.api_key = apiKey.trim() || undefined
      if (model.trim()) data.model = model.trim()
      if (activeProvider === 'ollama' && ollamaUrl.trim()) data.ollama_url = ollamaUrl.trim()
      const res = await aiConfigApi.test(data)
      setTestResult(res)
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Erreur' })
    } finally {
      setTesting(false)
    }
  }

  function handleProviderChange(p: AiProvider) {
    setProvider(p)
    setApiKey('')  // always clear — backend uses saved key if available
    setModel(savedProviders[p]?.model ?? '')
    setTestResult(null)
    if (p === 'ollama') setOllamaUrl(savedProviders['ollama']?.ollama_url || current?.ollama_url || '')
  }

  const isDirty = provider !== null || apiKey !== '' || model !== '' || ollamaUrl !== ''
  // Can save if: no key needed, OR key entered, OR switching to provider with saved key
  const canSave = !needsKey || apiKey.trim() !== '' || selectedHasSavedKey || (current?.hasKey && provider === null)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain size={16} className="text-muted-foreground" />
        <p className="text-sm font-semibold">{t('settings.aiSection')}</p>
        {!loadingCurrent && current && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium
            ${activeProvider === 'ollama'    ? 'bg-gray-100 text-gray-700' :
              activeProvider === 'openai'    ? 'bg-green-100 text-green-700' :
              activeProvider === 'gemini'    ? 'bg-blue-100 text-blue-700' :
              activeProvider === 'anthropic' ? 'bg-orange-100 text-orange-700' :
                                              'bg-purple-100 text-purple-700'}`}>
            {PROVIDER_LABELS[activeProvider]}
          </span>
        )}
      </div>

      {loadingCurrent && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      {!loadingCurrent && (
        <div className="rounded-lg border bg-card p-4 space-y-5">

          {/* Provider picker */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{t('settings.aiProvider')}</p>
            <div className="grid grid-cols-5 gap-2">
              {PROVIDERS.map((p) => {
                const hasSaved = p === 'ollama' || !!(savedProviders[p]?.hasKey)
                const isActive = current?.provider === p && provider === null
                return (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`relative flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                      activeProvider === p
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {hasSaved && (
                      <span
                        className={`absolute top-1 right-1 w-2 h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-green-500'}`}
                        title="Clé enregistrée"
                      />
                    )}
                    <span className="font-semibold">{PROVIDER_LABELS[p]}</span>
                    <span className="text-[10px] opacity-60 text-center leading-tight">{PROVIDER_DESCS[p]}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              • Pastille verte = clé enregistrée — cliquez pour activer sans re-saisir la clé
            </p>
          </div>

          {/* Ollama URL */}
          {activeProvider === 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t('settings.aiOllamaUrlLabel')}</label>
              <Input
                value={ollamaUrl || current?.ollama_url || ''}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://192.168.1.76:11434"
              />
              <p className="text-[11px] text-muted-foreground">{t('settings.aiOllamaUrlHint')}</p>
            </div>
          )}

          {/* API Key */}
          {needsKey && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                {t('settings.aiKeyLabel')}
                {selectedHasSavedKey && !apiKey && (
                  <span className="ml-2 text-[11px] text-green-600 font-normal flex-inline items-center gap-1">
                    ✓ Clé enregistrée — laisser vide pour la conserver
                  </span>
                )}
                {current?.hasKey && provider === null && !selectedHasSavedKey && (
                  <span className="ml-2 text-[11px] text-green-600 font-normal">{t('settings.aiKeySaved')}</span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestResult(null) }}
                  placeholder={selectedHasSavedKey ? '••••••••  (clé enregistrée)' : (current?.hasKey && provider === null ? '••••••••' : 'sk-…')}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(v => !v)}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Model override */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              {t('settings.aiModelLabel')} <span className="font-normal text-muted-foreground">({t('settings.aiModelOptional')} {DEFAULT_MODELS[activeProvider]})</span>
            </label>
            <Input
              value={model || (current?.provider === activeProvider ? current.model : '')}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODELS[activeProvider]}
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              testResult.ok
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.ok
                ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-green-600" />
                : <XCircle size={14} className="shrink-0 mt-0.5 text-red-600" />}
              <p className="text-xs">{testResult.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || (needsKey && !apiKey.trim() && !selectedHasSavedKey && !current?.hasKey)}
              className="gap-1.5"
            >
              {testing
                ? <><Loader2 size={13} className="animate-spin" /> {t('settings.aiTesting')}</>
                : <><CheckCircle2 size={13} /> {t('settings.aiTestBtn')}</>}
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !canSave || !isDirty}
              className="gap-1.5"
            >
              {saveMut.isPending ? t('settings.aiSaving') : t('settings.aiSaveBtn')}
            </Button>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Template flags ────────────────────────────────────────────────────────────

const LANG_FLAGS: Record<string, string> = {
  fr: '🇫🇷', en: '🇬🇧', it: '🇮🇹', es: '🇪🇸', de: '🇩🇪',
}

// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const isAdmin = me?.role === 'admin'

  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)

  // PBX state
  const [pbxOpen, setPbxOpen]       = useState(false)
  const [pbxEditing, setPbxEditing] = useState<PbxCredential | null>(null)

  // Templates state
  const [tplOpen, setTplOpen]             = useState(false)
  const [tplEditing, setTplEditing]       = useState<BotTemplate | null>(null)

  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.list,
  })

  const tplDeleteMut = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template supprimé') },
    onError: (e: Error) => toast.error(e.message),
  })

  const tplDuplicateMut = useMutation({
    mutationFn: (tpl: BotTemplate) => templatesApi.create({
      name:     `${tpl.name} (copie)`,
      icon:     tpl.icon,
      sector:   tpl.sector,
      useCase:  tpl.useCase,
      sections: tpl.sections.map(s => ({ ...s })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template dupliqué') },
    onError: (e: Error) => toast.error(e.message),
  })

  const tplResetMut = useMutation({
    mutationFn: (id: string) => templatesApi.resetOverride(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template réinitialisé') },
    onError: (e: Error) => toast.error(e.message),
  })

  const { data: pbxList = [], isLoading: pbxLoading, isError: pbxError, refetch: refetchPbx } = useQuery({
    queryKey: ['pbx'],
    queryFn: pbxApi.list,
    retry: 2,
  })

  const pbxDeleteMut = useMutation({
    mutationFn: pbxApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pbx'] }); toast.success(t('settings.pbxDeleted')) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openPbxCreate() { setPbxEditing(null); setPbxOpen(true) }
  function openPbxEdit(p: PbxCredential) { setPbxEditing(p); setPbxOpen(true) }
  function closePbx() { setPbxOpen(false); setPbxEditing(null) }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: isAdmin,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t('settings.usersDeleted')) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setOpen(true) }
  function openEdit(u: AppUser) { setEditing(u); setOpen(true) }
  function close() { setOpen(false); setEditing(null) }


  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

      {/* Intelligence Artificielle */}
      <AiSection />

      {/* PBX Wildix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-muted-foreground" />
            <p className="text-sm font-semibold">{t('settings.pbxSection')}</p>
          </div>
          <Button size="sm" onClick={openPbxCreate}><Plus size={14} /> {t('settings.pbxAdd')}</Button>
        </div>

        {pbxLoading && <p className="text-sm text-muted-foreground">{t('settings.pbxLoading')}</p>}

        {!pbxLoading && pbxError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <AlertCircle size={13} className="text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">{t('settings.pbxLoadError')}</p>
            <button
              onClick={() => refetchPbx()}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              <RefreshCw size={11} /> {t('settings.pbxRetry')}
            </button>
          </div>
        )}

        {!pbxLoading && !pbxError && pbxList.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('settings.pbxNone')}</p>
        )}

        <div className="space-y-2">
          {pbxList.map((pbx) => (
            <div key={pbx.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Server size={14} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{pbx.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{pbx.pbx_host}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button size="sm" variant="outline" onClick={() => openPbxEdit(pbx)}>
                  <Pencil size={12} />
                </Button>
                <Button
                  size="sm" variant="destructive"
                  onClick={() => { if (confirm(t('settings.pbxConfirmDelete', { name: pbx.name }))) pbxDeleteMut.mutate(pbx.id) }}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-muted-foreground" />
            <p className="text-sm font-semibold">Templates de création assistée</p>
          </div>
{isAdmin && (
            <Button size="sm" onClick={() => { setTplEditing(null); setTplOpen(true) }}>
              <Plus size={14} /> Nouveau template
            </Button>
          )}
        </div>

        {tplLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

        {!tplLoading && templates.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun template configuré.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(templates as BotTemplate[]).map(tpl => {
            const lc = i18n.language?.slice(0, 2) ?? 'fr'
            const displayName   = tpl.translations?.[lc]?.name   ?? tpl.name
            const displaySector = tpl.translations?.[lc]?.sector ?? tpl.sector
            const availableCodes = (['fr', 'en', 'it', 'es', 'de'] as const).filter(code =>
              code === 'fr' || !!(tpl.translations?.[code]?.name)
            )
            return (
            <div key={tpl.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
              <span className="text-xl shrink-0">{tpl.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {tpl.hasOverride && !isAdmin && (
                    <span className="shrink-0 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">modifié</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{displaySector}</p>
                <div className="flex gap-0.5 mt-1">
                  {availableCodes.map(code => (
                    <span key={code} className={`text-[11px] leading-none ${code === lc ? '' : 'opacity-40'}`}>
                      {LANG_FLAGS[code]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isAdmin && (
                  <Button size="sm" variant="outline" title="Dupliquer"
                    onClick={() => tplDuplicateMut.mutate(tpl)}
                    disabled={tplDuplicateMut.isPending}
                  >
                    <Copy size={12} />
                  </Button>
                )}
                <Button size="sm" variant="outline" title="Modifier" onClick={() => { setTplEditing(tpl); setTplOpen(true) }}>
                  <Pencil size={12} />
                </Button>
                {isAdmin ? (
                  <Button size="sm" variant="destructive" title="Supprimer"
                    onClick={() => { if (confirm(`Supprimer le template "${tpl.name}" ?`)) tplDeleteMut.mutate(tpl.id) }}
                    disabled={tplDeleteMut.isPending}
                  >
                    <Trash2 size={12} />
                  </Button>
                ) : tpl.hasOverride ? (
                  <Button size="sm" variant="outline" title="Réinitialiser"
                    onClick={() => { if (confirm('Réinitialiser ce template aux valeurs par défaut ?')) tplResetMut.mutate(tpl.id) }}
                    disabled={tplResetMut.isPending}
                    className="text-amber-600 hover:text-amber-700 border-amber-300"
                  >
                    <RefreshCw size={12} />
                  </Button>
                ) : null}
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Mon compte */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">{t('settings.myAccount')}</p>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <UserIcon size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{me?.name || me?.email}</p>
            <p className="text-xs text-muted-foreground">{me?.email}</p>
          </div>
          <Badge variant={me?.role === 'admin' ? 'success' : 'muted'} className="ml-auto">
            {me?.role === 'admin' ? t('settings.roleAdmin') : t('settings.roleUser')}
          </Badge>
        </div>
      </div>

      {/* Gestion utilisateurs — admin only */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-muted-foreground" />
              <p className="text-sm font-semibold">{t('settings.usersSection')}</p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> {t('settings.usersAdd')}
            </Button>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{t('settings.usersLoading')}</p>}

          {!isLoading && users.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('settings.usersNone')}</p>
          )}

          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserIcon size={14} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant={u.role === 'admin' ? 'success' : 'muted'}>
                    {u.role === 'admin' ? t('settings.roleAdmin') : t('settings.roleUser')}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                    <Pencil size={12} />
                  </Button>
                  <Button
                    size="sm" variant="destructive"
                    disabled={u.id === me?.id}
                    onClick={() => {
                      if (confirm(t('settings.userConfirmDelete', { email: u.email }))) deleteMut.mutate(u.id)
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal utilisateurs */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
        <DialogContent title={editing ? `${t('settings.userEditTitle')} — ${editing.email}` : t('settings.userNewTitle')}>
          <UserForm editing={editing} onClose={close} />
        </DialogContent>
      </Dialog>

      {/* Modal PBX */}
      <Dialog open={pbxOpen} onOpenChange={(v) => { if (!v) closePbx() }}>
        <DialogContent title={pbxEditing ? t('settings.pbxEditTitle') : t('settings.pbxAddTitle')}>
          <PbxForm editing={pbxEditing} onClose={closePbx} />
        </DialogContent>
      </Dialog>

      {/* Modal Template */}
      <Dialog open={tplOpen} onOpenChange={(v) => { if (!v) { setTplOpen(false); setTplEditing(null) } }}>
        <DialogContent title={tplEditing ? `Modifier — ${tplEditing.name}` : 'Nouveau template'}>
          <TemplateModal editing={tplEditing} onClose={() => { setTplOpen(false); setTplEditing(null) }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
