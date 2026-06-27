"""
=================================================================
DENOMATH – app.py
Backend Flask untuk fitur "Tanya AI" (DENO AI)
=================================================================

Fungsi:
- Menyediakan endpoint POST /api/chat yang menerima pertanyaan siswa
  dan mengembalikan jawaban dari ChatGPT (OpenAI API).
- DENO AI diberi system prompt agar selalu fokus membantu materi
  Redenominasi Rupiah & Penyajian Data (sesuai konten DENOMATH),
  menjawab dengan bahasa yang ramah untuk siswa Kelas 7-9, dan
  TIDAK memberi jawaban soal evaluasi secara langsung.

CARA MENJALANKAN:
1. Install dependency:
     pip install flask flask-cors openai

2. Siapkan API key OpenAI kamu sebagai environment variable.
   Jangan pernah menulis API key langsung di dalam kode ini!

     # Linux / Mac:
     export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxx"

     # Windows (PowerShell):
     setx OPENAI_API_KEY "sk-xxxxxxxxxxxxxxxx"

3. Jalankan server:
     python app.py

   Server berjalan di http://localhost:5000

4. Buka index.html (file statis) di browser, ATAU jalankan via
   server statis sederhana, misalnya:
     python -m http.server 8000
   lalu akses http://localhost:8000

   script.js akan otomatis memanggil http://localhost:5000/api/chat
   (lihat konstanta AI_API_URL di script.js — sesuaikan jika kamu
   men-deploy backend ini ke domain/port lain).

MODEL:
- Default model adalah "gpt-4o-mini" (cepat & murah, cukup untuk
  asisten belajar). Bisa diganti lewat environment variable
  DENOMATH_AI_MODEL, contoh: "gpt-4o".

CATATAN KEAMANAN:
- API key TIDAK PERNAH dikirim ke browser/siswa. Permintaan dari
  browser hanya berisi teks pertanyaan; permintaan ke OpenAI API
  (yang membawa API key) hanya terjadi di server (app.py) ini.
- CORS diaktifkan agar index.html (dibuka dari file://, atau dari
  origin lain saat development) bisa memanggil endpoint ini. Saat
  deploy ke production, sebaiknya batasi origin yang diizinkan.
=================================================================
"""

import os
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    from openai import OpenAI
    import openai
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Modul 'openai' belum terpasang.\n"
        "Jalankan: pip install openai\n"
    ) from exc

# -----------------------------------------------------------------
# KONFIGURASI
# -----------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("denomath-ai")

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL_NAME = os.environ.get("DENOMATH_AI_MODEL", "gpt-4o-mini")
MAX_TOKENS = 600

app = Flask(__name__)
# Untuk production, ganti origins="*" dengan domain web kamu, contoh:
# CORS(app, resources={r"/api/*": {"origins": "https://domainsekolahmu.com"}})
CORS(app, resources={r"/api/*": {"origins": "*"}})

client = OpenAI(api_key=API_KEY) if API_KEY else None

# -----------------------------------------------------------------
# SYSTEM PROMPT — kepribadian & batasan DENO AI
# -----------------------------------------------------------------
SYSTEM_PROMPT = """Kamu adalah DENO AI, asisten belajar ramah di dalam aplikasi
DENOMATH — media pembelajaran interaktif untuk siswa SMP (Kelas 7-9) di Indonesia,
yang membahas materi "Redenominasi Rupiah" dan "Penyajian Data" (tabel, diagram
batang, diagram lingkaran).

ATURAN UTAMA:
1. Gunakan Bahasa Indonesia yang ramah, sederhana, dan menyemangati — seperti
   kakak pembimbing, bukan dosen. Boleh sesekali pakai emoji yang relevan (💰📊🧮),
   jangan berlebihan.
2. Fokus topik: redenominasi rupiah (penyederhanaan angka mata uang dengan dibagi
   1.000, nilai daya beli TETAP SAMA, beda dengan sanering), serta penyajian data
   (cara membuat & membaca tabel dan diagram batang/lingkaran).
3. Rumus inti yang harus kamu pegang: Harga/Nilai Baru = Harga/Nilai Lama ÷ 1.000.
4. JANGAN langsung memberikan jawaban akhir dari soal evaluasi/kuis yang sedang
   dikerjakan siswa. Jika siswa menempel soal pilihan ganda dan minta jawabannya,
   bantu dengan menjelaskan CARA berpikir/rumus/langkah penyelesaiannya, dorong
   siswa menghitung sendiri, dan beri contoh soal SEJENIS (bukan soal yang sama)
   jika perlu.
5. Jika pertanyaan di luar topik redenominasi/penyajian data/matematika dasar
   terkait, jawab singkat dengan ramah lalu arahkan kembali ke topik DENOMATH.
6. Jawaban ringkas dan jelas: idealnya 2-5 kalimat atau beberapa poin singkat,
   kecuali siswa minta penjelasan lebih panjang/contoh soal.
7. Jangan pernah berpura-pura menjadi manusia; kamu adalah asisten AI di dalam
   aplikasi DENOMATH.
"""


# -----------------------------------------------------------------
# ROUTES
# -----------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    """Cek cepat apakah server & API key sudah siap."""
    return jsonify({
        "status": "ok",
        "api_key_configured": bool(API_KEY),
        "model": MODEL_NAME,
        "provider": "openai",
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Menerima pertanyaan siswa dan riwayat singkat percakapan,
    lalu meneruskannya ke ChatGPT (OpenAI API).

    Body JSON yang diharapkan:
    {
      "message": "Apa itu redenominasi?",
      "history": [
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "..."}
      ],
      "siswa": { "nama": "Budi", "kelas": "7" }   // opsional, untuk personalisasi
    }
    """
    if client is None:
        return jsonify({
            "error": (
                "OPENAI_API_KEY belum diatur di server. "
                "Set environment variable OPENAI_API_KEY lalu restart server."
            )
        }), 503

    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    history = data.get("history") or []
    siswa = data.get("siswa") or {}

    if not user_message:
        return jsonify({"error": "Pertanyaan tidak boleh kosong."}), 400
    if len(user_message) > 2000:
        return jsonify({"error": "Pertanyaan terlalu panjang (maks 2000 karakter)."}), 400

    system_prompt = SYSTEM_PROMPT
    nama_siswa = siswa.get("nama")
    kelas_siswa = siswa.get("kelas")
    if nama_siswa or kelas_siswa:
        system_prompt += (
            f"\n\nKonteks siswa yang sedang belajar: nama '{nama_siswa or '-'}', "
            f"kelas '{kelas_siswa or '-'}'. Sapa dengan nama jika cocok secara alami, "
            "tidak perlu di setiap balasan."
        )

    # Bangun daftar messages sesuai format OpenAI Chat Completions:
    # system prompt di awal, lalu riwayat singkat, lalu pertanyaan baru.
    messages = [{"role": "system", "content": system_prompt}]
    for item in history[-10:]:  # batasi konteks agar ringan
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content.strip()})
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            max_tokens=MAX_TOKENS,
            messages=messages,
        )
        reply_text = (response.choices[0].message.content or "").strip()

        if not reply_text:
            reply_text = "Maaf, aku belum bisa menjawab itu sekarang. Coba tanyakan dengan cara lain ya! 🙏"

        return jsonify({"reply": reply_text})

    except openai.APIStatusError as exc:
        logger.exception("OpenAI API error")
        return jsonify({
            "error": f"Terjadi kendala saat menghubungi AI (status {exc.status_code})."
        }), 502
    except openai.APIConnectionError:
        logger.exception("OpenAI connection error")
        return jsonify({
            "error": "Tidak dapat terhubung ke server OpenAI. Cek koneksi internet server ya."
        }), 502
    except Exception:
        logger.exception("Unexpected error in /api/chat")
        return jsonify({
            "error": "Terjadi kesalahan tak terduga di server. Coba lagi sebentar ya."
        }), 500


if __name__ == "__main__":
    if not API_KEY:
        logger.warning(
            "⚠️  OPENAI_API_KEY belum diset. Endpoint /api/chat akan "
            "mengembalikan error 503 sampai env var ini diisi."
        )
    # debug=True hanya untuk pengembangan lokal — matikan saat production.
    app.run(host="0.0.0.0", port=5000, debug=True)