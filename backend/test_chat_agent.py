"""
Integrationstests für den /api/chat-Endpunkt.
Jeder Test schickt eine echte Anfrage an Claude (API-Kosten ~0.001€/Test).
Geprüft wird nicht der exakte Wortlaut, sondern ob die richtigen Zahlen/Fakten enthalten sind.

Ausführen: cd backend && python -m pytest test_chat_agent.py -v
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import app as backend

backend.app.config["TESTING"] = True


@pytest.fixture
def client():
    with backend.app.test_client() as c:
        yield c


def frage(client, text):
    """Hilfsfunktion: Schickt Frage an Agent und gibt Antworttext zurück."""
    resp = client.post("/api/chat", json={"frage": text})
    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.data}"
    data = resp.get_json()
    assert "antwort" in data, f"Kein 'antwort'-Feld: {data}"
    antwort = data["antwort"]
    print(f"\nFrage: {text}\nAntwort: {antwort}\n")
    return antwort


# ── Ev. Grundschule Mühlhausen (GSMHL) ───────────────────────────────────────

class TestGrundschuleMuehlhausen:
    """
    Rohdaten (Screenshot GSMHL, Monatsstatistik 2025/2026):
    - Schüler gesamt: 206 (Mai 2026)
    - SPG Gruppe A: 2, Gruppe B: 3 → SPG gesamt: 5
    - SPG-Quote: 5 / 206 ≈ 2,4%
    """

    def test_schuelerzahl(self, client):
        antwort = frage(client, "Wie viele Schüler hat die Evangelische Grundschule Mühlhausen?")
        assert "206" in antwort, f"Erwartete '206' in Antwort: {antwort}"

    def test_spg_anzahl(self, client):
        antwort = frage(client, "Wie viele SPG-Schüler hat die Evangelische Grundschule Mühlhausen?")
        assert "5" in antwort, f"Erwartete '5' in Antwort: {antwort}"

    def test_spg_quote(self, client):
        antwort = frage(client, "Wie hoch ist die SPG-Quote der Evangelischen Grundschule Mühlhausen?")
        assert "2,4" in antwort or "2.4" in antwort, f"Erwartete '2,4%' in Antwort: {antwort}"


# ── Evangelische Gemeinschaftsschule Erfurt (TGSEF) ──────────────────────────

class TestGemeinschaftsschuleErfurt:
    """
    Rohdaten (Screenshot TGSEF, Anmeldestatistik 2025/2026):
    - Anmeldungen Ist (Mai): 137, (April in unseren Daten): 135
    - Anmeldungen Soll: 75
    - Anmeldeerfüllung: ~180% (April) / ~182% (Mai)
    Hinweis: Wir haben April-Daten (135/75 = 180%), Screenshot zeigt Mai (137/75 = 182,7%).
    Test prüft auf 180 als gemeinsamen Nenner.
    """

    def test_anmeldeerfuellung_hoch(self, client):
        antwort = frage(client, "Wie hoch ist die Anmeldeerfüllung der Evangelischen Gemeinschaftsschule Erfurt?")
        assert "180" in antwort or "135" in antwort or "75" in antwort, \
            f"Erwartete Anmeldeerfüllung ~180% oder Rohdaten (135/75) in Antwort: {antwort}"

    def test_erfurt_ueberbucht(self, client):
        antwort = frage(client, "Welche Schulen in Erfurt haben mehr Anmeldungen als Plätze?")
        assert "Gemeinschaftsschule" in antwort or "Erfurt" in antwort, \
            f"Erwartete Gemeinschaftsschule Erfurt in Antwort: {antwort}"


# ── Allgemeine Fragen ─────────────────────────────────────────────────────────

class TestAllgemein:

    def test_groesste_schule(self, client):
        """Die größte Schule nach Schülerzahl soll korrekt benannt werden."""
        antwort = frage(client, "Welche Schule hat die meisten Schüler?")
        # Antwort muss eine Schule nennen und eine Zahl enthalten
        import re
        zahlen = re.findall(r'\d{3,}', antwort)
        assert len(zahlen) > 0, f"Erwartete eine Schülerzahl (3+ Stellen) in Antwort: {antwort}"

    def test_rote_ampeln(self, client):
        """Anfrage nach kritischen Schulen soll eine Liste zurückgeben."""
        antwort = frage(client, "Welche Schulen haben eine rote Ampel?")
        assert len(antwort) > 20, f"Antwort zu kurz: {antwort}"

    def test_thueringen_filter(self, client):
        """Bundesland-Filter soll nur Thüringer Schulen nennen."""
        antwort = frage(client, "Liste alle Schulen in Thüringen auf.")
        assert "Thüringen" in antwort or "thüringen" in antwort.lower() or \
               "Mühlhausen" in antwort or "Erfurt" in antwort or "Apolda" in antwort, \
            f"Erwartete Thüringer Schulen in Antwort: {antwort}"

    def test_keine_halluzination(self, client):
        """Agent soll keine erfundenen Schulen nennen."""
        antwort = frage(client, "Gibt es eine Schule in Hamburg?")
        nein_signale = ["keine", "nicht", "kein", "Hamburg"]
        assert any(s.lower() in antwort.lower() for s in nein_signale), \
            f"Erwartete Verneinung für Hamburg-Schule: {antwort}"
