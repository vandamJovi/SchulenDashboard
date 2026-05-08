import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, X } from 'lucide-react'

function renderMarkdown(text) {
  return text.split('\n').map((line, i) => {
    const parts = []
    let rest = line
    let key = 0
    while (rest.length > 0) {
      const m = rest.match(/\*\*(.+?)\*\*/)
      if (!m) { parts.push(<span key={key++}>{rest}</span>); break }
      if (m.index > 0) parts.push(<span key={key++}>{rest.slice(0, m.index)}</span>)
      parts.push(<strong key={key++}>{m[1]}</strong>)
      rest = rest.slice(m.index + m[0].length)
    }
    return <div key={i}>{parts}</div>
  })
}

export default function ChatWidget() {
  const [frage, setFrage] = useState('')
  const [verlauf, setVerlauf] = useState([])
  const [laedt, setLaedt] = useState(false)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [verlauf, laedt])

  async function senden() {
    const text = frage.trim()
    if (!text || laedt) return
    setFrage('')
    setVerlauf(v => [...v, { rolle: 'nutzer', text }])
    setLaedt(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frage: text }),
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
    <div className="rounded-2xl border-2 border-slate-200 shadow-md overflow-hidden" style={{ background: 'linear-gradient(to bottom, #f8fafc, #ffffff)' }}>

      {/* Verlauf */}
      {verlauf.length > 0 && (
        <div ref={scrollRef} className="px-6 pt-5 pb-3 space-y-5 max-h-96 overflow-y-auto border-b border-slate-100">
          {verlauf.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.rolle === 'nutzer' ? 'justify-end' : 'justify-start'}`}>
              {m.rolle === 'assistent' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                     style={{ background: '#006892' }}>
                  <span className="text-white text-xs font-bold">KI</span>
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.rolle === 'nutzer'
                  ? 'text-white rounded-br-sm'
                  : 'bg-slate-50 text-slate-800 rounded-bl-sm'
              }`} style={m.rolle === 'nutzer' ? { background: '#006892' } : {}}>
                {m.rolle === 'assistent' ? renderMarkdown(m.text) : m.text}
              </div>
            </div>
          ))}
          {laedt && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                   style={{ background: '#006892' }}>
                <span className="text-white text-xs font-bold">KI</span>
              </div>
              <div className="bg-slate-50 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 size={15} className="animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Eingabe */}
      <div className="flex items-center gap-4 px-6 py-5">
        {verlauf.length > 0 && (
          <button onClick={() => setVerlauf([])} className="text-slate-300 hover:text-slate-500 shrink-0">
            <X size={18} />
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={frage}
          onChange={e => setFrage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && senden()}
          placeholder="Fragen Sie die KI zu den Schuldaten…"
          className="flex-1 text-base text-slate-700 bg-transparent outline-none placeholder-slate-400"
        />
        <button
          onClick={senden}
          disabled={!frage.trim() || laedt}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-opacity disabled:opacity-30 shrink-0"
          style={{ background: '#006892' }}
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}
