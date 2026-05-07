export default function KpiCard({ label, value, sub, icon: Icon, variant = 'primary' }) {
  const variants = {
    primary: 'bg-[#006892] text-white',
    dark:    'bg-[#00303F] text-white',
    light:   'bg-[#e6f3f8] text-[#006892]',
    white:   'bg-white text-[#006892] border border-[#cce3ee]',
  }
  const iconColor = (variant === 'light' || variant === 'white') ? 'text-[#006892]' : 'text-white/70'

  return (
    <div className={`rounded-xl p-5 flex items-start gap-4 shadow-sm ${variants[variant]}`}>
      {Icon && (
        <div className={`mt-0.5 shrink-0 ${iconColor}`}>
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-3xl font-bold mt-1">{value ?? '–'}</p>
        {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
      </div>
    </div>
  )
}
