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
    const dateFrom  = searchParams.get('dateFrom')  || ''
    const dateTo    = searchParams.get('dateTo')    || ''

    const db  = await connectDB()
    const col = db.collection('ORDER_DATA')

    const sample = await col.findOne({})
    if (!sample) return NextResponse.json([])

    const keys = Object.keys(sample)
    const f = (c: string[]) => c.find(x => keys.includes(x)) || c[0]
    const F = {
      region:     f(['Region']),
      area:       f(['Area']),
      territory:  f(['Territory']),
      town:       f(['Town']),
      soName:     f(['SO Name','SOName']),
      brand:      f(['Brand Name','BrandName']),
      outlet:     f(['Outlet Name','OutletName']),
      outletCode: f(['Outlet Code','OutletCode']),
      orderDate:  f(['OrderDate','Order Date']),
      grossTP:    f(['Order Gross Value(TP)','GrossTP']),
    }

    const now = new Date()
    const defaultFrom = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2,'0') + '-01'
    const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
    const defaultTo = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(lastDay).padStart(2,'0')
    const effectiveFrom = dateFrom || defaultFrom
    const effectiveTo   = dateTo   || defaultTo

    const query: Record<string, unknown> = {}
    if (region)    query[F.region]    = region
    if (area)      query[F.area]      = area
    if (territory) query[F.territory] = territory
    if (town)      query[F.town]      = town
    if (soName)    query[F.soName]    = soName
    if (brand)     query[F.brand]     = brand

    const dateConvert = {
      $addFields: {
        _d: {
          $cond: {
            if: { $regexMatch: { input: { $ifNull: [`$${F.orderDate}`,''] }, regex: '^\\d{4}-\\d{2}-\\d{2}$' } },
            then: { $ifNull: [`$${F.orderDate}`,''] },
            else: {
              $let: {
                vars: { raw: { $ifNull: [`$${F.orderDate}`,''] } },
                in: {
                  $concat: [
                    { $cond: [{ $lte: [{ $toInt: { $substr: ['$$raw',7,2] } },50] },'20','19'] },
                    { $substr: ['$$raw',7,2] }, '-',
                    { $switch: { branches: [
                      { case: { $regexMatch: { input:'$$raw', regex:'Jan' } }, then:'01' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Feb' } }, then:'02' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Mar' } }, then:'03' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Apr' } }, then:'04' },
                      { case: { $regexMatch: { input:'$$raw', regex:'May' } }, then:'05' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Jun' } }, then:'06' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Jul' } }, then:'07' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Aug' } }, then:'08' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Sep' } }, then:'09' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Oct' } }, then:'10' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Nov' } }, then:'11' },
                      { case: { $regexMatch: { input:'$$raw', regex:'Dec' } }, then:'12' },
                    ], default:'00' } }, '-',
                    { $cond: [
                      { $lte: [{ $strLenCP: { $substr: ['$$raw',0,2] } },1] },
                      { $concat: ['0',{ $substr: ['$$raw',0,1] }] },
                      { $substr: ['$$raw',0,2] }
                    ]}
                  ]
                }
              }
            }
          }
        }
      }
    }

    // Aggregate per outlet
    const pipeline = [
      { $match: query },
      dateConvert,
      { $match: { _d: { $gte: effectiveFrom, $lte: effectiveTo } } },
      { $group: {
        _id: { outletCode: `$${F.outletCode}`, outletName: `$${F.outlet}`, town: `$${F.town}`, soName: `$${F.soName}` },
        lastDate:  { $max: '$_d' },
        frequency: { $sum: 1 },
        monetary:  { $sum: { $toDouble: `$${F.grossTP}` } },
        dates:     { $addToSet: '$_d' },
      }},
      { $sort: { monetary: -1 } },
      { $limit: 500 }
    ]

    const rows = await col.aggregate(pipeline).toArray()

    // Calculate recency, CLV, repeat rate, segment
    const todayStr = effectiveTo
    const result = rows.map(r => {
      const lastDate  = String(r.lastDate || '')
      const recency   = lastDate ? Math.floor((new Date(todayStr).getTime() - new Date(lastDate).getTime()) / 86400000) : 999
      const frequency = r.frequency || 0
      const monetary  = r.monetary  || 0
      const uniqueDates = Array.isArray(r.dates) ? new Set(r.dates).size : 1
      const repeatRate = uniqueDates > 1 ? (uniqueDates - 1) / uniqueDates : 0
      const clv        = monetary * (1 + repeatRate)

      // Segment logic
      let segment = 'New'
      if (recency <= 7  && frequency >= 5 && monetary >= 5000) segment = 'Champions'
      else if (recency <= 14 && frequency >= 3)                segment = 'Loyal'
      else if (recency > 14 && recency <= 30 && frequency >= 2) segment = 'Potential'
      else if (recency > 30 && frequency >= 3)                  segment = 'At Risk'
      else if (recency > 45)                                     segment = 'Lost'

      return {
        outletCode: String(r._id?.outletCode || ''),
        outletName: String(r._id?.outletName || ''),
        town:       String(r._id?.town       || ''),
        soName:     String(r._id?.soName     || ''),
        recency, frequency, monetary, clv, repeatRate, segment
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[API /rfm]', err)
    return NextResponse.json([])
  }
}
