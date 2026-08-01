// VoteWise — Workspace Templates (Chapter 6)
//
// During registration, organizations can choose a template that preconfigures:
// - Organization units (if desired)
// - Default voter fields
// - Sample election types
// - Suggested roles
//
// This does NOT change the architecture — it simply pre-fills configuration
// based on the organization type. Both a university and a small association
// use the same underlying platform.

export interface WorkspaceTemplate {
  id: string
  label: string
  icon: string
  desc: string
  voterFields: { label: string; key: string; fieldType: string; required: boolean }[]
  sampleUnits?: { name: string; unitType: string; code?: string }[]
  sampleElections?: { name: string; type: string }[]
  terminology?: { organizationLabel: string; workspaceLabel: string; voterGroupLabel: string; voterLabel: string; candidateLabel: string }
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'blank',
    label: 'Blank Workspace',
    icon: 'Building2',
    desc: 'Start from scratch with no preconfiguration. Best for simple elections.',
    voterFields: [],
  },
  {
    id: 'university',
    label: 'University',
    icon: 'GraduationCap',
    desc: 'Preconfigured for student union government elections with faculties and departments.',
    voterFields: [
      { label: 'Matric Number', key: 'matricNumber', fieldType: 'TEXT', required: true },
      { label: 'Faculty', key: 'faculty', fieldType: 'TEXT', required: true },
      { label: 'Department', key: 'department', fieldType: 'TEXT', required: true },
      { label: 'Level', key: 'level', fieldType: 'TEXT', required: false },
    ],
    sampleUnits: [
      { name: 'Faculty of Engineering', unitType: 'Faculty', code: 'ENG' },
      { name: 'Faculty of Science', unitType: 'Faculty', code: 'SCI' },
      { name: 'Faculty of Arts', unitType: 'Faculty', code: 'ART' },
    ],
    sampleElections: [{ name: 'SUG General Elections', type: 'General' }],
    terminology: { organizationLabel: 'University', workspaceLabel: 'Faculty', voterGroupLabel: 'Department', voterLabel: 'Student', candidateLabel: 'Aspirant' },
  },
  {
    id: 'company',
    label: 'Company',
    icon: 'Briefcase',
    desc: 'Preconfigured for corporate staff elections with departments and branches.',
    voterFields: [
      { label: 'Employee ID', key: 'employeeId', fieldType: 'TEXT', required: true },
      { label: 'Department', key: 'department', fieldType: 'TEXT', required: false },
    ],
    sampleUnits: [
      { name: 'Lagos Region', unitType: 'Region', code: 'LOS' },
      { name: 'Abuja Region', unitType: 'Region', code: 'ABJ' },
    ],
    sampleElections: [{ name: 'Staff Representative Election', type: 'General' }],
    terminology: { organizationLabel: 'Company', workspaceLabel: 'Region', voterGroupLabel: 'Department', voterLabel: 'Employee', candidateLabel: 'Candidate' },
  },
  {
    id: 'church',
    label: 'Church',
    icon: 'Church',
    desc: 'Preconfigured for church elections with parishes and fellowships.',
    voterFields: [
      { label: 'Membership Number', key: 'membershipNumber', fieldType: 'TEXT', required: true },
      { label: 'Parish', key: 'parish', fieldType: 'TEXT', required: false },
    ],
    sampleUnits: [
      { name: 'Main Parish', unitType: 'Parish', code: 'MAIN' },
      { name: 'Youth Fellowship', unitType: 'Fellowship', code: 'YTH' },
    ],
    sampleElections: [{ name: 'Annual Council Election', type: 'General' }],
    terminology: { organizationLabel: 'Church', workspaceLabel: 'Parish', voterGroupLabel: 'Fellowship', voterLabel: 'Member', candidateLabel: 'Candidate' },
  },
  {
    id: 'association',
    label: 'Association',
    icon: 'Users',
    desc: 'Preconfigured for professional bodies and associations with chapters.',
    voterFields: [
      { label: 'Member ID', key: 'memberId', fieldType: 'TEXT', required: true },
      { label: 'Chapter', key: 'chapter', fieldType: 'TEXT', required: false },
    ],
    sampleUnits: [
      { name: 'Lagos Chapter', unitType: 'Chapter', code: 'LAG' },
      { name: 'Abuja Chapter', unitType: 'Chapter', code: 'ABJ' },
    ],
    sampleElections: [{ name: 'Annual General Election', type: 'General' }],
    terminology: { organizationLabel: 'Association', workspaceLabel: 'Chapter', voterGroupLabel: 'Branch', voterLabel: 'Member', candidateLabel: 'Candidate' },
  },
  {
    id: 'government',
    label: 'Government',
    icon: 'Landmark',
    desc: 'Preconfigured for government agencies with state offices.',
    voterFields: [
      { label: 'Staff ID', key: 'staffId', fieldType: 'TEXT', required: true },
      { label: 'State Office', key: 'stateOffice', fieldType: 'TEXT', required: false },
    ],
    sampleUnits: [
      { name: 'Lagos State Office', unitType: 'State', code: 'LAG' },
      { name: 'Abuja HQ', unitType: 'State', code: 'ABJ' },
    ],
    sampleElections: [{ name: 'Staff Union Election', type: 'General' }],
    terminology: { organizationLabel: 'Agency', workspaceLabel: 'State Office', voterGroupLabel: 'Unit', voterLabel: 'Staff', candidateLabel: 'Candidate' },
  },
  {
    id: 'ngo',
    label: 'NGO',
    icon: 'Heart',
    desc: 'Preconfigured for NGOs and cooperatives with simple member voting.',
    voterFields: [
      { label: 'Member Number', key: 'memberNumber', fieldType: 'TEXT', required: true },
    ],
    sampleElections: [{ name: 'Board Election', type: 'General' }],
    terminology: { organizationLabel: 'Organization', workspaceLabel: 'Branch', voterGroupLabel: 'Group', voterLabel: 'Member', candidateLabel: 'Candidate' },
  },
  {
    id: 'market',
    label: 'Market Association',
    icon: 'Store',
    desc: 'Preconfigured for market associations with sections.',
    voterFields: [
      { label: 'Trader ID', key: 'traderId', fieldType: 'TEXT', required: true },
      { label: 'Shop Number', key: 'shopNumber', fieldType: 'TEXT', required: false },
      { label: 'Section', key: 'section', fieldType: 'TEXT', required: false },
    ],
    sampleUnits: [
      { name: 'Food Section', unitType: 'Market Section', code: 'FOOD' },
      { name: 'Electronics Section', unitType: 'Market Section', code: 'ELEC' },
    ],
    sampleElections: [{ name: 'Executive Election', type: 'General' }],
    terminology: { organizationLabel: 'Association', workspaceLabel: 'Section', voterGroupLabel: 'Line', voterLabel: 'Trader', candidateLabel: 'Candidate' },
  },
]

export function getTemplate(id: string): WorkspaceTemplate | undefined {
  return WORKSPACE_TEMPLATES.find((t) => t.id === id)
}
