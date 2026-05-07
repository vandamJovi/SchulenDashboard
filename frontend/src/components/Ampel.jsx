const COLORS = {
  green:  { dot: 'bg-green-500',  ring: 'ring-green-200',  label: 'text-green-700',  text: 'Gut' },
  yellow: { dot: 'bg-yellow-400', ring: 'ring-yellow-200', label: 'text-yellow-700', text: 'Mittel' },
  red:    { dot: 'bg-red-500',    ring: 'ring-red-200',    label: 'text-red-700',    text: 'Kritisch' },
  gray:   { dot: 'bg-slate-300',  ring: 'ring-slate-200',  label: 'text-slate-400',  text: 'Keine Daten' },
}

export function AmpelDot({ status, size = 'md' }) {
  const c = COLORS[status] ?? COLORS.gray
  const sz = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <span className={`inline-block rounded-full ring-2 ${sz} ${c.dot} ${c.ring}`} />
  )
}

export function AmpelBadge({ status, label }) {
  const c = COLORS[status] ?? COLORS.gray
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.label}`}>
      <AmpelDot status={status} size="sm" />
      {label ?? c.text}
    </span>
  )
}

export function AmpelRow({ label, status, value }) {
  const c = COLORS[status] ?? COLORS.gray
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`flex items-center gap-2 text-sm font-semibold ${c.label}`}>
        {value && <span className="text-slate-700 font-normal">{value}</span>}
        <AmpelDot status={status} size="sm" />
      </span>
    </div>
  )
}
