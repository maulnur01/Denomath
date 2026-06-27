/* ============================================================
   DENOMATH – Code.gs (Google Apps Script)
   Web App penerima data realtime dari DENOMATH (script.js)
   Menulis ke Spreadsheet "Rekapan DenoMath" (Sheet1)

   STRUKTUR KOLOM SHEET1:
   A: Timestamp | B: Nama | C: Kelas | D: Nilai | E: Grade
   F: Status KB1 | G: Status KB2

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

// Header kolom yang dipakai sheet ini
const HEADERS = ['Timestamp', 'Nama', 'Kelas', 'Absen', 'Nilai', 'Grade', 'Status KB1', 'Status KB2'];

/**
 * Entry point untuk request GET dari script.js (fetch mode no-cors via GET).
 * Menerima parameter:
 *   tipe   : 'evaluasi' | 'progresKB'
 *   nama, absen, kelas
 *   --- jika tipe evaluasi ---
 *   skor, total, nilai, grade, detail
 *   --- jika tipe progresKB ---
 *   kb1, kb2  (masing-masing 'selesai' atau kosong)
 */
function doGet(e) {
  try {
    const params = e.parameter;
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

  const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
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
    sheet.appendRow([timestamp, nama, kelas, absen, nilai, grade, '', '']);
  } else {
    sheet.getRange(baris, 1).setValue(timestamp); // Timestamp
    sheet.getRange(baris, 5).setValue(nilai);      // Nilai
    sheet.getRange(baris, 6).setValue(grade);      // Grade
  }
}

/**
 * Memperbarui status KB1 / KB2 siswa secara realtime.
 * Dipanggil setiap kali siswa menyelesaikan satu Kegiatan Belajar.
 * Jika baris siswa belum ada (belum pernah evaluasi), baris baru dibuat.
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
    sheet.appendRow([timestamp, nama, kelas, absen, '', '', kb1, kb2]);
  } else {
    sheet.getRange(baris, 1).setValue(timestamp); // Timestamp terakhir aktif
    if (kb1) sheet.getRange(baris, 7).setValue(kb1); // Status KB1
    if (kb2) sheet.getRange(baris, 8).setValue(kb2); // Status KB2
  }
}