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
    const groupBy   = searchParams.get('groupBy')   || 'region'

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
      outletCode: f(['Outlet Code','OutletCode']),
      orderDate:  f(['OrderDate','Order Date']),
      orderPcs:   f(['Order in Pcs','OrderPcs']),
      grossTP:    f(['Order Gross Value(TP)','GrossTP']),
    }

    const groupField = groupBy === 'area' ? F.area : groupBy === 'territory' ? F.territory : groupBy === 'town' ? F.town : F.region

    const now = new Date()
    const defaultFrom = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01'
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

    const dateConvert = { $addFields: { _d: { $cond: {
      if: { $regexMatch: { input: { $ifNull: [`$${F.orderDate}`,''] }, regex: '^\\d{4}-\\d{2}-\\d{2}$' } },
      then: { $ifNull: [`$${F.orderDate}`,''] },
      else: { $let: { vars: { raw: { $ifNull: [`$${F.orderDate}`,''] } }, in: { $concat: [
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
        { $cond: [{ $lte: [{ $strLenCP: { $substr: ['$$raw',0,2] } },1] },
          { $concat: ['0',{ $substr: ['$$raw',0,1] }] }, { $substr: ['$$raw',0,2] }]}
      ]}}}
    }}}}

    const rows = await col.aggregate([
      { $match: query }, dateConvert,
      { $match: { _d: { $gte: effectiveFrom, $lte: effectiveTo } } },
      { $group: {
        _id: `$${groupField}`,
        grossTP:  { $sum: { $toDouble: `$${F.grossTP}` } },
        orders:   { $sum: 1 },
        pcs:      { $sum: { $toDouble: `$${F.orderPcs}` } },
        outlets:  { $addToSet: `$${F.outletCode}` },
      }},
      { $project: {
        _id:0,
        [groupBy]: '$_id',
        grossTP:1, orders:1, pcs:1,
        outletCount: { $size: '$outlets' },
        avgPerOutlet: { $cond: [{ $gt: [{ $size: '$outlets' },0] },
          { $divide: ['$grossTP', { $size: '$outlets' }] }, 0] }
      }},
      { $sort: { grossTP: -1 } }
    ]).toArray()

    const result = rows.map(r => ({
      region:    String(r.region    || r[groupBy] || ''),
      area:      String(r.area      || r[groupBy] || ''),
      territory: String(r.territory || r[groupBy] || ''),
      town:      String(r.town      || r[groupBy] || ''),
      [groupBy]: String(r[groupBy]  || ''),
      grossTP:      r.grossTP      || 0,
      orders:       r.orders       || 0,
      pcs:          r.pcs          || 0,
      outlets:      r.outletCount  || 0,
      avgPerOutlet: r.avgPerOutlet || 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[API /geographic]', err)
    return NextResponse.json([])
  }
}
