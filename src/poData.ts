// ─────────────────────────────────────────────────────────────────────────────
// PO Monitoring demo data — SINGLE SWAPPABLE DATA LAYER.
// All supplier/PO-id-keyed seed data lives here so a downstream fork (e.g. the
// Ligentia demo) can replace ONLY this file and inherit every upstream feature
// change with minimal merge conflict. App.tsx and predict.ts import from here.
// ─────────────────────────────────────────────────────────────────────────────
import type { Supplier, PO, POEvent, ActionItem, InquiryThread, SupplierSession, InvAuditEntry, TriggerMessage, AgentLogEntry } from './App'
import type { SupplierJourneyData, SupplierFillHistory } from './predict'


export const SUPPLIERS: Supplier[] = [
  { id: 'ET', name: 'Eastern Textiles Co', onTimeRate: 54, avgDelayDays: 12.4, contractualLeadTimeDays: 60, trend: 'deteriorating', openPOs: 18, category: 'Apparel' },
  { id: 'SS', name: 'Summer Styles Ltd',   onTimeRate: 68, avgDelayDays: 7.2,  contractualLeadTimeDays: 45, trend: 'deteriorating', openPOs: 22, category: "Women's Apparel" },
  { id: 'NK', name: 'Nordic Knitwear',     onTimeRate: 74, avgDelayDays: 5.1,  contractualLeadTimeDays: 35, trend: 'stable',        openPOs: 11, category: 'Knitwear' },
  { id: 'BA', name: 'Basic Apparel Ltd',   onTimeRate: 78, avgDelayDays: 3.8,  contractualLeadTimeDays: 28, trend: 'stable',        openPOs: 31, category: "Men's Apparel" },
  { id: 'TB', name: 'Trendy Boots UK',     onTimeRate: 82, avgDelayDays: 2.9,  contractualLeadTimeDays: 42, trend: 'improving',     openPOs: 14, category: 'Footwear' },
  { id: 'UF', name: 'Urban Footwear',      onTimeRate: 85, avgDelayDays: 2.1,  contractualLeadTimeDays: 35, trend: 'stable',        openPOs: 17, category: 'Footwear' },
  { id: 'LL', name: 'Luxe Leather Co',     onTimeRate: 91, avgDelayDays: 1.4,  contractualLeadTimeDays: 50, trend: 'stable',        openPOs: 9,  category: 'Accessories' },
  { id: 'EL', name: 'Estée Lauder UK',     onTimeRate: 96, avgDelayDays: 0.8,  contractualLeadTimeDays: 21, trend: 'stable',        openPOs: 8,  category: 'Beauty', hasSubmissionDeadline: 'Thursday' },
  { id: 'UL', name: 'Unilever Ltd',        onTimeRate: 94, avgDelayDays: 1.1,  contractualLeadTimeDays: 28, trend: 'stable',        openPOs: 4,  category: 'Beauty' },
]

export const SUPPLIER_EMAILS: Record<string, string> = {
  'ET': 'orders@easterntextiles.cn',
  'SS': 'production@summerstyles.com',
  'NK': 'orders@nordicknitwear.dk',
  'BA': 'wholesale@basicapparel.co.uk',
  'TB': 'orders@trendyboots.co.uk',
  'UF': 'ops@urbanfootwear.com',
  'LL': 'orders@luxeleather.it',
  'EL': 'orders@esteelauder.co.uk',
}

export const ALL_POS: PO[] = [
  // Ex-Factory Delays — human needed
  { id: 'PO-2756', supplierId: 'ET', product: 'Beach Shorts Collection',   category: "Women's Apparel", createdOn: '01/12/25', expectedDelivery: '2026-04-08', status: 'Ex-factory delay',      priority: true,  quantity: 1200, skus: 14, orderValue: '£12,400', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-2756-1', fromDate: '2026-03-19', toDate: '2026-03-25', days: 6,  causedBy: 'supplier', reasonCode: 'capacity',     reason: 'Factory line shared with another retailer order.', at: '2026-03-12T09:00:00Z' },
      { id: 'dc-2756-2', fromDate: '2026-03-25', toDate: '2026-04-08', days: 14, causedBy: 'buyer',    reasonCode: 'spec_change',   reason: 'Buyer requested a colourway change after sealing — production reset.', at: '2026-03-26T14:00:00Z' },
    ] },
  { id: 'PO-2834', supplierId: 'ET', product: 'Linen Summer Dresses',      category: "Women's Apparel", createdOn: '15/12/25', expectedDelivery: '2026-04-14', status: 'Ex-factory delay',      priority: false, quantity: 800,  skus: 8,  orderValue: '£18,200', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-2834-1', fromDate: '2026-04-01', toDate: '2026-04-05', days: 4, causedBy: 'supplier', reasonCode: 'raw_material',        reason: 'Linen base cloth arrived late from mill.', at: '2026-03-28T10:00:00Z' },
      { id: 'dc-2834-2', fromDate: '2026-04-05', toDate: '2026-04-14', days: 9, causedBy: 'buyer',    reasonCode: 'late_sample_signoff', reason: 'Fit sample sat with buying team 9 days before sign-off.', at: '2026-04-02T16:00:00Z' },
    ] },
  { id: 'PO-2891', supplierId: 'SS', product: 'Floral Maxi Dress',         category: "Women's Apparel", createdOn: '05/01/26', expectedDelivery: '2026-04-19', status: 'Ex-factory delay',      priority: true,  quantity: 950,  skus: 6,  orderValue: '£22,800', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-2891-1', fromDate: '2026-04-05', toDate: '2026-04-19', days: 14, causedBy: 'supplier', reasonCode: 'raw_material', reason: 'Dye-lot QC failure — replacement lot re-sourced (40% of batch).', at: '2026-04-10T16:00:00Z' },
    ] },
  // Date Change Requests — human needed
  { id: 'PO-2901', supplierId: 'NK', product: 'Cotton Knit Jumpers',       category: 'Knitwear',        createdOn: '20/12/25', expectedDelivery: '2026-04-20', revisedDelivery: '2026-04-27', status: 'Date change required', priority: false, quantity: 600,  skus: 10, orderValue: '£14,400', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-2901-1', fromDate: '2026-04-20', toDate: '2026-04-27', days: 7, causedBy: 'supplier', reasonCode: 'raw_material', reason: 'Yarn mill mechanical failure — yarn receipt delayed 10 days.', at: '2026-04-03T14:22:00Z' },
    ] },
  { id: 'PO-2845', supplierId: 'TB', product: 'Ankle Strap Heels',         category: 'Footwear',        createdOn: '10/01/26', expectedDelivery: '2026-04-22', revisedDelivery: '2026-05-09', status: 'Date change required', priority: false, quantity: 600,  skus: 8,  orderValue: '£21,000', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-2845-1', fromDate: '2026-04-22', toDate: '2026-04-30', days: 8, causedBy: 'supplier', reasonCode: 'capacity',            reason: 'Portugal line gave priority to another retailer’s spring order.', at: '2026-04-05T09:47:00Z' },
      { id: 'dc-2845-2', fromDate: '2026-04-30', toDate: '2026-05-09', days: 9, causedBy: 'buyer',    reasonCode: 'late_sample_signoff', reason: 'Heel-height resealed late by buying — 9-day sign-off gap.', at: '2026-04-12T11:00:00Z' },
    ] },
  // Pre-Dispatch Chases — agent handling
  { id: 'PO-2976', supplierId: 'UF', product: 'Canvas Lo-Top Trainers',    category: 'Footwear',        createdOn: '14/02/26', expectedDelivery: '2026-04-30', status: 'Late DC booking',    priority: true,  quantity: 1500, skus: 18, orderValue: '£37,500', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-2988', supplierId: 'LL', product: 'Mini Crossbody Bags',       category: 'Accessories',     createdOn: '20/02/26', expectedDelivery: '2026-04-28', status: 'Late DC booking',    priority: false, quantity: 320,  skus: 4,  orderValue: '£28,800', freight: 'Air', handledBy: 'agent' },
  { id: 'PO-2991', supplierId: 'TB', product: 'Chelsea Boots',             category: 'Footwear',        createdOn: '22/02/26', expectedDelivery: '2026-05-02', status: 'Late DC booking',    priority: false, quantity: 450,  skus: 8,  orderValue: '£18,000', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-2994', supplierId: 'BA', product: 'Polo Shirt Multi-Pack',     category: "Men's Apparel",   createdOn: '24/02/26', expectedDelivery: '2026-05-05', status: 'Late DC booking',    priority: false, quantity: 1800, skus: 24, orderValue: '£12,600', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3001', supplierId: 'ET', product: 'Summer Polo Shirts',        category: "Men's Apparel",   createdOn: '20/02/26', expectedDelivery: '2026-05-08', status: 'Late DC booking',    priority: false, quantity: 900,  skus: 12, orderValue: '£15,300', freight: 'Sea', handledBy: 'agent' },
  // Partially delivered — agent monitoring
  { id: 'PO-2852', supplierId: 'BA', product: 'Graphic Sweatshirts',       category: "Men's Apparel",   createdOn: '18/12/25', expectedDelivery: '2026-03-20', status: 'Partially Delivered',   priority: false, quantity: 1200, skus: 16, orderValue: '£18,000', freight: 'Sea', handledBy: 'agent' },
  // In Transit — agent monitoring
  { id: 'PO-2878', supplierId: 'BA', product: 'Basic Crew T-Shirts',       category: "Men's Apparel",   createdOn: '28/12/25', expectedDelivery: '2026-04-08', status: 'In Transit',            priority: false, quantity: 2400, skus: 20, orderValue: '£9,600',  freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-2921', supplierId: 'ET', product: 'Jersey Wrap Dress',         category: "Women's Apparel", createdOn: '08/01/26', expectedDelivery: '2026-04-12', status: 'In Transit',            priority: false, quantity: 720,  skus: 6,  orderValue: '£16,200', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-2938', supplierId: 'SS', product: 'Strappy Sundresses',        category: "Women's Apparel", createdOn: '15/01/26', expectedDelivery: '2026-04-15', status: 'In Transit',            priority: false, quantity: 480,  skus: 4,  orderValue: '£11,520', freight: 'Sea', handledBy: 'agent' },
  // Acknowledged
  { id: 'PO-2997', supplierId: 'EL', product: 'Advanced Sérum Collection', category: 'Beauty',          createdOn: '01/03/26', expectedDelivery: '2026-04-08', status: 'Acknowledged',          priority: false, quantity: 240,  skus: 6,  orderValue: '£42,000', freight: 'Air', handledBy: 'agent' },
  { id: 'PO-3002', supplierId: 'LL', product: 'Leather Tote Bags',         category: 'Accessories',     createdOn: '04/03/26', expectedDelivery: '2026-04-10', status: 'Acknowledged',          priority: false, quantity: 180,  skus: 3,  orderValue: '£32,400', freight: 'Air', handledBy: 'agent' },
  { id: 'PO-3015', supplierId: 'UF', product: 'Running Shoes',             category: 'Footwear',        createdOn: '08/03/26', expectedDelivery: '2026-04-16', status: 'Acknowledged',          priority: true,  quantity: 800,  skus: 10, orderValue: '£28,000', freight: 'Sea', handledBy: 'agent' },
  // Sent to Supplier
  { id: 'PO-3008', supplierId: 'SS', product: 'Summer Crop Tops',          category: "Women's Apparel", createdOn: '10/03/26', expectedDelivery: '2026-04-22', status: 'Sent to supplier',      priority: false, quantity: 1200, skus: 16, orderValue: '£14,400', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3011', supplierId: 'BA', product: 'Slim Fit Chinos',           category: "Men's Apparel",   createdOn: '12/03/26', expectedDelivery: '2026-04-24', status: 'Sent to supplier',      priority: false, quantity: 960,  skus: 12, orderValue: '£21,120', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3019', supplierId: 'NK', product: 'Merino Wool Cardigans',     category: 'Knitwear',        createdOn: '14/03/26', expectedDelivery: '2026-04-28', status: 'Sent to supplier',      priority: false, quantity: 360,  skus: 6,  orderValue: '£18,000', freight: 'Sea', handledBy: 'agent' },
  // On Track
  { id: 'PO-3022', supplierId: 'EL', product: 'Summer Skincare Gift Sets', category: 'Beauty',          createdOn: '16/03/26', expectedDelivery: '2026-04-30', status: 'On track',              priority: false, quantity: 360,  skus: 8,  orderValue: '£63,000', freight: 'Air', handledBy: 'agent' },
  { id: 'PO-3026', supplierId: 'TB', product: 'Leather Sandals',           category: 'Footwear',        createdOn: '18/03/26', expectedDelivery: '2026-05-05', status: 'On track',              priority: false, quantity: 540,  skus: 9,  orderValue: '£16,200', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3029', supplierId: 'SS', product: 'Denim Shorts',              category: "Women's Apparel", createdOn: '18/03/26', expectedDelivery: '2026-05-08', status: 'On track',              priority: false, quantity: 840,  skus: 10, orderValue: '£25,200', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3033', supplierId: 'BA', product: 'Oxford Button-Down Shirts', category: "Men's Apparel",   createdOn: '20/03/26', expectedDelivery: '2026-05-12', status: 'On track',              priority: false, quantity: 720,  skus: 9,  orderValue: '£21,600', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3037', supplierId: 'LL', product: 'Leather Belt Collection',   category: 'Accessories',     createdOn: '20/03/26', expectedDelivery: '2026-05-15', status: 'On track',              priority: false, quantity: 480,  skus: 6,  orderValue: '£9,600',  freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3041', supplierId: 'ET', product: 'Lightweight Blazers',       category: 'Outerwear',       createdOn: '22/03/26', expectedDelivery: '2026-05-20', status: 'On track',              priority: false, quantity: 400,  skus: 8,  orderValue: '£28,000', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3044', supplierId: 'NK', product: 'Linen-Blend Tops',          category: "Women's Apparel", createdOn: '24/03/26', expectedDelivery: '2026-05-25', status: 'On track',              priority: false, quantity: 600,  skus: 6,  orderValue: '£12,000', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3048', supplierId: 'UF', product: 'Slip-On Sneakers',          category: 'Footwear',        createdOn: '24/03/26', expectedDelivery: '2026-05-28', status: 'On track',              priority: false, quantity: 640,  skus: 8,  orderValue: '£19,200', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3052', supplierId: 'EL', product: 'Foundation Range',          category: 'Beauty',          createdOn: '26/03/26', expectedDelivery: '2026-06-02', status: 'On track',              priority: false, quantity: 480,  skus: 12, orderValue: '£84,000', freight: 'Air', handledBy: 'agent' },
  { id: 'PO-3055', supplierId: 'SS', product: 'Wrap Midi Dresses',         category: "Women's Apparel", createdOn: '26/03/26', expectedDelivery: '2026-06-05', status: 'On track',              priority: false, quantity: 720,  skus: 8,  orderValue: '£21,600', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-3059', supplierId: 'BA', product: 'Linen Shorts',              category: "Men's Apparel",   createdOn: '28/03/26', expectedDelivery: '2026-06-10', status: 'On track',              priority: false, quantity: 960,  skus: 12, orderValue: '£14,400', freight: 'Sea', handledBy: 'agent' },
  // Negotiated PO — raised following CP negotiation with Unilever Ltd (REC-002)
  { id: 'PO-3060', supplierId: 'UL', product: 'Hyaluronic Acid Toner',    category: 'Beauty',          createdOn: '30/04/26', expectedDelivery: '2026-06-11', status: 'On track',              priority: false, quantity: 2840, skus: 1,  orderValue: '£25,475', freight: 'Air', handledBy: 'human' },

  // ── PREDICTED-TO-SLIP (the repositioning) ────────────────────────────────────
  // These are NOT yet late by the system — status is On track / Acknowledged /
  // Sent to supplier — but the predictive model forecasts a slip from a weak
  // UPCOMING supplier stage. targetStockDate is the merch deadline (tight, so the
  // predicted landing breaches it). Two are "headline OTR looks fine, one weak
  // upcoming stage" cases (UL customs, UF handover).
  { id: 'PO-3070', supplierId: 'UL', product: 'Retinol Renewal Serum',    category: 'Beauty',          createdOn: '02/05/26', expectedDelivery: '2026-06-20', status: 'Acknowledged',          priority: true,  quantity: 2600, skus: 4,  orderValue: '£23,400', freight: 'Sea', handledBy: 'agent', targetStockDate: '2026-06-22' },
  { id: 'PO-3071', supplierId: 'UF', product: 'Court Trainers',           category: 'Footwear',        createdOn: '04/05/26', expectedDelivery: '2026-06-25', status: 'Acknowledged',          priority: false, quantity: 900,  skus: 10, orderValue: '£27,000', freight: 'Sea', handledBy: 'agent', targetStockDate: '2026-06-26' },
  { id: 'PO-3072', supplierId: 'SS', product: 'Broderie Blouse',          category: "Women's Apparel", createdOn: '01/05/26', expectedDelivery: '2026-06-12', status: 'On track',              priority: true,  quantity: 1100, skus: 9,  orderValue: '£26,400', freight: 'Sea', handledBy: 'agent', targetStockDate: '2026-06-05' },
  { id: 'PO-3073', supplierId: 'NK', product: 'Lambswool Crew Knit',      category: 'Knitwear',        createdOn: '06/05/26', expectedDelivery: '2026-06-30', status: 'Sent to supplier',      priority: false, quantity: 540,  skus: 6,  orderValue: '£17,280', freight: 'Sea', handledBy: 'agent', targetStockDate: '2026-06-18' },
  { id: 'PO-3074', supplierId: 'TB', product: 'Western Ankle Boots',      category: 'Footwear',        createdOn: '05/05/26', expectedDelivery: '2026-06-18', status: 'Acknowledged',          priority: false, quantity: 620,  skus: 8,  orderValue: '£21,700', freight: 'Sea', handledBy: 'agent', targetStockDate: '2026-06-20' },
]

export const PO_PRODUCT_MAP: Record<string, string> = {
  'PO-2756': 'INV-012', // Beach Shorts → Wide Leg Trousers (women's casual bottoms)
  'PO-2834': 'INV-007', // Linen Summer Dresses → Floral Midi Dress
  'PO-2891': 'INV-007', // Floral Maxi Dress → Floral Midi Dress
  'PO-2901': 'INV-011', // Cotton Knit Jumpers → Ribbed Knit Jumper
  'PO-2845': 'INV-014', // Ankle Strap Heels → Pointed Toe Heels
  'PO-2976': 'INV-016', // Canvas Lo-Top Trainers → Leather Loafers
  'PO-2988': 'INV-018', // Mini Crossbody Bags → Leather Crossbody Bag
  'PO-2991': 'INV-015', // Chelsea Boots → Chelsea Boots
  'PO-2994': 'INV-009', // Polo Shirt Multi-Pack → Cotton Oxford Shirt
  'PO-2852': 'REC-006', // Graphic Sweatshirts → Striped Cotton Tee
  'PO-2878': 'REC-006', // Basic Crew T-Shirts → Striped Cotton Tee
  'PO-2921': 'REC-004', // Jersey Wrap Dress → Wrap Midi Dress
  'PO-2938': 'INV-010', // Strappy Sundresses → Jersey Maxi Dress
  'PO-2997': 'INV-001', // Advanced Sérum Collection → Hydrating Face Serum
  'PO-3002': 'INV-018', // Leather Tote Bags → Leather Crossbody Bag
  'PO-3015': 'REC-010', // Running Shoes → Platform Derby Shoes
  'PO-3060': 'REC-002', // Hyaluronic Acid Toner → directly the negotiated rec
  'PO-3022': 'INV-003', // Summer Skincare Gift Sets → Vitamin C Moisturiser
  'PO-3026': 'INV-017', // Leather Sandals → Strappy Sandals
  'PO-3029': 'INV-012', // Denim Shorts → Wide Leg Trousers
  'PO-3033': 'INV-009', // Oxford Button-Down Shirts → Cotton Oxford Shirt
  'PO-3041': 'INV-006', // Lightweight Blazers → Linen Blazer
  'PO-3044': 'REC-009', // Linen-Blend Tops → Oversized Linen Shirt
  'PO-3048': 'REC-010', // Slip-On Sneakers → Platform Derby Shoes
  'PO-3052': 'REC-003', // Foundation Range → Brightening Eye Cream
  'PO-3055': 'REC-004', // Wrap Midi Dresses → Wrap Midi Dress
  'PO-3059': 'INV-008', // Linen Shorts → Slim Fit Chinos
}

export const NEG_PO_MAP: Record<string, string> = {
  'REC-002': 'PO-3060',
}

export const SEED_PO_EVENTS: Record<string, POEvent[]> = {
  'PO-2756': [
    { id: 'e1', type: 'chase_sent',     timestamp: '2026-04-07T09:15:00Z', body: 'Handover chase sent to Eastern Textiles Co. Beach Shorts Collection — no dispatch confirmation received despite x-factory date passing.', author: 'agent' },
    { id: 'e2', type: 'supplier_reply', timestamp: '2026-04-09T14:32:00Z', body: 'Reply from Eastern Textiles: "Production complete, awaiting freight forwarder booking. Ex-factory now expected 14 Apr."', author: 'agent' },
    { id: 'e3', type: 'chase_sent',     timestamp: '2026-04-14T09:00:00Z', body: 'Second handover chase sent. 14 Apr passed with no booking confirmation or dispatch documentation received.', author: 'agent' },
  ],
  'PO-2891': [
    { id: 'e4', type: 'chase_sent',     timestamp: '2026-04-10T10:00:00Z', body: 'Handover chase sent to Summer Styles Ltd. Floral Maxi Dress — 9 days past x-factory with no dispatch confirmation.', author: 'agent' },
    { id: 'e5', type: 'manual_note',    timestamp: '2026-04-15T16:20:00Z', body: 'Called supplier ops manager. Production delayed by fabric QC failure on print run. Rescheduling to end of month.', author: 'buyer' },
  ],
  'PO-2901': [
    { id: 'e6', type: 'supplier_reply',       timestamp: '2026-04-05T11:00:00Z', body: 'Nordic Knitwear: requesting extension to 15 Apr due to cotton supply disruption. Formal letter to follow.', author: 'agent' },
    { id: 'e7', type: 'date_change_proposed', timestamp: '2026-04-05T11:02:00Z', body: 'Agent proposed: delivery 18 Mar → 15 Apr. Queued for approval.', author: 'agent' },
  ],
  'PO-2834': [
    { id: 'e2a', type: 'chase_sent',     timestamp: '2026-04-14T09:30:00Z', body: 'Handover chase sent to Eastern Textiles Co. Linen Summer Dresses — expected delivery date passed with no dispatch confirmation or booking documentation received.', author: 'agent' },
    { id: 'e2b', type: 'supplier_reply', timestamp: '2026-04-17T13:45:00Z', body: 'Reply from Eastern Textiles: "Production finalised but freight forwarder slot not confirmed. Ex-factory now expected 21 Apr. Apologies for the delay."', author: 'agent' },
    { id: 'e2c', type: 'chase_sent',     timestamp: '2026-04-22T09:00:00Z', body: 'Third-party logistics chase issued. 21 Apr ex-factory passed with no booking reference. 8 days since last supplier reply.', author: 'agent' },
  ],
  'PO-2845': [
    { id: 'e2d', type: 'supplier_reply',       timestamp: '2026-04-21T10:20:00Z', body: 'Trendy Boots UK: production delay due to last-minute component sourcing issue. Requesting delivery extension to 9 May. Formal notification attached.', author: 'agent' },
    { id: 'e2e', type: 'date_change_proposed',  timestamp: '2026-04-21T10:22:00Z', body: 'Agent proposed: delivery 22 Apr → 9 May (+17 days). Queued for buyer approval.', author: 'agent' },
  ],
  'PO-2976': [
    { id: 'e8', type: 'chase_sent', timestamp: '2026-04-18T09:00:00Z', body: 'Booking-in chase sent to Urban Footwear. Sea freight — 6 days to x-factory. Freight forwarder booking reference required.', author: 'agent' },
  ],
  'PO-2988': [
    { id: 'e9',  type: 'chase_sent',     timestamp: '2026-04-17T11:30:00Z', body: 'Booking-in chase sent to Luxe Leather Co. Air freight — confirm flight booking and AWB number.', author: 'agent' },
    { id: 'e10', type: 'supplier_reply', timestamp: '2026-04-18T14:00:00Z', body: 'Luxe Leather Co: AWB confirmed. Booking ref LL-2988-FR. Expected arrival Heathrow 2 May.', author: 'agent' },
  ],
}

export const STATIC_KANBAN_ITEMS: ActionItem[] = [
  {
    id: 'A-006', bucket: 'submission-deadline', supplierId: 'EL',
    headline: 'Estée Lauder submission window closes Thursday 2 Apr',
    detail: 'Missing this window means a full week delay to the next ordering cycle and a potential beauty intake gap. 3 SS26 POs are ready to submit.',
    suggestedAction: 'Prepare and submit all Estée Lauder SS26 POs by Wednesday 1 Apr.',
    metric: 'Due Thu 2 Apr',
  },
  {
    id: 'A-007', bucket: 'intake-volume',
    headline: 'High intake week — w/c 7 Apr needs resourcing',
    detail: '23 POs scheduled for delivery in the week of 7 Apr — 2× your average weekly intake of 11. Warehouse may face a receiving bottleneck without extra resource.',
    suggestedAction: 'Brief warehouse/intake team now. Book additional resource for w/c 7 Apr.',
    metric: '23 POs · 2× avg',
  },
]

export const SUPPLIER_JOURNEY: Record<string, SupplierJourneyData> = {
  UL: {
    tier:    'Good',
    summary: '94% on-time overall, but customs clearance is a persistent weakness (-2.4d average) and trending worse over the last 90 days.',
    byStage: {
      sample:     { onTime: 95, avgDelay: 0.4, trend: 'stable' },
      fit:        { onTime: 96, avgDelay: 0.3, trend: 'stable' },
      booking:    { onTime: 97, avgDelay: 0.2, trend: 'stable' },
      handover:   { onTime: 96, avgDelay: 0.5, trend: 'stable' },
      shipment:   { onTime: 96, avgDelay: 0.3, trend: 'stable' },
      in_transit: { onTime: 92, avgDelay: 1.8, trend: 'stable' },
      customs:    { onTime: 81, avgDelay: 2.4, trend: 'worsening' },
      dc_arrival: { onTime: 95, avgDelay: 0.7, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 96, avgDelay: 0.8, volume: 18 },
      { month: 'Jan', onTime: 95, avgDelay: 1.0, volume: 22 },
      { month: 'Feb', onTime: 94, avgDelay: 1.1, volume: 19 },
      { month: 'Mar', onTime: 94, avgDelay: 1.2, volume: 24 },
      { month: 'Apr', onTime: 93, avgDelay: 1.4, volume: 21 },
      { month: 'May', onTime: 94, avgDelay: 1.1, volume: 16 },
    ],
  },
  EL: {
    tier:    'Excellent',
    summary: 'Excellent across every stage of the journey. Sample provision is the strongest in the portfolio at 99%.',
    byStage: {
      sample:     { onTime: 99, avgDelay: -0.2, trend: 'stable' },
      fit:        { onTime: 98, avgDelay: 0.1,  trend: 'stable' },
      booking:    { onTime: 97, avgDelay: 0.3,  trend: 'stable' },
      handover:   { onTime: 96, avgDelay: 0.5,  trend: 'stable' },
      shipment:   { onTime: 97, avgDelay: 0.2,  trend: 'stable' },
      in_transit: { onTime: 95, avgDelay: 0.8,  trend: 'stable' },
      customs:    { onTime: 94, avgDelay: 1.1,  trend: 'stable' },
      dc_arrival: { onTime: 96, avgDelay: 0.5,  trend: 'improving' },
    },
    history: [
      { month: 'Dec', onTime: 95, avgDelay: 0.9, volume: 12 },
      { month: 'Jan', onTime: 96, avgDelay: 0.8, volume: 14 },
      { month: 'Feb', onTime: 96, avgDelay: 0.8, volume: 13 },
      { month: 'Mar', onTime: 96, avgDelay: 0.7, volume: 16 },
      { month: 'Apr', onTime: 97, avgDelay: 0.6, volume: 12 },
      { month: 'May', onTime: 96, avgDelay: 0.8, volume: 11 },
    ],
  },
  LL: {
    tier:    'Good',
    summary: '91% on-time overall, with first-fit approval consistently late (-3.1d) — sample stage strong but fit reviews slip.',
    byStage: {
      sample:     { onTime: 94, avgDelay: 0.6, trend: 'stable' },
      fit:        { onTime: 72, avgDelay: 3.1, trend: 'stable' },
      booking:    { onTime: 94, avgDelay: 0.8, trend: 'stable' },
      handover:   { onTime: 92, avgDelay: 1.4, trend: 'stable' },
      shipment:   { onTime: 95, avgDelay: 0.7, trend: 'stable' },
      in_transit: { onTime: 93, avgDelay: 1.2, trend: 'stable' },
      customs:    { onTime: 90, avgDelay: 1.6, trend: 'stable' },
      dc_arrival: { onTime: 94, avgDelay: 0.9, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 90, avgDelay: 1.5, volume: 9 },
      { month: 'Jan', onTime: 91, avgDelay: 1.4, volume: 11 },
      { month: 'Feb', onTime: 91, avgDelay: 1.4, volume: 8  },
      { month: 'Mar', onTime: 92, avgDelay: 1.3, volume: 10 },
      { month: 'Apr', onTime: 91, avgDelay: 1.4, volume: 9  },
      { month: 'May', onTime: 91, avgDelay: 1.4, volume: 9  },
    ],
  },
  UF: {
    tier:    'Watch',
    summary: 'Improving trend over the last 90 days, with handover slipping in the last 30 (-1.9d average vs +0.3d the prior period).',
    byStage: {
      sample:     { onTime: 86, avgDelay: 1.4, trend: 'stable' },
      fit:        { onTime: 83, avgDelay: 1.8, trend: 'stable' },
      booking:    { onTime: 88, avgDelay: 1.1, trend: 'improving' },
      handover:   { onTime: 79, avgDelay: 1.9, trend: 'worsening' },
      shipment:   { onTime: 91, avgDelay: 0.9, trend: 'improving' },
      in_transit: { onTime: 86, avgDelay: 1.6, trend: 'stable' },
      customs:    { onTime: 84, avgDelay: 1.8, trend: 'stable' },
      dc_arrival: { onTime: 88, avgDelay: 1.3, trend: 'improving' },
    },
    history: [
      { month: 'Dec', onTime: 79, avgDelay: 3.1, volume: 16 },
      { month: 'Jan', onTime: 81, avgDelay: 2.8, volume: 18 },
      { month: 'Feb', onTime: 82, avgDelay: 2.5, volume: 17 },
      { month: 'Mar', onTime: 84, avgDelay: 2.3, volume: 20 },
      { month: 'Apr', onTime: 85, avgDelay: 2.1, volume: 19 },
      { month: 'May', onTime: 85, avgDelay: 2.1, volume: 17 },
    ],
  },
  TB: {
    tier:    'Watch',
    summary: 'Improving overall but recovering slowly — booking confirmations are still the weakest stage at 76% on-time.',
    byStage: {
      sample:     { onTime: 84, avgDelay: 1.8, trend: 'improving' },
      fit:        { onTime: 82, avgDelay: 2.0, trend: 'improving' },
      booking:    { onTime: 76, avgDelay: 2.6, trend: 'improving' },
      handover:   { onTime: 83, avgDelay: 1.7, trend: 'improving' },
      shipment:   { onTime: 88, avgDelay: 1.1, trend: 'stable' },
      in_transit: { onTime: 84, avgDelay: 1.5, trend: 'stable' },
      customs:    { onTime: 81, avgDelay: 1.9, trend: 'stable' },
      dc_arrival: { onTime: 86, avgDelay: 1.2, trend: 'improving' },
    },
    history: [
      { month: 'Dec', onTime: 76, avgDelay: 3.4, volume: 13 },
      { month: 'Jan', onTime: 78, avgDelay: 3.1, volume: 15 },
      { month: 'Feb', onTime: 80, avgDelay: 2.8, volume: 12 },
      { month: 'Mar', onTime: 81, avgDelay: 2.7, volume: 14 },
      { month: 'Apr', onTime: 82, avgDelay: 2.6, volume: 16 },
      { month: 'May', onTime: 82, avgDelay: 2.6, volume: 13 },
    ],
  },
  BA: {
    tier:    'Watch',
    summary: 'Stable middle-of-the-road performance — no single weak stage but no strengths either. Handover is the slowest at 75%.',
    byStage: {
      sample:     { onTime: 82, avgDelay: 1.9, trend: 'stable' },
      fit:        { onTime: 79, avgDelay: 2.2, trend: 'stable' },
      booking:    { onTime: 81, avgDelay: 1.8, trend: 'stable' },
      handover:   { onTime: 75, avgDelay: 2.5, trend: 'stable' },
      shipment:   { onTime: 83, avgDelay: 1.4, trend: 'stable' },
      in_transit: { onTime: 80, avgDelay: 1.7, trend: 'stable' },
      customs:    { onTime: 78, avgDelay: 1.9, trend: 'stable' },
      dc_arrival: { onTime: 81, avgDelay: 1.5, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 77, avgDelay: 3.9, volume: 28 },
      { month: 'Jan', onTime: 78, avgDelay: 3.8, volume: 33 },
      { month: 'Feb', onTime: 78, avgDelay: 3.7, volume: 31 },
      { month: 'Mar', onTime: 79, avgDelay: 3.6, volume: 30 },
      { month: 'Apr', onTime: 78, avgDelay: 3.8, volume: 32 },
      { month: 'May', onTime: 78, avgDelay: 3.8, volume: 31 },
    ],
  },
  NK: {
    tier:    'At risk',
    summary: 'Declining across multiple stages. Sample and first-fit are now both below 70%, indicating a deeper sourcing problem.',
    byStage: {
      sample:     { onTime: 68, avgDelay: 4.2, trend: 'worsening' },
      fit:        { onTime: 65, avgDelay: 4.8, trend: 'worsening' },
      booking:    { onTime: 76, avgDelay: 2.4, trend: 'stable' },
      handover:   { onTime: 72, avgDelay: 3.1, trend: 'worsening' },
      shipment:   { onTime: 81, avgDelay: 1.6, trend: 'stable' },
      in_transit: { onTime: 78, avgDelay: 2.0, trend: 'stable' },
      customs:    { onTime: 75, avgDelay: 2.4, trend: 'stable' },
      dc_arrival: { onTime: 80, avgDelay: 1.8, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 80, avgDelay: 4.6, volume: 11 },
      { month: 'Jan', onTime: 78, avgDelay: 4.8, volume: 13 },
      { month: 'Feb', onTime: 76, avgDelay: 5.0, volume: 10 },
      { month: 'Mar', onTime: 75, avgDelay: 5.1, volume: 12 },
      { month: 'Apr', onTime: 74, avgDelay: 5.1, volume: 11 },
      { month: 'May', onTime: 74, avgDelay: 5.1, volume: 11 },
    ],
  },
  SS: {
    tier:    'At risk',
    summary: 'Customs clearance is consistently slow (-5.4d) and handover trending worse. Concentration risk: 22 open POs.',
    byStage: {
      sample:     { onTime: 71, avgDelay: 3.4, trend: 'stable' },
      fit:        { onTime: 68, avgDelay: 4.1, trend: 'stable' },
      booking:    { onTime: 74, avgDelay: 2.9, trend: 'stable' },
      handover:   { onTime: 62, avgDelay: 4.6, trend: 'worsening' },
      shipment:   { onTime: 72, avgDelay: 3.2, trend: 'stable' },
      in_transit: { onTime: 70, avgDelay: 3.6, trend: 'stable' },
      customs:    { onTime: 54, avgDelay: 5.4, trend: 'worsening' },
      dc_arrival: { onTime: 76, avgDelay: 2.4, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 72, avgDelay: 6.5, volume: 23 },
      { month: 'Jan', onTime: 71, avgDelay: 6.8, volume: 26 },
      { month: 'Feb', onTime: 70, avgDelay: 7.1, volume: 24 },
      { month: 'Mar', onTime: 69, avgDelay: 7.2, volume: 22 },
      { month: 'Apr', onTime: 68, avgDelay: 7.2, volume: 25 },
      { month: 'May', onTime: 68, avgDelay: 7.2, volume: 22 },
    ],
  },
  ET: {
    tier:    'Critical',
    summary: 'Structurally weak — every stage below 70% except sample provision. Customs clearance is failing (-15.2d). Replace or restructure.',
    byStage: {
      sample:     { onTime: 64, avgDelay: 6.8,  trend: 'worsening' },
      fit:        { onTime: 52, avgDelay: 9.3,  trend: 'worsening' },
      booking:    { onTime: 58, avgDelay: 7.4,  trend: 'worsening' },
      handover:   { onTime: 48, avgDelay: 11.2, trend: 'worsening' },
      shipment:   { onTime: 62, avgDelay: 5.8,  trend: 'stable' },
      in_transit: { onTime: 56, avgDelay: 6.9,  trend: 'worsening' },
      customs:    { onTime: 38, avgDelay: 15.2, trend: 'worsening' },
      dc_arrival: { onTime: 60, avgDelay: 6.4,  trend: 'worsening' },
    },
    history: [
      { month: 'Dec', onTime: 62, avgDelay: 10.8, volume: 16 },
      { month: 'Jan', onTime: 60, avgDelay: 11.4, volume: 18 },
      { month: 'Feb', onTime: 58, avgDelay: 11.9, volume: 17 },
      { month: 'Mar', onTime: 56, avgDelay: 12.2, volume: 20 },
      { month: 'Apr', onTime: 55, avgDelay: 12.3, volume: 19 },
      { month: 'May', onTime: 54, avgDelay: 12.4, volume: 18 },
    ],
  },
}

export const SUPPLIER_FILL_RATE: Record<string, SupplierFillHistory> = {
  // Chronic under-fulfillers (low fill + high spread)
  UF: { avgFillRatePct: 74, fillVolatilityPts: 16, trend: 'worsening', posObserved: 15, worstRecentPct: 55 }, // on-time but under-fills — independent signal
  ET: { avgFillRatePct: 76, fillVolatilityPts: 14, trend: 'worsening', posObserved: 12, worstRecentPct: 58 }, // weak on both timing AND fill
  // In between
  UL: { avgFillRatePct: 85, fillVolatilityPts: 9,  trend: 'worsening', posObserved: 12, worstRecentPct: 73 }, // good OTR, mediocre + slipping fill
  SS: { avgFillRatePct: 88, fillVolatilityPts: 9,  trend: 'stable',    posObserved: 14, worstRecentPct: 76 },
  TB: { avgFillRatePct: 90, fillVolatilityPts: 8,  trend: 'stable',    posObserved: 13, worstRecentPct: 79 },
  NK: { avgFillRatePct: 92, fillVolatilityPts: 5,  trend: 'improving', posObserved: 11, worstRecentPct: 85 },
  // Reliable (high fill, steady)
  BA: { avgFillRatePct: 94, fillVolatilityPts: 4,  trend: 'stable',    posObserved: 16, worstRecentPct: 88 },
  LL: { avgFillRatePct: 97, fillVolatilityPts: 3,  trend: 'stable',    posObserved: 10, worstRecentPct: 93 },
  EL: { avgFillRatePct: 98, fillVolatilityPts: 2,  trend: 'stable',    posObserved: 9,  worstRecentPct: 95 },
}

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
