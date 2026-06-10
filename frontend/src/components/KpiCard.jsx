import { ChevronDown } from 'lucide-react'

export default function KpiCard({ label, value, sub, icon: Icon, variant = 'primary', onClick, aktiv }) {
  const variants = {
    primary: 'bg-[#006892] text-white',
    dark:    'bg-[#00303F] text-white',
    light:   'bg-[#e6f3f8] text-[#006892]',
    white:   'bg-white text-[#006892] border border-[#cce3ee]',
  }
  const iconColor = (variant === 'light' || variant === 'white') ? 'text-[#006892]' : 'text-white/70'
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      aria-expanded={onClick ? !!aktiv : undefined}
      className={`relative rounded-xl p-5 flex items-start gap-4 text-left shadow-sm transition-all
        ${variants[variant]}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0' : ''}
        ${aktiv ? 'ring-2 ring-[#0085b8] ring-offset-2 ring-offset-[#f5f8fa]' : ''}
      `}
    >
      {Icon && (
        <div className={`mt-0.5 shrink-0 ${iconColor}`}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-3xl font-bold mt-1 tnum">{value ?? '–'}</p>
        {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
      </div>
      {onClick && (
        <ChevronDown
          size={16}
          className={`absolute right-4 top-4 opacity-50 transition-transform duration-200 ${aktiv ? 'rotate-180' : ''}`}
        />
      )}
    </Tag>
  )
}
