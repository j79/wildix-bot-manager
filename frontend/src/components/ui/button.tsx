import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'icon'
}

export function Button({ variant = 'default', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-primary text-primary-foreground hover:opacity-90': variant === 'default',
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground': variant === 'outline',
          'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
          'bg-destructive text-destructive-foreground hover:opacity-90': variant === 'destructive',
        },
        {
          'h-9 px-4 text-sm': size === 'md',
          'h-7 px-3 text-xs': size === 'sm',
          'h-9 w-9 p-0': size === 'icon',
        },
        className,
      )}
      {...props}
    />
  )
}
