import { NavBar, Footer } from '@/components/votewise/shared'
import { CompliancePage } from '@/components/votewise/compliance-page'

export const dynamic = 'force-dynamic'

export default function ComplianceRoute() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1"><CompliancePage /></main>
      <Footer />
    </div>
  )
}
