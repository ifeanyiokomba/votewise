'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2, LifeBuoy, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'How do I vote?',
  'I did not receive my OTP',
  'When do results come out?',
  'Can someone see who I voted for?',
]

export function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Hello! I'm AfriBot 🤖, your voting assistant. Ask me how to vote, eligibility, OTP issues, or anything about the SUG election." },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, open])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user', content } as Msg]
    setMessages(next); setInput(''); setBusy(true)
    try {
      const history = next.slice(1, -1).map((m) => ({ role: m.role, content: m.content }))
      const d = await api.chat(content, history)
      setMessages((m) => [...m, { role: 'assistant', content: d.reply }])
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: "I couldn't reach the server. If urgent, tap 'Open a Support Ticket' below." }])
    } finally { setBusy(false) }
  }

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {!open && (
          <Button onClick={() => setOpen(true)} size="lg" className="h-14 w-14 rounded-full shadow-lg gap-0 p-0">
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground ring-2 ring-background">AI</span>
          </Button>
        )}
      </div>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md">
          <Card className="afrivote-card-glow flex h-[32rem] flex-col overflow-hidden">
            <div className="flex items-center justify-between bg-primary p-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/15"><Bot className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold">AfriBot</div>
                  <div className="flex items-center gap-1 text-[10px] text-primary-foreground/80">
                    <span className="afrivote-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" /> Online · AI assistant
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-primary-foreground/15"><X className="h-5 w-5" /></button>
            </div>

            <div ref={scrollRef} className="afrivote-scroll flex-1 space-y-3 overflow-y-auto bg-secondary/30 p-3">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
                  <div className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', m.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground')}>
                    {m.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', m.role === 'assistant' ? 'rounded-tl-sm bg-card' : 'rounded-tr-sm bg-primary text-primary-foreground')}>
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div>
                  <div className="rounded-2xl rounded-tl-sm bg-card px-3 py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                </div>
              )}
              {messages.length <= 1 && (
                <div className="space-y-1.5 pt-2">
                  <p className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">Suggested questions</p>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs hover:bg-muted/50">
                      <Sparkles className="h-3.5 w-3.5 text-accent" /> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-card p-2">
              <div className="flex items-center gap-2">
                <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(input)} placeholder="Type your question…" className="text-sm" />
                <Button size="icon" onClick={() => send(input)} disabled={busy}><Send className="h-4 w-4" /></Button>
              </div>
              <button onClick={() => { setOpen(false); setTicketOpen(true) }} className="mt-1.5 flex w-full items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <LifeBuoy className="h-3 w-3" /> Not helpful? Open a support ticket
              </button>
            </div>
          </Card>
        </div>
      )}

      <SupportTicketDialog open={ticketOpen} onOpenChange={setTicketOpen} />
    </>
  )
}

export function SupportTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [form, setForm] = useState<any>({ issueType: 'OTP_NOT_RECEIVED' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  async function submit() {
    setBusy(true)
    try {
      await api.submitTicket(form)
      setDone(true); toast.success('Support ticket submitted')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setDone(false); setForm({ issueType: 'OTP_NOT_RECEIVED' }) } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><LifeBuoy className="h-5 w-5 text-primary" /> Open a Support Ticket</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><LifeBuoy className="h-7 w-7" /></div>
            <p className="mt-3 font-semibold">Ticket submitted</p>
            <p className="mt-1 text-sm text-muted-foreground">An electoral observer will attend to you shortly. Check your email/phone for updates.</p>
            <Button className="mt-4" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Matric Number</Label><Input value={form.matric || ''} onChange={(e) => set('matric', e.target.value.toUpperCase())} className="font-mono" /></div>
              <div className="space-y-1.5"><Label>Full Name</Label><Input value={form.fullName || ''} onChange={(e) => set('fullName', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email (optional)</Label><Input value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Phone (optional)</Label><Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Issue Type</Label>
              <Select value={form.issueType} onValueChange={(v) => set('issueType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OTP_NOT_RECEIVED">OTP not received</SelectItem>
                  <SelectItem value="CANNOT_LOGIN">Cannot log in</SelectItem>
                  <SelectItem value="VERIFICATION_FAILED">Verification failed</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Describe the issue</Label><Textarea rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Tell us what happened…" /></div>
          </div>
        )}
        {!done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !form.matric || !form.fullName || !form.description} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />} Submit Ticket</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
