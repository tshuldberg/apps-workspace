import { createTRPCClient, httpBatchLink } from '@trpc/client'

// AppRouter type will be imported from the API package once it's built.
// Using `any` as a temporary placeholder avoids tRPC's Router constraint.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppRouter = any

export function createApiClient(baseUrl: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
      }),
    ],
  })
}

export const DEFAULT_API_URL = 'http://localhost:4000'
