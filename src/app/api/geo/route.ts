import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

async function buildGeoModel() {
  const db  = await connectDB()
  const orders   = db.collection('ORDER_DATA')
  const geoModel = db.collection('GEO_MODEL')

  const sample = await orders.findOne({})
  if (!sample) return

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

  if (combos.length === 0) return

  await geoModel.deleteMany({})
  await geoModel.insertMany(combos)
  await geoModel.createIndex({ region: 1 })
  await geoModel.createIndex({ region: 1, area: 1 })
  await geoModel.createIndex({ region: 1, area: 1, territory: 1 })
  await geoModel.createIndex({ region: 1, area: 1, territory: 1, town: 1 })

  // Save last built timestamp
  await db.collection('GEO_META').replaceOne(
    { _id: 'last_built' as unknown as never },
    { _id: 'last_built', ts: new Date() },
    { upsert: true }
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region    = searchParams.get('region')    || ''
    const area      = searchParams.get('area')      || ''
    const territory = searchParams.get('territory') || ''

    const db  = await connectDB()
    const col = db.collection('GEO_MODEL')

    // Auto-build if empty or stale (older than 6 hours)
    const meta = await db.collection('GEO_META').findOne({ _id: 'last_built' as unknown as never })
    const count = await col.countDocuments()
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const isStale = !meta || new Date((meta as {ts: Date}).ts) < sixHoursAgo

    if (count === 0 || isStale) {
      await buildGeoModel()
    }

    const query: Record<string, string> = {}
    if (region)    query.region    = region
    if (area)      query.area      = area
    if (territory) query.territory = territory

    const [regions, areas, territories, towns] = await Promise.all([
      col.distinct('region',    {}),
      col.distinct('area',      region ? { region } : {}),
      col.distinct('territory', region || area ? { ...(region ? {region} : {}), ...(area ? {area} : {}) } : {}),
      col.distinct('town',      Object.keys(query).length ? query : {}),
    ])

    return NextResponse.json({
      regions:     regions.filter(Boolean).sort(),
      areas:       areas.filter(Boolean).sort(),
      territories: territories.filter(Boolean).sort(),
      towns:       towns.filter(Boolean).sort(),
    })
  } catch (err) {
    console.error('[API /geo]', err)
    return NextResponse.json({ regions:[], areas:[], territories:[], towns:[] })
  }
}
