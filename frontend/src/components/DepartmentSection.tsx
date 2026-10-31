import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Department } from '../catalog'

interface DepartmentSectionProps {
  departments: Department[]
  kicker?: string
  title?: string
  onSelectCategory: (category: string) => void
}

function DepartmentSection({
  departments,
  kicker = 'Browse the store',
  title = 'Shop by category',
  onSelectCategory,
}: DepartmentSectionProps) {
  if (!departments.length) return null
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pb-16" aria-labelledby="departments-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><p className="section-kicker">{kicker}</p><h2 id="departments-title" className="section-heading">{title}</h2><p className="mt-2 text-sm text-[#68736c]">Find components and gear by the way you build, play, or work.</p></div>
        <a href="#products" className="hidden items-center gap-2 pb-1 text-sm font-bold text-[#244fa7] sm:inline-flex">Browse products<ArrowRight size={15}/></a>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {departments.map(({ name, icon: Icon }, index) => (
          <button type="button" onClick={() => onSelectCategory(name)} key={name} className="group flex min-h-24 items-center gap-3 border border-[#e1e6ed] bg-white p-3 text-left transition hover:border-[#b8c9e5] hover:bg-[#f7f9fc] sm:min-h-28 sm:gap-4 sm:p-4">
            <span className={`grid size-11 shrink-0 place-items-center rounded-sm ${index % 3 === 1 ? 'bg-[#e9f4ff] text-[#244fa7]' : 'bg-[#f0f3f7] text-[#34445f]'} transition group-hover:bg-[#244fa7] group-hover:text-white`}><Icon size={22} strokeWidth={1.7}/></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-bold leading-5 text-[#17243a] sm:text-sm">{name}</span><span className="mt-1 block text-[10px] font-medium text-[#7b8795]">Shop now</span></span>
            <ArrowUpRight size={15} className="shrink-0 text-[#9aa4b1] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#244fa7]"/>
          </button>
        ))}
      </div>
    </section>
  )
}

export default DepartmentSection
