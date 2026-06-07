import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Server } from 'lucide-react'
import { pbxApi } from '@/api/pbx'
import type { PbxCredential } from '@/types/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'

const EMPTY: Omit<PbxCredential, 'id' | 'user' | 'created' | 'updated'> = {
  name: '', pbx_host: '', api_token: '', pbx_serial: '', pbx_local_token: '',
}

export default function PBX() {
  const qc = useQueryClient()
  const [open, setOpen]     = useState(false)
  const [editing, setEditing] = useState<PbxCredential | null>(null)
  const [form, setForm]     = useState(EMPTY)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['pbx'],
    queryFn: pbxApi.list,
  })

  const createMut = useMutation({
    mutationFn: pbxApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pbx'] }); closeDialog(); toast.success('PBX ajouté') },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY }) => pbxApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pbx'] }); closeDialog(); toast.success('PBX mis à jour') },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: pbxApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pbx'] }); toast.success('PBX supprimé') },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(pbx: PbxCredential) {
    setEditing(pbx)
    setForm({ name: pbx.name, pbx_host: pbx.pbx_host, api_token: pbx.api_token,
              pbx_serial: pbx.pbx_serial, pbx_local_token: pbx.pbx_local_token })
    setOpen(true)
  }
  function closeDialog() { setOpen(false); setEditing(null) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) updateMut.mutate({ id: editing.id, data: form })
    else createMut.mutate(form)
  }

  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">PBX Wildix</h1>
          <p className="text-sm text-muted-foreground">Gérez vos connexions PBX</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Ajouter un PBX</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!isLoading && list.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Server size={40} className="mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium">Aucun PBX configuré</p>
          <p className="mt-1 text-xs text-muted-foreground">Ajoutez votre premier PBX pour commencer</p>
          <Button className="mt-4" onClick={openCreate}><Plus size={16} /> Ajouter un PBX</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((pbx) => (
          <div key={pbx.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{pbx.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pbx.pbx_host}</p>
              </div>
              <Server size={18} className="text-muted-foreground/60 mt-0.5" />
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Token : {pbx.api_token ? `${pbx.api_token.slice(0, 8)}…` : '—'}
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => openEdit(pbx)}>
                <Pencil size={12} /> Éditer
              </Button>
              <Button
                size="sm" variant="destructive"
                onClick={() => { if (confirm(`Supprimer "${pbx.name}" ?`)) deleteMut.mutate(pbx.id) }}
              >
                <Trash2 size={12} /> Supprimer
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing ? 'Modifier le PBX' : 'Ajouter un PBX'}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {([
              ['name',            'Nom *',            'PBX Paris', true],
              ['pbx_host',        'Hôte PBX *',       'client.wildixin.com', true],
              ['api_token',       'Company API Key *', 'wsk-v1-…', true],
              ['pbx_serial',      'Serial PBX (X-Bees userId)', '', false],
              ['pbx_local_token', 'PBX Simple Token', 'access_…', false],
            ] as [keyof typeof EMPTY, string, string, boolean][]).map(([field, label, placeholder, required]) => (
              <div key={field} className="space-y-1">
                <label className="text-xs font-medium text-foreground">{label}</label>
                <Input
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder}
                  required={required}
                  type={field.includes('token') ? 'password' : 'text'}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Annuler</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
