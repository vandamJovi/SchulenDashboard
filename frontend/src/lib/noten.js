/** Farbe für einen Notenschnitt auf der Skala 1–6. */
export function notenFarbe(s) {
  if (s == null) return '#94a3b8'
  if (s <= 2.0) return '#16a34a'
  if (s <= 2.9) return '#059669'
  if (s <= 3.5) return '#d97706'
  if (s <= 4.5) return '#ea580c'
  return '#dc2626'
}

export const NOTEN_TRACK_GRADIENT = 'linear-gradient(to right, #16a34a 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #dc2626 100%)'
