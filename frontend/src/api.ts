export const apiUrl = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

export interface Customer {
  id: number
  email: string
  name: string
}

export interface CartLine {
  slug: string
  quantity: number
}

export interface OrderItemSummary {
  name: string
  slug?: string
  quantity: number
  unitPrice: number
}

export interface OrderSummary {
  orderNumber: string
  status: string
  paymentMethod: string
  paymentStatus: string
  subtotal?: number
  discountAmount?: number
  shipping?: number
  total: number
  couponCode?: string
  customerName?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  postalCode?: string
  note?: string
  createdAt: string
  items: OrderItemSummary[]
}

export interface Benefit {
  title: string
  detail: string
}

export interface StoreCity {
  slug: string
  name: string
  fee: number
  active?: boolean
}

export interface StoreSettings {
  deliveryFee: number
  freeShippingThreshold: number
  cities: StoreCity[]
}

export interface Category {
  id: number
  name: string
  slug: string
  sortOrder: number
  visible: boolean
  parentId: number | null
  parentName: string | null
}

export interface CategoryField {
  id: number
  category: string
  label: string
  placeholder: string
  sortOrder: number
}

export interface CouponPreview {
  code: string
  subtotal: number
  discountAmount: number
  shipping: number
  total: number
}

export interface CheckoutPayload {
  customerName: string
  phone: string
  email?: string
  address: string
  city: string
  postalCode?: string
  paymentMethod: string
  couponCode?: string
  note?: string
  attemptKey: string
}

export interface AdminCoupon {
  id: number
  code: string
  discountType: 'percent' | 'fixed'
  value: number
  minimumSubtotal: number
  startsAt: string | null
  endsAt: string | null
  maxUses: number | null
  usedCount: number
  active: boolean
}

export interface AdminSettings {
  deliveryFee: number
  freeDeliveryThreshold: number
  lowStockThreshold: number
  cities: StoreCity[]
}

export interface ContentRevision {
  id: number
  status: string
  editor: string
  note: string
  createdAt: string
  publishedAt: string | null
}

export interface DashboardStats {
  products: number
  unitsInStock: number
  categories: number
  catalogValue: number
  orders: number
  pendingOrders: number
  revenue: number
  lowStock: Array<{ slug: string; name: string; stockQuantity: number }>
  recentOrders: OrderSummary[]
}

export interface MediaFile {
  filename: string
  url: string
  size: number
  uploadedAt: string
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

export function formatPKR(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString('en-PK')}`
}
