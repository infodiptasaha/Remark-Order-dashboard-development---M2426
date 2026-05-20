import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region    = searchParams.get('region')    || ''
    const area      = searchParams.get('area')      || ''
    const territory = searchParams.get('territory') || ''

    const db  = await connectDB()
    const col = db.collection('GEO_MODEL')

    const query: Record<string, string> = {}
    if (region)    query.region    = region
    if (area)      query.area      = area
    if (territory) query.territory = territory

    const [regions, areas, territories, towns] = await Promise.all([
      col.distinct('region',    {}),
      col.distinct('area',      region ? { region } : {}),
      col.distinct('territory', region || area ? query : {}),
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
