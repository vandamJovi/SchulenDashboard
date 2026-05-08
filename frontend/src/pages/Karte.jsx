import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { ArrowLeft, MapPin } from 'lucide-react'
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

  useEffect(() => {
    fetch('/api/schulen')
      .then(r => r.json())
      .then(d => { setSchulen(d); setLoading(false) })
  }, [])

  const mitKoords = schulen.filter(s => s.latitude && s.longitude)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f8fa' }}>
      {/* Top-Banner */}
      <div style={{ background: '#00303F' }} className="py-2 px-6 shrink-0">
        <div className="max-w-screen-xl mx-auto">
          <span className="text-xs text-white/50">Evangelische Schulstiftung in Mitteldeutschland</span>
        </div>
      </div>

      {/* Header */}
      <header style={{ background: '#006892' }} className="shadow-md shrink-0">
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft size={16} /> Zurück zum Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg px-2 py-1.5 shadow-sm">
              <img src="/logo.svg" alt="EKMD Logo" className="h-8 w-auto" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Schulstandorte</h1>
              <p className="text-xs text-white/60 mt-0.5">
                {mitKoords.length} von {schulen.length} Schulen mit Koordinaten
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Legende */}
      <div className="shrink-0 px-6 py-3 bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto flex flex-wrap gap-5 items-center">
          {Object.entries(AMPEL_FARBEN).map(([key, { fill, label }]) => (
            <span key={key} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: fill }} />
              {label}
            </span>
          ))}
          <span className="text-xs text-slate-400 ml-2">· Klick auf Marker öffnet Schuldetails</span>
        </div>
      </div>

      {/* Karte */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Wird geladen…</div>
          </div>
        ) : (
          <MapContainer
            center={[51.3, 12.0]}
            zoom={7}
            style={{ height: '100%', width: '100%', minHeight: '600px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mitKoords.map(s => {
              const status = gesamtAmpel(s.ampel)
              const { fill } = AMPEL_FARBEN[status]
              return (
                <CircleMarker
                  key={s.id}
                  center={[parseFloat(s.latitude), parseFloat(s.longitude)]}
                  radius={10}
                  pathOptions={{ fillColor: fill, color: '#fff', weight: 2, fillOpacity: 0.9 }}
                >
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
                        className="mt-2 text-xs font-semibold px-3 py-1 rounded-lg text-white w-full"
                        style={{ background: '#006892' }}
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
  )
}
