import { Link } from 'react-router-dom'
import { AmpelDot, AmpelBadge } from './Ampel'
import { AMPEL_INFO } from '../lib/ampelInfo'
import { MapPin, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react'

function GesamtAmpel(ampel) {
  const vals = Object.values(ampel)
  if (vals.includes('red')) return 'red'
  if (vals.includes('yellow')) return 'yellow'
  if (vals.includes('green')) return 'green'
  return 'gray'
}

function YoyIcon({ pct }) {
  if (pct === null || pct === undefined) return null
  if (pct > 2)  return <TrendingUp  size={14} className="text-green-500" />
  if (pct < -2) return <TrendingDown size={14} className="text-red-500" />
  return <Minus size={14} className="text-yellow-500" />
}

const BORDER = {
  green:  'border-l-green-500',
  yellow: 'border-l-yellow-400',
  red:    'border-l-red-500',
  gray:   'border-l-slate-300',
}

export default function SchulCard({ schule }) {
  const gesamt = GesamtAmpel(schule.ampel)
  const yoy = schule.yoy_change_pct

  return (
    <Link
      to={`/schule/${schule.id}`}
      className={`block bg-white rounded-xl border border-slate-200 border-l-4 ${BORDER[gesamt]}
        p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#00303F] text-sm leading-snug">{schule.name}</h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
            <MapPin size={11} />
            <span>{schule.ort}, {schule.bundesland}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs font-bold rounded px-1.5 py-0.5 bg-[#e6f3f8] text-[#006892]">
            {schule.stiftung}
          </span>
          <AmpelDot status={gesamt} size="md" />
        </div>
      </div>

      {/* Schultypen */}
      <div className="flex flex-wrap gap-1 mb-3">
        {schule.schultypen.slice(0, 3).map(t => (
          <span key={t} className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{t}</span>
        ))}
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#f5f8fa] rounded-lg p-2.5">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
            <Users size={11} />
            <span>Schüler</span>
          </div>
          <div className="font-bold text-[#00303F] text-lg tnum">
            {schule.gesamt_schueler?.toLocaleString('de-DE') ?? '–'}
          </div>
          {schule.aktuelles_schuljahr && (
            <div className="text-xs text-slate-400">SJ {schule.aktuelles_schuljahr}</div>
          )}
        </div>
        <div className="bg-[#f5f8fa] rounded-lg p-2.5">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
            <YoyIcon pct={yoy} />
            <span>Entwicklung</span>
          </div>
          <div className={`font-bold text-lg tnum ${
            yoy === null || yoy === undefined ? 'text-slate-400' :
            yoy > 2  ? 'text-green-600' :
            yoy < -2 ? 'text-red-600'   : 'text-yellow-600'
          }`}>
            {yoy !== null && yoy !== undefined ? `${yoy > 0 ? '+' : ''}${yoy}%` : '–'}
          </div>
          <div className="text-xs text-slate-400">ggü. Vorjahr</div>
        </div>
      </div>

      {/* Ampel-Badges */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <AmpelBadge status={schule.ampel.auslastung} info={AMPEL_INFO.auslastung} label={
          schule.auslastung_pct !== null ? `Auslastung ${schule.auslastung_pct}%` : 'Auslastung –'
        } />
        <AmpelBadge status={schule.ampel.prognose} info={AMPEL_INFO.prognose} label={
          schule.prognose_pct !== null ? `Anmeldungen ${schule.prognose_pct}%` : 'Anmeldungen –'
        } />
        <AmpelBadge status={schule.ampel.spg} info={AMPEL_INFO.spg} label={
          schule.spg_quote_pct !== null ? `SPG ${schule.spg_quote_pct}%` : 'SPG –'
        } />
      </div>
    </Link>
  )
}
