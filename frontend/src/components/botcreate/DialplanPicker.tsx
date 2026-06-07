import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2 } from 'lucide-react'
import { dialplanApi } from '@/api/bots'
import { Input } from '@/components/ui/input'

export function DialplanPicker({ pbxId, value, onSelect }: {
  pbxId: string
  value: string
  onSelect: (ext: string) => void
}) {
  const [open, setOpen]           = useState(false)
  const [expandedId, setExpanded] = useState<number | null>(null)

  const { data: dialplanData } = useQuery({
    queryKey: ['dialplan', pbxId],
    queryFn:  () => dialplanApi.list(pbxId),
    enabled:  !!pbxId && open,
    staleTime: 60_000,
  })
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['dialplan-detail', pbxId, expandedId],
    queryFn:  () => dialplanApi.getDetail(pbxId, expandedId!),
    enabled:  !!expandedId,
    staleTime: 60_000,
  })

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          className="font-mono text-xs flex-1"
          placeholder="Ex: 100, sales_queue, +33123456789"
          value={value}
          onChange={e => onSelect(e.target.value)}
        />
        {pbxId && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className={`shrink-0 px-2.5 rounded-md border text-xs transition-colors ${
              open
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-input text-muted-foreground hover:bg-muted'
            }`}
          >
            Dialplan
          </button>
        )}
      </div>
      {open && (
        <div className="rounded-md border bg-card shadow-sm max-h-52 overflow-y-auto text-xs">
          {!dialplanData ? (
            <p className="px-3 py-2 text-muted-foreground flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> Chargement…
            </p>
          ) : !dialplanData.dialplans?.length ? (
            <p className="px-3 py-2 text-muted-foreground">Aucune règle dialplan configurée</p>
          ) : dialplanData.dialplans.map(dp => (
            <div key={dp.id} className="border-b last:border-b-0">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted"
                onClick={() => setExpanded(expandedId === dp.id ? null : dp.id)}
              >
                <ChevronRight size={11} className={`shrink-0 transition-transform ${expandedId === dp.id ? 'rotate-90' : ''}`} />
                <span className="font-medium flex-1 text-left">{dp.name || `#${dp.id}`}</span>
                {dp.description && <span className="text-muted-foreground truncate max-w-[140px]">{dp.description}</span>}
              </button>
              {expandedId === dp.id && (
                loadingDetail ? (
                  <div className="pl-7 py-1.5 flex items-center gap-1 text-muted-foreground">
                    <Loader2 size={10} className="animate-spin" /> Chargement…
                  </div>
                ) : detail?.numbers?.length ? (
                  detail.numbers.map(n => (
                    <button
                      key={n.number}
                      type="button"
                      className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 hover:bg-blue-50 text-left"
                      onClick={() => { onSelect(n.number); setOpen(false); setExpanded(null) }}
                    >
                      <span className="font-mono text-primary">{n.number}</span>
                      {n.comment && <span className="text-muted-foreground ml-1">{n.comment}</span>}
                    </button>
                  ))
                ) : (
                  <p className="pl-7 py-1.5 text-muted-foreground">Aucun numéro</p>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
