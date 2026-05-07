import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { ArrowLeft, MapPin, Phone, Mail, Globe, Users, Building2 } from 'lucide-react'
import { AmpelRow } from '../components/Ampel'

function InfoItem({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <div>
        <span className="text-slate-400 text-xs">{label}: </span>
        <span className="text-slate-700">{value}</span>
      </div>
    </div>
  )
}

export default function SchuleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [schule, setSchule] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/schulen/${id}`)
      .then(r => r.json())
      .then(d => { setSchule(d); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#f5f8fa' }}>
        <div className="text-center">
          <img src="/logo.svg" alt="EKMD Logo" className="h-12 mx-auto mb-6 opacity-60" />
          <div className="text-slate-400">Wird geladen…</div>
        </div>
      </div>
    )
  }

  const history = schule.schuelerzahlen_history ?? []
  const latest = history[history.length - 1]

  const ampelLabels = {
    yoy:       'Schülerzahl-Entwicklung (YoY)',
    auslastung: 'Kapazitätsauslastung',
    prognose:  'Prognose Folgejahr',
    spg:       'Förderbedarfsquote (SPG)',
  }
  const ampelValues = {
    yoy:       schule.yoy_change_pct !== null ? `${schule.yoy_change_pct > 0 ? '+' : ''}${schule.yoy_change_pct}%` : null,
    auslastung: schule.auslastung_pct !== null ? `${schule.auslastung_pct}%` : null,
    prognose:  schule.prognose_pct !== null ? `${schule.prognose_pct}%` : null,
    spg:       schule.spg_quote_pct !== null ? `${schule.spg_quote_pct}%` : null,
  }

  const hasJahrgaenge = latest?.jahrgaenge && Object.keys(latest.jahrgaenge).length > 0
  const jahrgangData = hasJahrgaenge
    ? Object.entries(latest.jahrgaenge)
        .map(([k, v]) => ({ name: `Jg. ${k.replace('j', '')}`, schueler: v }))
        .sort((a, b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]))
    : []

  return (
    <div className="min-h-screen" style={{ background: '#f5f8fa' }}>
      {/* Top-Banner */}
      <div style={{ background: '#00303F' }} className="py-2 px-6">
        <div className="max-w-screen-xl mx-auto">
          <span className="text-xs text-white/50">Evangelische Schulstiftung in Mitteldeutschland</span>
        </div>
      </div>

      {/* Header */}
      <header style={{ background: '#006892' }} className="shadow-md sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft size={16} /> Zurück zum Dashboard
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-white rounded-lg px-2 py-1.5 shadow-sm shrink-0">
                <img src="/logo.svg" alt="EKMD Logo" className="h-8 w-auto" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">{schule.name}</h1>
                <div className="flex items-center gap-1 text-sm text-white/60 mt-0.5">
                  <MapPin size={13} />
                  <span>{schule.details?.strasse}, {schule.plz} {schule.ort} · {schule.bundesland}</span>
                </div>
              </div>
            </div>
            <span className="text-sm font-bold bg-white/20 text-white rounded-lg px-3 py-1 shrink-0">
              {schule.stiftung}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Linke Spalte: Stammdaten + Ampel */}
          <div className="space-y-4">

            {/* Schultypen */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Schultypen</h2>
              <div className="flex flex-wrap gap-2">
                {schule.schultypen.map(t => (
                  <span key={t} className="text-sm bg-blue-50 text-blue-600 rounded-lg px-3 py-1">{t}</span>
                ))}
              </div>
            </div>

            {/* Ampel-Status */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Ampelstatus</h2>
              {Object.entries(schule.ampel).map(([key, status]) => (
                <AmpelRow
                  key={key}
                  label={ampelLabels[key]}
                  status={status}
                  value={ampelValues[key]}
                />
              ))}
            </div>

            {/* Stammdaten */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Stammdaten</h2>
              <InfoItem icon={Users} label="Leitung" value={schule.leiter} />
              <InfoItem icon={Phone} label="Telefon" value={schule.details?.telefon} />
              <InfoItem icon={Mail} label="E-Mail" value={schule.details?.email} />
              <InfoItem icon={Globe} label="Homepage" value={schule.details?.homepage} />
              {schule.gruendungsjahr && (
                <InfoItem icon={Building2} label="Gegründet" value={schule.gruendungsjahr} />
              )}
            </div>

            {/* Gebäude & Personal */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Gebäude & Personal</h2>
              <div className="space-y-2 text-sm">
                {[
                  ['Klassenräume', schule.details?.anzahl_klassenraeume],
                  ['Differenzierungsräume', schule.details?.anzahl_diff_raeume],
                  ['Horträume', schule.details?.anzahl_hort_raeume],
                  ['Lerngruppen', schule.details?.lerngruppenzahl],
                  ['Mitarbeiter', schule.details?.anzahl_personen],
                  ['VBE (Vollzeitäquivalente)', schule.details?.anzahl_vbe],
                  ['Fortbildungstage', schule.details?.fortbildung_tage],
                ].filter(([, v]) => v !== null && v !== undefined).map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-700">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rechte Spalte: Charts */}
          <div className="lg:col-span-2 space-y-4">

            {/* Schülerzahlentwicklung */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Schülerzahlen-Entwicklung
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="schuljahr" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="gesamt" name="Gesamt" stroke="#006892" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="maennlich" name="Männlich" stroke="#00303F" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="weiblich" name="Weiblich" stroke="#0085b8" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* SPG-Entwicklung */}
            {history.some(h => h.spg_gesamt > 0) && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Förderbedarf (SPG) Entwicklung
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="schuljahr" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="spg_lernen" name="Lernen" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="spg_emotional" name="Emotional/Sozial" stackId="a" fill="#ef4444" />
                    <Bar dataKey="spg_sprachlich" name="Sprache" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="spg_geistig" name="Geistig" stackId="a" fill="#06b6d4" />
                    <Bar dataKey="spg_koerperlich" name="Körperlich" stackId="a" fill="#10b981" />
                    <Bar dataKey="spg_begabt" name="Begabt" stackId="a" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Jahrgangsverteilung (aktuell) */}
            {jahrgangData.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Jahrgangsverteilung (SJ {schule.aktuelles_schuljahr})
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={jahrgangData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="schueler" name="Schüler" fill="#006892" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Aktuelle Kennzahlen-Übersicht */}
            {latest && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Kennzahlen SJ {schule.aktuelles_schuljahr}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    ['Schüler gesamt', schule.gesamt_schueler?.toLocaleString('de-DE')],
                    ['Prognose Folgejahr', schule.prognose_folgejahr?.toLocaleString('de-DE')],
                    ['SPG gesamt', schule.spg_gesamt],
                    ['SPG-Quote', schule.spg_quote_pct !== null ? `${schule.spg_quote_pct}%` : null],
                    ['Auslastung', schule.auslastung_pct !== null ? `${schule.auslastung_pct}%` : null],
                    ['Entwicklung (YoY)', schule.yoy_change_pct !== null ? `${schule.yoy_change_pct > 0 ? '+' : ''}${schule.yoy_change_pct}%` : null],
                  ].filter(([, v]) => v !== null && v !== undefined).map(([label, val]) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">{label}</div>
                      <div className="text-xl font-bold text-slate-800">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
