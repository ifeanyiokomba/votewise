'use client'

import { useState, useRef } from 'react'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Upload, FileText, AlertCircle,
  Download, X, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3 | 4 | 5

export function ImportWizard({ subdomain, onDone }: { subdomain?: string; onDone?: () => void }) {
  const [step, setStep] = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<{ errors: any[]; valid: number; duplicates: number }>({ errors: [], valid: 0, duplicates: 0 })
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Download the org-specific CSV template. We fetch with credentials so the
  // workspace auth cookie is sent, then turn the response into a Blob and
  // trigger a download via an object URL. This works around the fact that
  // <a download> alone doesn't let us surface auth errors as a toast.
  async function downloadTemplate() {
    setDownloadingTemplate(true)
    try {
      const url = api.downloadVoterTemplate(subdomain)
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        let msg = `Download failed (${res.status})`
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch { /* not JSON */ }
        throw new Error(msg)
      }
      const blob = await res.blob()
      // Pull the filename from Content-Disposition, falling back to a sensible default.
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename="?([^";]+)"?/i)
      const filename = match ? match[1] : 'votewise-voter-template.csv'
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
      toast.success('Template downloaded — open it and fill in your voters.')
    } catch (e: any) {
      toast.error(e?.message || 'Could not download template')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  // Step 1: File upload + parse
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '')
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length === 0) { toast.error('File is empty'); return }
      const parsedHeaders = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      setHeaders(parsedHeaders)
      const parsedRows = lines.slice(1, 100).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
        const obj: Record<string, string> = {}
        parsedHeaders.forEach((h, i) => { obj[h] = vals[i] || '' })
        return obj
      })
      setRows(parsedRows)
      // Auto-map: try to match CSV headers to known fields
      const autoMap: Record<string, string> = {}
      const knownFields = ['firstName', 'lastName', 'email', 'phone', 'fullName']
      parsedHeaders.forEach((h) => {
        const lower = h.toLowerCase()
        if (lower.includes('first') || lower.includes('name') && !lower.includes('last')) autoMap[h] = 'firstName'
        else if (lower.includes('last') || lower.includes('surname')) autoMap[h] = 'lastName'
        else if (lower.includes('email') || lower.includes('mail')) autoMap[h] = 'email'
        else if (lower.includes('phone') || lower.includes('tel') || lower.includes('mobile')) autoMap[h] = 'phone'
        else if (lower.includes('full') && lower.includes('name')) autoMap[h] = 'fullName'
        else autoMap[h] = h // map to metadata field with same name
      })
      setMapping(autoMap)
      setStep(2)
    }
    reader.readAsText(file)
  }

  // Step 4: Validation
  function validate() {
    const errors: any[] = []
    let duplicates = 0
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()
    rows.forEach((row, i) => {
      const mapped: Record<string, string> = {}
      Object.entries(mapping).forEach(([csvCol, target]) => {
        if (target) mapped[target] = row[csvCol] || ''
      })
      if (!mapped.firstName && !mapped.fullName && !mapped.lastName) {
        errors.push({ row: i + 2, error: 'Missing name' })
      }
      if (mapped.email) {
        if (seenEmails.has(mapped.email)) { duplicates++; errors.push({ row: i + 2, error: `Duplicate email: ${mapped.email}` }) }
        else seenEmails.add(mapped.email)
      }
      if (mapped.phone) {
        if (seenPhones.has(mapped.phone)) { duplicates++; errors.push({ row: i + 2, error: `Duplicate phone: ${mapped.phone}` }) }
        else seenPhones.add(mapped.phone)
      }
    })
    const valid = rows.length - errors.length
    setValidation({ errors, valid: Math.max(0, valid), duplicates })
    setStep(4)
  }

  // Step 5: Import
  async function doImport() {
    setImporting(true)
    try {
      const mappedRows = rows.map((row) => {
        const mapped: Record<string, string> = {}
        const metadata: Record<string, string> = {}
        Object.entries(mapping).forEach(([csvCol, target]) => {
          if (!target) return
          const val = row[csvCol] || ''
          if (['firstName', 'lastName', 'email', 'phone', 'fullName'].includes(target)) {
            mapped[target] = val
          } else {
            metadata[target] = val
          }
        })
        return { ...mapped, metadata: Object.keys(metadata).length > 0 ? metadata : undefined }
      })
      const d = await api.workspaceCreateImport({ fileName, totalRows: rows.length, rows: mappedRows }, subdomain)
      setResult({ imported: d.job.completedRows, skipped: 0, failed: d.job.failedRows })
      setStep(5)
      toast.success(`Imported ${d.job.completedRows} voters`)
    } catch (e: any) { toast.error(e.message) } finally { setImporting(false) }
  }

  const progress = ((step - 1) / 5) * 100

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => { if (onDone) onDone(); else window.location.href = `/workspace/voters?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Voter Registry
      </Button>

      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold">Import Voters</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a CSV file to add voters to your master registry.</p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Step {step} of 5</span><span className="text-primary">{Math.round(progress)}%</span></div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <Card className="votewise-card-glow">
        <CardContent className="p-6">
          {/* Step 1: Choose file */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">Choose a CSV file to import</p>
                <p className="mt-1 text-xs text-muted-foreground">The file should have a header row with column names.</p>
                <Button className="mt-4 gap-2" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Choose File</Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFile} />
              </div>

              {/* CSV template download — prominent card below the upload area */}
              <div className="flex flex-col gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Download a CSV template</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Not sure how to format your CSV? Download our template with the correct columns for your organization.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  disabled={downloadingTemplate}
                  className="gap-1.5 shrink-0 border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloadingTemplate ? 'Preparing…' : 'Download Template'}
                </Button>
              </div>

              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { window.location.href = `/workspace/voters?org=${subdomain || ''}` }}><Plus className="h-3.5 w-3.5" /> Manual Entry Instead</Button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{rows.length} rows found</Badge>
              </div>
              <div className="votewise-scroll max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80"><tr>{headers.map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
                  <tbody>{rows.slice(0, 20).map((row, i) => <tr key={i} className="border-t border-border">{headers.map((h) => <td key={h} className="p-2">{row[h]}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1 gap-2">Continue to Mapping <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* Step 3: Field Mapping */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Map your CSV columns to VoteWise voter fields. Unmapped columns become dynamic metadata fields.</p>
              <div className="space-y-2">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                    <Badge variant="outline" className="font-mono text-[10px]">{h}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Input value={mapping[h] || ''} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))} placeholder="field name" className="h-7 text-xs" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={validate} className="flex-1 gap-2">Validate <CheckCircle2 className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* Step 4: Validation */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-950/30"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" /><div className="mt-1 font-display text-xl font-bold text-emerald-700">{validation.valid}</div><div className="text-[10px] text-muted-foreground">Valid</div></div>
                <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-950/30"><AlertCircle className="mx-auto h-6 w-6 text-amber-600" /><div className="mt-1 font-display text-xl font-bold text-amber-700">{validation.duplicates}</div><div className="text-[10px] text-muted-foreground">Duplicates</div></div>
                <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-950/30"><X className="mx-auto h-6 w-6 text-red-600" /><div className="mt-1 font-display text-xl font-bold text-red-700">{validation.errors.length}</div><div className="text-[10px] text-muted-foreground">Errors</div></div>
              </div>
              {validation.errors.length > 0 && (
                <div className="votewise-scroll max-h-40 overflow-auto rounded-lg border border-border p-2">
                  {validation.errors.slice(0, 20).map((err, i) => <div key={i} className="text-xs text-red-600">Row {err.row}: {err.error}</div>)}
                  {validation.errors.length > 20 && <div className="text-xs text-muted-foreground">+ {validation.errors.length - 20} more errors…</div>}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={doImport} disabled={importing} className="flex-1 gap-2">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {importing ? 'Importing…' : `Import ${validation.valid} Voters`}</Button>
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && result && (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
              <h2 className="font-display text-xl font-bold">Import Complete!</h2>
              <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30"><div className="font-display text-2xl font-bold text-emerald-700">{result.imported}</div><div className="text-[10px] text-muted-foreground">Imported</div></div>
                <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30"><div className="font-display text-2xl font-bold text-amber-700">{result.skipped}</div><div className="text-[10px] text-muted-foreground">Skipped</div></div>
                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30"><div className="font-display text-2xl font-bold text-red-700">{result.failed}</div><div className="text-[10px] text-muted-foreground">Failed</div></div>
              </div>
              <Button onClick={() => { if (onDone) onDone(); else window.location.href = `/workspace/voters?org=${subdomain || ''}` }} className="gap-2">View Voter Registry <ArrowRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
