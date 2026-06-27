/* ============================================================
   DENOMATH – script.js (REVISI)
   Perubahan:
   - Intro redenominasi setelah login (sebelum menu utama)
   - Penyajian Data dihapus dari menu
   - Belajar: CP&TP → Pilih KB → CBL (Big Idea…Asesmen)
   - Evaluasi: tanpa feedback langsung, ada menu Pembahasan di akhir
   - Bank soal 20 soal
   ============================================================ */

/* ──────────────────────────────────────────────
   GOOGLE SHEETS CONFIG
────────────────────────────────────────────── */
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzv-7n1zWrEQMCMR-YThh8GTQAaoKGoaLMT3om_XwJsKOKuwodBlaOBFvpVxlevVJdm/exec';

/* ──────────────────────────────────────────────
   DENO AI CONFIG
   Memanggil backend Flask (app.py), BUKAN langsung
   ke OpenAI API dari browser.

   Kenapa harus lewat backend?
   - Memanggil OpenAI API langsung dari browser akan
     mengekspos API key ke siapa saja yang membuka
     DevTools / Network tab pengunjung.
   - Lewat backend, API key disimpan aman di server
     (environment variable), TIDAK PERNAH dikirim ke
     browser siswa.

   ⚠️ PENTING — CARA MENJALANKAN:
   1. Buka terminal, masuk ke folder project ini.
   2. Install dependency Python (sekali saja):
        pip install -r requirements.txt
   3. Set API key OpenAI kamu sebagai environment
      variable (JANGAN ditulis di file kode manapun):
        Mac/Linux : export OPENAI_API_KEY="sk-xxxx"
        Windows   : setx OPENAI_API_KEY "sk-xxxx"
        (Windows: tutup & buka ulang terminal setelah setx)
   4. Jalankan backend:
        python app.py
      Biarkan terminal ini TETAP TERBUKA & BERJALAN.
      Kamu akan melihat tulisan kira-kira:
        "Running on http://0.0.0.0:5000"
   5. Buka index.html di browser (boleh double-click
      file-nya, atau lewat server statis seperti
      `python -m http.server 8000`).
   6. Jika backend BELUM dijalankan, widget "Tanya AI"
      akan menampilkan pesan jelas: "Backend belum aktif".

   AI_API_URL di bawah ini menunjuk ke backend lokal.
   Jika kamu deploy app.py ke server lain (Railway,
   Render, dst), ganti URL ini ke alamat server itu.
────────────────────────────────────────────── */
const AI_API_URL = 'http://localhost:5000/api/chat';
const AI_HEALTH_URL = 'http://localhost:5000/api/health';

/* ──────────────────────────────────────────────
   STATE GLOBAL
────────────────────────────────────────────── */
const state = {
  user: { nama: '', absen: '', kelas: '' },
  currentPage: 'beranda',
  introSceneIndex: 0,
  kbSelesai: [false, false],
  kalcMode: 'lama-ke-baru',
  evalSoalIndex: 0,
  evalSkor: 0,
  evalSudahJawab: false,
  evalSoalOrder: [],
  evalJawabanSiswa: [],
  evalSelesai: false,
  // --- DENO AI ---
  aiOpen: false,
  aiHistory: [],       // {role:'user'|'assistant', content:string}
  aiSending: false,
  aiVoiceOn: false,    // mode percakapan suara (TTS otomatis untuk balasan AI)
  aiListening: false,
  aiRecognition: null, // instance SpeechRecognition aktif (jika ada)
  aiBackendChecked: false,
  // --- BUAT DIAGRAM (alat bantu) ---
  diagTipe: 'batang',
};

/* ──────────────────────────────────────────────
   INTRO SCENES – Pengenalan Redenominasi
   (muncul setelah login, sebelum menu utama)
────────────────────────────────────────────── */
const introScenes = [
  {
    speaker: 'left',
    leftActive: true,
    leftBubble: 'Halo teman-teman! Aku Pak Rupi 🧑‍🏫. Sebelum kamu mulai belajar di DENOMATH, aku mau kenalkan dulu satu konsep penting: <strong>Redenominasi Rupiah</strong>!',
    rightBubble: '',
    visual: `<div class="visual-info">
      <div class="visual-emoji">💰</div>
      <div class="visual-text"><strong>Redenominasi Rupiah</strong><br>Topik seru yang akan kamu pelajari hari ini!</div>
    </div>`,
  },
  {
    speaker: 'right',
    leftActive: false,
    leftBubble: '',
    rightBubble: 'Pak Rupi, redenominasi itu apa ya? Apa uang kita bakal hilang nilainya? Aku khawatir 😨',
    visual: `<div class="visual-info visual-tanya">
      <div class="visual-emoji">🤔</div>
      <div class="visual-text">Pertanyaan bagus sekali! Yuk cari tahu bersama…</div>
    </div>`,
  },
  {
    speaker: 'left',
    leftActive: true,
    leftBubble: 'Tenang, Uni Deno! <strong>Redenominasi</strong> adalah penyederhanaan angka pada mata uang. Nilainya <em>TIDAK berubah</em> — hanya angkanya yang diperkecil dengan cara dibagi 1.000!',
    rightBubble: '',
    visual: `<div class="visual-konversi">
      <div class="kv-item kv-lama">
        <div class="kv-label">Sebelum</div>
        <div class="kv-nilai">Rp 1.000.000</div>
      </div>
      <div class="kv-arrow">⟹</div>
      <div class="kv-item kv-baru">
        <div class="kv-label">Sesudah</div>
        <div class="kv-nilai">Rp 1.000</div>
      </div>
    </div>`,
  },
  {
    speaker: 'right',
    leftActive: false,
    leftBubble: '',
    rightBubble: 'Oh! Jadi seperti memotong tiga nol terakhirnya? Berarti Rp 75.000 jadi Rp 75 dong, Pak? Karena 75.000 ÷ 1.000 = 75!',
    visual: `<div class="visual-konversi">
      <div class="kv-item kv-lama">
        <div class="kv-label">Rp 75.000</div>
        <div class="kv-nilai">÷ 1.000</div>
      </div>
      <div class="kv-arrow">⟹</div>
      <div class="kv-item kv-baru">
        <div class="kv-label">Rp 75</div>
        <div class="kv-nilai">✅ Benar!</div>
      </div>
    </div>`,
  },
  {
    speaker: 'left',
    leftActive: true,
    leftBubble: 'Tepat sekali! 🎉 Rumusnya: <strong>Harga Baru = Harga Lama ÷ 1.000</strong>. Nilai daya belinya tetap sama. Ini berbeda dengan sanering yang memangkas nilai riil uang!',
    rightBubble: '',
    visual: `<div class="visual-rumus">
      <div class="rumus-judul">📐 Rumus Redenominasi</div>
      <div class="rumus-formula">Harga Baru = Harga Lama <span class="rumus-op">÷</span> 1.000</div>
      <div class="rumus-contoh">Rp 50.000 → Rp 50 &nbsp;|&nbsp; Rp 200.000 → Rp 200</div>
    </div>`,
  },
  {
    speaker: 'right',
    leftActive: false,
    leftBubble: '',
    rightBubble: 'Wah, sekarang aku paham! Terima kasih Pak Rupi! 🙌 Aku siap mulai belajar Redenominasi dan Penyajian Data di DENOMATH!',
    visual: `<div class="visual-info visual-selesai">
      <div class="visual-emoji">🌟</div>
      <div class="visual-text"><strong>Hebat!</strong> Kamu sudah paham konsep dasar Redenominasi Rupiah.<br>Selamat belajar di DENOMATH!</div>
    </div>`,
  },
];

/* ──────────────────────────────────────────────
   BANK SOAL EVALUASI – 20 SOAL
   (Redenominasi + Penyajian Data)
────────────────────────────────────────────── */
const bankSoal = [
  {
    soal: 'Redenominasi mata uang adalah proses…',
    pilihan: [
      'Mengurangi nilai mata uang secara drastis sehingga daya beli masyarakat menurun',
      'Menyederhanakan angka pada mata uang tanpa mengubah nilai daya belinya',
      'Mengganti mata uang rupiah dengan jenis mata uang yang baru',
      'Menaikkan nilai mata uang rupiah terhadap dolar Amerika',
    ],
    jawaban: 1,
    penjelasan: 'Redenominasi hanya menyederhanakan angka (misalnya menghilangkan tiga nol), tetapi nilai daya beli masyarakat tetap sama. Berbeda dengan sanering yang memangkas nilai riil uang.',
  },
  {
    soal: 'Jika redenominasi dilakukan dengan faktor 1.000, berapakah nilai rupiah baru dari Rp 50.000?',
    pilihan: ['Rp 50.000.000', 'Rp 500', 'Rp 50', 'Rp 5'],
    jawaban: 2,
    penjelasan: 'Rp 50.000 ÷ 1.000 = Rp 50 (rupiah baru). Rumus: Harga Baru = Harga Lama ÷ 1.000.',
  },
  {
    soal: 'Harga sebuah buku adalah Rp 25.000. Setelah redenominasi (÷1.000), harga buku tersebut menjadi…',
    pilihan: ['Rp 2.500', 'Rp 250', 'Rp 25', 'Rp 2,5'],
    jawaban: 2,
    penjelasan: 'Rp 25.000 ÷ 1.000 = Rp 25. Tiga angka nol di belakang dihilangkan.',
  },
  {
    soal: 'Apa perbedaan utama antara redenominasi dan sanering?',
    pilihan: [
      'Redenominasi mengurangi nilai uang, sanering tidak mengubah nilai uang',
      'Keduanya sama saja, hanya istilah yang berbeda dalam ekonomi',
      'Redenominasi hanya menyederhanakan angka, sanering memangkas nilai riil uang',
      'Sanering lebih menguntungkan masyarakat daripada redenominasi',
    ],
    jawaban: 2,
    penjelasan: 'Pada redenominasi, daya beli masyarakat tidak berubah. Pada sanering, nilai riil uang dipangkas sehingga merugikan masyarakat karena harga tidak ikut turun.',
  },
  {
    soal: 'Bu Sari membayar sebuah barang seharga Rp 65 dalam rupiah baru. Berapakah harga barang tersebut dalam rupiah lama?',
    pilihan: ['Rp 650', 'Rp 6.500', 'Rp 65.000', 'Rp 650.000'],
    jawaban: 2,
    penjelasan: 'Untuk mengkonversi ke rupiah lama: Rp 65 × 1.000 = Rp 65.000. Kebalikan dari rumus redenominasi.',
  },
  {
    soal: 'Apakah tujuan utama dilakukannya redenominasi mata uang?',
    pilihan: [
      'Membuat Indonesia menjadi negara yang lebih kaya',
      'Menyederhanakan transaksi dan mengurangi kesalahan penulisan angka',
      'Menurunkan inflasi secara langsung dan signifikan',
      'Mengubah desain dan warna uang kertas',
    ],
    jawaban: 1,
    penjelasan: 'Redenominasi bertujuan menyederhanakan sistem penulisan angka agar transaksi lebih mudah, efisien, dan mengurangi kemungkinan kesalahan dalam penulisan jumlah uang.',
  },
  {
    soal: 'Perhatikan tabel harga sayur Pak Budi berikut. Setelah dikonversi ke rupiah baru, sayur manakah yang harganya PALING MAHAL?',
    visual: `<div class="eval-visual-caption">📋 Tabel Harga Sayur Pak Budi</div>
      <table class="data-table"><thead><tr><th>Sayur</th><th>Harga Lama</th></tr></thead>
      <tbody>
        <tr><td>🌿 Bayam</td><td>Rp 5.000</td></tr>
        <tr><td>🌿 Kangkung</td><td>Rp 3.000</td></tr>
        <tr><td>🥕 Wortel</td><td>Rp 8.000</td></tr>
        <tr><td>🍅 Tomat</td><td>Rp 12.000</td></tr>
      </tbody></table>`,
    pilihan: ['Bayam (Rp 5)', 'Kangkung (Rp 3)', 'Wortel (Rp 8)', 'Tomat (Rp 12)'],
    jawaban: 3,
    penjelasan: 'Tomat Rp 12.000 ÷ 1.000 = Rp 12, yang merupakan nilai tertinggi. Urutan harga tidak berubah setelah redenominasi.',
  },
  {
    soal: 'Sebelum redenominasi, seseorang dapat membeli 5 kg beras seharga Rp 65.000. Apa yang terjadi setelah redenominasi diberlakukan?',
    pilihan: [
      'Ia hanya bisa membeli 1 kg beras karena uangnya berkurang',
      'Ia tetap bisa membeli 5 kg beras karena daya belinya tidak berubah',
      'Ia bisa membeli 5.000 kg beras karena harganya turun drastis',
      'Ia tidak bisa membeli beras sama sekali',
    ],
    jawaban: 1,
    penjelasan: 'Redenominasi tidak mengubah daya beli. Dengan Rp 65 (baru) ia tetap bisa membeli 5 kg beras yang kini juga seharga Rp 65 (baru). Nilai riilnya sama persis.',
  },
  {
    soal: 'Perhatikan tabel belanja Bu Sari dalam rupiah baru berikut. Berapakah total seluruh pengeluaran Bu Sari?',
    visual: `<div class="eval-visual-caption">📋 Tabel Belanja Bu Sari (Rupiah Baru)</div>
      <table class="data-table"><thead><tr><th>Barang</th><th>Harga Baru</th></tr></thead>
      <tbody>
        <tr><td>🍚 Beras 5 kg</td><td>Rp 65</td></tr>
        <tr><td>🥚 Telur 1 kg</td><td>Rp 28</td></tr>
        <tr><td>🛢️ Minyak 1 L</td><td>Rp 15</td></tr>
        <tr><td>🧂 Gula 1 kg</td><td>Rp 17</td></tr>
        <tr><td>🐟 Ikan 500 g</td><td>Rp 22</td></tr>
      </tbody></table>`,
    pilihan: ['Rp 137', 'Rp 147', 'Rp 157', 'Rp 127'],
    jawaban: 1,
    penjelasan: '65 + 28 + 15 + 17 + 22 = 147 (rupiah baru). Ini sama dengan Rp 147.000 dalam rupiah lama.',
  },
  {
    soal: 'Data jumlah tabungan harian dalam rupiah dan data jenis kelamin siswa adalah dua contoh data yang berbeda jenis. Apa nama jenis data untuk masing-masing contoh tersebut secara berurutan?',
    pilihan: [
      'Keduanya termasuk data kuantitatif',
      'Jumlah tabungan = data kuantitatif, jenis kelamin = data kualitatif',
      'Jumlah tabungan = data kualitatif, jenis kelamin = data kuantitatif',
      'Keduanya termasuk data kualitatif',
    ],
    jawaban: 1,
    penjelasan: 'Data kuantitatif berbentuk angka (misalnya jumlah tabungan), sedangkan data kualitatif tidak dinyatakan dalam angka melainkan kategori (misalnya jenis kelamin).',
  },
  {
    soal: 'Penyajian data manakah yang paling tepat digunakan untuk menampilkan PERBANDINGAN harga beberapa jenis sayur secara langsung?',
    pilihan: [
      'Diagram Lingkaran (Pie Chart)',
      'Diagram Batang',
      'Diagram Garis',
      'Paragraf narasi biasa',
    ],
    jawaban: 1,
    penjelasan: 'Diagram batang digunakan untuk membandingkan nilai beberapa kategori secara langsung dan visual. Semakin tinggi batang, semakin besar nilainya.',
  },
  {
    soal: 'Diagram manakah yang paling tepat digunakan untuk menampilkan tren kenaikan harga beras dari bulan Januari sampai Desember?',
    pilihan: ['Diagram Batang', 'Tabel', 'Diagram Garis', 'Diagram Lingkaran'],
    jawaban: 2,
    penjelasan: 'Diagram garis digunakan untuk menampilkan tren perubahan data dari waktu ke waktu. Titik-titik data dihubungkan dengan garis untuk menunjukkan pola perubahan.',
  },
  {
    soal: 'Perhatikan tabel pengeluaran Pak Andi sebesar Rp 1.000.000 berikut. Berapakah besar sudut sektor pada diagram lingkaran untuk kategori Tabungan Jangka Panjang?',
    visual: `<div class="eval-visual-caption">📋 Tabel &amp; Diagram Pengeluaran Pak Andi (Rp 1.000.000)</div>
      <table class="data-table"><thead><tr><th>Kategori</th><th>Nominal</th></tr></thead>
      <tbody>
        <tr><td>💰 Tabungan Jangka Panjang</td><td>Rp 400.000</td></tr>
        <tr><td>🛒 Kebutuhan Sehari-hari</td><td>Rp 300.000</td></tr>
        <tr><td>🎮 Hiburan</td><td>Rp 200.000</td></tr>
        <tr><td>🚨 Dana Darurat</td><td>Rp 100.000</td></tr>
      </tbody></table>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 40%, var(--biru-mid) 40% 70%, var(--violet) 70% 90%, var(--red) 90% 100%)"></div>
        <div class="pie-legend">
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--emas)"></span>Tabungan Jangka Panjang (40%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--biru-mid)"></span>Kebutuhan Sehari-hari (30%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--violet)"></span>Hiburan (20%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--red)"></span>Dana Darurat (10%)</div>
        </div>
      </div>`,
    pilihan: ['90°', '144°', '216°', '288°'],
    jawaban: 1,
    penjelasan: 'Besar sudut sektor = (Nilai ÷ Total) × 360°. Tabungan Jangka Panjang: (400.000 ÷ 1.000.000) × 360° = 144°.',
  },
  {
    soal: 'Apa keuntungan menyajikan data dalam bentuk TABEL dibandingkan dengan diagram?',
    pilihan: [
      'Lebih mudah membandingkan data secara visual dan cepat',
      'Menampilkan tren perubahan dari waktu ke waktu dengan jelas',
      'Menyajikan data lebih lengkap dan detail dengan angka pasti',
      'Lebih menarik secara visual dan mudah dipahami semua orang',
    ],
    jawaban: 2,
    penjelasan: 'Tabel menyajikan data paling lengkap dan detail karena menampilkan angka pasti setiap data, cocok untuk melihat rincian data yang spesifik.',
  },
  {
    soal: 'Perhatikan tabel persentase pengeluaran Pak Andi berikut. Kategori manakah yang paling tepat ditampilkan sebagai sektor TERBESAR pada diagram lingkaran?',
    visual: `<div class="eval-visual-caption">📋 Tabel &amp; Diagram Persentase Pengeluaran Pak Andi</div>
      <table class="data-table"><thead><tr><th>Kategori</th><th>Persentase</th></tr></thead>
      <tbody>
        <tr><td>💰 Tabungan Jangka Panjang</td><td>40%</td></tr>
        <tr><td>🛒 Kebutuhan Sehari-hari</td><td>30%</td></tr>
        <tr><td>🎮 Hiburan</td><td>20%</td></tr>
        <tr><td>🚨 Dana Darurat</td><td>10%</td></tr>
      </tbody></table>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 40%, var(--biru-mid) 40% 70%, var(--violet) 70% 90%, var(--red) 90% 100%)"></div>
        <div class="pie-legend">
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--emas)"></span>Tabungan Jangka Panjang (40%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--biru-mid)"></span>Kebutuhan Sehari-hari (30%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--violet)"></span>Hiburan (20%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--red)"></span>Dana Darurat (10%)</div>
        </div>
      </div>`,
    pilihan: [
      'Dana Darurat (10%)',
      'Hiburan (20%)',
      'Kebutuhan Sehari-hari (30%)',
      'Tabungan Jangka Panjang (40%)',
    ],
    jawaban: 3,
    penjelasan: 'Diagram lingkaran menampilkan proporsi tiap bagian dari keseluruhan data. Sektor terbesar adalah Tabungan Jangka Panjang dengan persentase 40%.',
  },
  {
    soal: 'Perhatikan diagram batang harga sayur Pak Budi (rupiah baru) berikut. Batang yang PALING PENDEK mewakili sayur…',
    visual: `<div class="eval-visual-caption">📊 Diagram Batang Harga Sayur (Rupiah Baru)</div>
      <div class="diagram-batang">
        <div class="batang-wrap"><div class="batang" style="height:50px"></div><span>Bayam (5)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:30px"></div><span>Kangkung (3)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:80px"></div><span>Wortel (8)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:120px"></div><span>Tomat (12)</span></div>
      </div>`,
    pilihan: ['Bayam (Rp 5)', 'Kangkung (Rp 3)', 'Wortel (Rp 8)', 'Tomat (Rp 12)'],
    jawaban: 1,
    penjelasan: 'Kangkung Rp 3.000 → Rp 3 (baru) adalah nilai terkecil, sehingga batangnya paling pendek dalam diagram. Batang pendek = nilai kecil.',
  },
  {
    soal: 'Harga 1 kg telur yang semula Rp 28.000 menjadi Rp 28 setelah redenominasi. Jika seseorang membeli 3 kg telur, berapakah yang harus dibayar dalam rupiah baru?',
    pilihan: ['Rp 84.000', 'Rp 840', 'Rp 84', 'Rp 8,4'],
    jawaban: 2,
    penjelasan: '3 × Rp 28 = Rp 84 (rupiah baru), atau setara dengan 3 × Rp 28.000 = Rp 84.000 (rupiah lama). Operasi hitung tetap sama!',
  },
  {
    soal: 'Perhatikan tabel hasil pencatatan tabungan harian siswa berikut (dalam rupiah baru). Nilai manakah yang merupakan MODUS (paling sering muncul) dari data tersebut?',
    visual: `<div class="eval-visual-caption">📋 Tabel Turus Tabungan Harian Siswa</div>
      <table class="data-table"><thead><tr><th>Nominal Tabungan</th><th>Turus</th><th>Frekuensi</th></tr></thead>
      <tbody>
        <tr><td>Rp 2</td><td>III</td><td>3</td></tr>
        <tr><td>Rp 5</td><td>IIIII I</td><td>6</td></tr>
        <tr><td>Rp 3</td><td>IIII</td><td>4</td></tr>
        <tr><td>Rp 10</td><td>II</td><td>2</td></tr>
      </tbody></table>`,
    pilihan: ['Rp 2 (frekuensi 3)', 'Rp 5 (frekuensi 6)', 'Rp 3 (frekuensi 4)', 'Rp 10 (frekuensi 2)'],
    jawaban: 1,
    penjelasan: 'Modus adalah nilai dengan frekuensi paling besar. Pada tabel, Rp 5 muncul sebanyak 6 kali, paling sering dibandingkan nilai lainnya.',
  },
  {
    soal: 'Perhatikan tabel pendapatan harian seorang pedagang berikut (rupiah lama). Berapakah pendapatan hari Selasa jika dikonversi ke rupiah baru?',
    visual: `<div class="eval-visual-caption">📋 Tabel Pendapatan Harian Pedagang (Rupiah Lama)</div>
      <table class="data-table"><thead><tr><th>Hari</th><th>Pendapatan</th></tr></thead>
      <tbody>
        <tr><td>Senin</td><td>Rp 250.000</td></tr>
        <tr><td>Selasa</td><td>Rp 300.000</td></tr>
        <tr><td>Rabu</td><td>Rp 275.000</td></tr>
      </tbody></table>`,
    pilihan: ['Rp 30.000', 'Rp 3.000', 'Rp 300', 'Rp 3'],
    jawaban: 2,
    penjelasan: 'Rp 300.000 ÷ 1.000 = Rp 300 (rupiah baru). Rumus redenominasi berlaku untuk semua nominal.',
  },
  {
    soal: 'Perhatikan tabel pengeluaran kuota internet siswa selama Januari–Juni berikut. Pada bulan apakah pengeluaran kuota internet siswa PALING TINGGI?',
    visual: `<div class="eval-visual-caption">📊 Diagram Batang Pengeluaran Kuota Internet</div>
      <div class="diagram-batang">
        <div class="batang-wrap"><div class="batang" style="height:76px"></div><span>Jan (3.800)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:80px"></div><span>Feb (4.000)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:72px"></div><span>Mar (3.600)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:84px"></div><span>Apr (4.200)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:80px"></div><span>Mei (4.000)</span></div>
        <div class="batang-wrap"><div class="batang" style="height:88px"></div><span>Jun (4.400)</span></div>
      </div>`,
    pilihan: ['Januari', 'April', 'Mei', 'Juni'],
    jawaban: 3,
    penjelasan: 'Pengeluaran kuota internet tertinggi terjadi pada bulan Juni sebesar Rp 4.400, terlihat dari batang yang paling tinggi pada diagram.',
  },
  {
    soal: 'Jika total pengeluaran Bu Sari dalam rupiah lama adalah Rp 147.000, berapakah persentase pengeluaran untuk beras (Rp 65.000) terhadap total pengeluaran?',
    visual: `<div class="eval-visual-caption">📋 Tabel Belanja Bu Sari (Rupiah Lama)</div>
      <table class="data-table"><thead><tr><th>Barang</th><th>Harga</th></tr></thead>
      <tbody>
        <tr><td>🍚 Beras 5 kg</td><td>Rp 65.000</td></tr>
        <tr><td>🥚 Telur 1 kg</td><td>Rp 28.000</td></tr>
        <tr><td>🛢️ Minyak 1 L</td><td>Rp 15.000</td></tr>
        <tr><td>🧂 Gula 1 kg</td><td>Rp 17.000</td></tr>
        <tr><td>🐟 Ikan 500 g</td><td>Rp 22.000</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>Rp 147.000</strong></td></tr>
      </tbody></table>`,
    pilihan: ['35,2%', '44,2%', '52,1%', '28,5%'],
    jawaban: 1,
    penjelasan: '(65.000 ÷ 147.000) × 100% ≈ 44,2%. Ini berlaku sama dalam rupiah baru: (65 ÷ 147) × 100% ≈ 44,2%. Proporsi tidak berubah setelah redenominasi!',
  },
];

/* ──────────────────────────────────────────────
   NAVIGASI HALAMAN
────────────────────────────────────────────── */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (activeLink) activeLink.classList.add('active');
  state.currentPage = pageId;
  if (pageId === 'belajar') updateProgressUI();
}

/* ──────────────────────────────────────────────
   LOGIN
────────────────────────────────────────────── */
function handleLogin() {
  const nama  = document.getElementById('inputNama').value.trim();
  const absen = document.getElementById('inputAbsen').value.trim();
  const kelas = document.getElementById('inputKelas').value;

  if (!nama) { shakeInput('inputNama'); showToast('⚠️ Nama lengkap harus diisi!', 'warn'); return; }
  if (!absen || absen < 1 || absen > 40) { shakeInput('inputAbsen'); showToast('⚠️ Nomor absen tidak valid!', 'warn'); return; }
  if (!kelas) { shakeInput('inputKelas'); showToast('⚠️ Pilih kelas terlebih dahulu!', 'warn'); return; }

  state.user = { nama, absen, kelas };
  document.getElementById('namaDisplay').textContent  = nama;
  document.getElementById('kelasDisplay').textContent = kelas;
  document.getElementById('absenDisplay').textContent = absen;
  document.getElementById('sambutanSiswa').style.display = 'flex';
  document.getElementById('navNama').textContent = nama;

  // Sembunyikan login overlay
  const overlay = document.getElementById('loginOverlay');
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
    // Tampilkan intro redenominasi
    tampilkanIntroRedenominasi();
  }, 500);
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.classList.add('shake');
  el.focus();
  setTimeout(() => el.classList.remove('shake'), 500);
}

/* ──────────────────────────────────────────────
   INTRO REDENOMINASI (setelah login, sebelum menu)
────────────────────────────────────────────── */
function tampilkanIntroRedenominasi() {
  state.introSceneIndex = 0;
  const overlay = document.getElementById('introOverlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  buildIntroDots();
  renderIntroScene();
}

function buildIntroDots() {
  const container = document.getElementById('introDots');
  if (!container) return;
  container.innerHTML = '';
  introScenes.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'intro-dot';
    dot.dataset.i = i;
    dot.addEventListener('click', () => { state.introSceneIndex = i; renderIntroScene(); });
    container.appendChild(dot);
  });
}

function renderIntroScene() {
  const s = introScenes[state.introSceneIndex];
  const total = introScenes.length;

  document.getElementById('introSceneLabel').textContent = `Scene ${state.introSceneIndex + 1} / ${total}`;

  // Progress bar
  const pct = ((state.introSceneIndex + 1) / total) * 100;
  document.getElementById('introProgressFill').style.width = pct + '%';

  // Dots
  document.querySelectorAll('.intro-dot').forEach((d, i) => {
    d.classList.toggle('active', i === state.introSceneIndex);
    d.classList.toggle('done', i < state.introSceneIndex);
  });

  // Render stage HTML — hanya percakapan penuh Pak Rupi & Uni Deno (tanpa kotak definisi)
  const stage = document.getElementById('introStage');
  stage.innerHTML = `
    <div class="intro-char intro-char-left" style="opacity:${s.leftActive ? '1' : '0.45'}; transform:scale(${s.leftActive ? '1.02' : '0.97'})">
      <div class="stage-avatar">
        <div class="avatar-ring ring-blue">
          <img class="avatar-photo" src="https://i1.rgstatic.net/ii/profile.image/997820215615491-1614910286892_Q512/Adi-Satrio-Ardiansyah.jpg" alt="Pak Rupi">
        </div>
        <div class="avatar-name">Pak Rupi</div>
      </div>
      ${s.leftBubble ? `<div class="stage-bubble bubble-left show">${s.leftBubble}</div>` : ''}
    </div>

    <div class="intro-char intro-char-right" style="opacity:${!s.leftActive ? '1' : '0.45'}; transform:scale(${!s.leftActive ? '1.02' : '0.97'})">
      ${s.rightBubble ? `<div class="stage-bubble bubble-right show">${s.rightBubble}</div>` : ''}
      <div class="stage-avatar">
        <div class="avatar-ring ring-gold">
          <img class="avatar-photo" src="https://media.licdn.com/dms/image/v2/D5603AQEDblZhoYa93g/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1691187636607?e=2147483647&v=beta&t=fPcXvX5N1s2Tql0vno-AseqigetvC09luEpJB_KdV04" alt="Uni Deno">
        </div>
        <div class="avatar-name">Uni Deno</div>
      </div>
    </div>
  `;

  // Nav buttons
  document.getElementById('introBtnPrev').disabled = state.introSceneIndex === 0;
  const btnNext = document.getElementById('introBtnNext');
  if (state.introSceneIndex === total - 1) {
    btnNext.textContent = '✅ Mulai Belajar!';
    btnNext.onclick = selesaiIntroRedenominasi;
  } else {
    btnNext.textContent = 'Selanjutnya ▶';
    btnNext.onclick = introNextScene;
  }
}

function introNextScene() {
  if (state.introSceneIndex < introScenes.length - 1) {
    state.introSceneIndex++;
    renderIntroScene();
  }
}

function introPrevScene() {
  if (state.introSceneIndex > 0) {
    state.introSceneIndex--;
    renderIntroScene();
  }
}

function selesaiIntroRedenominasi() {
  const overlay = document.getElementById('introOverlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  showToast(`🎉 Selamat datang, ${state.user.nama}! Selamat belajar di DENOMATH!`, 'success');
}

/* ──────────────────────────────────────────────
   TOAST NOTIFIKASI
────────────────────────────────────────────── */
function showToast(pesan, tipe = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = pesan;
  toast.className = `toast toast-${tipe} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ──────────────────────────────────────────────
   BELAJAR – CP & TP → KB
────────────────────────────────────────────── */
function belajarNextStep() {
  document.getElementById('belajarStep1').style.display = 'none';
  document.getElementById('belajarStep2').style.display = 'block';
  updateProgressUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function belajarPrevStep() {
  document.getElementById('belajarStep2').style.display = 'none';
  document.getElementById('belajarStep1').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ──────────────────────────────────────────────
   CBL TABS
────────────────────────────────────────────── */
function gantiCBLTab(kb, tabNum) {
  // Sembunyikan semua content di KB ini
  for (let i = 1; i <= 9; i++) {
    const content = document.getElementById(`cblContent${kb}-${i}`);
    const tab = document.getElementById(`cblTab${kb}-${i}`);
    if (content) content.classList.remove('active');
    if (tab) tab.classList.remove('active');
  }
  // Tampilkan yang dipilih
  const target = document.getElementById(`cblContent${kb}-${tabNum}`);
  const targetTab = document.getElementById(`cblTab${kb}-${tabNum}`);
  if (target) target.classList.add('active');
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Animasi batang KB1 saat tab activities dibuka
  if (kb === 1 && tabNum === 6) {
    setTimeout(animasiBatangKB1, 300);
  }
}

/* ──────────────────────────────────────────────
   KEGIATAN BELAJAR – MODAL
────────────────────────────────────────────── */
function bukaKB(nomor) {
  const modal = document.getElementById(`modalKB${nomor}`);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function tutupModal(nomor) {
  const modal = document.getElementById(`modalKB${nomor}`);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function animateLocked(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 500);
}

/* ──────────────────────────────────────────────
   KB 1 – Diagram Batang Statis
────────────────────────────────────────────── */
function animasiBatangKB1() {
  const batangs = document.querySelectorAll('#diagramKB1 .batang');
  batangs.forEach((b, i) => {
    const target = parseInt(b.dataset.target);
    const label  = b.dataset.label;
    setTimeout(() => { b.style.height = target + 'px'; }, i * 200);
    b.onclick = () => {
      showToast(`📊 ${label}: Rp ${target} (baru) | Rp ${target * 1000} (lama)`, 'info');
    };
  });
}

/* ──────────────────────────────────────────────
   KB 2 – Diagram Batang Canvas
────────────────────────────────────────────── */
function buatDiagramKB2() {
  const ids    = ['kb2h1','kb2h2','kb2h3','kb2h4','kb2h5'];
  const labels = ['Beras','Telur','Minyak','Gula','Ikan'];
  const warna  = ['#f5c518','#22c55e','#a855f7','#f97316','#4a9eff'];
  const values = ids.map(id => parseFloat(document.getElementById(id).value) || 0);

  if (values.every(v => v === 0)) { showToast('⚠️ Isi minimal satu nilai harga baru dulu!', 'warn'); return; }

  const canvas = document.getElementById('canvasKB2');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...values, 1);
  const barW   = 60, gap = (W - 60 - labels.length * barW) / (labels.length + 1);
  const padBot = 40, padTop = 20;
  const chartH = H - padBot - padTop;

  let progress = 0;
  function draw(prog) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, padTop);
    ctx.lineTo(50, H - padBot);
    ctx.lineTo(W - 10, H - padBot);
    ctx.stroke();

    values.forEach((v, i) => {
      const x = 50 + gap + i * (barW + gap);
      const barH = (v / maxVal) * chartH * prog;
      const y = H - padBot - barH;
      const grad = ctx.createLinearGradient(x, y, x, H - padBot);
      grad.addColorStop(0, warna[i]);
      grad.addColorStop(1, warna[i] + '88');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px Nunito';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, H - padBot + 18);
      if (prog === 1 && v > 0) {
        ctx.fillStyle = warna[i];
        ctx.font = 'bold 12px Nunito';
        ctx.fillText('Rp ' + v, x + barW / 2, y - 6);
      }
    });
  }

  function animate() {
    progress += 0.05;
    if (progress >= 1) { progress = 1; draw(1); return; }
    draw(progress);
    requestAnimationFrame(animate);
  }
  animate();
  showToast('📊 Diagram batang berhasil dibuat!', 'success');
}

/* ──────────────────────────────────────────────
   MENU "BUAT DIAGRAM" — Diagram Builder Bebas
   Siswa bisa memasukkan kategori & nilai sendiri,
   lalu menyajikannya sebagai diagram batang atau
   diagram lingkaran (canvas), dan mengunduhnya.
────────────────────────────────────────────── */
const DIAGRAM_WARNA = ['#f0a91e', '#1668d4', '#7c5ce0', '#16a34a', '#e0529c', '#19c3e6', '#ea7f17', '#dc2626'];

function setTipeDiagram(tipe) {
  state.diagTipe = tipe;
  document.getElementById('diagTypeBtnBatang').classList.toggle('active', tipe === 'batang');
  document.getElementById('diagTypeBtnLingkaran').classList.toggle('active', tipe === 'lingkaran');
}

function tambahBarisDiagram() {
  const wrap = document.getElementById('diagramRows');
  const row = document.createElement('div');
  row.className = 'diagram-row';
  row.innerHTML = `
    <input type="text" class="diag-label-input" placeholder="Nama kategori">
    <input type="number" class="diag-value-input" placeholder="Nilai">
    <button type="button" class="btn-diagram-hapus" onclick="hapusBarisDiagram(this)" title="Hapus baris">✕</button>
  `;
  wrap.appendChild(row);
}

function hapusBarisDiagram(btn) {
  const wrap = document.getElementById('diagramRows');
  if (wrap.children.length <= 2) {
    showToast('⚠️ Minimal harus ada 2 kategori data!', 'warn');
    return;
  }
  btn.closest('.diagram-row').remove();
}

function resetDiagramBuilder() {
  const wrap = document.getElementById('diagramRows');
  wrap.innerHTML = '';
  for (let i = 0; i < 3; i++) tambahBarisDiagram();
  document.getElementById('diagJudul').value = '';
  setTipeDiagram('batang');
  document.getElementById('diagramOutputCard').style.display = 'none';
}

function ambilDataDiagramUser() {
  const labelEls = document.querySelectorAll('.diag-label-input');
  const valueEls = document.querySelectorAll('.diag-value-input');
  const data = [];
  labelEls.forEach((labelEl, i) => {
    const label = labelEl.value.trim();
    const value = parseFloat(valueEls[i].value);
    if (label && !isNaN(value) && value >= 0) {
      data.push({ label, value });
    }
  });
  return data;
}

function buatDiagramUser() {
  const data = ambilDataDiagramUser();
  if (data.length < 2) {
    showToast('⚠️ Isi minimal 2 kategori dengan nama & nilai yang valid!', 'warn');
    return;
  }

  const judul = document.getElementById('diagJudul').value.trim();
  document.getElementById('diagramOutputTitle').textContent = judul || 'Hasil Diagram';
  document.getElementById('diagramOutputCard').style.display = 'block';

  if (state.diagTipe === 'batang') {
    gambarDiagramBatangUser(data);
  } else {
    gambarDiagramLingkaranUser(data);
  }

  document.getElementById('diagramOutputCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('📊 Diagram berhasil dibuat!', 'success');
}

function gambarDiagramBatangUser(data) {
  const legendEl = document.getElementById('diagramPieLegend');
  legendEl.style.display = 'none';
  legendEl.innerHTML = '';

  const canvas = document.getElementById('diagramCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padLeft = 50, padBot = 50, padTop = 24, padRight = 20;
  const chartW = W - padLeft - padRight;
  const chartH = H - padBot - padTop;
  const gap = chartW / data.length;
  const barW = Math.min(60, gap * 0.55);

  let progress = 0;
  function draw(prog) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(15,33,56,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, H - padBot);
    ctx.lineTo(W - padRight, H - padBot);
    ctx.stroke();

    data.forEach((d, i) => {
      const x = padLeft + gap * i + (gap - barW) / 2;
      const barH = (d.value / maxVal) * chartH * prog;
      const y = H - padBot - barH;
      const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
      ctx.fillStyle = warna;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#0f2138';
      ctx.font = '11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      const labelSingkat = d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label;
      ctx.fillText(labelSingkat, x + barW / 2, H - padBot + 18);

      if (prog === 1) {
        ctx.fillStyle = warna;
        ctx.font = 'bold 12px Nunito, sans-serif';
        ctx.fillText(d.value, x + barW / 2, y - 6);
      }
    });
  }

  function animate() {
    progress += 0.05;
    if (progress >= 1) { progress = 1; draw(1); return; }
    draw(progress);
    requestAnimationFrame(animate);
  }
  animate();
}

function gambarDiagramLingkaranUser(data) {
  const canvas = document.getElementById('diagramCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 24;

  let mulai = -Math.PI / 2;
  data.forEach((d, i) => {
    const sudut = (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, mulai, mulai + sudut);
    ctx.closePath();
    ctx.fillStyle = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
    ctx.fill();
    mulai += sudut;
  });

  // Legend persentase
  const legendEl = document.getElementById('diagramPieLegend');
  legendEl.style.display = 'flex';
  legendEl.innerHTML = data.map((d, i) => {
    const pct = ((d.value / total) * 100).toFixed(1);
    const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
    return `<div class="pie-legend-item"><span class="pie-swatch" style="background:${warna}"></span>${d.label} (${pct}%)</div>`;
  }).join('');
}

function unduhDiagram() {
  const canvas = document.getElementById('diagramCanvas');
  try {
    const link = document.createElement('a');
    link.download = 'diagram-denomath.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('⬇️ Diagram berhasil diunduh!', 'success');
  } catch (err) {
    console.error('Gagal mengunduh diagram:', err);
    showToast('⚠️ Gagal mengunduh diagram', 'warn');
  }
}

/* ──────────────────────────────────────────────
   SELESAIKAN KB
────────────────────────────────────────────── */
function selesaikanKB(nomor) {
  const refleksiId = `refleksiKB${nomor}`;
  const refleksi   = document.getElementById(refleksiId)?.value.trim();

  if (!refleksi || refleksi.length < 10) {
    showToast('✍️ Tulis refleksimu dulu (minimal 10 karakter)!', 'warn');
    document.getElementById(refleksiId)?.focus();
    return;
  }

  if (nomor === 1) {
    const ids = ['harga1','harga2','harga3','harga4'];
    const kosong = ids.some(id => !document.getElementById(id)?.value);
    if (kosong) { showToast('📋 Lengkapi tabel konversi harga dulu!', 'warn'); return; }
  }

  if (nomor === 2) {
    const ids = ['kb2h1','kb2h2','kb2h3','kb2h4','kb2h5'];
    const kosong = ids.some(id => !document.getElementById(id)?.value);
    if (kosong) { showToast('📋 Lengkapi tabel belanjaan Bu Sari dulu!', 'warn'); return; }
  }

  state.kbSelesai[nomor - 1] = true;
  updateKBCard(nomor);
  updateProgressUI();
  tutupModal(nomor);
  kirimProgresKB();

  if (state.kbSelesai.every(Boolean)) {
    setTimeout(tampilkanSelamat, 600);
  } else {
    const pesanNext = nomor < 2 ? ` KB ${nomor + 1} sekarang terbuka!` : '';
    showToast(`🏅 KB ${nomor} selesai!${pesanNext}`, 'success');
  }
}

function updateKBCard(nomor) {
  const card   = document.getElementById(`kb${nomor}card`);
  const status = document.getElementById(`kb${nomor}status`);
  if (card)   card.classList.add('done');
  if (status) status.textContent = '✅ Selesai';
  if (nomor === 1) {
    const nextCard   = document.getElementById('kb2card');
    const nextStatus = document.getElementById('kb2status');
    if (nextCard)   nextCard.classList.remove('locked');
    if (nextStatus) nextStatus.textContent = '🔓 Mulai';
  }
}

function updateProgressUI() {
  const selesai = state.kbSelesai.filter(Boolean).length;
  const pct     = (selesai / 2) * 100;
  const fill    = document.getElementById('progressFill');
  const label   = document.getElementById('progressLabel');
  if (fill)  fill.style.width  = pct + '%';
  if (label) label.textContent = `${selesai} / 2 KB selesai`;
}

/* ──────────────────────────────────────────────
   MODAL SELAMAT
────────────────────────────────────────────── */
function tampilkanSelamat() {
  const modal = document.getElementById('modalSelamat');
  if (!modal) return;
  document.getElementById('selamatNama').textContent =
    `${state.user.nama} dari Kelas ${state.user.kelas} – Absen ${state.user.absen}`;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  launchConfetti();
}

function tutupModalSelamat() {
  const modal = document.getElementById('modalSelamat');
  if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
  showPage('beranda');
}

function launchConfetti() {
  const container = document.getElementById('modalSelamat');
  const emojis = ['🎊','🎉','⭐','🏆','🌟','✨','💰','🪙'];
  for (let i = 0; i < 24; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = `
      position:absolute; left:${Math.random() * 100}%; top:-30px;
      font-size:${16 + Math.random() * 20}px;
      animation: confettiFall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 1}s forwards;
      pointer-events:none; z-index:10;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

/* ──────────────────────────────────────────────
   KALKULATOR REDENOMINASI
────────────────────────────────────────────── */
function setKalcMode(mode) {
  state.kalcMode = mode;
  document.getElementById('modeBtn1').classList.toggle('active', mode === 'lama-ke-baru');
  document.getElementById('modeBtn2').classList.toggle('active', mode === 'baru-ke-lama');
  const label  = document.getElementById('kalcInputLabel');
  const hint   = document.getElementById('kalcHint');
  const rlabel = document.getElementById('kalcResultLabel');
  if (mode === 'lama-ke-baru') {
    label.textContent  = '💵 Masukkan Rupiah Lama';
    hint.textContent   = 'Contoh: Rp 75.000 (lama) → Rp 75 (baru)';
    rlabel.textContent = 'Rupiah Baru';
  } else {
    label.textContent  = '🪙 Masukkan Rupiah Baru';
    hint.textContent   = 'Contoh: Rp 75 (baru) → Rp 75.000 (lama)';
    rlabel.textContent = 'Rupiah Lama';
  }
  resetKalkulator();
}

function hitungKalkulator() {
  const inputVal = parseFloat(document.getElementById('kalcInput').value);
  const result   = document.getElementById('kalcResult');
  const nilaiEl  = document.getElementById('kalcResultNilai');
  const noteEl   = document.getElementById('kalcResultNote');
  if (!inputVal || isNaN(inputVal) || inputVal <= 0) { result.style.display = 'none'; return; }
  let hasil, note;
  if (state.kalcMode === 'lama-ke-baru') {
    hasil = inputVal / 1000;
    note  = `Rp ${formatRupiah(inputVal)} (lama) dibagi 1.000`;
  } else {
    hasil = inputVal * 1000;
    note  = `Rp ${formatRupiah(inputVal)} (baru) dikali 1.000`;
  }
  nilaiEl.textContent = 'Rp ' + formatRupiah(hasil);
  noteEl.textContent  = note;
  result.style.display = 'block';
}

function resetKalkulator() {
  document.getElementById('kalcInput').value = '';
  document.getElementById('kalcResult').style.display = 'none';
}

function formatRupiah(angka) {
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}

/* ──────────────────────────────────────────────
   EVALUASI – tanpa feedback langsung, ada pembahasan di akhir
────────────────────────────────────────────── */
function mulaiEvaluasi() {
  // Acak semua 20 soal
  state.evalSoalOrder = [...Array(bankSoal.length).keys()].sort(() => Math.random() - 0.5);
  state.evalSoalIndex = 0;
  state.evalSkor = 0;
  state.evalJawabanSiswa = [];
  state.evalSelesai = false;

  // Update max label
  const maxEl = document.querySelector('.eval-score-max');
  if (maxEl) maxEl.textContent = `dari ${bankSoal.length}`;

  document.getElementById('evalStart').style.display    = 'none';
  document.getElementById('evalQuiz').style.display     = 'block';
  document.getElementById('evalResult').style.display   = 'none';
  document.getElementById('evalPembahasan').style.display = 'none';

  tampilkanSoal();
}

function tampilkanSoal() {
  const idx  = state.evalSoalOrder[state.evalSoalIndex];
  const soal = bankSoal[idx];
  const total = bankSoal.length;

  state.evalSudahJawab = false;

  const pct = (state.evalSoalIndex / total) * 100;
  document.getElementById('evalProgressFill').style.width = pct + '%';
  document.getElementById('evalSoalNum').textContent = `Soal ${state.evalSoalIndex + 1} / ${total}`;
  document.getElementById('evalSkorLive').textContent = `Soal dijawab: ${state.evalSoalIndex}`;
  document.getElementById('evalQuestion').textContent = soal.soal;

  // Tampilkan visual (tabel/diagram) DI ATAS soal jika tersedia
  const visualEl = document.getElementById('evalVisual');
  if (soal.visual) {
    visualEl.innerHTML = soal.visual;
    visualEl.style.display = 'block';
  } else {
    visualEl.innerHTML = '';
    visualEl.style.display = 'none';
  }

  const optContainer = document.getElementById('evalOptions');
  optContainer.innerHTML = '';
  soal.pilihan.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'eval-option';
    btn.textContent = `${String.fromCharCode(65 + i)}. ${p}`;
    btn.onclick = () => pilihJawaban(i);
    optContainer.appendChild(btn);
  });

  // Reset info & next button
  const infoEl = document.getElementById('evalSelectedInfo');
  if (infoEl) { infoEl.textContent = ''; infoEl.className = 'eval-selected-info'; }
  document.getElementById('btnEvalNext').style.display = 'none';
}

function pilihJawaban(pilihan) {
  const idx  = state.evalSoalOrder[state.evalSoalIndex];
  const soal = bankSoal[idx];
  const opts = document.querySelectorAll('.eval-option');
  const benar = (pilihan === soal.jawaban);

  // Tandai ulang pilihan yang dipilih saja (boleh ganti opsi berkali-kali,
  // jawaban TIDAK langsung terkunci — opsi lain tetap bisa diklik)
  opts.forEach(o => o.classList.remove('dipilih'));
  opts[pilihan].classList.add('dipilih');

  if (!state.evalSudahJawab) {
    // Jawaban pertama untuk soal ini → catat sebagai record baru
    state.evalSudahJawab = true;
    state.evalJawabanSiswa.push({
      nomor: state.evalSoalIndex + 1,
      soalIdx: idx,
      pilihanSiswa: pilihan,
      jawaban: soal.jawaban,
      benar: benar,
    });
    if (benar) state.evalSkor++;
  } else {
    // Siswa mengganti pilihan → perbarui record yang sudah ada,
    // sesuaikan skor jika status benar/salah berubah
    const rec = state.evalJawabanSiswa[state.evalJawabanSiswa.length - 1];
    if (rec.benar && !benar) state.evalSkor--;
    if (!rec.benar && benar) state.evalSkor++;
    rec.pilihanSiswa = pilihan;
    rec.benar = benar;
  }

  // Info terpilih — hanya konfirmasi pilihan, tidak kasih tahu benar/salah
  const infoEl = document.getElementById('evalSelectedInfo');
  if (infoEl) {
    infoEl.textContent = `✔ Kamu memilih: ${String.fromCharCode(65 + pilihan)}. ${soal.pilihan[pilihan]} (masih bisa diganti)`;
    infoEl.className = 'eval-selected-info show';
  }

  document.getElementById('btnEvalNext').style.display = 'inline-block';
  document.getElementById('btnEvalNext').textContent =
    state.evalSoalIndex + 1 >= bankSoal.length ? 'Selesai & Lihat Hasil →' : 'Soal Berikutnya →';
}

function soalBerikutnya() {
  const total = bankSoal.length;
  state.evalSoalIndex++;
  if (state.evalSoalIndex >= total) {
    tampilkanHasil();
  } else {
    tampilkanSoal();
  }
}

function tampilkanHasil() {
  document.getElementById('evalQuiz').style.display   = 'none';
  document.getElementById('evalResult').style.display = 'block';

  const skor  = state.evalSkor;
  const total = bankSoal.length;
  const pct   = (skor / total) * 100;

  document.getElementById('evalProgressFill').style.width = '100%';
  document.getElementById('evalScoreNum').textContent = skor;

  let judul, icon, grade, gradeClass, msg;
  if (pct >= 90) {
    judul = 'Luar Biasa!'; icon = '🏆'; grade = 'A – Sangat Baik';
    gradeClass = 'badge-gold'; msg = 'Kamu menguasai materi Redenominasi dan Penyajian Data dengan sangat baik. Pertahankan!';
  } else if (pct >= 70) {
    judul = 'Bagus Sekali!'; icon = '⭐'; grade = 'B – Baik';
    gradeClass = 'badge-blue'; msg = 'Pemahamanmu sudah bagus! Lihat pembahasan untuk mempelajari soal yang belum tepat.';
  } else if (pct >= 50) {
    judul = 'Cukup Baik!'; icon = '📚'; grade = 'C – Cukup';
    gradeClass = 'badge-yellow'; msg = 'Kamu sudah paham sebagian. Lihat pembahasan dan coba ulangi evaluasinya!';
  } else {
    judul = 'Terus Belajar!'; icon = '💪'; grade = 'D – Perlu Perbaikan';
    gradeClass = 'badge-red'; msg = 'Jangan menyerah! Buka pembahasan, pelajari kembali materinya, lalu coba lagi.';
  }

  document.getElementById('evalResultIcon').textContent = icon;
  document.getElementById('evalResultJudul').textContent = judul;
  document.getElementById('evalResultMsg').textContent  = msg;

  const badge = document.getElementById('evalGradeBadge');
  badge.textContent  = grade;
  badge.className    = `eval-grade-badge ${gradeClass}`;

  kirimKeSheets(skor, total, pct, grade);
}

/* ──────────────────────────────────────────────
   TAMPILKAN PEMBAHASAN
────────────────────────────────────────────── */
function tampilkanPembahasan() {
  document.getElementById('evalResult').style.display      = 'none';
  document.getElementById('evalPembahasan').style.display  = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const skor  = state.evalSkor;
  const total = bankSoal.length;
  const pct   = Math.round((skor / total) * 100);

  document.getElementById('pembahasanSkorInfo').innerHTML =
    `Skormu: <strong>${skor} / ${total}</strong> &nbsp;|&nbsp; Nilai: <strong>${pct}</strong> &nbsp;|&nbsp; 
     Benar: <span class="pb-benar">${skor} soal</span> &nbsp;|&nbsp; 
     Salah: <span class="pb-salah">${total - skor} soal</span>`;

  const list = document.getElementById('pembahasanList');
  list.innerHTML = '';

  state.evalJawabanSiswa.forEach((j, idx) => {
    const soal = bankSoal[j.soalIdx];
    const isBenar = j.benar;

    const item = document.createElement('div');
    item.className = `pembahasan-item ${isBenar ? 'pb-item-benar' : 'pb-item-salah'}`;

    item.innerHTML = `
      <div class="pb-item-header">
        <span class="pb-item-num">Soal ${j.nomor}</span>
        <span class="pb-item-status ${isBenar ? 'pb-status-benar' : 'pb-status-salah'}">
          ${isBenar ? '✅ Benar' : '❌ Salah'}
        </span>
      </div>
      <div class="pb-item-soal">${soal.visual ? `<div class="eval-visual-area" style="margin-bottom:12px">${soal.visual}</div>` : ''}${soal.soal}</div>
      <div class="pb-pilihan-wrap">
        ${soal.pilihan.map((p, i) => {
          let cls = 'pb-pilihan';
          if (i === soal.jawaban) cls += ' pb-pilihan-kunci';
          if (i === j.pilihanSiswa && !j.benar) cls += ' pb-pilihan-salah';
          const prefix = i === soal.jawaban ? '✅ ' : (i === j.pilihanSiswa && !j.benar ? '❌ ' : '');
          return `<div class="${cls}">${prefix}${String.fromCharCode(65+i)}. ${p}</div>`;
        }).join('')}
      </div>
      <div class="pb-item-penjelasan">
        <span class="pb-pen-icon">💡</span>
        <span>${soal.penjelasan}</span>
      </div>
    `;
    list.appendChild(item);
  });
}

/* ──────────────────────────────────────────────
   HELPER KIRIM KE SHEETS
────────────────────────────────────────────── */
function buatTimestamp() {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

async function kirimGetKeSheets(payload) {
  const url = `${SHEETS_URL}?` + Object.entries(payload)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return fetch(url, { method: 'GET', mode: 'no-cors' });
}

async function kirimKeSheets(skor, total, nilai, grade) {
  const statusEl = document.getElementById('evalSendStatus');
  statusEl.innerHTML = '<div class="send-spinner">⏳ Menyimpan hasil evaluasimu...</div>';
  const detailJawaban = state.evalJawabanSiswa.map(j => `S${j.nomor}:${j.benar ? 'B' : 'S'}`).join(' | ');
  const payload = {
    tipe: 'evaluasi', timestamp: buatTimestamp(),
    nama: state.user.nama, absen: state.user.absen, kelas: state.user.kelas,
    skor, total, nilai: Math.round(nilai), grade, detail: detailJawaban,
  };
  try {
    await kirimGetKeSheets(payload);
    statusEl.innerHTML = '<div class="send-success">✅ Hasil evaluasi berhasil tersimpan ke rekap guru!</div>';
  } catch (err) {
    statusEl.innerHTML = '<div class="send-warn">⚠️ Tidak dapat terhubung ke server. Cek koneksi internet.</div>';
  }
}

async function kirimProgresKB() {
  if (!state.user.nama || !state.user.kelas) return;
  const payload = {
    tipe: 'progresKB', timestamp: buatTimestamp(),
    nama: state.user.nama, absen: state.user.absen, kelas: state.user.kelas,
    kb1: state.kbSelesai[0] ? 'Selesai' : '', kb2: state.kbSelesai[1] ? 'Selesai' : '',
  };
  try { await kirimGetKeSheets(payload); } catch (err) { /* silent */ }
}

function ulangiEvaluasi() {
  document.getElementById('evalResult').style.display       = 'none';
  document.getElementById('evalPembahasan').style.display   = 'none';
  document.getElementById('evalStart').style.display        = 'block';
  document.getElementById('evalSendStatus').innerHTML       = '';
}

/* ──────────────────────────────────────────────
   DENO AI — Asisten Belajar (chat widget)
   Menghubungkan UI yang sudah ada di index.html
   ke backend Flask (app.py) yang memanggil OpenAI (ChatGPT) API.
────────────────────────────────────────────── */

/** Buka/tutup panel widget AI */
function toggleAIWidget() {
  state.aiOpen = !state.aiOpen;
  const panel = document.getElementById('aiPanel');
  const btn   = document.getElementById('aiToggleBtn');
  if (!panel || !btn) return;

  if (state.aiOpen) {
    panel.classList.add('open');
    btn.classList.add('open');
    const input = document.getElementById('aiInput');
    if (input) setTimeout(() => input.focus(), 150);
    if (!state.aiBackendChecked) cekStatusBackendAI();
  } else {
    panel.classList.remove('open');
    btn.classList.remove('open');
  }
}

/**
 * Cek sekali apakah backend (app.py) sedang berjalan & API key sudah diisi.
 * Memberi pesan yang jelas di status panel + bubble chat jika belum siap,
 * supaya orang tahu PERSIS apa yang harus dilakukan (bukan cuma "gagal").
 */
async function cekStatusBackendAI() {
  state.aiBackendChecked = true;
  setStatusAI('Memeriksa koneksi...', { thinking: true });

  try {
    const res = await fetch(AI_HEALTH_URL, { method: 'GET' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error('health endpoint tidak ok');
    }

    if (!data.api_key_configured) {
      setStatusAI('API key belum diisi');
      tambahBubbleAI(
        'assistant',
        '⚠️ Backend (app.py) sudah berjalan, tapi <strong>OPENAI_API_KEY</strong> belum diatur di server. ' +
        'Hentikan app.py (Ctrl+C), set environment variable OPENAI_API_KEY, lalu jalankan ulang <code>python app.py</code>.',
        { isError: true, trusted: true }
      );
      return;
    }

    setStatusAI('Siap membantu!');
  } catch (err) {
    setStatusAI('Backend belum aktif');
    tambahBubbleAI(
      'assistant',
      '⚠️ Tidak bisa terhubung ke backend AI di <strong>' + AI_API_URL + '</strong>.<br><br>' +
      'Langkah memperbaiki:<br>' +
      '1. Buka terminal di folder project ini.<br>' +
      '2. Jalankan: <code>pip install -r requirements.txt</code> (sekali saja).<br>' +
      '3. Set API key: <code>export OPENAI_API_KEY="sk-..."</code> (Mac/Linux) atau <code>setx OPENAI_API_KEY "sk-..."</code> (Windows).<br>' +
      '4. Jalankan: <code>python app.py</code> dan biarkan terminalnya tetap terbuka.<br>' +
      '5. Muat ulang halaman ini, lalu coba tanya lagi.',
      { isError: true, trusted: true }
    );
  }
}

/** Bersihkan riwayat chat & kembalikan ke pesan sambutan awal */
function clearChat() {
  state.aiHistory = [];
  const box = document.getElementById('aiMessages');
  if (!box) return;
  box.innerHTML = `
    <div class="ai-msg ai-msg-bot">
      <div class="ai-msg-avatar">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="ai-msg-bubble">
        <p>Riwayat percakapan sudah dibersihkan 🧹. Ada yang ingin kamu tanyakan lagi tentang Redenominasi Rupiah atau Penyajian Data?</p>
      </div>
    </div>
  `;
  showToast('🧹 Riwayat chat dibersihkan', 'info');
}

/** Toggle mode percakapan suara (text-to-speech otomatis utk balasan AI) */
function toggleVoice() {
  if (!state.aiVoiceOn && !('speechSynthesis' in window)) {
    showToast('🔇 Browser ini tidak mendukung text-to-speech', 'warn');
    return;
  }

  state.aiVoiceOn = !state.aiVoiceOn;
  const btn = document.getElementById('voiceToggleBtn');
  if (btn) btn.classList.toggle('active', state.aiVoiceOn);
  showToast(
    state.aiVoiceOn ? '🎙️ Mode suara diaktifkan — balasan AI akan dibacakan' : '🎙️ Mode suara dimatikan',
    'info'
  );
  if (!state.aiVoiceOn && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/** Auto-resize textarea input chat sesuai panjang teks */
function autoResizeAI(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 90) + 'px';
}

/** Enter untuk kirim, Shift+Enter untuk baris baru */
function handleAIKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendAIMessage();
  }
}

/** Tombol "Tanya Cepat" mengisi & langsung mengirim pertanyaan */
function sendQuickQuestion(pertanyaan) {
  const input = document.getElementById('aiInput');
  if (input) input.value = pertanyaan;
  sendAIMessage();
}

/** Escape sederhana agar input siswa tidak merusak HTML bubble chat */
function escapeHTMLAI(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Ubah baris baru jadi <br> setelah escaping, untuk balasan AI */
function formatAIReply(text) {
  return escapeHTMLAI(text).replace(/\n/g, '<br>');
}

/** Tambahkan satu bubble chat ke jendela pesan
 *  @param {boolean} opts.trusted - true HANYA untuk pesan yang kita generate
 *  sendiri di sini (status backend, instruksi setup). Balasan dari AI/siswa
 *  TIDAK PERNAH trusted, supaya tag HTML di dalamnya tetap di-escape dengan aman.
 */
function tambahBubbleAI(role, text, { isError = false, trusted = false } = {}) {
  const box = document.getElementById('aiMessages');
  if (!box) return;

  const wrap = document.createElement('div');
  wrap.className = `ai-msg ${role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`;

  const avatar = document.createElement('div');
  avatar.className = 'ai-msg-avatar';
  avatar.innerHTML = role === 'user'
    ? `<svg viewBox="0 0 24 24" fill="none" width="13" height="13"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="2"/><path d="M5 19.5c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const bubble = document.createElement('div');
  bubble.className = 'ai-msg-bubble';
  if (isError) bubble.style.borderColor = 'rgba(220,38,38,0.4)';
  bubble.innerHTML = trusted ? text : `<p>${formatAIReply(text)}</p>`;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

/** Tampilkan indikator "sedang mengetik" dari DENO AI */
function tampilkanTypingAI() {
  const box = document.getElementById('aiMessages');
  if (!box) return;
  const wrap = document.createElement('div');
  wrap.className = 'ai-msg ai-msg-bot';
  wrap.id = 'aiTypingIndicator';
  wrap.innerHTML = `
    <div class="ai-msg-avatar">
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="ai-typing"><span></span><span></span><span></span></div>
  `;
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

function hapusTypingAI() {
  const el = document.getElementById('aiTypingIndicator');
  if (el) el.remove();
}

/** Update status kecil di header panel ("Mengetik...", "Siap membantu!", dst) */
function setStatusAI(teks, { thinking = false } = {}) {
  const statusEl = document.getElementById('aiStatus');
  if (!statusEl) return;
  statusEl.innerHTML = `<span class="ai-dot" style="${thinking ? 'animation-duration:0.6s' : ''}"></span> ${teks}`;
}

/** Ucapkan balasan AI dengan Web Speech API (jika mode suara aktif) */
/**
 * Cache daftar voices browser. speechSynthesis.getVoices() sering
 * mengembalikan array kosong saat pertama dipanggil karena voices
 * baru selesai dimuat secara async — makanya kita dengarkan event
 * 'voiceschanged' juga.
 */
let _ttsVoices = [];
function muatTTSVoices() {
  if (!('speechSynthesis' in window)) return;
  _ttsVoices = window.speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  muatTTSVoices();
  window.speechSynthesis.onvoiceschanged = muatTTSVoices;
}

/** Cari voice Bahasa Indonesia jika ada; jika tidak ada, pakai voice default browser. */
function cariVoiceTerbaik() {
  if (!_ttsVoices || _ttsVoices.length === 0) muatTTSVoices();
  if (!_ttsVoices || _ttsVoices.length === 0) return null;
  return (
    _ttsVoices.find(v => v.lang?.toLowerCase() === 'id-id') ||
    _ttsVoices.find(v => v.lang?.toLowerCase().startsWith('id')) ||
    null // null = biarkan browser pakai voice default-nya sendiri
  );
}

/** Ucapkan balasan AI dengan Web Speech API (jika mode suara aktif) */
function bicarakanAI(teks) {
  if (!state.aiVoiceOn) return;
  if (!('speechSynthesis' in window)) {
    showToast('🔇 Browser ini belum mendukung text-to-speech', 'warn');
    return;
  }
  try {
    window.speechSynthesis.cancel();

    // Bersihkan tag HTML sederhana (<strong>, <code>, <br>) sebelum diucapkan
    const teksBersih = teks
      .replace(/<br\s*\/?>/gi, '. ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!teksBersih) return;

    const utter = new SpeechSynthesisUtterance(teksBersih);
    const voiceTerbaik = cariVoiceTerbaik();
    if (voiceTerbaik) {
      utter.voice = voiceTerbaik;
      utter.lang = voiceTerbaik.lang;
    } else {
      // Tidak ada voice id-ID terpasang di sistem — tetap coba lang id-ID,
      // browser akan jatuh ke voice default jika tidak tersedia.
      utter.lang = 'id-ID';
    }
    utter.rate = 1;
    utter.pitch = 1;
    utter.onerror = (e) => {
      console.warn('TTS error:', e.error);
    };

    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn('Text-to-speech tidak tersedia:', err);
    showToast('🔇 Gagal memutar suara balasan AI', 'warn');
  }
}

/** Kirim pertanyaan ke backend Flask (app.py), yang lalu meneruskannya ke OpenAI (ChatGPT) API */
async function sendAIMessage() {
  const input = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSendBtn');
  if (!input) return;

  const pesan = input.value.trim();
  if (!pesan || state.aiSending) return;

  tambahBubbleAI('user', pesan);
  state.aiHistory.push({ role: 'user', content: pesan });

  input.value = '';
  autoResizeAI(input);
  state.aiSending = true;
  if (sendBtn) sendBtn.disabled = true;
  setStatusAI('Mengetik...', { thinking: true });
  tampilkanTypingAI();

  // Riwayat (maks 10 turn terakhir) dikirim ke backend agar AI punya konteks
  const riwayat = state.aiHistory.slice(-11, -1)
    .filter(item => (item.role === 'user' || item.role === 'assistant') && item.content?.trim())
    .map(item => ({ role: item.role, content: item.content.trim() }));

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: pesan,
        history: riwayat,
        siswa: { nama: state.user.nama, kelas: state.user.kelas },
      }),
    });

    const data = await response.json().catch(() => ({}));
    hapusTypingAI();

    if (!response.ok || !data.reply) {
      const pesanError = data.error || 'Maaf, DENO AI sedang tidak bisa diakses. Coba lagi sebentar ya.';
      tambahBubbleAI('assistant', `⚠️ ${pesanError}`, { isError: true });
      setStatusAI('Sedang bermasalah');
      return;
    }

    tambahBubbleAI('assistant', data.reply);
    state.aiHistory.push({ role: 'assistant', content: data.reply });
    setStatusAI('Siap membantu!');
    bicarakanAI(data.reply);

  } catch (err) {
    hapusTypingAI();
    console.error('Gagal menghubungi backend AI:', err);
    tambahBubbleAI(
      'assistant',
      '⚠️ Tidak dapat terhubung ke backend AI di <strong>' + AI_API_URL + '</strong>.<br><br>' +
      'Pastikan kamu sudah menjalankan <code>python app.py</code> di terminal dan terminal itu masih terbuka, ' +
      'lalu coba kirim pesan ini lagi.',
      { isError: true, trusted: true }
    );
    setStatusAI('Tidak terhubung');
  } finally {
    state.aiSending = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

/* ──────────────────────────────────────────────
   DENO AI — Input Suara (Speech-to-Text)
   Menggunakan Web Speech API (SpeechRecognition).
   Catatan: dukungan browser bervariasi — paling
   stabil di Chrome/Edge desktop & Android.
────────────────────────────────────────────── */
function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function startListening() {
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();
  if (!SpeechRecognitionCtor) {
    showToast('🎙️ Browser ini belum mendukung input suara (coba Chrome/Edge)', 'warn');
    return;
  }
  // SpeechRecognition butuh koneksi aman (HTTPS) atau localhost/file://.
  // Di domain http biasa (bukan localhost), browser akan menolak akses mic.
  const isAman = ['https:', 'file:'].includes(location.protocol) || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!isAman) {
    showToast('🎙️ Input suara butuh HTTPS atau localhost', 'warn');
    return;
  }
  if (state.aiListening) return;

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'id-ID';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const micBtn = document.getElementById('aiMicBtn');
  const indicator = document.getElementById('aiVoiceIndicator');
  const inputWrap = document.getElementById('aiInputWrap');

  recognition.onstart = () => {
    state.aiListening = true;
    if (micBtn) micBtn.classList.add('listening');
    if (indicator) indicator.style.display = 'flex';
    if (inputWrap) inputWrap.style.display = 'none';
  };

  recognition.onresult = (event) => {
    const transkrip = event.results?.[0]?.[0]?.transcript || '';
    const input = document.getElementById('aiInput');
    if (input && transkrip) {
      input.value = transkrip;
      autoResizeAI(input);
      // Kirim otomatis sedikit setelah selesai bicara, supaya
      // siswa sempat melihat hasil transkrip sebelum terkirim.
      setTimeout(() => sendAIMessage(), 350);
    }
  };

  recognition.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
      showToast('🎙️ Izin mikrofon ditolak — aktifkan di setelan browser', 'warn');
    } else if (event.error === 'network') {
      showToast('🎙️ Input suara butuh koneksi internet', 'warn');
    } else if (event.error !== 'no-speech') {
      showToast('🎙️ Gagal menangkap suara, coba lagi', 'warn');
    }
  };

  recognition.onend = () => {
    state.aiListening = false;
    state.aiRecognition = null;
    if (micBtn) micBtn.classList.remove('listening');
    if (indicator) indicator.style.display = 'none';
    if (inputWrap) inputWrap.style.display = 'flex';
  };

  state.aiRecognition = recognition;
  try {
    recognition.start();
  } catch (err) {
    console.warn('Tidak dapat memulai SpeechRecognition:', err);
    showToast('🎙️ Input suara gagal dimulai', 'warn');
  }
}

function stopListening() {
  if (state.aiRecognition) {
    state.aiRecognition.stop();
  }
}

/* ──────────────────────────────────────────────
   KEYBOARD & AKSESIBILITAS
────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    [1, 2].forEach(n => {
      const m = document.getElementById(`modalKB${n}`);
      if (m && m.classList.contains('active')) tutupModal(n);
    });
    const ms = document.getElementById('modalSelamat');
    if (ms && ms.classList.contains('active')) tutupModalSelamat();
    // Intro: Escape tidak tutup intro (harus selesai baca)
  }
  if (state.currentPage === 'pengenalan') {
    if (e.key === 'ArrowRight') introNextScene();
    if (e.key === 'ArrowLeft')  introPrevScene();
  }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) {
      const nomor = this.id.replace('modalKB','');
      if (nomor === 'Selamat') tutupModalSelamat();
      else tutupModal(parseInt(nomor));
    }
  });
});

/* ──────────────────────────────────────────────
   INISIALISASI
────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.add('active');

  ['inputNama', 'inputAbsen', 'inputKelas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });

  // Inject dynamic CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes confettiFall {
      to { transform: translateY(500px) rotate(720deg); opacity: 0; }
    }
    .shake { animation: shake 0.4s ease; }
    @keyframes shake {
      0%,100%{ transform: translateX(0); }
      20%{ transform: translateX(-8px); }
      40%{ transform: translateX(8px); }
      60%{ transform: translateX(-5px); }
      80%{ transform: translateX(5px); }
    }
    .page { display:none; animation: fadeInPage 0.4s ease; }
    .page.active { display:block; }
    @keyframes fadeInPage {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .modal-overlay { display:none; }
    .modal-overlay.active { display:flex; animation: fadeInPage 0.3s ease; }
    .intro-overlay { display:none; }
    .intro-overlay.active { display:flex; animation: fadeInPage 0.35s ease; }
    .intro-dot {
      width:10px; height:10px; border-radius:50%;
      background:rgba(255,255,255,0.2); cursor:pointer;
      transition: background 0.3s, transform 0.2s; flex-shrink:0;
    }
    .intro-dot.active { background: var(--emas); transform:scale(1.3); }
    .intro-dot.done   { background: var(--hijau-muda); }
    .kb-card.done { border-color: var(--hijau) !important; }
    .visual-konversi { display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; padding:4px; }
    .kv-item { background:rgba(255,255,255,0.07); border-radius:10px; padding:12px 14px; text-align:center; min-width:80px; }
    .kv-item.kv-lama { border:1.5px solid rgba(245,197,24,0.4); }
    .kv-item.kv-baru { border:1.5px solid rgba(34,197,94,0.4); }
    .kv-label { font-size:11px; opacity:.65; margin-bottom:4px; }
    .kv-nilai { font-size:14px; font-weight:800; }
    .kv-arrow { font-size:20px; color:var(--emas); }
    .visual-info { display:flex; flex-direction:column; align-items:center; gap:8px; padding:8px; }
    .visual-emoji { font-size:36px; }
    .visual-text { text-align:center; font-size:13px; line-height:1.5; }
    .visual-tanya { background:rgba(245,197,24,.06); border-radius:10px; }
    .visual-selesai { background:rgba(34,197,94,.06); border-radius:10px; }
    .visual-rumus { background:rgba(74,158,255,.06); border-radius:10px; padding:14px; text-align:center; }
    .rumus-judul { font-size:11px; opacity:.6; margin-bottom:6px; }
    .rumus-formula { font-size:14px; font-weight:800; color:var(--emas); margin-bottom:6px; }
    .rumus-op { color:var(--biru-langit); }
    .rumus-contoh { font-size:11px; opacity:.7; }
    .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(80px);
      background:#1a4a7a; color:#fff; padding:12px 24px; border-radius:30px;
      font-size:14px; font-weight:600; box-shadow:0 8px 32px rgba(0,0,0,.4);
      transition: transform 0.4s ease, opacity 0.4s ease; opacity:0; z-index:99999; white-space:nowrap; }
    .toast.show { transform:translateX(-50%) translateY(0); opacity:1; }
    .toast-success { background: linear-gradient(135deg,#16a34a,#22c55e); }
    .toast-warn    { background: linear-gradient(135deg,#b45309,#f59e0b); }
    .toast-info    { background: linear-gradient(135deg,#1a4a7a,#2a7dd4); }
    .badge-gold { background: rgba(245,197,24,0.15); border:1px solid rgba(245,197,24,0.4); color:var(--emas-muda); }
    .badge-blue { background: rgba(42,125,212,0.15); border:1px solid rgba(42,125,212,0.4); color:var(--biru-langit); }
    .badge-yellow { background: rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4); color:#fb923c; }
    .badge-red { background: rgba(220,38,38,0.12); border:1px solid rgba(220,38,38,0.35); color:#f87171; }
    .send-spinner { padding:10px 16px; background:rgba(245,197,24,0.1); border:1px solid rgba(245,197,24,0.25); border-radius:10px; font-size:0.88rem; color:rgba(255,255,255,0.8); margin-bottom:16px; text-align:center; }
    .send-success { padding:10px 16px; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); border-radius:10px; font-size:0.88rem; color:#4ade80; margin-bottom:16px; text-align:center; }
    .send-warn { padding:10px 16px; background:rgba(249,115,22,0.1); border:1px solid rgba(249,115,22,0.3); border-radius:10px; font-size:0.88rem; color:#fb923c; margin-bottom:16px; text-align:center; }
    .cbl-content { display:none; animation: fadeInPage 0.3s ease; }
    .cbl-content.active { display:block; }
    .belajar-step { animation: fadeInPage 0.3s ease; }
    .intro-visual { flex:1; display:flex; align-items:center; justify-content:center; 
      background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
      border-radius:14px; padding:16px; min-height:140px; max-width:200px;
      font-size:0.85rem; color:rgba(255,255,255,0.85); font-weight:600; text-align:center; }
  `;
  document.head.appendChild(style);

  console.log('%c🎓 DENOMATH Loaded!', 'color:#f5c518;font-size:16px;font-weight:bold');
});