import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { MapPin, Phone, Mail, Globe, Users, Building2, ChevronDown, ChevronUp, GraduationCap, AlertTriangle } from 'lucide-react'
import Layout from '../components/Layout'
import { AmpelRow } from '../components/Ampel'
import { AMPEL_INFO } from '../lib/ampelInfo'

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
  const [fehler, setFehler] = useState(false)
  const [rohdatenOffen, setRohdatenOffen] = useState(false)

  useEffect(() => {
    fetch(`/api/schulen/${id}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setSchule(d); setLoading(false) })
      .catch(() => { setFehler(true); setLoading(false) })
  }, [id])

  if (loading || fehler) {
    return (
      <Layout title="Schuldetails" backTo={{ to: '/', label: 'Zurück zum Dashboard' }}>
        <main className="max-w-screen-xl mx-auto px-6 py-24 text-center">
          {fehler ? (
            <>
              <AlertTriangle size={40} className="mx-auto text-amber-400 mb-4" />
              <h2 className="text-lg font-semibold text-slate-700 mb-1">Schule konnte nicht geladen werden</h2>
              <p className="text-sm text-slate-400">Bitte zum Dashboard zurückkehren und erneut versuchen.</p>
            </>
          ) : (
            <div className="text-slate-400">Wird geladen…</div>
          )}
        </main>
      </Layout>
    )
  }

  const fotos = schule.foto_urls ?? []

  const history = schule.schuelerzahlen_history ?? []
  const latest = history[history.length - 1]

  const ampelLabels = {
    yoy:       'Schülerzahl-Entwicklung (YoY)',
    auslastung: 'Kapazitätsauslastung',
    prognose:  'Anmeldeerfüllung Folgejahr',
  }
  const ampelValues = {
    yoy:       schule.yoy_change_pct !== null ? `${schule.yoy_change_pct > 0 ? '+' : ''}${schule.yoy_change_pct}%` : null,
    auslastung: schule.auslastung_pct !== null ? `${schule.auslastung_pct}%` : null,
    prognose:  schule.prognose_pct !== null ? `${schule.prognose_pct}%` : null,
  }

  const hasJahrgaenge = latest?.jahrgaenge && Object.keys(latest.jahrgaenge).length > 0
  const jahrgangData = hasJahrgaenge
    ? Object.entries(latest.jahrgaenge)
        .map(([k, v]) => ({ name: `Jg. ${k.replace('j', '')}`, schueler: v }))
        .sort((a, b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]))
    : []

  return (
    <Layout
      title={schule.name}
      subtitle={
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} />
          {schule.details?.strasse}, {schule.plz} {schule.ort} · {schule.bundesland}
        </span>
      }
      backTo={{ to: '/', label: 'Zurück zum Dashboard' }}
      actions={
        <>
          {schule.stiftung === 'ESM' && (
            <button
              onClick={() => navigate(`/schule/${id}/klassen`)}
              className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors"
            >
              <GraduationCap size={16} /> <span className="hidden md:inline">Klassen & Noten</span>
            </button>
          )}
          <span className="text-sm font-bold bg-white/20 text-white rounded-lg px-3 py-1">
            {schule.stiftung}
          </span>
        </>
      }
    >
      <main className="max-w-screen-xl mx-auto px-6 py-6">

        {/* Hero-Banner (erstes Foto) */}
        {fotos.length > 0 && (
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm" style={{ height: 280 }}>
            <a href={fotos[0].replace('/scaled/', '/')} target="_blank" rel="noopener noreferrer">
              <img
                src={fotos[0].replace('/scaled/', '/')}
                alt="Schulfoto"
                className="w-full h-full object-cover hover:opacity-95 transition-opacity"
              />
            </a>
          </div>
        )}

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
                  info={AMPEL_INFO[key]}
                />
              ))}
              <p className="text-xs text-slate-400 mt-2">Schwellwerte per Mauszeiger auf einer Zeile einsehbar.</p>
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

            {/* Gebäude & Personal — nur anzeigen, wenn es nennenswerte Daten gibt */}
            {(() => {
              const eintraege = [
                ['Klassenräume', schule.details?.anzahl_klassenraeume],
                ['Differenzierungsräume', schule.details?.anzahl_diff_raeume],
                ['Horträume', schule.details?.anzahl_hort_raeume],
                ['Lerngruppen', schule.details?.lerngruppenzahl],
                ['Mitarbeiter', schule.details?.anzahl_personen],
                ['VBE (Vollzeitäquivalente)', schule.details?.anzahl_vbe],
                ['Fortbildungstage', schule.details?.fortbildung_tage],
              ].filter(([, v]) => v !== null && v !== undefined && v !== 0)
              if (eintraege.length === 0) return null
              return (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Gebäude & Personal</h2>
                  <div className="space-y-2 text-sm">
                    {eintraege.map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-slate-400">{label}</span>
                        <span className="font-semibold text-slate-700 tnum">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Rechte Spalte: Charts */}
          <div className="lg:col-span-2 space-y-4">

            {/* Schülerzahlentwicklung */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                    Schülerzahlen-Entwicklung (August je Schuljahr)
                  </h2>
                  <span className="text-xs text-slate-400">{history[0]?.schuljahr} – {history[history.length-1]?.schuljahr}</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [v, n]} labelFormatter={l => `SJ ${l}`} />
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
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={l => `SJ ${l}`} />
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
                    ['Anmeldungen Folgejahr (Ist)', schule.prognose_folgejahr?.toLocaleString('de-DE')],
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

        {/* Fotogalerie (weitere Fotos) */}
        {fotos.length > 1 && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Weitere Fotos ({fotos.length - 1})
            </h2>
            <div className="flex flex-wrap gap-3">
              {fotos.slice(1).map((url, i) => (
                <a key={i} href={url.replace('/scaled/', '/')} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Schulfoto ${i + 2}`}
                    className="rounded-lg shadow-sm hover:shadow-md transition-shadow max-h-48 w-auto"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Rohdaten */}
        {(history.length > 0 || schule.quelldaten) && (
          <div className="mt-6">
            <button
              onClick={() => setRohdatenOffen(o => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-3"
            >
              {rohdatenOffen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Quelldaten anzeigen
            </button>

            {rohdatenOffen && (
              <div className="space-y-4">

              {/* Beschreibung & Textfelder */}
              {schule.quelldaten && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Beschreibung & Profil</h3>

                  {schule.quelldaten.beschreibung && (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-1">Beschreibung</div>
                      <div
                        className="text-sm text-slate-700 leading-relaxed prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: schule.quelldaten.beschreibung }}
                      />
                    </div>
                  )}

                  {schule.quelldaten.profil_text && (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-1">Schulprofil</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{schule.quelldaten.profil_text}</p>
                    </div>
                  )}

                  {schule.quelldaten.unterricht_beschreibung && (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-1">Unterricht</div>
                      <p className="text-sm text-slate-700 leading-relaxed">{schule.quelldaten.unterricht_beschreibung}</p>
                    </div>
                  )}

                  {/* Ja/Nein-Felder */}
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-2">Merkmale</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['Gemeinsamer Unterricht', schule.quelldaten.gemeinsamer_unterricht],
                        ['Jahrgangsmischung', schule.quelldaten.jahrgangsmischung],
                        ['Evaluation extern', schule.quelldaten.evaluation_extern],
                        ['Evaluation intern', schule.quelldaten.evaluation_intern],
                        ['Fortbildungskonzept', schule.quelldaten.fortbildung_konzept],
                        ['Steuergruppe', schule.quelldaten.entwicklung_steuergruppe],
                        ['Wettbewerbe', schule.quelldaten.entwicklung_wettbewerbe],
                        ['Vernetzungstreffen', schule.quelldaten.vernetzung_treffen],
                        ['Investitionsbedarf', schule.quelldaten.investitionsbedarf],
                      ].map(([label, val]) => (
                        <span key={label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          val ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {val ? '✓' : '–'} {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Personalzahlen */}
                  {(schule.quelldaten.paedagogen_maennlich || schule.quelldaten.paedagogen_weiblich) && (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-2">Personal (Pädagogen)</div>
                      <div className="flex gap-4 text-sm text-slate-700">
                        {schule.quelldaten.paedagogen_maennlich != null && <span>Männlich: <strong>{schule.quelldaten.paedagogen_maennlich}</strong></span>}
                        {schule.quelldaten.paedagogen_weiblich != null && <span>Weiblich: <strong>{schule.quelldaten.paedagogen_weiblich}</strong></span>}
                        {schule.quelldaten.altersdurchschnitt && <span>Ø Alter: <strong>{schule.quelldaten.altersdurchschnitt}</strong></span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Monatsstatistik-Tabelle */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-3 font-semibold text-slate-500 whitespace-nowrap">Schuljahr</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">Gesamt</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">Männlich</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">Weiblich</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">Evangelisch</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">Konfessionslos</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">SPG Gesamt</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">SPG Lernen</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">SPG Emotional</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">SPG Sprache</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">SPG Geistig</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">SPG Körperlich</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">SPG Begabt</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">Anmeldungen (Ist)</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right whitespace-nowrap">Prognose Folgejahr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((h, i) => (
                      <tr key={h.schuljahr} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{h.schuljahr}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{h.gesamt ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.maennlich ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.weiblich ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.evangelisch ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.konfessionslos ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">{h.spg_gesamt ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.spg_lernen ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.spg_emotional ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.spg_sprachlich ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.spg_geistig ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.spg_koerperlich ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.spg_begabt ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.anmeldungen_1 ?? '–'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{h.prognose_folgejahr1 ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              </div>
            )}
          </div>
        )}

      </main>
    </Layout>
  )
}
