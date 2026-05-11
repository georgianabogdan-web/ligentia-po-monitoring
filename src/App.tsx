import { useState, useEffect, useRef } from 'react'
import {
  AlertTriangle, TrendingDown, TrendingUp,
  Minus, Package, Sparkles, Home, BookOpen, HelpCircle, Ghost,
  Download, Search, Star, ArrowRight, Building2,
  ChevronDown, RefreshCw, Activity,
  Bot, User, X, Clock, Mail, Check,
  Calendar, MessageSquare, Send, ChevronRight, ChevronLeft, Plus, AlertCircle, Info,
} from 'lucide-react'
import { ComposedChart, LineChart, Cell, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts'
import { INVENTORY_PRODUCTS, REORDER_RECOMMENDATIONS } from './mockData'
import type { SizeBand, StockStatus, ApprovalStatus, SizeCurveEntry, InventoryProduct, ReorderRecommendation, Category, FreightScenarioData } from './mockData'
import { REPLEN_PRODUCTS } from './replenData'
import type { ReplenProduct, DCStatus as ReplenDCStatus } from './replenData'

// ── Types ──────────────────────────────────────────────────────────────────────
type POStatus =
  | 'On track'
  | 'Sent to supplier'
  | 'Acknowledged'
  | 'Late DC booking'
  | 'Date change required'
  | 'Ex-factory delay'
  | 'In Transit'
  | 'Partially Delivered'
  | 'Delivered'

type SupplierTrend = 'improving' | 'stable' | 'deteriorating'
type Tab = 'alerts' | 'inventory' | 'reorder' | 'reorder-manager' | 'po-monitoring' | 'replenishment'
type AlertBucket = 'ex-factory-delay' | 'date-change' | 'submission-deadline' | 'intake-volume'

interface Supplier {
  id: string
  name: string
  onTimeRate: number
  avgDelayDays: number
  contractualLeadTimeDays: number
  trend: SupplierTrend
  openPOs: number
  category: string
  hasSubmissionDeadline?: string
}

interface PO {
  id: string
  supplierId: string
  product: string
  category: string
  createdOn: string
  expectedDelivery: string
  revisedDelivery?: string
  status: POStatus
  priority: boolean
  quantity: number
  skus: number
  orderValue: string
  freight: 'Sea' | 'Air'
  handledBy: 'agent' | 'human'
}

interface ActionItem {
  id: string
  bucket: AlertBucket
  poId?: string
  supplierId?: string
  headline: string
  detail: string
  suggestedAction: string
  metric: string
  // ex-factory-delay extras
  daysLate?:    number
  chaseCount?:  number
  unchased?:    boolean  // no chase in last 7 days
  // date-change extras
  proposalOldDate?: string
  proposalNewDate?: string
  extensionDays?:   number
}


interface RegisterFilter {
  search: string
  status: string
  supplier: string
  handling: string
}

// ── PO Event & Chase Types ─────────────────────────────────────────────────────
type RAGStatus   = 'green' | 'amber' | 'red'
type ChaseType   = 'booking_in' | 'handover' | 'cpr'
type POEventType = 'chase_sent' | 'supplier_reply' | 'date_change_proposed' | 'date_change_applied' | 'manual_note' | 'decision_recorded'

type ChaseThreadMsgStatus = 'sent' | 'auto-sent' | 'awaiting-review' | 'received' | 'dismissed'
interface ChaseThreadMsg {
  id:         string
  sender:     'you' | 'agent' | string
  timestamp:  string
  body:       string
  status:     ChaseThreadMsgStatus
  emailType?: string
}
interface ThreadSystemEvent {
  id:        string
  timestamp: string
  body:      string
}
interface ChaseThread {
  status:       'awaiting-reply' | 'reply-received' | 'no-reply-overdue' | 'resolved'
  startedAt:    string
  messages:     ChaseThreadMsg[]
  systemEvents?: ThreadSystemEvent[]
}
interface TriggerMessage {
  sender: string
  senderEmail: string
  timestamp: string
  body: string
  agentSummary?: string
  priorMessages?: { sender: string; timestamp: string; body: string; direction: 'inbound' | 'outbound' }[]
}
interface ActionGroup { supplierId: string; type: 'overdue' | 'at_risk' | 'late_dc'; pos: PO[]; triggerMessage?: TriggerMessage }

interface POEvent {
  id:        string
  type:      POEventType
  timestamp: string
  body:      string
  author:    'agent' | 'buyer'
}


interface AgentLogEntry {
  time: string
  type: 'scan' | 'scorecard' | 'date_change' | 'at_risk' | 'escalation' | 'chase_draft' | 'low_confidence'
  message: string
}

interface ProductOverride {
  moqGrouping?: string
  moqQty?: number
  fwcMin?: number
  fwcMax?: number
  promoPct?: number
}

// Only a handful of products have a seeded Promo % — others show "—"
const SEEDED_PROMO_PCT: Record<string, number> = {
  'INV-001': 22,  // Hydrating Face Serum (Beauty)
  'INV-003': 14,  // Vitamin C Moisturiser (Beauty)
  'INV-007': 35,  // Floral Midi Dress (Clothing)
  'INV-010': 28,  // Jersey Maxi Dress (Clothing)
  'INV-013': 20,  // Block Heel Ankle Boots (Footwear)
  'INV-018': 12,  // Leather Crossbody Bag (Accessories)
}
function getBasePromoPct(p: { id: string; category: string }): number | null {
  return SEEDED_PROMO_PCT[p.id] ?? null
}

interface InvAuditEntry {
  id: string
  user: string
  initial: string
  date: string
  changes: { field: string; oldVal: string; newVal: string }[]
  reason: string
}

const SEEDED_INV_AUDIT: Record<string, InvAuditEntry[]> = {
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

// ── Inquiry & Negotiation Types ───────────────────────────────────────────────
type NegotiationStatus = 'idle' | 'draft' | 'sending' | 'sent' | 'awaiting_reply' | 'replied' | 'follow_up' | 'agreed' | 'escalated'

interface SupplierNegReply {
  receivedAt:     string
  offeredCP:      number
  moqOffered:     number
  leadTimeWeeks:  number
  deliveryWindow: string
  accepted:       boolean
  scenario:       'accepted' | 'counter' | 'escalate' | 'uncertain'
  rawText:        string
}

interface InquiryRound {
  roundNumber:   number
  sentAt:        string | null
  emailBody:     string
  requestedCP:   number
  supplierReply: SupplierNegReply | null
}

interface InquiryThread {
  recId:          string
  supplierId:     string
  status:         NegotiationStatus
  rounds:         InquiryRound[]
  agreedCP:       number | null
  agreedMOQ:      number | null
  flaggedReason:  string | null
  internalNotes:  string
  scenario:       'accepted' | 'counter' | 'escalate' | 'uncertain'
}

// ── Data ───────────────────────────────────────────────────────────────────────
const SUPPLIERS: Supplier[] = [
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

const SUPPLIER_EMAILS: Record<string, string> = {
  'ET': 'orders@easterntextiles.cn',
  'SS': 'production@summerstyles.com',
  'NK': 'orders@nordicknitwear.dk',
  'BA': 'wholesale@basicapparel.co.uk',
  'TB': 'orders@trendyboots.co.uk',
  'UF': 'ops@urbanfootwear.com',
  'LL': 'orders@luxeleather.it',
  'EL': 'orders@esteelauder.co.uk',
}

const ALL_POS: PO[] = [
  // Ex-Factory Delays — human needed
  { id: 'PO-2756', supplierId: 'ET', product: 'Beach Shorts Collection',   category: "Women's Apparel", createdOn: '01/12/25', expectedDelivery: '2026-04-08', status: 'Ex-factory delay',      priority: true,  quantity: 1200, skus: 14, orderValue: '£12,400', freight: 'Sea', handledBy: 'human' },
  { id: 'PO-2834', supplierId: 'ET', product: 'Linen Summer Dresses',      category: "Women's Apparel", createdOn: '15/12/25', expectedDelivery: '2026-04-14', status: 'Ex-factory delay',      priority: false, quantity: 800,  skus: 8,  orderValue: '£18,200', freight: 'Sea', handledBy: 'human' },
  { id: 'PO-2891', supplierId: 'SS', product: 'Floral Maxi Dress',         category: "Women's Apparel", createdOn: '05/01/26', expectedDelivery: '2026-04-19', status: 'Ex-factory delay',      priority: true,  quantity: 950,  skus: 6,  orderValue: '£22,800', freight: 'Sea', handledBy: 'human' },
  // Date Change Requests — human needed
  { id: 'PO-2901', supplierId: 'NK', product: 'Cotton Knit Jumpers',       category: 'Knitwear',        createdOn: '20/12/25', expectedDelivery: '2026-04-20', revisedDelivery: '2026-04-27', status: 'Date change required', priority: false, quantity: 600,  skus: 10, orderValue: '£14,400', freight: 'Sea', handledBy: 'human' },
  { id: 'PO-2845', supplierId: 'TB', product: 'Ankle Strap Heels',         category: 'Footwear',        createdOn: '10/01/26', expectedDelivery: '2026-04-22', revisedDelivery: '2026-05-09', status: 'Date change required', priority: false, quantity: 600,  skus: 8,  orderValue: '£21,000', freight: 'Sea', handledBy: 'human' },
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
]

// Links each PO to the nearest equivalent InventoryProduct or ReorderRecommendation.
// Used to surface live stock/commercial context in the PO Line Drawer's Product tab.
const PO_PRODUCT_MAP: Record<string, string> = {
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

// Maps negotiation rec IDs → resulting PO IDs (for closed/applied negotiations)
const NEG_PO_MAP: Record<string, string> = {
  'REC-002': 'PO-3060',
}

// ── Seeded PO Event Log ────────────────────────────────────────────────────────
const SEED_PO_EVENTS: Record<string, POEvent[]> = {
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

// Static items for buckets without a PO data source (deadlines, volume)
const STATIC_KANBAN_ITEMS: ActionItem[] = [
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

// Derive live action items from PO data + event log
function computeKanbanItems(
  poEventsMap: Map<string, POEvent[]>,
  lastChasedMap: Map<string, string>
): ActionItem[] {
  const today = new Date()
  const items: ActionItem[] = []

  // ── Ex-factory delays ──────────────────────────────────────────────────────
  ALL_POS.filter(po => po.status === 'Ex-factory delay').forEach(po => {
    const sup    = getSupplier(po.supplierId)
    const events = poEventsMap.get(po.id) ?? []
    const chases = events.filter(e => e.type === 'chase_sent')
    const lastChaseTs = (() => {
      const lc = lastChasedMap.get(po.id)
      if (lc) return new Date(lc).getTime()
      const sorted = [...chases].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      return sorted[0] ? new Date(sorted[0].timestamp).getTime() : 0
    })()
    const daysSinceChase = lastChaseTs ? Math.floor((today.getTime() - lastChaseTs) / 86400000) : 999
    const daysLate  = Math.max(0, Math.floor((today.getTime() - new Date(po.expectedDelivery).getTime()) / 86400000))
    const chaseCount = chases.length
    const unchased   = daysSinceChase >= 7

    items.push({
      id: `ex-${po.id}`,
      bucket: 'ex-factory-delay',
      poId: po.id,
      supplierId: po.supplierId,
      headline: `${sup?.name ?? po.supplierId} — ${daysLate}d past ex-factory`,
      detail: chaseCount === 0
        ? `No chase sent yet. ${po.product} (${po.orderValue}).${po.priority ? ' KEY item.' : ''}`
        : chaseCount === 1
        ? `Agent sent 1 chase email, awaiting response. ${po.product}.${po.priority ? ' KEY item.' : ''}`
        : `Agent sent ${chaseCount} chases with no resolution. ${po.product}.${po.priority ? ' KEY item at risk of missed sell-through.' : ''}`,
      suggestedAction: chaseCount >= 2
        ? 'Escalate to supplier manager. Demand written ETA and proof of dispatch today.'
        : 'Chase supplier for dispatch confirmation and booking reference.',
      metric: `${daysLate}d overdue`,
      daysLate,
      chaseCount,
      unchased,
    })
  })

  // ── Date change requests ───────────────────────────────────────────────────
  ALL_POS.filter(po => po.status === 'Date change required').forEach(po => {
    const sup    = getSupplier(po.supplierId)
    const events = poEventsMap.get(po.id) ?? []
    if (events.some(e => e.type === 'date_change_applied' || e.type === 'decision_recorded')) return
    const oldDate       = po.expectedDelivery
    const newDate       = po.revisedDelivery ?? ''
    const extensionDays = newDate
      ? Math.round((new Date(newDate).getTime() - new Date(oldDate).getTime()) / 86400000)
      : 0
    items.push({
      id: `dc-${po.id}`,
      bucket: 'date-change',
      poId: po.id,
      supplierId: po.supplierId,
      headline: `${sup?.name ?? po.supplierId} requesting +${extensionDays}d extension`,
      detail: `${po.product} originally due ${formatDate(oldDate)}${newDate ? `, revised to ${formatDate(newDate)}` : ''}. ${po.orderValue}.`,
      suggestedAction: 'Review impact on intake plan. Approve if covered, or negotiate a partial earlier shipment.',
      metric: newDate ? `${formatDate(oldDate)} → ${formatDate(newDate)}` : `Due ${formatDate(oldDate)}`,
      proposalOldDate: oldDate,
      proposalNewDate: newDate,
      extensionDays,
    })
  })

  // ── Static deadline / volume items ────────────────────────────────────────
  STATIC_KANBAN_ITEMS.forEach(item => items.push(item))

  return items
}


// ── CP Rule Engine (hardcoded) ────────────────────────────────────────────────
const CP_RULES = {
  openingAsk:         0.94,
  targetCPFloor:      0.90,
  targetCPCeiling:    0.97,
  maxRounds:          3,
  concessionPerRound: 0.01,
  moqMaxMultiplier:   1.5,
}

const ESCALATION_RULES = {
  cpMaxDeltaPct:    0.08,
  moqMaxMultiplier: 1.5,
  leadTimeMaxWeeks: 8,
}

type CpRulesState = { openingAskPct: number; escalateIfPct: number; maxRounds: number }
const DEFAULT_CP_RULES: CpRulesState = { openingAskPct: 6, escalateIfPct: 8, maxRounds: 3 }

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

const SEEDED_THREADS: Record<string, InquiryThread> = {
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

// ── Fit Families ──────────────────────────────────────────────────────────────
const FIT_FAMILIES = [
  { id: 'ff-jersey',      label: 'Jersey Basics',    fabric: 'Single jersey, 180–220 gsm',         sharedMOQ: 600 },
  { id: 'ff-woven-btm',   label: 'Woven Bottoms',    fabric: 'Cotton twill / chino, 240–280 gsm',  sharedMOQ: 480 },
  { id: 'ff-fleece',      label: 'Fleece & Sweat',   fabric: 'French terry / loopback fleece',     sharedMOQ: 360 },
  { id: 'ff-canvas-foot', label: 'Canvas Footwear',  fabric: 'Cotton canvas upper, rubber sole',   sharedMOQ: 240 },
  { id: 'ff-denim',       label: 'Denim',            fabric: 'Selvedge / stretch denim, 10–12 oz', sharedMOQ: 300 },
  { id: 'ff-knit-acc',    label: 'Knit Accessories', fabric: 'Acrylic / wool blend knit',          sharedMOQ: 720 },
]
type FitFamily = typeof FIT_FAMILIES[0]

const REC_FIT_FAMILY_MAP: Record<string, string> = (() => {
  const catFamilies: Record<string, string[]> = {
    Beauty:      [],
    Clothing:    ['ff-jersey', 'ff-woven-btm', 'ff-fleece', 'ff-denim'],
    Footwear:    ['ff-canvas-foot'],
    Accessories: ['ff-knit-acc'],
  }
  const result: Record<string, string> = {}
  const counters: Record<string, number> = {}
  REORDER_RECOMMENDATIONS.forEach(r => {
    const ids = catFamilies[r.category] ?? []
    if (ids.length === 0) return
    const i = counters[r.category] ?? 0
    result[r.id] = ids[i % ids.length]
    counters[r.category] = i + 1
  })
  return result
})()

function getFitFamily(recId: string): FitFamily | null {
  const id = REC_FIT_FAMILY_MAP[recId]
  return id ? (FIT_FAMILIES.find(f => f.id === id) ?? null) : null
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tt({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tt inline-flex items-baseline">
      <span className="border-b border-dotted border-gray-400 cursor-help">{children}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tt:block z-50 w-52 bg-gray-900 text-white text-[10px] leading-snug rounded-lg px-2.5 py-2 shadow-xl whitespace-normal text-left">
        {tip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
const SPARKLINE_DATA: Record<string, number[]> = {
  deteriorating: [86, 80, 74, 68, 62, 57],
  stable:        [78, 81, 77, 80, 79, 81],
  improving:     [65, 69, 73, 77, 80, 84],
}
function Sparkline({ trend }: { trend: 'deteriorating' | 'stable' | 'improving' }) {
  const pts  = SPARKLINE_DATA[trend]
  const min  = Math.min(...pts)
  const max  = Math.max(...pts)
  const W = 48, H = 18
  const x = (i: number) => (i / (pts.length - 1)) * W
  const y = (v: number) => H - ((v - min) / (max - min + 1)) * H
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const color = trend === 'improving' ? '#22c55e' : trend === 'deteriorating' ? '#ef4444' : '#94a3b8'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1).toFixed(1)} cy={y(pts[pts.length - 1]).toFixed(1)} r="2" fill={color} />
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function getSupplier(id: string) { return SUPPLIERS.find(s => s.id === id) }
function getPO(id: string) { return ALL_POS.find(p => p.id === id) }

type LinkedProduct = Pick<InventoryProduct,
  'id' | 'name' | 'sku' | 'imageUrl' | 'supplier' |
  'costPrice' | 'sellingPrice' | 'marginPct' |
  'currentStock' | 'weeksOfStock' | 'weeklySales' |
  'stockoutRisk' | 'stockValue' | 'monthlyRevenue' |
  'onOrder' | 'safetyStock' | 'minLevel' | 'maxLevel' |
  'sizeBreakdown' | 'available'>

function getLinkedProduct(poId: string): LinkedProduct | undefined {
  const productId = PO_PRODUCT_MAP[poId]
  if (!productId) return undefined
  const inv = INVENTORY_PRODUCTS.find(p => p.id === productId)
  if (inv) return inv as LinkedProduct
  const rec = REORDER_RECOMMENDATIONS.find(p => p.id === productId) as (ReorderRecommendation & { available?: number }) | undefined
  if (!rec) return undefined
  return rec as unknown as LinkedProduct
}

function getXFactoryDate(po: PO): Date {
  const dlv = new Date(po.revisedDelivery ?? po.expectedDelivery)
  return new Date(dlv.getTime() - (po.freight === 'Sea' ? 28 : 10) * 86400000)
}

function computeRAG(po: PO): RAGStatus {
  const today = new Date()
  const xf    = getXFactoryDate(po)
  const dlv   = new Date(po.revisedDelivery ?? po.expectedDelivery)
  const daysToXF  = Math.ceil((xf.getTime()  - today.getTime()) / 86400000)
  const daysToDlv = Math.ceil((dlv.getTime() - today.getTime()) / 86400000)
  if (po.status === 'Ex-factory delay') return 'red'
  if (daysToDlv < -7) return 'red'
  if (daysToXF < 0 && !['In Transit', 'Partially Delivered', 'Delivered'].includes(po.status)) return 'red'
  if (po.status === 'Date change required') return 'amber'
  if (po.freight === 'Sea' && daysToXF >= 0 && daysToXF <= 14) return 'amber'
  if (daysToDlv >= 0 && daysToDlv <= 7) return 'amber'
  return 'green'
}

const RAG_CFG: Record<RAGStatus, { dot: string; bg: string; text: string; label: string }> = {
  red:   { dot: 'bg-red-500',   bg: 'bg-red-50',   text: 'text-red-700',   label: 'At Risk'  },
  amber: { dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Watch'    },
  green: { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', label: 'On Track' },
}




const STATUS_CONFIG: Record<POStatus, { bg: string; text: string; dot: string; border: string }> = {
  'On track':              { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',   border: 'border-green-200' },
  'Sent to supplier':      { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400',    border: 'border-blue-200' },
  'Acknowledged':          { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400',  border: 'border-indigo-200' },
  'Late DC booking':       { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',   border: 'border-amber-200' },
  'Date change required':  { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400',  border: 'border-orange-200' },
  'Ex-factory delay':      { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',     border: 'border-red-200' },
  'In Transit':            { bg: 'bg-teal-50',   text: 'text-teal-700',   dot: 'bg-teal-400',    border: 'border-teal-200' },
  'Partially Delivered':   { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400',  border: 'border-orange-200' },
  'Delivered':             { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',    border: 'border-gray-200' },
}

const BUCKET_CONFIG: Record<AlertBucket, { label: string; color: string; dot: string }> = {
  'ex-factory-delay':   { label: 'Ex-factory delay',    color: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  'date-change':        { label: 'Date Change Request',  color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  'submission-deadline':{ label: 'Submission Deadline',  color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
  'intake-volume':      { label: 'Intake Volume Alert',  color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
}

// ── Peak Logo ──────────────────────────────────────────────────────────────────
function PeakLogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
      <path d="M40 26.2C40 26.2 40 26.1 40 26C40 26 40 25.9 39.9 25.8L34.1 20L39.9 14.2C40.1 14 40.2 13.6 40.1 13.3C40 13 39.7 12.8 39.3 12.8H27.4V0.8C27.4 0.5 27.2 0.2 26.9 0C26.6 -0.1 26.2 0 26 0.2L13.5 12.7H0.8C0.3 12.7 0 13.1 0 13.5V26.3C0 26.8 0.4 27.1 0.8 27.1H11.5L6.6 32C6.3 32.3 6.3 32.9 6.6 33.2L13 39.6C13.1 39.7 13.2 39.7 13.3 39.7H38.8C39.3 39.7 39.6 39.3 39.6 38.9V26.1L40 26.2ZM14.5 14.5H25.6V25.6H14.5V14.5ZM27.2 15.7L37.1 25.6H27.2V15.7ZM37.1 14.5L32.8 18.8L28.5 14.5H37.1ZM25.5 2.9V12.8H15.6L25.5 2.9ZM1.7 14.5H12.8V25.6H1.7V14.5ZM12.8 28.4V37.1L8.5 32.8L12.8 28.4ZM14.5 27.2H25.6V38.3H14.5V27.2ZM38.3 38.3H27.2V27.2H38.3V38.3Z" fill="black"/>
    </svg>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar() {
  return (
    <div className="w-14 bg-white border-r border-gray-100 flex flex-col items-center py-3 shrink-0 min-h-screen">
      <div className="flex items-center justify-center w-full px-2 mb-4"><PeakLogoMark /></div>
      <div className="flex flex-col items-center gap-0.5 w-full px-1.5">
        <button className="w-full h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><Home className="w-4 h-4" /></button>
        <button className="w-full h-9 flex items-center justify-center rounded-lg bg-amber-50 transition-colors"><Package className="w-4 h-4 text-amber-600" /></button>
        <button className="w-full h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><Activity className="w-4 h-4" /></button>
        <button className="w-full h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><Building2 className="w-4 h-4" /></button>
      </div>
      <div className="flex-1" />
      <div className="flex flex-col items-center gap-0.5 w-full px-1.5">
        <button className="w-full h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><BookOpen className="w-4 h-4" /></button>
        <button className="w-full h-9 flex items-center justify-center rounded-lg text-purple-500 hover:bg-gray-50 transition-colors"><Sparkles className="w-4 h-4" /></button>
        <div className="w-8 border-t border-gray-100 my-1" />
        <button className="w-full h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><Ghost className="w-4 h-4" /></button>
        <button className="w-full h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><HelpCircle className="w-4 h-4" /></button>
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mt-1">
          <span className="text-xs font-bold text-white">G</span>
        </div>
      </div>
    </div>
  )
}

// ── Action Card ────────────────────────────────────────────────────────────────
function ActionCard({
  item,
  onTakeAction,
  onViewPO,
  onDismiss,
  onChaseNow,
  onAcceptDate,
  onRejectDate,
}: {
  item:          ActionItem
  onTakeAction:  () => void
  onViewPO?:     () => void
  onDismiss:     () => void
  onChaseNow?:   () => void
  onAcceptDate?: () => void
  onRejectDate?: () => void
}) {
  const bc       = BUCKET_CONFIG[item.bucket]
  const po       = item.poId ? getPO(item.poId) : undefined
  const supplier = item.supplierId ? getSupplier(item.supplierId) : undefined

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Bucket badge + metric */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${bc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${bc.dot}`} />{bc.label}
        </span>
        <span className="text-[11px] font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{item.metric}</span>
      </div>

      {/* PO / supplier identity */}
      {po ? (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-900">{po.id}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-600">{supplier?.name ?? po.supplierId}</span>
            {po.priority && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                <Star className="w-2.5 h-2.5" fill="currentColor" />KEY
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{po.product}</div>
        </div>
      ) : (
        <div className="px-3 pb-1">
          <div className="text-xs font-bold text-gray-900">{supplier?.name ?? 'All suppliers'}</div>
        </div>
      )}

      {/* Headline + detail */}
      <div className="px-3 pb-1.5">
        <p className="text-xs font-semibold text-gray-800 mb-0.5">{item.headline}</p>
        <p className="text-[11px] text-gray-500 leading-snug">{item.detail}</p>
      </div>

      {/* Suggested action */}
      <div className="px-3 pb-1.5 flex items-start gap-1.5">
        <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[11px] font-semibold text-indigo-700 flex-1">{item.suggestedAction}</p>
      </div>

      {/* Inline date-change proposal */}
      {item.bucket === 'date-change' && item.proposalOldDate && item.proposalNewDate && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[11px] text-gray-500">{formatDate(item.proposalOldDate)}</span>
            <ArrowRight className="w-3 h-3 text-amber-400" />
            <span className="text-[11px] font-semibold text-gray-800">{formatDate(item.proposalNewDate)}</span>
            <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              +{item.extensionDays}d
            </span>
          </div>
        </div>
      )}

      {/* Action buttons — vary by bucket */}
      <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap border-t border-gray-50 pt-2">
        {item.bucket === 'date-change' ? (
          <>
            <button
              onClick={onAcceptDate}
              className="h-6 px-2.5 text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Accept
            </button>
            <button
              onClick={onRejectDate}
              className="h-6 px-2.5 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={onTakeAction}
              className="h-6 px-2.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              View detail
            </button>
          </>
        ) : item.bucket === 'ex-factory-delay' ? (
          <>
            <button
              onClick={onTakeAction}
              className="h-6 px-2.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              Take Action →
            </button>
            {item.unchased && onChaseNow && (
              <button
                onClick={onChaseNow}
                className="h-6 px-2.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1"
              >
                <Send className="w-3 h-3" /> Chase Now
              </button>
            )}
            {onViewPO && (
              <button
                onClick={onViewPO}
                className="h-6 px-2.5 text-[11px] font-semibold text-gray-600 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
              >
                View PO
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onTakeAction}
            className="h-6 px-2.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            Take Action →
          </button>
        )}
        <button
          onClick={onDismiss}
          className="ml-auto h-6 px-2 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors flex items-center gap-1"
        >
          <X className="w-3 h-3" /> Dismiss
        </button>
      </div>
    </div>
  )
}

// ── Needs Action Panel (collapsible) ──────────────────────────────────────────


// ── Overview chart data ────────────────────────────────────────────────────────
// Clean 4-week sawtooth: on-hand oscillates trough→peak, on-order = 2 orders in flight
// onOrder is ~2× available so the pipeline segment clearly dominates the bar

const AVAILABILITY_CHART_DATA = [
  { week: 'W1 Jan', actual: 99.8, target: 97.5 },
  { week: 'W2 Jan', actual: 99.6, target: 97.5 },
  { week: 'W3 Jan', actual: 99.9, target: 97.5 },
  { week: 'W4 Jan', actual: 100.0, target: 97.5 },
  { week: 'W1 Feb', actual: 99.7, target: 97.5 },
  { week: 'W2 Feb', actual: 99.4, target: 97.5 },
  { week: 'W3 Feb', actual: 99.8, target: 97.5 },
  { week: 'W4 Feb', actual: 99.5, target: 97.5 },
  { week: 'W1 Mar', actual: 99.9, target: 97.5 },
  { week: 'W2 Mar', actual: 99.6, target: 97.5 },
  { week: 'W3 Mar', actual: 99.8, target: 97.5 },
  { week: 'W4 Mar', actual: 99.7, target: 97.5 },
]

// ── Alert Digest ───────────────────────────────────────────────────────────────
const SUBCATEGORY_MAP: Record<Category, string[]> = {
  'Beauty':      ['Skincare', 'Makeup', 'Fragrance', 'Bath & Body'],
  'Clothing':    ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Knitwear'],
  'Footwear':    ['Trainers', 'Boots', 'Heels', 'Sandals'],
  'Accessories': ['Bags', 'Belts', 'Jewellery'],
}

function getSubcategory(p: InventoryProduct): string {
  const n = p.name.toLowerCase()
  switch (p.category) {
    case 'Beauty':
      if (n.includes('serum') || n.includes('cream') || n.includes('mist') || n.includes('moistur') || n.includes('spf')) return 'Skincare'
      if (n.includes('foundation') || n.includes('mascara') || n.includes('lipstick') || n.includes('illuminat') || n.includes('highlighter') || n.includes('glow')) return 'Makeup'
      if (n.includes('shower') || n.includes('bath') || n.includes('gel')) return 'Bath & Body'
      if (n.includes('fragrance') || n.includes('perfume')) return 'Fragrance'
      return 'Skincare'
    case 'Clothing':
      if (n.includes('dress') || n.includes('skirt') || n.includes('midi') || n.includes('maxi') || n.includes('wrap')) return 'Dresses'
      if (n.includes('blazer') || n.includes('jacket') || n.includes('coat') || n.includes('outerwear')) return 'Outerwear'
      if (n.includes('jumper') || n.includes('knitwear') || n.includes('cardigan') || n.includes('roll-neck') || n.includes('wool') || n.includes('knit')) return 'Knitwear'
      if (n.includes('trouser') || n.includes('jeans') || n.includes('short') || n.includes('chino') || n.includes('linen') || n.includes('pant')) return 'Bottoms'
      return 'Tops'
    case 'Footwear':
      if (n.includes('boot')) return 'Boots'
      if (n.includes('heel') || n.includes('pump') || n.includes('wedge') || n.includes('slingback')) return 'Heels'
      if (n.includes('sandal') || n.includes('espadrille') || n.includes('flip')) return 'Sandals'
      return 'Trainers'
    case 'Accessories':
      if (n.includes('belt')) return 'Belts'
      if (n.includes('jewel') || n.includes('necklace') || n.includes('ring') || n.includes('earring')) return 'Jewellery'
      return 'Bags'
  }
}

// ── Chase Thread Panel ────────────────────────────────────────────────────────
function AlertDigest() {
  const [filterCat, setFilterCat]         = useState<Category | ''>('')
  const [filterSubcat, setFilterSubcat]   = useState('')
  const [stockChartUnit, setStockChartUnit] = useState<'value' | 'units' | 'cover'>('value')

  const OVERVIEW_AVG_COST = 22

  const filteredProds = INVENTORY_PRODUCTS.filter(p =>
    (!filterCat    || p.category === filterCat) &&
    (!filterSubcat || getSubcategory(p) === filterSubcat)
  )

  const eligibleProds    = filteredProds.filter(p => p.weeklySales > 0)
  const totalWeeklySales = eligibleProds.reduce((s, p) => s + p.weeklySales, 0)
  const totalAvailable   = eligibleProds.reduce((s, p) => s + p.available, 0)
  const totalSafetyStock = eligibleProds.reduce((s, p) => s + p.safetyStock, 0)
  // Chart on-order is inflated to 60% of available for visual prominence (presentation layer only —
  // per-SKU on-order values in Reorder tab are unaffected).
  const chartOnOrder  = totalWeeklySales > 0 ? Math.round(0.8 * totalAvailable) : 0
  const networkCover  = totalWeeklySales > 0 ? (totalAvailable + chartOnOrder) / totalWeeklySales : 0

  const CHART_WEEK_LABELS = ['W1 Jan','W2 Jan','W3 Jan','W4 Jan','W1 Feb','W2 Feb','W3 Feb','W4 Feb','W1 Mar','W2 Mar','W3 Mar','W4 Mar']
  const peakAvail    = totalWeeklySales > 0 ? Math.round(totalAvailable * 0.55 + 0.6 * totalWeeklySales) : 3900
  // On-order sawtooth offset by 2 weeks so its peak lands mid-cycle of available's decline —
  // reads visually as "replenishment order placed as stock runs down".
  const peakOnOrder  = totalWeeklySales > 0 ? Math.round(chartOnOrder + 1.5 * totalWeeklySales) : 6000
  const dynamicChartData  = CHART_WEEK_LABELS.map((week, i) => ({
    week,
    available:   Math.max(totalSafetyStock, peakAvail - (i % 4) * totalWeeklySales),
    onOrder:     Math.max(0, peakOnOrder - ((i + 2) % 4) * totalWeeklySales),
    safetyStock: totalSafetyStock,
  }))
  const overviewChartData = stockChartUnit === 'cover'
    ? dynamicChartData.map(d => ({ ...d, available: +(d.available / totalWeeklySales).toFixed(1), onOrder: +(d.onOrder / totalWeeklySales).toFixed(1), safetyStock: +(d.safetyStock / totalWeeklySales).toFixed(1) }))
    : stockChartUnit === 'value'
    ? dynamicChartData.map(d => ({ ...d, available: Math.round(d.available * OVERVIEW_AVG_COST / 1000), onOrder: Math.round(d.onOrder * OVERVIEW_AVG_COST / 1000), safetyStock: Math.round(d.safetyStock * OVERVIEW_AVG_COST / 1000) }))
    : dynamicChartData
  const subcatOptions = filterCat ? SUBCATEGORY_MAP[filterCat] : []

  const totalReorderValue = REORDER_RECOMMENDATIONS.reduce((s, r) => s + r.totalCost, 0)
  const draftCount        = REORDER_RECOMMENDATIONS.filter(r => r.approvalStatus === 'Draft').length
  const pendingCount      = REORDER_RECOMMENDATIONS.filter(r => r.approvalStatus === 'Pending Approval').length
  const approvedCount     = REORDER_RECOMMENDATIONS.filter(r => r.approvalStatus === 'Approved').length

  const totalWeeklyRevenue  = filteredProds.reduce((s, p) => s + p.weeklySales * p.sellingPrice, 0)
  const totalMonthlyRevenue = filteredProds.reduce((s, p) => s + p.monthlyRevenue, 0)

  const avgAvailPct  = 97.2

  const totalStockValueAtCost = filteredProds.reduce((s, p) => s + p.stockValue, 0)

  const invTotal         = filteredProds.length
  const onTargetCount    = filteredProds.filter(p => p.stockStatus === 'on-target').length
  const overstockedCount = filteredProds.filter(p => p.stockStatus === 'overstocked').length
  const lowStockCount    = filteredProds.filter(p => p.stockStatus === 'low-stock').length
  const invPct           = (n: number) => invTotal > 0 ? `${Math.round(n / invTotal * 100)}%` : '0%'
  // Display-only inflated product count for demo realism (Pavers manages 25k+ SKUs).
  // Scales proportionally when category / subcategory filter is applied.
  const DEMO_SKU_TOTAL   = 25000
  const displayInvTotal  = INVENTORY_PRODUCTS.length > 0 ? Math.round(DEMO_SKU_TOTAL * invTotal / INVENTORY_PRODUCTS.length) : 0
  const displayOnTarget  = invTotal > 0 ? Math.round(displayInvTotal * onTargetCount  / invTotal) : 0
  const displayOverstocked = invTotal > 0 ? Math.round(displayInvTotal * overstockedCount / invTotal) : 0
  const displayLowStock  = invTotal > 0 ? Math.round(displayInvTotal * lowStockCount   / invTotal) : 0

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-2">

        {/* ── Overview header + filters ───────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overview</span>
          <div className="flex-1 h-px bg-gray-200" />
          {/* Category + subcategory filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                className="h-7 pl-2.5 pr-6 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                value={filterCat}
                onChange={e => { setFilterCat(e.target.value as Category | ''); setFilterSubcat('') }}
              >
                <option value="">All categories</option>
                {(['Beauty', 'Clothing', 'Footwear', 'Accessories'] as Category[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            {filterCat && (
              <div className="relative">
                <select
                  className="h-7 pl-2.5 pr-6 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                  value={filterSubcat}
                  onChange={e => setFilterSubcat(e.target.value)}
                >
                  <option value="">All subcategories</option>
                  {subcatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            )}
            {(filterCat || filterSubcat) && (
              <button
                onClick={() => { setFilterCat(''); setFilterSubcat('') }}
                className="h-7 px-2 text-xs text-gray-400 hover:text-gray-600 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              >✕</button>
            )}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4 pb-2">
          {/* Card 1 — Reorder actions */}
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 mb-2">Reorder Actions Required</div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{REORDER_RECOMMENDATIONS.length}</div>
            <div className="flex gap-1.5 flex-wrap mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{draftCount} Draft</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">{pendingCount} Pending</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">{approvedCount} Approved</span>
            </div>
            <div className="text-xs text-gray-400">{fmtGBP(totalReorderValue)} total at cost</div>
          </div>

          {/* Card 2 — Sales performance */}
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 mb-2">Sales Performance</div>
            <div className="text-2xl font-bold text-gray-900 mb-0.5">{fmtGBP(totalWeeklyRevenue)}</div>
            <div className="text-[10px] text-gray-400 mb-1">Revenue this week{filterCat ? ` · ${filterCat}${filterSubcat ? ` / ${filterSubcat}` : ''}` : ''}</div>
            <div className="flex gap-3 text-[10px]">
              <span className="text-green-600 font-semibold">↑ +8.4% WoW</span>
              <span className="text-green-600 font-semibold">↑ +12.1% YoY</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">{fmtGBP(totalMonthlyRevenue)} monthly revenue</div>
          </div>

          {/* Card 3 — Stock health (metrics) */}
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 mb-2">Stock Health</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{avgAvailPct}%</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Availability</div>
              </div>
              <div className="text-center border-x border-gray-100">
                <div className="text-xl font-bold text-gray-900">{networkCover.toFixed(1)}w</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Weeks Cover</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{fmtGBP(totalStockValueAtCost)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Stock at Cost</div>
              </div>
            </div>
          </div>

          {/* Card 4 — Stock status traffic light (mirrors All Inventory) */}
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 mb-2">Stock Status</div>
            <div className="text-2xl font-bold text-gray-900">{displayInvTotal.toLocaleString()} <span className="text-sm font-normal text-gray-400">Products</span></div>
            <div className="mt-2 flex h-2 rounded-full overflow-hidden gap-px">
              <div className="bg-emerald-400" style={{ width: invPct(onTargetCount) }} />
              <div className="bg-amber-400"   style={{ width: invPct(overstockedCount) }} />
              <div className="bg-red-400 flex-1" />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-gray-500">
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />On Target: {displayOnTarget.toLocaleString()}</span>
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Overstocked: {displayOverstocked.toLocaleString()}</span>
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Low Stock: {displayLowStock.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Charts row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 pb-2">
          {/* Stock Levels */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Stock levels</span>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {(['Value', 'Units', 'Cover'] as const).map(v => (
                  <button key={v} onClick={() => setStockChartUnit(v.toLowerCase() as 'value' | 'units' | 'cover')}
                    className={`h-6 px-3 rounded-md text-xs font-semibold transition-colors ${stockChartUnit === v.toLowerCase() ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{v}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 mb-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-700 inline-block" />Available</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 inline-block" />On Order</span>
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-amber-400 inline-block" />Safety Stock</span>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={overviewChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                  tickFormatter={v =>
                    stockChartUnit === 'cover' ? `${v}w` :
                    stockChartUnit === 'value' ? `£${v}k` :
                    v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v: any, name: any) => {
                    const label = name === 'available' ? 'Available' : name === 'onOrder' ? 'On Order' : 'Safety Stock'
                    const fmt = stockChartUnit === 'cover' ? `${v} wks` : stockChartUnit === 'value' ? `£${v}k` : `${v} units`
                    return [fmt, label] as [string, string]
                  }} />
                <Bar dataKey="available" stackId="a" fill="#4338ca" name="Available" />
                <Bar dataKey="onOrder" stackId="a" fill="#c7d2fe" name="On Order" radius={[3, 3, 0, 0]} />
                <Line dataKey="safetyStock" type="monotone" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Safety Stock" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Availability */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Availability</span>
            </div>
            <div className="flex items-center gap-4 mb-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-indigo-700 inline-block" />Actual</span>
              <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-gray-400 inline-block" />Target (97.5%)</span>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={AVAILABILITY_CHART_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis domain={[96, 101]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [`${v}%`]} />
                <Line dataKey="actual" type="monotone" stroke="#4338ca" strokeWidth={2} dot={false} name="Actual" />
                <Line dataKey="target" type="monotone" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Target" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Stock Health ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock Health</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Bestsellers */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-gray-800">Bestsellers this week</span>
            </div>
            {[...filteredProds]
              .sort((a, b) => b.weeklySales - a.weeklySales)
              .slice(0, 5)
              .map((p, rank) => {
                const seed = p.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                const wow = ((seed * 7 + rank * 3) % 20) - 8
                return (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-[10px] font-bold text-gray-400 w-4">{rank + 1}</span>
                    <img src={p.imageUrl} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
                    <span className="text-xs text-gray-700 flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-semibold text-gray-500 mr-1">{p.weeklySales}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${wow >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {wow >= 0 ? '+' : ''}{wow}%
                    </span>
                  </div>
                )
              })}
          </div>

          {/* Trending */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-gray-800">Trending</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['up', 'down'] as const).map(dir => {
                const sorted = [...filteredProds].map((p, i) => {
                  const seed = p.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                  return { p, wow: ((seed * 7 + i * 3) % 20) - 8 }
                }).filter(x => dir === 'up' ? x.wow > 0 : x.wow < 0)
                  .sort((a, b) => dir === 'up' ? b.wow - a.wow : a.wow - b.wow)
                  .slice(0, 3)
                return (
                  <div key={dir}>
                    <div className={`flex items-center gap-1 mb-2 text-[10px] font-bold ${dir === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                      {dir === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {dir === 'up' ? '▲ Up' : '▼ Down'}
                    </div>
                    {sorted.map(({ p, wow }) => (
                      <div key={p.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-[10px] text-gray-700 truncate flex-1 mr-1">{p.name}</span>
                        <span className={`text-[10px] font-bold ${dir === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                          {wow >= 0 ? '+' : ''}{wow}%
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Aged stock */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-gray-800">Aged stock flags</span>
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                {filteredProds.filter(p => p.weeksOfStock > 8).length}
              </span>
            </div>
            {filteredProds.filter(p => p.weeksOfStock > 8).map(p => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <img src={p.imageUrl} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
                <span className="text-xs text-gray-700 flex-1 truncate">{p.name}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full whitespace-nowrap">
                  {p.weeksOfStock.toFixed(1)}w
                </span>
                <button className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700">Review</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PO Register ────────────────────────────────────────────────────────────────
export function PORegister({
  initialFilter,
  lastChasedMap,
  onSelectPO,
}: {
  initialFilter: Partial<RegisterFilter>
  lastChasedMap: Map<string, string>
  onSelectPO:    (poId: string) => void
}) {
  const [filter, setFilter] = useState<RegisterFilter>({
    search:   initialFilter.search   ?? '',
    status:   initialFilter.status   ?? '',
    supplier: initialFilter.supplier ?? '',
    handling: initialFilter.handling ?? 'all',
  })
  const [showUntouched, setShowUntouched] = useState(false)
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const now = new Date()

  const filtered = ALL_POS.filter(po => {
    const matchSearch   = !filter.search || po.id.toLowerCase().includes(filter.search.toLowerCase()) || po.product.toLowerCase().includes(filter.search.toLowerCase()) || (getSupplier(po.supplierId)?.name ?? '').toLowerCase().includes(filter.search.toLowerCase())
    const matchStatus   = !filter.status   || po.status === filter.status
    const matchSupplier = !filter.supplier || po.supplierId === filter.supplier
    const matchHandling = filter.handling === 'all' || po.handledBy === filter.handling
    const lc = lastChasedMap.get(po.id)
    const matchUntouched = !showUntouched || !lc || (now.getTime() - new Date(lc).getTime()) > ONE_WEEK_MS
    return matchSearch && matchStatus && matchSupplier && matchHandling && matchUntouched
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-semibold">
            {[['all', 'All'], ['agent', 'Agent handling'], ['human', 'Needs you']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(f => ({ ...f, handling: val }))}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-md transition-colors ${filter.handling === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {val === 'agent' && <Bot className="w-3 h-3" />}
                {val === 'human' && <User className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="pl-8 h-9 w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Search PO, product, supplier…" value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
          </div>
          <div className="relative">
            <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {(['On track','Sent to supplier','Acknowledged','Late DC booking','Date change required','Ex-factory delay','In Transit','Partially Delivered'] as POStatus[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              value={filter.supplier} onChange={e => setFilter(f => ({ ...f, supplier: e.target.value }))}>
              <option value="">All suppliers</option>
              {SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowUntouched(v => !v)}
            className={`h-9 px-3 flex items-center gap-1.5 text-xs font-semibold rounded-lg border transition-colors ${showUntouched ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Clock className="w-3.5 h-3.5" /> Untouched this week
          </button>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} POs</span>
          <button className="h-9 px-3 flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['RAG', 'PO Number', 'Supplier', 'Category', 'Status', 'X-Factory', 'Delivery', 'Value', 'Last chased', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((po, i) => {
                const supplier  = getSupplier(po.supplierId)
                const sc        = STATUS_CONFIG[po.status]
                const rag       = computeRAG(po)
                const rc        = RAG_CFG[rag]
                const lc        = lastChasedMap.get(po.id)
                const untouched = !lc || (now.getTime() - new Date(lc).getTime()) > ONE_WEEK_MS
                const xfDate    = getXFactoryDate(po)
                return (
                  <tr key={po.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer ${i % 2 !== 0 ? 'bg-gray-50/20' : ''} ${showUntouched && untouched ? 'bg-amber-50/30' : ''}`}
                    onClick={() => onSelectPO(po.id)}>
                    <td className="px-4 py-3">
                      <div className={`w-2 h-2 rounded-full ${rc.dot}`} title={rc.label} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-gray-900">{po.id}</span>
                        {po.priority && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                      </div>
                      <div className="text-[10px] text-gray-400">{po.product}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{supplier?.name ?? po.supplierId}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{po.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{po.status}
                        </span>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center ${po.handledBy === 'agent' ? 'bg-purple-50' : 'bg-red-50'}`}>
                          {po.handledBy === 'agent' ? <Bot className="w-2.5 h-2.5 text-purple-500" /> : <User className="w-2.5 h-2.5 text-red-500" />}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{xfDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-900">{formatDate(po.revisedDelivery ?? po.expectedDelivery)}</div>
                      {po.revisedDelivery && <div className="text-[10px] text-gray-400 line-through">{formatDate(po.expectedDelivery)}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 text-right whitespace-nowrap">{po.orderValue}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {lc ? new Date(lc).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : <span className="text-amber-500 font-medium">Never</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />At Risk</span>
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" />Watch</span>
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />On Track</span>
          <span className="flex items-center gap-1.5"><Bot className="w-3 h-3 text-purple-400" /> Agent</span>
          <span className="flex items-center gap-1.5"><User className="w-3 h-3 text-red-400" /> Needs action</span>
          <span className="ml-auto">Showing {filtered.length} open POs</span>
        </div>
      </div>
    </div>
  )
}

// ── Suppliers View ─────────────────────────────────────────────────────────────
export function SuppliersView() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <p className="text-sm text-orange-800">
            <strong>Eastern Textiles Co</strong> (54%, deteriorating) and{' '}
            <strong>Summer Styles Ltd</strong> (68%, deteriorating) are underperforming.
            Consider reviewing open commitments and building contingency plans.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[...SUPPLIERS].sort((a, b) => a.onTimeRate - b.onTimeRate).map(supplier => {
            const isAtRisk = supplier.onTimeRate < 70 || (supplier.onTimeRate < 80 && supplier.trend === 'deteriorating')
            const activeFlags = STATIC_KANBAN_ITEMS.filter(a => a.supplierId === supplier.id).length + ALL_POS.filter(p => (p.status === 'Ex-factory delay' || p.status === 'Date change required') && p.supplierId === supplier.id).length
            const delayContext = supplier.avgDelayDays / supplier.contractualLeadTimeDays * 100

            const rateColor  = supplier.onTimeRate >= 90 ? 'text-green-600' : supplier.onTimeRate >= 80 ? 'text-indigo-600' : supplier.onTimeRate >= 70 ? 'text-amber-600' : 'text-red-600'
            const rateBarCol = supplier.onTimeRate >= 90 ? 'bg-green-500'  : supplier.onTimeRate >= 80 ? 'bg-indigo-500'  : supplier.onTimeRate >= 70 ? 'bg-amber-400'  : 'bg-red-500'
            const TrendIcon  = supplier.trend === 'improving' ? TrendingUp : supplier.trend === 'deteriorating' ? TrendingDown : Minus
            const trendColor = supplier.trend === 'improving' ? 'text-green-500' : supplier.trend === 'deteriorating' ? 'text-red-500' : 'text-gray-400'

            return (
              <div key={supplier.id} className={`bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 ${isAtRisk ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{supplier.name}</span>
                      {isAtRisk && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] font-bold">
                          <AlertTriangle className="w-2.5 h-2.5" />AT RISK
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{supplier.category}</span>
                  </div>
                  <span className="text-xs text-gray-500"><strong className="text-gray-700">{supplier.openPOs}</strong> open POs</span>
                </div>

                {/* On-time rate */}
                <div className="mb-3">
                  <div className="flex items-end justify-between mb-1">
                    <span className="text-xs text-gray-500">On-time delivery rate</span>
                    <div className="flex items-center gap-2">
                      <Sparkline trend={supplier.trend} />
                      <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
                      <span className={`text-2xl font-bold ${rateColor}`}>{supplier.onTimeRate}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${rateBarCol}`} style={{ width: `${supplier.onTimeRate}%` }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                  <div className="bg-gray-50 rounded-lg py-2 col-span-1">
                    <div className="text-sm font-bold text-gray-900">{supplier.avgDelayDays.toFixed(1)}</div>
                    <div className="text-[9px] text-gray-500">Avg delay (d)</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2 col-span-1">
                    <div className="text-sm font-bold text-gray-900">{supplier.contractualLeadTimeDays}</div>
                    <div className="text-[9px] text-gray-500">Lead time (d)</div>
                  </div>
                  <div className={`rounded-lg py-2 col-span-1 ${delayContext > 10 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <div className={`text-sm font-bold ${delayContext > 10 ? 'text-amber-600' : 'text-gray-900'}`}>{delayContext.toFixed(0)}%</div>
                    <div className="text-[9px] text-gray-500">Delay / LT</div>
                  </div>
                  <div className={`rounded-lg py-2 col-span-1 ${activeFlags > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className={`text-sm font-bold ${activeFlags > 0 ? 'text-red-600' : 'text-gray-900'}`}>{activeFlags}</div>
                    <div className="text-[9px] text-gray-500">Active flags</div>
                  </div>
                </div>

                {supplier.hasSubmissionDeadline && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs text-blue-700">Submission deadline: every <strong>{supplier.hasSubmissionDeadline}</strong></span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Inventory / Reorder configs ───────────────────────────────────────────────
const STOCK_CFG: Record<StockStatus, { bg: string; text: string; dot: string; border: string; label: string }> = {
  'on-target':   { bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200', label: 'On Target' },
  'low-stock':   { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200', label: 'Low Stock' },
  'overstocked': { bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-500',  border: 'border-blue-200',  label: 'Overstocked' },
}

const APPROVAL_CFG: Record<ApprovalStatus, { bg: string; text: string; dot: string; border: string }> = {
  'Draft':            { bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400',  border: 'border-gray-200' },
  'Pending Approval': { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400', border: 'border-amber-200' },
  'Approved':         { bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200' },
  'Rejected':         { bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500',   border: 'border-red-200' },
  'Sent':             { bg: 'bg-indigo-50', text: 'text-indigo-700',dot: 'bg-indigo-500',border: 'border-indigo-200' },
}

// ── Size Band Bar ──────────────────────────────────────────────────────────────
function SizeBar({ bands }: { bands: SizeBand[] }) {
  if (bands.length === 1) {
    return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${bands[0].color}`}>{bands[0].label}</span>
  }
  return (
    <div className="flex gap-0.5">
      {bands.map(b => (
        <div key={b.label} className={`flex flex-col items-center rounded px-1 py-0.5 ${b.color}`} style={{ minWidth: 26 }}>
          <span className="text-[8px] font-bold leading-tight">{b.label}</span>
          <span className="text-[8px] leading-tight">{b.pct}%</span>
        </div>
      ))}
    </div>
  )
}

// ── Inventory View ─────────────────────────────────────────────────────────────
function InventoryView({ configMode, setConfigMode }: { configMode: boolean; setConfigMode: (v: boolean) => void }) {
  const [search,    setSearch]   = useState('')
  const [cat,       setCat]      = useState('')
  const [status,    setStatus]   = useState('')
  const [supplier,  setSupplier] = useState('')
  const [skuChips,  setSkuChips] = useState<string[]>([])
  const [seasonFilter,   setSeasonFilter]   = useState('')
  const [leadBandFilter, setLeadBandFilter] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else { setSortCol(col); setSortDir('asc') }
  }

  const handleSearchChange = (val: string) => {
    if (val.includes(',') || val.includes('\n')) {
      const parsed = val.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
      setSkuChips(prev => [...new Set([...prev, ...parsed])])
      setSearch('')
    } else {
      setSearch(val)
    }
  }

  const supplierOptions = [...new Set(INVENTORY_PRODUCTS.map(p => p.supplier))].sort()

  // config mode state
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(() => new Set())
  const [drawerOpen,       setDrawerOpen]        = useState(false)
  const [editForm,         setEditForm]          = useState({ moqQty: '', fwc: '', promoPct: '', reason: '' })
  const [formErrors,       setFormErrors]        = useState<{ fwc?: string; fwcWarn?: string; promoPct?: string; reason?: string }>({})
  const [productOverrides, setProductOverrides]  = useState<Record<string, ProductOverride>>({})
  const [auditLog,         setAuditLog]          = useState<Record<string, InvAuditEntry[]>>(() => ({ ...SEEDED_INV_AUDIT }))
  const [flashIds,         setFlashIds]          = useState<Set<string>>(() => new Set())
  const [undoStack,        setUndoStack]         = useState<{ ids: string[]; prev: Record<string, ProductOverride | undefined> } | null>(null)
  const [undoVisible,      setUndoVisible]       = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [auditPopoverId,   setAuditPopoverId]    = useState<string | null>(null)
  const [dismissedFwcWarn, setDismissedFwcWarn] = useState(false)

  const rows = INVENTORY_PRODUCTS.filter(p =>
    (skuChips.length > 0
      ? skuChips.some(c => p.sku.toLowerCase().includes(c.toLowerCase()) || p.name.toLowerCase().includes(c.toLowerCase()))
      : (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
    ) &&
    (!cat      || p.category === cat) &&
    (!status   || p.stockStatus === status) &&
    (!supplier || p.supplier === supplier) &&
    (!seasonFilter   || p.seasonCode === seasonFilter) &&
    (!leadBandFilter || getLeadTimeBand(p.leadTime) === leadBandFilter)
  )

  // Clear selection & drawer when leaving config mode
  useEffect(() => {
    if (!configMode) { setSelectedIds(new Set()); setDrawerOpen(false) }
  }, [configMode])

  // KPI aggregates
  const totalSales       = INVENTORY_PRODUCTS.reduce((s, p) => s + p.weeklySales, 0)
  const avgMargin        = INVENTORY_PRODUCTS.reduce((s, p) => s + p.marginPct, 0) / INVENTORY_PRODUCTS.length
  const avgCover         = INVENTORY_PRODUCTS.reduce((s, p) => s + p.forwardWeeksCover, 0) / INVENTORY_PRODUCTS.length
  const totalRevenue     = Math.round(INVENTORY_PRODUCTS.reduce((s, p) => s + p.weeklySales * p.sellingPrice, 0))
  const invTotal         = INVENTORY_PRODUCTS.length
  const onTargetCount    = INVENTORY_PRODUCTS.filter(p => p.stockStatus === 'on-target').length
  const overstockedCount = INVENTORY_PRODUCTS.filter(p => p.stockStatus === 'overstocked').length
  const lowStockCount    = INVENTORY_PRODUCTS.filter(p => p.stockStatus === 'low-stock').length
  const invPct           = (n: number) => `${Math.round(n / invTotal * 100)}%`
  const INV_DEMO_TOTAL      = 25000
  const dispOnTarget        = Math.round(INV_DEMO_TOTAL * onTargetCount    / invTotal)
  const dispOverstocked     = Math.round(INV_DEMO_TOTAL * overstockedCount / invTotal)
  const dispLowStock        = Math.round(INV_DEMO_TOTAL * lowStockCount    / invTotal)

  // Sorting (Feature 5)
  const sortedRows = sortCol ? [...rows].sort((a, b) => {
    const ov_a = productOverrides[a.id]
    const ov_b = productOverrides[b.id]
    const vals: Record<string, [number, number]> = {
      CostPrice: [a.costPrice, b.costPrice],
      Margin:    [a.marginPct, b.marginPct],
      WkSales:   [a.weeklySales, b.weeklySales],
      FwdCover:  [ov_a?.fwcMin ?? a.forwardWeeksCover, ov_b?.fwcMin ?? b.forwardWeeksCover],
      MoqValue:  [ov_a?.moqQty ?? a.minOrderQty, ov_b?.moqQty ?? b.minOrderQty],
    }
    const [va, vb] = vals[sortCol] ?? [0, 0]
    return sortDir === 'asc' ? va - vb : vb - va
  }) : rows

  // selection helpers
  const allVisibleSelected = rows.length > 0 && rows.every(p => selectedIds.has(p.id))
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleSelectAll = () => setSelectedIds(prev => {
    const next = new Set(prev)
    if (allVisibleSelected) rows.forEach(p => next.delete(p.id))
    else rows.forEach(p => next.add(p.id))
    return next
  })

  // products that cannot be updated (mocked)
  const LOCKED_IDS = new Set(['INV-003', 'INV-008'])
  const LOCK_REASON: Record<string, string> = {
    'INV-003': 'locked by Sarah Chen',
    'INV-008': 'invalid grouping for this product type',
  }
  const updatableSelected   = [...selectedIds].filter(id => !LOCKED_IDS.has(id))
  const unupdatableSelected = [...selectedIds].filter(id => LOCKED_IDS.has(id))

  // form validation
  const validateForm = (): boolean => {
    const errs: typeof formErrors = {}
    if (editForm.moqQty && (!/^\d+$/.test(editForm.moqQty) || parseInt(editForm.moqQty) <= 0)) {
      errs.fwc = 'MOQ Quantity must be a positive integer'
    }
    if (editForm.fwc) {
      const v = parseFloat(editForm.fwc)
      if (isNaN(v) || v <= 0) errs.fwc = 'Forward weeks cover must be a positive number'
      else if (!dismissedFwcWarn && (v < 1 || v > 20)) {
        errs.fwcWarn = v < 1 ? 'FWC is very low (< 1 week) — are you sure?' : 'FWC is unusually high (> 20 weeks) — are you sure?'
      }
    }
    if (editForm.promoPct) {
      const v = parseFloat(editForm.promoPct)
      if (isNaN(v) || v < 0 || v > 100) errs.promoPct = 'Promo % must be between 0 and 100'
    }
    if (!editForm.reason.trim()) errs.reason = 'Please provide a reason for this change'
    setFormErrors(errs)
    return !errs.fwc && !errs.promoPct && !errs.reason
  }

  const handleApply = () => {
    if (!validateForm()) return

    const selectedArr = updatableSelected
    const prevSnapshot: Record<string, ProductOverride | undefined> = {}
    selectedArr.forEach(id => { prevSnapshot[id] = productOverrides[id] })

    // build changes description for audit
    const changeDescs: { field: string; newVal: string }[] = []
    if (editForm.moqQty)   changeDescs.push({ field: 'MOQ Qty',    newVal: `${editForm.moqQty} units` })
    if (editForm.fwc)      changeDescs.push({ field: 'FWC Target', newVal: `${editForm.fwc} wks` })
    if (editForm.promoPct) changeDescs.push({ field: 'Promo %',    newVal: `${editForm.promoPct}%` })

    // apply overrides
    setProductOverrides(prev => {
      const next = { ...prev }
      selectedArr.forEach(id => {
        next[id] = {
          ...next[id],
          ...(editForm.moqQty   ? { moqQty: parseInt(editForm.moqQty) }                                      : {}),
          ...(editForm.fwc      ? { fwcMin: parseFloat(editForm.fwc), fwcMax: parseFloat(editForm.fwc) }     : {}),
          ...(editForm.promoPct ? { promoPct: parseFloat(editForm.promoPct) }                                 : {}),
        }
      })
      return next
    })

    // audit entries
    const now = new Date().toISOString()
    setAuditLog(prev => {
      const next = { ...prev }
      selectedArr.forEach(id => {
        const p = INVENTORY_PRODUCTS.find(x => x.id === id)
        const prevOv = prevSnapshot[id]
        const changes = changeDescs.map(c => {
          let oldVal = '—'
          if (c.field === 'MOQ Qty')    oldVal = prevOv?.moqQty   != null ? `${prevOv.moqQty} units`   : (p ? `${p.minOrderQty} units` : '—')
          if (c.field === 'FWC Target') oldVal = prevOv?.fwcMin   != null ? `${prevOv.fwcMin} wks`     : '—'
          if (c.field === 'Promo %')    oldVal = prevOv?.promoPct != null ? `${prevOv.promoPct}%`       : (p ? (getBasePromoPct(p) != null ? `${getBasePromoPct(p)}%` : '—') : '—')
          return { field: c.field, oldVal, newVal: c.newVal }
        })
        const entry: InvAuditEntry = { id: `aud-${Date.now()}-${id}`, user: 'You', initial: 'Y', date: now, changes, reason: editForm.reason }
        next[id] = [entry, ...(next[id] ?? [])]
      })
      return next
    })

    // flash rows
    setFlashIds(new Set(selectedArr))
    setTimeout(() => setFlashIds(new Set()), 1500)

    // undo
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoStack({ ids: selectedArr, prev: prevSnapshot })
    setUndoVisible(true)
    undoTimerRef.current = setTimeout(() => setUndoVisible(false), 10000)

    // close & reset
    setDrawerOpen(false)
    setEditForm({ moqQty: '', fwc: '', promoPct: '', reason: '' })
    setFormErrors({})
    setDismissedFwcWarn(false)
  }

  const handleUndo = () => {
    if (!undoStack) return
    setProductOverrides(prev => {
      const next = { ...prev }
      undoStack.ids.forEach(id => {
        if (undoStack.prev[id] === undefined) delete next[id]
        else next[id] = undoStack.prev[id]!
      })
      return next
    })
    setAuditLog(prev => {
      const next = { ...prev }
      undoStack.ids.forEach(id => { next[id] = (next[id] ?? []).slice(1) })
      return next
    })
    setUndoVisible(false)
    setUndoStack(null)
  }

  return (
    <div className="flex-1 overflow-y-auto relative">

      {/* Audit popover backdrop */}
      {auditPopoverId && <div className="fixed inset-0 z-30" onClick={() => setAuditPopoverId(null)} />}

      {/* Audit popover */}
      {auditPopoverId && (() => {
        const entries = (auditLog[auditPopoverId] ?? []).slice(0, 5)
        const p = INVENTORY_PRODUCTS.find(x => x.id === auditPopoverId)
        return (
          <div className="fixed right-6 top-36 z-40 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-xs font-bold text-gray-800 truncate">{p?.name}</div>
              <button onClick={() => setAuditPopoverId(null)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
            </div>
            {entries.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">No changes recorded yet</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {entries.map(e => (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">{e.initial}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800">{e.user}</div>
                        <div className="text-[10px] text-gray-400">{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                    </div>
                    {e.changes.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-1.5 text-[10px] mb-0.5">
                        <span className="text-gray-500 font-medium">{c.field}:</span>
                        <span className="text-gray-400 line-through">{c.oldVal}</span>
                        <span className="text-gray-300">→</span>
                        <span className="text-indigo-600 font-semibold">{c.newVal}</span>
                      </div>
                    ))}
                    <div className="mt-1.5 text-[10px] text-gray-500 italic leading-relaxed">"{e.reason}"</div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-2.5 border-t border-gray-50">
              <button className="text-[10px] text-indigo-600 hover:underline font-medium">View full history →</button>
            </div>
          </div>
        )
      })()}

      {/* Edit settings drawer */}
      {drawerOpen && configMode && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1" onClick={() => setDrawerOpen(false)} />
          <div className="w-[420px] bg-white border-l border-gray-200 shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="text-sm font-bold text-gray-900">Edit supplier &amp; inventory settings</div>
                <div className="text-xs text-gray-400 mt-0.5">{updatableSelected.length} of {selectedIds.size} products will be updated</div>
              </div>
              <button onClick={() => setDrawerOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

              {/* MOQ Grouping */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">MOQ Grouping</label>
                <div className="h-9 px-3 flex items-center rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-700">
                  Style + Colour
                </div>
                <p className="mt-1 text-[11px] text-gray-400">Grouping is fixed at style + colour level</p>
              </div>

              {/* MOQ Quantity */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">MOQ Quantity</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Leave unchanged"
                    value={editForm.moqQty}
                    onChange={e => setEditForm(f => ({ ...f, moqQty: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-gray-300"
                  />
                  <span className="text-xs text-gray-400 shrink-0">units</span>
                </div>
              </div>

              {/* Target FWC */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Target Forward Weeks Cover</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Leave unchanged"
                    value={editForm.fwc}
                    onChange={e => { setEditForm(f => ({ ...f, fwc: e.target.value })); setDismissedFwcWarn(false) }}
                    className={`w-32 h-9 px-3 rounded-lg border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-gray-300 ${formErrors.fwc ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  <span className="text-xs text-gray-400 shrink-0">weeks</span>
                </div>
                {formErrors.fwc && <p className="mt-1 text-[11px] text-red-600">{formErrors.fwc}</p>}
                {formErrors.fwcWarn && !dismissedFwcWarn && (
                  <div className="mt-1.5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 flex-1">{formErrors.fwcWarn}</p>
                    <button onClick={() => setDismissedFwcWarn(true)} className="text-amber-400 hover:text-amber-600 shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>

              {/* Planned Promo % */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-semibold text-gray-700">Planned Promo %</label>
                  <div className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 w-64 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl leading-relaxed">
                      The forecast strips historical promo demand from the baseline, then applies this % as the planned promo allowance. Use this to step down from reactive promotion over time.
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">Share of future demand planned to come from promotional activity. Lower values reduce reorder quantities.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Leave unchanged"
                    value={editForm.promoPct}
                    onChange={e => setEditForm(f => ({ ...f, promoPct: e.target.value }))}
                    className={`w-32 h-9 px-3 rounded-lg border text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-gray-300 ${formErrors.promoPct ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  <span className="text-xs text-gray-400 shrink-0">%</span>
                </div>
                {formErrors.promoPct && <p className="mt-1 text-[11px] text-red-600">{formErrors.promoPct}</p>}
              </div>

              {/* Live impact preview */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide mb-1.5">Live Impact Preview</div>
                <p className="text-xs text-indigo-800">
                  Updating <span className="font-semibold">{updatableSelected.length} product{updatableSelected.length !== 1 ? 's' : ''}</span>.{' '}
                  <span className="font-semibold">{Math.min(updatableSelected.length * 2, 12)} open reorder recommendation{updatableSelected.length !== 1 ? 's' : ''}</span> will be recalculated.
                </p>
                {editForm.promoPct && (() => {
                  const newPct = parseFloat(editForm.promoPct)
                  const promoSamples = updatableSelected.map(id => {
                    const prod = INVENTORY_PRODUCTS.find(x => x.id === id)
                    return productOverrides[id]?.promoPct ?? (prod ? getBasePromoPct(prod) : null)
                  }).filter((v): v is number => v != null)
                  const avgCurrent = promoSamples.length > 0
                    ? promoSamples.reduce((s, v) => s + v, 0) / promoSamples.length
                    : 20
                  const lower = !isNaN(newPct) && newPct < avgCurrent
                  return (
                    <div className="mt-2 pt-2 border-t border-indigo-100 space-y-1">
                      <p className="text-xs text-indigo-800">Forecast and reorder recommendations will be recalculated with the updated promo allowance.</p>
                      {lower && <p className="text-xs text-indigo-800 font-semibold">↓ Lower promo allowance will reduce projected reorder quantities.</p>}
                    </div>
                  )
                })()}
                {unupdatableSelected.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-indigo-100">
                    <p className="text-[11px] text-indigo-600 font-semibold mb-1">Cannot update {unupdatableSelected.length} product{unupdatableSelected.length !== 1 ? 's' : ''}:</p>
                    {unupdatableSelected.slice(0, 3).map(id => {
                      const prod = INVENTORY_PRODUCTS.find(p => p.id === id)
                      return (
                        <div key={id} className="text-[10px] text-indigo-500 flex items-center gap-1.5">
                          <span>•</span>
                          <span>{prod?.name ?? id}</span>
                          <span className="text-indigo-400">— {LOCK_REASON[id]}</span>
                        </div>
                      )
                    })}
                    {unupdatableSelected.length > 3 && <button className="text-[10px] text-indigo-600 hover:underline mt-0.5">See all {unupdatableSelected.length} →</button>}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reason for change <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="e.g. 'Q2 supplier renegotiation with BrandX'"
                  maxLength={200}
                  value={editForm.reason}
                  onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                  className={`w-full h-20 px-3 py-2 rounded-lg border text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-gray-300 ${formErrors.reason ? 'border-red-300' : 'border-gray-200'}`}
                />
                <div className="flex justify-between mt-0.5">
                  {formErrors.reason ? <p className="text-[11px] text-red-600">{formErrors.reason}</p> : <span />}
                  <span className="text-[10px] text-gray-300">{editForm.reason.length}/200</span>
                </div>
              </div>

            </div>

            {/* Drawer actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
              <button onClick={() => { setDrawerOpen(false); setFormErrors({}) }} className="flex-1 h-9 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleApply}
                disabled={updatableSelected.length === 0}
                className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply to {updatableSelected.length} product{updatableSelected.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action bar — slides up when 2+ rows selected in config mode */}
      {configMode && selectedIds.size >= 2 && (
        <div className="fixed bottom-0 left-14 right-0 z-20 bg-indigo-700 text-white px-6 py-3 flex items-center gap-4 shadow-xl">
          <span className="text-sm font-semibold">{selectedIds.size} selected</span>
          <div className="w-px h-4 bg-indigo-500" />
          <button onClick={() => setDrawerOpen(true)} className="text-sm font-semibold hover:text-indigo-200 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit settings
          </button>
          <button className="text-sm font-semibold hover:text-indigo-200 transition-colors flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-indigo-300 hover:text-white transition-colors">Clear selection</button>
        </div>
      )}

      {/* Undo toast */}
      {undoVisible && undoStack && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg">
          <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span>Updated {undoStack.ids.length} product{undoStack.ids.length !== 1 ? 's' : ''}.</span>
          <button onClick={handleUndo} className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Undo</button>
          <button onClick={() => setUndoVisible(false)} className="text-gray-500 hover:text-gray-300 ml-1"><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="p-6">

        {/* Config mode banner */}
        {configMode && (
          <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span className="text-sm font-semibold text-indigo-700">Configuration mode</span>
            <span className="text-xs text-indigo-500 hidden sm:inline">Select products and click "Edit settings" to update MOQ and FWC settings in bulk</span>
            <button onClick={() => setConfigMode(false)} className="ml-auto px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">Done</button>
          </div>
        )}

        {/* KPI summary */}
        <div className="grid grid-cols-5 gap-4 mb-5">
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{INV_DEMO_TOTAL.toLocaleString()} <span className="text-sm font-normal text-gray-400">Products</span></div>
            <div className="mt-2 flex h-2 rounded-full overflow-hidden gap-px">
              <div className="bg-emerald-400" style={{ width: invPct(onTargetCount) }} />
              <div className="bg-amber-400"   style={{ width: invPct(overstockedCount) }} />
              <div className="bg-red-400 flex-1" />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-gray-500">
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />On Target: {dispOnTarget.toLocaleString()}</span>
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Overstocked: {dispOverstocked.toLocaleString()}</span>
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Low Stock: {dispLowStock.toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs text-gray-400 mb-1">Sales this week</div>
            <div className="text-2xl font-bold text-gray-900">{totalSales >= 1000 ? `${(totalSales/1000).toFixed(1)}k` : totalSales} <span className="text-sm font-normal text-gray-400">units</span></div>
            <div className="text-[10px] text-amber-600 font-semibold mt-1">↓ -24.8% WoW vs {Math.round(totalSales * 1.33 / 1000).toFixed(0)}k last week</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs text-gray-400 mb-1">Revenue this week</div>
            <div className="text-2xl font-bold text-gray-900">{fmtGBP(totalRevenue)}</div>
            <div className="text-[10px] text-amber-600 font-semibold mt-1">↓ -52.6% WoW vs {fmtGBP(Math.round(totalRevenue * 2.1))} last week</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs text-gray-400 mb-1">Gross Margin</div>
            <div className="text-2xl font-bold text-gray-900">{(avgMargin * 100).toFixed(0)} <span className="text-sm font-normal text-gray-400">%</span></div>
            <div className="text-[10px] text-amber-600 font-semibold mt-1">↓ -2.1% WoW vs {((avgMargin + 0.021) * 100).toFixed(1)}% last week</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="text-xs text-gray-400 mb-1">Stock Cover</div>
            <div className="text-2xl font-bold text-gray-900">{avgCover.toFixed(1)} <span className="text-sm font-normal text-gray-400">wks</span></div>
            <div className="text-[10px] text-green-600 font-semibold mt-1">↑ +3.2 Forward cover (target 3–4 wks)</div>
          </div>
        </div>

        {/* Filter row */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input className="pl-8 h-9 w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Search or paste SKU IDs" value={search} onChange={e => handleSearchChange(e.target.value)} />
            </div>
            <div className="relative">
              <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none" value={cat} onChange={e => setCat(e.target.value)}>
                <option value="">All categories</option>
                {(['Beauty', 'Clothing', 'Footwear', 'Accessories'] as const).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none" value={supplier} onChange={e => setSupplier(e.target.value)}>
                <option value="">All suppliers</option>
                {supplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All stock levels</option>
                <option value="on-target">On Target</option>
                <option value="low-stock">Low Stock</option>
                <option value="overstocked">Overstocked</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}>
                <option value="">All seasons</option>
                {['Core','SS26','AW26','Clearance'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                value={leadBandFilter} onChange={e => setLeadBandFilter(e.target.value)}>
                <option value="">All regions</option>
                {['UK <2wk','EU 2-4wk','Far East 8-12wk'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            {configMode && selectedIds.size > 0 && (
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">{selectedIds.size} selected</span>
            )}
            <span className="ml-auto text-xs text-gray-400">{rows.length} of {INVENTORY_PRODUCTS.length} products</span>
            <button
              onClick={() => setConfigMode(!configMode)}
              className={`h-9 px-3 flex items-center gap-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                configMode
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Configure products
            </button>
            <button className="h-9 px-3 flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          {skuChips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skuChips.map(chip => (
                <span key={chip} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                  {chip}
                  <button onClick={() => setSkuChips(chips => chips.filter(c => c !== chip))} className="hover:text-indigo-900">×</button>
                </span>
              ))}
              <button onClick={() => setSkuChips([])} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className={`bg-white rounded-xl shadow-sm overflow-x-auto ${configMode ? 'border-2 border-indigo-200 ring-1 ring-indigo-100' : 'border border-gray-100'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {configMode && (
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 cursor-pointer accent-indigo-600" />
                  </th>
                )}
                <th className="px-4 py-3 w-14" />
                {['Product', 'Category', 'Supplier', 'Stock Status', 'Cost £', 'Margin', 'Wk Sales', 'Fwd Weeks Cover', 'Promo %', 'MOQ Level', 'MOQ Unit Value', 'Size'].map(h => {
                  const sortKey = ({ 'Cost £': 'CostPrice', 'Margin': 'Margin', 'Wk Sales': 'WkSales', 'Fwd Weeks Cover': 'FwdCover', 'MOQ Unit Value': 'MoqValue' } as Record<string,string>)[h]
                  const isActive = sortCol === sortKey
                  return (
                    <th key={h}
                      onClick={sortKey ? () => toggleSort(sortKey) : undefined}
                      className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${sortKey ? 'cursor-pointer select-none hover:text-gray-700' : ''} ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {h}{isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : (sortKey ? ' ↕' : '')}
                    </th>
                  )
                })}
                {configMode && <th className="px-3 py-3 w-8" />}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((p, i) => {
                const sc       = STOCK_CFG[p.stockStatus]
                const isSelected = configMode && selectedIds.has(p.id)
                const isFlashing = flashIds.has(p.id)
                const ov         = productOverrides[p.id]
                const displayMoqQty = ov?.moqQty ?? p.minOrderQty

                const hasAudit      = (auditLog[p.id] ?? []).length > 0
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-50 transition-colors ${
                      isFlashing  ? 'bg-indigo-100' :
                      isSelected  ? 'bg-indigo-50/70' :
                      i % 2 !== 0 ? 'bg-gray-50/20 hover:bg-gray-50/60' : 'hover:bg-gray-50/60'
                    }`}
                  >
                    {configMode && (
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 cursor-pointer accent-indigo-600" />
                      </td>
                    )}
                    <td className="px-4 py-2" style={{ width: 56, minWidth: 56 }}>
                      <img src={p.imageUrl} className="rounded object-cover block" style={{ width: 40, height: 40, minWidth: 40 }} alt={p.name} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-gray-900">{p.name}</div>
                      <div className="text-[10px] text-gray-400">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={p.supplier}>{p.supplier}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">£{p.costPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700">{(p.marginPct * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{p.weeklySales.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className={`text-xs font-bold whitespace-nowrap ${ov?.fwcMin != null ? 'text-amber-600' : 'text-gray-900'}`}>
                        {(ov?.fwcMin ?? p.forwardWeeksCover).toFixed(1)} wks
                        {ov?.fwcMin != null && <span className="ml-1 text-[9px] font-normal text-amber-500">edited</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const base = getBasePromoPct(p)
                        const value = ov?.promoPct ?? base
                        const isModified = ov?.promoPct != null
                        if (value == null) return <span className="text-xs text-gray-300">—</span>
                        return (
                          <div className={`text-xs font-bold whitespace-nowrap ${isModified ? 'text-amber-600' : 'text-gray-900'}`}>
                            {value}%
                            {isModified && <span className="ml-1 text-[9px] font-normal text-amber-500">edited</span>}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-right">{ov?.moqGrouping ? <span className="font-semibold text-indigo-700">{ov.moqGrouping}</span> : p.packSize}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-right">
                      {ov?.moqQty != null ? <span className="font-semibold text-indigo-700">{displayMoqQty.toLocaleString()}</span> : displayMoqQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3"><SizeBar bands={p.sizeBreakdown} /></td>
                    {configMode && (
                      <td className="px-3 py-2">
                        <button
                          onClick={e => { e.stopPropagation(); setAuditPopoverId(p.id) }}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${hasAudit ? 'text-indigo-500 hover:bg-indigo-50' : 'text-gray-300 hover:bg-gray-50 hover:text-gray-400'}`}
                          title="View change history"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* bottom padding when action bar is visible */}
        {configMode && selectedIds.size >= 2 && <div className="h-14" />}

      </div>
    </div>
  )
}


// ── Inquiry Logic ─────────────────────────────────────────────────────────────
function calcRequestedCP(currentCP: number, roundNumber: number): number {
  const ratio = Math.min(
    CP_RULES.openingAsk + (roundNumber - 1) * CP_RULES.concessionPerRound,
    CP_RULES.targetCPCeiling
  )
  return Math.round(currentCP * ratio * 100) / 100
}

const fmtGBP = (v: number) =>
  v >= 1_000_000 ? `£${(v / 1_000_000).toFixed(1)}m`
  : v >= 1_000   ? `£${(v / 1_000).toFixed(0)}k`
  : `£${v}`

function isoWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const CHASE_TYPE_LABELS: Record<ChaseType, string> = {
  booking_in: 'Booking-in',
  handover:   'Handover/dispatch',
  cpr:        'CPR negotiation',
}

const CHASE_INTROS: Record<ChaseType, string> = {
  booking_in: 'We are writing to confirm sea freight booking-in slots for the following PO lines. As each is within two weeks of its ex-factory date, please confirm your freight forwarder has been briefed and provide a booking reference at the earliest opportunity.',
  handover:   'The following PO lines have passed their ex-factory date and we have not yet received dispatch confirmation or a handover document. Please provide a status update for each line and confirm the expected dispatch date.',
  cpr:        'The following PO lines are running late and we need to discuss a commercial price reduction (CPR) to reflect the delay. Please respond with your proposed CPR % for each line, or contact us to discuss.',
}

function buildChaseEmail(supplierName: string, lines: PO[], chaseType: ChaseType): string {
  const today   = new Date()
  const weekStr = `Wk ${isoWeekNum(today)}`
  const subjects: Record<ChaseType, string> = {
    booking_in: `Sea Freight Booking-in Confirmation – ${weekStr}`,
    handover:   `Handover / Dispatch Chase – ${weekStr}`,
    cpr:        `CPR Discussion – Late Orders – ${weekStr}`,
  }
  const lineRows = lines.map(po => {
    const xfStr = getXFactoryDate(po).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return `  • ${po.id} | ${po.product} | Qty: ${po.quantity.toLocaleString()} | X-factory: ${xfStr} | Delivery: ${formatDate(po.revisedDelivery ?? po.expectedDelivery)}`
  }).join('\n')
  return `Subject: ${subjects[chaseType]} – ${supplierName}

Dear ${supplierName} team,

${CHASE_INTROS[chaseType]}

${lineRows}

Please respond by end of business today.

Best regards,
[Buyer Name]`
}

function getProductScenario(rec: typeof REORDER_RECOMMENDATIONS[0]): 'accepted' | 'counter' | 'escalate' {
  const seed = rec.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const scenarios: Array<'accepted' | 'counter' | 'escalate'> = ['accepted', 'counter', 'escalate']
  return scenarios[seed % 3]
}

function buildInquiryEmail(
  rec: typeof REORDER_RECOMMENDATIONS[0],
  roundNumber: number,
  requestedCP: number
): string {
  const ff      = getFitFamily(rec.id)
  const today   = new Date()
  const deadline = new Date(today)
  deadline.setDate(today.getDate() + 5)
  const dlStr   = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const familyLine = ff
    ? `\nAs part of our ${ff.label} programme, combined volume across styles reaches ${ff.sharedMOQ.toLocaleString()} units, which we trust supports this request.`
    : ''
  const openingLine = roundNumber === 1
    ? `We are reviewing our reorder position for ${rec.name} (SKU: ${rec.sku}) and would like to discuss cost price for the upcoming replenishment.`
    : `Following our previous exchange, we would like to continue our discussion on cost price for ${rec.name} (SKU: ${rec.sku}).`
  return `Subject: CP Inquiry – ${rec.name} – Wk ${isoWeekNum(today)}

Dear ${rec.supplier} team,

${openingLine}

Current agreed CP: £${rec.costPrice.toFixed(2)} per unit

Given the ${rec.recommendedReorderQty.toLocaleString()}-unit commitment and our forward plan for this line, we'd like to align on £${requestedCP.toFixed(2)} per unit for this order.${familyLine}

Please confirm your best CP and any MOQ conditions by ${dlStr}.

Best regards,
[Buyer Name]`
}

function buildCounterMidpointDraft(
  rec: typeof REORDER_RECOMMENDATIONS[0],
  reply: SupplierNegReply,
  round1RequestedCP: number,
): string {
  const midpoint = Math.round((round1RequestedCP + reply.offeredCP) / 2 * 100) / 100
  const today = new Date()
  const dl = new Date(today); dl.setDate(today.getDate() + 3)
  const dlStr = dl.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const exFactoryDt = rec.exFactoryDate ? new Date(rec.exFactoryDate) : null
  const weeksToExF = exFactoryDt ? (exFactoryDt.getTime() - today.getTime()) / (7 * 86400000) : null
  const hasLeadBreach = weeksToExF !== null && reply.leadTimeWeeks > weeksToExF
  const exFStr = exFactoryDt ? exFactoryDt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
  const leadTimeBlock = hasLeadBreach
    ? `\nOn lead time: our ex-factory date is fixed at ${exFStr} and cannot move. We require full delivery of ${rec.recommendedReorderQty.toLocaleString()} units by that date. Alternatively, we can accept a split: 1,800 units by 28 May (firm) with the balance of 1,330 units no later than 2 Jun 2026. Any delay beyond these dates will require a commercial discussion.\n`
    : ''

  return `Subject: RE: CP Inquiry – ${rec.name} – Round 2

Dear ${rec.supplier} team,

Thank you for your response. We appreciate your transparency on material cost pressures and understand the input cost context.

After internal review, we are unable to accept £${reply.offeredCP.toFixed(2)} per unit — this exceeds our cost price approval threshold and would take gross margin below acceptable levels for this range.

We propose to meet in the middle at £${midpoint.toFixed(2)} per unit, which represents a fair midpoint between our positions and allows us to maintain viable margins.${leadTimeBlock}
To support this agreement, we can offer 60-day payment terms (vs our standard 45 days) and are prepared to commit to a repeat order at the same CP for AW26, providing you with forward volume certainty.

Confirmed order quantity: ${rec.recommendedReorderQty.toLocaleString()} units

Please confirm by ${dlStr} so we can proceed to purchase order.

Best regards,
[Buyer Name]`
}

function buildAcceptSplitDraft(
  rec: typeof REORDER_RECOMMENDATIONS[0],
  reply: SupplierNegReply,
  round1RequestedCP: number,
): string {
  const midpoint = Math.round((round1RequestedCP + reply.offeredCP) / 2 * 100) / 100
  const today = new Date()
  const dl = new Date(today); dl.setDate(today.getDate() + 3)
  const dlStr = dl.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `Subject: RE: CP Inquiry – ${rec.name} – Split Delivery Proposal

Dear ${rec.supplier} team,

Thank you for your response and for offering a partial fulfilment option.

We are prepared to accept a split delivery on the following conditions:

• Shipment 1: 1,800 units delivered by 28 May 2026 (firm — no later)
• Shipment 2: 1,330 units delivered by 2 Jun 2026 (firm — no later)
• Agreed CP: £${midpoint.toFixed(2)} per unit across both shipments

The first shipment date of 28 May is critical for our range launch and cannot slip. If you are unable to meet this, please advise immediately so we can explore alternatives.

Total order quantity confirmed: ${rec.recommendedReorderQty.toLocaleString()} units

Please confirm both shipment dates and the CP of £${midpoint.toFixed(2)} by ${dlStr}.

Best regards,
[Buyer Name]`
}

function simulateSupplierReply(
  rec: typeof REORDER_RECOMMENDATIONS[0],
  round: InquiryRound,
  scenario: 'accepted' | 'counter' | 'escalate'
): SupplierNegReply {
  const today      = new Date().toISOString().slice(0, 10)
  const leadTime   = (rec.supplier.length % 4) + 4
  const exFactory  = new Date()
  exFactory.setDate(exFactory.getDate() + leadTime * 7)
  const exEnd      = new Date(exFactory.getTime() + 14 * 86400000)
  const deliveryWindow = `${exFactory.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${exEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  if (scenario === 'accepted') {
    const offered = Math.round(round.requestedCP * 1.005 * 100) / 100
    return {
      receivedAt: today, offeredCP: offered, moqOffered: rec.minOrderQty,
      leadTimeWeeks: leadTime, deliveryWindow, accepted: true, scenario,
      rawText: `Dear Buying Team,\n\nThank you for your inquiry regarding ${rec.name}.\n\nWe are pleased to confirm acceptance of your terms:\n• CP: £${offered.toFixed(2)} per unit\n• MOQ: ${rec.minOrderQty.toLocaleString()} units\n• Lead time: ${leadTime} weeks\n• Delivery: ${deliveryWindow}\n\nPlease proceed with the order and we will prioritise production scheduling.\n\nBest regards,\n${rec.supplier}`,
    }
  }
  if (scenario === 'counter') {
    const offered = Math.round(((round.requestedCP + rec.costPrice) / 2) * 100) / 100
    return {
      receivedAt: today, offeredCP: offered, moqOffered: rec.minOrderQty,
      leadTimeWeeks: leadTime, deliveryWindow, accepted: false, scenario,
      rawText: `Dear Buying Team,\n\nThank you for your inquiry. After internal review, we can offer:\n\n• CP: £${offered.toFixed(2)} per unit (your requested £${round.requestedCP.toFixed(2)} is not achievable due to material cost pressures)\n• MOQ: ${rec.minOrderQty.toLocaleString()} units\n• Lead time: ${leadTime} weeks\n• Delivery: ${deliveryWindow}\n\nWe hope to proceed and look forward to your response.\n\nBest regards,\n${rec.supplier}`,
    }
  }
  const offeredMOQ = Math.round(rec.minOrderQty * 1.6)
  return {
    receivedAt: today, offeredCP: rec.costPrice, moqOffered: offeredMOQ,
    leadTimeWeeks: leadTime + 2, deliveryWindow, accepted: false, scenario,
    rawText: `Dear Buying Team,\n\nUnfortunately we are unable to reduce our CP at this time. Raw material costs have increased significantly and £${rec.costPrice.toFixed(2)} is our best offer.\n\nWe can offer preferential terms at higher volume:\n• Revised MOQ: ${offeredMOQ.toLocaleString()} units\n• Lead time: ${leadTime + 2} weeks\n• Delivery: ${deliveryWindow}\n\nBest regards,\n${rec.supplier}`,
  }
}

const NEG_STATUS_CFG: Record<NegotiationStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  idle:          { label: '',                bg: '',              text: '',                 border: '',                 dot: ''             },
  draft:         { label: 'Draft',           bg: 'bg-gray-100',   text: 'text-gray-600',    border: 'border-gray-200',  dot: 'bg-gray-400'  },
  sending:       { label: 'Sending…',        bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',  dot: 'bg-blue-300'  },
  sent:          { label: 'Sent',            bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',  dot: 'bg-blue-400'  },
  awaiting_reply:{ label: 'Awaiting reply',  bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',  dot: 'bg-blue-500'  },
  replied:       { label: 'Reply rcvd',      bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200', dot: 'bg-amber-400' },
  follow_up:     { label: 'Follow-up ready', bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',dot: 'bg-violet-400'},
  agreed:        { label: 'Agreed ✓',        bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200', dot: 'bg-green-500' },
  escalated:     { label: 'Escalated ⚑',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',   dot: 'bg-red-500'   },
}

function evalCpDecision(cpDeltaPct: number, lastReply: { offeredCP: number } | null, sellingPrice: number, effectiveCpRules: CpRulesState, currentMarginPct: string, leadTimeBreach?: boolean) {
  const withinRule        = cpDeltaPct < effectiveCpRules.escalateIfPct
  const exceedsEscalation = cpDeltaPct >= effectiveCpRules.escalateIfPct
  const newGP = lastReply ? ((sellingPrice - lastReply.offeredCP) / sellingPrice * 100).toFixed(1) : currentMarginPct
  return { withinRule, exceedsEscalation, newGP, leadTimeBreach: leadTimeBreach ?? false }
}

// ── Inquiry Drawer ────────────────────────────────────────────────────────────
function InquiryDrawer({
  rec, thread, onClose, onUpdate, isManager, onApprove, onReject, globalCpRules, onNavigateToPO,
}: {
  rec:              typeof REORDER_RECOMMENDATIONS[0]
  thread:           InquiryThread | undefined
  onClose:          () => void
  onUpdate:         (t: InquiryThread) => void
  isManager?:       boolean
  onApprove?:       () => void
  onReject?:        () => void
  globalCpRules:    CpRulesState
  onNavigateToPO?:  (poId: string) => void
}) {
  const ff      = getFitFamily(rec.id)
  const status: NegotiationStatus = thread?.status ?? 'idle'

  const latestThread = useRef(thread)
  useEffect(() => { latestThread.current = thread }, [thread])

  const [contextOpen,       setContextOpen]       = useState(false)
  const [editedBody,        setEditedBody]        = useState('')
  const [originalBody,      setOriginalBody]      = useState('')
  const [followUpBody,      setFollowUpBody]      = useState('')
  const [followUpOriginal,  setFollowUpOriginal]  = useState('')
  const [isSending,         setIsSending]         = useState(false)
  const [sentAt,            setSentAt]            = useState<string | null>(null)
  const [internalNotes,     setInternalNotes]     = useState(thread?.internalNotes ?? '')
  const [alertSent,         setAlertSent]         = useState(false)
  const [appliedToBuySheet, setAppliedToBuySheet] = useState(false)
  const [mgrComment,        setMgrComment]        = useState('')
  const [cpEditing,         setCpEditing]         = useState(false)
  const [cpOverride,        setCpOverride]        = useState<CpRulesState | null>(null)
  const [_suggestStrategy,  setSuggestStrategy]   = useState<'counter' | 'split' | 'escalate'>('counter')
  const [draftCpOverride,   setDraftCpOverride]   = useState<number | null>(null)
  const [editingAsk,        setEditingAsk]        = useState(false)

  // Auto-generate draft on open
  useEffect(() => {
    if (thread) {
      const lastRound = thread.rounds[thread.rounds.length - 1]
      if (!editedBody) {
        setOriginalBody(lastRound.emailBody)
        setEditedBody(lastRound.emailBody)
      }
      setInternalNotes(thread.internalNotes)
      return
    }
    const scenario    = getProductScenario(rec)
    const requestedCP = calcRequestedCP(rec.costPrice, 1)
    const emailBody   = buildInquiryEmail(rec, 1, requestedCP)
    setOriginalBody(emailBody)
    setEditedBody(emailBody)
    onUpdate({
      recId: rec.id, supplierId: rec.supplier, status: 'draft', scenario,
      rounds: [{ roundNumber: 1, sentAt: null, emailBody, requestedCP, supplierReply: null }],
      agreedCP: null, agreedMOQ: null, flaggedReason: null, internalNotes: '',
    })
  }, [rec.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // sent → awaiting_reply after 2s
  useEffect(() => {
    if (status !== 'sent') return
    const t = setTimeout(() => {
      const cur = latestThread.current
      if (!cur || cur.status !== 'sent') return
      onUpdate({ ...cur, status: 'awaiting_reply' })
    }, 2000)
    return () => clearTimeout(t)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // awaiting_reply → replied/escalated after 3s
  useEffect(() => {
    if (status !== 'awaiting_reply') return
    const t = setTimeout(() => {
      const cur = latestThread.current
      if (!cur || cur.status !== 'awaiting_reply') return
      const last  = cur.rounds[cur.rounds.length - 1]
      const reply = simulateSupplierReply(rec, last, cur.scenario === 'uncertain' ? 'counter' : cur.scenario)
      let nextStatus: NegotiationStatus = 'replied'
      let flaggedReason: string | null  = null
      if (reply.scenario === 'escalate') {
        if (reply.moqOffered > rec.minOrderQty * ESCALATION_RULES.moqMaxMultiplier) {
          nextStatus    = 'escalated'
          flaggedReason = `Supplier MOQ (${reply.moqOffered.toLocaleString()}) exceeds limit (${Math.round(rec.minOrderQty * ESCALATION_RULES.moqMaxMultiplier).toLocaleString()})`
        } else {
          nextStatus    = 'escalated'
          flaggedReason = `CP (£${reply.offeredCP.toFixed(2)}) above acceptable threshold`
        }
      }
      onUpdate({
        ...cur,
        status:        nextStatus,
        rounds:        [...cur.rounds.slice(0, -1), { ...last, supplierReply: reply }],
        flaggedReason: flaggedReason ?? cur.flaggedReason,
      })
    }, 3000)
    return () => clearTimeout(t)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // draftCpOverride → regenerate email body live
  useEffect(() => {
    if (draftCpOverride === null || !thread) return
    const round = thread.rounds[thread.rounds.length - 1]
    const newBody = buildInquiryEmail(rec, round.roundNumber, draftCpOverride)
    setOriginalBody(newBody)
    setEditedBody(newBody)
  }, [draftCpOverride]) // eslint-disable-line react-hooks/exhaustive-deps

  // replied + counter → auto-generate follow-up draft
  useEffect(() => {
    if (status !== 'replied' || !thread) return
    const lastReply = thread.rounds[thread.rounds.length - 1]?.supplierReply
    if (!lastReply || lastReply.scenario !== 'counter' || followUpBody) return
    const round1CP = thread.rounds[0]?.requestedCP ?? 0
    const body = buildCounterMidpointDraft(rec, lastReply, round1CP)
    setFollowUpBody(body)
    setFollowUpOriginal(body)
  }, [status, thread?.rounds.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    if (!latestThread.current) return
    setIsSending(true)
    setTimeout(() => {
      const cur     = latestThread.current!
      const ts      = new Date().toISOString()
      const last    = cur.rounds[cur.rounds.length - 1]
      const updated = { ...last, sentAt: ts.slice(0, 10), emailBody: editedBody }
      setSentAt(ts)
      setIsSending(false)
      onUpdate({ ...cur, status: 'sent', rounds: [...cur.rounds.slice(0, -1), updated] })
    }, 1500)
  }

  const handleSendFollowUp = () => {
    if (!latestThread.current) return
    setIsSending(true)
    setTimeout(() => {
      const cur       = latestThread.current!
      const ts        = new Date().toISOString()
      const nextRound = cur.rounds.length + 1
      const round1CP  = cur.rounds[0]?.requestedCP ?? 0
      const replyCP   = cur.rounds[cur.rounds.length - 1]?.supplierReply?.offeredCP ?? rec.costPrice
      const requestedCP = Math.round((round1CP + replyCP) / 2 * 100) / 100
      setSentAt(ts)
      setIsSending(false)
      onUpdate({
        ...cur,
        status:    'agreed',
        agreedCP:  requestedCP,
        agreedMOQ: rec.minOrderQty,
        rounds: [...cur.rounds, { roundNumber: nextRound, sentAt: ts.slice(0, 10), emailBody: followUpBody, requestedCP, supplierReply: null }],
      })
    }, 1500)
  }

  const handleAccept = () => {
    if (!thread) return
    const reply = thread.rounds[thread.rounds.length - 1].supplierReply
    if (!reply) return
    onUpdate({ ...thread, status: 'agreed', agreedCP: reply.offeredCP, agreedMOQ: reply.moqOffered })
  }

  const lastRound  = thread?.rounds[thread.rounds.length - 1]
  const lastReply  = lastRound?.supplierReply
  const scenario   = thread?.scenario ?? getProductScenario(rec)

  const lineValue  = (rec.recommendedReorderQty * rec.costPrice).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
  const sup        = SUPPLIERS.find(s => s.name === rec.supplier)
  const relTier    = !sup ? 'Standard' : sup.onTimeRate >= 82 ? 'Strategic' : sup.onTimeRate >= 70 ? 'Preferred' : 'Standard'
  const relColors  = relTier === 'Strategic' ? 'bg-emerald-100 text-emerald-700' : relTier === 'Preferred' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'

  const today        = new Date()
  const buyDeadline  = new Date(today); buyDeadline.setDate(today.getDate() + 5)
  const exFactory    = new Date(today); exFactory.setDate(today.getDate() + (sup?.contractualLeadTimeDays ?? 42))
  const buyDlStr     = buyDeadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const exFactoryStr = exFactory.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const todayStr     = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  const effectiveCpRules = cpOverride ?? globalCpRules

  const cpDeltaPct   = lastReply ? ((lastReply.offeredCP - rec.costPrice) / rec.costPrice * 100) : 0
  const cpDeltaLabel = cpDeltaPct >= 0 ? `+${cpDeltaPct.toFixed(1)}%` : `${cpDeltaPct.toFixed(1)}%`
  const cpDeltaColor = cpDeltaPct <= 0 ? 'text-green-700' : cpDeltaPct < effectiveCpRules.escalateIfPct ? 'text-amber-700' : 'text-red-700'

  const currentMarginPct  = ((rec.sellingPrice - rec.costPrice) / rec.sellingPrice * 100).toFixed(1)
  const agreedMarginPct   = thread?.agreedCP ? ((rec.sellingPrice - thread.agreedCP) / rec.sellingPrice * 100).toFixed(1) : null

  // "Why this ask" panel derived values
  const ANCHOR_LABELS: Record<string, string> = {
    Beauty:      'Category benchmark · Beauty / volume tier 3,000+',
    Clothing:    'Category benchmark · Clothing / volume tier 2,000+',
    Footwear:    'Category benchmark · Footwear / volume tier 1,500+',
    Accessories: 'Category benchmark · Accessories / volume tier 1,000+',
  }
  const anchorLabel    = ANCHOR_LABELS[rec.category] ?? `${rec.category} category benchmark`
  const walkAwayPct    = Math.ceil(effectiveCpRules.openingAskPct / 2)
  const roundRequestedCP = lastRound?.requestedCP ?? calcRequestedCP(rec.costPrice, 1)
  const effectiveDraftCP = draftCpOverride ?? roundRequestedCP

  const exFactoryRecDt   = rec.exFactoryDate ? new Date(rec.exFactoryDate) : null
  const weeksToExFactory = exFactoryRecDt ? (exFactoryRecDt.getTime() - today.getTime()) / (7 * 86400000) : null
  const leadTimeBreach   = weeksToExFactory !== null && !!lastReply && (lastReply as SupplierNegReply).leadTimeWeeks > weeksToExFactory
  const exFactoryDateStr = exFactoryRecDt ? exFactoryRecDt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''

  const handleStrategyChange = (s: 'counter' | 'split' | 'escalate') => {
    setSuggestStrategy(s)
    if (!lastReply || !thread) return
    const round1CP = thread.rounds[0]?.requestedCP ?? 0
    if (s === 'counter') {
      const body = buildCounterMidpointDraft(rec, lastReply as SupplierNegReply, round1CP)
      setFollowUpBody(body); setFollowUpOriginal(body)
    } else if (s === 'split') {
      const body = buildAcceptSplitDraft(rec, lastReply as SupplierNegReply, round1CP)
      setFollowUpBody(body); setFollowUpOriginal(body)
    }
  }

  const pipelineStage = getPipelineStage(thread?.status === 'agreed' ? 'Approved' : 'Draft')

  const negStatusLabel =
    status === 'agreed'          ? 'Closed — Agreed' :
    status === 'escalated'       ? 'Escalated' :
    (status === 'replied' && scenario === 'uncertain') ? '⚠ Agent uncertain — flagged for review' :
    status === 'replied'         ? `Round ${lastRound?.roundNumber ?? 1} — Reply received` :
    status === 'sent'            ? `Round ${lastRound?.roundNumber ?? 1} — Sent` :
    status === 'awaiting_reply'  ? `Round ${lastRound?.roundNumber ?? 1} — Awaiting` :
    'Draft'
  const negStatusPillCls =
    status === 'agreed'    ? 'bg-green-100 text-green-700' :
    status === 'escalated' ? 'bg-red-100 text-red-700' :
    (status === 'replied' && scenario === 'uncertain') ? 'bg-amber-100 text-amber-800 border border-amber-300' :
    status === 'replied'   ? 'bg-amber-100 text-amber-700' :
    status === 'draft'     ? 'bg-gray-100 text-gray-500' :
    'bg-blue-100 text-blue-700'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[560px] bg-white h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-bold text-gray-900 truncate">{rec.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${negStatusPillCls}`}>
                {negStatusLabel}
              </span>
            </div>
            <div className="text-xs text-gray-400">{rec.supplier} · {rec.sku}</div>
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                CP target −{effectiveCpRules.openingAskPct}%
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                Escalate &gt;{effectiveCpRules.escalateIfPct}%
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                Buy by {buyDlStr}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                {lineValue}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* [1] Negotiation timeline — primary content */}
          {thread && thread.rounds.map((round, ri) => (
            <div key={ri} className="space-y-2">
              {round.sentAt && (
                <RoundSentBlock
                  roundNumber={round.roundNumber}
                  sentAt={round.sentAt}
                  requestedCP={round.requestedCP}
                  emailBody={round.emailBody}
                />
              )}
              {round.supplierReply && scenario !== 'uncertain' && (
                <ReplyBlock
                  reply={round.supplierReply}
                  rec={rec}
                  cpDeltaColor={cpDeltaColor}
                  cpDeltaLabel={cpDeltaLabel}
                  currentMarginPct={currentMarginPct}
                  leadTimeBreach={leadTimeBreach}
                />
              )}
              {round.supplierReply && scenario === 'uncertain' && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50 border-b border-amber-100">
                    <span className="text-[11px] font-semibold text-amber-700">Supplier Reply — {round.supplierReply.receivedAt}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">No CP offered</span>
                  </div>
                  <div className="px-3.5 pt-2 pb-3 bg-white">
                    <pre className="text-[10px] text-gray-600 font-mono leading-relaxed whitespace-pre-wrap">{round.supplierReply.rawText}</pre>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Why this ask — visible when draft is open */}
          {status === 'draft' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-indigo-100">
                <span className="text-[11px] font-semibold text-indigo-700">Why this ask</span>
                <button
                  onClick={() => setEditingAsk(o => !o)}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors"
                >
                  ✎ Edit ask
                </button>
              </div>
              <div className="px-4 py-3">
                {editingAsk ? (
                  <div className="space-y-2">
                    <div className="text-[10px] text-indigo-400">Target CP for this draft only</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">£</span>
                      <input
                        type="number" step="0.01" min={0}
                        value={effectiveDraftCP}
                        onChange={e => setDraftCpOverride(Number(e.target.value))}
                        className="w-24 h-7 rounded-lg border border-indigo-200 px-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                      />
                      <button onClick={() => setEditingAsk(false)} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">Done</button>
                      {draftCpOverride !== null && (
                        <button onClick={() => { setDraftCpOverride(null); setEditingAsk(false) }} className="text-[10px] text-gray-400 hover:text-gray-600">Reset</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <div className="text-[10px] text-indigo-400">Opening ask</div>
                      <div className="text-xs font-bold text-indigo-700">–{effectiveCpRules.openingAskPct}% · £{effectiveDraftCP.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-indigo-400">Anchored on</div>
                      <div className="text-[10px] font-medium text-indigo-700 leading-snug">{anchorLabel}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-indigo-400">Walk-away (Round {effectiveCpRules.maxRounds} floor)</div>
                      <div className="text-xs font-bold text-indigo-700">–{walkAwayPct}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-indigo-400">Max rounds</div>
                      <div className="text-xs font-bold text-indigo-700">{effectiveCpRules.maxRounds}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deal record — reasoning before output */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setContextOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <span className="text-[11px] text-gray-400">Deal record</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${contextOpen ? 'rotate-180' : ''}`} />
            </button>
            {contextOpen && (
              <div className="px-4 py-3 space-y-3 bg-white">
                {/* Leverage */}
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Leverage & context</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-[10px] text-gray-400">Line value</div>
                      <div className="text-xs font-bold text-gray-800 mt-0.5">{lineValue}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-gray-400">Relationship</div>
                      <span className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${relColors}`}>{relTier}</span>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-gray-400">Fit family</div>
                      <div className="text-xs font-bold text-gray-800 mt-0.5">{ff ? ff.label : '—'}</div>
                    </div>
                  </div>
                  {ff && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-500">
                      Combined MOQ across family: <span className="font-semibold text-gray-700">{ff.sharedMOQ.toLocaleString()} units</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-100" />
                {/* Key dates */}
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Key dates</div>
                  <div className="relative flex items-start">
                    <div className="absolute top-1 left-[16.5%] right-[16.5%] h-0.5 bg-gray-100" />
                    {[
                      { label: 'Today',        date: todayStr,     color: 'bg-gray-400'   },
                      { label: 'Buy decision', date: buyDlStr,     color: 'bg-amber-400'  },
                      { label: 'Ex-factory',   date: exFactoryStr, color: 'bg-indigo-400' },
                    ].map((item, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 relative z-10">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color} ring-2 ring-white`} />
                        <div className="text-[11px] font-semibold text-gray-600 text-center">{item.date}</div>
                        <div className="text-[9px] text-gray-400 text-center">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-100" />
                {/* CP Rule Engine — editable */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">CP Rule Engine</div>
                    <div className="flex items-center gap-2">
                      {cpOverride && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 font-semibold border border-amber-200">modified</span>
                      )}
                      <button onClick={() => setCpEditing(o => !o)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">
                        {cpEditing ? 'Done' : 'Edit'}
                      </button>
                      {cpOverride && (
                        <button onClick={() => { setCpOverride(null); setCpEditing(false) }} className="text-[10px] text-gray-400 hover:text-gray-600">Reset</button>
                      )}
                    </div>
                  </div>
                  {cpEditing ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] text-indigo-400 mb-1">Opening ask (–%)</div>
                        <input type="number" min={0} max={30}
                          value={(cpOverride ?? globalCpRules).openingAskPct}
                          onChange={e => setCpOverride(prev => ({ ...(prev ?? globalCpRules), openingAskPct: Number(e.target.value) }))}
                          className="w-full h-7 rounded-lg border border-indigo-200 px-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] text-indigo-400 mb-1">Escalate if &gt; (%)</div>
                        <input type="number" min={0} max={50}
                          value={(cpOverride ?? globalCpRules).escalateIfPct}
                          onChange={e => setCpOverride(prev => ({ ...(prev ?? globalCpRules), escalateIfPct: Number(e.target.value) }))}
                          className="w-full h-7 rounded-lg border border-indigo-200 px-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                        />
                      </div>
                      <div>
                        <div className="text-[10px] text-indigo-400 mb-1">Max rounds</div>
                        <input type="number" min={1} max={10}
                          value={(cpOverride ?? globalCpRules).maxRounds}
                          onChange={e => setCpOverride(prev => ({ ...(prev ?? globalCpRules), maxRounds: Number(e.target.value) }))}
                          className="w-full h-7 rounded-lg border border-indigo-200 px-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[10px] text-indigo-400">Opening ask</div>
                        <div className="text-xs font-bold text-indigo-700">–{effectiveCpRules.openingAskPct}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-indigo-400">Escalate if &gt;</div>
                        <div className="text-xs font-bold text-indigo-700">+{effectiveCpRules.escalateIfPct}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-indigo-400">Max rounds</div>
                        <div className="text-xs font-bold text-indigo-700">{effectiveCpRules.maxRounds}</div>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-indigo-100 flex justify-between text-[10px]">
                    <span className="text-indigo-400">Current CP</span>
                    <span className="font-semibold text-indigo-700">£{rec.costPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Editable email draft */}
          {status === 'draft' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-700">Draft — Round {lastRound?.roundNumber ?? 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{editedBody.length} chars</span>
                  {editedBody !== originalBody && (
                    <button onClick={() => setEditedBody(originalBody)} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">
                      Revert
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className="w-full text-[11px] text-gray-700 font-mono leading-relaxed p-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-200"
                rows={12}
                value={editedBody}
                onChange={e => setEditedBody(e.target.value)}
              />
            </div>
          )}

          {/* Sending spinner */}
          {isSending && (
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-xs text-blue-700 font-medium">Sending via Outlook…</span>
            </div>
          )}

          {/* Sent / awaiting reply state */}
          {(status === 'sent' || status === 'awaiting_reply') && (
            <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-100 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-blue-700">Sent via Outlook</span>
                {sentAt && (
                  <span className="text-[10px] text-blue-500 ml-auto">{new Date(sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
              {status === 'awaiting_reply' && (
                <div className="flex items-center gap-2 pl-7">
                  <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin shrink-0" />
                  <span className="text-[11px] text-blue-600">Awaiting supplier reply…</span>
                </div>
              )}
            </div>
          )}

          {/* Scenario A: accepted → margin impact */}
          {status === 'replied' && scenario === 'accepted' && lastReply && (
            <div className="bg-green-50 rounded-xl p-3.5 border border-green-200 space-y-1.5">
              <div className="text-[10px] font-semibold text-green-600 uppercase tracking-wide">Margin impact if accepted</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Current <Tt tip="Gross Profit %: selling price minus cost price, as a percentage of selling price.">GP%</Tt></span>
                <span className="font-semibold text-gray-700">{currentMarginPct}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-green-600">New <Tt tip="Gross Profit %: selling price minus cost price, as a percentage of selling price.">GP%</Tt> at £{lastReply.offeredCP.toFixed(2)}</span>
                <span className="font-bold text-green-700">{((rec.sellingPrice - lastReply.offeredCP) / rec.sellingPrice * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs pb-1">
                <span className="text-green-600">Saving this order</span>
                <span className="font-bold text-green-700">
                  £{((rec.costPrice - lastReply.offeredCP) * rec.recommendedReorderQty).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </span>
              </div>
              {!appliedToBuySheet && !NEG_PO_MAP[rec.id] ? (
                <div className="space-y-1">
                  <button
                    onClick={() => { setAppliedToBuySheet(true); handleAccept() }}
                    className="w-full h-8 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Apply to Purchase Order
                  </button>
                  <p className="text-center text-[10px] text-gray-400">You'll review before anything is sent.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-green-700 py-1">
                    <Check className="w-3.5 h-3.5" /> Applied to Purchase Order
                  </div>
                  {NEG_PO_MAP[rec.id] && (() => {
                    const linkedPO = ALL_POS.find(p => p.id === NEG_PO_MAP[rec.id])
                    return linkedPO ? (
                      <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between">
                        <div className="text-[11px] text-gray-600">
                          Resulted in <span className="font-semibold text-gray-900">{linkedPO.id}</span>
                          <span className="mx-1.5 text-gray-300">·</span>
                          <span className="text-green-600 font-medium">Currently: {linkedPO.status}</span>
                        </div>
                        <button
                          onClick={() => onNavigateToPO?.(linkedPO.id)}
                          className="text-indigo-500 hover:text-indigo-700 text-[11px] font-medium whitespace-nowrap ml-2 transition-colors"
                        >
                          View PO →
                        </button>
                      </div>
                    ) : null
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Strategy recommendation — counter scenario */}
          {status === 'replied' && scenario === 'counter' && (() => {
            const offeredCP = lastReply ? (lastReply as SupplierNegReply).offeredCP : null
            const round1CP  = thread?.rounds[0]?.requestedCP ?? 0
            const midpointCP = offeredCP !== null ? ((offeredCP + round1CP) / 2) : null
            const recStrategy: 'counter' | 'split' | 'escalate' =
              cpDeltaPct >= effectiveCpRules.escalateIfPct ? 'escalate' :
              cpDeltaPct <= effectiveCpRules.escalateIfPct / 2 ? 'split' :
              'counter'
            const recRationale =
              recStrategy === 'split'    ? 'Margin impact is within tolerance — supplier moved closer to your ask.' :
              recStrategy === 'escalate' ? 'Offered CP exceeds your target ceiling by ' + cpDeltaPct.toFixed(1) + '%. This needs manager review before further rounds.' :
              midpointCP !== null ? 'Supplier offered £' + offeredCP!.toFixed(2) + ' vs your £' + round1CP.toFixed(2) + ' ask; midpoint at £' + midpointCP.toFixed(2) + ' is within your concession budget.' :
              'Meet at midpoint between our ask and their offer — within CP rules.'
            return (
              <div className="rounded-xl border border-indigo-100 overflow-hidden">
                <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                  <p className="text-[11px] font-bold text-indigo-800 mb-0.5">
                    Recommendation: {recStrategy === 'counter' ? 'Counter at midpoint' : recStrategy === 'split' ? 'Accept the split' : 'Escalate to manager'}.
                  </p>
                  <p className="text-[11px] text-indigo-700">{recRationale}</p>
                </div>
                <div className="bg-white px-4 py-3 flex items-center gap-2 flex-wrap">
                  {(['counter', 'split', 'escalate'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => s !== 'escalate' && handleStrategyChange(s)}
                      disabled={s === 'escalate'}
                      className={`h-7 px-3 rounded-full text-[10px] font-semibold transition-colors border ${
                        s === recStrategy
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : s === 'escalate'
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      {s === 'counter' ? 'Counter at midpoint' : s === 'split' ? 'Accept split delivery' : 'Escalate to manager'}
                      {s === 'escalate' && <span className="ml-1 text-[9px] opacity-70">soon</span>}
                    </button>
                  ))}
                </div>
                <details className="border-t border-indigo-100">
                  <summary className="px-4 py-2 text-[10px] text-indigo-500 cursor-pointer hover:text-indigo-700 select-none">
                    ▸ Why this recommendation?
                  </summary>
                  <div className="px-4 pb-3 space-y-1 text-[11px] text-gray-500">
                    <div>Round: <span className="font-semibold text-gray-700">{lastRound?.roundNumber ?? 1}</span></div>
                    <div>Your ask: <span className="font-semibold text-gray-700">£{round1CP.toFixed(2)}</span></div>
                    {offeredCP !== null && <div>Supplier offered: <span className="font-semibold text-gray-700">£{offeredCP.toFixed(2)}</span></div>}
                    {midpointCP !== null && <div>Midpoint: <span className="font-semibold text-gray-700">£{midpointCP.toFixed(2)}</span></div>}
                    <div>Escalate threshold: <span className="font-semibold text-gray-700">+{effectiveCpRules.escalateIfPct}%</span></div>
                    <div>CP delta: <span className={`font-semibold ${cpDeltaColor}`}>{cpDeltaLabel}</span></div>
                  </div>
                </details>
              </div>
            )
          })()}

          {/* Scenario C: uncertain → agent flags for human review */}
          {status === 'replied' && scenario === 'uncertain' && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-300 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-800">Agent uncertain — supplier response is non-committal</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                The supplier hasn't proposed a specific CP. The agent isn't confident enough to recommend a margin impact or next action. Review the full reply above and decide how to respond.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onUpdate({ ...thread!, status: 'follow_up' }) }}
                  className="flex-1 h-8 rounded-lg border border-amber-300 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3 h-3" /> Draft follow-up
                </button>
                <button
                  onClick={() => { onUpdate({ ...thread!, status: 'escalated', flaggedReason: 'Supplier reply non-committal — no CP proposed.' }) }}
                  className="flex-1 h-8 rounded-lg border border-amber-300 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3 h-3" /> Escalate to manager
                </button>
              </div>
              <p className="text-[10px] text-amber-600 text-center">Agent is passing control to you — no action will be taken without your decision.</p>
            </div>
          )}

          {/* Scenario B: counter → editable follow-up draft */}
          {status === 'replied' && scenario === 'counter' && followUpBody && (
            <div className="border border-violet-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 bg-violet-50 border-b border-violet-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[11px] font-semibold text-violet-700">AI-drafted follow-up — Round 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-violet-400">{followUpBody.length} chars</span>
                  {followUpBody !== followUpOriginal && (
                    <button onClick={() => setFollowUpBody(followUpOriginal)} className="text-[10px] text-violet-600 hover:text-violet-800 font-medium">
                      Revert
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className="w-full text-[11px] text-gray-700 font-mono leading-relaxed p-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-200"
                rows={10}
                value={followUpBody}
                onChange={e => setFollowUpBody(e.target.value)}
              />
              {lastReply && (() => {
                const ev = evalCpDecision(cpDeltaPct, lastReply, rec.sellingPrice, effectiveCpRules, currentMarginPct, leadTimeBreach)
                const supplyDelivEnd = lastReply.deliveryWindow.split('–').pop()?.trim() ?? lastReply.deliveryWindow
                return (
                  <div className="px-3.5 py-2.5 bg-gray-50 border-t border-gray-100 space-y-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Decision signals</div>
                    <div className={`flex items-start gap-1.5 text-[11px] ${ev.exceedsEscalation ? 'text-red-600' : 'text-green-600'}`}>
                      <span>{ev.exceedsEscalation ? '⚠' : '✓'}</span>
                      <span className="font-medium">
                        {ev.exceedsEscalation
                          ? `Exceeds escalation threshold (+${cpDeltaPct.toFixed(1)}% vs limit +${effectiveCpRules.escalateIfPct}%)`
                          : `Within CP rules (+${cpDeltaPct.toFixed(1)}% vs limit +${effectiveCpRules.escalateIfPct}%)`}
                      </span>
                    </div>
                    {ev.leadTimeBreach && (
                      <div className="flex items-start gap-1.5 text-[11px] text-amber-700">
                        <span>⚠</span>
                        <span className="font-medium">Delivery slips past ex-factory ({supplyDelivEnd} vs {exFactoryDateStr})</span>
                      </div>
                    )}
                    <div className="flex items-start gap-1.5 text-[11px] text-gray-600">
                      <span>→</span>
                      <span>GP impact <span className="font-semibold">{currentMarginPct}% → {ev.newGP}%</span></span>
                    </div>
                  </div>
                )
              })()}
              <div className="px-3.5 py-2.5 bg-violet-50 border-t border-violet-100">
                {lastReply && (() => {
                  const ev = evalCpDecision(cpDeltaPct, lastReply, rec.sellingPrice, effectiveCpRules, currentMarginPct, leadTimeBreach)
                  const hasAnyBreach = ev.exceedsEscalation || ev.leadTimeBreach
                  return (
                    <div className={`text-[10px] font-medium mb-2 leading-relaxed ${hasAnyBreach ? 'text-red-600' : 'text-amber-700'}`}>
                      {hasAnyBreach
                        ? `GP ${currentMarginPct}% → ${ev.newGP}% ✗ · ${ev.exceedsEscalation ? `Exceeds CP rule (+${cpDeltaPct.toFixed(1)}%)` : ''}${ev.exceedsEscalation && ev.leadTimeBreach ? ' · ' : ''}${ev.leadTimeBreach ? 'Delivery slips ex-factory' : ''} ⚠ · Escalation recommended`
                        : `CP +${cpDeltaPct.toFixed(1)}% — within your +${effectiveCpRules.escalateIfPct}% threshold, safe to send`
                      }
                    </div>
                  )
                })()}
                <button
                  onClick={handleSendFollowUp}
                  disabled={isSending}
                  className="w-full h-8 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isSending
                    ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending…</span></>
                    : <><Mail className="w-3.5 h-3.5" /><span>Send follow-up via Outlook</span></>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Scenario C: escalated */}
          {status === 'escalated' && (
            <div className="bg-red-50 rounded-xl p-3.5 border border-red-200 space-y-2">
              <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Escalation thresholds breached</div>
              {thread?.flaggedReason && <div className="text-xs text-red-700 font-medium">{thread.flaggedReason}</div>}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="bg-red-100 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-red-500">MOQ limit</div>
                  <div className="text-xs font-bold text-red-700">{Math.round(rec.minOrderQty * ESCALATION_RULES.moqMaxMultiplier).toLocaleString()}</div>
                </div>
                <div className="bg-red-100 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-red-500">CP max delta</div>
                  <div className="text-xs font-bold text-red-700">+{effectiveCpRules.escalateIfPct}%</div>
                </div>
              </div>
              {!alertSent ? (
                <button
                  onClick={() => setAlertSent(true)}
                  className="w-full h-8 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                >
                  Alert senior buyer
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-700 py-1">
                  <Check className="w-3.5 h-3.5" /> Senior buyer alerted
                </div>
              )}
            </div>
          )}

          {/* Agreement summary */}
          {status === 'agreed' && thread?.agreedCP != null && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-bold text-green-700">Agreement reached ✓</div>
              <div className="flex justify-between text-xs">
                <span className="text-green-600">Agreed CP</span>
                <span className="font-bold text-green-800">£{thread!.agreedCP!.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-green-600">Saving vs current</span>
                <span className="font-bold text-green-800">£{(rec.costPrice - thread!.agreedCP!).toFixed(2)}/unit</span>
              </div>
              {agreedMarginPct && (
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">New GP%</span>
                  <span className="font-bold text-green-800">{agreedMarginPct}%</span>
                </div>
              )}
              {thread!.agreedMOQ && (
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">Agreed MOQ</span>
                  <span className="font-bold text-green-800">{thread!.agreedMOQ.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Internal notes */}
          {thread && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 mt-4">
                Internal notes <span className="font-normal normal-case">— {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <textarea
                className="w-full text-[11px] text-gray-700 leading-relaxed p-3 rounded-xl border border-gray-200 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-200"
                rows={3}
                placeholder="Add notes for the team…"
                value={internalNotes}
                onChange={e => {
                  setInternalNotes(e.target.value)
                  onUpdate({ ...thread, internalNotes: e.target.value })
                }}
              />
            </div>
          )}
        </div>

        {/* Sticky footer — action bar */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          {/* Manager approve/reject when pending_approval */}
          {isManager && pipelineStage === 'pending_approval' && onApprove && onReject && (
            <div className="space-y-2 mb-2">
              <textarea
                rows={2}
                placeholder="Optional comment…"
                value={mgrComment}
                onChange={e => setMgrComment(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-gray-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={onApprove}
                  className="flex-1 h-9 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 h-9 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
          {status === 'draft' && (
            <div className="space-y-1">
              <button
                onClick={handleSend}
                disabled={isSending}
                className="w-full h-9 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Mail className="w-3.5 h-3.5" /> Send via Outlook
              </button>
              <p className="text-center text-[10px] text-gray-400">You'll review before anything is sent.</p>
            </div>
          )}
          {(status === 'sent' || status === 'awaiting_reply') && (
            <p className="text-center text-xs text-blue-600 font-medium">
              {status === 'sent' ? 'Email sent — confirming delivery…' : 'Waiting for supplier response…'}
            </p>
          )}
          {status === 'replied' && scenario === 'accepted' && (
            <p className="text-center text-xs text-green-600 font-medium">Review margin impact above and apply to Purchase Order.</p>
          )}
          {status === 'replied' && scenario === 'counter' && (
            <p className="text-center text-xs text-violet-600 font-medium">Review follow-up draft above and send when ready.</p>
          )}
          {status === 'replied' && scenario === 'uncertain' && (
            <p className="text-center text-xs text-amber-600 font-medium">Agent has flagged this for your review. Choose an action above.</p>
          )}
          {status === 'agreed' && !isManager && (
            <p className="text-center text-xs text-gray-400">Update agreed CP in Order App.</p>
          )}
          {status === 'escalated' && (
            <p className="text-center text-xs text-gray-400">Escalated — awaiting senior buyer action.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Inline sub-components used by InquiryDrawer thread ───────────────────────
function RoundSentBlock({ roundNumber, sentAt, requestedCP, emailBody }: {
  roundNumber: number; sentAt: string; requestedCP: number; emailBody: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] font-semibold text-gray-700">Round {roundNumber} — Sent {sentAt}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Asked for £{requestedCP.toFixed(2)}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="px-3.5 py-3 bg-white">
          <pre className="text-[10px] text-gray-600 font-mono leading-relaxed whitespace-pre-wrap">{emailBody}</pre>
        </div>
      )}
    </div>
  )
}

function ReplyBlock({ reply, rec, cpDeltaColor, cpDeltaLabel, currentMarginPct, leadTimeBreach }: {
  reply: SupplierNegReply
  rec: typeof REORDER_RECOMMENDATIONS[0]
  cpDeltaColor: string
  cpDeltaLabel: string
  currentMarginPct: string
  leadTimeBreach?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const newGP = ((rec.sellingPrice - reply.offeredCP) / rec.sellingPrice * 100).toFixed(1)
  const gpDeltaUp = parseFloat(newGP) >= parseFloat(currentMarginPct)
  const borderCls = leadTimeBreach ? 'border-red-200' : 'border-amber-200'
  const accentBg  = leadTimeBreach ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
  const accentTxt = leadTimeBreach ? 'text-red-700' : 'text-amber-700'
  return (
    <div className={`border rounded-xl overflow-hidden ${borderCls}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${accentBg}`}>
        <span className={`text-[11px] font-semibold ${accentTxt}`}>Supplier Reply — {reply.receivedAt}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${gpDeltaUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          GP% {currentMarginPct}% → {newGP}%
        </span>
      </div>

      {/* Summary cards */}
      <div className="px-3.5 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 bg-white">
        <div>
          <div className="text-[10px] text-gray-400">CP offered</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-gray-800">£{reply.offeredCP.toFixed(2)}</span>
            <span className={`text-[11px] font-semibold ${cpDeltaColor}`}>{cpDeltaLabel}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400"><Tt tip="Minimum Order Quantity: the smallest number of units a supplier will produce in a single order.">MOQ</Tt></div>
          <div className="text-sm font-bold text-gray-800">{reply.moqOffered.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">Lead time</div>
          <div className={`text-xs font-semibold ${leadTimeBreach ? 'text-red-600' : 'text-gray-700'}`}>
            {reply.leadTimeWeeks} wks{leadTimeBreach && <span className="ml-1 text-[10px] font-normal">⚠ <Tt tip="Delivery slips past the agreed ex-factory date, meaning goods will leave the factory late and likely arrive late.">slips ex-fty</Tt></span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">Delivery window</div>
          <div className={`text-xs font-semibold ${leadTimeBreach ? 'text-red-600' : 'text-gray-700'}`}>{reply.deliveryWindow}</div>
        </div>
      </div>
      <div className="px-3.5 pb-2 text-[9px] text-gray-400 italic bg-white">
        AI-summarised — verify against full reply below
      </div>

      {/* Full reply text — expanded by default */}
      <div className={`border-t ${borderCls}`}>
        {expanded ? (
          <div className="px-3.5 pt-2 pb-3 bg-white">
            <pre className="text-[10px] text-gray-600 font-mono leading-relaxed whitespace-pre-wrap">{reply.rawText}</pre>
            <button
              onClick={() => setExpanded(false)}
              className={`mt-2 text-[10px] font-medium ${accentTxt} hover:opacity-70 transition-opacity`}
            >
              Collapse full reply ↑
            </button>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className={`w-full flex items-center justify-between px-3.5 py-1.5 hover:bg-amber-50/60 transition-colors text-left`}
          >
            <span className={`text-[10px] font-medium ${accentTxt}`}>View full reply</span>
            <ChevronDown className="w-3 h-3 text-amber-400" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Active Negotiations View ──────────────────────────────────────────────────
function ActiveNegotiationsView({
  negNeedsResponse, negAwaiting, negReady, inquiries, onOpenInquiry, cpRules, onUpdateCpRules,
}: {
  negNeedsResponse: typeof REORDER_RECOMMENDATIONS
  negAwaiting:      typeof REORDER_RECOMMENDATIONS
  negReady:         typeof REORDER_RECOMMENDATIONS
  inquiries:        Record<string, InquiryThread>
  onOpenInquiry:    (id: string) => void
  cpRules:          CpRulesState
  onUpdateCpRules:  (r: CpRulesState) => void
}) {
  const [cpSettingsOpen, setCpSettingsOpen] = useState(false)
  const sections = [
    {
      key: 'needs',
      title: 'Needs your response',
      items: negNeedsResponse,
      borderCls: 'border-amber-200',
      bgCls: 'bg-amber-50',
      headerCls: 'text-amber-700',
      emptyText: 'No items needing response',
      btnCls: 'bg-amber-500 text-white hover:bg-amber-600',
      btnLabel: 'Review reply',
    },
    {
      key: 'awaiting',
      title: 'Awaiting supplier',
      items: negAwaiting,
      borderCls: 'border-blue-200',
      bgCls: 'bg-blue-50/30',
      headerCls: 'text-blue-700',
      emptyText: 'No items awaiting reply',
      btnCls: 'border border-gray-200 text-gray-600 hover:bg-gray-50',
      btnLabel: 'View thread',
    },
    {
      key: 'ready',
      title: 'Ready to progress',
      items: negReady,
      borderCls: 'border-green-200',
      bgCls: 'bg-green-50/30',
      headerCls: 'text-green-700',
      emptyText: 'No items ready to progress',
      btnCls: 'bg-green-600 text-white hover:bg-green-700',
      btnLabel: 'Proceed',
    },
  ]

  return (
    <div className="space-y-6">

      {/* CP Rule Defaults settings */}
      <div className="border border-indigo-100 rounded-xl overflow-hidden">
        <button
          onClick={() => setCpSettingsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
        >
          <span className="text-xs font-semibold text-indigo-600">CP Rule Defaults</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-indigo-400">–{cpRules.openingAskPct}% ask · +{cpRules.escalateIfPct}% escalate · {cpRules.maxRounds} rounds</span>
            <ChevronDown className={`w-3.5 h-3.5 text-indigo-400 transition-transform ${cpSettingsOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {cpSettingsOpen && (
          <div className="px-4 py-3 bg-white grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-indigo-400 block mb-1">Opening ask (–%)</label>
              <input
                type="number" min={0} max={30}
                value={cpRules.openingAskPct}
                onChange={e => onUpdateCpRules({ ...cpRules, openingAskPct: Number(e.target.value) })}
                className="w-full h-7 rounded-lg border border-indigo-200 px-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-indigo-400 block mb-1">Escalate if &gt; (%)</label>
              <input
                type="number" min={0} max={50}
                value={cpRules.escalateIfPct}
                onChange={e => onUpdateCpRules({ ...cpRules, escalateIfPct: Number(e.target.value) })}
                className="w-full h-7 rounded-lg border border-indigo-200 px-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-indigo-400 block mb-1">Max rounds</label>
              <input
                type="number" min={1} max={10}
                value={cpRules.maxRounds}
                onChange={e => onUpdateCpRules({ ...cpRules, maxRounds: Number(e.target.value) })}
                className="w-full h-7 rounded-lg border border-indigo-200 px-2 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>
        )}
      </div>

      {sections.map(sec => (
        <div key={sec.key}>
          <div className={`flex items-center gap-2 mb-3 px-1`}>
            <span className={`text-xs font-bold ${sec.headerCls}`}>{sec.title}</span>
            <span className="text-[10px] text-gray-400 font-medium">({sec.items.length})</span>
          </div>
          {sec.items.length === 0 ? (
            <div className="text-xs text-gray-400 italic px-1">{sec.emptyText}</div>
          ) : (
            <div className="space-y-2">
              {sec.items.map(p => {
                const thread = inquiries[p.id]
                if (!thread) return null
                const lastRound = thread.rounds[thread.rounds.length - 1]
                const lastReply = lastRound?.supplierReply
                const sentDays  = lastRound?.sentAt
                  ? Math.floor((Date.now() - new Date(lastRound.sentAt).getTime()) / 86400000)
                  : null
                const nsCfg = NEG_STATUS_CFG[thread.status]
                return (
                  <div key={p.id} className={`rounded-xl border p-4 ${sec.borderCls} ${sec.bgCls}`}>
                    {/* Row 1 */}
                    <div className="flex items-center gap-2 mb-2">
                      <img src={p.imageUrl} className="w-9 h-9 rounded object-cover shrink-0" alt="" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-gray-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-gray-400">{p.sku}</div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${nsCfg.bg} ${nsCfg.text} ${nsCfg.border} shrink-0`}>
                        <span className={`w-1 h-1 rounded-full ${nsCfg.dot}`} />{nsCfg.label}
                      </span>
                    </div>
                    {/* Row 2 */}
                    <div className="flex items-center gap-3 mb-1 text-[10px] text-gray-500">
                      <span>Round {lastRound?.roundNumber ?? 1} of {cpRules.maxRounds} max</span>
                      <span>·</span>
                      <span>CP: £{p.costPrice.toFixed(2)} → target £{calcRequestedCP(p.costPrice, 1).toFixed(2)}</span>
                      {sentDays !== null && sec.key === 'awaiting' && (
                        <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-semibold">
                          {sentDays}d waiting
                        </span>
                      )}
                    </div>
                    {/* Row 3 */}
                    {lastReply && (
                      <div className="text-[10px] text-gray-400 italic mb-2 line-clamp-1">
                        {lastReply.rawText.split('\n').filter(l => l.trim())[0] ?? ''}
                      </div>
                    )}
                    {/* Row 4 */}
                    <button
                      onClick={() => onOpenInquiry(p.id)}
                      className={`w-full h-7 text-[10px] font-semibold rounded-lg transition-colors ${sec.btnCls}`}
                    >
                      {sec.btnLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Reorder Recommendations View ──────────────────────────────────────────────
type ReorderFilter = ApprovalStatus | 'All'
type PipelineStage = 'draft' | 'pending_approval' | 'approved' | 'pushed' | 'rejected'
const PIPELINE_ORDER: PipelineStage[] = ['draft', 'pending_approval', 'approved', 'pushed']
const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  draft:            'Draft',
  pending_approval: 'Pending approval',
  approved:         'Approved',
  pushed:           'Sent to Order App',
  rejected:         'Rejected',
}

// Seeded rejection metadata for pre-rejected POs in demo data
const REJECTION_META: Record<string, { manager: string; date: string }> = {
  'REC-003': { manager: 'Sarah Chen', date: '21 Apr 2026' },
  'REC-008': { manager: 'Sarah Chen', date: '24 Apr 2026' },
}

// Module-level set so the manager view (separate component) sees a "Resubmitted" pill
// on POs the merchandiser has resubmitted within the same session.
const _sharedResubmits = new Set<string>()

// Shared rejection history — populated by manager rejections, read by buyer view
const _sharedRejectionHistory: Record<string, Array<{ date: string; manager: string; comment: string }>> = {
  'REC-003': [{ date: '21 Apr 2026', manager: 'Sarah Chen', comment: 'Stock levels still too high at DC. Come back when cover drops below 8w.' }],
  'REC-008': [{ date: '24 Apr 2026', manager: 'Sarah Chen', comment: 'Margin too thin at this price point. Need supplier discount first.' }],
}

// Helper: lead time band for Inventory filters
function getLeadTimeBand(lt: string): string {
  const weeks = parseInt(lt)
  if (weeks < 2) return 'UK <2wk'
  if (weeks <= 4) return 'EU 2-4wk'
  return 'Far East 8-12wk'
}

// Helper: gross margin for time window (Feature 6a)
function getMarginForWindow(marginPct: number, id: string, timeRange: '1m' | '6m' | '1y'): number {
  const base = Math.round(marginPct * 100)
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  if (timeRange === '1m') return base
  if (timeRange === '6m') return Math.max(0, base + ((seed * 3) % 5) - 2)
  return Math.max(0, base + ((seed * 7) % 8) - 4)
}

function getPipelineStage(approvalStatus: ApprovalStatus): PipelineStage {
  if (approvalStatus === 'Sent')             return 'pushed'
  if (approvalStatus === 'Approved')         return 'approved'
  if (approvalStatus === 'Pending Approval') return 'pending_approval'
  if (approvalStatus === 'Rejected')         return 'rejected'
  return 'draft'
}

function PipelineStepper({ stage }: { stage: PipelineStage }) {
  if (stage === 'rejected') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">Rejected</span>
  }
  const idx = PIPELINE_ORDER.indexOf(stage)
  return (
    <div className="flex items-center gap-0.5 whitespace-nowrap">
      {PIPELINE_ORDER.map((s, si) => {
        const done    = si < idx
        const current = si === idx
        return (
          <div key={s} className="flex items-center gap-0.5">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${done ? 'bg-indigo-500' : current ? 'bg-indigo-600 ring-2 ring-indigo-100' : 'bg-gray-200'}`}
              title={PIPELINE_STAGE_LABELS[s]}
            />
            {si < PIPELINE_ORDER.length - 1 && <div className={`w-3 h-px ${done ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
          </div>
        )
      })}
      <span className="text-[10px] text-gray-500 ml-1.5">{PIPELINE_STAGE_LABELS[stage]}</span>
    </div>
  )
}

// ── Simple toast notification ─────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in"
      style={{ animation: 'fadeInUp 0.2s ease' }}
    >
      <span>{message}</span>
      <button onClick={onDone} className="text-gray-400 hover:text-white ml-1">✕</button>
    </div>
  )
}

// ── Stock Levels Chart (30-week inventory model) ─────────────────────────────
function StockLevelsChart({ productId, timeRange }: { productId: string; timeRange: '1m' | '6m' | '1y' }) {
  const [chartUnit, setChartUnit] = useState<'units' | 'value' | 'cover'>('units')
  const TODAY = 18, TOTAL = 52

  // Derive simulation parameters from the product — fall back to a neutral demo SKU
  const prod = REORDER_RECOMMENDATIONS.find(p => p.id === productId)
  const X  = prod?.weeklySales  ?? 200
  const S  = prod?.safetyStock  ?? 300
  const CP = prod?.costPrice    ?? 12
  const SP = prod?.sellingPrice ?? 40

  // Inventory model: LT=8wks, FWC(review cycle)=4wks
  // intake_units = X × FWC  →  every cycle replenishes exactly one cycle of demand
  // MIN = S + X×LT  (net-inv reorder trigger)
  // MAX = MIN + X×FWC  (net-inv immediately after order is placed in the intake week)
  const FWC    = 4
  const LT     = 8
  const INTAKE  = X * FWC
  const SAFETY  = S
  const MIN_LVL = S + X * LT
  const MAX_LVL = MIN_LVL + X * FWC
  const AVG_DEM = X

  // Flat demand — exactly X every week → clean 4-week sawtooth
  const demands = Array.from({ length: TOTAL }, () => X)

  // POs every FWC weeks, each placed LT weeks before delivery
  // placed<0 = pre-chart history; only placed>=0 show ↑ORD markers
  const POS = Array.from({ length: 13 }, (_, k) => ({
    placed:    (k - 2) * FWC,
    delivered: k * FWC,
    qty:       INTAKE,
  }))

  const BASE = new Date('2026-04-21').getTime()
  const MO   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const wk   = (i: number) => { const d = new Date(BASE + (i - TODAY) * 7 * 86_400_000); return `${d.getDate()} ${MO[d.getMonth()]}` }
  const ds   = (i: number) => { const d = new Date(BASE + (i - TODAY) * 7 * 86_400_000); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}` }
  const wn   = (i: number) => { const d = new Date(BASE + (i - TODAY) * 7 * 86_400_000); const u = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dy = u.getUTCDay()||7; u.setUTCDate(u.getUTCDate()+4-dy); const y1=new Date(Date.UTC(u.getUTCFullYear(),0,1)); return Math.ceil((((u.getTime()-y1.getTime())/86400000)+1)/7) }

  // Start at trough (safety stock) — first intake at W0 immediately restores to peak
  let st = S
  const allRows = Array.from({ length: TOTAL }, (_, i) => {
    const open  = st
    const dem   = demands[i]
    const intk  = POS.find(p => p.delivered === i)?.qty ?? 0
    const close = Math.max(0, open + intk - dem)
    // on_order = all POs placed on or before this week that haven't arrived yet
    const onOrd = POS.filter(p => p.placed <= i && p.delivered > i).reduce((acc, p) => acc + p.qty, 0)
    // At intake weeks use beginning-of-period stock so netInv hits MAX exactly;
    // at other weeks use end-of-period so netInv hits MIN exactly at the trough.
    const netInv = intk > 0 ? (open + intk + onOrd) : (close + onOrd)
    const act   = i <= TODAY
    st = close
    const revenue = Math.round(dem * SP)
    const grossProfit = Math.round(dem * (SP - CP))
    const gpPct = Math.round((SP - CP) / SP * 100)
    const coverWeeks = dem > 0 ? Math.round(close / dem * 10) / 10 : 0
    return { wk: wk(i), dateStr: ds(i), weekNum: wn(i), wi: i, open, dem, intk, close, onOrd, netInv,
      closeAct: act ? close : null, onOrdAct: act ? onOrd : null,
      closeFc: !act ? close : null, onOrdFc: !act ? onOrd : null,
      netInvAct: act ? netInv : null, netInvFc: !act ? netInv : null,
      isActual: act, revenue, grossProfit, gpPct, coverWeeks }
  })

  const rows = allRows.map((r, i) => {
    const prev = allRows[i - 1]
    const demandWoW  = prev ? Math.round((r.dem - prev.dem) / Math.max(1, prev.dem) * 100) : null
    const revenueWoW = prev ? Math.round((r.revenue - prev.revenue) / Math.max(1, prev.revenue) * 100) : null
    const demandYoY  = Math.round(((42 * 7 + i * 3) % 36) - 15)
    const revenueYoY = demandYoY + Math.round(((42 + i * 5) % 6) - 3)
    return { ...r, demandWoW, revenueWoW, demandYoY, revenueYoY }
  })

  const displayRows = timeRange === '1m' ? rows.slice(12, 25)
                   : timeRange === '6m' ? rows.slice(0, 30)
                   : rows

  const SAFETY_COV = SAFETY / AVG_DEM   // 5 wks
  const MIN_COV    = MIN_LVL / AVG_DEM  // 13 wks
  const MAX_COV    = MAX_LVL / AVG_DEM  // 16 wks
  const chartRows  = chartUnit === 'units' ? displayRows : displayRows.map(r => {
    const scale = chartUnit === 'cover' ? (r.dem > 0 ? 1 / r.dem : 0) : CP
    const dp    = chartUnit === 'cover' ? 1 : 0
    return {
      ...r,
      closeAct:  r.closeAct  != null ? +( r.closeAct  * scale).toFixed(dp) : null,
      onOrdAct:  r.onOrdAct  != null ? +( r.onOrdAct  * scale).toFixed(dp) : null,
      closeFc:   r.closeFc   != null ? +( r.closeFc   * scale).toFixed(dp) : null,
      onOrdFc:   r.onOrdFc   != null ? +( r.onOrdFc   * scale).toFixed(dp) : null,
      netInvAct: r.netInvAct != null ? +( r.netInvAct * scale).toFixed(dp) : null,
      netInvFc:  r.netInvFc  != null ? +( r.netInvFc  * scale).toFixed(dp) : null,
    }
  })

  const dispWks = new Set(displayRows.map(r => r.wi))
  const todayWk = wk(TODAY)
  const riskEndWk = wk(TODAY + 8)  // lead-time window from today

  const SLC_Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const row = displayRows.find(r => r.wk === label); if (!row) return null
    const fc  = row.wi > TODAY
    const isCov = chartUnit === 'cover'
    const isVal = chartUnit === 'value'
    const fmt = (v: number) =>
      isCov ? `${+(v / row.dem).toFixed(1)} wks` : isVal ? `£${Math.round(v * CP).toLocaleString()}` : v.toLocaleString()
    const stCls = row.close >= MAX_LVL ? 'text-violet-700' : row.close >= MIN_LVL ? 'text-green-700' : row.close >= SAFETY ? 'text-amber-700' : 'text-red-700'
    const stTxt = row.close >= MAX_LVL ? 'Above max' : row.close >= MIN_LVL ? 'Healthy' : row.close >= SAFETY ? 'Below min — reorder!' : 'Below safety!'
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-[11px] min-w-[190px]">
        <div className="font-bold text-gray-900 mb-2">{label}{fc && <span className="text-violet-500 ml-1 font-normal">(forecast)</span>}</div>
        <div className="space-y-0.5">
          <div className="flex justify-between gap-4"><span className="text-gray-400">Opening</span><span>{fmt(row.open)}</span></div>
          {!isCov && <div className="flex justify-between gap-4"><span className="text-gray-400">Demand</span><span className="text-slate-700">−{row.dem}</span></div>}
          {row.intk > 0 && <div className="flex justify-between gap-4"><span className="text-gray-400">Intake (PO)</span><span className="text-emerald-700 font-medium">+{fmt(row.intk)}</span></div>}
          <div className="border-t border-gray-100 my-1" />
          <div className="flex justify-between gap-4"><span className="text-gray-600 font-medium">{isCov ? 'Available cover' : 'Closing stock'}</span><span className="font-bold text-indigo-900">{fmt(row.close)}</span></div>
          {row.onOrd > 0 && <div className="flex justify-between gap-4"><span className="text-gray-400">{isCov ? 'On-order cover' : 'On order'}</span><span className="text-violet-600">{fmt(row.onOrd)}</span></div>}
          <div className="pt-1 border-t border-gray-100 mt-1"><span className={`font-semibold ${stCls}`}>{stTxt}</span></div>
        </div>
      </div>
    )
  }

  // Build a week-index → PO-number map for past intakes (shared by chart markers and table)
  const PAST_PO_NUMS = ['PO-44821','PO-45603','PO-46287','PO-47194','PO-47852']
  const poNumByWeek: Record<number, string> = {}
  let pastIntakeIdx = 0
  POS.forEach(po => {
    if (po.delivered < TODAY) poNumByWeek[po.delivered] = PAST_PO_NUMS[pastIntakeIdx++] ?? ''
  })

  const pctCls = (v: number | null) => v == null ? 'text-gray-400' : v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-gray-500'
  const pct    = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`

  return (
    <div>
      <div className="flex justify-end mb-2">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {(['Units', 'Value', 'Cover'] as const).map(u => (
            <button key={u} onClick={() => setChartUnit(u.toLowerCase() as 'units' | 'value' | 'cover')}
              className={`h-6 px-3 rounded-md text-xs font-semibold transition-colors ${chartUnit === u.toLowerCase() ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{u}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 20 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          {/* PO transit bands */}
          {POS.filter(po => dispWks.has(po.placed) || dispWks.has(po.delivered)).map(po => (
            <ReferenceArea key={`band${po.placed}`} x1={wk(po.placed)} x2={wk(po.delivered)}
              fill="#ddd6fe" fillOpacity={0.2} />
          ))}
          {/* Risk period */}
          {dispWks.has(TODAY) && <ReferenceArea x1={todayWk} x2={riskEndWk} fill="#fef9c3" fillOpacity={0.85} />}

          <XAxis dataKey="wk" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
            interval={Math.max(0, Math.floor(displayRows.length / 8) - 1)}
            label={{ value: 'Period (weeks)', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={false}
            tickFormatter={v =>
              chartUnit === 'cover' ? `${v}` :
              chartUnit === 'value' ? (v >= 1000 ? `£${(v/1000).toFixed(0)}k` : `£${v}`) :
              (v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`)}
            label={{ value: chartUnit === 'cover' ? 'Cover (wks)' : chartUnit === 'value' ? 'Stock (£)' : 'Stock (units)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 10, fill: '#9ca3af' }} />
          <Tooltip content={(props: any) => <SLC_Tip {...props} />} />

          {/* Actual bars */}
          <Bar dataKey="closeAct" stackId="s" fill="#4338ca" name="closeAct" maxBarSize={28} radius={0} isAnimationActive={false} />
          <Bar dataKey="onOrdAct" stackId="s" fill="#c7d2fe" name="onOrdAct" maxBarSize={28} radius={[2,2,0,0]} isAnimationActive={false} />
          {/* Forecast bars (hatched) */}
          <Bar dataKey="closeFc" stackId="s" name="closeFc" maxBarSize={28} isAnimationActive={false}
            shape={(props: any) => { const {x=0,y=0,width=0,height=0}=props; if(!width||height<=0)return null; return(<g><defs><pattern id="slc-fc" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="3.5" height="6" fill="#818cf8"/></pattern></defs><rect x={x} y={y} width={width} height={height} fill="url(#slc-fc)" stroke="#6366f1" strokeWidth={0.4}/></g>) }} />
          <Bar dataKey="onOrdFc" stackId="s" name="onOrdFc" maxBarSize={28} isAnimationActive={false}
            shape={(props: any) => { const {x=0,y=0,width=0,height=0}=props; if(!width||height<=0)return null; return(<g><defs><pattern id="slc-oo-fc" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="3.5" height="6" fill="#ddd6fe"/></pattern></defs><rect x={x} y={y} width={width} height={height} fill="url(#slc-oo-fc)" stroke="#a5b4fc" strokeWidth={0.4}/></g>) }} />

          {/* Demand line — hidden in cover/value modes (different scale) */}
          <Line type="monotone" dataKey="dem" stroke="#1e293b" strokeWidth={1.5} dot={false} isAnimationActive={false} legendType="none" hide={chartUnit !== 'units'} />
          {/* Net inventory line — sawtooths between Min and Max */}
          <Line type="monotone" dataKey="netInvAct" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" connectNulls={false} />
          <Line type="monotone" dataKey="netInvFc"  stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" dot={false} isAnimationActive={false} legendType="none" connectNulls={false} />

          {/* Reference lines — scale with chartUnit */}
          <ReferenceLine y={chartUnit === 'cover' ? SAFETY_COV : chartUnit === 'value' ? SAFETY * CP : SAFETY}  stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
          <ReferenceLine y={chartUnit === 'cover' ? MIN_COV : chartUnit === 'value' ? MIN_LVL * CP : MIN_LVL} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine y={chartUnit === 'cover' ? MAX_COV : chartUnit === 'value' ? MAX_LVL * CP : MAX_LVL} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
          {dispWks.has(TODAY) && <ReferenceLine x={todayWk} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: 'Today', position: 'insideTopLeft', fontSize: 9, fill: '#6366f1', dy: -4 }} />}
          {POS.filter(po => po.placed >= 0 && dispWks.has(po.placed)).map(po => (
            <ReferenceLine key={`po${po.placed}`} x={wk(po.placed)} stroke="#3b82f6" strokeDasharray="3 2" strokeWidth={1.5}
              label={{ value: '↑ ORD', position: 'insideTopRight', fontSize: 7, fill: '#1d4ed8' }} />
          ))}
          {(() => {
            return POS.filter(po => dispWks.has(po.delivered)).map(po => {
              const isPast = po.delivered < TODAY
              const poNum  = poNumByWeek[po.delivered] ?? null
              return (
                <ReferenceLine key={`in${po.delivered}`} x={wk(po.delivered)}
                  stroke={isPast ? '#10b981' : '#86efac'}
                  strokeDasharray="3 2" strokeWidth={isPast ? 1.5 : 1}
                  label={(props: any) => {
                    const vb = props?.viewBox ?? {}
                    const lx = (vb.x ?? 0) + 3
                    const ly = vb.y ?? 0
                    return (
                      <g>
                        <text x={lx} y={ly + 11} fontSize={7} fill={isPast ? '#065f46' : '#86efac'} fontFamily="inherit">▲ IN</text>
                        {poNum && <text x={lx} y={ly + 21} fontSize={6} fill="#059669" fontFamily="inherit">{poNum}</text>}
                      </g>
                    )
                  }}
                />
              )
            })
          })()}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 mb-1 text-[10px] text-gray-500 justify-center">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-700 inline-block" />Available</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block" />On Order</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'repeating-linear-gradient(45deg,#818cf8,#818cf8 2px,#e0e7ff 2px,#e0e7ff 4px)' }} />Forecast</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t border-slate-800 inline-block" />Demand</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-indigo-500 inline-block" />Net inv.</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-amber-400 inline-block" />Safety Stock</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-slate-400 inline-block" />Min / Max</span>
        <span className="flex items-center gap-1.5 text-blue-700 font-medium">↑ ORD placed</span>
        <span className="flex items-center gap-1.5 text-emerald-700 font-medium">▲ Intake</span>
      </div>

      <div className="mt-4 overflow-x-auto max-h-72 overflow-y-auto border border-gray-100 rounded-lg">
        <table className="w-full text-[10px] min-w-[960px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['Date','Week','Opening stock\nUnits','Avail. cover\nWeeks','Intake','Closing stock','Target levels','Sales\nUnits','Sales\n% WoW','Sales\n% YoY','Revenue','Rev.\n% WoW','Rev.\n% YoY','Gross profit\nGP %','Sales price\nAverage'].map(h => (
                <th key={h} className="px-2 py-2 text-right first:text-left font-semibold text-gray-500 whitespace-nowrap">
                  {h.split('\n').map((line, idx) => idx === 0 ? <span key={idx}>{line}</span> : <span key={idx}><br/><span className="font-normal text-gray-400">{line}</span></span>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((w, i) => {
              const rowCls = w.wi === TODAY ? 'bg-indigo-50 font-semibold' : !w.isActual ? 'bg-violet-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              return (
                <tr key={i} className={`border-b border-gray-100 ${rowCls}`}>
                  <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{w.dateStr}</td>
                  <td className="px-2 py-1.5 text-right text-gray-500">{w.weekNum}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{w.open.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{w.coverWeeks}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">
                    {w.intk > 0 ? w.intk.toLocaleString() : '0'}
                    {w.intk > 0 && poNumByWeek[w.wi] && (
                      <div className="text-[9px] text-emerald-600 font-medium mt-0.5">{poNumByWeek[w.wi]}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-gray-900">{w.close.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right text-gray-500">{MIN_LVL}–{MAX_LVL}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{w.dem.toLocaleString()}</td>
                  <td className={`px-2 py-1.5 text-right ${pctCls(w.demandWoW)}`}>{pct(w.demandWoW)}</td>
                  <td className={`px-2 py-1.5 text-right ${pctCls(w.demandYoY)}`}>{pct(w.demandYoY)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">£{w.revenue.toLocaleString()}</td>
                  <td className={`px-2 py-1.5 text-right ${pctCls(w.revenueWoW)}`}>{pct(w.revenueWoW)}</td>
                  <td className={`px-2 py-1.5 text-right ${pctCls(w.revenueYoY)}`}>{pct(w.revenueYoY)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">£{w.grossProfit.toLocaleString()}<br/><span className="text-gray-400">{w.gpPct}%</span></td>
                  <td className="px-2 py-1.5 text-right text-gray-700">£{SP.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReorderView({ initialOpenInquiry, onNavigateToPO }: { initialOpenInquiry?: string | null; onNavigateToPO?: (poId: string) => void }) {
  const [search, setSearch]   = useState('')
  const [cat, setCat]         = useState('')
  const [recoSubView, setRecoSubView] = useState<'recommendations' | 'negotiations'>('recommendations')
  const [filter, setFilter]   = useState<ReorderFilter>('All')
  const [selectedProduct, setSelectedProduct] = useState<typeof REORDER_RECOMMENDATIONS[0] | null>(null)
  const [chartTab, setChartTab] = useState<'stock' | 'availability' | 'size-curve'>('stock')
  const [timeRange, setTimeRange] = useState<'1m' | '6m' | '1y'>('6m')
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ApprovalStatus>>({})
  const [freightOverrides, setFreightOverrides] = useState<Record<string, 'Sea' | 'Air'>>({})
  const [freightReasons, setFreightReasons]     = useState<Record<string, string>>({})
  const [freightSplits, setFreightSplits]       = useState<Record<string, { air: number; sea: number }>>({})
  const [recommendMode, setRecommendMode]       = useState<'cost' | 'margin'>('margin')
  const [selectedIds, setSelectedIds]           = useState<Set<string>>(new Set())
  const [toast, setToast]                       = useState<string | null>(null)
  const [inquiries, setInquiries]               = useState<Record<string, InquiryThread>>(() => ({ ...SEEDED_THREADS }))
  const [openInquiryId, setOpenInquiryId]       = useState<string | null>(initialOpenInquiry ?? null)
  const [globalCpRules, setGlobalCpRules]       = useState<CpRulesState>(DEFAULT_CP_RULES)

  useEffect(() => { if (initialOpenInquiry) setOpenInquiryId(initialOpenInquiry) }, [initialOpenInquiry])
  const [editQty, setEditQty]                   = useState(0)
  const [editExFactory, setEditExFactory]       = useState('')
  const [editCostPrice, setEditCostPrice]       = useState(0)
  const [sendMgrModalIds, setSendMgrModalIds]   = useState<string[]>([])
  const [sendMgrMsg, setSendMgrMsg]             = useState('')
  const [pushModalIds, setPushModalIds]         = useState<string[]>([])
  const [poHistory, setPoHistory]               = useState<Record<string, Array<{ action: string; by: string; date: string }>>>({})
  const [dismissedHistoryBanners, setDismissedHistoryBanners] = useState<Set<string>>(new Set())

  const effStatus  = (p: typeof REORDER_RECOMMENDATIONS[0]): ApprovalStatus =>
    statusOverrides[p.id] ?? p.approvalStatus
  const effFreight = (p: typeof REORDER_RECOMMENDATIONS[0]): 'Sea' | 'Air' =>
    freightOverrides[p.id] ?? p.recommendedFreight

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 10000) }

  const baseRows = REORDER_RECOMMENDATIONS.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) &&
    (!cat || p.category === cat)
  )

  const rows = baseRows

  const activeNegRows = REORDER_RECOMMENDATIONS.filter(p => {
    const t = inquiries[p.id]
    return t && !['idle', 'draft'].includes(t.status) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  })

  const draftEligible    = [...selectedIds].filter(id => effStatus(REORDER_RECOMMENDATIONS.find(r => r.id === id)!) === 'Draft').length
  const approvedEligible = [...selectedIds].filter(id => effStatus(REORDER_RECOMMENDATIONS.find(r => r.id === id)!) === 'Approved').length
  const allSelected  = rows.length > 0 && rows.every(r => selectedIds.has(r.id))
  const someSelected = rows.some(r => selectedIds.has(r.id))

  if (selectedProduct) {
    const p = selectedProduct
    const curStatus  = effStatus(p)
    const curFreight = effFreight(p)
    const ac = APPROVAL_CFG[curStatus]
    const riskCls = p.stockoutRisk === 'Low' ? 'bg-green-100 text-green-700' : p.stockoutRisk === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    const qty = editQty > 0 ? editQty : p.recommendedReorderQty
    const exFact = editExFactory || p.exFactoryDate
    const costPr = editCostPrice > 0 ? editCostPrice : p.costPrice
    const editTotalCost = Math.round(qty * costPr)

    // Freight option helpers
    const addD = (base: string, days: number) => {
      const d = new Date(base); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10)
    }
    const r2 = (n: number) => Math.round(n * 100) / 100
    const leadBase = parseInt(p.leadTime) || 21
    const freightOpts = {
      Sea: {
        leadTime: `${leadBase + 14} days`, exFactory: p.exFactoryDate,
        receipt: addD(p.exFactoryDate, leadBase + 14), unitCost: p.costPrice,
        totalCost: Math.round(qty * p.costPrice),
      },
      Air: {
        leadTime: `${Math.max(7, leadBase - 7)} days`, exFactory: addD(p.exFactoryDate, 14),
        receipt: addD(p.exFactoryDate, Math.max(7, leadBase - 7) + 14), unitCost: r2(p.costPrice * 1.05),
        totalCost: Math.round(qty * p.costPrice * 1.05),
      },
    }
    const isOverrideFreight = curFreight !== p.recommendedFreight

    const chartTabs = ['stock', ...(p.sizeCurve ? ['size-curve'] : []), 'availability'] as ('stock' | 'availability' | 'size-curve')[]

    const rejMeta   = REJECTION_META[p.id]
    const rejReason = p.rejectionReason

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          <button onClick={() => setSelectedProduct(null)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            ← Back to Reorder
          </button>

          {/* Prior rejection history banner — shown when not currently rejected */}
          {_sharedRejectionHistory[p.id]?.length > 0 && curStatus !== 'Rejected' && !dismissedHistoryBanners.has(p.id) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-amber-800 mb-0.5">
                  Previously rejected {_sharedRejectionHistory[p.id][0].date} by {_sharedRejectionHistory[p.id][0].manager}
                </div>
                {_sharedRejectionHistory[p.id][0].comment && (
                  <div className="text-xs text-amber-700 italic">"{_sharedRejectionHistory[p.id][0].comment}"</div>
                )}
              </div>
              <button onClick={() => setDismissedHistoryBanners(s => new Set([...s, p.id]))} className="text-amber-400 hover:text-amber-600 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Rejection banner — shown above everything when PO is rejected */}
          {curStatus === 'Rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <span className="text-red-500 text-base shrink-0 mt-0.5">●</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-red-700 mb-0.5">
                  Rejected{rejMeta ? ` by ${rejMeta.manager}, ${rejMeta.date}` : ''}
                </div>
                {rejReason && <div className="text-xs text-red-600 italic mb-1">"{rejReason}"</div>}
                <div className="text-xs text-red-600">Edit the recommendation below and resubmit for approval.</div>
              </div>
            </div>
          )}

          {/* Product header — identity + KPIs in one card */}
          {(() => {
            const gm = getMarginForWindow(p.marginPct, p.id, timeRange)
            const gmTextCls = gm > 25 ? 'text-green-700' : gm >= 10 ? 'text-amber-700' : 'text-red-700'
            return (
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-4">
                {/* Image */}
                <img src={p.imageUrl} className="w-16 h-16 rounded-lg object-cover shrink-0" alt={p.name} />
                {/* Identity + actions */}
                <div className="w-56 shrink-0 min-w-0">
                  <div className="text-sm font-bold text-gray-900 leading-snug">{p.name}</div>
                  <div className="text-[11px] text-gray-400 mb-2">{p.sku} · {p.category}</div>
                  <div className="flex gap-1.5 flex-wrap mb-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ac.bg} ${ac.text} ${ac.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ac.dot}`} />{curStatus}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${riskCls}`}>
                      {p.stockoutRisk} Risk
                    </span>
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    {curStatus === 'Draft' && (
                      <button onClick={() => {
                        if (isOverrideFreight && !freightReasons[p.id]?.trim()) {
                          showToast('Please add a reason for the freight override before sending.'); return
                        }
                        setStatusOverrides(o => ({ ...o, [p.id]: 'Pending Approval' }))
                        setPoHistory(h => ({ ...h, [p.id]: [...(h[p.id] ?? []), { action: 'Sent to manager', by: 'Emma (Merchandiser)', date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }] }))
                        showToast(`${p.name} sent to manager for approval.`)
                      }} className="h-7 px-3 text-[10px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                        Send to Manager
                      </button>
                    )}
                    {curStatus === 'Rejected' && (
                      <button onClick={() => {
                        if (isOverrideFreight && !freightReasons[p.id]?.trim()) {
                          showToast('Please add a reason for the freight override before sending.'); return
                        }
                        const changes: string[] = []
                        if (editQty > 0 && editQty !== p.recommendedReorderQty) changes.push(`Qty: ${p.recommendedReorderQty} → ${editQty}`)
                        if (editCostPrice > 0 && editCostPrice !== p.costPrice) changes.push(`Cost price: £${p.costPrice} → £${editCostPrice}`)
                        if (editExFactory && editExFactory !== p.exFactoryDate) changes.push(`Ex-Factory: ${p.exFactoryDate} → ${editExFactory}`)
                        const changeStr = changes.length > 0 ? changes.join(', ') : 'no fields changed'
                        const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        setStatusOverrides(o => ({ ...o, [p.id]: 'Pending Approval' }))
                        setPoHistory(h => ({ ...h, [p.id]: [...(h[p.id] ?? []), { action: `Resubmitted with changes: ${changeStr}`, by: 'Emma (Merchandiser)', date: today }] }))
                        _sharedResubmits.add(p.id)
                        showToast(`${p.name} resubmitted for approval.`)
                      }} className="h-7 px-3 text-[10px] font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                        Resubmit to Manager
                      </button>
                    )}
                    {curStatus === 'Approved' && (
                      <button onClick={() => {
                        setStatusOverrides(o => ({ ...o, [p.id]: 'Sent' }))
                        showToast(`${p.name} pushed to Order App.`)
                      }} className="h-7 px-3 text-[10px] font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                        Push to Order App
                      </button>
                    )}
                    <button onClick={() => setOpenInquiryId(p.id)}
                      className="h-7 px-2.5 text-[10px] font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1"
                      title="Send supplier inquiry">
                      <Mail className="w-3 h-3" />Inquire
                    </button>
                  </div>
                </div>
                {/* Divider */}
                <div className="w-px self-stretch bg-gray-100 shrink-0 mx-1" />
                {/* KPIs */}
                <div className="flex-1 grid grid-cols-5 gap-3">
                  {[
                    { label: 'Stock Value',     value: `£${p.stockValue.toLocaleString()}`,         pop: '↓ -3.2% vs last month', popCls: 'text-red-400' },
                    { label: 'Weeks of Stock',  value: `${p.weeksOfStock.toFixed(1)}w`,             pop: '↑ +0.4w vs last week',  popCls: 'text-green-600' },
                    { label: 'Monthly Revenue', value: `£${(p.monthlyRevenue / 1000).toFixed(1)}k`, pop: '↑ +7.1% vs last month', popCls: 'text-green-600' },
                    { label: 'Stockout Risk',   value: p.stockoutRisk, badge: riskCls },
                  ].map(({ label, value, badge, pop, popCls }) => (
                    <div key={label} className="text-center">
                      <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
                      {badge
                        ? <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${badge}`}>{value}</span>
                        : <div className="text-sm font-bold text-gray-900">{value}</div>}
                      {pop && <div className={`text-[10px] mt-0.5 ${popCls}`}>{pop}</div>}
                    </div>
                  ))}
                  <div className="text-center">
                    <div className="text-[10px] text-gray-400 mb-0.5">Gross Margin</div>
                    <div className={`text-sm font-bold ${gmTextCls}`}>{gm}%</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{timeRange === '1m' ? 'Last 4 wks' : timeRange === '6m' ? 'Last 6 mo' : 'Last 12 mo'}</div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Editable fields */}
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm space-y-2">
            <div className="text-[9px] font-semibold text-indigo-500 uppercase tracking-wide flex items-center gap-1">
              <span className="w-3 h-px bg-indigo-300 inline-block" />Editable<span className="w-3 h-px bg-indigo-300 inline-block" />
            </div>
            <div className="grid grid-cols-6 gap-2">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center col-span-2">
                <input type="number" value={editQty > 0 ? editQty : p.recommendedReorderQty}
                  onChange={e => setEditQty(Number(e.target.value))}
                  className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-full text-center" />
                <div className="text-[10px] text-gray-400 mt-0.5">Order Qty</div>
                <div className="text-[9px] text-indigo-400 mt-0.5">updates next Monday</div>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center col-span-2">
                <div className="flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-900 mr-0.5">£</span>
                  <input type="number" step="0.01" value={editCostPrice > 0 ? editCostPrice : p.costPrice}
                    onChange={e => setEditCostPrice(Number(e.target.value))}
                    className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-16 text-center" />
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Cost Price</div>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center col-span-2">
                <input type="date" value={exFact} onChange={e => setEditExFactory(e.target.value)}
                  className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-full text-center" />
                <div className="text-[10px] text-gray-400 mt-0.5">Ex-Factory</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-xs font-bold text-gray-900">£{editTotalCost.toLocaleString()}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Total Cost</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-xs font-bold text-gray-900">{p.receiptDate}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Receipt Date</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <div className="text-xs font-bold text-gray-900">£{p.sellingPrice.toFixed(2)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Selling Price</div>
              </div>
            </div>
          </div>

          {/* Freight Allocation */}
          {(() => {
            const activeMode: 'Sea' | 'Air' | 'Split' = freightSplits[p.id]
              ? 'Split'
              : (freightOverrides[p.id] ?? p.recommendedFreight) === 'Air' ? 'Air' : 'Sea'

            // Margin scenario data
            const scenarios = p.freightScenarios
            const seaMarginVal  = scenarios?.sea.predicted6moGrossMargin   ?? null
            const airMarginVal  = scenarios?.air.predicted6moGrossMargin   ?? null
            const splitMarginVal = scenarios?.split.predicted6moGrossMargin ?? null
            const hasMarginData = seaMarginVal !== null && airMarginVal !== null
            const bestMargin    = hasMarginData ? Math.max(seaMarginVal!, airMarginVal!, splitMarginVal ?? 0) : null

            // Effective recommended mode: margin mode picks option with highest margin
            const marginWinner = hasMarginData
              ? (airMarginVal! >= seaMarginVal! ? 'Air' : 'Sea') as 'Sea' | 'Air'
              : p.recommendedFreight as 'Sea' | 'Air'
            const recMode = (recommendMode === 'margin' && hasMarginData ? marginWinner : p.recommendedFreight) as 'Sea' | 'Air'

            const showOverrideReason = !!(freightSplits[p.id]) || (freightOverrides[p.id] !== undefined && freightOverrides[p.id] !== recMode)
            const recOpts = freightOpts[recMode]
            const altMode = (recMode === 'Sea' ? 'Air' : 'Sea') as 'Sea' | 'Air'
            const altOpts = freightOpts[altMode]
            const altDelta = altOpts.totalCost - recOpts.totalCost
            const heroSelected = activeMode === recMode

            // Per-option margins and deltas vs best
            const getMargin = (m: 'Sea' | 'Air' | 'Split') =>
              m === 'Sea' ? seaMarginVal : m === 'Air' ? airMarginVal : splitMarginVal
            const marginDeltaVsBest = (m: 'Sea' | 'Air' | 'Split') => {
              const v = getMargin(m)
              return hasMarginData && v !== null && bestMargin !== null ? v - bestMargin : null
            }
            const recMarginVal  = getMargin(recMode)
            const altMarginVsRec = hasMarginData && getMargin(altMode) !== null && recMarginVal !== null
              ? getMargin(altMode)! - recMarginVal : null

            return (
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-800">Freight Options</div>
                  <div className="flex items-center gap-0.5 rounded-full border border-gray-200 p-0.5 text-[10px]">
                    <button
                      onClick={() => setRecommendMode('cost')}
                      className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${recommendMode === 'cost' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >Lowest cost</button>
                    <button
                      onClick={() => setRecommendMode('margin')}
                      className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${recommendMode === 'margin' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >Highest margin</button>
                  </div>
                </div>
                {/* Hero card — recommended option */}
                <button
                  onClick={() => {
                    setFreightOverrides(o => ({ ...o, [p.id]: recMode }))
                    setFreightSplits(s => { const n = { ...s }; delete n[p.id]; return n })
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all mb-3 ${
                    heroSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-indigo-200 bg-white hover:bg-indigo-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900">
                      {recMode === 'Sea' ? '🚢 Sea freight' : '✈️ Air freight'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">Recommended</span>
                      {recommendMode === 'cost' && altDelta > 0 && (
                        <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                          saves £{altDelta.toLocaleString()} vs {altMode}
                        </span>
                      )}
                      {recommendMode === 'margin' && hasMarginData && altMarginVsRec !== null && altMarginVsRec < 0 && (
                        <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                          +£{Math.abs(altMarginVsRec).toLocaleString()} margin vs {altMode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-1 text-[11px]">
                    <div><span className="text-gray-400">Lead time</span><div className="font-semibold text-gray-800 mt-0.5">{recOpts.leadTime}</div></div>
                    <div><span className="text-gray-400">Receipt date</span><div className="font-semibold text-gray-800 mt-0.5">{recOpts.receipt}</div></div>
                    <div><span className="text-gray-400">Unit cost</span><div className="font-semibold text-gray-800 mt-0.5">£{recOpts.unitCost.toFixed(2)}</div></div>
                    <div><span className="text-gray-400">Total cost</span><div className="font-bold text-gray-900 mt-0.5">£{recOpts.totalCost.toLocaleString()}</div></div>
                    {hasMarginData && recMarginVal !== null && (
                      <div>
                        <span className="text-gray-400">6mo margin</span>
                        <div className="font-bold text-gray-900 mt-0.5">£{recMarginVal.toLocaleString()}</div>
                        {(() => { const d = marginDeltaVsBest(recMode); return d !== null && d < 0 ? <div className="text-[9px] text-red-500 font-semibold">−£{Math.abs(d).toLocaleString()} vs best</div> : null })()}
                      </div>
                    )}
                  </div>
                </button>
                {/* Alternatives */}
                <details className="group" open={showOverrideReason}>
                  <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 select-none">
                    <svg className="w-3 h-3 transition-transform group-open:rotate-90 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                    Compare other freight options (2 alternatives)
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {/* Air/Sea alternative — full grid */}
                    <button
                      onClick={() => {
                        setFreightOverrides(o => ({ ...o, [p.id]: altMode }))
                        setFreightSplits(s => { const n = { ...s }; delete n[p.id]; return n })
                      }}
                      className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${
                        activeMode === altMode ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50/40 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-gray-700">{altMode === 'Sea' ? '🚢 Sea' : '✈️ Air'}</span>
                        <span className={`text-[10px] font-semibold tabular-nums ${altDelta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {altDelta > 0 ? '+' : ''}£{altDelta.toLocaleString()} vs recommended
                        </span>
                      </div>
                      <div className={`grid gap-x-3 text-[10px] ${hasMarginData ? 'grid-cols-5' : 'grid-cols-4'}`}>
                        <div><div className="text-gray-400">Lead time</div><div className="font-medium text-gray-600 mt-0.5">{altOpts.leadTime}</div></div>
                        <div><div className="text-gray-400">Receipt date</div><div className="font-medium text-gray-600 mt-0.5">{altOpts.receipt}</div></div>
                        <div><div className="text-gray-400">Unit cost</div><div className="font-medium text-gray-600 mt-0.5">£{altOpts.unitCost.toFixed(2)}</div></div>
                        <div><div className="text-gray-400">Total cost</div><div className="font-semibold text-gray-700 mt-0.5">£{altOpts.totalCost.toLocaleString()}</div></div>
                        {hasMarginData && getMargin(altMode) !== null && (
                          <div>
                            <div className="text-gray-400">6mo margin</div>
                            <div className="font-semibold text-gray-700 mt-0.5">£{getMargin(altMode)!.toLocaleString()}</div>
                            {(() => { const d = marginDeltaVsBest(altMode); return d !== null && d < 0 ? <div className="text-[9px] text-red-500 font-semibold">−£{Math.abs(d).toLocaleString()} vs best</div> : null })()}
                          </div>
                        )}
                      </div>
                    </button>
                    {/* Split — compact row when not selected, inline configurator when selected */}
                    {(() => {
                      const splitActive = activeMode === 'Split'
                      const split = freightSplits[p.id] ?? { air: Math.round(qty * 0.3), sea: Math.round(qty * 0.7) }
                      const airPct = qty > 0 ? Math.round(split.air / qty * 100) : 30
                      const airUnitCost = freightOpts.Air.unitCost
                      const seaUnitCost = freightOpts.Sea.unitCost
                      const airTotal = Math.round(split.air * airUnitCost)
                      const seaTotal = Math.round(split.sea * seaUnitCost)
                      const combinedTotal = airTotal + seaTotal
                      const splitDelta = combinedTotal - recOpts.totalCost
                      const blendedUnit = qty > 0 ? combinedTotal / qty : 0
                      const splitValid = split.air + split.sea === qty
                      if (!splitActive) {
                        return (
                          <button
                            onClick={() => setFreightSplits(s => ({ ...s, [p.id]: { air: Math.round(qty * 0.3), sea: Math.round(qty * 0.7) } }))}
                            className="w-full text-left px-3 py-3 rounded-lg border border-gray-200 bg-gray-50/40 hover:bg-gray-50 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-semibold text-gray-700">↔ Split</span>
                              <span className={`text-[10px] font-semibold tabular-nums ${splitDelta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {splitDelta > 0 ? '+' : ''}£{splitDelta.toLocaleString()} vs recommended
                              </span>
                            </div>
                            <div className={`grid gap-x-3 text-[10px] ${hasMarginData ? 'grid-cols-5' : 'grid-cols-4'}`}>
                              <div><div className="text-gray-400">Lead time</div><div className="font-medium text-gray-600 mt-0.5">mixed</div></div>
                              <div><div className="text-gray-400">Receipt date</div><div className="font-medium text-gray-600 mt-0.5">{freightOpts.Sea.receipt}</div></div>
                              <div><div className="text-gray-400">Blended cost</div><div className="font-medium text-gray-600 mt-0.5">£{blendedUnit.toFixed(2)}</div></div>
                              <div><div className="text-gray-400">Total cost</div><div className="font-semibold text-gray-700 mt-0.5">£{combinedTotal.toLocaleString()}</div></div>
                              {hasMarginData && splitMarginVal !== null && (
                                <div>
                                  <div className="text-gray-400">6mo margin</div>
                                  <div className="font-semibold text-gray-700 mt-0.5">£{splitMarginVal.toLocaleString()}</div>
                                  {(() => { const d = marginDeltaVsBest('Split'); return d !== null && d < 0 ? <div className="text-[9px] text-red-500 font-semibold">−£{Math.abs(d).toLocaleString()} vs best</div> : null })()}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      }
                      return (
                        <div className="rounded-lg border border-amber-400 bg-amber-50">
                          {/* Header */}
                          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-amber-200">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="font-semibold text-gray-800">↔ Split</span>
                              <span className="text-gray-500">{airPct}% Air · {100 - airPct}% Sea</span>
                            </div>
                            <span className={`text-[10px] font-semibold tabular-nums ${splitDelta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {splitDelta > 0 ? '+' : ''}£{splitDelta.toLocaleString()} vs recommended
                            </span>
                          </div>
                          <div className="px-3 pt-3 pb-3 space-y-3">
                            {/* Input cards */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                                <div className="text-xs font-bold text-sky-700 mb-1.5">✈️ Air</div>
                                <label className="text-[10px] text-gray-500 block mb-1">Units by Air</label>
                                <input type="number" min={0} max={qty} value={split.air}
                                  onChange={e => setFreightSplits(s => ({ ...s, [p.id]: { air: Number(e.target.value), sea: qty - Number(e.target.value) } }))}
                                  className="w-full rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                                <div className="text-[10px] text-gray-500 mt-1.5">£{airUnitCost.toFixed(2)}/unit · receipt {freightOpts.Air.receipt}</div>
                              </div>
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <div className="text-xs font-bold text-blue-700 mb-1.5">🚢 Sea</div>
                                <label className="text-[10px] text-gray-500 block mb-1">Units by Sea</label>
                                <input type="number" min={0} max={qty} value={split.sea}
                                  onChange={e => setFreightSplits(s => ({ ...s, [p.id]: { sea: Number(e.target.value), air: qty - Number(e.target.value) } }))}
                                  className="w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                <div className="text-[10px] text-gray-500 mt-1.5">£{seaUnitCost.toFixed(2)}/unit · receipt {freightOpts.Sea.receipt}</div>
                              </div>
                            </div>
                            {!splitValid && (
                              <div className="text-xs text-red-600 font-semibold">Air + Sea units must equal total order qty ({qty.toLocaleString()})</div>
                            )}
                            {/* Allocation slider */}
                            <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                              <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${airPct}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500">
                              <span>✈️ Air {airPct}%</span><span>🚢 Sea {100 - airPct}%</span>
                            </div>
                            {/* Two-PO summary */}
                            {splitValid && (
                              <div className="space-y-2">
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Raising 2 POs simultaneously</div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5 text-[10px]">
                                    <div className="font-bold text-sky-700 mb-1.5">✈️ Air PO</div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between"><span className="text-gray-400">Units</span><span className="font-semibold text-gray-900">{split.air.toLocaleString()}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Unit cost</span><span className="font-semibold text-gray-900">£{airUnitCost.toFixed(2)}</span></div>
                                      <div className="flex justify-between border-t border-sky-100 pt-1 mt-1"><span className="text-gray-500 font-semibold">Total</span><span className="font-bold text-sky-800">£{airTotal.toLocaleString()}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Receipt</span><span className="font-semibold text-gray-900">{freightOpts.Air.receipt}</span></div>
                                    </div>
                                  </div>
                                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-[10px]">
                                    <div className="font-bold text-blue-700 mb-1.5">🚢 Sea PO</div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between"><span className="text-gray-400">Units</span><span className="font-semibold text-gray-900">{split.sea.toLocaleString()}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Unit cost</span><span className="font-semibold text-gray-900">£{seaUnitCost.toFixed(2)}</span></div>
                                      <div className="flex justify-between border-t border-blue-100 pt-1 mt-1"><span className="text-gray-500 font-semibold">Total</span><span className="font-bold text-blue-800">£{seaTotal.toLocaleString()}</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Receipt</span><span className="font-semibold text-gray-900">{freightOpts.Sea.receipt}</span></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-end items-center gap-2 text-xs text-gray-500 pt-1">
                                  <span>Combined total</span>
                                  <span className="font-bold text-gray-900 text-sm">£{combinedTotal.toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  {/* Override reason */}
                  {showOverrideReason && (
                    <div className="mt-3">
                      <label className="text-xs font-semibold text-amber-700 block mb-1">
                        Reason for override <span className="text-gray-400 font-normal">(required before sending to manager)</span>
                      </label>
                      <textarea rows={2} placeholder="Why are you overriding the recommended freight method?"
                        value={freightReasons[p.id] ?? ''}
                        onChange={e => setFreightReasons(r => ({ ...r, [p.id]: e.target.value }))}
                        className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-gray-400"
                      />
                    </div>
                  )}
                </details>
                {/* How is this calculated? */}
                {hasMarginData && (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer list-none text-[10px] text-indigo-500 hover:text-indigo-700 font-medium select-none">
                      ▸ How is 6mo gross margin calculated?
                    </summary>
                    <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl p-3 text-[10px] text-gray-600 space-y-2">
                      <p className="font-semibold text-gray-700">Predicted 6-month gross margin</p>
                      <p className="text-gray-500 italic">Indicative model — hand-tuned for demo purposes. Based on expected sales, margin per unit, and estimated stockout impact by freight option.</p>
                      {(['Sea', 'Air', 'Split'] as const).filter(m => getMargin(m) !== null).map(m => {
                        const scen: FreightScenarioData | undefined = scenarios?.[m.toLowerCase() as 'sea' | 'air' | 'split']
                        if (!scen) return null
                        const a = scen.assumptions
                        return (
                          <div key={m} className="border border-gray-200 rounded-lg p-2 space-y-1.5">
                            <div className="font-semibold text-gray-700">{m === 'Sea' ? '🚢' : m === 'Air' ? '✈️' : '↔'} {m} freight — <span className="text-indigo-700">£{scen.predicted6moGrossMargin.toLocaleString()}</span></div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-500">
                              <span>Forecast units (6mo): <b className="text-gray-700">{a.forecastUnits.toLocaleString()}</b></span>
                              <span>Selling price: <b className="text-gray-700">£{a.sellingPrice.toFixed(2)}</b></span>
                              <span>Cost incl. freight: <b className="text-gray-700">£{a.costPerUnitWithFreight.toFixed(2)}</b></span>
                              <span>Stockout days: <b className="text-gray-700">{a.stockoutDays}</b></span>
                              <span>Est. lost sales: <b className="text-gray-700">{a.lostUnits.toLocaleString()} units</b></span>
                              <span>Recovery rate: <b className="text-gray-700">{a.lostSaleRecoveryPct}%</b></span>
                            </div>
                            <div className="text-gray-400 pt-0.5 border-t border-gray-100">
                              Formula: (captured units × margin/unit) − (lost units × margin/unit × (1 − recovery rate))
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )}
              </div>
            )
          })()}

          {/* Two panels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-800 mb-3">Stock Management</div>
              {[
                { label: 'Available',    value: `${p.available.toLocaleString()} units` },
                { label: 'On Order',     value: `${p.onOrder.toLocaleString()} units` },
                { label: 'Safety Stock', value: `${p.safetyStock.toLocaleString()} units` },
                { label: 'Min Level',    value: `${p.minLevel.toLocaleString()} units` },
                { label: 'Max Level',    value: `${p.maxLevel.toLocaleString()} units` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-800 mb-3">Order Constraints</div>
              {[
                { label: 'Forward Weeks Cover', value: p.orderFrequency },
                { label: 'Lead Time',           value: p.leadTime },
                { label: 'Min Order Qty',       value: p.minOrderQty.toLocaleString() },
                { label: 'Pack Size',           value: p.packSize.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart panel */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-gray-800">
                {chartTab === 'size-curve' ? 'Stock distribution by size' : 'Monitor your stock levels including on order stock'}
              </span>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-auto gap-0.5">
                {chartTabs.map(t => (
                  <button key={t} onClick={() => setChartTab(t)}
                    className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${chartTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {t === 'stock' ? 'Stock Levels' : t === 'availability' ? 'Availability' : 'Size Curves'}
                  </button>
                ))}
              </div>
              {chartTab !== 'size-curve' && (
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  {(['1m', '6m', '1y'] as const).map(r => (
                    <button key={r} onClick={() => setTimeRange(r)}
                      className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${timeRange === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                      {r === '1m' ? 'One Month' : r === '6m' ? 'Six Months' : 'One Year'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {chartTab === 'stock' && <StockLevelsChart productId={p.id} timeRange={timeRange} />}

            {chartTab === 'availability' && (
              <p className="text-sm text-gray-400 mt-4">Coming soon</p>
            )}

            {chartTab === 'size-curve' && p.sizeCurve && (() => {
              // Derive totals from the same inventory model used by StockLevelsChart
              // FWC=4wks, LT=8wks, sawtooth at week TODAY=18 (2 weeks after last intake)
              const SC_FWC = 4, SC_LT = 8
              const scX = p.weeklySales, scS = p.safetyStock
              const modelAvail  = scS + scX                    // closing stock at week 18
              const modelOnOrd  = 2 * scX * SC_FWC             // 2 POs in-flight (placed wk12→del20, placed wk16→del24)
              const modelRecm   = scX * SC_FWC                 // one replenishment cycle (INTAKE)
              const modelSales  = scX
              const modelMin    = scS + scX * SC_LT             // MIN_LVL
              const modelMax    = modelMin + scX * SC_FWC       // MAX_LVL

              const rawAvail = p.sizeCurve.reduce((s: number, r: SizeCurveEntry) => s + r.available,   0)
              const rawOnOrd = p.sizeCurve.reduce((s: number, r: SizeCurveEntry) => s + r.onOrder,     0)
              const rawRecm  = p.sizeCurve.reduce((s: number, r: SizeCurveEntry) => s + r.recommended, 0)
              const rawSales = p.sizeCurve.reduce((s: number, r: SizeCurveEntry) => s + r.sales,       0)
              const rawMin   = p.sizeCurve.reduce((s: number, r: SizeCurveEntry) => s + r.targetMin,   0)
              const rawMax   = p.sizeCurve.reduce((s: number, r: SizeCurveEntry) => s + r.targetMax,   0)

              // Scale each size row proportionally so totals match the model
              const scaledCurve: SizeCurveEntry[] = p.sizeCurve.map((row: SizeCurveEntry) => ({
                ...row,
                available:   rawAvail > 0 ? Math.round(row.available   / rawAvail * modelAvail)  : 0,
                onOrder:     rawOnOrd > 0 ? Math.round(row.onOrder     / rawOnOrd * modelOnOrd)  : 0,
                recommended: rawRecm  > 0 ? Math.round(row.recommended / rawRecm  * modelRecm)   : 0,
                sales:       rawSales > 0 ? Math.round(row.sales       / rawSales * modelSales)  : 0,
                targetMin:   rawMin   > 0 ? Math.round(row.targetMin   / rawMin   * modelMin)    : 0,
                targetMax:   rawMax   > 0 ? Math.round(row.targetMax   / rawMax   * modelMax)    : 0,
              }))

              return (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={scaledCurve} margin={{ top: 8, right: 16, left: 0, bottom: 20 }} barCategoryGap="15%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="size" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
                        label={{ value: 'Size', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`}
                        label={{ value: 'Stock Units', angle: -90, position: 'insideLeft', offset: 16, fontSize: 10, fill: '#9ca3af' }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '6px 10px' }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                        formatter={(value, name) => {
                          const labels: Record<string, string> = { available: 'Available stock', onOrder: 'On order stock', recommended: 'Recommended order' }
                          return [typeof value === 'number' ? value.toLocaleString() : value, labels[name as string] ?? name]
                        }} />
                      <Bar dataKey="available"    stackId="s" fill="#4338ca" name="available"    radius={0} isAnimationActive={false} />
                      <Bar dataKey="onOrder"      stackId="s" fill="#c7d2fe" name="onOrder"      radius={0} isAnimationActive={false} />
                      <Bar dataKey="recommended"  stackId="s" name="recommended" radius={[3,3,0,0]} isAnimationActive={false}
                        shape={(props: any) => {
                          const { x=0, y=0, width=0, height=0 } = props
                          if (!width || height <= 0) return null
                          return (<g><defs><pattern id="sc-rec" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="3.5" height="6" fill="#818cf8" /></pattern></defs><rect x={x} y={y} width={width} height={height} fill="url(#sc-rec)" stroke="#6366f1" strokeWidth={0.4} /></g>)
                        }} />
                      <Line dataKey="targetMax" type="monotone" stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 3"
                        dot={{ fill: '#64748b', r: 3 }} name="Target stock level" legendType="none" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 mb-3 text-[10px] text-gray-500 justify-center">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-700 inline-block" />Available stock</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block" />On order stock</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'repeating-linear-gradient(45deg,#818cf8,#818cf8 2px,#e0e7ff 2px,#e0e7ff 4px)' }} />Recommended order</span>
                    <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-slate-400 inline-block" />Target stock level</span>
                  </div>
                  <div className="overflow-x-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-[10px]">
                      <thead className="bg-gray-50">
                        <tr className="border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Size</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Available stock<br/><span className="font-normal text-gray-400">Units</span></th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">On order stock</th>
                          <th className="px-3 py-2 text-right font-semibold text-indigo-700 bg-indigo-50 border-x border-indigo-100">Recommended order</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Avail. stock cover<br/><span className="font-normal text-gray-400">Weeks</span></th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Target stock range</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Sales this week<br/><span className="font-normal text-gray-400">Units</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {scaledCurve.map((row: SizeCurveEntry, i: number) => {
                          const cover = row.sales > 0 ? (row.available / row.sales).toFixed(1) : '—'
                          return (
                            <tr key={row.size} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                              <td className="px-3 py-1.5 font-semibold text-gray-800">{row.size}</td>
                              <td className="px-3 py-1.5 text-right text-gray-700">{row.available.toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right text-gray-700">{row.onOrder.toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-indigo-700 bg-indigo-50/50 border-x border-indigo-100">{row.recommended.toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right text-amber-600 font-semibold">{cover}</td>
                              <td className="px-3 py-1.5 text-right text-gray-500">{row.targetMin.toLocaleString()}–{row.targetMax.toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right text-gray-700">{row.sales.toLocaleString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* PO history log — shows audit trail of actions (resubmissions, sends, etc.) */}
        {(poHistory[p.id]?.length ?? 0) > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-800 mb-3">Activity log</div>
            <div className="space-y-2">
              {/* Seed initial rejection entry for pre-rejected POs */}
              {REJECTION_META[p.id] && (
                <div className="flex items-start gap-3 text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1" />
                  <span><span className="font-semibold text-gray-700">Rejected by {REJECTION_META[p.id].manager}</span> · {REJECTION_META[p.id].date}
                    {p.rejectionReason && <span className="italic text-gray-400"> — "{p.rejectionReason}"</span>}
                  </span>
                </div>
              )}
              {(poHistory[p.id] ?? []).map((entry, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1" />
                  <span><span className="font-semibold text-gray-700">{entry.action}</span> · {entry.by} · {entry.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejection history expandable */}
        {_sharedRejectionHistory[p.id]?.length > 0 && (
          <details className="bg-red-50 border border-red-200 rounded-xl">
            <summary className="flex items-center gap-2 px-5 py-3 cursor-pointer list-none">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <span className="text-xs font-semibold text-red-800">
                Rejection history ({_sharedRejectionHistory[p.id].length})
              </span>
              <span className="ml-auto text-[10px] text-red-500">▾ expand</span>
            </summary>
            <div className="px-5 pb-4 space-y-3 border-t border-red-100 pt-3">
              {_sharedRejectionHistory[p.id].map((entry, i) => (
                <div key={i} className="bg-white rounded-lg border border-red-100 px-3 py-2 text-xs">
                  <div className="font-semibold text-red-700 mb-0.5">Rejected by {entry.manager} · {entry.date}</div>
                  {entry.comment ? <div className="text-gray-500 italic">"{entry.comment}"</div> : <div className="text-gray-400">No reason given</div>}
                </div>
              ))}
            </div>
          </details>
        )}

        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </div>
    )
  }

  // KPI computations
  const totalReorderValue = REORDER_RECOMMENDATIONS.reduce((s, r) => s + r.totalCost, 0)
  const livePos           = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Approved').length
  const uniqueSuppliers   = new Set(REORDER_RECOMMENDATIONS.map(r => r.supplier)).size
  const avgLeadDays       = Math.round(REORDER_RECOMMENDATIONS.reduce((s, r) => s + parseInt(r.leadTime), 0) / REORDER_RECOMMENDATIONS.length)
  const stDraft    = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Draft').length
  const stPending  = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Pending Approval').length
  const stApproved = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Approved').length
  const stSent     = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Sent').length
  const stRejected = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Rejected').length
  const total      = REORDER_RECOMMENDATIONS.length
  const pct        = (n: number) => `${Math.round(n / total * 100)}%`

  const negNeedsResponse = activeNegRows.filter(p => ['replied', 'escalated'].includes(inquiries[p.id]?.status ?? ''))
  const negAwaiting      = activeNegRows.filter(p => ['sent', 'awaiting_reply'].includes(inquiries[p.id]?.status ?? ''))
  const negReady         = activeNegRows.filter(p => inquiries[p.id]?.status === 'agreed')

  const FILTER_TABS: ReorderFilter[] = ['All', 'Draft', 'Pending Approval', 'Approved', 'Rejected', 'Sent']
  const filteredRows = filter === 'All'
    ? rows
    : rows.filter(p => effStatus(p) === filter)
  const tabCounts: Record<ReorderFilter, number> = {
    All:               rows.length,
    Draft:             rows.filter(p => effStatus(p) === 'Draft').length,
    'Pending Approval':rows.filter(p => effStatus(p) === 'Pending Approval').length,
    Approved:          rows.filter(p => effStatus(p) === 'Approved').length,
    Rejected:          rows.filter(p => effStatus(p) === 'Rejected').length,
    Sent:              rows.filter(p => effStatus(p) === 'Sent').length,
  }

  const handleSendToManager = () => {
    const eligible = [...selectedIds].filter(id => effStatus(REORDER_RECOMMENDATIONS.find(r => r.id === id)!) === 'Draft')
    setSendMgrModalIds(eligible)
  }

  const handlePushToOrderApp = () => {
    const eligible = [...selectedIds].filter(id => effStatus(REORDER_RECOMMENDATIONS.find(r => r.id === id)!) === 'Approved')
    setPushModalIds(eligible)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">

        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-4 mb-5">
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
            <div className="text-xl font-bold text-gray-900">{total} <span className="text-sm font-normal text-gray-400">Recommendations</span></div>
            <div className="mt-2 flex h-2 rounded-full overflow-hidden gap-px">
              {stDraft    > 0 && <div className="bg-gray-300"    style={{ width: pct(stDraft)    }} />}
              {stPending  > 0 && <div className="bg-amber-400"   style={{ width: pct(stPending)  }} />}
              {stApproved > 0 && <div className="bg-emerald-500" style={{ width: pct(stApproved) }} />}
              {stSent     > 0 && <div className="bg-indigo-400"  style={{ width: pct(stSent)     }} />}
              {stRejected > 0 && <div className="bg-red-400 flex-1" />}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-gray-500">
              {stDraft    > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />Draft: {stDraft}</span>}
              {stPending  > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Pending: {stPending}</span>}
              {stApproved > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Approved: {stApproved}</span>}
              {stSent     > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />Sent: {stSent}</span>}
              {stRejected > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Rejected: {stRejected}</span>}
            </div>
          </div>
          {[
            { label: 'Total Reorder Value',  value: fmtGBP(totalReorderValue), sub: `${total} orders pending`, pop: '↑ +12% vs last month · within plan', popCls: 'text-green-600' },
            { label: 'Live Purchase Orders', value: `${livePos}`,              sub: 'approved this week',      pop: '↑ +2 vs last week · on track',       popCls: 'text-green-600' },
            { label: 'Total Suppliers',      value: `${uniqueSuppliers}`,      sub: 'across all recs' },
            { label: 'Avg Lead Time',        value: `${avgLeadDays} days`,     sub: 'across all recs' },
          ].map(({ label, value, sub, pop, popCls }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              <div className="text-[10px] text-gray-400 mt-1">{sub}</div>
              {pop && <div className={`text-[10px] font-semibold mt-0.5 ${popCls}`}>{pop}</div>}
            </div>
          ))}
        </div>

        {/* Segmented control */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 mb-5 w-fit gap-0.5">
          {(['recommendations', 'negotiations'] as const).map(sv => (
            <button key={sv} onClick={() => setRecoSubView(sv)}
              className={`h-8 px-5 rounded-lg text-xs font-semibold transition-colors ${
                recoSubView === sv ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {sv === 'recommendations' ? 'Recommendations' : `Active Negotiations${activeNegRows.length > 0 ? ` (${activeNegRows.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Recommendations sub-view */}
        {recoSubView === 'recommendations' && (
          <>


            {/* Status filter tabs */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 mb-4 w-fit gap-0.5">
              {FILTER_TABS.map(s => {
                const active = filter === s
                const cfgKey = s === 'All' ? null : s as ApprovalStatus
                const ac = cfgKey ? APPROVAL_CFG[cfgKey] : null
                return (
                  <button key={s} onClick={() => setFilter(s)}
                    className={`flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold transition-colors ${
                      active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {s}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active && ac ? `${ac.bg} ${ac.text} border ${ac.border}` : 'bg-gray-200 text-gray-500'
                    }`}>{tabCounts[s]}</span>
                  </button>
                )
              })}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="relative w-52">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  className="pl-8 h-9 w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Search product or SKU…"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                  value={cat} onChange={e => setCat(e.target.value)}>
                  <option value="">All categories</option>
                  {(['Beauty', 'Clothing', 'Footwear', 'Accessories'] as const).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
              <span className="ml-auto text-xs text-gray-400">{filteredRows.length} shown</span>
              <button className="h-9 px-3 flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download className="w-3.5 h-3.5" /> Export All
              </button>
            </div>

            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <span className="text-xs font-semibold text-indigo-700">{selectedIds.size} line{selectedIds.size !== 1 ? 's' : ''} selected</span>
                <div className="flex-1" />
                <button
                  disabled={draftEligible === 0}
                  onClick={handleSendToManager}
                  className="h-8 px-4 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                >
                  Send to manager for approval{draftEligible > 0 ? ` (${draftEligible})` : ''}
                </button>
                <button
                  disabled={approvedEligible === 0}
                  onClick={handlePushToOrderApp}
                  className="h-8 px-4 rounded-lg text-xs font-semibold bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
                >
                  Push to Order App{approvedEligible > 0 ? ` (${approvedEligible})` : ''}
                </button>
              </div>
            )}

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
              <table className="text-xs" style={{ minWidth: 1560 }}>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="sticky z-20 bg-gray-50 px-3 py-3 border-r border-gray-100" style={{ left: 0, width: 40, minWidth: 40 }}>
                      <input type="checkbox" className="rounded"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(new Set([...selectedIds, ...filteredRows.map(r => r.id)]))
                          else setSelectedIds(s => { const n = new Set(s); filteredRows.forEach(r => n.delete(r.id)); return n })
                        }}
                      />
                    </th>
                    <th className="sticky z-20 bg-gray-50 text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap" style={{ left: 40, minWidth: 196 }}>Product</th>
                    <th className="sticky z-20 bg-gray-50 text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap" style={{ left: 236, minWidth: 104 }}>Category</th>
                    <th className="sticky z-20 bg-indigo-50 text-right px-3 py-3 font-bold text-indigo-700 whitespace-nowrap border-l border-indigo-100" style={{ left: 340, minWidth: 100 }}>Reorder qty</th>
                    <th className="sticky z-20 bg-indigo-50 text-right px-3 py-3 font-bold text-indigo-700 whitespace-nowrap border-x border-indigo-100" style={{ left: 440, minWidth: 130, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>Total reorder cost</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Freight</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Selling Price</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Cost Price</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Gross Margin</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Revenue this week<br/><span className="font-normal text-gray-400">% WoW</span></th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Sales this week<br/><span className="font-normal text-gray-400">% WoW</span></th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Available stock</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">On order stock</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Avail. cover</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Target levels</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Min order qty</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Lead time</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Availability<br/><span className="font-normal text-gray-400">Target</span></th>
                    <th className="px-3 py-3 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100">Size breakdown</th>
                    <th className="px-3 py-3 font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth: 200 }}>Pipeline</th>
                    <th className="sticky right-0 z-20 bg-gray-50 px-3 py-3 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100" style={{ minWidth: 160, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((p, i) => {
                    const curSt = effStatus(p)
                    const curFr = effFreight(p)
                    const stage = getPipelineStage(curSt)
                    const seed = p.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                    const revWow = ((seed * 11 + i * 7) % 20) - 8
                    const salesWow = ((seed * 9 + i * 5) % 20) - 8
                    const grossMargin = Math.round((p.sellingPrice - p.costPrice) / p.sellingPrice * 100)
                    const weeklyRevenue = Math.round(p.weeklySales * p.sellingPrice)
                    const availPct = 95 + (seed % 5)
                    const fmtK = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : `${v}`
                    const stickyBg = i % 2 !== 0 ? '#f9fafb' : '#ffffff'
                    return (
                      <tr key={p.id} onClick={() => { setEditQty(0); setEditExFactory(''); setEditCostPrice(0); setSelectedProduct(p) }}
                        className={`border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition-colors ${inquiries[p.id]?.status === 'escalated' ? 'bg-red-50/50' : i % 2 !== 0 ? 'bg-gray-50/20' : ''}`}>
                        <td className="sticky z-10 px-3 py-2 border-r border-gray-100" style={{ left: 0, backgroundColor: stickyBg }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded"
                            checked={selectedIds.has(p.id)}
                            onChange={e => setSelectedIds(s => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n })}
                          />
                        </td>
                        <td className="sticky z-10 px-3 py-2" style={{ left: 40, backgroundColor: stickyBg }}>
                          <div className="flex items-center gap-2">
                            <img src={p.imageUrl} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                            <div>
                              <div className="font-semibold text-gray-900 whitespace-nowrap">{p.name}</div>
                              <div className="text-[10px] text-gray-400">{p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="sticky z-10 px-3 py-2 text-gray-600 whitespace-nowrap" style={{ left: 236, backgroundColor: stickyBg }}>{p.category}</td>
                        <td className="sticky z-10 px-3 py-2 text-right font-bold text-indigo-700 text-sm" style={{ left: 340, backgroundColor: stickyBg }}>
                          {p.recommendedReorderQty.toLocaleString()}
                        </td>
                        <td className="sticky z-10 px-3 py-2 text-right font-bold text-indigo-700 text-sm" style={{ left: 440, backgroundColor: stickyBg, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                          £{p.totalCost.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                            curFr === 'Air' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            <span>{curFr === 'Air' ? '✈️' : '🚢'}</span><span>{curFr}</span>
                            {curFr !== p.recommendedFreight && <span className="ml-0.5 text-amber-500" title="Override">⚑</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">£{p.sellingPrice.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">£{p.costPrice.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${
                          grossMargin > 25 ? 'text-green-700' : grossMargin >= 10 ? 'text-amber-700' : 'text-red-600'
                        }`}>{grossMargin}%</td>
                        <td className="px-3 py-2 text-right">
                          <div className="text-gray-700">£{weeklyRevenue.toLocaleString()}</div>
                          <div className={`text-[10px] font-semibold ${revWow >= 0 ? 'text-green-600' : 'text-red-500'}`}>{revWow >= 0 ? '+' : ''}{revWow}%</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="text-gray-700">{p.weeklySales}</div>
                          <div className={`text-[10px] font-semibold ${salesWow >= 0 ? 'text-green-600' : 'text-red-500'}`}>{salesWow >= 0 ? '+' : ''}{salesWow}%</div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{p.available.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{p.onOrder.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-bold text-amber-600">{p.weeksOfStock.toFixed(1)}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtK(p.minLevel)}–{fmtK(p.maxLevel)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{p.minOrderQty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{p.leadTime}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="font-semibold text-gray-900">{availPct}%</div>
                          <div className="text-[10px] text-gray-400">97.5%</div>
                        </td>
                        <td className="px-3 py-2 border-l border-gray-100">
                          <SizeBar bands={p.sizeBreakdown} />
                        </td>
                        {/* Pipeline column */}
                        <td className="px-3 py-2" style={{ minWidth: 200 }}>
                          <PipelineStepper stage={stage} />
                        </td>
                        {/* Next action column */}
                        <td className="sticky right-0 z-10 px-3 py-2 border-l border-gray-100" style={{ backgroundColor: stickyBg, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)', minWidth: 180 }} onClick={e => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            {/* Primary next-step action */}
                            {stage === 'draft' && (
                              <button onClick={() => setSendMgrModalIds([p.id])}
                                className="h-7 px-3 text-[10px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                                Send to manager
                              </button>
                            )}
                            {stage === 'pending_approval' && (
                              <span className="text-[10px] text-gray-400 font-medium py-0.5">Awaiting approval</span>
                            )}
                            {stage === 'approved' && (
                              <button onClick={() => setPushModalIds([p.id])}
                                className="h-7 px-3 text-[10px] font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                                Push to Order App
                              </button>
                            )}
                            {stage === 'pushed' && (
                              <span className="text-[10px] text-gray-400 font-medium py-0.5">Sent to Order App</span>
                            )}
                            {stage === 'rejected' && (() => {
                              const meta = REJECTION_META[p.id]
                              const reason = p.rejectionReason ?? '—'
                              const tooltip = meta
                                ? `Rejected by ${meta.manager}, ${meta.date} — "${reason}"`
                                : `Rejected — "${reason}"`
                              return (
                                <button
                                  onClick={() => { setEditQty(0); setEditExFactory(''); setEditCostPrice(0); setSelectedProduct(p) }}
                                  title={tooltip}
                                  className="h-7 px-3 text-[10px] font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                                  Review &amp; resubmit
                                </button>
                              )
                            })()}
                            {/* Inquiry indicator + side-action button (all statuses) */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <button
                                onClick={() => setOpenInquiryId(p.id)}
                                className="h-6 px-2 text-[10px] font-medium rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1"
                                title="Send supplier inquiry"
                              >
                                <Mail className="w-2.5 h-2.5" />Inquire
                              </button>
                              {inquiries[p.id] && inquiries[p.id].status !== 'idle' && (() => {
                                const nsCfg = NEG_STATUS_CFG[inquiries[p.id].status]
                                return (
                                  <button onClick={() => setOpenInquiryId(p.id)} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${nsCfg.bg} ${nsCfg.text} ${nsCfg.border}`} title="Open negotiation">
                                    <span className={`w-1.5 h-1.5 rounded-full ${nsCfg.dot}`} />1
                                  </button>
                                )
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Active Negotiations sub-view */}
        {recoSubView === 'negotiations' && (
          <ActiveNegotiationsView
            negNeedsResponse={negNeedsResponse}
            negAwaiting={negAwaiting}
            negReady={negReady}
            inquiries={inquiries}
            onOpenInquiry={id => setOpenInquiryId(id)}
            cpRules={globalCpRules}
            onUpdateCpRules={setGlobalCpRules}
          />
        )}
      </div>

      {/* Inquiry drawer */}
      {openInquiryId && (() => {
        const rec = REORDER_RECOMMENDATIONS.find(r => r.id === openInquiryId)
        if (!rec) return null
        return (
          <InquiryDrawer
            rec={rec}
            thread={inquiries[openInquiryId]}
            onClose={() => setOpenInquiryId(null)}
            onUpdate={t => setInquiries(prev => ({ ...prev, [t.recId]: t }))}
            globalCpRules={globalCpRules}
            onNavigateToPO={onNavigateToPO}
          />
        )
      })()}

      {/* SendToManager modal */}
      {sendMgrModalIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[420px]">
            <div className="text-sm font-bold text-gray-900 mb-1">
              Send {sendMgrModalIds.length} line{sendMgrModalIds.length !== 1 ? 's' : ''} for approval
            </div>
            <div className="text-xs text-gray-400 mb-4">Lines will be sent to your manager for review.</div>
            <textarea rows={2} placeholder="Optional message to manager…"
              value={sendMgrMsg}
              onChange={e => setSendMgrMsg(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-4 placeholder:text-gray-400" />
            <div className="flex gap-2">
              <button onClick={() => {
                setStatusOverrides(o => {
                  const n = { ...o }
                  sendMgrModalIds.forEach(id => { n[id] = 'Pending Approval' })
                  return n
                })
                setSendMgrModalIds([])
                setSendMgrMsg('')
                setSelectedIds(new Set())
                showToast(`${sendMgrModalIds.length} line${sendMgrModalIds.length !== 1 ? 's' : ''} sent for approval.`)
              }}
                className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
                Send for approval
              </button>
              <button onClick={() => { setSendMgrModalIds([]); setSendMgrMsg('') }}
                className="h-9 px-4 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PushToOrderApp modal */}
      {pushModalIds.length > 0 && (() => {
        const firstRec = REORDER_RECOMMENDATIONS.find(r => r.id === pushModalIds[0])
        const today = new Date()
        const wk = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 604800000)
        const defaultCollection = `Reorder Wk ${wk} — ${firstRec?.supplier ?? ''} — ${firstRec?.category ?? ''}`
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px]">
              <div className="text-sm font-bold text-gray-900 mb-1">Push {pushModalIds.length} line{pushModalIds.length !== 1 ? 's' : ''} to Order App</div>
              <div className="text-xs text-gray-400 mb-4">Pre-flight check before pushing to Order App.</div>
              <div className="mb-3">
                <label className="text-xs font-semibold text-gray-600 block mb-1">Collection name</label>
                <input type="text" defaultValue={defaultCollection}
                  className="w-full h-9 rounded-lg border border-gray-200 px-3 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              </div>
              <div className="mb-3">
                <label className="text-xs font-semibold text-gray-600 block mb-1">PO grouping</label>
                <select className="w-full h-9 rounded-lg border border-gray-200 px-3 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white appearance-none">
                  <option>One PO per Style</option>
                  <option>One PO per Style × Colour</option>
                  <option>One PO per SKU</option>
                </select>
              </div>
              <div className="mb-4 space-y-1">
                <div className="text-xs font-semibold text-gray-600 mb-1.5">Validation</div>
                {[
                  { label: 'Supplier active', ok: true },
                  { label: 'Factory active', ok: true },
                  { label: 'Required fields complete', ok: true },
                  { label: 'Cost price warning', ok: false },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className={ok ? 'text-green-600' : 'text-amber-500'}>{ok ? '✓' : '⚠'}</span>
                    <span className={ok ? 'text-gray-700' : 'text-amber-700'}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="mb-4 max-h-32 overflow-y-auto space-y-1">
                {pushModalIds.map(id => {
                  const r = REORDER_RECOMMENDATIONS.find(x => x.id === id)
                  if (!r) return null
                  return (
                    <div key={id} className="flex items-center gap-2 text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0">
                      <img src={r.imageUrl} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
                      <span className="truncate">{r.name}</span>
                      <span className="text-gray-400 shrink-0">{r.sku}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  setStatusOverrides(o => {
                    const n = { ...o }
                    pushModalIds.forEach(id => { n[id] = 'Sent' })
                    return n
                  })
                  setPushModalIds([])
                  setSelectedIds(new Set())
                  showToast(`${pushModalIds.length} line${pushModalIds.length !== 1 ? 's' : ''} pushed to Order App.`)
                }}
                  className="flex-1 h-9 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
                  Push {pushModalIds.length} line{pushModalIds.length !== 1 ? 's' : ''}
                </button>
                <button onClick={() => setPushModalIds([])}
                  className="h-9 px-4 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

// ── Manager Reorder View ───────────────────────────────────────────────────────
type Override = { status: 'Approved' | 'Rejected'; comment: string }
type ManagerFilter = 'All' | 'Pending Approval' | 'Approved' | 'Rejected'

function ManagerReorderView() {
  const [overrides,   setOverrides]   = useState<Record<string, Override>>({})
  const [rejectDraft, setRejectDraft] = useState<Record<string, string>>({})
  const [rejectOpen,  setRejectOpen]  = useState<Record<string, boolean>>({})
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<ManagerFilter>('Pending Approval')
  const [selectedProduct, setSelectedProduct] = useState<typeof REORDER_RECOMMENDATIONS[0] | null>(null)
  const [chartTab, setChartTab] = useState<'stock' | 'availability'>('stock')
  const [timeRange, setTimeRange] = useState<'1m' | '6m' | '1y'>('6m')
  const [editQty, setEditQty] = useState(0)
  const [editExFactory, setEditExFactory] = useState('')
  const [editCostPrice, setEditCostPrice] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mgrToast, setMgrToast] = useState<string | null>(null)
  const [inquiries,     setInquiries]     = useState<Record<string, InquiryThread>>(() => ({ ...SEEDED_THREADS }))
  const [mgrCpRules,   setMgrCpRules]    = useState<CpRulesState>(DEFAULT_CP_RULES)
  const [openInquiryId, setOpenInquiryId] = useState<string | null>(null)
  const [bulkRejectModal, setBulkRejectModal] = useState(false)
  const [bulkRejectComment, setBulkRejectComment] = useState('')
  const [mgrSubView, setMgrSubView] = useState<'recommendations' | 'negotiations'>('recommendations')
  const [lowMarginOnly, setLowMarginOnly] = useState(false)

  const effStatus = (p: typeof REORDER_RECOMMENDATIONS[0]): ApprovalStatus =>
    (overrides[p.id]?.status ?? p.approvalStatus) as ApprovalStatus
  const effComment = (p: typeof REORDER_RECOMMENDATIONS[0]) =>
    overrides[p.id]?.comment ?? p.rejectionReason ?? ''

  const approve = (id: string) =>
    setOverrides(o => ({ ...o, [id]: { status: 'Approved', comment: '' } }))
  const confirmReject = (id: string) => {
    setOverrides(o => ({ ...o, [id]: { status: 'Rejected', comment: rejectDraft[id] ?? '' } }))
    setRejectOpen(o => ({ ...o, [id]: false }))
    const entry = {
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      manager: 'Sarah Chen',
      comment: rejectDraft[id] ?? '',
    }
    _sharedRejectionHistory[id] = [entry, ...(_sharedRejectionHistory[id] ?? [])]
  }
  const undo = (id: string) =>
    setOverrides(o => { const n = { ...o }; delete n[id]; return n })

  const showMgrToast = (msg: string) => {
    setMgrToast(msg)
    setTimeout(() => setMgrToast(null), 4000)
  }

  const handleBulkApprove = () => {
    const eligible = [...selectedIds].filter(id => effStatus(REORDER_RECOMMENDATIONS.find(r => r.id === id)!) === 'Pending Approval')
    const skipped  = selectedIds.size - eligible.length
    setOverrides(o => {
      const n = { ...o }
      eligible.forEach(id => { n[id] = { status: 'Approved', comment: '' } })
      return n
    })
    setSelectedIds(new Set())
    const msg = skipped === 0
      ? `${eligible.length} line${eligible.length !== 1 ? 's' : ''} approved.`
      : `${eligible.length} of ${selectedIds.size} lines approved. ${skipped} skipped (not Pending Approval).`
    showMgrToast(msg)
  }

  const handleBulkReject = () => {
    const eligible = [...selectedIds].filter(id => effStatus(REORDER_RECOMMENDATIONS.find(r => r.id === id)!) === 'Pending Approval')
    setOverrides(o => {
      const n = { ...o }
      eligible.forEach(id => { n[id] = { status: 'Rejected', comment: bulkRejectComment } })
      return n
    })
    setSelectedIds(new Set())
    setBulkRejectModal(false)
    setBulkRejectComment('')
    showMgrToast(`${eligible.length} line${eligible.length !== 1 ? 's' : ''} rejected.`)
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedProduct) {
    const p = selectedProduct
    const status = effStatus(p)
    const comment = effComment(p)
    const ac = APPROVAL_CFG[status]
    const rCls = p.stockoutRisk === 'Low' ? 'bg-green-100 text-green-700' : p.stockoutRisk === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    const qty = editQty > 0 ? editQty : p.recommendedReorderQty
    const exFact = editExFactory || p.exFactoryDate
    const costPr = editCostPrice > 0 ? editCostPrice : p.costPrice
    const editTotalCost = Math.round(qty * costPr)
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          <button onClick={() => setSelectedProduct(null)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            ← Back to Manager View
          </button>

          {/* Manager action bar */}
          <div className={`flex items-center justify-between px-5 py-3 rounded-xl border ${
            status === 'Pending Approval' ? 'bg-amber-50 border-amber-200' :
            status === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ac.bg} ${ac.text} ${ac.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ac.dot}`} />{status}
              </span>
              {status === 'Rejected' && comment && (
                <span className="text-xs text-gray-500 italic">Reason: {comment}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {status === 'Pending Approval' && (
                <>
                  <button onClick={() => { setOverrides(o => ({ ...o, [p.id]: { status: 'Approved', comment: '' } })); setSelectedProduct({ ...p }) }}
                    className="h-8 px-4 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                    Approve
                  </button>
                  <button onClick={() => setRejectOpen(o => ({ ...o, [p.id]: true }))}
                    className="h-8 px-4 text-xs font-semibold rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors">
                    Reject
                  </button>
                </>
              )}
              {(status === 'Approved' || status === 'Rejected') && (
                <button onClick={() => { undo(p.id); setSelectedProduct({ ...p }) }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Undo
                </button>
              )}
            </div>
          </div>

          {/* Inline reject form */}
          {rejectOpen[p.id] && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <div className="text-xs font-semibold text-red-700 mb-2">Reason for rejection</div>
              <textarea rows={2} placeholder="Add a reason (optional)…"
                value={rejectDraft[p.id] ?? ''}
                onChange={e => setRejectDraft(d => ({ ...d, [p.id]: e.target.value }))}
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-red-400 placeholder:text-gray-400 mb-3"
              />
              <div className="flex items-center gap-2">
                <button onClick={() => { confirmReject(p.id); setSelectedProduct({ ...p }) }}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                  Confirm Rejection
                </button>
                <button onClick={() => setRejectOpen(o => ({ ...o, [p.id]: false }))}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Resubmission context — shown when merchandiser resubmitted a rejected PO */}
          {_sharedResubmits.has(p.id) && status === 'Pending Approval' && (() => {
            const meta = REJECTION_META[p.id]
            const originalReason = p.rejectionReason
            return (
              <details className="bg-amber-50 border border-amber-200 rounded-xl">
                <summary className="flex items-center gap-2 px-5 py-3 cursor-pointer list-none">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-amber-800">Resubmission — see previous rejection and what changed</span>
                  <span className="ml-auto text-[10px] text-amber-600">▾ expand</span>
                </summary>
                <div className="px-5 pb-4 space-y-2 border-t border-amber-200 pt-3">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Previous rejection</div>
                  <div className="bg-white rounded-lg border border-red-100 px-3 py-2 text-xs">
                    <span className="font-semibold text-red-700">
                      Rejected{meta ? ` by ${meta.manager}, ${meta.date}` : ''}
                    </span>
                    {originalReason && <div className="text-gray-500 italic mt-0.5">"{originalReason}"</div>}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-2">Merchandiser response</div>
                  <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-700">
                    Resubmitted by Emma (Merchandiser) — see editable fields below for current values.
                  </div>
                </div>
              </details>
            )
          })()}

          {/* Freight override notice (if buyer overrode the recommended freight) */}
          {p.freightChoice && p.freightChoice !== p.recommendedFreight && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-start gap-3">
              <span className="text-amber-500 text-base mt-0.5">⚑</span>
              <div>
                <div className="text-xs font-semibold text-amber-800 mb-0.5">
                  Buyer freight override: <span className="line-through text-gray-400">{p.recommendedFreight}</span> → <span className="font-bold">{p.freightChoice}</span>
                </div>
                {p.freightOverrideReason && (
                  <div className="text-xs text-amber-700 italic">"{p.freightOverrideReason}"</div>
                )}
              </div>
            </div>
          )}

          {/* Top card */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-start gap-5">
            <img src={p.imageUrl} className="w-20 h-20 rounded-lg object-cover shrink-0" alt={p.name} />
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-400 mb-2">{p.sku} · {p.category}</div>
              <div className="flex gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${rCls}`}>
                  {p.stockoutRisk} Risk
                </span>
              </div>
            </div>
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="h-px flex-1 bg-indigo-100" />
                <span className="text-[9px] font-semibold text-indigo-500 tracking-wide uppercase">Editable</span>
                <div className="h-px flex-1 bg-indigo-100" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <input type="number" value={editQty > 0 ? editQty : p.recommendedReorderQty}
                    onChange={e => setEditQty(Number(e.target.value))}
                    className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-full text-center" />
                  <div className="text-[10px] text-gray-400 mt-0.5">Order Qty</div>
                  <div className="text-[9px] text-indigo-400 mt-0.5">updates next Monday</div>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <div className="flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-900 mr-0.5">£</span>
                    <input type="number" step="0.01" value={editCostPrice > 0 ? editCostPrice : p.costPrice}
                      onChange={e => setEditCostPrice(Number(e.target.value))}
                      className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-16 text-center" />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Cost Price</div>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <input type="date" value={exFact} onChange={e => setEditExFactory(e.target.value)}
                    className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-full text-center" />
                  <div className="text-[10px] text-gray-400 mt-0.5">Ex-Factory</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <div className="text-xs font-bold text-gray-900">£{editTotalCost.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Total Cost</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <div className="text-xs font-bold text-gray-900">{p.receiptDate}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Receipt Date</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <div className="text-xs font-bold text-gray-900">£{p.sellingPrice.toFixed(2)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Selling Price</div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          {(() => {
            const gm = getMarginForWindow(p.marginPct, p.id, timeRange)
            const gmBorderCls = gm > 25 ? 'border-l-green-400' : gm >= 10 ? 'border-l-amber-400' : 'border-l-red-400'
            const gmTextCls   = gm > 25 ? 'text-green-700'    : gm >= 10 ? 'text-amber-700'    : 'text-red-700'
            return (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Stock Value',     value: `£${p.stockValue.toLocaleString()}`, pop: '↓ -3.2% vs last month', popCls: 'text-red-400' },
              { label: 'Weeks of Stock',  value: `${p.weeksOfStock.toFixed(1)}w`,     pop: '↑ +0.4w vs last week',  popCls: 'text-green-600' },
              { label: 'Monthly Revenue', value: `£${(p.monthlyRevenue / 1000).toFixed(1)}k`, pop: '↑ +7.1% vs last month', popCls: 'text-green-600' },
              { label: 'Stockout Risk',   value: p.stockoutRisk, badge: rCls },
            ].map(({ label, value, badge, pop, popCls }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm text-center">
                {badge
                  ? <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${badge}`}>{value}</span>
                  : <div className="text-lg font-bold text-gray-900">{value}</div>
                }
                <div className="text-[10px] text-gray-400 mt-1">{label}</div>
                {pop && <div className={`text-[9px] mt-0.5 ${popCls}`}>{pop}</div>}
              </div>
            ))}
            <div className={`bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm text-center border-l-4 ${gmBorderCls}`}>
              <div className={`text-lg font-bold ${gmTextCls}`}>{gm}%</div>
              <div className="text-[10px] text-gray-400 mt-1">Gross Margin</div>
              <div className="text-[9px] text-gray-400 mt-0.5">{timeRange === '1m' ? 'Last 4 wks' : timeRange === '6m' ? 'Last 6 mo' : 'Last 12 mo'}</div>
            </div>
          </div>
            )
          })()}

          {/* Two panels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-800 mb-3">Stock Management</div>
              {[
                { label: 'Available',    value: `${p.available.toLocaleString()} units` },
                { label: 'On Order',     value: `${p.onOrder.toLocaleString()} units` },
                { label: 'Safety Stock', value: `${p.safetyStock.toLocaleString()} units` },
                { label: 'Min Level',    value: `${p.minLevel.toLocaleString()} units` },
                { label: 'Max Level',    value: `${p.maxLevel.toLocaleString()} units` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-800 mb-3">Order Constraints</div>
              {[
                { label: 'Order Frequency', value: p.orderFrequency },
                { label: 'Lead Time',       value: p.leadTime },
                { label: 'Min Order Qty',   value: p.minOrderQty.toLocaleString() },
                { label: 'Pack Size',       value: p.packSize.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-gray-800">Monitor your stock levels including on order stock</span>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-auto gap-0.5">
                {(['stock', 'availability'] as const).map(t => (
                  <button key={t} onClick={() => setChartTab(t)}
                    className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${chartTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {t === 'stock' ? 'Stock levels' : 'Availability'}
                  </button>
                ))}
              </div>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {(['1m', '6m', '1y'] as const).map(r => (
                  <button key={r} onClick={() => setTimeRange(r)}
                    className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${timeRange === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {r === '1m' ? 'One Month' : r === '6m' ? 'Six Months' : 'One Year'}
                  </button>
                ))}
              </div>
            </div>
            {chartTab === 'stock' && <StockLevelsChart productId={p.id} timeRange={timeRange} />}
            {chartTab === 'availability' && <p className="text-sm text-gray-400 mt-4">Coming soon</p>}
          </div>
        </div>
      </div>
    )
  }

  const counts: Record<ManagerFilter, number> = {
    'All':              REORDER_RECOMMENDATIONS.length,
    'Pending Approval': REORDER_RECOMMENDATIONS.filter(p => effStatus(p) === 'Pending Approval').length,
    'Approved':         REORDER_RECOMMENDATIONS.filter(p => effStatus(p) === 'Approved').length,
    'Rejected':         REORDER_RECOMMENDATIONS.filter(p => effStatus(p) === 'Rejected').length,
  }

  const rows = REORDER_RECOMMENDATIONS.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || effStatus(p) === filter
    const matchMargin = !lowMarginOnly || Math.round((p.sellingPrice - p.costPrice) / p.sellingPrice * 100) < 10
    return matchSearch && matchFilter && matchMargin
  })

  const pendingEligible = [...selectedIds].filter(id => effStatus(REORDER_RECOMMENDATIONS.find(r => r.id === id)!) === 'Pending Approval').length
  const mgrAllSelected  = rows.length > 0 && rows.every(r => selectedIds.has(r.id))
  const mgrSomeSelected = rows.some(r => selectedIds.has(r.id))

  const FILTER_TABS: ManagerFilter[] = ['All', 'Pending Approval', 'Approved', 'Rejected']
  const filterCfg: Record<ManagerFilter, { bg: string; text: string }> = {
    'All':              { bg: 'bg-gray-100',   text: 'text-gray-600' },
    'Pending Approval': { bg: 'bg-amber-100',  text: 'text-amber-700' },
    'Approved':         { bg: 'bg-green-100',  text: 'text-green-700' },
    'Rejected':         { bg: 'bg-red-100',    text: 'text-red-700' },
  }
  const totalReorderValue = REORDER_RECOMMENDATIONS.reduce((s, r) => s + r.totalCost, 0)
  const livePos = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Approved').length
  const uniqueSuppliers = new Set(REORDER_RECOMMENDATIONS.map(r => r.supplier)).size
  const avgLeadDays = Math.round(
    REORDER_RECOMMENDATIONS.reduce((s, r) => s + parseInt(r.leadTime), 0) / REORDER_RECOMMENDATIONS.length
  )
  const mvDraft    = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Draft').length
  const mvPending  = counts['Pending Approval']
  const mvApproved = counts['Approved']
  const mvRejected = counts['Rejected']
  const mvSent     = REORDER_RECOMMENDATIONS.filter(r => effStatus(r) === 'Sent').length
  const mvTotal    = REORDER_RECOMMENDATIONS.length
  const mvPct      = (n: number) => `${Math.round(n / mvTotal * 100)}%`

  const mgrActiveNegRows = REORDER_RECOMMENDATIONS.filter(p => {
    const t = inquiries[p.id]
    return t && !['idle', 'draft'].includes(t.status) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  })
  const mgrNegNeedsResponse = mgrActiveNegRows.filter(p => ['replied', 'escalated'].includes(inquiries[p.id]?.status ?? ''))
  const mgrNegAwaiting      = mgrActiveNegRows.filter(p => ['sent', 'awaiting_reply'].includes(inquiries[p.id]?.status ?? ''))
  const mgrNegReady         = mgrActiveNegRows.filter(p => inquiries[p.id]?.status === 'agreed')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">

        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-4 mb-5">
          {/* Status breakdown */}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
            <div className="text-xl font-bold text-gray-900">{mvTotal} <span className="text-sm font-normal text-gray-400">Recommendations</span></div>
            <div className="mt-2 flex h-2 rounded-full overflow-hidden gap-px">
              {mvDraft    > 0 && <div className="bg-gray-300"    style={{ width: mvPct(mvDraft)    }} />}
              {mvPending  > 0 && <div className="bg-amber-400"   style={{ width: mvPct(mvPending)  }} />}
              {mvApproved > 0 && <div className="bg-emerald-500" style={{ width: mvPct(mvApproved) }} />}
              {mvSent     > 0 && <div className="bg-indigo-400"  style={{ width: mvPct(mvSent)     }} />}
              {mvRejected > 0 && <div className="bg-red-400 flex-1" />}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-gray-500">
              {mvDraft    > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />Draft: {mvDraft}</span>}
              {mvPending  > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Pending: {mvPending}</span>}
              {mvApproved > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Approved: {mvApproved}</span>}
              {mvSent     > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />Sent: {mvSent}</span>}
              {mvRejected > 0 && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Rejected: {mvRejected}</span>}
            </div>
          </div>
          {[
            { label: 'Total Reorder Value',  value: fmtGBP(totalReorderValue), sub: `${mvTotal} orders pending`, pop: '↑ +12% vs last month', popCls: 'text-green-600' },
            { label: 'Live Purchase Orders', value: `${livePos}`,           sub: 'approved this week', pop: '↑ +2 vs last week', popCls: 'text-green-600' },
            { label: 'Total Suppliers',      value: `${uniqueSuppliers}`,   sub: 'across all recs' },
            { label: 'Avg Lead Time',        value: `${avgLeadDays} days`,  sub: 'across all recs' },
          ].map(({ label, value, sub, pop, popCls }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              <div className="text-[10px] text-gray-400 mt-1">{sub}</div>
              {pop && <div className={`text-[10px] font-semibold mt-0.5 ${popCls}`}>{pop}</div>}
            </div>
          ))}
        </div>

        {/* Segmented control */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 mb-5 w-fit gap-0.5">
          {(['recommendations', 'negotiations'] as const).map(sv => (
            <button key={sv} onClick={() => setMgrSubView(sv)}
              className={`h-8 px-5 rounded-lg text-xs font-semibold transition-colors ${
                mgrSubView === sv ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {sv === 'recommendations' ? 'Recommendations' : `Active Negotiations${mgrActiveNegRows.length > 0 ? ` (${mgrActiveNegRows.length})` : ''}`}
            </button>
          ))}
        </div>

        {mgrSubView === 'recommendations' && (<>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-base font-bold text-gray-900">Manager Review</div>
            <div className="text-xs text-gray-400 mt-0.5">Review and action reorder recommendations submitted for approval</div>
          </div>
          <div className="flex items-center gap-2">
            {(['Pending Approval', 'Approved', 'Rejected'] as const).map(s => (
              <span key={s} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${filterCfg[s].bg} ${filterCfg[s].text}`}>
                {s === 'Pending Approval' ? 'Pending' : s}: {counts[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            {FILTER_TABS.map(f => {
              const active = filter === f
              const cfg = filterCfg[f]
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold transition-colors ${
                    active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {f}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? `${cfg.bg} ${cfg.text}` : 'bg-gray-200 text-gray-500'}`}>
                    {counts[f]}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setLowMarginOnly(v => !v)}
            className={`h-8 px-3 text-xs font-semibold rounded-full border transition-colors ${
              lowMarginOnly ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}>
            ↓ Low margin
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="pl-8 h-9 w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Search product or SKU…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="ml-auto text-xs text-gray-400">{rows.length} shown</span>
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
            <span className="text-xs font-semibold text-amber-700">{selectedIds.size} line{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <div className="flex-1" />
            <button
              disabled={pendingEligible === 0}
              onClick={handleBulkApprove}
              className="h-8 px-4 rounded-lg text-xs font-semibold bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
            >
              Approve ({pendingEligible})
            </button>
            <button
              disabled={pendingEligible === 0}
              onClick={() => setBulkRejectModal(true)}
              className="h-8 px-4 rounded-lg text-xs font-semibold border border-red-300 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-50 transition-colors"
            >
              Reject ({pendingEligible})
            </button>
          </div>
        )}

        {/* Table — scrollable, frozen cols left + actions right, matching ReorderView columns */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
          <table className="text-xs" style={{ minWidth: 1600 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="sticky z-20 bg-gray-50 px-3 py-3 border-r border-gray-100" style={{ left: 0, width: 40, minWidth: 40 }}>
                  <input type="checkbox" className="rounded"
                    checked={mgrAllSelected}
                    ref={el => { if (el) el.indeterminate = mgrSomeSelected && !mgrAllSelected }}
                    onChange={e => {
                      if (e.target.checked) setSelectedIds(new Set([...selectedIds, ...rows.map(r => r.id)]))
                      else setSelectedIds(s => { const n = new Set(s); rows.forEach(r => n.delete(r.id)); return n })
                    }}
                  />
                </th>
                <th className="sticky z-20 bg-gray-50 text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap" style={{ left: 40, minWidth: 196 }}>Product</th>
                <th className="sticky z-20 bg-gray-50 text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap" style={{ left: 236, minWidth: 104 }}>Category</th>
                <th className="sticky z-20 bg-indigo-50 text-right px-3 py-3 font-bold text-indigo-700 whitespace-nowrap border-l border-indigo-100" style={{ left: 340, minWidth: 100 }}>Reorder qty</th>
                <th className="sticky z-20 bg-indigo-50 text-right px-3 py-3 font-bold text-indigo-700 whitespace-nowrap border-x border-indigo-100" style={{ left: 440, minWidth: 130, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>Total reorder cost</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Freight</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Selling Price</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Cost Price</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Gross Margin</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Revenue this week<br/><span className="font-normal text-gray-400">% WoW</span></th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Sales this week<br/><span className="font-normal text-gray-400">% WoW</span></th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Available stock</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">On order stock</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Avail. cover</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Target levels</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Min order qty</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Lead time</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Availability<br/><span className="font-normal text-gray-400">Target</span></th>
                <th className="px-3 py-3 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100">Size breakdown</th>
                <th className="sticky right-0 z-20 bg-gray-50 px-3 py-3 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100" style={{ minWidth: 186, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const status  = effStatus(p)
                const comment = effComment(p)
                const isOpen  = !!rejectOpen[p.id]
                const ac = APPROVAL_CFG[status]
                const seed = p.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                const revWow = ((seed * 11 + i * 7) % 20) - 8
                const salesWow = ((seed * 9 + i * 5) % 20) - 8
                const grossMargin = Math.round((p.sellingPrice - p.costPrice) / p.sellingPrice * 100)
                const weeklyRevenue = Math.round(p.weeklySales * p.sellingPrice)
                const availPct = 95 + (seed % 5)
                const fmtK = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : `${v}`
                const curFr = p.freightChoice ?? p.recommendedFreight
                const stickyBg = i % 2 !== 0 ? '#f9fafb' : '#ffffff'
                return (
                  <>
                    <tr key={p.id}
                      onClick={() => { setEditQty(0); setEditExFactory(''); setEditCostPrice(0); setSelectedProduct(p) }}
                      className={`border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition-colors ${i % 2 !== 0 ? 'bg-gray-50/20' : ''} ${isOpen ? 'bg-red-50/30' : ''}`}>
                      {/* Checkbox */}
                      <td className="sticky z-10 px-3 py-2 border-r border-gray-100" style={{ left: 0, backgroundColor: stickyBg }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded"
                          checked={selectedIds.has(p.id)}
                          onChange={e => setSelectedIds(s => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n })}
                        />
                      </td>
                      {/* Product */}
                      <td className="sticky z-10 px-3 py-2" style={{ left: 40, backgroundColor: stickyBg }}>
                        <div className="flex items-center gap-2">
                          <img src={p.imageUrl} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-gray-900 whitespace-nowrap">{p.name}</span>
                              {_sharedResubmits.has(p.id) && status === 'Pending Approval' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">Resubmitted</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      {/* Category */}
                      <td className="sticky z-10 px-3 py-2 text-gray-600 whitespace-nowrap" style={{ left: 236, backgroundColor: stickyBg }}>{p.category}</td>
                      {/* Reorder qty */}
                      <td className="sticky z-10 px-3 py-2 text-right font-bold text-indigo-700 text-sm" style={{ left: 340, backgroundColor: stickyBg }}>
                        {p.recommendedReorderQty.toLocaleString()}
                      </td>
                      {/* Total reorder cost */}
                      <td className="sticky z-10 px-3 py-2 text-right font-bold text-indigo-700 text-sm" style={{ left: 440, backgroundColor: stickyBg, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                        £{p.totalCost.toLocaleString()}
                      </td>
                      {/* Freight */}
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                          curFr === 'Air' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          <span>{curFr === 'Air' ? '✈️' : '🚢'}</span><span>{curFr}</span>
                          {p.freightChoice && p.freightChoice !== p.recommendedFreight && <span className="ml-0.5 text-amber-500" title="Buyer override">⚑</span>}
                        </span>
                      </td>
                      {/* Selling Price */}
                      <td className="px-3 py-2 text-right text-gray-700">£{p.sellingPrice.toFixed(2)}</td>
                      {/* Cost Price */}
                      <td className="px-3 py-2 text-right text-gray-700">£{p.costPrice.toFixed(2)}</td>
                      {/* Gross Margin */}
                      <td className={`px-3 py-2 text-right font-semibold ${
                        grossMargin > 25 ? 'text-green-700' : grossMargin >= 10 ? 'text-amber-700' : 'text-red-600'
                      }`}>{grossMargin}%</td>
                      {/* Revenue */}
                      <td className="px-3 py-2 text-right">
                        <div className="text-gray-700">£{weeklyRevenue.toLocaleString()}</div>
                        <div className={`text-[10px] font-semibold ${revWow >= 0 ? 'text-green-600' : 'text-red-500'}`}>{revWow >= 0 ? '+' : ''}{revWow}%</div>
                      </td>
                      {/* Sales */}
                      <td className="px-3 py-2 text-right">
                        <div className="text-gray-700">{p.weeklySales}</div>
                        <div className={`text-[10px] font-semibold ${salesWow >= 0 ? 'text-green-600' : 'text-red-500'}`}>{salesWow >= 0 ? '+' : ''}{salesWow}%</div>
                      </td>
                      {/* Available */}
                      <td className="px-3 py-2 text-right text-gray-700">{p.available.toLocaleString()}</td>
                      {/* On order */}
                      <td className="px-3 py-2 text-right text-gray-700">{p.onOrder.toLocaleString()}</td>
                      {/* Avail. cover */}
                      <td className="px-3 py-2 text-right">
                        <span className="font-bold text-amber-600">{p.weeksOfStock.toFixed(1)}</span>
                      </td>
                      {/* Target levels */}
                      <td className="px-3 py-2 text-right text-gray-700">{fmtK(p.minLevel)}–{fmtK(p.maxLevel)}</td>
                      {/* Min order qty */}
                      <td className="px-3 py-2 text-right text-gray-700">{p.minOrderQty.toLocaleString()}</td>
                      {/* Lead time */}
                      <td className="px-3 py-2 text-right text-gray-700">{p.leadTime}</td>
                      {/* Availability */}
                      <td className="px-3 py-2 text-right">
                        <div className="font-semibold text-gray-900">{availPct}%</div>
                        <div className="text-[10px] text-gray-400">97.5%</div>
                      </td>
                      {/* Size breakdown */}
                      <td className="px-3 py-2 border-l border-gray-100">
                        <SizeBar bands={p.sizeBreakdown} />
                      </td>
                      {/* Actions */}
                      <td className="sticky right-0 z-10 px-3 py-2 border-l border-gray-100" style={{ backgroundColor: stickyBg, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }} onClick={e => e.stopPropagation()}>
                        <div className="space-y-1.5">
                          {status === 'Pending Approval' && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => approve(p.id)} className="h-7 px-3 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Approve</button>
                              <button onClick={() => setRejectOpen(o => ({ ...o, [p.id]: true }))} className="h-7 px-3 text-xs font-semibold rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors">Reject</button>
                            </div>
                          )}
                          {status === 'Approved' && (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ac.bg} ${ac.text} ${ac.border}`}><span className={`w-1.5 h-1.5 rounded-full ${ac.dot}`} />{status}</span>
                              <button onClick={() => undo(p.id)} className="text-[10px] text-gray-400 hover:text-gray-600 underline">Undo</button>
                            </div>
                          )}
                          {status === 'Rejected' && (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ac.bg} ${ac.text} ${ac.border}`}><span className={`w-1.5 h-1.5 rounded-full ${ac.dot}`} />{status}</span>
                                <button onClick={() => undo(p.id)} className="text-[10px] text-gray-400 hover:text-gray-600 underline">Undo</button>
                              </div>
                              {comment && <div className="text-[10px] text-gray-400 italic mt-0.5 max-w-[160px] truncate">Reason: {comment.slice(0, 60)}{comment.length > 60 ? '…' : ''}</div>}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setOpenInquiryId(p.id)}
                              className="h-6 px-2 text-[10px] font-medium rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1"
                              title="Send supplier inquiry"
                            >
                              <Mail className="w-2.5 h-2.5" />Inquire
                            </button>
                            {inquiries[p.id] && inquiries[p.id].status !== 'idle' && (() => {
                              const t = inquiries[p.id]
                              const nsCfg = NEG_STATUS_CFG[t.status]
                              let label = nsCfg.label
                              let bg = nsCfg.bg, text = nsCfg.text, border = nsCfg.border, dot = nsCfg.dot
                              if (t.status === 'replied') {
                                const rn = t.rounds.length
                                if (t.scenario === 'counter') {
                                  label = `Negotiating · Rd ${rn}`
                                  bg = 'bg-amber-50'; text = 'text-amber-700'; border = 'border-amber-200'; dot = 'bg-amber-400'
                                } else if (t.scenario === 'accepted') {
                                  label = 'Reply rcvd · apply to PO'
                                  bg = 'bg-green-50'; text = 'text-green-700'; border = 'border-green-200'; dot = 'bg-green-500'
                                }
                              }
                              return (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${bg} ${text} ${border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
                                </span>
                              )
                            })()}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Inline reject form */}
                    {isOpen && (
                      <tr key={`${p.id}-reject`} className="border-b border-red-100">
                        <td colSpan={20} className="px-4 py-3 bg-red-50">
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-red-700 mb-1.5">Reason for rejection</div>
                              <textarea
                                rows={2}
                                placeholder="Add a reason (optional)…"
                                value={rejectDraft[p.id] ?? ''}
                                onChange={e => setRejectDraft(d => ({ ...d, [p.id]: e.target.value }))}
                                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-red-400 placeholder:text-gray-400"
                              />
                            </div>
                            <div className="flex items-center gap-2 mt-6 shrink-0">
                              <button
                                onClick={() => confirmReject(p.id)}
                                className="h-8 px-4 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                                Confirm Rejection
                              </button>
                              <button
                                onClick={() => setRejectOpen(o => ({ ...o, [p.id]: false }))}
                                className="h-8 px-3 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
        </>)}

        {mgrSubView === 'negotiations' && (
          <ActiveNegotiationsView
            negNeedsResponse={mgrNegNeedsResponse}
            negAwaiting={mgrNegAwaiting}
            negReady={mgrNegReady}
            inquiries={inquiries}
            onOpenInquiry={id => setOpenInquiryId(id)}
            cpRules={mgrCpRules}
            onUpdateCpRules={setMgrCpRules}
          />
        )}
      </div>
      {openInquiryId && (() => {
        const rec = REORDER_RECOMMENDATIONS.find(r => r.id === openInquiryId)
        if (!rec) return null
        return (
          <InquiryDrawer
            rec={rec}
            thread={inquiries[openInquiryId]}
            onClose={() => setOpenInquiryId(null)}
            onUpdate={t => setInquiries(prev => ({ ...prev, [t.recId]: t }))}
            isManager={true}
            globalCpRules={mgrCpRules}
            onApprove={() => {
              approve(rec.id)
              setOpenInquiryId(null)
              showMgrToast(`${rec.name} approved.`)
            }}
            onReject={() => {
              setRejectOpen(o => ({ ...o, [rec.id]: true }))
              setOpenInquiryId(null)
            }}
          />
        )
      })()}

      {/* Bulk reject modal */}
      {bulkRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[420px]">
            <div className="text-sm font-bold text-gray-900 mb-1">Reject selected lines</div>
            <div className="text-xs text-gray-400 mb-4">Add an optional reason for rejection.</div>
            <textarea rows={3} placeholder="Reason for rejection (optional)…"
              value={bulkRejectComment}
              onChange={e => setBulkRejectComment(e.target.value)}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-red-400 mb-4 placeholder:text-gray-400" />
            <div className="flex gap-2">
              <button onClick={handleBulkReject}
                className="flex-1 h-9 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors">
                Confirm rejection
              </button>
              <button onClick={() => { setBulkRejectModal(false); setBulkRejectComment('') }}
                className="h-9 px-4 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {mgrToast && <Toast message={mgrToast} onDone={() => setMgrToast(null)} />}
    </div>
  )
}
// ── Kanban Panel ─────────────────────────────────────────────────────────────
// ── PO Detail Pane ────────────────────────────────────────────────────────────
function PODetailPane({
  po, onAddEvent, fromActionDrawer = false, showHeader = true, onClose,
}: {
  po:               PO
  onAddEvent?:      (poId: string, event: POEvent) => void
  fromActionDrawer?: boolean
  showHeader?:      boolean
  onClose?:         () => void
}) {
  const rag       = computeRAG(po)
  const rc        = RAG_CFG[rag]
  const sup       = getSupplier(po.supplierId)
  const xfDate    = getXFactoryDate(po)
  const isPostDsp = ['In Transit', 'Partially Delivered'].includes(po.status)
  const isDelivered = po.status === 'Delivered'
  const today     = new Date()
  const delivDate = new Date(po.revisedDelivery ?? po.expectedDelivery)
  const isDeliveryOverdue = delivDate < today && !isDelivered

  const product      = getLinkedProduct(po.id)
  const openPOs      = product ? ALL_POS.filter(p => PO_PRODUCT_MAP[p.id] === PO_PRODUCT_MAP[po.id] && p.status !== 'Delivered') : []
  const totalOnOrder = openPOs.reduce((s, p) => s + p.quantity, 0)
  void totalOnOrder

  const [productOpen, setProductOpen] = useState(false)
  const [noteText, setNoteText] = useState('')

  const timeline = [
    { label: 'Order created', date: po.createdOn ? new Date(po.createdOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', done: true, overdue: false },
    { label: 'Ex-factory',    date: xfDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), done: xfDate < today, overdue: xfDate < today && !isPostDsp && !isDelivered },
    { label: 'Dispatched',    date: isPostDsp || isDelivered ? 'Confirmed' : 'Pending', done: isPostDsp || isDelivered, overdue: xfDate < today && !isPostDsp && !isDelivered },
    { label: po.revisedDelivery ? 'Revised delivery' : 'Expected delivery', date: formatDate(po.revisedDelivery ?? po.expectedDelivery), done: isDelivered, overdue: isDeliveryOverdue },
  ]

  return (
    <>
      {/* Header */}
      {showHeader && (
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">{po.id}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${rc.bg} ${rc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />{rc.label}
              </span>
              {po.priority && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold"><Star className="w-2.5 h-2.5" fill="currentColor" />KEY</span>}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{po.product} · {sup?.name ?? po.supplierId}</div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Reference banner — only when not from action drawer */}
        {!fromActionDrawer && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-200">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-[11px] text-gray-500">Reference view — actions are managed in the <strong className="text-gray-700">Actions tab</strong></span>
          </div>
        )}

        {/* Key facts */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Ex-factory', value: xfDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), sub: isPostDsp ? 'Dispatched' : xfDate < today ? 'Overdue' : 'Upcoming' },
            { label: po.revisedDelivery ? 'Revised delivery' : 'Expected delivery', value: formatDate(po.revisedDelivery ?? po.expectedDelivery), sub: po.revisedDelivery ? formatDate(po.expectedDelivery) : null },
            { label: 'Order value', value: po.orderValue, sub: `${po.freight} freight` },
            { label: 'Quantity', value: po.quantity.toLocaleString(), sub: `${po.skus} SKU${po.skus !== 1 ? 's' : ''}` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
              <div className="text-[10px] text-gray-400 mb-1 leading-tight">{label}</div>
              <div className="text-xs font-bold text-gray-900 leading-tight">{value}</div>
              {sub && <div className="text-[9px] text-gray-400 mt-0.5">{sub}</div>}
            </div>
          ))}
        </div>

        {/* PO lifecycle timeline */}
        <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">PO lifecycle</div>
          <div className="space-y-0">
            {timeline.map((step, i) => (
              <div key={step.label} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${step.overdue ? 'bg-red-500' : step.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                    {step.done && !step.overdue ? <Check className="w-3 h-3 text-white" /> : step.overdue ? <AlertTriangle className="w-3 h-3 text-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                  </div>
                  {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 min-h-[20px] my-1" />}
                </div>
                <div className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold ${step.overdue ? 'text-red-600' : step.done ? 'text-gray-700' : 'text-gray-400'}`}>{step.label}</span>
                    {step.overdue && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Overdue</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{step.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product & stock context — collapsible */}
        {product && (
          <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => setProductOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
              <span className="text-[11px] font-semibold text-gray-700">Product &amp; stock context</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${productOpen ? 'rotate-180' : ''}`} />
            </button>
            {productOpen && (
              <div className="px-4 py-3 space-y-4 bg-white">
                {/* Identity */}
                <div className="flex items-center gap-3">
                  <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-gray-200" />
                  <div>
                    <div className="text-xs font-bold text-gray-900">{product.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{product.sku} · {product.supplier}</div>
                    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 ${product.stockoutRisk === 'High' ? 'bg-red-100 text-red-700' : product.stockoutRisk === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{product.stockoutRisk} stockout risk</span>
                  </div>
                </div>
                {/* Stock metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { val: product.currentStock.toLocaleString(), label: 'Current stock' },
                    { val: `${product.weeksOfStock.toFixed(1)}w`, label: 'Weeks cover' },
                    { val: product.weeklySales.toLocaleString(), label: 'Weekly sales' },
                  ].map(({ val, label }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                      <div className="text-sm font-bold text-gray-900">{val}</div>
                      <div className="text-[10px] text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
                {/* Stock bar */}
                <div className="h-2 rounded-full bg-gray-100 relative overflow-hidden">
                  <div className={`absolute left-0 top-0 h-full rounded-full ${product.stockoutRisk === 'High' ? 'bg-red-400' : product.stockoutRisk === 'Medium' ? 'bg-amber-400' : 'bg-indigo-400'}`} style={{ width: `${Math.min(100, product.currentStock / product.maxLevel * 100)}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-amber-500 z-10" style={{ left: `${Math.min(100, product.safetyStock / product.maxLevel * 100)}%` }} />
                </div>
                {/* Commercial */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { val: `£${product.costPrice.toFixed(2)}`, label: 'Cost price' },
                    { val: `£${product.sellingPrice.toFixed(2)}`, label: 'Selling price' },
                    { val: `${(product.marginPct * 100).toFixed(0)}%`, label: 'Gross margin' },
                  ].map(({ val, label }) => (
                    <div key={label} className="text-center">
                      <div className="text-xs font-bold text-gray-900">{val}</div>
                      <div className="text-[10px] text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
                {/* Open order book */}
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Open orders — this SKU</div>
                  <div className="space-y-0.5">
                    {openPOs.map(p => {
                      const pRag = computeRAG(p)
                      return (
                        <div key={p.id} className={`flex items-center gap-2 text-[10px] py-1.5 px-2 rounded-lg ${p.id === po.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pRag === 'red' ? 'bg-red-500' : pRag === 'amber' ? 'bg-amber-400' : 'bg-green-400'}`} />
                          <span className="font-mono">{p.id}</span>
                          <span className="flex-1 truncate opacity-70">{getSupplier(p.supplierId)?.name}</span>
                          <span>{p.quantity.toLocaleString()} units</span>
                          {p.id === po.id && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded font-bold">this PO</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom affordances */}
        <div className="space-y-2 pt-1">
          {onAddEvent && (
            <div className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Add note</div>
              <div className="flex gap-2">
                <textarea className="flex-1 text-[11px] text-gray-700 p-2.5 rounded-lg border border-gray-200 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-200" rows={2} placeholder="Log a call, update, or observation…" value={noteText} onChange={e => setNoteText(e.target.value)} />
                <button onClick={() => { if (!noteText.trim()) return; onAddEvent(po.id, { id: `note-${Date.now()}`, type: 'manual_note', timestamp: new Date().toISOString(), body: noteText.trim(), author: 'buyer' }); setNoteText('') }} disabled={!noteText.trim()} className="self-end h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <button className="w-full h-8 rounded-lg border border-gray-200 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />View in Reorder app
          </button>
        </div>

      </div>
    </>
  )
}

// ── PO Line Drawer ────────────────────────────────────────────────────────────
function POLineDrawer({
  po, onClose, onAddEvent,
}: {
  po:         PO
  onClose:    () => void
  onAddEvent?: (poId: string, event: POEvent) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[540px] bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        <PODetailPane po={po} onAddEvent={onAddEvent} showHeader fromActionDrawer={false} onClose={onClose} />
      </div>
    </div>
  )
}

// ── Chase Scheduler ───────────────────────────────────────────────────────────
export function ChaseScheduler({
  onAddEvent, onUpdateLastChased,
}: {
  onAddEvent:         (poId: string, event: POEvent) => void
  onUpdateLastChased: (poId: string, date: string) => void
}) {
  const today = new Date()

  type SupplierGroup = { supplierId: string; name: string; pos: PO[] }

  const chaseGroups: Array<{ type: ChaseType; label: string; dot: string; desc: string; pos: PO[] }> = ([
    {
      type: 'booking_in' as ChaseType, dot: 'bg-indigo-400',
      label: 'Booking-in confirmation',
      desc:  'Sea freight lines within 14 days of x-factory — booking reference required',
      pos: ALL_POS.filter(po => {
        const daysToXF = Math.ceil((getXFactoryDate(po).getTime() - today.getTime()) / 86400000)
        return po.freight === 'Sea' && daysToXF >= 0 && daysToXF <= 14 && !['In Transit','Partially Delivered','Delivered'].includes(po.status)
      }),
    },
    {
      type: 'handover' as ChaseType, dot: 'bg-red-500',
      label: 'Handover / dispatch chase',
      desc:  'Past x-factory with no dispatch confirmation received',
      pos: ALL_POS.filter(po => {
        const xf = getXFactoryDate(po)
        return xf < today && !['In Transit','Partially Delivered','Delivered'].includes(po.status)
      }),
    },
    {
      type: 'cpr' as ChaseType, dot: 'bg-amber-400',
      label: 'CPR negotiation',
      desc:  'Delayed POs — commercial price reduction discussion required',
      pos: ALL_POS.filter(po => ['Ex-factory delay','Date change required'].includes(po.status)),
    },
  ] as Array<{ type: ChaseType; label: string; dot: string; desc: string; pos: PO[] }>).filter(g => g.pos.length > 0)

  const [draftBodies,  setDraftBodies]  = useState<Record<string, string>>({})
  const [activeDraft,  setActiveDraft]  = useState<string | null>(null)
  const [sentKeys,     setSentKeys]     = useState<Set<string>>(new Set())
  const [sendingKey,   setSendingKey]   = useState<string | null>(null)

  const dk = (type: ChaseType, sid: string) => `${type}:${sid}`

  const toSupplierGroups = (pos: PO[]): SupplierGroup[] =>
    Object.values(pos.reduce<Record<string, SupplierGroup>>((acc, po) => {
      if (!acc[po.supplierId]) acc[po.supplierId] = { supplierId: po.supplierId, name: getSupplier(po.supplierId)?.name ?? po.supplierId, pos: [] }
      acc[po.supplierId].pos.push(po)
      return acc
    }, {}))

  const openDraft = (type: ChaseType, sg: SupplierGroup) => {
    const key = dk(type, sg.supplierId)
    if (!draftBodies[key]) setDraftBodies(p => ({ ...p, [key]: buildChaseEmail(sg.name, sg.pos, type) }))
    setActiveDraft(activeDraft === key ? null : key)
  }

  const sendDraft = (type: ChaseType, sg: SupplierGroup) => {
    const key = dk(type, sg.supplierId)
    setSendingKey(key)
    setTimeout(() => {
      const ts = new Date().toISOString()
      sg.pos.forEach(po => {
        onAddEvent(po.id, { id: `chase-${po.id}-${Date.now()}`, type: 'chase_sent', timestamp: ts,
          body: `${CHASE_TYPE_LABELS[type]} chase sent to ${sg.name}. Grouped with ${sg.pos.length - 1} other line(s) this week.`, author: 'agent' })
        onUpdateLastChased(po.id, ts)
      })
      setSentKeys(prev => new Set([...prev, key]))
      setSendingKey(null)
      setActiveDraft(null)
    }, 1500)
  }

  if (chaseGroups.length === 0) return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-3">
      <Check className="w-4 h-4 text-green-500 shrink-0" />
      <span className="text-sm text-green-700 font-medium">No chases due this week.</span>
    </div>
  )

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
        <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
          <Send className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <span className="text-sm font-semibold text-gray-800">Weekly Chase Schedule</span>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
          {chaseGroups.reduce((s, g) => s + g.pos.length, 0)} lines due
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {chaseGroups.map(({ type, label, dot, desc, pos }) => {
          const groups = toSupplierGroups(pos)
          return (
            <div key={type} className="px-5 py-4">
              <div className="flex items-start gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${dot} mt-1.5 shrink-0`} />
                <div>
                  <div className="text-xs font-semibold text-gray-700">{label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{desc}</div>
                </div>
                <span className="ml-auto text-[10px] text-gray-400 shrink-0">{pos.length} lines</span>
              </div>
              <div className="space-y-2 ml-4">
                {groups.map(sg => {
                  const key      = dk(type, sg.supplierId)
                  const isSent   = sentKeys.has(key)
                  const isSndg   = sendingKey === key
                  const isOpen   = activeDraft === key
                  return (
                    <div key={sg.supplierId} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-gray-50">
                        <span className="text-xs font-semibold text-gray-700">{sg.name}</span>
                        <span className="text-[10px] text-gray-400">{sg.pos.length} line{sg.pos.length > 1 ? 's' : ''}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {isSent
                            ? <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold"><Check className="w-3 h-3" />Sent</span>
                            : <button onClick={() => openDraft(type, sg)}
                                className="h-6 px-2.5 rounded-md border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-white transition-colors">
                                {isOpen ? 'Hide draft' : 'Review draft'}
                              </button>
                          }
                        </div>
                      </div>
                      {!isOpen && !isSent && (
                        <div className="px-3.5 py-2 border-t border-gray-50 flex flex-wrap gap-1">
                          {sg.pos.map(po => <span key={po.id} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{po.id}</span>)}
                        </div>
                      )}
                      {isOpen && (
                        <div>
                          <textarea
                            className="w-full text-[11px] text-gray-700 font-mono leading-relaxed p-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-200 border-t border-gray-100"
                            rows={11}
                            value={draftBodies[key] ?? ''}
                            onChange={e => setDraftBodies(p => ({ ...p, [key]: e.target.value }))}
                          />
                          <div className="px-3.5 py-2.5 bg-gray-50 border-t border-gray-100 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400">{(draftBodies[key] ?? '').length} chars</span>
                              <button onClick={() => setDraftBodies(p => ({ ...p, [key]: buildChaseEmail(sg.name, sg.pos, type) }))}
                                className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">Revert</button>
                              <button onClick={() => sendDraft(type, sg)} disabled={isSndg}
                                className="ml-auto h-7 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                                {isSndg
                                  ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</>
                                  : <><Send className="w-3 h-3" />Send via Outlook</>}
                              </button>
                            </div>
                            <p className="text-center text-[10px] text-gray-400">You'll review before anything is sent.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function KanbanPanel({
  poEventsMap,
  lastChasedMap,
  onOpenPO,
  onSwitchToRegister,
  onAddEvent,
  onUpdateLastChased,
}: {
  poEventsMap:        Map<string, POEvent[]>
  lastChasedMap:      Map<string, string>
  onOpenPO:           (poId: string) => void
  onSwitchToRegister: () => void
  onAddEvent:         (poId: string, event: POEvent) => void
  onUpdateLastChased: (poId: string, date: string) => void
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const allItems = computeKanbanItems(poEventsMap, lastChasedMap)
  const items    = allItems.filter(i => !dismissedIds.has(i.id))

  const dismiss = (item: ActionItem) => {
    if (item.poId) {
      onAddEvent(item.poId, {
        id: `dismissed-${Date.now()}`, type: 'decision_recorded',
        timestamp: new Date().toISOString(),
        body: 'Action reviewed and dismissed from board — no further intervention taken at this time.',
        author: 'buyer',
      })
    }
    setDismissedIds(prev => new Set([...prev, item.id]))
  }

  const chaseNow = (item: ActionItem) => {
    if (!item.poId) return
    const po  = getPO(item.poId)!
    const sup = getSupplier(po.supplierId)
    const ts  = new Date().toISOString()
    onAddEvent(item.poId, {
      id: `chase-${Date.now()}`, type: 'chase_sent',
      timestamp: ts,
      body: `Handover chase sent to ${sup?.name ?? po.supplierId} via Kanban quick-action. ${po.product} — awaiting dispatch confirmation.`,
      author: 'agent',
    })
    onUpdateLastChased(item.poId, ts)
    setDismissedIds(prev => new Set([...prev, item.id]))
  }

  const acceptDate = (item: ActionItem) => {
    if (!item.poId || !item.proposalOldDate || !item.proposalNewDate) return
    onAddEvent(item.poId, {
      id: `applied-${Date.now()}`, type: 'date_change_applied',
      timestamp: new Date().toISOString(),
      body: `Date change accepted via Kanban board: delivery ${formatDate(item.proposalOldDate)} → ${formatDate(item.proposalNewDate)}. Update sent to Order App.`,
      author: 'buyer',
    })
    setDismissedIds(prev => new Set([...prev, item.id]))
  }

  const rejectDate = (item: ActionItem) => {
    if (!item.poId) return
    onAddEvent(item.poId, {
      id: `rejected-${Date.now()}`, type: 'decision_recorded',
      timestamp: new Date().toISOString(),
      body: `Date change request rejected via Kanban board. Original delivery date maintained${item.proposalOldDate ? `: ${formatDate(item.proposalOldDate)}` : ''}. Supplier to be notified.`,
      author: 'buyer',
    })
    setDismissedIds(prev => new Set([...prev, item.id]))
  }

  const columns: { label: string; colCls: string; headerCls: string; dot: string; buckets: AlertBucket[] }[] = [
    { label: 'Critical',     colCls: 'bg-red-50 border-red-200',    headerCls: 'bg-red-100 text-red-700',    dot: 'bg-red-500',   buckets: ['ex-factory-delay'] },
    { label: 'Needs Review', colCls: 'bg-amber-50 border-amber-200', headerCls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400', buckets: ['date-change'] },
    { label: 'Upcoming',     colCls: 'bg-blue-50 border-blue-200',  headerCls: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-400',  buckets: ['submission-deadline', 'intake-volume'] },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-red-100 rounded-md flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-red-600" />
        </div>
        <span className="text-sm font-bold text-gray-900">Actions to prioritise</span>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{items.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {columns.map(col => {
          const colItems = items.filter(a => col.buckets.includes(a.bucket))
          return (
            <div key={col.label} className={`border rounded-xl overflow-hidden ${col.colCls}`}>
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-bold text-gray-700">{col.label}</span>
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.headerCls}`}>{colItems.length}</span>
              </div>
              <div className="px-3 pb-3 space-y-2 border-t border-white/60">
                {colItems.length === 0
                  ? <p className="text-xs text-gray-400 py-4 text-center">All clear</p>
                  : colItems.map(item => (
                    <ActionCard
                      key={item.id}
                      item={item}
                      onTakeAction={() => item.poId ? onOpenPO(item.poId) : onSwitchToRegister()}
                      onViewPO={item.poId ? () => { onSwitchToRegister(); onOpenPO(item.poId!) } : undefined}
                      onDismiss={() => dismiss(item)}
                      onChaseNow={item.bucket === 'ex-factory-delay' ? () => chaseNow(item) : undefined}
                      onAcceptDate={item.bucket === 'date-change' ? () => acceptDate(item) : undefined}
                      onRejectDate={item.bucket === 'date-change' ? () => rejectDate(item) : undefined}
                    />
                  ))
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── PO Monitoring helpers ─────────────────────────────────────────────────────
function getRelationshipPattern(sup: Supplier): 'structural' | 'concentration' | 'routine' {
  if (sup.onTimeRate < 60) return 'structural'
  if (sup.openPOs >= 20 && sup.onTimeRate < 80) return 'concentration'
  return 'routine'
}

const SUPPLIER_COVER_WEEKS: Record<string, number> = {
  ET: 7, SS: 5, NK: 8, BA: 9, TB: 8, UF: 8, LL: 9,
}

interface PORecommendation {
  action:          'accept_late' | 'cpr' | 'cancel' | 'chase'
  primaryLabel:    string
  primaryForecast: string
  rationale:       string
  altOptions:      Array<{ key: 'accept_late' | 'cpr' | 'cancel' | 'chase'; label: string; forecast: string }>
}

function getPORecommendation(
  _g: ActionGroup,
  sup: Supplier,
  maxDaysOverdue: number,
  orderVal: number,
  cprPct: number
): PORecommendation {
  const coverWeeks = SUPPLIER_COVER_WEEKS[sup.id] ?? 6
  const cprSaving  = Math.round(orderVal * cprPct / 100)
  const delayWeeks = Math.ceil(maxDaysOverdue / 7)
  const pattern    = getRelationshipPattern(sup)

  const ALL_OPTS: PORecommendation['altOptions'] = [
    { key: 'accept_late', label: 'Accept late (+' + delayWeeks + 'w intake)',   forecast: 'Cover: ' + coverWeeks + 'w → ' + Math.max(0, coverWeeks - delayWeeks) + 'w · Margin preserved' },
    { key: 'cpr',         label: 'Request CPR ' + cprPct + '%',                 forecast: 'Margin recovered: +£' + cprSaving.toLocaleString() + ' · Relationship risk moderate' },
    { key: 'cancel',      label: 'Cancel PO and resource',                       forecast: 'Stockouts likely · £' + orderVal.toLocaleString() + ' commitment cancelled' },
    { key: 'chase',       label: 'Chase first (24h deadline)',                   forecast: 'Supplier notified · Resolution expected 48h' },
  ]

  if (pattern === 'concentration') {
    return {
      action: 'chase',
      primaryLabel: 'Review concentration with ' + sup.name,
      primaryForecast: sup.openPOs + ' open POs · Portfolio risk at ' + sup.onTimeRate + '% OTR',
      rationale: sup.openPOs + ' open POs at ' + sup.onTimeRate + '% OTR creates portfolio risk across your range. Review your exposure before chasing individual POs.',
      altOptions: ALL_OPTS.filter(o => o.key !== 'chase'),
    }
  }

  if (coverWeeks >= 6 && maxDaysOverdue < 60) {
    return {
      action: 'accept_late',
      primaryLabel: 'Accept late delivery (+' + delayWeeks + 'w intake)',
      primaryForecast: 'Cover holds: ' + coverWeeks + 'w → ' + Math.max(0, coverWeeks - delayWeeks) + 'w by intake · Margin preserved',
      rationale: 'You have ' + coverWeeks + ' weeks of cover at current sell-through, so the late intake won\'t cause stockouts. ' + (pattern === 'structural' ? sup.name + '\'s OTR is ' + sup.onTimeRate + '% -- cancelling or applying CPR pressure risks the relationship without improving reliability.' : 'Chasing aggressively risks the relationship for marginal gain.'),
      altOptions: ALL_OPTS.filter(o => o.key !== 'accept_late'),
    }
  }

  if (coverWeeks < 4 && sup.onTimeRate >= 70) {
    return {
      action: 'cpr',
      primaryLabel: 'Request CPR ' + cprPct + '% (+£' + cprSaving.toLocaleString() + ' margin)',
      primaryForecast: 'Margin recovered: +£' + cprSaving.toLocaleString() + ' · ' + sup.name + ' relationship manageable',
      rationale: 'Cover is low at ' + coverWeeks + ' weeks -- you need this stock, but the ' + maxDaysOverdue + 'd delay warrants a commercial concession. A ' + cprPct + '% CPR recovers £' + cprSaving.toLocaleString() + ' and is proportionate given ' + sup.name + '\'s ' + sup.onTimeRate + '% OTR.',
      altOptions: ALL_OPTS.filter(o => o.key !== 'cpr'),
    }
  }

  if (sup.onTimeRate < 60 && maxDaysOverdue >= 30) {
    return {
      action: 'cancel',
      primaryLabel: 'Cancel PO and resource',
      primaryForecast: 'Stockouts likely · £' + orderVal.toLocaleString() + ' commitment cancelled',
      rationale: sup.name + '\'s OTR is ' + sup.onTimeRate + '% and this PO is ' + maxDaysOverdue + ' days late. Continued commitment concentrates risk with a structurally unreliable supplier. Source alternatives now.',
      altOptions: ALL_OPTS.filter(o => o.key !== 'cancel'),
    }
  }

  return {
    action: 'chase',
    primaryLabel: 'Chase first (24h deadline)',
    primaryForecast: 'Supplier notified · Resolution expected 48h',
    rationale: sup.name + ' typically resolves delays within 48 hours when chased directly. Send a formal chase with a 24-hour deadline before escalating to commercial decisions.',
    altOptions: ALL_OPTS.filter(o => o.key !== 'chase'),
  }
}

function isSubstantiveReason(trigger?: TriggerMessage): boolean {
  if (!trigger) return false
  const text = (trigger.body + ' ' + (trigger.agentSummary ?? '')).toLowerCase()
  return /mechanical failure|raw material|yarn supply|qc failure|quality control|natural disaster|flood|fire|power cut|capacity failure|supply disruption/.test(text)
}

interface DateChangeRec {
  action:          'approve_date' | 'counter' | 'reject'
  primaryLabel:    string
  primaryForecast: string
  rationale:       string
  altOptions:      Array<{ key: 'approve_date' | 'counter' | 'reject'; label: string; forecast: string }>
}

function getDateChangeRecommendation(
  g: ActionGroup,
  sup: Supplier,
  daysPushed: number,
  substantiveReason: boolean,
  orderVal: number,
): DateChangeRec {
  const coverWeeks   = SUPPLIER_COVER_WEEKS[sup.id] ?? 6
  const midpointDays = Math.ceil(daysPushed / 2)
  const origDate     = g.pos.reduce((min, p) => p.expectedDelivery < min ? p.expectedDelivery : min, g.pos[0].expectedDelivery)
  const midpointDate = new Date(origDate); midpointDate.setDate(new Date(origDate).getDate() + midpointDays)
  const midpointStr  = midpointDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const coverAfterFull  = Math.max(0, coverWeeks - Math.ceil(daysPushed / 7))
  const coverAfterMid   = Math.max(0, coverWeeks - Math.ceil(midpointDays / 7))

  const ALL_OPTS: DateChangeRec['altOptions'] = [
    { key: 'approve_date', label: `Approve new date (+${daysPushed}d)`,        forecast: `Intake delayed: ${daysPushed} days · Cover: ${coverWeeks}w → ~${coverAfterFull}w` },
    { key: 'counter',      label: `Counter-propose ${midpointStr} (+${midpointDays}d)`, forecast: `Earlier than supplier's ask: ${midpointDays} days · Protects ~${coverAfterMid}w cover` },
    { key: 'reject',       label: 'Reject date change',                         forecast: `Forces supplier commitment · Value at risk: £${orderVal.toLocaleString()}` },
  ]

  if (substantiveReason && daysPushed <= 14 && coverWeeks >= 4) {
    return {
      action: 'approve_date',
      primaryLabel: `Approve new date (+${daysPushed} days)`,
      primaryForecast: `Cover holds: ${coverWeeks}w → ~${coverAfterFull}w by new intake · Margin preserved`,
      rationale: `${sup.name} cited a substantive operational reason and the ${daysPushed}-day push is within tolerance. You have ${coverWeeks} weeks of cover — approving keeps the relationship stable without stockout risk.`,
      altOptions: ALL_OPTS.filter(o => o.key !== 'approve_date'),
    }
  }

  if (!substantiveReason && coverWeeks < 2) {
    return {
      action: 'reject',
      primaryLabel: 'Reject date change',
      primaryForecast: `Forces supplier commitment · Value at risk: £${orderVal.toLocaleString()}`,
      rationale: `Cover is critically low at ${coverWeeks} weeks and ${sup.name} has not given a substantive reason for the delay. Holding the original date is the only viable option.`,
      altOptions: ALL_OPTS.filter(o => o.key !== 'reject'),
    }
  }

  const counterRationale = daysPushed > 14
    ? `A ${daysPushed}-day push is larger than standard tolerance${!substantiveReason ? ' and the reason provided is non-operational' : ''}. Counter-proposing ${midpointStr} (+${midpointDays}d) splits the difference and protects ~${coverAfterMid} weeks of cover.`
    : `${sup.name}'s OTR is ${sup.onTimeRate}% — caution is warranted. Counter at ${midpointStr} to limit the intake impact while maintaining the relationship.`

  return {
    action: 'counter',
    primaryLabel: `Counter-propose ${midpointStr} (+${midpointDays} days)`,
    primaryForecast: `Earlier than supplier's ask: ${midpointDays} days · Protects ~${coverAfterMid} weeks cover`,
    rationale: counterRationale,
    altOptions: ALL_OPTS.filter(o => o.key !== 'counter'),
  }
}

interface DCBookingRec {
  action:          'confirm' | 'alt_slot'
  recommendLine:   string
  primaryLabel:    string
  primaryForecast: string
  altLabel:        string
  altForecast:     string
}

function getDCBookingRecommendation(g: ActionGroup, sup: Supplier): DCBookingRec {
  const pattern      = getRelationshipPattern(sup)
  const dispatchDate = g.pos[0].expectedDelivery
  const dispatchStr  = new Date(dispatchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  if (sup.onTimeRate < 75) {
    return {
      action: 'alt_slot',
      recommendLine: `Request an alternate slot. ${sup.name}'s OTR is ${sup.onTimeRate}% — confirm goods are packed and ready before committing the DC slot.`,
      primaryLabel:  'Request alternate slot',
      primaryForecast: `Avoids committing DC slot before supplier confirms readiness`,
      altLabel:    'Confirm booking (accept risk)',
      altForecast: `Accepts reliability risk at ${sup.onTimeRate}% OTR · Locks in ${dispatchStr} dispatch`,
    }
  }

  const confirmLine = pattern === 'concentration'
    ? `Confirm the slot. Goods are ready to dispatch — but note: ${sup.openPOs} open POs at ${sup.onTimeRate}% OTR means this further commitment increases your concentration exposure with ${sup.name}.`
    : `Confirm the slot. ${sup.name} is ready for dispatch and your DC has capacity in the requested window.`

  return {
    action:          'confirm',
    recommendLine:   confirmLine,
    primaryLabel:    'Confirm booking',
    primaryForecast: `Locks in ${dispatchStr} dispatch · DC slot reserved`,
    altLabel:        'Request alternate slot',
    altForecast:     'Delays commitment · Risk of losing DC slot',
  }
}

// ── PO Monitoring View ────────────────────────────────────────────────────────
function POMonitoringView({ initialOpenPO, onNavigateToNeg: _onNavigateToNeg }: { initialOpenPO?: string | null; onNavigateToNeg?: (recId: string) => void }) {
  const [subTab,           setSubTab]           = useState<'actions' | 'allpos' | 'suppliers' | 'agentlog'>('actions')
  const [poEventsMap,      setPoEventsMap]      = useState<Map<string, POEvent[]>>(new Map(Object.entries(SEED_PO_EVENTS)))
  const [lastChasedMap] = useState<Map<string, string>>(new Map()); void lastChasedMap
  const [selectedPOId,     setSelectedPOId]     = useState<string | null>(initialOpenPO ?? null)

  useEffect(() => { if (initialOpenPO) setSelectedPOId(initialOpenPO) }, [initialOpenPO])
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [sendModal,        setSendModal]        = useState<{ supplierId: string; poIds: string[] } | null>(null)
  const [emailDraft,       setEmailDraft]       = useState('')
  const [poSearch,         setPoSearch]         = useState('')
  const [chaseThreads,     setChaseThreads]     = useState<Record<string, ChaseThread>>({})
  const [expandedMsgIds,   setExpandedMsgIds]   = useState<Set<string>>(new Set()); void expandedMsgIds; void setExpandedMsgIds
  const [chaseDraftMap,    setChaseDraftMap]    = useState<Record<string, string>>({})
  const [chaseHistoryOpen, setChaseHistoryOpen] = useState(false); void chaseHistoryOpen; void setChaseHistoryOpen
  const [poStatusFilter,   setPoStatusFilter]   = useState('all')
  const [poSupFilter,      setPoSupFilter]      = useState('all')
  const [settingsAccordion, setSettingsAccordion] = useState<string | null>(null)
  // Actions queue state
  const [drawerCardKey,    setDrawerCardKey]    = useState<string | null>(null)
  const [snoozedCards,     setSnoozedCards]     = useState<Set<string>>(new Set())
  const [actTypeFilter,    setActTypeFilter]    = useState('all')
  const [urgencyFilter,    setUrgencyFilter]    = useState('all')
  const [sortMode,         setSortMode]         = useState<'urgency_value' | 'alpha'>('urgency_value')
  const [drawerDecision,   setDrawerDecision]   = useState<Record<string, 'cancel' | 'cpr' | 'accept_late'>>({})
  const [proposedMutations,setProposedMutations]= useState<Record<string, Array<{poId:string;field:string;oldVal:string;newVal:string}>>>({})
  const [selectedActionPill,setSelectedActionPill]= useState<Record<string,string>>({})
  const [drawerView,        setDrawerView]        = useState<'action' | 'po-detail'>('action')
  const [drawerViewPOId,    setDrawerViewPOId]    = useState<string | null>(null)
  const [counterProposeDate,setCounterProposeDate]= useState<Record<string,string>>({})
  const [rejectReason,      setRejectReason]      = useState<Record<string,string>>({})
  const [logNoteOpen,       setLogNoteOpen]       = useState<Record<string,boolean>>({})
  const [logNoteType,       setLogNoteType]       = useState<Record<string,'call'|'note'|'internal'>>({})
  const [logNoteText,       setLogNoteText]       = useState<Record<string,string>>({})
  const [snoozeConfirmOpen, setSnoozeConfirmOpen] = useState<Record<string,boolean>>({})
  const [dismissConfirmOpen,setDismissConfirmOpen]= useState<Record<string,boolean>>({})
  const [resolvedCards,     setResolvedCards]     = useState<Set<string>>(new Set())
  const [triggerExpanded,   setTriggerExpanded]   = useState<Record<string,boolean>>({})
  // DP2 — reply received decision
  const [dp2Action,  setDp2Action]  = useState<Record<string, 'apply_changes' | 'counter_propose' | 'reject_escalate' | 'reply_question'>>({})
  const [dp2Draft,   setDp2Draft]   = useState<Record<string, string>>({})
  // DP3 — no reply overdue decision
  const [dp3Action,  setDp3Action]  = useState<Record<string, 'followup_chase' | 'escalate_manager' | 'switch_phone' | 'accept_silence'>>({})
  const [dp3Draft,   setDp3Draft]   = useState<Record<string, string>>({})
  // DP4 — resolution confirmation done (skip confirmation step)
  const [dp4Done,    setDp4Done]    = useState<Set<string>>(new Set())

  const addPOEvent = (poId: string, event: POEvent) => {
    setPoEventsMap(prev => { const next = new Map(prev); next.set(poId, [...(next.get(poId) ?? []), event]); return next })
  }

  const selectedPO = selectedPOId ? ALL_POS.find(p => p.id === selectedPOId) ?? null : null
  const today = new Date()

  const classifyPO = (po: PO): 'overdue' | 'at_risk' | 'late_dc' | 'on_track' => {
    if (po.status === 'Ex-factory delay')     return 'overdue'
    if (po.status === 'Date change required') return 'at_risk'
    if (po.status === 'Late DC booking')      return 'late_dc'
    return 'on_track'
  }

  const overduePOs     = ALL_POS.filter(p => classifyPO(p) === 'overdue')
  const atRiskPOs      = ALL_POS.filter(p => classifyPO(p) === 'at_risk')
  const preDispatchPOs = ALL_POS.filter(p => classifyPO(p) === 'late_dc')
  const onTrackPOs     = ALL_POS.filter(p => classifyPO(p) === 'on_track')

  const daysOverdue = (po: PO) => Math.ceil((today.getTime() - new Date(po.expectedDelivery).getTime()) / 86400000)
  const daysUntil   = (po: PO) => Math.ceil((new Date(po.expectedDelivery).getTime() - today.getTime()) / 86400000); void daysUntil

  // ActionGroup is declared at module level — see below
  const makeGroups = (pos: PO[], type: ActionGroup['type']): ActionGroup[] => {
    const bySupplier = pos.reduce((acc, po) => { acc[po.supplierId] = [...(acc[po.supplierId] ?? []), po]; return acc }, {} as Record<string, PO[]>)
    return Object.entries(bySupplier).map(([supplierId, ps]) => ({ supplierId, type, pos: ps }))
  }
  const TRIGGER_MESSAGES: Record<string, TriggerMessage> = {
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
  const actionGroups: ActionGroup[] = [
    ...makeGroups(overduePOs, 'overdue'),
    ...makeGroups(atRiskPOs, 'at_risk'),
    ...makeGroups(preDispatchPOs, 'late_dc'),
  ].map(g => ({ ...g, triggerMessage: TRIGGER_MESSAGES[`${g.supplierId}-${g.type}`] }))

  // Consolidate by supplier: one entry per supplier across all issue types
  const supplierEntries = (() => {
    const map: Record<string, ActionGroup[]> = {}
    actionGroups.forEach(g => { map[g.supplierId] = [...(map[g.supplierId] ?? []), g] })
    return Object.entries(map).map(([supplierId, groups]) => ({
      supplierId,
      groups,
      primaryGroup: groups.find(g => g.type === 'overdue') ?? groups.find(g => g.type === 'at_risk') ?? groups[0],
      allPos: groups.flatMap(g => g.pos),
    }))
  })()

  // Map each PO id → its issue type (for per-PO badges in the right panel)
  const poTypeMap = new Map(actionGroups.flatMap(g => g.pos.map(p => [p.id, g.type] as const))); void poTypeMap

  // ── Card helpers ────────────────────────────────────────────────────────────
  const parseOrderVal = (v: string) => parseInt(v.replace(/[^0-9]/g, '')) || 0
  const urgWt = (g: ActionGroup) => g.type === 'overdue' ? 3 : g.type === 'at_risk' ? 2 : 1
  const cardKey = (g: ActionGroup) => `${g.supplierId}-${g.type}`
  const getCardState = (g: ActionGroup): 'agent-drafted' | 'decision-needed' | 'awaiting-reply' | 'reply-received' | 'no-reply-overdue' | 'snoozed' => {
    if (snoozedCards.has(cardKey(g))) return 'snoozed'
    const thread = chaseThreads[g.supplierId]
    if (thread?.status === 'reply-received') return 'reply-received'
    if (thread?.status === 'no-reply-overdue') return 'no-reply-overdue'
    if (thread?.status === 'awaiting-reply') return 'awaiting-reply'
    if (g.type === 'overdue' && Math.max(...g.pos.map(p => daysOverdue(p))) >= 14) return 'decision-needed'
    return 'agent-drafted'
  }
  const cardScore = (g: ActionGroup) => urgWt(g) * g.pos.reduce((s, p) => s + parseOrderVal(p.orderValue), 0)

  const generateDraftEmail = (groups: ActionGroup[]): string => {
    if (groups.length === 0) return ''
    const sup = getSupplier(groups[0].supplierId)
    if (!sup) return ''
    if (groups.length === 1) {
      const g = groups[0]
      const poList = g.pos.map(p => `- ${p.id}: ${p.product} (Due: ${formatDate(p.expectedDelivery)})`).join('\n')
      if (g.type === 'overdue') {
        const maxDays = Math.max(...g.pos.map(p => daysOverdue(p)))
        return `Dear ${sup.name} Team,\n\nWe are writing to urgently follow up on ${g.pos.length} purchase order${g.pos.length > 1 ? 's' : ''} that ${g.pos.length > 1 ? 'are' : 'is'} now overdue by up to ${maxDays} days:\n\n${poList}\n\nPlease confirm:\n1. Current dispatch status\n2. Revised ex-factory date\n3. Freight booking reference\n\nWe require an urgent response by end of business today.\n\nKind regards,\nDebenhams Buying Team`
      }
      if (g.type === 'at_risk') {
        return `Dear ${sup.name} Team,\n\nWe are writing regarding date change requests for the following purchase orders:\n\n${poList}\n\nPlease provide:\n1. Root cause of the delay\n2. Confirmation of revised delivery schedule\n3. Mitigation actions being taken\n\nPlease respond within 48 hours.\n\nKind regards,\nDebenhams Buying Team`
      }
      return `Dear ${sup.name} Team,\n\nPre-dispatch chase for the following orders due for delivery shortly:\n\n${poList}\n\nPlease confirm:\n1. Goods packed and ready for collection\n2. Freight forwarder booking reference\n3. Expected handover date\n\nKind regards,\nDebenhams Buying Team`
    }
    // Multi-issue consolidated email
    const sections = groups.map(g => {
      const poList = g.pos.map(p => `  - ${p.id}: ${p.product} (Due: ${formatDate(p.expectedDelivery)})`).join('\n')
      if (g.type === 'overdue') {
        const maxDays = Math.max(...g.pos.map(p => daysOverdue(p)))
        return `OVERDUE ORDERS (${g.pos.length} PO${g.pos.length > 1 ? 's' : ''}, up to ${maxDays}d late):\n${poList}\nAction required: confirm dispatch status, revised ex-factory date, and freight booking.`
      }
      if (g.type === 'at_risk') {
        return `DATE CHANGE REQUESTS (${g.pos.length} PO${g.pos.length > 1 ? 's' : ''}):\n${poList}\nAction required: provide root cause, revised delivery schedule, and mitigation actions.`
      }
      return `PRE-DISPATCH CONFIRMATION (${g.pos.length} PO${g.pos.length > 1 ? 's' : ''}):\n${poList}\nAction required: confirm goods are packed, freight forwarder booking reference, and expected handover date.`
    }).join('\n\n')
    const totalPos = groups.reduce((s, g) => s + g.pos.length, 0)
    return `Dear ${sup.name} Team,\n\nWe are writing regarding ${totalPos} purchase order${totalPos > 1 ? 's' : ''} that require your urgent attention. This email covers multiple open issues — please respond to each section below.\n\n${sections}\n\nPlease respond to all points above within 24 hours.\n\nKind regards,\nDebenhams Buying Team`
  }

  // ── Thread helpers ──────────────────────────────────────────────────────────
  const getThreadKey = (g: ActionGroup) => g.supplierId

  const generateSupplierReply = (g: ActionGroup): string => {
    const sup = getSupplier(g.supplierId)
    const ref  = `DB-${String(Math.floor(100000 + Math.random() * 900000))}`
    const revDate = new Date(today); revDate.setDate(today.getDate() + 9)
    const handDate = new Date(today); handDate.setDate(today.getDate() + 3)
    const revStr  = revDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const handStr = handDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const name = sup?.name ?? g.supplierId

    if (g.type === 'overdue') {
      const poLines = g.pos.map(p => `  - ${p.id} (${p.product}): QC complete. Revised ex-factory date: ${revStr}.`).join('\n')
      return `Dear Debenhams Buying Team,\n\nThank you for your email. We sincerely apologise for the delays on the following orders:\n\n${poLines}\n\nWe are arranging freight booking as a priority and will confirm booking references by ${handStr}.\n\nPlease accept our apologies for any disruption to your intake planning.\n\nKind regards,\n${name} Team`
    }
    if (g.type === 'at_risk') {
      const poLines = g.pos.map(p => {
        const rev = p.revisedDelivery
          ? new Date(p.revisedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : revStr
        return `  - ${p.id} (${p.product}): Revised delivery ${rev}.`
      }).join('\n')
      return `Dear Debenhams Buying Team,\n\nThank you for your email. To confirm our date change request:\n\n${poLines}\n\nRoot cause: Raw material supply delays from our primary fabric supplier impacted production scheduling.\nMitigation: We are expediting QC and finishing processes to minimise further slippage.\n\nWe are committed to no further extensions on these orders.\n\nKind regards,\n${name} Team`
    }
    // late_dc
    const poLines = g.pos.map(p => `  - ${p.id} (${p.product}): Packed and ready. Freight forwarder: DB Schenker. Booking ref: ${ref}. Handover: ${handStr}.`).join('\n')
    return `Dear Debenhams Buying Team,\n\nThank you for your pre-dispatch chase. Confirming dispatch status:\n\n${poLines}\n\nPlease let us know if you require any further documentation.\n\nKind regards,\n${name} Team`
  }

  const getFollowUpEmailType = (g: ActionGroup) =>
    g.type === 'late_dc'  ? 'Pre-Dispatch Chase' :
    g.type === 'at_risk'  ? 'Date Change Request' :
    'Ex-Factory Delay — Escalation'

  const generateFollowUp = (g: ActionGroup): string => {
    const sup = getSupplier(g.supplierId)
    const name = sup?.name ?? g.supplierId
    const cutDate = new Date(today); cutDate.setDate(today.getDate() + 5)
    const cutStr = cutDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

    if (g.type === 'overdue') {
      return `Dear ${name} Team,\n\nThank you for confirming the revised ex-factory dates.\n\nPlease note this represents a significant delay to our intake plan. We require:\n1. Daily status updates until goods are confirmed dispatched\n2. Freight booking references confirmed no later than ${cutStr}\n3. Written confirmation that air freight will be arranged at your cost if dispatch slips further\n\nThis matter has been escalated to our Head of Buying.\n\nPlease confirm receipt and acceptance of these terms.\n\nKind regards,\nDebenhams Buying Team`
    }
    if (g.type === 'at_risk') {
      return `Dear ${name} Team,\n\nThank you for confirming the revised delivery schedule and explaining the root cause.\n\nWe can accept the revised dates on the following conditions:\n1. No further extensions will be granted on these orders\n2. Air freight at your cost if revised dates slip by more than 3 days\n3. Weekly production updates until dispatch is confirmed\n\nPlease confirm your acceptance of these terms in writing within 24 hours.\n\nKind regards,\nDebenhams Buying Team`
    }
    // late_dc (auto-send)
    return `Dear ${name} Team,\n\nThank you for confirming the freight booking details. We have updated our systems accordingly.\n\nWe will monitor progress and will be in touch if any issues arise at our DC.\n\nKind regards,\nDebenhams Buying Team`
  }

  const handleStartThread = (groups: ActionGroup[], editedBody?: string) => {
    const primary = groups[0]
    const key  = primary.supplierId
    const body = editedBody ?? generateDraftEmail(groups)
    const msgId = `msg-${Date.now()}`
    const thread: ChaseThread = {
      status: 'awaiting-reply',
      startedAt: new Date().toISOString(),
      messages: [{ id: msgId, sender: 'you', timestamp: new Date().toISOString(), body, status: 'sent' }],
    }
    setChaseThreads(prev => ({ ...prev, [key]: thread }))
    setExpandedMsgIds(new Set())
    addPOEvent(primary.pos[0].id, { id: `ev-${Date.now()}`, type: 'chase_sent', timestamp: new Date().toISOString(), body: `Chase email sent to ${getSupplier(primary.supplierId)?.name}.`, author: 'agent' })
  }

  const handleSimulateReply = (group: ActionGroup) => {
    const key = getThreadKey(group)
    const replyBody = generateSupplierReply(group)
    const emailType = getFollowUpEmailType(group)
    const cfg = CHASE_CONFIGS.find(c => c.label === emailType)
    const followUpBody = generateFollowUp(group)
    const replyId   = `msg-${Date.now()}`
    const followId  = `msg-${Date.now() + 1}`
    const sup = getSupplier(group.supplierId)
    const replyMsg: ChaseThreadMsg  = { id: replyId,  sender: sup?.name ?? group.supplierId, timestamp: new Date().toISOString(), body: replyBody, status: 'received' }
    const followMsg: ChaseThreadMsg = { id: followId, sender: 'agent', timestamp: new Date().toISOString(), body: followUpBody, status: cfg?.autoSend ? 'auto-sent' : 'awaiting-review', emailType }
    setChaseThreads(prev => {
      const cur = prev[key]
      if (!cur) return prev
      return { ...prev, [key]: { ...cur, status: 'reply-received', messages: [...cur.messages, replyMsg, followMsg] } }
    })
    // Generate proposed PO mutations (push expected dates forward ~3-5 weeks)
    const newDate = (base: string, weeks: number) => {
      const d = new Date(base); d.setDate(d.getDate() + weeks * 7); return d.toISOString().split('T')[0]
    }
    const mutations = group.pos.map((p, i) => ({
      poId: p.id,
      field: 'Expected delivery',
      oldVal: formatDate(p.expectedDelivery),
      newVal: formatDate(newDate(p.expectedDelivery, 3 + i)),
    }))
    setProposedMutations(prev => ({ ...prev, [group.supplierId]: mutations }))
    setExpandedMsgIds(new Set())
  }

  const generateDP2Draft = (action: string, sup: { name: string }, muts: Array<{poId: string; field: string; oldVal: string; newVal: string}>): string => {
    const nl = '\n'
    const closing = nl + nl + 'Kind regards,' + nl + 'Debenhams Buying Team'
    if (action === 'apply_changes') {
      const mutLines = muts.map(m => `- ${m.poId}: ${m.field} updated from ${m.oldVal} to ${m.newVal}`).join(nl)
      return `Dear ${sup.name} Team,${nl}${nl}Thank you for your reply. We confirm acceptance of the proposed changes:${nl}${nl}${mutLines}${nl}${nl}We have updated our systems accordingly. Please ensure freight is booked in line with the revised schedule.${closing}`
    }
    if (action === 'counter_propose') {
      return `Dear ${sup.name} Team,${nl}${nl}Thank you for your response. We are unable to accept the proposed dates as they stand and would like to discuss a revised schedule.${nl}${nl}Could you please confirm whether an earlier delivery is achievable? We are flexible on specific dates and would appreciate your earliest possible commitment.${closing}`
    }
    if (action === 'reject_escalate') {
      return `Dear ${sup.name} Team,${nl}${nl}Thank you for your response. After review, we are unable to accept the proposed changes. The original contractual delivery dates remain in effect.${nl}${nl}This matter has been escalated internally. Please revert with a plan to meet the original schedule, or we will need to review our options.${closing}`
    }
    if (action === 'reply_question') {
      return `Dear ${sup.name} Team,${nl}${nl}Thank you for your reply. Before we can confirm our response, we need some clarification on the following points:${nl}${nl}1. [Add your question here]${nl}${nl}Please respond at your earliest convenience so we can proceed.${closing}`
    }
    return ''
  }

  const generateDP3Draft = (action: string, group: ActionGroup, sup: { name: string }, daysSinceChase: number): string => {
    const nl = '\n'
    const closing = nl + nl + 'Kind regards,' + nl + 'Debenhams Buying Team'
    if (action === 'followup_chase') {
      const poList = group.pos.map(p => `- ${p.id}: ${p.product}`).join(nl)
      return `Dear ${sup.name} Team,${nl}${nl}We sent you a chase email ${daysSinceChase} days ago regarding the following orders and have not yet received a response:${nl}${nl}${poList}${nl}${nl}This is now urgent. Please confirm the current status of these orders and provide a revised delivery timeline by end of business today.${nl}${nl}Failure to respond will require us to escalate this matter.${closing}`
    }
    if (action === 'escalate_manager') {
      const poList = group.pos.map(p => `- ${p.id}: ${p.product} (Due: ${formatDate(p.expectedDelivery)})`).join(nl)
      return `Dear [Manager Name],${nl}${nl}I'm escalating the following supplier issue for your awareness.${nl}${nl}Supplier: ${sup.name}${nl}Issue: No response received to chase email sent ${daysSinceChase} days ago.${nl}${nl}Affected orders:${nl}${poList}${nl}${nl}Recommended action: [Add recommendation here]${nl}${nl}Please advise on how to proceed.${nl}${nl}Regards,${nl}[Your name]`
    }
    return ''
  }

  const handleApplyChanges = (group: ActionGroup, action: string, replyDraft: string, sendReply: boolean, cardKey: string) => {
    const key = getThreadKey(group)
    const ts = new Date().toISOString()
    const muts = proposedMutations[group.supplierId] ?? []
    const actionLabel = action === 'apply_changes' ? 'Apply proposed changes' : action === 'counter_propose' ? 'Counter-propose' : action === 'reject_escalate' ? 'Reject and escalate' : 'Reply with question'

    setChaseThreads(prev => {
      const cur = prev[key]
      if (!cur) return prev
      const newMsgs = sendReply
        ? [...cur.messages, { id: `msg-${Date.now()}`, sender: 'you' as const, timestamp: ts, body: replyDraft, status: 'sent' as const }]
        : cur.messages
      const sysEv: ThreadSystemEvent = { id: `sys-${Date.now()}`, timestamp: ts, body: `Decision recorded: ${actionLabel}` }
      const mutEvs: ThreadSystemEvent[] = muts.map((m, i) => ({
        id: `sys-${Date.now() + i + 1}`, timestamp: ts, body: `${m.field} updated: ${m.oldVal} → ${m.newVal} (${m.poId})`
      }))
      const resolvedEv: ThreadSystemEvent = { id: `sys-${Date.now() + muts.length + 1}`, timestamp: ts, body: 'Action resolved' }
      return {
        ...prev,
        [key]: { ...cur, status: 'resolved', messages: newMsgs, systemEvents: [...(cur.systemEvents ?? []), sysEv, ...mutEvs, resolvedEv] }
      }
    })
    setProposedMutations(prev => { const n = { ...prev }; delete n[group.supplierId]; return n })
    setResolvedCards(prev => { const n = new Set(prev); n.add(cardKey); return n })
  }

  const handleNoReplyTrigger = (group: ActionGroup) => {
    const key = getThreadKey(group)
    const ts = new Date().toISOString()
    setChaseThreads(prev => {
      const cur = prev[key]
      if (!cur) return prev
      const sysEv: ThreadSystemEvent = { id: `sys-${Date.now()}`, timestamp: ts, body: 'No reply received after 3 days — action escalated to overdue' }
      return { ...prev, [key]: { ...cur, status: 'no-reply-overdue', systemEvents: [...(cur.systemEvents ?? []), sysEv] } }
    })
  }

  const handleDP3Action = (group: ActionGroup, action: string, draft: string, cardKey: string) => {
    const key = getThreadKey(group)
    const ts = new Date().toISOString()
    if (action === 'accept_silence') {
      const sysEv: ThreadSystemEvent = { id: `sys-${Date.now()}`, timestamp: ts, body: 'Action closed — supplier silence accepted' }
      setChaseThreads(prev => {
        const cur = prev[key]
        if (!cur) return prev
        return { ...prev, [key]: { ...cur, status: 'resolved', systemEvents: [...(cur.systemEvents ?? []), sysEv] } }
      })
      setResolvedCards(prev => { const n = new Set(prev); n.add(cardKey); return n })
      return
    }
    if (action === 'switch_phone') {
      setLogNoteOpen(prev => ({ ...prev, [cardKey]: true }))
      return
    }
    const sysEvLabel = action === 'followup_chase' ? 'Follow-up chase sent' : 'Escalated to manager'
    const sysEv: ThreadSystemEvent = { id: `sys-${Date.now()}`, timestamp: ts, body: sysEvLabel }
    const newStatus = action === 'followup_chase' ? 'awaiting-reply' as const : 'awaiting-reply' as const
    setChaseThreads(prev => {
      const cur = prev[key]
      if (!cur) return prev
      const newMsg: ChaseThreadMsg = { id: `msg-${Date.now()}`, sender: 'you', timestamp: ts, body: draft, status: 'sent' }
      return { ...prev, [key]: { ...cur, status: newStatus, messages: [...cur.messages, newMsg], systemEvents: [...(cur.systemEvents ?? []), sysEv] } }
    })
  }





  const AGENT_LOG: AgentLogEntry[] = [
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
  const LOG_ICON: Record<AgentLogEntry['type'], { icon: string; color: string; bg: string; label: string; actionLabel: string; actionCls: string }> = {
    scan:        { icon: '🔍', color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Daily Scan',       actionLabel: 'Detected', actionCls: 'bg-gray-100 text-gray-500'   },
    scorecard:   { icon: '📊', color: 'text-purple-600', bg: 'bg-purple-50', label: 'Scorecard Update', actionLabel: 'Detected', actionCls: 'bg-gray-100 text-gray-500'   },
    date_change: { icon: '📅', color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'Date Change',      actionLabel: 'Detected', actionCls: 'bg-gray-100 text-gray-500'   },
    at_risk:     { icon: '⚠️', color: 'text-orange-600', bg: 'bg-orange-50', label: 'At Risk Flag',     actionLabel: 'Detected', actionCls: 'bg-gray-100 text-gray-500'   },
    escalation:  { icon: '🚨', color: 'text-red-600',    bg: 'bg-red-50',    label: 'Escalation',       actionLabel: 'Detected', actionCls: 'bg-gray-100 text-gray-500'   },
    chase_draft:    { icon: '✉️', color: 'text-indigo-600', bg: 'bg-indigo-50',  label: 'Chase Draft',      actionLabel: 'Drafted',          actionCls: 'bg-indigo-50 text-indigo-600'  },
    low_confidence: { icon: '🤔', color: 'text-amber-700', bg: 'bg-amber-50',   label: 'Low Confidence',   actionLabel: 'Flagged for review', actionCls: 'bg-amber-100 text-amber-700'  },
  }
  const CHASE_CONFIGS = [
    { label: 'Pre-Dispatch Chase',              trigger: '7 days before delivery',            autoSend: true  },
    { label: 'Ex-Factory Delay — Day 1',        trigger: '1 day after ex-factory missed',     autoSend: true  },
    { label: 'Ex-Factory Delay — Escalation',   trigger: '7 days after ex-factory missed',   autoSend: false },
    { label: 'Date Change Request',             trigger: 'On receipt of date change proposal', autoSend: false },
    { label: 'Delivery Overdue',                trigger: '1 day after delivery date missed',  autoSend: false },
    { label: 'Weekly Supplier Summary',         trigger: 'Every Monday 08:00',                autoSend: true  },
  ]

  return (
    <div className="flex-1 overflow-y-auto relative">

      {selectedPO && (
        <POLineDrawer po={selectedPO} onClose={() => setSelectedPOId(null)} onAddEvent={addPOEvent} />
      )}

      {/* Send confirm modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[580px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <div className="text-sm font-bold text-gray-900">Review &amp; Send Chase Email</div>
                <div className="text-xs text-gray-400 mt-0.5">To: {SUPPLIER_EMAILS[sendModal.supplierId]} · {sendModal.poIds.length} PO{sendModal.poIds.length > 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => setSendModal(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <textarea className="w-full h-60 text-xs text-gray-700 border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono leading-relaxed" value={emailDraft} onChange={e => setEmailDraft(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setSendModal(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => { addPOEvent(sendModal.poIds[0], { id: `ev-${Date.now()}`, type: 'chase_sent', timestamp: new Date().toISOString(), body: `Chase email sent to ${getSupplier(sendModal.supplierId)?.name}.`, author: 'agent' }); setSendModal(null) }} className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Send Chase Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings slide-over */}
      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1" onClick={() => setSettingsOpen(false)} />
          <div className="w-[420px] bg-white shadow-2xl border-l border-gray-100 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-900">Agent Settings</span>
              <button onClick={() => setSettingsOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-6">
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Classification Thresholds</div>
                <div className="space-y-3">
                  {[
                    { label: 'Overdue (days past delivery)',                   value: '1'  },
                    { label: 'At Risk — date change window (days)',             value: '28' },
                    { label: 'Pre-dispatch chase trigger (days before delivery)', value: '7'  },
                    { label: 'Escalation threshold (days overdue)',             value: '7'  },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 flex-1">{label}</span>
                      <input defaultValue={value} className="w-14 text-center border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Chase Email Configuration</div>
                <div className="space-y-2">
                  {CHASE_CONFIGS.map((cfg, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left" onClick={() => setSettingsAccordion(settingsAccordion === cfg.label ? null : cfg.label)}>
                        <div>
                          <div className="text-xs font-semibold text-gray-800">{cfg.label}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{cfg.trigger}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.autoSend ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{cfg.autoSend ? 'Auto-send' : 'Needs Review'}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${settingsAccordion === cfg.label ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {settingsAccordion === cfg.label && (
                        <div className="px-4 py-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Send mode:</span>
                            <span className={`text-[10px] font-semibold px-3 py-1 rounded-full border cursor-pointer ${cfg.autoSend ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>Auto-send</span>
                            <span className={`text-[10px] font-semibold px-3 py-1 rounded-full border cursor-pointer ${!cfg.autoSend ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>Needs Review</span>
                          </div>
                          <textarea className="w-full h-28 text-xs text-gray-600 border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" defaultValue={`Dear [Supplier Name],\n\nThis is an automated chase for your reference.\n\nKind regards,\nDebenhams Buying Team`} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            {([['actions','Actions'],['allpos','All POs'],['suppliers','Suppliers'],['agentlog','Agent Log']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setSubTab(t)} className={`h-8 px-4 rounded-lg text-xs font-semibold transition-colors ${subTab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
            ))}
          </div>
          <button onClick={() => setSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50" title="Settings">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>

        {/* ── ACTIONS ── */}
        {subTab === 'actions' && (() => {
          // ── Queue data ───────────────────────────────────────────────────
          const awaitingUser   = actionGroups.filter(g => ['agent-drafted','decision-needed','reply-received'].includes(getCardState(g))).length
          const valueAtRisk    = [...overduePOs, ...atRiskPOs].reduce((s, p) => s + parseOrderVal(p.orderValue), 0)
          const decisionsPend  = actionGroups.filter(g => getCardState(g) === 'decision-needed').length
          const awaitingReply  = actionGroups.filter(g => getCardState(g) === 'awaiting-reply').length

          const filtered = actionGroups.filter(g => {
            if (actTypeFilter === 'chase'       && g.type !== 'overdue')  return false
            if (actTypeFilter === 'date_change' && g.type !== 'at_risk')  return false
            if (actTypeFilter === 'dc_booking'  && g.type !== 'late_dc')  return false
            if (actTypeFilter === 'decision'    && getCardState(g) !== 'decision-needed') return false
            if (urgencyFilter  === 'overdue'    && g.type !== 'overdue')  return false
            if (urgencyFilter  === 'at_risk'    && g.type !== 'at_risk')  return false
            if (urgencyFilter  === 'routine'    && g.type !== 'late_dc')  return false
            return true
          })
          const sorted = [...filtered].sort((a, b) =>
            sortMode === 'alpha'
              ? (getSupplier(a.supplierId)?.name ?? '').localeCompare(getSupplier(b.supplierId)?.name ?? '')
              : cardScore(b) - cardScore(a)
          )
          const withHeaders = sorted.map((g, i) => ({ g, showHeader: i === 0 || sorted[i-1].supplierId !== g.supplierId }))

          // ── Drawer data ──────────────────────────────────────────────────
          const drawerGroup    = actionGroups.find(g => cardKey(g) === drawerCardKey) ?? null
          const drawerSup      = drawerGroup ? getSupplier(drawerGroup.supplierId) : null
          const drawerThread   = drawerGroup ? chaseThreads[drawerGroup.supplierId] : null
          const drawerState    = drawerGroup ? getCardState(drawerGroup) : null
          const drawerAllGrps  = drawerGroup ? (supplierEntries.find(e => e.supplierId === drawerGroup.supplierId)?.groups ?? [drawerGroup]) : []
          const drawerDraftKey = drawerGroup?.supplierId ?? ''
          const drawerDefault  = drawerGroup ? generateDraftEmail(drawerAllGrps) : ''
          const drawerDraft    = chaseDraftMap[drawerDraftKey] ?? drawerDefault
          const drawerDirty    = drawerDraft !== drawerDefault
          const drawerMuts     = drawerGroup ? (proposedMutations[drawerGroup.supplierId] ?? []) : []
          const drawerDecChoice = drawerCardKey ? drawerDecision[drawerCardKey] : undefined
          const drawerMaxOverdue = drawerGroup?.type === 'overdue' ? Math.max(...drawerGroup.pos.map(p => daysOverdue(p))) : 0
          const drawerOrderVal   = drawerGroup ? drawerGroup.pos.reduce((s, p) => s + parseOrderVal(p.orderValue), 0) : 0
          const cprPct = 10
          const cprSaving = Math.round(drawerOrderVal * cprPct / 100)
          const drawerViewPO = drawerViewPOId ? (ALL_POS.find(p => p.id === drawerViewPOId) ?? null) : null
          const drawerCurrentPill = drawerCardKey
            ? (selectedActionPill[drawerCardKey] ?? (
                drawerGroup?.type === 'at_risk' ? 'approve_date' :
                drawerGroup?.type === 'late_dc' ? 'confirm_booking' :
                drawerState === 'decision-needed' ? 'decision' : 'chase'
              ))
            : 'chase'
          const hasExplicitSelection = !!(drawerCardKey && selectedActionPill[drawerCardKey])
          const drawerUiState: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' = (() => {
            if (!drawerCardKey) return 'A'
            if (resolvedCards.has(drawerCardKey)) return 'E'
            if (drawerState === 'reply-received') return 'D'
            if (drawerState === 'no-reply-overdue') return 'F'
            if (drawerState === 'awaiting-reply') return 'C'
            if (hasExplicitSelection) return 'B'
            return 'A'
          })()
          // DP2 derived state
          const currentDp2Action = drawerCardKey ? (dp2Action[drawerCardKey] ?? 'apply_changes') : 'apply_changes'
          const dp2DefaultDraft = (drawerGroup && drawerSup) ? generateDP2Draft(currentDp2Action, drawerSup, drawerMuts) : ''
          const currentDp2Draft = drawerCardKey ? (dp2Draft[drawerCardKey] ?? dp2DefaultDraft) : dp2DefaultDraft
          // DP3 derived state
          const currentDp3Action = drawerCardKey ? (dp3Action[drawerCardKey] ?? 'followup_chase') : 'followup_chase'
          const daysSinceChase = drawerThread ? Math.floor((Date.now() - new Date(drawerThread.startedAt).getTime()) / 86400000) : 3
          const dp3DefaultDraft = (drawerGroup && drawerSup) ? generateDP3Draft(currentDp3Action, drawerGroup, drawerSup, Math.max(daysSinceChase, 3)) : ''
          const currentDp3Draft = drawerCardKey ? (dp3Draft[drawerCardKey] ?? dp3DefaultDraft) : dp3DefaultDraft
          const selectedActionLabel = (() => {
            if (!drawerCardKey) return ''
            const pill = selectedActionPill[drawerCardKey]
            return ({ chase:'Chase supplier', decision:'Make commercial decision', approve_date:'Approve date change', counter:'Counter-propose', reject:'Reject', confirm_booking:'Confirm DC booking', alt_slot:'Request alternate slot' } as Record<string,string>)[pill] ?? pill
          })()
          const cpDate = drawerCardKey ? (counterProposeDate[drawerCardKey] ?? '') : ''
          const rrText = drawerCardKey ? (rejectReason[drawerCardKey] ?? '') : ''
          const nl = '\n'
          const actionDraftBody = (() => {
            if (!drawerGroup || !drawerSup) return ''
            const pill = drawerCurrentPill
            const closing = nl + nl + 'Kind regards,' + nl + 'Debenhams Buying Team'
            const poList = drawerGroup.pos.map(p => '- ' + p.id + ': ' + p.product + ' (Due: ' + formatDate(p.expectedDelivery) + ')').join(nl)
            if (pill === 'approve_date') return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'Thank you for advising of the revised schedule. We confirm acceptance of the updated dates for:' + nl + nl + poList + nl + nl + 'Please update your records and ensure freight is booked accordingly.' + closing
            if (pill === 'counter') {
              const d = cpDate ? new Date(cpDate).toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'}) : '[DATE TBC]'
              return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'Thank you for your communication. We are unable to accept the dates as proposed and would like to counter-propose delivery by ' + d + ' for:' + nl + nl + poList + nl + nl + 'Please confirm whether this revised schedule is achievable.' + closing
            }
            if (pill === 'reject') {
              const rp = rrText ? (nl + nl + 'Reason: ' + rrText) : ''
              return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'We formally reject the proposed date changes for the following orders:' + rp + nl + nl + poList + nl + nl + 'The original delivery dates remain contractually binding. Please advise on your plan to meet the original schedule.' + closing
            }
            if (pill === 'confirm_booking') return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'We confirm the DC delivery booking for:' + nl + nl + poList + nl + nl + 'Please ensure goods are ready at the confirmed slot and share your freight booking reference.' + closing
            if (pill === 'alt_slot') return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'We are writing to request an alternate delivery slot for:' + nl + nl + poList + nl + nl + 'The current booking does not align with our receiving schedule. Please provide available alternative dates.' + closing
            if (pill === 'decision' && drawerDecChoice) {
              const decPoList = drawerGroup.pos.map(p => '- ' + p.id + ': ' + p.product).join(nl)
              if (drawerDecChoice === 'cancel') return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'Following our review, we are cancelling the following orders:' + nl + decPoList + nl + nl + 'Please confirm and advise on any cancellation charges.' + closing
              if (drawerDecChoice === 'cpr') return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'We would like to negotiate a CPR of ' + cprPct + '% on the following delayed orders:' + nl + decPoList + nl + nl + 'Please confirm acceptance in writing.' + closing
              return 'Dear ' + drawerSup.name + ' Team,' + nl + nl + 'We will accept the late delivery for:' + nl + decPoList + nl + nl + 'Please confirm the revised delivery date.' + closing
            }
            return chaseDraftMap[drawerDraftKey] ?? drawerDefault
          })()
          const isLogNoteOpen = !!(drawerCardKey && logNoteOpen[drawerCardKey])
          const currentLogNoteType = drawerCardKey ? (logNoteType[drawerCardKey] ?? 'note') : 'note'
          const currentLogNoteText = drawerCardKey ? (logNoteText[drawerCardKey] ?? '') : ''
          const isSnoozeConfirm = !!(drawerCardKey && snoozeConfirmOpen[drawerCardKey])
          const isDismissConfirm = !!(drawerCardKey && dismissConfirmOpen[drawerCardKey])
          type DrawerThreadEntry =
            | { kind: 'outbound';      id: string; sender: string; timestamp: string; body: string; poIds: string[] }
            | { kind: 'inbound';       id: string; sender: string; timestamp: string; body: string }
            | { kind: 'agent_summary'; id: string; timestamp: string; mutations: typeof drawerMuts }
            | { kind: 'note';          id: string; author: string;  timestamp: string; body: string; noteType?: 'call' | 'note' | 'internal' }
            | { kind: 'system_event';  id: string; timestamp: string; body: string }
          const drawerThreadEntries: DrawerThreadEntry[] = (() => {
            if (!drawerGroup) return []
            const entries: DrawerThreadEntry[] = []
            const messages = drawerThread?.messages ?? []
            messages.forEach((m, idx) => {
              if (m.sender === 'you' || m.sender === 'agent') {
                entries.push({ kind: 'outbound' as const, id: m.id, sender: m.sender === 'you' ? 'You' : 'Agent (sent on your behalf)', timestamp: m.timestamp, body: m.body, poIds: drawerGroup.pos.map(p => p.id) })
              } else {
                entries.push({ kind: 'inbound' as const, id: m.id, sender: m.sender, timestamp: m.timestamp, body: m.body })
                // If the next message is agent summary (awaiting-review), inject an agent_summary entry
                const next = messages[idx + 1]
                if (next?.sender === 'agent' && next.status === 'awaiting-review' && drawerMuts.length > 0) {
                  const agentTs = new Date(new Date(m.timestamp).getTime() + 5000).toISOString()
                  entries.push({ kind: 'agent_summary' as const, id: `agsum-${m.id}`, timestamp: agentTs, mutations: drawerMuts })
                }
              }
            })
            drawerGroup.pos.forEach(p => {
              ;(poEventsMap.get(p.id) ?? []).filter(e => e.type === 'manual_note').forEach(e => {
                const body = e.body
                const noteType: 'call' | 'note' | 'internal' = body.startsWith('[Call] ') ? 'call' : body.startsWith('[Internal] ') ? 'internal' : 'note'
                entries.push({ kind: 'note' as const, id: e.id, author: e.author === 'buyer' ? 'You' : 'Agent', timestamp: e.timestamp, body, noteType })
              })
            })
            ;(drawerThread?.systemEvents ?? []).forEach(e => {
              entries.push({ kind: 'system_event' as const, id: e.id, timestamp: e.timestamp, body: e.body })
            })
            return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          })()

          const drawerTrigger      = drawerGroup?.triggerMessage ?? null
          const triggerIsExpanded  = !!(drawerCardKey && triggerExpanded[drawerCardKey])

          // ── State → visual mapping ───────────────────────────────────────
          const stateBar   = { 'agent-drafted': 'bg-purple-500', 'decision-needed': 'bg-red-500', 'awaiting-reply': 'bg-gray-300', 'reply-received': 'bg-blue-500', 'no-reply-overdue': 'bg-amber-500', 'snoozed': 'bg-gray-200' }
          const statePillCls = { 'agent-drafted': 'bg-purple-100 text-purple-700', 'decision-needed': 'bg-red-100 text-red-700', 'awaiting-reply': 'bg-gray-100 text-gray-500', 'reply-received': 'bg-blue-100 text-blue-700', 'no-reply-overdue': 'bg-amber-100 text-amber-700', 'snoozed': 'bg-gray-100 text-gray-400' }
          const statePillLbl = { 'agent-drafted': 'Agent drafted', 'decision-needed': 'Decision needed', 'awaiting-reply': 'Awaiting reply', 'reply-received': 'Reply received', 'no-reply-overdue': 'No reply — overdue', 'snoozed': 'Snoozed' }
          const stateCTA     = { 'agent-drafted': 'Review draft', 'decision-needed': 'Make decision', 'awaiting-reply': 'View thread', 'reply-received': 'Review reply', 'no-reply-overdue': 'No reply — act', 'snoozed': 'Unsnoozed' }
          const actionTypeLbl = (g: ActionGroup) => g.type === 'overdue' ? 'Chase' : g.type === 'at_risk' ? 'Approve date change' : 'Confirm DC booking'
          const actionTypeCls = (g: ActionGroup) => g.type === 'overdue' ? 'bg-red-50 text-red-600' : g.type === 'at_risk' ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-amber-600'

          const headline = (g: ActionGroup) => {
            const totalVal = g.pos.reduce((s, p) => s + parseOrderVal(p.orderValue), 0)
            const valStr = totalVal > 0 ? ` · £${totalVal.toLocaleString()} at risk` : ''
            if (g.type === 'overdue') return `${g.pos.length} PO${g.pos.length > 1 ? 's' : ''} overdue by up to ${Math.max(...g.pos.map(p => daysOverdue(p)))} days${valStr}`
            if (g.type === 'at_risk') return `${g.pos.length} date change${g.pos.length > 1 ? 's' : ''} requested${valStr}`
            return `${g.pos.length} PO${g.pos.length > 1 ? 's' : ''} with unconfirmed DC booking${valStr}`
          }
          const agentRec = (g: ActionGroup, state: string) => {
            if (state === 'awaiting-reply') return 'Waiting for supplier response — no action needed'
            if (state === 'reply-received') return 'Agent summary: supplier replied — review proposed date changes'
            if (state === 'decision-needed') return `Agent observation: ${Math.max(...g.pos.map(p => daysOverdue(p)))}d late — cancellation or CPR may recover margin`
            if (g.type === 'overdue') return `Agent recommends: urgent chase covering ${g.pos.length > 1 ? 'all ' + g.pos.length + ' orders' : 'this order'}`
            if (g.type === 'at_risk') return 'Agent recommends: request root cause and revised schedule'
            return 'Agent recommends: confirm freight forwarder booking reference'
          }

          return (
          <>
            {/* ── Stats strip ───────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-3 mb-1">
              {[
                { label: 'Actions awaiting you', value: awaitingUser,   color: 'text-gray-900', bg: 'bg-white border border-gray-100' },
                { label: '£ value at risk',       value: `£${valueAtRisk.toLocaleString()}`, color: 'text-red-600',   bg: 'bg-red-50 border border-red-100' },
                { label: 'Decisions pending',     value: decisionsPend, color: 'text-red-700',  bg: 'bg-red-50 border border-red-100' },
                { label: 'Awaiting reply',         value: awaitingReply, color: 'text-gray-500', bg: 'bg-gray-50 border border-gray-100' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-xl p-4 ${bg}`}>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {/* Secondary status pills */}
            <div className="flex items-center gap-2 flex-wrap pb-1">
              {[
                { label: 'On track',      count: onTrackPOs.length,      cls: 'bg-green-50 text-green-700 border-green-100' },
                { label: 'Late DC',       count: preDispatchPOs.length,   cls: 'bg-amber-50 text-amber-700 border-amber-100' },
                { label: 'At risk',       count: atRiskPOs.length,        cls: 'bg-orange-50 text-orange-700 border-orange-100' },
                { label: 'Overdue',       count: overduePOs.length,       cls: 'bg-red-50 text-red-700 border-red-100' },
              ].map(({ label, count, cls }) => (
                <span key={label} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
                  <span className="font-bold">{count}</span> {label}
                </span>
              ))}
            </div>

            {/* ── Filter bar ────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter</span>
              {[
                { value: 'all',         label: 'All types' },
                { value: 'chase',       label: 'Chase' },
                { value: 'date_change', label: 'Date change' },
                { value: 'dc_booking',  label: 'DC booking' },
                { value: 'decision',    label: 'Decision' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setActTypeFilter(opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${actTypeFilter === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {opt.label}
                </button>
              ))}
              <div className="w-px h-4 bg-gray-200 mx-1" />
              {[
                { value: 'all',      label: 'Any urgency' },
                { value: 'overdue',  label: 'Overdue' },
                { value: 'at_risk',  label: 'At risk' },
                { value: 'routine',  label: 'Routine' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setUrgencyFilter(opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${urgencyFilter === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {opt.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 font-medium">Sort:</span>
                <button onClick={() => setSortMode(m => m === 'urgency_value' ? 'alpha' : 'urgency_value')}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  {sortMode === 'urgency_value' ? '↓ Value at risk' : 'A–Z Supplier'}
                </button>
              </div>
            </div>

            {/* ── Queue + Drawer ─────────────────────────────────────────── */}
            <div className="relative flex gap-0 min-h-[500px]">
              {/* Queue */}
              <div className={`flex-1 space-y-1 transition-opacity duration-200 ${drawerCardKey ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                {withHeaders.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Check className="w-10 h-10 mb-3 text-green-300" />
                    <p className="text-sm font-semibold">No actions match the current filters</p>
                    <p className="text-xs mt-1">Adjust filters above or check back later</p>
                  </div>
                )}
                {withHeaders.map(({ g, showHeader }) => {
                  const sup   = getSupplier(g.supplierId)
                  const state = getCardState(g)
                  const ck    = cardKey(g)
                  const isOpen = drawerCardKey === ck
                  return (
                    <div key={ck}>
                      {/* Supplier divider header */}
                      {showHeader && (
                        <div className="flex items-center gap-3 pt-3 pb-1 px-1">
                          <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
                            <Building2 className="w-3 h-3 text-indigo-600" />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{sup?.name ?? g.supplierId}</span>
                          {sup && (() => {
                            const pat = getRelationshipPattern(sup)
                            if (pat === 'structural') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Structural underperformer</span>
                            if (pat === 'concentration') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">High concentration &middot; {sup.openPOs} open POs</span>
                            return null
                          })()}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sup && (
                              <>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sup.onTimeRate >= 80 ? 'bg-green-50 text-green-700 border-green-100' : sup.onTimeRate >= 70 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'}`}>OTR {sup.onTimeRate}%</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sup.avgDelayDays > 7 ? 'bg-red-50 text-red-700 border-red-100' : sup.avgDelayDays > 3 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>Avg delay {sup.avgDelayDays}d</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">{sup.openPOs} open POs</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Action card */}
                      <div
                        onClick={() => setDrawerCardKey(isOpen ? null : ck)}
                        className={`relative flex items-stretch bg-white border rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md ${isOpen ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-gray-100'} ${state === 'snoozed' ? 'opacity-50' : ''}`}
                      >
                        {/* Left colour bar */}
                        <div className={`w-1 rounded-l-xl shrink-0 ${stateBar[state]}`} />
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statePillCls[state]}`}>{statePillLbl[state]}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${actionTypeCls(g)}`}>{actionTypeLbl(g)}</span>
                          </div>
                          <div className="text-sm font-bold text-gray-900 mb-0.5">{headline(g)}</div>
                          <div className="text-xs text-gray-500 mb-1.5">
                            {g.pos.length <= 2
                              ? g.pos.map(p => p.id).join(', ')
                              : `${g.pos[0].id}, ${g.pos[1].id} +${g.pos.length - 2} more`
                            }
                          </div>
                          <div className="text-xs text-gray-400 italic">{agentRec(g, state)}</div>
                        </div>
                        <div className="flex flex-col items-end justify-between p-4 shrink-0 gap-3">
                          <button
                            onClick={e => { e.stopPropagation(); setDrawerCardKey(isOpen ? null : ck) }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${state === 'agent-drafted' ? 'bg-purple-600 hover:bg-purple-700 text-white' : state === 'decision-needed' ? 'bg-red-600 hover:bg-red-700 text-white' : state === 'reply-received' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                          >{stateCTA[state]}</button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); setSnoozedCards(prev => { const n = new Set(prev); n.has(ck) ? n.delete(ck) : n.add(ck); return n }) }}
                              className="text-[10px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                            >{snoozedCards.has(ck) ? 'Unsnooze' : 'Snooze 3d'}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Drawer ────────────────────────────────────────────────── */}
              {drawerCardKey && drawerGroup && drawerSup && (
                <div
                  className="fixed top-0 right-0 bottom-0 bg-white border-l border-gray-100 shadow-2xl flex flex-col z-40 overflow-hidden transition-[width] duration-200 ease-out"
                  style={{ width: drawerView === 'action' ? 520 : 640 }}
                  onKeyDown={e => { if (e.key === 'Escape') { if (drawerView === 'po-detail') { setDrawerView('action'); setDrawerViewPOId(null) } else setDrawerCardKey(null) } }}
                >
                  {/* Drawer header */}
                  <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
                    {drawerView === 'action' ? (
                      <>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${drawerState ? statePillCls[drawerState] : ''}`}>{drawerState ? statePillLbl[drawerState] : ''}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${actionTypeCls(drawerGroup)}`}>{actionTypeLbl(drawerGroup)}</span>
                            </div>
                            <div className="text-base font-bold text-gray-900">{drawerSup.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{SUPPLIER_EMAILS[drawerGroup.supplierId]} · {drawerGroup.pos.length} PO{drawerGroup.pos.length > 1 ? 's' : ''}</div>
                          </div>
                          <button onClick={() => setDrawerCardKey(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${drawerSup.onTimeRate >= 80 ? 'bg-green-50 text-green-700 border-green-100' : drawerSup.onTimeRate >= 70 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'}`}>OTR {drawerSup.onTimeRate}%</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${drawerSup.avgDelayDays > 7 ? 'bg-red-50 text-red-700 border-red-100' : drawerSup.avgDelayDays > 3 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>Avg delay {drawerSup.avgDelayDays}d</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">{drawerSup.openPOs} open POs</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100">Lead {drawerSup.contractualLeadTimeDays}d</span>
                        </div>
                      </>
                    ) : (
                      /* View 2 breadcrumb */
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setDrawerView('action'); setDrawerViewPOId(null) }}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />{drawerSup.name}
                        </button>
                        <span className="text-gray-300">/</span>
                        <span className="text-xs text-gray-700 font-semibold">{drawerViewPOId}</span>
                        <button onClick={() => setDrawerCardKey(null)} className="ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>

                  {/* Drawer body */}
                  <div className="flex-1 overflow-y-auto flex flex-col">

                    {/* ── View 1: Action panels ───────────────────────────── */}
                    {drawerView === 'action' && (
                    <>

                    {/* PO table — click a row to open PO detail (View 2) */}
                    <div className="border-b border-gray-100 px-6 py-3 shrink-0">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">POs in this action</div>
                      <div className="space-y-0.5">
                        {drawerGroup.pos.map(p => {
                          const pRag = computeRAG(p)
                          const ragDot = pRag === 'red' ? 'bg-red-500' : pRag === 'amber' ? 'bg-amber-400' : 'bg-green-400'
                          return (
                            <button
                              key={p.id}
                              onClick={() => { setDrawerViewPOId(p.id); setDrawerView('po-detail') }}
                              className="w-full flex items-center gap-2 text-[11px] py-1.5 px-2 rounded-lg text-left hover:bg-indigo-50 hover:text-indigo-900 text-gray-600 transition-colors group"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ragDot}`} />
                              <span className="font-mono font-semibold text-gray-800">{p.id}</span>
                              <span className="flex-1 truncate text-gray-500">{p.product}</span>
                              <span className="shrink-0 text-gray-400">{formatDate(p.expectedDelivery)}</span>
                              <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-indigo-500 shrink-0" />
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── Trigger context block ─────────────────────────── */}
                    {drawerTrigger && (
                      <div className="border-b border-gray-100 px-6 py-4 shrink-0">
                        {(drawerUiState === 'A' || drawerUiState === 'B') ? (
                          <div className="bg-sky-50/70 border border-sky-100 rounded-xl px-4 py-3 space-y-2">
                            {drawerTrigger.agentSummary ? (
                              <>
                                <div className="flex items-center gap-1.5 text-[10px] text-sky-700">
                                  <Sparkles className="w-2.5 h-2.5 shrink-0 text-sky-500" />
                                  <span className="font-semibold">{drawerTrigger.sender}</span>
                                  <span className="text-sky-300">·</span>
                                  <span className="text-sky-500">{new Date(drawerTrigger.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-[11px] text-sky-900 leading-relaxed">{drawerTrigger.agentSummary}</p>
                                <button
                                  onClick={() => setTriggerExpanded(prev => ({ ...prev, [drawerCardKey!]: !prev[drawerCardKey!] }))}
                                  className="text-[10px] text-sky-600 hover:text-sky-800 font-medium transition-colors"
                                >{triggerIsExpanded ? '▾ Hide original' : '▸ View original message'}</button>
                                {triggerIsExpanded && (
                                  <div className="pt-2 border-t border-sky-100">
                                    <pre className="text-[10px] text-sky-800 whitespace-pre-wrap font-sans leading-relaxed">{drawerTrigger.body}</pre>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5 text-[10px] text-sky-700">
                                  <span className="font-semibold">{drawerTrigger.sender}</span>
                                  <span className="text-sky-300">·</span>
                                  <span className="text-sky-500">{new Date(drawerTrigger.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-[11px] text-sky-900 italic leading-relaxed border-l-2 border-sky-200 pl-2.5 line-clamp-3">
                                  &ldquo;{drawerTrigger.body}&rdquo;
                                </p>
                                <button
                                  onClick={() => setTriggerExpanded(prev => ({ ...prev, [drawerCardKey!]: !prev[drawerCardKey!] }))}
                                  className="text-[10px] text-sky-600 hover:text-sky-800 font-medium transition-colors"
                                >{triggerIsExpanded ? '▾ Hide' : (drawerTrigger.priorMessages?.length ? `▸ View full thread (${drawerTrigger.priorMessages.length + 1} messages)` : '▸ View full message')}</button>
                                {triggerIsExpanded && (
                                  <div className="pt-2 border-t border-sky-100">
                                    <pre className="text-[10px] text-sky-800 whitespace-pre-wrap font-sans leading-relaxed">{drawerTrigger.body}</pre>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="pt-1.5 border-t border-sky-100">
                              <button
                                onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: true }))}
                                className="text-[10px] text-sky-500 hover:text-sky-700 transition-colors"
                              >+ Log call or note</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-2.5 h-2.5 text-gray-300 shrink-0" />
                              <span>Triggered by: <span className="font-medium text-gray-500">{drawerTrigger.sender}</span> · {new Date(drawerTrigger.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                              <button
                                onClick={() => setTriggerExpanded(prev => ({ ...prev, [drawerCardKey!]: !prev[drawerCardKey!] }))}
                                className="ml-1 text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                              >{triggerIsExpanded ? 'hide' : 'view'}</button>
                            </div>
                            {triggerIsExpanded && (
                              <div className="mt-2 bg-sky-50/70 border border-sky-100 rounded-xl px-3 py-2.5">
                                <p className="text-[10px] text-sky-900 leading-relaxed">{drawerTrigger.agentSummary ?? drawerTrigger.body}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Decision panel ──────────────────────────────────── */}
                    {/* DP1: States A & B */}
                    {(drawerUiState === 'A' || drawerUiState === 'B') && (
                      <div className="border-b border-gray-100 px-6 py-4 shrink-0">
                        {drawerUiState === 'A' ? (
                          <>
                            {drawerGroup.type === 'overdue' ? (() => {
                              const poRec = getPORecommendation(drawerGroup, drawerSup, drawerMaxOverdue, drawerOrderVal, cprPct)
                              const pattern = getRelationshipPattern(drawerSup)
                              const recBg = pattern === 'structural' ? 'bg-red-50 border-red-200' : pattern === 'concentration' ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'
                              const recHd = pattern === 'structural' ? 'text-red-800' : pattern === 'concentration' ? 'text-amber-800' : 'text-indigo-800'
                              const recBody = pattern === 'structural' ? 'text-red-700' : pattern === 'concentration' ? 'text-amber-700' : 'text-indigo-700'
                              return (
                                <>
                                  <p className="text-[13px] font-bold text-gray-900 mb-0.5">What should we do about {drawerSup.name}?</p>
                                  <p className="text-[11px] text-gray-400 mb-3">
                                    {drawerGroup.pos.length} PO{drawerGroup.pos.length > 1 ? 's' : ''} &middot; £{drawerOrderVal.toLocaleString()} at risk &middot; {drawerMaxOverdue}d overdue
                                  </p>
                                  <div className={`border rounded-xl px-4 py-3 mb-3 ${recBg}`}>
                                    <p className={`text-[11px] font-bold mb-1 ${recHd}`}>Recommendation: {poRec.primaryLabel.split('(')[0].trim().replace(/\+$/, '').trim()}.</p>
                                    <p className={`text-[11px] leading-relaxed ${recBody}`}>{poRec.rationale}</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (poRec.action === 'chase') {
                                        setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'chase' }))
                                      } else {
                                        setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'decision' }))
                                        setDrawerDecision(prev => ({ ...prev, [drawerCardKey!]: poRec.action as 'accept_late' | 'cpr' | 'cancel' }))
                                      }
                                    }}
                                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 text-left mb-3 transition-colors"
                                  >
                                    <div className="text-[12px] font-bold">{poRec.primaryLabel}</div>
                                    <div className="text-[10px] text-indigo-200 mt-0.5">{poRec.primaryForecast}</div>
                                  </button>
                                  <div className="grid grid-cols-3 gap-2 mb-3">
                                    {poRec.altOptions.map(opt => (
                                      <button
                                        key={opt.key}
                                        onClick={() => {
                                          if (opt.key === 'chase') {
                                            setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'chase' }))
                                          } else {
                                            setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'decision' }))
                                            setDrawerDecision(prev => ({ ...prev, [drawerCardKey!]: opt.key as 'accept_late' | 'cpr' | 'cancel' }))
                                          }
                                        }}
                                        className="border border-gray-200 rounded-xl px-2 py-2 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                      >
                                        <div className="text-[11px] font-semibold text-gray-700 leading-tight">{opt.label}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.forecast}</div>
                                      </button>
                                    ))}
                                  </div>
                                  <details className="mb-3">
                                    <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                                      ▸ Why this recommendation?
                                    </summary>
                                    <div className="mt-2 space-y-1 pl-3 border-l-2 border-gray-100">
                                      <div className="text-[11px] text-gray-500">OTR: <span className="font-semibold text-gray-700">{drawerSup.onTimeRate}%</span></div>
                                      <div className="text-[11px] text-gray-500">Avg delay: <span className="font-semibold text-gray-700">{drawerSup.avgDelayDays}d</span></div>
                                      <div className="text-[11px] text-gray-500">Days overdue (max): <span className="font-semibold text-gray-700">{drawerMaxOverdue}d</span></div>
                                      <div className="text-[11px] text-gray-500">Est. cover remaining: <span className="font-semibold text-gray-700">~{SUPPLIER_COVER_WEEKS[drawerSup.id] ?? 6}w</span></div>
                                      <div className="text-[11px] text-gray-500">Open POs: <span className="font-semibold text-gray-700">{drawerSup.openPOs}</span></div>
                                      <div className="text-[11px] text-gray-500">Pattern: <span className="font-semibold text-gray-700 capitalize">{pattern}</span></div>
                                    </div>
                                  </details>
                                  <div className="border border-dashed border-gray-200 rounded-xl px-4 py-4 text-center">
                                    <p className="text-[11px] text-gray-400">Once you choose an action, the agent will draft the communication or record the decision.</p>
                                  </div>
                                  <div className="flex items-center gap-3 mt-3">
                                    {isSnoozeConfirm ? (
                                      <span className="text-[11px] text-gray-600">Reappear in 3 days?
                                        <button onClick={() => { setSnoozedCards(prev => { const n = new Set(prev); n.add(drawerCardKey!); return n }); setDrawerCardKey(null) }} className="ml-1.5 font-semibold text-indigo-600 hover:text-indigo-800">Confirm</button>
                                        <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="ml-1.5 text-gray-400 hover:text-gray-600">Cancel</button>
                                      </span>
                                    ) : (
                                      <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: true }))} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Snooze 3 days</button>
                                    )}
                                  </div>
                                </>
                              )
                            })() : (() => {
                              const snoozeRow = (
                                <div className="flex items-center gap-3 mt-3">
                                  {isSnoozeConfirm ? (
                                    <span className="text-[11px] text-gray-600">Reappear in 3 days?
                                      <button onClick={() => { setSnoozedCards(prev => { const n = new Set(prev); n.add(drawerCardKey!); return n }); setDrawerCardKey(null) }} className="ml-1.5 font-semibold text-indigo-600 hover:text-indigo-800">Confirm</button>
                                      <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="ml-1.5 text-gray-400 hover:text-gray-600">Cancel</button>
                                    </span>
                                  ) : isDismissConfirm ? (
                                    <span className="text-[11px] text-gray-600">Dismiss without action?
                                      <button onClick={() => { setSnoozedCards(prev => { const n = new Set(prev); n.add(drawerCardKey!); return n }); setDrawerCardKey(null) }} className="ml-1.5 font-semibold text-red-600 hover:text-red-800">Confirm</button>
                                      <button onClick={() => setDismissConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="ml-1.5 text-gray-400 hover:text-gray-600">Cancel</button>
                                    </span>
                                  ) : (
                                    <>
                                      <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: true }))} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Snooze 3 days</button>
                                      <button onClick={() => setDismissConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: true }))} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Dismiss</button>
                                    </>
                                  )}
                                </div>
                              )

                              // ── Tier 1: Approve date change (at_risk) ──────────────
                              if (drawerGroup.type === 'at_risk') {
                                const daysPushed = Math.max(...drawerGroup.pos.map(p => {
                                  if (!p.revisedDelivery) return 0
                                  return Math.round((new Date(p.revisedDelivery).getTime() - new Date(p.expectedDelivery).getTime()) / 86400000)
                                }))
                                const substantiveReason = isSubstantiveReason(drawerGroup.triggerMessage)
                                const dateRec = getDateChangeRecommendation(drawerGroup, drawerSup, daysPushed, substantiveReason, drawerOrderVal)
                                const pattern = getRelationshipPattern(drawerSup)
                                const recBg   = pattern === 'structural' ? 'bg-red-50 border-red-200' : pattern === 'concentration' ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'
                                const recHd   = pattern === 'structural' ? 'text-red-800' : pattern === 'concentration' ? 'text-amber-800' : 'text-indigo-800'
                                const recBody = pattern === 'structural' ? 'text-red-700' : pattern === 'concentration' ? 'text-amber-700' : 'text-indigo-700'
                                return (
                                  <>
                                    <p className="text-[13px] font-bold text-gray-900 mb-0.5">Should we approve {drawerSup.name}'s date change?</p>
                                    <p className="text-[11px] text-gray-400 mb-3">
                                      {drawerGroup.pos.length} PO{drawerGroup.pos.length > 1 ? 's' : ''} · £{drawerOrderVal.toLocaleString()} at risk · {daysPushed}-day push requested
                                    </p>
                                    <div className={`border rounded-xl px-4 py-3 mb-3 ${recBg}`}>
                                      <p className={`text-[11px] font-bold mb-1 ${recHd}`}>Recommendation: {dateRec.primaryLabel.split('(')[0].trim().replace(/\+$/, '').trim()}.</p>
                                      <p className={`text-[11px] leading-relaxed ${recBody}`}>{dateRec.rationale}</p>
                                    </div>
                                    <button
                                      onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: dateRec.action }))}
                                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 text-left mb-3 transition-colors"
                                    >
                                      <div className="text-[12px] font-bold">{dateRec.primaryLabel}</div>
                                      <div className="text-[10px] text-indigo-200 mt-0.5">{dateRec.primaryForecast}</div>
                                    </button>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                      {dateRec.altOptions.map(opt => (
                                        <button
                                          key={opt.key}
                                          onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: opt.key }))}
                                          className="border border-gray-200 rounded-xl px-2 py-2 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                        >
                                          <div className="text-[11px] font-semibold text-gray-700 leading-tight">{opt.label}</div>
                                          <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.forecast}</div>
                                        </button>
                                      ))}
                                    </div>
                                    <details className="mb-3">
                                      <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                                        ▸ Why this recommendation?
                                      </summary>
                                      <div className="mt-2 space-y-1 pl-3 border-l-2 border-gray-100">
                                        <div className="text-[11px] text-gray-500">OTR: <span className="font-semibold text-gray-700">{drawerSup.onTimeRate}%</span></div>
                                        <div className="text-[11px] text-gray-500">Days push: <span className="font-semibold text-gray-700">{daysPushed}d</span></div>
                                        <div className="text-[11px] text-gray-500">Est. cover remaining: <span className="font-semibold text-gray-700">~{SUPPLIER_COVER_WEEKS[drawerSup.id] ?? 6}w</span></div>
                                        <div className="text-[11px] text-gray-500">Reason quality: <span className="font-semibold text-gray-700">{substantiveReason ? 'Substantive' : 'Non-substantive'}</span></div>
                                        <div className="text-[11px] text-gray-500">Avg delay (hist.): <span className="font-semibold text-gray-700">{drawerSup.avgDelayDays}d</span></div>
                                        <div className="text-[11px] text-gray-500">Pattern: <span className="font-semibold text-gray-700 capitalize">{pattern}</span></div>
                                      </div>
                                    </details>
                                    <div className="border border-dashed border-gray-200 rounded-xl px-4 py-4 text-center mb-1">
                                      <p className="text-[11px] text-gray-400">Once you choose an action, the agent will draft the communication or record the decision.</p>
                                    </div>
                                    {snoozeRow}
                                  </>
                                )
                              }

                              // ── Tier 1/2/3: DC booking (late_dc) ──────────────────
                              const dcTier = drawerSup.onTimeRate < 70 ? 1 : drawerSup.onTimeRate > 85 ? 3 : 2

                              // Tier 1 upgrade: structurally unreliable supplier
                              if (dcTier === 1) {
                                const pattern = getRelationshipPattern(drawerSup)
                                const recBg   = 'bg-red-50 border-red-200'
                                const recHd   = 'text-red-800'
                                const recBody = 'text-red-700'
                                void pattern
                                return (
                                  <>
                                    <p className="text-[13px] font-bold text-gray-900 mb-0.5">How do we handle {drawerSup.name}'s DC booking?</p>
                                    <p className="text-[11px] text-gray-400 mb-3">
                                      {drawerGroup.pos.length} PO{drawerGroup.pos.length > 1 ? 's' : ''} · £{drawerOrderVal.toLocaleString()} · Booking confirmation overdue
                                    </p>
                                    <div className={`border rounded-xl px-4 py-3 mb-3 ${recBg}`}>
                                      <p className={`text-[11px] font-bold mb-1 ${recHd}`}>Recommendation: Investigate root cause.</p>
                                      <p className={`text-[11px] leading-relaxed ${recBody}`}>
                                        {drawerSup.name}'s OTR is {drawerSup.onTimeRate}% — a DC booking delay from a structurally unreliable supplier warrants investigation, not just a routine confirmation. A pattern of late bookings may signal deeper dispatch problems.
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'alt_slot' }))}
                                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 text-left mb-3 transition-colors"
                                    >
                                      <div className="text-[12px] font-bold">Request dispatch evidence first</div>
                                      <div className="text-[10px] text-indigo-200 mt-0.5">Request goods-ready confirmation before committing slot · Reduces booking risk</div>
                                    </button>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                      <button
                                        onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'confirm_booking' }))}
                                        className="border border-gray-200 rounded-xl px-2 py-2 text-left hover:bg-gray-50 transition-colors"
                                      >
                                        <div className="text-[11px] font-semibold text-gray-700 leading-tight">Confirm booking (accept risk)</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">Confirms slot at {drawerSup.onTimeRate}% OTR · Reliability risk remains</div>
                                      </button>
                                      <button
                                        onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'chase' }))}
                                        className="border border-gray-200 rounded-xl px-2 py-2 text-left hover:bg-gray-50 transition-colors"
                                      >
                                        <div className="text-[11px] font-semibold text-gray-700 leading-tight">Chase for update</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">Routine follow-up · May not resolve root cause</div>
                                      </button>
                                    </div>
                                    <details className="mb-3">
                                      <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                                        ▸ Why this recommendation?
                                      </summary>
                                      <div className="mt-2 space-y-1 pl-3 border-l-2 border-gray-100">
                                        <div className="text-[11px] text-gray-500">OTR: <span className="font-semibold text-gray-700">{drawerSup.onTimeRate}%</span></div>
                                        <div className="text-[11px] text-gray-500">Avg delay (hist.): <span className="font-semibold text-gray-700">{drawerSup.avgDelayDays}d</span></div>
                                        <div className="text-[11px] text-gray-500">Open POs: <span className="font-semibold text-gray-700">{drawerSup.openPOs}</span></div>
                                        <div className="text-[11px] text-gray-500">Pattern: <span className="font-semibold text-gray-700">Structural underperformer</span></div>
                                      </div>
                                    </details>
                                    <div className="border border-dashed border-gray-200 rounded-xl px-4 py-4 text-center mb-1">
                                      <p className="text-[11px] text-gray-400">Once you choose an action, the agent will draft the communication or record the decision.</p>
                                    </div>
                                    {snoozeRow}
                                  </>
                                )
                              }

                              // Tier 3: highly reliable supplier — transactional
                              if (dcTier === 3) {
                                const primaryPO    = drawerGroup.pos[0]
                                const dispatchStr  = new Date(primaryPO.expectedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                return (
                                  <>
                                    <p className="text-[13px] font-bold text-gray-900 mb-0.5">Confirm the DC booking with {drawerSup.name}?</p>
                                    <p className="text-[11px] text-gray-500 mb-3">
                                      {drawerSup.name} typically dispatches on schedule ({drawerSup.onTimeRate}% OTR). Agent will send booking confirmation when ready.
                                    </p>
                                    <button
                                      onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: 'confirm_booking' }))}
                                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 text-left mb-3 transition-colors"
                                    >
                                      <div className="text-[12px] font-bold">Confirm booking</div>
                                      <div className="text-[10px] text-indigo-200 mt-0.5">Locks in {dispatchStr} dispatch · DC slot reserved</div>
                                    </button>
                                    {snoozeRow}
                                  </>
                                )
                              }

                              // Tier 2: deliberate DC booking with recommendation banner
                              const dcRec       = getDCBookingRecommendation(drawerGroup, drawerSup)
                              const primaryPill = dcRec.action === 'confirm' ? 'confirm_booking' : 'alt_slot'
                              const altPill     = dcRec.action === 'confirm' ? 'alt_slot'        : 'confirm_booking'
                              return (
                                <>
                                  <p className="text-[13px] font-bold text-gray-900 mb-0.5">Confirm the DC booking with {drawerSup.name}?</p>
                                  <p className="text-[11px] text-gray-400 mb-3">
                                    {drawerGroup.pos.length} PO{drawerGroup.pos.length > 1 ? 's' : ''} · £{drawerOrderVal.toLocaleString()} · Expected dispatch {new Date(drawerGroup.pos[0].expectedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </p>
                                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 mb-3">
                                    <p className="text-[11px] text-indigo-800">
                                      <span className="font-bold">Recommendation: </span>{dcRec.recommendLine}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: primaryPill }))}
                                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 text-left mb-2 transition-colors"
                                  >
                                    <div className="text-[12px] font-bold">{dcRec.primaryLabel}</div>
                                    <div className="text-[10px] text-indigo-200 mt-0.5">{dcRec.primaryForecast}</div>
                                  </button>
                                  <button
                                    onClick={() => setSelectedActionPill(prev => ({ ...prev, [drawerCardKey!]: altPill }))}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors mb-3"
                                  >
                                    <div className="text-[11px] font-semibold text-gray-700">{dcRec.altLabel}</div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">{dcRec.altForecast}</div>
                                  </button>
                                  {snoozeRow}
                                </>
                              )
                            })()}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                <span className="text-[12px] font-semibold text-gray-800">Action: {selectedActionLabel}</span>
                              </div>
                              <button onClick={() => setSelectedActionPill(prev => { const n = { ...prev }; delete n[drawerCardKey!]; return n })} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors">Change action</button>
                            </div>
                            {drawerCurrentPill === 'decision' && (
                              <div className="mt-3 space-y-2.5">
                                <p className="text-[11px] text-gray-500 italic leading-relaxed">
                                  {drawerMaxOverdue}d overdue · OTR {drawerSup.onTimeRate}% · Avg delay {drawerSup.avgDelayDays}d · Est. cover ~{SUPPLIER_COVER_WEEKS[drawerSup.id] ?? 6}w
                                </p>
                                <div className="flex gap-2">
                                  {([
                                    { key: 'cancel'      as const, label: 'Cancel',         sub: `Cover loss: ~3 weeks before intake`,    cls: 'border-red-200 bg-red-50 hover:bg-red-100 text-red-800' },
                                    { key: 'cpr'         as const, label: `CPR ${cprPct}%`, sub: `Margin recovered: £${cprSaving.toLocaleString()}`, cls: 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800' },
                                    { key: 'accept_late' as const, label: 'Accept late',    sub: `Intake delayed: ${Math.ceil(drawerMaxOverdue/7)} weeks`, cls: 'border-green-200 bg-green-50 hover:bg-green-100 text-green-800' },
                                  ] as const).map(opt => {
                                    const chosen = drawerDecChoice === opt.key
                                    return (
                                      <button
                                        key={opt.key}
                                        onClick={() => setDrawerDecision(p => ({ ...p, [drawerCardKey!]: opt.key }))}
                                        className={`flex-1 border-2 rounded-xl p-2.5 text-center transition-all ${chosen ? 'ring-2 ring-offset-1 ring-indigo-400 ' + opt.cls : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
                                      >
                                        <div className="text-xs font-bold">{opt.label}</div>
                                        <div className={`text-[11px] font-semibold mt-0.5 ${chosen ? '' : 'text-gray-500'}`}>{opt.sub}</div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* DP2: State D — reply received decision panel */}
                    {drawerUiState === 'D' && (
                      <div className="border-b border-gray-100 px-6 py-4 shrink-0 space-y-3">
                        <p className="text-[11px] font-semibold text-gray-700">Supplier replied — what would you like to do?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { key: 'apply_changes'   as const, label: 'Apply proposed changes', sub: 'Accept & confirm in writing',  cls: 'border-green-200 hover:border-green-400 hover:bg-green-50',   selCls: 'border-green-500 bg-green-50 ring-2 ring-green-200'   },
                            { key: 'counter_propose' as const, label: 'Counter-propose',         sub: 'Push back with alternative',   cls: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50',   selCls: 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'   },
                            { key: 'reject_escalate' as const, label: 'Reject and escalate',    sub: 'Refuse, escalate internally',  cls: 'border-red-200 hover:border-red-400 hover:bg-red-50',         selCls: 'border-red-500 bg-red-50 ring-2 ring-red-200'         },
                            { key: 'reply_question'  as const, label: 'Reply with question',    sub: 'Need more info first',         cls: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50', selCls: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' },
                          ]).map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => {
                                setDp2Action(prev => ({ ...prev, [drawerCardKey!]: opt.key }))
                                setDp2Draft(prev => { const n = { ...prev }; delete n[drawerCardKey!]; return n })
                              }}
                              className={`border-2 rounded-xl p-3 text-left transition-all ${currentDp2Action === opt.key ? opt.selCls : opt.cls}`}
                            >
                              <div className="text-[12px] font-bold text-gray-800 leading-tight">{opt.label}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{opt.sub}</div>
                            </button>
                          ))}
                        </div>
                        {drawerMuts.length > 0 && (
                          <div className="bg-blue-50/70 border border-blue-100 rounded-xl px-3 py-2.5 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <Bot className="w-3 h-3 text-blue-500 shrink-0" />
                              <span className="text-[10px] font-bold text-blue-700">Parsed from reply</span>
                            </div>
                            <div className="space-y-0.5 font-mono text-[11px]">
                              {drawerMuts.map(m => (
                                <div key={m.poId} className="flex items-center gap-2">
                                  <span className="font-bold text-gray-700 shrink-0">{m.poId}</span>
                                  <span className="text-gray-400 shrink-0 font-sans">{m.field}:</span>
                                  <span className="text-red-500 line-through shrink-0">{m.oldVal}</span>
                                  <span className="text-gray-300 shrink-0">→</span>
                                  <span className="text-green-600 font-bold shrink-0">{m.newVal}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: true }))} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Snooze 3 days</button>
                          <button onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: true }))} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Log call or note</button>
                        </div>
                        {isSnoozeConfirm && (
                          <span className="text-[11px] text-gray-600">Reappear in 3 days?
                            <button onClick={() => { setSnoozedCards(prev => { const n = new Set(prev); n.add(drawerCardKey!); return n }); setDrawerCardKey(null) }} className="ml-1.5 font-semibold text-indigo-600 hover:text-indigo-800">Confirm</button>
                            <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="ml-1.5 text-gray-400 hover:text-gray-600">Cancel</button>
                          </span>
                        )}
                      </div>
                    )}

                    {/* DP3: State F — no reply overdue decision panel */}
                    {drawerUiState === 'F' && (
                      <div className="border-b border-amber-100 bg-amber-50/40 px-6 py-4 shrink-0 space-y-3">
                        <p className="text-[11px] font-semibold text-amber-800">No reply from {drawerSup.name} after {Math.max(daysSinceChase, 3)} days — what would you like to do?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { key: 'followup_chase'   as const, label: 'Send follow-up chase',    sub: 'Second, more urgent chase',    cls: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50',   selCls: 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'   },
                            { key: 'escalate_manager' as const, label: 'Escalate to manager',     sub: 'Draft internal notification',  cls: 'border-red-200 hover:border-red-400 hover:bg-red-50',         selCls: 'border-red-500 bg-red-50 ring-2 ring-red-200'         },
                            { key: 'switch_phone'     as const, label: 'Switch to phone',         sub: 'Log a call instead',           cls: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50', selCls: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' },
                            { key: 'accept_silence'   as const, label: 'Accept silence & close',  sub: 'Close with a note',            cls: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',       selCls: 'border-gray-500 bg-gray-50 ring-2 ring-gray-200'       },
                          ]).map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => {
                                setDp3Action(prev => ({ ...prev, [drawerCardKey!]: opt.key }))
                                setDp3Draft(prev => { const n = { ...prev }; delete n[drawerCardKey!]; return n })
                              }}
                              className={`border-2 rounded-xl p-3 text-left transition-all ${currentDp3Action === opt.key ? opt.selCls : opt.cls}`}
                            >
                              <div className="text-[12px] font-bold text-gray-800 leading-tight">{opt.label}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{opt.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Comms thread ───────────────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                      {/* Log call or note — shown when trigger block is absent or in C/D/E states */}
                      {!(drawerTrigger && (drawerUiState === 'A' || drawerUiState === 'B')) && (
                      <div className="px-6 pt-3 pb-0 shrink-0">
                        {isLogNoteOpen ? (
                          <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
                            <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-100">
                              {(['call', 'note', 'internal'] as const).map(t => (
                                <button
                                  key={t}
                                  onClick={() => setLogNoteType(prev => ({ ...prev, [drawerCardKey!]: t }))}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${currentLogNoteType === t ? 'bg-white shadow-sm text-gray-800 border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                  {t === 'call' ? 'Call' : t === 'note' ? 'Note' : 'Internal comment'}
                                </button>
                              ))}
                              <button onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="ml-auto p-0.5 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>
                            </div>
                            <textarea
                              placeholder={currentLogNoteType === 'call' ? 'Summarise the call…' : currentLogNoteType === 'internal' ? 'Internal comment (not shared with supplier)…' : 'Add a note…'}
                              value={currentLogNoteText}
                              onChange={e => setLogNoteText(prev => ({ ...prev, [drawerCardKey!]: e.target.value }))}
                              className="w-full text-[11px] text-gray-700 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-200"
                              rows={3}
                            />
                            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                              <button
                                onClick={() => {
                                  if (!currentLogNoteText.trim() || !drawerCardKey) return
                                  const prefix = currentLogNoteType === 'call' ? '[Call] ' : currentLogNoteType === 'internal' ? '[Internal] ' : ''
                                  drawerGroup.pos.forEach(p => addPOEvent(p.id, { id: `note-${Date.now()}-${p.id}`, type: 'manual_note', timestamp: new Date().toISOString(), author: 'buyer', body: prefix + currentLogNoteText.trim() }))
                                  setLogNoteText(prev => ({ ...prev, [drawerCardKey!]: '' }))
                                  setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: false }))
                                }}
                                disabled={!currentLogNoteText.trim()}
                                className="h-7 px-3 rounded-lg bg-gray-800 text-white text-[11px] font-semibold hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >Save to thread</button>
                              <button onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="text-[11px] text-gray-400 hover:text-gray-600">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: true }))}
                            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors mb-3"
                          >
                            <span className="text-gray-300 font-semibold">+</span> Log call or note
                          </button>
                        )}
                      </div>
                      )}

                      {/* Log call or note open composer when trigger block owns the button */}
                      {drawerTrigger && (drawerUiState === 'A' || drawerUiState === 'B') && isLogNoteOpen && (
                      <div className="px-6 pt-3 pb-0 shrink-0">
                        <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
                          <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-100">
                            {(['call', 'note', 'internal'] as const).map(t => (
                              <button key={t} onClick={() => setLogNoteType(prev => ({ ...prev, [drawerCardKey!]: t }))} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${currentLogNoteType === t ? 'bg-white shadow-sm text-gray-800 border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>{t === 'call' ? 'Call' : t === 'note' ? 'Note' : 'Internal comment'}</button>
                            ))}
                            <button onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="ml-auto p-0.5 text-gray-300 hover:text-gray-500"><X className="w-3 h-3" /></button>
                          </div>
                          <textarea placeholder={currentLogNoteType === 'call' ? 'Summarise the call…' : currentLogNoteType === 'internal' ? 'Internal comment (not shared with supplier)…' : 'Add a note…'} value={currentLogNoteText} onChange={e => setLogNoteText(prev => ({ ...prev, [drawerCardKey!]: e.target.value }))} className="w-full text-[11px] text-gray-700 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-200" rows={3} />
                          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                            <button onClick={() => { if (!currentLogNoteText.trim() || !drawerCardKey) return; const prefix = currentLogNoteType === 'call' ? '[Call] ' : currentLogNoteType === 'internal' ? '[Internal] ' : ''; drawerGroup.pos.forEach(p => addPOEvent(p.id, { id: `note-${Date.now()}-${p.id}`, type: 'manual_note', timestamp: new Date().toISOString(), author: 'buyer', body: prefix + currentLogNoteText.trim() })); setLogNoteText(prev => ({ ...prev, [drawerCardKey!]: '' })); setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: false })) }} disabled={!currentLogNoteText.trim()} className="h-7 px-3 rounded-lg bg-gray-800 text-white text-[11px] font-semibold hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Save to thread</button>
                            <button onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="text-[11px] text-gray-400 hover:text-gray-600">Cancel</button>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3 min-h-0">
                        {drawerThreadEntries.map(entry => {
                          const ts = (t: string) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

                          /* ── Type A: outbound email ─────────────────────── */
                          if (entry.kind === 'outbound') return (
                            <div key={entry.id} className="flex justify-end">
                              <div className="max-w-[82%] space-y-1">
                                <div className="flex items-center justify-end gap-1.5 text-[10px] text-gray-400">
                                  <span className="font-semibold text-gray-600">{entry.sender}</span>
                                  <span>·</span>
                                  <span>{ts(entry.timestamp)}</span>
                                </div>
                                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl rounded-tr-sm px-4 py-3">
                                  <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{entry.body}</pre>
                                  {entry.poIds.length > 0 && (
                                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                                      {entry.poIds.map(id => (
                                        <span key={id} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-mono font-bold">{id}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )

                          /* ── Type B: inbound email ──────────────────────── */
                          if (entry.kind === 'inbound') return (
                            <div key={entry.id} className="flex justify-start">
                              <div className="max-w-[82%] space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                  <span className="font-semibold text-gray-700">{entry.sender}</span>
                                  <span>·</span>
                                  <span>{ts(entry.timestamp)}</span>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                  <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{entry.body}</pre>
                                </div>
                              </div>
                            </div>
                          )

                          /* ── Type C: agent summary ──────────────────────── */
                          if (entry.kind === 'agent_summary') return (
                            <div key={entry.id} className="border-l-2 border-blue-300 bg-blue-50/50 rounded-r-xl px-3.5 py-3 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[10px] text-blue-600">
                                <Bot className="w-3 h-3 shrink-0" />
                                <span className="font-bold">✦ Agent summary</span>
                                <span className="text-blue-300">·</span>
                                <span className="text-blue-400">{ts(entry.timestamp)}</span>
                              </div>
                              <p className="text-[11px] text-blue-900 italic leading-relaxed">{drawerSup.name} replied. I've parsed the response and identified the following proposed changes:</p>
                              <div className="space-y-0.5 font-mono text-[11px]">
                                {entry.mutations.map(m => (
                                  <div key={m.poId} className="flex items-center gap-2">
                                    <span className="font-bold text-gray-700 shrink-0">{m.poId}</span>
                                    <span className="text-gray-400 shrink-0 font-sans">{m.field}:</span>
                                    <span className="text-red-500 line-through shrink-0">{m.oldVal}</span>
                                    <span className="text-gray-300 shrink-0">→</span>
                                    <span className="text-green-600 font-bold shrink-0">{m.newVal}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )

                          /* ── Type D: internal note / logged call ────────── */
                          if (entry.kind === 'note') {
                            const isCall = entry.noteType === 'call' || entry.body.startsWith('[Call] ')
                            const isInternal = entry.noteType === 'internal' || entry.body.startsWith('[Internal] ')
                            const displayBody = entry.body.replace(/^\[(Call|Internal)\] /, '')
                            return (
                              <div key={entry.id} className="flex justify-center">
                                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 max-w-[75%] space-y-0.5">
                                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
                                    <span>{isCall ? '📞' : isInternal ? '🔒' : '📝'}</span>
                                    <span className="font-medium">{isCall ? 'Call logged' : isInternal ? 'Internal note' : 'Note'}</span>
                                    <span>·</span>
                                    <span>{entry.author}</span>
                                    <span>·</span>
                                    <span>{ts(entry.timestamp)}</span>
                                  </div>
                                  <p className="text-[11px] text-gray-600 italic leading-relaxed text-center">{displayBody}</p>
                                </div>
                              </div>
                            )
                          }

                          /* ── Type E: system event ───────────────────────── */
                          if (entry.kind === 'system_event') return (
                            <div key={entry.id} className="flex items-center gap-2 py-0.5">
                              <div className="flex-1 h-px bg-gray-100" />
                              <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">ⓘ {entry.body} · {ts(entry.timestamp)}</span>
                              <div className="flex-1 h-px bg-gray-100" />
                            </div>
                          )

                          return null
                        })}
                      </div>
                    </div>

                    {/* ── Bottom section (state-gated) ─────────────────────────────── */}

                    {/* State A: draft preview — only for late_dc Tier 2/3 (transactional); at_risk + ET-upgraded late_dc use the empty placeholder */}
                    {drawerUiState === 'A' && drawerGroup.type === 'late_dc' && (drawerSup?.onTimeRate ?? 0) >= 70 && (
                      <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-white space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 shrink-0 w-5">To:</span>
                          <span className="text-[11px] text-gray-700 font-medium">{SUPPLIER_EMAILS[drawerGroup.supplierId]}</span>
                          <div className="flex gap-1 ml-auto flex-wrap">
                            {drawerGroup.pos.map(p => <span key={p.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-mono font-semibold">{p.id}</span>)}
                          </div>
                        </div>
                        <div className="border border-violet-200 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
                            <Bot className="w-3 h-3 text-violet-500 shrink-0" />
                            <span className="text-[10px] font-semibold text-violet-700">Agent draft</span>
                            <span className="text-[10px] text-violet-400 truncate ml-1">— select an action above to send</span>
                          </div>
                          <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-sans leading-relaxed p-3.5 bg-gray-50/40 select-text">{actionDraftBody}</pre>
                        </div>
                        <div className="flex items-center justify-end">
                          <button onClick={() => handleSimulateReply(drawerGroup)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-500 transition-colors"><MessageSquare className="w-3 h-3" />Simulate reply (demo)</button>
                        </div>
                      </div>
                    )}

                    {/* State B: action selected — editable draft + Approve & send */}
                    {drawerUiState === 'B' && (
                      <div className="shrink-0 border-t border-gray-200 px-6 py-4 bg-white space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 shrink-0 w-5">To:</span>
                          <span className="text-[11px] text-gray-700 font-medium">{SUPPLIER_EMAILS[drawerGroup.supplierId]}</span>
                          <div className="flex gap-1 ml-auto flex-wrap">
                            {drawerGroup.pos.map(p => <span key={p.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-mono font-semibold">{p.id}</span>)}
                          </div>
                        </div>
                        {drawerCurrentPill === 'counter' && (
                          <div className="flex items-center gap-2 py-1.5 px-3 bg-amber-50 border border-amber-100 rounded-xl">
                            <label className="text-[11px] text-amber-800 font-semibold shrink-0">Propose alternative date:</label>
                            <input
                              type="date"
                              value={cpDate}
                              onChange={e => setCounterProposeDate(prev => ({ ...prev, [drawerCardKey!]: e.target.value }))}
                              className="text-[11px] text-amber-900 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
                            />
                          </div>
                        )}
                        {drawerCurrentPill === 'reject' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-red-700">Reason for rejection <span className="text-red-500">*</span></label>
                            <textarea
                              placeholder="e.g. Stock already sourced from alternative supplier…"
                              value={rrText}
                              onChange={e => setRejectReason(prev => ({ ...prev, [drawerCardKey!]: e.target.value }))}
                              className="w-full text-[11px] text-gray-700 border border-red-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-200"
                              rows={2}
                            />
                          </div>
                        )}
                        {(() => {
                          const isReadOnly = drawerCurrentPill !== 'chase'
                          const subjectLine = drawerCurrentPill === 'approve_date' ? `Date Change Acceptance — ${drawerSup.name}`
                            : drawerCurrentPill === 'counter' ? `Counter-Proposal — ${drawerSup.name}`
                            : drawerCurrentPill === 'reject' ? `Date Change Rejection — ${drawerSup.name}`
                            : drawerCurrentPill === 'confirm_booking' ? `DC Booking Confirmation — ${drawerSup.name}`
                            : drawerCurrentPill === 'alt_slot' ? `Alternate Slot Request — ${drawerSup.name}`
                            : drawerDecChoice === 'cancel' ? `Order Cancellation — ${drawerSup.name}`
                            : drawerDecChoice === 'cpr' ? `CPR Negotiation — ${drawerSup.name}`
                            : `Urgent: Outstanding POs — ${drawerSup.name}`
                          return (
                            <div className="border border-violet-200 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-violet-50 border-b border-violet-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Bot className="w-3 h-3 text-violet-500 shrink-0" />
                                  <span className="text-[10px] font-semibold text-violet-700 shrink-0">Agent draft</span>
                                  <span className="text-[10px] text-violet-400 truncate">— {subjectLine}</span>
                                </div>
                                {!isReadOnly && drawerDirty && <button onClick={() => setChaseDraftMap(p => ({ ...p, [drawerDraftKey]: drawerDefault }))} className="text-[10px] text-violet-600 hover:text-violet-800 shrink-0 ml-2">↺ Revert</button>}
                              </div>
                              <textarea
                                className="w-full text-[11px] text-gray-700 font-mono leading-relaxed p-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-200"
                                rows={7}
                                value={actionDraftBody}
                                readOnly={isReadOnly}
                                onChange={isReadOnly ? undefined : (e => setChaseDraftMap(p => ({ ...p, [drawerDraftKey]: e.target.value })))}
                              />
                            </div>
                          )
                        })()}
                        <button
                          disabled={(drawerCurrentPill === 'reject' && !rrText.trim()) || (drawerCurrentPill === 'counter' && !cpDate)}
                          onClick={() => handleStartThread(drawerAllGrps, actionDraftBody)}
                          className="w-full h-10 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" /> Approve &amp; send
                        </button>
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <button className="hover:text-gray-600 transition-colors">Save draft</button>
                          <button onClick={() => handleSimulateReply(drawerGroup)} className="flex items-center gap-1 hover:text-gray-500 transition-colors"><MessageSquare className="w-3 h-3" />Simulate reply (demo)</button>
                        </div>
                      </div>
                    )}

                    {/* State C: awaiting reply — status banner + secondary actions */}
                    {drawerUiState === 'C' && (
                      <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-white space-y-3">
                        <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 bg-gray-50 rounded-xl py-3">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-gray-300" />
                          <span>Sent {drawerThread ? new Date(drawerThread.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} · awaiting supplier reply</span>
                        </div>
                        <div className="flex items-center justify-center gap-4">
                          <button onClick={() => handleNoReplyTrigger(drawerGroup)} className="text-[11px] text-amber-600 hover:text-amber-800 font-medium transition-colors">Mark: no reply (demo)</button>
                          <span className="text-gray-200">·</span>
                          <button onClick={() => setLogNoteOpen(prev => ({ ...prev, [drawerCardKey!]: true }))} className="text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors">Log call or note</button>
                          <span className="text-gray-200">·</span>
                          <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: true }))} className="text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors">Snooze 3 days</button>
                        </div>
                        {isSnoozeConfirm && (
                          <div className="text-center text-[11px] text-gray-600">Reappear in 3 days?
                            <button onClick={() => { setSnoozedCards(prev => { const n = new Set(prev); n.add(drawerCardKey!); return n }); setDrawerCardKey(null) }} className="ml-1.5 font-semibold text-indigo-600 hover:text-indigo-800">Confirm</button>
                            <button onClick={() => setSnoozeConfirmOpen(prev => ({ ...prev, [drawerCardKey!]: false }))} className="ml-1.5 text-gray-400 hover:text-gray-600">Cancel</button>
                          </div>
                        )}
                        <button onClick={() => handleSimulateReply(drawerGroup)} className="w-full h-7 rounded-lg border border-dashed border-gray-200 text-[10px] font-medium text-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                          <MessageSquare className="w-3 h-3" />Simulate reply (demo)
                        </button>
                      </div>
                    )}

                    {/* State D: DP2 — reply received composer + CTA */}
                    {drawerUiState === 'D' && (
                      <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-white space-y-2.5">
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 shrink-0 w-5">To:</span>
                            <span className="text-[11px] text-gray-700 font-medium">{SUPPLIER_EMAILS[drawerGroup.supplierId]}</span>
                            <div className="flex gap-1 ml-auto flex-wrap">
                              {drawerGroup.pos.map(p => <span key={p.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-mono font-semibold">{p.id}</span>)}
                            </div>
                            </div>
                            <div className="border border-violet-200 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-violet-50 border-b border-violet-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Bot className="w-3 h-3 text-violet-500 shrink-0" />
                                  <span className="text-[10px] font-semibold text-violet-700 shrink-0">Agent draft</span>
                                  <span className="text-[10px] text-violet-400 truncate ml-1">— reply to {drawerSup.name}</span>
                                </div>
                                {currentDp2Draft !== dp2DefaultDraft && (
                                  <button onClick={() => setDp2Draft(prev => { const n = { ...prev }; delete n[drawerCardKey!]; return n })} className="text-[10px] text-violet-600 hover:text-violet-800 shrink-0 ml-2">↺ Revert</button>
                                )}
                              </div>
                              <textarea
                                className="w-full text-[11px] text-gray-700 font-mono leading-relaxed p-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-200"
                                rows={6}
                                value={currentDp2Draft}
                                onChange={e => setDp2Draft(prev => ({ ...prev, [drawerCardKey!]: e.target.value }))}
                              />
                            </div>
                            {currentDp2Action === 'apply_changes' ? (
                              <>
                                <button
                                  onClick={() => handleApplyChanges(drawerGroup, currentDp2Action, currentDp2Draft, true, drawerCardKey!)}
                                  className="w-full h-10 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                  <Send className="w-4 h-4" /> Approve changes &amp; send reply
                                </button>
                                <div className="text-center">
                                  <button
                                    onClick={() => handleApplyChanges(drawerGroup, currentDp2Action, currentDp2Draft, false, drawerCardKey!)}
                                    className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                                  >Apply changes only (no reply)</button>
                                </div>
                              </>
                            ) : (
                              <button
                                onClick={() => handleApplyChanges(drawerGroup, currentDp2Action, currentDp2Draft, true, drawerCardKey!)}
                                className="w-full h-10 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                              >
                                <Send className="w-4 h-4" /> Send reply
                              </button>
                            )}
                          </>
                      </div>
                    )}

                    {/* State F: DP3 — no reply composer + CTA */}
                    {drawerUiState === 'F' && (
                      <div className="shrink-0 border-t border-amber-100 px-6 py-4 bg-amber-50/30 space-y-2.5">
                        {(currentDp3Action === 'followup_chase' || currentDp3Action === 'escalate_manager') && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 shrink-0 w-5">To:</span>
                              <span className="text-[11px] text-gray-700 font-medium">
                                {currentDp3Action === 'escalate_manager' ? 'Manager / Head of Buying' : SUPPLIER_EMAILS[drawerGroup.supplierId]}
                              </span>
                            </div>
                            <div className="border border-amber-200 rounded-xl overflow-hidden">
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-100">
                                <Bot className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="text-[10px] font-semibold text-amber-700">Agent draft</span>
                                {currentDp3Draft !== dp3DefaultDraft && (
                                  <button onClick={() => setDp3Draft(prev => { const n = { ...prev }; delete n[drawerCardKey!]; return n })} className="text-[10px] text-amber-600 hover:text-amber-800 ml-auto">↺ Revert</button>
                                )}
                              </div>
                              <textarea
                                className="w-full text-[11px] text-gray-700 font-mono leading-relaxed p-3.5 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-200"
                                rows={6}
                                value={currentDp3Draft}
                                onChange={e => setDp3Draft(prev => ({ ...prev, [drawerCardKey!]: e.target.value }))}
                              />
                            </div>
                            <button
                              onClick={() => handleDP3Action(drawerGroup, currentDp3Action, currentDp3Draft, drawerCardKey!)}
                              className="w-full h-10 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                              <Send className="w-4 h-4" /> {currentDp3Action === 'escalate_manager' ? 'Send to manager' : 'Send follow-up chase'}
                            </button>
                          </>
                        )}
                        {currentDp3Action === 'switch_phone' && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-gray-500 italic">Log a call with {drawerSup.name} below — this will appear in the thread.</p>
                            <button
                              onClick={() => { handleDP3Action(drawerGroup, currentDp3Action, '', drawerCardKey!); }}
                              className="w-full h-9 rounded-xl border border-indigo-200 text-indigo-700 text-[12px] font-semibold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                            >
                              📞 Open call log composer
                            </button>
                          </div>
                        )}
                        {currentDp3Action === 'accept_silence' && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-gray-500">This will close the action and add a note to the thread that supplier silence was accepted.</p>
                            <button
                              onClick={() => handleDP3Action(drawerGroup, currentDp3Action, '', drawerCardKey!)}
                              className="w-full h-9 rounded-xl bg-gray-700 text-white text-[12px] font-semibold hover:bg-gray-800 transition-colors"
                            >
                              Close action
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* State E: DP4 — resolved (confirmation or read-only banner) */}
                    {drawerUiState === 'E' && (
                      dp4Done.has(drawerCardKey!) ? (
                        <div className="shrink-0 border-t border-gray-100 px-6 py-5 bg-green-50 text-center space-y-1.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                            <span className="text-[12px] font-semibold text-green-800">This action is resolved</span>
                          </div>
                          <button className="text-[11px] text-green-600 hover:text-green-800 underline transition-colors">View in Agent Log →</button>
                        </div>
                      ) : (
                        <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-white space-y-3">
                          <p className="text-[11px] font-semibold text-gray-700 text-center">This action is being closed. Send a final confirmation to {drawerSup.name}?</p>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { key: 'send_confirmation' as const, label: 'Send confirmation', sub: 'Draft closing summary', cls: 'border-green-200 hover:border-green-400 hover:bg-green-50' },
                              { key: 'close_without'     as const, label: 'Close without confirmation', sub: 'Silent close', cls: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50' },
                            ]).map(opt => (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (opt.key === 'send_confirmation') {
                                    const nl = '\n'
                                    const closing = nl + nl + 'Kind regards,' + nl + 'Debenhams Buying Team'
                                    const confirmDraft = `Dear ${drawerSup.name} Team,${nl}${nl}We are writing to confirm that all matters relating to the recent order delay have now been resolved. Our records have been updated accordingly.${nl}${nl}Thank you for your cooperation.${closing}`
                                    setChaseThreads(prev => {
                                      const cur = prev[drawerGroup.supplierId]
                                      if (!cur) return prev
                                      const ts = new Date().toISOString()
                                      const sentMsg: ChaseThreadMsg = { id: `msg-${Date.now()}`, sender: 'you', timestamp: ts, body: confirmDraft, status: 'sent' }
                                      return { ...prev, [drawerGroup.supplierId]: { ...cur, messages: [...cur.messages, sentMsg] } }
                                    })
                                  }
                                  setDp4Done(prev => { const n = new Set(prev); n.add(drawerCardKey!); return n })
                                }}
                                className={`border-2 rounded-xl p-3 text-left transition-all ${opt.cls}`}
                              >
                                <div className="text-[12px] font-bold text-gray-800 leading-tight">{opt.label}</div>
                                <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{opt.sub}</div>
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              setResolvedCards(prev => { const n = new Set(prev); n.delete(drawerCardKey!); return n })
                            }}
                            className="w-full text-center text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                          >↩ Reopen this action</button>
                        </div>
                      )
                    )}

                    </> /* end View 1 */
                    )}

                    {/* ── View 2: PO Detail ───────────────────────────────── */}
                    {drawerView === 'po-detail' && drawerViewPO && (
                      <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
                        <PODetailPane
                          po={drawerViewPO}
                          onAddEvent={addPOEvent}
                          showHeader fromActionDrawer
                        />
                      </div>
                    )}

                  </div>{/* end drawer body flex-1 */}
                </div>
              )}
              {/* Backdrop click to close drawer */}
              {drawerCardKey && <div className="fixed inset-0 z-30 bg-black/10" onClick={() => setDrawerCardKey(null)} />}
            </div>
          </>
          )
        })()}

        {/* ── ALL POs ── */}
        {subTab === 'allpos' && (() => {
          const filtered = ALL_POS.filter(po => {
            const cl = classifyPO(po)
            const statusOk   = poStatusFilter === 'all' || cl === poStatusFilter
            const supplierOk = poSupFilter     === 'all' || po.supplierId === poSupFilter
            const searchOk   = !poSearch || po.id.toLowerCase().includes(poSearch.toLowerCase()) || po.product.toLowerCase().includes(poSearch.toLowerCase())
            return statusOk && supplierOk && searchOk
          })
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={poSearch} onChange={e => setPoSearch(e.target.value)} placeholder="Search PO or product…" className="pl-8 pr-3 h-8 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 w-52" />
                </div>
                <select value={poStatusFilter} onChange={e => setPoStatusFilter(e.target.value)} className="h-8 border border-gray-200 rounded-lg text-xs px-2 focus:outline-none">
                  <option value="all">All Statuses</option>
                  <option value="overdue">Ex-factory delay</option>
                  <option value="at_risk">Date change required</option>
                  <option value="late_dc">Late DC booking</option>
                  <option value="on_track">On track</option>
                </select>
                <select value={poSupFilter} onChange={e => setPoSupFilter(e.target.value)} className="h-8 border border-gray-200 rounded-lg text-xs px-2 focus:outline-none">
                  <option value="all">All Suppliers</option>
                  {SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="ml-auto h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Export Excel
                </button>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{['PO Number','Supplier','Product','Status','Delivery','Value','Freight'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(po => {
                      const sup = getSupplier(po.supplierId)
                      const diffDays = Math.ceil((new Date(po.expectedDelivery).getTime() - today.getTime()) / 86400000)
                      const relLabel = diffDays < 0 ? `${Math.abs(diffDays)} days overdue` : diffDays === 0 ? 'Due today' : `due in ${diffDays}d`
                      return (
                        <tr key={po.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPOId(po.id)}>
                          <td className="px-4 py-3 font-semibold text-indigo-700">{po.id}</td>
                          <td className="px-4 py-3 text-gray-700">{sup?.name ?? po.supplierId}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{po.product}</td>
                          <td className="px-4 py-3">{(() => { const sc = STATUS_CONFIG[po.status]; return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] border ${sc.bg} ${sc.text} ${sc.border}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{po.status}</span> })()}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{formatDate(po.expectedDelivery)}</div>
                            <div className={`text-[10px] mt-0.5 ${diffDays < 0 ? 'text-red-500' : diffDays <= 7 ? 'text-amber-500' : 'text-gray-400'}`}>{relLabel}</div>
                            {po.revisedDelivery && <div className="text-[10px] text-orange-500 mt-0.5">→ {formatDate(po.revisedDelivery)}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-medium">{po.orderValue}</td>
                          <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${po.freight === 'Air' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{po.freight}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && <div className="text-center text-xs text-gray-400 py-10">No POs match the selected filters</div>}
              </div>
            </div>
          )
        })()}

        {/* ── SUPPLIERS ── */}
        {subTab === 'suppliers' && (() => {
          const underperforming = SUPPLIERS.filter(s => s.onTimeRate < 75 || s.trend === 'deteriorating')
          return (
            <div className="space-y-4">
              {underperforming.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div><span className="text-xs font-bold text-red-700">Performance Alert — </span><span className="text-xs text-red-600">{underperforming.length} supplier{underperforming.length > 1 ? 's' : ''} ({underperforming.map(s => s.name).join(', ')}) are underperforming. Review forward commitments.</span></div>
                </div>
              )}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{['Supplier','Category','On-Time Rate','Avg Delay','Open POs','Lead Time','Trend','Status'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {SUPPLIERS.map(s => {
                      const atRisk = s.onTimeRate < 75 || s.trend === 'deteriorating'
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                          <td className="px-4 py-3 text-gray-500">{s.category}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${s.onTimeRate >= 85 ? 'bg-green-500' : s.onTimeRate >= 75 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${s.onTimeRate}%` }} /></div>
                              <span className={`font-semibold ${s.onTimeRate >= 85 ? 'text-green-700' : s.onTimeRate >= 75 ? 'text-amber-700' : 'text-red-700'}`}>{s.onTimeRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{s.avgDelayDays}d</td>
                          <td className="px-4 py-3 text-gray-600">{s.openPOs}</td>
                          <td className="px-4 py-3 text-gray-600">{s.contractualLeadTimeDays}d</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {s.trend === 'improving'     && <TrendingUp  className="w-3.5 h-3.5 text-green-500" />}
                              {s.trend === 'stable'        && <Minus        className="w-3.5 h-3.5 text-gray-400" />}
                              {s.trend === 'deteriorating' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                              <span className={`text-[11px] font-medium capitalize ${s.trend === 'improving' ? 'text-green-600' : s.trend === 'stable' ? 'text-gray-500' : 'text-red-600'}`}>{s.trend.charAt(0).toUpperCase() + s.trend.slice(1)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{atRisk ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">AT RISK</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* ── AGENT LOG ── */}
        {subTab === 'agentlog' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><Bot className="w-4 h-4 text-purple-600" /></div>
              <span className="text-sm font-bold text-gray-800">Agent Activity Log</span>
              <span className="text-xs text-gray-400">· updated {new Date(AGENT_LOG[0].time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-500">
              <Bot className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              This agent drafts and recommends. All outbound actions require your approval.
            </div>
            <div className="relative pl-8">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-2">
                {AGENT_LOG.map((entry, i) => {
                  const cfg = LOG_ICON[entry.type]
                  const timeStr = new Date(entry.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className={`absolute -left-5 w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${cfg.bg}`}>{cfg.icon}</div>
                      <div className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.actionCls}`}>{cfg.actionLabel}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{timeStr}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">{entry.message}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Replenishment ─────────────────────────────────────────────────────────────

const REPLEN_TODAY = new Date('2026-04-24')

function getExitDate(p: ReplenProduct): string | undefined {
  return p.sellingWindowEnd ?? p.discontinueDate
}

function swWeeksRemaining(exitDate: string): number {
  const ms = new Date(exitDate).getTime() - REPLEN_TODAY.getTime()
  return Math.max(0, Math.floor(ms / (7 * 86400000)))
}

function calcPhaseOutReplen(p: ReplenProduct, exitDate: string): number {
  const wks = swWeeksRemaining(exitDate)
  if (wks <= 0) return 0
  return Math.max(0, wks * p.weeklySales - p.currentStock - p.targetMin)
}

interface ReplenSimRow {
  wk: string; weekNum: number; isActual: boolean; isBeyondExit: boolean
  onHand: number; onOrder: number; intake: number; orderPlaced: number; demand: number
  safetyStock: number; minLevel: number; maxLevel: number; netInventory: number
}

function zScore(p: number): number {
  if (p >= 0.999) return 3.090; if (p >= 0.99) return 2.326; if (p >= 0.975) return 1.960
  if (p >= 0.95)  return 1.645; if (p >= 0.90) return 1.282; if (p >= 0.85) return 1.036
  if (p >= 0.80)  return 0.842; return 0.524
}

function runReplenSim(product: ReplenProduct): ReplenSimRow[] {
  const leadTime   = product.leadTime    ?? 2
  const cycPeriod  = product.cyclePeriod ?? 1
  const riskPeriod = leadTime + cycPeriod
  const z          = zScore(product.targetAvailability ?? 0.90)
  const exitDate   = product.sellingWindowEnd ?? product.discontinueDate
  const hist       = product.weeklyHistory
  const startWkNum = parseInt(hist[0].week.replace('Wk ', ''))
  const ACTUAL_WKS = Math.min(hist.length, 12)
  const TOTAL      = Math.max(52, hist.length + 36)

  const exitIdx: number | null = exitDate
    ? isoWeekNum(new Date(exitDate)) - startWkNum : null

  const getDemand = (i: number): number =>
    (product.demandForecast && i < product.demandForecast.length)
      ? product.demandForecast[i] : product.weeklySales

  const getStdDev = (i: number): number =>
    (product.demandStdDev && i < product.demandStdDev.length)
      ? product.demandStdDev[i]
      : (product.stdDevWeeklySales ?? Math.max(1, product.weeklySales * 0.15))

  const computeTargets = (i: number) => {
    const stdDev = getStdDev(i)
    const safety = Math.round(z * stdDev * Math.sqrt(riskPeriod))
    let fcastRisk = 0
    for (let j = 0; j < riskPeriod; j++) {
      if (exitIdx !== null && (i + j) >= exitIdx) break
      fcastRisk += getDemand(i + j)
    }
    const minLvl = Math.round(fcastRisk + safety)
    let fcastCyc = 0
    for (let j = 0; j < cycPeriod; j++) {
      if (exitIdx !== null && (i + riskPeriod + j) >= exitIdx) break
      fcastCyc += getDemand(i + riskPeriod + j)
    }
    return { safetyStock: safety, minLevel: minLvl, maxLevel: Math.round(minLvl + fcastCyc) }
  }

  const pipeline = new Array(TOTAL + leadTime + 2).fill(0)
  const rows: ReplenSimRow[] = []
  let onHand = hist[ACTUAL_WKS - 1].storeStock

  for (let i = 0; i < TOTAL; i++) {
    const wkNum = startWkNum + i
    const wk = `Wk ${wkNum}`
    const isActual = i < ACTUAL_WKS
    const isBeyondExit = exitIdx !== null && i >= exitIdx
    const { safetyStock, minLevel, maxLevel } = computeTargets(i)

    if (isActual) {
      const h = hist[i]
      const futureOnOrder = pipeline.slice(i + 1, i + 1 + leadTime).reduce((a, b) => a + b, 0)
      rows.push({
        wk, weekNum: wkNum, isActual: true, isBeyondExit: false,
        onHand: h.storeStock, onOrder: futureOnOrder, intake: h.replen, orderPlaced: 0,
        demand: h.sales, safetyStock, minLevel, maxLevel,
        netInventory: h.storeStock + futureOnOrder,
      })
    } else {
      const intake = pipeline[i] ?? 0
      onHand = Math.max(0, onHand + intake)
      const onOrderBefore = pipeline.slice(i + 1, i + 1 + leadTime).reduce((a, b) => a + b, 0)
      const netInv = onHand + onOrderBefore
      let orderPlaced = 0
      if (!isBeyondExit && netInv <= minLevel && maxLevel > 0 &&
          (exitIdx === null || i + leadTime < exitIdx)) {
        orderPlaced = Math.max(0, maxLevel - netInv)
        if (i + leadTime < pipeline.length) pipeline[i + leadTime] += orderPlaced
      }
      const demand = getDemand(i)
      const closing = Math.max(0, onHand - demand)
      const onOrderAfter = pipeline.slice(i + 1, i + 1 + leadTime).reduce((a, b) => a + b, 0)
      rows.push({
        wk, weekNum: wkNum, isActual: false, isBeyondExit,
        onHand: closing, onOrder: isBeyondExit ? 0 : onOrderAfter,
        intake, orderPlaced: isBeyondExit ? 0 : orderPlaced, demand,
        safetyStock: isBeyondExit ? 0 : safetyStock,
        minLevel: isBeyondExit ? 0 : minLevel, maxLevel: isBeyondExit ? 0 : maxLevel,
        netInventory: closing + onOrderAfter,
      })
      onHand = closing
    }
  }
  return rows
}

function replenWhyReasons(p: ReplenProduct): string[] {
  const reasons: string[] = []
  if (p.stockStatus === 'low-stock')
    reasons.push(`Store stock (${p.currentStock} units) is below the minimum target of ${p.targetMin} units.`)
  if (p.stockStatus === 'overstocked')
    reasons.push(`Store stock (${p.currentStock} units) exceeds the maximum target of ${p.targetMax} units — no replenishment recommended.`)
  if (p.dcStatus === 'low')
    reasons.push(`DC stock is low (${p.dcStock} units vs ${p.dcCapacity} capacity). Prioritise DC replenishment before store allocation.`)
  if (p.dcStatus === 'excess')
    reasons.push(`DC has excess stock (${p.dcStock} / ${p.dcCapacity} units). Distribute to stores to free DC space.`)
  if (p.isOnPromo)
    reasons.push(`Active promotion running until ${formatDate(p.promoEndDate!)}. Sales velocity is elevated — monitor cover closely.`)
  if (p.discontinueDate)
    reasons.push(`Product phases out on ${formatDate(p.discontinueDate)}. Avoid over-replenishing — model remaining demand before sending stock.`)
  if (p.sellingWindowEnd) {
    const wks = swWeeksRemaining(p.sellingWindowEnd)
    const taper = calcPhaseOutReplen(p, p.sellingWindowEnd)
    if (wks <= 0) reasons.push(`Selling window at ${p.store} has ended — no further replenishment recommended.`)
    else reasons.push(`Selling window at ${p.store} ends ${formatDate(p.sellingWindowEnd)} (${wks} weeks remaining). Taper replenishment — max safe qty: ${taper} units to avoid dead stock.`)
  }
  if (p.seasonality === 'high')
    reasons.push(`High-seasonality line. Demand patterns follow a seasonal curve — adjust replenishment frequency accordingly.`)
  if (p.suggestedReplen > 0)
    reasons.push(`Suggested replenishment: ${p.suggestedReplen} units. This covers ~${Math.round(p.suggestedReplen / p.weeklySales)} weeks of demand at current rate.`)
  return reasons.length ? reasons : ['All metrics within target ranges. No immediate action required.']
}

function ReplenSizeBar({ bands }: { bands: SizeBand[] }) {
  if (bands.length === 1) {
    return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${bands[0].color}`}>{bands[0].label}</span>
  }
  return (
    <div className="flex gap-0.5">
      {bands.map(b => (
        <div key={b.label} className={`flex flex-col items-center rounded px-1 py-0.5 ${b.color}`} style={{ minWidth: 26 }}>
          <span className="text-[8px] font-bold leading-tight">{b.label}</span>
          <span className="text-[8px] leading-tight">{b.pct}%</span>
        </div>
      ))}
    </div>
  )
}

function ReplenStockLevelsChart({ product, timeRange }: { product: ReplenProduct; timeRange: '1m' | '6m' | '1y' }) {
  const simRows    = runReplenSim(product)
  const todayWkNum = isoWeekNum(REPLEN_TODAY)
  const todayWk    = `Wk ${todayWkNum}`
  const exitDateSW = product.sellingWindowEnd ?? product.discontinueDate
  const discWk     = exitDateSW ? `Wk ${isoWeekNum(new Date(exitDateSW))}` : null
  const promoWk    = product.promoEndDate ? `Wk ${isoWeekNum(new Date(product.promoEndDate))}` : null

  const todayIdx = simRows.findIndex(r => r.wk === todayWk)
  const base = Math.max(0, todayIdx < 0 ? 0 : todayIdx - 6)
  const displayRows = timeRange === '1m' ? simRows.slice(base, base + 20)
                    : timeRange === '6m' ? simRows.slice(0, 30)
                    : simRows
  const dispWks = new Set(displayRows.map(r => r.wk))

  const chartData = displayRows.map(r => ({
    wk:             r.wk,
    onHandActBase:  r.isActual ? Math.max(0, r.onHand - r.intake) : null,
    intkAct:        r.isActual && r.intake > 0 ? r.intake : null,
    onHandFc:       !r.isActual && !r.isBeyondExit ? r.onHand : null,
    onOrderFc:      !r.isActual && !r.isBeyondExit ? r.onOrder : null,
    onHandPost:     r.isBeyondExit ? r.onHand : null,
    demand:      r.demand,
    minLevel:    r.isBeyondExit ? null : r.minLevel,
    maxLevel:    r.isBeyondExit ? null : r.maxLevel,
    safetyStock: r.isBeyondExit ? null : r.safetyStock,
    netInventory: r.isBeyondExit ? null : r.netInventory,
  }))

  const belowMinWks = displayRows.filter(r => !r.isBeyondExit && r.minLevel > 0 && r.netInventory < r.minLevel)

  const simStLabel = (r: ReplenSimRow) =>
    r.isBeyondExit ? 'Ended'
    : r.onHand <= 0 ? 'Stockout!'
    : r.minLevel > 0 && r.onHand < r.minLevel ? 'Below min — replen!'
    : r.maxLevel > 0 && r.onHand > r.maxLevel ? 'Above max'
    : 'Healthy'
  const simStCls = (r: ReplenSimRow) =>
    r.isBeyondExit ? 'text-gray-400'
    : r.onHand <= 0 ? 'text-red-700'
    : r.minLevel > 0 && r.onHand < r.minLevel ? 'text-amber-700'
    : r.maxLevel > 0 && r.onHand > r.maxLevel ? 'text-violet-700'
    : 'text-green-700'

  const RP_Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const sim = displayRows.find(r => r.wk === label)
    if (!sim) return null
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-[11px] min-w-[210px]">
        <div className="font-bold text-gray-900 mb-2">
          {label}
          {!sim.isActual && <span className="text-violet-500 ml-1 font-normal">{sim.isBeyondExit ? '(post-exit)' : '(forecast)'}</span>}
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between gap-4"><span className="text-gray-400">On hand</span><span className="font-medium">{sim.onHand}</span></div>
          {!sim.isActual && !sim.isBeyondExit && <div className="flex justify-between gap-4"><span className="text-gray-400">On order</span><span className="text-indigo-500">{sim.onOrder}</span></div>}
          {!sim.isActual && !sim.isBeyondExit && <div className="flex justify-between gap-4"><span className="text-gray-400">Net inventory</span><span className="font-semibold">{sim.netInventory}</span></div>}
          <div className="flex justify-between gap-4"><span className="text-gray-400">Demand</span><span className="text-slate-700">−{sim.demand}</span></div>
          {sim.intake > 0 && <div className="flex justify-between gap-4"><span className="text-gray-400">Intake ▼</span><span className="text-emerald-700 font-medium">+{sim.intake}</span></div>}
          {sim.orderPlaced > 0 && <div className="flex justify-between gap-4"><span className="text-gray-400">Order placed ↑</span><span className="text-blue-600 font-medium">{sim.orderPlaced}</span></div>}
          {!sim.isBeyondExit && sim.minLevel > 0 && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <div className="flex justify-between gap-4"><span className="text-gray-400">Safety stock</span><span>{sim.safetyStock}</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-400">Min target</span><span className="text-amber-600">{sim.minLevel}</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-400">Max target</span><span className="text-gray-500">{sim.maxLevel}</span></div>
            </>
          )}
          <div className="pt-1 border-t border-gray-100 mt-1">
            <span className={`font-semibold ${simStCls(sim)}`}>{simStLabel(sim)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* SVG pattern defs defined once — avoids duplicate-ID rendering bugs across bar instances */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <pattern id="rp-hatch-fc" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="3.5" height="6" fill="#818cf8" />
          </pattern>
          <pattern id="rp-hatch-oo" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="3.5" height="6" fill="#ddd6fe" />
          </pattern>
        </defs>
      </svg>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 20 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          {/* Phase-out zone: today → exit line */}
          {exitDateSW && discWk && dispWks.has(discWk) && dispWks.has(todayWk) && todayWk !== discWk && (
            <ReferenceArea x1={todayWk} x2={discWk} fill="#fecaca" fillOpacity={0.18} />
          )}
          {/* Per-week below-min tint — only weeks where net inventory (on hand + pipeline) falls below Min */}
          {belowMinWks.map(r => (
            <ReferenceArea key={`bm-${r.wk}`} x1={r.wk} x2={r.wk} fill="#fecaca" fillOpacity={0.5} />
          ))}
          <XAxis dataKey="wk" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
            interval={Math.max(0, Math.floor(displayRows.length / 8) - 1)}
            label={{ value: 'Period (weeks)', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`}
            label={{ value: 'Stock (units)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 10, fill: '#9ca3af' }} />
          <Tooltip content={(props: any) => <RP_Tip {...props} />} />
          <Bar dataKey="onHandActBase" stackId="s" fill="#4338ca" maxBarSize={28} radius={0} isAnimationActive={false} legendType="none" />
          <Bar dataKey="intkAct"       stackId="s" fill="#c7d2fe" maxBarSize={28} radius={[2,2,0,0]} isAnimationActive={false} legendType="none" />
          <Bar dataKey="onHandFc"   stackId="s" maxBarSize={28} isAnimationActive={false} legendType="none"
            shape={(props: any) => { const {x=0,y=0,width=0,height=0}=props; if(!width||height<=0)return null; return(<rect x={x} y={y} width={width} height={height} fill="url(#rp-hatch-fc)" stroke="#6366f1" strokeWidth={0.4}/>) }} />
          <Bar dataKey="onOrderFc"  stackId="s" maxBarSize={28} isAnimationActive={false} legendType="none"
            shape={(props: any) => { const {x=0,y=0,width=0,height=0}=props; if(!width||height<=0)return null; return(<rect x={x} y={y} width={width} height={height} fill="url(#rp-hatch-oo)" stroke="#a5b4fc" strokeWidth={0.4}/>) }} />
          <Bar dataKey="onHandPost" stackId="s" fill="#d1d5db" maxBarSize={28} radius={0} isAnimationActive={false} legendType="none" />
          {/* Safety stock band — rendered AFTER bars so it overlays the bottom floor visibly */}
          <Area type="monotone" dataKey="safetyStock" fill="#fef9c3" fillOpacity={0.55} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 3" isAnimationActive={false} legendType="none" connectNulls={false} />
          <Line type="monotone" dataKey="minLevel" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} legendType="none" connectNulls={false} />
          <Line type="monotone" dataKey="maxLevel" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} legendType="none" connectNulls={false} />
          <Line type="monotone" dataKey="demand" stroke="#1e293b" strokeWidth={1.5} dot={false} isAnimationActive={false} legendType="none" />
          <Line type="monotone" dataKey="netInventory" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} legendType="none" connectNulls={false} />
          {dispWks.has(todayWk) && <ReferenceLine x={todayWk} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: 'Today', position: 'insideTopLeft', fontSize: 9, fill: '#6366f1', dy: -4 }} />}
          {discWk && dispWks.has(discWk) && <ReferenceLine x={discWk} stroke="#ef4444" strokeWidth={2}
            label={{ value: `Exits ${product.store}`, position: 'insideTopRight', fontSize: 9, fill: '#ef4444', dy: -4 }} />}
          {promoWk && dispWks.has(promoWk) && <ReferenceLine x={promoWk} stroke="#a855f7" strokeDasharray="3 2" strokeWidth={1}
            label={{ value: 'Promo End', position: 'insideTopRight', fontSize: 9, fill: '#a855f7', dy: -4 }} />}
          {displayRows.filter(r => r.intake > 0).map(r => (
            <ReferenceLine key={`in-${r.wk}`} x={r.wk} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1.5}
              label={{ value: '▼ IN', position: 'insideTopLeft', fontSize: 7, fill: '#065f46' }} />
          ))}
          {displayRows.filter(r => !r.isActual && r.orderPlaced > 0).map(r => (
            <ReferenceLine key={`ord-${r.wk}`} x={r.wk} stroke="#3b82f6" strokeDasharray="2 2" strokeWidth={1}
              label={{ value: '↑ ORD', position: 'insideTopRight', fontSize: 7, fill: '#1d4ed8' }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 mb-1 text-[10px] text-gray-500 justify-center">
        <span className="font-semibold text-gray-700">Stock:</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-700 inline-block" />Actual</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block" />Intake</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'repeating-linear-gradient(45deg,#818cf8,#818cf8 2px,#e0e7ff 2px,#e0e7ff 4px)' }} />Forecast</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'repeating-linear-gradient(45deg,#ddd6fe,#ddd6fe 2px,#ede9fe 2px,#ede9fe 4px)' }} />On order</span>
        {exitDateSW && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-300 inline-block" />Post-exit</span>}
        <span className="ml-2 font-semibold text-gray-700">Targets:</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300 inline-block" />Safety floor</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-amber-500 inline-block" />Min</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-slate-400 inline-block" />Max</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t border-slate-800 inline-block" />Demand</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-indigo-500 inline-block" />Net inv.</span>
        {exitDateSW && <><span className="ml-2 font-semibold text-gray-700">Lifecycle:</span>
          <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-red-500 inline-block" />Exit date</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 inline-block" />Phase-out zone</span>
        </>}
      </div>

      <div className="mt-4 overflow-x-auto max-h-72 overflow-y-auto border border-gray-100 rounded-lg">
        <table className="w-full text-[10px] min-w-[800px]">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-200">
              {['Week','On hand','On order','Net inv.','Safety stock','Min target','Max target','Demand','Intake ▼','Order ↑'].map(h => (
                <th key={h} className="px-2 py-2 text-right first:text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r, i) => {
              const rowCls = r.wk === todayWk ? 'bg-indigo-50 font-semibold'
                : r.isBeyondExit ? 'bg-gray-50/80 text-gray-400'
                : !r.isActual ? 'bg-violet-50/40'
                : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              return (
                <tr key={i} className={`border-b border-gray-100 ${rowCls}`}>
                  <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                    {r.wk}
                    {!r.isActual && !r.isBeyondExit && <span className="ml-1 text-[9px] text-violet-500">fcst</span>}
                    {r.isBeyondExit && <span className="ml-1 text-[9px] text-gray-400">ended</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-gray-900">{r.onHand}</td>
                  <td className="px-2 py-1.5 text-right text-indigo-600">{r.isBeyondExit ? '—' : r.onOrder}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{r.isBeyondExit ? '—' : r.netInventory}</td>
                  <td className="px-2 py-1.5 text-right text-amber-600">{r.isBeyondExit ? '—' : r.safetyStock}</td>
                  <td className="px-2 py-1.5 text-right text-amber-700 font-medium">{r.isBeyondExit ? '—' : r.minLevel}</td>
                  <td className="px-2 py-1.5 text-right text-gray-500">{r.isBeyondExit ? '—' : r.maxLevel}</td>
                  <td className="px-2 py-1.5 text-right text-gray-700">{r.demand}</td>
                  <td className="px-2 py-1.5 text-right">
                    {r.intake > 0 ? <span className="text-emerald-700 font-medium">+{r.intake}</span> : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {r.orderPlaced > 0 ? <span className="text-blue-600 font-medium">{r.orderPlaced}</span> : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReplenishmentView() {
  type ReplenFilter = 'All' | 'Low Stock' | 'On Target' | 'Overstocked' | 'Ending soon'
  const [selectedProduct, setSelectedProduct] = useState<ReplenProduct | null>(null)
  const [search, setSearch]     = useState('')
  const [cat, setCat]           = useState('')
  const [filter, setFilter]     = useState<ReplenFilter>('All')
  const [chartTab, setChartTab] = useState<'stock' | 'size-curves' | 'availability'>('stock')
  const [timeRange, setTimeRange] = useState<'1m' | '6m' | '1y'>('6m')
  const [editReplenQty, setEditReplenQty]       = useState(0)
  const [editTransferDate, setEditTransferDate] = useState('')
  const [showWhy, setShowWhy] = useState(false)
  const [toast, setToast]     = useState<string | null>(null)
  const [overrideLog, setOverrideLog] = useState<{id: string; name: string; store: string; qty: number; reason: string; ts: string}[]>([])
  const [overrideReason, setOverrideReason] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedProduct) {
    const p = selectedProduct
    const exitDate = getExitDate(p)
    const weeksLeft = exitDate ? swWeeksRemaining(exitDate) : null
    const phaseOutQty = (exitDate && weeksLeft !== null && weeksLeft > 0) ? calcPhaseOutReplen(p, exitDate) : p.suggestedReplen
    const replenQty = editReplenQty > 0 ? editReplenQty : phaseOutQty
    const isOverride = !!(exitDate && editReplenQty > 0 && editReplenQty > phaseOutQty)
    const defaultTransfer = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
    const transferDate = editTransferDate || defaultTransfer
    const totalValue = Math.round(replenQty * p.costPrice)

    const scCfg: Record<StockStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
      'on-target':  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'On Target'   },
      'low-stock':  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',    label: 'Low Stock'   },
      'overstocked':{ bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',  label: 'Overstocked' },
    }
    const sc = scCfg[p.stockStatus]
    const stockoutRisk = p.stockStatus === 'low-stock' ? 'High' : p.stockStatus === 'overstocked' ? 'Low' : 'Medium'
    const riskCls = stockoutRisk === 'High' ? 'bg-red-100 text-red-700' : stockoutRisk === 'Low' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
    const stockValue    = Math.round(p.currentStock * p.costPrice)
    const monthlyRevenue = Math.round(p.weeklySales * p.sellingPrice * 4.33)
    const grossMargin   = Math.round((p.sellingPrice - p.costPrice) / p.sellingPrice * 100)

    const dcCls: Record<ReplenDCStatus, { bg: string; text: string; border: string; bar: string; label: string }> = {
      ok:     { bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200',   bar: 'bg-emerald-400', label: 'OK'     },
      low:    { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  bar: 'bg-amber-400',   label: 'Low'    },
      excess: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', bar: 'bg-orange-400',  label: 'Excess' },
    }
    const dc = dcCls[p.dcStatus]
    const dcPct = Math.round(p.dcStock / p.dcCapacity * 100)

    const displayChartData = timeRange === '1m' ? p.weeklyHistory.slice(8) : p.weeklyHistory
    const dispWkSet        = new Set(displayChartData.map(w => w.week))
    const todayWk  = 'Wk 17'
    const discWk   = exitDate ? `Wk ${isoWeekNum(new Date(exitDate))}` : null
    const chartTabs = ['stock', 'size-curves', 'availability'] as const

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          <button onClick={() => { setSelectedProduct(null); setShowWhy(false) }}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            ← Back to Replenishment
          </button>

          {/* Selling window banner */}
          {exitDate && weeksLeft !== null && weeksLeft <= 8 && (
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap border ${weeksLeft <= 2 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <span className="text-base">⏱</span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-bold ${weeksLeft <= 2 ? 'text-red-800' : 'text-amber-800'}`}>
                  {weeksLeft <= 2 ? 'Selling window ending very soon' : `Selling window ends in ${weeksLeft} weeks`}
                </span>
                <span className={`text-xs ml-2 ${weeksLeft <= 2 ? 'text-red-700' : 'text-amber-700'}`}>
                  {weeksLeft <= 2 ? '— stop replenishing immediately to avoid dead stock' : '— taper replenishment to clear stock before exit date'}
                </span>
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${weeksLeft <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                Exits {p.store} · {formatDate(exitDate)}
              </span>
            </div>
          )}

          {/* Top card */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-start gap-5">
            <img src={p.imageUrl} className="w-20 h-20 rounded-lg object-cover shrink-0" alt={p.name} />
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-400 mb-2">{p.sku} · {p.category} · {p.store}</div>
              <div className="flex gap-2 flex-wrap mb-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${riskCls}`}>
                  {stockoutRisk} Risk
                </span>
                {p.isOnPromo && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">Promo until {formatDate(p.promoEndDate!)}</span>}
                {exitDate && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${weeksLeft !== null && weeksLeft <= 2 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>{weeksLeft === 0 ? 'Ended' : `Ending ${formatDate(exitDate)}`}</span>}
                {p.seasonality === 'high' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">Seasonal</span>}
              </div>
              <div className="flex gap-2">
                {(replenQty > 0 || (exitDate && editReplenQty > 0)) && (
                  <button onClick={() => {
                    if (isOverride && !overrideReason.trim()) {
                      showToast('Please enter an override reason before sending.')
                      return
                    }
                    if (isOverride && overrideReason.trim()) {
                      setOverrideLog(prev => [...prev, { id: p.id, name: p.name, store: p.store, qty: editReplenQty, reason: overrideReason.trim(), ts: new Date().toLocaleString() }])
                    }
                    showToast(`${p.name} — ${replenQty} units scheduled for ${p.store} on ${transferDate}.`)
                    setOverrideReason('')
                  }} className="h-7 px-3 text-[10px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                    Send to Store
                  </button>
                )}
                <button onClick={() => setShowWhy(true)}
                  className="h-7 px-3 text-[10px] font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                  Why flagged?
                </button>
              </div>
            </div>
            <div className="space-y-1.5 shrink-0">
              <div className="text-[9px] font-semibold text-indigo-500 uppercase tracking-wide px-0.5 flex items-center gap-1">
                <span className="w-3 h-px bg-indigo-300 inline-block" />Editable<span className="w-3 h-px bg-indigo-300 inline-block" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center min-w-[100px]">
                  <input type="number" value={editReplenQty > 0 ? editReplenQty : phaseOutQty}
                    onChange={e => setEditReplenQty(Number(e.target.value))}
                    className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-full text-center" />
                  <div className="text-[10px] text-gray-400 mt-0.5">Replen Qty</div>
                  {editReplenQty > 0 && editReplenQty !== phaseOutQty
                    ? <div className="text-[8px] text-red-500 mt-0.5 font-semibold">✎ overridden</div>
                    : exitDate && weeksLeft !== null && weeksLeft > 0 && phaseOutQty < p.suggestedReplen
                    ? <div className="text-[8px] text-orange-500 mt-0.5 font-semibold">⚠ tapered · exit in {weeksLeft}w</div>
                    : exitDate && phaseOutQty === 0
                    ? <div className="text-[8px] text-red-400 mt-0.5">✗ do not replenish</div>
                    : <div className="text-[9px] text-indigo-400 mt-0.5">algorithm-derived</div>
                  }
                  <button onClick={() => setShowWhy(true)} className="text-[8px] text-indigo-400 hover:text-indigo-600 underline mt-0.5 block w-full text-center">Why this qty?</button>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-center min-w-[100px]">
                  <input type="date" value={transferDate} onChange={e => setEditTransferDate(e.target.value)}
                    className="text-xs font-bold text-gray-900 bg-transparent border-b border-indigo-300 focus:outline-none focus:border-indigo-600 w-full text-center" />
                  <div className="text-[10px] text-gray-400 mt-0.5">Transfer Date</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <div className="text-xs font-bold text-gray-900">£{totalValue.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Total Value</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <div className="text-xs font-bold text-gray-900">{p.currentStock}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Store Stock</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center min-w-[88px]">
                  <div className="text-xs font-bold text-gray-900">£{p.sellingPrice.toFixed(2)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Selling Price</div>
                </div>
              </div>
              {isOverride && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <div className="text-[10px] font-bold text-red-700 mb-1.5">⚠ Dead stock risk — {editReplenQty - phaseOutQty} units above taper recommendation</div>
                  <input type="text" placeholder="Enter override reason (required)…"
                    value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                    className="w-full text-[10px] border border-red-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-red-500 bg-white" />
                </div>
              )}
            </div>
          </div>

          {/* DC Position */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-800 mb-3">DC Position</div>
            <div className={`border-2 rounded-xl p-4 ${dc.border} ${dc.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-lg font-bold text-gray-900">{p.dcStock.toLocaleString()}</span>
                  <span className="text-sm text-gray-400 ml-1">/ {p.dcCapacity.toLocaleString()} units capacity</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${dc.bg} ${dc.text} ${dc.border}`}>DC {dc.label}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                <div className={`h-2.5 rounded-full ${dc.bar}`} style={{ width: `${Math.min(dcPct, 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-4 text-[11px]">
                <div><div className="text-gray-400">Capacity used</div><div className="font-semibold text-gray-800">{dcPct}%</div></div>
                <div><div className="text-gray-400">Available to send</div><div className="font-semibold text-gray-800">{p.dcStock.toLocaleString()} units</div></div>
                <div><div className="text-gray-400">After this replen</div><div className="font-semibold text-gray-800">{Math.max(0, p.dcStock - replenQty).toLocaleString()} units</div></div>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Stock Value',     value: `£${stockValue.toLocaleString()}`,              pop: '↓ −3.2% vs last month', popCls: 'text-red-400' },
              { label: 'Weeks of Cover',  value: `${p.weeksOfCover.toFixed(1)}w`,                pop: '↑ +0.4w vs last week',  popCls: 'text-green-600' },
              { label: 'Gross Margin',    value: `${grossMargin}%`,                              pop: '→ flat vs last month',  popCls: 'text-gray-400' },
              { label: 'Monthly Revenue', value: `£${(monthlyRevenue / 1000).toFixed(1)}k`,      pop: '↑ +7.1% vs last month', popCls: 'text-green-600' },
              { label: 'Stockout Risk',   value: stockoutRisk, badge: riskCls, pop: undefined, popCls: undefined },
            ].map(({ label, value, badge, pop, popCls }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm text-center">
                {badge ? <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${badge}`}>{value}</span>
                       : <div className="text-lg font-bold text-gray-900">{value}</div>}
                <div className="text-[10px] text-gray-400 mt-1">{label}</div>
                {pop && <div className={`text-[9px] mt-0.5 ${popCls}`}>{pop}</div>}
              </div>
            ))}
          </div>

          {/* Two panels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-800 mb-3">Stock Management</div>
              {[
                { label: 'Store Stock',  value: `${p.currentStock} units` },
                { label: 'DC Stock',     value: `${p.dcStock.toLocaleString()} units` },
                { label: 'Target Min',   value: `${p.targetMin} units` },
                { label: 'Target Max',   value: `${p.targetMax} units` },
                { label: 'Weekly Sales', value: `${p.weeklySales} units/wk` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <div className="text-sm font-semibold text-gray-800 mb-3">Replen Details</div>
              {[
                { label: 'Store',       value: p.store },
                { label: 'Supplier',    value: p.supplier },
                { label: 'Last Replen', value: formatDate(p.lastReplenDate) },
                { label: 'Seasonality', value: p.seasonality.charAt(0).toUpperCase() + p.seasonality.slice(1) },
                ...(p.promoEndDate    ? [{ label: 'Promo Ends',          value: formatDate(p.promoEndDate)    }] : []),
                ...(p.discontinueDate ? [{ label: 'Phase-out',            value: formatDate(p.discontinueDate) }] : []),
                ...(p.sellingWindowEnd ? [{ label: 'Selling Window Ends', value: `${formatDate(p.sellingWindowEnd)} · ${swWeeksRemaining(p.sellingWindowEnd)}w remaining` }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Override audit log */}
          {overrideLog.filter(l => l.id === p.id).length > 0 && (
            <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-red-700 mb-2">Replenishment Override Log</div>
              {overrideLog.filter(l => l.id === p.id).map((entry, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0 text-[10px]">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <div className="flex-1">
                    <span className="font-bold text-gray-800">{entry.qty} units sent</span>
                    <span className="text-gray-400 mx-1.5">·</span>
                    <span className="text-gray-600 italic">"{entry.reason}"</span>
                    <span className="text-gray-400 ml-2">{entry.ts}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart panel */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-gray-800">
                {chartTab === 'size-curves' ? 'Stock distribution by size' : 'Monitor your stock levels including DC replenishment intake'}
              </span>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-auto gap-0.5">
                {chartTabs.map(t => (
                  <button key={t} onClick={() => setChartTab(t)}
                    className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${chartTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {t === 'stock' ? 'Stock Levels' : t === 'size-curves' ? 'Size Curves' : 'Availability'}
                  </button>
                ))}
              </div>
              {chartTab !== 'size-curves' && (
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  {(['1m', '6m', '1y'] as const).map(r => (
                    <button key={r} onClick={() => setTimeRange(r)}
                      className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${timeRange === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                      {r === '1m' ? 'One Month' : r === '6m' ? 'Six Months' : 'One Year'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {chartTab === 'stock' && <ReplenStockLevelsChart product={p} timeRange={timeRange} />}

            {chartTab === 'size-curves' && (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  {(() => {
                    const bandHex = ['#818cf8','#6366f1','#4f46e5','#a78bfa','#8b5cf6','#7c3aed']
                    return (
                      <ComposedChart data={p.sizeBreakdown.map(s => ({ size: s.label, pct: s.pct }))} margin={{ top: 8, right: 16, left: 0, bottom: 20 }} barCategoryGap="15%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="size" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
                          label={{ value: 'Size', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9ca3af' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`}
                          label={{ value: 'Mix %', angle: -90, position: 'insideLeft', offset: 16, fontSize: 10, fill: '#9ca3af' }} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '6px 10px' }} formatter={(v) => [`${v}%`, 'Size share']} />
                        <Bar dataKey="pct" name="pct" radius={[3,3,0,0]} isAnimationActive={false}>
                          {p.sizeBreakdown.map((_s, i) => <Cell key={i} fill={bandHex[i % bandHex.length]} />)}
                        </Bar>
                      </ComposedChart>
                    )
                  })()}
                </ResponsiveContainer>
                {(() => {
                  const bandHex = ['#818cf8','#6366f1','#4f46e5','#a78bfa','#8b5cf6','#7c3aed']
                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 mb-3 text-[10px] text-gray-500 justify-center">
                        {p.sizeBreakdown.map((s, i) => (
                          <span key={s.label} className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: bandHex[i % bandHex.length] }} />{s.label} ({s.pct}%)
                          </span>
                        ))}
                      </div>
                      <div className="overflow-x-auto border border-gray-100 rounded-lg">
                        <table className="w-full text-[10px]">
                          <thead className="bg-gray-50">
                            <tr className="border-b border-gray-200">
                              <th className="px-3 py-2 text-left font-semibold text-gray-500">Size</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">Mix %</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">Store units</th>
                              <th className="px-3 py-2 text-right font-semibold text-indigo-700 bg-indigo-50 border-x border-indigo-100">Suggested replen</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-500">Cover (wks)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.sizeBreakdown.map((s, i) => {
                              const storeUnits = Math.round(p.currentStock * s.pct / 100)
                              const replenUnits = p.suggestedReplen > 0 ? Math.round(p.suggestedReplen * s.pct / 100) : 0
                              const sizeSales = p.weeklySales * s.pct / 100
                              const cover = sizeSales > 0 ? (storeUnits / sizeSales).toFixed(1) : '—'
                              return (
                                <tr key={s.label} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                                  <td className="px-3 py-1.5"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: bandHex[i % bandHex.length] }} /><span className="font-semibold text-gray-800">{s.label}</span></div></td>
                                  <td className="px-3 py-1.5 text-right text-gray-700">{s.pct}%</td>
                                  <td className="px-3 py-1.5 text-right text-gray-700">{storeUnits}</td>
                                  <td className="px-3 py-1.5 text-right font-bold text-indigo-700 bg-indigo-50/50 border-x border-indigo-100">{replenUnits > 0 ? replenUnits : '—'}</td>
                                  <td className="px-3 py-1.5 text-right text-amber-600 font-semibold">{cover}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                })()}
              </>
            )}

            {chartTab === 'availability' && (
              <>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-2 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-indigo-600 inline-block" />Projected Stock</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-amber-400 inline-block" />Min Target</span>
                  <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-slate-400 inline-block" />Max Target</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={displayChartData} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
                      interval={Math.max(0, Math.floor(displayChartData.length / 8) - 1)}
                      label={{ value: 'Period (weeks)', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 8, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                      label={{ value: 'Store Stock (units)', angle: -90, position: 'insideLeft', offset: 16, fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <ReferenceLine y={p.targetMin} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
                    <ReferenceLine y={p.targetMax} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />
                    {dispWkSet.has(todayWk) && <ReferenceLine x={todayWk} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: 'Today', position: 'insideTopLeft', fontSize: 9, fill: '#6366f1', dy: -4 }} />}
                    {discWk && dispWkSet.has(discWk) && <ReferenceLine x={discWk} stroke="#ef4444" strokeWidth={1.5} />}
                    <Line type="monotone" dataKey="storeStock" stroke="#4338ca" strokeWidth={2} dot={false} isAnimationActive={false} name="Projected Stock" />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
        {showWhy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowWhy(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-gray-900">Why is this flagged?</span>
                <button onClick={() => setShowWhy(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="space-y-2.5">
                {replenWhyReasons(p).map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-gray-50 rounded-lg p-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                    <p className="text-xs text-gray-700 leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  const FILTER_TABS: ReplenFilter[] = ['All', 'Low Stock', 'On Target', 'Overstocked', 'Ending soon']
  const stores = ['All', ...Array.from(new Set(REPLEN_PRODUCTS.map(p => p.store))).sort()]

  const bySearchCat = REPLEN_PRODUCTS.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) &&
    (!cat    || p.category === cat)
  )
  const tabCounts: Record<ReplenFilter, number> = {
    'All':          bySearchCat.length,
    'Low Stock':    bySearchCat.filter(p => p.stockStatus === 'low-stock').length,
    'On Target':    bySearchCat.filter(p => p.stockStatus === 'on-target').length,
    'Overstocked':  bySearchCat.filter(p => p.stockStatus === 'overstocked').length,
    'Ending soon':  bySearchCat.filter(p => { const ed = getExitDate(p); return !!ed && swWeeksRemaining(ed) > 0 && swWeeksRemaining(ed) <= 8 }).length,
  }
  const rows = filter === 'All'          ? bySearchCat
    : filter === 'Low Stock'   ? bySearchCat.filter(p => p.stockStatus === 'low-stock')
    : filter === 'On Target'   ? bySearchCat.filter(p => p.stockStatus === 'on-target')
    : filter === 'Ending soon' ? bySearchCat.filter(p => { const ed = getExitDate(p); return !!ed && swWeeksRemaining(ed) > 0 && swWeeksRemaining(ed) <= 8 })
    : bySearchCat.filter(p => p.stockStatus === 'overstocked')

  const totalReplenValue  = REPLEN_PRODUCTS.filter(p => p.suggestedReplen > 0).reduce((s, p) => s + p.suggestedReplen * p.costPrice, 0)
  const itemsNeedingReplen = REPLEN_PRODUCTS.filter(p => p.suggestedReplen > 0).length
  const storesMonitored   = new Set(REPLEN_PRODUCTS.map(p => p.store)).size
  const avgWeeksCover     = Math.round(REPLEN_PRODUCTS.reduce((s, p) => s + p.weeksOfCover, 0) / REPLEN_PRODUCTS.length * 10) / 10
  const excessDC = REPLEN_PRODUCTS.filter(p => p.dcStatus === 'excess')
  const lowDC    = REPLEN_PRODUCTS.filter(p => p.dcStatus === 'low')

  const scTableCfg: Record<StockStatus, { bg: string; text: string; dot: string; label: string }> = {
    'on-target':  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'On Target'   },
    'low-stock':  { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Low Stock'   },
    'overstocked':{ bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Overstocked' },
  }
  const filterTabCfg: Record<ReplenFilter, { bg: string; text: string }> = {
    'All':          { bg: 'bg-gray-100',    text: 'text-gray-600'    },
    'Low Stock':    { bg: 'bg-red-100',     text: 'text-red-700'     },
    'On Target':    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    'Overstocked':  { bg: 'bg-amber-100',   text: 'text-amber-700'   },
    'Ending soon':  { bg: 'bg-orange-100',  text: 'text-orange-700'  },
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Replen Value',   value: `£${(totalReplenValue / 1000).toFixed(0)}k`, sub: `${itemsNeedingReplen} items need replenishing` },
            { label: 'Items Needing Replen', value: `${itemsNeedingReplen}`, sub: 'ready to send to stores', pop: '↑ +2 vs last week', popCls: 'text-amber-600' },
            { label: 'Stores Monitored',     value: `${storesMonitored}`, sub: `${REPLEN_PRODUCTS.length} product-store pairs` },
            { label: 'Avg Weeks Cover',      value: `${avgWeeksCover}w`, sub: 'across all stores' },
          ].map(({ label, value, sub, pop, popCls }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              <div className="text-[10px] text-gray-400 mt-1">{sub}</div>
              {pop && <div className={`text-[10px] font-semibold mt-0.5 ${popCls}`}>{pop}</div>}
            </div>
          ))}
        </div>

        {/* DC issues banner */}
        {(excessDC.length > 0 || lowDC.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-800">DC Issues:</span>
            {excessDC.length > 0 && <span className="text-xs text-amber-700"><span className="font-semibold">{excessDC.length} excess DC</span> — {Array.from(new Set(excessDC.map(p => p.name))).join(', ')}</span>}
            {excessDC.length > 0 && lowDC.length > 0 && <span className="text-amber-300">·</span>}
            {lowDC.length > 0 && <span className="text-xs text-amber-700"><span className="font-semibold">{lowDC.length} low DC</span> — {Array.from(new Set(lowDC.map(p => p.name))).join(', ')}</span>}
          </div>
        )}

        {/* Selling window banner */}
        {(() => {
          const swItems = REPLEN_PRODUCTS.filter(p => { const ed = getExitDate(p); return !!ed && swWeeksRemaining(ed) > 0 && swWeeksRemaining(ed) <= 8 })
          if (swItems.length === 0) return null
          const hasCritical = swItems.some(p => swWeeksRemaining(getExitDate(p)!) <= 2)
          const names = Array.from(new Set(swItems.map(p => `${p.name} (${p.store})`))).slice(0, 3)
          const extra = swItems.length - names.length
          return (
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap mb-4 border ${hasCritical ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
              <span className="text-sm shrink-0">⏱</span>
              <span className={`text-xs font-semibold ${hasCritical ? 'text-red-800' : 'text-orange-800'}`}>
                Selling window: {swItems.length} {swItems.length === 1 ? 'product' : 'products'} ending soon
              </span>
              <span className={`text-xs ${hasCritical ? 'text-red-700' : 'text-orange-700'}`}>
                — {names.join(', ')}{extra > 0 ? ` +${extra} more` : ''}
              </span>
            </div>
          )
        })()}

        {/* Filter tabs */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 mb-4 w-fit gap-0.5">
          {FILTER_TABS.map(s => {
            const active = filter === s
            const cfg = filterTabCfg[s]
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={`flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {s}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? `${cfg.bg} ${cfg.text}` : 'bg-gray-200 text-gray-500'}`}>{tabCounts[s]}</span>
              </button>
            )
          })}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="pl-8 h-9 w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Search product or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">All categories</option>
              {(['Beauty', 'Clothing', 'Footwear', 'Accessories'] as const).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="h-9 pl-3 pr-7 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
              onChange={e => setFilter(e.target.value === '' ? 'All' : e.target.value as ReplenFilter)}>
              {stores.map(s => <option key={s} value={s === 'All' ? '' : s}>{s === 'All' ? 'All stores' : s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <span className="ml-auto text-xs text-gray-400">{rows.length} shown</span>
          <button className="h-9 px-3 flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
          <table className="text-xs" style={{ minWidth: 1280 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="sticky z-20 bg-gray-50 text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap" style={{ left: 0, minWidth: 196 }}>Product</th>
                <th className="sticky z-20 bg-gray-50 text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap" style={{ left: 196, minWidth: 100 }}>Store</th>
                <th className="sticky z-20 bg-indigo-50 text-right px-3 py-3 font-bold text-indigo-700 whitespace-nowrap border-x border-indigo-100" style={{ left: 296, minWidth: 104, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>Replen qty</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Status</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Selling Price</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Cost Price</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Gross Margin</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Weekly Sales</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Store Stock</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">DC Stock</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Wks Cover</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Target Range</th>
                <th className="sticky right-0 z-20 bg-gray-50 text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100" style={{ minWidth: 130, width: 130, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>Flags</th>
                <th className="px-3 py-3 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100">Size breakdown</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-10 text-center text-sm text-gray-400">No products match the current filters.</td></tr>
              )}
              {rows.map((p, i) => {
                const sc = scTableCfg[p.stockStatus]
                const grossMargin = Math.round((p.sellingPrice - p.costPrice) / p.sellingPrice * 100)
                const dcDot: Record<ReplenDCStatus, string> = { ok: 'bg-emerald-400', low: 'bg-amber-500', excess: 'bg-orange-400' }
                const stickyBg = i % 2 !== 0 ? '#f9fafb' : '#ffffff'
                const rowExitDate = getExitDate(p)
                const rowWksLeft = rowExitDate ? swWeeksRemaining(rowExitDate) : null
                const isPastExit = rowWksLeft !== null && rowWksLeft <= 0
                return (
                  <tr key={p.id} onClick={() => { setEditReplenQty(0); setEditTransferDate(''); setSelectedProduct(p) }}
                    className={`border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition-colors ${isPastExit ? 'opacity-40' : ''} ${i % 2 !== 0 ? 'bg-gray-50/20' : ''}`}>
                    <td className="sticky z-10 px-3 py-2" style={{ left: 0, backgroundColor: stickyBg }}>
                      <div className="flex items-center gap-2">
                        <img src={p.imageUrl} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                        <div>
                          <div className="font-semibold text-gray-900 whitespace-nowrap">{p.name}</div>
                          <div className="text-[10px] text-gray-400">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="sticky z-10 px-3 py-2 text-gray-600 whitespace-nowrap" style={{ left: 196, backgroundColor: stickyBg }}>{p.store}</td>
                    <td className="sticky z-10 px-3 py-2 text-right font-bold text-indigo-700 text-sm" style={{ left: 296, backgroundColor: stickyBg, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      {isPastExit ? <span className="text-gray-300 font-normal text-xs">—</span> : (() => {
                        if (rowExitDate && rowWksLeft !== null && rowWksLeft > 0) {
                          const taper = calcPhaseOutReplen(p, rowExitDate)
                          if (taper < p.suggestedReplen && p.suggestedReplen > 0) {
                            return (
                              <span className="group relative inline-flex items-center gap-1">
                                <span className="text-orange-600">{taper > 0 ? taper : '—'}</span>
                                <span className="text-[8px] text-orange-400">↓</span>
                                <span className="hidden group-hover:flex absolute right-0 top-5 z-50 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-2 w-48 leading-snug whitespace-normal flex-col gap-0.5 shadow-xl">
                                  <span className="font-semibold">Tapered: {p.suggestedReplen} → {taper > 0 ? taper : 0}</span>
                                  <span className="text-gray-300">{rowWksLeft}w × {p.weeklySales}/wk − {p.currentStock} stock − {p.targetMin} buffer</span>
                                </span>
                              </span>
                            )
                          }
                        }
                        return p.suggestedReplen > 0 ? <>{p.suggestedReplen.toLocaleString()}</> : <span className="text-gray-300 font-normal text-xs">—</span>
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">£{p.sellingPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">£{p.costPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{grossMargin}%</td>
                    <td className="px-3 py-2 text-right text-gray-700">{p.weeklySales}</td>
                    <td className="px-3 py-2 text-right"><span className="font-bold text-amber-600">{p.currentStock}</span></td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${dcDot[p.dcStatus]}`} />
                        <span className="text-gray-700">{p.dcStock.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right"><span className="font-bold text-amber-600">{p.weeksOfCover.toFixed(1)}</span></td>
                    <td className="px-3 py-2 text-right text-gray-700">{p.targetMin}–{p.targetMax}</td>
                    <td className="sticky right-0 z-10 px-3 py-2 border-l border-gray-100" style={{ width: 130, minWidth: 130, backgroundColor: stickyBg, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {p.isOnPromo && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Promo</span>}
                        {rowExitDate && (() => {
                          const wks = rowWksLeft!
                          if (wks <= 0) return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Ended</span>
                          if (wks <= 2) return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Ending soon</span>
                          return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Ending in {wks}w</span>
                        })()}
                        {p.dcStatus === 'low'    && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Low DC</span>}
                        {p.dcStatus === 'excess' && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Excess DC</span>}
                        {p.seasonality === 'high' && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Seasonal</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-l border-gray-100">
                      <ReplenSizeBar bands={p.sizeBreakdown} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('alerts')
  const [configMode, setConfigMode] = useState(false)
  const [pendingOpenInquiry, setPendingOpenInquiry] = useState<string | null>(null)
  const [pendingOpenPO, setPendingOpenPO] = useState<string | null>(null)

  // reset config mode when leaving inventory tab
  const handleTabChange = (t: Tab) => { setTab(t); if (t !== 'inventory') setConfigMode(false) }

  const handleNavigateToNeg = (recId: string) => {
    setPendingOpenInquiry(recId)
    handleTabChange('reorder')
  }
  const handleNavigateToPO = (poId: string) => {
    setPendingOpenPO(poId)
    handleTabChange('po-monitoring')
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'alerts',        label: 'Overview',                count: ALL_POS.filter(p => p.status === 'Ex-factory delay' || p.status === 'Date change required').length + STATIC_KANBAN_ITEMS.length },
    { id: 'inventory',     label: 'All Inventory',           count: INVENTORY_PRODUCTS.length },
    { id: 'reorder',         label: 'Reorder',               count: REORDER_RECOMMENDATIONS.length },
    { id: 'reorder-manager', label: 'Reorder - Manager View', count: REORDER_RECOMMENDATIONS.filter(r => r.approvalStatus === 'Pending Approval').length },
    { id: 'po-monitoring',  label: 'PO Monitoring',   count: ALL_POS.length },
    { id: 'replenishment',  label: 'Replenishment',   count: REPLEN_PRODUCTS.filter(p => p.suggestedReplen > 0).length },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-indigo-600" />
                <h1 className="text-lg font-bold text-gray-900">Inventory</h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-600 text-[11px] font-semibold rounded-full border border-green-100">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Active
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                A holistic inventory view to forecast, order and balance optimal stock levels across your network
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors">
                <span className="text-xs text-gray-400">Updated 3 min ago</span>
                <span className="w-px h-4 bg-gray-200" />
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="font-semibold text-gray-600">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 px-6 bg-white border-b border-gray-100 shrink-0">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`relative flex items-center gap-2 h-11 px-4 text-sm font-medium transition-colors ${
                tab === id
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
              }`}
            >
              {label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {tab === 'alerts'          && <AlertDigest />}
        {tab === 'inventory'       && <InventoryView configMode={configMode} setConfigMode={setConfigMode} />}
        {tab === 'reorder'         && <ReorderView initialOpenInquiry={pendingOpenInquiry} onNavigateToPO={handleNavigateToPO} />}
        {tab === 'reorder-manager' && <ManagerReorderView />}
        {tab === 'po-monitoring'   && <POMonitoringView initialOpenPO={pendingOpenPO} onNavigateToNeg={handleNavigateToNeg} />}
        {tab === 'replenishment'   && <ReplenishmentView />}
      </div>
    </div>
  )
}
