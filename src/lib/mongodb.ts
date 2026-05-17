import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGODB_URI!
const dbName = process.env.MONGODB_DB || 'rhbl_orders'

if (!uri) throw new Error('Please define MONGODB_URI in your .env.local')

// Reuse connection across hot reloads in dev (Next.js serverless)
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function connectDB(): Promise<Db> {
  if (cachedClient && cachedDb) return cachedDb

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })

  await client.connect()
  cachedClient = client
  cachedDb = client.db(dbName)
  return cachedDb
}
