import { useEffect, useState, useRef } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { LogOut, Bot, Wrench, Settings as SettingsIcon, Sparkles, Server, ChevronDown, AlertCircle, Brain, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { usePbxStore } from '@/stores/pbx'
import { authApi } from '@/api/auth'
import { pbxApi } from '@/api/pbx'
import { aiConfigApi, PROVIDER_LABELS, PROVIDER_COLORS } from '@/api/ai'
import BotManager from './BotManager'
import BotCreate from './BotCreate'
import BotEdit from './BotEdit'
import Tools from './Tools'
import Settings from './Settings'
import AIChat from './AIChat'
import i18n from '@/i18n/index'

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
]

function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentLang = i18n.language?.slice(0, 2) ?? 'fr'
  const current = LANGUAGES.find(l => l.code === currentLang) ?? LANGUAGES[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent transition-colors"
        title="Change language"
      >
        <Globe size={12} className="text-muted-foreground" />
        <span>{current.flag}</span>
        <span className="text-muted-foreground">{current.code.toUpperCase()}</span>
        <ChevronDown size={10} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-md border bg-popover shadow-md z-50 py-1">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors ${
                currentLang === lang.code ? 'font-semibold text-primary' : 'text-foreground'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { t } = useTranslation()

  const handleLogout = async () => {
    await authApi.logout().catch(() => {})
    clearAuth()
    navigate('/login')
    toast.success(t('dashboard.logoutSuccess'))
  }

  const nav = [
    { to: '/bots',     icon: Bot,          label: t('nav.bots')     },
    { to: '/tools',    icon: Wrench,       label: t('nav.tools')    },
    { to: '/ai',       icon: Sparkles,     label: t('nav.aiChat')   },
    { to: '/settings', icon: SettingsIcon, label: t('nav.settings') },
  ]

  return (
    <aside className="w-56 flex flex-col border-r bg-card h-screen sticky top-0 shrink-0">
      <div className="px-4 py-5 border-b">
        <span className="font-bold text-sm">Wilma Bot Manager</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t">
        <div className="text-xs text-muted-foreground mb-2 truncate">{user?.email}</div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={14} />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}

function PbxBanner() {
  const navigate = useNavigate()
  const { selectedPbxId, setSelectedPbxId } = usePbxStore()
  const { t } = useTranslation()
  const { data: pbxList = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['pbx'],
    queryFn: pbxApi.list,
    refetchInterval: 30_000,
    retry: 2,
  })
  const { data: aiConfig } = useQuery({
    queryKey: ['ai-config'],
    queryFn: aiConfigApi.get,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!selectedPbxId && pbxList.length > 0) setSelectedPbxId(pbxList[0].id)
  }, [pbxList, selectedPbxId, setSelectedPbxId])

  const selected = pbxList.find((p) => p.id === selectedPbxId)

  return (
    <div className="flex items-center gap-3 px-6 py-2 border-b bg-muted/40 shrink-0">
      <Server size={13} className="text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">PBX</span>

      {isLoading && <span className="text-xs text-muted-foreground italic">{t('dashboard.pbxLoading')}</span>}
      {!isLoading && isError && (
        <>
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle size={11} /> {t('dashboard.pbxError')}
          </span>
          <button onClick={() => refetch()} className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors">
            {t('dashboard.pbxRetry')}
          </button>
        </>
      )}
      {!isLoading && !isError && pbxList.length === 0 && (
        <button onClick={() => navigate('/settings')} className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
          {t('dashboard.pbxNone')}
        </button>
      )}
      {!isLoading && pbxList.length > 0 && (
        <>
          <div className="relative">
            <select
              className="h-7 rounded-md border border-input bg-background pl-2 pr-6 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-ring font-medium"
              value={selectedPbxId}
              onChange={(e) => setSelectedPbxId(e.target.value)}
            >
              {!selectedPbxId && <option value="">{t('dashboard.pbxSelect')}</option>}
              {pbxList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1.5 text-muted-foreground" />
          </div>
          {selected && <span className="text-xs text-muted-foreground">{selected.pbx_host}</span>}
        </>
      )}

      {aiConfig && (
        <>
          <span className="text-muted-foreground/40 text-xs select-none mx-1">|</span>
          <Brain size={13} className="text-muted-foreground shrink-0" />
          <button
            onClick={() => navigate('/settings')}
            title={t('dashboard.aiChangeProvider')}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-80 ${PROVIDER_COLORS[aiConfig.provider]}`}
          >
            {PROVIDER_LABELS[aiConfig.provider]}
            {aiConfig.model && <span className="opacity-60 font-normal">{aiConfig.model}</span>}
          </button>
        </>
      )}

      {/* Language switcher — pushed to the right */}
      <div className="ml-auto">
        <LanguageSwitcher />
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <PbxBanner />
        <main className="flex-1 p-6 min-w-0 overflow-auto">
          <Routes>
            <Route path="/"              element={<Navigate to="/bots" replace />} />
            <Route path="/bots"          element={<BotManager />} />
            <Route path="/bots/create"   element={<BotCreate />}  />
            <Route path="/bots/:id"      element={<BotEdit />}    />
            <Route path="/tools"         element={<Tools />}      />
            <Route path="/ai"            element={<AIChat />}     />
            <Route path="/settings"      element={<Settings />}   />
          </Routes>
        </main>
      </div>
    </div>
  )
}
