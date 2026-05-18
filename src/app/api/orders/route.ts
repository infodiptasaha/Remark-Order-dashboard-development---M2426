import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

// Convert "14-May-26" or "2026-05-14" to a comparable string "YYYY-MM-DD"
function toComparableDate(s: string): string {
  if (!s) return ''
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD-Mon-YY e.g. "14-May-26"
  const months: Record<string, string> = {
    Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
    Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'
  }
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (m) {
    const day  = m[1].padStart(2, '0')
    const mon  = months[m[2]] || '00'
    const year = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${year}-${mon}-${day}`
  }
  return s
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region    = searchParams.get('region')    || ''
    const area      = searchParams.get('area')      || ''
    const territory = searchParams.get('territory') || ''
    const soName    = searchParams.get('soName')    || ''
    const search    = searchParams.get('search')    || ''
    const dateFrom  = searchParams.get('dateFrom')  || ''
    const dateTo    = searchParams.get('dateTo')    || ''
    const page      = parseInt(searchParams.get('page')     || '0')
    const pageSize  = parseInt(searchParams.get('pageSize') || '20')
    const mode      = searchParams.get('mode')      || 'table'

    const db  = await connectDB()
    const col = db.collection('ORDER_DATA')

    const sample = await col.findOne({})
    if (!sample) {
      if (mode === 'filters')  return NextResponse.json({ regions:[], areas:[], territories:[], soNames:[] })
      if (mode === 'summary')  return NextResponse.json({ totalLines:0,totalPcs:0,totalFreePcs:0,totalGross:0,totalDiscount:0,totalNet:0,uniqueOutlets:0,uniqueSOs:0 })
      if (mode === 'charts')   return NextResponse.json({ byRegion:[],byTerritory:[],bySO:[],byArea:[] })
      return NextResponse.json({ data:[],total:0,page:0,pageSize })
    }

    const keys = Object.keys(sample)
    const f = (candidates: string[]) => candidates.find(c => keys.includes(c)) || candidates[0]

    const F = {
      region:     f(['Region']),
      area:       f(['Area']),
      territory:  f(['Territory']),
      soName:     f(['SO Name','SOName']),
      town:       f(['Town']),
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
      brand:      f(['Brand Name','BrandName']),
    }

    // ── Build base query ──────────────────────────────────────
    const query: Record<string, unknown> = {}
    if (region)    query[F.region]    = region
    if (area)      query[F.area]      = area
    if (territory) query[F.territory] = territory
    if (soName)    query[F.soName]    = soName

    // Date filter — compare as string "YYYY-MM-DD" using $where or addFields+match
    // We use aggregation pipeline for date, simple query for others
    const fromStr = dateFrom  // already YYYY-MM-DD from <input type="date">
    const toStr   = dateTo

    if (search) {
      query['$or'] = [
        { [F.outlet]:  { $regex: search, $options: 'i' } },
        { [F.skuName]: { $regex: search, $options: 'i' } },
        { [F.soName]:  { $regex: search, $options: 'i' } },
        { [F.town]:    { $regex: search, $options: 'i' } },
      ]
    }

    // Date pipeline stages (convert stored string → comparable YYYY-MM-DD)
    const dateStages = (fromStr || toStr) ? [
      { $addFields: {
        _dateStr: {
          $let: {
            vars: {
              raw: { $ifNull: [`$${F.orderDate}`, ''] },
            },
            in: {
              $cond: {
                // Already YYYY-MM-DD format
                if: { $regexMatch: { input: '$$raw', regex: /^\d{4}-\d{2}-\d{2}$/ } },
                then: '$$raw',
                // DD-Mon-YY format → convert via $dateFromString
                else: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: {
                      $dateFromString: {
                        dateString: '$$raw',
                        format: '%d-%b-%y',
                        onError: null,
                        onNull: null,
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }},
      { $match: {
        ...(fromStr ? { _dateStr: { $gte: fromStr } } : {}),
        ...(toStr   ? { _dateStr: { $lte: toStr } }   : {}),
      }},
    ] : []

    // ── FILTERS mode — respect current selections for cascading ──
    if (mode === 'filters') {
      // Each dropdown only shows values valid given the currently selected filters above it
      const baseMatch = { $match: query }

      const [regions, areas, territories, soNames] = await Promise.all([
        col.distinct(F.region,    {}),
        col.distinct(F.area,      query),
        col.distinct(F.territory, query),
        col.distinct(F.soName,    query),
      ])

      return NextResponse.json({
        regions:     regions.filter(Boolean).sort(),
        areas:       areas.filter(Boolean).sort(),
        territories: territories.filter(Boolean).sort(),
        soNames:     soNames.filter(Boolean).sort(),
      })
    }

    // ── SUMMARY ──────────────────────────────────────────────
    if (mode === 'summary') {
      const pipeline = [
        { $match: query },
        ...dateStages,
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
          _id:0, totalLines:1, totalPcs:1, totalFreePcs:1,
          totalGross:1, totalDiscount:1, totalNet:1,
          uniqueOutlets: { $size: '$outlets' },
          uniqueSOs:     { $size: '$sos' },
        }}
      ]
      const [result] = await col.aggregate(pipeline).toArray()
      return NextResponse.json(result || {
        totalLines:0,totalPcs:0,totalFreePcs:0,
        totalGross:0,totalDiscount:0,totalNet:0,
        uniqueOutlets:0,uniqueSOs:0
      })
    }

    // ── CHARTS ────────────────────────────────────────────────
    if (mode === 'charts') {
      const chartAgg = (groupBy: string) => [
        { $match: query },
        ...dateStages,
        { $group: { _id: `$${groupBy}`, value: { $sum: { $toDouble: `$${F.netTP}` } } } },
        { $sort: { value: -1 } },
        { $limit: 8 },
        { $project: { _id:0, name:'$_id', value:1 } },
      ]
      const [byRegion, byTerritory, bySO, byArea] = await Promise.all([
        col.aggregate(chartAgg(F.region)).toArray(),
        col.aggregate(chartAgg(F.territory)).toArray(),
        col.aggregate(chartAgg(F.soName)).toArray(),
        col.aggregate(chartAgg(F.area)).toArray(),
      ])
      return NextResponse.json({ byRegion, byTerritory, bySO, byArea })
    }

    // ── TABLE ─────────────────────────────────────────────────
    if (dateStages.length > 0) {
      const countPipeline = [{ $match: query }, ...dateStages, { $count: 'n' }]
      const dataPipeline  = [
        { $match: query }, ...dateStages,
        { $skip: page * pageSize }, { $limit: pageSize },
      ]
      const [countRes, docs] = await Promise.all([
        col.aggregate(countPipeline).toArray(),
        col.aggregate(dataPipeline).toArray(),
      ])
      const total = countRes[0]?.n || 0
      const data = docs.map((d: Record<string, unknown>) => ({
        OrderDate:  String(d[F.orderDate]  ?? ''),
        Region:     String(d[F.region]     ?? ''),
        Area:       String(d[F.area]       ?? ''),
        Territory:  String(d[F.territory]  ?? ''),
        Town:       String(d[F.town]       ?? ''),
        SOName:     String(d[F.soName]     ?? ''),
        OutletName: String(d[F.outlet]     ?? ''),
        BrandName:  String(d[F.brand]      ?? ''),
        SKUName:    String(d[F.skuName]    ?? ''),
        OrderPcs:   Number(d[F.orderPcs])  || 0,
        FreePcs:    Number(d[F.freePcs])   || 0,
        GrossTP:    Number(d[F.grossTP])   || 0,
        Discount:   Number(d[F.discount])  || 0,
        NetTP:      Number(d[F.netTP])     || 0,
      }))
      return NextResponse.json({ data, total, page, pageSize })
    }

    const [docs, total] = await Promise.all([
      col.find(query).skip(page * pageSize).limit(pageSize).toArray(),
      col.countDocuments(query),
    ])
    const data = docs.map((d: Record<string, unknown>) => ({
      OrderDate:  String(d[F.orderDate]  ?? ''),
      Region:     String(d[F.region]     ?? ''),
      Area:       String(d[F.area]       ?? ''),
      Territory:  String(d[F.territory]  ?? ''),
      Town:       String(d[F.town]       ?? ''),
      SOName:     String(d[F.soName]     ?? ''),
      OutletName: String(d[F.outlet]     ?? ''),
      BrandName:  String(d[F.brand]      ?? ''),
      SKUName:    String(d[F.skuName]    ?? ''),
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
