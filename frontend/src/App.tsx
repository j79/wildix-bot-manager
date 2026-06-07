import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { token, setAuth, clearAuth } = useAuthStore()
  const [initializing, setInitializing] = useState(true)

  // Vérifie la validité du token au démarrage
  useEffect(() => {
    if (!token) {
      setInitializing(false)
      return
    }
    authApi.me()
      .then((user) => setAuth(token, user))
      .catch(() => clearAuth())
      .finally(() => setInitializing(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Chargement…</div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
      </Routes>
    </>
  )
}
