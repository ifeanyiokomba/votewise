import { NavBar, Footer } from '@/components/votewise/shared'
import { SuccessStoriesPage } from '@/components/votewise/success-stories-page'

export const dynamic = 'force-dynamic'

export default function SuccessStoriesRoute() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1"><SuccessStoriesPage /></main>
      <Footer />
    </div>
  )
}
