import Constants from 'expo-constants'

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:4000'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

class ApiClient {
  private baseUrl: string
  private authToken: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { body, headers: customHeaders, ...rest } = options

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error')
      throw new Error(
        `API Error ${response.status}: ${errorBody}`,
      )
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>
    }
    return undefined as T
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'POST', body })
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'PUT', body })
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(API_URL)
export { API_URL }
