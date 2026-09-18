import os
import json
import logging
import requests

from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("denomath-ai")

GROQ_API_KEY = (os.environ.get("GROQ_API_KEY") or "").strip()
GROQ_MODEL   = os.environ.get("DENOMATH_AI_MODEL", "openai/gpt-oss-120b")
MAX_TOKENS   = 800
MAX_TOKENS_KOREKSI = 350
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

if GROQ_API_KEY:
    logger.info("Provider AI aktif: Groq (%s)", GROQ_MODEL)
else:
    logger.warning(
        "⚠️  GROQ_API_KEY belum diisi di file .env. "
        "Endpoint /api/chat akan mengembalikan error 503 sampai key diisi."
    )

# ---------------------------------------------------------------------------
# YouTube Data API v3 — dipakai untuk mengisi baris "Lainnya dari YouTube"
# pada tab Video dengan video-video LAIN (bukan cuma daftar video pilihan
# guru yang sudah dikurasi manual), memakai algoritma pencarian & relevansi
# YouTube sendiri. Perlu API key dari Google Cloud Console (aktifkan
# "YouTube Data API v3"), diisi lewat variabel YOUTUBE_API_KEY di file .env.
# ---------------------------------------------------------------------------
YOUTUBE_API_KEY = (os.environ.get("YOUTUBE_API_KEY") or "").strip()
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

if YOUTUBE_API_KEY:
    logger.info("YouTube Data API aktif — baris \"Lainnya dari YouTube\" akan terisi otomatis.")
else:
    logger.warning(
        "⚠️  YOUTUBE_API_KEY belum diisi di file .env. "
        "Endpoint /api/video-lainnya akan mengembalikan error 503 sampai key diisi "
        "(baris \"Lainnya dari YouTube\" akan menampilkan tombol cari manual sebagai gantinya)."
    )

# ---------------------------------------------------------------------------
# URL Web App Google Apps Script (Code.gs) tujuan rekap nilai ke Spreadsheet.
# Sebaiknya diisi lewat variabel GOOGLE_SHEETS_URL di file .env supaya bisa
# diganti tanpa mengedit kode (mis. saat deploy ulang Apps Script dan URL-nya
# berubah). Nilai di bawah ini hanya fallback kalau .env belum diisi.
#
# CATATAN: rekapan sekarang pindah ke Spreadsheet BARU —
# https://docs.google.com/spreadsheets/d/1iBB9cULhgqPKOHNZrSOAWaqRqipcq5JRtoCuh9I1f8A/edit?usp=sharing
# Fallback di bawah sudah diisi URL Web App ("/exec") hasil deploy Code.gs
# ke spreadsheet tsb. Kalau URL Web App-nya berubah lagi nanti (redeploy),
# cukup update lewat variabel GOOGLE_SHEETS_URL di file .env (lebih aman,
# tidak perlu ubah kode ini) — atau ganti langsung nilai fallback di bawah.
#
# PENTING: fallback ini HANYA dipakai kalau app.py benar-benar dijalankan
# sebagai server Flask (mis. server sendiri/Render/Railway). Kalau DENOMATH
# di-hosting statis di GitHub Pages, app.py TIDAK berjalan sama sekali —
# di sana script.js memanggil Apps Script langsung lewat konstanta
# GOOGLE_SHEETS_WEBAPP_URL (lihat komentarnya di script.js), jadi URL di
# script.js itu juga WAJIB diganti secara terpisah dari nilai di bawah ini.
# ---------------------------------------------------------------------------
GOOGLE_SHEETS_URL = (os.environ.get("GOOGLE_SHEETS_URL") or
    "https://script.google.com/macros/s/AKfycby5hWMKkRNqOpo79PLPnCOYyM9CO3t5wxEhIz4sJp9dSxjiieClZvveEppsUYBam5oZqw/exec"
).strip()

# Cek fallback/nilai .env memang berupa URL (bukan kosong/placeholder lama).
GOOGLE_SHEETS_URL_BELUM_DIKONFIGURASI = not GOOGLE_SHEETS_URL.startswith("http")

if GOOGLE_SHEETS_URL_BELUM_DIKONFIGURASI:
    logger.warning(
        "⚠️  GOOGLE_SHEETS_URL belum diisi dengan URL Web App yang valid "
        "(masih placeholder atau kosong). Endpoint /api/rekap (rekap nilai "
        "ke Spreadsheet) akan mengembalikan error 503 sampai variabel "
        "GOOGLE_SHEETS_URL di file .env diisi dengan URL \"/exec\" hasil "
        "deploy Code.gs ke spreadsheet baru."
    )
elif GOOGLE_SHEETS_URL.rstrip("/").endswith("/dev"):
    # Kesalahan konfigurasi yang pernah terjadi: URL "/dev" adalah deployment
    # TES Apps Script (cuma bisa diakses kalau yang membuka sedang login
    # sebagai pemilik script di browser). Dipanggil dari server (requests)
    # atau oleh murid lain, Google akan membalas halaman HTML login/redirect
    # (bukan JSON) sehingga rekap SELALU gagal walau kodenya benar. Yang
    # harus dipakai untuk Web App produksi adalah URL yang berakhiran
    # "/exec" (dari Deploy > Manage deployments, bukan dari "Test deployment").
    logger.warning(
        "⚠️  GOOGLE_SHEETS_URL di .env berakhiran \"/dev\" (deployment TES Apps "
        "Script, butuh login akun pemilik). Rekap ke Spreadsheet akan GAGAL "
        "untuk murid lain. Ganti ke URL yang berakhiran \"/exec\" (Apps Script "
        "editor > Deploy > Manage deployments > salin URL Web app)."
    )

# ---------------------------------------------------------------------------
# Serve file front-end (index.html, style.css, script.js) LANGSUNG dari
# server Flask ini, dari folder yang sama dengan app.py.
#
# Ini penting untuk video YouTube di menu "Materi & Video": jika index.html
# dibuka dengan cara didobel-klik langsung dari File Explorer (jadi URL-nya
# "file:///.../index.html"), browser mengirim origin "null" ke YouTube, dan
# YouTube MENOLAK memutar video yang disematkan (embed) dari origin seperti
# itu — inilah salah satu penyebab paling umum "Video player configuration
# error / Error 153". Dengan menyajikan file lewat Flask, halaman dibuka
# lewat http://localhost:5000/ (origin yang valid), sehingga masalah ini
# hilang selama video yang dipakai memang mengizinkan embed.
#
# Hanya file front-end yang eksplisit diizinkan di bawah ini yang disajikan
# (BUKAN seluruh folder project) — supaya app.py, .env, dan file rahasia
# lain TIDAK ikut bisa diakses/diunduh lewat browser.
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_STATIC_FILES = {
    "index.html", "style.css", "script.js", "logo.png",
    "maskot-tikus.mp4", "maskot-poster.jpg",
}

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route("/")
def index_page():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    if filename not in ALLOWED_STATIC_FILES:
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(BASE_DIR, filename)

SYSTEM_PROMPT = """Kamu adalah DENO AI, asisten belajar ramah di dalam aplikasi
DENOMATH - media pembelajaran interaktif untuk siswa SMP (Kelas 7-9) di Indonesia,
yang membahas materi "Redenominasi Rupiah" dan "Penyajian Data".

ATURAN UTAMA:
1. Gunakan Bahasa Indonesia yang ramah, sederhana, dan menyemangati.
2. Fokus: redenominasi rupiah (dibagi 1.000, nilai daya beli TETAP SAMA, beda sanering)
   dan penyajian data (tabel, diagram batang, diagram garis, diagram lingkaran).
3. Rumus inti: Harga Baru = Harga Lama / 1.000.
4. JANGAN langsung berikan jawaban soal evaluasi — bantu cara berpikirnya saja.
5. Jawaban ringkas: 2-5 kalimat, atau beberapa poin singkat jika perlu.
6. Jangan pernah berpura-pura menjadi manusia.

ATURAN FORMAT JAWABAN (SANGAT PENTING):
7. JANGAN PERNAH memakai tanda markdown seperti bintang (**tebal**), garis
   bawah (_miring_), tanda pagar (# judul), atau tanda kutip terbalik (`kode`)
   di jawabanmu. Tanda-tanda itu TIDAK dirender jadi format, hanya muncul
   sebagai simbol mentah yang mengganggu siswa. Tulis jawaban sebagai teks
   biasa, kalimat mengalir, atau poin bernomor "1)", "2)", dst. Untuk daftar
   pendek boleh pakai baris yang diawali tanda "- " (dash spasi) karena ini
   akan otomatis diubah jadi bullet list yang rapi oleh aplikasi.
8. Jika pertanyaan siswa cocok dijawab dengan TABEL (misalnya membandingkan
   beberapa nilai/kategori), gunakan format berikut PERSIS (tanpa markdown
   tambahan di dalamnya), dengan kolom dipisah tanda "|":
   [TABEL]
   Kolom1 | Kolom2 | Kolom3
   Baris1A | Baris1B | Baris1C
   Baris2A | Baris2B | Baris2C
   [/TABEL]
9. Jika pertanyaan siswa cocok dijawab dengan DIAGRAM BATANG sederhana
   (misalnya membandingkan beberapa angka), gunakan format berikut PERSIS,
   satu baris "Label: angka" per kategori:
   [DIAGRAM]
   Label1: 10
   Label2: 20
   [/DIAGRAM]
10. Boleh menulis penjelasan singkat sebelum/sesudah blok [TABEL] atau
    [DIAGRAM], tapi jangan mengulang isi tabel/diagram itu lagi dalam bentuk
    kalimat panjang.
"""



# ---------------------------------------------------------------------------
# RUBRIK PENILAIAN AI — "Ayo Belajar" (KB1 & KB2)
#
# Setiap sintaks (Essential Question, Challenge, Guiding Question, Guiding
# Activity, Asesmen) punya daftar pertanyaan + "kata kunci" (konsep/istilah
# inti yang WAJIB muncul atau dijelaskan dalam jawaban yang benar). AI diminta
# secara eksplisit memeriksa kata kunci ini pada tiap jawaban siswa sebelum
# memberi skor 0-100, supaya penilaian argumen tidak asal-asalan/menebak,
# tapi berbasis konsep yang memang diajarkan di modul.
#
# Sintaks "Big Idea", "Guiding Resource", dan "Solution Action" TIDAK ada di
# sini karena tidak berisi kolom isian yang dinilai (murni materi bacaan).
# ---------------------------------------------------------------------------
RUBRIK_KOREKSI = {
    1: {
        # --- Sumber: dokumen "KEGIATAN BELAJAR 1" (tabungan 25 murid & redenominasi;
        #     lihat juga data panen kebun pada Asesmen) ---
        "essentialQ": [
            {"field": "kb1eq1", "pertanyaan": "Melalui Big Idea tersebut, bagaimana tanggapanmu tentang pentingnya menyajikan data dengan tepat agar lebih mudah dipahami?",
             "kata_kunci": ["menyajikan data dengan tepat membuat informasi mudah dibaca, dipahami, dibandingkan, dan diinterpretasikan",
                            "dalam konteks redenominasi, nilai sebenarnya tetap sama meski nominal disederhanakan",
                            "tabel atau diagram batang yang sesuai membantu melihat perbedaan nilai antarjenis data",
                            "kesimpulan dapat ditarik berdasarkan data secara tepat"]},
        ],
        "challenge": [
            {"field": "kb1challenge", "pertanyaan": "Rencana awal kelompok untuk mengolah & menyajikan data tabungan 25 murid (redenominasi) ke tabel dan diagram, serta rencana menentukan murid dengan tabungan tertinggi & terendah.",
             "kata_kunci": ["redenominasi", "25 murid", "tabel sistematis", "diagram batang", "tabungan tertinggi dan terendah"]},
        ],
        "guidingQuestion": [
            {"field": "kb1gq1", "pertanyaan": "Jika diberikan data mentah 45 nilai tabungan murid (nilai 1-5 ribu rupiah), bagaimana cara menyajikan data tersebut ke dalam bentuk diagram batang yang tepat? Jelaskan langkah-langkahnya (jawaban benar: data diurutkan/dihitung dengan turus menjadi tabel frekuensi terlebih dahulu, lalu sumbu horizontal diisi nilai data dan sumbu vertikal diisi frekuensi, kemudian digambar batang setinggi frekuensi masing-masing nilai dan diberi judul).",
             "kata_kunci": ["data dihitung/ditata dengan turus menjadi tabel frekuensi terlebih dahulu",
                            "sumbu horizontal diisi nilai/nama data, sumbu vertikal diisi frekuensi",
                            "tinggi batang sesuai frekuensi tiap nilai",
                            "diagram diberi judul yang sesuai"]},
        ],
        "guidingActivity": [
            {"field": "freqA1", "pertanyaan": "Frekuensi nilai tabungan Rp1 ribu dari 45 data Lembar Kerja Guiding Activity (jawaban benar: 7).", "kata_kunci": ["7"]},
            {"field": "freqA2", "pertanyaan": "Frekuensi nilai tabungan Rp2 ribu (jawaban benar: 14).", "kata_kunci": ["14"]},
            {"field": "freqA3", "pertanyaan": "Frekuensi nilai tabungan Rp3 ribu (jawaban benar: 12).", "kata_kunci": ["12"]},
            {"field": "freqA4", "pertanyaan": "Frekuensi nilai tabungan Rp4 ribu (jawaban benar: 8).", "kata_kunci": ["8"]},
            {"field": "freqA5", "pertanyaan": "Frekuensi nilai tabungan Rp5 ribu (jawaban benar: 4).", "kata_kunci": ["4"]},
            {"field": "kb1ga2", "pertanyaan": "Deskripsi diagram batang dari tabel frekuensi (harus memuat judul serta nama sumbu horizontal & vertikal yang sesuai).",
             "kata_kunci": ["judul diagram", "sumbu horizontal/nilai tabungan", "sumbu vertikal/jumlah murid atau frekuensi"]},
        ],
        "asesmen": [
            {"field": "kb1as1", "pertanyaan": "Informasi apa saja yang dapat diperoleh dari tabel hasil panen kebun (Cabai, Wortel, Tomat, Ubi, Kentang) setelah diterapkan redenominasi (jawaban benar: harga menjadi lebih sederhana penulisannya yaitu Cabai Rp63, Wortel Rp14, Tomat Rp16, Ubi Rp10, Kentang Rp20 per kg; redenominasi tidak mengubah perbandingan harga maupun nilai sebenarnya, hanya menyederhanakan nominal; Cabai tetap harga tertinggi dan Ubi harga terendah).",
             "kata_kunci": ["Cabai Rp63", "Wortel Rp14", "Tomat Rp16", "Ubi Rp10", "Kentang Rp20 per kg",
                            "redenominasi tidak mengubah nilai sebenarnya, hanya menyederhanakan nominal",
                            "Cabai harga tertinggi, Ubi harga terendah"]},
            {"field": "kb1as2diagram", "pertanyaan": "Diagram batang harga tiap komoditas setelah redenominasi (jawaban benar: Cabai Rp63, Wortel Rp14, Tomat Rp16, Ubi Rp10, Kentang Rp20 per kg).",
             "kata_kunci": ["Cabai Rp63", "Wortel Rp14", "Tomat Rp16", "Ubi Rp10", "Kentang Rp20"]},
            {"field": "kb1as2", "pertanyaan": "Uraian: tentukan komoditas dengan harga tertinggi & terendah pada diagram, dan jika mempertimbangkan jumlah hasil panen tentukan komoditas dengan pendapatan terbesar (jawaban benar: Cabai tertinggi Rp63/kg, Ubi terendah Rp10/kg; pendapatan = harga x banyak panen -> Cabai Rp1.260.000/Rp1.260, Wortel Rp420.000/Rp420, Tomat Rp400.000/Rp400, Ubi Rp350.000/Rp350, Kentang Rp800.000/Rp800, sehingga Cabai menghasilkan pendapatan terbesar).",
             "kata_kunci": ["Cabai harga tertinggi Rp63/kg, Ubi harga terendah Rp10/kg",
                            "pendapatan = harga per kg x banyak panen (kg)",
                            "Cabai Rp1.260.000/Rp1.260 pendapatan terbesar",
                            "Kentang Rp800.000/Rp800, Wortel Rp420.000/Rp420, Tomat Rp400.000/Rp400, Ubi Rp350.000/Rp350"]},
        ],
    },
    2: {
        # --- Sumber: dokumen "KEGIATAN BELAJAR 2" (Young Investor Club & diagram
        #     lingkaran — lihat file Kegiatan_Belajar_2.docx, termasuk kunci jawaban
        #     bergambar pada bagian Big Idea, Challenge, Guiding Question, Guiding
        #     Activity, dan Asesmen) ---
        "essentialQ": [
            {"field": "kb2eq1", "pertanyaan": "Setelah mengamati Big Idea (portofolio saham BRIS, TLKM, BBNI, BBRI, BREN yang disajikan dalam tabel & diagram lingkaran nilai investasi), rumuskan SATU pertanyaan penting (Essential Question) yang membuat siswa penasaran dan dapat membantunya menemukan solusi terhadap permasalahan penyajian/pembacaan data nilai investasi saham tersebut. Ini adalah soal terbuka (tidak ada satu jawaban baku) — nilai TINGGI jika pertanyaan yang dirumuskan relevan dengan Big Idea (mis. berkaitan dengan proporsi/persentase investasi, diagram lingkaran, redenominasi, atau pengambilan keputusan keuangan) dan berbentuk kalimat tanya yang jelas & bermakna, bukan sekadar pernyataan atau di luar topik.",
             "kata_kunci": ["berbentuk kalimat tanya yang jelas", "relevan dengan diagram lingkaran/persentase/proporsi investasi saham", "relevan dengan redenominasi atau pengambilan keputusan keuangan"]},
        ],
        "challenge": [
            {"field": "kb2challenge", "pertanyaan": "Data pengeluaran jajan kantin Raka & teman-teman (setelah redenominasi): Nasi Rp60, Minuman Rp40, Roti Rp30, Gorengan Rp30, Snack Rp20, Buah Rp20 (total Rp200). Hitung persentase & besar sudut diagram lingkaran tiap jenis jajanan, tentukan bentuk diagramnya, serta jajanan dengan pengeluaran terbesar & terkecil beserta selisihnya (jawaban benar: Nasi 30%/108°, Minuman 20%/72°, Roti 15%/54°, Gorengan 15%/54°, Snack 10%/36°, Buah 10%/36°; terbesar Nasi, terkecil Snack & Buah, selisih Rp40.000/Rp40).",
             "kata_kunci": ["Nasi 30% / 108°", "Minuman 20% / 72°", "Roti 15% / 54°", "Gorengan 15% / 54°", "Snack 10% / 36°", "Buah 10% / 36°",
                            "Nasi pengeluaran terbesar", "Snack dan Buah pengeluaran terkecil", "selisih Rp40.000 atau Rp40"]},
        ],
        "guidingQuestion": [
            {"field": "kb2gq1", "pertanyaan": "Diberikan tabungan 6 murid di bank setelah redenominasi (total Rp240): Andi Rp72, Budi Rp48, Citra Rp36, Dinda Rp24, Edo Rp12, Fani Rp48. Hitung persentase & besar sudut diagram lingkaran untuk tabungan tiap murid, jelaskan langkah perhitungannya (jawaban benar: Andi 30%/108°, Budi 20%/72°, Citra 15%/54°, Dinda 10%/36°, Edo 5%/18°, Fani 20%/72°).",
             "kata_kunci": ["persentase = (tabungan ÷ total) × 100%", "besar sudut = persentase × 360°",
                            "Andi 30% / 108°", "Budi 20% / 72°", "Citra 15% / 54°", "Dinda 10% / 36°", "Edo 5% / 18°", "Fani 20% / 72°"]},
            {"field": "kb2gqPersen1", "pertanyaan": "Lengkapi tabel: persentase tabungan Andi (Rp72 dari total Rp240).", "kata_kunci": ["30%"]},
            {"field": "kb2gqSudut1", "pertanyaan": "Lengkapi tabel: besar sudut juring tabungan Andi.", "kata_kunci": ["108°", "108"]},
            {"field": "kb2gqPersen2", "pertanyaan": "Lengkapi tabel: persentase tabungan Budi (Rp48 dari total Rp240).", "kata_kunci": ["20%"]},
            {"field": "kb2gqSudut2", "pertanyaan": "Lengkapi tabel: besar sudut juring tabungan Budi.", "kata_kunci": ["72°", "72"]},
            {"field": "kb2gqPersen3", "pertanyaan": "Lengkapi tabel: persentase tabungan Citra (Rp36 dari total Rp240).", "kata_kunci": ["15%"]},
            {"field": "kb2gqSudut3", "pertanyaan": "Lengkapi tabel: besar sudut juring tabungan Citra.", "kata_kunci": ["54°", "54"]},
            {"field": "kb2gqPersen4", "pertanyaan": "Lengkapi tabel: persentase tabungan Dinda (Rp24 dari total Rp240).", "kata_kunci": ["10%"]},
            {"field": "kb2gqSudut4", "pertanyaan": "Lengkapi tabel: besar sudut juring tabungan Dinda.", "kata_kunci": ["36°", "36"]},
            {"field": "kb2gqPersen5", "pertanyaan": "Lengkapi tabel: persentase tabungan Edo (Rp12 dari total Rp240).", "kata_kunci": ["5%"]},
            {"field": "kb2gqSudut5", "pertanyaan": "Lengkapi tabel: besar sudut juring tabungan Edo.", "kata_kunci": ["18°", "18"]},
            {"field": "kb2gqPersen6", "pertanyaan": "Lengkapi tabel: persentase tabungan Fani (Rp48 dari total Rp240).", "kata_kunci": ["20%"]},
            {"field": "kb2gqSudut6", "pertanyaan": "Lengkapi tabel: besar sudut juring tabungan Fani.", "kata_kunci": ["72°", "72"]},
            {"field": "kb2gq3", "pertanyaan": "Murid manakah yang memiliki tabungan terbesar dan terkecil, serta berapa selisihnya? (jawaban benar: Andi terbesar 30%/Rp72, Edo terkecil 5%/Rp12, selisih 25 poin persen atau Rp60).",
             "kata_kunci": ["Andi terbesar", "Edo terkecil", "selisih 25 poin persen atau Rp60"]},
            {"field": "kb2gq4", "pertanyaan": "Sebutkan informasi yang diperoleh dari diagram lingkaran tabungan 6 murid tersebut.",
             "kata_kunci": ["Andi tabungan terbesar 30%", "Edo tabungan terkecil 5%", "Andi dan Fani gabungan 50%", "Budi dan Citra gabungan 35%"]},
        ],
        "guidingActivity": [
            {"field": "kb2gaAset1", "pertanyaan": "Nilai investasi saham BBRI setelah redenominasi (dari Rp300.000 sebelum redenominasi).", "kata_kunci": ["300"]},
            {"field": "kb2gaAset2", "pertanyaan": "Nilai investasi saham BBCA setelah redenominasi (dari Rp250.000 sebelum redenominasi).", "kata_kunci": ["250"]},
            {"field": "kb2gaAset3", "pertanyaan": "Nilai investasi saham BBNI setelah redenominasi (dari Rp200.000 sebelum redenominasi).", "kata_kunci": ["200"]},
            {"field": "kb2gaAset4", "pertanyaan": "Nilai investasi saham TLKM setelah redenominasi (dari Rp150.000 sebelum redenominasi).", "kata_kunci": ["150"]},
            {"field": "kb2gaAset5", "pertanyaan": "Nilai investasi saham BRIS setelah redenominasi (dari Rp100.000 sebelum redenominasi).", "kata_kunci": ["100"]},
            {"field": "kb2gaA", "pertanyaan": "Jelaskan informasi yang dapat diperoleh dari data dana investasi sebelum & sesudah redenominasi pada kelima saham (BBRI, BBCA, BBNI, TLKM, BRIS).",
             "kata_kunci": ["angka setelah redenominasi lebih sederhana/kecil", "tiga angka nol dihilangkan", "nilai/daya beli sebenarnya tetap sama"]},
            {"field": "kb2gaB", "pertanyaan": "Buat diagram lingkaran dari dana investasi kelima saham setelah redenominasi (total Rp1.000: BBRI Rp300, BBCA Rp250, BBNI Rp200, TLKM Rp150, BRIS Rp100): jelaskan langkah perhitungan persentase & besar sudut tiap juringnya (jawaban benar: BBRI 30%/108°, BBCA 25%/90°, BBNI 20%/72°, TLKM 15%/54°, BRIS 10%/36°).",
             "kata_kunci": ["persentase = (nilai ÷ total) × 100%", "besar sudut = persentase × 360°",
                            "BBRI 30% / 108°", "BBCA 25% / 90°", "BBNI 20% / 72°", "TLKM 15% / 54°", "BRIS 10% / 36°"]},
        ],
        "asesmen": [
            {"field": "kb2as1", "pertanyaan": "Dari tabel harga lauk Rumah Makan Padang Pak Heru dalam bentuk redenominasi rupiah (Rendang Rp20, Ayam Goreng Rp30, Ayam Bakar Rp25, Telur Dadar Padang Rp10, Telur Balado Rp15), sebutkan informasi yang diperoleh serta lauk dengan harga paling murah & paling mahal.",
             "kata_kunci": ["Telur Dadar Padang paling murah Rp10", "Ayam Goreng paling mahal Rp30", "total harga seluruh lauk Rp100"]},
            {"field": "kb2as2", "pertanyaan": "Urutkan harga lauk dari termurah ke termahal, lalu tentukan selisih harga lauk termahal & termurah (jawaban benar: Telur Dadar Rp10, Telur Balado Rp15, Rendang Rp20, Ayam Bakar Rp25, Ayam Goreng Rp30; selisih Rp20).",
             "kata_kunci": ["urutan: Telur Dadar, Telur Balado, Rendang, Ayam Bakar, Ayam Goreng", "selisih Rp20"]},
            {"field": "kb2as3", "pertanyaan": "Buat diagram lingkaran (dalam persentase) dari data harga lauk (total Rp100): Rendang 20%, Ayam Goreng 30%, Ayam Bakar 25%, Telur Dadar 10%, Telur Balado 15%.",
             "kata_kunci": ["Rendang 20%", "Ayam Goreng 30%", "Ayam Bakar 25%", "Telur Dadar 10%", "Telur Balado 15%", "total Rp100"]},
            {"field": "kb2as4", "pertanyaan": "Tuliskan minimal tiga kesimpulan mengenai harga lauk di Rumah Makan Padang Pak Heru berdasarkan tabel & diagram lingkaran.",
             "kata_kunci": ["Ayam Goreng termahal 30%", "Telur Dadar Padang termurah 10%", "total Rp100 dari lima jenis lauk", "bagian terbesar & terkecil pada diagram"]},
        ],
    },
}

SINTAKS_LABEL = {
    "essentialQ": "Essential Question", "challenge": "Challenge",
    "guidingQuestion": "Guiding Question", "guidingActivity": "Guiding Activity",
    "asesmen": "Asesmen",
}

KOREKSI_SYSTEM_PROMPT = """Kamu adalah penilai (grader) otomatis untuk jawaban siswa SMP pada
aplikasi DENOMATH, materi Redenominasi Rupiah & Penyajian Data.

CARA MENILAI (WAJIB DIIKUTI):
1. Untuk setiap soal, kamu diberi "Kata kunci/konsep inti" yang seharusnya
   muncul atau dijelaskan (boleh dengan kata lain yang semakna) dalam
   jawaban siswa yang benar.
2. Periksa jawaban siswa SATU PER SATU: apakah kata kunci/konsepnya ada,
   sebagian ada, atau tidak ada sama sekali. Jawaban yang memuat kata kunci
   inti dengan penjelasan/alasan yang masuk akal mendapat skor tinggi.
   Jawaban yang kosong, asal, atau tidak menyebut/menjelaskan kata kunci
   sama sekali mendapat skor rendah.
3. Untuk soal berupa angka (misalnya frekuensi atau hasil konversi harga),
   nilai benar jika angkanya sama persis dengan kata kunci yang diberikan;
   toleransi kecil untuk format penulisan (misalnya "Rp25" vs "25").
4. Hitung SATU skor akhir 0-100 untuk keseluruhan sintaks (rata-rata
   tertimbang dari semua soal dalam sintaks tersebut), bukan per soal.
5. Jika seluruh jawaban kosong, beri skor 0.
6. Bersikap adil dan mendukung siswa SMP: jawaban dengan bahasa sendiri yang
   maknanya tetap benar tetap dihargai tinggi, tidak perlu sama persis kata
   demi kata.

FORMAT OUTPUT (WAJIB):
Balas HANYA dengan satu objek JSON valid, tanpa teks lain, tanpa markdown,
persis seperti ini:
{"skor": <angka bulat 0-100>, "catatan": "<catatan singkat 1-2 kalimat
dalam Bahasa Indonesia untuk siswa, sebutkan kata kunci penting yang sudah
tepat dan/atau yang masih kurang>"}
"""


def _panggil_groq_koreksi(prompt_user):
    """Kirim satu permintaan (non-streaming) ke Groq untuk menilai jawaban
    satu sintaks, lalu kembalikan (skor:int, catatan:str). Melempar
    Exception dengan pesan yang aman ditampilkan ke siswa jika gagal."""
    resp = requests.post(
        GROQ_API_URL,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": KOREKSI_SYSTEM_PROMPT},
                {"role": "user", "content": prompt_user},
            ],
            "max_tokens": MAX_TOKENS_KOREKSI,
            "temperature": 0.2,
            "stream": False,
        },
        timeout=45,
    )
    resp.encoding = "utf-8"

    if resp.status_code != 200:
        if resp.status_code == 401:
            raise RuntimeError("API Key Groq tidak valid atau sudah kedaluwarsa. Cek file .env.")
        if resp.status_code == 429:
            raise RuntimeError("Batas permintaan Groq tercapai. Coba lagi sebentar.")
        try:
            raw_err = resp.json().get("error", {}).get("message", "Groq API error")
        except Exception:
            raw_err = f"Groq API error ({resp.status_code})"
        logger.error("Groq API error (koreksi) %d: %s", resp.status_code, raw_err)
        raise RuntimeError(raw_err)

    try:
        data = resp.json()
        konten = data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        raise RuntimeError("Format balasan Groq tidak sesuai.") from exc

    # Bersihkan kemungkinan pembungkus ```json ... ``` dari balasan AI,
    # lalu ambil blok {...} pertama supaya parsing JSON tetap tahan banting
    # meski AI menambahkan sedikit teks di luar instruksi.
    konten = konten.replace("```json", "").replace("```", "").strip()
    awal, akhir = konten.find("{"), konten.rfind("}")
    if awal == -1 or akhir == -1:
        raise RuntimeError("AI tidak mengembalikan format skor yang valid.")
    try:
        hasil = json.loads(konten[awal:akhir + 1])
        skor = max(0, min(100, round(float(hasil.get("skor", 0)))))
        catatan = str(hasil.get("catatan", "") or "").strip()
    except Exception as exc:
        raise RuntimeError("Gagal membaca hasil penilaian AI.") from exc

    return skor, catatan


@app.route("/api/koreksi", methods=["POST"])
def koreksi():
    if not GROQ_API_KEY:
        return jsonify({
            "error": (
                "GROQ_API_KEY belum diisi di file .env. "
                "Dapatkan API key gratis di https://console.groq.com/keys"
            )
        }), 503

    data = request.get_json(silent=True) or {}
    try:
        kb = int(data.get("kb"))
    except (TypeError, ValueError):
        return jsonify({"error": "Parameter 'kb' tidak valid."}), 400
    sintaks = (data.get("sintaks") or "").strip()
    jawaban = data.get("jawaban") or {}

    daftar_soal = RUBRIK_KOREKSI.get(kb, {}).get(sintaks)
    if not daftar_soal:
        return jsonify({"error": f"Rubrik untuk KB {kb} - sintaks '{sintaks}' tidak ditemukan."}), 400

    if not isinstance(jawaban, dict) or not any(str(v or "").strip() for v in jawaban.values()):
        return jsonify({"error": "Jawaban tidak boleh kosong."}), 400

    label = SINTAKS_LABEL.get(sintaks, sintaks)
    blok_soal = []
    for i, soal in enumerate(daftar_soal, start=1):
        jwb = str(jawaban.get(soal["field"], "") or "").strip() or "(kosong)"
        kunci = ", ".join(soal["kata_kunci"])
        blok_soal.append(
            f"Soal {i}: {soal['pertanyaan']}\n"
            f"Kata kunci/konsep inti yang diharapkan: {kunci}\n"
            f"Jawaban siswa: {jwb}"
        )
    prompt_user = (
        f"Sintaks: {label} (Kegiatan Belajar {kb})\n\n" + "\n\n".join(blok_soal) +
        "\n\nBerikan SATU skor 0-100 untuk keseluruhan sintaks ini sesuai instruksi sistem."
    )

    try:
        skor, catatan = _panggil_groq_koreksi(prompt_user)
        return jsonify({"skor": skor, "catatan": catatan})
    except requests.RequestException:
        logger.exception("Gagal terhubung ke Groq API (koreksi)")
        return jsonify({"error": "Tidak dapat terhubung ke server Groq. Cek koneksi internet."}), 502
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception:
        logger.exception("Unexpected error in /api/koreksi")
        return jsonify({"error": "Terjadi kesalahan tak terduga di server."}), 500


@app.route("/api/rekap", methods=["POST"])
def rekap():
    """
    Proxy dari front-end (script.js) ke Web App Google Apps Script (Code.gs),
    yang menulis nilai Evaluasi / KB1 / KB2 ke Spreadsheet "Rekapan DenoMath".

    KENAPA LEWAT PROXY INI (bukan browser -> Apps Script langsung)?
    Sebelumnya script.js memanggil URL Apps Script langsung dari browser
    dengan fetch(..., { mode: 'no-cors' }). Mode itu membuat browser TIDAK
    PERNAH bisa membaca isi balasan Apps Script (responsnya "opaque") —
    sehingga status.innerHTML selalu menampilkan "berhasil tersimpan" WALAUPUN
    sebenarnya gagal di sisi server (mis. Apps Script belum di-deploy ulang,
    URL sudah tidak aktif, dsb). Kesalahan jadi tidak pernah kelihatan.

    Dengan proxy ini, browser hanya bicara ke server Flask sendiri (satu
    origin, tidak ada isu CORS sama sekali), lalu SERVER-lah yang meneruskan
    request ke Apps Script memakai library `requests` (komunikasi
    server-ke-server tidak kena aturan CORS browser). Balasan asli dari Apps
    Script (status ok / error) diteruskan apa adanya ke front-end, sehingga
    kalau memang gagal, pesan errornya akan benar-benar tampil ke pengguna.
    """
    if GOOGLE_SHEETS_URL_BELUM_DIKONFIGURASI:
        return jsonify({
            "status": "error",
            "message": (
                "GOOGLE_SHEETS_URL belum diisi dengan URL Web App yang valid di "
                "file .env pada server. Deploy Code.gs ke spreadsheet rekap yang "
                "baru dulu, lalu isi GOOGLE_SHEETS_URL dengan URL \"/exec\" hasilnya."
            ),
        }), 503

    if GOOGLE_SHEETS_URL.rstrip("/").endswith("/dev"):
        return jsonify({
            "status": "error",
            "message": (
                "GOOGLE_SHEETS_URL di .env server masih memakai URL deployment TES "
                "(berakhiran \"/dev\"), yang hanya bisa diakses oleh akun pemilik "
                "Apps Script. Buka Apps Script > Deploy > Manage deployments, salin "
                "URL Web app yang berakhiran \"/exec\", lalu ganti GOOGLE_SHEETS_URL "
                "di .env dengan URL tersebut."
            ),
        }), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not payload:
        return jsonify({"status": "error", "message": "Payload rekap kosong/tidak valid."}), 400

    try:
        resp = requests.post(GOOGLE_SHEETS_URL, json=payload, timeout=15)
    except requests.RequestException as exc:
        logger.exception("Gagal menghubungi Google Apps Script (/api/rekap)")
        return jsonify({
            "status": "error",
            "message": f"Server tidak dapat terhubung ke Google Sheets: {exc}",
        }), 502

    try:
        data = resp.json()
    except ValueError:
        logger.error(
            "Respons Apps Script bukan JSON (HTTP %d): %s",
            resp.status_code, resp.text[:300],
        )
        return jsonify({
            "status": "error",
            "message": (
                f"Google Apps Script membalas format tak terduga (HTTP {resp.status_code}). "
                "Cek apakah deployment Web App Apps Script masih aktif "
                "(Deploy > Manage deployments) dan akses diset ke 'Anyone'."
            ),
        }), 502

    if data.get("status") != "ok":
        logger.warning("Apps Script mengembalikan error (/api/rekap): %s", data.get("message"))
        return jsonify({
            "status": "error",
            "message": data.get("message") or "Google Apps Script mengembalikan error.",
        }), 502

    return jsonify(data)


@app.route("/api/video-lainnya", methods=["GET"])
def video_lainnya():
    """
    Proxy ke YouTube Data API v3 (search.list) untuk mengisi baris
    "Lainnya dari YouTube" di tab Video dengan video-video LAIN di luar
    daftar kurasi manual — hasilnya memakai algoritma pencarian & relevansi
    YouTube sendiri (bukan daftar statis buatan kita), supaya siswa punya
    lebih banyak pilihan tontonan seputar materi yang sama.

    Query string:
      q        : kata kunci pencarian (wajib)
      exclude  : daftar video ID yang SUDAH tampil (dipisah koma), supaya
                 tidak dobel dengan video kurasi manual / yang sudah dimuat.
      max      : jumlah hasil (opsional, default 12, maksimal 25)

    Kenapa lewat proxy backend (bukan fetch langsung dari browser ke
    YouTube API)? Supaya YOUTUBE_API_KEY tidak pernah terekspos ke
    front-end / DevTools browser siswa.
    """
    if not YOUTUBE_API_KEY:
        return jsonify({
            "status": "error",
            "message": "YOUTUBE_API_KEY belum diisi di file .env pada server.",
        }), 503

    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"status": "error", "message": "Parameter 'q' (kata kunci pencarian) wajib diisi."}), 400

    exclude_raw = (request.args.get("exclude") or "").strip()
    exclude_ids = {v.strip() for v in exclude_raw.split(",") if v.strip()}

    try:
        max_results = int(request.args.get("max", 12))
    except (TypeError, ValueError):
        max_results = 12
    max_results = max(1, min(max_results, 25))

    params = {
        "key": YOUTUBE_API_KEY,
        "part": "snippet",
        "q": query,
        "type": "video",
        "videoEmbeddable": "true",   # hanya video yang memang bisa disematkan (embed)
        "safeSearch": "strict",      # konteks sekolah — filter konten paling ketat
        "relevanceLanguage": "id",
        "maxResults": min(max_results + len(exclude_ids), 25),
    }

    try:
        resp = requests.get(YOUTUBE_SEARCH_URL, params=params, timeout=12)
    except requests.RequestException as exc:
        logger.exception("Gagal menghubungi YouTube Data API (/api/video-lainnya)")
        return jsonify({
            "status": "error",
            "message": f"Server tidak dapat terhubung ke YouTube: {exc}",
        }), 502

    if resp.status_code != 200:
        logger.warning("YouTube Data API membalas error (HTTP %d): %s", resp.status_code, resp.text[:300])
        return jsonify({
            "status": "error",
            "message": f"YouTube Data API membalas error (HTTP {resp.status_code}). Cek YOUTUBE_API_KEY / kuota API.",
        }), 502

    try:
        data = resp.json()
    except ValueError:
        return jsonify({"status": "error", "message": "YouTube Data API membalas format tak terduga."}), 502

    hasil = []
    for item in data.get("items", []):
        video_id = (item.get("id") or {}).get("videoId")
        if not video_id or video_id in exclude_ids:
            continue
        snippet = item.get("snippet") or {}
        thumb = (
            (snippet.get("thumbnails") or {}).get("medium")
            or (snippet.get("thumbnails") or {}).get("default")
            or {}
        )
        hasil.append({
            "id": video_id,
            "judul": snippet.get("title") or "(tanpa judul)",
            "deskripsi": snippet.get("description") or "",
            "channel": snippet.get("channelTitle") or "",
            "thumbnail": thumb.get("url") or f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        })
        if len(hasil) >= max_results:
            break

    return jsonify({"status": "ok", "videos": hasil})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "provider": "groq" if GROQ_API_KEY else None,
        "provider_ready": bool(GROQ_API_KEY),
        "model": GROQ_MODEL,
        "sheets_rekap_ready": not GOOGLE_SHEETS_URL_BELUM_DIKONFIGURASI,
        "youtube_ready": bool(YOUTUBE_API_KEY),
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
        system += f"\nSiswa yang sedang belajar: nama '{nama or '-'}', sekolah '{kelas or '-'}'."

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
                # Groq tidak selalu mengirim header charset pada respons
                # text/event-stream-nya, sehingga tanpa baris ini `requests`
                # menebak encoding sebagai ISO-8859-1 dan merusak semua
                # karakter non-ASCII (emoji, tanda petik pintar, "—", dll)
                # menjadi teks acak seperti "Ã¢â‚¬" pada balasan DENO AI.
                resp.encoding = "utf-8"

                if resp.status_code != 200:
                    if resp.status_code == 401:
                        err = "API Key Groq tidak valid atau sudah kedaluwarsa. Cek file .env."
                    elif resp.status_code == 429:
                        err = "Batas permintaan Groq tercapai. Coba lagi sebentar."
                    else:
                        try:
                            err_data = resp.json()
                            raw_err = err_data.get("error", {}).get("message", "Groq API error")
                        except Exception:
                            raw_err = f"Groq API error ({resp.status_code})"

                        if resp.status_code == 400 and "does not exist" in raw_err.lower():
                            err = (
                                f"Model AI '{GROQ_MODEL}' sudah tidak tersedia di Groq "
                                "(kemungkinan sudah deprecated/dihentikan). "
                                "Ganti nilai DENOMATH_AI_MODEL di file .env, misalnya ke "
                                "'openai/gpt-oss-120b', lalu restart server. "
                                f"Pesan asli: {raw_err}"
                            )
                        else:
                            err = raw_err
                        logger.error("Groq API error %d: %s", resp.status_code, raw_err)
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
    logger.info("Buka aplikasi di browser lewat: http://localhost:5000/")
    logger.info("(Jangan buka index.html langsung dengan dobel klik — video YouTube bisa error.)")
    app.run(host="0.0.0.0", port=5000, debug=True)