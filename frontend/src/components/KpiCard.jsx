export default function KpiCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    green:  'bg-green-50 text-green-700 border-green-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
  }
  return (
    <div className={`rounded-xl border p-5 flex items-start gap-4 ${colors[color]}`}>
      {Icon && (
        <div className="mt-0.5 shrink-0">
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-3xl font-bold mt-1">{value ?? '–'}</p>
        {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
      </div>
    </div>
  )
}
