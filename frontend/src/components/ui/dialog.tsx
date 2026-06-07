import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog        = RadixDialog.Root
export const DialogTrigger = RadixDialog.Trigger
export const DialogClose   = RadixDialog.Close

export function DialogContent({
  children,
  title,
  className,
}: {
  children: React.ReactNode
  title: string
  className?: string
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
          <RadixDialog.Close className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none">
            <X size={16} />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}
