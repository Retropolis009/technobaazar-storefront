import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, PackageSearch, UserRound } from 'lucide-react'
import { apiRequest, formatPKR, type Customer, type OrderSummary } from '../api'

interface Props {
  customer: Customer | null
  onAuthenticated: (customer: Customer) => void
  onLogout: () => void
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  confirmed: 'bg-blue-50 text-blue-800',
  processing: 'bg-violet-50 text-violet-800',
  shipped: 'bg-sky-50 text-sky-800',
  delivered: 'bg-green-50 text-green-800',
  cancelled: 'bg-red-50 text-red-800',
}

function AccountPage({ customer, onAuthenticated, onLogout }: Props) {
  const [register, setRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!customer) return
    apiRequest<OrderSummary[]>('/api/customer/orders').then(setOrders).catch(() => setError('Could not load order history.'))
  }, [customer])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const nextCustomer = await apiRequest<Customer>(register ? '/api/customer/register' : '/api/customer/login', {
        method: 'POST', body: JSON.stringify({ email, password, ...(register ? { name } : {}) }),
      })
      await onAuthenticated(nextCustomer)
      setPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try { await apiRequest('/api/customer/logout', { method: 'POST' }) } catch { /* Clear the local account view either way. */ }
    setOrders([])
    onLogout()
  }

  return (
    <main id="top" className="mx-auto flex min-h-[70vh] max-w-180 flex-col justify-center px-4 py-12 sm:px-7">
      <p className="section-kicker">TechnoBaazar account</p>
      <h1 className="font-display text-4xl font-bold tracking-tighter">Your account</h1>
      <div className="mt-7 border border-[#dfe4dc] bg-white p-6 sm:p-8">
        <UserRound size={25} className="text-[#315ee8]" />
        {customer ? <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-display text-xl font-bold">Welcome, {customer.name}</h2><p className="mt-1 text-sm text-[#68736c]">{customer.email}</p></div>
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 border border-[#cfd6ce] px-3 py-2 text-sm font-semibold"><LogOut size={15}/>Sign out</button>
          </div>
          <h2 className="mt-8 font-display text-lg font-bold">Order history</h2>
          {orders.length ? <ul className="mt-3 space-y-3">{orders.map(order => (
            <li key={order.orderNumber} className="border border-[#dfe4dc] p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{order.orderNumber}</strong>
                <span className={`px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-700'}`}>{order.status}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#68736c]">{order.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0eb] pt-3">
                <span className="text-xs text-[#68736c]">
                  {new Date(order.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {order.city ? ` · ${order.city}` : ''} · {order.paymentMethod === 'bank_transfer_manual' ? 'Bank transfer' : 'Cash on delivery'}
                </span>
                <strong>{formatPKR(order.total)}</strong>
              </div>
              {(order.subtotal ?? 0) > 0 && (
                <p className="mt-1.5 text-xs text-[#9aa29b]">
                  Subtotal {formatPKR(order.subtotal ?? order.total)}
                  {(order.discountAmount ?? 0) > 0 ? ` · Discount −${formatPKR(order.discountAmount ?? 0)}` : ''}
                  {` · Delivery ${(order.shipping ?? 0) === 0 ? 'Free' : formatPKR(order.shipping ?? 0)}`}
                </p>
              )}
            </li>
          ))}</ul> : (
            <div className="mt-3 border border-dashed border-[#cbd2ca] px-5 py-10 text-center">
              <PackageSearch size={24} className="mx-auto text-[#929a94]" />
              <p className="mt-3 text-sm text-[#68736c]">No orders yet. <Link to="/collections/all-gear" className="font-semibold text-[#315ee8]">Browse the store</Link>.</p>
            </div>
          )}
        </> : <>
          <h2 className="mt-4 font-display text-xl font-bold">{register ? 'Create your account' : 'Sign in to your account'}</h2>
          <p className="mt-2 text-sm leading-6 text-[#68736c]">Your saved bag, favorites, and order history are linked to your account.</p>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            {register && <label className="text-sm font-semibold">Name<input required maxLength={160} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]"/></label>}
            <label className="text-sm font-semibold">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]"/></label>
            <label className="text-sm font-semibold">Password<input required minLength={8} maxLength={256} type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]"/></label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="h-11 bg-[#142c24] font-semibold text-white transition hover:bg-[#315ee8] disabled:opacity-60">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
          </form>
          <button type="button" onClick={() => { setRegister(value => !value); setError('') }} className="mt-4 text-sm font-semibold text-[#315ee8]">{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
        </>}
      </div>
    </main>
  )
}

export default AccountPage
