import { NavBar, Footer } from '@/components/votewise/shared'
import { DemoPortalPage } from '@/components/votewise/demo-portal-page'

export const dynamic = 'force-dynamic'

export default function DemoRoute() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1"><DemoPortalPage /></main>
      <Footer />
    </div>
  )
}
