import { SUPPLIER_JOURNEY, SUPPLIER_FILL_RATE } from './poData'
export { SUPPLIER_JOURNEY, SUPPLIER_FILL_RATE }
// ─────────────────────────────────────────────────────────────────────────────
// predict.ts — forward-looking supplier + PO risk model.
//
// This file is the home of the PREDICTIVE repositioning: instead of flagging POs
// once they're already late, we forecast where each open PO is likely to slip
// BEFORE anything breaks.
//
// Everything here is a deterministic pure function over mock data — there is no
// trained model. The "predictions" are transparent arithmetic over the supplier
// journey-stage history, so they're easy to read and tweak. Anchored to a fixed
// DEMO_TODAY so the demo is stable regardless of the wall clock.
// ─────────────────────────────────────────────────────────────────────────────

// Fixed "now" for the prototype so predictions are deterministic.
export const DEMO_TODAY = new Date('2026-05-22')

// ── Supplier journey-stage model ──────────────────────────────────────────────
// Full order journey, in sequence. Pre-booking stages (sample, fit) are NOT
// instrumented in production data today — see isStageInstrumented / the
// isInstrumented flag normalised onto every StagePerf below.
export type JourneyStageKey =
  | 'sample' | 'fit' | 'booking' | 'handover'
  | 'shipment' | 'in_transit' | 'customs' | 'dc_arrival'

export interface StagePerf {
  onTime:         number   // historic on-time %, 0-100
  avgDelay:       number   // average delay in days; negative = early
  trend:          'improving' | 'stable' | 'worsening'
  isInstrumented?: boolean // tracked in production data today? (false for pre-booking)
}

export interface SupplierJourneyData {
  byStage: Record<JourneyStageKey, StagePerf>
  summary: string
  tier:    'Excellent' | 'Good' | 'Watch' | 'At risk' | 'Critical'
  history: { month: string; onTime: number; avgDelay: number; volume: number }[]
}

export const STAGE_LABELS: Record<JourneyStageKey, string> = {
  sample:      'Sample provided',
  fit:         'First-fit approved',
  booking:     'Booking placed',
  handover:    'Handover',
  shipment:    'Shipment departure',
  in_transit:  'In-transit',
  customs:     'Customs clearance',
  dc_arrival:  'Arrival to DC',
}
export const STAGE_ORDER: JourneyStageKey[] = ['sample', 'fit', 'booking', 'handover', 'shipment', 'in_transit', 'customs', 'dc_arrival']
export const PRE_BOOKING_STAGES: JourneyStageKey[] = ['sample', 'fit']

// Single source of truth for the instrumentation rule.
export function isStageInstrumented(stage: JourneyStageKey): boolean {
  return !PRE_BOOKING_STAGES.includes(stage)
}

// Seeded stage breakdown per supplier (keyed by supplier id, e.g. 'UL').
// The "Unilever-style" case (UL): 94% headline OTR but customs clearance weak +
// worsening. UF is a second "looks fine on headline (85%) but handover is weak"
// case. EL is excellent across every stage.

// Normalise the isInstrumented flag onto every stored StagePerf so the data model
// honestly carries it per-stage (pre-booking stages = false).
for (const sup of Object.values(SUPPLIER_JOURNEY)) {
  for (const stage of STAGE_ORDER) {
    sup.byStage[stage].isInstrumented = isStageInstrumented(stage)
  }
}

export const HEALTH_TIER_CFG: Record<SupplierJourneyData['tier'], { bg: string; text: string; border: string; ring: string }> = {
  'Excellent': { bg: 'bg-green-100',  text: 'text-green-800',   border: 'border-green-200',   ring: 'ring-green-200' },
  'Good':      { bg: 'bg-emerald-100',text: 'text-emerald-800', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  'Watch':     { bg: 'bg-amber-100',  text: 'text-amber-800',   border: 'border-amber-200',   ring: 'ring-amber-200' },
  'At risk':   { bg: 'bg-orange-100', text: 'text-orange-800',  border: 'border-orange-200',  ring: 'ring-orange-200' },
  'Critical':  { bg: 'bg-red-100',    text: 'text-red-800',     border: 'border-red-200',     ring: 'ring-red-200' },
}

// ── Structural input shapes ───────────────────────────────────────────────────
// Minimal shapes so this module doesn't depend on App.tsx's full PO / Supplier
// types (App's types are structurally compatible and pass straight in).
export interface RiskSupplier {
  id:                       string
  name:                     string
  onTimeRate:               number
  avgDelayDays:             number
  contractualLeadTimeDays:  number
}
export interface RiskPO {
  id:                string
  supplierId:        string
  status:            string
  expectedDelivery:  string   // ISO; the system's stated plan
  revisedDelivery?:  string
  freight:           'Sea' | 'Air'
  quantity:          number
  orderValue:        string   // e.g. "£12,400" (cost)
  category:          string
  targetStockDate?:  string   // when stock is needed to hit plan (input, not derived)
}

// ── Prediction output types ───────────────────────────────────────────────────
export type RiskBand = 'Low' | 'Medium' | 'High' | 'Critical'

export interface MissedSalesRisk {
  willMissSales:         boolean
  estimatedLostUnits:    number
  estimatedLostRevenue:  number
}

export interface PoPrediction {
  poId:                 string
  predictedRiskPct:     number          // 0-100
  riskBand:             RiskBand
  gatingStage:          JourneyStageKey | null
  gatingStageLabel:     string | null
  statedDeliveryDate:   string          // the system's date (untrusted)
  predictedLandingDate: string          // our forecast
  landingGapDays:       number          // predicted - stated (positive = later than plan)
  targetStockDate:      string
  missedSalesRisk:      MissedSalesRisk
  signals:              string[]        // human-readable "why this score"
  isOpen:               boolean
}

// ── Stage progression helpers ─────────────────────────────────────────────────
// Map a PO status to the index of the stage currently IN PROGRESS — stages from
// this index onward are the ones still remaining (and therefore still at risk).
function statusToStageIndex(status: string): number {
  switch (status) {
    case 'Sent to supplier':     return STAGE_ORDER.indexOf('booking')     // sent, awaiting booking confirmation
    case 'Acknowledged':         return STAGE_ORDER.indexOf('booking')     // booking about to be placed
    case 'On track':             return STAGE_ORDER.indexOf('shipment')    // in production, heading to ETD
    case 'Late DC booking':      return STAGE_ORDER.indexOf('handover')    // handover / booking-in pending
    case 'Date change required': return STAGE_ORDER.indexOf('shipment')    // ETD being renegotiated
    case 'Ex-factory delay':     return STAGE_ORDER.indexOf('shipment')    // stuck pre-departure
    case 'In Transit':           return STAGE_ORDER.indexOf('in_transit')
    case 'Partially Delivered':  return STAGE_ORDER.indexOf('dc_arrival')
    case 'Delivered':            return STAGE_ORDER.length                 // done
    default:                     return STAGE_ORDER.indexOf('shipment')
  }
}

export function isPoOpen(status: string): boolean {
  return status !== 'Delivered'
}

const STALLED_STATUSES = new Set(['Ex-factory delay', 'Late DC booking', 'Date change required'])

// Base duration (days) to COMPLETE each stage once entered. Transit depends on freight.
function stageBaseDuration(stage: JourneyStageKey, freight: 'Sea' | 'Air'): number {
  switch (stage) {
    case 'sample':     return 14
    case 'fit':        return 10
    case 'booking':    return 5
    case 'handover':   return 4
    case 'shipment':   return 6
    case 'in_transit': return freight === 'Air' ? 6 : 28
    case 'customs':    return 4
    case 'dc_arrival': return 3
  }
}

function parseISO(d: string): Date { return new Date(d + 'T00:00:00') }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function toISO(d: Date): string { return d.toISOString().slice(0, 10) }
function daysBetween(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 86400000) }
function parseMoney(v: string): number { return parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 }

// Remaining instrumented stages for a PO, with their perf records.
function remainingStages(po: RiskPO, supplier: RiskSupplier): { stage: JourneyStageKey; perf: StagePerf | null }[] {
  const startIdx = statusToStageIndex(po.status)
  const journey = SUPPLIER_JOURNEY[supplier.id]
  return STAGE_ORDER.slice(startIdx).map(stage => ({
    stage,
    perf: journey ? journey.byStage[stage] : null,
  }))
}

// ── computePredictedLanding ───────────────────────────────────────────────────
// Does NOT trust the system's stated delivery date. Starts from the stated plan
// and adds the supplier's *expected additional slip* on each remaining stage
// (avgDelay) — so a chronically-late supplier lands later than plan even if the
// PO isn't yet flagged. If the PO is already stalled and overdue, the lost time
// is pushed in on top. A PO whose sample has only just been approved can't land
// in two weeks because all the downstream stage durations still have to elapse.
export function computePredictedLanding(po: RiskPO, supplier: RiskSupplier, today: Date = DEMO_TODAY): string {
  const stated = parseISO(po.revisedDelivery ?? po.expectedDelivery)
  const remaining = remainingStages(po, supplier)

  // Expected additional slip = sum of remaining-stage average delays (≥0 contribution).
  let slip = 0
  for (const { perf } of remaining) {
    if (perf) slip += Math.max(0, perf.avgDelay)
  }

  // Stall penalty: an overdue, stalled PO has already burned time it must recover.
  let stallPenalty = 0
  if (STALLED_STATUSES.has(po.status)) {
    const overdue = Math.max(0, daysBetween(stated, today))
    stallPenalty = overdue
  }
  const fromStated = addDays(stated, Math.round(slip + stallPenalty))

  // Early-journey reality check: a PO that hasn't been booked yet (Sent to
  // supplier / Acknowledged) physically cannot land before today + the sum of all
  // remaining stage durations — so a sample-just-approved PO can't land in 2 weeks
  // by sea. This floor applies ONLY to pre-booking/pre-production statuses; an
  // in-production "On track" PO already has most of its journey behind it, so we
  // trust its stated date + the supplier's residual slip.
  const isEarly = po.status === 'Sent to supplier' || po.status === 'Acknowledged'
  if (isEarly) {
    const minDurationFromNow = remaining.reduce((s, { stage }) => s + stageBaseDuration(stage, po.freight), 0)
    const earliestRealistic = addDays(today, minDurationFromNow)
    if (earliestRealistic.getTime() > fromStated.getTime()) return toISO(earliestRealistic)
  }

  return toISO(fromStated)
}

// ── computePoRisk ─────────────────────────────────────────────────────────────
// Likelihood (0-100) this PO misses its plan. Deterministic function of:
//  (a) the supplier's weakest UPCOMING stage on-time % (the gating stage),
//  (b) how far into the journey the PO already is (more remaining = more exposure),
//  (c) any current slip (already overdue),
//  + small contributions from headline OTR and a worsening-trend kicker.
export function computePoRisk(po: RiskPO, supplier: RiskSupplier, today: Date = DEMO_TODAY): {
  pct: number; band: RiskBand; gatingStage: JourneyStageKey | null; signals: string[]
} {
  const journey = SUPPLIER_JOURNEY[supplier.id]
  const remaining = remainingStages(po, supplier).filter(r => r.perf && isStageInstrumented(r.stage)) as { stage: JourneyStageKey; perf: StagePerf }[]

  const signals: string[] = []

  // (a) weakest upcoming instrumented stage
  let gatingStage: JourneyStageKey | null = null
  let weakestOnTime = supplier.onTimeRate
  if (remaining.length > 0) {
    const worst = remaining.reduce((min, r) => r.perf.onTime < min.perf.onTime ? r : min)
    gatingStage = worst.stage
    weakestOnTime = worst.perf.onTime
  }
  const weakGap = Math.max(0, 100 - weakestOnTime)

  // (b) exposure — fraction of journey still ahead
  const startIdx = statusToStageIndex(po.status)
  const exposure = (STAGE_ORDER.length - startIdx) / STAGE_ORDER.length // 0..1
  const exposureMult = 0.6 + 0.4 * exposure

  // (c) current slip — only counts when the PO is actually flagged late/stalled.
  // A future-dated On-track PO carries no slip; an overdue Ex-factory PO does.
  const stated = parseISO(po.revisedDelivery ?? po.expectedDelivery)
  const daysOverdue = STALLED_STATUSES.has(po.status) ? Math.max(0, daysBetween(stated, today)) : 0
  const slipPenalty = Math.min(30, daysOverdue * 1.5)

  // tiering kicker — a single sub-par upcoming stage should register even when the
  // headline OTR looks healthy (the core "94% hides a weak stage" insight).
  const tierKicker = weakestOnTime < 80 ? 12 : weakestOnTime < 88 ? 6 : 0
  const headlineFactor = (100 - supplier.onTimeRate) * 0.12
  const gatingTrend = gatingStage && journey ? journey.byStage[gatingStage].trend : 'stable'
  const trendBonus = gatingTrend === 'worsening' ? 10 : 0

  let pct = weakGap * 1.1 * exposureMult + slipPenalty + headlineFactor + tierKicker + trendBonus
  pct = Math.max(0, Math.min(100, Math.round(pct)))

  // ── signals ("why this score") ──
  if (gatingStage) {
    const lbl = STAGE_LABELS[gatingStage]
    if (weakestOnTime < 88) signals.push(`${supplier.name} ${lbl.toLowerCase()} on-time only ${weakestOnTime}%`)
    if (gatingTrend === 'worsening') signals.push(`${lbl} is trending worse for this supplier`)
  }
  if (daysOverdue > 0) signals.push(`Already ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} behind plan`)
  if (exposure >= 0.6) signals.push(`Early in the journey — ${STAGE_ORDER.length - startIdx} stages still to clear`)
  if (supplier.onTimeRate >= 90 && weakestOnTime < 85) signals.push(`Headline OTR ${supplier.onTimeRate}% masks a weak upcoming stage`)
  if (supplier.onTimeRate < 70) signals.push(`Structurally unreliable supplier (${supplier.onTimeRate}% overall OTR)`)
  if (signals.length === 0) signals.push('All upcoming stages tracking on plan')

  const band: RiskBand = pct >= 75 ? 'Critical' : pct >= 55 ? 'High' : pct >= 30 ? 'Medium' : 'Low'
  return { pct, band, gatingStage, signals }
}

// ── computeMissedSales ────────────────────────────────────────────────────────
// Compares the predicted landing date against the date stock is needed.
export function computeMissedSales(po: RiskPO, predictedLandingISO: string, targetStockISO: string): MissedSalesRisk {
  const predicted = parseISO(predictedLandingISO)
  const target = parseISO(targetStockISO)
  const lateDays = daysBetween(target, predicted)
  if (lateDays <= 0) return { willMissSales: false, estimatedLostUnits: 0, estimatedLostRevenue: 0 }

  const weeksLate = lateDays / 7
  // Up to 50% of the order is unsellable if it lands well past the needed date.
  const lostFraction = Math.min(0.5, weeksLate * 0.18)
  const estimatedLostUnits = Math.round(po.quantity * lostFraction)
  const unitCost = po.quantity > 0 ? parseMoney(po.orderValue) / po.quantity : 0
  const retailPerUnit = unitCost * 2.4 // typical keystone-plus apparel markup
  const estimatedLostRevenue = Math.round(estimatedLostUnits * retailPerUnit)
  return { willMissSales: true, estimatedLostUnits, estimatedLostRevenue }
}

// Default target stock date when a PO doesn't carry an explicit one: a week of
// headroom after the planned delivery (stock needed within ~1 week of the plan).
export function defaultTargetStockDate(po: RiskPO): string {
  return toISO(addDays(parseISO(po.expectedDelivery), 7))
}

// ── buildPrediction ───────────────────────────────────────────────────────────
// Bundles the whole forward-looking prediction object for one PO.
export function buildPrediction(po: RiskPO, supplier: RiskSupplier, today: Date = DEMO_TODAY): PoPrediction {
  const open = isPoOpen(po.status)
  const stated = po.revisedDelivery ?? po.expectedDelivery
  const predictedLandingDate = computePredictedLanding(po, supplier, today)
  const { pct, band, gatingStage, signals } = computePoRisk(po, supplier, today)
  const targetStockDate = po.targetStockDate ?? defaultTargetStockDate(po)
  const missedSalesRisk = computeMissedSales(po, predictedLandingDate, targetStockDate)
  const landingGapDays = daysBetween(parseISO(stated), parseISO(predictedLandingDate))

  return {
    poId:                 po.id,
    predictedRiskPct:     pct,
    riskBand:             band,
    gatingStage,
    gatingStageLabel:     gatingStage ? STAGE_LABELS[gatingStage] : null,
    statedDeliveryDate:   stated,
    predictedLandingDate,
    landingGapDays,
    targetStockDate,
    missedSalesRisk,
    signals,
    isOpen:               open,
  }
}

export const RISK_BAND_CFG: Record<RiskBand, { bg: string; text: string; border: string; dot: string }> = {
  Low:      { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500' },
  Medium:   { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-400' },
  High:     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  Critical: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
}

// ════════════════════════════════════════════════════════════════════════════
// FILL RATE — a SECOND, independent supplier-risk dimension alongside slip risk.
// Measures order completeness: units delivered ÷ units ordered. Suppliers often
// ship less than ordered (raise a PO for 100, receive 70) and rarely flag it in
// advance, so — exactly like slip risk — we infer it from history rather than
// trust a confirmation. Buyer-facing language only: "fill rate", "order
// completeness", "under-fulfilment". (The underlying statistical concept is
// yield volatility — that phrase stays in code comments, never in a UI field.)
//
// IMPORTANT: this is PREDICTION ONLY. Nothing here computes or applies an
// "order more to compensate" gross-up — reorder quantities are deliberately
// untouched in this iteration.
// ════════════════════════════════════════════════════════════════════════════

// Buyer-friendly consistency label derived from the spread (volatility) — a
// steady 90% is very different from an erratic 90%, so we surface the spread.
export type FillConsistency = 'steady' | 'variable' | 'erratic'
export function fillConsistency(volatilityPts: number): FillConsistency {
  return volatilityPts <= 5 ? 'steady' : volatilityPts <= 10 ? 'variable' : 'erratic'
}

// Historic order completeness for a supplier, across past (closed) POs.
export interface SupplierFillHistory {
  avgFillRatePct:   number   // units delivered ÷ ordered, averaged across past POs (0-100)
  fillVolatilityPts: number  // spread of fill rate in percentage points (the yield-volatility measure)
  trend:            'improving' | 'stable' | 'worsening'
  posObserved:      number   // # of past POs the average is based on
  worstRecentPct:   number   // worst fill seen in recent orders (drives signals)
}

// Seeded distribution (see summary at the bottom of this block). Independent of
// the lateness/OTR signal: e.g. UF is on-time (85% OTR) yet a chronic
// under-fulfiller (~74% fill), and UL looks fine on timing (94% OTR) but only
// ~85% complete and worsening.
const DEFAULT_FILL_HISTORY: SupplierFillHistory = { avgFillRatePct: 96, fillVolatilityPts: 3, trend: 'stable', posObserved: 8, worstRecentPct: 92 }
export function supplierFillHistory(supplierId: string): SupplierFillHistory {
  return SUPPLIER_FILL_RATE[supplierId] ?? DEFAULT_FILL_HISTORY
}

// ── Per-PO fill-rate prediction (open, not-yet-delivered POs) ─────────────────
export interface FillPrediction {
  poId:                    string
  orderedUnits:            number
  predictedFillRatePct:    number   // 0-100, expected order completeness
  predictedShortfallUnits: number   // ordered × expected shortfall (PREDICTION ONLY — no gross-up)
  fillRiskBand:            RiskBand
  consistency:             FillConsistency
  signals:                 string[] // human-readable "why this score"
  // Provenance — surfaced so the UI can label it illustrative/inferred, exactly
  // like slip predictions. Suppliers rarely communicate shortfall ahead of time.
  inferred:                true     // pattern-based, derived from history
  supplierConfirmed:       false    // never confirmed by the supplier in advance
  isOpen:                  boolean
}

// computeFillRisk — a transparent pure function (tweakable for demos). Mirrors
// computePoRisk but on the QUANTITY axis (delivered vs ordered) instead of timing.
export function computeFillRisk(po: RiskPO, supplier: RiskSupplier): FillPrediction {
  const hist = supplierFillHistory(supplier.id)
  const ordered = po.quantity

  // Point estimate: the supplier's historic average, nudged by trend. The spread
  // (volatility) feeds the risk BAND below, not the point estimate.
  const trendAdj = hist.trend === 'worsening' ? -3 : hist.trend === 'improving' ? 2 : 0
  const predictedFillRatePct = Math.max(0, Math.min(100, Math.round(hist.avgFillRatePct + trendAdj)))
  const predictedShortfallUnits = Math.max(0, Math.round(ordered * (1 - predictedFillRatePct / 100)))

  // Risk = how far below 100% we expect to land, widened by an erratic spread and
  // a worsening trend. A consistent 90% is lower risk than an erratic 90%.
  const shortfallPct = 100 - predictedFillRatePct
  const riskScore = shortfallPct + hist.fillVolatilityPts * 0.6 + (hist.trend === 'worsening' ? 8 : 0)
  const fillRiskBand: RiskBand = riskScore >= 35 ? 'Critical' : riskScore >= 22 ? 'High' : riskScore >= 12 ? 'Medium' : 'Low'

  const consistency = fillConsistency(hist.fillVolatilityPts)
  const signals: string[] = []
  signals.push(`Supplier averaged ${hist.avgFillRatePct}% fill over the last ${hist.posObserved} POs`)
  if (consistency === 'erratic') signals.push(`Fill rate is erratic (±${hist.fillVolatilityPts}pts) — wide downside on any single order`)
  else if (consistency === 'variable') signals.push(`Fill rate varies (±${hist.fillVolatilityPts}pts) order to order`)
  if (hist.trend === 'worsening') signals.push('Order completeness is trending worse over recent orders')
  if (hist.worstRecentPct <= 80) signals.push(`Recent orders under-delivered to as low as ${hist.worstRecentPct}%`)
  if (supplier.onTimeRate >= 85 && hist.avgFillRatePct < 85) signals.push(`On-time (${supplier.onTimeRate}% OTR) but under-fills — a separate risk from lateness`)
  if (predictedShortfallUnits > 0) signals.push(`Expect ~${predictedShortfallUnits.toLocaleString('en-GB')} of ${ordered.toLocaleString('en-GB')} units short (~${predictedFillRatePct}% fill)`)
  if (signals.length === 1 && fillRiskBand === 'Low') signals.push('Order completeness tracking on plan')

  return {
    poId: po.id,
    orderedUnits: ordered,
    predictedFillRatePct,
    predictedShortfallUnits,
    fillRiskBand,
    consistency,
    signals,
    inferred: true,
    supplierConfirmed: false,
    isOpen: isPoOpen(po.status),
  }
}

// ── Closed-PO fill outcomes (delivered POs) ───────────────────────────────────
// Real history so Supplier Health can show what actually happened, not only
// predictions. Deterministic per-PO derivation (hash of the PO id, no RNG) so it
// is reproducible: it lands within the supplier's historic [avg ± volatility]
// band. Use only for delivered/closed POs.
export interface FillOutcome {
  poId:          string
  orderedUnits:  number
  receivedUnits: number
  fillRatePct:   number   // received ÷ ordered (0-100)
  shortfallUnits: number
}
export function computeFillOutcome(po: RiskPO, supplier: RiskSupplier): FillOutcome {
  const hist = supplierFillHistory(supplier.id)
  const ordered = po.quantity
  const seed = po.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const span = hist.fillVolatilityPts * 2 + 1
  const jitter = (seed % span) - hist.fillVolatilityPts   // deterministic [-vol, +vol]
  const fillRatePct = Math.max(40, Math.min(100, hist.avgFillRatePct + jitter))
  const receivedUnits = Math.round(ordered * fillRatePct / 100)
  return { poId: po.id, orderedUnits: ordered, receivedUnits, fillRatePct, shortfallUnits: Math.max(0, ordered - receivedUnits) }
}
