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
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-slate-400 text-lg">Daten werden geladen…</div>
      </div>
    )
  }

  const ampelV = uebersicht?.ampel_verteilung ?? {}

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Schulen-Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">Evangelische Schulstiftung Mitteldeutschland</p>
          </div>
          {meta && (
            <div className="text-xs text-slate-400 text-right">
              <div>Datenstand: {new Date(meta.fetched_at).toLocaleDateString('de-DE')}</div>
              <div>{meta.anzahl_schulen} Schulen · {meta.anzahl_datensaetze} Datensätze</div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">

        {/* KPI-Übersicht */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Schulen gesamt"
            value={uebersicht?.gesamt_schulen}
            sub={`${uebersicht?.esm?.anzahl} ESM · ${uebersicht?.kos?.anzahl} KOS`}
            icon={School}
            color="blue"
          />
          <KpiCard
            label="Schüler gesamt"
            value={uebersicht?.gesamt_schueler?.toLocaleString('de-DE')}
            sub="alle ESM-Schulen"
            icon={Users}
            color="violet"
          />
          <KpiCard
            label="Kritische Schulen"
            value={ampelV.red ?? 0}
            sub="mind. 1 rote Kennzahl"
            icon={AlertTriangle}
            color="amber"
          />
          <KpiCard
            label="Schulen ohne Probleme"
            value={ampelV.green ?? 0}
            sub="alle Ampeln grün"
            icon={CheckCircle}
            color="green"
          />
        </div>

        {/* Ampel-Legende */}
        <div className="flex gap-4 mb-5 flex-wrap">
          {[
            { label: `${ampelV.red ?? 0} Kritisch`, color: 'bg-red-500' },
            { label: `${ampelV.yellow ?? 0} Mittel`, color: 'bg-yellow-400' },
            { label: `${ampelV.green ?? 0} Gut`, color: 'bg-green-500' },
            { label: `${ampelV.gray ?? 0} Keine Daten`, color: 'bg-slate-300' },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className={`w-3 h-3 rounded-full ${color}`} />
              {label}
            </span>
          ))}
          <span className="text-sm text-slate-400 ml-2">
            Gesamtstatus je Schule = schlechtester Einzelwert
          </span>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
          <FilterBar filters={filters} options={filterOptions} onChange={setFilters} />
        </div>

        {/* Schul-Karten */}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            {filtered.length} Schulen
            {filtered.length !== schulen.length && ` (von ${schulen.length})`}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => (
            <SchulCard key={s.id} schule={s} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            Keine Schulen gefunden.
          </div>
        )}
      </main>
    </div>
  )
}
