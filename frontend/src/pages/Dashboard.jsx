import { useState, useEffect } from 'react'
import { School, Users, AlertTriangle, CheckCircle } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import FilterBar from '../components/FilterBar'
import SchulCard from '../components/SchulCard'

const EMPTY_FILTERS = { stiftung: '', bundesland: '', schultyp: '', ampel: '', suche: '' }

function gesamtAmpel(ampel) {
  const vals = Object.values(ampel)
  if (vals.includes('red')) return 'red'
  if (vals.includes('yellow')) return 'yellow'
  if (vals.includes('green')) return 'green'
  return 'gray'
}

export default function Dashboard() {
  const [schulen, setSchulen] = useState([])
  const [uebersicht, setUebersicht] = useState(null)
  const [filterOptions, setFilterOptions] = useState({})
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/schulen').then(r => r.json()),
      fetch('/api/uebersicht').then(r => r.json()),
      fetch('/api/filter-options').then(r => r.json()),
      fetch('/api/meta').then(r => r.json()),
    ]).then(([s, u, fo, m]) => {
      setSchulen(s)
      setUebersicht(u)
      setFilterOptions(fo)
      setMeta(m)
      setLoading(false)
    })
  }, [])

  const filtered = schulen.filter(s => {
    if (filters.stiftung && s.stiftung !== filters.stiftung) return false
    if (filters.bundesland && s.bundesland !== filters.bundesland) return false
    if (filters.schultyp && !s.schultypen.includes(filters.schultyp)) return false
    if (filters.ampel && gesamtAmpel(s.ampel) !== filters.ampel) return false
    if (filters.suche && !s.name.toLowerCase().includes(filters.suche.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#f5f8fa' }}>
        <div className="text-center">
          <img src="/logo.svg" alt="EKMD Logo" className="h-12 mx-auto mb-6 opacity-60" />
          <div className="text-slate-400">Daten werden geladen…</div>
        </div>
      </div>
    )
  }

  const ampelV = uebersicht?.ampel_verteilung ?? {}

  return (
    <div className="min-h-screen" style={{ background: '#f5f8fa' }}>

      {/* Top-Banner */}
      <div style={{ background: '#00303F' }} className="py-2 px-6">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <span className="text-xs text-white/50">Evangelische Schulstiftung in Mitteldeutschland</span>
          {meta && (
            <span className="text-xs text-white/40">
              Datenstand: {new Date(meta.fetched_at).toLocaleDateString('de-DE')}
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <header style={{ background: '#006892' }} className="shadow-md sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-white rounded-lg px-3 py-2 shadow-sm">
              <img src="/logo.svg" alt="EKMD Logo" className="h-10 w-auto" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">Schulen-Dashboard</h1>
              <p className="text-xs text-white/60 mt-0.5">Kennzahlen & Ampelstatus aller Schulen</p>
            </div>
          </div>
          <div className="text-right text-xs text-white/50 hidden sm:block">
            <div>{uebersicht?.gesamt_schulen} Schulen</div>
            <div>{uebersicht?.gesamt_schueler?.toLocaleString('de-DE')} Schüler</div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">

        {/* KPI-Kacheln */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Schulen gesamt"
            value={uebersicht?.gesamt_schulen}
            sub={`${uebersicht?.esm?.anzahl} ESM · ${uebersicht?.kos?.anzahl} KOS`}
            icon={School}
            variant="dark"
          />
          <KpiCard
            label="Schüler gesamt"
            value={uebersicht?.gesamt_schueler?.toLocaleString('de-DE')}
            sub="alle ESM-Schulen"
            icon={Users}
            variant="primary"
          />
          <KpiCard
            label="Kritische Schulen"
            value={ampelV.red ?? 0}
            sub="mind. 1 rote Kennzahl"
            icon={AlertTriangle}
            variant="white"
          />
          <KpiCard
            label="Ohne Probleme"
            value={ampelV.green ?? 0}
            sub="alle Ampeln grün"
            icon={CheckCircle}
            variant="light"
          />
        </div>

        {/* Ampel-Legende */}
        <div className="flex flex-wrap gap-4 mb-5 items-center">
          {[
            { label: `${ampelV.red ?? 0} Kritisch`,    color: 'bg-red-500'    },
            { label: `${ampelV.yellow ?? 0} Mittel`,   color: 'bg-yellow-400' },
            { label: `${ampelV.green ?? 0} Gut`,       color: 'bg-green-500'  },
            { label: `${ampelV.gray ?? 0} Keine Daten`, color: 'bg-slate-300' },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className={`w-3 h-3 rounded-full ${color}`} />
              {label}
            </span>
          ))}
          <span className="text-sm text-slate-400 ml-1">
            · Gesamtstatus = schlechtester Einzelwert
          </span>
        </div>

        {/* Filterleiste */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
          <FilterBar filters={filters} options={filterOptions} onChange={setFilters} />
        </div>

        {/* Ergebniszeile */}
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            {filtered.length} Schulen
            {filtered.length !== schulen.length && ` (von ${schulen.length})`}
          </h2>
        </div>

        {/* Schul-Karten */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => <SchulCard key={s.id} schule={s} />)}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">Keine Schulen gefunden.</div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          Evangelische Schulstiftung in Mitteldeutschland · Schulen-Dashboard POC ·{' '}
          {meta && new Date(meta.fetched_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </footer>
      </main>
    </div>
  )
}
