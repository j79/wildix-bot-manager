import type { EmbeddedToolsDraft, Section } from '@/types/botCreate'

export function assemblePrompt(sections: Section[]): string {
  return sections
    .filter(s => !s.optional || s.content.trim())
    .map(s => `#### ${s.title}\n${s.content}`)
    .join('\n\n---\n\n')
}

export function buildEmbeddedTools(d: EmbeddedToolsDraft) {
  const result: Array<{ type: string; name: string; parameters?: Record<string, string> }> = []
  for (const rule of d.transfer) {
    if (!rule.extension && !rule.context) continue
    result.push({
      type: 'TRANSFER',
      name: rule.name || 'Transfer',
      parameters: {
        ...(rule.extension   && { extension:   rule.extension }),
        ...(rule.context     && { context:     rule.context }),
        ...(rule.description && { description: rule.description }),
      },
    })
  }
  if (d.hangup.enabled) {
    result.push({
      type: 'HANGUP', name: 'Hangup',
      parameters: {
        ...(d.hangup.context     && { context:     d.hangup.context }),
        ...(d.hangup.description && { description: d.hangup.description }),
      },
    })
  }
  if (d.wait.enabled) {
    result.push({
      type: 'WAIT', name: 'Wait',
      parameters: {
        ...(d.wait.context     && { context:     d.wait.context }),
        ...(d.wait.description && { description: d.wait.description }),
      },
    })
  }
  return result
}

// Maps i18n language code → language name for the AI API
export const LANG_MAP: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  it: 'Italiano',
  es: 'Español',
  de: 'Deutsch',
}
