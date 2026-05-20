import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify cron secret so nobody else can trigger it
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db     = await connectDB()
    const orders   = db.collection('ORDER_DATA')
    const geoModel = db.collection('GEO_MODEL')

    const sample = await orders.findOne({})
    if (!sample) return NextResponse.json({ ok: false, message: 'No data' })

    const keys = Object.keys(sample)
    const f = (candidates: string[]) => candidates.find(c => keys.includes(c)) || candidates[0]
    const F = {
      region:    f(['Region']),
      area:      f(['Area']),
      territory: f(['Territory']),
      town:      f(['Town']),
    }

    const combos = await orders.aggregate([
      { $group: {
        _id: {
          region:    `$${F.region}`,
          area:      `$${F.area}`,
          territory: `$${F.territory}`,
          town:      `$${F.town}`,
        }
      }},
      { $project: {
        _id: 0,
        region:    '$_id.region',
        area:      '$_id.area',
        territory: '$_id.territory',
        town:      '$_id.town',
      }}
    ]).toArray()

    await geoModel.deleteMany({})
    if (combos.length > 0) await geoModel.insertMany(combos)

    await geoModel.createIndex({ region: 1 })
    await geoModel.createIndex({ region: 1, area: 1 })
    await geoModel.createIndex({ region: 1, area: 1, territory: 1 })
    await geoModel.createIndex({ region: 1, area: 1, territory: 1, town: 1 })

    await db.collection('GEO_META').replaceOne(
      { _id: 'last_built' as unknown as never },
      { _id: 'last_built', ts: new Date() },
      { upsert: true }
    )

    return NextResponse.json({
      ok: true,
      rebuilt: combos.length,
      ts: new Date().toISOString()
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
