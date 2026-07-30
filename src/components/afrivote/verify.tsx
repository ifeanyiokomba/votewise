'use client'

import { useEffect, useState } from 'react'
import {
  Shield, KeyRound, BadgeCheck, Vote, ArrowRight, ArrowLeft, CheckCircle2,
  Loader2, AlertCircle, Mail, MessageSquare, Smartphone, Copy, Trophy, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { api, setVoterToken } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Step = 'matric' | 'channel' | 'otp' | 'ready'

export function VerifyView() {
  const { setView, voterToken, setVoterToken, voterProfile, setVoterProfile } = useApp()
  const [step, setStep] = useState<Step>('matric')
  const [matric, setMatric] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyData, setVerifyData] = useState<any>(null)
  const [channel, setChannel] = useState('EMAIL')
  const [otp, setOtp] = useState('')
  const [otpInfo, setOtpInfo] = useState<any>(null)
  const [resendIn, setResendIn] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // If already has a session, go straight to ready.
  useEffect(() => {
    if (voterToken && !voterProfile) {
      api.getVoterSession().then((d) => {
        if (d.valid) { setVoterProfile(d.voter); setStep('ready') }
      }).catch(() => {})
    }
  }, [voterToken, voterProfile, setVoterProfile])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  async function onVerifyMatric() {
    setError(null); setLoading(true)
    try {
      const d = await api.verifyMatric(matric)
      if (!d.found) { setError('This matriculation number was not found in the voter register. Please contact the Electoral Committee.'); setLoading(false); return }
      if (d.hasVoted) { setError('This voter has already cast a ballot in this election. Each student may vote only once.'); setLoading(false); return }
      setVerifyData(d)
      setChannel(d.channels[0])
      setStep('channel')
    } catch (e: any) {
      if (e?.data?.hasVoted) { setError('This voter has already cast a ballot in this election. Each student may vote only once.'); setLoading(false); return }
      if (e?.status === 404 || e?.data?.found === false) { setError('This matriculation number was not found in the voter register. Please contact the Electoral Committee.'); setLoading(false); return }
      setError(e.message || 'Verification failed')
    } finally { setLoading(false) }
  }

  async function onSendOtp() {
    setError(null); setLoading(true)
    try {
      const d = await api.sendOtp(matric, channel)
      setOtpInfo(d)
      setResendIn(60)
      setStep('otp')
      if (d.devOtp) toast.info(`Dev OTP (auto-filled): ${d.devOtp}`, { duration: 8000 })
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP')
    } finally { setLoading(false) }
  }

  async function onVerifyOtp() {
    setError(null); setLoading(true)
    try {
      const d = await api.verifyOtp(matric, otp)
      setVoterToken(d.token)
      setVoterProfile(d.voter)
      setStep('ready')
      toast.success('Identity verified! You can now cast your ballot.')
    } catch (e: any) {
      setError(e.message || 'OTP verification failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>

      <Stepper step={step} />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 'matric' && (
        <Card className="afrivote-card-glow">
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Shield className="h-6 w-6" /></div>
            <CardTitle className="mt-3 font-display">Verify Your Matriculation Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matric">Matriculation / JAMB Registration Number</Label>
              <Input id="matric" placeholder="e.g. CSC/2022/001" value={matric} onChange={(e) => setMatric(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && onVerifyMatric()} className="font-mono" />
              <p className="text-xs text-muted-foreground">Enter the matric number on your student ID. We check it against the official register.</p>
            </div>
            <Button onClick={onVerifyMatric} disabled={loading || !matric} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Verifying…' : 'Continue'}
            </Button>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Demo voters (try one):</p>
              <div className="mt-1 grid grid-cols-2 gap-1 font-mono">
                <span>CSC/2022/001</span><span>ENG/2022/015</span>
                <span>ACC/2022/022</span><span>POL/2023/005</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'channel' && verifyData && (
        <Card className="afrivote-card-glow">
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="h-6 w-6" /></div>
            <CardTitle className="mt-3 font-display">Hello, {verifyData.voter.fullName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Faculty" value={verifyData.voter.faculty} />
              <Info label="Department" value={verifyData.voter.department} />
              <Info label="Level" value={verifyData.voter.level} />
              <Info label="Voting" value={verifyData.votingOpen ? 'Open now' : 'Not yet open'} />
            </div>
            <div className="space-y-2">
              <Label>Choose how to receive your verification PIN</Label>
              <div className="grid gap-2">
                {verifyData.channels.map((ch: string) => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      channel === ch ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <ChannelIcon ch={ch} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{ch === 'EMAIL' ? 'Email' : ch === 'SMS' ? 'SMS' : 'WhatsApp'}</div>
                      <div className="text-xs text-muted-foreground">
                        {ch === 'EMAIL' ? verifyData.voter.emailMasked : verifyData.voter.phoneMasked}
                      </div>
                    </div>
                    {channel === ch && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('matric')} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={onSendOtp} disabled={loading} className="flex-1 gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Send Verification PIN
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'otp' && (
        <Card className="afrivote-card-glow">
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-6 w-6" /></div>
            <CardTitle className="mt-3 font-display">Enter Verification PIN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit PIN via {otpInfo?.channel === 'EMAIL' ? 'email' : otpInfo?.channel === 'SMS' ? 'SMS' : 'WhatsApp'} to{' '}
              <span className="font-medium text-foreground">{otpInfo?.maskedDestination}</span>.
              {otpInfo?.devOtp && <span className="ml-1 text-primary">[Dev: <span className="font-mono">{otpInfo.devOtp}</span>]</span>}
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={(v) => setOtp(v)}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={onVerifyOtp} disabled={loading || otp.length < 6} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Verify &amp; Unlock Ballot
            </Button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> PIN expires in {Math.floor((otpInfo?.ttl || 600) / 60)} min</span>
              {resendIn > 0 ? (
                <span>Resend in {resendIn}s</span>
              ) : (
                <button className="text-primary hover:underline" onClick={onSendOtp}>Resend PIN</button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'ready' && voterProfile && (
        <Card className="afrivote-card-glow">
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><BadgeCheck className="h-6 w-6" /></div>
            <CardTitle className="mt-3 font-display">You&apos;re verified, {voterProfile.fullName.split(' ')[0]}!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Matric" value={voterProfile.matric} />
              <Info label="Faculty" value={voterProfile.faculty} />
              <Info label="Department" value={voterProfile.department} />
              <Info label="Level" value={voterProfile.level} />
            </div>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Your ballot is ready</AlertTitle>
              <AlertDescription>
                You will see only the positions you are eligible to vote in. Candidate order is shuffled
                to remove bias. You can vote only once.
              </AlertDescription>
            </Alert>
            <Button onClick={() => setView('vote')} size="lg" className="w-full gap-2">
              <Vote className="h-5 w-5" /> Open My Ballot <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'matric', label: 'Matric' },
    { key: 'channel', label: 'Channel' },
    { key: 'otp', label: 'Verify' },
    { key: 'ready', label: 'Ballot' },
  ]
  const idx = steps.findIndex((s) => s.key === step)
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center gap-2">
          <div className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold', i <= idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            {i < idx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={cn('hidden text-xs sm:inline', i <= idx ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s.label}</span>
          {i < steps.length - 1 && <div className={cn('h-0.5 flex-1', i < idx ? 'bg-primary' : 'bg-muted')} />}
        </div>
      ))}
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value || '—'}</div>
    </div>
  )
}

function ChannelIcon({ ch }: { ch: string }) {
  if (ch === 'EMAIL') return <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-blue-700"><Mail className="h-5 w-5" /></div>
  if (ch === 'SMS') return <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><Smartphone className="h-5 w-5" /></div>
  return <div className="grid h-9 w-9 place-items-center rounded-lg bg-green-100 text-green-700"><MessageSquare className="h-5 w-5" /></div>
}
