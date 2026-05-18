import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region   = searchParams.get('region')   || ''
    const brand    = searchParams.get('brand')    || ''
    const soName   = searchParams.get('soName')   || ''
    const area     = searchParams.get('area')     || ''
    const search   = searchParams.get('search')   || ''
    const page     = parseInt(searchParams.get('page')     || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const mode     = searchParams.get('mode')     || 'table'
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo   = searchParams.get('dateTo')   || ''

    const db  = await connectDB()
    const col = db.collection('ORDER_DATA')

    // --- detect field names from first document ---
    const sample = await col.findOne({})
    if (!sample) {
      if (mode === 'filters')  return NextResponse.json({ regions:[], brands:[], soNames:[], areas:[] })
      if (mode === 'summary')  return NextResponse.json({ totalLines:0, totalPcs:0, totalFreePcs:0, totalGross:0, totalDiscount:0, totalNet:0, uniqueOutlets:0, uniqueSOs:0 })
      if (mode === 'charts')   return NextResponse.json({ byRegion:[], byBrand:[], bySO:[], byArea:[] })
      return NextResponse.json({ data:[], total:0, page:0, pageSize })
    }

    // Support both camelCase and space-separated field names
    const keys = Object.keys(sample)
    const f = (candidates: string[]) => candidates.find(c => keys.includes(c)) || candidates[0]

    const F = {
      region:      f(['Region']),
      area:        f(['Area']),
      brand:       f(['Brand Name', 'BrandName']),
      soName:      f(['SO Name', 'SOName']),
      town:        f(['Town']),
      outlet:      f(['Outlet Name', 'OutletName']),
      outletCode:  f(['Outlet Code', 'OutletCode']),
      soCode:      f(['SO Code', 'SOCode']),
      orderDate:   f(['OrderDate', 'Order Date']),
      territory:   f(['Territory']),
      skuName:     f(['Order SKU Name', 'SKUName']),
      orderPcs:    f(['Order in Pcs', 'OrderPcs']),
      freePcs:     f(['Free in PCS', 'FreePcs']),
      grossTP:     f(['Order Gross Value(TP)', 'GrossTP']),
      discount:    f(['Discount']),
      netTP:       f(['Net Order Value(TP)', 'NetTP']),
    }

    // Build query
    const query: Record<string, unknown> = {}
    if (region)  query[F.region]  = region
    if (brand)   query[F.brand]   = brand
    if (soName)  query[F.soName]  = soName
    if (area)    query[F.area]    = area
    // Date range filter
    if (dateFrom || dateTo) {
      const dateConditions: Record<string, unknown> = {}
      if (dateFrom) dateConditions['$gte'] = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        dateConditions['$lte'] = to
      }
      query[F.orderDate] = dateConditions
    }
    if (search) {
      query['$or'] = [
        { [F.outlet]:  { $regex: search, $options: 'i' } },
        { [F.skuName]: { $regex: search, $options: 'i' } },
        { [F.soName]:  { $regex: search, $options: 'i' } },
        { [F.town]:    { $regex: search, $options: 'i' } },
      ]
    }

    // FILTERS
    if (mode === 'filters') {
      const [regions, brands, soNames, areas] = await Promise.all([
        col.distinct(F.region),
        col.distinct(F.brand),
        col.distinct(F.soName),
        col.distinct(F.area),
      ])
      return NextResponse.json({
        regions: regions.filter(Boolean).sort(),
        brands:  brands.filter(Boolean).sort(),
        soNames: soNames.filter(Boolean).sort(),
        areas:   areas.filter(Boolean).sort(),
      })
    }

    // SUMMARY
    if (mode === 'summary') {
      const pipeline = [
        { $match: query },
        { $group: {
          _id: null,
          totalLines:    { $sum: 1 },
          totalPcs:      { $sum: { $toDouble: `$${F.orderPcs}` } },
          totalFreePcs:  { $sum: { $toDouble: `$${F.freePcs}` } },
          totalGross:    { $sum: { $toDouble: `$${F.grossTP}` } },
          totalDiscount: { $sum: { $toDouble: `$${F.discount}` } },
          totalNet:      { $sum: { $toDouble: `$${F.netTP}` } },
          outlets:       { $addToSet: `$${F.outletCode}` },
          sos:           { $addToSet: `$${F.soCode}` },
        }},
        { $project: {
          _id: 0,
          totalLines: 1, totalPcs: 1, totalFreePcs: 1,
          totalGross: 1, totalDiscount: 1, totalNet: 1,
          uniqueOutlets: { $size: '$outlets' },
          uniqueSOs:     { $size: '$sos' },
        }}
      ]
      const [result] = await col.aggregate(pipeline).toArray()
      return NextResponse.json(result || {
        totalLines:0, totalPcs:0, totalFreePcs:0,
        totalGross:0, totalDiscount:0, totalNet:0,
        uniqueOutlets:0, uniqueSOs:0
      })
    }

    // CHARTS
    if (mode === 'charts') {
      const chartAgg = (groupBy: string) => [
        { $match: query },
        { $group: { _id: `$${groupBy}`, value: { $sum: { $toDouble: `$${F.netTP}` } } } },
        { $sort: { value: -1 } },
        { $limit: 8 },
        { $project: { _id: 0, name: '$_id', value: 1 } },
      ]
      const [byRegion, byBrand, bySO, byArea] = await Promise.all([
        col.aggregate(chartAgg(F.region)).toArray(),
        col.aggregate(chartAgg(F.brand)).toArray(),
        col.aggregate(chartAgg(F.soName)).toArray(),
        col.aggregate(chartAgg(F.area)).toArray(),
      ])
      return NextResponse.json({ byRegion, byBrand, bySO, byArea })
    }

    // TABLE
    const [docs, total] = await Promise.all([
      col.find(query).skip(page * pageSize).limit(pageSize).toArray(),
      col.countDocuments(query),
    ])

    // Normalize each row to consistent keys for the frontend
    const data = docs.map(d => ({
      OrderDate:  d[F.orderDate]  ?? '',
      Region:     d[F.region]     ?? '',
      Area:       d[F.area]       ?? '',
      Town:       d[F.town]       ?? '',
      SOName:     d[F.soName]     ?? '',
      OutletName: d[F.outlet]     ?? '',
      BrandName:  d[F.brand]      ?? '',
      SKUName:    d[F.skuName]    ?? '',
      OrderPcs:   Number(d[F.orderPcs])  || 0,
      FreePcs:    Number(d[F.freePcs])   || 0,
      GrossTP:    Number(d[F.grossTP])   || 0,
      Discount:   Number(d[F.discount])  || 0,
      NetTP:      Number(d[F.netTP])     || 0,
    }))

    return NextResponse.json({ data, total, page, pageSize })

  } catch (err) {
    console.error('[API /orders]', err)
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 })
  }
}
