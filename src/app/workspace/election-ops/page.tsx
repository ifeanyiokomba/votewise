import { Suspense } from 'react'
import { ElectionOpsConsole } from '@/components/votewise/election-ops-console'

export const dynamic = 'force-dynamic'

// /workspace/election-ops — Election Operations Console (single-screen command center)
// Spec: "A single live dashboard with widgets showing: live voter activity feed,
// OTVP delivery queue, active support chats, current turnout, online observers,
// fraud alerts, system health, announcement broadcaster."
export default function ElectionOpsPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="animate-pulse text-muted-foreground">Loading Election Operations Console…</div></div>}>
      <ElectionOpsConsoleWrapper />
    </Suspense>
  )
}

function ElectionOpsConsoleWrapper() {
  return <ElectionOpsConsole />
}
