# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## Projektdokumentation: Schulen-Dashboard POC

### Übersicht

POC-Dashboard für die Evangelische Schulstiftung Mitteldeutschland (EKMD). Zeigt Kennzahlen von 42 Schulen (32 ESM, 10 KOS) übersichtlich mit Ampelstatus an. Datenquelle: kesep.ekmd-online.de (SRP-6a Authentifizierung).

**GitHub Repo:** https://github.com/vandamJovi/SchulenDashboard (privat)

### Architektur

```
SchulenDashboard/
├── fetch_data.py          # Einmaliger Daten-Abruf von KESEP → data/kesep_data.json
├── scraper_explore.py     # Explorations-Skript (nicht für Produktion)
├── data/                  # Lokale JSON-Daten (.gitignore — Schülerdaten!)
│   └── kesep_data.json
├── backend/
│   ├── app.py             # Flask REST-API (Port 5000)
│   └── requirements.txt   # flask, flask-cors
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── Dashboard.jsx      # Übersicht aller Schulen
    │   │   └── SchuleDetail.jsx   # Detailansicht + Charts
    │   └── components/
    │       ├── Ampel.jsx          # Ampel-Dot, -Badge, -Row
    │       ├── KpiCard.jsx        # KPI-Kacheln
    │       ├── FilterBar.jsx      # Filter-Leiste
    │       └── SchulCard.jsx      # Schul-Karte in der Übersicht
    └── package.json       # React + Vite + Tailwind + Recharts
```

### Lokale Entwicklung starten

```bash
# 1. Daten abrufen (einmalig)
python fetch_data.py

# 2. Backend starten (Terminal 1)
cd backend
pip install -r requirements.txt
python app.py          # läuft auf http://localhost:5000

# 3. Frontend starten (Terminal 2)
cd frontend
npm install
npm run dev            # läuft auf http://localhost:5173
```

### Backend API-Endpunkte

| Endpunkt | Beschreibung |
|---|---|
| `GET /api/meta` | Datenstand, Anzahl Schulen/Datensätze |
| `GET /api/schulen` | Alle Schulen mit KPIs und Ampelstatus |
| `GET /api/schulen/:id` | Einzelne Schule + Schülerzahlen-Historie |
| `GET /api/uebersicht` | Aggregierte Gesamtstatistik |
| `GET /api/filter-options` | Verfügbare Filterwerte |

### Datenbasis (KESEP)

- **42 Schulen**: 32 ESM, 10 KOS (Kooperationsschulen — keine Schülerzahlen)
- **Bundesländer**: Thüringen, Sachsen-Anhalt, Sachsen
- **Schuljahre**: 2013/14 bis 2025/26 (10 Datensätze je Schule)
- **Authentifizierung**: SRP-6a (Secure Remote Password) + HMAC-SHA256 Request-Signierung

### Ampel-Schwellwerte

Alle Schwellwerte sind in `backend/app.py` in der Konstante `THRESHOLDS` definiert und können dort angepasst werden.

| Kennzahl | Grün | Gelb | Rot | Berechnung |
|---|---|---|---|---|
| Schülerzahl-Entwicklung (YoY) | > +2% | -2% bis +2% | < -2% | (Ist − Vorjahr) / Vorjahr |
| Kapazitätsauslastung | ≥ 70% | 50–70% | < 50% | Schüler / (Klassenräume × 25) |
| Anmeldeerfüllung Folgejahr | ≥ 95% | 80–95% | < 80% | Gesamt_Folgejahr1 / Schuljahr[0].Sollzahl_Folgejahr1 |
| SPG-Quote (Förderbedarf) | < 10% | 10–20% | > 20% | SPG-Summe / Gesamt |

**Annahme Auslastung:** 25 Schüler pro Klassenraum als maximale Kapazität (Konstante `SCHUELER_PRO_RAUM` in `app.py`).

**Gesamtampel je Schule:** Schlechtester Einzelwert bestimmt die Gesamtfarbe (rot > gelb > grün > grau).

### Geplante Erweiterungen (laut Kunde)

- Wirtschaftliche Daten (werden nicht per URL geliefert, müssen manuell importiert werden)
- Eigene Authentifizierung für das Dashboard (für Produktiveinsatz)
- Datenbankanbindung statt statischer JSON-Datei

