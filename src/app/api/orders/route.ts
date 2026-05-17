import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import type { OrderRow, SummaryMetrics, ChartEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region    = searchParams.get('region')    || ''
    const brand     = searchParams.get('brand')     || ''
    const soName    = searchParams.get('soName')    || ''
    const area      = searchParams.get('area')      || ''
    const search    = searchParams.get('search')    || ''
    const page      = parseInt(searchParams.get('page')     || '0')
    const pageSize  = parseInt(searchParams.get('pageSize') || '20')
    const mode      = searchParams.get('mode')      || 'table' // table | summary | charts | filters

    const db = await connectDB()
    const col = db.collection<OrderRow>('ORDER_DATA')

    // Build filter query
    const query: Record<string, unknown> = {}
    if (region)  query['Region']    = region
    if (brand)   query['BrandName'] = brand
    if (soName)  query['SOName']    = soName
    if (area)    query['Area']      = area
    if (search) {
      query['$or'] = [
        { OutletName: { $regex: search, $options: 'i' } },
        { SKUName:    { $regex: search, $options: 'i' } },
        { SOName:     { $regex: search, $options: 'i' } },
        { Town:       { $regex: search, $options: 'i' } },
      ]
    }

    // --- FILTERS mode: return distinct values ---
    if (mode === 'filters') {
      const [regions, brands, soNames, areas] = await Promise.all([
        col.distinct('Region'),
        col.distinct('BrandName'),
        col.distinct('SOName'),
        col.distinct('Area'),
      ])
      return NextResponse.json({
        regions: regions.sort(),
        brands:  brands.sort(),
        soNames: soNames.sort(),
        areas:   areas.sort(),
      })
    }

    // --- SUMMARY mode ---
    if (mode === 'summary') {
      const pipeline = [
        { $match: query },
        { $group: {
          _id: null,
          totalLines:    { $sum: 1 },
          totalPcs:      { $sum: '$OrderPcs' },
          totalFreePcs:  { $sum: '$FreePcs' },
          totalGross:    { $sum: '$GrossTP' },
          totalDiscount: { $sum: '$Discount' },
          totalNet:      { $sum: '$NetTP' },
          outlets:       { $addToSet: '$OutletCode' },
          sos:           { $addToSet: '$SOCode' },
        }},
        { $project: {
          _id: 0,
          totalLines: 1, totalPcs: 1, totalFreePcs: 1,
          totalGross: 1, totalDiscount: 1, totalNet: 1,
          uniqueOutlets: { $size: '$outlets' },
          uniqueSOs:     { $size: '$sos' },
        }}
      ]
      const [result] = await col.aggregate<SummaryMetrics>(pipeline).toArray()
      return NextResponse.json(result || {
        totalLines:0,totalPcs:0,totalFreePcs:0,
        totalGross:0,totalDiscount:0,totalNet:0,
        uniqueOutlets:0,uniqueSOs:0
      })
    }

    // --- CHARTS mode ---
    if (mode === 'charts') {
      const chartAgg = (groupBy: string) => [
        { $match: query },
        { $group: { _id: `$${groupBy}`, value: { $sum: '$NetTP' } } },
        { $sort: { value: -1 } },
        { $limit: 8 },
        { $project: { _id: 0, name: '$_id', value: 1 } },
      ]
      const [byRegion, byBrand, bySO, byArea] = await Promise.all([
        col.aggregate<ChartEntry>(chartAgg('Region')).toArray(),
        col.aggregate<ChartEntry>(chartAgg('BrandName')).toArray(),
        col.aggregate<ChartEntry>(chartAgg('SOName')).toArray(),
        col.aggregate<ChartEntry>(chartAgg('Area')).toArray(),
      ])
      return NextResponse.json({ byRegion, byBrand, bySO, byArea })
    }

    // --- TABLE mode (default) ---
    const [data, total] = await Promise.all([
      col.find(query)
         .sort({ OrderDate: -1 })
         .skip(page * pageSize)
         .limit(pageSize)
         .toArray(),
      col.countDocuments(query),
    ])

    return NextResponse.json({ data, total, page, pageSize })
  } catch (err) {
    console.error('[API /orders]', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
