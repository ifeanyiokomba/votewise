'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2, LifeBuoy, Sparkles, Camera, Paperclip, Image as ImageIcon, Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { api, getVoterToken } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ChatMsg {
  id?: string
  sender: string // VOTER | BOT | OFFICIAL
  content: string
  attachments?: any[]
  createdAt?: string
}

const SUGGESTIONS = [
  'How do I vote?',
  'I did not receive my OTP',
  'When do results come out?',
  'Can someone see who I voted for?',
]

export function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([
    { sender: 'BOT', content: "Hi! I'm VoteWise Assistant. Ask me how to vote, eligibility, OTP issues, or anything about the election. You can also send photos or files, or tap 'Talk to an Officer' to speak with a human." },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [escalated, setEscalated] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const voterToken = getVoterToken()

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, open])

  // Load chat history for logged-in voters
  useEffect(() => {
    if (open && voterToken && messages.length <= 1) {
      api.chatHistory().then((d) => {
        if (d.messages && d.messages.length > 0) {
          setMessages(d.messages)
          setThreadId(d.messages[d.messages.length - 1].threadId || null)
        }
      }).catch(() => {})
    }
  }, [open, voterToken])

  // Poll for official replies if escalated
  useEffect(() => {
    if (!open || !escalated || !threadId) return
    const t = setInterval(() => {
      api.chatHistory().then((d) => {
        if (d.messages && d.messages.length > messages.length) {
          setMessages(d.messages)
        }
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [open, escalated, threadId, messages.length])

  async function send(text?: string) {
    const content = (text || input).trim()
    if ((!content && attachments.length === 0) || busy) return
    setBusy(true)

    // Optimistically add the user message
    const userMsg: ChatMsg = { sender: 'VOTER', content: content || '(attachment)', attachments: attachments.length > 0 ? attachments : undefined }
    setMessages((m) => [...m, userMsg])
    setInput('')
    const sentAttachments = [...attachments]
    setAttachments([])

    try {
      if (voterToken) {
        // Use the new conversation API
        const d = await api.chatSend({ message: content, attachments: sentAttachments, threadId })
        if (d.threadId) setThreadId(d.threadId)
        if (d.escalated) {
          setEscalated(true)
          setMessages((m) => [...m, { sender: 'BOT', content: d.note || 'Your message has been sent to the electoral committee.' }])
        } else if (d.reply) {
          setMessages((m) => [...m, d.reply])
        }
      } else {
        // Fallback to legacy chat API for non-logged-in users
        const history = messages.slice(1).map((m) => ({ role: m.sender === 'VOTER' ? 'user' : 'assistant', content: m.content }))
        const d = await api.chat(content, history)
        setMessages((m) => [...m, { sender: 'BOT', content: d.reply }])
      }
    } catch {
      setMessages((m) => [...m, { sender: 'BOT', content: "I couldn't send your message. Please try again or open a support ticket." }])
    } finally { setBusy(false) }
  }

  function escalateToHuman() {
    setEscalated(true)
    send('I need to speak with an electoral officer.')
    toast.success('Connecting you with an electoral officer...')
  }

  // File upload handler
  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).slice(0, 3).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) { toast.error(`${file.name} is too large (max 2MB)`); return }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = String(ev.target?.result || '')
        const isImage = file.type.startsWith('image/')
        setAttachments((a) => [...a, { type: isImage ? 'image' : 'file', name: file.name, dataUrl }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Camera capture
  async function openCamera() {
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      toast.error('Could not access camera. Please check permissions.')
      setCameraOpen(false)
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    setAttachments((a) => [...a, { type: 'image', name: `photo-${Date.now()}.jpg`, dataUrl }])
    closeCamera()
    toast.success('Photo captured')
  }

  function removeAttachment(idx: number) {
    setAttachments((a) => a.filter((_, i) => i !== idx))
  }

  function senderIcon(sender: string) {
    if (sender === 'VOTER') return <User className="h-4 w-4" />
    if (sender === 'OFFICIAL') return <Headphones className="h-4 w-4" />
    return <Bot className="h-4 w-4" />
  }

  function senderLabel(sender: string) {
    if (sender === 'VOTER') return 'You'
    if (sender === 'OFFICIAL') return 'Officer'
    return 'VoteWise Bot'
  }

  return (
    <>
      {/* Floating button — premium pill design, follows scroll, on all pages */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2 print:hidden">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="group relative flex items-center gap-2 rounded-full bg-primary py-2.5 pl-3 pr-4 text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-all hover:scale-[1.02] hover:shadow-xl"
            aria-label="Open VoteWise Support chat"
          >
            <span className="votewise-live-dot absolute -left-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground ring-2 ring-background">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/12">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-medium sm:inline">Ask VoteWise</span>
          </button>
        )}
      </div>

      {/* Chat panel — premium floating card */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[100] w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md print:hidden">
          <Card className="vw-mockup flex h-[34rem] flex-col overflow-hidden p-0">
            {/* Header — refined with subtle gradient + status */}
            <div className="relative overflow-hidden bg-primary p-3.5 text-primary-foreground">
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="votewise-orb absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/15 blur-2xl" />
              </div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/12 ring-1 ring-primary-foreground/15"><Bot className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-medium">VoteWise Support</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-primary-foreground/75">
                      <span className="votewise-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      {escalated ? 'Connected to an officer' : 'Online · AI assistant'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-primary-foreground/12" aria-label="Close chat"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="votewise-scroll flex-1 space-y-3 overflow-y-auto bg-secondary/20 p-3">
              {messages.map((m, i) => (
                <div key={m.id || i} className={cn('flex gap-2', m.sender === 'VOTER' && 'flex-row-reverse')}>
                  <div className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1', m.sender === 'VOTER' ? 'bg-accent/15 text-accent-foreground ring-accent/20' : m.sender === 'OFFICIAL' ? 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/40' : 'bg-primary/8 text-primary ring-primary/10')}>
                    {senderIcon(m.sender)}
                  </div>
                  <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', m.sender === 'VOTER' ? 'rounded-tr-sm bg-primary text-primary-foreground' : m.sender === 'OFFICIAL' ? 'rounded-tl-sm bg-sky-50 dark:bg-sky-950/30' : 'rounded-tl-sm border border-border bg-card')}>
                    <div className="mb-0.5 text-[10px] font-medium opacity-60">{senderLabel(m.sender)}</div>
                    {m.content}
                    {/* Attachments */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.attachments.map((a, j) => (
                          <div key={j}>
                            {a.type === 'image' ? (
                              <img src={a.dataUrl} alt={a.name} className="h-20 w-20 rounded-lg object-cover ring-1 ring-border" />
                            ) : (
                              <div className="flex items-center gap-1 rounded-lg bg-black/5 px-2 py-1 text-xs dark:bg-white/5">
                                <Paperclip className="h-3 w-3" /> {a.name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary ring-1 ring-primary/10"><Bot className="h-4 w-4" /></div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                  </div>
                </div>
              )}
              {messages.length <= 1 && !escalated && (
                <div className="space-y-1.5 pt-2">
                  <p className="vw-eyebrow px-1 text-[10px]">Suggested questions</p>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="vw-lift flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" /> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Attachment preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-border bg-card p-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative">
                    {a.type === 'image' ? (
                      <img src={a.dataUrl} alt={a.name} className="h-12 w-12 rounded-lg object-cover ring-1 ring-border" />
                    ) : (
                      <div className="flex h-12 items-center gap-1 rounded-lg bg-muted px-2 text-xs">{a.name}</div>
                    )}
                    <button onClick={() => removeAttachment(i)} className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-white ring-2 ring-background">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input area — refined */}
            <div className="border-t border-border bg-card p-2.5">
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={openCamera} title="Take photo" className="h-9 w-9 shrink-0 rounded-lg">
                  <Camera className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} title="Attach file" className="h-9 w-9 shrink-0 rounded-lg">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple onChange={onFileSelect} className="hidden" />
                <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type your message…" className="flex-1 text-sm" />
                <Button size="icon" onClick={() => send()} disabled={busy} className="h-9 w-9 shrink-0 rounded-lg"><Send className="h-4 w-4" /></Button>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                {!escalated ? (
                  <button onClick={escalateToHuman} className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                    <Headphones className="h-3 w-3" /> Talk to an Officer
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400">
                    <span className="votewise-live-dot inline-block h-1.5 w-1.5 rounded-full bg-sky-500" /> Waiting for officer reply…
                  </span>
                )}
                <button onClick={() => { setTicketOpen(true); setOpen(false) }} className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                  <LifeBuoy className="h-3 w-3" /> Support Ticket
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Camera capture dialog — refined */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <Card className="vw-mockup w-full max-w-md overflow-hidden p-0">
            <CardContent className="p-0">
              <div className="relative overflow-hidden bg-primary p-3.5 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Take a Photo</span>
                  <button onClick={closeCamera} className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-primary-foreground/12" aria-label="Close camera"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="relative bg-black">
                <video ref={videoRef} className="h-64 w-full object-cover" playsInline />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex justify-center gap-2 p-3">
                <Button variant="outline" onClick={closeCamera}>Cancel</Button>
                <Button onClick={capturePhoto} className="gap-1.5"><Camera className="h-4 w-4" /> Capture</Button>
              </div>
            </CardContent>
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
          <DialogTitle className="flex items-center gap-2 font-display text-base font-medium"><LifeBuoy className="h-5 w-5 text-primary" /> Open a Support Ticket</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="py-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/40"><LifeBuoy className="h-7 w-7" /></div>
            <p className="mt-3 font-display text-lg font-medium">Ticket submitted<span className="vw-dot">.</span></p>
            <p className="mt-1 text-sm text-muted-foreground">An electoral observer will attend to you shortly.</p>
            <Button className="mt-4" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Voter ID Number</Label><Input value={form.voterId || ''} onChange={(e) => set('voterId', e.target.value.toUpperCase())} className="font-mono" /></div>
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
            <Button onClick={submit} disabled={busy || !form.voterId || !form.fullName || !form.description} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />} Submit Ticket</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
