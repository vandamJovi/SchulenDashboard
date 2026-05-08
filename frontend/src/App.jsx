import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import SchuleDetail from './pages/SchuleDetail'
import Karte from './pages/Karte'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/schule/:id" element={<SchuleDetail />} />
      <Route path="/karte" element={<Karte />} />
    </Routes>
  )
}
