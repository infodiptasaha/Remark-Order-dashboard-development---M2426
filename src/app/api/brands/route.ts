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
      outletCode: f(['Outlet Code','OutletCode']),
      orderDate:  f(['OrderDate','Order Date']),
      orderPcs:   f(['Order in Pcs','OrderPcs']),
      grossTP:    f(['Order Gross Value(TP)','GrossTP']),
      netTP:      f(['Net Order Value(TP)','NetTP']),
    }

    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    const defaultFrom = y + '-' + String(m+1).padStart(2,'0') + '-01'
    const lastDay = new Date(y, m+1, 0).getDate()
    const defaultTo = y + '-' + String(m+1).padStart(2,'0') + '-' + String(lastDay).padStart(2,'0')
    const effectiveFrom = dateFrom || defaultFrom
    const effectiveTo   = dateTo   || defaultTo

    // Previous month range
    const prevDate  = new Date(y, m-1, 1)
    const prevFrom  = prevDate.getFullYear() + '-' + String(prevDate.getMonth()+1).padStart(2,'0') + '-01'
    const prevLast  = new Date(prevDate.getFullYear(), prevDate.getMonth()+1, 0).getDate()
    const prevTo    = prevDate.getFullYear() + '-' + String(prevDate.getMonth()+1).padStart(2,'0') + '-' + String(prevLast).padStart(2,'0')

    const query: Record<string, unknown> = {}
    if (region)    query[F.region]    = region
    if (area)      query[F.area]      = area
    if (territory) query[F.territory] = territory
    if (town)      query[F.town]      = town
    if (soName)    query[F.soName]    = soName
    if (brand)     query[F.brand]     = brand

    const mkDateConvert = (dateField: string) => ({ $addFields: { _d: { $cond: {
      if: { $regexMatch: { input: { $ifNull: [`$${dateField}`,''] }, regex: '^\\d{4}-\\d{2}-\\d{2}$' } },
      then: { $ifNull: [`$${dateField}`,''] },
      else: { $let: { vars: { raw: { $ifNull: [`$${dateField}`,''] } }, in: { $concat: [
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

    const dateConvert = mkDateConvert(F.orderDate)

    // Current period
    const current = await col.aggregate([
      { $match: query }, dateConvert,
      { $match: { _d: { $gte: effectiveFrom, $lte: effectiveTo } } },
      { $group: {
        _id: `$${F.brand}`,
        grossTP:  { $sum: { $toDouble: `$${F.grossTP}` } },
        netTP:    { $sum: { $toDouble: `$${F.netTP}` } },
        orders:   { $sum: 1 },
        pcs:      { $sum: { $toDouble: `$${F.orderPcs}` } },
        outlets:  { $addToSet: `$${F.outletCode}` },
        dates:    { $push: '$_d' },
        outletDates: { $push: { outlet: `$${F.outletCode}`, date: '$_d' } },
      }},
    ]).toArray()

    // Previous period
    const previous = await col.aggregate([
      { $match: query }, dateConvert,
      { $match: { _d: { $gte: prevFrom, $lte: prevTo } } },
      { $group: { _id: `$${F.brand}`, grossTP: { $sum: { $toDouble: `$${F.grossTP}` } } } }
    ]).toArray()

    const prevMap: Record<string, number> = {}
    previous.forEach(p => { prevMap[String(p._id)] = p.grossTP || 0 })

    const result = current.map(r => {
      const brandName   = String(r._id || '')
      const grossTP     = r.grossTP || 0
      const netTP       = r.netTP   || 0
      const orders      = r.orders  || 0
      const pcs         = r.pcs     || 0
      const outletList  = Array.isArray(r.outlets) ? r.outlets : []
      const outlets     = outletList.length
      const avgOrderValue = orders > 0 ? grossTP / orders : 0

      const prevGrossTP = prevMap[brandName] || 0
      const growthRate  = prevGrossTP > 0 ? ((grossTP - prevGrossTP) / prevGrossTP) * 100 : 0

      // Repeat analysis per outlet
      const outletDateMap: Record<string, Set<string>> = {}
      if (Array.isArray(r.outletDates)) {
        r.outletDates.forEach((od: {outlet:string;date:string}) => {
          if (!outletDateMap[od.outlet]) outletDateMap[od.outlet] = new Set()
          outletDateMap[od.outlet].add(od.date)
        })
      }
      const repeatOutlets = Object.values(outletDateMap).filter(s => s.size > 1).length
      const repeatRate    = outlets > 0 ? repeatOutlets / outlets : 0

      // Velocity: avg days between orders for repeating outlets
      let totalVelocity = 0, velocityCount = 0
      Object.values(outletDateMap).forEach(dateSet => {
        const dates = [...dateSet].sort()
        if (dates.length > 1) {
          for (let i = 1; i < dates.length; i++) {
            const diff = (new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / 86400000
            totalVelocity += diff
            velocityCount++
          }
        }
      })
      const avgRepeatVelocityDays = velocityCount > 0 ? totalVelocity / velocityCount : 0

      return {
        brand: brandName, grossTP, netTP, orders, pcs, outlets,
        avgOrderValue, prevGrossTP, growthRate,
        repeatOutlets, repeatRate, avgRepeatVelocityDays
      }
    }).sort((a, b) => b.grossTP - a.grossTP)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[API /brands]', err)
    return NextResponse.json([])
  }
}
