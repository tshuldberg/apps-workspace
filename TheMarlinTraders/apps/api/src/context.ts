import { verifyAuth } from './middleware/auth.js'

export interface Context {
  req: Request
  userId: string | null
}

export async function createContext(req: Request): Promise<Context> {
  const userId = await verifyAuth(req.headers.get('Authorization'))
  return { req, userId }
}
