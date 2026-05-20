import { useState } from 'react'

export default function Login({ onLogin }) {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

  async function anmelden(e) {
    e.preventDefault()
    setFehler('')
    setLaedt(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user, password }),
      })
      if (res.ok) {
        onLogin()
      } else {
        setFehler('Ungültige Zugangsdaten.')
      }
    } catch {
      setFehler('Verbindungsfehler. Bitte erneut versuchen.')
    }
    setLaedt(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f8fa' }}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-xl px-4 py-3 shadow-sm mb-4">
            <img src="/logo.svg" alt="EKMD Logo" className="h-12 w-auto" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Schulen-Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Evangelische Schulstiftung Mitteldeutschland</p>
        </div>

        <form onSubmit={anmelden} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Benutzername
            </label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              autoComplete="username"
              required
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#006892] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#006892] transition-colors"
            />
          </div>

          {fehler && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{fehler}</p>
          )}

          <button
            type="submit"
            disabled={laedt}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#006892' }}
          >
            {laedt ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
