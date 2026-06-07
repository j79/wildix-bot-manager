import { Check } from 'lucide-react'

export const STEPS = ['Identité', 'Prompt', 'Outils & Paramètres', 'Voix', 'Récapitulatif']

export function StepHeader({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 flex-wrap gap-y-2">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            i < current
              ? 'bg-primary/20 text-primary'
              : i === current
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
          }`}>
            {i < current ? <Check size={12} /> : <span>{i + 1}</span>}
            {label}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-4 mx-1 ${i < current ? 'bg-primary/40' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
