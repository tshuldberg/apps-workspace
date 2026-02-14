import { createClerkClient } from '@clerk/backend'
import type { IncomingMessage } from 'node:http'

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

/** Extract and verify Clerk JWT from WebSocket upgrade request.
 *  Token is passed as ?token=<jwt> query parameter. */
export async function authenticateWsConnection(req: IncomingMessage): Promise<string | null> {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
  const token = url.searchParams.get('token')

  if (!token) {
    return null
  }

  try {
    const { sub } = await clerkClient.verifyToken(token)
    return sub
  } catch {
    return null
  }
}
