'use client'

// VoteWise — Multi-Language Support (i18n)
// ---------------------------------------------------------------
// Supports 5 languages: English, French, Yoruba, Hausa, Igbo.
//
// This module is SEPARATE from terminology.ts (which handles
// ORG-SPECIFIC labels like University/Company/Church). This module
// handles LANGUAGE translation of fixed UI strings.
//
// The useTranslation() hook is Zustand-based — it reads the current
// language from the store and returns a t(key) function. Missing
// keys fall back to English.
//
// For Yoruba/Hausa/Igbo we use proper diacritics:
//   Yoruba: à, é, è, ì, ò, ṣ, ó
//   Hausa:  ɓ, ɗ, ƙ, ƙ, ƴ
//   Igbo:   ṅ, Ọ, ụ, ṅ, ị
// ---------------------------------------------------------------

import { useApp } from '@/lib/store'

export type Language = 'en' | 'fr' | 'yo' | 'ha' | 'ig'

export interface LanguageMeta {
  code: Language
  name: string        // Endonym (the language's name for itself)
  englishName: string // English name
  flag: string        // Emoji flag
  locale: string      // BCP-47 locale tag for Intl APIs
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English',  englishName: 'English',  flag: '🇬🇧', locale: 'en-GB' },
  { code: 'fr', name: 'Français', englishName: 'French',   flag: '🇫🇷', locale: 'fr-FR' },
  { code: 'yo', name: 'Yorùbá',   englishName: 'Yoruba',   flag: '🇳🇬', locale: 'yo-NG' },
  { code: 'ha', name: 'Hausa',    englishName: 'Hausa',    flag: '🇳🇬', locale: 'ha-NG' },
  { code: 'ig', name: 'Igbo',     englishName: 'Igbo',     flag: '🇳🇬', locale: 'ig-NG' },
]

export function getLanguageMeta(lang: Language): LanguageMeta {
  return LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
}

// ---------------------------------------------------------------
// Translations interface — organized by namespace.
// ---------------------------------------------------------------
export interface Translations {
  common: {
    save: string
    cancel: string
    delete: string
    edit: string
    search: string
    filter: string
    loading: string
    error: string
    success: string
    close: string
    back: string
    next: string
    previous: string
    submit: string
    confirm: string
    retry: string
    refresh: string
    copy: string
    copied: string
    share: string
    download: string
    yes: string
    no: string
    all: string
    none: string
    optional: string
    required: string
    theme: string
    language: string
  }
  home: {
    // Hero
    heroBadge: string
    heroTitleLine1: string
    heroTitleLine2: string
    heroTitleLine3: string
    heroSubtitle: string
    registerOrg: string
    requestDemo: string
    encryptedVoting: string
    receiptAnchored: string
    fullAuditTrail: string
    anyOrg: string
    statOrganizations: string
    statOrgTypes: string
    statUserRoles: string
    trustedTransparent: string
    trustedTransparentSub: string
    // Verify receipt section
    receiptVerification: string
    verifyYourVoteTitle: string
    verifyYourVoteTitleHighlight: string
    verifyYourVoteDesc: string
    ballotSecrecy: string
    ballotSecrecyDesc: string
    receiptAnchoredLabel: string
    receiptAnchoredDesc: string
    tamperEvident: string
    tamperEvidentDesc: string
    checkYourReceipt: string
    receiptCode: string
    receiptCodeFormat: string
    verifyReceipt: string
    voteConfirmed: string
    receiptNotFound: string
    needFullView: string
    openFullPage: string
    // Trust indicators
    trustAudit: string
    trustLiveDashboard: string
    trustMFA: string
    trustOTP: string
    trustWhiteLabel: string
    trustMonitoring: string
    trustSecurity: string
    statOrgsCount: string
    statElectionsHosted: string
    statVotesCast: string
    statUptime: string
    // How it works
    howBadge: string
    howTitle: string
    howSubtitle: string
    howStep1Title: string
    howStep1Desc: string
    howStep2Title: string
    howStep2Desc: string
    howStep3Title: string
    howStep3Desc: string
    howStep4Title: string
    howStep4Desc: string
    // Org types
    orgsBuiltForAny: string
    orgsTitle: string
    orgsSubtitle: string
    orgsAllOrgs: string
    // Products
    productsBadge: string
    productsTitle: string
    productsSubtitle: string
    // Features
    featuresBadge: string
    featuresTitle: string
    featuresSubtitle: string
    // Hierarchy
    hierarchyBadge: string
    hierarchyTitle: string
    hierarchySubtitle: string
    hierarchyNote: string
    // Roles
    rolesBadge: string
    rolesTitle: string
    rolesSubtitle: string
    rolesCan: string
    rolesCannot: string
    // Principles
    principlesBadge: string
    principlesTitle: string
    principlesSubtitle: string
    // Security
    securityBadge: string
    securityTitle: string
    securitySubtitle: string
    // Pricing
    pricingBadge: string
    pricingTitle: string
    pricingSubtitle: string
    pricingMostPopular: string
    // Testimonials
    testimonialsBadge: string
    testimonialsTitle: string
    testimonialsSubtitle: string
    // Organizations directory
    orgsDirectoryBadge: string
    orgsDirectoryTitle: string
    orgsDirectorySubtitle: string
    // Demo request
    demoBadge: string
    demoTitle: string
    demoSubtitle: string
    demoContactPerson: string
    demoEmail: string
    demoPhone: string
    demoOrgType: string
    demoOrgName: string
    demoEstimatedVoters: string
    demoPreferredDate: string
    demoMessage: string
    demoRequestBtn: string
    demoSending: string
    demoNoCommitment: string
    liveDemoBadge: string
    liveDemoTitle: string
    liveDemoSubtitle: string
    tryVoterJourney: string
    tryVotingNow: string
    about: string
    guide: string
    viewPublicResults: string
    viewLiveResults: string
    // Docs
    docsBadge: string
    docsTitle: string
    docsSubtitle: string
    readMore: string
    // Contact
    contactBadge: string
    contactTitle: string
    contactSubtitle: string
    contactName: string
    contactOrgOptional: string
    contactMessage: string
    contactSend: string
    contactSending: string
    // Org signup CTA
    signupBadge: string
    signupTitle: string
    signupSubtitle: string
    signupFeature1: string
    signupFeature2: string
    signupFeature3: string
    signupFeature4: string
    registerYourOrg: string
    // Verify election section
    verifyElectionBadge: string
    verifyElectionTitle: string
    verifyElectionTitleHighlight: string
    verifyElectionDesc: string
    verifyElectionCertified: string
    verifyElectionCertifiedDesc: string
    verifyElectionCrypto: string
    verifyElectionCryptoDesc: string
    verifyElectionTamper: string
    verifyElectionTamperDesc: string
    openVerificationPortal: string
    electionIdOrUrl: string
    electionIdPlaceholder: string
    electionIdHint: string
    openPortalBtn: string
    dontHaveId: string
    askOrganizers: string
    // Voter status section
    voterStatusBadge: string
    voterStatusTitle: string
    voterStatusTitleHighlight: string
    voterStatusDesc: string
    voterStatusRegistration: string
    voterStatusRegistrationDesc: string
    voterStatusParticipation: string
    voterStatusParticipationDesc: string
    voterStatusSecrecy: string
    voterStatusSecrecyDesc: string
    voterStatusHashing: string
    voterStatusHashingDesc: string
    whatYouWillSee: string
    checkVoterStatus: string
    dontHaveVoterId: string
    useEmailOrPhone: string
    identifierEmail: string
    identifierPhone: string
    identifierVoterId: string
    identifierAny: string
  }
  auth: {
    login: string
    register: string
    logout: string
    sessionExpired: string
    orgLogin: string
    registerOrg: string
    myDashboard: string
    dashboard: string
    organizationPortal: string
    signIn: string
    signUp: string
    email: string
    password: string
    forgotPassword: string
    welcomeBack: string
    createAccount: string
  }
  workspace: {
    dashboard: string
    elections: string
    voters: string
    candidates: string
    settings: string
    overview: string
    reports: string
    notifications: string
    audit: string
    observers: string
    exports: string
  }
  election: {
    overview: string
    positions: string
    voting: string
    results: string
    audit: string
    reports: string
    notifications: string
    status: string
    statusDraft: string
    statusPublished: string
    statusAccreditation: string
    statusVoting: string
    statusClosed: string
    statusCertified: string
    votingOpensIn: string
    votingClosesIn: string
    votingEnded: string
    turnout: string
    votesCast: string
    eligibleVoters: string
    timeRemaining: string
  }
  voting: {
    ballot: string
    castVote: string
    receipt: string
    verify: string
    review: string
    confirm: string
    reviewYourVote: string
    submitVote: string
    confirmAndSubmit: string
    finalConfirmation: string
    finalConfirmationDesc: string
    summary: string
    voteRecorded: string
    voteRecordedDesc: string
    verifyReceipt: string
    receiptCopied: string
    receiptVerified: string
    verificationFailed: string
    ballotSecrecyProtected: string
    ballotSecrecyDesc: string
    backToElection: string
    chooseOne: string
    chooseN: string
    clear: string
    change: string
    noneOfTheAbove: string
    noneOfTheAboveDesc: string
    readManifesto: string
    hideManifesto: string
    manifesto: string
    allPositionsCompleted: string
    generatingBallot: string
    generatingBallotSub: string
    encrypting: string
    encryptingSub: string
    online: string
    offline: string
    autoSaved: string
    liveElection: string
    voter: string
    votingClosesIn: string
    position: string
    of: string
    completed: string
    reviewing: string
    cannotLoadBallot: string
    backBtn: string
  }
  voterPicker: {
    title: string
    subtitle: string
    demoMode: string
    demoModeDesc: string
    eligibleVoters: string
    noVoters: string
    voted: string
    backToElection: string
    sessionStarted: string
  }
  publicResults: {
    live: string
    certified: string
    completed: string
    published: string
    setup: string
    publicResults: string
    verified: string
    opened: string
    closes: string
    lastVote: string
    timeRemaining: string
    votingClosed: string
    viewFullVerification: string
    share: string
    verifyYourVote: string
    copyLink: string
    verifyReceipt: string
    eligibleVoters: string
    votesCast: string
    turnout: string
    turnoutProgress: string
    voters: string
    of: string
    remaining: string
    lastVoteRecorded: string
    liveCandidateResults: string
    updatingLive: string
    final: string
    noPositions: string
    resultsHidden: string
    resultsHiddenDesc: string
    cryptographicVerification: string
    cryptoDesc: string
    auditHash: string
    integritySignature: string
    totalVotes: string
    verifiedTurnout: string
    signatureValid: string
    loadingResults: string
    couldntLoadResults: string
    winner: string
    winners: string
    votes: string
    noVotesRecorded: string
    copy: string
    footerSecurity: string
  }
  verification: {
    portalTitle: string
    certified: string
    verificationStatus: string
    verified: string
    failed: string
    publicResults: string
    backToVoteWise: string
    loadingVerification: string
    verificationUnavailable: string
    verificationUnavailableDesc: string
    electionVerified: string
    verificationFailed: string
    electionVerifiedDesc: string
    verificationFailedDesc: string
    auditHash: string
    integritySignature: string
    totalVotes: string
    turnoutPct: string
    signatureValid: string
    certifiedResults: string
    auditChain: string
    downloadReport: string
    sharePortal: string
  }
  voterStatus: {
    portalTitle: string
    title: string
    titleHighlight: string
    desc: string
    descHighlight: string
    lookUpRecord: string
    identifier: string
    identifierPlaceholder: string
    checkStatus: string
    checking: string
    identifierHint: string
    privacyGuarantees: string
    whatIsShown: string
    whatIsNeverRevealed: string
    shownRegistration: string
    shownParticipation: string
    shownReceipts: string
    hiddenChoices: string
    hiddenIdentity: string
    hiddenLinking: string
    recordFound: string
    voterNotFound: string
    notFoundDesc: string
    suggestions: string
    suggestion1: string
    suggestion2: string
    suggestion3: string
    suggestion4: string
    suggestion5: string
    lookupsPrivate: string
    backToHome: string
    elections: string
    noElections: string
    yourReceipts: string
    recentActivity: string
    voted: string
    eligibleOpen: string
    eligibleUpcoming: string
    didNotVote: string
    pending: string
    voteNow: string
    receipt: string
    recorded: string
    verify: string
    verifying: string
    voteConfirmed: string
    receiptNotFound: string
    verificationFailed: string
    election: string
    position: string
  }
  errors: {
    notFound: string
    notFoundDesc: string
    unauthorized: string
    unauthorizedDesc: string
    forbidden: string
    forbiddenDesc: string
    serverError: string
    serverErrorDesc: string
    goHome: string
  }
}

// ---------------------------------------------------------------
// ENGLISH — complete
// ---------------------------------------------------------------
const en: Translations = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    filter: 'Filter',
    loading: 'Loading…',
    error: 'Error',
    success: 'Success',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    confirm: 'Confirm',
    retry: 'Retry',
    refresh: 'Refresh',
    copy: 'Copy',
    copied: 'Copied',
    share: 'Share',
    download: 'Download',
    yes: 'Yes',
    no: 'No',
    all: 'All',
    none: 'None',
    optional: 'optional',
    required: 'required',
    theme: 'Theme',
    language: 'Language',
  },
  home: {
    heroBadge: "Africa's Election Management Platform",
    heroTitleLine1: 'Run Secure, Transparent &',
    heroTitleLine2: 'Real-Time Elections',
    heroTitleLine3: 'for Any Organization.',
    heroSubtitle:
      'From universities and associations to companies, churches and government agencies, VoteWise helps you organize trusted elections in minutes.',
    registerOrg: 'Register Organization',
    requestDemo: 'Request Live Demo',
    encryptedVoting: 'Encrypted voting',
    receiptAnchored: 'Receipt-anchored',
    fullAuditTrail: 'Full audit trail',
    anyOrg: 'Any organization',
    statOrganizations: 'Organizations',
    statOrgTypes: 'Org Types',
    statUserRoles: 'User Roles',
    trustedTransparent: 'Trusted & Transparent',
    trustedTransparentSub: 'Every vote verifiable. Every action audited.',
    receiptVerification: 'Receipt-Anchored Verification',
    verifyYourVoteTitle: 'Verify your vote was',
    verifyYourVoteTitleHighlight: 'recorded & counted.',
    verifyYourVoteDesc:
      "Every voter receives a unique receipt code after casting their ballot. Enter it below to confirm your vote was recorded — without revealing which candidate you chose. That's receipt-anchored anonymity.",
    ballotSecrecy: 'Ballot secrecy.',
    ballotSecrecyDesc: 'Your choice is encrypted forever — only the receipt is verifiable.',
    receiptAnchoredLabel: 'Receipt-anchored.',
    receiptAnchoredDesc: 'Prove you voted without ever revealing how.',
    tamperEvident: 'Tamper-evident.',
    tamperEvidentDesc: 'A hash-chained audit log catches any modification, anywhere.',
    checkYourReceipt: 'Check Your Receipt',
    receiptCode: 'Receipt code',
    receiptCodeFormat: 'Format: VW-YYYY-XXXXXXXX. Find it in your confirmation screen or email.',
    verifyReceipt: 'Verify Receipt',
    voteConfirmed: 'Vote confirmed & counted',
    receiptNotFound: 'Receipt not found',
    needFullView: 'Need the full view?',
    openFullPage: 'Open full page',
    trustAudit: 'End-to-End Audit Trails',
    trustLiveDashboard: 'Live Result Dashboard',
    trustMFA: 'Multi-Factor Authentication',
    trustOTP: 'OTP Verified Voting',
    trustWhiteLabel: 'White-Label Portal',
    trustMonitoring: 'Real-Time Monitoring',
    trustSecurity: 'Enterprise Security',
    statOrgsCount: 'Organizations',
    statElectionsHosted: 'Elections Hosted',
    statVotesCast: 'Votes Cast',
    statUptime: 'Platform Uptime',
    howBadge: '4 Simple Steps',
    howTitle: 'How VoteWise Works',
    howSubtitle: 'From registration to live election in minutes.',
    howStep1Title: '1. Create Organization',
    howStep1Desc: 'Register your organization, choose a subdomain, and set up branding in under 5 minutes.',
    howStep2Title: '2. Setup Election',
    howStep2Desc: 'Create an election, add positions and candidates, configure voting window.',
    howStep3Title: '3. Invite Voters',
    howStep3Desc: 'Import your voter register via CSV or manual entry. Dynamic fields adapt to your org type.',
    howStep4Title: '4. Go Live',
    howStep4Desc: 'When all readiness checks pass, click Go Live. Your election opens for voting instantly.',
    orgsBuiltForAny: 'Built for ANY Organization',
    orgsTitle: 'The system never knows or cares which one it is.',
    orgsSubtitle: "They're all simply Organizations. VoteWise works for every one of them.",
    orgsAllOrgs: 'Organizations',
    productsBadge: 'Three Products',
    productsTitle: 'The VoteWise Platform',
    productsSubtitle: 'Three distinct products, one trusted platform. Clear separation of concerns.',
    featuresBadge: 'Platform Features',
    featuresTitle: 'Everything You Need to Run a Secure Election',
    featuresSubtitle: 'A complete election management toolkit — from voter registration to certified results.',
    hierarchyBadge: 'The Biggest Architectural Shift',
    hierarchyTitle: 'A Universal Hierarchy',
    hierarchySubtitle:
      'Not University → Faculty → Department → Student → Election. That only works for one org type. VoteWise uses a generic hierarchy that works for every organization.',
    hierarchyNote:
      'This single change makes the platform universal. A university configures its terminology as Organization=University, Workspace=Faculty, Voter Group=Department. A church configures Organization=Church, Workspace=Parish, Voter Group=Fellowship. The system treats them identically.',
    rolesBadge: 'Six User Roles',
    rolesTitle: 'Exactly Six. Not Twenty. Not Fifty.',
    rolesSubtitle: 'Every person on VoteWise fits one of these six categories. Clear permissions, clear boundaries.',
    rolesCan: 'Can',
    rolesCannot: 'Cannot',
    principlesBadge: 'Six Platform Principles',
    principlesTitle: 'Every Feature Must Satisfy These',
    principlesSubtitle:
      'If a design decision can\'t answer "Can this work for ANY organization?" with yes, we don\'t build it.',
    securityBadge: 'Security First',
    securityTitle: 'Built for Trust',
    securitySubtitle: 'Every action produces an audit trail. Every vote is encrypted. Every result is verifiable.',
    pricingBadge: 'Simple Pricing',
    pricingTitle: 'Pay Only for What You Use',
    pricingSubtitle: 'Start free. Pay to go live. No hidden fees. Negotiation available for large organizations.',
    pricingMostPopular: 'Most Popular',
    testimonialsBadge: 'Testimonials',
    testimonialsTitle: 'Trusted by Organizations Across Africa',
    testimonialsSubtitle:
      'From professional bodies to cooperatives to universities — organizations run their elections on VoteWise.',
    orgsDirectoryBadge: 'Live Directory',
    orgsDirectoryTitle: 'Organizations on VoteWise',
    orgsDirectorySubtitle: 'Real organizations already running their elections on VoteWise.',
    demoBadge: 'Demo Request',
    demoTitle: 'Request a Personalized Demo',
    demoSubtitle: 'Tell us about your organization and our team will set up a tailored demo within 24 hours.',
    demoContactPerson: 'Contact Person',
    demoEmail: 'Email',
    demoPhone: 'Phone',
    demoOrgType: 'Organization Type',
    demoOrgName: 'Organization Name',
    demoEstimatedVoters: 'Estimated Voters',
    demoPreferredDate: 'Preferred Date',
    demoMessage: 'Message (optional)',
    demoRequestBtn: 'Request Demo',
    demoSending: 'Sending…',
    demoNoCommitment: "No commitment required. We'll never share your details.",
    liveDemoBadge: 'Live Demo',
    liveDemoTitle: 'See It In Action',
    liveDemoSubtitle:
      'Explore a live demo election with real encrypted votes, live results, and the full voter journey. No registration required.',
    tryVoterJourney: 'Try the voter journey',
    tryVotingNow: 'Try Voting Now',
    about: 'About',
    guide: 'Guide',
    viewPublicResults: 'View public results',
    viewLiveResults: 'View Live Results',
    docsBadge: 'Documentation',
    docsTitle: 'Read the Docs',
    docsSubtitle: 'Everything you need to understand, trust, and use VoteWise — for voters, admins, and observers.',
    readMore: 'Read more',
    contactBadge: 'Contact',
    contactTitle: 'Get In Touch',
    contactSubtitle: 'Questions? Partnerships? Press? We\'d love to hear from you.',
    contactName: 'Your Name',
    contactOrgOptional: 'Organization (optional)',
    contactMessage: 'Message',
    contactSend: 'Send Message',
    contactSending: 'Sending…',
    signupBadge: 'Simple Onboarding',
    signupTitle: 'Set Up Your Election in Under 5 Minutes',
    signupSubtitle:
      'Register your organization, configure your terminology, and launch your first election. No technical expertise required. No hidden complexity.',
    signupFeature1: 'Works for any organization type',
    signupFeature2: 'Configure your own terminology (Faculty / Branch / Parish / Unit)',
    signupFeature3: 'Custom branding with your logo & colors',
    signupFeature4: 'Pay only when you go live',
    registerYourOrg: 'Register Your Organization',
    verifyElectionBadge: 'Public Verification Portal',
    verifyElectionTitle: 'Verify an',
    verifyElectionTitleHighlight: 'entire election.',
    verifyElectionDesc:
      'Anyone — voters, journalists, observers, auditors — can independently verify the integrity of a certified VoteWise election. Check the audit hash, walk the hash-chained audit log, and confirm the integrity signature. If anything was tampered with, the portal will tell you.',
    verifyElectionCertified: 'Certified only.',
    verifyElectionCertifiedDesc: 'Verification portals are available only after the electoral committee certifies the results.',
    verifyElectionCrypto: 'Cryptographic.',
    verifyElectionCryptoDesc: 'Recompute the SHA-256 audit hash and verify the HMAC-SHA256 signature yourself.',
    verifyElectionTamper: 'Tamper-evident.',
    verifyElectionTamperDesc: 'The hash-chained audit log catches any modification — anywhere, anytime.',
    openVerificationPortal: 'Open a Verification Portal',
    electionIdOrUrl: 'Election ID or URL',
    electionIdPlaceholder: 'Paste an election ID or /verify/… link',
    electionIdHint: 'Accepts an election ID, a /verify/<id> URL, or a /results/<id> URL.',
    openPortalBtn: 'Open Verification Portal',
    dontHaveId: "Don't have an ID?",
    askOrganizers: 'Ask the election organizers for the verification link.',
    voterStatusBadge: 'Voter Self-Service',
    voterStatusTitle: 'Check your',
    voterStatusTitleHighlight: 'voter status.',
    voterStatusDesc:
      "Enter your email, phone, or voter ID and we'll show you your registration status, the elections you're eligible for, the receipts you hold, and your recent activity timeline — all without ever revealing how you voted. Cross-organization: one lookup, every org you're registered with.",
    voterStatusRegistration: 'Registration status.',
    voterStatusRegistrationDesc: "Confirm you're ACTIVE and VERIFIED across all the organizations you're registered with.",
    voterStatusParticipation: 'Participation history.',
    voterStatusParticipationDesc: 'See which elections you\'ve voted in, which are live, and which are upcoming — with a one-tap "Vote Now" button.',
    voterStatusSecrecy: 'Ballot secrecy guaranteed.',
    voterStatusSecrecyDesc: 'Receipt codes confirm your vote was counted but cannot reveal which candidate you selected.',
    voterStatusHashing: 'One-way hashing.',
    voterStatusHashingDesc: 'Your voter hash is one-way encrypted — no one can link a receipt back to your identity.',
    whatYouWillSee: "What you'll see",
    checkVoterStatus: 'Check Voter Status',
    dontHaveVoterId: "Don't have your voter ID?",
    useEmailOrPhone: 'Use your registration email or phone instead.',
    identifierEmail: 'Email',
    identifierPhone: 'Phone',
    identifierVoterId: 'Voter ID / Matric',
    identifierAny: 'Any identifier',
  },
  auth: {
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    sessionExpired: 'Session expired. Please sign in again.',
    orgLogin: 'Org Login',
    registerOrg: 'Register Org',
    myDashboard: 'My Dashboard',
    dashboard: 'Dashboard',
    organizationPortal: 'Organization Portal',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    email: 'Email',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    welcomeBack: 'Welcome back',
    createAccount: 'Create account',
  },
  workspace: {
    dashboard: 'Dashboard',
    elections: 'Elections',
    voters: 'Voters',
    candidates: 'Candidates',
    settings: 'Settings',
    overview: 'Overview',
    reports: 'Reports',
    notifications: 'Notifications',
    audit: 'Audit',
    observers: 'Observers',
    exports: 'Exports',
  },
  election: {
    overview: 'Overview',
    positions: 'Positions',
    voting: 'Voting',
    results: 'Results',
    audit: 'Audit',
    reports: 'Reports',
    notifications: 'Notifications',
    status: 'Status',
    statusDraft: 'Draft',
    statusPublished: 'Published',
    statusAccreditation: 'Accreditation',
    statusVoting: 'Voting Open',
    statusClosed: 'Voting Closed',
    statusCertified: 'Certified',
    votingOpensIn: 'Voting opens in',
    votingClosesIn: 'Voting closes in',
    votingEnded: 'Voting has ended',
    turnout: 'Turnout',
    votesCast: 'Votes Cast',
    eligibleVoters: 'Eligible Voters',
    timeRemaining: 'Time Remaining',
  },
  voting: {
    ballot: 'Ballot',
    castVote: 'Cast Vote',
    receipt: 'Receipt',
    verify: 'Verify',
    review: 'Review',
    confirm: 'Confirm',
    reviewYourVote: 'Review Your Vote',
    submitVote: 'Submit Vote',
    confirmAndSubmit: 'Confirm & Submit',
    finalConfirmation: 'Final Confirmation',
    finalConfirmationDesc:
      'You are about to submit your vote. This action cannot be reversed. Your ballot will be encrypted and recorded permanently.',
    summary: 'Summary:',
    voteRecorded: 'Vote Successfully Recorded',
    voteRecordedDesc:
      'Your vote has been encrypted, recorded, and audited. Save your receipt numbers below to verify your participation later.',
    verifyReceipt: 'Verify Receipt',
    receiptCopied: 'Receipt copied to clipboard',
    receiptVerified: 'Receipt Verified',
    verificationFailed: 'Verification Failed',
    ballotSecrecyProtected: 'Ballot Secrecy Protected',
    ballotSecrecyDesc:
      'Your receipt confirms participation — not candidate choices. No one can determine who you voted for, not even database administrators.',
    backToElection: 'Back to Election',
    chooseOne: 'Choose 1',
    chooseN: 'Choose',
    clear: 'Clear',
    change: 'Change',
    noneOfTheAbove: 'None of the Above',
    noneOfTheAboveDesc: 'I do not support any of these candidates',
    readManifesto: 'Read manifesto',
    hideManifesto: 'Hide manifesto',
    manifesto: 'Manifesto',
    allPositionsCompleted: 'All positions completed',
    generatingBallot: 'Generating your secure ballot…',
    generatingBallotSub: 'Validating eligibility, accreditation, and election rules.',
    encrypting: 'Encrypting and recording your vote…',
    encryptingSub: 'Running 8-step validation pipeline. Atomic transaction — if anything fails, your vote is NOT recorded.',
    online: 'Online',
    offline: 'Offline',
    autoSaved: 'Auto-saved',
    liveElection: 'Live Election',
    voter: 'Voter',
    votingClosesIn: 'Voting closes in',
    position: 'Position',
    of: 'of',
    completed: 'completed',
    reviewing: 'Reviewing',
    cannotLoadBallot: 'Cannot load ballot',
    backBtn: 'Back',
  },
  voterPicker: {
    title: 'Secure Voter Authentication',
    subtitle:
      'Select your voter profile to begin. A secure voting session will be created for you. Your session expires in 30 minutes.',
    demoMode: 'Demo Mode',
    demoModeDesc:
      'This is a demo election. In production, voters authenticate via email/SMS OTP or institutional SSO. Here you can pick any voter to simulate the experience.',
    eligibleVoters: 'Eligible Voters',
    noVoters: 'No eligible voters found for this election.',
    voted: 'Voted',
    backToElection: 'Back to Election',
    sessionStarted: 'Voting session started for',
  },
  publicResults: {
    live: 'Live',
    certified: 'Certified',
    completed: 'Completed',
    published: 'Published',
    setup: 'Setup',
    publicResults: 'Public Results',
    verified: 'Verified',
    opened: 'Opened:',
    closes: 'Closes:',
    lastVote: 'Last vote:',
    timeRemaining: 'Time Remaining',
    votingClosed: 'Voting Closed',
    viewFullVerification: 'View Full Verification',
    share: 'Share',
    verifyYourVote: 'Verify Your Vote',
    copyLink: 'Copy Link',
    verifyReceipt: 'Verify Receipt',
    eligibleVoters: 'Eligible Voters',
    votesCast: 'Votes Cast',
    turnout: 'Turnout',
    turnoutProgress: 'Turnout Progress',
    voters: 'voters',
    of: 'of',
    remaining: 'remaining',
    lastVoteRecorded: 'Last vote recorded',
    liveCandidateResults: 'Live Candidate Results',
    updatingLive: 'Updating live',
    final: 'Final',
    noPositions: 'No positions configured for this election.',
    resultsHidden: 'Results are hidden until voting closes.',
    resultsHiddenDesc:
      'Showing aggregate turnout only. Candidate-level results will be published once the election window closes and the tally is certified.',
    cryptographicVerification: 'Cryptographic Verification',
    cryptoDesc:
      'Every election in VoteWise produces a signed verification package. The audit hash is a SHA-256 of all vote records; the integrity signature is an HMAC-SHA256 over the tally. Independent observers can recompute these to prove the published results match the recorded ballots.',
    auditHash: 'Audit Hash (SHA-256)',
    integritySignature: 'Integrity Signature (HMAC-SHA256)',
    totalVotes: 'Total Votes',
    verifiedTurnout: 'Verified Turnout',
    signatureValid: 'Signature Valid',
    loadingResults: 'Loading live results…',
    couldntLoadResults: "Couldn't load results",
    winner: 'Winner',
    winners: 'winners',
    votes: 'votes',
    noVotesRecorded: 'No votes recorded for this position yet.',
    copy: 'Copy',
    footerSecurity:
      'Every vote is encrypted at rest (AES-256-GCM) and recorded with a hash-chained audit log. Receipt-anchored anonymity — verify participation, never choices.',
  },
  verification: {
    portalTitle: 'Election Verification Portal',
    certified: 'Certified',
    verificationStatus: 'Verification Status',
    verified: 'Verified',
    failed: 'Failed',
    publicResults: 'Public Results',
    backToVoteWise: 'Back to VoteWise',
    loadingVerification: 'Loading verification package…',
    verificationUnavailable: 'Verification unavailable',
    verificationUnavailableDesc:
      'The public verification portal is only available for elections that have been officially certified. If you have a receipt code, you can still verify your individual vote below.',
    electionVerified: '✓ This election is verified',
    verificationFailed: '✗ Verification failed',
    electionVerifiedDesc:
      'All integrity checks passed. The certified results match the recorded ballots, the audit chain is intact, and the integrity signature is valid.',
    verificationFailedDesc:
      'One or more integrity checks did not pass. Review the details below before trusting these results.',
    auditHash: 'Audit Hash',
    integritySignature: 'Integrity Signature',
    totalVotes: 'Total Votes',
    turnoutPct: 'Turnout',
    signatureValid: 'Signature Valid',
    certifiedResults: 'Certified Results',
    auditChain: 'Audit Chain',
    downloadReport: 'Download Report',
    sharePortal: 'Share Portal',
  },
  voterStatus: {
    portalTitle: 'Voter Status Portal',
    title: 'Check Your',
    titleHighlight: 'Voter Status',
    desc: 'Check your registration status, voting history, and receipts.',
    descHighlight: 'Your vote choices are never revealed.',
    lookUpRecord: 'Look up your record',
    identifier: 'Email, phone, or voter ID',
    identifierPlaceholder: 'Enter your email, phone, or voter ID',
    checkStatus: 'Check Status',
    checking: 'Checking…',
    identifierHint:
      'You can use any identifier you registered with — email, phone number, or matric / voter ID.',
    privacyGuarantees: 'Privacy Guarantees',
    whatIsShown: 'What is shown',
    whatIsNeverRevealed: 'What is never revealed',
    shownRegistration: 'Your registration status is shown',
    shownParticipation: 'Your participation (voted / not voted) is shown',
    shownReceipts: 'Your receipt codes are shown (so you can verify them)',
    hiddenChoices: 'Your vote choices are NEVER revealed',
    hiddenIdentity: 'No one can determine who you voted for',
    hiddenLinking: 'Your receipt cannot be linked to your identity by third parties',
    recordFound: 'Record found',
    voterNotFound: 'Voter not found',
    notFoundDesc: 'No voter record matches that identifier. Please try again with a different identifier.',
    suggestions: 'Suggestions',
    suggestion1: 'Check your spelling and try again',
    suggestion2: 'Try a different identifier (email, phone, or voter ID)',
    suggestion3: 'If you usually log in by email, try your phone number instead',
    suggestion4: 'Make sure your phone includes the country code, e.g. +234…',
    suggestion5: "Contact your organization's electoral committee if you believe this is an error",
    lookupsPrivate: 'Lookups are private — no record of your search is kept.',
    backToHome: 'Back to home',
    elections: 'Elections',
    noElections: 'No elections published by this organization yet.',
    yourReceipts: 'Your Receipts',
    recentActivity: 'Recent Activity',
    voted: 'Voted',
    eligibleOpen: 'Eligible — Open Now',
    eligibleUpcoming: 'Eligible — Upcoming',
    didNotVote: 'Did not vote',
    pending: 'Pending',
    voteNow: 'Vote Now',
    receipt: 'Receipt',
    recorded: 'Recorded',
    verify: 'Verify',
    verifying: 'Verifying…',
    voteConfirmed: 'Vote confirmed & counted',
    receiptNotFound: 'Receipt not found',
    verificationFailed: 'Verification failed',
    election: 'Election',
    position: 'Position',
  },
  errors: {
    notFound: 'Page not found',
    notFoundDesc: "The page you're looking for doesn't exist or has been moved.",
    unauthorized: 'Unauthorized',
    unauthorizedDesc: 'You need to sign in to access this page.',
    forbidden: 'Forbidden',
    forbiddenDesc: "You don't have permission to access this page.",
    serverError: 'Server error',
    serverErrorDesc: 'Something went wrong on our end. Please try again later.',
    goHome: 'Go to Homepage',
  },
}

// ---------------------------------------------------------------
// FRENCH — complete
// ---------------------------------------------------------------
const fr: Translations = {
  common: {
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    search: 'Rechercher',
    filter: 'Filtrer',
    loading: 'Chargement…',
    error: 'Erreur',
    success: 'Succès',
    close: 'Fermer',
    back: 'Retour',
    next: 'Suivant',
    previous: 'Précédent',
    submit: 'Soumettre',
    confirm: 'Confirmer',
    retry: 'Réessayer',
    refresh: 'Actualiser',
    copy: 'Copier',
    copied: 'Copié',
    share: 'Partager',
    download: 'Télécharger',
    yes: 'Oui',
    no: 'Non',
    all: 'Tout',
    none: 'Aucun',
    optional: 'facultatif',
    required: 'requis',
    theme: 'Thème',
    language: 'Langue',
  },
  home: {
    heroBadge: "Plateforme de Gestion Électorale d'Afrique",
    heroTitleLine1: 'Organisez des Élections Sûres,',
    heroTitleLine2: 'Transparentes & en Temps Réel',
    heroTitleLine3: 'pour Toute Organisation.',
    heroSubtitle:
      "Des universités et associations aux entreprises, églises et agences gouvernementales, VoteWise vous aide à organiser des élections fiables en quelques minutes.",
    registerOrg: "Enregistrer l'Organisation",
    requestDemo: 'Demander une Démo',
    encryptedVoting: 'Vote chiffré',
    receiptAnchored: 'Reçu authentifié',
    fullAuditTrail: "Piste d'audit complète",
    anyOrg: 'Toute organisation',
    statOrganizations: 'Organisations',
    statOrgTypes: "Types d'org.",
    statUserRoles: 'Rôles utilisateur',
    trustedTransparent: 'Fiable & Transparent',
    trustedTransparentSub: 'Chaque vote vérifiable. Chaque action auditée.',
    receiptVerification: 'Vérification par Reçu',
    verifyYourVoteTitle: 'Vérifiez que votre vote a été',
    verifyYourVoteTitleHighlight: 'enregistré & compté.',
    verifyYourVoteDesc:
      "Chaque électeur reçoit un code de reçu unique après avoir voté. Saisissez-le ci-dessous pour confirmer que votre vote a été enregistré — sans révéler quel candidat vous avez choisi. C'est l'anonymat par reçu.",
    ballotSecrecy: 'Secret du vote.',
    ballotSecrecyDesc: 'Votre choix est chiffré pour toujours — seul le reçu est vérifiable.',
    receiptAnchoredLabel: 'Par reçu.',
    receiptAnchoredDesc: 'Prouvez que vous avez voté sans jamais révéler comment.',
    tamperEvident: 'Infalsifiable.',
    tamperEvidentDesc: "Une piste d'audit à chaîne de hachage détecte toute modification, n'importe où.",
    checkYourReceipt: 'Vérifiez Votre Reçu',
    receiptCode: 'Code de reçu',
    receiptCodeFormat: 'Format : VW-AAAA-XXXXXXXX. Trouvez-le sur votre écran de confirmation ou par email.',
    verifyReceipt: 'Vérifier le Reçu',
    voteConfirmed: 'Vote confirmé & compté',
    receiptNotFound: 'Reçu introuvable',
    needFullView: 'Besoin de la vue complète ?',
    openFullPage: 'Ouvrir la page complète',
    trustAudit: "Pistes d'Audit de Bout en Bout",
    trustLiveDashboard: 'Tableau de Bord des Résultats en Direct',
    trustMFA: 'Authentification Multi-Facteurs',
    trustOTP: 'Vote Vérifié par OTP',
    trustWhiteLabel: 'Portail Marque Blanche',
    trustMonitoring: 'Surveillance en Temps Réel',
    trustSecurity: 'Sécurité Entreprise',
    statOrgsCount: 'Organisations',
    statElectionsHosted: 'Élections Organisées',
    statVotesCast: 'Votes Exprimés',
    statUptime: 'Disponibilité Plateforme',
    howBadge: '4 Étapes Simples',
    howTitle: 'Comment VoteWise Fonctionne',
    howSubtitle: "De l'inscription à l'élection en direct en quelques minutes.",
    howStep1Title: "1. Créer l'Organisation",
    howStep1Desc: "Enregistrez votre organisation, choisissez un sous-domaine et configurez l'image de marque en moins de 5 minutes.",
    howStep2Title: "2. Configurer l'Élection",
    howStep2Desc: "Créez une élection, ajoutez des postes et candidats, configurez la fenêtre de vote.",
    howStep3Title: '3. Inviter les Électeurs',
    howStep3Desc: "Importez votre registre électoral via CSV ou saisie manuelle. Les champs dynamiques s'adaptent à votre type d'organisation.",
    howStep4Title: '4. Lancer',
    howStep4Desc: "Quand tous les contrôles de préparation passent, cliquez sur Lancer. Votre élection s'ouvre au vote instantanément.",
    orgsBuiltForAny: 'Conçu pour TOUTE Organisation',
    orgsTitle: "Le système ne sait ni ne se soucie de laquelle c'est.",
    orgsSubtitle: "Ce sont toutes simplement des Organisations. VoteWise fonctionne pour chacune d'elles.",
    orgsAllOrgs: 'Organisations',
    productsBadge: 'Trois Produits',
    productsTitle: 'La Plateforme VoteWise',
    productsSubtitle: 'Trois produits distincts, une plateforme de confiance. Séparation claire des préoccupations.',
    featuresBadge: 'Fonctionnalités de la Plateforme',
    featuresTitle: 'Tout ce dont vous avez besoin pour organiser une élection sûre',
    featuresSubtitle: "Une boîte à outils complète de gestion électorale — de l'inscription des électeurs aux résultats certifiés.",
    hierarchyBadge: 'Le Plus Grand Changement Architectural',
    hierarchyTitle: 'Une Hiérarchie Universelle',
    hierarchySubtitle:
      "Pas Université → Faculté → Département → Étudiant → Élection. Cela ne fonctionne que pour un type d'org. VoteWise utilise une hiérarchie générique qui fonctionne pour chaque organisation.",
    hierarchyNote:
      "Ce seul changement rend la plateforme universelle. Une université configure sa terminologie comme Organisation=Université, Espace=Faculté, Groupe d'électeurs=Département. Une église configure Organisation=Église, Espace=Paroisse, Groupe d'électeurs=Congrégation. Le système les traite identiquement.",
    rolesBadge: 'Six Rôles Utilisateur',
    rolesTitle: 'Exactement Six. Pas Vingt. Pas Cinquante.',
    rolesSubtitle: 'Chaque personne sur VoteWise correspond à l\'une de ces six catégories. Permissions claires, frontières claires.',
    rolesCan: 'Peut',
    rolesCannot: 'Ne peut pas',
    principlesBadge: 'Six Principes de Plateforme',
    principlesTitle: 'Chaque Fonctionnalité Doit Satisfaire Ceux-ci',
    principlesSubtitle: 'Si une décision de conception ne peut pas répondre « Cela peut-il fonctionner pour TOUTE organisation ? » par oui, nous ne le construisons pas.',
    securityBadge: 'Sécurité d\'Abord',
    securityTitle: 'Conçu pour la Confiance',
    securitySubtitle: 'Chaque action produit une piste d\'audit. Chaque vote est chiffré. Chaque résultat est vérifiable.',
    pricingBadge: 'Tarification Simple',
    pricingTitle: 'Payez Seulement pour ce que Vous Utilisez',
    pricingSubtitle: 'Commencez gratuitement. Payez pour lancer. Aucuns frais cachés. Négociation disponible pour les grandes organisations.',
    pricingMostPopular: 'Le Plus Populaire',
    testimonialsBadge: 'Témoignages',
    testimonialsTitle: 'Adopté par des Organisations à travers l\'Afrique',
    testimonialsSubtitle: 'Des organismes professionnels aux coopératives et universités — les organisations organisent leurs élections sur VoteWise.',
    orgsDirectoryBadge: 'Annuaire en Direct',
    orgsDirectoryTitle: 'Organisations sur VoteWise',
    orgsDirectorySubtitle: 'De vraies organisations organisant déjà leurs élections sur VoteWise.',
    demoBadge: 'Demande de Démo',
    demoTitle: 'Demander une Démo Personnalisée',
    demoSubtitle: 'Parlez-nous de votre organisation et notre équipe configurera une démo sur mesure sous 24 heures.',
    demoContactPerson: 'Personne à Contacter',
    demoEmail: 'Email',
    demoPhone: 'Téléphone',
    demoOrgType: "Type d'Organisation",
    demoOrgName: "Nom de l'Organisation",
    demoEstimatedVoters: 'Électeurs Estimés',
    demoPreferredDate: 'Date Préférée',
    demoMessage: 'Message (facultatif)',
    demoRequestBtn: 'Demander une Démo',
    demoSending: 'Envoi…',
    demoNoCommitment: 'Aucun engagement requis. Nous ne partagerons jamais vos informations.',
    liveDemoBadge: 'Démo en Direct',
    liveDemoTitle: 'Voir en Action',
    liveDemoSubtitle: 'Explorez une élection de démonstration en direct avec de vrais votes chiffrés, des résultats en direct et le parcours électoral complet. Aucune inscription requise.',
    tryVoterJourney: 'Essayez le parcours électeur',
    tryVotingNow: 'Essayer de Voter',
    about: 'À propos',
    guide: 'Guide',
    viewPublicResults: 'Voir les résultats publics',
    viewLiveResults: 'Voir les Résultats en Direct',
    docsBadge: 'Documentation',
    docsTitle: 'Lire la Documentation',
    docsSubtitle: 'Tout ce dont vous avez besoin pour comprendre, faire confiance et utiliser VoteWise — pour les électeurs, administrateurs et observateurs.',
    readMore: 'Lire plus',
    contactBadge: 'Contact',
    contactTitle: 'Contactez-Nous',
    contactSubtitle: 'Questions ? Partenariats ? Presse ? Nous serions ravis d\'avoir de vos nouvelles.',
    contactName: 'Votre Nom',
    contactOrgOptional: 'Organisation (facultatif)',
    contactMessage: 'Message',
    contactSend: 'Envoyer le Message',
    contactSending: 'Envoi…',
    signupBadge: 'Intégration Simple',
    signupTitle: 'Configurez Votre Élection en Moins de 5 Minutes',
    signupSubtitle: 'Enregistrez votre organisation, configurez votre terminologie et lancez votre première élection. Aucune expertise technique requise. Aucune complexité cachée.',
    signupFeature1: 'Fonctionne pour tout type d\'organisation',
    signupFeature2: 'Configurez votre propre terminologie (Faculté / Branche / Paroisse / Unité)',
    signupFeature3: 'Image de marque personnalisée avec votre logo et couleurs',
    signupFeature4: 'Payez seulement lorsque vous lancez',
    registerYourOrg: 'Enregistrer Votre Organisation',
    verifyElectionBadge: 'Portail de Vérification Publique',
    verifyElectionTitle: 'Vérifiez une',
    verifyElectionTitleHighlight: 'élection entière.',
    verifyElectionDesc: 'N\'importe qui — électeurs, journalistes, observateurs, auditeurs — peut vérifier indépendamment l\'intégrité d\'une élection VoteWise certifiée. Vérifiez le hachage d\'audit, parcourez le journal d\'audit à chaîne de hachage et confirmez la signature d\'intégrité. Si quoi que ce soit a été falsifié, le portail vous le dira.',
    verifyElectionCertified: 'Certifiées seulement.',
    verifyElectionCertifiedDesc: 'Les portails de vérification ne sont disponibles qu\'après que le comité électoral certifie les résultats.',
    verifyElectionCrypto: 'Cryptographique.',
    verifyElectionCryptoDesc: 'Recalculez vous-même le hachage d\'audit SHA-256 et vérifiez la signature HMAC-SHA256.',
    verifyElectionTamper: 'Infalsifiable.',
    verifyElectionTamperDesc: 'Le journal d\'audit à chaîne de hachage détecte toute modification — n\'importe où, n\'importe quand.',
    openVerificationPortal: 'Ouvrir un Portail de Vérification',
    electionIdOrUrl: 'ID d\'Élection ou URL',
    electionIdPlaceholder: 'Collez un ID d\'élection ou un lien /verify/…',
    electionIdHint: 'Accepte un ID d\'élection, une URL /verify/<id> ou une URL /results/<id>.',
    openPortalBtn: 'Ouvrir le Portail de Vérification',
    dontHaveId: 'Vous n\'avez pas d\'ID ?',
    askOrganizers: 'Demandez le lien de vérification aux organisateurs de l\'élection.',
    voterStatusBadge: 'Self-Service Électeur',
    voterStatusTitle: 'Vérifiez votre',
    voterStatusTitleHighlight: 'statut d\'électeur.',
    voterStatusDesc: 'Saisissez votre email, téléphone ou ID d\'électeur et nous vous montrerons votre statut d\'inscription, les élections pour lesquelles vous êtes éligible, les reçus que vous détenez et votre chronologie d\'activité récente — tout sans jamais révéler comment vous avez voté. Multi-organisations : une recherche, chaque organisation où vous êtes inscrit.',
    voterStatusRegistration: 'Statut d\'inscription.',
    voterStatusRegistrationDesc: 'Confirmez que vous êtes ACTIF et VÉRIFIÉ dans toutes les organisations où vous êtes inscrit.',
    voterStatusParticipation: 'Historique de participation.',
    voterStatusParticipationDesc: 'Voyez dans quelles élections vous avez voté, lesquelles sont en direct et à venir — avec un bouton « Voter Maintenant ».',
    voterStatusSecrecy: 'Secret du vote garanti.',
    voterStatusSecrecyDesc: 'Les codes de reçu confirment que votre vote a été compté mais ne peuvent pas révéler quel candidat vous avez sélectionné.',
    voterStatusHashing: 'Hachage à sens unique.',
    voterStatusHashingDesc: 'Votre hachage d\'électeur est chiffré à sens unique — personne ne peut lier un reçu à votre identité.',
    whatYouWillSee: 'Ce que vous verrez',
    checkVoterStatus: 'Vérifier le Statut d\'Électeur',
    dontHaveVoterId: 'Vous n\'avez pas votre ID d\'électeur ?',
    useEmailOrPhone: 'Utilisez plutôt votre email ou téléphone d\'inscription.',
    identifierEmail: 'Email',
    identifierPhone: 'Téléphone',
    identifierVoterId: 'ID Électeur / Matricule',
    identifierAny: 'Tout identifiant',
  },
  auth: {
    login: 'Connexion',
    register: 'S\'inscrire',
    logout: 'Déconnexion',
    sessionExpired: 'Session expirée. Veuillez vous reconnecter.',
    orgLogin: 'Connexion Org.',
    registerOrg: 'Enregistrer Org.',
    myDashboard: 'Mon Tableau de Bord',
    dashboard: 'Tableau de Bord',
    organizationPortal: 'Portail Organisation',
    signIn: 'Se Connecter',
    signUp: 'S\'inscrire',
    email: 'Email',
    password: 'Mot de passe',
    forgotPassword: 'Mot de passe oublié ?',
    welcomeBack: 'Bon retour',
    createAccount: 'Créer un compte',
  },
  workspace: {
    dashboard: 'Tableau de Bord',
    elections: 'Élections',
    voters: 'Électeurs',
    candidates: 'Candidats',
    settings: 'Paramètres',
    overview: 'Aperçu',
    reports: 'Rapports',
    notifications: 'Notifications',
    audit: 'Audit',
    observers: 'Observateurs',
    exports: 'Exportations',
  },
  election: {
    overview: 'Aperçu',
    positions: 'Postes',
    voting: 'Vote',
    results: 'Résultats',
    audit: 'Audit',
    reports: 'Rapports',
    notifications: 'Notifications',
    status: 'Statut',
    statusDraft: 'Brouillon',
    statusPublished: 'Publié',
    statusAccreditation: 'Accréditation',
    statusVoting: 'Vote Ouvert',
    statusClosed: 'Vote Fermé',
    statusCertified: 'Certifié',
    votingOpensIn: 'Le vote ouvre dans',
    votingClosesIn: 'Le vote ferme dans',
    votingEnded: 'Le vote est terminé',
    turnout: 'Participation',
    votesCast: 'Votes Exprimés',
    eligibleVoters: 'Électeurs Inscrits',
    timeRemaining: 'Temps Restant',
  },
  voting: {
    ballot: 'Bulletin',
    castVote: 'Déposer le Vote',
    receipt: 'Reçu',
    verify: 'Vérifier',
    review: 'Vérifier',
    confirm: 'Confirmer',
    reviewYourVote: 'Vérifiez Votre Vote',
    submitVote: 'Soumettre le Vote',
    confirmAndSubmit: 'Confirmer & Soumettre',
    finalConfirmation: 'Confirmation Finale',
    finalConfirmationDesc: 'Vous êtes sur le point de soumettre votre vote. Cette action est irréversible. Votre bulletin sera chiffré et enregistré de façon permanente.',
    summary: 'Résumé :',
    voteRecorded: 'Vote Enregistré avec Succès',
    voteRecordedDesc: 'Votre vote a été chiffré, enregistré et audité. Sauvegardez vos numéros de reçu ci-dessous pour vérifier votre participation ultérieurement.',
    verifyReceipt: 'Vérifier le Reçu',
    receiptCopied: 'Reçu copié dans le presse-papiers',
    receiptVerified: 'Reçu Vérifié',
    verificationFailed: 'Vérification Échouée',
    ballotSecrecyProtected: 'Secret du Vote Protégé',
    ballotSecrecyDesc: 'Votre reçu confirme la participation — pas les choix de candidats. Personne ne peut déterminer pour qui vous avez voté, pas même les administrateurs de base de données.',
    backToElection: "Retour à l'Élection",
    chooseOne: 'Choisir 1',
    chooseN: 'Choisir',
    clear: 'Effacer',
    change: 'Changer',
    noneOfTheAbove: 'Aucun des Candidats',
    noneOfTheAboveDesc: 'Je ne soutiens aucun de ces candidats',
    readManifesto: 'Lire le manifeste',
    hideManifesto: 'Masquer le manifeste',
    manifesto: 'Manifeste',
    allPositionsCompleted: 'Tous les postes complétés',
    generatingBallot: 'Génération de votre bulletin sécurisé…',
    generatingBallotSub: "Validation de l'éligibilité, l'accréditation et les règles électoral.",
    encrypting: 'Chiffrement et enregistrement de votre vote…',
    encryptingSub: "Exécution du pipeline de validation en 8 étapes. Transaction atomique — si quelque chose échoue, votre vote n'est PAS enregistré.",
    online: 'En ligne',
    offline: 'Hors ligne',
    autoSaved: 'Sauvegardé auto.',
    liveElection: 'Élection en Direct',
    voter: 'Électeur',
    votingClosesIn: 'Le vote ferme dans',
    position: 'Poste',
    of: 'sur',
    completed: 'complété',
    reviewing: 'Vérification',
    cannotLoadBallot: 'Impossible de charger le bulletin',
    backBtn: 'Retour',
  },
  voterPicker: {
    title: 'Authentification Sécurisée de l\'Électeur',
    subtitle: 'Sélectionnez votre profil d\'électeur pour commencer. Une session de vote sécurisée sera créée pour vous. Votre session expire dans 30 minutes.',
    demoMode: 'Mode Démonstration',
    demoModeDesc: 'Ceci est une élection de démonstration. En production, les électeurs s\'authentifient via OTP email/SMS ou SSO institutionnel. Ici, vous pouvez choisir n\'importe quel électeur pour simuler l\'expérience.',
    eligibleVoters: 'Électeurs Éligibles',
    noVoters: 'Aucun électeur éligible trouvé pour cette élection.',
    voted: 'A voté',
    backToElection: "Retour à l'Élection",
    sessionStarted: 'Session de vote démarrée pour',
  },
  publicResults: {
    live: 'En Direct',
    certified: 'Certifié',
    completed: 'Terminé',
    published: 'Publié',
    setup: 'Configuration',
    publicResults: 'Résultats Publics',
    verified: 'Vérifié',
    opened: 'Ouvert :',
    closes: 'Ferme :',
    lastVote: 'Dernier vote :',
    timeRemaining: 'Temps Restant',
    votingClosed: 'Vote Fermé',
    viewFullVerification: 'Voir la Vérification Complète',
    share: 'Partager',
    verifyYourVote: 'Vérifier Votre Vote',
    copyLink: 'Copier le Lien',
    verifyReceipt: 'Vérifier le Reçu',
    eligibleVoters: 'Électeurs Inscrits',
    votesCast: 'Votes Exprimés',
    turnout: 'Participation',
    turnoutProgress: 'Progression de la Participation',
    voters: 'électeurs',
    of: 'sur',
    remaining: 'restant',
    lastVoteRecorded: 'Dernier vote enregistré',
    liveCandidateResults: 'Résultats Candidats en Direct',
    updatingLive: 'Mise à jour en direct',
    final: 'Final',
    noPositions: 'Aucun poste configuré pour cette élection.',
    resultsHidden: 'Les résultats sont masqués jusqu\'à la fin du vote.',
    resultsHiddenDesc: 'Affichage de la participation agrégée uniquement. Les résultats par candidat seront publiés une fois que la fenêtre électorale se ferme et que le décompte est certifié.',
    cryptographicVerification: 'Vérification Cryptographique',
    cryptoDesc: 'Chaque élection dans VoteWise produit un paquet de vérification signé. Le hachage d\'audit est un SHA-256 de tous les enregistrements de vote ; la signature d\'intégrité est un HMAC-SHA256 sur le décompte. Les observateurs indépendants peuvent recalculer ceux-ci pour prouver que les résultats publiés correspondent aux bulletins enregistrés.',
    auditHash: 'Hachage d\'Audit (SHA-256)',
    integritySignature: 'Signature d\'Intégrité (HMAC-SHA256)',
    totalVotes: 'Total des Votes',
    verifiedTurnout: 'Participation Vérifiée',
    signatureValid: 'Signature Valide',
    loadingResults: 'Chargement des résultats en direct…',
    couldntLoadResults: 'Impossible de charger les résultats',
    winner: 'Gagnant',
    winners: 'gagnants',
    votes: 'votes',
    noVotesRecorded: 'Aucun vote enregistré pour ce poste pour le moment.',
    copy: 'Copier',
    footerSecurity: 'Chaque vote est chiffré au repos (AES-256-GCM) et enregistré avec un journal d\'audit à chaîne de hachage. Anonymat par reçu — vérifiez la participation, jamais les choix.',
  },
  verification: {
    portalTitle: 'Portail de Vérification Électorale',
    certified: 'Certifié',
    verificationStatus: 'Statut de Vérification',
    verified: 'Vérifié',
    failed: 'Échoué',
    publicResults: 'Résultats Publics',
    backToVoteWise: 'Retour à VoteWise',
    loadingVerification: 'Chargement du paquet de vérification…',
    verificationUnavailable: 'Vérification indisponible',
    verificationUnavailableDesc: 'Le portail de vérification publique n\'est disponible que pour les élections qui ont été officiellement certifiées. Si vous avez un code de reçu, vous pouvez toujours vérifier votre vote individuel ci-dessous.',
    electionVerified: '✓ Cette élection est vérifiée',
    verificationFailed: '✗ Vérification échouée',
    electionVerifiedDesc: 'Toutes les vérifications d\'intégrité ont passé. Les résultats certifiés correspondent aux bulletins enregistrés, la chaîne d\'audit est intacte et la signature d\'intégrité est valide.',
    verificationFailedDesc: 'Une ou plusieurs vérifications d\'intégrité n\'ont pas passé. Examinez les détails ci-dessous avant de faire confiance à ces résultats.',
    auditHash: 'Hachage d\'Audit',
    integritySignature: 'Signature d\'Intégrité',
    totalVotes: 'Total des Votes',
    turnoutPct: 'Participation',
    signatureValid: 'Signature Valide',
    certifiedResults: 'Résultats Certifiés',
    auditChain: 'Chaîne d\'Audit',
    downloadReport: 'Télécharger le Rapport',
    sharePortal: 'Partager le Portail',
  },
  voterStatus: {
    portalTitle: 'Portail de Statut d\'Électeur',
    title: 'Vérifiez Votre',
    titleHighlight: 'Statut d\'Électeur',
    desc: 'Vérifiez votre statut d\'inscription, votre historique de vote et vos reçus.',
    descHighlight: 'Vos choix de vote ne sont jamais révélés.',
    lookUpRecord: 'Recherchez votre dossier',
    identifier: 'Email, téléphone ou ID d\'électeur',
    identifierPlaceholder: 'Saisissez votre email, téléphone ou ID d\'électeur',
    checkStatus: 'Vérifier le Statut',
    checking: 'Vérification…',
    identifierHint: 'Vous pouvez utiliser tout identifiant avec lequel vous vous êtes inscrit — email, numéro de téléphone ou matricule / ID d\'électeur.',
    privacyGuarantees: 'Garanties de Confidentialité',
    whatIsShown: 'Ce qui est affiché',
    whatIsNeverRevealed: 'Ce qui n\'est jamais révélé',
    shownRegistration: 'Votre statut d\'inscription est affiché',
    shownParticipation: 'Votre participation (a voté / n\'a pas voté) est affichée',
    shownReceipts: 'Vos codes de reçu sont affichés (pour que vous puissiez les vérifier)',
    hiddenChoices: 'Vos choix de vote ne sont JAMAIS révélés',
    hiddenIdentity: 'Personne ne peut déterminer pour qui vous avez voté',
    hiddenLinking: 'Votre reçu ne peut pas être lié à votre identité par des tiers',
    recordFound: 'Dossier trouvé',
    voterNotFound: 'Électeur introuvable',
    notFoundDesc: 'Aucun dossier d\'électeur ne correspond à cet identifiant. Veuillez réessayer avec un autre identifiant.',
    suggestions: 'Suggestions',
    suggestion1: 'Vérifiez l\'orthographe et réessayez',
    suggestion2: 'Essayez un autre identifiant (email, téléphone ou ID d\'électeur)',
    suggestion3: 'Si vous vous connectez habituellement par email, essayez votre numéro de téléphone',
    suggestion4: 'Assurez-vous que votre téléphone inclut l\'indicatif pays, ex. +234…',
    suggestion5: 'Contactez le comité électoral de votre organisation si vous pensez que c\'est une erreur',
    lookupsPrivate: 'Les recherches sont privées — aucun historique de votre recherche n\'est conservé.',
    backToHome: 'Retour à l\'accueil',
    elections: 'Élections',
    noElections: 'Aucune élection publiée par cette organisation pour le moment.',
    yourReceipts: 'Vos Reçus',
    recentActivity: 'Activité Récente',
    voted: 'A voté',
    eligibleOpen: 'Éligible — Ouvert Maintenant',
    eligibleUpcoming: 'Éligible — À Venir',
    didNotVote: 'N\'a pas voté',
    pending: 'En attente',
    voteNow: 'Voter Maintenant',
    receipt: 'Reçu',
    recorded: 'Enregistré',
    verify: 'Vérifier',
    verifying: 'Vérification…',
    voteConfirmed: 'Vote confirmé & compté',
    receiptNotFound: 'Reçu introuvable',
    verificationFailed: 'Vérification échouée',
    election: 'Élection',
    position: 'Poste',
  },
  errors: {
    notFound: 'Page introuvable',
    notFoundDesc: "La page que vous recherchez n'existe pas ou a été déplacée.",
    unauthorized: 'Non autorisé',
    unauthorizedDesc: 'Vous devez vous connecter pour accéder à cette page.',
    forbidden: 'Interdit',
    forbiddenDesc: "Vous n'avez pas la permission d'accéder à cette page.",
    serverError: 'Erreur du serveur',
    serverErrorDesc: "Quelque chose s'est mal passé de notre côté. Veuillez réessayer plus tard.",
    goHome: 'Aller à l\'Accueil',
  },
}

// ---------------------------------------------------------------
// YORUBA — complete (with diacritics)
// ---------------------------------------------------------------
const yo: Translations = {
  common: {
    save: 'Fipamọ',
    cancel: 'Nùkúrọ̀',
    delete: 'Pa rẹ́',
    edit: 'Ṣàtúnṣe',
    search: 'Wá',
    filter: 'Yan',
    loading: 'Ń rò…',
    error: 'Àṣìṣe',
    success: 'A ṣaṣeyọrí',
    close: 'Ti',
    back: 'Pada',
    next: 'Tẹ̀síwájú',
    previous: 'Tẹ́lẹ̀',
    submit: 'Firanṣẹ',
    confirm: 'Ẹ̀rí',
    retry: 'Gbiyanju lẹ́ẹkansí',
    refresh: 'Tún',
    copy: 'Da',
    copied: 'A dá',
    share: 'Pín',
    download: 'Gbà sókè',
    yes: 'Bẹ́ẹ̀ni',
    no: 'Bẹ́ẹ̀kọ́',
    all: 'Gbogbo',
    none: 'Kò sí',
    optional: 'àfọmọ́',
    required: 'pátákì',
    theme: 'Àkójọ',
    language: 'Èdè',
  },
  home: {
    heroBadge: 'Ètò Ìṣàkóso Ìdìbò ilẹ̀ Áfíríkà',
    heroTitleLine1: 'Ṣe Ìdìbò Ààrọ̀,',
    heroTitleLine2: 'Ìhòó Tótọ́ & ní Àkókò Gidi',
    heroTitleLine3: 'fún Èyíkéyí Ilé-iṣẹ́.',
    heroSubtitle:
      'Láti ile-ẹ̀kọ́ gíga àti ẹgbẹ́ sí ilé-iṣẹ́, íjá àti àjọ ìjọba, VoteWise ṣe ìrànwọ́ fún ọ láti ṣe ìdìbò olójúgbọ́n nínú ìṣẹ́jú.',
    registerOrg: 'Forúkọsilẹ̀ Ilé-iṣẹ́',
    requestDemo: 'Bèèrè Ìdàánù Alàyọ',
    encryptedVoting: 'Ìdìbò tí a fi ọ̀rọ̀ aṣínà',
    receiptAnchored: 'Ìdánimọ̀ pẹ̀lú ìwé ẹ̀rí',
    fullAuditTrail: 'Igbésẹ̀ àyẹ̀wò kúrú',
    anyOrg: 'Èyíkéyí ilé-iṣẹ́',
    statOrganizations: 'Àwọn Ilé-iṣẹ́',
    statOrgTypes: 'Àwọn Iru Ilé-iṣẹ́',
    statUserRoles: 'Àwọn Ipò Oníṣẹ́',
    trustedTransparent: 'Olójúgbọ́n & Ìhòó Tótọ́',
    trustedTransparentSub: 'Gbogbo ìdìbò leè yẹ̀wò. Gbogbo iṣẹ́ ni a ṣàyẹ̀wò.',
    receiptVerification: 'Ìyẹ̀wò pẹ̀lú Ìwé Ẹ̀rí',
    verifyYourVoteTitle: 'Ẹ̀rín dájú pé ìdìbò rẹ ti',
    verifyYourVoteTitleHighlight: 'wà ní àkósílẹ̀ & wà nínú ìkànnì.',
    verifyYourVoteDesc:
      'Gbogbo olùdìbò ń gba kódù ìwé ẹ̀rí aládàní lẹ́hìn tí wọ́n bá ti dìbò. Tẹ ẹ sítẹ̀ ní ìsàlẹ̀ lái fi ẹ̀rí dájú pé ìdìbò rẹ ti wà ní àkósílẹ̀ — láì ṣàlàyé elétí-èyí-tó-ò-dìbò-fún. Ìyẹn ni ìdánimọ̀ aláìní-ìdánimọ̀ pẹ̀lú ìwé ẹ̀rí.',
    ballotSecrecy: 'Ìpamọ́ Ìdìbò.',
    ballotSecrecyDesc: 'Ìyàn rẹ ni a fi ọ̀rọ̀ aṣínà pọ́; — ẹ̀yín ìwé ẹ̀rí ni a le yẹ̀wò.',
    receiptAnchoredLabel: 'Pẹ̀lú ìwé ẹ̀rí.',
    receiptAnchoredDesc: 'Fi ẹ̀rí dájú pé ọ ti dìbò láì ṣàlàyé bawo.',
    tamperEvident: 'Aláṣeyọrí-àbájáde.',
    tamperEvidentDesc: 'Igbésẹ̀ àyẹ̀wò àdákọ́-hash ń rí àyípadà kúrò bí ó bá wà, níbití ó bá wà.',
    checkYourReceipt: 'Yẹ̀wò Ìwé Ẹ̀rí Rẹ',
    receiptCode: 'Kódù ìwé ẹ̀rí',
    receiptCodeFormat: 'Àkópọ̀: VW-YYYY-XXXXXXXX. Wá á nínú ibò rẹ ìjápọ̀ tàbí ìmẹ̀lì.',
    verifyReceipt: 'Yẹ̀wò Ìwé Ẹ̀rí',
    voteConfirmed: 'Ìdìbò ti fi ẹ̀rí dájú & wà nínú ìkànnì',
    receiptNotFound: 'A kò rí ìwé ẹ̀rí',
    needFullView: 'Ṣé o fẹ́ àyẹ̀wò kún?',
    openFullPage: 'Ṣí ojú-ewé kún',
    trustAudit: 'Igbésẹ̀ Àyẹ̀wò Láti-ìbẹ̀rẹ̀-sí-ìparí',
    trustLiveDashboard: 'Páńẹ́lì Àwọn Ìdìbò ní Àkókò Gidi',
    trustMFA: 'Ìdánimọ̀ Pẹ̀lú Ọ̀pọ̀-Ìdánimọ̀',
    trustOTP: 'Ìdìbò pẹ̀lú Ìdánimọ̀ OTP',
    trustWhiteLabel: 'Pọ́tálì Àkọlé-Fúnra-rẹ',
    trustMonitoring: 'Àkíyèsí Àkókò Gidi',
    trustSecurity: 'Ààbọ̀ Ilé-iṣẹ́',
    statOrgsCount: 'Àwọn Ilé-iṣẹ́',
    statElectionsHosted: 'Àwọn Ìdìbò A ṣe',
    statVotesCast: 'Àwọn Ìdìbò A ti Kà',
    statUptime: 'Àkókò-Àjọ̀ Páńẹ́lì',
    howBadge: 'Ìgbésẹ̀ 4 Rọrẹn',
    howTitle: 'Bí VoteWise Ṣe ń Ṣiṣẹ́',
    howSubtitle: 'Láti forúkọsílẹ̀ sí ìdìbò alàyọ nínú ìṣẹ́jú.',
    howStep1Title: '1. Ṣẹ̀dá Ilé-iṣẹ́',
    howStep1Desc: 'Forúkọsilẹ̀ ilé-iṣẹ́ rẹ, yan orúkọ-ìsàlẹ̀-àkójọ, kí o sì ṣètò àmì níbí ìṣẹ́jú márùn-ún.',
    howStep2Title: '2. Ṣètò Ìdìbò',
    howStep2Desc: 'Ṣẹ̀dá ìdìbò, ṣàfikún àwọn ipò àti àwọn olùdíje, ṣètò àsìkò ìdìbò.',
    howStep3Title: '3. Pe Àwọn Olùdìbò',
    howStep3Desc: 'Gba àkójọ olùdìbò rẹ wá pẹ̀lú CSV tàbí ìforúkọsílẹ̀ ọwọ́. Àwọn páápáá tún-fúnra-rẹ ń ṣe àdàtúró fún irú ilé-iṣẹ́ rẹ.',
    howStep4Title: '4. Bẹ́ẹ̀ni-kíkún',
    howStep4Desc: 'Nígbà tí gbogbo àyẹ̀wò ṣetàn bá jáde, tẹ Bẹ́ẹ̀ni-kíkún. Ìdìbò rẹ yóò ṣí fún ìdìbò lẹ́sẹ̀kẹsẹ̀.',
    orgsBuiltForAny: 'A ṣe fún Èyíkéyí Ilé-iṣẹ́',
    orgsTitle: 'Ètò kò mọ̀ tàbí kò ní lọ́kàn ní ìyípadà bawo ni wọ́n ṣe wà.',
    orgsSubtitle: 'Wọ́n jẹ́ gbogbo Àwọn Ilé-iṣẹ́ nìkan. VoteWise ń ṣiṣẹ́ fún gbogbo wọn.',
    orgsAllOrgs: 'Àwọn Ilé-iṣẹ́',
    productsBadge: 'Àwọn Ẹ̀yà-ara Mẹ́ta',
    productsTitle: 'Páńẹ́lì VoteWise',
    productsSubtitle: 'Àwọn ẹ̀yà-ara mẹ́ta yàtọ̀, páńẹ́lì ọ̀kan olójúgbọ́n. Ìyàsọ́tọ̀ tótọ́ ti àkíyèsí.',
    featuresBadge: 'Àwọn Àbájáde Páńẹ́lì',
    featuresTitle: 'Gbogbo nǹkan tí o nílò láti ṣe Ìdìbò Ààrọ̀',
    featuresSubtitle: 'Àkójọpọ̀ ìṣàkóso ìdìbò kún — láti forúkọsílẹ̀ olùdìbò sí àwọn èsì tí a ti fi ẹ̀rí dájú.',
    hierarchyBadge: 'Ìyípadà Tó Tóbi Jùlo Nínú Àpò',
    hierarchyTitle: 'Ìdàlọ́pọ̀ Gbogbo-agbaye',
    hierarchySubtitle:
      'Kì í ṣe Ile-ẹ̀kọ́ gíga → Ẹ̀ka → Ẹ̀ka-ìkẹ́kọ̀ọ́ → Akẹ́kọ̀ọ́ → Ìdìbò. Èyí ṣiṣẹ́ fún irú ilé-iṣẹ́ ọ̀kan nìkan. VoteWise ń lo ìdàlọ́pọ̀ aládàní tí ó ń ṣiṣẹ́ fún gbogbo ilé-iṣẹ́.',
    hierarchyNote:
      'Ìyípadà yìí ọ̀kan ṣoṣo ni ó ń ṣe páńẹ́lì náà ní gbogbo-agbaye. Ile-ẹ̀kọ́ gíga ń ṣètò orúkọ rẹ̀ gẹ́gẹ́ bí Ilé-iṣẹ́=Ile-ẹ̀kọ́ gíga, Ààyè=Ẹ̀ka, Ẹgbẹ́ Olùdìbò=Ẹ̀ka-ìkẹ́kọ̀ọ́. Ìjà ń ṣètò Ilé-iṣẹ́=Ìjọ, Ààyè=Paríṣì, Ẹgbẹ́ Olùdìbò=Ẹgbẹ́ Àjọyọ̀. Ètò ń ṣe wọ́n gẹ́gẹ́ bí ọ̀kan.',
    rolesBadge: 'Àwọn Ipò Oníṣẹ́ Mẹ́fà',
    rolesTitle: 'Gẹ́gẹ́bí Mẹ́fà. Kì í ṣe Ọgọ́rùn-ún. Kì í ṣe Àádọ́ta.',
    rolesSubtitle: 'Gbogbo ènìyàn lórí VoteWise ń bá ìkan nínú àwọn ẹ̀yà-ìpò mẹ́fà yìí mu. Ìyànda tótọ́, ààlà tótọ́.',
    rolesCan: 'Le',
    rolesCannot: 'Kò le',
    principlesBadge: 'Àwọn Ìmọ̀ràn Páńẹ́lì Mẹ́fà',
    principlesTitle: 'Gbogbo Àbájáde Gbọ́dọ̀ Bá Ìyẹn Mu',
    principlesSubtitle: 'Tí ìpinnu ìdàrò kò bá le dáhùn « Ṣé èyí le ṣiṣẹ́ fún Èyíkéyí Ilé-iṣẹ́? » pẹ̀lú bẹ́ẹ̀ni, a kò ń ṣẹ́ ẹ.',
    securityBadge: 'Ààbọ̀ Kíkún',
    securityTitle: 'A ṣe Fún Ìgbàgbọ́',
    securitySubtitle: 'Gbogbo iṣẹ́ ń ṣàgbéjáde igbésẹ̀ àyẹ̀wò. Gbogbo ìdìbò ni a fi ọ̀rọ̀ aṣínà. Gbogbo èsì ni a le yẹ̀wò.',
    pricingBadge: 'Owó Ìyá Rọrẹn',
    pricingTitle: 'Sàn Nìkan Fún Èyí-tó-ò-Lò',
    pricingSubtitle: 'Bẹ̀rẹ̀ lọ́fẹ̀ẹ́. Sàn láti bẹ́ẹ̀ni-kíkún. Kò sí owó tó pamọ́. Ìbájẹ́ wà fún àwọn ilé-iṣẹ́ tó tóbi.',
    pricingMostPopular: 'Tó Wọ́pọ̀ Jù',
    testimonialsBadge: 'Àwọn Ẹ̀rí',
    testimonialsTitle: 'Àwọn Ilé-iṣẹ́ Gbàgbọ́ Ní Áfíríkà',
    testimonialsSubtitle: 'Láti àwọn ẹgbẹ́ alámọ̀dájú sí àwọn ilé-ẹ̀kọ́ gíga — àwọn ilé-iṣẹ́ ń ṣe àwọn ìdìbò wọn lórí VoteWise.',
    orgsDirectoryBadge: 'Àtìjọ Alàyọ',
    orgsDirectoryTitle: 'Àwọn Ilé-iṣẹ́ Lórí VoteWise',
    orgsDirectorySubtitle: 'Àwọn ilé-iṣẹ́ gidi tó ń ṣe àwọn ìdìbò wọn tẹ́lẹ̀ lórí VoteWise.',
    demoBadge: 'Ìbèèrè Ìdàánù',
    demoTitle: 'Bèèrè Ìdàánù Tó Dá Lórí Rẹ',
    demoSubtitle: 'Sọ fún wa nípa ilé-iṣẹ́ rẹ, ẹgbẹ́ wa yóò ṣẹ̀dá ìdàánù nínú wákàtí mẹ́rìnlélógún.',
    demoContactPerson: 'Eni-tó-ń-bá-ẹ̀rín-sọ̀rọ̀',
    demoEmail: 'Ìmẹ̀lì',
    demoPhone: 'Fọ́nù',
    demoOrgType: 'Iru Ilé-iṣẹ́',
    demoOrgName: 'Orúkọ Ilé-iṣẹ́',
    demoEstimatedVoters: 'Iye Àwọn Olùdìbò',
    demoPreferredDate: 'Déètì Tó Fẹ́ràn',
    demoMessage: 'Ìfiranṣẹ (àfọmọ́)',
    demoRequestBtn: 'Bèèrè Ìdàánù',
    demoSending: 'Ń firanṣẹ…',
    demoNoCommitment: 'Kò sí ìbájẹ́ pátákì. A kò ní pín àwọn àlàyé rẹ.',
    liveDemoBadge: 'Ìdàánù Alàyọ',
    liveDemoTitle: 'Wò ó Nínú Ìṣe',
    liveDemoSubtitle: 'Wá àkójọ ìdìbò ìdàánù alàyọ pẹ̀lú àwọn ìdìbò ọ̀rọ̀ aṣínà gidi, àwọn èsì alàyọ, àti ìrìn-àjò olùdìbò kún. Kò sí forúkọsílẹ̀ pátákì.',
    tryVoterJourney: 'Gbiyanju ìrìn-àjò olùdìbò',
    tryVotingNow: 'Gbiyanju Ìdìbò Báyìí',
    about: 'Nípa',
    guide: 'Ìtọ́ni',
    viewPublicResults: 'Wo àwọn èsì gbogbo-ènìyàn',
    viewLiveResults: 'Wo Àwọn Ìdìbò Alàyọ',
    docsBadge: 'Ìwé-àkọsilẹ̀',
    docsTitle: 'Kà Àwọn Ìwé-àkọsilẹ̀',
    docsSubtitle: 'Gbogbo nǹkan tí o nílò láti yé, láti gbàgbọ́, àti láti lo VoteWise — fún àwọn olùdìbò, àwọn alákóso, àti àwọn alàyẹ̀wò.',
    readMore: 'Kà síwájú',
    contactBadge: 'Kán-àrí',
    contactTitle: 'Kán-àrí Wa',
    contactSubtitle: 'Ìbéèrè? Ìdàpọ̀? Ìróyìn? A ń retí láti gbọ́ ti rẹ.',
    contactName: 'Orúkọ Rẹ',
    contactOrgOptional: 'Ilé-iṣẹ́ (àfọmọ́)',
    contactMessage: 'Ìfiranṣẹ',
    contactSend: 'Firanṣẹ Ìfiranṣẹ',
    contactSending: 'Ń firanṣẹ…',
    signupBadge: 'Ìbẹ̀rẹ̀ Rọrẹn',
    signupTitle: 'Ṣètò Ìdìbò Rẹ Nínú Ìṣẹ́jú Márùn-ún Kéré Jù',
    signupSubtitle: 'Forúkọsilẹ̀ ilé-iṣẹ́ rẹ, ṣètò orúkọ rẹ, kí o sì bẹ́ẹ̀ni-kíkún àkọ́kọ́ ìdìbò rẹ. Kò ní ìmọ̀-ẹ̀rọ pátákì. Kò sí ìṣòro tó pamọ́.',
    signupFeature1: 'Ó ń ṣiṣẹ́ fún èyíkéyí irú ilé-iṣẹ́',
    signupFeature2: 'Ṣètò orúkọ rẹ̀ (Ẹ̀ka / Ẹ̀ka / Paríṣì / Àpàn)',
    signupFeature3: 'Àmì àdàkọ pẹ̀lú lọ́gò àti àwọ̀ rẹ',
    signupFeature4: 'Sàn nìkan nígbà tí o bá ń bẹ́ẹ̀ni-kíkún',
    registerYourOrg: 'Forúkọsilẹ̀ Ilé-iṣẹ́ Rẹ',
    verifyElectionBadge: 'Pọ́tálì Ìyẹ̀wò Gbogbo-Ènìyàn',
    verifyElectionTitle: 'Yẹ̀wò Ìdìbò',
    verifyElectionTitleHighlight: 'kún.',
    verifyElectionDesc:
      'Ènìyàn kọ̀ọ̀kan — àwọn olùdìbò, àwọn oníṣẹ́ ìróyìn, àwọn alàyẹ̀wò, àwọn aláboyún — le yẹ̀wò ààbọ̀ Ìdìbò VoteWise tí a ti fi ẹ̀rí dájú ní òmínira. Yẹ̀wò hash àyẹ̀wò, rìn lórí igbésẹ̀ àyẹ̀wò àdákọ́-hash, kí o sì fi ẹ̀rí dájú síínì-ìdásílẹ̀-ìdápọ̀. Tí nǹkan bá ti yípadà, pọ́tálì yóò sọ fún ọ.',
    verifyElectionCertified: 'Àyẹ̀wò nìkan.',
    verifyElectionCertifiedDesc: 'Àwọn pọ́tálì ìyẹ̀wò wà nìkan lẹ́hìn tí ẹgbẹ́ ìdìbò ti fi ẹ̀rí dájú àwọn èsì.',
    verifyElectionCrypto: 'Kriptográfí.',
    verifyElectionCryptoDesc: 'Tún hash àyẹ̀wò SHA-256 ṣe kí o sì yẹ̀wò síínì HMAC-SHA256 fúnra rẹ.',
    verifyElectionTamper: 'Aláṣeyọrí-àbájáde.',
    verifyElectionTamperDesc: 'Igbésẹ̀ àyẹ̀wò àdákọ́-hash ń rí àyípadà kúrò — níbití ó bá wà, nígbakugba.',
    openVerificationPortal: 'Ṣí Pọ́tálì Ìyẹ̀wò',
    electionIdOrUrl: 'ID Ìdìbò tàbí URL',
    electionIdPlaceholder: 'Dà ID ìdìbò tàbí asopọ̀ /verify/… sítẹ̀',
    electionIdHint: 'Gba ID ìdìbò, URL /verify/<id>, tàbí URL /results/<id>.',
    openPortalBtn: 'Ṣí Pọ́tálì Ìyẹ̀wò',
    dontHaveId: 'Ṣé o kò ní ID?',
    askOrganizers: 'Bèèrè asopọ̀ ìyẹ̀wò lọ́wọ́ àwọn alákóso ìdìbò.',
    voterStatusBadge: 'Ìránṣẹ́-Fúnra-Olùdìbò',
    voterStatusTitle: 'Yẹ̀wò',
    voterStatusTitleHighlight: 'ipò olùdìbò rẹ.',
    voterStatusDesc:
      'Tẹ ìmẹ̀lì, fọ́nù, tàbí ID olùdìbò rẹ, a ó sì fi ẹ̀rí ìforúkọsílẹ̀ rẹ, àwọn ìdìbò tí o lè dìbò fún, àwọn ìwé ẹ̀rí tí o ní, àti àkójọ àṣeyẹ̀wò àkókò tó kẹ́yìn hánnu — láì ṣàlàyé bí o ti dìbò rí. Kárí-ilé-iṣẹ́: ìwádìí ọ̀kan, gbogbo ilé-iṣẹ́ tí o ti forúkọsílẹ̀.',
    voterStatusRegistration: 'Ipò Ìforúkọsílẹ̀.',
    voterStatusRegistrationDesc: 'Ẹ̀rín dájú pé o wà ní Àṣẹ-dáko àti pé a ti fi ẹ̀rí dájú kárí gbogbo àwọn ilé-iṣẹ́ tí o ti forúkọsílẹ̀.',
    voterStatusParticipation: 'Àkójọ Ìdípartí.',
    voterStatusParticipationDesc: 'Wá àwọn ìdìbò tí o ti dìbò, àwọn tí ó ń ṣẹlẹ̀, àti àwọn tí ó ń bọ̀ — pẹ̀lú bọ́tínì « Dìbò Báyìí ».',
    voterStatusSecrecy: 'Ìdájú Ìpamọ́ Ìdìbò.',
    voterStatusSecrecyDesc: 'Àwọn kódù ìwé ẹ̀rí ń fi ẹ̀rí dájú pé a ti kà ìdìbò rẹ, ṣùgbọ́n kò le sọ elétí-èyí-tó-ò-yàn.',
    voterStatusHashing: 'Hashing-ìkọ̀-ọ̀kan.',
    voterStatusHashingDesc: 'Hash olùdìbò rẹ ni a fi ọ̀rọ̀ aṣínà-ìkọ̀-ọ̀kan — ẹnìkẹ́ni kò le so ìwé ẹ̀rí pọ̀ mọ́ ìdánimọ̀ rẹ padà.',
    whatYouWillSee: 'Àwọn nǹkan tí o ó rí',
    checkVoterStatus: 'Yẹ̀wò Ipò Olùdìbò',
    dontHaveVoterId: 'Ṣé o kò ní ID olùdìbò rẹ?',
    useEmailOrPhone: 'Lo ìmẹ̀lì tàbí fọ́nù ìforúkọsílẹ̀ rẹ báyìí.',
    identifierEmail: 'Ìmẹ̀lì',
    identifierPhone: 'Fọ́nù',
    identifierVoterId: 'ID Olùdìbò / Mátírìkù',
    identifierAny: 'Èyíkéyìí ìdánimọ̀',
  },
  auth: {
    login: 'Wọ̀',
    register: 'Forúkọsílẹ̀',
    logout: 'Jáde',
    sessionExpired: 'Àkókò ìbẹ̀rẹ̀ ti parí. Jọ̀wọ́ wọ̀ báyìí.',
    orgLogin: 'Wọ̀ Ilé-iṣẹ́',
    registerOrg: 'Forúkọsilẹ̀ Ilé-iṣẹ́',
    myDashboard: 'Páńẹ́lì Mi',
    dashboard: 'Páńẹ́lì',
    organizationPortal: 'Pọ́tálì Ilé-iṣẹ́',
    signIn: 'Wọ̀',
    signUp: 'Forúkọsílẹ̀',
    email: 'Ìmẹ̀lì',
    password: 'Ọ̀rọ̀-ìjínà',
    forgotPassword: 'Gbagbọ́ ọ̀rọ̀-ìjínà?',
    welcomeBack: 'Ká bọ̀',
    createAccount: 'Ṣẹ̀dá àkántì',
  },
  workspace: {
    dashboard: 'Páńẹ́lì',
    elections: 'Àwọn Ìdìbò',
    voters: 'Àwọn Olùdìbò',
    candidates: 'Àwọn Olùdíje',
    settings: 'Ètò',
    overview: 'Àkójọpọ̀',
    reports: 'Àwọn Ìroyìn',
    notifications: 'Àwọn Ìfìníràn',
    audit: 'Àyẹ̀wò',
    observers: 'Àwọn Alàyẹ̀wò',
    exports: 'Àwọn Ìjáde',
  },
  election: {
    overview: 'Àkójọpọ̀',
    positions: 'Àwọn Ipò',
    voting: 'Ìdìbò',
    results: 'Àwọn Èsì',
    audit: 'Àyẹ̀wò',
    reports: 'Àwọn Ìroyìn',
    notifications: 'Àwọn Ìfìníràn',
    status: 'Ipò',
    statusDraft: 'Àkọkọ́-kọ̀wé',
    statusPublished: 'A ti tẹ̀ jáde',
    statusAccreditation: 'Ìdánimọ̀',
    statusVoting: 'Ìdìbò Tì Ṣí',
    statusClosed: 'Ìdìbò Tì Ti',
    statusCertified: 'A ti fi ẹ̀rí dájú',
    votingOpensIn: 'Ìdìbò yóò ṣí nínú',
    votingClosesIn: 'Ìdìbò yóò ti nínú',
    votingEnded: 'Ìdìbò ti parí',
    turnout: 'Iye àwọn tí ó dìbò',
    votesCast: 'Àwọn Ìdìbò A Kà',
    eligibleVoters: 'Àwọn Olùdìbò Tó Lè Dìbò',
    timeRemaining: 'Àkókò Tó Kù',
  },
  voting: {
    ballot: 'Káàdì-ìdìbò',
    castVote: 'Fi Ìdìbò Sì',
    receipt: 'Ìwé Ẹ̀rí',
    verify: 'Yẹ̀wò',
    review: 'Yẹ̀wò-àrín',
    confirm: 'Ẹ̀rí',
    reviewYourVote: 'Yẹ̀wò Ìdìbò Rẹ',
    submitVote: 'Firanṣẹ Ìdìbò',
    confirmAndSubmit: 'Ẹ̀rí & Firanṣẹ',
    finalConfirmation: 'Ẹ̀rí Kẹ́yìn',
    finalConfirmationDesc: 'Ó ń bá ọ ṣẹ́ láti fi ìdìbò rẹ ranṣẹ. Iṣẹ́ yìí kò le padà sẹ́yìn. Káàdì-ìdìbò rẹ yóò wà ní ìpamọ́ àti ní àkósílẹ̀ láé-láé.',
    summary: 'Àkójọpọ̀:',
    voteRecorded: 'A ti Fi Ìdìbò Rẹ Sí Àkósílẹ̀ Pẹ̀lú Ìṣaṣeyọrí',
    voteRecordedDesc: 'A ti fi ọ̀rọ̀ aṣínà sọ́ ìdìbò rẹ, a ti sì gba á sí àkósílẹ̀ àti ṣàyẹ̀wò rẹ̀. Fi àwọn nọ́ḿbà ìwé ẹ̀rí rẹ pamọ́ ní ìsàlẹ̀ láti le yẹ̀wò ìdípartí rẹ lẹ́hìn.',
    verifyReceipt: 'Yẹ̀wò Ìwé Ẹ̀rí',
    receiptCopied: 'A ti dá ìwé ẹ̀rí sí itọ́-kọ̀pì',
    receiptVerified: 'A ti yẹ̀wò Ìwé Ẹ̀rí',
    verificationFailed: 'Ìyẹ̀wò Kò ṣaṣeyọrí',
    ballotSecrecyProtected: 'Ìdájú Ìpamọ́ Káàdì-ìdìbò',
    ballotSecrecyDesc: 'Ìwé ẹ̀rí rẹ ń fi ẹ̀rí dájú ìdípartí — kì í ṣe àwọn ìyàn olùdíje. Ẹnìkeji kò le sọ elétí-tó-ò-dìbò-fún, bóyá àwọn alákóso ìdàsílẹ̀-dátà.',
    backToElection: 'Pada Sí Ìdìbò',
    chooseOne: 'Yan 1',
    chooseN: 'Yan',
    clear: 'Pa rẹ́',
    change: 'Yípadà',
    noneOfTheAbove: 'Kò-sí-ẹni-nínú-àwọn-wọ̀nyí',
    noneOfTheAboveDesc: 'Mi kò dìbò fún ẹni-kẹ́yìn nínú àwọn olùdíje wọ̀nyí',
    readManifesto: 'Kà mànífésì',
    hideManifesto: 'Pa mànífésì',
    manifesto: 'Mànífésì',
    allPositionsCompleted: 'A ti parí gbogbo àwọn ipò',
    generatingBallot: 'Ń ṣẹ̀dá káàdì-ìdìbò ààrọ̀ rẹ…',
    generatingBallotSub: 'Ń yẹ̀wò ìyẹ̀wù, ìdánimọ̀, àti àwọn òfin ìdìbò.',
    encrypting: 'Ń fi ọ̀rọ̀ aṣínà sọ ìdìbò rẹ àti ń gba á sí àkósílẹ̀…',
    encryptingSub: 'Ń ṣiṣẹ́ pipeline-àyẹ̀wò ìgbésẹ̀ mẹ́jọ. Iṣẹ́-ìbílẹ̀ — tí nǹkan bá kùnà, ìdìbò rẹ kò wà ní àkósílẹ̀.',
    online: 'Lórí àsopọ̀',
    offline: 'Láìsí àsopọ̀',
    autoSaved: 'A ti fi pamọ́',
    liveElection: 'Ìdìbò Alàyọ',
    voter: 'Olùdìbò',
    votingClosesIn: 'Ìdìbò yóò ti nínú',
    position: 'Ipò',
    of: 'nínú',
    completed: 'a ti parí',
    reviewing: 'Ń yẹ̀wò-àrín',
    cannotLoadBallot: 'Kò le gbé káàdì-ìdìbò wá',
    backBtn: 'Pada',
  },
  voterPicker: {
    title: 'Ìdánimọ̀ Olùdìbò Ààrọ̀',
    subtitle: 'Yan àkọlé olùdìbò rẹ láti bẹ̀rẹ̀. A ó ṣẹ̀dá àkókò ìdìbò ààrọ̀ fún ọ. Àkókò rẹ ó máa parí nínú ìṣẹ́jú àádọ́ta.',
    demoMode: 'Àkòpọ̀ Ìdàánù',
    demoModeDesc: 'Èyí ni ìdìbò ìdàánù. Nínú iṣẹ́-àkànṣe, àwọn olùdìbò ń ṣàpẹ̀rẹ̀ pẹ̀lú OTP ìmẹ̀lì/SMS tàbí SSO ilé-ẹ̀kọ́. Níhìn-ín, o le yan ẹnìkejì olùdìbò láti ṣe àwárí ìrírí.',
    eligibleVoters: 'Àwọn Olùdìbò Tó Lè Dìbò',
    noVoters: 'A kò rí olùdìbò tó lè dìbò fún ìdìbò yìí.',
    voted: 'A ti dìbò',
    backToElection: 'Pada Sí Ìdìbò',
    sessionStarted: 'A ti bẹ̀rẹ̀ àkókò ìdìbò fún',
  },
  publicResults: {
    live: 'Alàyọ',
    certified: 'A ti fi ẹ̀rí dájú',
    completed: 'A ti parí',
    published: 'A ti tẹ̀ jáde',
    setup: 'Ètò',
    publicResults: 'Àwọn Èsì Gbogbo-Ènìyàn',
    verified: 'A ti yẹ̀wò',
    opened: 'A ti ṣí:',
    closes: 'Yóò ti:',
    lastVote: 'Ìdìbò tó kẹ́yìn:',
    timeRemaining: 'Àkókò Tó Kù',
    votingClosed: 'Ìdìbò Tì Ti',
    viewFullVerification: 'Wo Ìyẹ̀wò Kún',
    share: 'Pín',
    verifyYourVote: 'Yẹ̀wò Ìdìbò Rẹ',
    copyLink: 'Da Àsopọ̀',
    verifyReceipt: 'Yẹ̀wò Ìwé Ẹ̀rí',
    eligibleVoters: 'Àwọn Olùdìbò Tó Lè Dìbò',
    votesCast: 'Àwọn Ìdìbò A Kà',
    turnout: 'Iye àwọn tí ó dìbò',
    turnoutProgress: 'Ìlọsíwájú Ìdípartí',
    voters: 'àwọn olùdìbò',
    of: 'nínú',
    remaining: 'tó kù',
    lastVoteRecorded: 'Ìdìbò tó kẹ́yìn a ti gba sí àkósílẹ̀',
    liveCandidateResults: 'Àwọn Èsì Olùdíje Alàyọ',
    updatingLive: 'Ń yípadà lórí ìgbà',
    final: 'Ìparí',
    noPositions: 'A kò ṣètò ipò fún ìdìbò yìí.',
    resultsHidden: 'Àwọn èsì wà ní ìpamọ́ títí ìdìbò ó fi máa ti.',
    resultsHiddenDesc: 'Ń ṣàfihàn ìdípartí pọ̀ nìkan. Àwọn èsì olùdíje yóò máa jáde lẹ́hìn tí àsìkò ìdìbò bá ti parí àti pé a ti fi ẹ̀rí dájú ìkànnì.',
    cryptographicVerification: 'Ìyẹ̀wò Kriptográfí',
    cryptoDesc: 'Gbogbo ìdìbò nínú VoteWise ń ṣàgbéjáde àkójọ ìyẹ̀wò tó jẹ́ ẹ̀rí. Hash àyẹ̀wò jẹ́ SHA-256 gbogbo àwọn ìgbé-kò-lé; síínì-ìdásílẹ̀-ìdápọ̀ jẹ́ HMAC-SHA256 lórí ìkànnì. Àwọn alàyẹ̀wò-òmìnira le tún wọ́n ṣe láti fi ẹ̀rí dájú pé àwọn èsì tó jáde bá àwọn káàdì-ìdìbò tó wà ní àkósílẹ̀ mu.',
    auditHash: 'Hash Àyẹ̀wò (SHA-256)',
    integritySignature: 'Síínì Ìdásílẹ̀ Ìdápọ̀ (HMAC-SHA256)',
    totalVotes: 'Gbogbo Ìdìbò',
    verifiedTurnout: 'Ìdípartí A ti yẹ̀wò',
    signatureValid: 'Síínì Tótọ́',
    loadingResults: 'Ń gbé àwọn èsì alàyọ wá…',
    couldntLoadResults: 'Kò le gbé àwọn èsì wá',
    winner: 'Olùjàbọ̀',
    winners: 'àwọn olùjàbọ̀',
    votes: 'àwọn ìdìbò',
    noVotesRecorded: 'A kò tìí kà ìdìbò fún ipò yìí.',
    copy: 'Da',
    footerSecurity: 'Gbogbo ìdìbò wà ní ìpamọ́ ọ̀rọ̀ aṣínà (AES-256-GCM) àti ní àkósílẹ̀ pẹ̀lú igbésẹ̀ àyẹ̀wò àdákọ́-hash. Ìdánimọ̀ aláìní-ìdánimọ̀ pẹ̀lú ìwé ẹ̀rí — yẹ̀wò ìdípartí, kì í ṣe àwọn ìyàn.',
  },
  verification: {
    portalTitle: 'Pọ́tálì Ìyẹ̀wò Ìdìbò',
    certified: 'A ti fi ẹ̀rí dájú',
    verificationStatus: 'Ipò Ìyẹ̀wò',
    verified: 'A ti yẹ̀wò',
    failed: 'Kò ṣaṣeyọrí',
    publicResults: 'Àwọn Èsì Gbogbo-Ènìyàn',
    backToVoteWise: 'Pada Sí VoteWise',
    loadingVerification: 'Ń gbé àkójọ ìyẹ̀wò wá…',
    verificationUnavailable: 'Ìyẹ̀wò kò sí',
    verificationUnavailableDesc: 'Pọ́tálì ìyẹ̀wò gbogbo-ènìyàn wà nìkan fún àwọn ìdìbò tó ti gba ìdájú ẹ̀rí káríayé. Tí o bá ní kódù ìwé ẹ̀rí, o le tún yẹ̀wò ìdìbò rẹ̀ ní ìsàlẹ̀.',
    electionVerified: '✓ A ti yẹ̀wò ìdìbò yìí',
    verificationFailed: '✗ Ìyẹ̀wò kò ṣaṣeyọrí',
    electionVerifiedDesc: 'Gbogbo àwọn àyẹ̀wò ìdásílẹ̀-ìdápọ̀ ti jáde. Àwọn èsì tó ń bá àwọn káàdì-ìdìbò tó wà ní àkósílẹ̀ mu, àdákọ́ àyẹ̀wò wà ní ìdásílẹ̀, àti síínì-ìdásílẹ̀-ìdápọ̀ tótọ́.',
    verificationFailedDesc: 'Ọ̀kan tàbí ju àwọn àyẹ̀wò ìdásílẹ̀-ìdápọ̀ lọ kò jáde. Yẹ̀wò àwọn àlàyé ní ìsàlẹ̀ ṣáájú kí o tó gbàgbọ́ nínú àwọn èsì wọ̀nyí.',
    auditHash: 'Hash Àyẹ̀wò',
    integritySignature: 'Síínì Ìdásílẹ̀ Ìdápọ̀',
    totalVotes: 'Gbogbo Ìdìbò',
    turnoutPct: 'Ìdípartí',
    signatureValid: 'Síínì Tótọ́',
    certifiedResults: 'Àwọn Èsì A ti fi ẹ̀rí dájú',
    auditChain: 'Àdákọ́ Àyẹ̀wò',
    downloadReport: 'Gbà Ìroyìn Sókè',
    sharePortal: 'Pín Pọ́tálì',
  },
  voterStatus: {
    portalTitle: 'Pọ́tálì Ipò Olùdìbò',
    title: 'Yẹ̀wò',
    titleHighlight: 'Ipò Olùdìbò Rẹ',
    desc: 'Yẹ̀wò ipò ìforúkọsílẹ̀ rẹ, àkójọ ìdìbò rẹ, àti àwọn ìwé ẹ̀rí rẹ.',
    descHighlight: 'A kò ní ṣàfihàn àwọn ìyàn ìdìbò rẹ rárá.',
    lookUpRecord: 'Wá àkósílẹ̀ rẹ',
    identifier: 'Ìmẹ̀lì, fọ́nù, tàbí ID olùdìbò',
    identifierPlaceholder: 'Tẹ ìmẹ̀lì, fọ́nù, tàbí ID olùdìbò rẹ',
    checkStatus: 'Yẹ̀wò Ipò',
    checking: 'Ń yẹ̀wò…',
    identifierHint: 'O le lo èyíkéyìí ìdánimọ̀ tí o fi forúkọsílẹ̀ — ìmẹ̀lì, nọ́ḿbà fọ́nù, tàbí mátírìkù / ID olùdìbò.',
    privacyGuarantees: 'Àwọn Ìdájú Ìkọ́kọ́',
    whatIsShown: 'Àwọn nǹkan a ń fìhàn',
    whatIsNeverRevealed: 'Àwọn nǹkan a kò ní ṣàfihàn rárá',
    shownRegistration: 'A ń fìhàn ipò ìforúkọsílẹ̀ rẹ',
    shownParticipation: 'A ń fìhàn ìdípartí rẹ (dìbò / kò dìbò)',
    shownReceipts: 'A ń fìhàn àwọn kódù ìwé ẹ̀rí rẹ (kí o le yẹ̀wò wọn)',
    hiddenChoices: 'A kò ní ṣàfihàn àwọn ìyàn ìdìbò rẹ RÁRÁ',
    hiddenIdentity: 'Ẹnìkejì kò le sọ elétí-tó-ò-dìbò-fún',
    hiddenLinking: 'Ìwé ẹ̀rí rẹ kò le so pọ̀ mọ́ ìdánimọ̀ rẹ nípa àwọn ẹgbẹ́-kẹ́yìn',
    recordFound: 'A ti rí àkósílẹ̀',
    voterNotFound: 'A kò rí olùdìbò',
    notFoundDesc: 'Kò sí àkósílẹ̀ olùdìbò tó bá ìdánimọ̀ yìí mu. Jọ̀wọ́ gbiyanju pẹ̀lú ìdánimọ̀ míràn.',
    suggestions: 'Àwọn ìmọ̀ràn',
    suggestion1: 'Yẹ̀wò òdìkè sí o kí o tún gbiyanju',
    suggestion2: 'Gbiyanju ìdánimọ̀ míràn (ìmẹ̀lì, fọ́nù, tàbí ID olùdìbò)',
    suggestion3: 'Tí o bá ń wọ̀ pẹ̀lú ìmẹ̀lì, gbiyanju nọ́ḿbà fọ́nù rẹ báyìí',
    suggestion4: 'Rí ìdájú pé fọ́nù rẹ ní kódù orílẹ̀-èdè, àpẹẹrẹ +234…',
    suggestion5: 'Kán ẹgbẹ́ ìdìbò ilé-iṣẹ́ rẹ tí o bá rò pé èyí jẹ́ àṣìṣe',
    lookupsPrivate: 'Àwọn ìwádìí jẹ́ ìkọ́kọ́ — kò sí àkósílẹ̀ ìwádìí rẹ.',
    backToHome: 'Pada sí ilé',
    elections: 'Àwọn Ìdìbò',
    noElections: 'Kò sí ìdìbò tí ilé-iṣẹ́ yìí ti tẹ̀ jáde.',
    yourReceipts: 'Àwọn Ìwé Ẹ̀rí Rẹ',
    recentActivity: 'Àkójọ Àṣeyẹ̀wò Tó Kẹ́yìn',
    voted: 'A ti dìbò',
    eligibleOpen: 'Ó lè dìbò — Ó Ṣí Báyìí',
    eligibleUpcoming: 'Ó lè dìbò — Ó ń Bọ̀',
    didNotVote: 'Kò dìbò',
    pending: 'Nínú ìdúró',
    voteNow: 'Dìbò Báyìí',
    receipt: 'Ìwé Ẹ̀rí',
    recorded: 'A ti gba á sí àkósílẹ̀',
    verify: 'Yẹ̀wò',
    verifying: 'Ń yẹ̀wò…',
    voteConfirmed: 'A ti fi ẹ̀rí dájú ìdìbò & a ti kà á',
    receiptNotFound: 'A kò rí ìwé ẹ̀rí',
    verificationFailed: 'Ìyẹ̀wò kò ṣaṣeyọrí',
    election: 'Ìdìbò',
    position: 'Ipò',
  },
  errors: {
    notFound: 'A kò rí ojú-ewé',
    notFoundDesc: 'Ojú-ewé tí o ń wá kò sí tàbí a ti gbe lọ.',
    unauthorized: 'A kò yọ̀nà fún ọ',
    unauthorizedDesc: 'O nílò láti wọ̀ kí o lè wọ ojú-ewé yìí.',
    forbidden: 'A kò jẹ́ kí ọ wọ̀',
    forbiddenDesc: 'O kò ní àṣẹ láti wọ ojú-ewé yìí.',
    serverError: 'Àṣìṣe sáfà',
    serverErrorDesc: 'Nǹkan ó ti ṣí lọ́dọ̀ wa. Jọ̀wọ́ gbiyanju lẹ́ẹkansí ẹ̀yìn.',
    goHome: 'Lọ sí Ojú-ewé-ìbẹ̀rẹ̀',
  },
}

// ---------------------------------------------------------------
// HAUSA — complete (with ɓ, ɗ, ƙ diacritics)
// ---------------------------------------------------------------
const ha: Translations = {
  common: {
    save: 'Ajiye',
    cancel: 'Soke',
    delete: 'Goge',
    edit: 'Gyara',
    search: 'Nemo',
    filter: 'Tace',
    loading: 'Ana loda…',
    error: 'Kuskure',
    success: 'Nasara',
    close: 'Rufe',
    back: 'Koma',
    next: 'Na gaba',
    previous: 'Da ya gabata',
    submit: 'Aika',
    confirm: 'Tabbatar',
    retry: 'Sake gwadawa',
    refresh: 'Sabunta',
    copy: 'Kwafa',
    copied: 'An kwafa',
    share: 'Raba',
    download: 'Sauke',
    yes: 'Eh',
    no: 'A\'a',
    all: 'Duka',
    none: 'Babu',
    optional: 'zaɓi',
    required: 'tilas',
    theme: 'Jigo',
    language: 'Yare',
  },
  home: {
    heroBadge: 'Dandalin Gudanar da Zabe na Afirka',
    heroTitleLine1: 'Gudanar da Zabe Mai Tsaro,',
    heroTitleLine2: 'Mai Fallasa & cikin Lokaci Gaskiya',
    heroTitleLine3: 'don Kowane Kungiya.',
    heroSubtitle:
      'Daga jami\'o\'i da ƙungiyoyi zuwa kamfanoni, coci-coci da hukumomin gwamnati, VoteWise yana taimaka maka ka shirya zabben da ake gaskanta da shi cikin mintuna kaɗan.',
    registerOrg: 'Yi Rijistar Kungiya',
    requestDemo: 'Nemi Nunin Kai tsaye',
    encryptedVoting: 'Zabe mai rufewa',
    receiptAnchored: 'Tabbatarwa da takardar alhari',
    fullAuditTrail: 'Cikakken bayanin binciken',
    anyOrg: 'Kowane kungiya',
    statOrganizations: 'Kungiyoyi',
    statOrgTypes: 'Nau\'in Kungiyoyi',
    statUserRoles: 'Matsayin Masu Amfani',
    trustedTransparent: 'An Gaskanta & Mai Fallasa',
    trustedTransparentSub: 'Kowane zabe za a iya tabbatarwa. Kowane aiki ana bincikensa.',
    receiptVerification: 'Tabbatarwa da Takardar Alhari',
    verifyYourVoteTitle: 'Tabbatar an rubuta zabenka kuma',
    verifyYourVoteTitleHighlight: 'an kirga.',
    verifyYourVoteDesc:
      'Kowane mai zabe yana karbar lambar takardar alhari ta musamman bayan ya kada kuri\'a. Shigar da ita a kasa don tabbatarwa an rubuta zabenka — ba tare da fallasa wanda ka zeba ba. Wancan ita ce rashin suna da takardar alhari.',
    ballotSecrecy: 'Asirin zabe.',
    ballotSecrecyDesc: 'Zaɓinka an rufe shi har abada — takardar alhari kawai za a iya tabbatarwa.',
    receiptAnchoredLabel: 'Da takardar alhari.',
    receiptAnchoredDesc: 'Tabbatar ka kada kuri\'a ba tare da bayyana yadda ka zeba ba.',
    tamperEvident: 'A iya gano saɓani.',
    tamperEvidentDesc: 'Bayanin bincike na sarkar-hash yana kama duk wani saɓani, a ko ina.',
    checkYourReceipt: 'Duba Takardar Alharia',
    receiptCode: 'Lambar takardar alhari',
    receiptCodeFormat: 'Tsari: VW-YYYY-XXXXXXXX. Samu da ita a fuskar tabbatarwa ko imel.',
    verifyReceipt: 'Tabbatar Takardar Alhari',
    voteConfirmed: 'An tabbatar da zabe & an kirga',
    receiptNotFound: 'Ba a samu takardar alhari',
    needFullView: 'Kana buƙatar cikakken bayani?',
    openFullPage: 'Bude shafi cikakke',
    trustAudit: 'Cikakken Bayanin Bincike',
    trustLiveDashboard: 'Allon Zabe cikin Lokaci',
    trustMFA: 'Tabbatarwa da Yawa',
    trustOTP: 'Zabe da Tabbatarwar OTP',
    trustWhiteLabel: 'Fasalin Alama da Kanka',
    trustMonitoring: 'Sa ido cikin Lokaci',
    trustSecurity: 'Tsaron Kamfani',
    statOrgsCount: 'Kungiyoyi',
    statElectionsHosted: 'Zabe da aka Gudanar',
    statVotesCast: 'Kuri\'o\'i da aka Kada',
    statUptime: 'Lokacin Aiki na Dandalin',
    howBadge: 'Mataki 4 Mai Sauƙi',
    howTitle: 'Yadda VoteWise ke Aiki',
    howSubtitle: 'Daga rijista zuwa zaben kai tsaye cikin mintuna.',
    howStep1Title: '1. Ƙirƙiri Kungiya',
    howStep1Desc: 'Yi rijistar kungiyarka, zaɓi ƙaramin-yanki, ka kuma saita alama cikin ƙasa da minti biyar.',
    howStep2Title: '2. Saita Zabe',
    howStep2Desc: 'Ƙirƙiri zabe, ƙara mukamai da ɗaliban zabe, saita tagarden zabe.',
    howStep3Title: '3. Kira Masu Zabe',
    howStep3Desc: 'Shigo da rajistar masu zabe ta CSV ko shigar da hannu. Fagage masu ɗauka suna dacewa da nau\'in kungiyar.',
    howStep4Title: '4. Fara',
    howStep4Desc: 'Lokacin da duk binciken shiri ya wuce, danna Fara. Zabenka zai budewa nan take.',
    orgsBuiltForAny: 'An gina shi don KOWACE Kungiya',
    orgsTitle: 'Tsarin ba ya sane ko damuwa da wane ne.',
    orgsSubtitle: 'Duk suna da kawai suna Kungiyoyi. VoteWise yana aiki ga dukansu.',
    orgsAllOrgs: 'Kungiyoyi',
    productsBadge: 'Samfura Uku',
    productsTitle: 'Dandalin VoteWise',
    productsSubtitle: 'Samfura uku daban-daban, dandali ɗaya da ake gaskanta. Rarrabuwar bayani a bayyane.',
    featuresBadge: 'Fasalolin Dandalin',
    featuresTitle: 'Duk abin da kake buƙata don Gudanar da Zabe Mai Tsaro',
    featuresSubtitle: 'Cikakken kayan aiki na gudanar da zabe — daga rijistar masu zabe zuwa sakamakon da aka tabbatar.',
    hierarchyBadge: 'Babban Canjin Tsarin',
    hierarchyTitle: 'Tsari na Duniya',
    hierarchySubtitle:
      'Ba Jami\'a → Faculty → Sashen → Dalibi → Zabe. Wancan yana aiki ne kawai ga wani nau\'in kungiya. VoteWise yana amfani da tsari gabaɗaya wanda ke aiki ga kowane kungiya.',
    hierarchyNote:
      'Wannan canji ɗaya kawai yana sa dandalin ya zama na duniya. Jami\'a tana saita harshenta a matsayin Kungiya=Jami\'a, Wurin Aiki=Faculty, Kungiyar Masu Zabe=Sashen. Coci yana saita Kungiya=Coci, Wurin Aiki=Ikklisiya, Kungiyar Masu Zabe=Zuwo. Tsarin yana kula da su daidai.',
    rolesBadge: 'Matsayin Masu Amfani Shida',
    rolesTitle: 'A daidai Shida. Ba Ashirin. Ba Hamsin.',
    rolesSubtitle: 'Kowane mutum a VoteWise ya dace da ɗaya daga cikin wadannan rukunoni shida. Izni a bayyane, iyaka a bayyane.',
    rolesCan: 'Zai iya',
    rolesCannot: 'Ba zai iya',
    principlesBadge: 'Ka\'idojin Dandalin Shida',
    principlesTitle: 'Kowane Fasali Dole ya Dace da Wadannan',
    principlesSubtitle: 'Idan shawarar tsari ba za ta iya amsa "Shin wannan na iya aiki ga KOWACE kungiya?" da eh ba, ba mu gina shi ba.',
    securityBadge: 'Tsaro na Farko',
    securityTitle: 'An Gina shi don Amincewa',
    securitySubtitle: 'Kowane aiki yana samar da bayanin bincike. Kowane zabe an rufe shi. Kowane sakamako za a iya tabbatarwa.',
    pricingBadge: 'Farashi Mai Sauƙi',
    pricingTitle: 'Biya Kawai abin da kake Amfani da shi',
    pricingSubtitle: 'Fara kyauta. Biya don farawa. Babu ɓoyayyen kuɗi. Tattaunawa na samuwa ga manyan kungiyoyi.',
    pricingMostPopular: 'Mafi Shahara',
    testimonialsBadge: 'Shaidoshi',
    testimonialsTitle: 'Kungiyoyi Suna Gaskata a Afirka',
    testimonialsSubtitle: 'Daga ƙungiyoyin sana\'a zuwa hadin gwiwa da jami\'o\'i — kungiyoyi suna gudanar da zabensu akan VoteWise.',
    orgsDirectoryBadge: 'Kundin Kai tsaye',
    orgsDirectoryTitle: 'Kungiyoyi akan VoteWise',
    orgsDirectorySubtitle: 'Gaskiyar kungiyoyi da ke gudanar da zabensu akan VoteWise.',
    demoBadge: 'Neman Nunin',
    demoTitle: 'Nemi Nunin Da Ya Dace Da Kai',
    demoSubtitle: 'Faɗa mana game da kungiyarka kuma tawagar mu za ta saita nunin da ya dace cikin awanni ashirin da huɗu.',
    demoContactPerson: 'Mai Tuntuɓar',
    demoEmail: 'Imel',
    demoPhone: 'Waya',
    demoOrgType: 'Nau\'in Kungiya',
    demoOrgName: 'Sunan Kungiya',
    demoEstimatedVoters: 'Kimantattun Masu Zabe',
    demoPreferredDate: 'Ranar da aka Fi So',
    demoMessage: 'Saƙo (zaɓi)',
    demoRequestBtn: 'Nemi Nunin',
    demoSending: 'Ana aikawa…',
    demoNoCommitment: 'Babu wajibi. Ba za mu taba raba bayanan ka ba.',
    liveDemoBadge: 'Nunin Kai tsaye',
    liveDemoTitle: 'Duba A Aiki',
    liveDemoSubtitle: 'Bincika zaben nunin kai tsaye tare da gaskiyar kuri\'o\'i masu rufewa, sakamakon kai tsaye, da cikakken tafiyar mai zabe. Babu buƙatar rijista.',
    tryVoterJourney: 'Gwada tafiyar mai zabe',
    tryVotingNow: 'Gwada Zabe Yanzu',
    about: 'Game da',
    guide: 'Jagora',
    viewPublicResults: 'Duba sakamakon jama\'a',
    viewLiveResults: 'Duba Sakamakon Kai tsaye',
    docsBadge: 'Takardu',
    docsTitle: 'Karanta Takardu',
    docsSubtitle: 'Duk abin da kake buƙata don fahimta, gaskatawa, da amfani da VoteWise — ga masu zabe, masu gudanarwa, da masu sa ido.',
    readMore: 'Kara karantawa',
    contactBadge: 'Tuntuɓa',
    contactTitle: 'Tuntuɓa Mu',
    contactSubtitle: 'Tambayoyi? Haɗin gwiwa? Jarida? Da muna son jin daga gare ka.',
    contactName: 'Sunanka',
    contactOrgOptional: 'Kungiya (zaɓi)',
    contactMessage: 'Saƙo',
    contactSend: 'Aika Saƙo',
    contactSending: 'Ana aikawa…',
    signupBadge: 'Fara Aiki Mai Sauƙi',
    signupTitle: 'Saita Zabenka cikin Ƙasa da Minti Biyar',
    signupSubtitle: 'Yi rijistar kungiyarka, saita harshenka, ka kuma ƙaddamar da zabenka na farko. Ba a buƙatar ƙwarewa ta fasaha. Babu ɓoyayyen matsala.',
    signupFeature1: 'Yana aiki ga kowane nau\'in kungiya',
    signupFeature2: 'Saita harshenka (Faculty / Reshe / Ikklisiya / Sashen)',
    signupFeature3: 'Alama ta musamman da logonka da launuka',
    signupFeature4: 'Biya kawai lokacin da kake farawa',
    registerYourOrg: 'Yi Rijistar Kungiyarka',
    verifyElectionBadge: 'Dandalin Tabbatarwa na Jama\'a',
    verifyElectionTitle: 'Tabbatar da',
    verifyElectionTitleHighlight: 'zabe gabaɗaya.',
    verifyElectionDesc:
      'Kowa — masu zabe, ƴan jarida, masu sa ido, masu bincike — zai iya tabbatar da amincin zaben VoteWise da aka tabbatar a kai tsaye. Duba hash na bincike, yi tafiya a kan bayanin bincike na sarkar-hash, kuma tabbatar da saƙon aminci. Idan an gyara komai, dandalin zai faɗa maka.',
    verifyElectionCertified: 'Da aka tabbatar kawai.',
    verifyElectionCertifiedDesc: 'Dandalin tabbatarwa na samuwa ne kawai bayan kwamitin zabe ya tabbatar da sakamakon.',
    verifyElectionCrypto: 'Na Cryptographic.',
    verifyElectionCryptoDesc: 'Sake ƙirga hash na bincike na SHA-256 ka kuma tabbatar da saƙon HMAC-SHA256 da kanka.',
    verifyElectionTamper: 'A iya gano saɓani.',
    verifyElectionTamperDesc: 'Bayanin bincike na sarkar-hash yana kama duk wani saɓani — a ko ina, a kowane lokaci.',
    openVerificationPortal: 'Bude Dandalin Tabbatarwa',
    electionIdOrUrl: 'ID na Zabe ko URL',
    electionIdPlaceholder: 'Manya ID na zabe ko hanyar /verify/…',
    electionIdHint: 'Yana karɓar ID na zabe, URL na /verify/<id>, ko URL na /results/<id>.',
    openPortalBtn: 'Bude Dandalin Tabbatarwa',
    dontHaveId: 'Ba ka da ID?',
    askOrganizers: 'Nemi hanyar tabbatarwa daga masu shirya zabe.',
    voterStatusBadge: 'Aikin Kai na Mai Zabe',
    voterStatusTitle: 'Duba',
    voterStatusTitleHighlight: 'matsayin zabenka.',
    voterStatusDesc:
      'Shigar da imel, waya, ko ID na mai zabe kuma za mu nuna maka matsayin rijistar ka, zabeben da ka cancanta, takardun alhari da kake da su, da kuma bayanin ayyukan ka na ƙarshe — duk ba tare da fallasa yadda ka zeba ba. Tsaka-ƙungiya: bincike ɗaya, duk kungiyoyin da ka yi rijista.',
    voterStatusRegistration: 'Matsayin rijista.',
    voterStatusRegistrationDesc: 'Tabbatar kana Aiki kuma an Tabbatar da Kai a duk kungiyoyin da ka yi rijista.',
    voterStatusParticipation: 'Tarihin shiga.',
    voterStatusParticipationDesc: 'Duba wanne zabe ka shiga, wanne yake kai tsaye, da wanne yana zuwa — tare da maɓallin "Zabi Yanzu".',
    voterStatusSecrecy: 'Tabbatar da asirin zabe.',
    voterStatusSecrecyDesc: 'Lambobin takardar alhari suna tabbatar da an kirga zabenka amma ba za su iya bayyana wanda ka zaba ba.',
    voterStatusHashing: 'Hashing mai hanya ɗaya.',
    voterStatusHashingDesc: 'Hash na mai zabenka an rufe shi da hanya ɗaya — babu wanda zai iya danganta takardar alhari da asalin ka.',
    whatYouWillSee: 'Abin da za ka gani',
    checkVoterStatus: 'Duba Matsayin Mai Zabe',
    dontHaveVoterId: 'Ba ka da ID na mai zabe?',
    useEmailOrPhone: 'Yi amfani da imel ko wayar rijistar ka maimakon haka.',
    identifierEmail: 'Imel',
    identifierPhone: 'Wayo',
    identifierVoterId: 'ID Mai Zabe / Matrik',
    identifierAny: 'Kowane shaida',
  },
  auth: {
    login: 'Shiga',
    register: 'Yi rijista',
    logout: 'Fita',
    sessionExpired: 'Zaman ya kare. Da fatan za a shiga sake.',
    orgLogin: 'Shiga Kungiya',
    registerOrg: 'Rijistar Kungiya',
    myDashboard: 'Allon Na',
    dashboard: 'Allon',
    organizationPortal: 'Dandalin Kungiya',
    signIn: 'Shiga',
    signUp: 'Yi rijista',
    email: 'Imel',
    password: 'Kalmar sirri',
    forgotPassword: 'Ka manta kalmar sirri?',
    welcomeBack: 'Barka da dawowa',
    createAccount: 'Ƙirƙiri asusu',
  },
  workspace: {
    dashboard: 'Allon',
    elections: 'Zabe',
    voters: 'Masu Zabe',
    candidates: 'Ƴan takara',
    settings: 'Saitoci',
    overview: 'Taƙaitaccen bayani',
    reports: 'Rahotanni',
    notifications: 'Sanarwa',
    audit: 'Bincike',
    observers: 'Masu Sa ido',
    exports: 'Fitarwa',
  },
  election: {
    overview: 'Taƙaitaccen bayani',
    positions: 'Mukamai',
    voting: 'Zabe',
    results: 'Sakamako',
    audit: 'Bincike',
    reports: 'Rahotanni',
    notifications: 'Sanarwa',
    status: 'Matsayi',
    statusDraft: 'Daftarin',
    statusPublished: 'An buga',
    statusAccreditation: 'Tabbatarwa',
    statusVoting: 'Zabe Buɗe',
    statusClosed: 'An rufe Zabe',
    statusCertified: 'An tabbatar',
    votingOpensIn: 'Zabe zai budewa cikin',
    votingClosesIn: 'Zabe zai rufe cikin',
    votingEnded: 'Zabe ya kare',
    turnout: 'Adadin masu zabe',
    votesCast: 'Kuri\'o\'i da aka Kada',
    eligibleVoters: 'Masu Zabe Masu Cancanta',
    timeRemaining: 'Lokacin da ya rage',
  },
  voting: {
    ballot: 'Takardar zabe',
    castVote: 'Kada Kuri\'a',
    receipt: 'Takardar Alhari',
    verify: 'Tabbatar',
    review: 'Duba',
    confirm: 'Tabbatar',
    reviewYourVote: 'Duba Kuri\'arka',
    submitVote: 'Aika Zabe',
    confirmAndSubmit: 'Tabbatar & Aika',
    finalConfirmation: 'Tabbatarwa ta Ƙarshe',
    finalConfirmationDesc: 'Kana shirin aika zabenka. Wannan aikin ba za a iya juyar da shi ba. Takardar zabenka za a rufe ta kuma a rubuta ta na dindindin.',
    summary: 'Taƙaitaccen bayani:',
    voteRecorded: 'An Rubuta Zabe da Nasara',
    voteRecordedDesc: 'An rufe zabenka, an rubuta shi, kuma an bincika shi. Ajiye lambobin takardar alharia ka a kasa don tabbatar da shiga ka daga baya.',
    verifyReceipt: 'Tabbatar Takardar Alhari',
    receiptCopied: 'An kwafa takardar alhari',
    receiptVerified: 'An Tabbatar da Takardar Alhari',
    verificationFailed: 'Tabbatarwa ta Kasa',
    ballotSecrecyProtected: 'An Kare Asirin Takardar Zabe',
    ballotSecrecyDesc: 'Takardar alharia ka tana tabbatar da shiga — ba zaɓin ƴan takara ba. Babu wanda zai iya sanin wanda ka zeba, ko da masu gudanar da database.',
    backToElection: 'Koma zuwa Zabe',
    chooseOne: 'Zaɓi 1',
    chooseN: 'Zaɓi',
    clear: 'Goge',
    change: 'Canja',
    noneOfTheAbove: 'Babu Ɗaya daga cikin Wadannan',
    noneOfTheAboveDesc: 'Ba na goyon bayan ɗaya daga cikin wadannan ƴan takara ba',
    readManifesto: 'Karanta manifesto',
    hideManifesto: 'Ɓoye manifesto',
    manifesto: 'Manifesto',
    allPositionsCompleted: 'An kammala dukkan mukamai',
    generatingBallot: 'Ana ƙirƙirar takardar zabenta mai tsaro…',
    generatingBallotSub: 'Ana tabbatar da cancanta, izini, da dokokin zabe.',
    encrypting: 'Ana rufewa da rubuta zabenka…',
    encryptingSub: 'Ana gudanar da tsarin tabbatarwa na mataki takwas. Aiki mai cikakke — idan wani abu ya gaza, zabenka BA a rubuta shi ba.',
    online: 'Kan layi',
    offline: 'Ba kan layi ba',
    autoSaved: 'An ajiye da kai',
    liveElection: 'Zabe kai tsaye',
    voter: 'Mai zabe',
    votingClosesIn: 'Zabe zai rufe cikin',
    position: 'Mukami',
    of: 'na',
    completed: 'an kammala',
    reviewing: 'Ana dubawa',
    cannotLoadBallot: 'Ba a iya loda takardar zabe ba',
    backBtn: 'Koma',
  },
  voterPicker: {
    title: 'Tabbatarwa ta Mai Zabe Mai Tsaro',
    subtitle: 'Zaɓi bayanin mai zabenka don farawa. Za a ƙirƙiri zaman zabe mai tsaro don ka. Zamenka zai kare cikin minti talatin.',
    demoMode: 'Yanayin Nunin',
    demoModeDesc: 'Wannan zaben nunin ne. A cikin aiki, masu zabe suna tabbatarwa ta hanyar OTP na imel/SMS ko SSO na cibiga. Anan za ka iya zaɓar kowane mai zabe don kwaikwayon gogewa.',
    eligibleVoters: 'Masu Zabe Masu Cancanta',
    noVoters: 'Ba a samu masu zabe masu cancanta don wannan zaben ba.',
    voted: 'An kada kuri\'a',
    backToElection: 'Koma zuwa Zabe',
    sessionStarted: 'An fara zaman zabe don',
  },
  publicResults: {
    live: 'Kai tsaye',
    certified: 'An tabbatar',
    completed: 'An kammala',
    published: 'An buga',
    setup: 'Saitawa',
    publicResults: 'Sakamakon Jama\'a',
    verified: 'An tabbatar',
    opened: 'An buɗe:',
    closes: 'Zai rufe:',
    lastVote: 'Kuri\'a ta ƙarshe:',
    timeRemaining: 'Lokacin da ya rage',
    votingClosed: 'An rufe Zabe',
    viewFullVerification: 'Duba Cikakken Tabbatarwa',
    share: 'Raba',
    verifyYourVote: 'Tabbatar da Zabenka',
    copyLink: 'Kwafa Hanya',
    verifyReceipt: 'Tabbatar da Takardar Alhari',
    eligibleVoters: 'Masu Zabe Masu Cancanta',
    votesCast: 'Kuri\'o\'i da aka Kada',
    turnout: 'Adadin masu zabe',
    turnoutProgress: 'Ci gaban Shiga',
    voters: 'masu zabe',
    of: 'na',
    remaining: 'ya rage',
    lastVoteRecorded: 'Kuri\'a ta ƙarshe da aka rubuta',
    liveCandidateResults: 'Sakamakon Ƴan Takara kai tsaye',
    updatingLive: 'Ana sabuntawa kai tsaye',
    final: 'Na ƙarshe',
    noPositions: 'Ba a saita mukamai don wannan zaben ba.',
    resultsHidden: 'An ɓoye sakamakon har zabe ya rufe.',
    resultsHiddenDesc: 'Ana nuna adadin shiga kawai. Sakamakon ƴan takara za a buga su ne bayan tagarden zabe ya rufe kuma an tabbatar da kirga.',
    cryptographicVerification: 'Tabbatarwa ta Cryptographic',
    cryptoDesc: 'Kowane zabe a VoteWise yana samar da kunshin tabbatarwa da aka sanya wa alama. Hash na bincike SHA-256 ne na duk bayanan kuri\'a; saƙon aminci HMAC-SHA256 ne akan kirga. Masu sa ido masu zaman kansu za su iya sake ƙirga wadannan don tabbatar da cewa sakamakon da aka buga yayi daidai da takardar zabe da aka rubuta.',
    auditHash: 'Hash na Bincike (SHA-256)',
    integritySignature: 'Saƙon Aminci (HMAC-SHA256)',
    totalVotes: 'Jimlar Kuri\'o\'i',
    verifiedTurnout: 'Adandin da aka Tabbatar',
    signatureValid: 'Saƙon Ya Dace',
    loadingResults: 'Ana loda sakamakon kai tsaye…',
    couldntLoadResults: 'Ba a iya loda sakamako ba',
    winner: 'Wanda ya yi nasara',
    winners: 'masu nasara',
    votes: 'kuri\'o\'i',
    noVotesRecorded: 'Babu kuri\'a da aka rubuta don wannan mukamin har yanzu.',
    copy: 'Kwafa',
    footerSecurity: 'Kowane zabe an rufe shi (AES-256-GCM) kuma an rubuta shi da bayanin bincike na sarkar-hash. Rashin suna da takardar alhari — tabbatar da shiga, ba zaɓi ba.',
  },
  verification: {
    portalTitle: 'Dandalin Tabbatarwa na Zabe',
    certified: 'An tabbatar',
    verificationStatus: 'Matsayin Tabbatarwa',
    verified: 'An tabbatar',
    failed: 'Ya kasa',
    publicResults: 'Sakamakon Jama\'a',
    backToVoteWise: 'Koma zuwa VoteWise',
    loadingVerification: 'Ana loda kunshin tabbatarwa…',
    verificationUnavailable: 'Tabbatarwa ba ta samuwa ba',
    verificationUnavailableDesc: 'Dandalin tabbatarwa na jama\'a yana samuwa ne kawai ga zabeben da aka tabbatar da su hukuma. Idan kana da lambar takardar alhari, har yanzu za ka iya tabbatar da zabenka daban a kasa.',
    electionVerified: '✓ An tabbatar da wannan zaben',
    verificationFailed: '✗ Tabbatarwa ta kasa',
    electionVerifiedDesc: 'Duk binciken aminci ya wuce. Sakamakon da aka tabbatar yayi daidai da takardar zabe da aka rubuta, sarkar bincike ba ta da matsala, kuma saƙon aminci ya dace.',
    verificationFailedDesc: 'Ɗaya ko fiye da binciken aminci bai wuce ba. Yi nazari a bayanan da ke ƙasa kafin ka gaskanta wannan sakamakon.',
    auditHash: 'Hash na Bincike',
    integritySignature: 'Saƙon Aminci',
    totalVotes: 'Jimlar Kuri\'o\'i',
    turnoutPct: 'Adandin masu zabe',
    signatureValid: 'Saƙon Ya Dace',
    certifiedResults: 'Sakamakon da aka Tabbatar',
    auditChain: 'Sarkar Bincike',
    downloadReport: 'Sauke Rahoto',
    sharePortal: 'Raba Dandalin',
  },
  voterStatus: {
    portalTitle: 'Dandalin Matsayin Mai Zabe',
    title: 'Duba',
    titleHighlight: 'Matsayin Mai Zabenka',
    desc: 'Duba matsayin rijistar ka, tarihin zabe, da takardun alharia ka.',
    descHighlight: 'Ba za a taɓa bayyana zaɓin zabenka ba.',
    lookUpRecord: 'Nemo bayanan ka',
    identifier: 'Imel, waya, ko ID na mai zabe',
    identifierPlaceholder: 'Shigar da imel, waya, ko ID na mai zabenka',
    checkStatus: 'Duba Matsayi',
    checking: 'Ana dubawa…',
    identifierHint: 'Zaka iya amfani da kowane shaida da ka yi rijista da ita — imel, lambobin waya, ko matrik / ID na mai zabe.',
    privacyGuarantees: 'Tabbatarwar Keɓantawa',
    whatIsShown: 'Abin da ake nuna',
    whatIsNeverRevealed: 'Abin da ba za a taɓa bayyana ba',
    shownRegistration: 'Ana nuna matsayin rijistar ka',
    shownParticipation: 'Ana nuna shiga ka (ka kada kuri\'a / ba ka kada ba)',
    shownReceipts: 'Ana nuna lambobin takardar alharia ka (don ka iya tabbatar da su)',
    hiddenChoices: 'Zaɓin zabenka ba za a taɓa bayyana shi ba',
    hiddenIdentity: 'Babu wanda zai iya sanin wanda ka zeba',
    hiddenLinking: 'Takardar alharia ka ba za a iya danganta ta da asalin ka ta ɓangare na uku ba',
    recordFound: 'An samu bayani',
    voterNotFound: 'Ba a samu mai zabe',
    notFoundDesc: 'Babu bayanin mai zabe da ya dace da wannan shaidar. Da fatan za a sake gwadawa da wata shaida daban.',
    suggestions: 'Shawarwari',
    suggestion1: 'Duba rubutun ka kuma sake gwadawa',
    suggestion2: 'Gwada wata shaida daban (imel, waya, ko ID na mai zabe)',
    suggestion3: 'Idan kakan shiga ta imel, gwada lambobin wayarka maimakon haka',
    suggestion4: 'Tabbatar an haɗa lambar ƙasa da wayarka, misali +234…',
    suggestion5: 'Tuntuɓi kwamitin zabe na kungiyarka idan ka ji wannan kuskure ne',
    lookupsPrivate: 'Binciken sun keɓantattu ne — babu bayanin binciken ka da ake ajiye.',
    backToHome: 'Koma gida',
    elections: 'Zabe',
    noElections: 'Babu zabe da wannan kungiya ta buga har yanzu.',
    yourReceipts: 'Takardun Alharia ka',
    recentActivity: 'Ayyukan Ƙarshe',
    voted: 'An kada kuri\'a',
    eligibleOpen: 'Yana da Cancanta — Buɗe Yanzu',
    eligibleUpcoming: 'Yana da Cancanta — Yana Zuwa',
    didNotVote: 'Ba a kada kuri\'a ba',
    pending: 'Ana jira',
    voteNow: 'Zabi Yanzu',
    receipt: 'Takardar Alhari',
    recorded: 'An rubuta',
    verify: 'Tabbatar',
    verifying: 'Ana tabbatarwa…',
    voteConfirmed: 'An tabbatar da zabe & an kirga',
    receiptNotFound: 'Ba a samu takardar alhari',
    verificationFailed: 'Tabbatarwa ta kasa',
    election: 'Zabe',
    position: 'Mukami',
  },
  errors: {
    notFound: 'Ba a samu shafi',
    notFoundDesc: 'Shafin da kake nema ba ya nan ko an motsa shi.',
    unauthorized: 'Ba a ba ka izini',
    unauthorizedDesc: 'Kana buƙatar shiga don samun damar wannan shafin.',
    forbidden: 'An hana',
    forbiddenDesc: 'Ba ka da izinin samun damar wannan shafin.',
    serverError: 'Kuskuren sava',
    serverErrorDesc: 'Wani abu ya yi kuskure a gefen mu. Da fatan za a sake gwadawa daga baya.',
    goHome: 'Tafi Shafi na Farko',
  },
}

// ---------------------------------------------------------------
// IGBO — complete (with ṅ, Ọ, ụ, ị diacritics)
// ---------------------------------------------------------------
const ig: Translations = {
  common: {
    save: 'Chekwaa',
    cancel: 'Kagbuo',
    delete: 'Hichapụ',
    edit: 'Dezie',
    search: 'Chọọ',
    filter: 'Họrọ',
    loading: 'Na-ebuga…',
    error: 'Nsogbu',
    success: 'Omere nke ọma',
    close: 'Mechie',
    back: 'Laghachi',
    next: 'Nke ọzọ',
    previous: 'Nke gara aga',
    submit: 'Zite',
    confirm: 'Kwenye',
    retry: 'Nwaa ọzọ',
    refresh: 'Mmịgharị',
    copy: 'Detuo',
    copied: 'Ederela',
    share: 'Kesaa',
    download: 'Budata',
    yes: 'Ee',
    no: 'Mba',
    all: 'Niile',
    none: 'Ọ nweghị',
    optional: 'nhọrọ',
    required: 'ihe achọrọ',
    theme: 'Isiokwu',
    language: 'Asụsụ',
  },
  home: {
    heroBadge: 'Ikpo Okwu Nchịkwa Ntuliaka nke Africa',
    heroTitleLine1: 'Mepee Ntuliaka Nchebe,',
    heroTitleLine2: 'Nke Doro Anya & n\'Ezigbo Oge',
    heroTitleLine3: 'maka Òbì ọbụla.',
    heroSubtitle:
      'Site na mahadum na njikọ ruo na ụlọ ọrụ, ụka na ụlọ ọrụ gọọmentị, VoteWise na-enyere gị aka ịhazi ntuliaka a pụrụ ịtụkwasị obi n\'ime nkeji ole na ole.',
    registerOrg: 'Debanye Aha Òbì',
    requestDemo: 'Rịọ Ngosị Ezigbo Oge',
    encryptedVoting: 'Ntuliaka ezoro ezo',
    receiptAnchored: 'Ntinye aka na nnata',
    fullAuditTrail: 'Akụkọ nyocha zuru ezu',
    anyOrg: 'Òbì ọbụla',
    statOrganizations: 'Òbì',
    statOrgTypes: 'Ụdị Òbì',
    statUserRoles: 'Ọrụ Ndị Ọrụ',
    trustedTransparent: 'A Pụrụ Itụkwasị Obi & Doro Anya',
    trustedTransparentSub: 'Ntuliaka ọ bụla enwere ike nyocha. Ọrụ ọ bụla a na-enyocha.',
    receiptVerification: 'Nyocha site na Nnata',
    verifyYourVoteTitle: 'Nyocha na edere ntuliaka gị',
    verifyYourVoteTitleHighlight: 'ma gụọ ya.',
    verifyYourVoteDesc:
      'Onye ọ bụla na-atụ vootu na-anata koodu nnata pụrụ iche ka ọ chara atụ vootu. Banye ya n\'okpuru iji kwado na edere vootu gị — na-enweghị ịgwa onye ị họrọ. Nke ahụ bụ nzuzo nke nnata.',
    ballotSecrecy: 'Nzuzo vootu.',
    ballotSecrecyDesc: 'Nhọrọ gị ezoro ezo ruo mgbe ebighị ebi — naanị nnata ka enwere ike nyocha.',
    receiptAnchoredLabel: 'Ntinye aka na nnata.',
    receiptAnchoredDesc: 'Gosi na ịtụrụ vootu na-enweghị ịgwa otu esi mee ya.',
    tamperEvident: 'Enwere ike ịchọpụta mmegharị.',
    tamperEvidentDesc: 'Akụkọ nyocha nke njikọ-hash na-amata mgbanwe ọbụla, ebe ọbụla.',
    checkYourReceipt: 'Nyocha Nnata Gị',
    receiptCode: 'Koodu nnata',
    receiptCodeFormat: 'Ụdị: VW-YYYY-XXXXXXXX. Hụ ya na ihuenyo nkwenye gị ma ọ bụ ozi ịntanetị.',
    verifyReceipt: 'Nyocha Nnata',
    voteConfirmed: 'A kwadoro vootu & a gụrụ ya',
    receiptNotFound: 'A hụghị nnata',
    needFullView: 'Ị chọrọ ile anya nke ọma?',
    openFullPage: 'Mepee peeji nke ọma',
    trustAudit: 'Akụkọ Nyocha site na mmalite ruo ngwụsị',
    trustLiveDashboard: 'PANEL Nsonaazụ Ezigbo Oge',
    trustMFA: 'Nkwenye Ọtụtụ Ụzọ',
    trustOTP: 'Ntuliaka nyere OTP',
    trustWhiteLabel: 'Ikpo Okwu nke Akara Gị',
    trustMonitoring: 'Nleba anya Ezigbo Oge',
    trustSecurity: 'Nchebe Ụlọ Ọrụ',
    statOrgsCount: 'Òbì',
    statElectionsHosted: 'Ntuliaka a Na-eduzi',
    statVotesCast: 'Vootu a Tụrụ',
    statUptime: 'Oge Ikpo Okwu Na-arụ Ọrụ',
    howBadge: 'Nzọụkwụ 4 Dị Mfe',
    howTitle: 'Otu VoteWise si Arụ Ọrụ',
    howSubtitle: 'Site na ndebanye aha ruo ntuliaka ezigbo oge n\'ime nkeji.',
    howStep1Title: '1. Mepụta Òbì',
    howStep1Desc: 'Debanye aha òbì gị, họrọ obere ngalaba, ma setịpụ akara n\'okpuru nkeji ise.',
    howStep2Title: '2. Ntọala Ntuliaka',
    howStep2Desc: 'Mepụta ntuliaka, tinye ọkwa na ndị na-azọ ọkwa, hazie oge ntuliaka.',
    howStep3Title: '3. kpọọ Ndị Na-atụ Vootu',
    howStep3Desc: 'Webata ndebanye aha ndị na-atụ vootu gị site na CSV ma ọ bụ ntinye aka. Mpaghara na-agbanwe iji daba ụdị òbì gị.',
    howStep4Title: '4. Bido',
    howStep4Desc: 'Mgbe nyocha njikarịcha niile gafere, pịa Bido. Ntuliaka gị ga-emeghe ozugbo.',
    orgsBuiltForAny: 'Ewuru ya maka ÒBÌ ỌBỤLA',
    orgsTitle: 'Sistemụ anaghị amaghị ma ọ bụ chọghị ịma nke ọ bụ.',
    orgsSubtitle: 'Ha niile bụ naanị Òbì. VoteWise na-arụ ọrụ maka ha niile.',
    orgsAllOrgs: 'Òbì',
    productsBadge: 'Ngwaahịa Atọ',
    productsTitle: 'Ikpo Okwu VoteWise',
    productsSubtitle: 'Ngwaahịa atọ dị iche iche, ikpo okwu ọ bụla a pụrụ ịtụkwasị obi. Nkewa doro anya nke ihe.',
    featuresBadge: 'Ngwaọrụ Ikpo Okwu',
    featuresTitle: 'Ihe Niile I Ji Achọ Iji Duzie Ntuliaka Nchebe',
    featuresSubtitle: 'Ngwaọrụ zuru ezu maka nchịkwa ntuliaka — site na ndebanye aha ndị na-atụ vootu ruo na nsonaazụ a kwadoro.',
    hierarchyBadge: 'Nnukwu Mgbanwe Ndị Na-ewu Ụlọ',
    hierarchyTitle: 'Usoro nke Ụwa Nile',
    hierarchySubtitle:
      'Ọ bụghị Mahadum → Faculty → Ngalaba → Nwa akwukwo → Ntuliaka. Nke ahụ na-arụ ọrụ naanị maka otu ụdị òbì. VoteWise na-eji usoro zuru oke nke na-arụ ọrụ maka òbì ọ bụla.',
    hierarchyNote:
      'Mgbanwe a naanị na-eme ka ikpo okwu bụrụ nke ụwa niile. Mahadum na-ahazi okwu ya dị ka Òbì=Mahadum, Ebe Ọrụ=Faculty, Njikọ Ndị Na-atụ Vootu=Ngalaba. Ụka na-ahazi Òbì=Ụka, Ebe Ọrụ=Parish, Njikọ Ndị Na-atụ Vootu=Fellowship. Sistemụ na-edo ha nhata.',
    rolesBadge: 'Ọrụ Ndị Ọrụ Isii',
    rolesTitle: 'Ziri Ezi Isii. Ọ bụghị Iri Abụọ. Ọ bụghị Iri Isii.',
    rolesSubtitle: 'Onye ọ bụla na VoteWise dabara n\'otu n\'ime ụdị isii a. Ikike doro anya, ókè doro anya.',
    rolesCan: 'Nwere ike',
    rolesCannot: 'Enweghị ike',
    principlesBadge: 'Isi Iwu Ikpo Okwu Isii',
    principlesTitle: 'Ngwaọrụ Ọbụla Ga-eju Nlereanya',
    principlesSubtitle: 'Ọ bụrụ na mkpebi ọchịchị enweghị ike ịza "Ọ nwere ike ịrụ ọrụ maka ÒBÌ ỌBỤLA?" na ee, anyị anaghị ewu ya.',
    securityBadge: 'Nchebe Mbụ',
    securityTitle: 'Ewuru ya maka Ndị Ga-ele Anya',
    securitySubtitle: 'Ọrụ ọ bụla na-emepụta akụkọ nyocha. Vootu ọ bụla ezoro ezo. Nsonaazụ ọ bụla enwere ike nyocha.',
    pricingBadge: 'Ọnụahịa Dị Mfe',
    pricingTitle: 'Na-akwụ Naanị Ihe I Ji',
    pricingSubtitle: 'Bido n\'efu. Kwụọ iji bido. Enweghị ego zoro ezo. Mkparịta ụka dị maka nnukwu òbì.',
    pricingMostPopular: 'Kachasị ewu ewu',
    testimonialsBadge: 'Nkwupụta',
    testimonialsTitle: 'Òbì Na-atụkwasị Obi na Africa',
    testimonialsSubtitle: 'Site na òbì ọkachamara ruo na mkpakọrịta na mahadum — òbì na-eduzi ntuliaka ha na VoteWise.',
    orgsDirectoryBadge: 'Akwụkwọ Nduzi Ezigbo Oge',
    orgsDirectoryTitle: 'Òbì na VoteWise',
    orgsDirectorySubtitle: 'Òbì n\'ezie na-eduzi ntuliaka ha na VoteWise.',
    demoBadge: 'Arịrịọ Ngosị',
    demoTitle: 'Rịọ Ngosị Pụrụ Iche',
    demoSubtitle: 'Gwa anyị maka òbì gị na ndị otu anyị ga-edobe ngosị pụrụ iche n\'ime awa iri abụọ na anọ.',
    demoContactPerson: 'Onye Ị ga-akpọtụrụ',
    demoEmail: 'Ozi ịntanetị',
    demoPhone: 'Ekwentị',
    demoOrgType: 'Ụdị Òbì',
    demoOrgName: 'Aha Òbì',
    demoEstimatedVoters: 'Atụmatụ Ndị Na-atụ Vootu',
    demoPreferredDate: 'Ụbọchị a Na-ahọrọ',
    demoMessage: 'Ozi (nhọrọ)',
    demoRequestBtn: 'Rịọ Ngosị',
    demoSending: 'Na-ezite…',
    demoNoCommitment: 'Enweghị ọrụ achọrọ. Anyị agaghị ekerịta nkọwa gị.',
    liveDemoBadge: 'Ngosị Ezigbo Oge',
    liveDemoTitle: 'Hụ Ya Na Mmemme',
    liveDemoSubtitle: 'Nyochaa ngosị ntuliaka ezigbo oge nwere vootu ezoro ezo, nsonaazụ ezigbo oge, na njem onye na-atụ vootu zuru ezu. Enweghị ndebanye aha achọrọ.',
    tryVoterJourney: 'Nwaa njem onye na-atụ vootu',
    tryVotingNow: 'Nwaa Itu Vootu Ugbua',
    about: 'Maka',
    guide: 'Nduzi',
    viewPublicResults: 'Lee nsonaazụ ọha',
    viewLiveResults: 'Lee Nsonaazụ Ezigbo Oge',
    docsBadge: 'Akwụkwọ',
    docsTitle: 'Gụọ Akwụkwọ',
    docsSubtitle: 'Ihe niile ị chọrọ iji ghọta, tụkwasị obi, ma jiri VoteWise — maka ndị na-atụ vootu, ndị nchịkwa, na ndị na-ele anya.',
    readMore: 'Gụọ ọzọ',
    contactBadge: 'Kpọtụrụ',
    contactTitle: 'Kpọtụrụ Anyị',
    contactSubtitle: 'Ajụjụ? Njikọ? Mgbasa ozi? Anyị ga-asịọ ịnụ site n\'aka gị.',
    contactName: 'Aha Gị',
    contactOrgOptional: 'Òbì (nhọrọ)',
    contactMessage: 'Ozi',
    contactSend: 'Zite Ozi',
    contactSending: 'Na-ezite…',
    signupBadge: 'Malite Dị Mfe',
    signupTitle: 'Ntọala Ntuliaka Gị n\'okpuru nkeji ise',
    signupSubtitle: 'Debanye aha òbì gị, hazie okwu gị, ma malite ntuliaka gị nke mbụ. Enweghị nkà ụkpụrụ achọrọ. Enweghị ihe mgbagwoju anya zoro ezo.',
    signupFeature1: 'Na-arụ ọrụ maka ụdị òbì ọ bụla',
    signupFeature2: 'Hazie okwu nke gị (Faculty / Alaka / Parish / Nkeji)',
    signupFeature3: 'Akara nke gị nwere logo na agba gị',
    signupFeature4: 'Na-akwụ naanị mgbe ị na-amalite',
    registerYourOrg: 'Debanye Aha Òbì Gị',
    verifyElectionBadge: 'Ikpo Okwu Nyocha Ọha',
    verifyElectionTitle: 'Nyocha ntuliaka',
    verifyElectionTitleHighlight: 'niile.',
    verifyElectionDesc:
      'Onye ọ bụla — ndị na-atụ vootu, ndị nta akụkọ, ndị na-ele anya, ndị na-enyocha — nwere ike nyocha aka ịhụ na ntuliaka VoteWise a kwadoro. Lelee hash nyocha, jee njem na akụkọ nyocha nke njikọ-hash, ma kwado saịnịntegriti. Ọ bụrụ na e megharịla ihe ọbụla, ikpo okwu ga-agwa gị.',
    verifyElectionCertified: 'Naanị nke a kwadoro.',
    verifyElectionCertifiedDesc: 'Ikpo okwu nyocha dị naanị mgbe kọmitii ntuliaka kwadoro nsonaazụ.',
    verifyElectionCrypto: 'Nke Cryptographic.',
    verifyElectionCryptoDesc: 'Ịgụgharịa hash nyocha SHA-56 ma nyocha saịnịntegriti HMAC-SHA256 nke onwe gị.',
    verifyElectionTamper: 'Enwere ike ịchọpụta mmegharị.',
    verifyElectionTamperDesc: 'Akụkọ nyocha nke njikọ-hash na-amata mgbanwe ọ bụla — ebe ọbụla, mgbe ọbụla.',
    openVerificationPortal: 'Mepee Ikpo Okwu Nyocha',
    electionIdOrUrl: 'ID Ntuliaka ma ọ bụ URL',
    electionIdPlaceholder: 'Tee ID ntuliaka ma ọbuahịa /verify/…',
    electionIdHint: 'Anabatara ID ntuliaka, URL /verify/<id>, ma ọ bụ URL /results/<id>.',
    openPortalBtn: 'Mepee Ikpo Okwu Nyocha',
    dontHaveId: 'Ị enweghị ID?',
    askOrganizers: 'Rịọ njikọ nyocha site n\'aka ndị na-ahazi ntuliaka.',
    voterStatusBadge: 'Ọrụ Onwe Onye Na-atụ Vootu',
    voterStatusTitle: 'Nyocha',
    voterStatusTitleHighlight: 'ọnọdụ vootu gị.',
    voterStatusDesc:
      'Banye ozi ịntanetị, ekwentị, ma ọ bụ ID onye na-atụ vootu gị, anyị ga-egosi gị ọnọdụ ndebanye aha gị, ntuliaka ị nwere ike itinye aka, nnata ị nwere, na akụkọ ihe omume gị na nso nso a — niile na-enweghị ịgwa etu ị si tụọ vootu. Gafee-òbì: nyocha otu, òbì ọ bụla ị debanyere aha.',
    voterStatusRegistration: 'Ọnọdụ ndebanye aha.',
    voterStatusRegistrationDesc: 'Kwenye na ị na-arụ ọrụ ma nyochaa gị n\'ofe òbì niile ị debanyere aha.',
    voterStatusParticipation: 'Akụkọ ihe mere eme nke itinye aka.',
    voterStatusParticipationDesc: 'Hụ ntuliaka ị tụrụ vootu, nke dị na ezigbo oge, na nke na-abịa — nwere bọtịnụ "Tụọ Vootu Ugbua".',
    voterStatusSecrecy: 'Nkwenye nzuzo vootu.',
    voterStatusSecrecyDesc: 'Koodu nnata na-ekwenye na a gụrụ vootu gị mana ha enweghị ike ịgwa onye ị họrọ.',
    voterStatusHashing: 'Hashing otu ụzọ.',
    voterStatusHashingDesc: 'Hash onye na-atụ vootu gị ezoro ezo otu ụzọ — ọ nweghị onye nwere ike ijikọ nnata na njirimara gị.',
    whatYouWillSee: 'Ihe ị ga-ahụ',
    checkVoterStatus: 'Nyocha Ọnọdụ Onye Na-atụ Vootu',
    dontHaveVoterId: 'Ị enweghị ID onye na-atụ vootu?',
    useEmailOrPhone: 'Ji ozi ịntanetị ma ọ bụ ekwentị ndebanye aha gị kama.',
    identifierEmail: 'Ozi ịntanetị',
    identifierPhone: 'Ekwentị',
    identifierVoterId: 'ID Onye Na-atụ Vootu / Matrik',
    identifierAny: 'Njirimara ọbụla',
  },
  auth: {
    login: 'Banye',
    register: 'Debanye aha',
    logout: 'Pụọ',
    sessionExpired: 'Oge gbara afụ. Biko banye ọzọ.',
    orgLogin: 'Banye Òbì',
    registerOrg: 'Debanye Òbì',
    myDashboard: 'PANEL M',
    dashboard: 'PANEL',
    organizationPortal: 'Ikpo Okwu Òbì',
    signIn: 'Banye',
    signUp: 'Debanye aha',
    email: 'Ozi ịntanetị',
    password: 'Okwuntughe',
    forgotPassword: 'Chefuo okwuntughe?',
    welcomeBack: 'Nnọọ ịlaghachi',
    createAccount: 'Mepụta akaụntụ',
  },
  workspace: {
    dashboard: 'PANEL',
    elections: 'Ntuliaka',
    voters: 'Ndị Na-atụ Vootu',
    candidates: 'Ndị Na-azọ Ọkwa',
    settings: 'Ntọala',
    overview: 'Nchịkọta',
    reports: 'Akụkọ',
    notifications: 'N Marcel',
    audit: 'Nyocha',
    observers: 'Ndị Na-ele Anya',
    exports: 'Ntinyepụta',
  },
  election: {
    overview: 'Nchịkọta',
    positions: 'Ọkwa',
    voting: 'Ntuliaka',
    results: 'Nsonaazụ',
    audit: 'Nyocha',
    reports: 'Akụkọ',
    notifications: 'N Marcel',
    status: 'Ọnọdụ',
    statusDraft: 'Edemede',
    statusPublished: 'E bipụtara',
    statusAccreditation: 'Nkwenye',
    statusVoting: 'Ntuliaka Mepe',
    statusClosed: 'Emechiri Ntuliaka',
    statusCertified: 'A kwadoro',
    votingOpensIn: 'Ntuliaka ga-emepe n\'ime',
    votingClosesIn: 'Ntuliaka ga-emechi n\'ime',
    votingEnded: 'Ntuliaka agwụla',
    turnout: 'Ọnụ ọgụgụ ndị na-atụ vootu',
    votesCast: 'Vootu a Tụrụ',
    eligibleVoters: 'Ndị Na-atụ Vootu Tozuru',
    timeRemaining: 'Oge fọdụrụ',
  },
  voting: {
    ballot: 'Akwụkwọ vootu',
    castVote: 'Tụọ Vootu',
    receipt: 'Nnata',
    verify: 'Nyocha',
    review: 'Nlegharị',
    confirm: 'Kwenye',
    reviewYourVote: 'Nyochaa Vootu Gị',
    submitVote: 'Zite Vootu',
    confirmAndSubmit: 'Kwenye & Zite',
    finalConfirmation: 'Nkwenye Ikpeazụ',
    finalConfirmationDesc: 'Ị na-eme atụmatụ izite vootu gị. Ọrụ a enweghị ike ịlaghachi azụ. Akwụkwọ vootu gị ga-ezokwa ma dee ya kpamkpam.',
    summary: 'Nchịkọta:',
    voteRecorded: 'Edere Vootu nke Ọma',
    voteRecordedDesc: 'Ezoro vootu gị, edere ya, ma nyocha ya. Chekwaa nọmba nnata gị n\'okpuru iji nyochaa itinye aka gị mgbe e mesịrị.',
    verifyReceipt: 'Nyocha Nnata',
    receiptCopied: 'Ederela nnata na clipboard',
    receiptVerified: 'A Nyochaala Nnata',
    verificationFailed: 'Nyocha Da',
    ballotSecrecyProtected: 'Echebe Nzuzo Akwụkwọ Vootu',
    ballotSecrecyDesc: 'Nnata gị na-ekwenye itinye aka — ọ bụghị nhọrọ ndị na-azọ ọkwa. Ọ nweghị onye nwere ike ịmata onye ị tụrụ vootu, ọbụna ndị nchịkwa databeese.',
    backToElection: 'Laghachi na Ntuliaka',
    chooseOne: 'Họrọ 1',
    chooseN: 'Họrọ',
    clear: 'Hichapụ',
    change: 'Gbanwee',
    noneOfTheAbove: 'Ọ nweghị nke n\'Elu',
    noneOfTheAboveDesc: 'Anaghị akwado ndị na-azọ ọkwa ọ bụla n\'ime ndị a',
    readManifesto: 'Gụọ manifesto',
    hideManifesto: 'Zoo manifesto',
    manifesto: 'Manifesto',
    allPositionsCompleted: 'Emechaala ọkwa niile',
    generatingBallot: 'Na-emepụta akwụkwọ vootu nchebe gị…',
    generatingBallotSub: 'Na-enyocha iru eru, nkwenye, na iwu ntuliaka.',
    encrypting: 'Na-ezochi ma dee vootu gị…',
    encryptingSub: 'Na-agba ọsọ usoro nyocha nzọụkwụ asatọ. Ọrụ dị iche — ọ bụrụ na ihe ọ bụla daa, a naghị edere vootu gị.',
    online: 'N\'ịntanetị',
    offline: 'N\'ọ́ffịs',
    autoSaved: 'Echekwaala',
    liveElection: 'Ntuliaka Ezigbo Oge',
    voter: 'Onye na-atụ vootu',
    votingClosesIn: 'Ntuliaka ga-emechi n\'ime',
    position: 'Ọkwa',
    of: 'nke',
    completed: 'emechaala',
    reviewing: 'Na-enyocha',
    cannotLoadBallot: 'Enweghị ike ibu akwụkwọ vootu',
    backBtn: 'Laghachi',
  },
  voterPicker: {
    title: 'Nkwenye Onye Na-atụ Vootu Nchebe',
    subtitle: 'Họrọ profaịlụ onye na-atụ vootu gị iji malite. A ga-emepụta oge ntuliaka nchebe maka gị. Oge gị ga-agwụ n\'ime nkeji iri atọ.',
    demoMode: 'Ọnọdụ Ngosị',
    demoModeDesc: 'Nke a bụ ngosị ntuliaka. N\'ezie, ndị na-atụ vootu na-enyocha site na OTP nke ozi ịntanetị/SMS ma ọ bụ SSO nke ụlọ ọrụ. Ebe a, ị nwere ike họrọ onye ọ bụla na-atụ vootu iji gosi ahụmịhe.',
    eligibleVoters: 'Ndị Na-atụ Vootu Tozuru',
    noVoters: 'A hụghị ndị na-atụ vootu tozuru maka ntuliaka a.',
    voted: 'A tụrụ vootu',
    backToElection: 'Laghachi na Ntuliaka',
    sessionStarted: 'Malitere oge ntuliaka maka',
  },
  publicResults: {
    live: 'Ezigbo Oge',
    certified: 'A kwadoro',
    completed: 'Emechaala',
    published: 'E bipụtara',
    setup: 'Ntọala',
    publicResults: 'Nsonaazụ Ọha',
    verified: 'A nyochaala',
    opened: 'Mepeere:',
    closes: 'Ga-emechi:',
    lastVote: 'Vootu ikpeazụ:',
    timeRemaining: 'Oge fọdụrụ',
    votingClosed: 'Emechiri Ntuliaka',
    viewFullVerification: 'Lee Nyocha Dị Ukwwu',
    share: 'Kesaa',
    verifyYourVote: 'Nyochaa Vootu Gị',
    copyLink: 'Detuo njikọ',
    verifyReceipt: 'Nyochaa Nnata',
    eligibleVoters: 'Ndị Na-atụ Vootu Tozuru',
    votesCast: 'Vootu a Tụrụ',
    turnout: 'Ọnụ ọgụgụ ndị na-atụ vootu',
    turnoutProgress: 'Ọganihu Itinye Aka',
    voters: 'ndị na-atụ vootu',
    of: 'nke',
    remaining: 'fọdụrụ',
    lastVoteRecorded: 'Vootu ikpeazụ edere',
    liveCandidateResults: 'Nsonaazụ Ndị Na-azọ Ọkwa Ezigbo Oge',
    updatingLive: 'Na-emelite ezigbo oge',
    final: 'Nke ikpeazụ',
    noPositions: 'Eweghị ọkwa edobere maka ntuliaka a.',
    resultsHidden: 'A na-ezo nsonaazụ ruo mgbe ntuliaka ga-emechi.',
    resultsHiddenDesc: 'Na-egosi naanị ọnụ ọgụgụ itinye aka. A ga-ebipụta nsonaazụ ọkwa onye na-azọ ọkwa mgbe oge ntuliaka mechie ma nyochaa ọnụ ọgụgụ ahụ.',
    cryptographicVerification: 'Nyocha Cryptographic',
    cryptoDesc: 'Ntuliaka ọ bụla na VoteWise na-emepụta ngwugwu nyocha a bịanyere aka. Hash nyocha bụ SHA-256 nke ndekọ vootu niile; saịnịntegriti bụ HMAC-SHA256 n\'elu ọnụ ọgụgụ ahụ. Ndị na-ele anya nweere onwe ha nwere ike ịgụgharịa ndị a iji gosi na nsonaazụ e bipụtara dabara na akwụkwọ vootu edere.',
    auditHash: 'Hash Nyocha (SHA-256)',
    integritySignature: 'Saịnịntegriti (HMAC-SHA256)',
    totalVotes: 'Ngụkọta Vootu',
    verifiedTurnout: 'Ọnụ ọgụgụ a Nyochaala',
    signatureValid: 'Saịnị Dị Mma',
    loadingResults: 'Na-ebu nsonaazụ ezigbo oge…',
    couldntLoadResults: 'Enweghị ike ibu nsonaazụ',
    winner: 'Onye mmeri',
    winners: 'ndị mmeri',
    votes: 'vootu',
    noVotesRecorded: 'Ebeghị vootu maka ọkwa a ruo ugbua.',
    copy: 'Detuo',
    footerSecurity: 'Vootu ọ bụla ezoro ezo (AES-256-GCM) ma dee ya na akụkọ nyocha nke njikọ-hash. Nzuzo nke nnata — nyochaa itinye aka, ọ bụghị nhọrọ.',
  },
  verification: {
    portalTitle: 'Ikpo Okwu Nyocha Ntuliaka',
    certified: 'A kwadoro',
    verificationStatus: 'Ọnọdụ Nyocha',
    verified: 'A nyochaala',
    failed: 'Dara',
    publicResults: 'Nsonaazụ Ọha',
    backToVoteWise: 'Laghachi na VoteWise',
    loadingVerification: 'Na-ebu ngwugwu nyocha…',
    verificationUnavailable: 'Nyocha adịghị',
    verificationUnavailableDesc: 'Ikpo okwu nyocha ọha na-adị naanị maka ntuliaka e kwadoro nke ọma. Ọ bụrụ na ị nwere koodu nnata, ị ka nwere ike nyochaa vootu gị n\'onwe gị n\'okpuru.',
    electionVerified: '✓ A nyochaala ntuliaka a',
    verificationFailed: '✗ Nyocha da',
    electionVerifiedDesc: 'Nyocha niile nke njikarịcha gafere. Nsonaazụ a kwadoro dabara na akwụkwọ vootu edere, sarkar nyocha dị mma, ma saịnịntegriti dị mma.',
    verificationFailedDesc: 'Otu ma ọ bụ karịa nyocha njikarịcha adịghị agafe. Nyochaa nkọwa n\'okpuru tupu ịtụkwasị obi na nsonaazụ a.',
    auditHash: 'Hash Nyocha',
    integritySignature: 'Saịnịntegriti',
    totalVotes: 'Ngụkọta Vootu',
    turnoutPct: 'Ọnụ ọgụgụ ndị na-atụ vootu',
    signatureValid: 'Saịnị Dị Mma',
    certifiedResults: 'Nsonaazụ A Kwadoro',
    auditChain: 'Sarkar Nyocha',
    downloadReport: 'Budata Akụkọ',
    sharePortal: 'Kesaa Ikpo Okwu',
  },
  voterStatus: {
    portalTitle: 'Ikpo Okwu Ọnọdụ Onye Na-atụ Vootu',
    title: 'Nyocha',
    titleHighlight: 'Ọnọdụ Onye Na-atụ Vootu Gị',
    desc: 'Nyochaa ọnọdụ ndebanye aha gị, akụkọ ihe mere eme nke ntuliaka, na nnata gị.',
    descHighlight: 'A ga-ekpughe nhọrọ vootu gị mgbe ọbụla.',
    lookUpRecord: 'Chọọ ndekọ gị',
    identifier: 'Ozi ịntanetị, ekwentị, ma ọ bụ ID onye na-atụ vootu',
    identifierPlaceholder: 'Banye ozi ịntanetị, ekwentị, ma ọ bụ ID onye na-atụ vootu gị',
    checkStatus: 'Nyochaa Ọnọdụ',
    checking: 'Na-enyocha…',
    identifierHint: 'Ị nwere ike iji njirimara ọ bụla ị debanyere aha — ozi ịntanetị, nọmba ekwentị, ma ọ bụ matrik / ID onye na-atụ vootu.',
    privacyGuarantees: 'Nkwenye Nzuzo',
    whatIsShown: 'Ihe a na-egosi',
    whatIsNeverRevealed: 'Ihe a ga-ekpughe mgbe ọbụla',
    shownRegistration: 'A na-egosi ọnọdụ ndebanye aha gị',
    shownParticipation: 'A na-egosi itinye aka gị (ịtụrụ / ị na-atụghị vootu)',
    shownReceipts: 'A na-egosi koodu nnata gị (ka ị nwee ike nyocha ha)',
    hiddenChoices: 'A ga-ekpughe nhọrọ vootu gị mgbe ọbụla',
    hiddenIdentity: 'Ọ nweghị onye nwere ike ịmata onye ị họrọ',
    hiddenLinking: 'Enweghị ike ijikọ nnata gị na njirimara gị site n\'aka ndị ọzọ',
    recordFound: 'A hụrụ ndekọ',
    voterNotFound: 'A hụghị onye na-atụ vootu',
    notFoundDesc: 'Ọ nweghị ndekọ onye na-atụ vootu dabara njirimara a. Biko nwaa ọzọ na njirimara dị iche.',
    suggestions: 'Aro',
    suggestion1: 'Nyochaa asụsụ ma nwaa ọzọ',
    suggestion2: 'Nwaa njirimara dị iche (ozi ịntanetị, ekwentị, ma ọ bụ ID onye na-atụ vootu)',
    suggestion3: 'Ọ bụrụ na ị na-abanye site na ozi ịntanetị, nwaa nọmba ekwentị gị kama',
    suggestion4: 'Gbaa mbọ hụ na ekwentị gị nwere koodu mba, dịka +234…',
    suggestion5: 'Kpọtụrụ kọmitii ntuliaka nke òbì gị ma ọ bụrụ na ị chere na nke a bụ njehie',
    lookupsPrivate: 'Nyocha bụ nkeonwe — enweghị ndekọ nke nyocha gị a na-edobe.',
    backToHome: 'Laghachi n\'ụlọ',
    elections: 'Ntuliaka',
    noElections: 'Ọ dịghị ntuliaka òbì a bipụtara ruo ugbua.',
    yourReceipts: 'Nnata Gị',
    recentActivity: 'Omume Na Nso Nso A',
    voted: 'A tụrụ vootu',
    eligibleOpen: 'Tozuru — Mepe Ugbua',
    eligibleUpcoming: 'Tozuru — Na-abịa',
    didNotVote: 'Ebeghị vootu',
    pending: 'Na-eche',
    voteNow: 'Tụọ Vootu Ugbua',
    receipt: 'Nnata',
    recorded: 'Ederela',
    verify: 'Nyocha',
    verifying: 'Na-enyocha…',
    voteConfirmed: 'A kwadoro vootu & a gụrụ ya',
    receiptNotFound: 'A hụghị nnata',
    verificationFailed: 'Nyocha da',
    election: 'Ntuliaka',
    position: 'Ọkwa',
  },
  errors: {
    notFound: 'A hụghị peeji',
    notFoundDesc: 'Peeji ị na-achọ adịghị ma ọ bụ a tụfuru ya.',
    unauthorized: 'Enweghị ikike',
    unauthorizedDesc: 'Ị chọrọ ịbanye iji nweta peeji a.',
    forbidden: 'A machibidoro',
    forbiddenDesc: 'Ị enweghị ikike ịnweta peeji a.',
    serverError: 'Njehie sava',
    serverErrorDesc: 'Ihe mere n\'akụkụ anyị. Biko nwaa ọzọ mgbe e mesịrị.',
    goHome: 'Gaa Peeji nke Mbụ',
  },
}

// ---------------------------------------------------------------
// Dictionary map
// ---------------------------------------------------------------
export const translations: Record<Language, Translations> = { en, fr, yo, ha, ig }

// ---------------------------------------------------------------
// Resolve a dotted key like "home.heroTitle" → translations.home.heroTitle
// ---------------------------------------------------------------
function resolveKey(dict: Translations, key: string): string | undefined {
  const parts = key.split('.')
  let cur: any = dict
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

// ---------------------------------------------------------------
// useTranslation hook (Zustand-based — reads language from the store).
// ---------------------------------------------------------------
export function useTranslation() {
  const language = useApp((s) => s.language)
  const dict = translations[language] || translations.en
  const fallback = translations.en

  function t(key: string): string {
    const value = resolveKey(dict, key)
    if (value !== undefined) return value
    const fallbackValue = resolveKey(fallback, key)
    if (fallbackValue !== undefined) return fallbackValue
    // If the key isn't found anywhere, return the key itself as a last
    // resort — better than showing "undefined" to the user.
    return key
  }

  return { t, language }
}

// ---------------------------------------------------------------
// Date / time formatting helpers (locale-aware).
// ---------------------------------------------------------------
export function formatDate(date: Date | string, lang: Language): string {
  const meta = getLanguageMeta(lang)
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(meta.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    // Fall back to the runtime default if the locale is unsupported.
    return d.toLocaleString()
  }
}

export function formatRelativeTime(date: Date | string, lang: Language): string {
  const meta = getLanguageMeta(lang)
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const diff = d.getTime() - Date.now()
  const absDiff = Math.abs(diff)
  const sec = Math.round(absDiff / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)

  const rtf = (() => {
    try {
      return new Intl.RelativeTimeFormat(meta.locale, { numeric: 'auto' })
    } catch {
      try {
        return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
      } catch {
        return null
      }
    }
  })()

  if (!rtf) {
    // Last-resort English fallback.
    const sign = diff < 0 ? 'ago' : 'in'
    if (sec < 60) return diff < 0 ? `${sec}s ago` : `in ${sec}s`
    if (min < 60) return diff < 0 ? `${min}m ago` : `in ${min}m`
    if (hr < 24) return diff < 0 ? `${hr}h ago` : `in ${hr}h`
    return diff < 0 ? `${day}d ago` : `in ${day}d`
  }

  if (sec < 60) return rtf.format(Math.round(-diff / 1000), 'second')
  if (min < 60) return rtf.format(Math.round(-diff / 60_000), 'minute')
  if (hr < 24) return rtf.format(Math.round(-diff / 3_600_000), 'hour')
  if (day < 30) return rtf.format(Math.round(-diff / 86_400_000), 'day')
  return rtf.format(Math.round(-diff / (86_400_000 * 30)), 'month')
}
