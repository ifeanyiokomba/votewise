// Mock for @/lib/db, used ONLY by the Chapter 2 verification test. Implements
// exactly the three calls ballot-builder.ts makes (electionSession.findUnique,
// voter.findUnique, ballot.create) against fixed in-memory fixtures — no real
// database. This is a standard mocked-dependency unit test: the code under
// test (src/lib/sve/ballot-builder.ts) is imported unmodified and really
// executes; only its database calls are stubbed.

type Fixture = Record<string, any>

const elections: Fixture = {
  'election-org-a': {
    id: 'election-org-a',
    organizationId: 'org-a',
    name: 'Org A General Election',
    description: null,
    votingMethod: 'Single Choice',
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() + 60 * 60_000),
    settings: null,
    positions: [
      {
        id: 'pos-president',
        title: 'President',
        description: null,
        maximumVotes: 1,
        scope: 'ORGANIZATION',
        displayOrder: 1,
        facultyId: null,
        departmentId: null,
        candidates: [
          {
            id: 'cand-1',
            fullName: 'Candidate One',
            photoUrl: null,
            slogan: null,
            manifesto: null,
            politicalPartyId: null,
            biography: null,
            status: 'APPROVED',
            screeningStatus: 'APPROVED',
            displayOrder: 1,
          },
        ],
      },
    ],
  },
}

const voters: Fixture = {
  'voter-org-a': { id: 'voter-org-a', organizationId: 'org-a', fullName: 'Voter A', facultyId: null, departmentId: null },
  'voter-org-b': { id: 'voter-org-b', organizationId: 'org-b', fullName: 'Voter B', facultyId: null, departmentId: null },
}

const votingSessions: Fixture = {
  'valid-token-org-a': {
    id: 'vsession-1',
    sessionToken: 'valid-token-org-a',
    organizationId: 'org-a',
    electionId: 'election-org-a',
    voterId: 'voter-org-a',
    accredited: false,
    hasVoted: false,
    expiresAt: new Date(Date.now() + 30 * 60_000),
    deviceFingerprint: null,
    ipAddress: null,
  },
}

let approvalRequests: Record<string, any> = {}
let approvalVotes: any[] = []
let approvalIdCounter = 0
let voteIdCounter = 0

export function resetApprovalFixtures() {
  approvalRequests = {}
  approvalVotes = []
  approvalIdCounter = 0
  voteIdCounter = 0
}

export const db = {
  electionSession: {
    findUnique: async ({ where }: any) => elections[where.id] ?? null,
  },
  voter: {
    findUnique: async ({ where }: any) => voters[where.id] ?? null,
  },
  ballot: {
    create: async ({ data }: any) => ({ id: 'ballot-test-id', ...data }),
  },
  votingSession: {
    findUnique: async ({ where }: any) => votingSessions[where.sessionToken] ?? null,
    updateMany: async () => ({ count: 0 }),
    create: async ({ data }: any) => ({
      id: 'vsession-new',
      sessionToken: data.sessionToken,
      accredited: false,
      hasVoted: false,
      deviceFingerprint: data.deviceFingerprint ?? null,
      ipAddress: data.ipAddress ?? null,
      expiresAt: data.expiresAt,
      ...data,
    }),
  },
  privilegedActionApproval: {
    create: async ({ data }: any) => {
      const id = `approval-${++approvalIdCounter}`
      const record = { id, resolvedAt: null, ...data }
      approvalRequests[id] = record
      return record
    },
    findUnique: async ({ where }: any) => approvalRequests[where.id] ?? null,
    update: async ({ where, data }: any) => {
      approvalRequests[where.id] = { ...approvalRequests[where.id], ...data }
      return approvalRequests[where.id]
    },
  },
  privilegedActionApprovalVote: {
    create: async ({ data }: any) => {
      const record = { id: `vote-${++voteIdCounter}`, createdAt: new Date(), ...data }
      approvalVotes.push(record)
      return record
    },
    findFirst: async ({ where }: any) =>
      approvalVotes.find((v) => v.requestId === where.requestId && v.approverId === where.approverId) ?? null,
    count: async ({ where }: any) =>
      approvalVotes.filter((v) => v.requestId === where.requestId && v.decision === where.decision).length,
  },
}
