/**
 * Noten-Skala 1–6: fester Farbverlauf als Track, Marker an der Position
 * des Schnitts. Selbsterklärend — ersetzt die früheren Füllbalken,
 * bei denen „kurzer Balken = gute Note“ erklärt werden musste.
 */
import { notenFarbe, NOTEN_TRACK_GRADIENT as TRACK_GRADIENT } from '../lib/noten'

/** Nur Track + Marker, z.B. für Karten und Listenzeilen. */
export function NotenSkalaKompakt({ schnitt, className = '' }) {
  const pct = schnitt != null ? Math.min(100, Math.max(0, ((schnitt - 1) / 5) * 100)) : null
  return (
    <div className={`relative h-2 ${className}`}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full opacity-60" style={{ background: TRACK_GRADIENT }} />
      {pct != null && (
        <span
          className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
          style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', background: notenFarbe(schnitt) }}
        />
      )}
    </div>
  )
}

/** Volle Zeile mit Fachname, Skala 1–6 und Wert. */
export default function NotenSkala({ label, schnitt, sublabel }) {
  const pct = schnitt != null ? Math.min(100, Math.max(0, ((schnitt - 1) / 5) * 100)) : null
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-32 shrink-0 text-sm font-medium text-slate-700 truncate">{label}</div>

      <div className="flex-1 flex items-center gap-2">
        <span className="text-[10px] text-slate-400 tnum shrink-0">1</span>
        <div className="relative flex-1 h-4">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full opacity-70" style={{ background: TRACK_GRADIENT }} />
          {/* Skalenstriche bei 2–5 */}
          {[2, 3, 4, 5].map(n => (
            <span
              key={n}
              className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-white/80"
              style={{ left: `${((n - 1) / 5) * 100}%` }}
            />
          ))}
          {pct != null && (
            <span
              className="absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-all duration-500"
              style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', background: notenFarbe(schnitt) }}
            />
          )}
        </div>
        <span className="text-[10px] text-slate-400 tnum shrink-0">6</span>
      </div>

      <span className="w-12 shrink-0 text-right text-sm font-bold tnum" style={{ color: notenFarbe(schnitt) }}>
        {schnitt?.toFixed(2) ?? '–'}
      </span>
      {sublabel && <div className="w-28 shrink-0 text-xs text-slate-400 truncate hidden sm:block">{sublabel}</div>}
    </div>
  )
}
