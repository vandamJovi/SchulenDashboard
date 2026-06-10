import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import Layout from '../components/Layout'
import { NotenSkalaKompakt } from '../components/NotenSkala'

function schnittFarbe(schnitt) {
  if (schnitt === null || schnitt === undefined) return 'text-slate-400'
  if (schnitt <= 2.5) return 'text-green-600'
  if (schnitt <= 3.5) return 'text-yellow-600'
  return 'text-red-600'
}

function schnittBg(schnitt) {
  if (schnitt === null || schnitt === undefined) return 'bg-slate-50 border-slate-200'
  if (schnitt <= 2.0) return 'bg-green-50 border-green-100'
  if (schnitt <= 2.9) return 'bg-emerald-50 border-emerald-100'
  if (schnitt <= 3.5) return 'bg-yellow-50 border-yellow-100'
  if (schnitt <= 4.5) return 'bg-orange-50 border-orange-100'
  return 'bg-red-50 border-red-100'
}

function SchnittBadge({ wert }) {
  return (
    <span className={`text-lg font-bold ${schnittFarbe(wert)}`}>
      Ø {wert?.toFixed(1) ?? '–'}
    </span>
  )
}

export default function KlassenUebersicht() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [daten, setDaten] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ansicht, setAnsicht] = useState('klassen') // 'klassen' | 'lehrer'
  const [sortiertNach, setSortiertNach] = useState('bezeichnung')
  const [schuleName, setSchuleName] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/schulen/${id}/klassen`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/schulen/${id}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([k, s]) => {
      setDaten(k)
      setSchuleName(s.name ?? '')
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <Layout title="Klassen & Noten" backTo={{ to: `/schule/${id}`, label: 'Zurück zur Schule' }}>
      <main className="max-w-screen-xl mx-auto px-6 py-24 text-center text-slate-400">Wird geladen…</main>
    </Layout>
  )

  const { klassen, lehrer, faecher } = daten

  // Lehrer-Auswertung: Schnitte pro Fach aggregieren
  const lehrerStats = lehrer.map(l => {
    const fachSchnitte = {}
    let summe = 0, anzahl = 0
    faecher.forEach(fach => {
      const relevante = klassen.filter(kl => kl.fach_schnitte?.[fach]?.lehrer_id === l.id)
      if (relevante.length > 0) {
        const avg = relevante.reduce((s, kl) => s + kl.fach_schnitte[fach].klassen_schnitt, 0) / relevante.length
        fachSchnitte[fach] = { schnitt: Math.round(avg * 100) / 100, klassen: relevante.length }
        summe += avg
        anzahl++
      }
    })
    return {
      ...l,
      fachSchnitte,
      gesamt_schnitt: anzahl > 0 ? Math.round((summe / anzahl) * 100) / 100 : null,
      anzahl_faecher: anzahl,
    }
  }).filter(l => l.anzahl_faecher > 0)

  const sortiertKlassen = [...klassen].sort((a, b) => {
    if (sortiertNach === 'schnitt') return a.klassen_schnitt - b.klassen_schnitt
    if (sortiertNach === 'schueler') return b.anzahl_schueler - a.anzahl_schueler
    return a.bezeichnung.localeCompare(b.bezeichnung, 'de')
  })

  const sortiertLehrer = [...lehrerStats].sort((a, b) => {
    if (b.gesamt_schnitt === null) return -1
    if (a.gesamt_schnitt === null) return 1
    return a.gesamt_schnitt - b.gesamt_schnitt
  })

  return (
    <Layout
      title={schuleName}
      subtitle={`${klassen.length} Klassen · ${klassen.reduce((s, k) => s + k.anzahl_schueler, 0)} Schüler (Mock-Daten)`}
      backTo={{ to: `/schule/${id}`, label: 'Zurück zur Schule' }}
    >
      <main className="max-w-screen-xl mx-auto px-6 py-6">

        {/* Ansicht-Umschalter */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit mb-5" role="tablist">
          {[['klassen', 'Klassen'], ['lehrer', 'Lehrer']].map(([key, label]) => (
            <button key={key} onClick={() => setAnsicht(key)}
              role="tab" aria-selected={ansicht === key}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                ansicht === key ? 'bg-[#006892] text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {ansicht === 'klassen' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Alle Klassen</h2>
              <div className="flex gap-1.5 text-sm">
                <span className="text-slate-400 mr-1">Sortierung:</span>
                {[['bezeichnung', 'Name'], ['schnitt', 'Notenschnitt'], ['schueler', 'Schülerzahl']].map(([key, label]) => (
                  <button key={key} onClick={() => setSortiertNach(key)}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      sortiertNach === key ? 'text-white' : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300'
                    }`}
                    style={sortiertNach === key ? { background: '#006892' } : {}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortiertKlassen.map(kl => {
                const fachListe = Object.entries(kl.fach_schnitte ?? {})
                  .sort((a, b) => a[1].klassen_schnitt - b[1].klassen_schnitt)
                const bestesFach = fachListe[0]
                const schlechtestesFach = fachListe[fachListe.length - 1]
                return (
                  <button key={kl.id} onClick={() => navigate(`/schule/${id}/klassen/${kl.id}`)}
                    className={`text-left rounded-xl border p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all ${schnittBg(kl.klassen_schnitt)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{kl.bezeichnung}</span>
                      <SchnittBadge wert={kl.klassen_schnitt} />
                    </div>
                    <div className="text-xs text-slate-500 mb-3 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Users size={11} />
                        <span>{kl.anzahl_schueler} Schüler</span>
                      </div>
                      <div className="text-slate-400 truncate">KL: {kl.klassenlehrer}</div>
                    </div>
                    {/* Noten-Skala 1–6 mit Marker */}
                    <NotenSkalaKompakt schnitt={kl.klassen_schnitt} className="mb-3" />
                    {/* Bestes & schlechtestes Fach */}
                    <div className="flex justify-between text-xs">
                      {bestesFach && (
                        <span className="text-green-700 truncate max-w-[45%]">
                          ↑ {bestesFach[0]} ({bestesFach[1].klassen_schnitt.toFixed(1)})
                        </span>
                      )}
                      {schlechtestesFach && schlechtestesFach[0] !== bestesFach?.[0] && (
                        <span className="text-red-600 truncate max-w-[45%] text-right">
                          ↓ {schlechtestesFach[0]} ({schlechtestesFach[1].klassen_schnitt.toFixed(1)})
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {ansicht === 'lehrer' && (
          <>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Lehrer-Auswertung (Ø Klassenschnitte je Fach)
            </h2>
            <div className="space-y-3">
              {sortiertLehrer.map(l => (
                <div key={l.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <button
                        onClick={() => navigate(`/schule/${id}/lehrer/${l.id}`)}
                        className="font-semibold text-slate-800 hover:text-[#006892] hover:underline transition-colors">
                        {l.vorname} {l.nachname}
                      </button>
                      <span className="ml-2 text-xs text-slate-400">[{l.kuerzel}]</span>
                      <div className="text-xs text-slate-400 mt-0.5">{l.faecher.join(', ')}</div>
                    </div>
                    <div className="text-right">
                      <SchnittBadge wert={l.gesamt_schnitt} />
                      <div className="text-xs text-slate-400 mt-0.5">{l.anzahl_faecher} Fach/Klassen-Kombi</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(l.fachSchnitte).map(([fach, fs]) => (
                      <div key={fach} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${schnittBg(fs.schnitt)}`}>
                        <span className="text-slate-600">{fach}</span>
                        <span className={`ml-1.5 font-bold ${schnittFarbe(fs.schnitt)}`}>
                          Ø {fs.schnitt.toFixed(1)}
                        </span>
                        <span className="text-slate-400 ml-1">({fs.klassen} Kl.)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </Layout>
  )
}
