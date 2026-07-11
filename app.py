"""
app.py — SERVER STATIS OPSIONAL untuk DENOMATH.

PENTING: Fitur "Tanya AI / DENO AI" TIDAK LAGI membutuhkan file ini atau
backend apa pun. Sejak revisi ini, DENO AI memanggil Groq API LANGSUNG
dari browser (lihat script.js), menggunakan API key yang diisi
siswa/guru sendiri lewat ikon 🔑 di panel chat. Jadi kamu TIDAK perlu
menjalankan "python app.py" di terminal supaya AI bisa dipakai — cukup
buka index.html di browser, klik ikon 🔑, isi Groq API key, selesai.

File ini disediakan hanya sebagai kenyamanan TAMBAHAN (opsional) jika
kamu ingin membuka DENOMATH lewat http://localhost:8000 alih-alih
membuka file index.html secara langsung (mis. karena browser tertentu
membatasi beberapa fitur saat dibuka lewat file://). Cukup jalankan:

    pip install -r requirements.txt
    python app.py

lalu buka http://localhost:8000 — tidak ada API key atau konfigurasi
apa pun yang perlu diisi di sisi server.
"""

import os
from flask import Flask, send_from_directory

# Folder tempat index.html, script.js, style.css berada (folder yang sama
# dengan file app.py ini). Ubah jika struktur foldermu berbeda.
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=None)


@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    # Menyajikan script.js, style.css, dan aset lain apa adanya
    return send_from_directory(STATIC_DIR, filename)


if __name__ == "__main__":
    print("DENOMATH berjalan di http://localhost:8000")
    print("(Server ini hanya menyajikan file statis — DENO AI berjalan langsung dari browser, tanpa backend.)")
    app.run(host="0.0.0.0", port=8000, debug=True)