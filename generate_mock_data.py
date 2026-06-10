"""
Generiert realistische Mock-Daten für Klassen, Schüler, Lehrer und Noten.
Speichert das Ergebnis in data/mock_klassen.json

Enthält:
- Klassen, Schüler, Lehrer, Noten (1-6)
- Fehlzeiten pro Schüler (entschuldigt/unentschuldigt)
- Lernentwicklung: Halbjahres-Schnitte über 3 Schuljahre
- Historische Lehrerdaten: Klassenschnitte der letzten 3 Jahre
- Schulklima-Score pro Klasse

Plausibilitäts-Garantien:
- Schultypen kommen aus den ist*-Flags der KESEP-Daten (wie im Backend),
  d.h. Grundschulen bekommen Klassen 1-4, Gymnasien 5-12 usw.
- Jeder Lehrer hat feste Lehrfächer; Historie und aktueller Unterricht
  bewegen sich ausschließlich innerhalb dieser Fächer.
- Das letzte historische Schuljahr entspricht exakt den aktuellen
  Fachschnitten, frühere Jahre driften leicht darum.
- Der Klassenlehrer unterrichtet selbst in seiner Klasse.
- Die Mock-Schülerzahl orientiert sich an der realen Gesamtschülerzahl.
"""

import json
import os
import random
from datetime import date, timedelta

random.seed(42)

SCHULJAHRE = ["2022/23", "2023/24", "2024/25"]

VORNAMEN_M = [
    "Lukas", "Leon", "Felix", "Paul", "Jonas", "Noah", "Ben", "Elias",
    "Finn", "Luca", "Maximilian", "Tim", "Jan", "Nico", "Moritz", "Julian",
    "Tobias", "Philipp", "Erik", "Simon", "David", "Alexander", "Fabian", "Florian",
]
VORNAMEN_W = [
    "Emma", "Hannah", "Mia", "Lena", "Laura", "Sarah", "Anna", "Julia",
    "Lisa", "Lea", "Sophie", "Marie", "Clara", "Lara", "Katharina", "Nina",
    "Maja", "Jana", "Leonie", "Alina", "Amelie", "Charlotte", "Johanna", "Emilia",
]
NACHNAMEN = [
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner",
    "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch", "Richter", "Bauer",
    "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun",
    "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Krause",
]
LEHRER_VORNAMEN_M = ["Thomas", "Michael", "Andreas", "Stefan", "Christian", "Klaus",
                      "Jürgen", "Peter", "Ralf", "Markus", "Frank", "Matthias"]
LEHRER_VORNAMEN_W = ["Sabine", "Petra", "Monika", "Claudia", "Andrea", "Susanne",
                      "Kerstin", "Anja", "Nicole", "Katrin", "Birgit", "Heike"]

FAECHER_GRUNDSCHULE    = ["Deutsch", "Mathematik", "Sachunterricht", "Englisch", "Sport", "Kunst", "Musik"]
FAECHER_SEK1           = ["Deutsch", "Mathematik", "Englisch", "Biologie", "Geschichte", "Geografie", "Sport", "Kunst", "Ethik"]
FAECHER_SEK1_ERWEITERT = ["Deutsch", "Mathematik", "Englisch", "Biologie", "Chemie", "Physik",
                           "Geschichte", "Geografie", "Sport", "Kunst", "Ethik", "Informatik"]
FAECHER_GYMNASIUM      = ["Deutsch", "Mathematik", "Englisch", "Französisch", "Biologie", "Chemie",
                           "Physik", "Geschichte", "Geografie", "Sport", "Kunst", "Ethik", "Informatik"]

NOTE_ARTEN = ["Klassenarbeit", "Test", "Mündlich"]

# Gleiche Ableitung wie _schultypen() im Backend — die KESEP-Daten haben
# keinen "Schultypen"-Schlüssel, sondern nur boolesche ist*-Flags.
SCHULTYP_FLAGS = {
    "istGrundschule":         "Grundschule",
    "istGymnasium":           "Gymnasium",
    "istRegelschule":         "Regelschule",
    "istSekundarschule":      "Sekundarschule",
    "istGemeinschaftsschule": "Gemeinschaftsschule",
    "istGesamtschule":        "Gesamtschule",
    "istGanztagsschule":      "Ganztagsschule",
    "istAusbildungsschule":   "Ausbildungsschule",
    "istBekenntnisschule":    "Bekenntnisschule",
}


def zufaellige_note(basis=3.0, streuung=1.0):
    return max(1.0, min(6.0, round(random.gauss(basis, streuung), 1)))

def lehrer_kuerzel(vorname, nachname):
    return (vorname[0] + nachname[:3]).upper()

def stabiler_hash(*teile):
    """Deterministischer Hash — hash() ist durch PYTHONHASHSEED nicht reproduzierbar."""
    text = "|".join(str(t) for t in teile)
    wert = 0
    for c in text:
        wert = (wert * 31 + ord(c)) % 1_000_003
    return wert

def schultypen_aus_flags(schule):
    typen = [label for flag, label in SCHULTYP_FLAGS.items() if schule.get(flag)]
    if not typen:
        # Fallback: Schulen ohne gesetzte Flags über den Namen einordnen
        name = (schule.get("Name") or "").lower()
        for label in ["Grundschule", "Gymnasium", "Regelschule", "Sekundarschule",
                      "Gemeinschaftsschule", "Gesamtschule"]:
            if label.lower() in name:
                typen.append(label)
                break
    return typen

def schultyp_zu_faecher(schultypen):
    t = " ".join(schultypen).lower()
    if "gymnasium" in t:            return FAECHER_GYMNASIUM
    if "regelschule" in t or "mittelschule" in t or "sekundarschule" in t:
        return FAECHER_SEK1_ERWEITERT
    if "grundschule" in t:          return FAECHER_GRUNDSCHULE
    return FAECHER_SEK1

def jahrgaenge_fuer_schultyp(schultypen):
    t = " ".join(schultypen).lower()
    if "gymnasium" in t:            return list(range(5, 13))
    if "grundschule" in t and any(x in t for x in ["regelschule", "mittelschule", "gesamtschule", "gemeinschaftsschule", "sekundarschule"]):
        return list(range(1, 11))
    if "grundschule" in t:          return list(range(1, 5))
    if "regelschule" in t or "mittelschule" in t or "sekundarschule" in t:
        return list(range(5, 11))
    return list(range(5, 11))


def generiere_schule(schule_id, schultypen, gesamt_schueler):
    faecher    = schultyp_zu_faecher(schultypen)
    jahrgaenge = jahrgaenge_fuer_schultyp(schultypen)
    ziel_schueler = gesamt_schueler or 200

    # ── Lehrer-Pool ──────────────────────────────────────────────────────────
    anzahl_lehrer = max(5, ziel_schueler // 15)

    # Lehrfächer mit garantierter Abdeckung: erst jedes Fach mindestens einmal
    # verteilen, dann freie Plätze zufällig auffüllen.
    fach_warteschlange = faecher[:]
    random.shuffle(fach_warteschlange)

    lehrer_pool = []
    for i in range(anzahl_lehrer):
        if random.random() > 0.45:
            vn = random.choice(LEHRER_VORNAMEN_W)
        else:
            vn = random.choice(LEHRER_VORNAMEN_M)
        nn = random.choice(NACHNAMEN)

        lehrfaecher = set()
        while len(lehrfaecher) < min(3, len(faecher)):
            if fach_warteschlange:
                lehrfaecher.add(fach_warteschlange.pop())
            else:
                lehrfaecher.add(random.choice(faecher))

        lehrer_pool.append({
            "id": i + 1,
            "vorname": vn,
            "nachname": nn,
            "kuerzel": lehrer_kuerzel(vn, nn),
            "faecher": sorted(lehrfaecher),
            "fortbildung_stunden": random.randint(8, 60),
            "dienstjahre": random.randint(1, 35),
        })

    def lehrer_fuer_fach(fach, jahrgang):
        kandidaten = [l for l in lehrer_pool if fach in l["faecher"]] or lehrer_pool
        idx = stabiler_hash(schule_id, fach, jahrgang // 2) % len(kandidaten)
        return kandidaten[idx]

    # ── Klassen & Schüler ─────────────────────────────────────────────────────
    klassen = []
    klassen_id = 1
    schueler_id_global = 1

    # Klassengrößen so wählen, dass die Mock-Summe nahe der realen Schülerzahl liegt
    pro_jahrgang = max(12, round(ziel_schueler / len(jahrgaenge)))
    anzahl_klassen_je_jahrgang = max(1, min(3, round(pro_jahrgang / 24)))
    basis_groesse = max(10, min(30, round(pro_jahrgang / anzahl_klassen_je_jahrgang)))

    for jg in jahrgaenge:
        for buch in ["a", "b", "c"][:anzahl_klassen_je_jahrgang]:
            anzahl_schueler = max(8, basis_groesse + random.randint(-2, 2))
            schulklima_score = round(random.gauss(3.5, 0.6), 1)
            schulklima_score = max(1.0, min(5.0, schulklima_score))

            schueler_liste = []
            for _ in range(anzahl_schueler):
                if random.random() > 0.5:
                    vn, geschlecht = random.choice(VORNAMEN_W), "w"
                else:
                    vn, geschlecht = random.choice(VORNAMEN_M), "m"
                nn = random.choice(NACHNAMEN)

                schueler_basis = max(1.5, min(5.5, random.gauss(3.0, 0.8)))

                # Fehlzeiten
                fehlzeiten_gesamt = max(0, int(random.gauss(12, 8)))
                fehlzeiten_entschuldigt = int(fehlzeiten_gesamt * random.uniform(0.6, 1.0))
                fehlzeiten_unentschuldigt = fehlzeiten_gesamt - fehlzeiten_entschuldigt

                # Lernentwicklung: Halbjahres-Schnitte der letzten 3 Jahre
                lernentwicklung = {}
                for sj_idx, sj in enumerate(SCHULJAHRE):
                    trend = (sj_idx - 1) * random.gauss(0, 0.2)  # leichte Drift über Jahre
                    lernentwicklung[sj] = {
                        "HJ1": round(max(1.0, min(6.0, random.gauss(schueler_basis + trend + 0.1, 0.4))), 2),
                        "HJ2": round(max(1.0, min(6.0, random.gauss(schueler_basis + trend, 0.4))), 2),
                    }

                # Aktuelle Noten pro Fach
                noten_pro_fach = {}
                for fach in faecher:
                    lehrer = lehrer_fuer_fach(fach, jg)
                    lehrer_effekt = ((lehrer["id"] * 7 + stabiler_hash(fach)) % 10 - 5) * 0.1
                    fach_basis = schueler_basis + lehrer_effekt
                    einzel_noten = []
                    for art in NOTE_ARTEN:
                        for _ in range(2 if art == "Klassenarbeit" else 1):
                            start = date(2025, 8, 1)
                            datum = start + timedelta(days=random.randint(0, 300))
                            einzel_noten.append({
                                "art": art,
                                "wert": zufaellige_note(fach_basis, 0.7),
                                "datum": datum.isoformat(),
                            })
                    schnitt = round(sum(n["wert"] for n in einzel_noten) / len(einzel_noten), 2)
                    noten_pro_fach[fach] = {
                        "lehrer_id": lehrer["id"],
                        "noten": einzel_noten,
                        "schnitt": schnitt,
                    }

                gesamt_schnitt = round(sum(noten_pro_fach[f]["schnitt"] for f in faecher) / len(faecher), 2)

                # Verbesserungs-Trend (aktueller Schnitt vs. Vorjahr HJ2)
                vorjahr_schnitt = lernentwicklung[SCHULJAHRE[-2]]["HJ2"]
                trend_delta = round(vorjahr_schnitt - gesamt_schnitt, 2)  # positiv = verbessert

                schueler_liste.append({
                    "id": schueler_id_global,
                    "vorname": vn,
                    "nachname": nn,
                    "geschlecht": geschlecht,
                    "noten": noten_pro_fach,
                    "gesamt_schnitt": gesamt_schnitt,
                    "fehlzeiten": {
                        "gesamt": fehlzeiten_gesamt,
                        "entschuldigt": fehlzeiten_entschuldigt,
                        "unentschuldigt": fehlzeiten_unentschuldigt,
                        "quote_pct": round(fehlzeiten_gesamt / 200 * 100, 1),
                    },
                    "lernentwicklung": lernentwicklung,
                    "trend_delta": trend_delta,
                })
                schueler_id_global += 1

            # Klassen-Fachschnitte
            fach_schnitte = {}
            for fach in faecher:
                lehrer = lehrer_fuer_fach(fach, jg)
                schnitte = [s["noten"][fach]["schnitt"] for s in schueler_liste]
                fach_schnitte[fach] = {
                    "lehrer_id": lehrer["id"],
                    "klassen_schnitt": round(sum(schnitte) / len(schnitte), 2),
                }

            klassen_schnitt = round(
                sum(s["gesamt_schnitt"] for s in schueler_liste) / len(schueler_liste), 2
            )

            # Klassenlehrer unterrichtet selbst in der Klasse (Fach 1 = Deutsch)
            klassenlehrer_id = fach_schnitte[faecher[0]]["lehrer_id"]

            # Verbesserungsrate: % der Schüler die sich verbessert haben
            verbesserte = sum(1 for s in schueler_liste if s["trend_delta"] > 0.1)
            verbesserungsrate = round(verbesserte / len(schueler_liste) * 100, 1)

            klassen.append({
                "id": klassen_id,
                "bezeichnung": f"{jg}{buch}",
                "jahrgang": jg,
                "klassenlehrer_id": klassenlehrer_id,
                "anzahl_schueler": anzahl_schueler,
                "fach_schnitte": fach_schnitte,
                "klassen_schnitt": klassen_schnitt,
                "schulklima_score": schulklima_score,
                "verbesserungsrate_pct": verbesserungsrate,
                "fehlzeiten_schnitt": round(
                    sum(s["fehlzeiten"]["gesamt"] for s in schueler_liste) / len(schueler_liste), 1
                ),
                "schueler": schueler_liste,
            })
            klassen_id += 1

    # ── Lehrer: aktuelle Schnitte aus den Klassendaten, Historie daraus ───────
    for lehrer in lehrer_pool:
        lid = lehrer["id"]
        eigene_klassen = [kl for kl in klassen if any(
            fs.get("lehrer_id") == lid for fs in kl["fach_schnitte"].values()
        )]
        aktuell = {}
        for kl in eigene_klassen:
            for fach, fs in kl["fach_schnitte"].items():
                if fs.get("lehrer_id") == lid:
                    aktuell.setdefault(fach, []).append(fs["klassen_schnitt"])
        lehrer["aktuell_schnitte"] = {
            fach: round(sum(v) / len(v), 2) for fach, v in aktuell.items()
        }
        lehrer["anzahl_klassen"] = len(eigene_klassen)

        # Historie: gleiche Fächer wie aktuell unterrichtet, letztes Jahr = Ist,
        # frühere Jahre driften leicht — keine Fachwechsel zwischen den Jahren.
        historisch = {}
        for sj_idx, sj in enumerate(SCHULJAHRE):
            jahre_zurueck = len(SCHULJAHRE) - 1 - sj_idx
            if jahre_zurueck == 0:
                historisch[sj] = dict(lehrer["aktuell_schnitte"])
            else:
                historisch[sj] = {
                    fach: round(max(1.5, min(5.5, wert + random.gauss(0, 0.18) * jahre_zurueck)), 2)
                    for fach, wert in lehrer["aktuell_schnitte"].items()
                }
        lehrer["historisch"] = historisch

    return {
        "schule_id": schule_id,
        "faecher": faecher,
        "lehrer": lehrer_pool,
        "klassen": klassen,
    }


def main():
    with open(os.path.join("data", "kesep_data.json"), encoding="utf-8") as f:
        kesep = json.load(f)

    esm_schulen = [s for s in kesep["schulen"] if s.get("Stiftung") == "ESM"]
    zahlen_by_schule = {}
    for z in kesep["schuelerzahlen"]:
        sid = z.get("Schule", [{}])[0].get("id")
        if sid and z.get("Gesamt") not in (None, ""):
            zahlen_by_schule[sid] = int(z["Gesamt"])

    print(f"Generiere Mock-Daten für {len(esm_schulen)} ESM-Schulen...")
    result = {}
    for schule in esm_schulen:
        sid = schule["id"]
        typen = schultypen_aus_flags(schule)
        gesamt = zahlen_by_schule.get(sid, 200)
        print(f"  [{sid}] {schule.get('Name', '')} ({gesamt} Schüler, {', '.join(typen) or 'kein Typ'})...")
        result[str(sid)] = generiere_schule(sid, typen, gesamt)

    out_path = os.path.join("data", "mock_klassen.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total_klassen  = sum(len(v["klassen"]) for v in result.values())
    total_schueler = sum(sum(kl["anzahl_schueler"] for kl in v["klassen"]) for v in result.values())
    print(f"\nFertig! {out_path}")
    print(f"  Schulen:  {len(result)}")
    print(f"  Klassen:  {total_klassen}")
    print(f"  Schüler:  {total_schueler} (Mock)")


if __name__ == "__main__":
    main()
