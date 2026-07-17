import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

const connectionString =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV !== 'production' ? 'postgresql://localhost:5432/postgres' : undefined)

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL not set; defaulting to postgresql://localhost:5432/postgres')
}

const client = postgres(connectionString)

export const db = drizzle(client, { schema })
