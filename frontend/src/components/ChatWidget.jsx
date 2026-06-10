import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, ChevronDown, RotateCcw } from 'lucide-react'

const BEISPIEL_FRAGEN = [
  'Welche Schulen sind aktuell kritisch?',
  'Wo sinken die Schülerzahlen am stärksten?',
  'Welche Schule hat die höchste Auslastung?',
]

function renderMarkdown(text) {
  return text.split('\n').map((line, i) => {
    const parts = []
    let rest = line
    while (rest.length > 0) {
      const m = rest.match(/\*\*(.+?)\*\*/)
      if (!m) { parts.push(<span key={parts.length}>{rest}</span>); break }
      if (m.index > 0) parts.push(<span key={parts.length}>{rest.slice(0, m.index)}</span>)
      parts.push(<strong key={parts.length}>{m[1]}</strong>)
      rest = rest.slice(m.index + m[0].length)
    }
    return <div key={i}>{parts}</div>
  })
}

export default function ChatWidget() {
  const [frage, setFrage] = useState('')
  const [verlauf, setVerlauf] = useState([])
  const [laedt, setLaedt] = useState(false)
  const [offen, setOffen] = useState(true)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [verlauf, laedt])

  async function senden(text) {
    const t = (text ?? frage).trim()
    if (!t || laedt) return
    setFrage('')
    setVerlauf(v => [...v, { rolle: 'nutzer', text: t }])
    setLaedt(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ frage: t }),
      })
      const d = await res.json()
      setVerlauf(v => [...v, { rolle: 'assistent', text: d.antwort ?? d.error ?? 'Fehler.' }])
    } catch {
      setVerlauf(v => [...v, { rolle: 'assistent', text: 'Verbindungsfehler. Bitte erneut versuchen.' }])
    }
    setLaedt(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">

      {/* Kopfzeile */}
      <button
        onClick={() => setOffen(o => !o)}
        aria-expanded={offen}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#e6f3f8]">
            <Sparkles size={15} className="text-[#006892]" />
          </span>
          <span className="text-sm font-semibold text-[#00303F]">KI-Assistent</span>
          <span className="text-xs text-slate-400 hidden sm:inline">beantwortet Fragen zu den Schuldaten</span>
        </span>
        <span className="flex items-center gap-3">
          {verlauf.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); setVerlauf([]) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setVerlauf([]) } }}
              title="Verlauf löschen"
              className="text-slate-300 hover:text-slate-500 transition-colors"
            >
              <RotateCcw size={15} />
            </span>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${offen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {offen && (
        <div className="border-t border-slate-100">

          {/* Verlauf */}
          {verlauf.length > 0 && (
            <div ref={scrollRef} className="px-5 pt-4 pb-3 space-y-4 max-h-96 overflow-y-auto border-b border-slate-100">
              {verlauf.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.rolle === 'nutzer' ? 'justify-end' : 'justify-start'}`}>
                  {m.rolle === 'assistent' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#006892]">
                      <Sparkles size={13} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.rolle === 'nutzer'
                      ? 'text-white rounded-br-sm bg-[#006892]'
                      : 'bg-slate-50 text-slate-800 rounded-bl-sm'
                  }`}>
                    {m.rolle === 'assistent' ? renderMarkdown(m.text) : m.text}
                  </div>
                </div>
              ))}
              {laedt && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[#006892]">
                    <Sparkles size={13} className="text-white" />
                  </div>
                  <div className="bg-slate-50 rounded-2xl rounded-bl-sm px-4 py-3">
                    <Loader2 size={15} className="animate-spin text-slate-400" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Beispiel-Fragen, solange noch kein Verlauf existiert */}
          {verlauf.length === 0 && (
            <div className="flex flex-wrap gap-2 px-5 pt-4">
              {BEISPIEL_FRAGEN.map(f => (
                <button
                  key={f}
                  onClick={() => senden(f)}
                  className="text-xs text-[#006892] bg-[#e6f3f8] hover:bg-[#d3ebf4] rounded-full px-3 py-1.5 transition-colors"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Eingabe */}
          <div className="flex items-center gap-3 px-5 py-4">
            <input
              ref={inputRef}
              type="text"
              value={frage}
              onChange={e => setFrage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && senden()}
              placeholder="Frage stellen, z. B. „Wie viele Schüler hat Erfurt?“"
              aria-label="Frage an den KI-Assistenten"
              className="flex-1 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none placeholder-slate-400 focus:border-[#006892] focus:bg-white transition-colors"
            />
            <button
              onClick={() => senden()}
              disabled={!frage.trim() || laedt}
              title="Senden"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-opacity disabled:opacity-30 shrink-0 bg-[#006892]"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
