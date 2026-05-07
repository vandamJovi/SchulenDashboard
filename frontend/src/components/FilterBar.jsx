const SELECT = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006892]/40 focus:border-[#006892]"

export default function FilterBar({ filters, options, onChange }) {
  const hasActive = filters.stiftung || filters.bundesland || filters.schultyp || filters.ampel || filters.suche

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select value={filters.stiftung} onChange={e => onChange({ ...filters, stiftung: e.target.value })} className={SELECT}>
        <option value="">Alle Träger</option>
        {options.stiftungen?.map(s => (
          <option key={s} value={s}>
            {s === 'ESM' ? 'ESM – Ev. Schulstiftung Mitteldeutschland' : 'KOS – Kooperationsschulen'}
          </option>
        ))}
      </select>

      <select value={filters.bundesland} onChange={e => onChange({ ...filters, bundesland: e.target.value })} className={SELECT}>
        <option value="">Alle Bundesländer</option>
        {options.bundeslaender?.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      <select value={filters.schultyp} onChange={e => onChange({ ...filters, schultyp: e.target.value })} className={SELECT}>
        <option value="">Alle Schultypen</option>
        {options.schultypen?.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <select value={filters.ampel} onChange={e => onChange({ ...filters, ampel: e.target.value })} className={SELECT}>
        <option value="">Alle Ampelstatus</option>
        <option value="red">🔴 Kritisch</option>
        <option value="yellow">🟡 Mittel</option>
        <option value="green">🟢 Gut</option>
        <option value="gray">⚪ Keine Daten</option>
      </select>

      <input
        type="text"
        placeholder="Schule suchen…"
        value={filters.suche}
        onChange={e => onChange({ ...filters, suche: e.target.value })}
        className={`${SELECT} min-w-48`}
      />

      {hasActive && (
        <button
          onClick={() => onChange({ stiftung: '', bundesland: '', schultyp: '', ampel: '', suche: '' })}
          className="text-sm text-[#006892] hover:text-[#00303F] underline underline-offset-2"
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  )
}
