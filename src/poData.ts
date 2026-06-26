// ─────────────────────────────────────────────────────────────────────────────
// PO Monitoring demo data — SINGLE SWAPPABLE DATA LAYER.
// All supplier/PO-id-keyed seed data lives here so a downstream fork (e.g. the
// Ligentia demo) can replace ONLY this file and inherit every upstream feature
// change with minimal merge conflict. App.tsx and predict.ts import from here.
// ─────────────────────────────────────────────────────────────────────────────
import type { Supplier, PO, POEvent, ActionItem } from './App'
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
