export interface OrderRow {
  _id?: string
  Region: string
  Area: string
  Territory: string
  TownCode: string
  SAPCode: string
  Town: string
  OrderDate: string
  SOCode: string
  SOName: string
  RouteCode: string
  RouteName: string
  OutletCode: string
  OutletName: string
  BrandName: string
  SKUCode: string
  SKUName: string
  OrderPcs: number
  FreePcs: number
  GrossTP: number
  FreeTP: number
  Discount: number
  NetTP: number
  BusinessType: string
}

export interface SummaryMetrics {
  totalLines: number
  totalPcs: number
  totalFreePcs: number
  totalGross: number
  totalDiscount: number
  totalNet: number
  uniqueOutlets: number
  uniqueSOs: number
}

export interface ChartEntry {
  name: string
  value: number
}

export interface OrdersResponse {
  data: OrderRow[]
  total: number
  page: number
  pageSize: number
}

export interface FiltersResponse {
  regions: string[]
  brands: string[]
  soNames: string[]
  areas: string[]
}
