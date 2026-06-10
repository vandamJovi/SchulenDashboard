import { Link, NavLink } from 'react-router-dom'
import { ArrowLeft, LayoutGrid, Map, LogOut } from 'lucide-react'

/**
 * Gemeinsames Seitengerüst: Top-Banner, Header mit Navigation,
 * optionalem Zurück-Link, Seitentitel und Logout.
 *
 * Props:
 *  - title / subtitle: Überschrift im Header (Strings oder Nodes)
 *  - backTo:   { to, label } — zeigt einen Zurück-Link über dem Titel
 *  - actions:  zusätzliche Buttons rechts im Header
 *  - banner:   Text rechts im Top-Banner (z.B. Datenstand)
 *  - hideNav:  Navigation ausblenden (z.B. auf tiefen Detailseiten)
 */
export default function Layout({ title, subtitle, backTo, actions, banner, children }) {
  async function abmelden() {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    } finally {
      window.location.href = '/'
    }
  }

  const navLink = ({ isActive }) =>
    `flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2 transition-colors ${
      isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
    }`

  return (
    <div className="min-h-screen bg-[#f5f8fa]">

      {/* Top-Banner */}
      <div className="py-1.5 px-4 sm:px-6 bg-[#00303F]">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <span className="text-xs text-white/50">Evangelische Schulstiftung in Mitteldeutschland</span>
          {banner && <span className="text-xs text-white/40">{banner}</span>}
        </div>
      </div>

      {/* Header */}
      <header
        className="shadow-md sticky top-0 z-20"
        style={{ background: 'linear-gradient(120deg, #00547a 0%, #006892 55%, #007aa8 100%)' }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3.5">
          {backTo && (
            <Link
              to={backTo.to}
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-2.5 transition-colors rounded focus-visible:outline-2 focus-visible:outline-white/70"
            >
              <ArrowLeft size={16} /> {backTo.label}
            </Link>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <Link to="/" className="bg-white rounded-lg px-2.5 py-1.5 shadow-sm shrink-0 hidden sm:block" title="Zum Dashboard">
                <img src="/logo.svg" alt="EKMD Logo" className="h-9 w-auto" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{title}</h1>
                {subtitle && <div className="text-xs text-white/60 mt-0.5 truncate">{subtitle}</div>}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {actions}
              <nav className="flex items-center gap-1" aria-label="Hauptnavigation">
                <NavLink to="/" end className={navLink}>
                  <LayoutGrid size={16} /> <span className="hidden md:inline">Dashboard</span>
                </NavLink>
                <NavLink to="/karte" className={navLink}>
                  <Map size={16} /> <span className="hidden md:inline">Karte</span>
                </NavLink>
              </nav>
              <div className="w-px h-6 bg-white/20 mx-0.5 hidden sm:block" />
              <button
                onClick={abmelden}
                title="Abmelden"
                className="flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
              >
                <LogOut size={16} /> <span className="hidden lg:inline">Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
