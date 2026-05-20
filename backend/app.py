"""
KESEP Schulen-Dashboard — Flask Backend
Liest lokale JSON-Daten und stellt REST-API bereit.
"""

import json
import os
import functools
import urllib.request
from datetime import datetime
from flask import Flask, jsonify, abort, request, session
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-bitte-aendern")
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173",
    os.environ.get("FRONTEND_URL", ""),
])

DASHBOARD_USER     = os.environ.get("DASHBOARD_USER", "admin")
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "changeme")


def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return jsonify({"error": "Nicht angemeldet."}), 401
        return f(*args, **kwargs)
    return decorated

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


def _is_august(z):
    return z.get("Schulmonat") and z["Schulmonat"][0].get("id") == 1


def _parse_updated_at(z):
    try:
        return datetime.strptime(z.get("updatedAt", ""), "%d.%m.%Y | %H:%M Uhr")
    except (ValueError, TypeError):
        return datetime.min


def _latest_record(zahlen_fuer_schule):
    """Neuester Datensatz mit Ist-Schülerzahlen (August für Historik, letzter Monat für aktuelles Jahr)."""
    filled = [z for z in zahlen_fuer_schule if _parse_int(z.get("Gesamt")) is not None]
    if not filled:
        return None
    return max(filled, key=lambda z: z["Schuljahr"][0]["Jahr"] if z.get("Schuljahr") else 0)


def _latest_folgejahr_record(zahlen_fuer_schule):
    """Zuletzt geänderter Datensatz des neuesten Schuljahres (für Folgejahr-Anmeldungen)."""
    with_sj = [z for z in zahlen_fuer_schule if z.get("Schuljahr")]
    if not with_sj:
        return None
    latest_jahr = max(z["Schuljahr"][0]["Jahr"] for z in with_sj)
    current = [z for z in with_sj if z["Schuljahr"][0]["Jahr"] == latest_jahr]
    return max(current, key=_parse_updated_at)


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
    latest_fj = _latest_folgejahr_record(zahlen_fuer_schule)

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

    # Anmeldeerfüllung Folgejahr1: aktuellster Monatswert Ist / Soll
    anmeldungen_ist = _parse_int(latest_fj.get("Gesamt_Folgejahr1")) if latest_fj else None
    anmeldungen_soll = None
    if latest_fj and latest_fj.get("Schuljahr"):
        anmeldungen_soll = _parse_int(latest_fj["Schuljahr"][0].get("Sollzahl_Folgejahr1"))
    prognose_val = anmeldungen_ist
    prognose_pct = None
    if anmeldungen_ist is not None and anmeldungen_soll and anmeldungen_soll > 0:
        prognose_pct = round(anmeldungen_ist / anmeldungen_soll * 100, 1)

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

@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    if body.get("user") == DASHBOARD_USER and body.get("password") == DASHBOARD_PASSWORD:
        session["authenticated"] = True
        return jsonify({"ok": True})
    return jsonify({"error": "Ungültige Zugangsdaten."}), 401


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    if session.get("authenticated"):
        return jsonify({"authenticated": True})
    return jsonify({"authenticated": False}), 401


@app.route("/api/meta")
@login_required
def meta():
    data = _load_data()
    return jsonify({
        "fetched_at": data["fetched_at"],
        "anzahl_schulen": len(data["schulen"]),
        "anzahl_datensaetze": len(data["schuelerzahlen"]),
        "thresholds": THRESHOLDS,
    })


@app.route("/api/filter-options")
@login_required
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
@login_required
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
@login_required
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
    uid = schule.get("uId", "")
    foto_paths = data.get("schulbilder", {}).get(uid, [])
    BASE_IMG = "https://kesep.ekmd-online.de/"
    summary["foto_urls"] = [BASE_IMG + p for p in foto_paths]

    summary["quelldaten"] = {
        "beschreibung": schule.get("Beschreibung") or None,
        "profil": schule.get("Profil") or None,
        "profil_text": schule.get("ProfilText") or None,
        "unterricht_beschreibung": schule.get("UnterrichtBeschreibung") or None,
        "analyse": schule.get("Analyse") or None,
        "prognose_text": schule.get("Prognose") or None,
        "stufenorganisation": schule.get("Stufenorganisation") or None,
        "gemeinsamer_unterricht": schule.get("GemeinsamerUnterricht"),
        "jahrgangsmischung": schule.get("Jahrgangsmischung"),
        "gebunden": schule.get("gebunden") or None,
        "flaeche_pro_schueler": schule.get("FreiflaecheProSchueler") or None,
        "paedagogen_maennlich": _parse_int(schule.get("PaedagogenMaennlich")),
        "paedagogen_weiblich": _parse_int(schule.get("PaedagogenWeiblich")),
        "altersdurchschnitt": schule.get("Altersdurchschnitt") or None,
        "evaluation_intern": schule.get("EvaluationIntern"),
        "evaluation_extern": schule.get("EvaluationExtern"),
        "evaluation_test": schule.get("EvaluationTestTeilnahme"),
        "fortbildung_konzept": schule.get("FortbildungKonzept"),
        "entwicklung_steuergruppe": schule.get("EntwicklungSteuergruppe"),
        "entwicklung_wettbewerbe": schule.get("EntwicklungWettbewerbe"),
        "vernetzung_treffen": schule.get("VernetzungTreffen"),
        "oeff_arbeit_konzept": schule.get("OeffArbeitKonzept"),
        "investitionsbedarf": schule.get("Investitionsbedarf"),
    }
    return jsonify(summary)


@app.route("/api/uebersicht")
@login_required
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

    # Jahrgangs- und SPG-Summen über alle Schulen
    jahrgaenge_gesamt = {}
    spg_gesamt = {"lernen": 0, "emotional": 0, "sprachlich": 0, "geistig": 0, "koerperlich": 0, "begabt": 0}
    for s in data["schulen"]:
        zahlen = zahlen_by_schule.get(s["id"], [])
        latest = _latest_record(zahlen)
        if not latest:
            continue
        for i in range(1, 13):
            val = _parse_int(latest.get(f"Jahrgang{i}Gesamt"))
            if val is not None:
                jahrgaenge_gesamt[str(i)] = jahrgaenge_gesamt.get(str(i), 0) + val
        for key in spg_gesamt:
            val = _parse_int(latest.get(f"SPG_{key}"))
            if val is not None:
                spg_gesamt[key] += val

    def ampel_schulen(status):
        result = []
        for s in summaries:
            vals = list(s["ampel"].values())
            if status == "red" and "red" in vals:
                result.append({"id": s["id"], "name": s["name"], "ort": s["ort"]})
            elif status == "green" and "green" in vals and "red" not in vals and "yellow" not in vals:
                result.append({"id": s["id"], "name": s["name"], "ort": s["ort"]})
        return sorted(result, key=lambda x: x["name"])

    return jsonify({
        "gesamt_schulen": len(summaries),
        "gesamt_schueler": total_schueler,
        "schulen_mit_daten": len(with_data),
        "ampel_verteilung": ampel_counts,
        "jahrgaenge_gesamt": jahrgaenge_gesamt,
        "spg_gesamt": spg_gesamt,
        "rote_schulen": ampel_schulen("red"),
        "gruene_schulen": ampel_schulen("green"),
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


def _build_kontext():
    """Kompakte Textübersicht aller Schulen für den KI-Kontext."""
    data = _load_data()
    zahlen_by_schule = {}
    for z in data["schuelerzahlen"]:
        sid = z.get("Schule") if isinstance(z.get("Schule"), int) else (
            z["Schule"][0]["id"] if isinstance(z.get("Schule"), list) and z["Schule"] else None
        )
        if sid:
            zahlen_by_schule.setdefault(sid, []).append(z)

    lines = ["# Schulen-Übersicht (Evangelische Schulstiftung Mitteldeutschland)\n"]
    for s in data["schulen"]:
        summary = _build_schule_summary(s, zahlen_by_schule.get(s["id"], []))
        ampel_gesamt = "grün"
        vals = list(summary["ampel"].values())
        if "red" in vals:
            ampel_gesamt = "rot"
        elif "yellow" in vals:
            ampel_gesamt = "gelb"
        elif not any(v == "green" for v in vals):
            ampel_gesamt = "keine Daten"

        yoy = f"{summary['yoy_change_pct']:+}%" if summary['yoy_change_pct'] is not None else "–"
        auslastung = f"{summary['auslastung_pct']}%" if summary['auslastung_pct'] is not None else "–"
        prognose = f"{summary['prognose_pct']}%" if summary['prognose_pct'] is not None else "–"
        spg_q = f"{summary['spg_quote_pct']}%" if summary['spg_quote_pct'] is not None else "–"
        lines.append(
            f"- {summary['name']} ({summary['stiftung']}, {summary['ort']}, {summary['bundesland']})"
            f" | Schultypen: {', '.join(summary['schultypen']) or '–'}"
            f" | Schüler: {summary['gesamt_schueler'] or '–'}"
            f" | YoY: {yoy}"
            f" | Auslastung: {auslastung}"
            f" | Anmeldeerfüllung: {prognose}"
            f" | SPG-Quote: {spg_q}"
            f" | Ampel: {ampel_gesamt}"
        )
    return "\n".join(lines)


@app.route("/api/chat", methods=["POST"])
@login_required
def chat():
    body = request.get_json(silent=True) or {}
    frage = (body.get("frage") or "").strip()
    if not frage:
        return jsonify({"error": "Keine Frage angegeben."}), 400

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return jsonify({"error": "API-Key nicht konfiguriert."}), 500

    kontext = _build_kontext()

    # Anfrage an Claude API (direkt über HTTP, kein SDK nötig)
    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "system": (
            "Du bist ein Assistent für das Schulen-Dashboard der Evangelischen Schulstiftung "
            "Mitteldeutschland. Du beantwortest Fragen zu den Schuldaten präzise und auf Deutsch. "
            "Antworte kurz und direkt. Wenn du eine Liste ausgibst, halte sie übersichtlich.\n\n"
            + kontext
        ),
        "messages": [{"role": "user", "content": frage}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            antwort = result["content"][0]["text"]
            return jsonify({"antwort": antwort})
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        return jsonify({"error": f"API-Fehler: {err[:200]}"}), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)
