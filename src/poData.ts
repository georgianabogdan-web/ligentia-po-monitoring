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
import type { Supplier, PO, POEvent, ActionItem } from './App'
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
