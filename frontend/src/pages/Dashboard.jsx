import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Users, AlertTriangle, CheckCircle, Map } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import FilterBar from '../components/FilterBar'
import SchulCard from '../components/SchulCard'
import ChatWidget from '../components/ChatWidget'

const EMPTY_FILTERS = { stiftung: '', bundesland: '', schultyp: '', ampel: '', suche: '' }

function gesamtAmpel(ampel) {
  const vals = Object.values(ampel)
  if (vals.includes('red')) return 'red'
  if (vals.includes('yellow')) return 'yellow'
  if (vals.includes('green')) return 'green'
  return 'gray'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [schulen, setSchulen] = useState([])
  const [uebersicht, setUebersicht] = useState(null)
  const [filterOptions, setFilterOptions] = useState({})
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [sortierung, setSortierung] = useState('daten')
  const [aktivesPanel, setAktivesPanel] = useState(null)
  const schulenRef = useRef(null)
  const panelRef = useRef(null)

  function togglePanel(name) {
    setAktivesPanel(p => {
      const next = p === name ? null : name
      if (next) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
      return next
    })
  }

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

  const filtered = schulen
    .filter(s => {
      if (filters.stiftung && s.stiftung !== filters.stiftung) return false
      if (filters.bundesland && s.bundesland !== filters.bundesland) return false
      if (filters.schultyp && !s.schultypen.includes(filters.schultyp)) return false
      if (filters.ampel && gesamtAmpel(s.ampel) !== filters.ampel) return false
      if (filters.suche && !s.name.toLowerCase().includes(filters.suche.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const nullLast = (val) => val ?? -Infinity
      switch (sortierung) {
        case 'schueler':   return nullLast(b.gesamt_schueler) - nullLast(a.gesamt_schueler)
        case 'auslastung': return nullLast(b.auslastung_pct)  - nullLast(a.auslastung_pct)
        case 'prognose':   return nullLast(b.prognose_pct)    - nullLast(a.prognose_pct)
        default: // 'daten': Schulen mit Daten zuerst, dann alphabetisch
          if ((a.gesamt_schueler == null) !== (b.gesamt_schueler == null))
            return a.gesamt_schueler == null ? 1 : -1
          return a.name.localeCompare(b.name, 'de')
      }
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/karte')}
              className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors"
            >
              <Map size={16} /> Karte
            </button>
            <div className="text-right text-xs text-white/50 hidden sm:block">
              <div>{uebersicht?.gesamt_schulen} Schulen</div>
              <div>{uebersicht?.gesamt_schueler?.toLocaleString('de-DE')} Schüler</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">

        {/* KPI-Kacheln */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KpiCard
            label="Schulen gesamt"
            value={uebersicht?.gesamt_schulen}
            sub={`${uebersicht?.esm?.anzahl} ESM · ${uebersicht?.kos?.anzahl} KOS`}
            icon={School}
            variant="dark"
            onClick={() => schulenRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />
          <KpiCard
            label="Schüler gesamt"
            value={uebersicht?.gesamt_schueler?.toLocaleString('de-DE')}
            sub="alle ESM-Schulen"
            icon={Users}
            variant="primary"
            onClick={() => togglePanel('schueler')}
            aktiv={aktivesPanel === 'schueler'}
          />
          <KpiCard
            label="Kritische Schulen"
            value={ampelV.red ?? 0}
            sub="mind. 1 rote Kennzahl"
            icon={AlertTriangle}
            variant="white"
            onClick={() => togglePanel('kritisch')}
            aktiv={aktivesPanel === 'kritisch'}
          />
          <KpiCard
            label="Ohne Probleme"
            value={ampelV.green ?? 0}
            sub="alle Ampeln grün"
            icon={CheckCircle}
            variant="light"
            onClick={() => togglePanel('gruen')}
            aktiv={aktivesPanel === 'gruen'}
          />
        </div>

        {/* Detail-Panel unter den Kacheln */}
        {aktivesPanel && (
          <div ref={panelRef} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
            {aktivesPanel === 'schueler' && (
              <>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Schüler nach Jahrgang (alle Schulen)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                  {Object.entries(uebersicht?.jahrgaenge_gesamt ?? {})
                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                    .map(([jg, anzahl]) => (
                      <div key={jg} className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-slate-400 mb-1">Jahrgang {jg}</div>
                        <div className="text-xl font-bold text-slate-800">{anzahl.toLocaleString('de-DE')}</div>
                      </div>
                    ))}
                </div>

                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Förderbedarf (SPG) gesamt</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    ['Lernen',     uebersicht?.spg_gesamt?.lernen],
                    ['Emotional',  uebersicht?.spg_gesamt?.emotional],
                    ['Sprache',    uebersicht?.spg_gesamt?.sprachlich],
                    ['Geistig',    uebersicht?.spg_gesamt?.geistig],
                    ['Körperlich', uebersicht?.spg_gesamt?.koerperlich],
                    ['Begabt',     uebersicht?.spg_gesamt?.begabt],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-amber-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-amber-600 mb-1">{label}</div>
                      <div className="text-xl font-bold text-slate-800">{(val ?? 0).toLocaleString('de-DE')}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {aktivesPanel === 'kritisch' && (
              <>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Schulen mit kritischem Status</h3>
                <div className="space-y-1">
                  {(uebersicht?.rote_schulen ?? []).map(s => (
                    <button key={s.id} onClick={() => navigate(`/schule/${s.id}`)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50 text-left group transition-colors">
                      <span className="text-sm font-medium text-slate-700 group-hover:text-red-700">{s.name}</span>
                      <span className="text-xs text-slate-400">{s.ort} →</span>
                    </button>
                  ))}
                  {(uebersicht?.rote_schulen ?? []).length === 0 && <p className="text-sm text-slate-400">Keine kritischen Schulen.</p>}
                </div>
              </>
            )}
            {aktivesPanel === 'gruen' && (
              <>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Schulen ohne Probleme</h3>
                <div className="space-y-1">
                  {(uebersicht?.gruene_schulen ?? []).map(s => (
                    <button key={s.id} onClick={() => navigate(`/schule/${s.id}`)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-green-50 text-left group transition-colors">
                      <span className="text-sm font-medium text-slate-700 group-hover:text-green-700">{s.name}</span>
                      <span className="text-xs text-slate-400">{s.ort} →</span>
                    </button>
                  ))}
                  {(uebersicht?.gruene_schulen ?? []).length === 0 && <p className="text-sm text-slate-400">Keine Schulen ohne Probleme.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* KI-Assistent */}
        <div className="mb-6">
          <ChatWidget />
        </div>

        {/* Ampel-Legende */}
        <div ref={schulenRef} className="flex flex-wrap gap-4 mb-5 items-center">
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

        {/* Ergebniszeile + Sortierung */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            {filtered.length} Schulen
            {filtered.length !== schulen.length && ` (von ${schulen.length})`}
          </h2>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-slate-400 mr-1">Sortierung:</span>
            {[
              { key: 'schueler',   label: 'Schülerzahl' },
              { key: 'auslastung', label: 'Auslastung' },
              { key: 'prognose',   label: 'Anmeldeerfüllung' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortierung(s => s === key ? 'daten' : key)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  sortierung === key
                    ? 'text-white'
                    : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300'
                }`}
                style={sortierung === key ? { background: '#006892' } : {}}
              >
                {label}
              </button>
            ))}
          </div>
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
