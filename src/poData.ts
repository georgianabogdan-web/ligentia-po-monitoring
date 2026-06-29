// ─────────────────────────────────────────────────────────────────────────────
// LIGENTIA PO Monitoring — data layer (full 12-month dataset).
// Data is loaded from ligentiaData.json, generated from Ligentia's Snowflake
// warehouse (PLC_PROD_*, Nisbets 44187): ~4.7k real POs across ~230 suppliers,
// last 12 months. Supplier metrics, journey-stage and fill profiles are derived
// from each supplier's real on-time/delay history. Date-changes are real
// (OriginalDueDeliveryDate → DueDeliveryDate / ExFactory slips). Chase-thread
// events are generated for high-value flagged POs only (not hand-authored at
// scale). Regenerate with ../gen_full.py against a fresh extraction.
// ─────────────────────────────────────────────────────────────────────────────
import data from './ligentiaData.json'
import type { Supplier, PO, POEvent, ActionItem, InquiryThread, SupplierSession, InvAuditEntry, TriggerMessage, AgentLogEntry } from './App'
import type { SupplierJourneyData, SupplierFillHistory } from './predict'

export const SUPPLIERS            = data.suppliers as unknown as Supplier[]
export const SUPPLIER_EMAILS      = data.supplierEmails as Record<string, string>
export const ALL_POS              = data.pos as unknown as PO[]
export const SEED_PO_EVENTS       = data.events as unknown as Record<string, POEvent[]>
export const STATIC_KANBAN_ITEMS  = data.kanban as unknown as ActionItem[]
export const SUPPLIER_JOURNEY     = data.journey as unknown as Record<string, SupplierJourneyData>
export const SUPPLIER_FILL_RATE   = data.fill as unknown as Record<string, SupplierFillHistory>

// Cross-tab / negotiation links have no source in the full PLC dataset.
export const PO_PRODUCT_MAP: Record<string, string> = {}
export const NEG_PO_MAP: Record<string, string> = {}

// ── Seed content ported from upstream App.tsx (now upstream poData.ts) so the
// extracted data-layer contract resolves on the Ligentia dataset. Demo-keyed.
// Only a handful of products have a seeded Promo % — others show "—"
export const SEEDED_PROMO_PCT: Record<string, number> = {
  'INV-001': 22,  // Hydrating Face Serum (Beauty)
  'INV-003': 14,  // Vitamin C Moisturiser (Beauty)
  'INV-007': 35,  // Floral Midi Dress (Clothing)
  'INV-010': 28,  // Jersey Maxi Dress (Clothing)
  'INV-013': 20,  // Block Heel Ankle Boots (Footwear)
  'INV-018': 12,  // Leather Crossbody Bag (Accessories)
}

export const SEEDED_INV_AUDIT: Record<string, InvAuditEntry[]> = {
  'INV-001': [
    { id: 'sa1', user: 'Sarah Chen', initial: 'SC', date: '2026-04-10T14:30:00Z', changes: [{ field: 'MOQ Qty', oldVal: '400 units', newVal: '500 units' }], reason: 'Q2 supplier renegotiation with L\'Oréal UK — new MOQ agreed.' },
    { id: 'sa2', user: 'James Wright', initial: 'JW', date: '2026-03-22T09:15:00Z', changes: [{ field: 'FWC Range', oldVal: '3–6 wks', newVal: '4–8 wks' }], reason: 'Increased cover target ahead of peak season.' },
  ],
  'INV-005': [
    { id: 'sa3', user: 'Priya Sharma', initial: 'PS', date: '2026-04-18T11:00:00Z', changes: [{ field: 'MOQ Grouping', oldVal: 'SKU', newVal: 'Style × Colour' }], reason: 'Consolidating orders by colour to reduce freight cost.' },
    { id: 'sa4', user: 'Sarah Chen', initial: 'SC', date: '2026-04-02T10:30:00Z', changes: [{ field: 'MOQ Qty', oldVal: '200 units', newVal: '300 units' }], reason: 'Footwear buyer aligned with supplier on new pack size.' },
  ],
  'INV-009': [
    { id: 'sa5', user: 'James Wright', initial: 'JW', date: '2026-04-20T16:00:00Z', changes: [{ field: 'FWC Range', oldVal: '2–5 wks', newVal: '3–7 wks' }, { field: 'MOQ Qty', oldVal: '150 units', newVal: '200 units' }], reason: 'Menswear Q2 restock ahead of summer — extended cover window agreed with buyer.' },
  ],
}

const SEED_R1_HYALURONIC = `Subject: CP Inquiry – Hyaluronic Acid Toner – Wk 18

Dear Unilever Ltd team,

We are reviewing our reorder position for Hyaluronic Acid Toner (SKU: SKU-REC002) and would like to discuss cost price for the upcoming replenishment.

Current agreed CP: £9.50 per unit

Given the 2,840-unit commitment and our forward plan for this line, we'd like to align on £8.93 per unit for this order.

Please confirm your best CP and any MOQ conditions by 5 May 2026.

Best regards,
[Buyer Name]`

const SEED_R1_COTTONTEE = `Subject: CP Inquiry – Striped Cotton Tee – Wk 18

Dear Next Sourcing team,

We are reviewing our reorder position for Striped Cotton Tee (SKU: SKU-REC006) and would like to discuss cost price for the upcoming replenishment.

Current agreed CP: £14.50 per unit

Given the 3,130-unit commitment and our forward plan for this line, we'd like to align on £13.63 per unit for this order.

Delivery required by ex-factory date: 27 May 2026

Please confirm your best CP and any MOQ conditions by 5 May 2026.

Best regards,
[Buyer Name]`

export const SEEDED_THREADS: Record<string, InquiryThread> = {
  'REC-002': {
    recId: 'REC-002', supplierId: 'Unilever Ltd', status: 'replied', scenario: 'accepted',
    rounds: [{
      roundNumber: 1, sentAt: '2026-04-29',
      emailBody: SEED_R1_HYALURONIC, requestedCP: 8.93,
      supplierReply: {
        receivedAt: '2026-04-29', offeredCP: 8.97, moqOffered: 500,
        leadTimeWeeks: 4, deliveryWindow: '28 May – 11 Jun 2026',
        accepted: true, scenario: 'accepted',
        rawText: `Dear Buying Team,\n\nThank you for your inquiry regarding Hyaluronic Acid Toner.\n\nWe are pleased to confirm acceptance of your terms:\n• CP: £8.97 per unit\n• MOQ: 500 units\n• Lead time: 4 weeks\n• Delivery: 28 May – 11 Jun 2026\n\nPlease proceed with the order and we will prioritise production scheduling.\n\nBest regards,\nUnilever Ltd`,
      },
    }],
    agreedCP: null, agreedMOQ: null, flaggedReason: null, internalNotes: '',
  },
  'REC-006': {
    recId: 'REC-006', supplierId: 'Next Sourcing', status: 'replied', scenario: 'counter',
    rounds: [{
      roundNumber: 1, sentAt: '2026-04-30',
      emailBody: SEED_R1_COTTONTEE, requestedCP: 13.63,
      supplierReply: {
        receivedAt: '2026-05-01', offeredCP: 14.20, moqOffered: 300,
        leadTimeWeeks: 5, deliveryWindow: '2 Jun – 16 Jun 2026',
        accepted: false, scenario: 'counter',
        rawText: `Dear Buying Team,\n\nThank you for your inquiry regarding Striped Cotton Tee (SKU-REC006).\n\nWe appreciate our ongoing partnership and have reviewed your CP request carefully. Given current cotton market conditions and raw material costs, we are unfortunately unable to meet the target of £13.63 at this time.\n\nWe are pleased to offer the following:\n• CP: £14.20 per unit\n• MOQ: 300 units\n• Lead time: 5 weeks\n• Delivery: 2 Jun – 16 Jun 2026\n\nWe believe this reflects a fair position given current input costs, and we remain open to discussing volume commitments that could help us move closer to your target.\n\nBest regards,\nNext Sourcing`,
      },
    }],
    agreedCP: null, agreedMOQ: null, flaggedReason: null, internalNotes: '',
  },
}

// ── Seeded supplier sessions (bulk negotiations across multiple SKUs) ────────
export const SEEDED_SUPPLIER_SESSIONS: SupplierSession[] = [
  // Next Sourcing — 3 lines, round 1 reply received (mostly counter)
  {
    id: 'session-next-001',
    supplierId: 'Next Sourcing',
    threadIds: ['REC-004', 'REC-006', 'REC-008'],
    status: 'open',
    createdAt: '2026-05-12T09:00:00Z',
    rounds: [{
      id: 'sr-next-r1',
      roundNumber: 1,
      outbound: {
        sentAt:  '2026-05-12T09:30:00Z',
        subject: 'Rebuy proposal — 3 SKUs · Week 20',
        body: `Dear Next Sourcing Team,\n\nWe're proposing the following rebuys for 30 Jun ex-fty:\n\n• REC-004 Wrap Midi Dress — 3,200 units · £20.84 · MOQ 250 · ex-fty 30 Jun\n• REC-006 Striped Cotton Tee — 4,800 units · £13.63 · MOQ 300 · ex-fty 30 Jun\n• REC-008 Ruched Bodycon Dress — 2,400 units · £18.27 · MOQ 250 · ex-fty 30 Jun\n\nPlease confirm acceptance or respond with revised terms by Fri 16 May.\n\nBest regards,\nDebenhams Buying`,
        recipients: ['orders@nextsourcing.co.uk'],
      },
      inbound: {
        receivedAt: '2026-05-15T14:20:00Z',
        summary:    'Next Sourcing accepted 1 of 3 lines at proposed CP. 2 lines countered with average +£0.55 citing cotton market pressure. Ex-fty held at 30 Jun across all.',
        fullReply:  `Dear Buying Team,\n\nThank you for the consolidated rebuy proposal. Our position per line:\n\n• Wrap Midi Dress — accepted at £20.84 · MOQ 250 · ex-fty 30 Jun confirmed\n• Striped Cotton Tee — unable to meet £13.63; offering £14.20 (firm) · MOQ 300 · ex-fty 30 Jun\n• Ruched Bodycon Dress — unable to meet £18.27; offering £18.95 · MOQ 250 · ex-fty 30 Jun\n\nCotton input costs have risen ~4% since our last quote; we've absorbed where possible. Happy to discuss further on the two countered lines.\n\nBest regards,\nNext Sourcing`,
        perThreadResponses: [
          { threadId: 'REC-004', offered: { cp: 20.84, moq: 250, exFty: '2026-06-30' }, status: 'accepted' },
          { threadId: 'REC-006', offered: { cp: 14.20, moq: 300, exFty: '2026-06-30' }, status: 'countered', notes: 'Cotton input pressure' },
          { threadId: 'REC-008', offered: { cp: 18.95, moq: 250, exFty: '2026-06-30' }, status: 'countered', notes: 'Cotton input pressure' },
        ],
      },
    }],
  },
  // ASOS Brands — 3 lines, round 2 in progress (we counter-proposed; awaiting reply)
  {
    id: 'session-asos-001',
    supplierId: 'ASOS Brands',
    threadIds: ['REC-005', 'REC-007', 'REC-009'],
    status: 'open',
    createdAt: '2026-05-06T11:00:00Z',
    rounds: [
      {
        id: 'sr-asos-r1',
        roundNumber: 1,
        outbound: {
          sentAt:  '2026-05-06T11:15:00Z',
          subject: 'Rebuy proposal — 3 SKUs · Week 19',
          body:    'Round 1 proposal sent — see consolidated rebuy.',
          recipients: ['wholesale@asosbrands.co.uk'],
        },
        inbound: {
          receivedAt: '2026-05-08T16:40:00Z',
          summary:    'ASOS accepted 2 of 3 lines. 1 line countered +£0.70.',
          fullReply:  `Dear Buying Team,\n\nThank you for the rebuy. Tailored Suit Jacket and Oversized Linen Shirt accepted at proposed terms. Bamboo Lounge Set — we cannot hold £15.04 at the requested 2,200 units; offering £15.74 firm.\n\nBest regards,\nASOS Brands`,
          perThreadResponses: [
            { threadId: 'REC-005', offered: { cp: 31.78, moq: 200, exFty: '2026-07-05' }, status: 'accepted' },
            { threadId: 'REC-007', offered: { cp: 16.43, moq: 200, exFty: '2026-07-05' }, status: 'accepted' },
            { threadId: 'REC-009', offered: { cp: 15.74, moq: 250, exFty: '2026-07-05' }, status: 'countered' },
          ],
        },
      },
      {
        id: 'sr-asos-r2',
        roundNumber: 2,
        outbound: {
          sentAt:  '2026-05-15T10:00:00Z',
          subject: 'Counter offer — 1 line · 15 May',
          body:    `Dear ASOS Brands Team,\n\nThanks for confirming the two accepted lines. On Bamboo Lounge Set: we can meet you at £15.39 (midpoint of your £15.74 and our original £15.04) — please confirm by Tue 19 May so we can lock the 5 Jul ex-fty.\n\nBest regards,\nDebenhams Buying`,
          recipients: ['wholesale@asosbrands.co.uk'],
        },
        inbound: null,
      },
    ],
  },
  // L'Oréal UK — 2 lines, round 1 sent, awaiting reply
  {
    id: 'session-loreal-001',
    supplierId: "L'Oréal UK",
    threadIds: ['REC-001', 'REC-003'],
    status: 'open',
    createdAt: '2026-05-18T08:30:00Z',
    rounds: [{
      id: 'sr-loreal-r1',
      roundNumber: 1,
      outbound: {
        sentAt:  '2026-05-18T09:00:00Z',
        subject: 'Rebuy proposal — 2 SKUs · Week 21',
        body: `Dear L'Oréal UK Team,\n\nWe're proposing the following rebuys for 28 Jun ex-fty:\n\n• REC-001 Retinol Night Cream — 3,060 units · £11.09 · MOQ 500 · ex-fty 28 Jun\n• REC-003 Brightening Eye Cream — 2,980 units · £10.15 · MOQ 500 · ex-fty 28 Jun\n\nPlease confirm acceptance or respond with revised terms by Thu 22 May.\n\nBest regards,\nDebenhams Buying`,
        recipients: ['orders@loreal.co.uk'],
      },
      inbound: null,
    }],
  },
  // Unilever Ltd — single-SKU session, awaiting reply
  {
    id: 'session-unilever-001',
    supplierId: 'Unilever Ltd',
    threadIds: ['REC-002'],
    status: 'open',
    createdAt: '2026-04-29T08:00:00Z',
    rounds: [{
      id: 'sr-unilever-r1',
      roundNumber: 1,
      outbound: {
        sentAt:  '2026-04-29T08:30:00Z',
        subject: 'Rebuy proposal — 1 SKU · Week 18',
        body:    `Dear Unilever Ltd Team,\n\nWe're proposing 2,840 units of Hyaluronic Acid Toner at £8.93 CP, MOQ 500, ex-fty 28 May.\n\nBest regards,\nDebenhams Buying`,
        recipients: ['orders@unilever.co.uk'],
      },
      inbound: {
        receivedAt: '2026-04-29T15:00:00Z',
        summary:    'Unilever accepted at £8.97 (very slight uplift). Terms confirmed.',
        fullReply:  `Dear Buying Team,\n\nThank you for your inquiry regarding Hyaluronic Acid Toner.\n\nWe are pleased to confirm acceptance of your terms:\n• CP: £8.97 per unit\n• MOQ: 500 units\n• Lead time: 4 weeks\n• Delivery: 28 May – 11 Jun 2026\n\nPlease proceed with the order and we will prioritise production scheduling.\n\nBest regards,\nUnilever Ltd`,
        perThreadResponses: [
          { threadId: 'REC-002', offered: { cp: 8.97, moq: 500, exFty: '2026-05-28' }, status: 'accepted' },
        ],
      },
    }],
  },
]

export const TRIGGER_MESSAGES: Record<string, TriggerMessage> = {
  'NK-at_risk': {
    sender: 'Nordic Knitwear', senderEmail: 'production@nordicknitwear.dk',
    timestamp: '2026-04-03T14:22:00Z',
    body: 'Hi Debenhams team,\n\nI\'m writing to inform you of an unavoidable delay to PO-2901 (Cotton Knit Jumpers). Our primary yarn supplier in Denmark has experienced a mechanical failure at their main spinning facility, which has pushed our yarn receipt back by 10 days.\n\nWe are currently forecasting a revised ex-factory date of 27 April (was 20 April). We have explored air freight but the cost uplift is not viable on this margin. We are committed to no further slippage beyond 27 April and will provide weekly production updates.\n\nKind regards,\nOliver Hansen\nNordic Knitwear Production',
    agentSummary: 'Requested 7-day push on PO-2901 (20 Apr → 27 Apr). Cited mechanical failure at primary yarn mill in Denmark — yarn receipt delayed 10 days. Air freight ruled out on cost. No QC concerns flagged.',
  },
  'TB-at_risk': {
    sender: 'Trendy Boots UK', senderEmail: 'orders@trendyboots.co.uk',
    timestamp: '2026-04-05T09:47:00Z',
    body: 'Dear Debenhams Buying Team,\n\nPlease be advised that PO-2845 (Ankle Strap Heels) will require a revised delivery date. Our factory in Portugal is experiencing a capacity constraint due to a larger-than-expected spring order from another retailer that has taken priority on the production line.\n\nWe are now forecasting delivery of 6 May (original: 22 April). We apologise for the inconvenience and are working to recover as much lead time as possible. We will confirm the final ex-factory date no later than 10 April.\n\nBest regards,\nSophia Turner\nTrendy Boots UK',
    agentSummary: 'Requested 14-day push on PO-2845 (22 Apr → 6 May). Cited factory capacity constraint in Portugal — spring order from another retailer took production priority. Final ex-factory date to be confirmed by 10 Apr.',
  },
  'UF-late_dc': {
    sender: 'Urban Footwear', senderEmail: 'logistics@urbanfootwear.com',
    timestamp: '2026-04-18T11:15:00Z',
    body: 'Hi team,\n\nQuick update on PO-2976 (Canvas Lo-Top Trainers). Goods are packed and ready. We are targeting dispatch on 30 April via our usual freight forwarder (DHL Supply Chain). However, we have not yet received the final booking confirmation from DHL — we\'re chasing and expect to confirm within 48 hours.\n\nPlease confirm your DC receiving slot is still available for w/c 14 May. Let us know if there are any issues.\n\nThanks,\nMarcus Reid\nUrban Footwear Logistics',
    agentSummary: 'Goods packed for PO-2976, targeting 30 Apr dispatch via DHL Supply Chain. Freight booking not yet confirmed — expecting within 48 hrs. Requesting DC slot confirmation for w/c 14 May.',
  },
  'ET-late_dc': {
    sender: 'Eastern Textiles Co', senderEmail: 'dispatch@easterntextiles.co.uk',
    timestamp: '2026-05-05T10:00:00Z',
    body: 'Hi team,\n\nJust to update you on PO-3001 (Summer Polo Shirts). Goods are currently being packed at our warehouse. We have not yet received a confirmed freight booking slot from our logistics partner — we are still working on it. We will update you once confirmed.\n\nBest,\nEastern Textiles',
    agentSummary: 'ET has not confirmed DC booking for PO-3001 (Summer Polo Shirts). Goods not yet fully packed. No booking reference provided. This is the second late-booking incident from ET this quarter.',
  },
  'SS-overdue': {
    sender: 'Summer Styles Ltd', senderEmail: 'production@summerstyles.co.uk',
    timestamp: '2026-04-10T16:03:00Z',
    body: 'Dear Debenhams team,\n\nI wanted to give you an early heads-up regarding PO-2891 (Floral Maxi Dress). We have encountered a fabric QC failure — a dye lot inconsistency was identified during final inspection, affecting approximately 40% of the batch.\n\nThe affected fabric has been quarantined and we are sourcing a replacement dye lot. This will add a minimum of 14 days to our production schedule. We understand the impact this has on your intake planning and are doing everything possible to minimise further delay.\n\nWe will provide a revised ex-factory date by end of week.\n\nSincerely,\nAmelia Clarke\nSummer Styles Production',
    agentSummary: 'PO-2891 delayed by fabric QC failure — dye lot inconsistency in ~40% of batch. Affected fabric quarantined, replacement being sourced. Minimum 14-day impact. Revised ex-factory date due end of this week. No dispatch imminent.',
  },
}

export const AGENT_LOG: AgentLogEntry[] = [
  { time: '2026-05-01T11:30:00Z', type: 'low_confidence', message: 'Supplier reply from Next Sourcing (Striped Cotton Tee — REC-006) is non-committal. No specific CP proposed. Agent cannot assess margin impact. Flagged for buyer review.' },
  { time: '2026-04-22T08:00:00Z', type: 'scan',        message: 'Morning scan complete. 31 open POs reviewed. 3 overdue, 2 date change requests, 4 pre-dispatch chases identified.' },
  { time: '2026-04-22T08:02:00Z', type: 'at_risk',     message: 'PO-2845 (Ankle Strap Heels, Trendy Boots UK) flagged — revised delivery now 9 May, 17-day extension requested.' },
  { time: '2026-04-22T08:03:00Z', type: 'at_risk',     message: 'PO-2901 (Cotton Knit Jumpers, Nordic Knitwear) flagged — revised delivery 18 May requested, 28-day extension.' },
  { time: '2026-04-21T14:30:00Z', type: 'chase_draft', message: 'Chase email drafted for Eastern Textiles Co — 2 overdue POs (PO-2756, PO-2834). Awaiting buyer review.' },
  { time: '2026-04-21T09:15:00Z', type: 'scorecard',   message: 'Supplier scorecard updated: Eastern Textiles Co on-time rate down to 54% (was 58% last quarter). Trend: Deteriorating.' },
  { time: '2026-04-20T16:45:00Z', type: 'escalation',  message: 'PO-2756 (Beach Shorts, Eastern Textiles) escalated to head of buying — 14 days overdue, no dispatch confirmation received.' },
  { time: '2026-04-20T10:00:00Z', type: 'scan',        message: 'Midday scan: PO-2891 (Floral Maxi Dress) now 1 day overdue. Chase email queued for Summer Styles Ltd.' },
  { time: '2026-04-19T11:20:00Z', type: 'date_change', message: 'Date change proposal received from Nordic Knitwear for PO-2901. New delivery: 18 May 2026 (was 20 Apr). Flagged for buyer approval.' },
  { time: '2026-04-18T09:00:00Z', type: 'scan',        message: 'Morning scan: 28 open POs reviewed. 2 overdue, 1 pre-dispatch chase. All other POs tracking to plan.' },
  { time: '2026-04-17T15:30:00Z', type: 'chase_draft', message: 'Pre-dispatch chase drafted for Urban Footwear — PO-2976 (Canvas Lo-Top Trainers). Delivery due 30 Apr. Awaiting buyer review.' },
]
