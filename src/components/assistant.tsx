/* AI tutor chat in the bottom corner, powered by Claude.
   Runs entirely in the browser with the user's own Anthropic API key. */
import type Anthropic from '@anthropic-ai/sdk'
import { KeyRoundIcon, MessageCircleIcon, SendHorizonalIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { tutorContext } from '@/lib/tutor-context'
import { cn } from '@/lib/utils'

const MODEL = 'claude-opus-5-5'
const KEY_STORAGE = 'lingocards:anthropic-key'

const SYSTEM = `You are the friendly language tutor built into LingoCards, a spaced-repetition flashcard app.
Help the learner with vocabulary, grammar, pronunciation, example sentences, mnemonics and short practice drills.
Keep replies short and conversational — a few sentences or a compact list — since they appear in a small chat panel.
Plain text only: no Markdown headings or tables.
If the learner is in the middle of a review and hasn't revealed the answer yet, give hints rather than the answer unless they ask for it.`

interface Bubble {
  role: 'user' | 'assistant'
  text: string
  pending?: boolean
  error?: boolean
}

type SDK = typeof Anthropic

// The SDK is loaded on first use so it stays out of the main bundle.
let sdk: SDK | null = null
let client: Anthropic | null = null

async function getClient() {
  sdk ??= (await import('@anthropic-ai/sdk')).default
  client ??= new sdk({ apiKey: localStorage.getItem(KEY_STORAGE), dangerouslyAllowBrowser: true })
  return client
}

function forgetKey() {
  localStorage.removeItem(KEY_STORAGE)
  client = null
}

export function Assistant() {
  const [open, setOpen] = useState(false)
  const [hasKey, setHasKey] = useState(() => !!localStorage.getItem(KEY_STORAGE))
  const [bubbles, setBubbles] = useState<Bubble[]>([{ role: 'assistant', text: 'Hi! Ask me about words, grammar, or the card you’re studying.' }])
  const [input, setInput] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [busy, setBusy] = useState(false)
  const messages = useRef<Anthropic.Beta.BetaMessageParam[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [bubbles])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const updateLast = (patch: Partial<Bubble> | ((b: Bubble) => Partial<Bubble>)) =>
    setBubbles(bs => {
      const last = bs[bs.length - 1]
      return [...bs.slice(0, -1), { ...last, ...(typeof patch === 'function' ? patch(last) : patch) }]
    })

  function errorText(err: unknown) {
    if (sdk && err instanceof sdk.AuthenticationError) {
      forgetKey()
      setHasKey(false)
      return 'That API key was rejected. Please enter a valid key.'
    }
    if (sdk && err instanceof sdk.RateLimitError) return 'Too many requests right now — try again in a moment.'
    if (sdk && err instanceof sdk.APIError) return `Something went wrong (${err.status ?? 'network'}). Please try again.`
    return 'Could not reach the assistant. Check your connection and try again.'
  }

  async function send(text: string) {
    setBusy(true)
    const context = tutorContext()
    // The app context rides along with each question; the history itself stays append-only.
    messages.current.push({ role: 'user', content: context ? `<app_context>\n${context}\n</app_context>\n\n${text}` : text })
    setBubbles(bs => [...bs, { role: 'user', text }, { role: 'assistant', text: '', pending: true }])

    try {
      const api = await getClient()
      const stream = api.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        messages: messages.current,
      })
      stream.on('text', delta => updateLast(b => ({ text: b.text + delta, pending: false })))
      const final = await stream.finalMessage()
      if (final.stop_reason === 'refusal') {
        messages.current.pop()
        updateLast({ text: 'Sorry, I can’t help with that one. Try asking something else.', pending: false, error: true })
      } else {
        messages.current.push({ role: 'assistant', content: final.content })
        updateLast(b => ({ text: b.text || '…', pending: false }))
      }
    } catch (err) {
      console.warn('Assistant error', err)
      messages.current.pop()
      updateLast({ text: errorText(err), pending: false, error: true })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    send(text)
  }

  const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  const saveKey = (e: FormEvent) => {
    e.preventDefault()
    const key = keyInput.trim()
    if (!key) return
    localStorage.setItem(KEY_STORAGE, key)
    client = null
    setKeyInput('')
    setHasKey(true)
  }

  return (
    <aside className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <Card
          aria-label="AI tutor"
          className="h-[min(520px,calc(100svh-7rem))] w-[min(370px,calc(100vw-2.5rem))] gap-0 py-0 shadow-xl animate-in fade-in slide-in-from-bottom-2"
        >
          <header className="flex items-center justify-between border-b py-2 pr-2 pl-4">
            <strong className="flex items-center gap-1.5 text-sm">
              <SparklesIcon className="size-4 text-primary" /> AI tutor
            </strong>
            <div className="flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Change API key"
                    onClick={() => {
                      forgetKey()
                      setHasKey(false)
                    }}
                  >
                    <KeyRoundIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Change API key</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setOpen(false)}>
                <XIcon />
              </Button>
            </div>
          </header>

          <div ref={logRef} aria-live="polite" className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
            {bubbles.map((b, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap',
                  b.role === 'user' ? 'self-end rounded-br-sm bg-primary text-primary-foreground' : 'self-start rounded-bl-sm bg-muted',
                  b.error && 'bg-destructive/10 text-destructive',
                )}
              >
                {b.text}
                {b.pending && <span className="animate-pulse">…</span>}
              </div>
            ))}
          </div>

          {hasKey ? (
            <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
              <Textarea
                ref={inputRef}
                autoFocus
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Ask your tutor…"
                aria-label="Message"
                className="max-h-30 min-h-9 resize-none"
              />
              <Button type="submit" size="icon-lg" aria-label="Send" disabled={busy || !input.trim()}>
                <SendHorizonalIcon />
              </Button>
            </form>
          ) : (
            <form onSubmit={saveKey} className="border-t p-3">
              <Field>
                <FieldDescription>Enter your Anthropic API key to chat. It’s kept in this browser and only sent to Anthropic.</FieldDescription>
                <Input type="password" autoFocus required autoComplete="off" placeholder="sk-ant-…" aria-label="Anthropic API key" value={keyInput} onChange={e => setKeyInput(e.target.value)} />
                <Button type="submit">Save key</Button>
              </Field>
            </form>
          )}
        </Card>
      )}
      <Button
        size="icon"
        aria-label={open ? 'Close AI tutor' : 'Open AI tutor'}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="size-14 rounded-full shadow-lg transition-transform hover:scale-105 [&_svg:not([class*='size-'])]:size-6"
      >
        {open ? <XIcon /> : <MessageCircleIcon />}
      </Button>
    </aside>
  )
}
