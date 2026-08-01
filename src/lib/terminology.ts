'use client'

// VoteWise — Terminology (Principle 4: Everything configurable)
// Organizations configure their own terms instead of VoteWise hardcoding
// "University", "Faculty", "Department", "Church", "Market", "Company".
//
// For Chapter 1, we use generic defaults across the UI. In Chapter 2+, the
// organization's terminology (from OrganizationTerminology table) will be
// fetched and injected here, so every label becomes org-specific dynamically.

export interface Terminology {
  organizationLabel: string   // "University" / "Company" / "Church"
  workspaceLabel: string      // "Faculty" / "Branch" / "Parish"
  voterGroupLabel: string     // "Department" / "Unit" / "Cell"
  voterLabel: string          // "Student" / "Member" / "Employee"
  candidateLabel: string      // "Aspirant" / "Nominee"
  electionLabel: string       // "Election" / "Poll"
  positionLabel: string       // "Position" / "Office" / "Role"
  ballotLabel: string         // "Ballot"
  receiptLabel: string        // "Receipt"
  officialLabel: string       // "Electoral Officer" / "Returning Officer"
  observerLabel: string       // "Observer"
  // Voter ID concept — generic. Universities call it "matric number",
  // companies "employee ID", churches "member number". We say "Voter ID".
  voterIdLabel: string        // "Voter ID"
  // The period label — universities use "Academic Session", others "Term"/"Year"
  periodLabel: string         // "Election Period"
}

// Generic defaults — no assumption about organization type.
export const DEFAULT_TERMINOLOGY: Terminology = {
  organizationLabel: 'Organization',
  workspaceLabel: 'Workspace',
  voterGroupLabel: 'Voter Group',
  voterLabel: 'Voter',
  candidateLabel: 'Candidate',
  electionLabel: 'Election',
  positionLabel: 'Position',
  ballotLabel: 'Ballot',
  receiptLabel: 'Receipt',
  officialLabel: 'Electoral Officer',
  observerLabel: 'Observer',
  voterIdLabel: 'Voter ID',
  periodLabel: 'Election Period',
}

// React hook — returns the current terminology. For Chapter 1 this is always
// the generic defaults (no org-scoped terminology fetch yet). Chapter 2+ will
// extend this to fetch the active organization's terminology from the API and
// override these defaults dynamically.
export function useTerminology(): Terminology {
  return DEFAULT_TERMINOLOGY
}
