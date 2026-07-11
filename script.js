const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwJJ1rNBTEHEW9SU-REFcymWFHx0Z0x8rqWz-57mn4sCZ2rdaGuChGJS_DABYgCc7oJ/exec';
// DENO AI kini memanggil Groq API LANGSUNG dari browser — tidak lagi
// lewat backend Flask lokal, jadi tidak perlu menjalankan "python app.py"
// di terminal sama sekali. Cukup isi API key lewat ikon 🔑, AI langsung aktif.
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_MAX_TOKENS = 600;
const DENO_AI_SYSTEM_PROMPT = `Kamu adalah DENO AI, asisten belajar ramah di dalam aplikasi
DENOMATH - media pembelajaran interaktif untuk siswa SMP (Kelas 7-9) di Indonesia,
yang membahas materi "Redenominasi Rupiah" dan "Penyajian Data".

ATURAN UTAMA:
1. Gunakan Bahasa Indonesia yang ramah, sederhana, dan menyemangati.
2. Fokus: redenominasi rupiah (dibagi 1.000, nilai daya beli TETAP SAMA, beda sanering).
3. Rumus inti: Harga Baru = Harga Lama / 1.000.
4. JANGAN langsung berikan jawaban soal evaluasi — bantu cara berpikirnya saja.
5. Jawaban ringkas: 2-5 kalimat atau beberapa poin singkat.
6. Jangan pernah berpura-pura menjadi manusia.`;
// Groq API Key TIDAK diintegrasikan/disimpan di server (.env) — key diisi
// manual oleh siswa/guru lewat panel DENO AI, lalu disimpan hanya di
// localStorage browser masing-masing perangkat.
const AI_KEY_STORAGE = 'denomath_groq_api_key';
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
  aiHistory: [], // {role:'user'|'assistant', content:string}
  aiSending: false,
  aiVoiceOn: false, // mode percakapan suara (TTS otomatis untuk balasan AI)
  aiListening: false,
  aiCallMode: false, // mode panggilan AI bergaya video call
  aiRecognition: null, // instance SpeechRecognition aktif (jika ada)
  aiBackendChecked: false,
  // --- BUAT DIAGRAM (alat bantu) ---
  diagTipe: 'batang',
  kb2DiagTipe: 'batang',
  // --- GATING SINTAKS AYO BELAJAR (CBL) ---
  // Menyimpan nomor tab tertinggi yang sudah terbuka untuk tiap KB.
  // Murid wajib menyelesaikan (mengisi) satu sintaks sebelum lanjut ke sintaks berikutnya.
  cblUnlocked: { 1: 1, 2: 1 },
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
    soal: 'Perhatikan tabel harga sayur Pak Budi berikut. Setelah dikonversi ke rupiah baru, sayur manakah yang harganya paling mahal?',
    visual: `<div class="eval-visual-caption"> Tabel Harga Sayur Pak Budi</div>
      <table class="data-table"><thead><tr><th>Sayur</th><th>Harga Lama</th></tr></thead>
      <tbody>
        <tr><td> Bayam</td><td>Rp 5.000</td></tr>
        <tr><td> Kangkung</td><td>Rp 3.000</td></tr>
        <tr><td> Wortel</td><td>Rp 8.000</td></tr>
        <tr><td> Tomat</td><td>Rp 12.000</td></tr>
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
    visual: `<div class="eval-visual-caption"> Tabel Belanja Bu Sari (Rupiah Baru)</div>
      <table class="data-table"><thead><tr><th>Barang</th><th>Harga Baru</th></tr></thead>
      <tbody>
        <tr><td> Beras 5 kg</td><td>Rp 65</td></tr>
        <tr><td> Telur 1 kg</td><td>Rp 28</td></tr>
        <tr><td> Minyak 1 L</td><td>Rp 15</td></tr>
        <tr><td> Gula 1 kg</td><td>Rp 17</td></tr>
        <tr><td> Ikan 500 g</td><td>Rp 22</td></tr>
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
    soal: 'Penyajian data manakah yang paling tepat digunakan untuk menampilkan perbandingan harga beberapa jenis sayur secara langsung?',
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
    visual: `<div class="eval-visual-caption"> Tabel &amp; Diagram Pengeluaran Pak Andi (Rp 1.000.000)</div>
      <table class="data-table"><thead><tr><th>Kategori</th><th>Nominal</th></tr></thead>
      <tbody>
        <tr><td> Tabungan Jangka Panjang</td><td>Rp 400.000</td></tr>
        <tr><td> Kebutuhan Sehari-hari</td><td>Rp 300.000</td></tr>
        <tr><td> Hiburan</td><td>Rp 200.000</td></tr>
        <tr><td> Dana Darurat</td><td>Rp 100.000</td></tr>
      </tbody></table>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 40%, var(--biru-mid) 40% 70%, var(--violet) 70% 90%, var(--red) 90% 100%)">
          <span class="pie-pct" style="left:93px;top:49px">40%</span>
          <span class="pie-pct" style="left:49px;top:93px">30%</span>
          <span class="pie-pct" style="left:27px;top:49px">20%</span>
          <span class="pie-pct" style="left:49px;top:27px">10%</span>
        </div>
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
    soal: 'Apa keuntungan menyajikan data dalam bentuk tabel dibandingkan dengan diagram?',
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
    soal: 'Perhatikan tabel persentase pengeluaran Pak Andi berikut. Kategori manakah yang paling tepat ditampilkan sebagai sektor terbesar pada diagram lingkaran?',
    visual: `<div class="eval-visual-caption"> Tabel &amp; Diagram Persentase Pengeluaran Pak Andi</div>
      <table class="data-table"><thead><tr><th>Kategori</th><th>Persentase</th></tr></thead>
      <tbody>
        <tr><td> Tabungan Jangka Panjang</td><td>40%</td></tr>
        <tr><td> Kebutuhan Sehari-hari</td><td>30%</td></tr>
        <tr><td> Hiburan</td><td>20%</td></tr>
        <tr><td> Dana Darurat</td><td>10%</td></tr>
      </tbody></table>
      <div class="pie-chart-wrap">
        <div class="pie-chart" style="background:conic-gradient(var(--emas) 0% 40%, var(--biru-mid) 40% 70%, var(--violet) 70% 90%, var(--red) 90% 100%)">
          <span class="pie-pct" style="left:93px;top:49px">40%</span>
          <span class="pie-pct" style="left:49px;top:93px">30%</span>
          <span class="pie-pct" style="left:27px;top:49px">20%</span>
          <span class="pie-pct" style="left:49px;top:27px">10%</span>
        </div>
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
    soal: 'Perhatikan diagram batang harga sayur Pak Budi (rupiah baru) berikut. Batang yang paling pendek mewakili sayur…',
    visual: `<div class="eval-visual-caption"> Diagram Batang Harga Sayur (Rupiah Baru)</div>
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
    soal: 'Perhatikan tabel hasil pencatatan tabungan harian siswa berikut (dalam rupiah baru). Nilai manakah yang merupakan modus (paling sering muncul) dari data tersebut?',
    visual: `<div class="eval-visual-caption"> Tabel Turus Tabungan Harian Siswa</div>
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
    visual: `<div class="eval-visual-caption"> Tabel Pendapatan Harian Pedagang (Rupiah Lama)</div>
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
    soal: 'Perhatikan tabel pengeluaran kuota internet siswa selama Januari–Juni berikut. Pada bulan apakah pengeluaran kuota internet siswa paling tinggi?',
    visual: `<div class="eval-visual-caption"> Diagram Batang Pengeluaran Kuota Internet</div>
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
function handleLogin() {
  const nama = document.getElementById('inputNama').value.trim();
  const absen = document.getElementById('inputAbsen').value.trim();
  const kelas = document.getElementById('inputKelas').value;

  if (!nama) { shakeInput('inputNama'); showToast(' Nama lengkap harus diisi!', 'warn'); return; }
  if (!absen || absen < 1 || absen > 40) { shakeInput('inputAbsen'); showToast(' Nomor absen tidak valid!', 'warn'); return; }
  if (!kelas) { shakeInput('inputKelas'); showToast(' Pilih kelas terlebih dahulu!', 'warn'); return; }

  state.user = { nama, absen, kelas };
  document.getElementById('namaDisplay').textContent = nama;
  const kelasEl = document.getElementById('kelasDisplay');
  const absenEl = document.getElementById('absenDisplay');
  if (kelasEl) kelasEl.textContent = kelas;
  if (absenEl) absenEl.textContent = absen;
  document.getElementById('sambutanSiswa').style.display = 'inline-flex';
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
   KB 2 – Diagram Batang Canvas
────────────────────────────────────────────── */
function buatDiagramKB2() {
  const ids = ['kb2h1','kb2h2','kb2h3','kb2h4','kb2h5'];
  const labels = ['Beras','Telur','Minyak','Gula','Ikan'];
  const warna = ['#f5c518','#22c55e','#a855f7','#f97316','#4a9eff'];
  const values = ids.map(id => parseFloat(document.getElementById(id).value) || 0);

  if (values.every(v => v === 0)) { showToast(' Isi minimal satu nilai harga baru dulu!', 'warn'); return; }

  const canvas = document.getElementById('canvasKB2');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...values, 1);
  const barW = 60, gap = (W - 60 - labels.length * barW) / (labels.length + 1);
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
  showToast(' Diagram batang berhasil dibuat!', 'success');
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

  if (state.diagTipe === 'batang') {
    gambarDiagramBatangUser(data);
  } else {
    gambarDiagramLingkaranUser(data);
  }

  document.getElementById('diagramOutputCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(' Diagram berhasil dibuat!', 'success');
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
    showToast('⬇ Diagram berhasil diunduh!', 'success');
  } catch (err) {
    console.error('Gagal mengunduh diagram:', err);
    showToast(' Gagal mengunduh diagram', 'warn');
  }
}

/* ──────────────────────────────────────────────
   SELESAIKAN KB
────────────────────────────────────────────── */
function selesaikanKB(nomor) {
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
  kirimProgresKB();

  if (state.kbSelesai.every(Boolean)) {
    setTimeout(tampilkanSelamat, 600);
  } else {
    const pesanNext = nomor < 2 ? ` KB ${nomor + 1} sekarang terbuka!` : '';
    showToast(` KB ${nomor} selesai!${pesanNext}`, 'success');
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

async function kirimGetKeSheets(payload) {
  const url = `${SHEETS_URL}?` + Object.entries(payload)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return fetch(url, { method: 'GET', mode: 'no-cors' });
}

/**
 * Kirim data via POST (body JSON) — dipakai untuk rekap progres & jawaban
 * "Ayo Belajar" karena isinya bisa panjang (banyak jawaban esai murid),
 * sehingga tidak aman/cukup jika dikirim lewat query string GET.
 * mode 'no-cors' + Content-Type text/plain supaya tidak kena CORS preflight;
 * Apps Script tetap bisa mem-parse body-nya sebagai JSON di sisi server.
 */
async function kirimPostKeSheets(payload) {
  return fetch(SHEETS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
}

/** Ambil value sebuah field, kosong jika elemen tidak ada. */
function v(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

/**
 * Kumpulkan seluruh jawaban murid pada satu Kegiatan Belajar (KB), dikelompokkan
 * per sintaks (Essential Question, Challenge, Guiding Question, Guiding Activity,
 * Refleksi, Asesmen/Publikasi) — dipakai untuk rekap realtime ke Google Sheets.
 */
function kumpulkanJawabanKB(nomor) {
  if (nomor === 1) {
    return {
      essentialQ: `1) ${v('kb1eq1')} || 2) ${v('kb1eq2')} || 3) ${v('kb1eq3')}`,
      challenge: v('kb1challenge'),
      guidingQuestion: `1) ${v('kb1gq1')} || 2) ${v('kb1gq2')}`,
      guidingActivity: `Frekuensi -> 5:${v('freq5')} 6:${v('freq6')} 7:${v('freq7')} 8:${v('freq8')} 9:${v('freq9')} | Harga Baru -> Cabai:${v('hkb1')} Wortel:${v('hkb2')} Tomat:${v('hkb3')} Ubi:${v('hkb4')} Kentang:${v('hkb5')} | Link Foto: ${v('kb1link')}`,
      asesmen: `a) ${v('kb1as1')} || b) ${v('kb1as2')} || c) ${v('kb1as3')}`,
      publikasi: v('kb1PublikasiLink'),
    };
  }
  return {
    essentialQ: `1) ${v('kb2eq1')} || 2) ${v('kb2eq2')} || 3) ${v('kb2eq3')}`,
    challenge: v('kb2challenge'),
    guidingQuestion: `1) ${v('kb2gq1')} || 2) ${v('kb2gq2')} || 3) ${v('kb2gq3')}`,
    guidingActivity: `Data -> Keripik:${v('kb2h1')} Roti:${v('kb2h2')} Minuman:${v('kb2h3')} Permen:${v('kb2h4')} | Link Foto: ${v('kb2link')}`,
    asesmen: `a) ${v('kb2as1')} || b) ${v('kb2as2')} || c) ${v('kb2as3')} || d) ${v('kb2as4')} || e) ${v('kb2as5')}`,
    publikasi: v('kb2PublikasiLink'),
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
  };
  try {
    await kirimGetKeSheets(payload);
    statusEl.innerHTML = '<div class="send-success"> Hasil evaluasi berhasil tersimpan ke rekap guru!</div>';
  } catch (err) {
    statusEl.innerHTML = '<div class="send-warn"> Tidak dapat terhubung ke server. Cek koneksi internet.</div>';
  }
}

async function kirimProgresKB() {
  if (!state.user.nama || !state.user.kelas) return;
  const j1 = kumpulkanJawabanKB(1);
  const j2 = kumpulkanJawabanKB(2);
  const payload = {
    tipe: 'progresKB', timestamp: buatTimestamp(),
    nama: state.user.nama, absen: state.user.absen, kelas: state.user.kelas,
    kb1: state.kbSelesai[0] ? 'Selesai' : '', kb2: state.kbSelesai[1] ? 'Selesai' : '',
    kb1_essentialQ: j1.essentialQ, kb1_challenge: j1.challenge, kb1_guidingQuestion: j1.guidingQuestion,
    kb1_guidingActivity: j1.guidingActivity, kb1_asesmen: j1.asesmen, kb1_publikasi: j1.publikasi,
    kb2_essentialQ: j2.essentialQ, kb2_challenge: j2.challenge, kb2_guidingQuestion: j2.guidingQuestion,
    kb2_guidingActivity: j2.guidingActivity, kb2_asesmen: j2.asesmen, kb2_publikasi: j2.publikasi,
  };
  try { await kirimPostKeSheets(payload); } catch (err) { /* silent, rekap akan dikirim ulang di sintaks berikutnya */ }
}

/**
 * Rekap realtime tambahan: dikirim setiap murid selesai mengetik jawaban
 * di satu kolom isian (saat field kehilangan fokus / blur), tidak hanya
 * saat klik "Lanjut" antar sintaks. Ini memastikan jawaban seperti argumen
 * murid pada Essential Question (mis. soal modus tabungan di Big Idea KB 1)
 * langsung masuk ke rekap guru meski murid belum pindah tab.
 */
function pasangAutoRekapJawaban() {
  const selector = '#modalKB1 .jawaban-input, #modalKB1 .cell-input:not(.optional-input), #modalKB2 .jawaban-input, #modalKB2 .cell-input:not(.optional-input)';
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener('blur', () => {
      if (el.value && el.value.trim()) kirimProgresKB();
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
   LANGSUNG ke Groq API dari browser (tanpa backend
   Flask/terminal) menggunakan API key yang diisi
   siswa/guru sendiri lewat ikon 🔑.
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
    // Belum ada API key tersimpan di browser ini -> minta diisi dulu
    if (!getAIApiKey()) toggleAIKeyModal(true);
  } else {
    panel.classList.remove('open');
    btn.classList.remove('open');
  }
}

/* ──────────────────────────────────────────────
   GROQ API KEY — diisi manual oleh siswa/guru lewat
   panel DENO AI (tombol 🔑), TIDAK diintegrasikan atau
   disimpan di server/.env. Key hanya tersimpan di
   localStorage browser perangkat yang bersangkutan,
   dan dikirim per-permintaan ke backend agar diteruskan
   ke Groq API.
────────────────────────────────────────────── */
function getAIApiKey() {
  return (localStorage.getItem(AI_KEY_STORAGE) || '').trim();
}

function toggleAIKeyModal(paksaBuka) {
  const modal = document.getElementById('aiKeyModal');
  const keyBtn = document.getElementById('aiKeyBtn');
  if (!modal) return;
  const buka = typeof paksaBuka === 'boolean' ? paksaBuka : !modal.classList.contains('open');
  modal.classList.toggle('open', buka);
  if (buka) {
    const input = document.getElementById('aiKeyInput');
    if (input) {
      input.value = getAIApiKey();
      setTimeout(() => input.focus(), 150);
    }
  }
  keyBtn?.classList.toggle('active', !!getAIApiKey());
}

/**
 * Bersihkan input API key dari hal-hal yang sering tidak sengaja ikut
 * ter-copy-paste siswa, misalnya baris utuh dari file .env
 * ("GROQ_API_KEY=gsk_xxx"), tanda kutip, atau spasi berlebih.
 */
function bersihkanGroqKey(raw) {
  let key = (raw || '').trim();
  // Buang prefix "SESUATU=" (mis. "GROQ_API_KEY=") jika ikut ter-paste
  key = key.replace(/^[A-Za-z0-9_]*\s*=\s*/, '');
  // Buang tanda kutip pembuka/penutup jika ada
  key = key.replace(/^["']|["']$/g, '');
  return key.trim();
}

function simpanAIApiKey() {
  const input = document.getElementById('aiKeyInput');
  if (!input) return;
  const key = bersihkanGroqKey(input.value);
  if (!key) {
    showToast(' Masukkan Groq API Key terlebih dahulu', 'warn');
    return;
  }
  if (!/^gsk_[A-Za-z0-9]+$/.test(key)) {
    showToast(' Format key sepertinya salah. Tempel hanya key-nya saja (diawali "gsk_"), tanpa tulisan "GROQ_API_KEY="', 'warn');
    input.value = key; // tampilkan versi yang sudah dibersihkan agar mudah dicek
    return;
  }
  localStorage.setItem(AI_KEY_STORAGE, key);
  document.getElementById('aiKeyBtn')?.classList.add('active');
  toggleAIKeyModal(false);
  showToast(' API Key tersimpan di browser ini', 'success');
  setStatusAI('Siap membantu!');
  state.aiBackendChecked = false;
  cekStatusBackendAI();
}

function hapusAIApiKey() {
  localStorage.removeItem(AI_KEY_STORAGE);
  const input = document.getElementById('aiKeyInput');
  if (input) input.value = '';
  document.getElementById('aiKeyBtn')?.classList.remove('active');
  showToast(' API Key dihapus dari browser ini', 'info');
  setStatusAI('Menunggu API Key');
}

/**
 * DENO AI kini terhubung LANGSUNG ke Groq API dari browser — tidak ada
 * backend lokal yang perlu dicek/dijalankan lewat terminal lagi. Fungsi
 * ini hanya memastikan API key sudah diisi; begitu key tersimpan, AI
 * langsung aktif dan siap dipakai.
 */
async function cekStatusBackendAI() {
  state.aiBackendChecked = true;
  const key = getAIApiKey();
  setStatusAI(key ? 'Siap membantu!' : 'Menunggu API Key');
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

/** Ubah baris baru jadi <br> setelah escaping, untuk balasan AI */
function formatAIReply(text) {
  return escapeHTMLAI(text).replace(/\n/g, '<br>');
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
  bubble.innerHTML = trusted ? text : `<p>${formatAIReply(text)}</p>`;

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
  bubble.innerHTML = `<p><span class="ai-stream-text"></span><span class="ai-stream-cursor"></span></p>`;

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

/** Kirim pertanyaan ke DENO AI LANGSUNG ke Groq API dari browser (tanpa
 * backend/terminal apa pun — cukup API key yang sudah diisi lewat ikon 🔑).
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

  const apiKey = getAIApiKey();
  if (!apiKey) {
    showToast(' Masukkan Groq API Key dulu lewat ikon 🔑', 'warn');
    toggleAIKeyModal(true);
    return;
  }

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

  // Personalisasi system prompt jika info siswa tersedia
  let system = DENO_AI_SYSTEM_PROMPT;
  const nama = state.user?.nama, kelas = state.user?.kelas;
  if (nama || kelas) {
    system += `\nSiswa yang sedang belajar: nama '${nama || '-'}', kelas '${kelas || '-'}'.`;
  }

  const messages = [{ role: 'system', content: system }, ...riwayatBersih, { role: 'user', content: pesan }];

  let bubbleStreaming = null;

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`, // key dikirim langsung dari localStorage browser ke Groq
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: GROQ_MAX_TOKENS,
        temperature: 0.7,
        stream: true,
      }),
    });

    // Status non-200 (mis. 401 key salah/kedaluwarsa, 429 batas terlampaui) —
    // Groq membalas JSON biasa, bukan stream.
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      hapusTypingAI();
      let pesanError;
      if (response.status === 401) {
        pesanError = ' API Key Groq yang kamu masukkan tidak valid atau sudah kedaluwarsa. Klik ikon 🔑 untuk memasukkan key yang benar.';
      } else if (response.status === 429) {
        pesanError = ' Batas permintaan Groq tercapai. Coba lagi sebentar.';
      } else {
        pesanError = data?.error?.message ? ` ${data.error.message}` : ' Maaf, DENO AI sedang tidak bisa diakses. Coba lagi sebentar.';
      }
      tambahBubbleAI('assistant', pesanError, { isError: true, trusted: true });
      setStatusAI('Sedang bermasalah');
      if (response.status === 401) toggleAIKeyModal(true);
      if (state.aiCallMode) { setCallState('Gagal terhubung'); setCallSubtitle(pesanError); }
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
        if (!payload || payload === '[DONE]') continue;

        let json;
        try { json = JSON.parse(payload); } catch { continue; }

        if (json.error) {
          streamError = json.error.message || 'Groq API error';
          continue;
        }

        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          if (!typingDihapus) {
            hapusTypingAI();
            typingDihapus = true;
            bubbleStreaming = buatBubbleStreamingAI();
            setStatusAI('Mengetik...', { thinking: true });
            if (state.aiCallMode) setCallState('Sedang menjawab...');
          }
          fullText += delta;
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
    console.error('Gagal menghubungi Groq API:', err);
    if (bubbleStreaming) bubbleStreaming.closest('.ai-msg')?.remove();
    tambahBubbleAI(
      'assistant',
      ' Tidak dapat terhubung ke Groq API. Cek koneksi internet kamu, lalu coba lagi.',
      { isError: true, trusted: true }
    );
    setStatusAI('Tidak terhubung');
    if (state.aiCallMode) { setCallState('Tidak terhubung'); setCallSubtitle('Tidak dapat terhubung ke Groq API. Cek koneksi internet lalu coba lagi.'); }
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

  // Tandai ikon 🔑 aktif jika API key sudah pernah diisi & tersimpan di browser ini
  if (getAIApiKey()) document.getElementById('aiKeyBtn')?.classList.add('active');

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