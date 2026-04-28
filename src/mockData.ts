// AUTO-GENERATED — do not edit by hand.
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
  freightChoice?:        'Sea' | 'Air'
  freightOverrideReason?: string
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

export const INVENTORY_PRODUCTS: InventoryProduct[] = [
  {
    "id": "INV-001",
    "name": "Hydrating Face Serum",
    "sku": "SKU-INV001",
    "category": "Beauty",
    "costPrice": 10.5,
    "sellingPrice": 37.5,
    "marginPct": 0.72,
    "currentStock": 1976,
    "weeklySales": 380,
    "forwardWeeksCover": 5.2,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop",
    "supplier": "L'Oréal UK",
    "stockValue": 20748,
    "weeksOfStock": 5.2,
    "monthlyRevenue": 57000,
    "stockoutRisk": "Low",
    "available": 1976,
    "onOrder": 253,
    "safetyStock": 570,
    "minLevel": 3610,
    "maxLevel": 5130,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1
  },
  {
    "id": "INV-002",
    "name": "Rose Hip Facial Oil",
    "sku": "SKU-INV002",
    "category": "Beauty",
    "costPrice": 11.2,
    "sellingPrice": 37.33,
    "marginPct": 0.7,
    "currentStock": 812,
    "weeklySales": 290,
    "forwardWeeksCover": 2.8,
    "stockStatus": "low-stock",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=80&h=80&fit=crop",
    "supplier": "Unilever Ltd",
    "stockValue": 9094.4,
    "weeksOfStock": 2.8,
    "monthlyRevenue": 43302.8,
    "stockoutRisk": "High",
    "available": 812,
    "onOrder": 390,
    "safetyStock": 435,
    "minLevel": 2755,
    "maxLevel": 3915,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1
  },
  {
    "id": "INV-003",
    "name": "Vitamin C Moisturiser",
    "sku": "SKU-INV003",
    "category": "Beauty",
    "costPrice": 9.8,
    "sellingPrice": 36.3,
    "marginPct": 0.73,
    "currentStock": 1995,
    "weeklySales": 210,
    "forwardWeeksCover": 9.5,
    "stockStatus": "overstocked",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-blue-100 text-blue-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop",
    "supplier": "L'Oréal UK",
    "stockValue": 19551,
    "weeksOfStock": 9.5,
    "monthlyRevenue": 30492,
    "stockoutRisk": "Low",
    "available": 1995,
    "onOrder": 527,
    "safetyStock": 315,
    "minLevel": 1995,
    "maxLevel": 2835,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1
  },
  {
    "id": "INV-004",
    "name": "Micellar Cleansing Water",
    "sku": "SKU-INV004",
    "category": "Beauty",
    "costPrice": 10,
    "sellingPrice": 34.48,
    "marginPct": 0.71,
    "currentStock": 2016,
    "weeklySales": 420,
    "forwardWeeksCover": 4.8,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=80&h=80&fit=crop",
    "supplier": "Unilever Ltd",
    "stockValue": 20160,
    "weeksOfStock": 4.8,
    "monthlyRevenue": 57926.4,
    "stockoutRisk": "Low",
    "available": 2016,
    "onOrder": 664,
    "safetyStock": 630,
    "minLevel": 3990,
    "maxLevel": 5670,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1
  },
  {
    "id": "INV-005",
    "name": "SPF 50 Day Cream",
    "sku": "SKU-INV005",
    "category": "Beauty",
    "costPrice": 11.5,
    "sellingPrice": 37.1,
    "marginPct": 0.69,
    "currentStock": 714,
    "weeklySales": 340,
    "forwardWeeksCover": 2.1,
    "stockStatus": "low-stock",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop",
    "supplier": "L'Oréal UK",
    "stockValue": 8211,
    "weeksOfStock": 2.1,
    "monthlyRevenue": 50456,
    "stockoutRisk": "High",
    "available": 714,
    "onOrder": 200,
    "safetyStock": 510,
    "minLevel": 3230,
    "maxLevel": 4590,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1
  },
  {
    "id": "INV-006",
    "name": "Linen Blazer",
    "sku": "SKU-INV006",
    "category": "Clothing",
    "costPrice": 24,
    "sellingPrice": 85.71,
    "marginPct": 0.72,
    "currentStock": 798,
    "weeklySales": 145,
    "forwardWeeksCover": 5.5,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop",
    "supplier": "Next Sourcing",
    "stockValue": 19152,
    "weeksOfStock": 5.5,
    "monthlyRevenue": 49711.8,
    "stockoutRisk": "Low",
    "available": 798,
    "onOrder": 337,
    "safetyStock": 218,
    "minLevel": 1378,
    "maxLevel": 1958,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1
  },
  {
    "id": "INV-007",
    "name": "Floral Midi Dress",
    "sku": "SKU-INV007",
    "category": "Clothing",
    "costPrice": 18.5,
    "sellingPrice": 61.67,
    "marginPct": 0.7,
    "currentStock": 870,
    "weeklySales": 290,
    "forwardWeeksCover": 3,
    "stockStatus": "low-stock",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop",
    "supplier": "ASOS Brands",
    "stockValue": 16095,
    "weeksOfStock": 3,
    "monthlyRevenue": 71537.2,
    "stockoutRisk": "Medium",
    "available": 870,
    "onOrder": 474,
    "safetyStock": 435,
    "minLevel": 2755,
    "maxLevel": 3915,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1
  },
  {
    "id": "INV-008",
    "name": "Slim Fit Chinos",
    "sku": "SKU-INV008",
    "category": "Clothing",
    "costPrice": 15,
    "sellingPrice": 51.72,
    "marginPct": 0.71,
    "currentStock": 1836,
    "weeklySales": 180,
    "forwardWeeksCover": 10.2,
    "stockStatus": "overstocked",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-blue-100 text-blue-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop",
    "supplier": "Next Sourcing",
    "stockValue": 27540,
    "weeksOfStock": 10.2,
    "monthlyRevenue": 37238.4,
    "stockoutRisk": "Low",
    "available": 1836,
    "onOrder": 611,
    "safetyStock": 270,
    "minLevel": 1710,
    "maxLevel": 2430,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1
  },
  {
    "id": "INV-009",
    "name": "Cotton Oxford Shirt",
    "sku": "SKU-INV009",
    "category": "Clothing",
    "costPrice": 14,
    "sellingPrice": 51.85,
    "marginPct": 0.73,
    "currentStock": 924,
    "weeklySales": 220,
    "forwardWeeksCover": 4.2,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop",
    "supplier": "ASOS Brands",
    "stockValue": 12936,
    "weeksOfStock": 4.2,
    "monthlyRevenue": 45628,
    "stockoutRisk": "Low",
    "available": 924,
    "onOrder": 748,
    "safetyStock": 330,
    "minLevel": 2090,
    "maxLevel": 2970,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1
  },
  {
    "id": "INV-010",
    "name": "Jersey Maxi Dress",
    "sku": "SKU-INV010",
    "category": "Clothing",
    "costPrice": 20,
    "sellingPrice": 71.43,
    "marginPct": 0.72,
    "currentStock": 438,
    "weeklySales": 175,
    "forwardWeeksCover": 2.5,
    "stockStatus": "low-stock",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop",
    "supplier": "Next Sourcing",
    "stockValue": 8760,
    "weeksOfStock": 2.5,
    "monthlyRevenue": 50001,
    "stockoutRisk": "High",
    "available": 438,
    "onOrder": 284,
    "safetyStock": 263,
    "minLevel": 1663,
    "maxLevel": 2363,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1
  },
  {
    "id": "INV-011",
    "name": "Ribbed Knit Jumper",
    "sku": "SKU-INV011",
    "category": "Clothing",
    "costPrice": 22,
    "sellingPrice": 68.75,
    "marginPct": 0.68,
    "currentStock": 928,
    "weeklySales": 160,
    "forwardWeeksCover": 5.8,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop",
    "supplier": "ASOS Brands",
    "stockValue": 20416,
    "weeksOfStock": 5.8,
    "monthlyRevenue": 44000,
    "stockoutRisk": "Low",
    "available": 928,
    "onOrder": 421,
    "safetyStock": 240,
    "minLevel": 1520,
    "maxLevel": 2160,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1
  },
  {
    "id": "INV-012",
    "name": "Wide Leg Trousers",
    "sku": "SKU-INV012",
    "category": "Clothing",
    "costPrice": 19,
    "sellingPrice": 73.08,
    "marginPct": 0.74,
    "currentStock": 1658,
    "weeklySales": 195,
    "forwardWeeksCover": 8.5,
    "stockStatus": "overstocked",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-blue-100 text-blue-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop",
    "supplier": "Next Sourcing",
    "stockValue": 31502,
    "weeksOfStock": 8.5,
    "monthlyRevenue": 57002.4,
    "stockoutRisk": "Low",
    "available": 1658,
    "onOrder": 558,
    "safetyStock": 293,
    "minLevel": 1853,
    "maxLevel": 2633,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1
  },
  {
    "id": "INV-013",
    "name": "Block Heel Ankle Boots",
    "sku": "SKU-INV013",
    "category": "Footwear",
    "costPrice": 28,
    "sellingPrice": 96.55,
    "marginPct": 0.71,
    "currentStock": 612,
    "weeklySales": 120,
    "forwardWeeksCover": 5.1,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop",
    "supplier": "Steve Madden EU",
    "stockValue": 17136,
    "weeksOfStock": 5.1,
    "monthlyRevenue": 46344,
    "stockoutRisk": "Low",
    "available": 612,
    "onOrder": 695,
    "safetyStock": 180,
    "minLevel": 1140,
    "maxLevel": 1620,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1
  },
  {
    "id": "INV-014",
    "name": "Pointed Toe Heels",
    "sku": "SKU-INV014",
    "category": "Footwear",
    "costPrice": 25,
    "sellingPrice": 92.59,
    "marginPct": 0.73,
    "currentStock": 345,
    "weeklySales": 150,
    "forwardWeeksCover": 2.3,
    "stockStatus": "low-stock",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop",
    "supplier": "Clarks Wholesale",
    "stockValue": 8625,
    "weeksOfStock": 2.3,
    "monthlyRevenue": 55554,
    "stockoutRisk": "High",
    "available": 345,
    "onOrder": 231,
    "safetyStock": 225,
    "minLevel": 1425,
    "maxLevel": 2025,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1
  },
  {
    "id": "INV-015",
    "name": "Chelsea Boots",
    "sku": "SKU-INV015",
    "category": "Footwear",
    "costPrice": 30,
    "sellingPrice": 100,
    "marginPct": 0.7,
    "currentStock": 1045,
    "weeklySales": 95,
    "forwardWeeksCover": 11,
    "stockStatus": "overstocked",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-blue-100 text-blue-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-blue-100 text-blue-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop",
    "supplier": "Steve Madden EU",
    "stockValue": 31350,
    "weeksOfStock": 11,
    "monthlyRevenue": 38000,
    "stockoutRisk": "Low",
    "available": 1045,
    "onOrder": 368,
    "safetyStock": 143,
    "minLevel": 903,
    "maxLevel": 1283,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1
  },
  {
    "id": "INV-016",
    "name": "Leather Loafers",
    "sku": "SKU-INV016",
    "category": "Footwear",
    "costPrice": 26,
    "sellingPrice": 92.86,
    "marginPct": 0.72,
    "currentStock": 517,
    "weeklySales": 110,
    "forwardWeeksCover": 4.7,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop",
    "supplier": "Clarks Wholesale",
    "stockValue": 13442,
    "weeksOfStock": 4.7,
    "monthlyRevenue": 40858.4,
    "stockoutRisk": "Low",
    "available": 517,
    "onOrder": 505,
    "safetyStock": 165,
    "minLevel": 1045,
    "maxLevel": 1485,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1
  },
  {
    "id": "INV-017",
    "name": "Strappy Sandals",
    "sku": "SKU-INV017",
    "category": "Footwear",
    "costPrice": 22.5,
    "sellingPrice": 72.58,
    "marginPct": 0.69,
    "currentStock": 882,
    "weeklySales": 205,
    "forwardWeeksCover": 4.3,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop",
    "supplier": "Steve Madden EU",
    "stockValue": 19845,
    "weeksOfStock": 4.3,
    "monthlyRevenue": 59515.6,
    "stockoutRisk": "Low",
    "available": 882,
    "onOrder": 642,
    "safetyStock": 308,
    "minLevel": 1948,
    "maxLevel": 2768,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1
  },
  {
    "id": "INV-018",
    "name": "Leather Crossbody Bag",
    "sku": "SKU-INV018",
    "category": "Accessories",
    "costPrice": 16,
    "sellingPrice": 55.17,
    "marginPct": 0.71,
    "currentStock": 459,
    "weeklySales": 85,
    "forwardWeeksCover": 5.4,
    "stockStatus": "on-target",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&h=80&fit=crop",
    "supplier": "Radley London",
    "stockValue": 7344,
    "weeksOfStock": 5.4,
    "monthlyRevenue": 18757.8,
    "stockoutRisk": "Low",
    "available": 459,
    "onOrder": 779,
    "safetyStock": 128,
    "minLevel": 808,
    "maxLevel": 1148,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 300,
    "packSize": 1
  },
  {
    "id": "INV-019",
    "name": "Silk Headband Set",
    "sku": "SKU-INV019",
    "category": "Accessories",
    "costPrice": 12,
    "sellingPrice": 44.44,
    "marginPct": 0.73,
    "currentStock": 351,
    "weeklySales": 130,
    "forwardWeeksCover": 2.7,
    "stockStatus": "low-stock",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop",
    "supplier": "Accessorize Ltd",
    "stockValue": 4212,
    "weeksOfStock": 2.7,
    "monthlyRevenue": 23108.8,
    "stockoutRisk": "High",
    "available": 351,
    "onOrder": 315,
    "safetyStock": 195,
    "minLevel": 1235,
    "maxLevel": 1755,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 300,
    "packSize": 1
  },
  {
    "id": "INV-020",
    "name": "Gold Charm Bracelet",
    "sku": "SKU-INV020",
    "category": "Accessories",
    "costPrice": 14.5,
    "sellingPrice": 51.79,
    "marginPct": 0.72,
    "currentStock": 630,
    "weeklySales": 70,
    "forwardWeeksCover": 9,
    "stockStatus": "overstocked",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-blue-100 text-blue-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&h=80&fit=crop",
    "supplier": "Radley London",
    "stockValue": 9135,
    "weeksOfStock": 9,
    "monthlyRevenue": 14501.2,
    "stockoutRisk": "Low",
    "available": 630,
    "onOrder": 452,
    "safetyStock": 105,
    "minLevel": 665,
    "maxLevel": 945,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 300,
    "packSize": 1
  }
]

export const REORDER_RECOMMENDATIONS: ReorderRecommendation[] = [
  {
    "id": "REC-001",
    "name": "Retinol Night Cream",
    "sku": "SKU-REC001",
    "category": "Beauty",
    "costPrice": 11.8,
    "sellingPrice": 42.14,
    "marginPct": 0.72,
    "currentStock": 1834,
    "weeklySales": 764,
    "forwardWeeksCover": 2.4,
    "recommendedReorderQty": 3060,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Approved",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop",
    "supplier": "L'Oréal UK",
    "stockValue": 21641.2,
    "weeksOfStock": 2.4,
    "monthlyRevenue": 128779.84,
    "stockoutRisk": "High",
    "available": 1834,
    "onOrder": 6112,
    "safetyStock": 1146,
    "minLevel": 7258,
    "maxLevel": 10314,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1,
    "exFactoryDate": "2026-05-12",
    "receiptDate": "2026-06-02",
    "totalCost": 36108
  },
  {
    "id": "REC-002",
    "name": "Hyaluronic Acid Toner",
    "sku": "SKU-REC002",
    "category": "Beauty",
    "costPrice": 9.5,
    "sellingPrice": 32.76,
    "marginPct": 0.71,
    "currentStock": 1985,
    "weeklySales": 709,
    "forwardWeeksCover": 2.8,
    "recommendedReorderQty": 2840,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Pending Approval",
    "recommendedFreight": "Sea",
    "freightChoice": "Air",
    "freightOverrideReason": "Stockout risk is high — need earlier receipt to cover the summer peak. Air adds ~£0.50/unit but prevents potential lost sales.",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=80&h=80&fit=crop",
    "supplier": "Unilever Ltd",
    "stockValue": 18857.5,
    "weeksOfStock": 2.8,
    "monthlyRevenue": 92907.36,
    "stockoutRisk": "High",
    "available": 1985,
    "onOrder": 5672,
    "safetyStock": 1064,
    "minLevel": 6736,
    "maxLevel": 9572,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1,
    "exFactoryDate": "2026-05-15",
    "receiptDate": "2026-06-05",
    "totalCost": 26980
  },
  {
    "id": "REC-003",
    "name": "Brightening Eye Cream",
    "sku": "SKU-REC003",
    "category": "Beauty",
    "costPrice": 10.8,
    "sellingPrice": 36,
    "marginPct": 0.7,
    "currentStock": 1565,
    "weeklySales": 745,
    "forwardWeeksCover": 2.1,
    "recommendedReorderQty": 2980,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Rejected",
    "recommendedFreight": "Air",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=80&h=80&fit=crop",
    "supplier": "L'Oréal UK",
    "stockValue": 16902,
    "weeksOfStock": 2.1,
    "monthlyRevenue": 107280,
    "stockoutRisk": "High",
    "available": 1565,
    "onOrder": 5960,
    "safetyStock": 1118,
    "minLevel": 7078,
    "maxLevel": 10058,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 500,
    "packSize": 1,
    "exFactoryDate": "2026-05-18",
    "receiptDate": "2026-06-08",
    "totalCost": 32184,
    "rejectionReason": "Supplier OOS until June — seek alternative"
  },
  {
    "id": "REC-004",
    "name": "Wrap Midi Dress",
    "sku": "SKU-REC004",
    "category": "Clothing",
    "costPrice": 21,
    "sellingPrice": 77.78,
    "marginPct": 0.73,
    "currentStock": 2080,
    "weeklySales": 800,
    "forwardWeeksCover": 2.6,
    "recommendedReorderQty": 3200,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Approved",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop",
    "supplier": "Next Sourcing",
    "stockValue": 43680,
    "weeksOfStock": 2.6,
    "monthlyRevenue": 248896,
    "stockoutRisk": "High",
    "available": 2080,
    "onOrder": 6400,
    "safetyStock": 1200,
    "minLevel": 7600,
    "maxLevel": 10800,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1,
    "exFactoryDate": "2026-05-21",
    "receiptDate": "2026-06-11",
    "totalCost": 67200,
    "sizeCurve": [
      {
        "size": "XS",
        "available": 142,
        "onOrder": 6400,
        "recommended": 352,
        "sales": 64,
        "targetMin": 230,
        "targetMax": 282
      },
      {
        "size": "S",
        "available": 309,
        "onOrder": 6400,
        "recommended": 792,
        "sales": 144,
        "targetMin": 518,
        "targetMax": 634
      },
      {
        "size": "M",
        "available": 524,
        "onOrder": 6400,
        "recommended": 1408,
        "sales": 256,
        "targetMin": 922,
        "targetMax": 1126
      },
      {
        "size": "L",
        "available": 419,
        "onOrder": 6400,
        "recommended": 1100,
        "sales": 200,
        "targetMin": 720,
        "targetMax": 880
      },
      {
        "size": "XL",
        "available": 210,
        "onOrder": 6400,
        "recommended": 528,
        "sales": 96,
        "targetMin": 346,
        "targetMax": 422
      },
      {
        "size": "XXL",
        "available": 90,
        "onOrder": 6400,
        "recommended": 220,
        "sales": 40,
        "targetMin": 144,
        "targetMax": 176
      }
    ]
  },
  {
    "id": "REC-005",
    "name": "Tailored Suit Jacket",
    "sku": "SKU-REC005",
    "category": "Clothing",
    "costPrice": 27.5,
    "sellingPrice": 94.83,
    "marginPct": 0.71,
    "currentStock": 2004,
    "weeklySales": 691,
    "forwardWeeksCover": 2.9,
    "recommendedReorderQty": 2760,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Draft",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop",
    "supplier": "ASOS Brands",
    "stockValue": 55110,
    "weeksOfStock": 2.9,
    "monthlyRevenue": 262110.12,
    "stockoutRisk": "High",
    "available": 2004,
    "onOrder": 5528,
    "safetyStock": 1037,
    "minLevel": 6565,
    "maxLevel": 9329,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1,
    "exFactoryDate": "2026-05-24",
    "receiptDate": "2026-06-14",
    "totalCost": 75900,
    "sizeCurve": [
      {
        "size": "XS",
        "available": 137,
        "onOrder": 5528,
        "recommended": 304,
        "sales": 55,
        "targetMin": 199,
        "targetMax": 243
      },
      {
        "size": "S",
        "available": 298,
        "onOrder": 5528,
        "recommended": 684,
        "sales": 124,
        "targetMin": 448,
        "targetMax": 548
      },
      {
        "size": "M",
        "available": 505,
        "onOrder": 5528,
        "recommended": 1216,
        "sales": 221,
        "targetMin": 796,
        "targetMax": 972
      },
      {
        "size": "L",
        "available": 404,
        "onOrder": 5528,
        "recommended": 950,
        "sales": 173,
        "targetMin": 622,
        "targetMax": 760
      },
      {
        "size": "XL",
        "available": 203,
        "onOrder": 5528,
        "recommended": 456,
        "sales": 83,
        "targetMin": 299,
        "targetMax": 365
      },
      {
        "size": "XXL",
        "available": 86,
        "onOrder": 5528,
        "recommended": 190,
        "sales": 35,
        "targetMin": 124,
        "targetMax": 152
      }
    ]
  },
  {
    "id": "REC-006",
    "name": "Striped Cotton Tee",
    "sku": "SKU-REC006",
    "category": "Clothing",
    "costPrice": 14.5,
    "sellingPrice": 51.79,
    "marginPct": 0.72,
    "currentStock": 1720,
    "weeklySales": 782,
    "forwardWeeksCover": 2.2,
    "recommendedReorderQty": 3130,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Pending Approval",
    "recommendedFreight": "Air",
    "freightChoice": "Sea",
    "freightOverrideReason": "Negotiated bulk Sea rate with supplier — saves £1.20/unit vs Air. Lead time is still within target given current stock cover.",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop",
    "supplier": "Next Sourcing",
    "stockValue": 24940,
    "weeksOfStock": 2.2,
    "monthlyRevenue": 161999.12,
    "stockoutRisk": "High",
    "available": 1720,
    "onOrder": 6256,
    "safetyStock": 1173,
    "minLevel": 7429,
    "maxLevel": 10557,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1,
    "exFactoryDate": "2026-05-27",
    "receiptDate": "2026-06-17",
    "totalCost": 45385,
    "sizeCurve": [
      {
        "size": "XS",
        "available": 117,
        "onOrder": 6256,
        "recommended": 344,
        "sales": 63,
        "targetMin": 225,
        "targetMax": 275
      },
      {
        "size": "S",
        "available": 256,
        "onOrder": 6256,
        "recommended": 774,
        "sales": 141,
        "targetMin": 507,
        "targetMax": 619
      },
      {
        "size": "M",
        "available": 433,
        "onOrder": 6256,
        "recommended": 1376,
        "sales": 250,
        "targetMin": 901,
        "targetMax": 1101
      },
      {
        "size": "L",
        "available": 347,
        "onOrder": 6256,
        "recommended": 1075,
        "sales": 196,
        "targetMin": 704,
        "targetMax": 860
      },
      {
        "size": "XL",
        "available": 174,
        "onOrder": 6256,
        "recommended": 516,
        "sales": 94,
        "targetMin": 338,
        "targetMax": 413
      },
      {
        "size": "XXL",
        "available": 74,
        "onOrder": 6256,
        "recommended": 215,
        "sales": 39,
        "targetMin": 140,
        "targetMax": 172
      }
    ]
  },
  {
    "id": "REC-007",
    "name": "Bamboo Lounge Set",
    "sku": "SKU-REC007",
    "category": "Clothing",
    "costPrice": 18,
    "sellingPrice": 60,
    "marginPct": 0.7,
    "currentStock": 1963,
    "weeklySales": 727,
    "forwardWeeksCover": 2.7,
    "recommendedReorderQty": 2910,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Draft",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop",
    "supplier": "ASOS Brands",
    "stockValue": 35334,
    "weeksOfStock": 2.7,
    "monthlyRevenue": 174480,
    "stockoutRisk": "High",
    "available": 1963,
    "onOrder": 5816,
    "safetyStock": 1091,
    "minLevel": 6907,
    "maxLevel": 9815,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1,
    "exFactoryDate": "2026-05-30",
    "receiptDate": "2026-06-20",
    "totalCost": 52380,
    "sizeCurve": [
      {
        "size": "XS",
        "available": 134,
        "onOrder": 5816,
        "recommended": 320,
        "sales": 58,
        "targetMin": 210,
        "targetMax": 256
      },
      {
        "size": "S",
        "available": 292,
        "onOrder": 5816,
        "recommended": 720,
        "sales": 131,
        "targetMin": 471,
        "targetMax": 575
      },
      {
        "size": "M",
        "available": 495,
        "onOrder": 5816,
        "recommended": 1280,
        "sales": 233,
        "targetMin": 838,
        "targetMax": 1024
      },
      {
        "size": "L",
        "available": 396,
        "onOrder": 5816,
        "recommended": 1000,
        "sales": 182,
        "targetMin": 654,
        "targetMax": 800
      },
      {
        "size": "XL",
        "available": 198,
        "onOrder": 5816,
        "recommended": 480,
        "sales": 87,
        "targetMin": 314,
        "targetMax": 384
      },
      {
        "size": "XXL",
        "available": 85,
        "onOrder": 5816,
        "recommended": 200,
        "sales": 36,
        "targetMin": 131,
        "targetMax": 160
      }
    ]
  },
  {
    "id": "REC-008",
    "name": "Ruched Bodycon Dress",
    "sku": "SKU-REC008",
    "category": "Clothing",
    "costPrice": 19.5,
    "sellingPrice": 75,
    "marginPct": 0.74,
    "currentStock": 1834,
    "weeklySales": 764,
    "forwardWeeksCover": 2.4,
    "recommendedReorderQty": 3060,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Rejected",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=80&h=80&fit=crop",
    "supplier": "Next Sourcing",
    "stockValue": 35763,
    "weeksOfStock": 2.4,
    "monthlyRevenue": 229200,
    "stockoutRisk": "High",
    "available": 1834,
    "onOrder": 6112,
    "safetyStock": 1146,
    "minLevel": 7258,
    "maxLevel": 10314,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1,
    "exFactoryDate": "2026-06-02",
    "receiptDate": "2026-06-23",
    "totalCost": 59670,
    "rejectionReason": "Intake window missed — next slot w/c 12 May",
    "sizeCurve": [
      {
        "size": "XS",
        "available": 125,
        "onOrder": 6112,
        "recommended": 336,
        "sales": 61,
        "targetMin": 220,
        "targetMax": 268
      },
      {
        "size": "S",
        "available": 273,
        "onOrder": 6112,
        "recommended": 756,
        "sales": 138,
        "targetMin": 495,
        "targetMax": 605
      },
      {
        "size": "M",
        "available": 462,
        "onOrder": 6112,
        "recommended": 1344,
        "sales": 244,
        "targetMin": 880,
        "targetMax": 1076
      },
      {
        "size": "L",
        "available": 370,
        "onOrder": 6112,
        "recommended": 1050,
        "sales": 191,
        "targetMin": 688,
        "targetMax": 840
      },
      {
        "size": "XL",
        "available": 185,
        "onOrder": 6112,
        "recommended": 504,
        "sales": 92,
        "targetMin": 330,
        "targetMax": 404
      },
      {
        "size": "XXL",
        "available": 79,
        "onOrder": 6112,
        "recommended": 210,
        "sales": 38,
        "targetMin": 138,
        "targetMax": 168
      }
    ]
  },
  {
    "id": "REC-009",
    "name": "Oversized Linen Shirt",
    "sku": "SKU-REC009",
    "category": "Clothing",
    "costPrice": 16,
    "sellingPrice": 59.26,
    "marginPct": 0.73,
    "currentStock": 1985,
    "weeklySales": 709,
    "forwardWeeksCover": 2.8,
    "recommendedReorderQty": 2840,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Approved",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "XS",
        "pct": 8,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "S",
        "pct": 18,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "M",
        "pct": 32,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "L",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XL",
        "pct": 12,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "XXL",
        "pct": 5,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=80&h=80&fit=crop",
    "supplier": "ASOS Brands",
    "stockValue": 31760,
    "weeksOfStock": 2.8,
    "monthlyRevenue": 168061.36,
    "stockoutRisk": "High",
    "available": 1985,
    "onOrder": 5672,
    "safetyStock": 1064,
    "minLevel": 6736,
    "maxLevel": 9572,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 200,
    "packSize": 1,
    "exFactoryDate": "2026-06-05",
    "receiptDate": "2026-06-26",
    "totalCost": 45440,
    "sizeCurve": [
      {
        "size": "XS",
        "available": 135,
        "onOrder": 5672,
        "recommended": 312,
        "sales": 57,
        "targetMin": 204,
        "targetMax": 250
      },
      {
        "size": "S",
        "available": 295,
        "onOrder": 5672,
        "recommended": 702,
        "sales": 128,
        "targetMin": 459,
        "targetMax": 561
      },
      {
        "size": "M",
        "available": 500,
        "onOrder": 5672,
        "recommended": 1248,
        "sales": 227,
        "targetMin": 817,
        "targetMax": 999
      },
      {
        "size": "L",
        "available": 400,
        "onOrder": 5672,
        "recommended": 975,
        "sales": 177,
        "targetMin": 638,
        "targetMax": 780
      },
      {
        "size": "XL",
        "available": 201,
        "onOrder": 5672,
        "recommended": 468,
        "sales": 85,
        "targetMin": 306,
        "targetMax": 374
      },
      {
        "size": "XXL",
        "available": 85,
        "onOrder": 5672,
        "recommended": 195,
        "sales": 35,
        "targetMin": 128,
        "targetMax": 156
      }
    ]
  },
  {
    "id": "REC-010",
    "name": "Platform Derby Shoes",
    "sku": "SKU-REC010",
    "category": "Footwear",
    "costPrice": 24,
    "sellingPrice": 85.71,
    "marginPct": 0.72,
    "currentStock": 1863,
    "weeklySales": 745,
    "forwardWeeksCover": 2.5,
    "recommendedReorderQty": 2980,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Draft",
    "recommendedFreight": "Air",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop",
    "supplier": "Clarks Wholesale",
    "stockValue": 44712,
    "weeksOfStock": 2.5,
    "monthlyRevenue": 255415.8,
    "stockoutRisk": "High",
    "available": 1863,
    "onOrder": 5960,
    "safetyStock": 1118,
    "minLevel": 7078,
    "maxLevel": 10058,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1,
    "exFactoryDate": "2026-06-08",
    "receiptDate": "2026-06-29",
    "totalCost": 71520,
    "sizeCurve": [
      {
        "size": "UK 6",
        "available": 127,
        "onOrder": 5960,
        "recommended": 328,
        "sales": 60,
        "targetMin": 214,
        "targetMax": 262
      },
      {
        "size": "UK 7",
        "available": 231,
        "onOrder": 5960,
        "recommended": 615,
        "sales": 112,
        "targetMin": 402,
        "targetMax": 492
      },
      {
        "size": "UK 8",
        "available": 411,
        "onOrder": 5960,
        "recommended": 1148,
        "sales": 209,
        "targetMin": 751,
        "targetMax": 917
      },
      {
        "size": "UK 9",
        "available": 371,
        "onOrder": 5960,
        "recommended": 1025,
        "sales": 186,
        "targetMin": 671,
        "targetMax": 820
      },
      {
        "size": "UK 10",
        "available": 217,
        "onOrder": 5960,
        "recommended": 574,
        "sales": 104,
        "targetMin": 375,
        "targetMax": 459
      },
      {
        "size": "UK 11",
        "available": 111,
        "onOrder": 5960,
        "recommended": 287,
        "sales": 52,
        "targetMin": 188,
        "targetMax": 230
      },
      {
        "size": "UK 12",
        "available": 48,
        "onOrder": 5960,
        "recommended": 123,
        "sales": 22,
        "targetMin": 80,
        "targetMax": 98
      }
    ]
  },
  {
    "id": "REC-011",
    "name": "Kitten Heel Mules",
    "sku": "SKU-REC011",
    "category": "Footwear",
    "costPrice": 22.5,
    "sellingPrice": 77.59,
    "marginPct": 0.71,
    "currentStock": 1799,
    "weeklySales": 782,
    "forwardWeeksCover": 2.3,
    "recommendedReorderQty": 3130,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Sent",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop",
    "supplier": "Steve Madden EU",
    "stockValue": 40477.5,
    "weeksOfStock": 2.3,
    "monthlyRevenue": 242701.52,
    "stockoutRisk": "High",
    "available": 1799,
    "onOrder": 6256,
    "safetyStock": 1173,
    "minLevel": 7429,
    "maxLevel": 10557,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1,
    "exFactoryDate": "2026-06-11",
    "receiptDate": "2026-07-02",
    "totalCost": 70425,
    "sizeCurve": [
      {
        "size": "UK 6",
        "available": 122,
        "onOrder": 6256,
        "recommended": 344,
        "sales": 63,
        "targetMin": 225,
        "targetMax": 275
      },
      {
        "size": "UK 7",
        "available": 223,
        "onOrder": 6256,
        "recommended": 645,
        "sales": 117,
        "targetMin": 422,
        "targetMax": 516
      },
      {
        "size": "UK 8",
        "available": 397,
        "onOrder": 6256,
        "recommended": 1204,
        "sales": 219,
        "targetMin": 788,
        "targetMax": 964
      },
      {
        "size": "UK 9",
        "available": 358,
        "onOrder": 6256,
        "recommended": 1075,
        "sales": 196,
        "targetMin": 704,
        "targetMax": 860
      },
      {
        "size": "UK 10",
        "available": 209,
        "onOrder": 6256,
        "recommended": 602,
        "sales": 109,
        "targetMin": 394,
        "targetMax": 482
      },
      {
        "size": "UK 11",
        "available": 107,
        "onOrder": 6256,
        "recommended": 301,
        "sales": 55,
        "targetMin": 197,
        "targetMax": 241
      },
      {
        "size": "UK 12",
        "available": 47,
        "onOrder": 6256,
        "recommended": 129,
        "sales": 23,
        "targetMin": 85,
        "targetMax": 103
      }
    ]
  },
  {
    "id": "REC-012",
    "name": "Wedge Espadrilles",
    "sku": "SKU-REC012",
    "category": "Footwear",
    "costPrice": 23,
    "sellingPrice": 76.67,
    "marginPct": 0.7,
    "currentStock": 1914,
    "weeklySales": 709,
    "forwardWeeksCover": 2.7,
    "recommendedReorderQty": 2840,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Approved",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=80&h=80&fit=crop",
    "supplier": "Clarks Wholesale",
    "stockValue": 44022,
    "weeksOfStock": 2.7,
    "monthlyRevenue": 217436.12,
    "stockoutRisk": "High",
    "available": 1914,
    "onOrder": 5672,
    "safetyStock": 1064,
    "minLevel": 6736,
    "maxLevel": 9572,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1,
    "exFactoryDate": "2026-06-14",
    "receiptDate": "2026-07-05",
    "totalCost": 65320,
    "sizeCurve": [
      {
        "size": "UK 6",
        "available": 130,
        "onOrder": 5672,
        "recommended": 312,
        "sales": 57,
        "targetMin": 204,
        "targetMax": 250
      },
      {
        "size": "UK 7",
        "available": 238,
        "onOrder": 5672,
        "recommended": 585,
        "sales": 106,
        "targetMin": 383,
        "targetMax": 468
      },
      {
        "size": "UK 8",
        "available": 422,
        "onOrder": 5672,
        "recommended": 1092,
        "sales": 199,
        "targetMin": 715,
        "targetMax": 873
      },
      {
        "size": "UK 9",
        "available": 381,
        "onOrder": 5672,
        "recommended": 975,
        "sales": 177,
        "targetMin": 638,
        "targetMax": 780
      },
      {
        "size": "UK 10",
        "available": 223,
        "onOrder": 5672,
        "recommended": 546,
        "sales": 99,
        "targetMin": 357,
        "targetMax": 437
      },
      {
        "size": "UK 11",
        "available": 114,
        "onOrder": 5672,
        "recommended": 273,
        "sales": 50,
        "targetMin": 179,
        "targetMax": 219
      },
      {
        "size": "UK 12",
        "available": 50,
        "onOrder": 5672,
        "recommended": 117,
        "sales": 21,
        "targetMin": 77,
        "targetMax": 94
      }
    ]
  },
  {
    "id": "REC-013",
    "name": "T-Bar Heeled Sandals",
    "sku": "SKU-REC013",
    "category": "Footwear",
    "costPrice": 25,
    "sellingPrice": 92.59,
    "marginPct": 0.73,
    "currentStock": 1604,
    "weeklySales": 764,
    "forwardWeeksCover": 2.1,
    "recommendedReorderQty": 3060,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Draft",
    "recommendedFreight": "Air",
    "sizeBreakdown": [
      {
        "label": "UK 6",
        "pct": 8,
        "color": "bg-green-100 text-green-700"
      },
      {
        "label": "UK 7",
        "pct": 15,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 8",
        "pct": 28,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 9",
        "pct": 25,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 10",
        "pct": 14,
        "color": "bg-red-100 text-red-700"
      },
      {
        "label": "UK 11",
        "pct": 7,
        "color": "bg-amber-100 text-amber-700"
      },
      {
        "label": "UK 12",
        "pct": 3,
        "color": "bg-green-100 text-green-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop",
    "supplier": "Steve Madden EU",
    "stockValue": 40100,
    "weeksOfStock": 2.1,
    "monthlyRevenue": 282955.04,
    "stockoutRisk": "High",
    "available": 1604,
    "onOrder": 6112,
    "safetyStock": 1146,
    "minLevel": 7258,
    "maxLevel": 10314,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 150,
    "packSize": 1,
    "exFactoryDate": "2026-06-17",
    "receiptDate": "2026-07-08",
    "totalCost": 76500,
    "sizeCurve": [
      {
        "size": "UK 6",
        "available": 109,
        "onOrder": 6112,
        "recommended": 336,
        "sales": 61,
        "targetMin": 220,
        "targetMax": 268
      },
      {
        "size": "UK 7",
        "available": 199,
        "onOrder": 6112,
        "recommended": 630,
        "sales": 115,
        "targetMin": 412,
        "targetMax": 504
      },
      {
        "size": "UK 8",
        "available": 354,
        "onOrder": 6112,
        "recommended": 1176,
        "sales": 214,
        "targetMin": 770,
        "targetMax": 942
      },
      {
        "size": "UK 9",
        "available": 320,
        "onOrder": 6112,
        "recommended": 1050,
        "sales": 191,
        "targetMin": 688,
        "targetMax": 840
      },
      {
        "size": "UK 10",
        "available": 187,
        "onOrder": 6112,
        "recommended": 588,
        "sales": 107,
        "targetMin": 385,
        "targetMax": 471
      },
      {
        "size": "UK 11",
        "available": 96,
        "onOrder": 6112,
        "recommended": 294,
        "sales": 53,
        "targetMin": 193,
        "targetMax": 235
      },
      {
        "size": "UK 12",
        "available": 42,
        "onOrder": 6112,
        "recommended": 126,
        "sales": 23,
        "targetMin": 83,
        "targetMax": 101
      }
    ]
  },
  {
    "id": "REC-014",
    "name": "Woven Raffia Clutch",
    "sku": "SKU-REC014",
    "category": "Accessories",
    "costPrice": 15,
    "sellingPrice": 53.57,
    "marginPct": 0.72,
    "currentStock": 1818,
    "weeklySales": 727,
    "forwardWeeksCover": 2.5,
    "recommendedReorderQty": 2910,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Sent",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&h=80&fit=crop",
    "supplier": "Radley London",
    "stockValue": 27270,
    "weeksOfStock": 2.5,
    "monthlyRevenue": 155781.56,
    "stockoutRisk": "High",
    "available": 1818,
    "onOrder": 5816,
    "safetyStock": 1091,
    "minLevel": 6907,
    "maxLevel": 9815,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 300,
    "packSize": 1,
    "exFactoryDate": "2026-06-20",
    "receiptDate": "2026-07-11",
    "totalCost": 43650
  },
  {
    "id": "REC-015",
    "name": "Pearl Drop Earrings",
    "sku": "SKU-REC015",
    "category": "Accessories",
    "costPrice": 12.5,
    "sellingPrice": 43.1,
    "marginPct": 0.71,
    "currentStock": 1935,
    "weeklySales": 691,
    "forwardWeeksCover": 2.8,
    "recommendedReorderQty": 2760,
    "avgReorderCoverWeeks": 5.5,
    "approvalStatus": "Draft",
    "recommendedFreight": "Sea",
    "sizeBreakdown": [
      {
        "label": "One Size",
        "pct": 100,
        "color": "bg-amber-100 text-amber-700"
      }
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop",
    "supplier": "Accessorize Ltd",
    "stockValue": 24187.5,
    "weeksOfStock": 2.8,
    "monthlyRevenue": 119128.4,
    "stockoutRisk": "High",
    "available": 1935,
    "onOrder": 5528,
    "safetyStock": 1037,
    "minLevel": 6565,
    "maxLevel": 9329,
    "orderFrequency": "4 weeks",
    "leadTime": "8 weeks",
    "minOrderQty": 300,
    "packSize": 1,
    "exFactoryDate": "2026-06-23",
    "receiptDate": "2026-07-14",
    "totalCost": 34500
  }
]
