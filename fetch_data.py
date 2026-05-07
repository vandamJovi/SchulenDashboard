"""
KESEP Schulstiftung — einmaliger Daten-Abruf
Speichert alle Schulen + Schuelerzahlen als JSON in data/
"""

import os
import json
import hmac
import hashlib
import urllib.parse
from datetime import datetime

import requests

BASE_URL = "https://kesep.ekmd-online.de"
USERNAME = "Eberl"
PASSWORD = "jwnUNR79"

N_HEX = (
    "eeaf0ab9adb38dd69c33f80afa8fc5e86072618775ff3c0b9ea2314c9c256576d"
    "674df7496ea81d3383b4813d692c6e0e0d5d8e250b98be48e495c1d6089dad15d"
    "c7d7b46154d6b6ce8ef4ad69b15d4982559b297bcf1885c529f566660e57ec68e"
    "dbc3c05726cc02fd4cbf4976eaa9afd5138fe8376435b9fc61d2fc0eb06e3"
)
G_HEX = "02"
N = int(N_HEX, 16)
g = int(G_HEX, 16)
ML = len(N_HEX)


def srp_hash(hex_str):
    return hashlib.sha256(bytes.fromhex(hex_str)).hexdigest()

def pad(x):
    return hex(x)[2:].zfill(ML)

def compute_x(username, password, salt_hex):
    h_up = hashlib.sha256((username + ":" + password).encode("utf-8")).digest()
    salt_b = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", salt_b + h_up, salt_b, 1000, dklen=32)
    return int(dk.hex(), 16)

def compute_k():
    return int(srp_hash(N_HEX + G_HEX.zfill(ML)), 16)

def key_hash(s_hex):
    s = s_hex
    while s.startswith("00"):
        s = s[2:]
    if len(s) % 4:
        s = s[len(s) % 4:]
    even_hex = "".join(s[i:i+2] for i in range(0, len(s), 4))
    odd_hex  = "".join(s[i+2:i+4] for i in range(0, len(s), 4))
    h_e = hashlib.sha256(bytes.fromhex(even_hex)).hexdigest()
    h_o = hashlib.sha256(bytes.fromhex(odd_hex)).hexdigest()
    return "".join(h_e[i:i+2] + h_o[i:i+2] for i in range(0, len(h_e), 2))

def compute_m1(username, salt_hex, a_hex, b_hex, session_key_hex):
    hn = srp_hash(N_HEX)
    hg = srp_hash(G_HEX)
    xored = bytes(a ^ b for a, b in zip(bytes.fromhex(hn), bytes.fromhex(hg))).hex()
    h_user = srp_hash(username.encode("utf-8").hex())
    m1_input = xored + h_user + salt_hex + a_hex + b_hex.zfill(ML) + session_key_hex
    return srp_hash(m1_input)


class KesepSession:
    def __init__(self):
        self.sess = requests.Session()
        self.sess.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": BASE_URL + "/",
        })
        self.session_id = ""
        self.sign_key = ""
        self._cc = 0

    def login(self, username, password):
        a = int(os.urandom(128).hex(), 16)
        A = pow(g, a, N)
        A_hex = pad(A)

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

        x = compute_x(username, password, salt_hex)
        k = compute_k()
        u = int(srp_hash(A_hex + B_hex.zfill(ML)), 16)
        base = (B - k * pow(g, x, N) % N) % N
        S = pow(base, (a + u * x) % (N - 1), N)
        K_hex = key_hash(pad(S))

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
        self.sign_key = K_hex[32:72]

    def post(self, endpoint, data):
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
            return {"error": "json_decode", "text": r.text[:200]}


def fetch_all():
    print("Verbinde mit KESEP...")
    ks = KesepSession()
    ks.login(USERNAME, PASSWORD)
    print("Login erfolgreich.")

    # Schulen
    print("Lade Schulen...")
    schulen_resp = ks.post("app.php/Schulen/read", {"start": 0, "limit": 200})
    schulen = schulen_resp.get("Schulen", [])
    print(f"  {len(schulen)} Schulen gefunden.")

    # Schuljahre
    print("Lade Schuljahre...")
    jahre_resp = ks.post("app.php/Schuelerzahlen/jahre", {"start": 0, "limit": 50})
    jahre = jahre_resp.get("Jahre", [])

    # Schulmonate
    monate_resp = ks.post("app.php/Schulmonate/read", {"start": 0, "limit": 20})
    monate = monate_resp.get("Schulmonate", [])

    # Schuelerzahlen je Schule
    print("Lade Schuelerzahlen (alle Schulen, alle Jahre)...")
    preload = json.dumps([
        {"property": "Schule", "value": True},
        {"property": "Schuljahr", "value": True},
        {"property": "Schulmonat", "value": True},
    ])
    all_zahlen = []
    for i, s in enumerate(schulen, 1):
        filt = json.dumps([{"property": "Schule", "value": s["id"]}])
        resp = ks.post("app.php/Schuelerzahlen/read", {
            "start": 0, "limit": 500,
            "filter": filt,
            "preload": preload,
        })
        zahlen = resp.get("Schuelerzahlen", [])
        all_zahlen.extend(zahlen)
        print(f"  [{i:2d}/{len(schulen)}] {s['Name']}: {len(zahlen)} Datensätze")

    # Schuljahre mit Sollzahlen
    schuljahre_resp = ks.post("app.php/Schuljahre/read", {"start": 0, "limit": 50})
    schuljahre = schuljahre_resp.get("Schuljahre", [])

    os.makedirs("data", exist_ok=True)
    result = {
        "fetched_at": datetime.now().isoformat(),
        "schulen": schulen,
        "schuelerzahlen": all_zahlen,
        "schuljahre": schuljahre,
        "jahre": jahre,
        "monate": monate,
    }
    out_path = os.path.join("data", "kesep_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nFertig! Gespeichert: {out_path}")
    print(f"  Schulen:        {len(schulen)}")
    print(f"  Schuelerzahlen: {len(all_zahlen)}")
    print(f"  Schuljahre:     {len(schuljahre)}")


if __name__ == "__main__":
    fetch_all()
