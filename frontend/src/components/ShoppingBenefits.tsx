import { Check, ShieldCheck, Truck } from 'lucide-react'
import type { Benefit } from '../api'
import { DEFAULT_LANDING_CONTENT } from '../content'

const icons = [Truck, ShieldCheck, Check]

function ShoppingBenefits({ benefits = DEFAULT_LANDING_CONTENT.benefits }: { benefits?: Benefit[] }) {
  return (
    <section
      id="shopping-benefits"
      className="mx-auto grid max-w-[1440px] grid-cols-1 px-4 py-12 sm:px-7 sm:py-14 md:grid-cols-3 lg:px-10"
      aria-label="Shopping benefits"
    >
      {benefits.slice(0, 6).map(({ title, detail }, index) => {
        const Icon = icons[index % icons.length]
        return (
          <div className="benefit-item" key={`${title}-${index}`}>
            <Icon size={22} strokeWidth={1.6} />
            <div><h3>{title}</h3><p>{detail}</p></div>
          </div>
        )
      })}
    </section>
  )
}

export default ShoppingBenefits
