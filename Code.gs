/* ============================================================
   DENOMATH – Code.gs (Google Apps Script)
   Web App penerima data realtime dari DENOMATH (script.js)
   Menulis ke Spreadsheet "Rekapan DenoMath" (Sheet1)

   STRUKTUR KOLOM SHEET1 (9 kolom — mendukung login KELOMPOK
   juga selain Individu):
   A: Timestamp | B: Nama (atau Nama Kelompok) | C: Kelas/Sekolah
   D: Absen (kosong jika login Kelompok) | E: Nilai Evaluasi
   F: Nilai KB1 | G: Nilai KB2 | H: Tipe (Individu/Kelompok)
   I: Anggota Kelompok (kosong jika login Individu)

   - Kolom A-G TIDAK berubah urutan/isinya dari versi sebelumnya, supaya
     data lama yang sudah ada di Spreadsheet tetap kompatibel.
   - Kolom H (Tipe) & I (Anggota Kelompok) menampung data dari menu
     login "Kelompok" pada DENOMATH (nama kelompok tercatat di kolom B,
     daftar anggotanya di kolom I, satu nama per baris di dalam sel).
   - Nilai Evaluasi  : nilai akhir (0-100) dari kuis "Evaluasi".
   - Nilai KB1 / KB2 : skor rata-rata AI (0-100) hasil koreksi
     seluruh sintaks "Ayo Belajar" pada Kegiatan Belajar 1 / 2.
     Terkirim REALTIME setiap kali satu sintaks baru selesai
     dikoreksi AI, sehingga nilainya makin lengkap seiring murid
     mengerjakan — guru tidak perlu menunggu murid selesai total.
   - HANYA skor akhir yang direkap di sini, bukan teks jawaban
     mentah murid maupun rincian per sintaks.
   - Satu baris mewakili satu murid (login Individu) ATAU satu
     kelompok (login Kelompok) — dicocokkan berdasarkan Nama + Kelas
     + Absen (Absen selalu kosong untuk baris Kelompok, sehingga tidak
     akan tertukar dengan baris murid Individu bernama sama, DAN dua
     kelompok dengan nama sama dari kelas/sekolah berbeda tetap jadi
     baris terpisah karena kelasnya berbeda).

   Spreadsheet tujuan (BARU — menggantikan spreadsheet lama):
   https://docs.google.com/spreadsheets/d/1iBB9cULhgqPKOHNZrSOAWaqRqipcq5JRtoCuh9I1f8A/edit?usp=sharing

   CARA PASANG (WAJIB dilakukan sekali, karena ini spreadsheet BARU
   sehingga belum ada Apps Script Web App yang terpasang di dalamnya —
   Code.gs ini "bound" ke spreadsheet-nya via SpreadsheetApp.getActiveSpreadsheet(),
   jadi HARUS ditempel dari dalam spreadsheet tujuan, bukan sekadar
   didiamkan sebagai file terpisah):
   1. Buka spreadsheet BARU di atas (link "Spreadsheet tujuan").
   2. Menu Ekstensi > Apps Script.
   3. Hapus isi default (Code.gs kosong bawaan), lalu paste SELURUH isi
      file ini menggantikannya.
   4. Klik ikon Simpan (💾).
   5. Klik Deploy > New deployment > ikon gerigi ⚙️ pilih jenis
      "Web app" > Execute as "Me" > Who has access "Anyone" > Deploy.
      (Kalau di kemudian hari isi Code.gs diubah lagi: buka
      Deploy > Manage deployments > ikon pensil pada deployment aktif >
      ganti "Version" ke "New version" > Deploy. Ini WAJIB tiap kali
      Code.gs diubah — kalau cuma disimpan tanpa versi deployment baru,
      Web App yang dipanggil script.js/app.py masih menjalankan kode LAMA.)
   6. Salin URL "Web app" yang muncul (harus berakhiran "/exec").
   7. Tempelkan URL itu ke DUA tempat di project DENOMATH:
      a. GOOGLE_SHEETS_WEBAPP_URL di script.js (dipakai saat website
         di-hosting statis, mis. GitHub Pages — lihat komentar di
         script.js untuk detailnya).
      b. Variabel GOOGLE_SHEETS_URL di file .env pada server (dipakai
         app.py kalau dijalankan sebagai backend Flask, mis. server
         sendiri/Render/Railway, BUKAN GitHub Pages).
   8. Coba login sebagai Individu & Kelompok di DENOMATH lalu cek baris
      baru muncul di Sheet1 (kolom H="Kelompok"/"Individu", kolom I
      terisi nama anggota untuk baris Kelompok).
   ============================================================ */

const SHEET_NAME = 'Sheet1';

// Header kolom sheet ini, urutan = urutan kolom A-I.
const HEADERS = [
  'Timestamp', 'Nama', 'Kelas', 'Absen',
  'Nilai Evaluasi', 'Nilai KB1', 'Nilai KB2',
  'Tipe', 'Anggota Kelompok',
];
// Nomor kolom (1-indexed) untuk field tambahan Tipe & Anggota Kelompok.
const KOL_TIPE = 8;
const KOL_ANGGOTA = 9;

// Peta nama-parameter (dikirim dari script.js, tipe 'progresKB') ->
// nomor kolom (1-indexed). Hanya skor rata-rata tiap KB yang dipakai;
// rincian skor per sintaks & link bukti kerja dari payload TIDAK direkam
// di sheet ini (sengaja disederhanakan sesuai rekap guru).
const FIELD_COLUMN_MAP = {
  kb1_skor_total: 6, // F: Nilai KB1
  kb2_skor_total: 7, // G: Nilai KB2
};

/**
 * Entry point untuk request GET dari script.js (dipakai untuk tipe 'evaluasi').
 */
function doGet(e) {
  return handleRequest(e.parameter);
}

/**
 * Entry point untuk request POST dari script.js (dipakai untuk semua tipe,
 * lewat proxy /api/rekap di app.py). Body dikirim sebagai JSON, sehingga
 * kita parse manual di sini.
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
    const nama = String(params.nama || '').trim();

    // Abaikan request tanpa nama (mis. URL Web App ini dibuka/di-refresh
    // langsung di browser untuk sekadar cek apakah deployment-nya aktif,
    // atau dipanggil tanpa data murid sama sekali) — supaya TIDAK membuat
    // baris kosong (cuma Timestamp terisi) di Spreadsheet.
    if (!nama) {
      return ContentService
        .createTextOutput(JSON.stringify({
          status: 'ok',
          ignored: true,
          message: 'Diabaikan: request tanpa nama murid/kelompok (tidak ditulis ke Spreadsheet).',
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

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
 * saat ini (mis. sheet lama masih 7 kolom), kolom yang kurang (Tipe &
 * Anggota Kelompok) akan otomatis dilengkapi tanpa menghapus data lama.
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
    const existingCount = sheet.getLastColumn();
    const missing = HEADERS.slice(existingCount);
    sheet.getRange(1, existingCount + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, existingCount + 1, 1, missing.length).setFontWeight('bold');
  }
  // Kolom "Anggota Kelompok" bisa berisi beberapa nama sekaligus (satu
  // nama per baris) — supaya tetap enak dibaca guru, sel-nya dibuat wrap
  // teks (bukan meluber ke kolom sebelah) dan kolomnya dilebarkan.
  sheet.getRange(1, KOL_ANGGOTA, Math.max(sheet.getMaxRows(), 2), 1).setWrap(true);
  if (sheet.getColumnWidth(KOL_ANGGOTA) < 220) {
    sheet.setColumnWidth(KOL_ANGGOTA, 260);
  }
  return sheet;
}

/**
 * Mencari baris siswa/kelompok berdasarkan Nama + Kelas + Absen.
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
 * Rapikan label Tipe supaya konsisten di Spreadsheet ("Individu" /
 * "Kelompok"), apa pun huruf besar/kecil yang dikirim dari front-end.
 */
function formatTipe(tipeMentah) {
  const t = String(tipeMentah || 'individu').trim().toLowerCase();
  return t === 'kelompok' ? 'Kelompok' : 'Individu';
}

/**
 * Rapikan daftar Anggota Kelompok: buang baris kosong & spasi berlebih
 * dari tiap nama, tapi TETAP satu nama per baris di dalam sel (mudah
 * dibaca guru, dan sel sudah diset wrap text di getSheetSiap()).
 */
function formatAnggota(anggotaMentah) {
  if (!anggotaMentah) return '';
  return String(anggotaMentah)
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join('\n');
}

/**
 * Menyimpan / memperbarui hasil EVALUASI siswa/kelompok (satu baris per
 * siswa atau per kelompok) ke kolom E (Nilai Evaluasi). Jika baris yang
 * sama sudah pernah mengisi evaluasi sebelumnya, baris itu akan diperbarui
 * (bukan menambah baris baru) agar rekap tetap rapi dan menampilkan hasil
 * evaluasi TERBARU.
 */
function simpanEvaluasi(p) {
  const sheet = getSheetSiap();

  const timestamp = p.timestamp || new Date().toLocaleString('id-ID');
  const nama    = p.nama  || '';
  const kelas   = p.kelas || '';
  const absen   = p.absen || '';
  const nilai   = p.nilai || '';
  const tipe    = formatTipe(p.loginTipe);
  const anggota = formatAnggota(p.anggota);

  const baris = cariBarisSiswa(sheet, nama, kelas, absen);

  if (baris === -1) {
    const row = new Array(HEADERS.length).fill('');
    row[0] = timestamp; row[1] = nama; row[2] = kelas; row[3] = absen; row[4] = nilai;
    row[KOL_TIPE - 1] = tipe; row[KOL_ANGGOTA - 1] = anggota;
    sheet.appendRow(row);
  } else {
    sheet.getRange(baris, 1).setValue(timestamp); // Timestamp
    sheet.getRange(baris, 5).setValue(nilai);      // Nilai Evaluasi
    sheet.getRange(baris, KOL_TIPE).setValue(tipe);
    if (anggota) sheet.getRange(baris, KOL_ANGGOTA).setValue(anggota);
  }
}

/**
 * Memperbarui Nilai KB1 / Nilai KB2 secara realtime — dipanggil setiap
 * kali murid/kelompok menyelesaikan satu sintaks pada "Ayo Belajar" (skor
 * rata-rata terbaru dikirim ulang tiap kali), maupun begitu login (agar
 * baris Nama/Kelas/Tipe/Anggota sudah tercatat sejak awal). Jika baris
 * belum ada, baris baru dibuat. Kolom skor hanya ditimpa jika nilai baru
 * yang dikirim TIDAK kosong, supaya skor yang sudah tersimpan tidak
 * tertimpa string kosong dari sintaks yang belum dikerjakan.
 */
function updateProgresKB(p) {
  const sheet = getSheetSiap();

  const timestamp = p.timestamp || new Date().toLocaleString('id-ID');
  const nama    = p.nama  || '';
  const kelas   = p.kelas || '';
  const absen   = p.absen || '';
  const tipe    = formatTipe(p.loginTipe);
  const anggota = formatAnggota(p.anggota);

  const baris = cariBarisSiswa(sheet, nama, kelas, absen);

  if (baris === -1) {
    const row = new Array(HEADERS.length).fill('');
    row[0] = timestamp; row[1] = nama; row[2] = kelas; row[3] = absen;
    row[KOL_TIPE - 1] = tipe; row[KOL_ANGGOTA - 1] = anggota;
    Object.keys(FIELD_COLUMN_MAP).forEach(key => {
      if (p[key] !== undefined && p[key] !== '') row[FIELD_COLUMN_MAP[key] - 1] = p[key];
    });
    sheet.appendRow(row);
  } else {
    sheet.getRange(baris, 1).setValue(timestamp); // Timestamp terakhir aktif
    sheet.getRange(baris, KOL_TIPE).setValue(tipe);
    if (anggota) sheet.getRange(baris, KOL_ANGGOTA).setValue(anggota);
    Object.keys(FIELD_COLUMN_MAP).forEach(key => {
      if (p[key] !== undefined && p[key] !== '') {
        sheet.getRange(baris, FIELD_COLUMN_MAP[key]).setValue(p[key]);
      }
    });
  }
}