import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region    = searchParams.get('region')    || ''
    const area      = searchParams.get('area')      || ''
    const territory = searchParams.get('territory') || ''
    const dateFrom  = searchParams.get('dateFrom')  || ''
    const dateTo    = searchParams.get('dateTo')    || ''

    const db  = await connectDB()
    const col = db.collection('ORDER_DATA')

    const sample = await col.findOne({})
    if (!sample) {
      return NextResponse.json({ regions:[], areas:[], territories:[], towns:[] })
    }

    const keys = Object.keys(sample)
    const f = (candidates: string[]) => candidates.find(c => keys.includes(c)) || candidates[0]
    const F = {
      region:    f(['Region']),
      area:      f(['Area']),
      territory: f(['Territory']),
      town:      f(['Town']),
      orderDate: f(['OrderDate', 'Order Date']),
    }

    const now = new Date()
    const defaultFrom = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01'
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const defaultTo = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0')
    const effectiveFrom = dateFrom || defaultFrom
    const effectiveTo   = dateTo   || defaultTo

    const dateConvertStage = {
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
    }

    // With date filter
    const getDistinctWithDate = async (
      field: string,
      matchExtra: Record<string, string> = {}
    ): Promise<string[]> => {
      const pipeline = [
        { $match: matchExtra },
        dateConvertStage,
        { $match: { _d: { $gte: effectiveFrom, $lte: effectiveTo } } },
        { $group: { _id: `$${field}` } },
        { $match: { _id: { $gt: '' } } },
        { $sort: { _id: 1 as const } },
        { $project: { _id: 0, value: '$_id' } }
      ]
      const results = await col.aggregate(pipeline).toArray()
      return results.map((r: Record<string, string>) => r.value).filter(Boolean)
    }

    // Region — NO date filter, always all regions from entire collection
    const allRegions = await col.distinct(F.region, {})
    const regions = allRegions.filter((v: unknown) => v && String(v).trim() !== '').sort() as string[]

    // Area, Territory, Town — date filter applies
    const areaMatch: Record<string, string> = {
      ...(region ? { [F.region]: region } : {})
    }
    const territoryMatch: Record<string, string> = {
      ...(region ? { [F.region]: region } : {}),
      ...(area   ? { [F.area]:   area   } : {})
    }
    const townMatch: Record<string, string> = {
      ...(region    ? { [F.region]:    region    } : {}),
      ...(area      ? { [F.area]:      area      } : {}),
      ...(territory ? { [F.territory]: territory } : {})
    }

    const [areas, territories, towns] = await Promise.all([
      getDistinctWithDate(F.area,      areaMatch),
      getDistinctWithDate(F.territory, territoryMatch),
      getDistinctWithDate(F.town,      townMatch),
    ])

    return NextResponse.json({ regions, areas, territories, towns })

  } catch (err) {
    console.error('[API /geo]', err)
    return NextResponse.json({ regions:[], areas:[], territories:[], towns:[] })
  }
}
