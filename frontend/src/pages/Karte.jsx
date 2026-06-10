import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import { MapPin } from 'lucide-react'
import Layout from '../components/Layout'
import 'leaflet/dist/leaflet.css'

function gesamtAmpel(ampel) {
  const vals = Object.values(ampel)
  if (vals.includes('red')) return 'red'
  if (vals.includes('yellow')) return 'yellow'
  if (vals.includes('green')) return 'green'
  return 'gray'
}

const AMPEL_FARBEN = {
  red:    { fill: '#ef4444', label: 'Kritisch' },
  yellow: { fill: '#f59e0b', label: 'Mittel' },
  green:  { fill: '#22c55e', label: 'Gut' },
  gray:   { fill: '#94a3b8', label: 'Keine Daten' },
}

export default function Karte() {
  const navigate = useNavigate()
  const [schulen, setSchulen] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetch('/api/schulen', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setSchulen(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const mitKoords = schulen.filter(s => s.latitude && s.longitude)
  const sichtbar = statusFilter
    ? mitKoords.filter(s => gesamtAmpel(s.ampel) === statusFilter)
    : mitKoords

  const anzahlJeStatus = mitKoords.reduce((acc, s) => {
    const st = gesamtAmpel(s.ampel)
    acc[st] = (acc[st] ?? 0) + 1
    return acc
  }, {})

  return (
    <Layout
      title="Schulstandorte"
      subtitle={`${mitKoords.length} von ${schulen.length} Schulen mit Koordinaten`}
    >
      <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 110px)' }}>

        {/* Legende = Filter */}
        <div className="shrink-0 px-6 py-3 bg-white border-b border-slate-200">
          <div className="max-w-screen-xl mx-auto flex flex-wrap gap-2 items-center">
            {Object.entries(AMPEL_FARBEN).map(([key, { fill, label }]) => {
              const aktiv = statusFilter === key
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(aktiv ? '' : key)}
                  aria-pressed={aktiv}
                  title={aktiv ? 'Filter entfernen' : `Nur Schulen mit Status „${label}“ anzeigen`}
                  className={`flex items-center gap-2 text-sm rounded-full border px-3 py-1 transition-colors ${
                    aktiv
                      ? 'border-slate-300 bg-slate-100 text-slate-800 font-semibold'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: fill }} />
                  {anzahlJeStatus[key] ?? 0} {label}
                </button>
              )
            })}
            <span className="text-xs text-slate-400 ml-2">· Klick auf Legende filtert · Klick auf Marker öffnet Schuldetails</span>
          </div>
        </div>

        {/* Karte */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full py-24">
              <div className="text-slate-400">Wird geladen…</div>
            </div>
          ) : (
            <MapContainer
              center={[51.3, 12.0]}
              zoom={7}
              style={{ position: 'absolute', inset: 0, minHeight: '500px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {sichtbar.map(s => {
                const status = gesamtAmpel(s.ampel)
                const { fill } = AMPEL_FARBEN[status]
                return (
                  <CircleMarker
                    key={s.id}
                    center={[parseFloat(s.latitude), parseFloat(s.longitude)]}
                    radius={10}
                    pathOptions={{ fillColor: fill, color: '#fff', weight: 2, fillOpacity: 0.9 }}
                  >
                    <Tooltip direction="top" offset={[0, -8]}>
                      <span className="font-semibold">{s.name}</span>
                      {s.gesamt_schueler ? ` · ${s.gesamt_schueler} Schüler` : ''}
                    </Tooltip>
                    <Popup maxWidth={260}>
                      <div className="text-sm">
                        <div className="font-bold text-slate-800 mb-1">{s.name}</div>
                        <div className="text-slate-500 text-xs mb-2">
                          <MapPin size={11} className="inline mr-1" />
                          {s.ort} · {s.bundesland}
                        </div>
                        {s.gesamt_schueler && (
                          <div className="text-xs text-slate-600 mb-1">
                            {s.gesamt_schueler} Schüler · {s.stiftung}
                          </div>
                        )}
                        <button
                          onClick={() => navigate(`/schule/${s.id}`)}
                          className="mt-2 text-xs font-semibold px-3 py-1 rounded-lg text-white w-full bg-[#006892]"
                        >
                          Zur Schulseite →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          )}
        </div>
      </div>
    </Layout>
  )
}
