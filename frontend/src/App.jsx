import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import SchuleDetail from './pages/SchuleDetail'
import Karte from './pages/Karte'
import Login from './pages/Login'
import KlassenUebersicht from './pages/KlassenUebersicht'
import KlassenDetail from './pages/KlassenDetail'
import LehrerDetail from './pages/LehrerDetail'

export default function App() {
  const [auth, setAuth] = useState(null) // null = prüft noch, true/false = Ergebnis

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => setAuth(r.ok))
      .catch(() => setAuth(false))
  }, [])

  if (auth === null) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#f5f8fa' }}>
        <img src="/logo.svg" alt="EKMD Logo" className="h-12 opacity-40" />
      </div>
    )
  }

  if (!auth) {
    return <Login onLogin={() => setAuth(true)} />
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/schule/:id" element={<SchuleDetail />} />
      <Route path="/schule/:id/klassen" element={<KlassenUebersicht />} />
      <Route path="/schule/:id/klassen/:klasseId" element={<KlassenDetail />} />
      <Route path="/schule/:id/lehrer/:lehrerId" element={<LehrerDetail />} />
      <Route path="/karte" element={<Karte />} />
    </Routes>
  )
}
