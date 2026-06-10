import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Layout from '../components/Layout'
import NotenSkala from '../components/NotenSkala'
import { notenFarbe } from '../lib/noten'

const SCHULJAHRE = ["2022/23", "2023/24", "2024/25"]

function schnittFarbe(s) {
  if (s == null) return 'text-slate-400'
  if (s <= 2.0) return 'text-green-600'
  if (s <= 2.9) return 'text-emerald-600'
  if (s <= 3.5) return 'text-yellow-600'
  if (s <= 4.5) return 'text-orange-600'
  return 'text-red-600'
}

function TrendIcon({ delta }) {
  if (delta == null) return <Minus size={14} className="text-slate-400" />
  if (delta > 0.1) return <TrendingUp size={14} className="text-green-500" />
  if (delta < -0.1) return <TrendingDown size={14} className="text-red-500" />
  return <Minus size={14} className="text-slate-400" />
}

export default function LehrerDetail() {
  const { id, lehrerId } = useParams()
  const [daten, setDaten] = useState(null)
  const [loading, setLoading] = useState(true)
  const [schuleName, setSchuleName] = useState('')
  const [ansicht, setAnsicht] = useState('uebersicht') // 'uebersicht' | 'klassen' | 'verlauf'
  const [aufgeklapptKlasse, setAufgeklapptKlasse] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/schulen/${id}/lehrer/${lehrerId}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/schulen/${id}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([l, s]) => {
      setDaten(l)
      setSchuleName(s.name ?? '')
      setLoading(false)
    })
  }, [id, lehrerId])

  if (loading) return (
    <Layout title="Lehrkraft" backTo={{ to: `/schule/${id}/klassen`, label: 'Zurück zur Klassenübersicht' }}>
      <main className="max-w-screen-xl mx-auto px-6 py-24 text-center text-slate-400">Wird geladen…</main>
    </Layout>
  )

  const { lehrer, klassen } = daten
  const alleSchueler = klassen.flatMap(kl =>
    kl.schueler.map(s => ({ ...s, klasse: kl.bezeichnung, klasse_id: kl.id }))
  )

  // Alle Fächer, die in irgendeinem Schuljahr vorkommen (nicht nur im ersten)
  const alleHistFaecher = [...new Set(SCHULJAHRE.flatMap(sj => Object.keys(lehrer.historisch?.[sj] ?? {})))]

  // Historische Chart-Daten: pro Schuljahr Ø über alle Fächer
  const historischChartData = SCHULJAHRE.map(sj => {
    const entry = { schuljahr: sj }
    const historisch = lehrer.historisch?.[sj] ?? {}
    Object.entries(historisch).forEach(([fach, wert]) => {
      entry[fach] = wert
    })
    // Gesamtschnitt
    const werte = Object.values(historisch)
    entry['Gesamt'] = werte.length > 0 ? Math.round(werte.reduce((a, b) => a + b, 0) / werte.length * 100) / 100 : null
    return entry
  })

  // Aktueller Gesamtschnitt über alle eigenen Klassen
  const aktuelleSchnitte = Object.values(lehrer.aktuell_schnitte ?? {})
  const gesamtSchnittAktuell = aktuelleSchnitte.length > 0
    ? Math.round(aktuelleSchnitte.reduce((a, b) => a + b, 0) / aktuelleSchnitte.length * 100) / 100
    : null

  const verbesserte = alleSchueler.filter(s => s.trend_delta > 0.1).length
  const verbesserungsrate = alleSchueler.length > 0
    ? Math.round(verbesserte / alleSchueler.length * 100)
    : 0

  const FACH_FARBEN = ['#006892', '#00303F', '#0085b8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#6366f1']

  return (
    <Layout
      title={`${lehrer.vorname} ${lehrer.nachname}`}
      subtitle={`${schuleName} · ${lehrer.faecher?.join(', ')} · ${lehrer.dienstjahre} Dienstjahre`}
      backTo={{ to: `/schule/${id}/klassen`, label: 'Zurück zur Klassenübersicht' }}
    >
      <main className="max-w-screen-xl mx-auto px-6 py-6">

        {/* Ansicht-Umschalter */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit mb-6" role="tablist">
          {[['uebersicht', 'Übersicht'], ['klassen', 'Klassen & Schüler'], ['verlauf', 'Historisch']].map(([key, label]) => (
            <button key={key} onClick={() => setAnsicht(key)}
              role="tab" aria-selected={ansicht === key}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                ansicht === key ? 'bg-[#006892] text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Übersicht ── */}
        {ansicht === 'uebersicht' && (
          <div className="space-y-6">

            {/* KPI-Kacheln */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Klassen gesamt', value: klassen.length, color: '#006892' },
                { label: 'Schüler gesamt', value: alleSchueler.length, color: '#00303F' },
                { label: 'Ø Notenschnitt', value: gesamtSchnittAktuell?.toFixed(2) ?? '–', color: notenFarbe(gesamtSchnittAktuell) },
                { label: 'Verbesserungsrate', value: `${verbesserungsrate}%`, color: verbesserungsrate >= 50 ? '#16a34a' : '#d97706' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-2xl font-bold tnum" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Aktuelle Fachschnitte */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Aktuelle Fachschnitte (SJ 2024/25)
              </h2>
              <div className="divide-y divide-slate-50">
                {Object.entries(lehrer.aktuell_schnitte ?? {}).sort((a, b) => a[1] - b[1]).map(([fach, schnitt]) => (
                  <NotenSkala key={fach} label={fach} schnitt={schnitt} />
                ))}
              </div>
            </div>

            {/* Zusatzinfos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Profil</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Kürzel', lehrer.kuerzel],
                    ['Lehrfächer', lehrer.faecher?.join(', ')],
                    ['Dienstjahre', `${lehrer.dienstjahre} Jahre`],
                    ['Fortbildungsstunden', `${lehrer.fortbildung_stunden} Std./Jahr`],
                    ['Unterrichtete Klassen', `${klassen.length} Klassen`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-medium text-slate-700">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Klassen im Überblick</h3>
                <div className="space-y-2">
                  {klassen.map(kl => (
                    <button key={kl.id} onClick={() => { setAnsicht('klassen'); setAufgeklapptKlasse(kl.id) }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group">
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-[#006892]">
                        Klasse {kl.bezeichnung}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{kl.anzahl_schueler} Schüler</span>
                        <span className={`text-sm font-bold ${schnittFarbe(Object.values(kl.fach_schnitte)[0])}`}>
                          Ø {Object.values(kl.fach_schnitte).length > 0
                            ? (Object.values(kl.fach_schnitte).reduce((a, b) => a + b, 0) / Object.values(kl.fach_schnitte).length).toFixed(2)
                            : '–'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Klassen & Schüler ── */}
        {ansicht === 'klassen' && (
          <div className="space-y-4">
            {klassen.map(kl => {
              const lehrerSchnitt = Object.values(kl.fach_schnitte).length > 0
                ? Object.values(kl.fach_schnitte).reduce((a, b) => a + b, 0) / Object.values(kl.fach_schnitte).length
                : null
              const aufgeklappt = aufgeklapptKlasse === kl.id
              return (
                <div key={kl.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <button className="w-full flex items-center justify-between px-5 py-4"
                    onClick={() => setAufgeklapptKlasse(aufgeklappt ? null : kl.id)}>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-slate-800">Klasse {kl.bezeichnung}</span>
                      <span className="text-sm text-slate-400">{kl.anzahl_schueler} Schüler</span>
                      {kl.schulklima_score && (
                        <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
                          Klima: {kl.schulklima_score}/5
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-lg font-bold ${schnittFarbe(lehrerSchnitt)}`}>
                          Ø {lehrerSchnitt?.toFixed(2) ?? '–'}
                        </div>
                        <div className="text-xs text-slate-400">meine Fächer</div>
                      </div>
                      {aufgeklappt ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {aufgeklappt && (
                    <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                      {/* Fächerbalken */}
                      <div className="mb-4">
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Meine Fächer in dieser Klasse</p>
                        {Object.entries(kl.fach_schnitte).map(([fach, schnitt]) => (
                          <NotenSkala key={fach} label={fach} schnitt={schnitt} />
                        ))}
                      </div>

                      {/* Schülertabelle */}
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Schüler</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left py-2 text-xs text-slate-400 font-semibold">Name</th>
                              {kl.unterrichtete_faecher.map(f => (
                                <th key={f} className="text-center py-2 text-xs text-slate-400 font-semibold px-2 whitespace-nowrap">{f}</th>
                              ))}
                              <th className="text-center py-2 text-xs text-slate-400 font-semibold px-2">Trend</th>
                              <th className="text-center py-2 text-xs text-slate-400 font-semibold px-2">Fehlt.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...kl.schueler].sort((a, b) => {
                              const avgA = Object.values(a.faecher).reduce((s, f) => s + (f.schnitt ?? 0), 0) / Math.max(1, Object.values(a.faecher).length)
                              const avgB = Object.values(b.faecher).reduce((s, f) => s + (f.schnitt ?? 0), 0) / Math.max(1, Object.values(b.faecher).length)
                              return avgA - avgB
                            }).map((s, i) => (
                              <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="py-2 font-medium text-slate-700">
                                  {s.vorname} {s.nachname}
                                  <span className="ml-1 text-xs text-slate-400">{s.geschlecht === 'w' ? '♀' : '♂'}</span>
                                </td>
                                {kl.unterrichtete_faecher.map(f => {
                                  const fd = s.faecher?.[f]
                                  return (
                                    <td key={f} className={`text-center px-2 font-bold text-sm ${schnittFarbe(fd?.schnitt)}`}>
                                      {fd?.schnitt?.toFixed(1) ?? '–'}
                                    </td>
                                  )
                                })}
                                <td className="text-center px-2">
                                  <div className="flex justify-center items-center gap-1">
                                    <TrendIcon delta={s.trend_delta} />
                                    <span className={`text-xs font-medium ${s.trend_delta > 0.1 ? 'text-green-600' : s.trend_delta < -0.1 ? 'text-red-600' : 'text-slate-400'}`}>
                                      {s.trend_delta > 0 ? '+' : ''}{s.trend_delta?.toFixed(1)}
                                    </span>
                                  </div>
                                </td>
                                <td className="text-center px-2 text-xs text-slate-500">
                                  {s.fehlzeiten?.gesamt ?? 0}
                                  {s.fehlzeiten?.unentschuldigt > 0 && (
                                    <span className="text-red-500 ml-1">({s.fehlzeiten.unentschuldigt}u)</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Historischer Verlauf ── */}
        {ansicht === 'verlauf' && (
          <div className="space-y-6">

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Entwicklung der Fachschnitte (letzte 3 Schuljahre)
              </h2>
              <p className="text-xs text-slate-400 mb-4">Y-Achse invertiert: oben = bessere Note</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historischChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="schuljahr" tick={{ fontSize: 12 }} />
                  <YAxis domain={[1, 5]} reversed tick={{ fontSize: 11 }}
                    label={{ value: '1=sehr gut', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => v?.toFixed(2)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {alleHistFaecher.map((fach, i) => (
                    <Line key={fach} type="monotone" dataKey={fach}
                      stroke={FACH_FARBEN[i % FACH_FARBEN.length]}
                      strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  ))}
                  <Line type="monotone" dataKey="Gesamt" name="Ø Gesamt"
                    stroke="#1e293b" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Historische Tabelle */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Detailübersicht nach Schuljahr
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 text-xs text-slate-400 font-semibold">Fach</th>
                      {SCHULJAHRE.map(sj => (
                        <th key={sj} className="text-center py-2 text-xs text-slate-400 font-semibold px-4">{sj}</th>
                      ))}
                      <th className="text-center py-2 text-xs text-slate-400 font-semibold px-4">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alleHistFaecher.map((fach, i) => {
                      const werte = SCHULJAHRE.map(sj => lehrer.historisch?.[sj]?.[fach] ?? null)
                      const erster = werte.find(v => v != null)
                      const letzter = [...werte].reverse().find(v => v != null)
                      const delta = erster != null && letzter != null ? letzter - erster : null
                      return (
                        <tr key={fach} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2.5 font-medium text-slate-700">{fach}</td>
                          {werte.map((w, j) => (
                            <td key={j} className={`text-center px-4 font-bold ${schnittFarbe(w)}`}>
                              {w?.toFixed(2) ?? '–'}
                            </td>
                          ))}
                          <td className="text-center px-4">
                            {delta != null ? (
                              <span className={`text-sm font-semibold flex items-center justify-center gap-1 ${delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {delta < -0.05 ? <TrendingUp size={13} /> : delta > 0.05 ? <TrendingDown size={13} /> : <Minus size={13} />}
                                {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                              </span>
                            ) : '–'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </Layout>
  )
}
