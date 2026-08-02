import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { API_MODULES, SUPPORTED_VERSIONS, CURRENT_API_VERSION } from '@/lib/aidp/api-docs'

export const dynamic = 'force-dynamic'

// GET /api/aidp/docs — API documentation catalog (public)
export async function GET() {
  return json({
    currentVersion: CURRENT_API_VERSION,
    supportedVersions: SUPPORTED_VERSIONS,
    modules: API_MODULES,
    totalEndpoints: API_MODULES.reduce((sum, m) => sum + m.endpoints.length, 0),
  })
}
