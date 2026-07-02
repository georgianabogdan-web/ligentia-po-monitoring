import { TEAM } from './clientConfig'

// ── Agent automation config ─────────────────────────────────────────────────
// Rules + guardrails behind the Agent Settings panel. Module-level shared store
// (same idiom as _approvalState / _shared* stores in App.tsx): the panel writes
// it, workflow views read it on render; panel components bump a local counter
// to re-render after they mutate it.

export type AutonomyLevel = 'off' | 'draft' | 'auto'

export const AUTONOMY_LBL: Record<AutonomyLevel, string> = {
  off:   'Off',
  draft: 'Draft for review',
  auto:  'Auto',
}

export type ParamFmt = 'money' | 'pct' | 'days' | 'units' | 'raw'
export const fmtParam = (fmt: ParamFmt | undefined, v: number | string): string => {
  if (typeof v === 'string') return v
  if (fmt === 'money') return `£${v.toLocaleString()}`
  if (fmt === 'pct')   return `${v}%`
  if (fmt === 'days')  return `${v} day${v === 1 ? '' : 's'}`
  if (fmt === 'units') return `${v.toLocaleString()} units`
  return String(v)
}

export interface RuleParam {
  key:     string
  options: (number | string)[]
  fmt?:    ParamFmt
}

export type SentencePart = string | { p: string }

export interface AutomationRuleDef {
  id:           string
  section:      'comms' | 'date' | 'reorder' | 'neg'
  title:        string
  summaryName:  string   // used in the plain-language autonomy summary
  sentence:     SentencePart[]
  params:       RuleParam[]
  defaults:     Record<string, number | string>
  defaultLevel: AutonomyLevel
  autoHint:     string   // what "Auto" means for this rule
  draftHint:    string   // what "Draft for review" means for this rule
}

export const RULE_SECTIONS: { id: AutomationRuleDef['section']; label: string; blurb: string }[] = [
  { id: 'comms',   label: 'Supplier communications', blurb: 'Emails the agent composes today — chases, pre-empts and confirmations.' },
  { id: 'date',    label: 'Date changes',            blurb: 'Supplier requests to move a confirmed delivery date.' },
  { id: 'reorder', label: 'Reorders',                blurb: 'Reorder recommendations flowing to manager approval and the Order App.' },
  { id: 'neg',     label: 'Cost-price negotiation',  blurb: 'How far the agent may negotiate before handing to a buyer.' },
]

export const AUTOMATION_RULES: AutomationRuleDef[] = [
  {
    id: 'auto-chase', section: 'comms',
    title: 'Chase overdue POs', summaryName: 'routine chasing',
    sentence: [
      'When a PO is overdue by ', { p: 'minDays' }, ' or more, send the chase email — if the order value is under ',
      { p: 'maxValue' }, ' and the supplier’s on-time rate is at least ', { p: 'minOTR' }, '.',
    ],
    params: [
      { key: 'minDays',  options: [1, 2, 3, 5, 7],                fmt: 'days'  },
      { key: 'maxValue', options: [5000, 10000, 25000, 50000],    fmt: 'money' },
      { key: 'minOTR',   options: [60, 70, 75, 80, 90],           fmt: 'pct'   },
    ],
    defaults: { minDays: 2, maxValue: 25000, minOTR: 75 },
    defaultLevel: 'auto',
    autoHint:  'The agent sends the chase itself and logs it — the card moves to “Awaiting reply”. Overdues of 14+ days always stay a human decision.',
    draftHint: 'The agent drafts the chase; you review and press Send.',
  },
  {
    id: 'auto-followup', section: 'comms',
    title: 'Follow up on unanswered chases', summaryName: 'chase follow-ups',
    sentence: [
      'If a supplier hasn’t replied ', { p: 'days' }, ' after a chase, send a follow-up automatically — up to ',
      { p: 'maxReminders' }, ' reminder(s) before escalating.',
    ],
    params: [
      { key: 'days',         options: [3, 5, 7, 10], fmt: 'days' },
      { key: 'maxReminders', options: [1, 2, 3],     fmt: 'raw'  },
    ],
    defaults: { days: 7, maxReminders: 2 },
    defaultLevel: 'draft',
    autoHint:  'Reminders go out on schedule without review; the escalation still comes to a human.',
    draftHint: 'Overdue-reply cards are flagged “No reply — overdue” and the follow-up waits for you.',
  },
  {
    id: 'auto-preempt', section: 'comms',
    title: 'Pre-empt predicted slips', summaryName: 'pre-empt emails',
    sentence: [
      'When a PO is predicted to slip with risk ', { p: 'band' },
      ' or higher, send a pre-empt email asking the supplier to confirm dates and quantities.',
    ],
    params: [{ key: 'band', options: ['Medium', 'High', 'Critical'] }],
    defaults: { band: 'High' },
    defaultLevel: 'draft',
    autoHint:  'Pre-empts send as soon as the prediction crosses the risk band — before the PO is late.',
    draftHint: 'The agent drafts the pre-empt on the “Predicted to slip” card; you review and send.',
  },
  {
    id: 'auto-fill-confirm', section: 'comms',
    title: 'Confirm quantities on fill risk', summaryName: 'quantity confirmations',
    sentence: [
      'When predicted under-fulfilment is at least ', { p: 'units' },
      ', send a quantity-confirmation request before production.',
    ],
    params: [{ key: 'units', options: [200, 500, 1000], fmt: 'units' }],
    defaults: { units: 500 },
    defaultLevel: 'draft',
    autoHint:  'Confirmation requests send automatically; supplier replies still come to you.',
    draftHint: 'The agent drafts the request on the “Predicted under-fulfilment” card; you review and send.',
  },
  {
    id: 'auto-accept-date', section: 'date',
    title: 'Accept small date changes', summaryName: 'small date changes',
    sentence: [
      'Accept supplier date-change requests of ', { p: 'maxSlip' },
      ' or less — only when no sales are at risk and it is the supplier’s first slip on the PO.',
    ],
    params: [{ key: 'maxSlip', options: [3, 5, 7, 14], fmt: 'days' }],
    defaults: { maxSlip: 7 },
    defaultLevel: 'off',
    autoHint:  'The agent confirms the new date with the supplier and updates the PO. Anything touching sales risk or key items still comes to you.',
    draftHint: 'The agent recommends accept/reject on the card; you make the call.',
  },
  {
    id: 'auto-reorder-push', section: 'reorder',
    title: 'Send small reorders to the Order App', summaryName: 'small reorders',
    sentence: [
      'Send reorder recommendations under ', { p: 'maxCost' },
      ' total cost straight to the Order App — skipping manager approval.',
    ],
    params: [{ key: 'maxCost', options: [10000, 20000, 30000, 50000], fmt: 'money' }],
    defaults: { maxCost: 30000 },
    defaultLevel: 'off',
    autoHint:  'Matching reorders are pushed immediately and logged; larger ones still queue for manager approval.',
    draftHint: 'All reorders queue for manager approval as today.',
  },
  {
    id: 'auto-counter', section: 'neg',
    title: 'Negotiate cost price within a band', summaryName: 'CP negotiation',
    sentence: [
      'Open negotiations at ', { p: 'openPct' }, ' below current cost price, auto-accept supplier counters within ',
      { p: 'acceptPct' }, ', and hand to a buyer after ', { p: 'maxRounds' }, ' unresolved rounds.',
    ],
    params: [
      { key: 'openPct',   options: [4, 6, 8],        fmt: 'pct' },
      { key: 'acceptPct', options: [4, 6, 8, 10],    fmt: 'pct' },
      { key: 'maxRounds', options: [2, 3, 4],        fmt: 'raw' },
    ],
    defaults: { openPct: 6, acceptPct: 8, maxRounds: 3 },
    defaultLevel: 'draft',
    autoHint:  'Counters within the band send without review; anything outside it escalates to a buyer.',
    draftHint: 'The agent drafts counters and flags escalations; a buyer sends every message.',
  },
]

const RULE_BY_ID: Record<string, AutomationRuleDef> = Object.fromEntries(AUTOMATION_RULES.map(r => [r.id, r]))

// ── Global guardrails ────────────────────────────────────────────────────────
export type GuardrailValue = number | string | boolean

export interface GuardrailDef {
  key:      string
  label:    string
  help:     string
  kind:     'select' | 'toggle'
  options?: (number | string)[]
  fmt?:     ParamFmt
}

export const GUARDRAILS: GuardrailDef[] = [
  { key: 'valueCeiling',         label: 'Never auto-act above',        kind: 'select', options: [25000, 50000, 100000, 250000], fmt: 'money', help: 'POs and reorders above this value always need a human, whatever the rules say.' },
  { key: 'priorityManual',       label: 'Key items always manual',     kind: 'toggle', help: 'POs flagged as key/priority items are never auto-actioned.' },
  { key: 'excludeDeteriorating', label: 'Skip deteriorating suppliers', kind: 'toggle', help: 'No autonomous actions for suppliers whose delivery trend is deteriorating.' },
  { key: 'dailyEmailCap',        label: 'Max auto-emails per day',     kind: 'select', options: [5, 10, 20, 50], fmt: 'raw', help: 'A hard daily ceiling across all communication rules.' },
  { key: 'escalateTo',           label: 'Escalations route to',        kind: 'select', options: [TEAM.manager1, TEAM.manager2, TEAM.manager3], fmt: 'raw', help: 'Who is notified when the agent hands off or a guardrail blocks an action.' },
]

const GUARDRAIL_DEFAULTS: Record<string, GuardrailValue> = {
  valueCeiling:         50000,
  priorityManual:       true,
  excludeDeteriorating: true,
  dailyEmailCap:        10,
  escalateTo:           TEAM.manager1,
}

// ── Shared store ─────────────────────────────────────────────────────────────
const _levels: Record<string, AutonomyLevel> = {}
const _params: Record<string, Record<string, number | string>> = {}
const _guards: Record<string, GuardrailValue> = {}
let _paused = false

export const ruleLevel    = (id: string): AutonomyLevel => _levels[id] ?? RULE_BY_ID[id].defaultLevel
export const setRuleLevel = (id: string, level: AutonomyLevel) => { _levels[id] = level }
export const ruleParam    = (id: string, key: string): number | string => _params[id]?.[key] ?? RULE_BY_ID[id].defaults[key]
export const setRuleParam = (id: string, key: string, v: number | string) => { _params[id] = { ..._params[id], [key]: v } }
export const guardrail    = (key: string): GuardrailValue => _guards[key] ?? GUARDRAIL_DEFAULTS[key]
export const setGuardrail = (key: string, v: GuardrailValue) => { _guards[key] = v }

export const automationPaused    = () => _paused
export const setAutomationPaused = (v: boolean) => { _paused = v }
export const ruleIsLive          = (id: string) => !_paused && ruleLevel(id) === 'auto'
export const autoRuleCount       = () => AUTOMATION_RULES.filter(r => ruleLevel(r.id) === 'auto').length

// ── Automation activity log ──────────────────────────────────────────────────
export interface AutomationLogEntry {
  time:    string   // ISO
  ruleId:  string
  tone:    'auto' | 'held' | 'draft'
  action:  string   // headline
  detail:  string   // which conditions were satisfied (or which guardrail blocked it)
  undo?:   { recIds: string[] }   // live-undoable (reorder pushes)
  undone?: boolean
}

// Seeded history — consistent with the default rule levels above (auto-chase on,
// comms drafting on) and with DEMO_TODAY (22 May 2026) in predict.ts.
export const AUTOMATION_LOG: AutomationLogEntry[] = [
  { time: '2026-05-22T08:03:00Z', ruleId: 'auto-chase',        tone: 'auto',  action: 'Chase sent to Summer Styles Ltd',              detail: '1 overdue PO · 3 days late · £8,400 order value · supplier on-time rate 84% — all guardrails satisfied.' },
  { time: '2026-05-22T08:03:00Z', ruleId: 'auto-chase',        tone: 'held',  action: 'Chase to Eastern Textiles Co held for review', detail: 'Supplier on-time rate 54% is below the 75% floor — drafted instead and queued in PO Monitoring.' },
  { time: '2026-05-21T16:40:00Z', ruleId: 'auto-preempt',      tone: 'draft', action: 'Pre-empt drafted for Urban Footwear',          detail: 'PO predicted to slip at customs (risk High, +6 days). Draft is on the card awaiting review.' },
  { time: '2026-05-21T08:02:00Z', ruleId: 'auto-chase',        tone: 'auto',  action: 'Chase sent to Coastal Apparel',                detail: '2 overdue POs · up to 4 days late · £11,200 combined · on-time rate 88% — all guardrails satisfied.' },
  { time: '2026-05-20T14:15:00Z', ruleId: 'auto-fill-confirm', tone: 'draft', action: 'Quantity confirmation drafted for Nordic Knitwear', detail: 'Predicted under-fulfilment ~780 units (fill ~86%). Draft awaiting review.' },
  { time: '2026-05-20T08:05:00Z', ruleId: 'auto-chase',        tone: 'held',  action: 'Chase held — key item',                        detail: 'Overdue PO is flagged as a key item; “Key items always manual” guardrail routed it to the review queue.' },
]

export const logAutomation = (e: AutomationLogEntry) => { AUTOMATION_LOG.unshift(e) }
