"""
=================================================================
DENOMATH - app.py
Backend Flask OPSIONAL untuk fitur "Tanya AI" (DENO AI)
Menggunakan: Groq API (llama-3.3-70b-versatile)
=================================================================

CATATAN PENTING:
Mulai versi ini, DENOMATH memanggil Groq API LANGSUNG dari browser —
file app.py ini TIDAK WAJIB dijalankan. Cukup buka index.html,
masukkan Groq API Key lewat widget ⚙️ di panel AI, dan selesai.

Gunakan app.py ini hanya jika kamu ingin menyembunyikan API key
dari browser (misalnya untuk deploy di sekolah/lab komputer).

=================================================================
CARA TERCEPAT (TANPA app.py — LANGSUNG DI BROWSER):
=================================================================
1. Daftar di https://console.groq.com  (GRATIS, tidak perlu kartu kredit)
2. Buka menu "API Keys" → klik "Create API Key" → salin key-nya
3. Buka index.html di browser
4. Klik tombol "Tanya AI" di pojok kanan bawah
5. Klik ikon ⚙️ di header panel AI
6. Tempelkan Groq API Key (diawali gsk_...) → klik "Simpan & Aktifkan"
7. Selesai! DENO AI langsung bisa dipakai. Key tersimpan di browser,
   tidak perlu dimasukkan ulang setiap membuka aplikasi.

=================================================================
CARA PAKAI BACKEND app.py (OPSIONAL — untuk lab/sekolah):
=================================================================
Keuntungan: API key TIDAK pernah terlihat di browser siswa.

Langkah-langkah:
1. Install Python 3.9+ → https://www.python.org/downloads/
   (Windows: centang "Add Python to PATH" saat instalasi)

2. Buka terminal/Command Prompt, masuk ke folder project:
     cd C:/Users/NamaKamu/Documents/DENOMATH

3. Install dependency (cukup sekali):
     pip install -r requirements.txt

4. Salin file "_env" → rename menjadi ".env" (titik di depan!),
   lalu isi API key:
     GROQ_API_KEY=gsk_...isiKeyGroqKamuDisini...

5. Jalankan backend:
     python app.py
   Biarkan terminal ini TETAP TERBUKA selama aplikasi dipakai.
   Kamu akan melihat: "Running on http://0.0.0.0:5000"

6. Buka index.html di browser (double-click, atau lewat XAMPP)

7. Cek apakah backend siap:
   Buka http://localhost:5000/api/health di browser.
   Harus muncul: {"status":"ok","provider_ready":true}

Catatan untuk XAMPP:
- XAMPP hanya menyajikan file HTML/CSS/JS via Apache.
- app.py TETAP harus dijalankan terpisah lewat "python app.py".
- Salin folder project ke C:/xampp/htdocs/denomath/
- Jalankan Apache di XAMPP, buka http://localhost/denomath/
- Pastikan python app.py masih berjalan di terminal terpisah.

=================================================================
"""

import os
import logging
import requests

from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("denomath-ai")

GROQ_API_KEY = (os.environ.get("GROQ_API_KEY") or "").strip()
GROQ_MODEL   = os.environ.get("DENOMATH_AI_MODEL", "llama-3.3-70b-versatile")
MAX_TOKENS   = 600
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

if GROQ_API_KEY:
    logger.info("Provider AI aktif: Groq (%s)", GROQ_MODEL)
else:
    logger.warning(
        "⚠️  GROQ_API_KEY belum diisi di file .env. "
        "Endpoint /api/chat akan mengembalikan error 503 sampai key diisi."
    )

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

SYSTEM_PROMPT = """Kamu adalah DENO AI, asisten belajar ramah di dalam aplikasi
DENOMATH - media pembelajaran interaktif untuk siswa SMP (Kelas 7-9) di Indonesia,
yang membahas materi "Redenominasi Rupiah" dan "Penyajian Data".

ATURAN UTAMA:
1. Gunakan Bahasa Indonesia yang ramah, sederhana, dan menyemangati.
2. Fokus: redenominasi rupiah (dibagi 1.000, nilai daya beli TETAP SAMA, beda sanering).
3. Rumus inti: Harga Baru = Harga Lama / 1.000.
4. JANGAN langsung berikan jawaban soal evaluasi — bantu cara berpikirnya saja.
5. Jawaban ringkas: 2-5 kalimat atau beberapa poin singkat.
6. Jangan pernah berpura-pura menjadi manusia.
"""


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "provider": "groq" if GROQ_API_KEY else None,
        "provider_ready": bool(GROQ_API_KEY),
        "model": GROQ_MODEL,
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    if not GROQ_API_KEY:
        return jsonify({
            "error": (
                "GROQ_API_KEY belum diisi di file .env. "
                "Dapatkan API key gratis di https://console.groq.com/keys"
            )
        }), 503

    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    history      = data.get("history") or []
    siswa        = data.get("siswa") or {}

    if not user_message:
        return jsonify({"error": "Pertanyaan tidak boleh kosong."}), 400
    if len(user_message) > 2000:
        return jsonify({"error": "Pertanyaan terlalu panjang (maks 2000 karakter)."}), 400

    # Personalisasi system prompt jika info siswa tersedia
    system = SYSTEM_PROMPT
    nama = siswa.get("nama"); kelas = siswa.get("kelas")
    if nama or kelas:
        system += f"\nSiswa yang sedang belajar: nama '{nama or '-'}', kelas '{kelas or '-'}'."

    # Bangun messages (format OpenAI-compatible, didukung penuh oleh Groq)
    messages = [{"role": "system", "content": system}]
    for item in history[-10:]:
        role    = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    try:
        resp = requests.post(
            GROQ_API_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}",
            },
            json={
                "model": GROQ_MODEL,
                "messages": messages,
                "max_tokens": MAX_TOKENS,
                "temperature": 0.7,
            },
            timeout=30,
        )
        resp_data = resp.json()

        if resp.status_code == 401:
            return jsonify({"error": "API Key Groq tidak valid atau sudah kedaluwarsa. Cek file .env."}), 502
        if resp.status_code == 429:
            return jsonify({"error": "Batas permintaan Groq tercapai. Coba lagi sebentar."}), 502
        if resp.status_code != 200:
            err = resp_data.get("error", {}).get("message", "Groq API error")
            logger.error("Groq API error %d: %s", resp.status_code, err)
            return jsonify({"error": err}), 502

        reply = resp_data["choices"][0]["message"]["content"].strip()
        return jsonify({"reply": reply, "provider": "groq"})

    except requests.RequestException:
        logger.exception("Gagal terhubung ke Groq API")
        return jsonify({"error": "Tidak dapat terhubung ke server Groq. Cek koneksi internet."}), 502
    except Exception:
        logger.exception("Unexpected error in /api/chat")
        return jsonify({"error": "Terjadi kesalahan tak terduga di server."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)