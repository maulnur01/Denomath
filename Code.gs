/* ============================================================
   DENOMATH – Code.gs (Google Apps Script)
   Web App penerima data realtime dari DENOMATH (script.js)
   Menulis ke Spreadsheet "Rekapan DenoMath" (Sheet1)

   STRUKTUR KOLOM SHEET1 (lihat array HEADERS di bawah):
   A: Timestamp | B: Nama | C: Kelas | D: Absen | E: Nilai | F: Grade
   G: Status KB1 | H: Status KB2
   I-N : Rekap jawaban murid KB 1 per sintaks (Ayo Belajar)
         (Essential Question, Challenge, Guiding Question,
          Guiding Activity, Asesmen/Soal Penutup, Publikasi)
   O-T : Rekap jawaban murid KB 2 per sintaks (struktur sama)

   Rekap ini terkirim REALTIME: setiap kali murid menekan tombol
   "Lanjut" di satu sintaks (setelah sintaks itu terisi lengkap) ATAU
   saat satu kolom isian selesai diketik (kehilangan fokus), browser
   mengirim ulang seluruh jawaban terbaru ke sheet ini, sehingga guru
   bisa memantau progres pengisian tiap sintaks — termasuk argumen
   murid pada Essential Question — secara langsung tanpa perlu
   menunggu murid menekan "Selesaikan KB".

   CARA PASANG:
   1. Buka spreadsheet "Rekapan DenoMath".
   2. Menu Ekstensi > Apps Script.
   3. Hapus isi default, lalu paste seluruh isi file ini.
   4. Klik ikon Simpan (💾).
   5. Klik Deploy > New deployment.
      - Pilih jenis: Web app
      - Execute as: Me
      - Who has access: Anyone
   6. Klik Deploy, salin URL "Web app" yang muncul.
   7. Tempel URL tersebut ke variabel SHEETS_URL di script.js.
   8. Setiap ada perubahan kode ini, gunakan
      Deploy > Manage deployments > Edit (pensil) > Deploy ulang
      agar URL tetap sama dan perubahan berlaku.
   ============================================================ */

const SHEET_NAME = 'Sheet1';

// Header kolom yang dipakai sheet ini (urutan = urutan kolom di sheet).
// Kolom 9-20 = RINGKASAN per sintaks (cepat dibaca sekilas).
// Kolom 21+  = RINCIAN per butir soal/isian formulir (rekap detail per sintaks),
//              satu kolom per pertanyaan, supaya guru bisa menilai jawaban murid
//              butir-demi-butir tanpa perlu membuka aplikasi.
const HEADERS = [
  'Timestamp', 'Nama', 'Kelas', 'Absen', 'Nilai', 'Grade', 'Status KB1', 'Status KB2',
  'KB1 - Ringkasan Essential Question', 'KB1 - Ringkasan Challenge', 'KB1 - Ringkasan Guiding Question',
  'KB1 - Ringkasan Guiding Activity', 'KB1 - Ringkasan Asesmen (Soal Penutup)', 'KB1 - Link Publikasi',
  'KB2 - Ringkasan Essential Question', 'KB2 - Ringkasan Challenge', 'KB2 - Ringkasan Guiding Question',
  'KB2 - Ringkasan Guiding Activity', 'KB2 - Ringkasan Asesmen (Soal Penutup)', 'KB2 - Link Publikasi',

  // ---- RINCIAN KB1 (kolom 21-40) ----
  'KB1 EQ1 - Modus Tabungan', 'KB1 EQ2 - Metode Pengumpulan Data', 'KB1 EQ3 - Jenis Data (Kategorik/Numerik)',
  'KB1 Challenge - Rencana Poster Kelompok',
  'KB1 GQ1 - Analisis Harga vs Pendapatan', 'KB1 GQ2 - Prioritas Peningkatan Panen',
  'KB1 GA - Frekuensi n=5', 'KB1 GA - Frekuensi n=6', 'KB1 GA - Frekuensi n=7',
  'KB1 GA - Frekuensi n=8', 'KB1 GA - Frekuensi n=9',
  'KB1 GA - Harga Baru Cabai', 'KB1 GA - Harga Baru Wortel', 'KB1 GA - Harga Baru Tomat',
  'KB1 GA - Harga Baru Ubi', 'KB1 GA - Harga Baru Kentang', 'KB1 GA - Link Foto/Drive',
  'KB1 Asesmen (a) - Medsos Tertinggi/Terendah', 'KB1 Asesmen (b) - Perubahan Persentase',
  'KB1 Asesmen (c) - Kesimpulan Tren',

  // ---- RINCIAN KB2 (kolom 41-57) ----
  'KB2 EQ1 - Saham Bagian Terbesar', 'KB2 EQ2 - Saham Bagian Terkecil', 'KB2 EQ3 - Alasan Proporsi Volume',
  'KB2 Challenge - Pilihan Jenis Diagram',
  'KB2 GQ1 - Diagram Tepat untuk Data', 'KB2 GQ2 - Info dari Diagram', 'KB2 GQ3 - Kesimpulan Pendapatan',
  'KB2 GA - Data Keripik', 'KB2 GA - Data Roti', 'KB2 GA - Data Minuman', 'KB2 GA - Data Permen',
  'KB2 GA - Link Foto/Drive',
  'KB2 Asesmen (a) - Persentase Kelompok D', 'KB2 Asesmen (b) - Perhitungan Tabungan',
  'KB2 Asesmen (c) - Kesimpulan Tabungan', 'KB2 Asesmen (a2) - Jenis Diagram Lauk',
  'KB2 Asesmen (b2) - Kesimpulan Harga Lauk',
];

// Peta nama-parameter (dikirim dari script.js) -> nomor kolom (1-indexed).
// Bagian atas = ringkasan (kompatibel dengan versi sebelumnya).
// Bagian "d_..." = rincian per butir soal (fitur baru).
const FIELD_COLUMN_MAP = {
  kb1_essentialQ: 9,  kb1_challenge: 10, kb1_guidingQuestion: 11,
  kb1_guidingActivity: 12, kb1_asesmen: 13, kb1_publikasi: 14,
  kb2_essentialQ: 15, kb2_challenge: 16, kb2_guidingQuestion: 17,
  kb2_guidingActivity: 18, kb2_asesmen: 19, kb2_publikasi: 20,

  // Rincian KB1
  d_kb1_eq1: 21, d_kb1_eq2: 22, d_kb1_eq3: 23,
  d_kb1_challenge: 24,
  d_kb1_gq1: 25, d_kb1_gq2: 26,
  d_kb1_freq5: 27, d_kb1_freq6: 28, d_kb1_freq7: 29, d_kb1_freq8: 30, d_kb1_freq9: 31,
  d_kb1_hkb1: 32, d_kb1_hkb2: 33, d_kb1_hkb3: 34, d_kb1_hkb4: 35, d_kb1_hkb5: 36,
  d_kb1_link: 37,
  d_kb1_as1: 38, d_kb1_as2: 39, d_kb1_as3: 40,

  // Rincian KB2
  d_kb2_eq1: 41, d_kb2_eq2: 42, d_kb2_eq3: 43,
  d_kb2_challenge: 44,
  d_kb2_gq1: 45, d_kb2_gq2: 46, d_kb2_gq3: 47,
  d_kb2_h1: 48, d_kb2_h2: 49, d_kb2_h3: 50, d_kb2_h4: 51,
  d_kb2_link: 52,
  d_kb2_as1: 53, d_kb2_as2: 54, d_kb2_as3: 55, d_kb2_as4: 56, d_kb2_as5: 57,
};

/**
 * Entry point untuk request GET dari script.js (dipakai untuk tipe 'evaluasi').
 */
function doGet(e) {
  return handleRequest(e.parameter);
}

/**
 * Entry point untuk request POST dari script.js (dipakai untuk tipe 'progresKB',
 * karena payload-nya bisa cukup panjang berisi banyak jawaban esai murid).
 * Body dikirim sebagai teks JSON (Content-Type: text/plain, agar bebas dari
 * CORS preflight), sehingga kita parse manual di sini.
 */
function doPost(e) {
  let params = {};
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    params = e.parameter || {};
  }
  return handleRequest(params);
}

function handleRequest(params) {
  try {
    const tipe = params.tipe || 'evaluasi';

    if (tipe === 'progresKB') {
      updateProgresKB(params);
    } else {
      simpanEvaluasi(params);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Memastikan sheet ada dan punya header. Mengembalikan objek Sheet.
 * Jika header sudah ada tapi jumlah kolomnya lebih sedikit dari HEADERS
 * saat ini (mis. sheet lama sebelum fitur rekap sintaks ditambahkan),
 * kolom yang kurang akan otomatis dilengkapi tanpa menghapus data lama.
 */
function getSheetSiap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  const headerRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headerKosong = headerRow.every(h => h === '' || h === null);
  if (headerKosong) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < HEADERS.length) {
    // Sheet lama: lengkapi header kolom baru (rekap sintaks) yang belum ada
    const existingCount = sheet.getLastColumn();
    const missing = HEADERS.slice(existingCount);
    sheet.getRange(1, existingCount + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, existingCount + 1, 1, missing.length).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Mencari baris siswa berdasarkan Nama + Kelas + Absen.
 * Mengembalikan nomor baris (1-indexed) atau -1 jika belum ada.
 */
function cariBarisSiswa(sheet, nama, kelas, absen) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = 0; i < data.length; i++) {
    const rowNama  = String(data[i][1]).trim().toLowerCase();
    const rowKelas = String(data[i][2]).trim().toLowerCase();
    const rowAbsen = String(data[i][3]).trim();
    if (rowNama === String(nama).trim().toLowerCase() &&
        rowKelas === String(kelas).trim().toLowerCase() &&
        rowAbsen === String(absen).trim()) {
      return i + 2; // +2 karena data dimulai dari baris ke-2 (setelah header)
    }
  }
  return -1;
}

/**
 * Menyimpan / memperbarui hasil EVALUASI siswa (satu baris per siswa).
 * Jika siswa sudah pernah mengisi evaluasi sebelumnya, baris yang sama
 * akan diperbarui (bukan menambah baris baru) agar rekap tetap rapi
 * dan menampilkan hasil evaluasi TERBARU.
 */
function simpanEvaluasi(p) {
  const sheet = getSheetSiap();

  const timestamp = p.timestamp || new Date().toLocaleString('id-ID');
  const nama   = p.nama  || '';
  const kelas  = p.kelas || '';
  const absen  = p.absen || '';
  const nilai  = p.nilai || '';
  const grade  = p.grade || '';

  const baris = cariBarisSiswa(sheet, nama, kelas, absen);

  if (baris === -1) {
    const row = new Array(HEADERS.length).fill('');
    row[0] = timestamp; row[1] = nama; row[2] = kelas; row[3] = absen; row[4] = nilai; row[5] = grade;
    sheet.appendRow(row);
  } else {
    sheet.getRange(baris, 1).setValue(timestamp); // Timestamp
    sheet.getRange(baris, 5).setValue(nilai);      // Nilai
    sheet.getRange(baris, 6).setValue(grade);      // Grade
  }
}

/**
 * Memperbarui status KB1 / KB2 + rekap jawaban tiap sintaks secara realtime.
 * Dipanggil setiap kali murid menyelesaikan satu sintaks pada "Ayo Belajar"
 * (bukan hanya saat KB selesai sepenuhnya), sehingga guru bisa memantau
 * progres pengisian jawaban murid secara langsung.
 * Jika baris siswa belum ada (belum pernah evaluasi), baris baru dibuat.
 * Kolom hanya ditimpa jika nilai baru yang dikirim TIDAK kosong, supaya
 * jawaban yang sudah tersimpan tidak tertimpa string kosong dari sintaks
 * yang belum dikerjakan.
 */
function updateProgresKB(p) {
  const sheet = getSheetSiap();

  const timestamp = p.timestamp || new Date().toLocaleString('id-ID');
  const nama   = p.nama  || '';
  const kelas  = p.kelas || '';
  const absen  = p.absen || '';
  const kb1    = p.kb1 || '';
  const kb2    = p.kb2 || '';

  const baris = cariBarisSiswa(sheet, nama, kelas, absen);

  if (baris === -1) {
    const row = new Array(HEADERS.length).fill('');
    row[0] = timestamp; row[1] = nama; row[2] = kelas; row[3] = absen;
    row[6] = kb1; row[7] = kb2;
    Object.keys(FIELD_COLUMN_MAP).forEach(key => {
      if (p[key]) row[FIELD_COLUMN_MAP[key] - 1] = p[key];
    });
    sheet.appendRow(row);
  } else {
    sheet.getRange(baris, 1).setValue(timestamp); // Timestamp terakhir aktif
    if (kb1) sheet.getRange(baris, 7).setValue(kb1); // Status KB1
    if (kb2) sheet.getRange(baris, 8).setValue(kb2); // Status KB2
    Object.keys(FIELD_COLUMN_MAP).forEach(key => {
      if (p[key]) sheet.getRange(baris, FIELD_COLUMN_MAP[key]).setValue(p[key]);
    });
  }
}