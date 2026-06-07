import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Trash2, Bot, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { aiApi, aiConfigApi, PROVIDER_LABELS } from '@/api/ai'
import { Button } from '@/components/ui/button'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const DEFAULT_SYSTEM =
  'Tu es un assistant IA utile et concis. Réponds en français sauf si on te parle dans une autre langue.'

let nextId = 1

export default function AIChat() {
  const { t } = useTranslation()
  const { data: aiConfig } = useQuery({ queryKey: ['ai-config'], queryFn: aiConfigApi.get })

  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM)
  const [showSystem, setShowSystem]   = useState(false)
  const [generating, setGenerating]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || generating) return

    const userMsg: Message = { id: nextId++, role: 'user', content: text }
    const assistantId = nextId++
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setGenerating(true)

    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }))

    try {
      await aiApi.chatStream(history, systemPrompt, (chunk) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m),
        )
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur LLM')
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m),
      )
      setGenerating(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  function clearChat() {
    setMessages([])
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bot size={20} /> {t('aiChat.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {aiConfig
              ? `${aiConfig.model} · ${PROVIDER_LABELS[aiConfig.provider]}`
              : t('common.loading')}
          </p>
        </div>
        <Button
          variant="ghost" size="sm"
          onClick={clearChat}
          disabled={messages.length === 0}
          className="text-muted-foreground"
        >
          <Trash2 size={14} /> {t('aiChat.clear')}
        </Button>
      </div>

      {/* System prompt (collapsible) */}
      <div className="shrink-0 mt-3">
        <button
          onClick={() => setShowSystem((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showSystem ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {t('aiChat.systemPrompt') || 'Prompt système'}
        </button>
        {showSystem && (
          <textarea
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={generating}
          />
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t('aiChat.noMessages')}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-muted text-foreground rounded-tl-sm'
            }`}>
              {msg.content || (msg.streaming && (
                <Loader2 size={14} className="animate-spin opacity-60" />
              ))}
              {msg.streaming && msg.content && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-current opacity-60 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 pt-3 border-t">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={t('aiChat.placeholder')}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKey}
            disabled={generating}
            autoFocus
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden leading-relaxed"
          />
          <Button onClick={send} disabled={!input.trim() || generating} className="shrink-0">
            {generating
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
