export class TrpcClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly httpStatus?: number,
    public readonly causeData?: unknown,
  ) {
    super(message)
    this.name = 'TrpcClientError'
  }
}

interface TrpcFetchOptions {
  apiUrl?: string
  signal?: AbortSignal
}

type TrpcBatchEntry<T> =
  | {
      result?: {
        data?: { json?: T } | T
      }
      error?: {
        message?: string
        data?: {
          code?: string
          httpStatus?: number
        } & Record<string, unknown>
      }
    }
  | null
  | undefined

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

function buildBatchInput(input: unknown): string {
  return JSON.stringify({
    '0': {
      json: input ?? {},
    },
  })
}

function parseBatchData<T>(payload: unknown): T {
  const entry = (Array.isArray(payload) ? payload[0] : payload) as TrpcBatchEntry<T>

  if (!entry || typeof entry !== 'object') {
    throw new TrpcClientError('Malformed tRPC response')
  }

  if (entry.error) {
    throw new TrpcClientError(
      entry.error.message ?? 'tRPC request failed',
      entry.error.data?.code,
      entry.error.data?.httpStatus,
      entry.error.data,
    )
  }

  const resultData = entry.result?.data
  if (resultData && typeof resultData === 'object' && 'json' in resultData) {
    return (resultData as { json?: T }).json as T
  }

  return resultData as T
}

async function trpcRequest<T>(
  method: 'GET' | 'POST',
  procedure: string,
  input: unknown,
  options?: TrpcFetchOptions,
): Promise<T> {
  const apiUrl = options?.apiUrl ?? DEFAULT_API_URL
  const url =
    method === 'GET'
      ? `${apiUrl}/trpc/${procedure}?${new URLSearchParams({
          batch: '1',
          input: buildBatchInput(input),
        }).toString()}`
      : `${apiUrl}/trpc/${procedure}`

  const response = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(input ?? {}) : undefined,
    signal: options?.signal,
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // Keep null payload and throw a clearer error below.
  }

  try {
    return parseBatchData<T>(payload)
  } catch (error) {
    if (error instanceof TrpcClientError) {
      throw error
    }
    throw new TrpcClientError(
      `tRPC ${procedure} failed with HTTP ${response.status}`,
      undefined,
      response.status,
    )
  }
}

export async function trpcQuery<T>(
  procedure: string,
  input: unknown = {},
  options?: TrpcFetchOptions,
): Promise<T> {
  return trpcRequest<T>('GET', procedure, input, options)
}

export async function trpcMutation<T>(
  procedure: string,
  input: unknown = {},
  options?: TrpcFetchOptions,
): Promise<T> {
  return trpcRequest<T>('POST', procedure, input, options)
}
