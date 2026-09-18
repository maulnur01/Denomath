/**
 * ============================================================================
 *  DENOMATH — Code.gs  (Google Apps Script)
 *  Rekap nilai realtime (Evaluasi, KB1, KB2) ke Google Spreadsheet.
 * ============================================================================
 *
 *  Spreadsheet tujuan (rekapan BARU):
 *  https://docs.google.com/spreadsheets/d/1iBB9cULhgqPKOHNZrSOAWaqRqipcq5JRtoCuh9I1f8A/edit
 *
 *  CARA PASANG (sekali saja)
 *  -------------------------
 *  1. Buka spreadsheet di atas > menu  Ekstensi > Apps Script.
 *  2. Hapus isi file Code.gs bawaan, tempel SELURUH isi file ini, klik Simpan.
 *  3. Pilih fungsi  siapkan  di dropdown atas, klik  Jalankan. Setujui izin
 *     akses yang diminta Google (hanya dilakukan sekali). Tab "Rekap" beserta
 *     judul kolomnya akan dibuat otomatis.
 *  4. (Opsional, disarankan) Jalankan fungsi  ujiCoba  — akan muncul satu baris
 *     "Siswa Uji Coba" di tab Rekap. Hapus baris itu setelah dicek.
 *  5. Klik  Terapkan (Deploy) > Deployment baru > jenis "Aplikasi web":
 *        - Jalankan sebagai (Execute as)  : Saya (akun Anda)
 *        - Yang memiliki akses (Access)   : Siapa saja (Anyone)   <-- WAJIB
 *          (BUKAN "Siapa saja dengan akun Google", karena murid tidak login.)
 *     Klik Terapkan, lalu SALIN "URL aplikasi web" yang berakhiran  /exec
 *     (BUKAN yang berakhiran /dev).
 *  6. Tempel URL /exec itu ke:
 *        - script.js  -> konstanta  GOOGLE_SHEETS_WEBAPP_URL
 *        - .env       -> GOOGLE_SHEETS_URL   (hanya kalau app.py dipakai)
 *  7. Cek cepat: buka URL /exec tadi di browser. Kalau muncul JSON berisi
 *     "status":"ok", deployment sudah benar.
 *
 *  KALAU KODE INI DIUBAH LAGI
 *  --------------------------
 *  Setiap perubahan baru berlaku untuk murid setelah  Terapkan > Kelola
 *  deployment > (ikon pensil) > Versi: "Versi baru" > Terapkan.  URL /exec
 *  tetap sama, tidak perlu mengganti apa pun di script.js.
 *
 *  CARA KERJA
 *  ----------
 *  - Satu murid/kelompok = SATU baris di tab "Rekap" (kunci: tipe login +
 *    nama + sekolah + no. absen). Data yang datang berikutnya memperbarui
 *    baris yang sama, bukan menambah baris baru.
 *  - Nilai yang kosong pada kiriman baru TIDAK menimpa nilai yang sudah ada.
 *  - Kiriman yang sama dikirim dua kali (mis. kirim ulang otomatis saat sinyal
 *    putus) aman: hasilnya tetap sama, percobaan evaluasi tidak dobel.
 *  - Guru boleh mengurutkan/memfilter tab Rekap; baris dicari lewat kolom
 *    kunci (tersembunyi, kolom terakhir), bukan lewat nomor baris.
 *  - LockService mencegah baris ganda saat banyak murid mengirim bersamaan.
 * ============================================================================
 */

/* ── PENGATURAN ──────────────────────────────────────────────────────────── */
const SPREADSHEET_ID   = '1iBB9cULhgqPKOHNZrSOAWaqRqipcq5JRtoCuh9I1f8A';
const NAMA_SHEET_REKAP = 'Rekap';
const NAMA_SHEET_LOG   = 'Log';
const ZONA_WAKTU       = 'Asia/Jakarta';
const TUNGGU_LOCK_MS   = 30000;
// true = setiap kiriman juga dicatat di tab "Log" (berguna saat uji coba /
// pelacakan masalah). Dimatikan secara bawaan agar penyimpanan lebih cepat
// saat banyak murid mengirim sekaligus.
const SIMPAN_LOG       = false;

/* ── DEFINISI KOLOM TAB "REKAP" ──────────────────────────────────────────────
 * key   : nama field pada kiriman dari script.js (untuk kolom kb*) atau nama internal
 * jenis : 'teks' | 'angka' | 'waktu'  (menentukan format sel)
 * Urutan di sini = urutan kolom di spreadsheet. */
const KOLOM = [
  { key: 'nama',      judul: 'Nama / Kelompok',            jenis: 'teks',  lebar: 190 },
  { key: 'kelas',     judul: 'Sekolah',                    jenis: 'teks',  lebar: 170 },
  { key: 'absen',     judul: 'No. Absen',                  jenis: 'angka', lebar: 80  },
  { key: 'loginTipe', judul: 'Tipe Login',                 jenis: 'teks',  lebar: 90  },
  { key: 'anggota',   judul: 'Anggota Kelompok',           jenis: 'teks',  lebar: 220 },
  { key: 'loginAwal', judul: 'Login Pertama',              jenis: 'waktu', lebar: 150 },
  { key: 'update',    judul: 'Update Terakhir',            jenis: 'waktu', lebar: 150 },

  { key: 'nilai',     judul: 'Nilai Evaluasi (Terakhir)',  jenis: 'angka', lebar: 110 },
  { key: 'nilaiMax',  judul: 'Nilai Evaluasi (Tertinggi)', jenis: 'angka', lebar: 110 },
  { key: 'skor',      judul: 'Jawaban Benar',              jenis: 'angka', lebar: 90  },
  { key: 'total',     judul: 'Jumlah Soal',                jenis: 'angka', lebar: 90  },
  { key: 'grade',     judul: 'Grade',                      jenis: 'teks',  lebar: 130 },
  { key: 'percobaan', judul: 'Percobaan Evaluasi',         jenis: 'angka', lebar: 100 },
  { key: 'detail',    judul: 'Detail Jawaban Evaluasi',    jenis: 'teks',  lebar: 240 },
  { key: 'waktuEval', judul: 'Waktu Evaluasi Terakhir',    jenis: 'teks',  lebar: 150 },

  { key: 'kb1',                judul: 'KB1 Status',             jenis: 'teks',  lebar: 90  },
  { key: 'kb1_skor_eq',        judul: 'KB1 Essential Question', jenis: 'angka', lebar: 100 },
  { key: 'kb1_skor_challenge', judul: 'KB1 Challenge',          jenis: 'angka', lebar: 90  },
  { key: 'kb1_skor_gq',        judul: 'KB1 Guiding Question',   jenis: 'angka', lebar: 100 },
  { key: 'kb1_skor_ga',        judul: 'KB1 Guiding Activity',   jenis: 'angka', lebar: 100 },
  { key: 'kb1_skor_asesmen',   judul: 'KB1 Asesmen',            jenis: 'angka', lebar: 90  },
  { key: 'kb1_skor_total',     judul: 'KB1 Skor Total',         jenis: 'angka', lebar: 90  },
  { key: 'kb1_publikasi',      judul: 'KB1 Link Publikasi',     jenis: 'teks',  lebar: 220 },
  { key: 'kb1_ga_link',        judul: 'KB1 Link Guiding Activity', jenis: 'teks', lebar: 220 },

  { key: 'kb2',                judul: 'KB2 Status',             jenis: 'teks',  lebar: 90  },
  { key: 'kb2_skor_eq',        judul: 'KB2 Essential Question', jenis: 'angka', lebar: 100 },
  { key: 'kb2_skor_challenge', judul: 'KB2 Challenge',          jenis: 'angka', lebar: 90  },
  { key: 'kb2_skor_gq',        judul: 'KB2 Guiding Question',   jenis: 'angka', lebar: 100 },
  { key: 'kb2_skor_ga',        judul: 'KB2 Guiding Activity',   jenis: 'angka', lebar: 100 },
  { key: 'kb2_skor_asesmen',   judul: 'KB2 Asesmen',            jenis: 'angka', lebar: 90  },
  { key: 'kb2_skor_total',     judul: 'KB2 Skor Total',         jenis: 'angka', lebar: 90  },
  { key: 'kb2_publikasi',      judul: 'KB2 Link Publikasi',     jenis: 'teks',  lebar: 220 },
  { key: 'kb2_ga_link',        judul: 'KB2 Link Guiding Activity', jenis: 'teks', lebar: 220 },

  { key: 'kunci',     judul: 'Kunci (jangan diubah)',      jenis: 'teks',  lebar: 120 },
];

const IDX = {};
KOLOM.forEach(function (k, i) { IDX[k.key] = i; });

// Field kiriman "progresKB" yang disalin ke baris bila tidak kosong.
const FIELD_KB_SKOR = [
  'kb1_skor_eq', 'kb1_skor_challenge', 'kb1_skor_gq', 'kb1_skor_ga', 'kb1_skor_asesmen', 'kb1_skor_total',
  'kb2_skor_eq', 'kb2_skor_challenge', 'kb2_skor_gq', 'kb2_skor_ga', 'kb2_skor_asesmen', 'kb2_skor_total',
];
const FIELD_KB_TEKS = [
  'kb1', 'kb2', 'kb1_publikasi', 'kb1_ga_link', 'kb2_publikasi', 'kb2_ga_link',
];

/* ── PINTU MASUK WEB APP ─────────────────────────────────────────────────── */

/** GET: dipakai script.js (data di query string) + cek deployment dari browser. */
function doGet(e) {
  return proses_((e && e.parameter) ? e.parameter : {});
}

/** POST: dipakai proxy Flask (app.py) — body JSON, atau form-encoded sebagai cadangan. */
function doPost(e) {
  var p = {};
  try {
    if (e && e.postData && e.postData.contents) {
      p = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      p = e.parameter;
    }
  } catch (err) {
    p = (e && e.parameter) ? e.parameter : {};
  }
  return proses_(p);
}

function proses_(p) {
  try {
    return jsonOut_(simpan_(p || {}));
  } catch (err) {
    return jsonOut_({ status: 'error', message: String(err && err.message ? err.message : err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── INTI PENYIMPANAN ────────────────────────────────────────────────────── */

function simpan_(p) {
  var tipe = bersih_(p.tipe, 20);

  // Tanpa "tipe" = hanya cek deployment (mis. URL dibuka di browser).
  if (!tipe) {
    return { status: 'ok', message: 'Web App rekap DENOMATH aktif. Kirim data lewat aplikasi DENOMATH.' };
  }
  if (tipe !== 'evaluasi' && tipe !== 'progresKB') {
    throw new Error('Tipe rekap tidak dikenal: ' + tipe);
  }

  var nama  = bersih_(p.nama, 100);
  var kelas = bersih_(p.kelas, 100);
  if (!nama || !kelas) {
    throw new Error('Nama dan sekolah wajib ada pada kiriman rekap.');
  }
  var loginTipe = bersih_(p.loginTipe, 20).toLowerCase() === 'kelompok' ? 'kelompok' : 'individu';
  var absenTeks = bersih_(p.absen, 10);
  var kunci = [loginTipe, normal_(nama), normal_(kelas), normal_(absenTeks)].join('|');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(TUNGGU_LOCK_MS);
  } catch (err) {
    throw new Error('Server rekap sedang sibuk. Coba lagi sebentar.');
  }

  try {
    var sheet = ambilSheetRekap_();
    var n = KOLOM.length;

    // Cari baris murid lewat kolom kunci.
    var baris = -1;
    var terakhir = sheet.getLastRow();
    if (terakhir >= 2) {
      var daftarKunci = sheet.getRange(2, IDX.kunci + 1, terakhir - 1, 1).getValues();
      for (var i = 0; i < daftarKunci.length; i++) {
        if (daftarKunci[i][0] === kunci) { baris = i + 2; break; }
      }
    }

    var sekarang = new Date();
    var baru = (baris === -1);
    var data;
    if (baru) {
      baris = Math.max(terakhir, 1) + 1;
      if (baris > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      data = [];
      for (var c = 0; c < n; c++) data.push('');
      data[IDX.nama]      = nama;
      data[IDX.kelas]     = kelas;
      data[IDX.absen]     = angka_(absenTeks) !== null ? angka_(absenTeks) : absenTeks;
      data[IDX.loginTipe] = loginTipe === 'kelompok' ? 'Kelompok' : 'Individu';
      data[IDX.loginAwal] = sekarang;
      data[IDX.kunci]     = kunci;
    } else {
      data = sheet.getRange(baris, 1, 1, n).getValues()[0];
    }

    var anggota = bersih_(p.anggota, 250);
    if (anggota) data[IDX.anggota] = anggota;

    if (tipe === 'evaluasi') {
      terapkanEvaluasi_(data, p);
    } else {
      terapkanProgresKB_(data, p);
    }
    data[IDX.update] = sekarang;

    sheet.getRange(baris, 1, 1, n).setValues([data]);

    if (SIMPAN_LOG) catatLog_(sekarang, tipe, nama, kelas, absenTeks, p);

    return { status: 'ok', aksi: baru ? 'baru' : 'update', baris: baris };
  } finally {
    lock.releaseLock();
  }
}

/** Nilai evaluasi. Percobaan baru dihitung hanya bila timestamp kiriman berbeda. */
function terapkanEvaluasi_(data, p) {
  var nilai = angka_(p.nilai);
  if (nilai === null || nilai < 0 || nilai > 100) {
    throw new Error('Nilai evaluasi tidak valid.');
  }
  nilai = Math.round(nilai);

  var waktu = bersih_(p.timestamp, 40);
  var percobaan = Number(data[IDX.percobaan]) || 0;
  if (!waktu || waktu !== String(data[IDX.waktuEval])) percobaan++;

  data[IDX.nilai]     = nilai;
  data[IDX.nilaiMax]  = Math.max(nilai, Number(data[IDX.nilaiMax]) || 0);
  data[IDX.percobaan] = percobaan;
  data[IDX.waktuEval] = waktu;

  var skor  = angka_(p.skor);
  var total = angka_(p.total);
  if (skor !== null)  data[IDX.skor]  = skor;
  if (total !== null) data[IDX.total] = total;
  var grade = bersih_(p.grade, 40);
  if (grade) data[IDX.grade] = grade;
  var detail = bersih_(p.detail, 400);
  if (detail) data[IDX.detail] = detail;
}

/** Progres KB1/KB2: hanya field yang tidak kosong yang menimpa isi baris. */
function terapkanProgresKB_(data, p) {
  FIELD_KB_SKOR.forEach(function (f) {
    var v = angka_(p[f]);
    if (v !== null) data[IDX[f]] = Math.max(0, Math.min(100, Math.round(v)));
  });
  FIELD_KB_TEKS.forEach(function (f) {
    var v = bersih_(p[f], 500);
    if (v) data[IDX[f]] = v;
  });
}

/* ── SHEET & FORMAT ──────────────────────────────────────────────────────── */

function ambilSheetRekap_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(NAMA_SHEET_REKAP);
  return sh ? sh : buatSheetRekap_(ss);
}

function buatSheetRekap_(ss) {
  ss.setSpreadsheetTimeZone(ZONA_WAKTU);

  // Spreadsheet baru biasanya berisi satu sheet kosong bawaan: pakai ulang.
  var semua = ss.getSheets();
  var sh;
  if (semua.length === 1 && semua[0].getLastRow() === 0) {
    sh = semua[0];
    sh.setName(NAMA_SHEET_REKAP);
  } else {
    sh = ss.insertSheet(NAMA_SHEET_REKAP, 0);
  }

  if (sh.getMaxColumns() < KOLOM.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), KOLOM.length - sh.getMaxColumns());
  }

  sh.getRange(1, 1, 1, KOLOM.length)
    .setValues([KOLOM.map(function (k) { return k.judul; })])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1e3a8a')
    .setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center');
  sh.setRowHeight(1, 48);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  // Format teks ('@') juga mencegah isian murid yang diawali "=" dibaca sebagai rumus.
  var jumlahBaris = Math.max(sh.getMaxRows() - 1, 1);
  KOLOM.forEach(function (k, i) {
    var rg = sh.getRange(2, i + 1, jumlahBaris, 1);
    if (k.jenis === 'teks')       rg.setNumberFormat('@');
    else if (k.jenis === 'waktu') rg.setNumberFormat('dd/MM/yyyy HH:mm:ss');
    else                          rg.setNumberFormat('0');
    sh.setColumnWidth(i + 1, k.lebar);
  });

  sh.hideColumns(IDX.kunci + 1);
  return sh;
}

function catatLog_(waktu, tipe, nama, kelas, absen, p) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var log = ss.getSheetByName(NAMA_SHEET_LOG);
  if (!log) {
    log = ss.insertSheet(NAMA_SHEET_LOG);
    log.getRange(1, 1, 1, 6).setValues([['Waktu', 'Tipe', 'Nama', 'Sekolah', 'Absen', 'Kiriman mentah']])
      .setFontWeight('bold');
    log.setFrozenRows(1);
    log.getRange('A:F').setNumberFormat('@');
  }
  log.appendRow([waktu.toISOString(), tipe, nama, kelas, absen, JSON.stringify(p).slice(0, 2000)]);
}

/* ── PEMBANTU ────────────────────────────────────────────────────────────── */

/** Buang karakter kontrol, rapikan spasi, batasi panjang. */
function bersih_(v, maks) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks || 200);
}

/** Bentuk baku untuk kunci pencocokan (huruf kecil, spasi tunggal). */
function normal_(v) {
  return bersih_(v, 100).toLowerCase();
}

/** Angka valid atau null (kosong / bukan angka). Koma desimal diterima. */
function angka_(v) {
  var s = bersih_(v, 20).replace(',', '.');
  if (s === '') return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}

/* ── FUNGSI YANG DIJALANKAN MANUAL DARI EDITOR ───────────────────────────── */

/** Jalankan sekali: membuat tab Rekap + meminta izin akses. */
function siapkan() {
  ambilSheetRekap_();
  Logger.log('Tab "' + NAMA_SHEET_REKAP + '" siap dipakai.');
}

/** Mengirim satu data contoh, untuk memastikan penulisan ke spreadsheet berjalan. */
function ujiCoba() {
  var r1 = proses_({ tipe: 'progresKB', nama: 'Siswa Uji Coba', kelas: 'SMP Uji Coba', absen: '1',
                     loginTipe: 'individu', kb1_skor_eq: '80', kb1_skor_total: '80' });
  var r2 = proses_({ tipe: 'evaluasi', nama: 'Siswa Uji Coba', kelas: 'SMP Uji Coba', absen: '1',
                     loginTipe: 'individu', timestamp: '01/01/2026 08.00.00', skor: '8', total: '10',
                     nilai: '80', grade: 'B – Baik', detail: 'S1:B | S2:S' });
  Logger.log(r1.getContent());
  Logger.log(r2.getContent());
}
