export const apiUrl = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000').replace(/\/$/, '')

export interface Customer {
  id: number
  email: string
  name: string
}

export interface CartLine {
  slug: string
  quantity: number
}

export interface OrderSummary {
  orderNumber: string
  status: string
  paymentMethod: string
  paymentStatus: string
  total: number
  createdAt: string
  items: Array<{ name: string; quantity: number; unitPrice: number }>
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const message = data && typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`
    throw new Error(message)
  }
  return data as T
}
