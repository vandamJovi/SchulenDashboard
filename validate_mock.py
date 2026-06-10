"""Einmalige Plausibilitätsprüfung für data/mock_klassen.json (Review-Hilfsskript)."""
import json

with open("data/mock_klassen.json", encoding="utf-8") as f:
    mock = json.load(f)
with open("data/kesep_data.json", encoding="utf-8") as f:
    kesep = json.load(f)

schulen_by_id = {s["id"]: s for s in kesep["schulen"]}
fehler = []

for sid, schule in mock.items():
    lehrer_by_id = {l["id"]: l for l in schule["lehrer"]}
    name = schulen_by_id[int(sid)].get("Name", sid)

    for l in schule["lehrer"]:
        # 1. Historische Fächer identisch über alle Jahre + Teilmenge der Lehrfächer
        jahres_faecher = [set(v.keys()) for v in l["historisch"].values()]
        if len(set(map(frozenset, jahres_faecher))) > 1:
            fehler.append(f"{name}: {l['vorname']} {l['nachname']} wechselt Fächer zwischen Jahren: {jahres_faecher}")
        for jf in jahres_faecher:
            if not jf <= set(l["faecher"]):
                fehler.append(f"{name}: {l['vorname']} {l['nachname']} Historie {jf} nicht in Lehrfächern {l['faecher']}")
        # 2. Letztes Jahr == aktuelle Schnitte
        if l["historisch"]["2024/25"] != l["aktuell_schnitte"]:
            fehler.append(f"{name}: {l['vorname']} {l['nachname']} Historie 2024/25 != aktuell")
        # 3. Aktuell unterrichtete Fächer in Lehrfächern
        if not set(l["aktuell_schnitte"].keys()) <= set(l["faecher"]):
            fehler.append(f"{name}: {l['vorname']} {l['nachname']} unterrichtet außerhalb der Lehrfächer")

    ist_grundschule = schulen_by_id[int(sid)].get("istGrundschule") or "grundschule" in name.lower()
    ist_rein_grundschule = ist_grundschule and not any(
        schulen_by_id[int(sid)].get(k) for k in
        ["istGymnasium", "istRegelschule", "istSekundarschule", "istGemeinschaftsschule", "istGesamtschule"]
    )

    for kl in schule["klassen"]:
        # 4. Fachlehrer qualifiziert
        for fach, fs in kl["fach_schnitte"].items():
            l = lehrer_by_id[fs["lehrer_id"]]
            if fach not in l["faecher"]:
                fehler.append(f"{name} {kl['bezeichnung']}: {fach} von unqualifiziertem Lehrer {l['nachname']}")
        # 5. Klassenlehrer unterrichtet die Klasse
        if kl["klassenlehrer_id"] not in {fs["lehrer_id"] for fs in kl["fach_schnitte"].values()}:
            fehler.append(f"{name} {kl['bezeichnung']}: Klassenlehrer unterrichtet die Klasse nicht")
        # 6. Jahrgänge passen zum Schultyp
        if ist_rein_grundschule and kl["jahrgang"] > 4:
            fehler.append(f"{name}: Grundschule mit Klasse {kl['bezeichnung']}")

if fehler:
    print(f"{len(fehler)} Probleme gefunden:")
    for f_ in fehler[:30]:
        print(" -", f_)
else:
    print("Alle Prüfungen bestanden:")
    print(f"  {len(mock)} Schulen, {sum(len(s['klassen']) for s in mock.values())} Klassen, {sum(len(s['lehrer']) for s in mock.values())} Lehrer")
    print("  1. Lehrer-Fächer über alle Jahre konstant und innerhalb der Lehrfächer")
    print("  2. Historie 2024/25 == aktuelle Fachschnitte")
    print("  3. Kein Unterricht außerhalb der Lehrfächer")
    print("  4. Alle Fachlehrer qualifiziert")
    print("  5. Klassenlehrer unterrichten ihre eigene Klasse")
    print("  6. Klassenstufen passen zum Schultyp")
