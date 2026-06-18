// ─────────────────────────────────────────────────────────────────────────────
// LIGENTIA PO Monitoring — demo data layer (swap-in for upstream src/poData.ts).
// Suppliers / POs extracted from Ligentia Snowflake (PLC_PROD_*, Nisbets 44187),
// 2026-06-17. Journey-stage & fill-rate profiles derived from each supplier's
// real on-time/delay metrics; PO-event timelines & kanban items synthesised.
// ─────────────────────────────────────────────────────────────────────────────
import type { Supplier, PO, POEvent, ActionItem } from './App'
import type { SupplierJourneyData, SupplierFillHistory } from './predict'

export const SUPPLIERS: Supplier[] = [
  { id: 'GU8300', name: 'Guangzhou Boaosi Appliance Co',                 onTimeRate: 63, avgDelayDays: -7.0, contractualLeadTimeDays: 118, trend: 'stable',        openPOs: 114, category: 'Refrigeration' },
  { id: 'SH9898', name: 'Shandong Kingbetter Trading Co Ltd',            onTimeRate: 42, avgDelayDays: 22.5, contractualLeadTimeDays: 138, trend: 'deteriorating', openPOs: 112, category: 'Cooking Equipment' },
  { id: 'ZH9111', name: 'Zhongshan Better Home Appliance',               onTimeRate: 83, avgDelayDays: -8.9, contractualLeadTimeDays: 135, trend: 'improving',     openPOs: 96,  category: 'Cooking Equipment' },
  { id: 'CO1900', name: 'Waring Products Division',                      onTimeRate: 13, avgDelayDays: 84.5, contractualLeadTimeDays: 84,  trend: 'deteriorating', openPOs: 112, category: 'Food Prep Machines' },
  { id: 'ZH1555', name: 'Zhaoqing Gold Artex Electrical Appliance Co',   onTimeRate: 47, avgDelayDays: 9.4,  contractualLeadTimeDays: 85,  trend: 'stable',        openPOs: 62,  category: 'Cooking Equipment' },
  { id: 'NI9888', name: 'Ningbo Sino Machinery Co Ltd',                  onTimeRate: 47, avgDelayDays: 7.2,  contractualLeadTimeDays: 113, trend: 'stable',        openPOs: 77,  category: 'Food Prep Machines' },
  { id: 'GU9811', name: 'Guangdong Shunde Minghao Import & Export Co',   onTimeRate: 34, avgDelayDays: 24.4, contractualLeadTimeDays: 130, trend: 'deteriorating', openPOs: 66,  category: 'Cooking Equipment' },
  { id: 'GU2222', name: 'Guangdong Midea Kitchen',                       onTimeRate: 36, avgDelayDays: 6.0,  contractualLeadTimeDays: 139, trend: 'deteriorating', openPOs: 43,  category: 'Cooking Equipment' },
  { id: 'BA0500', name: 'Baixue International Co Ltd',                    onTimeRate: 56, avgDelayDays: -5.7, contractualLeadTimeDays: 143, trend: 'stable',        openPOs: 43,  category: 'Refrigeration' },
  { id: 'JA5000', name: 'Jackson Cutting Board Co Ltd',                  onTimeRate: 76, avgDelayDays: -10.2, contractualLeadTimeDays: 120, trend: 'improving',    openPOs: 5,   category: 'Kitchen Supplies' },
  { id: 'JA1010', name: 'Jagdamba Cutlery Ltd',                          onTimeRate: 24, avgDelayDays: 33.6, contractualLeadTimeDays: 141, trend: 'deteriorating', openPOs: 6,   category: 'Tableware & Cutlery' },
  { id: 'GL1200', name: 'Glen Industries Ltd',                           onTimeRate: 6,  avgDelayDays: 28.1, contractualLeadTimeDays: 132, trend: 'deteriorating', openPOs: 7,   category: 'Disposables & Storage' },
]

export const SUPPLIER_EMAILS: Record<string, string> = {
  GU8300: 'orders@boaosi.com.cn',
  SH9898: 'export@kingbetter.cn',
  ZH9111: 'sales@betterhome-appliance.cn',
  CO1900: 'orders@waringproducts.com',
  ZH1555: 'export@gold-artex.cn',
  NI9888: 'sales@ningbosino.cn',
  GU9811: 'orders@minghao-exp.cn',
  GU2222: 'foodservice@midea.com',
  BA0500: 'sales@baixue-intl.com',
  JA5000: 'orders@jacksonboards.cn',
  JA1010: 'export@jagdambacutlery.in',
  GL1200: 'orders@glenindustries.in',
}

export const ALL_POS: PO[] = [
  // ── Delivered ───────────────────────────────────────────────────────────────
  { id: 'PO-5188712', supplierId: 'GU8300', product: 'Polar G-Series Back Bar Cooler with Double Doors', category: 'Refrigeration',      createdOn: '23/12/25', expectedDelivery: '2026-05-05', revisedDelivery: '2026-06-16', status: 'Delivered', priority: true,  quantity: 3929,  skus: 22, orderValue: '$883,666', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5186623', supplierId: 'GU2222', product: 'Buffalo Programmable Commercial Microwave 1.8kW',  category: 'Cooking Equipment',  createdOn: '13/11/25', expectedDelivery: '2026-03-05', revisedDelivery: '2026-03-11', status: 'Delivered', priority: false, quantity: 2126,  skus: 11, orderValue: '$483,692', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5189309', supplierId: 'SH9898', product: 'Buffalo Conveyor Toaster',                         category: 'Cooking Equipment',  createdOn: '20/01/26', expectedDelivery: '2026-07-10', revisedDelivery: '2026-06-16', status: 'Delivered', priority: false, quantity: 2728,  skus: 41, orderValue: '$331,348', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5188718', supplierId: 'ZH1555', product: 'Buffalo Rice Cooker - 1.95kW 220-240V',           category: 'Cooking Equipment',  createdOn: '19/05/26', expectedDelivery: '2026-04-27', revisedDelivery: '2026-06-11', status: 'Delivered', priority: false, quantity: 10193, skus: 60, orderValue: '$312,437', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5188714', supplierId: 'NI9888', product: 'Buffalo Planetary Mixer - 20Ltr',                 category: 'Food Prep Machines', createdOn: '23/12/25', expectedDelivery: '2026-05-05', revisedDelivery: '2026-05-29', status: 'Delivered', priority: false, quantity: 590,   skus: 6,  orderValue: '$273,918', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5188490', supplierId: 'SH9898', product: 'Buffalo Double Fryer with Timer - 2x8Ltr',        category: 'Cooking Equipment',  createdOn: '08/05/26', expectedDelivery: '2026-06-05', revisedDelivery: '2026-06-08', status: 'Delivered', priority: false, quantity: 2912,  skus: 26, orderValue: '$315,537', freight: 'Sea', handledBy: 'agent' },

  // ── Partially Delivered (real POs, re-labelled for demo) ──────────────────────
  { id: 'PO-5187024', supplierId: 'GU2222', product: 'Buffalo Programmable Commercial Microwave 1.5kW',  category: 'Cooking Equipment',  createdOn: '18/11/25', expectedDelivery: '2026-03-18', status: 'Partially Delivered', priority: false, quantity: 1136, skus: 30, orderValue: '$337,202', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5191188', supplierId: 'GU8300', product: 'HOST Black Beer Cooler Double Sliding Door',       category: 'Refrigeration',      createdOn: '10/03/26', expectedDelivery: '2026-07-24', status: 'Partially Delivered', priority: false, quantity: 988,  skus: 23, orderValue: '$98,861',  freight: 'Sea', handledBy: 'agent' },

  // ── In Transit ────────────────────────────────────────────────────────────────
  { id: 'PO-5189841', supplierId: 'GU2222', product: 'Buffalo Programmable Commercial Microwave 1.8kW',  category: 'Cooking Equipment',  createdOn: '28/01/26', expectedDelivery: '2026-06-25', status: 'In Transit', priority: true,  quantity: 3075, skus: 23, orderValue: '$541,516', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5189851', supplierId: 'SH9898', product: 'Buffalo Large Countertop Griddle Steel Plate',     category: 'Cooking Equipment',  createdOn: '28/01/26', expectedDelivery: '2026-07-13', status: 'In Transit', priority: true,  quantity: 3302, skus: 28, orderValue: '$370,293', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5189817', supplierId: 'NI9888', product: 'Buffalo Planetary Mixer - 20Ltr',                 category: 'Food Prep Machines', createdOn: '28/01/26', expectedDelivery: '2026-06-10', status: 'In Transit', priority: false, quantity: 415,  skus: 5,  orderValue: '$185,680', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5189939', supplierId: 'BA0500', product: 'Polar C-Series Countertop Ice Machine 15kg',       category: 'Refrigeration',      createdOn: '12/03/26', expectedDelivery: '2026-06-17', status: 'In Transit', priority: false, quantity: 1441, skus: 7,  orderValue: '$164,268', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5186872', supplierId: 'CO1900', product: 'Waring X-Prep Kitchen Blender - 2Ltr Jar',         category: 'Food Prep Machines', createdOn: '06/03/26', expectedDelivery: '2026-06-26', revisedDelivery: '2026-06-26', status: 'In Transit', priority: false, quantity: 270, skus: 5, orderValue: '$108,991', freight: 'Air', handledBy: 'agent',
    dateChanges: [
      { id: 'dc-5186872-1', fromDate: '2026-03-11', toDate: '2026-06-26', days: 107, causedBy: 'supplier', reasonCode: 'capacity', reason: 'Blender motor line oversubscribed — ex-factory pushed out 15 weeks.', at: '2026-03-20T09:00:00Z' },
    ] },

  // ── Late DC booking ─────────────────────────────────────────────────────────
  { id: 'PO-5189828', supplierId: 'ZH9111', product: 'Buffalo Induction Hob - 3kW',                      category: 'Cooking Equipment',  createdOn: '28/01/26', expectedDelivery: '2026-06-30', status: 'Late DC booking', priority: true,  quantity: 3504, skus: 48, orderValue: '$281,404', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5189314', supplierId: 'JA1010', product: 'Olympia Buckingham Table Knife St/St 18/0',        category: 'Tableware & Cutlery',createdOn: '20/01/26', expectedDelivery: '2026-07-22', status: 'Late DC booking', priority: false, quantity: 37960, skus: 26, orderValue: '$134,276', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5191211', supplierId: 'JA5000', product: 'Hygiplas High Density Anti-Bacterial Chopping Board', category: 'Kitchen Supplies', createdOn: '12/03/26', expectedDelivery: '2026-07-14', status: 'Late DC booking', priority: false, quantity: 21373, skus: 52, orderValue: '$110,072', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5189048', supplierId: 'GU9811', product: 'Rowlett Regent 6 Slot Toaster White',             category: 'Cooking Equipment',  createdOn: '16/01/26', expectedDelivery: '2026-06-13', status: 'Late DC booking', priority: false, quantity: 2765, skus: 30, orderValue: '$103,407', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5189030', supplierId: 'GU9811', product: 'Buffalo Electric Freestanding Fryer',             category: 'Cooking Equipment',  createdOn: '13/01/26', expectedDelivery: '2026-06-25', status: 'Late DC booking', priority: false, quantity: 70,   skus: 1,  orderValue: '$34,234',  freight: 'Sea', handledBy: 'agent' },

  // ── Date change required (real orig→revised due-date slips) ───────────────────
  { id: 'PO-5189823', supplierId: 'ZH1555', product: 'Nisbets Essentials Manual Fill Water Boiler',      category: 'Cooking Equipment',  createdOn: '28/01/26', expectedDelivery: '2026-06-01', revisedDelivery: '2026-06-06', status: 'Date change required', priority: false, quantity: 1126, skus: 12, orderValue: '$35,874', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-5189823-1', fromDate: '2026-06-01', toDate: '2026-06-06', days: 5, causedBy: 'supplier', reasonCode: 'capacity', reason: 'Heating-element sub-supplier ran 5 days late on the element batch.', at: '2026-05-12T10:00:00Z' },
    ] },
  { id: 'PO-5189934', supplierId: 'BA0500', product: 'Polar G-Series Spray Ice Maker - 120kg',           category: 'Refrigeration',      createdOn: '11/02/26', expectedDelivery: '2026-04-29', revisedDelivery: '2026-09-25', status: 'Date change required', priority: true, quantity: 48, skus: 2, orderValue: '$31,536', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-5189934-1', fromDate: '2026-04-29', toDate: '2026-07-15', days: 77, causedBy: 'supplier', reasonCode: 'raw_material', reason: 'Compressor allocation shortfall — re-sourced from alternate vendor.', at: '2026-04-15T08:30:00Z' },
      { id: 'dc-5189934-2', fromDate: '2026-07-15', toDate: '2026-09-25', days: 72, causedBy: 'supplier', reasonCode: 'capacity', reason: 'Replacement compressors slipped factory slot again.', at: '2026-06-02T14:00:00Z' },
    ] },
  { id: 'PO-5190105', supplierId: 'GU9811', product: 'Nisbets Essentials 2 Slot Toaster',               category: 'Cooking Equipment',  createdOn: '09/02/26', expectedDelivery: '2026-07-13', revisedDelivery: '2026-10-19', status: 'Date change required', priority: false, quantity: 300, skus: 1, orderValue: '$15,900', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-5190105-1', fromDate: '2026-07-13', toDate: '2026-10-19', days: 98, causedBy: 'supplier', reasonCode: 'capacity', reason: 'PO consolidated into a later sailing to fill a container.', at: '2026-05-20T11:00:00Z' },
    ] },
  { id: 'PO-5188089', supplierId: 'CO1900', product: 'Waring Xtreme Hi-Power Blender MX1000',           category: 'Food Prep Machines', createdOn: '22/01/26', expectedDelivery: '2026-05-25', revisedDelivery: '2026-06-12', status: 'Date change required', priority: false, quantity: 27, skus: 1, orderValue: '$12,745', freight: 'Air', handledBy: 'human',
    dateChanges: [
      { id: 'dc-5188089-1', fromDate: '2026-05-25', toDate: '2026-06-12', days: 18, causedBy: 'buyer', reasonCode: 'spec_change', reason: 'Buyer requested UK plug variant after order placed.', at: '2026-05-02T16:00:00Z' },
    ] },
  { id: 'PO-5191193', supplierId: 'GU2222', product: 'Buffalo H.V. Transformer for FB863/FB864',        category: 'Cooking Equipment',  createdOn: '02/06/26', expectedDelivery: '2026-07-24', revisedDelivery: '2026-10-04', status: 'Date change required', priority: false, quantity: 525, skus: 36, orderValue: '$5,565', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-5191193-1', fromDate: '2026-07-24', toDate: '2026-10-04', days: 72, causedBy: 'supplier', reasonCode: 'raw_material', reason: 'Transformer core laminations on extended lead time.', at: '2026-06-10T09:00:00Z' },
    ] },

  // ── Ex-factory delay (real high-value POs, re-labelled for demo) ──────────────
  { id: 'PO-5189837', supplierId: 'GU9811', product: 'Nisbets Essentials Countertop Griddle',            category: 'Cooking Equipment',  createdOn: '28/01/26', expectedDelivery: '2026-06-17', revisedDelivery: '2026-07-08', status: 'Ex-factory delay', priority: true, quantity: 4989, skus: 47, orderValue: '$180,507', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-5189837-1', fromDate: '2026-06-17', toDate: '2026-07-08', days: 21, causedBy: 'supplier', reasonCode: 'capacity', reason: 'Press-line capacity shared with a competing order — ex-factory missed.', at: '2026-06-05T09:00:00Z' },
    ] },
  { id: 'PO-5191549', supplierId: 'BA0500', product: 'Polar G-Series Under Counter Ice Machine',         category: 'Refrigeration',      createdOn: '17/03/26', expectedDelivery: '2026-08-12', revisedDelivery: '2026-09-02', status: 'Ex-factory delay', priority: false, quantity: 266, skus: 1, orderValue: '$81,662', freight: 'Sea', handledBy: 'human',
    dateChanges: [
      { id: 'dc-5191549-1', fromDate: '2026-08-12', toDate: '2026-09-02', days: 21, causedBy: 'supplier', reasonCode: 'raw_material', reason: 'Stainless cabinet stock delayed at the mill.', at: '2026-06-12T10:00:00Z' },
    ] },

  // ── Acknowledged ──────────────────────────────────────────────────────────────
  { id: 'PO-5190318', supplierId: 'GU9811', product: 'Rowlett Double Slice Conveyor Toaster',           category: 'Cooking Equipment',  createdOn: '12/02/26', expectedDelivery: '2026-07-25', status: 'Acknowledged', priority: false, quantity: 3097, skus: 47, orderValue: '$182,437', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5191582', supplierId: 'JA1010', product: 'Olympia Harley Dessert Spoon St/St (Box 12)',      category: 'Tableware & Cutlery',createdOn: '17/03/26', expectedDelivery: '2026-08-21', status: 'Acknowledged', priority: false, quantity: 53326, skus: 27, orderValue: '$167,530', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5191600', supplierId: 'GL1200', product: 'Vogue Ice Cream Container - 4Ltr (Pack 15)',       category: 'Disposables & Storage', createdOn: '01/04/26', expectedDelivery: '2026-07-30', status: 'Acknowledged', priority: false, quantity: 28638, skus: 17, orderValue: '$150,112', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5194723', supplierId: 'ZH1555', product: 'Buffalo Black Soup Kettle - 10Ltr',               category: 'Cooking Equipment',  createdOn: '11/06/26', expectedDelivery: '2026-10-05', status: 'Acknowledged', priority: false, quantity: 2744, skus: 14, orderValue: '$92,625', freight: 'Sea', handledBy: 'agent' },

  // ── Sent to supplier (recent POs, re-labelled for demo) ───────────────────────
  { id: 'PO-5194730', supplierId: 'GU9811', product: 'Rowlett Premier 6 Slot Toaster with Spare Element', category: 'Cooking Equipment', createdOn: '11/06/26', expectedDelivery: '2026-11-09', status: 'Sent to supplier', priority: false, quantity: 2369, skus: 34, orderValue: '$110,843', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5193418', supplierId: 'GU8300', product: 'Polar G-Series Back Bar Cooler with Double Doors', category: 'Refrigeration',     createdOn: '12/05/26', expectedDelivery: '2026-09-25', status: 'Sent to supplier', priority: false, quantity: 444,  skus: 11, orderValue: '$96,526',  freight: 'Sea', handledBy: 'agent' },

  // ── On track ────────────────────────────────────────────────────────────────
  { id: 'PO-5193972', supplierId: 'SH9898', product: 'Buffalo Large Countertop Griddle Steel Plate',     category: 'Cooking Equipment',  createdOn: '20/05/26', expectedDelivery: '2026-10-10', status: 'On track', priority: true,  quantity: 4014, skus: 48, orderValue: '$398,576', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5192866', supplierId: 'JA1010', product: 'Olympia Harley Table Fork St/St (Box 12)',         category: 'Tableware & Cutlery',createdOn: '21/04/26', expectedDelivery: '2026-09-25', status: 'On track', priority: false, quantity: 91229, skus: 29, orderValue: '$289,777', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5192251', supplierId: 'ZH9111', product: 'Buffalo Touch Control Single Induction Hob',       category: 'Cooking Equipment',  createdOn: '08/04/26', expectedDelivery: '2026-08-27', status: 'On track', priority: false, quantity: 1869, skus: 55, orderValue: '$147,330', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5194740', supplierId: 'JA5000', product: 'Hygiplas Low Density Chopping Boards - 450mm',     category: 'Kitchen Supplies',   createdOn: '12/06/26', expectedDelivery: '2026-10-15', status: 'On track', priority: false, quantity: 26647, skus: 43, orderValue: '$142,880', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5194731', supplierId: 'GU2222', product: 'Buffalo Programmable Commercial Microwave 1.8kW',  category: 'Cooking Equipment',  createdOn: '11/06/26', expectedDelivery: '2026-10-26', status: 'On track', priority: false, quantity: 1308, skus: 24, orderValue: '$135,647', freight: 'Sea', handledBy: 'agent' },
  { id: 'PO-5195151', supplierId: 'GL1200', product: 'Vogue Ice Cream Container Lid for 2Ltr & 4Ltr',    category: 'Disposables & Storage', createdOn: '16/06/26', expectedDelivery: '2026-11-16', status: 'On track', priority: false, quantity: 49457, skus: 20, orderValue: '$105,087', freight: 'Sea', handledBy: 'agent' },
]

export const PO_PRODUCT_MAP: Record<string, string> = {}

export const NEG_PO_MAP: Record<string, string> = {}

export const SEED_PO_EVENTS: Record<string, POEvent[]> = {
  'PO-5189837': [
    { id: 'e1', type: 'chase_sent',     timestamp: '2026-06-05T09:10:00Z', body: 'Ex-factory chase sent to Guangdong Shunde Minghao. Countertop Griddle — ex-factory date passed with no dispatch confirmation.', author: 'agent' },
    { id: 'e2', type: 'supplier_reply', timestamp: '2026-06-08T13:20:00Z', body: 'Reply: press-line capacity shared with a competing order; ex-factory now expected 8 Jul.', author: 'agent' },
  ],
  'PO-5191549': [
    { id: 'e3', type: 'chase_sent',     timestamp: '2026-06-12T10:00:00Z', body: 'Ex-factory chase sent to Baixue International. Under Counter Ice Machine — stainless cabinet stock delayed at the mill.', author: 'agent' },
  ],
  'PO-5189934': [
    { id: 'e4', type: 'supplier_reply',       timestamp: '2026-06-02T11:00:00Z', body: 'Baixue: compressor allocation shortfall, re-sourcing from alternate vendor. Requesting move to 25 Sep.', author: 'agent' },
    { id: 'e5', type: 'date_change_proposed', timestamp: '2026-06-02T11:05:00Z', body: 'Agent proposed: delivery 15 Jul → 25 Sep. Queued for buyer approval.', author: 'agent' },
  ],
  'PO-5186872': [
    { id: 'e6', type: 'chase_sent',     timestamp: '2026-03-20T09:00:00Z', body: 'Ex-factory chase sent to Waring Products. X-Prep Blender — blender motor line oversubscribed.', author: 'agent' },
    { id: 'e7', type: 'manual_note',    timestamp: '2026-04-02T16:00:00Z', body: 'Called Waring ops. Motor sub-assembly on 15-week lead time; ex-factory pushed to late June.', author: 'buyer' },
  ],
}

export const STATIC_KANBAN_ITEMS: ActionItem[] = [
  {
    id: 'A-101', bucket: 'intake-volume',
    headline: 'High intake week — w/c 22 Jun needs resourcing',
    detail: '14 containers scheduled to arrive at the AZTEC DC in the week of 22 Jun — well above the weekly average. Receiving may bottleneck without extra resource.',
    suggestedAction: 'Brief the AZTEC intake team and book additional unloading resource for w/c 22 Jun.',
    metric: '14 containers',
  },
]

export const SUPPLIER_JOURNEY: Record<string, SupplierJourneyData> = {
  GU8300: {
    tier:    'Watch',
    summary: '63% on-time overall; customs clearance is the weakest stage (-7.0d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 75, avgDelay: 0.0, trend: 'stable' },
      fit:        { onTime: 75, avgDelay: 0.0, trend: 'stable' },
      booking:    { onTime: 67, avgDelay: -1.1, trend: 'stable' },
      handover:   { onTime: 67, avgDelay: -1.1, trend: 'stable' },
      shipment:   { onTime: 67, avgDelay: -1.1, trend: 'stable' },
      in_transit: { onTime: 67, avgDelay: -1.1, trend: 'stable' },
      customs:    { onTime: 41, avgDelay: -1.1, trend: 'worsening' },
      dc_arrival: { onTime: 67, avgDelay: -1.1, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 64, avgDelay: -7.0, volume: 34 },
      { month: 'Jan', onTime: 62, avgDelay: -7.0, volume: 37 },
      { month: 'Feb', onTime: 64, avgDelay: -7.0, volume: 40 },
      { month: 'Mar', onTime: 62, avgDelay: -7.0, volume: 44 },
      { month: 'Apr', onTime: 64, avgDelay: -7.0, volume: 47 },
      { month: 'May', onTime: 62, avgDelay: -7.0, volume: 50 },
    ],
  },
  SH9898: {
    tier:    'Critical',
    summary: '42% on-time overall; shipment departure is the weakest stage (+22.5d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 1.5, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 1.5, trend: 'stable' },
      booking:    { onTime: 46, avgDelay: 3.4, trend: 'worsening' },
      handover:   { onTime: 46, avgDelay: 3.4, trend: 'worsening' },
      shipment:   { onTime: 20, avgDelay: 7.8, trend: 'worsening' },
      in_transit: { onTime: 46, avgDelay: 3.4, trend: 'worsening' },
      customs:    { onTime: 46, avgDelay: 3.4, trend: 'worsening' },
      dc_arrival: { onTime: 46, avgDelay: 3.4, trend: 'worsening' },
    },
    history: [
      { month: 'Dec', onTime: 51, avgDelay: 19.5, volume: 22 },
      { month: 'Jan', onTime: 49, avgDelay: 20.1, volume: 24 },
      { month: 'Feb', onTime: 47, avgDelay: 20.7, volume: 26 },
      { month: 'Mar', onTime: 46, avgDelay: 21.3, volume: 28 },
      { month: 'Apr', onTime: 44, avgDelay: 21.9, volume: 30 },
      { month: 'May', onTime: 42, avgDelay: 22.5, volume: 32 },
    ],
  },
  ZH9111: {
    tier:    'Good',
    summary: '83% on-time overall; customs clearance is the weakest stage (-8.9d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 95, avgDelay: 0.0, trend: 'stable' },
      fit:        { onTime: 95, avgDelay: 0.0, trend: 'stable' },
      booking:    { onTime: 87, avgDelay: -1.3, trend: 'improving' },
      handover:   { onTime: 87, avgDelay: -1.3, trend: 'improving' },
      shipment:   { onTime: 87, avgDelay: -1.3, trend: 'improving' },
      in_transit: { onTime: 87, avgDelay: -1.3, trend: 'improving' },
      customs:    { onTime: 61, avgDelay: -1.7, trend: 'worsening' },
      dc_arrival: { onTime: 87, avgDelay: -1.3, trend: 'improving' },
    },
    history: [
      { month: 'Dec', onTime: 74, avgDelay: -6.4, volume: 18 },
      { month: 'Jan', onTime: 76, avgDelay: -6.9, volume: 20 },
      { month: 'Feb', onTime: 78, avgDelay: -7.4, volume: 22 },
      { month: 'Mar', onTime: 79, avgDelay: -7.9, volume: 24 },
      { month: 'Apr', onTime: 81, avgDelay: -8.4, volume: 26 },
      { month: 'May', onTime: 83, avgDelay: -8.9, volume: 28 },
    ],
  },
  CO1900: {
    tier:    'Critical',
    summary: '13% on-time overall; handover is the weakest stage (+84.5d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 5.6, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 5.6, trend: 'stable' },
      booking:    { onTime: 17, avgDelay: 12.7, trend: 'worsening' },
      handover:   { onTime: 5, avgDelay: 26.4, trend: 'worsening' },
      shipment:   { onTime: 17, avgDelay: 12.7, trend: 'worsening' },
      in_transit: { onTime: 17, avgDelay: 12.7, trend: 'worsening' },
      customs:    { onTime: 17, avgDelay: 12.7, trend: 'worsening' },
      dc_arrival: { onTime: 17, avgDelay: 12.7, trend: 'worsening' },
    },
    history: [
      { month: 'Dec', onTime: 22, avgDelay: 81.5, volume: 16 },
      { month: 'Jan', onTime: 20, avgDelay: 82.1, volume: 18 },
      { month: 'Feb', onTime: 18, avgDelay: 82.7, volume: 19 },
      { month: 'Mar', onTime: 17, avgDelay: 83.3, volume: 21 },
      { month: 'Apr', onTime: 15, avgDelay: 83.9, volume: 22 },
      { month: 'May', onTime: 13, avgDelay: 84.5, volume: 24 },
    ],
  },
  ZH1555: {
    tier:    'At risk',
    summary: '47% on-time overall; in-transit is the weakest stage (+9.4d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 0.6, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 0.6, trend: 'stable' },
      booking:    { onTime: 51, avgDelay: 1.4, trend: 'stable' },
      handover:   { onTime: 51, avgDelay: 1.4, trend: 'stable' },
      shipment:   { onTime: 51, avgDelay: 1.4, trend: 'stable' },
      in_transit: { onTime: 25, avgDelay: 3.8, trend: 'worsening' },
      customs:    { onTime: 51, avgDelay: 1.4, trend: 'stable' },
      dc_arrival: { onTime: 51, avgDelay: 1.4, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 48, avgDelay: 9.4, volume: 14 },
      { month: 'Jan', onTime: 46, avgDelay: 9.4, volume: 16 },
      { month: 'Feb', onTime: 48, avgDelay: 9.4, volume: 17 },
      { month: 'Mar', onTime: 46, avgDelay: 9.4, volume: 19 },
      { month: 'Apr', onTime: 48, avgDelay: 9.4, volume: 20 },
      { month: 'May', onTime: 46, avgDelay: 9.4, volume: 22 },
    ],
  },
  NI9888: {
    tier:    'At risk',
    summary: '47% on-time overall; shipment departure is the weakest stage (+7.2d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 0.5, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 0.5, trend: 'stable' },
      booking:    { onTime: 51, avgDelay: 1.1, trend: 'stable' },
      handover:   { onTime: 51, avgDelay: 1.1, trend: 'stable' },
      shipment:   { onTime: 25, avgDelay: 3.2, trend: 'worsening' },
      in_transit: { onTime: 51, avgDelay: 1.1, trend: 'stable' },
      customs:    { onTime: 51, avgDelay: 1.1, trend: 'stable' },
      dc_arrival: { onTime: 51, avgDelay: 1.1, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 48, avgDelay: 7.2, volume: 14 },
      { month: 'Jan', onTime: 46, avgDelay: 7.2, volume: 16 },
      { month: 'Feb', onTime: 48, avgDelay: 7.2, volume: 17 },
      { month: 'Mar', onTime: 46, avgDelay: 7.2, volume: 19 },
      { month: 'Apr', onTime: 48, avgDelay: 7.2, volume: 20 },
      { month: 'May', onTime: 46, avgDelay: 7.2, volume: 22 },
    ],
  },
  GU9811: {
    tier:    'Critical',
    summary: '34% on-time overall; handover is the weakest stage (+24.4d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 1.6, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 1.6, trend: 'stable' },
      booking:    { onTime: 38, avgDelay: 3.7, trend: 'worsening' },
      handover:   { onTime: 12, avgDelay: 8.3, trend: 'worsening' },
      shipment:   { onTime: 38, avgDelay: 3.7, trend: 'worsening' },
      in_transit: { onTime: 38, avgDelay: 3.7, trend: 'worsening' },
      customs:    { onTime: 38, avgDelay: 3.7, trend: 'worsening' },
      dc_arrival: { onTime: 38, avgDelay: 3.7, trend: 'worsening' },
    },
    history: [
      { month: 'Dec', onTime: 43, avgDelay: 21.4, volume: 14 },
      { month: 'Jan', onTime: 41, avgDelay: 22.0, volume: 16 },
      { month: 'Feb', onTime: 39, avgDelay: 22.6, volume: 17 },
      { month: 'Mar', onTime: 38, avgDelay: 23.2, volume: 19 },
      { month: 'Apr', onTime: 36, avgDelay: 23.8, volume: 20 },
      { month: 'May', onTime: 34, avgDelay: 24.4, volume: 22 },
    ],
  },
  GU2222: {
    tier:    'Critical',
    summary: '36% on-time overall; customs clearance is the weakest stage (+6.0d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 0.4, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 0.4, trend: 'stable' },
      booking:    { onTime: 40, avgDelay: 0.9, trend: 'worsening' },
      handover:   { onTime: 40, avgDelay: 0.9, trend: 'worsening' },
      shipment:   { onTime: 40, avgDelay: 0.9, trend: 'worsening' },
      in_transit: { onTime: 40, avgDelay: 0.9, trend: 'worsening' },
      customs:    { onTime: 14, avgDelay: 2.8, trend: 'worsening' },
      dc_arrival: { onTime: 40, avgDelay: 0.9, trend: 'worsening' },
    },
    history: [
      { month: 'Dec', onTime: 45, avgDelay: 3.0, volume: 10 },
      { month: 'Jan', onTime: 43, avgDelay: 3.6, volume: 11 },
      { month: 'Feb', onTime: 41, avgDelay: 4.2, volume: 12 },
      { month: 'Mar', onTime: 40, avgDelay: 4.8, volume: 12 },
      { month: 'Apr', onTime: 38, avgDelay: 5.4, volume: 13 },
      { month: 'May', onTime: 36, avgDelay: 6.0, volume: 14 },
    ],
  },
  BA0500: {
    tier:    'At risk',
    summary: '56% on-time overall; shipment departure is the weakest stage (-5.7d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 68, avgDelay: 0.0, trend: 'stable' },
      fit:        { onTime: 68, avgDelay: 0.0, trend: 'stable' },
      booking:    { onTime: 60, avgDelay: -0.9, trend: 'stable' },
      handover:   { onTime: 60, avgDelay: -0.9, trend: 'stable' },
      shipment:   { onTime: 34, avgDelay: -0.7, trend: 'worsening' },
      in_transit: { onTime: 60, avgDelay: -0.9, trend: 'stable' },
      customs:    { onTime: 60, avgDelay: -0.9, trend: 'stable' },
      dc_arrival: { onTime: 60, avgDelay: -0.9, trend: 'stable' },
    },
    history: [
      { month: 'Dec', onTime: 57, avgDelay: -5.7, volume: 10 },
      { month: 'Jan', onTime: 55, avgDelay: -5.7, volume: 11 },
      { month: 'Feb', onTime: 57, avgDelay: -5.7, volume: 12 },
      { month: 'Mar', onTime: 55, avgDelay: -5.7, volume: 12 },
      { month: 'Apr', onTime: 57, avgDelay: -5.7, volume: 13 },
      { month: 'May', onTime: 55, avgDelay: -5.7, volume: 14 },
    ],
  },
  JA5000: {
    tier:    'Good',
    summary: '76% on-time overall; handover is the weakest stage (-10.2d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 88, avgDelay: 0.0, trend: 'stable' },
      fit:        { onTime: 88, avgDelay: 0.0, trend: 'stable' },
      booking:    { onTime: 80, avgDelay: -1.5, trend: 'improving' },
      handover:   { onTime: 54, avgDelay: -2.1, trend: 'worsening' },
      shipment:   { onTime: 80, avgDelay: -1.5, trend: 'improving' },
      in_transit: { onTime: 80, avgDelay: -1.5, trend: 'improving' },
      customs:    { onTime: 80, avgDelay: -1.5, trend: 'improving' },
      dc_arrival: { onTime: 80, avgDelay: -1.5, trend: 'improving' },
    },
    history: [
      { month: 'Dec', onTime: 67, avgDelay: -7.7, volume: 6 },
      { month: 'Jan', onTime: 69, avgDelay: -8.2, volume: 7 },
      { month: 'Feb', onTime: 71, avgDelay: -8.7, volume: 8 },
      { month: 'Mar', onTime: 72, avgDelay: -9.2, volume: 8 },
      { month: 'Apr', onTime: 74, avgDelay: -9.7, volume: 9 },
      { month: 'May', onTime: 76, avgDelay: -10.2, volume: 10 },
    ],
  },
  JA1010: {
    tier:    'Critical',
    summary: '24% on-time overall; shipment departure is the weakest stage (+33.6d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 2.2, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 2.2, trend: 'stable' },
      booking:    { onTime: 28, avgDelay: 5.0, trend: 'worsening' },
      handover:   { onTime: 28, avgDelay: 5.0, trend: 'worsening' },
      shipment:   { onTime: 5, avgDelay: 11.1, trend: 'worsening' },
      in_transit: { onTime: 28, avgDelay: 5.0, trend: 'worsening' },
      customs:    { onTime: 28, avgDelay: 5.0, trend: 'worsening' },
      dc_arrival: { onTime: 28, avgDelay: 5.0, trend: 'worsening' },
    },
    history: [
      { month: 'Dec', onTime: 33, avgDelay: 30.6, volume: 5 },
      { month: 'Jan', onTime: 31, avgDelay: 31.2, volume: 5 },
      { month: 'Feb', onTime: 29, avgDelay: 31.8, volume: 6 },
      { month: 'Mar', onTime: 28, avgDelay: 32.4, volume: 6 },
      { month: 'Apr', onTime: 26, avgDelay: 33.0, volume: 7 },
      { month: 'May', onTime: 24, avgDelay: 33.6, volume: 7 },
    ],
  },
  GL1200: {
    tier:    'Critical',
    summary: '6% on-time overall; booking placement is the weakest stage (+28.1d avg) and is the gating risk on open POs.',
    byStage: {
      sample:     { onTime: 60, avgDelay: 1.9, trend: 'stable' },
      fit:        { onTime: 60, avgDelay: 1.9, trend: 'stable' },
      booking:    { onTime: 5, avgDelay: 9.4, trend: 'worsening' },
      handover:   { onTime: 10, avgDelay: 4.2, trend: 'worsening' },
      shipment:   { onTime: 10, avgDelay: 4.2, trend: 'worsening' },
      in_transit: { onTime: 10, avgDelay: 4.2, trend: 'worsening' },
      customs:    { onTime: 10, avgDelay: 4.2, trend: 'worsening' },
      dc_arrival: { onTime: 10, avgDelay: 4.2, trend: 'worsening' },
    },
    history: [
      { month: 'Dec', onTime: 15, avgDelay: 25.1, volume: 6 },
      { month: 'Jan', onTime: 13, avgDelay: 25.7, volume: 6 },
      { month: 'Feb', onTime: 11, avgDelay: 26.3, volume: 7 },
      { month: 'Mar', onTime: 10, avgDelay: 26.9, volume: 7 },
      { month: 'Apr', onTime: 8, avgDelay: 27.5, volume: 8 },
      { month: 'May', onTime: 6, avgDelay: 28.1, volume: 8 },
    ],
  },
}

export const SUPPLIER_FILL_RATE: Record<string, SupplierFillHistory> = {
  GU8300: { avgFillRatePct: 94, fillVolatilityPts: 5, trend: 'stable', posObserved: 18, worstRecentPct: 88 },
  SH9898: { avgFillRatePct: 84, fillVolatilityPts: 12, trend: 'worsening', posObserved: 14, worstRecentPct: 62 },
  ZH9111: { avgFillRatePct: 85, fillVolatilityPts: 9, trend: 'worsening', posObserved: 12, worstRecentPct: 73 },
  CO1900: { avgFillRatePct: 78, fillVolatilityPts: 15, trend: 'worsening', posObserved: 10, worstRecentPct: 55 },
  ZH1555: { avgFillRatePct: 90, fillVolatilityPts: 8, trend: 'stable', posObserved: 9, worstRecentPct: 79 },
  NI9888: { avgFillRatePct: 91, fillVolatilityPts: 7, trend: 'stable', posObserved: 9, worstRecentPct: 80 },
  GU9811: { avgFillRatePct: 82, fillVolatilityPts: 11, trend: 'worsening', posObserved: 9, worstRecentPct: 64 },
  GU2222: { avgFillRatePct: 88, fillVolatilityPts: 9, trend: 'stable', posObserved: 6, worstRecentPct: 72 },
  BA0500: { avgFillRatePct: 94, fillVolatilityPts: 4, trend: 'stable', posObserved: 6, worstRecentPct: 88 },
  JA5000: { avgFillRatePct: 80, fillVolatilityPts: 10, trend: 'worsening', posObserved: 6, worstRecentPct: 66 },
  JA1010: { avgFillRatePct: 83, fillVolatilityPts: 9, trend: 'worsening', posObserved: 6, worstRecentPct: 70 },
  GL1200: { avgFillRatePct: 81, fillVolatilityPts: 12, trend: 'worsening', posObserved: 6, worstRecentPct: 61 },
}
