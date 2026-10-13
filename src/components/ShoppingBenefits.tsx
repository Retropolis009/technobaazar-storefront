import { Check, ShieldCheck, Truck } from 'lucide-react'

const benefits = [
  { title: 'Across Pakistan', detail: 'Carefully packed, right to your door.', icon: Truck },
  { title: 'Gear you can trust', detail: 'Authentic products with local warranty.', icon: ShieldCheck },
  { title: 'Real human help', detail: 'Get advice before you hit checkout.', icon: Check },
]

function ShoppingBenefits() {
  return (
    <section
      id="shopping-benefits"
      className="mx-auto grid max-w-[1440px] grid-cols-1 px-4 py-12 sm:px-7 sm:py-14 md:grid-cols-3 lg:px-10"
      aria-label="Shopping benefits"
    >
      {benefits.map(({ title, detail, icon: Icon }) => (
        <div className="benefit-item" key={title}>
          <Icon size={22} strokeWidth={1.6} />
          <div><h3>{title}</h3><p>{detail}</p></div>
        </div>
      ))}
    </section>
  )
}

export default ShoppingBenefits