"""
KESEP Schulen-Dashboard — Flask Backend
Liest lokale JSON-Daten und stellt REST-API bereit.
"""

import json
import os
from flask import Flask, jsonify, abort
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "kesep_data.json")

# ── Schwellwerte Ampelsystem ──────────────────────────────────────────────────
# Dokumentiert in CLAUDE.md
THRESHOLDS = {
    "yoy_change": {"green": 2.0, "red": -2.0},          # % Schülerzahl-Veränderung
    "auslastung": {"green": 70.0, "yellow": 50.0},       # % Kapazitätsauslastung
    "prognose":   {"green": 95.0, "yellow": 80.0},       # % Prognose vs. Ist
    "spg_quote":  {"green": 10.0, "yellow": 20.0},       # % Förderbedarfsquote
}

SCHUELER_PRO_RAUM = 25  # Annahme: max. Klassengröße


def _load_data():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def _ampel(wert, schwelle_gruen, schwelle_rot, hoeher_ist_besser=True):
    """Gibt 'green', 'yellow' oder 'red' zurück."""
    if wert is None:
        return "gray"
    if hoeher_ist_besser:
        if wert >= schwelle_gruen:
            return "green"
        if wert >= schwelle_rot:
            return "yellow"
        return "red"
    else:
        if wert <= schwelle_gruen:
            return "green"
        if wert <= schwelle_rot:
            return "yellow"
        return "red"


def _spg_total(z):
    felder = ["SPG_koerperlich", "SPG_geistig", "SPG_sehen", "SPG_hoeren",
              "SPG_lernen", "SPG_emotional", "SPG_sprachlich", "SPG_begabt"]
    vals = [int(z.get(f) or 0) for f in felder]
    return sum(vals)


def _parse_int(val):
    try:
        return int(val) if val not in (None, "", "None") else None
    except (ValueError, TypeError):
        return None


def _latest_record(zahlen_fuer_schule):
    """Gibt den Datensatz mit dem neuesten Schuljahr zurück."""
    filled = [z for z in zahlen_fuer_schule if _parse_int(z.get("Gesamt")) is not None]
    if not filled:
        return None
    return max(filled, key=lambda z: (
        z["Schuljahr"][0]["Jahr"] if z.get("Schuljahr") else 0
    ))


def _prev_record(zahlen_fuer_schule, latest):
    """Gibt den Datensatz des Vorjahres zurück."""
    if not latest or not latest.get("Schuljahr"):
        return None
    latest_jahr = latest["Schuljahr"][0]["Jahr"]
    candidates = [
        z for z in zahlen_fuer_schule
        if z.get("Schuljahr")
        and z["Schuljahr"][0]["Jahr"] == latest_jahr - 1
        and _parse_int(z.get("Gesamt")) is not None
    ]
    return candidates[0] if candidates else None


def _compute_kpis(schule, zahlen_fuer_schule):
    """Berechnet KPIs und Ampelstatus für eine Schule."""
    latest = _latest_record(zahlen_fuer_schule)
    prev = _prev_record(zahlen_fuer_schule, latest)

    gesamt = _parse_int(latest.get("Gesamt")) if latest else None
    gesamt_prev = _parse_int(prev.get("Gesamt")) if prev else None

    # YoY-Entwicklung
    yoy = None
    if gesamt is not None and gesamt_prev and gesamt_prev > 0:
        yoy = round((gesamt - gesamt_prev) / gesamt_prev * 100, 1)

    # Auslastung
    n_raeume = _parse_int(schule.get("AnzahlKlassenraeume"))
    auslastung = None
    if gesamt is not None and n_raeume and n_raeume > 0:
        auslastung = round(gesamt / (n_raeume * SCHUELER_PRO_RAUM) * 100, 1)

    # Prognose Folgejahr1
    prognose_val = _parse_int(latest.get("Gesamt_Folgejahr1")) if latest else None
    prognose_pct = None
    if prognose_val is not None and gesamt and gesamt > 0:
        prognose_pct = round(prognose_val / gesamt * 100, 1)

    # SPG-Quote
    spg = _spg_total(latest) if latest else 0
    spg_quote = None
    if gesamt and gesamt > 0:
        spg_quote = round(spg / gesamt * 100, 1)

    # Schuljahr-Label
    schuljahr_label = None
    if latest and latest.get("Schuljahr"):
        j = latest["Schuljahr"][0]["Jahr"]
        schuljahr_label = f"{j}/{j+1}"

    return {
        "gesamt_schueler": gesamt,
        "gesamt_vorjahr": gesamt_prev,
        "yoy_change_pct": yoy,
        "auslastung_pct": auslastung,
        "prognose_folgejahr": prognose_val,
        "prognose_pct": prognose_pct,
        "spg_gesamt": spg,
        "spg_quote_pct": spg_quote,
        "aktuelles_schuljahr": schuljahr_label,
        "ampel": {
            "yoy":       _ampel(yoy, THRESHOLDS["yoy_change"]["green"],
                                THRESHOLDS["yoy_change"]["red"], True),
            "auslastung": _ampel(auslastung, THRESHOLDS["auslastung"]["green"],
                                 THRESHOLDS["auslastung"]["yellow"], True),
            "prognose":  _ampel(prognose_pct, THRESHOLDS["prognose"]["green"],
                                THRESHOLDS["prognose"]["yellow"], True),
            "spg":       _ampel(spg_quote, THRESHOLDS["spg_quote"]["green"],
                                THRESHOLDS["spg_quote"]["yellow"], False),
        },
    }


def _schultypen(schule):
    mapping = {
        "istGrundschule":      "Grundschule",
        "istGymnasium":        "Gymnasium",
        "istRegelschule":      "Regelschule",
        "istSekundarschule":   "Sekundarschule",
        "istGemeinschaftsschule": "Gemeinschaftsschule",
        "istGesamtschule":     "Gesamtschule",
        "istGanztagsschule":   "Ganztagsschule",
        "istAusbildungsschule": "Ausbildungsschule",
        "istBekenntnisschule": "Bekenntnisschule",
    }
    return [label for key, label in mapping.items() if schule.get(key)]


def _build_schule_summary(schule, zahlen_fuer_schule):
    kpis = _compute_kpis(schule, zahlen_fuer_schule)
    return {
        "id": schule["id"],
        "name": schule["Name"],
        "stiftung": schule.get("Stiftung", ""),
        "bundesland": schule.get("Bundesland", ""),
        "ort": schule.get("Ort", ""),
        "plz": schule.get("PLZ", ""),
        "schultypen": _schultypen(schule),
        "leiter": schule.get("Leiter", ""),
        "gruendungsjahr": schule.get("Gruendungsjahr"),
        "latitude": schule.get("Latitude"),
        "longitude": schule.get("Longitude"),
        **kpis,
    }


def _build_zahlen_history(zahlen_fuer_schule):
    """Jahresverlauf der Schülerzahlen für Charts (1 August-Datensatz je Jahr)."""
    records = [z for z in zahlen_fuer_schule if z.get("Schuljahr")]
    records.sort(key=lambda z: z["Schuljahr"][0]["Jahr"])
    result = []
    for z in records:
        j = z["Schuljahr"][0]["Jahr"]
        gesamt = _parse_int(z.get("Gesamt"))
        if gesamt is None:
            continue
        result.append({
            "schuljahr": f"{j}/{j+1}",
            "label": f"{j}/{str(j+1)[2:]}",  # z.B. "2023/24"
            "jahr": j,
            "gesamt": gesamt,
            "maennlich": _parse_int(z.get("maennlich")),
            "weiblich": _parse_int(z.get("weiblich")),
            "prognose_folgejahr1": _parse_int(z.get("Gesamt_Folgejahr1")),
            "spg_gesamt": _spg_total(z),
            "spg_koerperlich": _parse_int(z.get("SPG_koerperlich")),
            "spg_geistig": _parse_int(z.get("SPG_geistig")),
            "spg_lernen": _parse_int(z.get("SPG_lernen")),
            "spg_emotional": _parse_int(z.get("SPG_emotional")),
            "spg_sprachlich": _parse_int(z.get("SPG_sprachlich")),
            "spg_begabt": _parse_int(z.get("SPG_begabt")),
            "evangelisch": _parse_int(z.get("evangelisch")),
            "konfessionslos": _parse_int(z.get("konfessionslos")),
            "anmeldungen_1": _parse_int(z.get("Anmeldungen_1")),
            "empfehlung_gym": _parse_int(z.get("EmpfehlungGYM")),
            "empfehlung_rs": _parse_int(z.get("EmpfehlungRS")),
            "empfehlung_gs": _parse_int(z.get("EmpfehlungGS")),
            "jahrgaenge": {
                f"j{i}": _parse_int(z.get(f"Jahrgang{i}Gesamt"))
                for i in range(1, 13)
                if _parse_int(z.get(f"Jahrgang{i}Gesamt")) is not None
            },
        })
    return result


# ── API Endpoints ─────────────────────────────────────────────────────────────

@app.route("/api/meta")
def meta():
    data = _load_data()
    return jsonify({
        "fetched_at": data["fetched_at"],
        "anzahl_schulen": len(data["schulen"]),
        "anzahl_datensaetze": len(data["schuelerzahlen"]),
        "thresholds": THRESHOLDS,
    })


@app.route("/api/filter-options")
def filter_options():
    data = _load_data()
    schulen = data["schulen"]
    bundeslaender = sorted({s.get("Bundesland", "") for s in schulen if s.get("Bundesland")})
    stiftungen = sorted({s.get("Stiftung", "") for s in schulen if s.get("Stiftung")})
    typen_set = set()
    for s in schulen:
        typen_set.update(_schultypen(s))
    return jsonify({
        "bundeslaender": bundeslaender,
        "stiftungen": stiftungen,
        "schultypen": sorted(typen_set),
    })


@app.route("/api/schulen")
def schulen_liste():
    data = _load_data()
    zahlen_by_schule = {}
    for z in data["schuelerzahlen"]:
        sid = z.get("Schule") if isinstance(z.get("Schule"), int) else (
            z["Schule"][0]["id"] if isinstance(z.get("Schule"), list) and z["Schule"] else None
        )
        if sid is None:
            continue
        zahlen_by_schule.setdefault(sid, []).append(z)

    result = []
    for s in data["schulen"]:
        zahlen = zahlen_by_schule.get(s["id"], [])
        result.append(_build_schule_summary(s, zahlen))
    return jsonify(result)


@app.route("/api/schulen/<int:schule_id>")
def schule_detail(schule_id):
    data = _load_data()
    schule = next((s for s in data["schulen"] if s["id"] == schule_id), None)
    if not schule:
        abort(404)

    zahlen_fuer_schule = []
    for z in data["schuelerzahlen"]:
        sid = z.get("Schule") if isinstance(z.get("Schule"), int) else (
            z["Schule"][0]["id"] if isinstance(z.get("Schule"), list) and z["Schule"] else None
        )
        if sid == schule_id:
            zahlen_fuer_schule.append(z)

    summary = _build_schule_summary(schule, zahlen_fuer_schule)
    summary["details"] = {
        "telefon": schule.get("Telefon"),
        "email": schule.get("Email"),
        "homepage": schule.get("Homepage"),
        "strasse": schule.get("Strasse"),
        "anzahl_klassenraeume": _parse_int(schule.get("AnzahlKlassenraeume")),
        "anzahl_diff_raeume": _parse_int(schule.get("AnzahlDiffRaeume")),
        "anzahl_hort_raeume": _parse_int(schule.get("AnzahlHortraeume")),
        "anzahl_personen": _parse_int(schule.get("AnzahlPersonen")),
        "anzahl_vbe": _parse_int(schule.get("AnzahlVbe")),
        "altersdurchschnitt": schule.get("Altersdurchschnitt"),
        "ist_genehmigt": schule.get("istGenehmigt"),
        "ist_anerkannt": schule.get("istAnerkannt"),
        "lerngruppenzahl": _parse_int(schule.get("Lerngruppenzahl")),
        "fortbildung_tage": _parse_int(schule.get("FortbildungTage")),
        "evaluation_extern": schule.get("EvaluationExtern"),
    }
    summary["schuelerzahlen_history"] = _build_zahlen_history(zahlen_fuer_schule)
    return jsonify(summary)


@app.route("/api/uebersicht")
def uebersicht():
    """Aggregierte Kennzahlen über alle Schulen."""
    data = _load_data()
    zahlen_by_schule = {}
    for z in data["schuelerzahlen"]:
        sid = z.get("Schule") if isinstance(z.get("Schule"), int) else (
            z["Schule"][0]["id"] if isinstance(z.get("Schule"), list) and z["Schule"] else None
        )
        if sid is None:
            continue
        zahlen_by_schule.setdefault(sid, []).append(z)

    summaries = []
    for s in data["schulen"]:
        zahlen = zahlen_by_schule.get(s["id"], [])
        summaries.append(_build_schule_summary(s, zahlen))

    with_data = [s for s in summaries if s["gesamt_schueler"] is not None]
    total_schueler = sum(s["gesamt_schueler"] for s in with_data)

    ampel_counts = {"green": 0, "yellow": 0, "red": 0, "gray": 0}
    for s in summaries:
        ampeln = list(s["ampel"].values())
        if "red" in ampeln:
            ampel_counts["red"] += 1
        elif "yellow" in ampeln:
            ampel_counts["yellow"] += 1
        elif "green" in ampeln:
            ampel_counts["green"] += 1
        else:
            ampel_counts["gray"] += 1

    esm_schulen = [s for s in summaries if s["stiftung"] == "ESM"]
    kos_schulen = [s for s in summaries if s["stiftung"] == "KOS"]

    return jsonify({
        "gesamt_schulen": len(summaries),
        "gesamt_schueler": total_schueler,
        "schulen_mit_daten": len(with_data),
        "ampel_verteilung": ampel_counts,
        "esm": {
            "anzahl": len(esm_schulen),
            "schueler": sum(s["gesamt_schueler"] for s in esm_schulen
                           if s["gesamt_schueler"] is not None),
        },
        "kos": {
            "anzahl": len(kos_schulen),
            "schueler": sum(s["gesamt_schueler"] for s in kos_schulen
                           if s["gesamt_schueler"] is not None),
        },
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
