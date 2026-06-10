import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import Layout from '../components/Layout'
import NotenSkala, { NotenSkalaKompakt } from '../components/NotenSkala'

function schnittFarbe(s) {
  if (s == null) return 'text-slate-400'
  if (s <= 2.0) return 'text-green-600'
  if (s <= 2.9) return 'text-emerald-600'
  if (s <= 3.5) return 'text-yellow-600'
  if (s <= 4.5) return 'text-orange-600'
  return 'text-red-600'
}
function schnittBg(s) {
  if (s == null) return 'bg-slate-50 border-slate-200'
  if (s <= 2.0) return 'bg-green-50 border-green-100'
  if (s <= 2.9) return 'bg-emerald-50 border-emerald-100'
  if (s <= 3.5) return 'bg-yellow-50 border-yellow-100'
  if (s <= 4.5) return 'bg-orange-50 border-orange-100'
  return 'bg-red-50 border-red-100'
}

function Notenschluessel() {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
      <Info size={12} className="shrink-0 text-slate-400" />
      <span>Notenskala: </span>
      {[['1', 'text-green-600'], ['2', 'text-emerald-600'], ['3', 'text-yellow-600'], ['4', 'text-orange-600'], ['5–6', 'text-red-600']].map(([n, c]) => (
        <span key={n} className={`font-bold ${c}`}>{n}</span>
      ))}
      <span className="text-slate-400 ml-1">— 1 = sehr gut, 6 = ungenügend</span>
    </div>
  )
}

const NOTE_ART_LABEL = { K: 'Klassenarbeit', T: 'Test', M: 'Mündlich' }

export default function KlassenDetail() {
  const { id, klasseId } = useParams()
  const navigate = useNavigate()
  const [daten, setDaten] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ansicht, setAnsicht] = useState('schueler')
  const [aufgeklappt, setAufgeklappt] = useState(null)
  const [schuleName, setSchuleName] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/schulen/${id}/klassen/${klasseId}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/schulen/${id}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([k, s]) => {
      setDaten(k)
      setSchuleName(s.name ?? '')
      setLoading(false)
    })
  }, [id, klasseId])

  if (loading) return (
    <Layout title="Klasse" backTo={{ to: `/schule/${id}/klassen`, label: 'Zurück zur Klassenübersicht' }}>
      <main className="max-w-screen-xl mx-auto px-6 py-24 text-center text-slate-400">Wird geladen…</main>
    </Layout>
  )

  const { bezeichnung, klassen_schnitt, anzahl_schueler, klassenlehrer,
          fach_schnitte, lehrer, faecher, schueler } = daten

  const lehrer_by_id = Object.fromEntries(lehrer.map(l => [l.id, l]))

  const lehrerInKlasse = {}
  faecher.forEach(fach => {
    const fs = fach_schnitte?.[fach]
    if (!fs) return
    const lid = fs.lehrer_id
    if (!lehrerInKlasse[lid]) lehrerInKlasse[lid] = { lehrer: lehrer_by_id[lid], faecher: [] }
    lehrerInKlasse[lid].faecher.push({ fach, schnitt: fs.klassen_schnitt })
  })

  const sortiertSchueler = [...schueler].sort((a, b) => a.gesamt_schnitt - b.gesamt_schnitt)

  return (
    <Layout
      title={`Klasse ${bezeichnung}`}
      subtitle={`${schuleName} · ${anzahl_schueler} Schüler · KL: ${klassenlehrer} · Gesamtschnitt: ${klassen_schnitt?.toFixed(2)}`}
      backTo={{ to: `/schule/${id}/klassen`, label: 'Zurück zur Klassenübersicht' }}
    >
      <main className="max-w-screen-xl mx-auto px-6 py-6">

        {/* Ansicht-Umschalter + Notenschlüssel */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm" role="tablist">
            {[['schueler', 'Schüler'], ['faecher', 'Fächer'], ['lehrer', 'Lehrer']].map(([key, label]) => (
              <button key={key} onClick={() => setAnsicht(key)}
                role="tab" aria-selected={ansicht === key}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  ansicht === key ? 'bg-[#006892] text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <Notenschluessel />
        </div>

        {/* ── Schüler-Ansicht ── */}
        {ansicht === 'schueler' && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              {sortiertSchueler.length} Schüler — sortiert nach Gesamtschnitt
            </h2>
            {sortiertSchueler.map((s, rang) => (
              <div key={s.id} className={`rounded-xl border ${schnittBg(s.gesamt_schnitt)} shadow-sm`}>
                <button className="w-full flex items-center justify-between px-4 py-3"
                  onClick={() => setAufgeklappt(aufgeklappt === s.id ? null : s.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-6 text-right font-mono">{rang + 1}.</span>
                    <span className="font-semibold text-slate-800">{s.vorname} {s.nachname}</span>
                    <span className="text-xs text-slate-400">{s.geschlecht === 'w' ? '♀' : '♂'}</span>
                    {s.fehlzeiten?.unentschuldigt > 2 && (
                      <span className="text-xs bg-red-50 text-red-600 rounded px-1.5 py-0.5">
                        {s.fehlzeiten.unentschuldigt}× unentsch.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block w-40">
                      <NotenSkalaKompakt schnitt={s.gesamt_schnitt} />
                    </div>
                    <span className={`text-base font-bold w-10 text-right ${schnittFarbe(s.gesamt_schnitt)}`}>
                      {s.gesamt_schnitt?.toFixed(2)}
                    </span>
                    {aufgeklappt === s.id
                      ? <ChevronUp size={16} className="text-slate-400" />
                      : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </button>

                {aufgeklappt === s.id && (
                  <div className="px-4 pb-4 border-t border-slate-100 mt-1 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                      {faecher.map(fach => {
                        const fd = s.faecher?.[fach]
                        if (!fd) return null
                        return (
                          <div key={fach} className="py-1.5 border-b border-slate-100 last:border-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-slate-600">{fach}</span>
                              <span className={`text-sm font-bold ${schnittFarbe(fd.schnitt)}`}>
                                Ø {fd.schnitt?.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 text-xs text-slate-500">
                              {fd.noten?.map((n, i) => (
                                <span key={i} title={NOTE_ART_LABEL[n.art[0]] ?? n.art}
                                  className={`px-2 py-0.5 rounded border font-medium ${schnittBg(n.wert)}`}>
                                  {n.art}: {n.wert.toFixed(1)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Fächer-Ansicht ── */}
        {ansicht === 'faecher' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Klassenschnitt pro Fach
            </h2>
            <div className="divide-y divide-slate-50 mt-4">
              {faecher.map(fach => {
                const fs = fach_schnitte?.[fach]
                const l = lehrer_by_id[fs?.lehrer_id] ?? {}
                return (
                  <NotenSkala
                    key={fach}
                    label={fach}
                    schnitt={fs?.klassen_schnitt}
                    sublabel={`${l.vorname ?? ''} ${l.nachname ?? ''}`.trim()}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Lehrer-Ansicht ── */}
        {ansicht === 'lehrer' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Lehrende in dieser Klasse — sortiert nach Ø Schnitt
            </h2>
            {Object.values(lehrerInKlasse).sort((a, b) => {
              const avgA = a.faecher.reduce((s, f) => s + f.schnitt, 0) / a.faecher.length
              const avgB = b.faecher.reduce((s, f) => s + f.schnitt, 0) / b.faecher.length
              return avgA - avgB
            }).map(({ lehrer: l, faecher: lf }) => {
              const avg = lf.reduce((s, f) => s + f.schnitt, 0) / lf.length
              return (
                <div key={l.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <button
                        onClick={() => navigate(`/schule/${id}/lehrer/${l.id}`)}
                        className="font-semibold text-slate-800 text-base hover:text-[#006892] hover:underline transition-colors">
                        {l.vorname} {l.nachname}
                      </button>
                      <span className="ml-2 text-xs text-slate-400 font-mono">[{l.kuerzel}]</span>
                    </div>
                    <span className={`text-lg font-bold ${schnittFarbe(avg)}`}>Ø {avg.toFixed(2)}</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {lf.map(f => (
                      <NotenSkala key={f.fach} label={f.fach} schnitt={f.schnitt} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </Layout>
  )
}
