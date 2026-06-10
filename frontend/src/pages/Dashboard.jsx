import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Users, AlertTriangle, CheckCircle, SearchX, RefreshCw } from 'lucide-react'
import Layout from '../components/Layout'
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

const LEGENDE = [
  { key: 'red',    label: 'Kritisch',    dot: 'bg-red-500',    aktivKlasse: 'bg-red-50 border-red-300 text-red-700' },
  { key: 'yellow', label: 'Mittel',      dot: 'bg-yellow-400', aktivKlasse: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
  { key: 'green',  label: 'Gut',         dot: 'bg-green-500',  aktivKlasse: 'bg-green-50 border-green-300 text-green-700' },
  { key: 'gray',   label: 'Keine Daten', dot: 'bg-slate-300',  aktivKlasse: 'bg-slate-100 border-slate-300 text-slate-600' },
]

function SkeletonDashboard() {
  return (
    <main className="max-w-screen-xl mx-auto px-6 py-6 animate-pulse" aria-busy="true" aria-label="Daten werden geladen">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-slate-200/70" />)}
      </div>
      <div className="h-14 rounded-2xl bg-slate-200/70 mb-6" />
      <div className="h-16 rounded-xl bg-slate-200/70 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-56 rounded-xl bg-slate-200/70" />)}
      </div>
    </main>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [schulen, setSchulen] = useState([])
  const [uebersicht, setUebersicht] = useState(null)
  const [filterOptions, setFilterOptions] = useState({})
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [fehler, setFehler] = useState(false)
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

  const datenAbrufen = useCallback(() => {
    Promise.all([
      fetch('/api/schulen', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch('/api/uebersicht', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch('/api/filter-options', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch('/api/meta', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
    ]).then(([s, u, fo, m]) => {
      setSchulen(s)
      setUebersicht(u)
      setFilterOptions(fo)
      setMeta(m)
      setLoading(false)
    }).catch(() => {
      setFehler(true)
      setLoading(false)
    })
  }, [])

  useEffect(() => { datenAbrufen() }, [datenAbrufen])

  function erneutVersuchen() {
    setLoading(true)
    setFehler(false)
    datenAbrufen()
  }

  const filtered = schulen
    .filter(s => {
      if (filters.stiftung && s.stiftung !== filters.stiftung) return false
      if (filters.bundesland && s.bundesland !== filters.bundesland) return false
      if (filters.schultyp && !s.schultypen.includes(filters.schultyp)) return false
      if (filters.ampel && gesamtAmpel(s.ampel) !== filters.ampel) return false
      if (filters.suche) {
        const q = filters.suche.toLowerCase()
        if (!s.name.toLowerCase().includes(q) && !(s.ort ?? '').toLowerCase().includes(q)) return false
      }
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

  const ampelV = uebersicht?.ampel_verteilung ?? {}
  const headerBanner = meta ? `Datenstand: ${new Date(meta.fetched_at).toLocaleDateString('de-DE')}` : null

  return (
    <Layout
      title="Schulen-Dashboard"
      subtitle="Kennzahlen & Ampelstatus aller Schulen"
      banner={headerBanner}
    >
      {fehler ? (
        <main className="max-w-screen-xl mx-auto px-6 py-24 text-center">
          <AlertTriangle size={40} className="mx-auto text-amber-400 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-1">Daten konnten nicht geladen werden</h2>
          <p className="text-sm text-slate-400 mb-6">Bitte prüfen Sie, ob das Backend läuft, und versuchen Sie es erneut.</p>
          <button
            onClick={erneutVersuchen}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white rounded-lg px-4 py-2.5 bg-[#006892] hover:bg-[#00547a] transition-colors"
          >
            <RefreshCw size={15} /> Erneut versuchen
          </button>
        </main>
      ) : loading ? (
        <SkeletonDashboard />
      ) : (
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
                        <div className="text-xl font-bold text-slate-800 tnum">{anzahl.toLocaleString('de-DE')}</div>
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
                      <div className="text-xl font-bold text-slate-800 tnum">{(val ?? 0).toLocaleString('de-DE')}</div>
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

        {/* Filterleiste mit klickbarer Ampel-Legende */}
        <div ref={schulenRef} className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {LEGENDE.map(({ key, label, dot, aktivKlasse }) => {
              const aktiv = filters.ampel === key
              return (
                <button
                  key={key}
                  onClick={() => setFilters(f => ({ ...f, ampel: aktiv ? '' : key }))}
                  aria-pressed={aktiv}
                  title={aktiv ? 'Filter entfernen' : `Nur Schulen mit Status „${label}“ anzeigen`}
                  className={`flex items-center gap-1.5 text-sm rounded-full border px-3 py-1 transition-colors ${
                    aktiv ? aktivKlasse : 'border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${dot}`} />
                  {ampelV[key] ?? 0} {label}
                </button>
              )
            })}
            <span className="text-xs text-slate-400 ml-1" title="Die schlechteste Einzelkennzahl bestimmt den Gesamtstatus einer Schule.">
              Gesamtstatus = schlechtester Einzelwert · Klick filtert
            </span>
          </div>
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
              { key: 'daten',      label: 'Name' },
              { key: 'schueler',   label: 'Schülerzahl' },
              { key: 'auslastung', label: 'Auslastung' },
              { key: 'prognose',   label: 'Anmeldungen' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortierung(key)}
                aria-pressed={sortierung === key}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  sortierung === key
                    ? 'text-white bg-[#006892]'
                    : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300'
                }`}
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
          <div className="text-center py-16">
            <SearchX size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium mb-1">Keine Schulen gefunden</p>
            <p className="text-sm text-slate-400 mb-4">Die aktuelle Filter-Kombination liefert kein Ergebnis.</p>
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-sm font-semibold text-[#006892] hover:text-[#00303F] underline underline-offset-2"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          Evangelische Schulstiftung in Mitteldeutschland · Schulen-Dashboard POC ·{' '}
          {meta && new Date(meta.fetched_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </footer>
      </main>
      )}
    </Layout>
  )
}
