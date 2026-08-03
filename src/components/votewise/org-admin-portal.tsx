'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Shield, Lock, Loader2, Building2, Vote, Users, Trophy, Eye,
  Settings, CreditCard, BarChart3, Mail, FileText, Headphones,
  AlertCircle, CheckCircle2, ArrowLeft, LogOut, LayoutDashboard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Official {
  id: string
  name: string
  email: string
  role: string
}

interface OrgData {
  organization: {
    id: string
    name: string
    subdomain: string
    category: string
    status: string
    plan: string
  }
}

export function OrgAdminPortal({ subdomain }: { subdomain: string }) {
  const router = useRouter()
  const [official, setOfficial] = useState<Official | null>(null)
  const [org, setOrg] = useState<OrgData['organization'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  const load = useCallback(async () => {
    try {
      // Check if the user is authenticated
      const me = await api.me()
      if (me.valid && me.official) {
        setOfficial(me.official)
      }
      // Load org data
      const orgRes = await fetch(`/api/portal/${encodeURIComponent(subdomain)}`).then(r => r.json())
      if (orgRes.organization) {
        setOrg(orgRes.organization)
      }
    } catch {
      /* ignore */
    } finally {
      setAuthChecked(true)
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    load()
  }, [load])

  // Show login prompt if not authenticated
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (authChecked && !official) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">Admin Login Required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need to be signed in as an organization admin to access this page.
          </p>
          {org && (
            <p className="mt-1 text-xs text-muted-foreground">
              Organization: <span className="font-semibold">{org.name}</span>
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => router.push(`/?view=official-login`)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Lock className="h-4 w-4" /> Sign In as Admin
            </Button>
            <Link href={`/o/${subdomain}`}>
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Portal
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  if (!official || !org) return null

  // Check if the user has an admin role
  const isAdmin = ['SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN', 'ORG_OWNER', 'ORG_ADMIN', 'ELECTORAL_COMMITTEE'].includes(official.role)

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-amber-500/10">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="font-display text-2xl font-bold">Insufficient Permissions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role ({official.role}) does not have admin access to this organization.
          </p>
          <Link href={`/o/${subdomain}`}>
            <Button variant="outline" className="mt-6 gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Portal
            </Button>
          </Link>
        </motion.div>
      </div>
    )
  }

  // Admin navigation items
  const adminSections = [
    {
      icon: LayoutDashboard,
      title: 'Dashboard',
      desc: 'Organization overview, stats, and quick actions',
      href: `/workspace?org=${subdomain}`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Vote,
      title: 'Election Management',
      desc: 'Create, configure, and manage elections',
      href: `/workspace/elections?org=${subdomain}`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Trophy,
      title: 'Candidates',
      desc: 'Manage candidate profiles, screening, and approval',
      href: `/workspace/elections?org=${subdomain}`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Users,
      title: 'Voters',
      desc: 'Import, manage, and verify the voter register',
      href: `/workspace/structure?org=${subdomain}`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Eye,
      title: 'Observers',
      desc: 'Assign and manage election observers',
      href: `/workspace/elections?org=${subdomain}`,
      color: 'text-zinc-600 dark:text-zinc-400',
      bg: 'bg-zinc-500/10',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      desc: 'Turnout, results, and election intelligence',
      href: `/workspace/analytics?org=${subdomain}`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Mail,
      title: 'Communication',
      desc: 'Notifications, announcements, and templates',
      href: `/workspace/communication?org=${subdomain}`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Headphones,
      title: 'Support Center',
      desc: 'Live chat, tickets, and voter assistance',
      href: `/o/${subdomain}/support`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Shield,
      title: 'Security & Audit',
      desc: 'Fraud detection, audit logs, and integrity',
      href: `/workspace/security?org=${subdomain}`,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      icon: CreditCard,
      title: 'Billing & Subscription',
      desc: 'Invoices, payments, and plan management',
      href: `/workspace/billing?org=${subdomain}`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: Settings,
      title: 'Settings',
      desc: 'Branding, domain, and organization configuration',
      href: `/workspace/settings?org=${subdomain}`,
      color: 'text-zinc-600 dark:text-zinc-400',
      bg: 'bg-zinc-500/10',
    },
    {
      icon: FileText,
      title: 'Developer & API',
      desc: 'API keys, webhooks, and integrations',
      href: `/workspace/developer?org=${subdomain}`,
      color: 'text-zinc-600 dark:text-zinc-400',
      bg: 'bg-zinc-500/10',
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href={`/o/${subdomain}`}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Portal
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-sm font-bold leading-tight">{org.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Admin Console</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {official.role === 'SUPER_ADMIN' || official.role === 'PLATFORM_SUPER_ADMIN' ? 'Super Admin' : 'Org Admin'}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:block">{official.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { api.logout(); router.push('/') }} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Welcome banner */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="votewise-card-glow">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="font-display text-2xl font-bold">Organization Admin Console</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Welcome back, {official.name}. Manage your organization's elections, voters, and settings from here.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Building2 className="h-3 w-3" /> {org.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{org.plan}</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Admin sections grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adminSections.map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={section.href}>
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/20">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', section.bg)}>
                          <section.icon className={cn('h-5 w-5', section.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold">{section.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{section.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Security notice */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Security Notice</AlertTitle>
              <AlertDescription className="text-xs">
                All admin actions are logged in the audit trail with your name, role, IP address, and timestamp.
                Role-based access control (RBAC) is enforced on every endpoint. Multi-factor authentication
                is {official.role === 'SUPER_ADMIN' || official.role === 'PLATFORM_SUPER_ADMIN' ? 'required' : 'optional'} for your role.
              </AlertDescription>
            </Alert>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-muted/30 py-4">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          {org.name} — Admin Console · Powered by VoteWise
        </div>
      </footer>
    </div>
  )
}
