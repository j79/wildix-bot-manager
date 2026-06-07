import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export function CollapsibleSection({ title, icon, badge, defaultOpen = true, children }: {
  title: string
  icon: React.ReactNode
  badge?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex items-center gap-2 w-full px-4 py-3 text-left">
        {icon}
        <span className="text-sm font-semibold flex-1">{title}</span>
        {badge && <span className="text-xs text-muted-foreground mr-2">{badge}</span>}
        <ChevronRight size={14} className={`shrink-0 transition-transform text-muted-foreground ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4 border-t">{children}</div>}
    </div>
  )
}
