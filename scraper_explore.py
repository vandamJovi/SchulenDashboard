"""
KESEP Schulstiftung Dashboard Explorer
=======================================
Authenticates via SRP-6a (Hermetic.js custom protocol) and
explores all available data via the app.php REST API.

Authentication protocol (two-step SRP-6a):
  Step 1: POST app.php/Anmeldung/login/  {username, A}
          -> {sessionId, salt, B, success}
  Step 2: POST app.php/Anmeldung/login/  {M1}  (header: X-Session: sessionId)
          -> {sessionId, user (AES-encrypted), M2, success}

Request signing (every authenticated request):
  session_key K = keyHash(S)  [128 hex chars = 64 bytes]
  sign_key     y = K[32:72]   [40 hex chars used AS UTF-8 string]
  message      = method + "/" + endpoint + url_encoded_body
  signature    = HMAC-SHA256(key=y.encode('utf-8'), msg=message.encode('utf-8'))
  headers: X-Session: sessionId, X-Request-Sig: signature
  body param: _cc (connection counter, increments each request)

Data API endpoints (gsAjax proxy pattern):
  POST app.php/{Controller}/read
  POST app.php/{Controller}/create
  POST app.php/{Controller}/update
  POST app.php/{Controller}/destroy
"""

import os
import sys
import hmac
import json
import hashlib
import urllib.parse
import requests

BASE_URL = "https://kesep.ekmd-online.de"
USERNAME = "Eberl"
PASSWORD = "jwnUNR79"

# ── SRP-6a parameters (1024-bit RFC 5054 group, SHA-256) ──────────────────────
N_HEX = (
    "eeaf0ab9adb38dd69c33f80afa8fc5e86072618775ff3c0b9ea2314c9c256576d"
    "674df7496ea81d3383b4813d692c6e0e0d5d8e250b98be48e495c1d6089dad15d"
    "c7d7b46154d6b6ce8ef4ad69b15d4982559b297bcf1885c529f566660e57ec68e"
    "dbc3c05726cc02fd4cbf4976eaa9afd5138fe8376435b9fc61d2fc0eb06e3"
)
G_HEX = "02"
N = int(N_HEX, 16)
g = int(G_HEX, 16)
ML = len(N_HEX)  # 256 hex chars (128 bytes, 1024 bits)


# ── SRP helper functions ───────────────────────────────────────────────────────

def srp_hash(hex_str: str) -> str:
    """SHA-256 of hex-decoded bytes, returns lowercase hex string."""
    return hashlib.sha256(bytes.fromhex(hex_str)).hexdigest()


def pad(x: int) -> str:
    """Zero-pad integer to ML hex chars."""
    return hex(x)[2:].zfill(ML)


def compute_x(username: str, password: str, salt_hex: str) -> int:
    """
    Hermetic.js custom x computation for SHA-256 group (PBKDF2-based):
      x_bits = SHA256(username + ':' + password)
      x = PBKDF2(password=concat(salt_bytes, x_bits), salt=salt_bytes, iter=1000, dklen=32)
    """
    h_up = hashlib.sha256((username + ":" + password).encode("utf-8")).digest()
    salt_b = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", salt_b + h_up, salt_b, 1000, dklen=32)
    return int(dk.hex(), 16)


def compute_k() -> int:
    """SRP-6a multiplier k = H(N || pad(g))."""
    return int(srp_hash(N_HEX + G_HEX.zfill(ML)), 16)


def key_hash(s_hex: str) -> str:
    """
    Hermetic.js interleaved hash of SRP session secret S:
    1. Strip leading '00' pairs from S_hex
    2. Align to 4-char boundary
    3. Split into even-position bytes and odd-position bytes
    4. SHA-256 each half, then interleave the two results
    Returns 128 hex chars (64 bytes).
    """
    s = s_hex
    while s.startswith("00"):
        s = s[2:]
    if len(s) % 4:
        s = s[len(s) % 4:]
    even_hex = "".join(s[i: i + 2] for i in range(0, len(s), 4))
    odd_hex = "".join(s[i + 2: i + 4] for i in range(0, len(s), 4))
    h_e = hashlib.sha256(bytes.fromhex(even_hex)).hexdigest()
    h_o = hashlib.sha256(bytes.fromhex(odd_hex)).hexdigest()
    return "".join(h_e[i: i + 2] + h_o[i: i + 2] for i in range(0, len(h_e), 2))


def compute_m1(username: str, salt_hex: str, a_hex: str, b_hex: str,
               session_key_hex: str) -> str:
    """
    Client proof M1 = H(H(N) XOR H(g=0x02) | H(username_as_utf8_hex) | salt | A | B_padded | K)
    JS: var E=N.toHex(); C=g.toHex()='2' (odd) -> pad to '02';
        z=h(H(E)); D=h(H('02')); F=m(xor(z,D));
        y=H(Variable.fromUtf8(username).toHex()); M1=H(F+y+salt+A+B.toHex(ML)+K)
    """
    hn = srp_hash(N_HEX)
    hg = srp_hash(G_HEX)   # SHA-256 of byte 0x02 (NOT padded to ML!)
    xored = bytes(a ^ b for a, b in zip(bytes.fromhex(hn), bytes.fromhex(hg))).hex()
    h_user = srp_hash(username.encode("utf-8").hex())
    m1_input = xored + h_user + salt_hex + a_hex + b_hex.zfill(ML) + session_key_hex
    return srp_hash(m1_input)


# ── Session state ──────────────────────────────────────────────────────────────

class KesepSession:
    """Manages authenticated session with HMAC-signed requests."""

    def __init__(self):
        self.sess = requests.Session()
        self.sess.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": BASE_URL + "/",
        })
        self.session_id: str = ""
        self.sign_key: str = ""   # y = K_hex[32:72] (40 hex chars as UTF-8 string)
        self._cc: int = 0         # request counter

    def login(self, username: str, password: str) -> None:
        """Perform two-step SRP-6a login."""
        a = int(os.urandom(128).hex(), 16)
        A = pow(g, a, N)
        A_hex = pad(A)

        # Step 1
        r1 = self.sess.post(
            f"{BASE_URL}/app.php/Anmeldung/login/",
            data={"username": username, "A": A_hex},
            headers={"X-Session": os.urandom(16).hex()},
            timeout=15,
        )
        d1 = json.loads(r1.text)
        if not d1.get("success"):
            raise RuntimeError(f"SRP step 1 failed: {d1.get('message')}")

        salt_hex = d1["salt"]
        B_hex = d1["B"]
        session_id = d1["sessionId"]
        B = int(B_hex, 16)

        # Compute session key K
        x = compute_x(username, password, salt_hex)
        k = compute_k()
        u = int(srp_hash(A_hex + B_hex.zfill(ML)), 16)
        base = (B - k * pow(g, x, N) % N) % N
        S = pow(base, (a + u * x) % (N - 1), N)
        K_hex = key_hash(pad(S))

        # Compute M1 and send step 2
        M1 = compute_m1(username, salt_hex, A_hex, B_hex, K_hex)
        r2 = self.sess.post(
            f"{BASE_URL}/app.php/Anmeldung/login/",
            data={"M1": M1},
            headers={"X-Session": session_id},
            timeout=15,
        )
        d2 = json.loads(r2.text)
        if not d2.get("success"):
            raise RuntimeError(f"SRP step 2 failed: {d2.get('message')}")

        self.session_id = session_id
        self.sign_key = K_hex[32:72]   # 40 hex chars used as UTF-8 HMAC key

    def post(self, endpoint: str, data: dict) -> dict:
        """
        Authenticated POST with HMAC signature.
        message = 'POST/' + endpoint + url_encoded_body_with_cc
        """
        self._cc += 1
        payload = dict(data)
        payload["_cc"] = self._cc
        body_str = urllib.parse.urlencode(payload)
        msg = "POST/" + endpoint + body_str
        sig = hmac.new(
            self.sign_key.encode("utf-8"),
            msg.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        r = self.sess.post(
            f"{BASE_URL}/{endpoint}",
            data=payload,
            headers={"X-Session": self.session_id, "X-Request-Sig": sig},
            timeout=20,
        )
        try:
            return json.loads(r.text)
        except json.JSONDecodeError:
            return {"error": "json_decode", "status": r.status_code, "text": r.text[:200]}


def separator(title: str = "") -> None:
    line = "=" * 72
    if title:
        print(f"\n{line}\n  {title}\n{line}")
    else:
        print(line)


# ══ Main ══════════════════════════════════════════════════════════════════════

separator("KESEP Schulstiftung Dashboard Explorer")

ks = KesepSession()

# ── 1. Login ──────────────────────────────────────────────────────────────────
separator("STEP 1: SRP-6a Login")
try:
    ks.login(USERNAME, PASSWORD)
    print(f"[SUCCESS] Login successful!")
    print(f"  Session ID : {ks.session_id}")
    print(f"  Sign key   : {ks.sign_key[:20]}... (40 hex chars)")
except RuntimeError as e:
    print(f"[FAILED] {e}")
    sys.exit(1)

# ── 2. Navigation tree (Programmauswahl) ──────────────────────────────────────
separator("STEP 2: Navigation / Programmauswahl Tree")
prog = ks.post("app.php/Programmauswahl/read", {"node": "root"})
if isinstance(prog, list):
    for node in prog:
        print(f"  [{node.get('id')}] {node.get('text')} -> viewer={node.get('viewer')}")
        for child in node.get("children", [])[:3]:
            print(f"        [{child.get('id')}] {child.get('text')} "
                  f"({child.get('qtip', '')}) -> viewer={child.get('viewer')}")
        if len(node.get("children", [])) > 3:
            print(f"        ... and {len(node['children']) - 3} more")
else:
    print(f"Response: {prog}")

# ── 3. All schools (Schulen) ──────────────────────────────────────────────────
separator("STEP 3: Schulen (Schools) — Master Data")
schulen_resp = ks.post("app.php/Schulen/read", {"start": 0, "limit": 200})
schulen = schulen_resp.get("Schulen", [])
print(f"Total schools: {len(schulen)}")
print(f"\nAll fields: {list(schulen[0].keys()) if schulen else 'N/A'}")

print("\n--- Schools ---")
for s in schulen:
    typen = [k.replace("ist", "") for k in [
        "istGrundschule", "istGymnasium", "istRegelschule", "istSekundarschule",
        "istGemeinschaftsschule", "istGesamtschule", "istGanztagsschule",
        "istAusbildungsschule", "istBekenntnisschule",
    ] if s.get(k)]
    print(
        f"  [{s['id']:3d}] {s['Name']:<55s} | "
        f"{s.get('PLZ',''):5s} {s.get('Ort',''):<25s} | "
        f"{s.get('Bundesland',''):<15s} | "
        f"{s.get('Stiftung',''):4s} | "
        f"{', '.join(typen) or 'k.A.'}"
    )

# ── 4. Available school years ─────────────────────────────────────────────────
separator("STEP 4: Available School Years (Schuljahre)")
jahre_resp = ks.post("app.php/Schuelerzahlen/jahre", {"start": 0, "limit": 50})
jahre = jahre_resp.get("Jahre", [])
print(f"School years available ({len(jahre)}):")
for j in jahre:
    print(f"  {j['Jahr']} / {j['Jahr'] + 1}  (key: Jahr={j['Jahr']})")

# ── 5. School months ──────────────────────────────────────────────────────────
monate_resp = ks.post("app.php/Schulmonate/read", {"start": 0, "limit": 20})
monate = monate_resp.get("Schulmonate", [])
print(f"\nSchool months ({len(monate)}): {[m['Name'] for m in monate]}")

# ── 6. Pupil counts (Schülerzahlen) per school ───────────────────────────────
separator("STEP 5: Schülerzahlen (Pupil Counts) — All Schools")

preload_param = json.dumps([
    {"property": "Schule", "value": True},
    {"property": "Schuljahr", "value": True},
    {"property": "Schulmonat", "value": True},
])

all_zahlen = []
schools_with_data = 0
for s in schulen:
    filt = json.dumps([{"property": "Schule", "value": s["id"]}])
    resp = ks.post("app.php/Schuelerzahlen/read", {
        "start": 0, "limit": 200,
        "filter": filt,
        "preload": preload_param,
    })
    zahlen = resp.get("Schuelerzahlen", [])
    for z in zahlen:
        z["_schulName"] = s["Name"]
        z["_schulStiftung"] = s.get("Stiftung", "")
    all_zahlen.extend(zahlen)
    filled = [z for z in zahlen if z.get("Gesamt") not in ("", None)]
    if filled:
        schools_with_data += 1

print(f"Total Schuelerzahl records : {len(all_zahlen)}")
print(f"Schools with filled data   : {schools_with_data} / {len(schulen)}")

# Show first filled record fields
filled_all = [z for z in all_zahlen if z.get("Gesamt") not in ("", None)]
print(f"Records with Gesamt filled : {len(filled_all)}")

if filled_all:
    print("\nAll fields in Schuelerzahl record:")
    print(list(filled_all[0].keys()))

print("\n--- School pupil count summary (max Gesamt across years) ---")
summary: dict = {}
for z in all_zahlen:
    name = z["_schulName"]
    stiftung = z["_schulStiftung"]
    gesamt_raw = z.get("Gesamt", "")
    gesamt = int(gesamt_raw) if str(gesamt_raw).lstrip("-").isdigit() else 0

    # Get year from nested Schuljahr association
    schuljahr_list = z.get("Schuljahr", [])
    jahr = schuljahr_list[0]["Jahr"] if schuljahr_list else "?"
    monat_list = z.get("Schulmonat", [])
    monat = monat_list[0]["Name"] if monat_list else "?"

    if name not in summary:
        summary[name] = {
            "stiftung": stiftung,
            "records": 0,
            "latest_gesamt": 0,
            "latest_year": 0,
            "latest_month": "",
            "maennlich": 0,
            "weiblich": 0,
        }
    summary[name]["records"] += 1
    if gesamt > 0 and str(jahr).isdigit() and int(jahr) >= summary[name]["latest_year"]:
        summary[name]["latest_year"] = int(jahr)
        summary[name]["latest_gesamt"] = gesamt
        summary[name]["latest_month"] = monat
        summary[name]["maennlich"] = int(z.get("maennlich") or 0)
        summary[name]["weiblich"] = int(z.get("weiblich") or 0)

for name in sorted(summary.keys()):
    info = summary[name]
    if info["latest_gesamt"] > 0:
        print(
            f"  {info['stiftung']:4s} | {name:<55s} | "
            f"SJ {info['latest_year']}/{info['latest_year']+1} | "
            f"Gesamt={info['latest_gesamt']:4d} | "
            f"m={info['maennlich']:4d} w={info['weiblich']:4d}"
        )

# ── 7. Users ──────────────────────────────────────────────────────────────────
separator("STEP 6: Benutzer (User Accounts)")
users_resp = ks.post("app.php/Benutzers/read", {"start": 0, "limit": 100})
users = users_resp.get("Benutzers", [])
print(f"Total users: {len(users)}")
for u in users:
    roles = []
    if u.get("Administrator"):
        roles.append("Admin")
    if u.get("canSeeEsm"):
        roles.append("ESM")
    if u.get("canSeeKos"):
        roles.append("KOS")
    if u.get("canSeeEjs"):
        roles.append("EJS")
    print(f"  {u.get('username', '?'):<20s} {', '.join(roles)}")

# ── 8. Detailed view of one school record ────────────────────────────────────
separator("STEP 7: Full Schema — First School Record")
if schulen:
    print(json.dumps(schulen[0], indent=2, ensure_ascii=False))

# ── 9. Full schema of one Schuelerzahl record ─────────────────────────────────
separator("STEP 8: Full Schema — First Filled Schuelerzahl Record")
if filled_all:
    print(json.dumps(filled_all[0], indent=2, ensure_ascii=False))

# ── Summary ───────────────────────────────────────────────────────────────────
separator("SUMMARY — KESEP Dashboard Data Map")
print(f"""
BASE URL:          {BASE_URL}
APPLICATION TYPE:  Single-Page App (ExtJS 4, Hermetic.js, SJCL)

─── Authentication ───────────────────────────────────────────────────────────
Protocol:    SRP-6a (Secure Remote Password), 2-step exchange
Group:       1024-bit (RFC 5054 prime, g=2)
Hash:        SHA-256
Key deriv:   PBKDF2(concat(salt, SHA256(user:pass)), salt, 1000 iter, 32 bytes)
Step 1 URL:  POST app.php/Anmeldung/login/ {{username, A}}
Step 2 URL:  POST app.php/Anmeldung/login/ {{M1}} header: X-Session
Session:     Stored in PHPSESSID + X-Session header

─── Request Signing ──────────────────────────────────────────────────────────
sign_key  = session_key_hex[32:72]  (40 hex chars as UTF-8 string)
message   = "POST/" + endpoint + url_encoded_body (including _cc counter)
signature = HMAC-SHA256(key=sign_key.encode('utf-8'), msg=message.encode('utf-8'))
Header:     X-Session + X-Request-Sig on every request
Counter:    _cc (connection counter) starts at 1, increments per request

─── API Endpoints ────────────────────────────────────────────────────────────
app.php/Schulen/read                -> School master data
app.php/Schuelerzahlen/read         -> Pupil counts (requires filter=[{{'property':'Schule','value':id}}])
app.php/Schuelerzahlen/jahre        -> Available school years list
app.php/Schulmonate/read            -> School months (Aug-Mai)
app.php/Schuljahre/read             -> School years with Sollzahl targets
app.php/Benutzers/read              -> User accounts (admin only)
app.php/Programmauswahl/read        -> Navigation tree (node=root)
app.php/Bilder/read                 -> School images (type=SchulBilder|GebaeudeFotos)
app.php/Dokumente/read              -> PDF documents
app.php/Anmeldung/login/            -> SRP login (steps 1 & 2)
app.php/Anmeldung/logout/           -> POST logout
app.php/Poll/keepalive/             -> Session keepalive

─── Schulen Data Model (42 schools: 26 ESM + 6 KOS) ─────────────────────────
Identity:     id, uId, Name, Stiftung (ESM/KOS), Nummer, Gruendungsjahr
Address:      Strasse, PLZ, Ort, Bundesland
Contact:      Telefon, Telefax, Email, Homepage
Geo:          Latitude, Longitude, Accuracy
School types: istGrundschule, istGymnasium, istRegelschule,
              istSekundarschule, istGemeinschaftsschule, istGesamtschule,
              istGanztagsschule, istAusbildungsschule, istBekenntnisschule
Status:       istGenehmigt, genehmigtAm, istAnerkannt, anerkanntAm
Leadership:   Leiter, username (login)
Building:     AnzahlKlassenraeume, AnzahlDiffRaeume, AnzahlHortraeume,
              FreiflaecheProSchueler, RaumangebotBedarfsgerecht
Personnel:    AnzahlPersonen, AnzahlVbe, PaedagogenMaennlich,
              PaedagogenWeiblich, Altersdurchschnitt
Finance:      ErtraegeAllgemein, ErtraegeProSchueler, ErgebnisAllgemein,
              AufwendungProSchueler, LehrerSchuelerrelation
Quality:      Lerngruppenzahl, EntwicklungSteuergruppe,
              EvaluationExtern, FortbildungTage, VernetzungTreffen

─── Schuelerzahlen Data Model ────────────────────────────────────────────────
Relations:    Schule (nested), Schuljahr (Jahr, Sollzahl), Schulmonat (Name)
Totals:       Gesamt, Gesamt_Folgejahr1, Gesamt_Folgejahr2
Gender:       maennlich, weiblich
Religion:     evangelisch, katholisch, ukrainisch, juedisch, muslimisch,
              andereKonfession, konfessionslos
Per grade:    Jahrgang1Gesamt ... Jahrgang12Gesamt
SPG (needs):  SPG_koerperlich, SPG_geistig, SPG_sehen, SPG_hoeren,
              SPG_lernen, SPG_emotional, SPG_sprachlich, SPG_begabt
Forecast:     SPG_A_Folgejahr1/2, SPG_B_Folgejahr1/2
Transitions:  EmpfehlungGYM, EmpfehlungRS, EmpfehlungGS
Admissions:   Anmeldungen_1, Anmeldungen_2 (future years)
Metadata:     updatedAt, updatedBy

─── Stats ────────────────────────────────────────────────────────────────────
Schools:      {len(schulen)} total
School years: {len(jahre)} available (2013-2025)
Months:       {len(monate)} per year (Aug-Mai)
Total records:{len(all_zahlen)} Schuelerzahl records
With data:    {len(filled_all)} records have Gesamt filled

─── Navigation Modules ───────────────────────────────────────────────────────
Situation     -> Stammdaten, Status, Beschreibung, Bilder
Organisation  -> Organisationstab, Unterricht, Gebaeude
Qualität      -> Konzept, Steuergruppe, Entwicklung, Evaluation,
               Fortbildung, Vernetzung, Prüfungen
Personal      -> Personal-Übersicht, Bemerkungen
Finanzen      -> Finanzen-Übersicht, Bemerkungen
Öff.Arbeit    -> Öffentlichkeitsarbeit
Schülerzahlen -> Aktuell (grid + form), Planung
Gesamtstatistik -> Aktuell, Planung
Benutzer      -> User management (admin only)
""")

separator("DONE")
