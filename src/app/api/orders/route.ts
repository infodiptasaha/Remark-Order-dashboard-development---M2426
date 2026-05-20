import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region    = searchParams.get('region')    || ''
    const area      = searchParams.get('area')      || ''
    const territory = searchParams.get('territory') || ''
    const town      = searchParams.get('town')      || ''
    const soName    = searchParams.get('soName')    || ''
    const brand     = searchParams.get('brand')     || ''
    const search    = searchParams.get('search')    || ''
    const dateFrom  = searchParams.get('dateFrom')  || ''
    const dateTo    = searchParams.get('dateTo')    || ''
    const page      = parseInt(searchParams.get('page')     || '0')
    const pageSize  = parseInt(searchParams.get('pageSize') || '20')
    const mode      = searchParams.get('mode')      || 'table'

    const db  = await connectDB()
    const col = db.collection('ORDER_DATA')

    // Default = current month
    const now = new Date()
    const defaultFrom = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01'
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const defaultTo = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0')
    const effectiveFrom = dateFrom || defaultFrom
    const effectiveTo   = dateTo   || defaultTo

    const sample = await col.findOne({})
    if (!sample) {
      if (mode === 'filters') return NextResponse.json({ soNames:[], brands:[] })
      if (mode === 'summary') return NextResponse.json({ totalLines:0,totalPcs:0,totalFreePcs:0,totalGross:0,totalDiscount:0,totalNet:0,uniqueOutlets:0,uniqueSOs:0 })
      if (mode === 'charts')  return NextResponse.json({ byRegion:[],byArea:[],byTerritory:[],byTown:[],bySO:[] })
      return NextResponse.json({ data:[],total:0,page:0,pageSize })
    }

    const keys = Object.keys(sample)
    const f = (candidates: string[]) => candidates.find(c => keys.includes(c)) || candidates[0]

    const F = {
      region:     f(['Region']),
      area:       f(['Area']),
      territory:  f(['Territory']),
      town:       f(['Town']),
      soName:     f(['SO Name','SOName']),
      brand:      f(['Brand Name','BrandName']),
      outlet:     f(['Outlet Name','OutletName']),
      outletCode: f(['Outlet Code','OutletCode']),
      soCode:     f(['SO Code','SOCode']),
      orderDate:  f(['OrderDate','Order Date']),
      skuName:    f(['Order SKU Name','SKUName']),
      orderPcs:   f(['Order in Pcs','OrderPcs']),
      freePcs:    f(['Free in PCS','FreePcs']),
      grossTP:    f(['Order Gross Value(TP)','GrossTP']),
      discount:   f(['Discount']),
      netTP:      f(['Net Order Value(TP)','NetTP']),
    }

    const query: Record<string, unknown> = {}
    if (region)    query[F.region]    = region
    if (area)      query[F.area]      = area
    if (territory) query[F.territory] = territory
    if (town)      query[F.town]      = town
    if (soName)    query[F.soName]    = soName
    if (brand)     query[F.brand]     = brand
    if (search) {
      query['$or'] = [
        { [F.outlet]:  { $regex: search, $options: 'i' } },
        { [F.skuName]: { $regex: search, $options: 'i' } },
        { [F.soName]:  { $regex: search, $options: 'i' } },
        { [F.town]:    { $regex: search, $options: 'i' } },
      ]
    }

    const dateStages = [
      {
        $addFields: {
          _d: {
            $cond: {
              if: { $regexMatch: { input: { $ifNull: [`$${F.orderDate}`, ''] }, regex: '^\\d{4}-\\d{2}-\\d{2}$' } },
              then: { $ifNull: [`$${F.orderDate}`, ''] },
              else: {
                $let: {
                  vars: { raw: { $ifNull: [`$${F.orderDate}`, ''] } },
                  in: {
                    $concat: [
                      { $cond: [{ $lte: [{ $toInt: { $substr: ['$$raw', 7, 2] } }, 50] }, '20', '19'] },
                      { $substr: ['$$raw', 7, 2] }, '-',
                      { $switch: {
                        branches: [
                          { case: { $regexMatch: { input: '$$raw', regex: 'Jan' } }, then: '01' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Feb' } }, then: '02' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Mar' } }, then: '03' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Apr' } }, then: '04' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'May' } }, then: '05' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Jun' } }, then: '06' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Jul' } }, then: '07' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Aug' } }, then: '08' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Sep' } }, then: '09' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Oct' } }, then: '10' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Nov' } }, then: '11' },
                          { case: { $regexMatch: { input: '$$raw', regex: 'Dec' } }, then: '12' },
                        ],
                        default: '00'
                      }}, '-',
                      { $cond: [
                        { $lte: [{ $strLenCP: { $substr: ['$$raw', 0, 2] } }, 1] },
                        { $concat: ['0', { $substr: ['$$raw', 0, 1] }] },
                        { $substr: ['$$raw', 0, 2] }
                      ]}
                    ]
                  }
                }
              }
            }
          }
        }
      },
      { $match: { _d: { $gte: effectiveFrom, $lte: effectiveTo } } }
    ]

    const grossVal = { $toDouble: `$${F.grossTP}` }

    // filters mode — only SO and Brand (geo comes from /api/geo)
    if (mode === 'filters') {
      const [soNames, brands] = await Promise.all([
        col.distinct(F.soName, query),
        col.distinct(F.brand,  query),
      ])
      return NextResponse.json({
        soNames: soNames.filter(Boolean).sort(),
        brands:  brands.filter(Boolean).sort(),
      })
    }

    if (mode === 'summary') {
      const pipeline = [
        { $match: query }, ...dateStages,
        { $group: {
          _id: null,
          totalLines:    { $sum: 1 },
          totalPcs:      { $sum: { $toDouble: `$${F.orderPcs}` } },
          totalFreePcs:  { $sum: { $toDouble: `$${F.freePcs}`  } },
          totalGross:    { $sum: grossVal },
          totalDiscount: { $sum: { $toDouble: `$${F.discount}` } },
          totalNet:      { $sum: { $toDouble: `$${F.netTP}`    } },
          outlets:       { $addToSet: `$${F.outletCode}` },
          sos:           { $addToSet: `$${F.soCode}` },
        }},
        { $project: {
          _id:0, totalLines:1, totalPcs:1, totalFreePcs:1,
          totalGross:1, totalDiscount:1, totalNet:1,
          uniqueOutlets: { $size: '$outlets' },
          uniqueSOs:     { $size: '$sos' },
        }}
      ]
      const [result] = await col.aggregate(pipeline).toArray()
      return NextResponse.json(result || { totalLines:0,totalPcs:0,totalFreePcs:0,totalGross:0,totalDiscount:0,totalNet:0,uniqueOutlets:0,uniqueSOs:0 })
    }

    if (mode === 'charts') {
      const chartAgg = (groupBy: string) => [
        { $match: query }, ...dateStages,
        { $group: { _id: `$${groupBy}`, value: { $sum: grossVal } } },
        { $sort: { value: -1 } },
        { $limit: 8 },
        { $project: { _id:0, name:'$_id', value:1 } },
      ]
      const [byRegion, byArea, byTerritory, byTown, bySO] = await Promise.all([
        col.aggregate(chartAgg(F.region)).toArray(),
        col.aggregate(chartAgg(F.area)).toArray(),
        col.aggregate(chartAgg(F.territory)).toArray(),
        col.aggregate(chartAgg(F.town)).toArray(),
        col.aggregate(chartAgg(F.soName)).toArray(),
      ])
      return NextResponse.json({ byRegion, byArea, byTerritory, byTown, bySO })
    }

    const mapDoc = (d: Record<string, unknown>) => ({
      OrderDate: String(d[F.orderDate] ?? ''), Region: String(d[F.region] ?? ''),
      Area: String(d[F.area] ?? ''), Territory: String(d[F.territory] ?? ''),
      Town: String(d[F.town] ?? ''), SOName: String(d[F.soName] ?? ''),
      OutletName: String(d[F.outlet] ?? ''), BrandName: String(d[F.brand] ?? ''),
      SKUName: String(d[F.skuName] ?? ''),
      OrderPcs: Number(d[F.orderPcs]) || 0, FreePcs: Number(d[F.freePcs]) || 0,
      GrossTP: Number(d[F.grossTP]) || 0, Discount: Number(d[F.discount]) || 0,
      NetTP: Number(d[F.netTP]) || 0,
    })

    const [countRes, docs] = await Promise.all([
      col.aggregate([{ $match: query }, ...dateStages, { $count: 'n' }]).toArray(),
      col.aggregate([{ $match: query }, ...dateStages, { $skip: page * pageSize }, { $limit: pageSize }]).toArray(),
    ])
    return NextResponse.json({ data: docs.map(mapDoc), total: countRes[0]?.n || 0, page, pageSize })

  } catch (err) {
    console.error('[API /orders]', err)
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 })
  }
}
