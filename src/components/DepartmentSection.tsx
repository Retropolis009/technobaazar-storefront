import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Department } from '../catalog'

interface DepartmentSectionProps {
  departments: Department[]
  onSelectCategory: (category: string) => void
}

function DepartmentSection({ departments, onSelectCategory }: DepartmentSectionProps) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-7 lg:px-10 lg:pb-16" aria-labelledby="departments-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Find your frequency</p>
          <h2 id="departments-title" className="section-heading">Shop by department</h2>
        </div>
        <a href="#products" className="hidden items-center gap-2 pb-1 text-sm font-semibold text-[#315ee8] sm:inline-flex">
          Browse everything <ArrowRight size={15} />
        </a>
      </div>
      <div className="grid grid-cols-2 border-l border-t border-[#dfe4dc] sm:grid-cols-3 lg:grid-cols-6">
        {departments.map(({ name, icon: Icon }, index) => (
          <button type="button" onClick={() => onSelectCategory(name)} key={name} className="department-tile group">
            <span className={`department-icon ${index % 3 === 1 ? 'department-icon-lime' : ''}`}>
              <Icon size={23} strokeWidth={1.6} />
            </span>
            <span className="mt-3 flex w-full items-center justify-between gap-2 text-sm font-semibold">
              {name}<ArrowUpRight size={14} className="text-[#98a09a] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#315ee8]" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default DepartmentSection