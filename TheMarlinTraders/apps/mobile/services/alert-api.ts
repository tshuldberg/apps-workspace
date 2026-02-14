import { apiClient } from './api-client'

export type AlertCondition = 'price_above' | 'price_below' | 'price_crosses'
export type AlertStatus = 'active' | 'triggered' | 'expired' | 'paused'
export type DeliveryMethod = 'push' | 'email'

export interface Alert {
  id: string
  symbol: string
  condition: AlertCondition
  targetPrice: number
  currentPrice: number
  status: AlertStatus
  delivery: DeliveryMethod[]
  createdAt: string
  triggeredAt: string | null
  note?: string
}

export interface CreateAlertInput {
  symbol: string
  condition: AlertCondition
  targetPrice: number
  delivery: DeliveryMethod[]
  note?: string
}

export interface UpdateAlertInput {
  condition?: AlertCondition
  targetPrice?: number
  delivery?: DeliveryMethod[]
  status?: AlertStatus
  note?: string
}

export const alertApi = {
  async list(): Promise<Alert[]> {
    return apiClient.get<Alert[]>('/trpc/alerts.list')
  },

  async listBySymbol(symbol: string): Promise<Alert[]> {
    return apiClient.get<Alert[]>(
      `/trpc/alerts.listBySymbol?input=${encodeURIComponent(JSON.stringify({ symbol }))}`,
    )
  },

  async create(input: CreateAlertInput): Promise<Alert> {
    return apiClient.post<Alert>('/trpc/alerts.create', input)
  },

  async update(id: string, input: UpdateAlertInput): Promise<Alert> {
    return apiClient.put<Alert>(`/trpc/alerts.update`, { id, ...input })
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/trpc/alerts.delete?input=${encodeURIComponent(JSON.stringify({ id }))}`)
  },

  async pause(id: string): Promise<Alert> {
    return this.update(id, { status: 'paused' })
  },

  async resume(id: string): Promise<Alert> {
    return this.update(id, { status: 'active' })
  },
}
