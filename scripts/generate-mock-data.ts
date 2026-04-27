import { writeFileSync } from 'fs'
import { resolve } from 'path'

// ── Types (local to this generator) ──────────────────────────────────────────
type Category       = 'Beauty' | 'Clothing' | 'Footwear' | 'Accessories'
type StockStatus    = 'on-target' | 'low-stock' | 'overstocked'
type ApprovalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Sent'
type StockoutRisk   = 'Low' | 'Medium' | 'High'
interface SizeBand       { label: string; pct: number; color: string }
interface SizeCurveEntry {
  size:      string
  available: number
  onOrder:   number
  recommended: number
  sales:     number
  targetMin: number
  targetMax: number
}

// ── Size-band helpers ─────────────────────────────────────────────────────────
const CLOTH_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const CLOTH_PCT   = [8, 18, 32, 25, 12, 5]

const FOOT_SIZES  = ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12']
const FOOT_PCT    = [8, 15, 28, 25, 14, 7, 3]

function bandColor(status: StockStatus, i: number, total: number): string {
  if (status === 'on-target')   return 'bg-green-100 text-green-700'
  if (status === 'overstocked') return 'bg-blue-100 text-blue-700'
  // low-stock: peak sizes sold out first
  const midStart = Math.floor(total * 0.3)
  const midEnd   = Math.floor(total * 0.7)
  if (i >= midStart && i <= midEnd) return 'bg-red-100 text-red-700'
  if (i === midStart - 1 || i === midEnd + 1) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function clothSizeBands(s: StockStatus): SizeBand[] {
  return CLOTH_SIZES.map((label, i) => ({ label, pct: CLOTH_PCT[i], color: bandColor(s, i, CLOTH_SIZES.length) }))
}
function footSizeBands(s: StockStatus): SizeBand[] {
  return FOOT_SIZES.map((label, i) => ({ label, pct: FOOT_PCT[i], color: bandColor(s, i, FOOT_SIZES.length) }))
}
function oneSize(s: StockStatus): SizeBand[] {
  const color = s === 'on-target' ? 'bg-green-100 text-green-700' : s === 'low-stock' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
  return [{ label: 'One Size', pct: 100, color }]
}
function sizeBands(cat: Category, s: StockStatus): SizeBand[] {
  if (cat === 'Clothing') return clothSizeBands(s)
  if (cat === 'Footwear') return footSizeBands(s)
  return oneSize(s)
}

// ── Size curve for reorder recs (Clothing + Footwear only) ───────────────────
function buildSizeCurve(
  cat: Category,
  totalAvailable: number,
  totalOnOrder: number,
  totalRecommended: number,
  weeklySales: number,
): SizeCurveEntry[] | undefined {
  if (cat !== 'Clothing' && cat !== 'Footwear') return undefined
  const labels = cat === 'Footwear' ? FOOT_SIZES  : CLOTH_SIZES
  const pcts   = cat === 'Footwear' ? FOOT_PCT    : CLOTH_PCT
  const total  = pcts.reduce((a, b) => a + b, 0)

  return labels.map((size, i) => {
    const w         = pcts[i] / total
    // Peak sizes more depleted → less available
    const depletion = 0.5 + (pcts[i] / Math.max(...pcts)) * 0.35
    const available = Math.round(totalAvailable * w * (1 - depletion * 0.25))
    const onOrder   = Math.round(totalOnOrder * w)
    const recommended = Math.round(totalRecommended * w)
    const sales     = Math.round(weeklySales * w)
    const targetBase = Math.round(weeklySales * w * 4)
    return {
      size, available, onOrder, recommended, sales,
      targetMin: Math.round(targetBase * 0.9),
      targetMax: Math.round(targetBase * 1.1),
    }
  })
}

// ── Per-category defaults ─────────────────────────────────────────────────────
const SUPPLIERS: Record<Category, string[]> = {
  'Beauty':      ["L'Oréal UK", 'Unilever Ltd'],
  'Clothing':    ['ASOS Brands', 'Next Sourcing'],
  'Footwear':    ['Steve Madden EU', 'Clarks Wholesale'],
  'Accessories': ['Accessorize Ltd', 'Radley London'],
}

const ORDER_DEFAULTS: Record<Category, { orderFrequency: string; leadTime: string; minOrderQty: number; packSize: number }> = {
  'Beauty':      { orderFrequency: '4 weeks', leadTime: '14 days', minOrderQty: 500, packSize: 1 },
  'Clothing':    { orderFrequency: '4 weeks', leadTime: '21 days', minOrderQty: 200, packSize: 1 },
  'Footwear':    { orderFrequency: '4 weeks', leadTime: '28 days', minOrderQty: 150, packSize: 1 },
  'Accessories': { orderFrequency: '4 weeks', leadTime: '14 days', minOrderQty: 300, packSize: 1 },
}

function stockoutRisk(fwc: number): StockoutRisk {
  if (fwc > 4) return 'Low'
  if (fwc < 3) return 'High'
  return 'Medium'
}

function pseudoOnOrder(seed: number): number {
  return 200 + ((seed * 137 + 53) % 601)
}

function addDays(base: string, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Inventory raw data (20 rows) ──────────────────────────────────────────────
type InvRow = [string, string, Category, number, number, number, StockStatus, number]
const INV_RAW: InvRow[] = [
  ['INV-001', 'Hydrating Face Serum',     'Beauty',      10.50, 0.72,  5.2, 'on-target',    380],
  ['INV-002', 'Rose Hip Facial Oil',      'Beauty',      11.20, 0.70,  2.8, 'low-stock',    290],
  ['INV-003', 'Vitamin C Moisturiser',    'Beauty',       9.80, 0.73,  9.5, 'overstocked',  210],
  ['INV-004', 'Micellar Cleansing Water', 'Beauty',      10.00, 0.71,  4.8, 'on-target',    420],
  ['INV-005', 'SPF 50 Day Cream',         'Beauty',      11.50, 0.69,  2.1, 'low-stock',    340],
  ['INV-006', 'Linen Blazer',             'Clothing',    24.00, 0.72,  5.5, 'on-target',    145],
  ['INV-007', 'Floral Midi Dress',        'Clothing',    18.50, 0.70,  3.0, 'low-stock',    290],
  ['INV-008', 'Slim Fit Chinos',          'Clothing',    15.00, 0.71, 10.2, 'overstocked',  180],
  ['INV-009', 'Cotton Oxford Shirt',      'Clothing',    14.00, 0.73,  4.2, 'on-target',    220],
  ['INV-010', 'Jersey Maxi Dress',        'Clothing',    20.00, 0.72,  2.5, 'low-stock',    175],
  ['INV-011', 'Ribbed Knit Jumper',       'Clothing',    22.00, 0.68,  5.8, 'on-target',    160],
  ['INV-012', 'Wide Leg Trousers',        'Clothing',    19.00, 0.74,  8.5, 'overstocked',  195],
  ['INV-013', 'Block Heel Ankle Boots',   'Footwear',    28.00, 0.71,  5.1, 'on-target',    120],
  ['INV-014', 'Pointed Toe Heels',        'Footwear',    25.00, 0.73,  2.3, 'low-stock',    150],
  ['INV-015', 'Chelsea Boots',            'Footwear',    30.00, 0.70, 11.0, 'overstocked',   95],
  ['INV-016', 'Leather Loafers',          'Footwear',    26.00, 0.72,  4.7, 'on-target',    110],
  ['INV-017', 'Strappy Sandals',          'Footwear',    22.50, 0.69,  4.3, 'on-target',    205],
  ['INV-018', 'Leather Crossbody Bag',    'Accessories', 16.00, 0.71,  5.4, 'on-target',     85],
  ['INV-019', 'Silk Headband Set',        'Accessories', 12.00, 0.73,  2.7, 'low-stock',    130],
  ['INV-020', 'Gold Charm Bracelet',      'Accessories', 14.50, 0.72,  9.0, 'overstocked',   70],
]

// ── Reorder raw data (15 rows) ────────────────────────────────────────────────
// [id, name, cat, costPrice, marginPct, fwc, reorderQty, status, rejectionReason, recommendedFreight]
type RecRow = [string, string, Category, number, number, number, number, ApprovalStatus, string | undefined, 'Sea' | 'Air']

const REC_RAW: RecRow[] = [
  ['REC-001', 'Retinol Night Cream',    'Beauty',       11.80, 0.72, 2.4, 4200, 'Approved',         undefined,                                       'Sea'],
  ['REC-002', 'Hyaluronic Acid Toner',  'Beauty',        9.50, 0.71, 2.8, 3900, 'Pending Approval', undefined,                                       'Sea'],
  ['REC-003', 'Brightening Eye Cream',  'Beauty',       10.80, 0.70, 2.1, 4100, 'Rejected',         'Supplier OOS until June — seek alternative',    'Air'],
  ['REC-004', 'Wrap Midi Dress',        'Clothing',     21.00, 0.73, 2.6, 4400, 'Approved',         undefined,                                       'Sea'],
  ['REC-005', 'Tailored Suit Jacket',   'Clothing',     27.50, 0.71, 2.9, 3800, 'Draft',            undefined,                                       'Sea'],
  ['REC-006', 'Striped Cotton Tee',     'Clothing',     14.50, 0.72, 2.2, 4300, 'Pending Approval', undefined,                                       'Air'],
  ['REC-007', 'Bamboo Lounge Set',      'Clothing',     18.00, 0.70, 2.7, 4000, 'Draft',            undefined,                                       'Sea'],
  ['REC-008', 'Ruched Bodycon Dress',   'Clothing',     19.50, 0.74, 2.4, 4200, 'Rejected',         'Intake window missed — next slot w/c 12 May',   'Sea'],
  ['REC-009', 'Oversized Linen Shirt',  'Clothing',     16.00, 0.73, 2.8, 3900, 'Approved',         undefined,                                       'Sea'],
  ['REC-010', 'Platform Derby Shoes',   'Footwear',     24.00, 0.72, 2.5, 4100, 'Draft',            undefined,                                       'Air'],
  ['REC-011', 'Kitten Heel Mules',      'Footwear',     22.50, 0.71, 2.3, 4300, 'Sent',             undefined,                                       'Sea'],
  ['REC-012', 'Wedge Espadrilles',      'Footwear',     23.00, 0.70, 2.7, 3900, 'Approved',         undefined,                                       'Sea'],
  ['REC-013', 'T-Bar Heeled Sandals',   'Footwear',     25.00, 0.73, 2.1, 4200, 'Draft',            undefined,                                       'Air'],
  ['REC-014', 'Woven Raffia Clutch',    'Accessories',  15.00, 0.72, 2.5, 4000, 'Sent',             undefined,                                       'Sea'],
  ['REC-015', 'Pearl Drop Earrings',    'Accessories',  12.50, 0.71, 2.8, 3800, 'Draft',            undefined,                                       'Sea'],
]

// ── Image URLs per category (rotate by index % 2) ────────────────────────────
const IMAGE_URLS: Record<Category, [string, string]> = {
  'Beauty': [
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=80&h=80&fit=crop',
  ],
  'Clothing': [
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop',
  ],
  'Footwear': [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop',
  ],
  'Accessories': [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&h=80&fit=crop',
  ],
}
function imageUrl(cat: Category, idx: number): string { return IMAGE_URLS[cat][idx % 2] }

// ── Expand to full objects ────────────────────────────────────────────────────
const round2 = (n: number) => Math.round(n * 100) / 100
const AVG_REORDER_COVER = 5.5

const INVENTORY_PRODUCTS = INV_RAW.map(([id, name, category, costPrice, marginPct, forwardWeeksCover, stockStatus, weeklySales], idx) => {
  const sellingPrice = round2(costPrice / (1 - marginPct))
  const currentStock = Math.round(weeklySales * forwardWeeksCover)
  const od = ORDER_DEFAULTS[category]
  return {
    id, name,
    sku: `SKU-${id.replace('-', '')}`,
    category,
    costPrice,
    sellingPrice,
    marginPct,
    currentStock,
    weeklySales,
    forwardWeeksCover,
    stockStatus,
    sizeBreakdown: sizeBands(category, stockStatus),
    imageUrl: imageUrl(category, idx),
    supplier: SUPPLIERS[category][idx % 2],
    stockValue: round2(currentStock * costPrice),
    weeksOfStock: forwardWeeksCover,
    monthlyRevenue: round2(weeklySales * 4 * sellingPrice),
    stockoutRisk: stockoutRisk(forwardWeeksCover),
    available: currentStock,
    onOrder: pseudoOnOrder(idx),
    safetyStock: Math.round(weeklySales * 1.5),
    minLevel: weeklySales,
    maxLevel: weeklySales * 8,
    orderFrequency: od.orderFrequency,
    leadTime: od.leadTime,
    minOrderQty: od.minOrderQty,
    packSize: od.packSize,
  }
})

const REORDER_RECOMMENDATIONS = REC_RAW.map(
  ([id, name, category, costPrice, marginPct, forwardWeeksCover, recommendedReorderQty, approvalStatus, rejectionReason, recommendedFreight], idx) => {
    const weeklySales  = Math.round(recommendedReorderQty / AVG_REORDER_COVER)
    const sellingPrice = round2(costPrice / (1 - marginPct))
    const currentStock = Math.round(weeklySales * forwardWeeksCover)
    const od           = ORDER_DEFAULTS[category]
    const available    = currentStock
    const onOrderQty   = pseudoOnOrder(idx + 20)
    const curve        = buildSizeCurve(category, available, onOrderQty, recommendedReorderQty, weeklySales)

    const obj: Record<string, unknown> = {
      id, name,
      sku: `SKU-${id.replace('-', '')}`,
      category,
      costPrice,
      sellingPrice,
      marginPct,
      currentStock,
      weeklySales,
      forwardWeeksCover,
      recommendedReorderQty,
      avgReorderCoverWeeks: AVG_REORDER_COVER,
      approvalStatus,
      recommendedFreight,
      sizeBreakdown: sizeBands(category, 'low-stock'),
      imageUrl: imageUrl(category, idx),
      supplier: SUPPLIERS[category][idx % 2],
      stockValue: round2(currentStock * costPrice),
      weeksOfStock: forwardWeeksCover,
      monthlyRevenue: round2(weeklySales * 4 * sellingPrice),
      stockoutRisk: stockoutRisk(forwardWeeksCover),
      available,
      onOrder: onOrderQty,
      safetyStock: Math.round(weeklySales * 1.5),
      minLevel: weeklySales,
      maxLevel: weeklySales * 8,
      orderFrequency: od.orderFrequency,
      leadTime: od.leadTime,
      minOrderQty: od.minOrderQty,
      packSize: od.packSize,
      exFactoryDate: addDays('2026-05-12', idx * 3),
      receiptDate:   addDays('2026-06-02', idx * 3),
      totalCost: round2(recommendedReorderQty * costPrice),
    }
    if (rejectionReason) obj.rejectionReason = rejectionReason
    if (curve)           obj.sizeCurve = curve
    return obj
  }
)

// ── Emit mockData.ts ──────────────────────────────────────────────────────────
const TYPES = `// AUTO-GENERATED — do not edit by hand.
// Regenerate with: npx tsx scripts/generate-mock-data.ts

export type Category       = 'Beauty' | 'Clothing' | 'Footwear' | 'Accessories'
export type StockStatus    = 'on-target' | 'low-stock' | 'overstocked'
export type ApprovalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Sent'
export type StockoutRisk   = 'Low' | 'Medium' | 'High'

export interface SizeBand {
  label: string
  pct:   number
  color: string
}

export interface SizeCurveEntry {
  size:        string
  available:   number
  onOrder:     number
  recommended: number
  sales:       number
  targetMin:   number
  targetMax:   number
}

export interface InventoryProduct {
  id:               string
  name:             string
  sku:              string
  category:         Category
  costPrice:        number
  sellingPrice:     number
  marginPct:        number
  currentStock:     number
  weeklySales:      number
  forwardWeeksCover: number
  stockStatus:      StockStatus
  sizeBreakdown:    SizeBand[]
  imageUrl:         string
  supplier:         string
  stockValue:       number
  weeksOfStock:     number
  monthlyRevenue:   number
  stockoutRisk:     StockoutRisk
  available:        number
  onOrder:          number
  safetyStock:      number
  minLevel:         number
  maxLevel:         number
  orderFrequency:   string
  leadTime:         string
  minOrderQty:      number
  packSize:         number
}

export interface ReorderRecommendation {
  id:                    string
  name:                  string
  sku:                   string
  category:              Category
  costPrice:             number
  sellingPrice:          number
  marginPct:             number
  currentStock:          number
  weeklySales:           number
  forwardWeeksCover:     number
  recommendedReorderQty: number
  avgReorderCoverWeeks:  number
  approvalStatus:        ApprovalStatus
  recommendedFreight:    'Sea' | 'Air'
  rejectionReason?:      string
  sizeBreakdown:         SizeBand[]
  sizeCurve?:            SizeCurveEntry[]
  imageUrl:              string
  supplier:              string
  stockValue:            number
  weeksOfStock:          number
  monthlyRevenue:        number
  stockoutRisk:          StockoutRisk
  available:             number
  onOrder:               number
  safetyStock:           number
  minLevel:              number
  maxLevel:              number
  orderFrequency:        string
  leadTime:              string
  minOrderQty:           number
  packSize:              number
  exFactoryDate:         string
  receiptDate:           string
  totalCost:             number
}
`

const body =
  TYPES +
  `\nexport const INVENTORY_PRODUCTS: InventoryProduct[] = ${JSON.stringify(INVENTORY_PRODUCTS, null, 2)}\n` +
  `\nexport const REORDER_RECOMMENDATIONS: ReorderRecommendation[] = ${JSON.stringify(REORDER_RECOMMENDATIONS, null, 2)}\n`

const outPath = resolve(process.cwd(), 'src/mockData.ts')
writeFileSync(outPath, body, 'utf8')
console.log(`✓ src/mockData.ts written`)
console.log(`  inventory:  ${INVENTORY_PRODUCTS.length} products`)
console.log(`  reorder:    ${REORDER_RECOMMENDATIONS.length} recommendations`)
