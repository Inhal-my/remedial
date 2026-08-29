/**
 * PDF service: generate PDF hasil validasi.
 * Catatan: file ini disiapkan untuk fase admin (generate + notif), tapi aman dipakai kapan pun.
 */

function pdf_embedImageDataUriFromDriveUrl_(fileUrl) {
    const fileId = drive_extractFileIdFromUrl_(fileUrl);
    if (!fileId) return '';
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    const b64 = Utilities.base64Encode(bytes);
    const mt = blob.getContentType() || 'image/jpeg';
    return `data:${mt};base64,${b64}`;
}

// ==========================================
// KONFIGURASI GAMBAR & SIGNATURE DARI DRIVE
// ==========================================
const URL_LOGO_UMSU = 'https://drive.google.com/file/d/1uTPTyAyfhONMsludsnWQMElh35UDopQD/view?usp=sharing';
const URL_LOGO_UNGGUL = 'https://drive.google.com/file/d/1ORe1DAh5NrTMmdmdslbvq89qNi4B7_Bn/view?usp=sharing';
// ⚠️ BUG: URL_TTD_DR_DESI sebelumnya identik dengan URL_LOGO_UNGGUL.
// Ganti dengan URL file TTD asli dari Drive setelah diunggah.
const URL_TTD_DR_DESI = 'https://drive.google.com/file/d/1ORe1DAh5NrTMmdmdslbvq89qNi4B7_Bn/view?usp=sharing';

// Global memory cache untuk logo/TTD demi efisiensi bulk email
const IMAGE_CACHE_ = {};

function pdf_getEmbeddedImage_(url) {
    if (!url) return '';
    if (IMAGE_CACHE_[url]) return IMAGE_CACHE_[url];
    try {
        const base64 = pdf_embedImageDataUriFromDriveUrl_(url);
        IMAGE_CACHE_[url] = base64;
        return base64;
    } catch (e) {
        log_error_('Gagal embed image: ' + url, e);
        return url; // fallback ke URL asli jika terjadi kegagalan konversi
    }
}

function getSemesterFromAngkatan_(angkatan) {
    const clean = String(angkatan || '').trim();
    if (clean === '2025') return 'II';
    if (clean === '2024') return 'IV';
    if (clean === '2023') return 'VI';
    if (clean.toLowerCase() === 'lainnya') return 'Lainnya';
    return clean || 'Lainnya';
}

function formatIndonesianDate_(date) {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    return `${d} ${m} ${y}`;
}

function pdf_buildHasilValidasiHtml_(data) {
    // 1. Ambil berkas template dari Google Apps Script (Pdf.html / pdf.html)
    let html = '';
    try {
        html = HtmlService.createHtmlOutputFromFile('Pdf').getContent();
    } catch (e) {
        try {
            html = HtmlService.createHtmlOutputFromFile('pdf').getContent();
        } catch (err) {
            throw new Error('Berkas template Pdf.html tidak ditemukan di Google Apps Script editor.');
        }
    }

    // 2. Hitung Semester Romawi berdasarkan Angkatan
    const semesterRomawi = getSemesterFromAngkatan_(data.angkatan);

    // 3. Build baris tabel Mata Kuliah
    const tableRows = (data.mkAcc || [])
        .map(it => `<tr>
            <td class="col-name">${it.namaMk}</td>
            <td class="col-sem" style="text-align:center">${semesterRomawi}</td>
            <td class="col-sks" style="text-align:center">${it.sks}</td>
        </tr>`)
        .join('\n');

    // 4. Ambil Base64 Logo & TTD (menggunakan cache memory)
    const logoUmsuB64 = pdf_getEmbeddedImage_(URL_LOGO_UMSU);
    const logoUnggulB64 = pdf_getEmbeddedImage_(URL_LOGO_UNGGUL);
    const ttdDrDesiB64 = pdf_getEmbeddedImage_(URL_TTD_DR_DESI);

    // 5. Format waktu cetak/kirim
    const now = new Date();
    const formattedTimestamp = 'Dibuat: ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    const formattedMedanDate = formatIndonesianDate_(now);

    // 6. Ganti placeholder di template
    html = html
        .replace(/\{\{LOGO_UMSU\}\}/g, logoUmsuB64)
        .replace(/\{\{LOGO_UNGGUL\}\}/g, logoUnggulB64)
        .replace(/\{\{TTD_DR_DESI\}\}/g, ttdDrDesiB64)
        .replace(/\{\{NAMA_LENGKAP\}\}/g, data.namaLengkap || '')
        .replace(/\{\{NPM\}\}/g, data.npm || '')
        .replace(/\{\{NO_HP\}\}/g, data.wa || '')
        .replace(/\{\{SEMESTER\}\}/g, semesterRomawi)
        .replace(/\{\{PAS_FOTO_URL\}\}/g, data.fotoDataUri || '')
        .replace(/\{\{MK_TABLE_BODY\}\}/g, tableRows)
        .replace(/\{\{TOTAL_SKS\}\}/g, String(data.totalSksAcc || 0))
        .replace(/\{\{TIMESTAMP_KIRIM\}\}/g, formattedTimestamp)
        .replace(/\{\{TANGGAL_KIRIM_ID\}\}/g, formattedMedanDate);

    return html;
}

function core_generatePdf(regId) {
    try {
        // 1. Ambil data pendaftaran menggunakan db_list standar
        const registrations = db_list(SHEETS.PENDAFTARAN);
        const regRow = registrations.find(r => String(r.regid) === String(regId));
        if (!regRow) return { status: 'error', message: 'regId tidak ditemukan' };

        // 2. Cek status keputusan pendaftaran
        const statusKeputusan = regRow.statuskeputusan || regRow.statusKeputusan;
        if (String(statusKeputusan) !== STATUS_KEPUTUSAN.SELESAI) {
            return { status: 'error', message: 'Status keputusan belum SELESAI' };
        }
        
        // 3. Cek jumlah MK yang di-ACC
        const jumlahMkAcc = regRow.jumlahmkacc || regRow.jumlahMkAcc;
        if (Number(jumlahMkAcc || 0) <= 0) {
            return { status: 'error', message: 'Tidak ada MK ACC' };
        }

        // 4. Ambil detail pendaftaran mata kuliah
        const details = db_list(SHEETS.PENDAFTARAN_DETAIL).filter(r => String(r.regid) === String(regId));
        const mkAcc = details
            .filter(r => String(r.statusmk) === STATUS_MK.ACC)
            .map(r => ({ namaMk: asString_(r.namamk), sks: Number(r.sks || 0) }));

        const s = getSettings();
        const folderId = drive_getFolderId_(s, 'driveFolderPdfId');

        // 5. Ambil data pas foto
        const fotoUrl = regRow.fotourl || regRow.fotoUrl;
        const fotoDataUri = fotoUrl ? pdf_embedImageDataUriFromDriveUrl_(fotoUrl) : '';
        
        // 6. Buat HTML hasil validasi
        const html = pdf_buildHasilValidasiHtml_({
            periode: asString_(regRow.periode),
            npm: asString_(regRow.npm),
            namaLengkap: asString_(regRow.namalengkap || regRow.namaLengkap),
            angkatan: asString_(regRow.angkatan),
            email: asString_(regRow.email),
            wa: asString_(regRow.wa),
            totalSksAcc: Number(regRow.totalsksacc || regRow.totalSksAcc || 0),
            tarifPerSks: s.tarifPerSks || s.tarifpersks,
            fotoDataUri,
            mkAcc,
        });

        // 7. Render PDF Blob
        const pdfBlob = Utilities.newBlob(html, 'text/html', 'hasil-validasi.html').getAs('application/pdf');
        const fileName = sanitizeFileName_(`HasilValidasi_${regRow.periode}_${regRow.npm}_${regRow.namalengkap || regRow.namaLengkap}.pdf`);
        pdfBlob.setName(fileName);

        // 8. Simpan ke Google Drive
        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(pdfBlob);
        drive_makePublicView_(file);

        const pdfUrl = file.getUrl();
        
        // 9. Update data baris pendaftar menggunakan db_updateRow standar
        db_updateRow(SHEETS.PENDAFTARAN, 'regId', regId, { pdfUrl, pdfCreatedAt: now_() });

        return { status: 'success', pdfUrl };
    } catch (e) {
        log_error_('core_generatePdf gagal', e);
        return { status: 'error', message: String(e && e.message ? e.message : e) };
    }
}

// Semua helpers utility (asString_, now_, log_error_, drive_getFolderId_, sanitizeFileName_, drive_makePublicView_, uuid_, drive_extractFileIdFromUrl_)
// sudah dipindahkan ke Utils.js. Global namespace GAS otomatis menggabungkan semua .gs.


