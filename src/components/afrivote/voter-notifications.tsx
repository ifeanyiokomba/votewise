'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, Info, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api, getVoterToken } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  readAt: string | null
  createdAt: string
}

export function VoterNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const token = getVoterToken()

  useEffect(() => {
    if (!token) return
    api.getNotifications().then((d) => { setNotifications(d.notifications); setUnread(d.unread) }).catch(() => {})
    const t = setInterval(() => {
      api.getNotifications().then((d) => { setNotifications(d.notifications); setUnread(d.unread) }).catch(() => {})
    }, 30000)
    return () => clearInterval(t)
  }, [token])

  async function onOpenChange(o: boolean) {
    setOpen(o)
    if (o && unread > 0) {
      // Mark as read after a short delay
      setTimeout(() => {
        api.markNotificationsRead().then(() => setUnread(0)).catch(() => {})
      }, 1500)
    }
  }

  if (!token) return null

  const iconFor = (type: string) => {
    if (type === 'SECURITY') return <ShieldAlert className="h-4 w-4 text-amber-600" />
    if (type === 'WARNING') return <AlertTriangle className="h-4 w-4 text-amber-600" />
    if (type === 'SUCCESS') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    return <Info className="h-4 w-4 text-blue-600" />
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground ring-2 ring-background">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <span className="font-display text-sm font-semibold">Notifications</span>
          {unread > 0 && <Badge variant="secondary" className="text-[10px]">{unread} new</Badge>}
        </div>
        <ScrollArea className="h-72">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="mt-2 text-xs">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div key={n.id} className={cn('flex gap-3 p-3', !n.readAt && 'bg-primary/5')}>
                  <div className="mt-0.5 shrink-0">{iconFor(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.message}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
