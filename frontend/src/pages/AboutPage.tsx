import { ArrowRight, Check, ShieldCheck, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

const values = [
  { title: 'Useful advice', detail: 'Clear product information makes it easier to choose gear that fits your setup.', icon: Check },
  { title: 'Reliable delivery', detail: 'Orders are packed carefully and shipped to customers across Pakistan.', icon: Truck },
  { title: 'Products you can trust', detail: 'We focus on authentic hardware and straightforward warranty details.', icon: ShieldCheck },
]

function AboutPage() {
  return (
    <main id="top" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-7 sm:py-16 lg:px-10">
      <p className="section-kicker">A better way to gear up</p>
      <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-[-0.05em] sm:text-6xl">Tech that meets you where you’re going.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[#68736c]">TechnoBaazar brings practical, performance-ready technology together in one place, from the parts inside your PC to the gear on your desk.</p>
      <div className="mt-10 grid border-l border-t border-[#dfe4dc] sm:grid-cols-3">
        {values.map(({ title, detail, icon: Icon }) => (
          <article key={title} className="border-b border-r border-[#dfe4dc] bg-white p-6 sm:p-7">
            <Icon className="text-[#315ee8]" size={23} />
            <h2 className="mt-5 font-display text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#68736c]">{detail}</p>
          </article>
        ))}
      </div>
      <Link to="/collections/all-gear" className="mt-8 inline-flex h-11 items-center gap-3 bg-[#142c24] px-5 text-sm font-bold text-white transition hover:bg-[#315ee8]">Shop all gear <ArrowRight size={16} /></Link>
    </main>
  )
}

export default AboutPage