const { MongoClient } = require('mongodb')

const URI = process.env.MONGODB_URI || 'your_mongodb_uri_here'
const DB  = process.env.MONGODB_DB  || 'rhbl_orders'

async function main() {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db(DB)

  const orders = db.collection('ORDER_DATA')
  const geoModel = db.collection('GEO_MODEL')

  console.log('Reading ORDER_DATA...')

  // Get all unique combinations from the LATEST data
  const pipeline = [
    {
      $group: {
        _id: {
          region:    '$Region',
          area:      '$Area',
          territory: '$Territory',
          town:      '$Town',
        }
      }
    },
    {
      $project: {
        _id: 0,
        region:    '$_id.region',
        area:      '$_id.area',
        territory: '$_id.territory',
        town:      '$_id.town',
      }
    }
  ]

  const combos = await orders.aggregate(pipeline).toArray()
  console.log(`Found ${combos.length} unique geo combinations`)

  // Rebuild GEO_MODEL fresh
  await geoModel.deleteMany({})
  if (combos.length > 0) {
    await geoModel.insertMany(combos)
  }

  // Create indexes for fast lookup
  await geoModel.createIndex({ region: 1 })
  await geoModel.createIndex({ region: 1, area: 1 })
  await geoModel.createIndex({ region: 1, area: 1, territory: 1 })
  await geoModel.createIndex({ region: 1, area: 1, territory: 1, town: 1 })

  console.log('GEO_MODEL built successfully!')
  console.log('Sample:', combos.slice(0, 3))

  await client.close()
}

main().catch(console.error)
