import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, UserRound } from 'lucide-react'
import { apiRequest, type CartLine, type Customer, type OrderSummary } from '../api'

interface Props {
  customer: Customer | null
  onAuthenticated: (customer: Customer, cart: Record<string, number>, favorites: string[]) => void
  onLogout: () => void
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
      const [cart, favorites] = await Promise.all([
        apiRequest<CartLine[]>('/api/customer/cart'),
        apiRequest<string[]>('/api/customer/favorites'),
      ])
      onAuthenticated(nextCustomer, Object.fromEntries(cart.map(item => [item.slug, item.quantity])), favorites)
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
          {orders.length ? <ul className="mt-3 divide-y divide-[#dfe4dc] border-y border-[#dfe4dc]">{orders.map(order => <li key={order.orderNumber} className="flex flex-wrap justify-between gap-2 py-4 text-sm"><span><strong>{order.orderNumber}</strong><span className="ml-2 text-[#68736c]">{order.status}</span><span className="mt-1 block text-xs text-[#68736c]">{order.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</span></span><strong>Rs. {order.total.toLocaleString('en-PK')}</strong></li>)}</ul> : <p className="mt-3 text-sm text-[#68736c]">No orders yet. <Link to="/collections/all-gear" className="text-[#315ee8]">Browse the store</Link>.</p>}
        </> : <>
          <h2 className="mt-4 font-display text-xl font-bold">{register ? 'Create your account' : 'Sign in to your account'}</h2>
          <p className="mt-2 text-sm leading-6 text-[#68736c]">Your saved bag, favorites, and order history are linked to your account.</p>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            {register && <label className="text-sm font-semibold">Name<input required maxLength={160} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal"/></label>}
            <label className="text-sm font-semibold">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal"/></label>
            <label className="text-sm font-semibold">Password<input required minLength={8} maxLength={256} type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal"/></label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="h-11 bg-[#142c24] font-semibold text-white disabled:opacity-60">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
          </form>
          <button type="button" onClick={() => { setRegister(value => !value); setError('') }} className="mt-4 text-sm font-semibold text-[#315ee8]">{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
        </>}
      </div>
    </main>
  )
}

export default AccountPage
