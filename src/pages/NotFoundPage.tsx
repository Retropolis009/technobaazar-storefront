import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main id="top" className="mx-auto flex min-h-[70vh] max-w-[1440px] flex-col items-start justify-center px-4 py-12 sm:px-7 lg:px-10">
      <p className="section-kicker">404 · Nothing on this shelf</p>
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em] sm:text-5xl">We couldn’t find that page.</h1>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#315ee8]"><ArrowLeft size={16} /> Back to TechnoBaazar</Link>
    </main>
  )
}

export default NotFoundPage