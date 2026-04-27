import type { SizeBand, StockStatus, Category } from './mockData'

export type DCStatus   = 'ok' | 'low' | 'excess'
export type Seasonality = 'standard' | 'high' | 'low'

export interface ReplenWeek {
  week:       string
  storeStock: number
  dcStock:    number
  sales:      number
  replen:     number
  isForecast: boolean
}

export interface ReplenProduct {
  id:              string
  name:            string
  sku:             string
  category:        Category
  imageUrl:        string
  supplier:        string
  costPrice:       number
  sellingPrice:    number
  marginPct:       number
  dcStock:         number
  dcCapacity:      number
  dcStatus:        DCStatus
  store:           string
  currentStock:    number
  targetMin:       number
  targetMax:       number
  weeklySales:     number
  weeksOfCover:    number
  stockStatus:     StockStatus
  suggestedReplen: number
  lastReplenDate:  string
  isOnPromo:       boolean
  promoEndDate?:   string
  discontinueDate?: string
  sellingWindowEnd?: string
  leadTime?:         number
  cyclePeriod?:      number
  targetAvailability?: number
  stdDevWeeklySales?: number
  demandForecast?:   number[]
  demandStdDev?:     number[]
  seasonality:     Seasonality
  weeklyHistory:   ReplenWeek[]
  sizeBreakdown:   SizeBand[]
}

// weeks 6-17 = historical (i 0-11), weeks 18-21 = forecast (i 12-15)
function wksV(ss: number[], dc: number[], rp: number[], s: number[]): ReplenWeek[] {
  return ss.map((storeStock, i) => ({
    week: `Wk ${6 + i}`,
    storeStock,
    dcStock: dc[i] ?? dc[dc.length - 1],
    sales: s[i] ?? s[s.length - 1],
    replen: rp[i] ?? 0,
    isForecast: i >= 12,
  }))
}

function wks(ss: number[], dc: number[], rp: number[], s: number): ReplenWeek[] {
  return ss.map((storeStock, i) => ({
    week: `Wk ${6 + i}`,
    storeStock,
    dcStock: dc[i],
    sales: s,
    replen: rp[i],
    isForecast: i >= 12,
  }))
}

export const REPLEN_PRODUCTS: ReplenProduct[] = [
  {
    id: 'RP-001',
    name: 'Radiant Dew Face Mist',
    sku: 'BT-FM-001',
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop',
    supplier: 'GlowLab Cosmetics',
    costPrice: 4.20, sellingPrice: 14.99, marginPct: 72,
    dcStock: 450, dcCapacity: 600, dcStatus: 'excess',
    store: 'Leeds', currentStock: 120, targetMin: 45, targetMax: 80,
    weeklySales: 18, weeksOfCover: 6.7, stockStatus: 'overstocked',
    suggestedReplen: 0, lastReplenDate: '2026-03-10',
    isOnPromo: false, seasonality: 'standard',
    weeklyHistory: wks(
      [50, 62, 47, 68, 82, 96, 85, 101, 112, 119, 120, 120, 115, 100,  86,  72],
      [380,380,400,400,460,460,460,460, 450, 450, 450, 450, 445, 440, 435, 430],
      [0,  25,  0, 38, 32,  0, 34, 30,  26,   0,   0,   0,   0,   0,   0,   0],
      18
    ),
    sizeBreakdown: [{ label: 'OS', pct: 100, color: 'bg-amber-100 text-amber-700' }],
  },
  {
    id: 'RP-002',
    name: 'Radiant Dew Face Mist',
    sku: 'BT-FM-001',
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop',
    supplier: 'GlowLab Cosmetics',
    costPrice: 4.20, sellingPrice: 14.99, marginPct: 72,
    dcStock: 450, dcCapacity: 600, dcStatus: 'excess',
    store: 'Milton Keynes', currentStock: 55, targetMin: 35, targetMax: 70,
    weeklySales: 15, weeksOfCover: 3.7, stockStatus: 'on-target',
    suggestedReplen: 0, lastReplenDate: '2026-03-24',
    isOnPromo: false, seasonality: 'standard',
    weeklyHistory: wks(
      [42, 55, 43, 58, 52, 65, 49, 63, 58, 62, 58, 55, 53, 50, 47, 45],
      [380,380,400,400,460,460,460,460,450,450,450,450,445,440,435,430],
      [0,  25,  0, 28,  0, 28,  0, 28,  0, 18,  0,  0,  0,  0,  0,  0],
      15
    ),
    sizeBreakdown: [{ label: 'OS', pct: 100, color: 'bg-green-100 text-green-700' }],
  },
  {
    id: 'RP-003',
    name: 'Twilight Glow Illuminator',
    sku: 'BT-IL-003',
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=80&h=80&fit=crop',
    supplier: 'GlowLab Cosmetics',
    costPrice: 6.50, sellingPrice: 22.00, marginPct: 70,
    dcStock: 370, dcCapacity: 500, dcStatus: 'ok',
    store: 'Leeds', currentStock: 95, targetMin: 40, targetMax: 75,
    weeklySales: 22, weeksOfCover: 4.3, stockStatus: 'overstocked',
    suggestedReplen: 0, lastReplenDate: '2026-03-17',
    isOnPromo: true, promoEndDate: '2026-05-10', sellingWindowEnd: '2026-05-22', seasonality: 'standard',
    weeklyHistory: wks(
      [42, 68, 85, 72, 88, 95, 80, 92, 95, 95, 95, 95, 88, 72, 58, 45],
      [340,340,360,360,380,380,380,380,370,370,370,370,365,355,345,335],
      [0,  40, 32,  0, 35,  0,  0, 22,  0,  0,  0,  0,  0,  0,  0,  0],
      22
    ),
    sizeBreakdown: [{ label: 'OS', pct: 100, color: 'bg-amber-100 text-amber-700' }],
  },
  {
    id: 'RP-004',
    name: 'Twilight Glow Illuminator',
    sku: 'BT-IL-003',
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=80&h=80&fit=crop',
    supplier: 'GlowLab Cosmetics',
    costPrice: 6.50, sellingPrice: 22.00, marginPct: 70,
    dcStock: 370, dcCapacity: 500, dcStatus: 'ok',
    store: 'Milton Keynes', currentStock: 58, targetMin: 35, targetMax: 70,
    weeklySales: 18, weeksOfCover: 3.2, stockStatus: 'on-target',
    suggestedReplen: 20, lastReplenDate: '2026-03-31',
    isOnPromo: true, promoEndDate: '2026-05-10', seasonality: 'standard',
    weeklyHistory: wks(
      [38, 52, 42, 58, 48, 65, 52, 68, 58, 65, 60, 58, 52, 46, 40, 36],
      [340,340,360,360,380,380,380,380,370,370,370,370,365,355,345,335],
      [0,  22,  0, 28,  0, 30,  0, 28,  0, 22,  0,  0, 20,  0,  0,  0],
      18
    ),
    sizeBreakdown: [{ label: 'OS', pct: 100, color: 'bg-green-100 text-green-700' }],
  },
  {
    id: 'RP-005',
    name: 'Essential Leather Boots',
    sku: 'FW-LB-005',
    category: 'Footwear',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    supplier: 'Pinnacle Footwear',
    costPrice: 28.00, sellingPrice: 89.99, marginPct: 69,
    dcStock: 252, dcCapacity: 400, dcStatus: 'ok',
    store: 'Leeds', currentStock: 42, targetMin: 30, targetMax: 65,
    weeklySales: 15, weeksOfCover: 2.8, stockStatus: 'on-target',
    suggestedReplen: 25, lastReplenDate: '2026-03-03',
    isOnPromo: false, seasonality: 'high',
    weeklyHistory: wks(
      [72, 58, 68, 52, 65, 72, 60, 48, 58, 50, 45, 42, 40, 38, 36, 35],
      [280,280,290,290,295,295,285,285,275,270,260,250,245,240,235,230],
      [0,  35,  0, 30,  0, 30,  0, 35,  0,  0,  0,  0, 25,  0,  0,  0],
      15
    ),
    sizeBreakdown: [
      { label: 'UK 3', pct: 8,  color: 'bg-green-100 text-green-700' },
      { label: 'UK 4', pct: 14, color: 'bg-green-100 text-green-700' },
      { label: 'UK 5', pct: 25, color: 'bg-green-100 text-green-700' },
      { label: 'UK 6', pct: 28, color: 'bg-green-100 text-green-700' },
      { label: 'UK 7', pct: 18, color: 'bg-green-100 text-green-700' },
      { label: 'UK 8', pct: 7,  color: 'bg-green-100 text-green-700' },
    ],
  },
  {
    id: 'RP-006',
    name: 'Essential Leather Boots',
    sku: 'FW-LB-005',
    category: 'Footwear',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    supplier: 'Pinnacle Footwear',
    costPrice: 28.00, sellingPrice: 89.99, marginPct: 69,
    dcStock: 252, dcCapacity: 400, dcStatus: 'ok',
    store: 'Milton Keynes', currentStock: 35, targetMin: 25, targetMax: 55,
    weeklySales: 12, weeksOfCover: 2.9, stockStatus: 'on-target',
    suggestedReplen: 20, lastReplenDate: '2026-03-10',
    isOnPromo: false, sellingWindowEnd: '2026-05-22', seasonality: 'high',
    weeklyHistory: wks(
      [58, 45, 55, 42, 52, 60, 48, 38, 46, 40, 36, 35, 33, 31, 30, 28],
      [280,280,290,290,295,295,285,285,275,270,260,250,245,240,235,230],
      [0,  28,  0, 26,  0, 28,  0, 30,  0,  0,  0,  0, 20,  0,  0,  0],
      12
    ),
    sizeBreakdown: [
      { label: 'UK 3', pct: 8,  color: 'bg-green-100 text-green-700' },
      { label: 'UK 4', pct: 14, color: 'bg-green-100 text-green-700' },
      { label: 'UK 5', pct: 25, color: 'bg-green-100 text-green-700' },
      { label: 'UK 6', pct: 28, color: 'bg-green-100 text-green-700' },
      { label: 'UK 7', pct: 18, color: 'bg-green-100 text-green-700' },
      { label: 'UK 8', pct: 7,  color: 'bg-green-100 text-green-700' },
    ],
  },
  {
    id: 'RP-007',
    name: 'Elegance Leather Slingbacks',
    sku: 'FW-SB-007',
    category: 'Footwear',
    imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop',
    supplier: 'Pinnacle Footwear',
    costPrice: 22.00, sellingPrice: 72.00, marginPct: 69,
    dcStock: 142, dcCapacity: 350, dcStatus: 'low',
    store: 'Milton Keynes', currentStock: 12, targetMin: 25, targetMax: 55,
    weeklySales: 8, weeksOfCover: 1.5, stockStatus: 'low-stock',
    suggestedReplen: 30, lastReplenDate: '2026-02-17',
    isOnPromo: false, seasonality: 'standard',
    weeklyHistory: wks(
      [45, 38, 32, 44, 36, 30, 42, 35, 28, 22, 18, 12,  8, 30, 25, 18],
      [280,260,245,265,245,228,248,224,202,182,162,142,130,110, 95, 82],
      [0,   0,  0, 20,  0, 18,  0, 25,  0,  0,  0,  0, 30,  0,  0,  0],
      8
    ),
    sizeBreakdown: [
      { label: 'UK 3', pct: 10, color: 'bg-red-100 text-red-700' },
      { label: 'UK 4', pct: 18, color: 'bg-red-100 text-red-700' },
      { label: 'UK 5', pct: 26, color: 'bg-red-100 text-red-700' },
      { label: 'UK 6', pct: 28, color: 'bg-red-100 text-red-700' },
      { label: 'UK 7', pct: 14, color: 'bg-red-100 text-red-700' },
      { label: 'UK 8', pct:  4, color: 'bg-red-100 text-red-700' },
    ],
  },
  {
    id: 'RP-008',
    name: 'Elegance Leather Slingbacks',
    sku: 'FW-SB-007',
    category: 'Footwear',
    imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop',
    supplier: 'Pinnacle Footwear',
    costPrice: 22.00, sellingPrice: 72.00, marginPct: 69,
    dcStock: 142, dcCapacity: 350, dcStatus: 'low',
    store: 'Leeds', currentStock: 34, targetMin: 22, targetMax: 50,
    weeklySales: 8, weeksOfCover: 4.3, stockStatus: 'on-target',
    suggestedReplen: 0, lastReplenDate: '2026-03-03',
    isOnPromo: false, seasonality: 'standard',
    weeklyHistory: wks(
      [35, 42, 36, 48, 42, 38, 45, 38, 34, 40, 36, 34, 32, 30, 28, 27],
      [240,240,245,245,250,250,248,248,245,245,242,240,238,235,232,230],
      [0,  15,  0, 20,  0,  0, 15,  0,  0, 10,  0,  0,  0,  0,  0,  0],
      8
    ),
    sizeBreakdown: [
      { label: 'UK 3', pct: 10, color: 'bg-green-100 text-green-700' },
      { label: 'UK 4', pct: 18, color: 'bg-green-100 text-green-700' },
      { label: 'UK 5', pct: 26, color: 'bg-green-100 text-green-700' },
      { label: 'UK 6', pct: 28, color: 'bg-green-100 text-green-700' },
      { label: 'UK 7', pct: 14, color: 'bg-green-100 text-green-700' },
      { label: 'UK 8', pct:  4, color: 'bg-green-100 text-green-700' },
    ],
  },
  {
    id: 'RP-009',
    name: 'Heritage Woven Belt',
    sku: 'AC-WB-009',
    category: 'Accessories',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&h=80&fit=crop',
    supplier: 'Craftline Accessories',
    costPrice: 5.80, sellingPrice: 22.50, marginPct: 74,
    dcStock: 155, dcCapacity: 300, dcStatus: 'ok',
    store: 'Leeds', currentStock: 28, targetMin: 18, targetMax: 40,
    weeklySales: 5, weeksOfCover: 5.6, stockStatus: 'on-target',
    suggestedReplen: 0, lastReplenDate: '2026-03-17',
    isOnPromo: false, seasonality: 'standard',
    weeklyHistory: wks(
      [28, 35, 30, 38, 32, 28, 35, 30, 28, 32, 28, 28, 26, 25, 24, 23],
      [160,160,162,162,165,165,162,162,160,160,158,155,152,150,148,145],
      [0,  12,  0, 14,  0,  0, 12,  0,  0,  8,  0,  0,  0,  0,  0,  0],
      5
    ),
    sizeBreakdown: [
      { label: 'XS/S', pct: 22, color: 'bg-green-100 text-green-700' },
      { label: 'M',    pct: 35, color: 'bg-green-100 text-green-700' },
      { label: 'L',    pct: 30, color: 'bg-green-100 text-green-700' },
      { label: 'XL',   pct: 13, color: 'bg-green-100 text-green-700' },
    ],
  },
  {
    id: 'RP-010',
    name: 'Refined Linen Blazer',
    sku: 'CL-LB-010',
    category: 'Clothing',
    imageUrl: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop',
    supplier: 'Meridian Apparel',
    costPrice: 32.00, sellingPrice: 99.00, marginPct: 68,
    dcStock: 350, dcCapacity: 500, dcStatus: 'ok',
    store: 'Milton Keynes', currentStock: 88, targetMin: 30, targetMax: 60,
    weeklySales: 12, weeksOfCover: 7.3, stockStatus: 'overstocked',
    suggestedReplen: 0, lastReplenDate: '2026-02-24',
    isOnPromo: false, discontinueDate: '2026-05-15', seasonality: 'standard',
    weeklyHistory: wks(
      [45, 58, 72, 65, 80, 88, 80, 90, 88, 88, 88, 88, 82, 72, 62, 52],
      [320,320,340,340,360,360,360,360,350,350,350,350,348,340,330,300],
      [0,  25,  0, 30,  0, 25,  0, 22,  0,  0,  0,  0,  0,  0,  0,  0],
      12
    ),
    sizeBreakdown: [
      { label: 'XS', pct: 10, color: 'bg-amber-100 text-amber-700' },
      { label: 'S',  pct: 22, color: 'bg-amber-100 text-amber-700' },
      { label: 'M',  pct: 35, color: 'bg-amber-100 text-amber-700' },
      { label: 'L',  pct: 25, color: 'bg-amber-100 text-amber-700' },
      { label: 'XL', pct:  8, color: 'bg-amber-100 text-amber-700' },
    ],
  },
  {
    id: 'RP-011',
    name: 'Refined Linen Blazer',
    sku: 'CL-LB-010',
    category: 'Clothing',
    imageUrl: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop',
    supplier: 'Meridian Apparel',
    costPrice: 32.00, sellingPrice: 99.00, marginPct: 68,
    dcStock: 350, dcCapacity: 500, dcStatus: 'ok',
    store: 'Leeds', currentStock: 72, targetMin: 25, targetMax: 55,
    weeklySales: 10, weeksOfCover: 7.2, stockStatus: 'overstocked',
    suggestedReplen: 0, lastReplenDate: '2026-02-17',
    isOnPromo: false, discontinueDate: '2026-05-15', seasonality: 'standard',
    weeklyHistory: wks(
      [38, 48, 60, 55, 68, 75, 68, 75, 72, 72, 72, 72, 65, 56, 48, 40],
      [320,320,340,340,360,360,360,360,350,350,350,350,348,340,330,300],
      [0,  22,  0, 25,  0, 22,  0, 18,  0,  0,  0,  0,  0,  0,  0,  0],
      10
    ),
    sizeBreakdown: [
      { label: 'XS', pct: 10, color: 'bg-amber-100 text-amber-700' },
      { label: 'S',  pct: 22, color: 'bg-amber-100 text-amber-700' },
      { label: 'M',  pct: 35, color: 'bg-amber-100 text-amber-700' },
      { label: 'L',  pct: 25, color: 'bg-amber-100 text-amber-700' },
      { label: 'XL', pct:  8, color: 'bg-amber-100 text-amber-700' },
    ],
  },
  {
    id: 'RP-012',
    name: 'Fresh Citrus Shower Gel',
    sku: 'BT-SG-012',
    category: 'Beauty',
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop',
    supplier: 'GlowLab Cosmetics',
    costPrice: 2.10, sellingPrice: 8.50, marginPct: 75,
    dcStock: 610, dcCapacity: 700, dcStatus: 'excess',
    store: 'Milton Keynes', currentStock: 145, targetMin: 60, targetMax: 110,
    weeklySales: 35, weeksOfCover: 4.1, stockStatus: 'overstocked',
    suggestedReplen: 0, lastReplenDate: '2026-03-03',
    isOnPromo: false, seasonality: 'standard',
    weeklyHistory: wks(
      [ 80, 110,  95, 130, 148, 145, 135, 148, 152, 148, 145, 145, 138, 120, 105,  90],
      [580, 580, 600, 600, 620, 620, 620, 620, 610, 610, 610, 610, 605, 595, 585, 575],
      [  0,  45,   0,  65,  45,   0,  48,  42,   0,   0,   0,   0,   0,   0,   0,   0],
      35
    ),
    sizeBreakdown: [{ label: 'OS', pct: 100, color: 'bg-amber-100 text-amber-700' }],
  },
  {
    id: 'RP-013',
    name: 'Canvas Running Shoes',
    sku: 'FW-RS-013',
    category: 'Footwear',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    supplier: 'Pinnacle Footwear',
    costPrice: 18.00, sellingPrice: 55.00, marginPct: 67,
    dcStock: 110, dcCapacity: 300, dcStatus: 'ok',
    store: 'Birmingham Bullring', currentStock: 8, targetMin: 20, targetMax: 50,
    weeklySales: 8, weeksOfCover: 1.0, stockStatus: 'low-stock',
    suggestedReplen: 35, lastReplenDate: '2026-02-03',
    isOnPromo: false, seasonality: 'standard',
    weeklyHistory: wks(
      [45, 38, 32, 42, 35, 28, 38, 30, 22, 16, 12,  8,  5, 32, 42, 50],
      [180,175,168,175,165,155,162,152,142,132,120,110,100, 88, 76, 65],
      [  0,  0,  0, 18,  0,  0, 18,  0,  0,  0,  0,  0, 35,  0,  0,  0],
      8
    ),
    sizeBreakdown: [
      { label: 'UK 4', pct:  8, color: 'bg-red-100 text-red-700' },
      { label: 'UK 5', pct: 16, color: 'bg-red-100 text-red-700' },
      { label: 'UK 6', pct: 24, color: 'bg-red-100 text-red-700' },
      { label: 'UK 7', pct: 28, color: 'bg-red-100 text-red-700' },
      { label: 'UK 8', pct: 16, color: 'bg-red-100 text-red-700' },
      { label: 'UK 9', pct:  8, color: 'bg-red-100 text-red-700' },
    ],
  },
  {
    id: 'RP-014',
    name: 'Merino Wool Roll-Neck',
    sku: 'CL-MR-014',
    category: 'Clothing',
    imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop',
    supplier: 'Meridian Apparel',
    costPrice: 24.00, sellingPrice: 75.00, marginPct: 68,
    dcStock: 148, dcCapacity: 300, dcStatus: 'ok',
    store: 'Leeds', currentStock: 15, targetMin: 20, targetMax: 50,
    weeklySales: 10, weeksOfCover: 1.5, stockStatus: 'low-stock',
    suggestedReplen: 15, lastReplenDate: '2026-01-20',
    isOnPromo: false, seasonality: 'high',
    weeklyHistory: wks(
      [85, 72, 60, 75, 62, 50, 62, 50, 38, 28, 20, 15, 12, 10,  8,  7],
      [180,180,185,185,190,190,185,180,175,165,158,148,140,130,120,110],
      [  0, 25,  0, 25,  0,  0, 25,  0,  0,  0,  0,  0, 15,  0,  0,  0],
      10
    ),
    sizeBreakdown: [
      { label: 'XS', pct:  8, color: 'bg-red-100 text-red-700' },
      { label: 'S',  pct: 20, color: 'bg-red-100 text-red-700' },
      { label: 'M',  pct: 38, color: 'bg-red-100 text-red-700' },
      { label: 'L',  pct: 26, color: 'bg-red-100 text-red-700' },
      { label: 'XL', pct:  8, color: 'bg-red-100 text-red-700' },
    ],
  },

  // ── Demo SKUs for chart engine demo ──────────────────────────────────────────
  {
    id: 'RP-DEMO-S1',
    name: 'Canvas Tote Bag',
    sku: 'AC-TB-S1',
    category: 'Accessories',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&h=80&fit=crop',
    supplier: 'Craftline Accessories',
    costPrice: 4.50, sellingPrice: 18.00, marginPct: 75,
    dcStock: 300, dcCapacity: 400, dcStatus: 'ok',
    store: 'Leeds',
    currentStock: 32, targetMin: 25, targetMax: 45,
    weeklySales: 12, weeksOfCover: 2.7, stockStatus: 'on-target',
    suggestedReplen: 12, lastReplenDate: '2026-04-14',
    isOnPromo: false, seasonality: 'standard',
    leadTime: 1, cyclePeriod: 1, targetAvailability: 0.90, stdDevWeeklySales: 2,
    weeklyHistory: wks(
      [44, 32, 44, 32, 44, 32, 44, 32, 44, 32, 44, 32, 44, 32, 44, 32],
      [300,300,300,300,300,300,300,300,300,300,300,300,300,300,300,300],
      [0,  24,  0, 24,  0, 24,  0, 24,  0, 24,  0, 24,  0, 24,  0, 24],
      12
    ),
    sizeBreakdown: [{ label: 'OS', pct: 100, color: 'bg-green-100 text-green-700' }],
  },
  {
    id: 'RP-DEMO-S2',
    name: 'Coastal Summer Sandal',
    sku: 'FW-CS-S2',
    category: 'Footwear',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    supplier: 'Pinnacle Footwear',
    costPrice: 12.00, sellingPrice: 45.00, marginPct: 73,
    dcStock: 380, dcCapacity: 500, dcStatus: 'ok',
    store: 'Milton Keynes',
    currentStock: 90, targetMin: 55, targetMax: 135,
    weeklySales: 12, weeksOfCover: 6.4, stockStatus: 'on-target',
    suggestedReplen: 48, lastReplenDate: '2026-03-31',
    isOnPromo: false, seasonality: 'high',
    leadTime: 3, cyclePeriod: 1, targetAvailability: 0.95,
    demandForecast: [
      4, 4, 5, 5, 6, 7, 7, 8, 9,10,11,12,   // Wk 6-17  (Feb-Apr) actual indices 0-11
      14,16,18,20,22,24,25,26,26,            // Wk 18-26 (May-Jun) indices 12-20
      26,26,25,23,20,17,14,11, 8,            // Wk 27-35 (Jul-Sep) peak ~Wk 27-28 indices 21-29
       6, 5, 4, 4, 4, 4, 4,                 // Wk 36-42 (Oct-Nov) indices 30-36
    ],
    demandStdDev: [
      1,1,1,1,1,1,2,2,2,2,2,3,              // indices 0-11
      3,3,4,4,4,5,5,5,5,                    // indices 12-20
      5,5,4,4,4,3,3,2,2,                    // indices 21-29
      2,1,1,1,1,1,1,                        // indices 30-36
    ],
    weeklyHistory: wksV(
      [50, 60, 72, 65, 78, 85, 75, 88, 90, 90, 90, 90, 88, 82, 76, 70],
      [380,380,385,385,390,390,390,390,385,382,380,380,378,374,370,365],
      [0,  30,  0, 36,  0, 35,  0, 38,  0,  0,  0,  0, 48,  0,  0,  0],
      [4,  4,  5,  5,  6,  7,  7,  8,  9, 10, 11, 12, 14, 16, 18, 20]
    ),
    sizeBreakdown: [
      { label: 'UK 3', pct:  8, color: 'bg-green-100 text-green-700' },
      { label: 'UK 4', pct: 18, color: 'bg-green-100 text-green-700' },
      { label: 'UK 5', pct: 28, color: 'bg-green-100 text-green-700' },
      { label: 'UK 6', pct: 28, color: 'bg-green-100 text-green-700' },
      { label: 'UK 7', pct: 18, color: 'bg-green-100 text-green-700' },
    ],
  },
  {
    id: 'RP-DEMO-S3',
    name: 'Espadrille Wedge Heel',
    sku: 'FW-EW-S3',
    category: 'Footwear',
    imageUrl: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop',
    supplier: 'Pinnacle Footwear',
    costPrice: 14.00, sellingPrice: 52.00, marginPct: 73,
    dcStock: 180, dcCapacity: 350, dcStatus: 'ok',
    store: 'Leeds',
    currentStock: 120, targetMin: 55, targetMax: 130,
    weeklySales: 12, weeksOfCover: 8.6, stockStatus: 'overstocked',
    suggestedReplen: 0, lastReplenDate: '2026-03-10',
    isOnPromo: false, sellingWindowEnd: '2026-06-06', seasonality: 'high',
    leadTime: 3, cyclePeriod: 1, targetAvailability: 0.95,
    demandForecast: [
      4, 4, 5, 5, 6, 7, 7, 8, 9,10,11,12,   // Wk 6-17  (Feb-Apr) actual indices 0-11
      14,16,18,20,22,24,25,26,26,            // Wk 18-26 (May-Jun) indices 12-20
      26,26,25,23,20,17,14,11, 8,            // Wk 27-35 (Jul-Sep) peak ~Wk 27-28 indices 21-29
       6, 5, 4, 4, 4, 4, 4,                 // Wk 36-42 (Oct-Nov) indices 30-36
    ],
    demandStdDev: [
      1,1,1,1,1,1,2,2,2,2,2,3,              // indices 0-11
      3,3,4,4,4,5,5,5,5,                    // indices 12-20
      5,5,4,4,4,3,3,2,2,                    // indices 21-29
      2,1,1,1,1,1,1,                        // indices 30-36
    ],
    weeklyHistory: wksV(
      [60, 72, 88, 80, 95, 108, 100, 112, 118, 120, 120, 120, 118, 112, 106, 100],
      [280,280,285,285,290,290, 290, 285, 282, 180, 180, 180, 178, 172, 165, 158],
      [0,  30,  0, 38,  0,  38,   0,  38,   0,   0,   0,   0,   0,   0,   0,   0],
      [4,  4,  5,  5,  6,   7,   7,   8,   9,  10,  11,  12,  14,  16,  18,  20]
    ),
    sizeBreakdown: [
      { label: 'UK 3', pct:  8, color: 'bg-amber-100 text-amber-700' },
      { label: 'UK 4', pct: 18, color: 'bg-amber-100 text-amber-700' },
      { label: 'UK 5', pct: 28, color: 'bg-amber-100 text-amber-700' },
      { label: 'UK 6', pct: 28, color: 'bg-amber-100 text-amber-700' },
      { label: 'UK 7', pct: 18, color: 'bg-amber-100 text-amber-700' },
    ],
  },
]
