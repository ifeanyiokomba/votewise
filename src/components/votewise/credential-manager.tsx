'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, Key, Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  Mail, Smartphone, MessageSquare, CreditCard, Cloud, Activity, Bell,
  Database, Zap, RefreshCw, Trash2, AlertTriangle, Save,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Credential {
  key: string
  displayName: string
  category: string
  provider: string
  description: string
  isRequired: boolean
  placeholder: string
  isConfigured: boolean
  maskedValue: string | null
  lastRotatedAt: string | null
  lastVerifiedAt: string | null
  lastVerifiedStatus: string | null
}

interface Stats {
  total: number
  configured: number
  missing: number
  required: number
  requiredConfigured: number
  requiredMissing: number
  byCategory: Record<string, { total: number; configured: number }>
  allRequiredConfigured: boolean
}

const CATEGORY_ICONS: Record<string, any> = {
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageSquare,
  PAYMENT: CreditCard,
  STORAGE: Cloud,
  MONITORING: Activity,
  NOTIFICATION: Bell,
  DATABASE: Database,
  CACHE: Zap,
  OAUTH: Key,
}

const CATEGORY_COLORS: Record<string, string> = {
  EMAIL: 'text-emerald-600 dark:text-emerald-400',
  SMS: 'text-amber-600 dark:text-amber-400',
  WHATSAPP: 'text-emerald-600 dark:text-emerald-400',
  PAYMENT: 'text-amber-600 dark:text-amber-400',
  STORAGE: 'text-zinc-600 dark:text-zinc-400',
  MONITORING: 'text-red-600 dark:text-red-400',
  NOTIFICATION: 'text-amber-600 dark:text-amber-400',
  DATABASE: 'text-emerald-600 dark:text-emerald-400',
  CACHE: 'text-red-600 dark:text-red-400',
  OAUTH: 'text-zinc-600 dark:text-zinc-400',
}

export function CredentialManager() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/credentials').then(r => r.json())
      if (res.credentials) {
        setCredentials(res.credentials)
        setStats(res.stats)
      }
    } catch {
      toast.error('Failed to load credentials')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function saveCredential(key: string) {
    if (!editValue.trim()) {
      toast.error('Please enter a value')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      }).then(r => r.json())
      if (res.message) {
        toast.success(`${key} saved successfully`)
        setEditingKey(null)
        setEditValue('')
        setShowValue(false)
        load()
      } else {
        toast.error(res.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save credential')
    } finally {
      setSaving(false)
    }
  }

  async function verifyCredential(key: string) {
    setVerifying(key)
    try {
      const res = await fetch(`/api/admin/credentials/${key}/verify`, {
        method: 'POST',
      }).then(r => r.json())
      if (res.valid) {
        toast.success(`${key}: ${res.message}`)
      } else {
        toast.error(`${key}: ${res.message}`)
      }
      load()
    } catch {
      toast.error('Verification failed')
    } finally {
      setVerifying(null)
    }
  }

  async function removeCredential(key: string) {
    if (!confirm(`Remove ${key}? This will disable the associated provider.`)) return
    try {
      await fetch(`/api/admin/credentials/${key}`, { method: 'DELETE' })
      toast.success(`${key} removed`)
      load()
    } catch {
      toast.error('Failed to remove credential')
    }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  // Group by category
  const categories = Array.from(new Set(credentials.map((c) => c.category)))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Provider Credentials</h1>
            <p className="text-sm text-muted-foreground">Securely manage API keys for all platform providers</p>
          </div>
        </div>
      </motion.div>

      {/* Stats banner */}
      {stats && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <Card className={cn('votewise-card-glow', stats.allRequiredConfigured ? 'border-emerald-500/30' : 'border-amber-500/30')}>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="text-center">
                  <div className="font-display text-2xl font-bold">{stats.configured}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Configured</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.missing}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Not Set</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.requiredConfigured}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Required ✓</div>
                </div>
                <div className="text-center">
                  <div className={cn('font-display text-2xl font-bold', stats.requiredMissing > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {stats.requiredMissing}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Required ✗</div>
                </div>
              </div>
              {stats.requiredMissing > 0 && (
                <Alert className="mt-4 border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-xs">
                    {stats.requiredMissing} required credential(s) are not configured. The platform cannot start safely without them.
                  </AlertDescription>
                </Alert>
              )}
              {stats.allRequiredConfigured && (
                <Alert className="mt-4 border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertDescription className="text-xs">
                    All required credentials are configured. The platform is ready to start.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Credentials by category */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catCreds = credentials.filter((c) => c.category === cat)
          const Icon = CATEGORY_ICONS[cat] || Key
          const catStats = stats?.byCategory[cat]

          return (
            <motion.div key={cat} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <Icon className={cn('h-4 w-4', CATEGORY_COLORS[cat])} />
                      {cat}
                      {catStats && (
                        <Badge variant="outline" className="ml-2 text-[9px]">
                          {catStats.configured}/{catStats.total}
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {catCreds.map((cred) => (
                    <div key={cred.key} className="rounded-lg border border-border/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* Left: info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{cred.displayName}</span>
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{cred.key}</code>
                            {cred.isRequired && <Badge variant="outline" className="text-[9px] text-destructive">Required</Badge>}
                            {cred.isConfigured ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Configured
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">Not Set</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{cred.description}</p>
                          {cred.maskedValue && (
                            <div className="mt-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              {cred.maskedValue}
                            </div>
                          )}
                          {cred.lastVerifiedStatus && (
                            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                              {cred.lastVerifiedStatus === 'VALID' ? (
                                <><CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> <span className="text-emerald-600 dark:text-emerald-400">Verified</span></>
                              ) : cred.lastVerifiedStatus === 'INVALID' ? (
                                <><XCircle className="h-3 w-3 text-red-600 dark:text-red-400" /> <span className="text-red-600 dark:text-red-400">Invalid</span></>
                              ) : (
                                <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" /> <span className="text-amber-600 dark:text-amber-400">Untested</span></>
                              )}
                              {cred.lastVerifiedAt && (
                                <span className="text-muted-foreground">
                                  · {new Date(cred.lastVerifiedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: actions */}
                        <div className="flex shrink-0 gap-1.5">
                          {cred.isConfigured && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => verifyCredential(cred.key)}
                              disabled={verifying === cred.key}
                              className="gap-1.5 text-xs"
                            >
                              {verifying === cred.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Test
                            </Button>
                          )}
                          {cred.isConfigured && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCredential(cred.key)}
                              className="gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Edit form */}
                      {editingKey === cred.key ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <Label htmlFor={`edit-${cred.key}`} className="text-xs">
                            Enter new value for {cred.displayName}
                          </Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                id={`edit-${cred.key}`}
                                type={showValue ? 'text' : 'password'}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder={cred.placeholder}
                                className="font-mono pr-10"
                                onKeyDown={(e) => e.key === 'Enter' && saveCredential(cred.key)}
                              />
                              <button
                                type="button"
                                onClick={() => setShowValue(!showValue)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <Button onClick={() => saveCredential(cred.key)} disabled={saving} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Save
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditingKey(null); setEditValue(''); setShowValue(false) }}>
                              Cancel
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            The value will be encrypted with AES-256-GCM before storage and synced to the runtime environment.
                          </p>
                        </div>
                      ) : (
                        <Button
                          variant={cred.isConfigured ? 'ghost' : 'outline'}
                          size="sm"
                          onClick={() => { setEditingKey(cred.key); setEditValue(''); setShowValue(false) }}
                          className="mt-2 gap-1.5 text-xs"
                        >
                          <Key className="h-3 w-3" />
                          {cred.isConfigured ? 'Update' : 'Configure'}
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Security notice */}
      <Alert className="mt-8">
        <Lock className="h-4 w-4" />
        <AlertTitle>Security Notice</AlertTitle>
        <AlertDescription className="text-xs">
          All credentials are encrypted with AES-256-GCM before storage. Values are never displayed in full after saving — only masked previews are shown. Credentials are synced to the runtime environment automatically, so all platform features that depend on API keys will use the values configured here. Only platform super admins can access this page.
        </AlertDescription>
      </Alert>
    </div>
  )
}
