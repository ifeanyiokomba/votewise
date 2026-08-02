import { Suspense } from 'react'
import { CertificationVerification } from '@/components/votewise/certification-verification'

export const dynamic = 'force-dynamic'

// /certify/[id] — Public certification verification page.
// Anyone with a Certification ID (VW-2027-000184) can verify it here.
export default function CertifyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="animate-pulse text-muted-foreground">Loading certification…</div></div>}>
      <CertificationVerificationWrapper params={params} />
    </Suspense>
  )
}

async function CertificationVerificationWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CertificationVerification certificationId={id} />
}
