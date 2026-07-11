import os
import json
import logging
import requests

from flask import Flask, request, jsonify, Response, stream_with_context
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

    def sse(payload):
        """Bungkus satu potongan data sebagai event Server-Sent Events."""
        return f"data: {json.dumps(payload)}\n\n"

    def generate():
        """
        Streaming generator — meneruskan setiap potongan (token) balasan
        Groq langsung ke browser begitu tiba, alih-alih menunggu seluruh
        jawaban selesai lalu mengirim satu blok besar sekaligus. Ini yang
        membuat obrolan terasa mengalir tanpa jeda, seperti panggilan telepon.
        """
        try:
            with requests.post(
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
                    "stream": True,
                },
                timeout=60,
                stream=True,
            ) as resp:

                if resp.status_code != 200:
                    if resp.status_code == 401:
                        err = "API Key Groq tidak valid atau sudah kedaluwarsa. Cek file .env."
                    elif resp.status_code == 429:
                        err = "Batas permintaan Groq tercapai. Coba lagi sebentar."
                    else:
                        try:
                            err_data = resp.json()
                            err = err_data.get("error", {}).get("message", "Groq API error")
                        except Exception:
                            err = f"Groq API error ({resp.status_code})"
                        logger.error("Groq API error %d: %s", resp.status_code, err)
                    yield sse({"error": err})
                    return

                for raw_line in resp.iter_lines(decode_unicode=True):
                    if not raw_line:
                        continue
                    if not raw_line.startswith("data: "):
                        continue
                    payload = raw_line[len("data: "):].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except ValueError:
                        continue
                    delta = (
                        chunk.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content")
                    )
                    if delta:
                        yield sse({"delta": delta})

                yield sse({"done": True})

        except requests.RequestException:
            logger.exception("Gagal terhubung ke Groq API")
            yield sse({"error": "Tidak dapat terhubung ke server Groq. Cek koneksi internet."})
        except Exception:
            logger.exception("Unexpected error in /api/chat streaming")
            yield sse({"error": "Terjadi kesalahan tak terduga di server."})

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # matikan buffering proxy (mis. nginx) agar benar2 streaming
            "Connection": "keep-alive",
        },
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)