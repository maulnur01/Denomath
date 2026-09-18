/* ──────────────────────────────────────────────
   URL BACKEND (Flask, app.py)
   Sebelumnya URL-URL ini ditulis tetap ke
   "http://localhost:5000/..." — ini HANYA bekerja saat halaman dibuka
   dari komputer yang sama dengan yang menjalankan `python app.py`.
   Begitu halaman dibuka dari komputer/HP lain (mis. murid mengakses
   lewat alamat IP guru, atau aplikasi di-hosting online), permintaan ke
   "localhost" itu mengarah ke perangkat murid sendiri (yang tidak
   menjalankan server apa pun) sehingga SELALU gagal secara diam-diam —
   inilah sebab utama Nilai KB1/KB2 tidak pernah terhitung & tidak pernah
   terekap ke Spreadsheet (nilai evaluasi tidak butuh koreksi AI sehingga
   tampak baik-baik saja).
   Diganti memakai origin halaman saat ini (window.location.origin) supaya
   otomatis mengikuti ke mana pun app.py benar-benar diakses. */
const API_BASE = (window.location.origin && window.location.origin !== 'null')
  ? window.location.origin.replace(/\/$/, '')
  : 'http://localhost:5000';

/* Rekap nilai (Evaluasi, KB1, KB2) idealnya dikirim lewat backend Flask
   (endpoint /api/rekap di app.py), yang meneruskan ke Apps Script di sisi
   server. TAPI karena saat ini di-hosting statis (mis. GitHub Pages) yang
   tidak menjalankan app.py sama sekali, kode di bawah memanggil Apps
   Script LANGSUNG dari browser (lihat GOOGLE_SHEETS_WEBAPP_URL & fungsi
   kirimKeRekap). Kalau nanti app.py sudah dihosting di server yang
   mendukung Python, baris ini (REKAP_URL) bisa dipakai lagi di
   kirimKeRekap sebagai gantinya. */
const REKAP_URL = `${API_BASE}/api/rekap`;

/* ──────────────────────────────────────────────
   MODE HOSTING STATIS (mis. GitHub Pages) — TIDAK ADA app.py yang jalan
   sama sekali di sana (GitHub Pages cuma menyajikan file statis, tidak
   bisa menjalankan Python/Flask). Supaya rekap nilai TETAP bisa tersimpan
   ke Spreadsheet walau tanpa app.py, browser di sini memanggil LANGSUNG
   URL Web App Google Apps Script (Code.gs) — bukan lewat /api/rekap.

   PENTING — GANTI URL DI BAWAH dengan URL "/exec" (BUKAN "/dev") hasil
   Deploy > Manage deployments di Apps Script-mu (Who has access: Anyone).
   URL "/dev" hanya bisa diakses saat KAMU sendiri login ke akun Google
   pemilik script, jadi TIDAK akan berfungsi untuk murid lain.

   Kenapa Content-Type di bawah "text/plain" (bukan "application/json")?
   Supaya browser TIDAK mengirim CORS preflight (request OPTIONS) lebih
   dulu — Apps Script Web App tidak menangani OPTIONS, jadi request akan
   gagal kalau pakai Content-Type "application/json". Code.gs tetap bisa
   membaca body ini sebagai JSON apa pun Content-Type-nya, karena doPost
   di Code.gs memang mem-parsing lewat JSON.parse(e.postData.contents). */
const GOOGLE_SHEETS_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbyohfwRkSsNpk7zDupJFPj-C9w-a7Q5LOzqITtHq0M/exec';

/* ──────────────────────────────────────────────
   DAFTAR VIDEO — menu "Materi & Video"
   Tinggal tambah objek baru di array ini untuk menambah
   video lain. "id" diisi ID video YouTube saja (bagian
   setelah "v=" pada URL, atau bagian akhir URL youtu.be/...).
   Contoh: dari https://youtu.be/q8p2QrWzWLs, id-nya adalah
   'q8p2QrWzWLs'.
   Tiap video otomatis dirender sebagai kartu thumbnail +
   tombol Play; iframe YouTube (autoplay) baru dimuat saat
   thumbnail-nya diklik, supaya halaman tetap ringan.
────────────────────────────────────────────── */
const MATERI_VIDEOS = [
  {
    id: 'q8p2QrWzWLs',
    judul: 'Penyajian Data (Diagram Batang, Garis & Lingkaran)',
    deskripsi: 'Video penjelasan cara menyajikan data ke dalam diagram batang, garis, dan lingkaran lengkap dengan contoh soal.',
  },
  {
    id: 'zT4Pk6m0KtQ',
    judul: 'Mengenal Unsur-Unsur & Cara Penyajian Data Tabel Distribusi Frekuensi',
    deskripsi: 'Membahas unsur-unsur tabel distribusi frekuensi dan cara menyajikan data ke dalam bentuk tabel berkelompok.',
  },
  {
    id: '59AcZRfSqEE',
    judul: 'Penyajian Data Statistika: Diagram Lingkaran & Diagram Batang',
    deskripsi: 'Pembahasan materi Matematika SMP Kelas 8 tentang penyajian data ke dalam diagram lingkaran dan diagram batang.',
  },
  {
    id: 'WjWqAbFmNzo',
    judul: 'Cara Menyajikan Data dengan Diagram Lingkaran (Lengkap & Mudah Dimengerti)',
    deskripsi: 'Tutorial langkah demi langkah membuat diagram lingkaran dari data mentah, lengkap dengan perhitungan sudut/persentasenya.',
  },
  {
    id: 'STOC8vPcQDc',
    judul: 'Penyajian Data Tunggal: Tabel, Diagram Garis, Diagram Batang & Lingkaran',
    deskripsi: 'Rangkuman lengkap cara menyajikan data tunggal ke dalam tabel, diagram garis, diagram batang, dan diagram lingkaran.',
  },
];
const AI_API_URL = `${API_BASE}/api/chat`;
const AI_HEALTH_URL = `${API_BASE}/api/health`;
const AI_KOREKSI_URL = `${API_BASE}/api/koreksi`;
const VIDEO_LAINNYA_URL = `${API_BASE}/api/video-lainnya`;
// Jumlah video kurasi manual (di atas) — dicatat SEBELUM video dari YouTube
// Data API ditambahkan secara dinamis, supaya kita tetap tahu batas antara
// "Pilihan Video Lain" (kurasi guru) dan "Lainnya dari YouTube" (otomatis).
const JUMLAH_VIDEO_KURASI = MATERI_VIDEOS.length;
// Kata kunci pencarian dipakai untuk mengisi baris "Lainnya dari YouTube".
const VIDEO_LAINNYA_QUERY = 'penyajian data diagram batang garis lingkaran matematika SMP';

/* ──────────────────────────────────────────────
   PETA SINTAKS "AYO BELAJAR" (CBL) — dipakai untuk
   mengelompokkan field jawaban per sintaks, supaya
   bisa dikoreksi & diberi skor oleh AI (lihat
   koreksiSintaksAI di bawah), bukan dikirim mentah
   sebagai teks ke Google Spreadsheet.
────────────────────────────────────────────── */
const CBL_SINTAKS = {
  1: {
    essentialQ:      { tab: 2, label: 'Essential Question', fields: ['kb1eq1'] },
    challenge:        { tab: 3, label: 'Challenge', fields: ['kb1challenge'] },
    guidingQuestion:  { tab: 5, label: 'Guiding Question', fields: ['kb1gq1'] },
    guidingActivity:  { tab: 6, label: 'Guiding Activity', fields: ['freqA1', 'freqA2', 'freqA3', 'freqA4', 'freqA5', 'kb1ga2'] },
    asesmen:          { tab: 8, label: 'Asesmen', fields: ['kb1as1', 'kb1as2diagram', 'kb1as2'] },
  },
  2: {
    essentialQ:      { tab: 2, label: 'Essential Question', fields: ['kb2eq1'] },
    challenge:        { tab: 3, label: 'Challenge', fields: ['kb2challenge'] },
    guidingQuestion:  { tab: 5, label: 'Guiding Question', fields: ['kb2gqPersen1', 'kb2gqSudut1', 'kb2gqPersen2', 'kb2gqSudut2', 'kb2gqPersen3', 'kb2gqSudut3', 'kb2gqPersen4', 'kb2gqSudut4', 'kb2gqPersen5', 'kb2gqSudut5', 'kb2gqPersen6', 'kb2gqSudut6', 'kb2gq3'] },
    guidingActivity:  { tab: 6, label: 'Guiding Activity', fields: ['kb2gaAset1', 'kb2gaAset2', 'kb2gaAset3', 'kb2gaAset4', 'kb2gaAset5', 'kb2gaB'] },
    asesmen:          { tab: 8, label: 'Asesmen', fields: ['kb2as1', 'kb2as2', 'kb2asPersen1', 'kb2asPersen2', 'kb2asPersen3', 'kb2asPersen4', 'kb2asPersen5', 'kb2as3'] },
  },
};
// Peta balik: id field -> {kb, sintaks}, supaya listener blur tahu grup mana yang harus dikoreksi.
const CBL_FIELD_TO_SINTAKS = {};
Object.entries(CBL_SINTAKS).forEach(([kb, grup]) => {
  Object.entries(grup).forEach(([sintaksKey, info]) => {
    info.fields.forEach(fid => { CBL_FIELD_TO_SINTAKS[fid] = { kb: Number(kb), sintaks: sintaksKey }; });
  });
});

const state = {
  user: { tipe: 'individu', nama: '', absen: '', kelas: '', anggota: '' },
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
  evalNilai: 0,
  evalGradeLabel: '',
  // --- DENO AI ---
  aiOpen: false,
  aiHistory: [], // {role:'user'|'assistant', content:string}
  aiSending: false,
  aiVoiceOn: false, // mode percakapan suara (TTS otomatis untuk balasan AI)
  aiListening: false,
  aiCallMode: false, // mode panggilan AI bergaya video call
  aiRecognition: null, // instance SpeechRecognition aktif (jika ada)
  aiBackendChecked: false,
  // --- BUAT DIAGRAM (alat bantu) ---
  diagTipe: 'batang',
  kb2DiagTipe: 'lingkaran',
  // --- GATING SINTAKS AYO BELAJAR (CBL) ---
  // Menyimpan nomor tab tertinggi yang sudah terbuka untuk tiap KB.
  // Murid wajib menyelesaikan (mengisi) satu sintaks sebelum lanjut ke sintaks berikutnya.
  cblUnlocked: { 1: 1, 2: 1 },
  // --- SKOR AI (koreksi otomatis "Ayo Belajar") ---
  // Skor 0-100 per sintaks, hasil koreksi AI. null = belum dinilai.
  skorKB: {
    1: { essentialQ: null, challenge: null, guidingQuestion: null, guidingActivity: null, asesmen: null },
    2: { essentialQ: null, challenge: null, guidingQuestion: null, guidingActivity: null, asesmen: null },
  },
  skorKBTimer: {},   // debounce timer per "kb-sintaks"
  skorKBLoading: {}, // flag sedang dikoreksi, per "kb-sintaks"
};

/* ──────────────────────────────────────────────
   BACKGROUND INTERAKTIF – simbol Rp, angka, %,
   dan bentuk diagram melayang di seluruh halaman,
   dengan efek parallax mengikuti gerakan mouse
────────────────────────────────────────────── */
function initBgDecor() {
  const wrap = document.getElementById('bgDecor');
  if (!wrap) return;

  // Beberapa "blob" cahaya lembut yang bergerak pelan
  const blobConfig = [
    { top: '-6%',  left: '4%',  size: 320, color: 'rgba(25,195,230,0.16)',  dur: '16s', delay: '0s' },
    { top: '55%',  left: '86%', size: 280, color: 'rgba(10,69,149,0.14)',   dur: '19s', delay: '2s' },
    { top: '80%',  left: '10%', size: 260, color: 'rgba(240,169,30,0.14)',  dur: '14s', delay: '4s' },
    { top: '18%',  left: '70%', size: 220, color: 'rgba(124,92,224,0.12)', dur: '21s', delay: '1s' },
  ];
  blobConfig.forEach(b => {
    const el = document.createElement('div');
    el.className = 'bg-orb-blob';
    el.style.cssText = `top:${b.top};left:${b.left};width:${b.size}px;height:${b.size}px;background:${b.color};animation-duration:${b.dur};animation-delay:${b.delay}`;
    wrap.appendChild(el);
  });

  // Simbol-simbol matematika & keuangan yang melayang naik perlahan
  const symbols = ['Rp', '%', '÷', '×', '=', '1.000', 'Σ', 'Rp', '%', 'π', 'Rp', '÷'];
  const colorClasses = ['', 'gold', 'cyan', 'green', 'violet'];
  const total = window.innerWidth < 640 ? 10 : 20;

  for (let i = 0; i < total; i++) {
    const el = document.createElement('div');
    const sym = symbols[i % symbols.length];
    const cls = colorClasses[i % colorClasses.length];
    const size = 14 + Math.random() * 26;
    const left = Math.random() * 100;
    const dur = 18 + Math.random() * 22;
    const delay = -(Math.random() * 30);
    const op = 0.08 + Math.random() * 0.14;
    const dxMid = (Math.random() * 60 - 30) + 'px';
    const dxEnd = (Math.random() * 80 - 40) + 'px';

    el.className = `bg-shape${cls ? ' ' + cls : ''}`;
    el.textContent = sym;
    el.style.left = left + '%';
    el.style.fontSize = size + 'px';
    el.style.setProperty('--op', op);
    el.style.setProperty('--dx-mid', dxMid);
    el.style.setProperty('--dx-end', dxEnd);
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = delay + 's';
    el.dataset.depth = (0.4 + Math.random() * 1.2).toFixed(2);
    wrap.appendChild(el);
  }

  // Parallax halus mengikuti posisi mouse/sentuhan
  let px = 0, py = 0, tx = 0, ty = 0;
  function applyParallax() {
    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;
    const shapes = wrap.querySelectorAll('.bg-shape');
    shapes.forEach(s => {
      const depth = parseFloat(s.dataset.depth || 0.6);
      s.style.marginLeft = `${px * depth}px`;
      s.style.marginTop = `${py * depth * 0.5}px`;
    });
    requestAnimationFrame(applyParallax);
  }
  window.addEventListener('mousemove', e => {
    tx = (e.clientX / window.innerWidth - 0.5) * 30;
    ty = (e.clientY / window.innerHeight - 0.5) * 20;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (!e.touches || !e.touches[0]) return;
    tx = (e.touches[0].clientX / window.innerWidth - 0.5) * 30;
    ty = (e.touches[0].clientY / window.innerHeight - 0.5) * 20;
  }, { passive: true });
  requestAnimationFrame(applyParallax);
}

/* ──────────────────────────────────────────────
   INTRO SCENES – Pengenalan Redenominasi
   (muncul setelah login, sebelum menu utama)
────────────────────────────────────────────── */
const introScenes = [
  {
    speaker: 'left',
    leftActive: true,
    leftBubble: 'Halo teman-teman! Aku Bu Rupi ‍. Sebelum kamu mulai belajar di DENOMATH, aku mau kenalkan dulu satu konsep penting: <strong>Redenominasi Rupiah</strong>!',
    rightBubble: '',
    visual: `<div class="visual-info">
      <div class="visual-emoji"></div>
      <div class="visual-text"><strong>Redenominasi Rupiah</strong><br>Topik seru yang akan kamu pelajari hari ini!</div>
    </div>`,
  },
  {
    speaker: 'right',
    leftActive: false,
    leftBubble: '',
    rightBubble: 'Bu Rupi, redenominasi itu apa ya? Apa uang kita bakal hilang nilainya? Aku khawatir ',
    visual: `<div class="visual-info visual-tanya">
      <div class="visual-emoji"></div>
      <div class="visual-text">Pertanyaan bagus sekali! Yuk cari tahu bersama…</div>
    </div>`,
  },
  {
    speaker: 'left',
    leftActive: true,
    leftBubble: 'Tenang, Kak Deno! <strong>Redenominasi</strong> adalah penyederhanaan angka pada mata uang. Nilainya <em>TIDAK berubah</em> — hanya angkanya yang diperkecil dengan cara dibagi 1.000!',
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
    rightBubble: 'Oh! Jadi seperti memotong tiga nol terakhirnya? Berarti Rp 75.000 jadi Rp 75 dong, Bu? Karena 75.000 ÷ 1.000 = 75!',
    visual: `<div class="visual-konversi">
      <div class="kv-item kv-lama">
        <div class="kv-label">Rp 75.000</div>
        <div class="kv-nilai">÷ 1.000</div>
      </div>
      <div class="kv-arrow">⟹</div>
      <div class="kv-item kv-baru">
        <div class="kv-label">Rp 75</div>
        <div class="kv-nilai"> Benar!</div>
      </div>
    </div>`,
  },
  {
    speaker: 'left',
    leftActive: true,
    leftBubble: 'Tepat sekali! Rumusnya: <strong>Harga Baru = Harga Lama ÷ 1.000</strong>. Nilai daya belinya tetap sama. Ini berbeda dengan sanering yang memangkas nilai riil uang!',
    rightBubble: '',
    visual: `<div class="visual-rumus">
      <div class="rumus-judul"> Rumus Redenominasi</div>
      <div class="rumus-formula">Harga Baru = Harga Lama <span class="rumus-op">÷</span> 1.000</div>
      <div class="rumus-contoh">Rp 50.000 → Rp 50 &nbsp;|&nbsp; Rp 200.000 → Rp 200</div>
    </div>`,
  },
  {
    speaker: 'right',
    leftActive: false,
    leftBubble: '',
    rightBubble: 'Wah, sekarang aku paham! Terima kasih Bu Rupi! Aku siap mulai belajar Redenominasi dan Penyajian Data di DENOMATH!',
    visual: `<div class="visual-info visual-selesai">
      <div class="visual-emoji"></div>
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
    soal: 'Perhatikan tabel harga beberapa barang sebelum dan sesudah redenominasi berikut. Berdasarkan tabel tersebut, barang manakah yang harganya setelah redenominasi berupa bilangan pecahan (desimal)?',
    visual: `<div class="eval-visual-caption">📋 Tabel Harga Barang Sebelum & Sesudah Redenominasi</div>
      <table class="data-table"><thead><tr><th>Barang</th><th>Harga Sebelum Redenominasi</th><th>Harga Sesudah Redenominasi</th></tr></thead>
      <tbody>
        <tr><td>Buku Tulis</td><td>Rp3.000</td><td>Rp3</td></tr>
        <tr><td>Pensil</td><td>Rp2.000</td><td>Rp2</td></tr>
        <tr><td>Penghapus</td><td>Rp1.500</td><td>Rp1,5</td></tr>
        <tr><td>Tas Sekolah</td><td>Rp75.000</td><td>Rp75</td></tr>
        <tr><td>Sepatu</td><td>Rp150.000</td><td>Rp150</td></tr>
      </tbody></table>`,
    pilihan: ['Buku Tulis', 'Pensil', 'Penghapus', 'Tas Sekolah'],
    jawaban: 2,
    penjelasan: 'Harga sesudah redenominasi dihitung dengan membagi harga sebelum dengan 1.000. Penghapus: Rp1.500 ÷ 1.000 = Rp1,5 (bilangan pecahan/desimal). Barang lain menghasilkan bilangan bulat (Rp3, Rp2, Rp75, Rp150).',
  },
  {
    soal: 'Perhatikan tabel harga beberapa alat tulis berikut (dalam rupiah baru). Diagram apakah yang paling tepat digunakan untuk membandingkan harga antar jenis alat tulis pada tabel tersebut?',
    visual: `<div class="eval-visual-caption">📋 Tabel Harga Alat Tulis (Rupiah Baru)</div>
      <table class="data-table"><thead><tr><th>Alat Tulis</th><th>Harga (Rupiah Baru)</th></tr></thead>
      <tbody>
        <tr><td>Buku</td><td>Rp3</td></tr>
        <tr><td>Pensil</td><td>Rp2</td></tr>
        <tr><td>Penggaris</td><td>Rp2,5</td></tr>
        <tr><td>Pulpen</td><td>Rp4</td></tr>
        <tr><td>Tas</td><td>Rp75</td></tr>
      </tbody></table>`,
    pilihan: ['Diagram garis, karena data menunjukkan perubahan dari waktu ke waktu', 'Diagram batang, karena data bersifat kategorik dan dibandingkan antarjenis barang', 'Diagram lingkaran, karena data menunjukkan bagian dari keseluruhan', 'Diagram pencar, karena data menunjukkan hubungan dua variabel numerik'],
    jawaban: 1,
    penjelasan: 'Data harga barang bersifat kategorik (per jenis barang) yang dibandingkan satu sama lain, sehingga diagram batang paling tepat digunakan. Diagram garis untuk data berkelanjutan/waktu, diagram lingkaran untuk proporsi terhadap keseluruhan, dan diagram pencar untuk hubungan dua variabel numerik.',
  },
  {
    soal: 'Perhatikan diagram batang harga beberapa kebutuhan pokok setelah redenominasi berikut. Berapakah harga gula per kilogram berdasarkan diagram tersebut?',
    visual: `<div class="eval-visual-caption">📊 Diagram Batang Harga Kebutuhan Pokok Setelah Redenominasi</div>
      <div class="diagram-batang">
        <div class="batang-wrap"><div class="batang" style="height:67px"></div><span>Beras (per kg) — Rp12</span></div>
        <div class="batang-wrap"><div class="batang" style="height:101px"></div><span>Minyak Goreng (per L) — Rp18</span></div>
        <div class="batang-wrap"><div class="batang" style="height:78px"></div><span>Gula (per kg) — Rp14</span></div>
        <div class="batang-wrap"><div class="batang" style="height:140px"></div><span>Telur (per kg) — Rp25</span></div>
        <div class="batang-wrap"><div class="batang" style="height:112px"></div><span>Susu (per L) — Rp20</span></div>
      </div>`,
    pilihan: ['Rp12', 'Rp14', 'Rp18', 'Rp20'],
    jawaban: 1,
    penjelasan: 'Berdasarkan diagram batang, tinggi batang untuk kategori Gula menunjukkan angka Rp14.',
  },
  {
    soal: 'Perhatikan diagram batang harga beberapa perlengkapan sekolah setelah redenominasi berikut. Barang dengan harga tertinggi dan terendah berturut-turut adalah ....',
    visual: `<div class="eval-visual-caption">📊 Diagram Batang Harga Perlengkapan Sekolah Setelah Redenominasi</div>
      <div class="diagram-batang">
        <div class="batang-wrap"><div class="batang" style="height:4px"></div><span>Buku Tulis — Rp3</span></div>
        <div class="batang-wrap"><div class="batang" style="height:4px"></div><span>Pensil — Rp4</span></div>
        <div class="batang-wrap"><div class="batang" style="height:5px"></div><span>Penghapus — Rp5</span></div>
        <div class="batang-wrap"><div class="batang" style="height:70px"></div><span>Tas Sekolah — Rp75</span></div>
        <div class="batang-wrap"><div class="batang" style="height:140px"></div><span>Sepatu — Rp150</span></div>
      </div>`,
    pilihan: ['Sepatu dan Penghapus', 'Tas Sekolah dan Pensil', 'Sepatu dan Buku Tulis', 'Tas Sekolah dan Penghapus'],
    jawaban: 2,
    penjelasan: 'Batang tertinggi pada diagram adalah Sepatu (Rp150) dan batang terendah adalah Buku Tulis (Rp3).',
  },
  {
    soal: 'Sebuah survei dilakukan terhadap 40 peserta didik mengenai kebiasaan penggunaan uang saku mereka. Berdasarkan tabel hasil survei tersebut, berapa banyak peserta didik yang tidak menggunakan uang sakunya untuk menabung?',
    visual: `<div class="eval-visual-caption">📋 Tabel Hasil Survei Penggunaan Uang Saku (40 Peserta Didik)</div>
      <table class="data-table"><thead><tr><th>Kegiatan</th><th>Jumlah Peserta Didik</th></tr></thead>
      <tbody>
        <tr><td>Jajan</td><td>20</td></tr>
        <tr><td>Menabung</td><td>10</td></tr>
        <tr><td>Membeli alat tulis</td><td>6</td></tr>
        <tr><td>Lainnya</td><td>4</td></tr>
      </tbody></table>`,
    pilihan: ['10 peserta didik', '20 peserta didik', '30 peserta didik', '40 peserta didik'],
    jawaban: 2,
    penjelasan: 'Total peserta didik yang disurvei adalah 40 orang. Yang tidak menabung = 40 − 10 (menabung) = 30 peserta didik.',
  },
  {
    soal: 'Perhatikan diagram lingkaran jenis pengeluaran uang saku dari 40 peserta didik yang disurvei berikut. Berdasarkan diagram tersebut, berapa jumlah peserta didik yang menggunakan uang sakunya untuk menabung?',
    visual: `<div class="eval-visual-caption">🥧 Diagram Lingkaran Jenis Pengeluaran Uang Saku (dari 40 Siswa)</div>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 40%, var(--biru-mid) 40% 65%, var(--violet) 65% 85%, var(--red) 85% 100%)">
          <span class="pie-pct" style="left:95px;top:49px">40%</span>
          <span class="pie-pct" style="left:54px;top:97px">25%</span>
          <span class="pie-pct" style="left:23px;top:60px">20%</span>
          <span class="pie-pct" style="left:43px;top:27px">15%</span>
        </div>
        <div class="pie-legend">
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--emas)"></span>Jajan (40%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--biru-mid)"></span>Menabung (25%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--violet)"></span>Alat Tulis (20%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--red)"></span>Lainnya (15%)</div>
        </div>
      </div>`,
    pilihan: ['6 peserta didik', '8 peserta didik', '10 peserta didik', '16 peserta didik'],
    jawaban: 2,
    penjelasan: 'Persentase menabung pada diagram lingkaran adalah 25%. Jumlah peserta didik = 25% × 40 = 10 peserta didik.',
  },
  {
    soal: 'Perhatikan tabel hasil survei harga sebuah buku tulis di lima toko berikut. Pernyataan yang paling tepat berdasarkan tabel tersebut adalah ....',
    visual: `<div class="eval-visual-caption">📋 Tabel Hasil Survei Harga Buku Tulis di 5 Toko</div>
      <table class="data-table"><thead><tr><th>Toko</th><th>Harga (Rp)</th></tr></thead>
      <tbody>
        <tr><td>Toko A</td><td>3.200</td></tr>
        <tr><td>Toko B</td><td>3.000</td></tr>
        <tr><td>Toko C</td><td>3.500</td></tr>
        <tr><td>Toko D</td><td>2.800</td></tr>
        <tr><td>Toko E</td><td>3.100</td></tr>
      </tbody></table>`,
    pilihan: ['Harga buku termahal terdapat di Toko E', 'Harga buku termurah terdapat di Toko D', 'Harga buku di semua toko sama besar', 'Harga buku termurah terdapat di Toko B'],
    jawaban: 1,
    penjelasan: 'Harga pada tabel adalah A=Rp3.200, B=Rp3.000, C=Rp3.500, D=Rp2.800, E=Rp3.100. Nilai terkecil adalah Rp2.800 di Toko D, sehingga Toko D memiliki harga termurah.',
  },
  {
    soal: 'Perhatikan tabel jumlah peserta didik yang memilih jenis tempat menyimpan uang berikut. Bentuk diagram yang paling tepat digunakan untuk menyajikan data tersebut adalah ....',
    visual: `<div class="eval-visual-caption">📋 Tabel Jumlah Peserta Didik Menurut Tempat Menyimpan Uang</div>
      <table class="data-table"><thead><tr><th>Jenis Tempat Menyimpan Uang</th><th>Jumlah Peserta Didik</th></tr></thead>
      <tbody>
        <tr><td>Celengan</td><td>15</td></tr>
        <tr><td>Tabungan Bank</td><td>10</td></tr>
        <tr><td>Dompet Digital</td><td>8</td></tr>
        <tr><td>Uang Tunai di Rumah</td><td>7</td></tr>
      </tbody></table>`,
    pilihan: ['Diagram garis', 'Diagram batang', 'Diagram pencar', 'Diagram batang-daun'],
    jawaban: 1,
    penjelasan: 'Data berupa jumlah (frekuensi) peserta didik pada beberapa kategori tempat menyimpan uang, sehingga diagram batang adalah bentuk paling tepat untuk membandingkan antarkategori.',
  },
  {
    soal: 'Perhatikan diagram batang perbandingan nilai nominal harga beberapa barang sebelum dan sesudah redenominasi berikut. Perhatikan bahwa satuan pada kedua kelompok data berbeda (ribu Rupiah lama dan Rupiah baru). Kesimpulan yang paling tepat berdasarkan diagram tersebut adalah ....',
    visual: `<div class="eval-visual-caption">📊 Diagram Batang Perbandingan Nominal Sebelum vs Sesudah Redenominasi</div>
      <div class="diagram-batang">
        <div class="batang-wrap"><div class="batang" style="height:6px"></div><span>Buku Tulis (lama) — 3</span></div>
        <div class="batang-wrap"><div class="batang" style="height:6px"></div><span>Buku Tulis (baru) — 3</span></div>
        <div class="batang-wrap"><div class="batang" style="height:4px"></div><span>Pensil (lama) — 2</span></div>
        <div class="batang-wrap"><div class="batang" style="height:4px"></div><span>Pensil (baru) — 2</span></div>
        <div class="batang-wrap"><div class="batang" style="height:140px"></div><span>Tas Sekolah (lama) — 75</span></div>
        <div class="batang-wrap"><div class="batang" style="height:140px"></div><span>Tas Sekolah (baru) — 75</span></div>
      </div>`,
    pilihan: ['Nilai riil barang menjadi lebih murah setelah redenominasi', 'Nilai riil barang tidak berubah, hanya tiga angka nol pada penulisan nominal yang dihilangkan', 'Harga barang naik karena angka pada diagram terlihat sama', 'Redenominasi menyebabkan barang menjadi lebih mahal secara riil'],
    jawaban: 1,
    penjelasan: 'Meskipun angka nominal berbeda satuan (ribu Rupiah lama vs Rupiah baru), nilai pada kedua kelompok batang sama besar. Ini menunjukkan bahwa redenominasi hanya menyederhanakan penulisan angka (menghilangkan tiga angka nol) tanpa mengubah nilai riil barang.',
  },
  {
    soal: 'Perhatikan diagram lingkaran penggunaan uang saku peserta didik berikut. Kesimpulan yang paling tepat berdasarkan diagram tersebut adalah ....',
    visual: `<div class="eval-visual-caption">🥧 Diagram Lingkaran Penggunaan Uang Saku Peserta Didik</div>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 50%, var(--biru-mid) 50% 70%, var(--violet) 70% 85%, var(--red) 85% 100%)">
          <span class="pie-pct" style="left:97px;top:60px">50%</span>
          <span class="pie-pct" style="left:38px;top:90px">20%</span>
          <span class="pie-pct" style="left:23px;top:54px">15%</span>
          <span class="pie-pct" style="left:43px;top:27px">15%</span>
        </div>
        <div class="pie-legend">
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--emas)"></span>Jajan (50%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--biru-mid)"></span>Menabung (20%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--violet)"></span>Transportasi (15%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--red)"></span>Lainnya (15%)</div>
        </div>
      </div>`,
    pilihan: ['Sebagian besar peserta didik menggunakan uang sakunya untuk menabung', 'Persentase uang saku yang ditabung lebih besar daripada yang digunakan untuk jajan', 'Sebagian besar uang saku digunakan untuk jajan, bukan untuk menabung', 'Seluruh peserta didik menggunakan uang saku hanya untuk transportasi'],
    jawaban: 2,
    penjelasan: 'Berdasarkan diagram lingkaran, persentase jajan (50%) jauh lebih besar dibandingkan menabung (20%), sehingga kesimpulan yang tepat adalah sebagian besar uang saku digunakan untuk jajan, bukan ditabung.',
  },
  {
    soal: 'Perhatikan tabel harga beberapa bahan pokok sebelum dan sesudah redenominasi berikut. Pernyataan yang paling tepat mengenai hubungan antara data statistik dan informasi keuangan pada tabel tersebut adalah ....',
    visual: `<div class="eval-visual-caption">📋 Tabel Harga Bahan Pokok Sebelum & Sesudah Redenominasi</div>
      <table class="data-table"><thead><tr><th>Bahan Pokok</th><th>Harga Sebelum Redenominasi</th><th>Harga Sesudah Redenominasi</th></tr></thead>
      <tbody>
        <tr><td>Beras (per kg)</td><td>Rp12.000</td><td>Rp12</td></tr>
        <tr><td>Minyak Goreng (per L)</td><td>Rp18.000</td><td>Rp18</td></tr>
        <tr><td>Gula (per kg)</td><td>Rp14.000</td><td>Rp14</td></tr>
      </tbody></table>`,
    pilihan: ['Redenominasi membuat daya beli masyarakat terhadap bahan pokok menjadi berkurang', 'Redenominasi menyebabkan harga riil bahan pokok naik tiga kali lipat', 'Perubahan angka nominal tidak mengubah nilai riil bahan pokok maupun daya beli uang', 'Harga bahan pokok setelah redenominasi lebih mahal dibandingkan sebelum redenominasi'],
    jawaban: 2,
    penjelasan: 'Redenominasi hanya mengubah angka nominal (menyederhanakan penulisan) tanpa mengubah nilai riil barang maupun daya beli uang terhadap bahan pokok tersebut.',
  },
  {
    soal: 'Perhatikan diagram batang harga beberapa jajanan sehat setelah redenominasi berikut. Dika memiliki uang saku Rp15 dan ingin membeli dua jenis jajanan yang berbeda. Kombinasi pembelian berikut yang justru melebihi uang saku Dika adalah ....',
    visual: `<div class="eval-visual-caption">📊 Diagram Batang Harga Jajanan Sehat Setelah Redenominasi</div>
      <div class="diagram-batang">
        <div class="batang-wrap"><div class="batang" style="height:70px"></div><span>Roti — Rp5</span></div>
        <div class="batang-wrap"><div class="batang" style="height:112px"></div><span>Susu Kotak — Rp8</span></div>
        <div class="batang-wrap"><div class="batang" style="height:140px"></div><span>Buah — Rp10</span></div>
        <div class="batang-wrap"><div class="batang" style="height:42px"></div><span>Snack — Rp3</span></div>
      </div>`,
    pilihan: ['Susu Kotak dan Buah', 'Buah dan Snack', 'Roti dan Susu Kotak', 'Roti dan Snack'],
    jawaban: 0,
    penjelasan: 'Susu Kotak (Rp8) + Buah (Rp10) = Rp18, melebihi uang saku Dika sebesar Rp15. Kombinasi lain masih dalam batas: Buah + Snack = Rp13; Roti + Susu Kotak = Rp13; Roti + Snack = Rp8.',
  },
  {
    soal: 'Perhatikan tabel pendapatan (uang saku) dan pengeluaran mingguan Salsa setelah redenominasi berikut. Berdasarkan tabel tersebut, jumlah uang yang dapat ditabung Salsa setiap minggu adalah ....',
    visual: `<div class="eval-visual-caption">📋 Tabel Pendapatan & Pengeluaran Mingguan Salsa (Rupiah Baru)</div>
      <table class="data-table"><thead><tr><th>Keterangan</th><th>Jumlah (Rupiah Baru)</th></tr></thead>
      <tbody>
        <tr><td>Uang Saku per Minggu</td><td>Rp50</td></tr>
        <tr><td>Pengeluaran Jajan</td><td>Rp20</td></tr>
        <tr><td>Pengeluaran Transportasi</td><td>Rp10</td></tr>
        <tr><td>Pengeluaran Alat Tulis</td><td>Rp5</td></tr>
        <tr><td>Pengeluaran Lainnya</td><td>Rp5</td></tr>
      </tbody></table>`,
    pilihan: ['Rp5', 'Rp10', 'Rp15', 'Rp20'],
    jawaban: 1,
    penjelasan: 'Total pengeluaran = Rp20 + Rp10 + Rp5 + Rp5 = Rp40. Sisa yang dapat ditabung = Rp50 − Rp40 = Rp10.',
  },
  {
    soal: 'Perhatikan diagram lingkaran alokasi uang saku mingguan Fira berikut. Berdasarkan diagram tersebut, kondisi keuangan Fira dapat dianalisis sebagai ....',
    visual: `<div class="eval-visual-caption">🥧 Diagram Lingkaran Alokasi Uang Saku Mingguan Fira</div>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 60%, var(--biru-mid) 60% 80%, var(--violet) 80% 90%, var(--red) 90% 100%)">
          <span class="pie-pct" style="left:95px;top:71px">60%</span>
          <span class="pie-pct" style="left:25px;top:71px">20%</span>
          <span class="pie-pct" style="left:30px;top:38px">10%</span>
          <span class="pie-pct" style="left:49px;top:25px">10%</span>
        </div>
        <div class="pie-legend">
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--emas)"></span>Jajan (60%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--biru-mid)"></span>Alat Tulis (20%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--violet)"></span>Tabungan (10%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--red)"></span>Lainnya (10%)</div>
        </div>
      </div>`,
    pilihan: ['Sehat, karena proporsi tabungan lebih besar daripada proporsi jajan', 'Kurang sehat, karena proporsi tabungan (10%) jauh lebih kecil dibandingkan proporsi jajan (60%)', 'Sehat, karena seluruh uang saku digunakan untuk kebutuhan sekolah', 'Tidak dapat dianalisis karena data tidak menunjukkan pengeluaran'],
    jawaban: 1,
    penjelasan: 'Proporsi tabungan pada diagram hanya 10%, jauh lebih kecil dibandingkan proporsi jajan yang mencapai 60%, sehingga kondisi keuangan Fira tergolong kurang sehat karena porsi menabung terlalu kecil.',
  },
  {
    soal: 'Perhatikan diagram batang perkembangan tabungan Vino selama empat bulan berikut. Penafsiran yang paling tepat mengenai perkembangan kondisi tabungan Vino adalah ....',
    visual: `<div class="eval-visual-caption">📊 Diagram Batang Perkembangan Tabungan Vino (4 Bulan)</div>
      <div class="diagram-batang">
        <div class="batang-wrap"><div class="batang" style="height:56px"></div><span>Januari — Rp20rb</span></div>
        <div class="batang-wrap"><div class="batang" style="height:98px"></div><span>Februari — Rp35rb</span></div>
        <div class="batang-wrap"><div class="batang" style="height:84px"></div><span>Maret — Rp30rb</span></div>
        <div class="batang-wrap"><div class="batang" style="height:140px"></div><span>April — Rp50rb</span></div>
      </div>`,
    pilihan: ['Tabungan Vino terus menurun setiap bulan', 'Tabungan Vino sempat menurun pada bulan Maret, namun secara keseluruhan cenderung meningkat hingga April', 'Tabungan Vino tidak mengalami perubahan sama sekali', 'Tabungan Vino tertinggi terjadi pada bulan Januari'],
    jawaban: 1,
    penjelasan: 'Tabungan naik dari Januari (Rp20rb) ke Februari (Rp35rb), turun pada Maret (Rp30rb), lalu naik kembali pada April (Rp50rb). Secara keseluruhan tren tabungan meningkat meskipun sempat menurun di bulan Maret.',
  },
  {
    soal: 'Rafi memiliki uang saku Rp30 per minggu. Berikut adalah data dua pilihan pengeluaran yang sedang dipertimbangkannya. Evaluasi yang paling tepat terhadap kedua pilihan pengeluaran Rafi berdasarkan data tersebut adalah ....',
    visual: `<div class="eval-visual-caption">📋 Tabel Dua Pilihan Pengeluaran Rafi (Uang Saku Rp30/minggu)</div>
      <table class="data-table"><thead><tr><th>Pilihan</th><th>Rincian Pembelian</th><th>Total Harga</th></tr></thead>
      <tbody>
        <tr><td>Pilihan 1</td><td>Buku (Rp15) dan Pensil (Rp5)</td><td>Rp20</td></tr>
        <tr><td>Pilihan 2</td><td>Tas baru</td><td>Rp35</td></tr>
      </tbody></table>`,
    pilihan: ['Pilihan 1 lebih tepat karena masih sesuai dengan uang saku dan menyisakan Rp10 untuk ditabung', 'Pilihan 2 lebih tepat karena tas lebih dibutuhkan meskipun melebihi uang saku', 'Kedua pilihan sama-sama tepat karena keduanya barang yang berguna', 'Pilihan 2 lebih tepat karena hanya membeli satu jenis barang'],
    jawaban: 0,
    penjelasan: 'Pilihan 1 (Rp20) tidak melebihi uang saku Rp30 dan masih menyisakan Rp10 yang dapat ditabung, sedangkan Pilihan 2 (Rp35) melebihi uang saku yang dimiliki Rafi.',
  },
  {
    soal: 'Perhatikan tabel harga beberapa bahan makanan sebelum dan sesudah redenominasi berikut. Perhatikan pernyataan-pernyataan berikut: (I) Harga roti setelah redenominasi adalah Rp8. (II) Nilai riil susu menjadi lebih murah setelah redenominasi. (III) Angka nominal harga telur sebelum redenominasi memiliki tiga digit lebih banyak dibandingkan sesudahnya. (IV) Total harga ketiga bahan makanan setelah redenominasi adalah Rp43. Pernyataan yang benar berdasarkan tabel tersebut ditunjukkan oleh nomor ....',
    visual: `<div class="eval-visual-caption">📋 Tabel Harga Bahan Makanan Sebelum & Sesudah Redenominasi</div>
      <table class="data-table"><thead><tr><th>Bahan Makanan</th><th>Harga Sebelum Redenominasi</th><th>Harga Sesudah Redenominasi</th></tr></thead>
      <tbody>
        <tr><td>Roti</td><td>Rp8.000</td><td>Rp8</td></tr>
        <tr><td>Susu</td><td>Rp10.000</td><td>Rp10</td></tr>
        <tr><td>Telur (per kg)</td><td>Rp25.000</td><td>Rp25</td></tr>
      </tbody></table>`,
    pilihan: ['I, II, dan III', 'I, III, dan IV', 'II, III, dan IV', 'I, II, dan IV'],
    jawaban: 1,
    penjelasan: 'I benar (Rp8.000 ÷ 1.000 = Rp8). II salah, karena redenominasi tidak mengubah nilai riil, hanya penulisan nominal. III benar (Rp25.000 memiliki digit ribuan, sedangkan Rp25 tidak). IV benar (8 + 10 + 25 = 43). Maka pernyataan yang benar adalah I, III, dan IV.',
  },
  {
    soal: 'Rina memiliki uang saku Rp50 setiap minggu untuk 5 hari sekolah. Setiap harinya, rata-rata Rina menghabiskan Rp8 untuk jajan dan Rp2 untuk transportasi. Rina ingin mulai menabung, namun masih bingung menentukan strategi yang tepat agar dapat menabung tanpa mengurangi kebutuhan transportasinya. Strategi menabung yang paling tepat untuk Rina berdasarkan deskripsi tersebut adalah ....',
    pilihan: ['Mengurangi pengeluaran transportasi harian agar ada sisa uang untuk ditabung', 'Mengurangi pengeluaran jajan harian, misalnya Rp2 per hari, sehingga terkumpul Rp10 per minggu untuk ditabung', 'Meminta tambahan uang saku kepada orang tua setiap minggu', 'Tidak menabung karena seluruh uang saku sudah habis untuk kebutuhan harian'],
    jawaban: 1,
    penjelasan: 'Pengeluaran harian Rina = Rp8 (jajan) + Rp2 (transportasi) = Rp10, dikali 5 hari = Rp50, sama dengan uang sakunya sehingga tidak ada sisa. Dengan mengurangi jajan Rp2 per hari, Rina dapat menyisihkan Rp10 per minggu untuk ditabung tanpa mengurangi transportasi.',
  },
  {
    soal: 'Andi memiliki uang saku Rp50 per minggu dengan alokasi penggunaan seperti pada diagram lingkaran berikut. Andi memiliki target tabungan sebesar Rp60 untuk membeli sebuah buku. Keputusan pengelolaan uang yang paling tepat agar Andi dapat mencapai target tabungannya adalah ....',
    visual: `<div class="eval-visual-caption">🥧 Diagram Lingkaran Alokasi Uang Saku Mingguan Andi (Rp50/minggu)</div>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 55%, var(--biru-mid) 55% 75%, var(--violet) 75% 90%, var(--red) 90% 100%)">
          <span class="pie-pct" style="left:97px;top:66px">55%</span>
          <span class="pie-pct" style="left:30px;top:82px">20%</span>
          <span class="pie-pct" style="left:27px;top:43px">15%</span>
          <span class="pie-pct" style="left:49px;top:25px">10%</span>
        </div>
        <div class="pie-legend">
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--emas)"></span>Jajan (55%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--biru-mid)"></span>Transportasi (20%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--violet)"></span>Tabungan (15%)</div>
          <div class="pie-legend-item"><span class="pie-swatch" style="background:var(--red)"></span>Lainnya (10%)</div>
        </div>
      </div>`,
    pilihan: ['Tetap mempertahankan alokasi saat ini karena tabungan sudah cukup besar', 'Mengurangi porsi jajan dan menambah porsi tabungan agar target Rp60 lebih cepat tercapai', 'Mengalokasikan seluruh uang saku untuk jajan karena target tabungan tidak penting', 'Menghentikan pengeluaran transportasi meskipun dibutuhkan untuk ke sekolah'],
    jawaban: 1,
    penjelasan: 'Agar target tabungan Rp60 lebih cepat tercapai, porsi tabungan pada alokasi uang saku perlu ditambah dengan cara mengurangi porsi jajan yang saat ini paling besar (55%).',
  },
  {
    soal: 'Perhatikan data keuangan Fikri berikut. Jika Fikri menabung seluruh sisa uang sakunya setiap minggu secara konsisten, berapa minggu lagi paling cepat Fikri dapat membeli sepatu impiannya?',
    visual: `<div class="eval-visual-caption">📋 Tabel Data Keuangan Fikri</div>
      <table class="data-table"><thead><tr><th>Keterangan</th><th>Jumlah (Rupiah Baru)</th></tr></thead>
      <tbody>
        <tr><td>Uang Saku per Minggu</td><td>Rp60</td></tr>
        <tr><td>Pengeluaran Jajan per Minggu</td><td>Rp25</td></tr>
        <tr><td>Pengeluaran Transportasi per Minggu</td><td>Rp15</td></tr>
        <tr><td>Pengeluaran Alat Tulis per Minggu</td><td>Rp10</td></tr>
        <tr><td>Tabungan Saat Ini</td><td>Rp45</td></tr>
        <tr><td>Harga Sepatu Impian (sebelum redenominasi)</td><td>Rp180.000</td></tr>
        <tr><td>Harga Sepatu Impian (sesudah redenominasi)</td><td>Rp180</td></tr>
      </tbody></table>`,
    pilihan: ['9 minggu', '12 minggu', '14 minggu', '18 minggu'],
    jawaban: 2,
    penjelasan: 'Sisa uang saku per minggu = Rp60 − (Rp25+Rp15+Rp10) = Rp10. Sisa dana yang dibutuhkan = Rp180 − Rp45 (tabungan saat ini) = Rp135. Waktu yang dibutuhkan = 135 ÷ 10 = 13,5 minggu, dibulatkan ke atas menjadi 14 minggu.',
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
  if (pageId === 'materi') initMateriVideoPage();

  // Tanya AI hanya tampil di menu Beranda/Utama.
  // Di menu Ayo Belajar, Kalkulator/Diagram, Evaluasi, dan Petunjuk, widget disembunyikan.
  const aiWidget = document.getElementById('aiWidget');
  if (aiWidget) {
    if (pageId === 'beranda') {
      aiWidget.classList.remove('hidden-page');
    } else {
      if (state.aiOpen) toggleAIWidget(); // tutup panel dulu agar tidak "menggantung" saat disembunyikan
      aiWidget.classList.add('hidden-page');
    }
  }
}

/* ──────────────────────────────────────────────
   LOGIN
────────────────────────────────────────────── */
let loginTipeAktif = 'individu';

/**
 * Ganti tampilan form login antara Individu & Kelompok. Field Sekolah
 * tetap sama untuk kedua mode (tidak diduplikasi).
 */
function setLoginTipe(tipe) {
  loginTipeAktif = tipe;
  const btnIndividu = document.getElementById('btnLoginIndividu');
  const btnKelompok = document.getElementById('btnLoginKelompok');
  if (btnIndividu) btnIndividu.classList.toggle('active', tipe === 'individu');
  if (btnKelompok) btnKelompok.classList.toggle('active', tipe === 'kelompok');
  const fieldsIndividu = document.getElementById('loginFieldsIndividu');
  const fieldsKelompok = document.getElementById('loginFieldsKelompok');
  if (fieldsIndividu) fieldsIndividu.style.display = (tipe === 'individu') ? 'block' : 'none';
  if (fieldsKelompok) fieldsKelompok.style.display = (tipe === 'kelompok') ? 'block' : 'none';
}

function handleLogin() {
  const tipe = loginTipeAktif;
  const kelas = document.getElementById('inputKelas').value.trim(); // field "Sekolah"

  let nama, absen, anggota = '';

  if (tipe === 'kelompok') {
    nama   = document.getElementById('inputNamaKelompok').value.trim();
    absen  = ''; // tidak ada lagi field "No. Kelompok" pada form login
    anggota = document.getElementById('inputAnggotaKelompok').value.trim();

    if (!nama) { shakeInput('inputNamaKelompok'); showToast(' Nama kelompok harus diisi!', 'warn'); return; }
    if (!anggota) { shakeInput('inputAnggotaKelompok'); showToast(' Tulis dulu anggota kelompoknya!', 'warn'); return; }
  } else {
    nama  = document.getElementById('inputNama').value.trim();
    absen = document.getElementById('inputAbsen').value.trim();

    if (!nama) { shakeInput('inputNama'); showToast(' Nama lengkap harus diisi!', 'warn'); return; }
    if (!absen || absen < 1 || absen > 40) { shakeInput('inputAbsen'); showToast(' Nomor absen tidak valid!', 'warn'); return; }
  }

  if (!kelas) { shakeInput('inputKelas'); showToast(' Nama sekolah harus diisi!', 'warn'); return; }

  state.user = { tipe, nama, absen, kelas, anggota };
  document.getElementById('namaDisplay').textContent = nama;
  document.getElementById('sambutanSiswa').style.display = 'inline-flex';
  document.getElementById('navNama').textContent = nama;

  // Langsung catat Nama/Kelas/Absen ke rekap begitu murid login — supaya
  // baris murid ini SUDAH ADA di Spreadsheet sejak awal (kolom nilai masih
  // kosong), bukan baru muncul nanti setelah Evaluasi/KB1/KB2 selesai.
  // Dikirim async, tidak perlu ditunggu — tidak boleh menghambat proses
  // login kalau koneksi lambat/gagal (akan tertutupi otomatis saat
  // kirimProgresKB()/kirimKeSheets() berikutnya jalan).
  kirimProgresKB();

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
   HALAMAN MATERI & VIDEO
   Tab "Materi" berisi konten statis (lihat index.html).

   Tab "Video" sekarang tampil sebagai layout "player + daftar":
   - Kolom kiri  : video yang sedang aktif diputar (videoAktifIndex)
   - Kolom kanan : daftar semua video lain dari MATERI_VIDEOS,
                   klik salah satu untuk mengganti video di kolom kiri.

   Catatan soal "Video player configuration error / Error 153":
   error ini nyaris selalu muncul karena salah satu dari tiga hal:
   1) Header HTTP "Referer" tidak terkirim ke YouTube saat iframe dimuat
      (mis. atribut `referrerpolicy` iframe tidak diisi, sehingga bisa
      memakai kebijakan yang menghapus Referer). YouTube MEWAJIBKAN
      Referer terkirim untuk memutar embed.
      -> Solusi (SUDAH diterapkan di putarVideoUtama()): iframe selalu
         diberi `referrerpolicy="strict-origin-when-cross-origin"`,
         nilai yang direkomendasikan resmi oleh YouTube.
   2) Halaman dibuka langsung dari file (file://index.html), bukan
      lewat server (http://localhost:5000/) — origin jadi "null" dan
      sama sekali tidak ada Referer yang bisa dikirim ke YouTube.
      -> Solusi: jalankan `python app.py`, lalu buka
         http://localhost:5000/ di browser (JANGAN dobel klik index.html).
   3) Pemilik video mematikan opsi "izinkan disematkan" (embed) untuk
      video tsb, atau video sudah dihapus/private.
      -> Solusi: pakai video lain yang mengizinkan embed, atau pakai
         tombol "Tonton Langsung di YouTube" sebagai jalan pintas.
   Kode di bawah ini juga otomatis mendeteksi video yang gagal
   diputar (lewat YouTube IFrame API) dan menampilkan tombol
   "Tonton di YouTube" sebagai cadangan supaya siswa tidak mentok.
────────────────────────────────────────────── */
let materiVideoSudahDirender = false;
let videoAktifIndex = 0;
let ytApiSudahDiminta = false;
const ytApiCallbackQueue = [];

function initMateriVideoPage() {
  if (materiVideoSudahDirender) return; // cukup dirender sekali
  const playlistEl = document.getElementById('videoPlaylist');
  const playerFrameEl = document.getElementById('videoPlayerFrame');
  if (!playlistEl || !playerFrameEl) return;

  if (!MATERI_VIDEOS.length) {
    playerFrameEl.innerHTML = `<p style="text-align:center;color:var(--text-2);padding:20px 0">Video belum tersedia. Tambahkan pada variabel <code>MATERI_VIDEOS</code> di <code>script.js</code>.</p>`;
    playlistEl.innerHTML = '';
    return;
  }

  // Jika halaman dibuka langsung dari File Explorer (file://) bukan lewat
  // server Flask, iframe YouTube TIDAK akan pernah bisa diputar (origin
  // "null" tidak dikenali YouTube). Beri tahu ini SEJAK AWAL lewat banner,
  // supaya siswa tidak menebak-nebak kenapa video error terus.
  if (window.location.protocol === 'file:') {
    const banner = document.createElement('div');
    banner.className = 'video-file-warning';
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v5M12 16v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>Halaman ini dibuka langsung dari file (bukan lewat server), sehingga video YouTube tidak akan bisa diputar di sini. Jalankan <code>python app.py</code>, lalu buka <code>http://localhost:5000/</code> di browser agar video bisa diputar.</span>`;
    playerFrameEl.parentElement.insertBefore(banner, playerFrameEl);
  }

  renderVideoPlaylist();
  renderVideoInfo(videoAktifIndex);
  tampilkanThumbnailUtama(videoAktifIndex); // player kiri: thumbnail dulu, iframe dimuat saat diklik
  materiVideoSudahDirender = true;

  // Baris "Lainnya dari YouTube" dimuat terpisah & async (tidak menghambat
  // tampilan awal), memakai algoritma pencarian YouTube sendiri.
  muatVideoLainnyaDariYoutube();
}

// Render daftar video KURASI GURU (bagian atas MATERI_VIDEOS, sejumlah
// JUMLAH_VIDEO_KURASI) ke baris "Pilihan Video Lain".
function renderVideoPlaylist() {
  const playlistEl = document.getElementById('videoPlaylist');
  if (!playlistEl) return;
  const videoKurasi = MATERI_VIDEOS.slice(0, JUMLAH_VIDEO_KURASI);
  playlistEl.innerHTML = videoKurasi.map((v, i) => renderVideoCardHtml(v, i)).join('');
}

// Render satu kartu video (dipakai baik untuk baris kurasi maupun baris YouTube).
function renderVideoCardHtml(v, index) {
  return `
    <div class="video-playlist-item ${index === videoAktifIndex ? 'active' : ''}" id="videoPlaylistItem${index}"
         onclick="pilihVideoMateri(${index})"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pilihVideoMateri(${index})}"
         role="button" tabindex="0" aria-label="Putar video: ${v.judul}">
      <div class="video-playlist-thumb">
        <img src="${v.thumbnail || `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}" alt="Thumbnail ${v.judul}" loading="lazy"
             onerror="this.src='https://img.youtube.com/vi/${v.id}/default.jpg'">
        <span class="video-playlist-play"><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/></svg></span>
        ${v.sumber === 'youtube' ? `<span class="video-playlist-badge-yt"><svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M21.6 7.2c-.25-1-1-1.75-2-2C17.9 4.7 12 4.7 12 4.7s-5.9 0-7.6.5c-1 .25-1.75 1-2 2C2 8.9 2 12 2 12s0 3.1.4 4.8c.25 1 1 1.75 2 2 1.7.5 7.6.5 7.6.5s5.9 0 7.6-.5c1-.25 1.75-1 2-2 .4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.2V8.8L15.5 12 10 15.2z"/></svg>YouTube</span>` : ''}
      </div>
      <div class="video-playlist-text">
        <h5>${v.judul}</h5>
        <p>${v.deskripsi || v.channel || ''}</p>
      </div>
    </div>
  `;
}

// Ambil video "lain" dari YouTube Data API (search.list) lewat proxy backend
// (/api/video-lainnya di app.py) dan tambahkan ke baris "Lainnya dari
// YouTube" — hasilnya ditentukan oleh algoritma pencarian & relevansi
// YouTube sendiri, bukan daftar statis buatan kita.
function muatVideoLainnyaDariYoutube() {
  const statusEl = document.getElementById('videoYoutubeStatus');
  const excludeIds = MATERI_VIDEOS.map(v => v.id).join(',');
  const url = `${VIDEO_LAINNYA_URL}?q=${encodeURIComponent(VIDEO_LAINNYA_QUERY)}&exclude=${encodeURIComponent(excludeIds)}&max=12`;

  fetch(url)
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || data.status !== 'ok' || !Array.isArray(data.videos) || !data.videos.length) {
        tampilkanStatusVideoYoutube(data && data.message, true);
        return;
      }
      const awalIndex = MATERI_VIDEOS.length;
      data.videos.forEach(v => {
        MATERI_VIDEOS.push({
          id: v.id,
          judul: v.judul,
          deskripsi: v.channel ? `Kanal: ${v.channel}` : (v.deskripsi || ''),
          thumbnail: v.thumbnail,
          sumber: 'youtube',
        });
      });
      renderVideoPlaylistYoutube(awalIndex);
    })
    .catch(() => tampilkanStatusVideoYoutube(null, true));
}

// Render bagian video YouTube dinamis (index awal..akhir MATERI_VIDEOS) ke baris "Lainnya dari YouTube".
function renderVideoPlaylistYoutube(awalIndex) {
  const playlistEl = document.getElementById('videoPlaylistYoutube');
  if (!playlistEl) return;
  const html = MATERI_VIDEOS
    .map((v, i) => ({ v, i }))
    .filter(({ i }) => i >= awalIndex)
    .map(({ v, i }) => renderVideoCardHtml(v, i))
    .join('');
  playlistEl.innerHTML = html;
}

// Tampilkan pesan status/error di baris "Lainnya dari YouTube" (mis. kalau
// YOUTUBE_API_KEY belum diisi di server, atau koneksi gagal).
function tampilkanStatusVideoYoutube(pesanServer, isError) {
  const playlistEl = document.getElementById('videoPlaylistYoutube');
  if (!playlistEl) return;
  const pesan = pesanServer || 'Rekomendasi otomatis dari YouTube belum aktif di server ini. Gunakan tombol pencarian manual di bawah.';
  playlistEl.innerHTML = `<p class="video-yt-status${isError ? ' is-error' : ''}">${pesan}</p>`;
}

// Update judul/deskripsi/link di bawah player kiri.
function renderVideoInfo(index) {
  const v = MATERI_VIDEOS[index];
  if (!v) return;
  const titleEl = document.getElementById('videoMainTitle');
  const descEl = document.getElementById('videoMainDesc');
  const linkEl = document.getElementById('videoMainYoutubeLink');
  if (titleEl) titleEl.textContent = v.judul;
  if (descEl) descEl.textContent = v.deskripsi || '';
  if (linkEl) linkEl.href = `https://www.youtube.com/watch?v=${v.id}`;
  updateVideoStageBackdrop(index);
}

// Ganti backdrop blur di belakang panggung video (efek sinematik ala Netflix)
// mengikuti thumbnail video yang sedang aktif.
function updateVideoStageBackdrop(index) {
  const v = MATERI_VIDEOS[index];
  const backdropEl = document.getElementById('videoStageBackdrop');
  if (!v || !backdropEl) return;
  backdropEl.style.backgroundImage = `url('https://img.youtube.com/vi/${v.id}/hqdefault.jpg')`;
}

// Tampilkan thumbnail + tombol Play dulu di player utama (ringan, belum memuat iframe).
function tampilkanThumbnailUtama(index) {
  const v = MATERI_VIDEOS[index];
  const frame = document.getElementById('videoPlayerFrame');
  if (!v || !frame) return;
  frame.innerHTML = `
    <div class="video-thumb-wrap" id="videoMainThumb"
         onclick="putarVideoUtama(${index})"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();putarVideoUtama(${index})}"
         role="button" tabindex="0" aria-label="Putar video: ${v.judul}">
      <img src="https://img.youtube.com/vi/${v.id}/hqdefault.jpg" alt="Thumbnail ${v.judul}" loading="lazy">
      <button class="video-play-btn" tabindex="-1" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/></svg>
      </button>
    </div>`;
}

// Klik salah satu video di daftar sebelah kanan -> ganti video di player kiri.
function pilihVideoMateri(index) {
  if (index === videoAktifIndex) return;
  videoAktifIndex = index;
  renderVideoInfo(index);
  // Video dipilih lewat klik pengguna, jadi boleh langsung autoplay.
  putarVideoUtama(index, true);
  // Perbarui status "active" pada daftar tanpa merender ulang semuanya.
  document.querySelectorAll('.video-playlist-item.active').forEach(el => el.classList.remove('active'));
  const item = document.getElementById(`videoPlaylistItem${index}`);
  if (item) {
    item.classList.add('active');
    item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

// Memuat iframe YouTube untuk video di player utama (kolom kiri).
//
// Catatan soal "Error 153 / Video player configuration error":
// Penyebab paling umum BUKAN parameter "origin", melainkan header HTTP
// "Referer" yang tidak terkirim ke YouTube — biasanya karena atribut
// `referrerpolicy` iframe tidak diisi eksplisit (sehingga browser/CDN bisa
// memakai kebijakan yang menghapus Referer, mis. "no-referrer" / "same-origin"),
// atau karena halaman dibuka lewat file:// (origin "null", tidak ada Referer
// sama sekali). YouTube mensyaratkan Referer terkirim agar embed berfungsi,
// jadi iframe di bawah SELALU diberi referrerpolicy="strict-origin-when-cross-origin"
// (nilai yang direkomendasikan resmi oleh YouTube) — ini yang jadi kunci
// perbaikannya, di luar penyebab lain seperti embed dimatikan pemilik video.
function putarVideoUtama(index, autoplay) {
  const v = MATERI_VIDEOS[index];
  const frame = document.getElementById('videoPlayerFrame');
  if (!v || !frame) return;

  // Kalau halaman dibuka lewat file:// (dobel klik index.html), iframe
  // YouTube dipastikan gagal (tidak ada Referer/origin valid yang bisa
  // dikirim) — langsung tampilkan fallback tanpa memaksa mencoba iframe
  // dulu, supaya siswa tidak perlu menunggu error muncul.
  if (window.location.protocol === 'file:') {
    tampilkanFallbackVideo(index);
    return;
  }

  const iframeId = 'videoMainIframe';
  // "origin" hanya dikirim kalau halaman benar-benar diakses lewat http(s)
  // (server Flask di http://localhost:5000/).
  const isValidHttpOrigin = /^https?:\/\//.test(window.location.origin || '');
  const origin = isValidHttpOrigin ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
  // Dipakai domain youtube-nocookie.com (mode privasi yang direkomendasikan
  // YouTube untuk embed di situs pihak ketiga) — selain lebih ramah privasi
  // siswa, domain ini juga cenderung lebih jarang diblokir oleh pengaturan
  // jaringan sekolah/browser dibanding www.youtube.com/embed.
  // Video baru dimuat setelah pengguna mengklik (thumbnail atau daftar di kanan),
  // jadi autoplay di sini aman dan tidak melanggar kebijakan autoplay browser.
  frame.innerHTML = `<iframe id="${iframeId}" src="https://www.youtube-nocookie.com/embed/${v.id}?rel=0&enablejsapi=1&playsinline=1&autoplay=1${origin}" title="${v.judul}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;

  // Pasang pendeteksi error YouTube (video tak bisa disematkan / dihapus / dsb).
  // Jika gagal diputar, otomatis ganti tampilan jadi tombol "Tonton di YouTube".
  attachYoutubeErrorWatcher(iframeId, index);
}

// Muat YouTube IFrame API sekali saja, lalu jalankan semua callback yang menunggu.
function loadYoutubeIframeApi(callback) {
  ytApiCallbackQueue.push(callback);
  if (ytApiSudahDiminta) return;
  ytApiSudahDiminta = true;
  window.onYouTubeIframeAPIReady = function () {
    ytApiCallbackQueue.splice(0).forEach(cb => { try { cb(); } catch (e) { /* abaikan */ } });
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

// Pantau apakah video di iframe gagal diputar (embed dimatikan, video hilang, dll).
function attachYoutubeErrorWatcher(iframeId, videoIndex) {
  const buatPlayer = () => {
    const iframeEl = document.getElementById(iframeId);
    if (!iframeEl || typeof YT === 'undefined' || !YT.Player) return;
    try {
      new YT.Player(iframeId, {
        events: {
          onError: function () { tampilkanFallbackVideo(videoIndex); },
        },
      });
    } catch (e) { /* abaikan jika player sudah dibuat / API belum siap */ }
  };
  if (window.YT && window.YT.Player) {
    buatPlayer();
  } else {
    loadYoutubeIframeApi(buatPlayer);
  }
}

// Tampilan cadangan saat video benar-benar tidak bisa diputar di dalam web ini.
function tampilkanFallbackVideo(index) {
  const v = MATERI_VIDEOS[index];
  const frame = document.getElementById('videoPlayerFrame');
  if (!v || !frame) return;
  frame.innerHTML = `
    <div class="video-fallback">
      <img src="https://img.youtube.com/vi/${v.id}/hqdefault.jpg" alt="Thumbnail ${v.judul}" class="video-fallback-bg">
      <div class="video-fallback-overlay">
        <svg viewBox="0 0 24 24" fill="none" width="34" height="34"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5M12 16v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <h4>Video ini tidak bisa diputar langsung di sini</h4>
        <p>Video mungkin dinonaktifkan untuk disematkan (embed), atau halaman belum diakses lewat server. Kamu tetap bisa menontonnya langsung di YouTube.</p>
        <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener noreferrer" class="btn-video-youtube">
          Tonton di YouTube
        </a>
      </div>
    </div>`;
}

function setMateriTab(tab) {
  document.getElementById('tabBtnMateri').classList.toggle('active', tab === 'materi');
  document.getElementById('tabBtnVideo').classList.toggle('active', tab === 'video');
  document.getElementById('tabMateri').classList.toggle('active', tab === 'materi');
  document.getElementById('tabVideo').classList.toggle('active', tab === 'video');
}

function bukaYoutubeSearch(query) {
  window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
}

/* ──────────────────────────────────────────────
   DETAIL MATERI — dibuka saat kartu di menu "Materi"
   diklik. Menampilkan penjelasan lebih lengkap ditambah
   contoh diagram sungguhan (digambar di canvas), supaya
   murid tidak hanya membaca teks tapi juga melihat
   visualisasinya langsung.
────────────────────────────────────────────── */
const MATERI_DETAIL = {
  investigasi: {
    tag: 'Investigasi Statistika', title: 'Investigasi Statistika',
    paragraf: [
      'Dalam kehidupan sehari-hari kita sering menemukan berbagai macam data — misalnya pemain sepak bola dengan performa terbaik, makanan yang paling disukai siswa, atau kemampuan siswa melakukan sit-up. Untuk memperoleh kesimpulan dari data seperti itu, kita tidak cukup hanya mengumpulkannya; data perlu diolah dan dianalisis lebih dulu.',
      'Secara umum, investigasi statistika dilakukan melalui empat tahap berurutan: <strong>Formulasi Pertanyaan → Pengumpulan Data → Analisis Data → Interpretasi Hasil.</strong>',
      '<strong>1. Formulasi Pertanyaan</strong> — menentukan pertanyaan yang ingin dijawab lewat data. Pertanyaan statistika biasanya punya jawaban yang bervariasi dan butuh pengumpulan sejumlah data, misalnya: "Berapa panjang nama siswa di kelas?", "Apa olahraga yang paling disukai siswa?", atau "Berapa lama siswa menggunakan internet?" Pertanyaan yang dirumuskan menentukan jenis data yang perlu dikumpulkan.',
      '<strong>2. Pengumpulan Data</strong> — data dapat diperoleh lewat pengukuran, pengamatan, wawancara, survei, atau memakai data yang sudah tersedia. Misalnya untuk mengetahui panjang nama siswa, kita bisa meminta tiap siswa menuliskan namanya lalu menghitung jumlah hurufnya.',
      '<strong>3. Analisis Data</strong> — data yang terkumpul diolah supaya lebih mudah dibaca dan dipahami, salah satunya dengan menyajikannya dalam bentuk diagram (diagram batang, diagram garis, diagram batang ganda, diagram garis ganda, atau diagram lingkaran).',
      '<strong>4. Interpretasi Hasil</strong> — tahap terakhir menarik kesimpulan berdasarkan hasil analisis, dengan menjawab pertanyaan awal berdasarkan data atau diagram yang sudah dibuat.',
      'Contohnya, data mengenai jumlah huruf pada nama siswa bisa disajikan dengan <em>diagram titik/line plot</em> (titik-titik menunjukkan banyak siswa dengan jumlah huruf tertentu) maupun dengan diagram batang — keduanya sama-sama bisa dipakai untuk menunjukkan frekuensi data, hanya beda cara penyajiannya: line plot memakai titik-titik, diagram batang memakai tinggi batang.',
    ],
    diagram: { tipe: 'batang', judul: 'Contoh: Jumlah Huruf pada Nama Siswa', sumbuX: 'Jumlah Huruf', sumbuY: 'Jumlah Siswa',
      data: [{ label: '4', value: 3 }, { label: '5', value: 7 }, { label: '6', value: 9 }, { label: '7', value: 5 }, { label: '8', value: 2 }] },
  },
  'jenis-data': {
    tag: 'Macam Data', title: 'Data Kategorik & Numerik',
    paragraf: [
      'Data dapat dikelompokkan berdasarkan sifatnya menjadi dua jenis: <strong>data kategorik</strong> dan <strong>data numerik</strong>.',
      '<strong>Data kategorik</strong> adalah data yang berupa kategori atau kelompok, dipakai untuk menunjukkan kelompok/jenis tertentu. Contohnya: nama provinsi, nama negara, kelas, jenis olahraga, jenis makanan, dan warna kendaraan.',
      '<strong>Data numerik</strong> adalah data yang berupa angka dan memiliki makna kuantitatif, sehingga memungkinkan kita melakukan operasi matematika yang bermakna. Contohnya: tinggi badan, berat badan, panjang nama, jumlah medali, jumlah gol, suhu, banyak aplikasi, dan skor permainan.',
      '<strong>Catatan penting:</strong> tidak semua data yang ditulis dengan angka otomatis termasuk data numerik. Kalau angka itu cuma dipakai sebagai identitas/label — misalnya nomor kelas atau nomor peserta — maka angka tersebut termasuk data <em>kategorik</em>. Contohnya kelas 7A, 7B, dan 7C: angka pada nama kelas ini tidak menunjukkan besaran yang bisa dijumlahkan atau dikurangi, jadi tetap data kategorik.',
    ],
    diagram: null,
  },
  'cara-baca': {
    tag: 'Panduan', title: 'Cara Membaca Diagram',
    paragraf: [
      'Diagram digunakan untuk menyajikan data secara visual supaya informasinya lebih mudah dibaca — membantu kita melihat perubahan, kenaikan/penurunan, pola tertentu, perbandingan antarkelompok, dan kecenderungan data. Namun diagram harus dibaca dengan teliti; jangan langsung menebak angka hanya dari tampilan visualnya.',
      'Sebelum menarik kesimpulan dari sebuah diagram, selalu perhatikan lima hal ini: <strong>(1) judul diagram</strong> — topik apa yang disajikan; <strong>(2) sumbu horizontal</strong>; <strong>(3) sumbu vertikal</strong>; <strong>(4) skala</strong>; <strong>(5) satuan</strong>; dan <strong>(6) keterangan/legenda</strong> apabila ada lebih dari satu kelompok data.',
      'Cek skala pada sumbunya sebelum membandingkan — satu kotak atau satu garis bisa saja mewakili lebih dari satu satuan data (misalnya satu kotak = 5 siswa, bukan 1 siswa), sehingga dua diagram dengan skala berbeda bisa terlihat sangat berbeda padahal datanya mirip.',
      'Apabila ingin membandingkan <strong>dua kelompok data</strong> sekaligus (misalnya jumlah medali emas Olimpiade 2016 vs 2020, atau olahraga favorit kelas 7C vs 7D), dipakai <strong>diagram batang ganda</strong> — dua warna/bentuk batang berdampingan dipakai untuk membedakan tiap kelompok data, sehingga perubahan atau perbandingan keduanya lebih mudah dilihat.',
    ],
    diagram: { tipe: 'batang', judul: 'Contoh: Perhatikan Skala Sumbu Y!', sumbuX: 'Kelas', sumbuY: 'Jumlah Siswa (per 5)',
      data: [{ label: '7A', value: 30 }, { label: '7B', value: 25 }, { label: '7C', value: 35 }] },
  },
  batang: {
    tag: 'Diagram Batang', title: 'Diagram Batang',
    paragraf: [
      'Diagram batang menampilkan data sebagai batang/kotak sejajar dengan tinggi sesuai nilainya, dan umumnya dipakai untuk menyajikan <strong>data kategorik</strong> — cocok untuk membandingkan nilai antar kategori.',
      'Langkah umum membuat diagram batang: (1) tentukan kategori data, (2) hitung frekuensi tiap kategori, (3) buat judul diagram, (4) tentukan sumbu horizontal & vertikal, (5) beri label pada kedua sumbu, (6) tentukan skala yang konsisten, (7) buat batang dengan tinggi sesuai frekuensi, (8) pastikan lebar tiap batang sama, dan (9) beri jarak yang sesuai antarbatang.',
      'Contoh: survei olahraga favorit kelas 7C dan 7D — bulu tangkis (13 vs 8 siswa), bola basket (10 vs 12), bola voli (6 vs 8), atletik (3 vs 5), dan renang (2 vs 1). Karena ada dua kelompok kelas yang dibandingkan pada kategori yang sama, data ini paling pas disajikan dengan <strong>diagram batang ganda</strong> — dua batang berdampingan untuk tiap cabang olahraga.',
    ],
    diagram: { tipe: 'batang', judul: 'Contoh: Cabang Olahraga Favorit', sumbuX: 'Cabang Olahraga', sumbuY: 'Jumlah Siswa',
      data: [{ label: 'Sepak Bola', value: 14 }, { label: 'Basket', value: 9 }, { label: 'Voli', value: 7 }, { label: 'Bulu Tangkis', value: 11 }] },
  },
  garis: {
    tag: 'Diagram Garis', title: 'Diagram Garis',
    paragraf: [
      'Diagram garis menghubungkan titik-titik data dengan garis lurus secara berurutan, sehingga lebih cocok dipakai ketika data menunjukkan <strong>perubahan dari waktu ke waktu</strong> — misalnya perubahan suhu tiap jam, jumlah pengunjung tiap bulan, jumlah penduduk tiap tahun, atau perkembangan penjualan tiap bulan.',
      'Cara membacanya: garis yang naik berarti nilainya bertambah, garis yang turun berarti nilainya berkurang — makin curam garisnya, makin cepat perubahannya. Karena itu, kalau sumbu horizontalnya menunjukkan waktu, diagram garis biasanya lebih sesuai dipakai dibanding diagram batang.',
      'Kalau ingin membandingkan perubahan <strong>dua kelompok data</strong> sekaligus dari waktu ke waktu (misalnya emisi CO₂ suatu negara pada tahun 1990 vs 1998, atau rata-rata penggunaan media sosial 2020 vs 2021), dipakai <strong>diagram garis ganda</strong> — dua garis dengan warna berbeda pada satu diagram yang sama.',
    ],
    diagram: { tipe: 'garis', judul: 'Contoh: Pengunjung Perpustakaan per Bulan', sumbuX: 'Bulan', sumbuY: 'Pengunjung',
      data: [{ label: 'Jan', value: 40 }, { label: 'Feb', value: 55 }, { label: 'Mar', value: 48 }, { label: 'Apr', value: 63 }, { label: 'Mei', value: 70 }] },
  },
  lingkaran: {
    tag: 'Diagram Lingkaran', title: 'Diagram Lingkaran',
    paragraf: [
      'Diagram lingkaran dipakai untuk menunjukkan <strong>bagian-bagian dari keseluruhan</strong> data. Berbeda dari diagram batang/garis, diagram lingkaran tidak memakai sumbu horizontal dan vertikal — satu lingkaran penuh besarnya 360°, dan tiap bagian lingkaran disebut <strong>sektor</strong>.',
      'Rumus mengubah data menjadi persentase dan sudut sektor:<br>Persentase = (sudut sektor ÷ 360°) × 100%<br>Sudut sektor = (persentase ÷ 100%) × 360°',
      'Contoh: sebuah hard disk memiliki sektor terpakai sebesar 216° dan sisanya (144°) belum terpakai. Karena total sudut lingkaran 360°, bagian terpakai = 216/360 = 3/5 = <strong>60%</strong>, dan bagian belum terpakai = 144/360 = 2/5 = <strong>40%</strong>. Kalau kapasitas hard disk itu 500 TB, maka 60% × 500 = <strong>300 TB</strong> sudah terpakai, dan sisanya 200 TB belum terpakai.',
    ],
    diagram: { tipe: 'lingkaran', judul: 'Contoh: Kapasitas Hard Disk Terpakai', sumbuX: '', sumbuY: '',
      data: [{ label: 'Terpakai', value: 60 }, { label: 'Belum Terpakai', value: 40 }] },
  },
  memilih: {
    tag: 'Tips', title: 'Memilih Diagram yang Tepat',
    paragraf: [
      'Tidak semua data sebaiknya disajikan dengan diagram yang sama — pemilihan diagram bergantung pada tujuan penyajian datanya:',
      '• <strong>Diagram batang</strong> → membandingkan data/kategori.<br>• <strong>Diagram batang ganda</strong> → membandingkan dua kelompok data pada kategori yang sama.<br>• <strong>Diagram garis</strong> → menunjukkan perubahan data dari waktu ke waktu.<br>• <strong>Diagram garis ganda</strong> → membandingkan perubahan dua kelompok data dari waktu ke waktu.<br>• <strong>Diagram lingkaran</strong> → menunjukkan bagian terhadap keseluruhan.',
      'Contoh penerapannya: (1) membandingkan jumlah pengguna TikTok di lima kelas → <em>diagram batang</em>, karena membandingkan satu jenis data pada beberapa kategori kelas. (2) membandingkan TikTok dan LINE di lima kelas sekaligus → <em>diagram batang ganda</em>, karena ada dua jenis data yang dibandingkan pada kategori yang sama.',
      '(3) rata-rata waktu penggunaan TikTok selama satu minggu → <em>diagram garis</em>, karena datanya berubah berdasarkan waktu. (4) membandingkan rata-rata penggunaan TikTok kelas 7A dan 7B selama satu minggu → <em>diagram garis ganda</em>, karena ada dua kelompok data yang berubah terhadap waktu.',
      '(5) persentase aktivitas daring siswa → <em>diagram lingkaran</em>, karena yang ingin ditunjukkan adalah bagian-bagian dari keseluruhan. (6) mengetahui apakah penggemar sepak bola lebih dari setengah kelas → diagram lingkaran juga bisa dipakai, karena menunjukkan proporsi bagian terhadap keseluruhan.',
      'Intinya: tidak hanya penting bisa <em>membuat</em> diagram, tapi juga mampu <em>membaca, menganalisis, dan menarik kesimpulan</em> dari data yang sudah disajikan.',
    ],
    diagram: null,
  },
};

function bukaMateriDetail(key) {
  const info = MATERI_DETAIL[key];
  if (!info) return;
  const modal = document.getElementById('modalMateriDetail');
  if (!modal) return;

  document.getElementById('materiDetailTag').textContent = info.tag;
  document.getElementById('materiDetailTitle').textContent = info.title;
  document.getElementById('materiDetailText').innerHTML = info.paragraf.map(p => `<p>${p}</p>`).join('');

  const canvasWrap = document.getElementById('materiDetailDiagramWrap');
  const canvas = document.getElementById('materiDetailCanvas');
  const legend = document.getElementById('materiDetailLegend');
  const judulEl = document.getElementById('materiDetailDiagramJudul');
  if (info.diagram) {
    canvasWrap.style.display = 'block';
    judulEl.textContent = info.diagram.judul;
    legend.innerHTML = '';
    legend.style.display = 'none';
    gambarDiagramContoh(canvas, legend, info.diagram);
  } else {
    canvasWrap.style.display = 'none';
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function tutupMateriDetail() {
  const modal = document.getElementById('modalMateriDetail');
  if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

/**
 * Versi ringkas dari gambar*User() (lihat menu "Buat Diagram") khusus untuk
 * menggambar SATU contoh diagram statis di modal Detail Materi — batang,
 * garis, atau lingkaran, tergantung `cfg.tipe`.
 */
function gambarDiagramContoh(canvas, legendEl, cfg) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const data = cfg.data;

  if (cfg.tipe === 'lingkaran') {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 34;
    let mulai = -Math.PI / 2;
    legendEl.style.display = 'flex';
    legendEl.innerHTML = '';
    data.forEach((d, i) => {
      const pct = (d.value / total) * 100;
      const sudut = (d.value / total) * Math.PI * 2;
      const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, mulai, mulai + sudut);
      ctx.closePath();
      ctx.fillStyle = warna;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const tengah = mulai + sudut / 2;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      if (sudut > 0.28) ctx.fillText(Math.round(pct) + '%', cx + Math.cos(tengah) * r * 0.62, cy + Math.sin(tengah) * r * 0.62);
      mulai += sudut;

      const chip = document.createElement('div');
      chip.className = 'pie-legend-item';
      chip.innerHTML = `<span class="pie-swatch" style="background:${warna}"></span>${d.label} (${Math.round(pct)}%)`;
      legendEl.appendChild(chip);
    });
    return;
  }

  legendEl.style.display = 'none';
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padLeft = 50, padBot = 46, padTop = 20, padRight = 16;
  const chartW = W - padLeft - padRight, chartH = H - padBot - padTop;

  ctx.strokeStyle = 'rgba(15,33,56,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, H - padBot);
  ctx.lineTo(W - padRight, H - padBot);
  ctx.stroke();

  if (cfg.tipe === 'garis') {
    const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
    ctx.strokeStyle = '#1668d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padLeft + stepX * i, y = H - padBot - (d.value / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    data.forEach((d, i) => {
      const x = padLeft + stepX * i, y = H - padBot - (d.value / maxVal) * chartH;
      const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
      ctx.fillStyle = warna;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f2138'; ctx.font = '10px Nunito, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x, H - padBot + 16);
      ctx.fillStyle = warna; ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.fillText(d.value, x, y - 8);
    });
  } else {
    const gap = chartW / data.length, barW = Math.min(52, gap * 0.55);
    data.forEach((d, i) => {
      const x = padLeft + gap * i + (gap - barW) / 2;
      const barH = (d.value / maxVal) * chartH;
      const y = H - padBot - barH;
      const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
      ctx.fillStyle = warna;
      ctx.beginPath(); ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]); ctx.fill();
      ctx.fillStyle = '#0f2138'; ctx.font = '10px Nunito, sans-serif'; ctx.textAlign = 'center';
      const labelSingkat = d.label.length > 9 ? d.label.slice(0, 8) + '…' : d.label;
      ctx.fillText(labelSingkat, x + barW / 2, H - padBot + 16);
      ctx.fillStyle = warna; ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.fillText(d.value, x + barW / 2, y - 6);
    });
  }

  if (cfg.sumbuX || cfg.sumbuY) gambarJudulSumbu(ctx, W, H, padLeft, padBot, padTop, cfg.sumbuX, cfg.sumbuY);
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

  // Render stage HTML — hanya percakapan penuh Bu Rupi & Kak Deno (tanpa kotak definisi)
  const stage = document.getElementById('introStage');
  stage.innerHTML = `
    <div class="intro-char intro-char-left" style="opacity:${s.leftActive ? '1' : '0.45'}; transform:scale(${s.leftActive ? '1.02' : '0.97'})">
      <div class="stage-avatar">
        <div class="avatar-ring ring-blue">
          <img class="avatar-photo" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRyfI58dntiT4yS6yhSUskHVrmeSZhPBF5CRww509vWIZISFVNrMv6MWTg&s=10" alt="Bu Rupi" onerror="this.parentElement.innerHTML=''; this.parentElement.style.fontSize='2rem'; this.parentElement.style.display='flex'; this.parentElement.style.alignItems='center'; this.parentElement.style.justifyContent='center';">
        </div>
        <div class="avatar-name">Bu Rupi</div>
      </div>
      ${s.leftBubble ? `<div class="stage-bubble bubble-left show">${s.leftBubble}</div>` : ''}
    </div>

    <div class="intro-char intro-char-right" style="opacity:${!s.leftActive ? '1' : '0.45'}; transform:scale(${!s.leftActive ? '1.02' : '0.97'})">
      ${s.rightBubble ? `<div class="stage-bubble bubble-right show">${s.rightBubble}</div>` : ''}
      <div class="stage-avatar">
        <div class="avatar-ring ring-gold">
          <img class="avatar-photo" src="https://png.pngtree.com/png-vector/20241217/ourmid/pngtree-thoughtful-anime-boy-cartoon-character-clipart-png-image_14793656.png" alt="Kak Deno" onerror="this.parentElement.innerHTML='‍'; this.parentElement.style.fontSize='2rem'; this.parentElement.style.display='flex'; this.parentElement.style.alignItems='center'; this.parentElement.style.justifyContent='center';">
        </div>
        <div class="avatar-name">Kak Deno</div>
      </div>
    </div>
  `;

  // Nav buttons
  document.getElementById('introBtnPrev').disabled = state.introSceneIndex === 0;
  const btnNext = document.getElementById('introBtnNext');
  if (state.introSceneIndex === total - 1) {
    btnNext.textContent = ' Mulai Belajar!';
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
  showToast(` Selamat datang, ${state.user.nama}! Selamat belajar di DENOMATH!`, 'success');
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
  for (let i = 1; i <= 8; i++) {
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

  // Animasi batang KB1 saat tab Big Idea dibuka
  if (kb === 1 && tabNum === 1) {
    setTimeout(animasiBatangKB1, 300);
  }
}

/* ──────────────────────────────────────────────
   GATING SINTAKS — murid wajib mengerjakan &
   menyelesaikan satu sintaks sebelum lanjut ke
   sintaks berikutnya (tidak bisa loncat tab).
────────────────────────────────────────────── */

/** Mengecek apakah semua isian wajib pada satu tab sintaks sudah terisi. */
function cblValidateTab(kb, tabNum) {
  const content = document.getElementById(`cblContent${kb}-${tabNum}`);
  if (!content) return true;
  const fields = content.querySelectorAll('.jawaban-input, .refleksi-input, .cell-input:not(.optional-input)');
  for (const f of fields) {
    if (!f.value || !String(f.value).trim()) return false;
  }
  return true;
}

/** Dipanggil oleh tombol "Lanjut" pada tiap sintaks. */
function cblLanjut(kb, fromTab, toTab) {
  if (!cblValidateTab(kb, fromTab)) {
    showToast(' Lengkapi dulu semua isian pada sintaks ini sebelum lanjut ke sintaks berikutnya!', 'warn');
    const content = document.getElementById(`cblContent${kb}-${fromTab}`);
    const empty = content?.querySelector('.jawaban-input:placeholder-shown, .refleksi-input:placeholder-shown, .cell-input:not(.optional-input):placeholder-shown');
    (empty || content?.querySelector('.jawaban-input, .refleksi-input, .cell-input:not(.optional-input)'))?.focus();
    return;
  }
  if (toTab > state.cblUnlocked[kb]) state.cblUnlocked[kb] = toTab;
  updateCBLTabLocks(kb);
  gantiCBLTab(kb, toTab);

  // Sintaks yang baru saja diselesaikan (fromTab) langsung dikoreksi AI.
  const sintaksSelesai = Object.keys(CBL_SINTAKS[kb]).find(k => CBL_SINTAKS[kb][k].tab === fromTab);
  if (sintaksSelesai) {
    clearTimeout(state.skorKBTimer[`${kb}-${sintaksSelesai}`]);
    koreksiSintaksAI(kb, sintaksSelesai); // async, tidak perlu ditunggu
  }
  kirimProgresKB(); // rekap realtime setiap satu sintaks selesai
}

/** Dipanggil saat murid klik langsung salah satu tab sintaks. */
function cblTabClick(kb, tabNum) {
  if (tabNum > state.cblUnlocked[kb]) {
    showToast(' Selesaikan sintaks sebelumnya secara berurutan dulu ya!', 'warn');
    const btn = document.getElementById(`cblTab${kb}-${tabNum}`);
    if (btn) { btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 500); }
    return;
  }
  gantiCBLTab(kb, tabNum);
}

/** Memberi tampilan terkunci pada tab-tab sintaks yang belum boleh diakses. */
function updateCBLTabLocks(kb) {
  for (let i = 1; i <= 8; i++) {
    const btn = document.getElementById(`cblTab${kb}-${i}`);
    if (!btn) continue;
    btn.classList.toggle('cbl-tab-locked', i > state.cblUnlocked[kb]);
  }
}

/* ──────────────────────────────────────────────
   GUIDING ACTIVITY KB1 — TURUS (TALLY) BUILDER
   Turus dibangun murid sendiri lewat tombol "+ Turus" /
   "−" (bukan diketik langsung ke kolom Frekuensi), supaya
   murid benar-benar berlatih menghitung data satu per satu
   dengan turus. Frekuensi otomatis mengikuti jumlah turus.
────────────────────────────────────────────── */
const turusGA = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

function renderTurusMarkupGA(n) {
  if (n <= 0) return '<span class="ga-turus-kosong">Belum ada turus</span>';
  const grp = Math.floor(n / 5);
  const sisa = n % 5;
  let html = '<span class="turus-row">';
  for (let i = 0; i < grp; i++) html += '<span class="turus-grp"></span>';
  if (sisa > 0) html += `<span class="turus-sisa">${'|'.repeat(sisa)}</span>`;
  html += '</span>';
  return html;
}

function updateTurusGA(nilai) {
  const n = turusGA[nilai] || 0;
  const disp = document.getElementById('turusDisplayA' + nilai);
  if (disp) disp.innerHTML = renderTurusMarkupGA(n);
  const inp = document.getElementById('freqA' + nilai);
  if (inp) inp.value = n > 0 ? n : '';
}

function tambahTurusGA(nilai) {
  turusGA[nilai] = (turusGA[nilai] || 0) + 1;
  updateTurusGA(nilai);
}

function kurangTurusGA(nilai) {
  if (!turusGA[nilai]) return;
  turusGA[nilai] = Math.max(0, turusGA[nilai] - 1);
  updateTurusGA(nilai);
}

/* ──────────────────────────────────────────────
   GUIDING ACTIVITY KB1 — BUAT DIAGRAM (Langkah 2)
   Diagram batang dibuat otomatis dari data tabel
   turus & frekuensi (freqA1..freqA5) di Langkah 1,
   dipadukan dengan judul/sumbu isian murid —
   murid menginput data dulu, baru diagramnya jadi.
────────────────────────────────────────────── */
function buatDiagramGA() {
  const nilaiList = [1, 2, 3, 4, 5];
  const data = nilaiList.map(n => {
    const raw = document.getElementById('freqA' + n).value;
    return { label: 'Rp' + n + 'rb', value: raw === '' ? NaN : parseFloat(raw) };
  });

  if (data.some(d => isNaN(d.value))) {
    showToast(' Lengkapi dulu tabel turus & frekuensi di Langkah 1!', 'warn');
    return;
  }

  const judul = document.getElementById('kb1gaJudul').value.trim();
  const sumbuX = document.getElementById('kb1gaSumbuX').value.trim();
  const sumbuY = document.getElementById('kb1gaSumbuY').value.trim();

  if (!judul || !sumbuX || !sumbuY) {
    showToast(' Isi dulu judul dan nama sumbu diagram!', 'warn');
    return;
  }

  document.getElementById('kb1gaOutputJudul').textContent = judul;
  document.getElementById('kb1gaOutputInfo').textContent = `Sumbu X: ${sumbuX}  •  Sumbu Y: ${sumbuY}`;
  document.getElementById('kb1gaOutputCard').style.display = 'block';

  gambarDiagramGA(data, sumbuX, sumbuY);

  // Simpan rangkuman isian ke field kb1ga2 (tersembunyi) supaya tetap bisa
  // dikoreksi AI seperti sintaks lain, dan tandai sintaks ini "terisi".
  document.getElementById('kb1ga2').value =
    `Judul diagram: ${judul}. Sumbu horizontal: ${sumbuX}. Sumbu vertikal: ${sumbuY}. ` +
    `Data frekuensi: ${data.map(d => `${d.label}=${d.value}`).join(', ')}.`;

  const info = CBL_FIELD_TO_SINTAKS['kb1ga2'];
  if (info) jadwalkanKoreksiAI(info.kb, info.sintaks);

  document.getElementById('kb1gaOutputCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(' Diagram berhasil dibuat!', 'success');
}

/* ──────────────────────────────────────────────
   ASESMEN KB1 — BUAT DIAGRAM (pertanyaan b)
   Diagram batang harga komoditas hasil kebun
   setelah redenominasi, dibuat murid dari 5 isian
   harga — sama pola dengan buatDiagramGA di atas,
   hanya tanpa langkah tabel turus/frekuensi.
────────────────────────────────────────────── */
function buatDiagramAsesmen1() {
  const komoditas = [
    { id: 'kb1asHarga1', label: 'Cabai' },
    { id: 'kb1asHarga2', label: 'Wortel' },
    { id: 'kb1asHarga3', label: 'Tomat' },
    { id: 'kb1asHarga4', label: 'Ubi' },
    { id: 'kb1asHarga5', label: 'Kentang' },
  ];
  const data = komoditas.map(k => {
    const raw = document.getElementById(k.id).value;
    return { label: k.label, value: raw === '' ? NaN : parseFloat(raw) };
  });

  if (data.some(d => isNaN(d.value))) {
    showToast(' Lengkapi dulu harga kelima komoditas setelah redenominasi!', 'warn');
    return;
  }

  document.getElementById('kb1asOutputCard').style.display = 'block';
  gambarDiagramAsesmen1(data);

  // Simpan rangkuman isian ke field tersembunyi kb1as2diagram supaya ikut
  // dikoreksi AI bersama uraian di kb1as2 (lihat CBL_SINTAKS[1].asesmen).
  document.getElementById('kb1as2diagram').value =
    `Diagram batang harga komoditas setelah redenominasi: ${data.map(d => `${d.label}=Rp${d.value}`).join(', ')}.`;

  const info = CBL_FIELD_TO_SINTAKS['kb1as2diagram'];
  if (info) jadwalkanKoreksiAI(info.kb, info.sintaks);

  document.getElementById('kb1asOutputCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(' Diagram berhasil dibuat!', 'success');
}

function gambarDiagramAsesmen1(data) {
  const canvas = document.getElementById('kb1asCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padLeft = 56, padBot = 46, padTop = 20, padRight = 20;
  const chartW = W - padLeft - padRight;
  const chartH = H - padBot - padTop;
  const gap = chartW / data.length;
  const barW = Math.min(56, gap * 0.55);

  ctx.strokeStyle = 'rgba(15,33,56,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, H - padBot);
  ctx.lineTo(W - padRight, H - padBot);
  ctx.stroke();

  data.forEach((d, i) => {
    const x = padLeft + gap * i + (gap - barW) / 2;
    const barH = maxVal > 0 ? (d.value / maxVal) * chartH : 0;
    const y = H - padBot - barH;
    const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
    ctx.fillStyle = warna;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#0f2138';
    ctx.font = '11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, H - padBot + 18);

    ctx.fillStyle = warna;
    ctx.font = 'bold 12px Nunito, sans-serif';
    ctx.fillText('Rp' + d.value, x + barW / 2, y - 6);
  });

  gambarJudulSumbu(ctx, W, H, padLeft, padBot, padTop, 'Komoditas', 'Harga (Rp/kg)');
}

function gambarDiagramGA(data, sumbuX, sumbuY) {
  const canvas = document.getElementById('kb1gaCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padLeft = 56, padBot = 46, padTop = 20, padRight = 20;
  const chartW = W - padLeft - padRight;
  const chartH = H - padBot - padTop;
  const gap = chartW / data.length;
  const barW = Math.min(56, gap * 0.55);

  ctx.strokeStyle = 'rgba(15,33,56,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, H - padBot);
  ctx.lineTo(W - padRight, H - padBot);
  ctx.stroke();

  data.forEach((d, i) => {
    const x = padLeft + gap * i + (gap - barW) / 2;
    const barH = maxVal > 0 ? (d.value / maxVal) * chartH : 0;
    const y = H - padBot - barH;
    const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
    ctx.fillStyle = warna;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#0f2138';
    ctx.font = '11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, H - padBot + 18);

    ctx.fillStyle = warna;
    ctx.font = 'bold 12px Nunito, sans-serif';
    ctx.fillText(String(d.value), x + barW / 2, y - 6);
  });

  gambarJudulSumbu(ctx, W, H, padLeft, padBot, padTop, sumbuX, sumbuY);
}

/* ──────────────────────────────────────────────
   KEGIATAN BELAJAR – MODAL
────────────────────────────────────────────── */
function bukaKB(nomor) {
  const modal = document.getElementById(`modalKB${nomor}`);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateCBLTabLocks(nomor);
    if (nomor === 1) setTimeout(animasiBatangKB1, 300);
  }
}

function tutupModal(nomor) {
  const modal = document.getElementById(`modalKB${nomor}`);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ──────────────────────────────────────────────
   MODAL BIODATA (profil siswa)
────────────────────────────────────────────── */
function bukaBiodataModal() {
  const tipe = state.user.tipe || 'individu';
  const namaLabelEl = document.getElementById('biodataNamaLabel');
  const absenRowEl = document.getElementById('biodataAbsenRow');
  const anggotaRowEl = document.getElementById('biodataAnggotaRow');
  if (namaLabelEl) namaLabelEl.textContent = tipe === 'kelompok' ? 'Nama Kelompok' : 'Nama Lengkap';
  document.getElementById('biodataNama').textContent = state.user.nama || '–';
  document.getElementById('biodataKelas').textContent = state.user.kelas || '–';

  if (tipe === 'kelompok') {
    // Kelompok tidak lagi punya No. Kelompok — tampilkan daftar anggota.
    if (absenRowEl) absenRowEl.style.display = 'none';
    if (anggotaRowEl) {
      anggotaRowEl.style.display = 'flex';
      document.getElementById('biodataAnggota').textContent = state.user.anggota || '–';
    }
  } else {
    if (absenRowEl) absenRowEl.style.display = 'flex';
    if (anggotaRowEl) anggotaRowEl.style.display = 'none';
    document.getElementById('biodataAbsen').textContent = state.user.absen || '–';
  }

  document.getElementById('biodataKB1').textContent = state.kbSelesai[0] ? 'Selesai' : 'Belum selesai';
  document.getElementById('biodataKB2').textContent = state.kbSelesai[1] ? 'Selesai' : 'Belum selesai';
  document.getElementById('biodataEval').textContent = state.evalSelesai
    ? `${state.evalNilai} (${state.evalGradeLabel})`
    : 'Belum dikerjakan';

  const modal = document.getElementById('modalBiodata');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function tutupBiodataModal() {
  const modal = document.getElementById('modalBiodata');
  modal.classList.remove('active');
  document.body.style.overflow = '';
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
    const label = b.dataset.label;
    setTimeout(() => { b.style.height = target + 'px'; }, i * 200);
    b.onclick = () => {
      showToast(` ${label}: Rp ${target} (baru) | Rp ${target * 1000} (lama)`, 'info');
    };
  });
}

/* ──────────────────────────────────────────────
   KB 2 – Diagram Batang / Lingkaran (Challenge: data
   pengeluaran jajan kantin Raka — Nasi, Minuman, Roti,
   Gorengan, Snack, Buah)
────────────────────────────────────────────── */
const KB2_LABELS = ['Nasi', 'Minuman', 'Roti', 'Gorengan', 'Snack', 'Buah'];
const KB2_WARNA  = ['#4a9eff', '#a855f7', '#22c55e', '#f5c518', '#f97316', '#e0529c'];

function pilihTipeDiagramKB2(tipe) {
  state.kb2DiagTipe = tipe;
  const btnBatang = document.getElementById('btnDiagBatang');
  const btnLingkaran = document.getElementById('btnDiagLingkaran');
  if (btnBatang) btnBatang.classList.toggle('active', tipe === 'batang');
  if (btnLingkaran) btnLingkaran.classList.toggle('active', tipe === 'lingkaran');
}

function buatDiagramKB2() {
  const ids = ['kb2h1', 'kb2h2', 'kb2h3', 'kb2h4', 'kb2h5', 'kb2h6'];
  const values = ids.map(id => parseFloat(document.getElementById(id).value) || 0);

  if (values.every(v => v === 0)) { showToast(' Isi minimal satu nilai pendapatan dulu!', 'warn'); return; }

  const canvas = document.getElementById('canvasKB2');
  canvas.style.display = 'block';
  const legendEl = document.getElementById('legendKB2');

  if (state.kb2DiagTipe === 'lingkaran') {
    gambarPieKB2(canvas, legendEl, KB2_LABELS, values, KB2_WARNA);
    showToast(' Diagram lingkaran berhasil dibuat!', 'success');
  } else {
    if (legendEl) legendEl.innerHTML = '';
    gambarBatangKB2(canvas, KB2_LABELS, values, KB2_WARNA);
    showToast(' Diagram batang berhasil dibuat!', 'success');
  }
}

function gambarBatangKB2(canvas, labels, values, warna) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...values, 1);
  const barW = 54, gap = (W - 60 - labels.length * barW) / (labels.length + 1);
  const padBot = 40, padTop = 20;
  const chartH = H - padBot - padTop;

  let progress = 0;
  function draw(prog) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(15,33,56,0.25)';
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
      ctx.fillStyle = '#0f2138';
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
}

/**
 * Menggambar diagram lingkaran generik (dipakai oleh KB2 Challenge & KB2
 * Guiding Activity) — tiap juring diberi label persen + derajat, dan
 * legend warna ditulis ke elemen `legendEl` (opsional).
 */
function gambarPieKB2(canvas, legendEl, labels, values, warna) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 30;

  let mulai = -Math.PI / 2;
  const sektor = values.map((v, i) => {
    const pct = (v / total) * 100;
    const sudut = (v / total) * Math.PI * 2;
    const info = { label: labels[i], pct, derajat: (v / total) * 360, awal: mulai, akhir: mulai + sudut, tengah: mulai + sudut / 2, warna: warna[i % warna.length] };
    mulai += sudut;
    return info;
  });

  sektor.forEach(s => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, s.awal, s.akhir);
    ctx.closePath();
    ctx.fillStyle = s.warna;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  sektor.forEach(s => {
    if (s.pct <= 0) return;
    const pctLabel = `${s.pct.toFixed(1)}%`;
    const cosT = Math.cos(s.tengah), sinT = Math.sin(s.tengah);
    if (s.pct >= 7) {
      const lx = cx + cosT * r * 0.62, ly = cy + sinT * r * 0.62;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,33,56,0.55)';
      ctx.strokeText(pctLabel, lx, ly);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(pctLabel, lx, ly);
    } else {
      const p1 = { x: cx + cosT * r, y: cy + sinT * r };
      const p2 = { x: cx + cosT * (r + 12), y: cy + sinT * (r + 12) };
      const rataTeks = cosT >= 0 ? 'left' : 'right';
      const p3x = p2.x + (cosT >= 0 ? 14 : -14);
      ctx.strokeStyle = s.warna; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3x, p2.y); ctx.stroke();
      ctx.textAlign = rataTeks; ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#0f2138';
      ctx.fillText(pctLabel, p3x + (cosT >= 0 ? 3 : -3), p2.y);
    }
  });

  if (legendEl) {
    legendEl.innerHTML = sektor.map(s =>
      `<div class="pie-legend-item"><span class="pie-swatch" style="background:${s.warna}"></span>${s.label} — ${s.pct.toFixed(1)}% (${Math.round(s.derajat)}°)</div>`
    ).join('');
  }
}

/* ──────────────────────────────────────────────
   KB 2 – Guiding Activity: Diagram Lingkaran Dana
   Investasi Saham (BBRI, BBCA, BBNI, TLKM, BRIS)
────────────────────────────────────────────── */
function buatDiagramAsetKB2() {
  const ids = ['kb2gaAset1', 'kb2gaAset2', 'kb2gaAset3', 'kb2gaAset4', 'kb2gaAset5'];
  const labels = ['BBRI', 'BBCA', 'BBNI', 'TLKM', 'BRIS'];
  const warna = ['#4a9eff', '#f5c518', '#22c55e', '#a855f7', '#f97316'];
  const values = ids.map(id => parseFloat(document.getElementById(id).value) || 0);

  if (values.every(v => v === 0)) {
    showToast(' Isi dulu nilai kelima aset setelah redenominasi!', 'warn');
    return;
  }

  const canvas = document.getElementById('canvasKB2GA');
  canvas.style.display = 'block';
  const legendEl = document.getElementById('legendKB2GA');
  gambarPieKB2(canvas, legendEl, labels, values, warna);
  showToast(' Diagram lingkaran aset berhasil dibuat!', 'success');
}

/* ──────────────────────────────────────────────
   KB 2 – Asesmen: Diagram Lingkaran Harga Lauk
   Rumah Makan Padang (Rendang, Ayam Goreng, Ayam
   Bakar, Telur Dadar Padang, Telur Balado)
────────────────────────────────────────────── */
function buatDiagramAsesmenKB2() {
  const ids = ['kb2asH1', 'kb2asH2', 'kb2asH3', 'kb2asH4', 'kb2asH5'];
  const labels = ['Rendang', 'Ayam goreng', 'Ayam bakar', 'Telur dadar padang', 'Telur balado'];
  const warna = ['#4a9eff', '#f5c518', '#22c55e', '#a855f7', '#f97316'];
  const values = ids.map(id => parseFloat(document.getElementById(id).value) || 0);

  if (values.every(v => v === 0)) {
    showToast(' Isi dulu harga kelima lauk!', 'warn');
    return;
  }

  const canvas = document.getElementById('canvasKB2AS');
  canvas.style.display = 'block';
  const legendEl = document.getElementById('legendKB2AS');
  gambarPieKB2(canvas, legendEl, labels, values, warna);
  showToast(' Diagram lingkaran harga lauk berhasil dibuat!', 'success');
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
  document.getElementById('diagTypeBtnGaris').classList.toggle('active', tipe === 'garis');
  document.getElementById('diagTypeBtnLingkaran').classList.toggle('active', tipe === 'lingkaran');
  // Sumbu X/Y hanya relevan untuk diagram batang & garis, diagram lingkaran tidak punya sumbu
  const sumbuWrap = document.getElementById('diagSumbuWrap');
  if (sumbuWrap) sumbuWrap.style.display = (tipe === 'lingkaran') ? 'none' : 'flex';
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
    showToast(' Minimal harus ada 2 kategori data!', 'warn');
    return;
  }
  btn.closest('.diagram-row').remove();
}

function resetDiagramBuilder() {
  const wrap = document.getElementById('diagramRows');
  wrap.innerHTML = '';
  for (let i = 0; i < 3; i++) tambahBarisDiagram();
  document.getElementById('diagJudul').value = '';
  document.getElementById('diagSumbuX').value = '';
  document.getElementById('diagSumbuY').value = '';
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
    showToast(' Isi minimal 2 kategori dengan nama & nilai yang valid!', 'warn');
    return;
  }

  const judul = document.getElementById('diagJudul').value.trim();
  document.getElementById('diagramOutputTitle').textContent = judul || 'Hasil Diagram';
  document.getElementById('diagramOutputCard').style.display = 'block';

  const sumbuX = document.getElementById('diagSumbuX').value.trim() || 'Kategori';
  const sumbuY = document.getElementById('diagSumbuY').value.trim() || 'Nilai';
  const infoEl = document.getElementById('diagramSumbuInfo');
  if (infoEl) {
    if (state.diagTipe === 'lingkaran') {
      infoEl.style.display = 'none';
    } else {
      infoEl.style.display = 'block';
      infoEl.textContent = `Sumbu X: ${sumbuX}  •  Sumbu Y: ${sumbuY}`;
    }
  }

  if (state.diagTipe === 'batang') {
    gambarDiagramBatangUser(data, sumbuX, sumbuY);
  } else if (state.diagTipe === 'garis') {
    gambarDiagramGarisUser(data, sumbuX, sumbuY);
  } else {
    gambarDiagramLingkaranUser(data);
  }

  document.getElementById('diagramOutputCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(' Diagram berhasil dibuat!', 'success');
}

// Menggambar judul sumbu X (horizontal, di bawah label kategori) dan
// sumbu Y (vertikal, diputar 90°, di sisi kiri) pada diagram batang/garis.
function gambarJudulSumbu(ctx, W, H, padLeft, padBot, padTop, sumbuX, sumbuY) {
  ctx.fillStyle = '#0f2138';
  ctx.font = 'bold 12px Nunito, sans-serif';

  // Sumbu X: teks horizontal di bawah, rata tengah area chart
  ctx.textAlign = 'center';
  ctx.fillText(sumbuX, padLeft + (W - padLeft) / 2, H - 8);

  // Sumbu Y: teks vertikal (diputar) di tepi kiri
  ctx.save();
  ctx.translate(14, padTop + (H - padBot - padTop) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(sumbuY, 0, 0);
  ctx.restore();
}

function gambarDiagramBatangUser(data, sumbuX, sumbuY) {
  const legendEl = document.getElementById('diagramPieLegend');
  legendEl.style.display = 'none';
  legendEl.innerHTML = '';

  const canvas = document.getElementById('diagramCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padLeft = 56, padBot = 62, padTop = 24, padRight = 20;
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

    gambarJudulSumbu(ctx, W, H, padLeft, padBot, padTop, sumbuX, sumbuY);
  }

  function animate() {
    progress += 0.05;
    if (progress >= 1) { progress = 1; draw(1); return; }
    draw(progress);
    requestAnimationFrame(animate);
  }
  animate();
}

// Diagram Garis — cocok untuk menunjukkan tren/perubahan nilai secara berurutan.
function gambarDiagramGarisUser(data, sumbuX, sumbuY) {
  const legendEl = document.getElementById('diagramPieLegend');
  legendEl.style.display = 'none';
  legendEl.innerHTML = '';

  const canvas = document.getElementById('diagramCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padLeft = 56, padBot = 62, padTop = 24, padRight = 20;
  const chartW = W - padLeft - padRight;
  const chartH = H - padBot - padTop;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
  const warnaGaris = '#1668d4';

  let progress = 0;
  function titik(i, prog) {
    const x = padLeft + stepX * i;
    const y = H - padBot - (data[i].value / maxVal) * chartH * prog;
    return { x, y };
  }

  function draw(prog) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(15,33,56,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, H - padBot);
    ctx.lineTo(W - padRight, H - padBot);
    ctx.stroke();

    // Garis penghubung antar titik data
    ctx.strokeStyle = warnaGaris;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      const p = titik(i, prog);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Titik data + label kategori & nilai
    data.forEach((d, i) => {
      const p = titik(i, prog);
      const warna = DIAGRAM_WARNA[i % DIAGRAM_WARNA.length];
      ctx.fillStyle = warna;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0f2138';
      ctx.font = '11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      const labelSingkat = d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label;
      ctx.fillText(labelSingkat, p.x, H - padBot + 18);

      if (prog === 1) {
        ctx.fillStyle = warna;
        ctx.font = 'bold 12px Nunito, sans-serif';
        ctx.fillText(d.value, p.x, p.y - 10);
      }
    });

    gambarJudulSumbu(ctx, W, H, padLeft, padBot, padTop, sumbuX, sumbuY);
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
  const cx = W / 2, cy = H / 2;
  // Radius sedikit lebih kecil dari sebelumnya agar tersisa ruang
  // untuk label persen/derajat yang berada di luar sektor-sektor kecil.
  const r = Math.min(W, H) / 2 - 46;

  // Hitung sudut & persentase tiap sektor lebih dulu (dipakai untuk
  // menggambar sektornya sekaligus menulis label persen/derajatnya).
  let sudutMulai = -Math.PI / 2;
  const sektor = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const sudut = (d.value / total) * Math.PI * 2;
    const info = {
      label: d.label,
      pct,
      derajat: (d.value / total) * 360,
      awal: sudutMulai,
      akhir: sudutMulai + sudut,
      tengah: sudutMulai + sudut / 2,
      warna: DIAGRAM_WARNA[i % DIAGRAM_WARNA.length],
    };
    sudutMulai += sudut;
    return info;
  });

  // 1) Gambar tiap sektor lingkaran
  sektor.forEach(s => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, s.awal, s.akhir);
    ctx.closePath();
    ctx.fillStyle = s.warna;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 2) Pertegas nilai persen & derajat tiap sektor.
  // Sektor yang cukup besar diberi label di dalamnya (persen + derajat);
  // sektor yang kecil diberi label di LUAR lingkaran dengan garis
  // penunjuk, supaya angkanya tetap jelas terbaca dan tidak berhimpitan.
  sektor.forEach(s => {
    const pctLabel = `${s.pct.toFixed(1)}%`;
    const derajatLabel = `${Math.round(s.derajat)}°`;
    const cosT = Math.cos(s.tengah), sinT = Math.sin(s.tengah);

    if (s.pct >= 7) {
      const lx = cx + cosT * r * 0.62;
      const ly = cy + sinT * r * 0.62;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';

      ctx.font = 'bold 13px "Space Grotesk", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(15,33,56,0.55)';
      ctx.strokeText(pctLabel, lx, ly - 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(pctLabel, lx, ly - 7);

      ctx.font = '600 11px "Space Grotesk", sans-serif';
      ctx.lineWidth = 2.5;
      ctx.strokeText(derajatLabel, lx, ly + 9);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(derajatLabel, lx, ly + 9);
    } else {
      const p1 = { x: cx + cosT * r, y: cy + sinT * r };
      const p2 = { x: cx + cosT * (r + 14), y: cy + sinT * (r + 14) };
      const rataTeks = cosT >= 0 ? 'left' : 'right';
      const p3x = p2.x + (cosT >= 0 ? 16 : -16);

      ctx.strokeStyle = s.warna;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3x, p2.y);
      ctx.stroke();

      ctx.textAlign = rataTeks;
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#0f2138';
      ctx.fillText(pctLabel, p3x + (cosT >= 0 ? 3 : -3), p2.y - 6);
      ctx.font = '600 10px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(15,33,56,0.68)';
      ctx.fillText(derajatLabel, p3x + (cosT >= 0 ? 3 : -3), p2.y + 6);
    }
  });

  // Legend persentase + derajat
  const legendEl = document.getElementById('diagramPieLegend');
  legendEl.style.display = 'flex';
  legendEl.innerHTML = sektor.map(s => {
    return `<div class="pie-legend-item"><span class="pie-swatch" style="background:${s.warna}"></span>${s.label} — ${s.pct.toFixed(1)}% (${Math.round(s.derajat)}°)</div>`;
  }).join('');
}

function unduhDiagram() {
  const canvas = document.getElementById('diagramCanvas');
  try {
    // Kanvas aslinya transparan (hanya bentuk yang digambar, tanpa latar).
    // PNG dengan transparansi itu sering tampil dengan latar HITAM pekat
    // saat dibuka di aplikasi/viewer yang mode gelapnya default (mis. galeri
    // HP tertentu, WhatsApp, dsb) — sehingga label & garis diagram jadi
    // tidak terbaca. Untuk mengunduh, gambar dulu diagramnya di atas kanvas
    // sementara berlatar PUTIH, baru kanvas sementara itu yang diunduh —
    // kanvas asli yang tampil di layar tidak diubah sama sekali.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = 'diagram-denomath.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast('⬇ Diagram berhasil diunduh!', 'success');
  } catch (err) {
    console.error('Gagal mengunduh diagram:', err);
    showToast(' Gagal mengunduh diagram', 'warn');
  }
}

/* ──────────────────────────────────────────────
   SELESAIKAN KB
────────────────────────────────────────────── */
async function selesaikanKB(nomor) {
  // Pastikan sintaks Asesmen (Publikasi & Soal Penutup) sudah diisi lengkap
  if (!cblValidateTab(nomor, 8)) {
    showToast(' Lengkapi dulu semua isian pada Asesmen sebelum menyelesaikan KB ini!', 'warn');
    gantiCBLTab(nomor, 8);
    const content = document.getElementById(`cblContent${nomor}-8`);
    const empty = content?.querySelector('.jawaban-input:placeholder-shown, .cell-input:not(.optional-input):placeholder-shown');
    (empty || content?.querySelector('.jawaban-input'))?.focus();
    return;
  }

  state.kbSelesai[nomor - 1] = true;
  updateKBCard(nomor);
  updateProgressUI();
  tutupModal(nomor);

  // Tampilkan modal "menghitung skor" sambil AI menilai semua sintaks yang
  // belum sempat dikoreksi (mis. karena murid tidak sempat blur di kolom
  // terakhir), sehingga skor akhir 1-100 langsung muncul begitu KB selesai.
  tampilkanSkorAkhirLoading(nomor);
  await pastikanSemuaSkorKB(nomor);
  await kirimProgresKB();
  tampilkanSkorAkhir(nomor);

  if (state.kbSelesai.every(Boolean)) {
    setTimeout(tampilkanSelamat, 600);
  } else {
    const pesanNext = nomor < 2 ? ` KB ${nomor + 1} sekarang terbuka!` : '';
    showToast(` KB ${nomor} selesai!${pesanNext}`, 'success');
  }
}

/**
 * Pastikan KELIMA sintaks (Essential Question, Challenge, Guiding Question,
 * Guiding Activity, Asesmen) pada satu KB sudah punya skor AI, dengan
 * mengoreksi ulang (atau untuk pertama kali) sintaks mana pun yang masih
 * kosong. Dijalankan berurutan (bukan paralel) supaya tidak membebani
 * server AI dengan banyak permintaan sekaligus.
 */
async function pastikanSemuaSkorKB(nomor) {
  const urutan = ['essentialQ', 'challenge', 'guidingQuestion', 'guidingActivity', 'asesmen'];
  for (const sintaksKey of urutan) {
    const jawaban = kumpulkanJawabanSintaks(nomor, sintaksKey);
    const adaIsi = Object.values(jawaban).some(x => x && String(x).trim());
    if (!adaIsi) continue; // sintaks memang tidak diisi (seharusnya tidak terjadi karena sudah divalidasi)
    if (typeof state.skorKB[nomor][sintaksKey] !== 'number') {
      await koreksiSintaksAI(nomor, sintaksKey);
    }
  }
}

function updateKBCard(nomor) {
  const card = document.getElementById(`kb${nomor}card`);
  const status = document.getElementById(`kb${nomor}status`);
  if (card) card.classList.add('done');
  if (status) status.textContent = ' Selesai';
  if (nomor === 1) {
    const nextCard = document.getElementById('kb2card');
    const nextStatus = document.getElementById('kb2status');
    if (nextCard) nextCard.classList.remove('locked');
    if (nextStatus) nextStatus.textContent = ' Mulai';
  }
}

function updateProgressUI() {
  const selesai = state.kbSelesai.filter(Boolean).length;
  const pct = (selesai / 2) * 100;
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = `${selesai} / 2 KB selesai`;
}

/* ──────────────────────────────────────────────
   MODAL SKOR AKHIR KB — muncul otomatis begitu murid
   klik "Selesaikan KB", berisi nilai gabungan 1-100
   dari semua aktivitas (Essential Q, Challenge, Guiding
   Question, Guiding Activity, Asesmen) plus rincian tiap
   bagian, supaya murid langsung tahu hasilnya.
────────────────────────────────────────────── */
const SINTAKS_LABEL_UI = {
  essentialQ: 'Essential Question', challenge: 'Challenge',
  guidingQuestion: 'Guiding Question', guidingActivity: 'Guiding Activity',
  asesmen: 'Asesmen',
};

function tampilkanSkorAkhirLoading(nomor) {
  const modal = document.getElementById('modalSkorAkhir');
  if (!modal) return;
  document.getElementById('skorAkhirKBBadge').textContent = `KB ${nomor}`;
  document.getElementById('skorAkhirBody').innerHTML =
    '<div class="skor-akhir-loading">🤖 AI sedang menghitung skor akhirmu dari semua aktivitas...</div>';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function tampilkanSkorAkhir(nomor) {
  const modal = document.getElementById('modalSkorAkhir');
  if (!modal) return;

  const s = kumpulkanSkorKB(nomor);
  const urutan = ['essentialQ', 'challenge', 'guidingQuestion', 'guidingActivity', 'asesmen'];
  const keyMap = { essentialQ: 'skor_eq', challenge: 'skor_challenge', guidingQuestion: 'skor_gq', guidingActivity: 'skor_ga', asesmen: 'skor_asesmen' };
  const nilai = typeof s.skor_total === 'number' ? s.skor_total : 0;

  let grade, gradeClass, pesan;
  if (nilai >= 90) { grade = 'A – Sangat Baik'; gradeClass = 'badge-gold'; pesan = 'Luar biasa! Kamu memahami semua aktivitas dengan sangat baik.'; }
  else if (nilai >= 70) { grade = 'B – Baik'; gradeClass = 'badge-blue'; pesan = 'Bagus! Sebagian besar jawabanmu sudah tepat dan lengkap.'; }
  else if (nilai >= 50) { grade = 'C – Cukup'; gradeClass = 'badge-yellow'; pesan = 'Cukup baik, tapi beberapa jawaban masih bisa dijelaskan lebih lengkap.'; }
  else { grade = 'D – Perlu Perbaikan'; gradeClass = 'badge-red'; pesan = 'Jangan menyerah! Coba lihat kembali catatan AI di tiap sintaks ya.'; }

  const rincianHtml = urutan.map(k => {
    const skorItem = state.skorKB[nomor][k];
    const adaSkor = typeof skorItem === 'number';
    let pillClass = 'skor-akhir-pill-kosong';
    if (adaSkor) {
      if (skorItem >= 80) pillClass = 'skor-akhir-pill-tinggi';
      else if (skorItem >= 50) pillClass = 'skor-akhir-pill-sedang';
      else pillClass = 'skor-akhir-pill-rendah';
    }
    return `
      <div class="skor-akhir-rincian-item">
        <span class="skor-akhir-rincian-label">${SINTAKS_LABEL_UI[k]}</span>
        <span class="skor-akhir-pill ${pillClass}">${adaSkor ? skorItem + '/100' : '–'}</span>
      </div>`;
  }).join('');

  document.getElementById('skorAkhirKBBadge').textContent = `KB ${nomor}`;
  document.getElementById('skorAkhirBody').innerHTML = `
    <div class="skor-akhir-circle ${gradeClass}">
      <span class="skor-akhir-angka">${nilai}</span>
      <span class="skor-akhir-maks">/100</span>
    </div>
    <div class="eval-grade-badge ${gradeClass}" style="margin:10px auto 4px">${grade}</div>
    <p class="skor-akhir-pesan">${pesan}</p>
    <div class="skor-akhir-rincian">${rincianHtml}</div>
    <p class="skor-akhir-ket">Skor akhir ini adalah rata-rata dari kelima aktivitas di atas dan sudah otomatis tersimpan di rekap gurumu.</p>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function tutupSkorAkhir() {
  const modal = document.getElementById('modalSkorAkhir');
  if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

/* ──────────────────────────────────────────────
   MODAL SELAMAT
────────────────────────────────────────────── */
function tampilkanSelamat() {
  const modal = document.getElementById('modalSelamat');
  if (!modal) return;
  document.getElementById('selamatNama').textContent = state.user.tipe === 'kelompok'
    ? `${state.user.nama} dari ${state.user.kelas}`
    : `${state.user.nama} dari ${state.user.kelas} – Absen ${state.user.absen}`;
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
  const emojis = ['','','','','','','',''];
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
   ALAT BANTU — Tab switcher (Kalkulator <-> Buat Diagram)
   Kedua fitur ini sekarang digabung dalam satu menu/page,
   dipisahkan lewat tab supaya tetap rapi & mudah diakses.
────────────────────────────────────────────── */
function setAlatBantuTab(tab) {
  const btnKalkulator = document.getElementById('tabBtnKalkulator');
  const btnDiagram = document.getElementById('tabBtnDiagram');
  const panelKalkulator = document.getElementById('tabKalkulator');
  const panelDiagram = document.getElementById('tabDiagram');
  if (!btnKalkulator || !btnDiagram || !panelKalkulator || !panelDiagram) return;

  const isKalkulator = tab === 'kalkulator';
  btnKalkulator.classList.toggle('active', isKalkulator);
  btnDiagram.classList.toggle('active', !isKalkulator);
  panelKalkulator.classList.toggle('active', isKalkulator);
  panelDiagram.classList.toggle('active', !isKalkulator);
}

/* ──────────────────────────────────────────────
   KALKULATOR REDENOMINASI
────────────────────────────────────────────── */
function setKalcMode(mode) {
  state.kalcMode = mode;
  document.getElementById('modeBtn1').classList.toggle('active', mode === 'lama-ke-baru');
  document.getElementById('modeBtn2').classList.toggle('active', mode === 'baru-ke-lama');
  const label = document.getElementById('kalcInputLabel');
  const hint = document.getElementById('kalcHint');
  const rlabel = document.getElementById('kalcResultLabel');
  if (mode === 'lama-ke-baru') {
    label.textContent = ' Masukkan Rupiah Lama';
    hint.textContent = 'Contoh: Rp 75.000 (lama) → Rp 75 (baru)';
    rlabel.textContent = 'Rupiah Baru';
  } else {
    label.textContent = ' Masukkan Rupiah Baru';
    hint.textContent = 'Contoh: Rp 75 (baru) → Rp 75.000 (lama)';
    rlabel.textContent = 'Rupiah Lama';
  }
  resetKalkulator();
}

function hitungKalkulator() {
  const inputVal = parseFloat(document.getElementById('kalcInput').value);
  const result = document.getElementById('kalcResult');
  const nilaiEl = document.getElementById('kalcResultNilai');
  const noteEl = document.getElementById('kalcResultNote');
  if (!inputVal || isNaN(inputVal) || inputVal <= 0) { result.style.display = 'none'; return; }
  let hasil, note;
  if (state.kalcMode === 'lama-ke-baru') {
    hasil = inputVal / 1000;
    note = `Rp ${formatRupiah(inputVal)} (lama) dibagi 1.000`;
  } else {
    hasil = inputVal * 1000;
    note = `Rp ${formatRupiah(inputVal)} (baru) dikali 1.000`;
  }
  nilaiEl.textContent = 'Rp ' + formatRupiah(hasil);
  noteEl.textContent = note;
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

  document.getElementById('evalStart').style.display = 'none';
  document.getElementById('evalQuiz').style.display = 'block';
  document.getElementById('evalResult').style.display = 'none';
  document.getElementById('evalPembahasan').style.display = 'none';

  tampilkanSoal();
}

function tampilkanSoal() {
  const idx = state.evalSoalOrder[state.evalSoalIndex];
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
  const idx = state.evalSoalOrder[state.evalSoalIndex];
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
  document.getElementById('evalQuiz').style.display = 'none';
  document.getElementById('evalResult').style.display = 'block';

  const skor = state.evalSkor;
  const total = bankSoal.length;
  const pct = (skor / total) * 100;

  document.getElementById('evalProgressFill').style.width = '100%';
  document.getElementById('evalScoreNum').textContent = skor;

  let judul, icon, grade, gradeClass, msg;
  if (pct >= 90) {
    judul = 'Luar Biasa!'; icon = ''; grade = 'A – Sangat Baik';
    gradeClass = 'badge-gold'; msg = 'Kamu menguasai materi Redenominasi dan Penyajian Data dengan sangat baik. Pertahankan!';
  } else if (pct >= 70) {
    judul = 'Bagus Sekali!'; icon = ''; grade = 'B – Baik';
    gradeClass = 'badge-blue'; msg = 'Pemahamanmu sudah bagus! Lihat pembahasan untuk mempelajari soal yang belum tepat.';
  } else if (pct >= 50) {
    judul = 'Cukup Baik!'; icon = ''; grade = 'C – Cukup';
    gradeClass = 'badge-yellow'; msg = 'Kamu sudah paham sebagian. Lihat pembahasan dan coba ulangi evaluasinya!';
  } else {
    judul = 'Terus Belajar!'; icon = ''; grade = 'D – Perlu Perbaikan';
    gradeClass = 'badge-red'; msg = 'Jangan menyerah! Buka pembahasan, pelajari kembali materinya, lalu coba lagi.';
  }

  document.getElementById('evalResultIcon').textContent = icon;
  document.getElementById('evalResultJudul').textContent = judul;
  document.getElementById('evalResultMsg').textContent = msg;

  const badge = document.getElementById('evalGradeBadge');
  badge.textContent = grade;
  badge.className = `eval-grade-badge ${gradeClass}`;

  state.evalSelesai = true;
  state.evalNilai = Math.round(pct);
  state.evalGradeLabel = grade;

  kirimKeSheets(skor, total, pct, grade);
}

/* ──────────────────────────────────────────────
   TAMPILKAN PEMBAHASAN
────────────────────────────────────────────── */
function tampilkanPembahasan() {
  document.getElementById('evalResult').style.display = 'none';
  document.getElementById('evalPembahasan').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const skor = state.evalSkor;
  const total = bankSoal.length;
  const pct = Math.round((skor / total) * 100);

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
          ${isBenar ? ' Benar' : ' Salah'}
        </span>
      </div>
      <div class="pb-item-soal">${soal.visual ? `<div class="eval-visual-area" style="margin-bottom:12px">${soal.visual}</div>` : ''}${soal.soal}</div>
      <div class="pb-pilihan-wrap">
        ${soal.pilihan.map((p, i) => {
          let cls = 'pb-pilihan';
          if (i === soal.jawaban) cls += ' pb-pilihan-kunci';
          if (i === j.pilihanSiswa && !j.benar) cls += ' pb-pilihan-salah';
          const prefix = i === soal.jawaban ? ' ' : (i === j.pilihanSiswa && !j.benar ? ' ' : '');
          return `<div class="${cls}">${prefix}${String.fromCharCode(65+i)}. ${p}</div>`;
        }).join('')}
      </div>
      <div class="pb-item-penjelasan">
        <span class="pb-pen-icon"></span>
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

/**
 * Kirim payload rekap (tipe 'evaluasi' atau 'progresKB') ke Spreadsheet.
 *
 * PERBAIKAN PENTING: versi sebelumnya memanggil Web App Google Apps Script
 * LANGSUNG dari browser (fetch ke GOOGLE_SHEETS_WEBAPP_URL). Itu SELALU
 * gagal di semua browser modern — bukan soal "/exec" vs "/dev" atau akses
 * "Anyone" — karena Apps Script Web App tidak pernah mengirim header
 * "Access-Control-Allow-Origin". Tanpa header itu, browser MEMBLOKIR
 * pembacaan balasannya walau requestnya sendiri sukses sampai ke server
 * Google (ini aturan CORS bawaan browser, bukan bug di kode Apps Script-mu).
 * Akibatnya fetch() selalu melempar error jaringan, persis pesan
 * "Tidak bisa menghubungi Google Apps Script..." yang muncul di layar.
 *
 * Solusinya: kirim lewat backend Flask sendiri dulu (REKAP_URL,
 * endpoint /api/rekap di app.py) — komunikasi server-ke-server pakai
 * `requests` di app.py TIDAK kena aturan CORS browser sama sekali, dan
 * proxy ini memang sudah ada & sudah benar di app.py. Baru kalau proxy itu
 * sendiri tidak ada (mis. website di-hosting statis di GitHub Pages tanpa
 * app.py berjalan sama sekali → responsnya bukan JSON dari Flask), coba
 * panggil Apps Script langsung sebagai upaya terakhir (tetap bisa gagal
 * karena CORS di atas, tapi setidaknya dicoba).
 */
async function kirimKeRekap(payload) {
  try {
    return await kirimRekapViaProxy(payload);
  } catch (proxyErr) {
    if (proxyErr.hostingStatis) {
      // /api/rekap tidak ditemukan sama sekali → app.py memang tidak
      // sedang berjalan (hosting statis). Coba jalur langsung sebagai
      // upaya terakhir.
      return await kirimRekapLangsung(payload);
    }
    throw proxyErr;
  }
}

/** Jalur utama: lewat backend Flask sendiri (/api/rekap → Code.gs). */
async function kirimRekapViaProxy(payload) {
  let res;
  try {
    res = await fetch(REKAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw new Error(
      'Tidak bisa menghubungi server aplikasi (Flask). Pastikan app.py ' +
      'sedang berjalan ("python app.py") dan halaman ini dibuka lewat ' +
      'http://... (bukan dengan dobel klik file index.html).'
    );
  }

  if (res.status === 404) {
    // Kemungkinan besar app.py versi lama (belum ada /api/rekap) atau
    // hosting statis tanpa app.py sama sekali.
    const err = new Error('Endpoint /api/rekap tidak ditemukan di server.');
    err.hostingStatis = true;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'ok') {
    if (res.status === 503) {
      throw new Error(
        (data.message || 'GOOGLE_SHEETS_URL belum diisi.') +
        ' Isi variabel GOOGLE_SHEETS_URL di file .env pada server (samakan ' +
        'dengan URL Web App Apps Script yang diakhiri "/exec"), lalu restart app.py.'
      );
    }
    if (res.status === 502) {
      throw new Error(
        data.message ||
        'Server Flask tidak berhasil menghubungi Google Apps Script. Cek ' +
        'apakah deployment Web App Apps Script masih aktif (Deploy > Manage ' +
        'deployments) dan akses diset ke "Anyone", lalu redeploy versi barunya.'
      );
    }
    throw new Error(data.message || `Gagal menyimpan rekap (HTTP ${res.status}).`);
  }
  return data;
}

/**
 * Jalur cadangan (hosting statis, TANPA app.py sama sekali): panggil Web
 * App Google Apps Script langsung dari browser. CATATAN: ini tetap bisa
 * gagal karena CORS (lihat komentar di atas kirimKeRekap) — Apps Script
 * memang tidak didesain untuk dipanggil langsung dari browser di origin
 * lain. Kalau memungkinkan, selalu jalankan app.py (jalur proxy di atas).
 */
async function kirimRekapLangsung(payload) {
  let res;
  try {
    res = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw new Error(
      'Tidak bisa menghubungi Google Apps Script langsung dari browser ' +
      '(ini memang sering diblokir oleh aturan CORS browser). Jalankan ' +
      'app.py dan buka halaman ini lewat http://... supaya rekap dikirim ' +
      'lewat server, bukan langsung dari browser.'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'ok') {
    throw new Error(data.message || `Gagal menyimpan rekap (HTTP ${res.status}).`);
  }
  return data;
}

/* ──────────────────────────────────────────────
   ANTREAN KIRIM-ULANG RESAP (biar data TIDAK HILANG kalau /api/rekap
   gagal — mis. server sedang down, hosting belum menjalankan app.py,
   atau HP siswa sedang tanpa koneksi). Payload yang gagal disimpan di
   localStorage, lalu dicoba kirim ulang otomatis: saat halaman dibuka
   kembali, saat koneksi internet pulih (event 'online'), dan setiap
   30 detik selama antrean belum kosong.
────────────────────────────────────────────── */
const REKAP_QUEUE_KEY = 'denomath_rekap_queue_v1';

function bacaAntreanRekap() {
  try {
    return JSON.parse(localStorage.getItem(REKAP_QUEUE_KEY) || '[]');
  } catch { return []; }
}
function simpanAntreanRekap(list) {
  try { localStorage.setItem(REKAP_QUEUE_KEY, JSON.stringify(list)); } catch {}
}
function tambahAntreanRekap(payload) {
  const list = bacaAntreanRekap();
  list.push({ payload, ts: Date.now() });
  simpanAntreanRekap(list);
  perbaruiIndikatorAntreanRekap();
}
function perbaruiIndikatorAntreanRekap() {
  const sisa = bacaAntreanRekap().length;
  document.querySelectorAll('.rekap-queue-count').forEach(el => {
    el.textContent = sisa;
    el.closest('.rekap-queue-badge')?.classList.toggle('hidden', sisa === 0);
  });
}

/**
 * Coba kirim ulang semua item di antrean. Item yang berhasil dihapus dari
 * antrean; yang masih gagal tetap disimpan untuk dicoba lagi nanti.
 * Dipanggil otomatis (lihat pemicu di bawah) MAUPUN manual lewat tombol
 * "Coba Kirim Ulang" pada pesan gagal.
 */
async function prosesAntreanRekap() {
  const list = bacaAntreanRekap();
  if (!list.length) return { terkirim: 0, sisa: 0 };
  const sisa = [];
  let terkirim = 0;
  for (const item of list) {
    try {
      await kirimKeRekap(item.payload);
      terkirim++;
    } catch {
      sisa.push(item);
    }
  }
  simpanAntreanRekap(sisa);
  perbaruiIndikatorAntreanRekap();
  return { terkirim, sisa: sisa.length };
}

window.addEventListener('online', () => { prosesAntreanRekap(); });
setInterval(() => { if (bacaAntreanRekap().length) prosesAntreanRekap(); }, 30000);

/** Ambil value sebuah field, kosong jika elemen tidak ada. */
function v(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

/**
 * Kumpulkan jawaban murid untuk SATU sintaks (mis. kb=1, sintaksKey='asesmen')
 * sebagai objek {id_field: jawaban} — dipakai sebagai input untuk koreksi AI.
 */
function kumpulkanJawabanSintaks(kb, sintaksKey) {
  const info = CBL_SINTAKS[kb]?.[sintaksKey];
  if (!info) return {};
  const out = {};
  info.fields.forEach(fid => { out[fid] = v(fid); });
  return out;
}

/**
 * Kumpulkan SKOR AI (hasil koreksi, 0-100) tiap sintaks pada satu Kegiatan
 * Belajar (KB), plus link Publikasi (bukti fisik, bukan jawaban yang
 * dikoreksi) — inilah yang direkap realtime ke Google Sheets, BUKAN teks
 * jawaban mentah murid.
 */
function kumpulkanSkorKB(nomor) {
  const s = state.skorKB[nomor];
  const urutan = ['essentialQ', 'challenge', 'guidingQuestion', 'guidingActivity', 'asesmen'];
  const terisi = urutan.map(k => s[k]).filter(x => typeof x === 'number');
  const skorTotal = terisi.length ? Math.round(terisi.reduce((a, b) => a + b, 0) / terisi.length) : '';
  const linkPublikasi = v(nomor === 1 ? 'kb1PublikasiLink' : 'kb2PublikasiLink');
  const linkGA = v(nomor === 1 ? 'kb1GaLink' : 'kb2GaLink');
  return {
    skor_eq: s.essentialQ ?? '', skor_challenge: s.challenge ?? '', skor_gq: s.guidingQuestion ?? '',
    skor_ga: s.guidingActivity ?? '', skor_asesmen: s.asesmen ?? '', skor_total: skorTotal,
    publikasi: linkPublikasi, ga_link: linkGA,
  };
}

async function kirimKeSheets(skor, total, nilai, grade) {
  const statusEl = document.getElementById('evalSendStatus');
  statusEl.innerHTML = '<div class="send-spinner">⏳ Menyimpan hasil evaluasimu...</div>';
  const detailJawaban = state.evalJawabanSiswa.map(j => `S${j.nomor}:${j.benar ? 'B' : 'S'}`).join(' | ');
  const payload = {
    tipe: 'evaluasi', timestamp: buatTimestamp(),
    nama: state.user.nama, absen: state.user.absen, kelas: state.user.kelas,
    skor, total, nilai: Math.round(nilai), grade, detail: detailJawaban,
    loginTipe: state.user.tipe || 'individu', anggota: state.user.anggota || '',
  };
  try {
    await kirimKeRekap(payload);
    statusEl.innerHTML = '<div class="send-success"> Hasil evaluasi berhasil tersimpan ke rekap guru!</div>';
  } catch (err) {
    console.error('Gagal mengirim hasil evaluasi ke rekap:', err);
    tambahAntreanRekap(payload);
    statusEl.innerHTML = `
      <div class="send-warn">
        Gagal menyimpan ke rekap guru: ${err.message || 'cek koneksi/server.'}
        <br>Jangan khawatir, hasilmu sudah disimpan sementara di HP/laptop ini dan akan
        otomatis dicoba kirim ulang. Kamu juga bisa coba manual:
        <button type="button" class="btn-retry-rekap" onclick="cobaKirimUlangEvaluasi(this)">Coba Kirim Ulang</button>
      </div>`;
  }
}

/** Dipanggil dari tombol "Coba Kirim Ulang" pada pesan gagal evaluasi. */
async function cobaKirimUlangEvaluasi(btnEl) {
  const statusEl = document.getElementById('evalSendStatus');
  btnEl.disabled = true;
  btnEl.textContent = 'Mengirim...';
  const { terkirim } = await prosesAntreanRekap();
  if (terkirim > 0) {
    statusEl.innerHTML = '<div class="send-success"> Hasil evaluasi berhasil tersimpan ke rekap guru!</div>';
  } else {
    btnEl.disabled = false;
    btnEl.textContent = 'Coba Kirim Ulang';
  }
}

async function kirimProgresKB() {
  if (!state.user.nama || !state.user.kelas) return;
  const j1 = kumpulkanSkorKB(1);
  const j2 = kumpulkanSkorKB(2);
  const payload = {
    tipe: 'progresKB', timestamp: buatTimestamp(),
    nama: state.user.nama, absen: state.user.absen, kelas: state.user.kelas,
    loginTipe: state.user.tipe || 'individu', anggota: state.user.anggota || '',
    kb1: state.kbSelesai[0] ? 'Selesai' : '', kb2: state.kbSelesai[1] ? 'Selesai' : '',
    kb1_skor_eq: j1.skor_eq, kb1_skor_challenge: j1.skor_challenge, kb1_skor_gq: j1.skor_gq,
    kb1_skor_ga: j1.skor_ga, kb1_skor_asesmen: j1.skor_asesmen, kb1_skor_total: j1.skor_total,
    kb1_publikasi: j1.publikasi, kb1_ga_link: j1.ga_link,
    kb2_skor_eq: j2.skor_eq, kb2_skor_challenge: j2.skor_challenge, kb2_skor_gq: j2.skor_gq,
    kb2_skor_ga: j2.skor_ga, kb2_skor_asesmen: j2.skor_asesmen, kb2_skor_total: j2.skor_total,
    kb2_publikasi: j2.publikasi, kb2_ga_link: j2.ga_link,
  };
  try {
    await kirimKeRekap(payload);
  } catch (err) {
    // Tidak menampilkan alert ke siswa di sini (dipanggil otomatis tiap
    // sintaks selesai), tapi TETAP dicatat ke console supaya guru/pengembang
    // bisa melihat kalau ada kegagalan berulang. Payload disimpan ke antrean
    // lokal supaya progres KB1/KB2 TIDAK HILANG — akan otomatis dicoba lagi
    // (lihat prosesAntreanRekap: saat online kembali & tiap 30 detik),
    // bukan cuma menunggu sintaks berikutnya selesai dikoreksi AI.
    console.warn('Gagal mengirim progres KB1/KB2 ke rekap:', err.message);
    tambahAntreanRekap(payload);
  }
}

/**
 * Debounce: jadwalkan koreksi AI beberapa saat setelah murid berhenti
 * mengetik di salah satu field sebuah sintaks (menghindari memanggil AI
 * berkali-kali saat murid masih mengetik/berpindah antar kolom).
 */
function jadwalkanKoreksiAI(kb, sintaksKey) {
  const key = `${kb}-${sintaksKey}`;
  clearTimeout(state.skorKBTimer[key]);
  state.skorKBTimer[key] = setTimeout(() => koreksiSintaksAI(kb, sintaksKey), 900);
}

/**
 * Kirim jawaban satu sintaks KB ke backend AI (/api/koreksi) untuk
 * dikoreksi & diberi skor 0-100 secara otomatis. Skor hasil koreksi
 * disimpan di state.skorKB dan itulah yang direkap ke Google Sheets
 * (kirimProgresKB) — bukan teks jawaban mentahnya.
 */
async function koreksiSintaksAI(kb, sintaksKey) {
  const info = CBL_SINTAKS[kb]?.[sintaksKey];
  if (!info) return;
  const jawaban = kumpulkanJawabanSintaks(kb, sintaksKey);
  const adaIsi = Object.values(jawaban).some(x => x && String(x).trim());
  if (!adaIsi) return;

  const key = `${kb}-${sintaksKey}`;
  if (state.skorKBLoading[key]) return; // sudah ada koreksi berjalan untuk grup ini
  state.skorKBLoading[key] = true;
  tampilkanBadgeSkor(kb, sintaksKey, 'loading');

  try {
    const res = await fetch(AI_KOREKSI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kb, sintaks: sintaksKey, jawaban }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.skor !== 'number') {
      throw new Error(data.error || 'Gagal menilai jawaban.');
    }
    state.skorKB[kb][sintaksKey] = Math.max(0, Math.min(100, Math.round(data.skor)));
    tampilkanBadgeSkor(kb, sintaksKey, 'sukses', state.skorKB[kb][sintaksKey], data.catatan);
    kirimProgresKB();
  } catch (err) {
    tampilkanBadgeSkor(kb, sintaksKey, 'gagal');
  } finally {
    state.skorKBLoading[key] = false;
  }
}

/**
 * Penilaian AI kini disengaja TIDAK ditampilkan ke murid pada tiap tab
 * sintaks "Ayo Belajar" (baik sedang dinilai, berhasil, maupun gagal
 * dinilai) — supaya murid tidak tahu status koreksi jawabannya secara
 * real-time. Koreksi tetap berjalan diam-diam di balik layar (lihat
 * koreksiSintaksAI) dan skornya baru terungkap lewat modal "Skor Akhir"
 * setelah murid menekan tombol "Selesaikan KB".
 */
function tampilkanBadgeSkor() {
  // sengaja kosong — lihat catatan di atas
}

function escapeHtmlSkor(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Rekap realtime tambahan: dikirim setiap murid selesai mengetik jawaban
 * di satu kolom isian (saat field kehilangan fokus / blur), tidak hanya
 * saat klik "Lanjut" antar sintaks. Sekaligus menjadwalkan koreksi AI
 * untuk sintaks terkait, sehingga skornya langsung terisi tanpa menunggu
 * murid berpindah tab.
 */
function pasangAutoRekapJawaban() {
  const selector = '#modalKB1 .jawaban-input, #modalKB1 .cell-input:not(.optional-input), #modalKB2 .jawaban-input, #modalKB2 .cell-input:not(.optional-input)';
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener('blur', () => {
      if (!el.value || !el.value.trim()) return;
      kirimProgresKB();
      const info = CBL_FIELD_TO_SINTAKS[el.id];
      if (info) jadwalkanKoreksiAI(info.kb, info.sintaks);
    });
  });
}
document.addEventListener('DOMContentLoaded', pasangAutoRekapJawaban);

function ulangiEvaluasi() {
  document.getElementById('evalResult').style.display = 'none';
  document.getElementById('evalPembahasan').style.display = 'none';
  document.getElementById('evalStart').style.display = 'block';
  document.getElementById('evalSendStatus').innerHTML = '';
}

/* ──────────────────────────────────────────────
   DENO AI — Asisten Belajar (chat widget)
   Menghubungkan UI yang sudah ada di index.html
   ke backend Flask (app.py) yang memanggil OpenAI (ChatGPT) API.
────────────────────────────────────────────── */

/** Buka/tutup panel widget AI */
/* ──────────────────────────────────────────────
   DENO AI — Mode Panggilan (tampilan video-call)
   Menggunakan ulang logic chat/voice yang sudah
   ada (sendAIMessage, bicarakanAI, startListening),
   hanya menambahkan tampilan avatar besar yang
   "berbicara" dan status real-time.
────────────────────────────────────────────── */
function toggleCallMode() {
  const panel = document.getElementById('aiPanel');
  const callView = document.getElementById('aiCallView');
  const callBtn = document.getElementById('callModeBtn');
  if (!panel || !callView) return;

  state.aiCallMode = !state.aiCallMode;

  panel.classList.toggle('call-mode', state.aiCallMode);
  callView.classList.toggle('open', state.aiCallMode);
  if (callBtn) callBtn.classList.toggle('active', state.aiCallMode);

  if (state.aiCallMode) {
    // Mode panggilan otomatis mengaktifkan suara AI agar terasa seperti video call
    if (!state.aiVoiceOn) toggleVoice();
    setCallState('Siap mendengarkan');
    setCallSubtitle('Tekan tombol mikrofon lalu ucapkan pertanyaanmu tentang Redenominasi Rupiah 🎤');
  } else {
    if (state.aiListening) stopListening();
    window.speechSynthesis?.cancel();
  }
}

function callModeToggleMic() {
  if (state.aiListening) {
    stopListening();
  } else {
    startListening();
  }
}

function setCallState(teks) {
  const el = document.getElementById('aiCallState');
  if (el) el.textContent = teks;
}

function setCallSubtitle(teks) {
  const el = document.getElementById('aiCallSubtitle');
  if (el) el.textContent = teks;
}

function setCallSpeaking(on) {
  const avatar = document.getElementById('aiCallAvatar');
  const glow = document.getElementById('aiCallGlow');
  avatar?.classList.toggle('speaking', on);
  glow?.classList.toggle('speaking', on);
  if (state.aiCallMode) setCallState(on ? 'Sedang menjawab...' : 'Siap mendengarkan');
}

function setCallListening(on) {
  const glow = document.getElementById('aiCallGlow');
  const micBtn = document.getElementById('aiCallMicBtn');
  glow?.classList.toggle('listening', on);
  micBtn?.classList.toggle('listening', on);
  if (state.aiCallMode) setCallState(on ? 'Mendengarkan kamu...' : 'Siap mendengarkan');
}

function toggleAIWidget() {
  state.aiOpen = !state.aiOpen;
  const panel = document.getElementById('aiPanel');
  const btn = document.getElementById('aiToggleBtn');
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
 * Cek sekali apakah backend (app.py) sedang berjalan & siap dipakai.
 * Tidak ada API key yang diminta dari siswa — key sudah otomatis
 * dibaca app.py dari file .env di server.
 */
async function cekStatusBackendAI() {
  state.aiBackendChecked = true;
  setStatusAI('Menghubungkan...', { thinking: true });
  try {
    const res = await fetch(AI_HEALTH_URL);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.provider_ready) {
      setStatusAI('Siap membantu!');
    } else {
      setStatusAI('Backend belum siap');
      tambahBubbleAI(
        'assistant',
        ' <strong>Backend DENO AI belum siap.</strong><br><br>' +
        'Pastikan file <code>.env</code> sudah berisi GROQ_API_KEY, lalu jalankan <code>python app.py</code> di terminal.',
        { isError: true, trusted: true }
      );
    }
  } catch (err) {
    setStatusAI('Backend tidak aktif');
    tambahBubbleAI(
      'assistant',
      ' <strong>Tidak dapat terhubung ke backend DENO AI.</strong><br><br>' +
      'Jalankan <code>python app.py</code> di terminal (folder project ini), lalu buka kembali panel ini.',
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
        <p>Riwayat percakapan sudah dibersihkan . Ada yang ingin kamu tanyakan lagi tentang Redenominasi Rupiah atau Penyajian Data?</p>
      </div>
    </div>
  `;
  showToast(' Riwayat chat dibersihkan', 'info');
}

/** Toggle mode percakapan suara (text-to-speech otomatis utk balasan AI) */
function toggleVoice() {
  if (!state.aiVoiceOn && !('speechSynthesis' in window)) {
    showToast(' Browser ini tidak mendukung text-to-speech', 'warn');
    return;
  }

  state.aiVoiceOn = !state.aiVoiceOn;
  const btn = document.getElementById('voiceToggleBtn');
  if (btn) btn.classList.toggle('active', state.aiVoiceOn);
  showToast(
    state.aiVoiceOn ? 'Mode suara diaktifkan — balasan AI akan dibacakan' : 'Mode suara dimatikan',
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

/** Ubah balasan AI (teks polos dari backend) menjadi HTML yang rapi & aman:
 * - Blok [TABEL]...[/TABEL] dirender sebagai tabel HTML sungguhan.
 * - Blok [DIAGRAM]...[/DIAGRAM] (baris "Label: angka") dirender sebagai
 *   diagram batang mini dalam bubble chat.
 * - **tebal** dirender jadi teks tebal sungguhan — tanda bintangnya dibuang.
 * - Baris yang diawali "- " / "• " dirender sebagai bullet list sungguhan —
 *   tanda "-" dibuang, diganti bullet asli.
 * - Sisa tanda markdown lain (*, _, #, `) yang masih tersisa dibuang total,
 *   supaya balasan tidak pernah menampilkan simbol mentah ke siswa.
 */
function formatAIReply(raw) {
  if (!raw) return '';
  let text = raw;

  // Simpan blok tabel/diagram sebagai HTML jadi, ditandai placeholder,
  // supaya tidak ikut ter-escape / terpotong oleh proses selanjutnya.
  const blokTersimpan = [];
  const simpanBlok = (html) => {
    blokTersimpan.push(html);
    return `@@AIBLOK${blokTersimpan.length - 1}@@`;
  };

  text = text.replace(/\[TABEL\]([\s\S]*?)\[\/TABEL\]/gi, (_m, isi) => {
    const baris = isi.trim().split('\n').map(b => b.trim()).filter(Boolean);
    if (!baris.length) return '';
    const sel = baris.map(b => b.split('|').map(s => s.trim()).filter((s, i, arr) => !(s === '' && (i === 0 || i === arr.length - 1))));
    const [header, ...rows] = sel;
    let html = '<table class="ai-chat-table"><thead><tr>' +
      header.map(h => `<th>${escapeHTMLAI(h)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr>' + r.map(c => `<td>${escapeHTMLAI(c)}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    return simpanBlok(html);
  });

  text = text.replace(/\[DIAGRAM\]([\s\S]*?)\[\/DIAGRAM\]/gi, (_m, isi) => {
    const baris = isi.trim().split('\n').map(b => b.trim()).filter(Boolean);
    const data = baris.map(b => {
      const idx = b.lastIndexOf(':');
      if (idx === -1) return null;
      const label = b.slice(0, idx).trim();
      const angka = parseFloat(b.slice(idx + 1).replace(/[^\d.-]/g, ''));
      return isNaN(angka) ? null : { label, angka };
    }).filter(Boolean);
    if (!data.length) return '';
    const max = Math.max(...data.map(d => d.angka), 1);
    let html = '<div class="ai-chat-diagram">';
    data.forEach(d => {
      const pct = Math.max(4, Math.round((d.angka / max) * 100));
      html += `<div class="ai-chat-diagram-row">
        <span class="ai-chat-diagram-label">${escapeHTMLAI(d.label)}</span>
        <div class="ai-chat-diagram-bar-wrap"><div class="ai-chat-diagram-bar" style="width:${pct}%"></div></div>
        <span class="ai-chat-diagram-value">${escapeHTMLAI(String(d.angka))}</span>
      </div>`;
    });
    html += '</div>';
    return simpanBlok(html);
  });

  // Escape sisa teks biasa (placeholder @@AIBLOKn@@ tidak terpengaruh).
  text = escapeHTMLAI(text);

  // **tebal** -> <strong>, tanda bintangnya hilang.
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Buang sisa tanda markdown yang mengganggu (*, _, #, `) yang masih tersisa.
  text = text.replace(/[*_#`]+/g, '');

  // Baris "- teks" / "• teks" -> bullet list sungguhan.
  const baris = text.split('\n');
  let html = '';
  let dalamList = false;
  baris.forEach(line => {
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      if (!dalamList) { html += '<ul class="ai-chat-list">'; dalamList = true; }
      html += `<li>${bullet[1]}</li>`;
    } else {
      if (dalamList) { html += '</ul>'; dalamList = false; }
      html += line + '<br>';
    }
  });
  if (dalamList) html += '</ul>';

  // Kembalikan blok tabel/diagram ke posisi placeholder-nya.
  html = html.replace(/@@AIBLOK(\d+)@@<br>?/g, (_m, i) => blokTersimpan[Number(i)] || '')
             .replace(/@@AIBLOK(\d+)@@/g, (_m, i) => blokTersimpan[Number(i)] || '');

  return html;
}

/** Scroll jendela chat ke bawah.
 * @param {boolean} force - true: selalu scroll ke bawah (dipakai saat pesan
 * milik siswa sendiri terkirim, atau saat indikator "mengetik" muncul).
 * false: hanya scroll jika posisi sebelumnya memang sudah dekat dasar —
 * supaya kalau siswa sedang scroll ke atas membaca/membalas pesan lama,
 * balasan AI yang sedang mengalir TIDAK menarik paksa layar ke bawah.
 */
function scrollAIMessages(force = false) {
  const box = document.getElementById('aiMessages');
  if (!box) return;
  const jarakDariDasar = box.scrollHeight - box.scrollTop - box.clientHeight;
  if (force || jarakDariDasar < 130) {
    box.scrollTop = box.scrollHeight;
  }
}

/** Tambahkan satu bubble chat ke jendela pesan
 * @param {boolean} opts.trusted - true HANYA untuk pesan yang kita generate
 * sendiri di sini (status backend, instruksi setup). Balasan dari AI/siswa
 * TIDAK PERNAH trusted, supaya tag HTML di dalamnya tetap di-escape dengan aman.
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
  bubble.innerHTML = trusted ? text : formatAIReply(text);

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  // Pesan baru (milik siswa / pesan sistem) selalu memaksa scroll ke bawah.
  scrollAIMessages(true);
}

/** Buat bubble kosong untuk balasan AI yang akan diisi bertahap (streaming),
 * supaya teks "mengalir masuk" tanpa jeda — mirip lawan bicara di telepon —
 * alih-alih muncul sekaligus sebagai satu blok teks panjang.
 * Mengembalikan elemen bubble-nya agar bisa diisi oleh updateBubbleStreamingAI().
 */
function buatBubbleStreamingAI() {
  const box = document.getElementById('aiMessages');
  if (!box) return null;

  const wrap = document.createElement('div');
  wrap.className = 'ai-msg ai-msg-bot';

  const avatar = document.createElement('div');
  avatar.className = 'ai-msg-avatar';
  avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const bubble = document.createElement('div');
  bubble.className = 'ai-msg-bubble ai-msg-bubble-streaming';
  bubble.innerHTML = `<div class="ai-stream-text"></div><span class="ai-stream-cursor"></span>`;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  scrollAIMessages(true);

  return bubble;
}

/** Isi ulang teks bubble streaming setiap ada potongan (delta) baru masuk. */
function updateBubbleStreamingAI(bubbleEl, fullText) {
  if (!bubbleEl) return;
  const span = bubbleEl.querySelector('.ai-stream-text');
  if (span) span.innerHTML = formatAIReply(fullText);
  // Hanya ikut-scroll kalau memang sudah berada dekat dasar jendela chat.
  scrollAIMessages(false);
}

/** Selesai streaming: hapus kursor berkedip & bubble jadi bubble biasa. */
function selesaikanBubbleStreamingAI(bubbleEl) {
  if (!bubbleEl) return;
  bubbleEl.classList.remove('ai-msg-bubble-streaming');
  const cursor = bubbleEl.querySelector('.ai-stream-cursor');
  if (cursor) cursor.remove();
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
  scrollAIMessages(true);
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
    showToast(' Browser ini belum mendukung text-to-speech', 'warn');
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
    utter.onstart = () => setCallSpeaking(true);
    utter.onend = () => setCallSpeaking(false);
    utter.onerror = (e) => {
      console.warn('TTS error:', e.error);
      setCallSpeaking(false);
    };

    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn('Text-to-speech tidak tersedia:', err);
    showToast(' Gagal memutar suara balasan AI', 'warn');
  }
}

/** Kirim pertanyaan ke DENO AI lewat backend Flask (app.py).
 * Balasan diterima sebagai stream (potongan demi potongan) lalu langsung
 * ditampilkan begitu tiba — bukan menunggu seluruh jawaban selesai baru
 * dimunculkan sekaligus. Ini membuat obrolan terasa mengalir tanpa jeda,
 * dan jendela chat tidak tiba-tiba dipenuhi blok teks panjang yang
 * menyulitkan untuk di-scroll atau dibalas.
 */
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
  if (state.aiCallMode) setCallState('Sedang berpikir...');
  tampilkanTypingAI();

  const riwayatBersih = state.aiHistory.slice(-20, -1)
    .filter(item => (item.role === 'user' || item.role === 'assistant') && item.content?.trim())
    .map(item => ({ role: item.role, content: item.content.trim() }));

  let bubbleStreaming = null;

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: pesan,
        history: riwayatBersih,
        siswa: { nama: state.user?.nama || '', kelas: state.user?.kelas || '' },
      }),
    });

    // Status non-200 (mis. 503 backend belum siap, 400 pesan kosong) —
    // backend membalas JSON biasa, bukan stream.
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      hapusTypingAI();
      const pesanError = data.error
        ? ` ${data.error}`
        : ' Maaf, DENO AI sedang tidak bisa diakses. Pastikan backend (python app.py) sedang berjalan.';
      tambahBubbleAI('assistant', pesanError, { isError: true, trusted: true });
      setStatusAI('Sedang bermasalah');
      if (state.aiCallMode) { setCallState('Gagal terhubung'); setCallSubtitle(data.error || 'Pastikan backend (python app.py) sedang berjalan.'); }
      return;
    }

    if (!response.body || !response.body.getReader) {
      // Browser lama tanpa dukungan streaming — fallback tidak tersedia,
      // beri tahu siswa dengan jelas.
      hapusTypingAI();
      tambahBubbleAI('assistant', ' Browser ini belum mendukung mode obrolan real-time. Coba gunakan Chrome/Edge terbaru.', { isError: true, trusted: true });
      setStatusAI('Sedang bermasalah');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let streamError = '';
    let typingDihapus = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blok = buffer.split('\n\n');
      buffer = blok.pop(); // sisa potongan yang belum lengkap, simpan utk putaran berikutnya

      for (const bagian of blok) {
        const baris = bagian.split('\n').find(l => l.startsWith('data: '));
        if (!baris) continue;
        const payload = baris.slice(6).trim();
        if (!payload) continue;

        let json;
        try { json = JSON.parse(payload); } catch { continue; }

        if (json.error) {
          streamError = json.error;
          continue;
        }
        if (json.done) continue;

        if (json.delta) {
          if (!typingDihapus) {
            hapusTypingAI();
            typingDihapus = true;
            bubbleStreaming = buatBubbleStreamingAI();
            setStatusAI('Mengetik...', { thinking: true });
            if (state.aiCallMode) setCallState('Sedang menjawab...');
          }
          fullText += json.delta;
          updateBubbleStreamingAI(bubbleStreaming, fullText);
          if (state.aiCallMode) setCallSubtitle(fullText.replace(/<[^>]+>/g, ''));
        }
      }
    }

    if (!typingDihapus) hapusTypingAI();

    if (streamError && !fullText) {
      if (bubbleStreaming) bubbleStreaming.closest('.ai-msg')?.remove();
      tambahBubbleAI('assistant', ` ${streamError}`, { isError: true, trusted: true });
      setStatusAI('Sedang bermasalah');
      if (state.aiCallMode) { setCallState('Gagal terhubung'); setCallSubtitle(streamError); }
      return;
    }

    if (!fullText) {
      tambahBubbleAI('assistant', ' Maaf, aku tidak mendapat respons dari AI. Coba lagi ya!', { isError: true });
      setStatusAI('Sedang bermasalah');
      return;
    }

    selesaikanBubbleStreamingAI(bubbleStreaming);
    scrollAIMessages(true);
    state.aiHistory.push({ role: 'assistant', content: fullText });
    setStatusAI('Siap membantu!');
    if (state.aiCallMode) setCallSubtitle(fullText.replace(/<[^>]+>/g, ''));
    bicarakanAI(fullText);

  } catch (err) {
    hapusTypingAI();
    console.error('Gagal menghubungi backend DENO AI:', err);
    if (bubbleStreaming) bubbleStreaming.closest('.ai-msg')?.remove();
    tambahBubbleAI(
      'assistant',
      ' Tidak dapat terhubung ke backend DENO AI.<br><br>' +
      'Jalankan <code>python app.py</code> di terminal (folder project ini), lalu coba lagi.',
      { isError: true, trusted: true }
    );
    setStatusAI('Tidak terhubung');
    if (state.aiCallMode) { setCallState('Tidak terhubung'); setCallSubtitle('Tidak dapat terhubung ke backend DENO AI. Jalankan python app.py lalu coba lagi.'); }
  } finally {
    state.aiSending = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

/* ──────────────────────────────────────────────
   DENO AI — Input Suara (Speech-to-Text) DENO AI — Input Suara (Speech-to-Text)
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
    showToast(' Browser ini belum mendukung input suara (coba Chrome/Edge)', 'warn');
    return;
  }
  // SpeechRecognition butuh koneksi aman (HTTPS) atau localhost/file://.
  // Di domain http biasa (bukan localhost), browser akan menolak akses mic.
  const isAman = ['https:', 'file:'].includes(location.protocol) || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!isAman) {
    showToast(' Input suara butuh HTTPS atau localhost', 'warn');
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
    setCallListening(true);
  };

  recognition.onresult = (event) => {
    const transkrip = event.results?.[0]?.[0]?.transcript || '';
    const input = document.getElementById('aiInput');
    if (input && transkrip) {
      input.value = transkrip;
      autoResizeAI(input);
      setCallSubtitle(`Kamu: "${transkrip}"`);
      // Kirim otomatis sedikit setelah selesai bicara, supaya
      // siswa sempat melihat hasil transkrip sebelum terkirim.
      setTimeout(() => sendAIMessage(), 350);
    }
  };

  recognition.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
      showToast('Izin mikrofon ditolak — aktifkan di setelan browser', 'warn');
    } else if (event.error === 'network') {
      showToast(' Input suara butuh koneksi internet', 'warn');
    } else if (event.error !== 'no-speech') {
      showToast(' Gagal menangkap suara, coba lagi', 'warn');
    }
  };

  recognition.onend = () => {
    state.aiListening = false;
    state.aiRecognition = null;
    if (micBtn) micBtn.classList.remove('listening');
    if (indicator) indicator.style.display = 'none';
    if (inputWrap) inputWrap.style.display = 'flex';
    setCallListening(false);
  };

  state.aiRecognition = recognition;
  try {
    recognition.start();
  } catch (err) {
    console.warn('Tidak dapat memulai SpeechRecognition:', err);
    showToast(' Input suara gagal dimulai', 'warn');
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
    if (e.key === 'ArrowLeft') introPrevScene();
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
  initBgDecor();

  // Kalau ada rekap yang gagal terkirim di sesi/kunjungan sebelumnya
  // (tersimpan di localStorage), coba kirim ulang sekarang.
  perbaruiIndikatorAntreanRekap();
  prosesAntreanRekap();

  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.add('active');

  // "inputAnggotaKelompok" adalah textarea — SENGAJA tidak dimasukkan ke
  // daftar ini, supaya tombol Enter di dalamnya membuat baris baru seperti
  // biasa (bukan langsung submit form login).
  ['inputNama', 'inputAbsen', 'inputNamaKelompok', 'inputKelas'].forEach(id => {
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
      to { opacity:1; transform:translateY(0); }
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
    .intro-dot.done { background: var(--hijau-muda); }
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
    .toast-warn { background: linear-gradient(135deg,#b45309,#f59e0b); }
    .toast-info { background: linear-gradient(135deg,#1a4a7a,#2a7dd4); }
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

  console.log('%c DENOMATH Loaded!', 'color:#f5c518;font-size:16px;font-weight:bold');
});