import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Hash, Plus, X, Loader2 } from 'lucide-react'
import { dialplanApi, type PbxUser } from '@/api/bots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SendMessageTarget } from '@/types/botCreate'

export function SendMessageRecipientsPicker({
  pbxId, targets, onChange,
}: {
  pbxId: string
  targets: SendMessageTarget[]
  onChange: (t: SendMessageTarget[]) => void
}) {
  const [groupInput, setGroupInput]   = useState('')
  const [groupContext, setGroupContext] = useState('')
  const [addingGroup, setAddingGroup]  = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['pbx-users', pbxId],
    queryFn: () => dialplanApi.listUsers(pbxId),
    enabled: !!pbxId,
    staleTime: 60_000,
  })
  const pbxUsers: PbxUser[] = data?.users ?? []

  function toggleUser(u: PbxUser) {
    if (targets.find(t => t.id === u.id && t.type === 'user')) {
      onChange(targets.filter(t => !(t.id === u.id && t.type === 'user')))
    } else {
      onChange([...targets, { id: u.id, type: 'user', displayName: u.name || u.extension, context: '' }])
    }
  }

  function addGroup() {
    const id = groupInput.trim()
    if (!id || targets.find(t => t.id === id && t.type === 'group')) return
    onChange([...targets, { id, type: 'group', displayName: id, context: groupContext.trim() }])
    setGroupInput(''); setGroupContext(''); setAddingGroup(false)
  }

  function updateContext(id: string, type: 'user' | 'group', context: string) {
    onChange(targets.map(t => t.id === id && t.type === type ? { ...t, context } : t))
  }

  function remove(id: string, type: 'user' | 'group') {
    onChange(targets.filter(t => !(t.id === id && t.type === type)))
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Sélectionnez les utilisateurs PBX et/ou saisissez des IDs de groupes. Précisez dans quel contexte envoyer le message.
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <Users size={11} /> Utilisateurs PBX
        </div>
        {!pbxId ? (
          <p className="text-xs text-muted-foreground italic pl-3">PBX non sélectionné</p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-3 py-1">
            <Loader2 size={10} className="animate-spin" /> Chargement…
          </div>
        ) : pbxUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground italic pl-3">Aucun utilisateur retourné par le PBX</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border bg-background p-1.5">
            {pbxUsers.map(u => {
              const sel = targets.find(t => t.id === u.id && t.type === 'user')
              return (
                <div key={u.id} className={`rounded transition-colors ${sel ? 'bg-blue-50/60' : ''}`}>
                  <label className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-blue-600 shrink-0"
                      checked={!!sel} onChange={() => toggleUser(u)} />
                    <span className="text-xs font-medium flex-1">{u.name || u.extension}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{u.extension}</span>
                  </label>
                  {sel && (
                    <div className="px-2 pb-2">
                      <Input className="text-xs h-7" placeholder="Quand envoyer à cet utilisateur ?"
                        value={sel.context} onChange={e => updateContext(u.id, 'user', e.target.value)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <Hash size={11} /> Groupes / ID manuel
        </div>
        {targets.filter(t => t.type === 'group').map(g => (
          <div key={g.id} className="flex items-start gap-2 rounded-md border bg-background p-2">
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold text-primary">{g.id}</span>
                <button onClick={() => remove(g.id, 'group')} className="text-muted-foreground hover:text-destructive ml-auto">
                  <X size={11} />
                </button>
              </div>
              <Input className="text-xs h-7" placeholder="Quand envoyer à ce groupe ?"
                value={g.context} onChange={e => updateContext(g.id, 'group', e.target.value)} />
            </div>
          </div>
        ))}
        {addingGroup ? (
          <div className="space-y-1.5 rounded-md border border-dashed p-2 bg-background">
            <Input autoFocus className="text-xs h-7 font-mono" placeholder="ID du groupe (ex : support_team…)"
              value={groupInput} onChange={e => setGroupInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setAddingGroup(false) }} />
            <Input className="text-xs h-7" placeholder="Quand envoyer à ce groupe ? (optionnel)"
              value={groupContext} onChange={e => setGroupContext(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGroup() }} />
            <div className="flex gap-1.5">
              <Button size="sm" className="h-6 text-xs" onClick={addGroup} disabled={!groupInput.trim()}>Ajouter</Button>
              <button className="text-xs text-muted-foreground" onClick={() => { setAddingGroup(false); setGroupInput(''); setGroupContext('') }}>Annuler</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingGroup(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
            <Plus size={11} /> Ajouter un groupe / ID
          </button>
        )}
      </div>
    </div>
  )
}
