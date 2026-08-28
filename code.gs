// ============================================================
// codegs.js - Google Apps Script Backend
// Scope: index.html (Formulir Pendaftaran Remedial)
// ============================================================

function doGet(e) {
    var page = (e && e.parameter && e.parameter.page) || 'index';

    if (page === 'index') {
        var availability = checkFormAvailability();
        if (!availability.isAvailable) {
            return createAvailabilityInfoPage_('Informasi Pendaftaran', availability.message, 'Informasi Pendaftaran');
        }
    }

    if (page === 'upload') {
        var uploadAvailability = checkUploadFormAvailability();
        if (!uploadAvailability.isAvailable) {
            return createAvailabilityInfoPage_('Informasi', uploadAvailability.message, 'Informasi');
        }
    }

    var title = '';
    if (page === 'index') title = 'Formulir Pendaftaran Remedial';
    else if (page === 'upload') title = 'Formulir Unggah Bukti Pembayaran';
    else return HtmlService.createHtmlOutput('Halaman tidak ditemukan');
    return HtmlService.createHtmlOutputFromFile(page)
        .setTitle(title)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createAvailabilityInfoPage_(heading, message, title) {
    return HtmlService.createHtmlOutput(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<base target="_top">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">' +
        '<script src="https://cdn.tailwindcss.com"></script>' +
        '<script>' +
        'tailwind.config = {' +
        '    theme: {' +
        '        extend: {' +
        '            colors: {' +
        '                primary: "#003087",' +
        '                primaryHover: "#00205b",' +
        '            }' +
        '        }' +
        '    }' +
        '}' +
        '</script>' +
        '<title>' + title + '</title>' +
        '</head>' +
        '<body class="bg-gray-100 flex items-center justify-center min-h-screen p-4">' +
        '<div class="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">' +
        '<div class="flex justify-center mb-4">' +
        '<i class="material-icons text-6xl text-primary">info</i>' +
        '</div>' +
        '<h1 class="text-2xl font-bold text-gray-800 mb-4">' + heading + '</h1>' +
        '<p class="text-gray-600 mb-6">' + message + '</p>' +
        '</div>' +
        '</body>' +
        '</html>'
    )
        .setTitle(title)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// HELPER: Spreadsheet & Drive IDs
// ============================================================

function getSpreadsheetId() {
    return '1gCjXbVQov45y8C1ZqUQV_kBvRmUTfVmsPGrTvBaPznU';
}

function getFolderId() {
    return '1DiCSwBKhNNhk1t0tAbEiqA7aveRmIGy7';
}

// ============================================================
// HELPER: Schema & Utility
// ============================================================

var _SCHEMA_PENDAFTARAN = {
    timestamp: ['timestamp'],
    npm: ['npm'],
    nama: ['nama lengkap', 'nama'],
    email: ['email'],
    hp: ['no. hp/wa', 'no. hpwa', 'hp', 'no. hp'],
    angkatan: ['angkatan'],
    semester: ['semester'],
    pasfoto: ['pasfoto url', 'foto 3x4', 'pas foto', 'pasfoto'],
    krs: ['krs url', 'krs semester genap', 'krs']
};

function _resolveIndices(headers, schema, defaults) {
    var res = {};
    for (var k in schema) {
        var idx = -1;
        var variants = schema[k];
        for (var i = 0; i < variants.length; i++) {
            var found = headers.indexOf(String(variants[i]).toLowerCase());
            if (found >= 0) { idx = found; break; }
        }
        if (idx < 0 && typeof defaults[k] === 'number') idx = defaults[k];
        res[k] = idx;
    }
    return res;
}

function buildPendaftaranSupabaseRow_(headers, row) {
    if (!headers || !row) return null;
    var headersLower = headers.map(function (h) { return String(h).trim().toLowerCase(); });
    var idxMapP = _resolveIndices(headersLower, _SCHEMA_PENDAFTARAN, {
        timestamp: 0, npm: 1, nama: 2, email: 3, hp: 4, angkatan: 5, semester: 6, pasfoto: 7, krs: 8
    });
    var idxTimestamp = idxMapP.timestamp;
    var idxNpm = idxMapP.npm;
    var idxNama = idxMapP.nama;
    var idxEmail = idxMapP.email;
    var idxHp = idxMapP.hp;
    var idxAngkatan = idxMapP.angkatan;
    var idxSemester = idxMapP.semester;
    var idxPasfoto = idxMapP.pasfoto;
    var idxKrs = idxMapP.krs;
    var mkStartIdx = -1;
    if (idxKrs >= 0) {
        mkStartIdx = idxKrs + 1;
    } else {
        var baseIndices = [idxTimestamp, idxNpm, idxNama, idxEmail, idxHp, idxAngkatan, idxSemester, idxPasfoto, idxKrs]
            .filter(function (i) { return i >= 0; });
        mkStartIdx = baseIndices.length ? Math.max.apply(null, baseIndices) + 1 : 9;
    }
    var mkList = [];
    for (var i = mkStartIdx; i < row.length; i++) {
        if (row[i] && String(row[i]).trim() !== '') mkList.push(String(row[i]).trim());
    }
    return {
        timestamp: row[idxTimestamp] || null,
        npm: String((idxNpm >= 0 ? row[idxNpm] : row[1]) || ''),
        nama_lengkap: String((idxNama >= 0 ? row[idxNama] : row[2]) || ''),
        email: String((idxEmail >= 0 ? row[idxEmail] : row[3]) || ''),
        hp: String((idxHp >= 0 ? row[idxHp] : row[4]) || ''),
        angkatan: String((idxAngkatan >= 0 ? row[idxAngkatan] : row[5]) || ''),
        semester: String((idxSemester >= 0 ? row[idxSemester] : row[6]) || ''),
        pasfoto_url: (idxPasfoto >= 0 ? row[idxPasfoto] : row[7]) || null,
        krs_url: (idxKrs >= 0 ? row[idxKrs] : row[8]) || null,
        mk_list: mkList.length ? mkList : null
    };
}

// ============================================================
// SUPABASE AUTO-SYNC
// ============================================================

var _SUPA_URL = 'https://hmdgggssiorhcomnfzho.supabase.co';

function getScriptProperty_(key) {
    try {
        var props = PropertiesService.getScriptProperties();
        return String(props.getProperty(key) || '').trim();
    } catch (e) {
        Logger.log('getScriptProperty_ error (' + key + '): ' + e.message);
        return '';
    }
}

function getSupabaseConfig_() {
    var url = getScriptProperty_('SUPA_URL') || _SUPA_URL;
    var serviceKey = getScriptProperty_('SUPA_SERVICE_KEY');
    return { url: url, serviceKey: serviceKey };
}

/**
 * UPSERT satu baris ke tabel Supabase (menggunakan service_role key).
 * Dipanggil server-side dari GAS setelah operasi write ke Google Sheets.
 */
function syncToSupabase_(table, row, onConflict) {
    try {
        var supa = getSupabaseConfig_();
        if (!supa.serviceKey) {
            Logger.log('syncToSupabase_ skipped: SUPA_SERVICE_KEY belum diset di Script Properties');
            return;
        }
        onConflict = onConflict || 'npm';
        var url = supa.url + '/rest/v1/' + table + '?on_conflict=' + onConflict;
        var options = {
            method: 'POST',
            headers: {
                'apikey': supa.serviceKey,
                'Authorization': 'Bearer ' + supa.serviceKey,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            payload: JSON.stringify(row),
            muteHttpExceptions: true
        };
        var resp = UrlFetchApp.fetch(url, options);
        var code = resp.getResponseCode();
        if (code >= 200 && code < 300) {
            Logger.log('syncToSupabase_ OK: ' + table + ' npm=' + (row.npm || ''));
        } else {
            Logger.log('syncToSupabase_ ERROR ' + code + ': ' + resp.getContentText().substring(0, 300));
        }
    } catch (e) {
        Logger.log('syncToSupabase_ exception: ' + e.message);
    }
}

// ============================================================
// FUNGSI YANG DIPANGGIL LANGSUNG OLEH index.html
// ============================================================

/**
 * Autocomplete nama berdasarkan NPM (dipanggil dari index.html)
 */
function searchNamalengkapByCustomerId(formObject) {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var sheet = ss.getSheetByName('DM');
        if (!sheet || sheet.getLastRow() <= 1) return [];
        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
        for (var i = 0; i < data.length; i++) {
            if (String(data[i][0]).trim() === String(formObject.custID).trim()) {
                return [data[i][1]];
            }
        }
        return [];
    } catch (error) {
        Logger.log('Error searching for name: ' + error.message);
        return [];
    }
}

function getWablasConfig_() {
    return {
        domain: getScriptProperty_('WABLAS_DOMAIN') || 'https://kudus.wablas.com',
        token: getScriptProperty_('WABLAS_TOKEN'),
        secret: getScriptProperty_('WABLAS_SECRET')
    };
}

function sendQueuedWaMessages(batchLimit) {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var waSheet = ensureWaSheet_(ss);
    var limit = parseInt(batchLimit, 10);
    if (isNaN(limit) || limit <= 0) limit = 20;

    var config = getWablasConfig_();
    if (!config.token || !config.domain) {
        return { sent: 0, failed: 0, skipped: 0, message: 'Konfigurasi Wablas belum lengkap' };
    }

    if (waSheet.getLastRow() <= 1) return { sent: 0, failed: 0, skipped: 0, message: 'Tidak ada antrean' };
    var data = waSheet.getRange(2, 1, waSheet.getLastRow() - 1, WA_HEADERS.length).getValues();
    var now = new Date();
    var sent = 0;
    var failed = 0;
    var skipped = 0;

    for (var i = 0; i < data.length; i++) {
        if (sent + failed + skipped >= limit) break;
        var row = data[i];
        var status = String(row[15] || '').trim().toUpperCase();
        if (status !== 'ANTRI') continue;

        var to = String(row[6] || '').trim();
        // Pemformatan nomor HP khusus untuk Wablas (ubah 08... atau +62... jadi 628...)
        to = to.replace(/\D/g, ''); // Hapus semua karakter non-angka
        if (to.startsWith('0')) {
            to = '62' + to.substring(1);
        }

        var body = String(row[13] || '').trim();
        var attempt = parseInt(row[16], 10);
        if (isNaN(attempt)) attempt = 0;
        var sheetRow = i + 2;

        if (!to || !body) {
            waSheet.getRange(sheetRow, 16).setValue('SKIP');
            waSheet.getRange(sheetRow, 19).setValue('Nomor WA atau pesan kosong');
            waSheet.getRange(sheetRow, 22).setValue(now);
            skipped++;
            continue;
        }

        var endpoint = config.domain + '/api/v2/send-message';
        var payload = JSON.stringify({
            data: [{
                phone: to,
                message: body
            }]
        });

        var options = {
            method: 'post',
            headers: {
                'Authorization': config.token + '.' + config.secret,
                'Content-Type': 'application/json'
            },
            payload: payload,
            muteHttpExceptions: true
        };

        try {
            var resp = UrlFetchApp.fetch(endpoint, options);
            var code = resp.getResponseCode();
            var text = resp.getContentText();
            attempt++;

            waSheet.getRange(sheetRow, 17).setValue(attempt);
            waSheet.getRange(sheetRow, 22).setValue(now);

            if (code >= 200 && code < 300) {
                var parsed = {};
                try { parsed = JSON.parse(text || '{}'); } catch (e1) { parsed = {}; }
                var msgId = '';
                if (parsed && parsed.data && parsed.data.messages && parsed.data.messages.length > 0) {
                    msgId = String(parsed.data.messages[0].id || '').trim();
                } else if (parsed && parsed.message_id) {
                    msgId = String(parsed.message_id || '').trim();
                } else if (parsed && parsed.id) {
                    msgId = String(parsed.id || '').trim();
                }

                waSheet.getRange(sheetRow, 16).setValue('TERKIRIM');
                waSheet.getRange(sheetRow, 18).setValue(msgId);
                waSheet.getRange(sheetRow, 19).setValue('Berhasil');
                waSheet.getRange(sheetRow, 21).setValue(new Date());
                sent++;
            } else {
                var errText = String(text || '').substring(0, 500);
                var nextStatus = attempt >= 3 ? 'GAGAL' : 'ANTRI';
                waSheet.getRange(sheetRow, 16).setValue(nextStatus);
                waSheet.getRange(sheetRow, 19).setValue('HTTP ' + code + ': ' + errText);
                failed++;
            }
        } catch (err) {
            attempt++;
            waSheet.getRange(sheetRow, 17).setValue(attempt);
            waSheet.getRange(sheetRow, 22).setValue(now);
            var stat = attempt >= 3 ? 'GAGAL' : 'ANTRI';
            waSheet.getRange(sheetRow, 16).setValue(stat);
            waSheet.getRange(sheetRow, 19).setValue(String(err.message || err).substring(0, 500));
            failed++;
        }
        Utilities.sleep(150);
    }
    return { sent: sent, failed: failed, skipped: skipped };
}

function reconcileAccToWaQueue() {
    return buildWaQueueFromKirimACC();
}

function setupWaAutomationTriggers() {
    var targetFns = ['reconcileAccToWaQueue', 'sendQueuedWaMessages'];
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        var fn = triggers[i].getHandlerFunction();
        if (targetFns.indexOf(fn) !== -1) {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }
    ScriptApp.newTrigger('reconcileAccToWaQueue').timeBased().everyMinutes(1).create();
    ScriptApp.newTrigger('sendQueuedWaMessages').timeBased().everyMinutes(1).create();
    return { status: 'ok', message: 'Trigger WA otomatis berhasil dibuat ulang' };
}

/**
 * Cek ketersediaan formulir berdasarkan waktu buka/tutup di sheet DM
 * (dipanggil dari index.html dan doGet)
 */
function checkFormAvailability() {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var dmSheet = ss.getSheetByName('DM');
        if (!dmSheet) return { isAvailable: true };

        // Batch baca G2 dan G4 sekaligus (1 API call, bukan 2)
        var dateRange = dmSheet.getRange('G2:G4').getValues();
        var openDateVal = dateRange[0][0];  // G2 = Waktu Mulai
        var closeDateVal = dateRange[2][0];  // G4 = Waktu Tutup

        var openDate = parseDateValue_(openDateVal);
        var closeDate = parseDateValue_(closeDateVal);
        var now = new Date();

        if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
            Logger.log('Invalid date in DM sheet. Open: ' + openDateVal + ', Close: ' + closeDateVal);
            return { isAvailable: true };
        }

        if (now >= openDate && now <= closeDate) {
            return { isAvailable: true };
        } else {
            var message = now < openDate
                ? ('Pendaftaran remedial belum dibuka. Pendaftaran akan dibuka pada ' + Utilities.formatDate(openDate, Session.getScriptTimeZone(), 'dd MMMM yyyy, HH:mm') + ' WIB.')
                : ('Pendaftaran remedial sudah ditutup pada ' + Utilities.formatDate(closeDate, Session.getScriptTimeZone(), 'dd MMMM yyyy, HH:mm') + ' WIB.');
            return { isAvailable: false, message: message };
        }
    } catch (error) {
        Logger.log('Error in checkFormAvailability: ' + error.message);
        return { isAvailable: true, message: 'Terjadi kesalahan saat memeriksa ketersediaan: ' + error.message };
    }
}

function checkUploadFormAvailability() {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var dmSheet = ss.getSheetByName('DM');
        if (!dmSheet) return { isAvailable: true };

        var dateRange = dmSheet.getRange('G8:G10').getValues();
        var openDateVal = dateRange[0][0];
        var closeDateVal = dateRange[2][0];
        var openDate = parseDateValue_(openDateVal);
        var closeDate = parseDateValue_(closeDateVal);
        var now = new Date();

        if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
            Logger.log('Invalid upload date in DM sheet. Open: ' + openDateVal + ', Close: ' + closeDateVal);
            return { isAvailable: true };
        }

        if (now >= openDate && now <= closeDate) {
            return { isAvailable: true };
        }

        var message = now < openDate
            ? ('Upload bukti pembayaran belum dibuka. Upload akan dibuka pada ' + Utilities.formatDate(openDate, Session.getScriptTimeZone(), 'dd MMMM yyyy, HH:mm') + ' WIB.')
            : ('Upload bukti pembayaran sudah ditutup pada ' + Utilities.formatDate(closeDate, Session.getScriptTimeZone(), 'dd MMMM yyyy, HH:mm') + ' WIB.');
        return { isAvailable: false, message: message };
    } catch (error) {
        Logger.log('Error in checkUploadFormAvailability: ' + error.message);
        return { isAvailable: true, message: 'Terjadi kesalahan saat memeriksa ketersediaan: ' + error.message };
    }
}

function parseDateValue_(val) {
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
        var parts = val.trim().split(/\s+/);
        var datePart = parts[0];
        var timePart = parts[1] || '00:00:00';
        var dParts = datePart.split('/');
        if (dParts.length === 3) {
            var day = parseInt(dParts[0], 10);
            var month = parseInt(dParts[1], 10) - 1;
            var year = parseInt(dParts[2], 10);
            var tParts = timePart.split(':');
            var hour = parseInt(tParts[0] || '0', 10);
            var min = parseInt(tParts[1] || '0', 10);
            var sec = parseInt(tParts[2] || '0', 10);
            return new Date(year, month, day, hour, min, sec);
        }
    }
    return new Date(val);
}

/**
 * Cek apakah NPM ada di sheet Pendaftaran dan/atau Izin
 * (dipanggil dari index.html)
 */
function checkNPMInSheets(npm) {
    try {
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) return { inPendaftaran: false, inIzin: false, remainingQuota: 0 };
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var pendaftaranSheet = ss.getSheetByName('Pendaftaran');
        var izinSheet = ss.getSheetByName('Izin');
        var inPendaftaran = false;
        var inIzin = false;
        var remainingQuota = 0;

        if (pendaftaranSheet && pendaftaranSheet.getLastRow() > 1) {
            var lastColP = pendaftaranSheet.getLastColumn();
            var headersP = pendaftaranSheet.getRange(1, 1, 1, lastColP).getValues()[0].map(function (h) { return String(h).trim().toLowerCase() });
            var idxNpmP = headersP.indexOf('npm');
            if (idxNpmP === -1) idxNpmP = 1;

            var npmValues = pendaftaranSheet.getRange(2, idxNpmP + 1, pendaftaranSheet.getLastRow() - 1, 1).getValues();
            inPendaftaran = npmValues.some(function (row) { return normalizeNpm_(row[0]) === npmClean; });
        }

        if (izinSheet && izinSheet.getLastRow() > 1) {
            var lastColI = izinSheet.getLastColumn();
            var headersI = izinSheet.getRange(1, 1, 1, lastColI).getValues()[0].map(function (h) { return String(h).trim().toLowerCase() });
            var idxNpmI = headersI.indexOf('npm');
            if (idxNpmI === -1) idxNpmI = 1;

            var npmValuesIzin = izinSheet.getRange(2, idxNpmI + 1, izinSheet.getLastRow() - 1, 1).getValues();
            var foundRowIdx = -1;
            for (var i = 0; i < npmValuesIzin.length; i++) {
                if (normalizeNpm_(npmValuesIzin[i][0]) === npmClean) { foundRowIdx = i + 2; break; }
            }
            inIzin = foundRowIdx !== -1;
            if (inIzin) {
                ensureIzinQuotaColumn_(izinSheet);
                remainingQuota = parseIzinQuota_(izinSheet.getRange(foundRowIdx, IZIN_QUOTA_COLUMN).getValue());
            }
        }
        return { inPendaftaran: inPendaftaran, inIzin: inIzin, remainingQuota: remainingQuota };
    } catch (error) {
        Logger.log('Error in checkNPMInSheets: ' + error.message);
        throw new Error('Failed to check NPM in sheets: ' + error.message);
    }
}

/**
 * Ambil daftar mata kuliah yang sudah terdaftar untuk NPM tertentu
 * (dipanggil dari index.html)
 */
function getExistingCourses(npm) {
    try {
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) return [];
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var sheet = ss.getSheetByName('Pendaftaran');
        if (!sheet || sheet.getLastRow() <= 1) return [];

        var lastCol = sheet.getLastColumn();
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase() });
        var idxNpm = headers.indexOf('npm');
        if (idxNpm < 0) idxNpm = 1;

        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
        var row = null;
        for (var i = 0; i < data.length; i++) {
            if (normalizeNpm_(data[i][idxNpm]) === npmClean) { row = data[i]; break; }
        }
        if (!row) return [];

        var existingCourses = [];
        // sem1: J-P = index 9-15 (7 slot)
        // sem3: Q-W = index 16-22 (7 slot)
        // sem5: X-AD = index 23-29 (7 slot)
        // sem7: AE-AK = index 30-36 (7 slot)
        var semConfig = [
            { startIdx: 9, slots: 7 },  // sem 1
            { startIdx: 16, slots: 7 },  // sem 3
            { startIdx: 23, slots: 7 },  // sem 5
            { startIdx: 30, slots: 7 }   // sem 7
        ];

        semConfig.forEach(function (cfg) {
            for (var k = 0; k < cfg.slots; k++) {
                var val = String(row[cfg.startIdx + k] || '').trim();
                if (val) existingCourses.push(val);
            }
        });

        return existingCourses;
    } catch (error) {
        Logger.log('Error in getExistingCourses: ' + error.message);
        return [];
    }
}

/**
 * Ambil daftar mata kuliah dari sheet MK berdasarkan semester
 * (dipanggil dari index.html)
 */
function getMataKuliahFromSheet(semester) {
    var cacheKey = 'mkList_sem' + semester + '_v1';
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);

    if (cached) {
        try {
            var parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            // Abaikan error parse, lanjut baca dari sheet
        }
    }

    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var sheet = ss.getSheetByName('MK') || ss.insertSheet('MK');
        var range;
        if (semester == 1) range = sheet.getRange('D2:D' + sheet.getLastRow());       // Angkatan 2026
        else if (semester == 3) range = sheet.getRange('E2:E' + sheet.getLastRow());   // Angkatan 2025
        else if (semester == 5) range = sheet.getRange('F2:F' + sheet.getLastRow());   // Angkatan 2024
        else if (semester == 7) range = sheet.getRange('G2:G' + sheet.getLastRow());   // Angkatan 2023/Lainnya
        else return [];

        var data = range.getValues();
        var options = [];
        for (var i = 0; i < data.length; i++) {
            var val = String(data[i][0]).trim();
            if (val !== '') options.push(val);
        }

        // Cache daftar MK selama 1 jam (3600 detik)
        try { cache.put(cacheKey, JSON.stringify(options), 3600); } catch (e) { }

        return options;
    } catch (error) {
        Logger.log('Error getting mata kuliah options: ' + error.message);
        return [];
    }
}

/**
 * Upload file ke Google Drive
 * (dipanggil dari index.html)
 */
function uploadFileToDrive(fileContent, fileName, mimeType) {
    var t0 = Date.now();
    try {
        var folderId = getFolderId();
        var folder = DriveApp.getFolderById(folderId) || DriveApp.getRootFolder();
        var decoded = Utilities.base64Decode(fileContent);
        var blob = Utilities.newBlob(decoded, mimeType, fileName);
        var file = folder.createFile(blob);
        Logger.log('uploadFileToDrive: ' + fileName + ' (%dms)', Date.now() - t0);
        return {
            status: 'success',
            message: 'File berhasil diunggah',
            fileUrl: file.getUrl(),
            fileName: fileName
        };
    } catch (error) {
        Logger.log('Error in uploadFileToDrive (%dms): ' + error.message, Date.now() - t0);
        return { status: 'error', message: 'Gagal upload file ke folder ' + getFolderId() + ': ' + error.message };
    }
}

// ============================================================
// VALIDASI BUKTI PEMBAYARAN DARI PORTAL
// MK!G12: 'Default' → wajib file portal (NPM di PDF harus cocok);
//         'Bypass'  → semua cek dilewati (cadangan saat portal bermasalah).
// ============================================================

var UPLOAD_MODE_RANGE = 'MK!G12';

function getUploadMode_() {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var val = String(ss.getRange(UPLOAD_MODE_RANGE).getValue() || '').trim().toLowerCase();
        return (val === 'bypass') ? 'bypass' : 'default';
    } catch (err) {
        Logger.log('getUploadMode_ error: ' + err.message);
        return 'default';
    }
}

function extractFileIdFromUrl_(url) {
    var u = String(url || '');
    var m = u.match(/[\/\\](?:file\/d\/|open\?id=)([a-zA-Z0-9\-_]+)/);
    if (m) return m[1];
    m = u.match(/[?&]id=([a-zA-Z0-9\-_]+)/);
    return m ? m[1] : '';
}

function trashFileFromUrl_(url) {
    try {
        var id = extractFileIdFromUrl_(url);
        if (id) DriveApp.getFileById(id).setTrashed(true);
    } catch (err) {
        Logger.log('trashFileFromUrl_ error: ' + err.message);
    }
}

/**
 * Ekstrak teks dari PDF via Drive API v2 (convert ke Google Docs).
 * PDF portal dari mPDF punya text layer, jadi tanpa OCR.
 */
function extractPdfText_(fileId) {
    var blob = DriveApp.getFileById(fileId).getBlob();
    var params = {
        method: 'post',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: {
            metadata: Utilities.newBlob(
                JSON.stringify({ title: 'tmp_kuitansi_cek', mimeType: 'application/vnd.google-apps.document' }),
                'application/json'
            ),
            file: blob
        },
        muteHttpExceptions: true
    };
    var resp = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true', params);
    if (resp.getResponseCode() >= 400) {
        throw new Error('Konversi PDF gagal: ' + resp.getContentText());
    }
    var docId = JSON.parse(resp.getContentText()).id;
    try {
        return DocumentApp.openById(docId).getBody().getText();
    } finally {
        try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) { /* ignore */ }
    }
}

function extractNpmFromText_(text) {
    var m = String(text || '').match(/NPM\s*[:：]\s*(\d{4,})/i);
    return m ? m[1].replace(/\D/g, '') : '';
}

/**
 * Validasi bukti pembayaran: NPM yang tercetak di dalam PDF harus sama dengan NPM login.
 */
function validatePaymentPdfNpm_(url, npm) {
    var npmClean = String(npm || '').replace(/\D/g, '');
    var fileId = extractFileIdFromUrl_(url);
    if (!fileId) return { valid: false, reason: 'file id tidak ditemukan' };
    try {
        var text = extractPdfText_(fileId);
        var pdfNpm = extractNpmFromText_(text);
        if (!pdfNpm) return { valid: false, reason: 'NPM tidak terbaca di file' };
        if (pdfNpm !== npmClean) return { valid: false, reason: 'NPM tidak cocok' };
        return { valid: true, reason: 'ok' };
    } catch (err) {
        Logger.log('validatePaymentPdfNpm_ error: ' + err.message);
        return { valid: false, reason: 'file tidak terbaca' };
    }
}

function getUploadStudentDataByNpm(npm) {
    try {
        var availability = checkUploadFormAvailability();
        if (!availability.isAvailable) {
            return { status: 'closed', message: availability.message };
        }
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) {
            return { status: 'error', message: 'Maaf, Data anda sedang diproses atau anda belum terdaftar' };
        }
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var kirimSheet = ss.getSheetByName('Kirim');
        if (!kirimSheet || kirimSheet.getLastRow() <= 1) {
            return { status: 'error', message: 'Maaf, Data anda sedang diproses atau anda belum terdaftar' };
        }
        // Baca kolom B..BO (indeks 0..65): TotalSKS di BN (idx 64), Status di BO (idx 65)
        var rows = kirimSheet.getRange(2, 2, kirimSheet.getLastRow() - 1, KIRIM_STATUS_COL - 1).getValues();
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (normalizeNpm_(row[0]) !== npmClean) continue;
            var accStatus = String(row[KIRIM_STATUS_COL - 2] || '').trim().toUpperCase();
            if (accStatus !== 'ACC') {
                return { status: 'error', message: 'Maaf, Data anda sedang diproses atau anda belum terdaftar' };
            }
            if (hasPembayaranByNpm_(npmClean, ss)) {
                return { status: 'already_uploaded', message: 'Maaf, pengisian form hanya satu kali saja' };
            }
            return {
                status: 'success',
                data: {
                    npm: npmClean,
                    namalengkap: String(row[1] || '').trim(),
                    email: String(row[2] || '').trim(),
                    totalSks: String(row[KIRIM_STATUS_COL - 3] || '').trim()
                }
            };
        }
        return { status: 'error', message: 'Maaf, Data anda sedang diproses atau anda belum terdaftar' };
    } catch (error) {
        Logger.log('Error getUploadStudentDataByNpm: ' + error.message);
        throw new Error('Gagal memeriksa data mahasiswa: ' + error.message);
    }
}

function submitUploadPembayaran(formData) {
    var tSubmit = Date.now();
    try {
        var availability = checkUploadFormAvailability();
        if (!availability.isAvailable) {
            return { status: 'closed', message: availability.message };
        }
        var npm = normalizeNpm_((formData && formData.npm) || '');
        if (!npm) throw new Error('NPM wajib diisi');

        var lookup = getUploadStudentDataByNpm(npm);
        if (lookup && lookup.status === 'already_uploaded') {
            return { status: 'already_uploaded', message: 'Maaf, pengisian form hanya satu kali saja' };
        }
        if (!lookup || lookup.status !== 'success') {
            return {
                status: 'error',
                message: 'Maaf, Data anda sedang diproses atau anda belum terdaftar'
            };
        }

        var student = lookup.data || {};
        var buktiPendaftaranUrl = String((formData && formData.buktiPendaftaranUrl) || '').trim();
        var buktiPembayaranUrl = String((formData && formData.buktiPembayaranUrl) || '').trim();
        if (!buktiPendaftaranUrl || !buktiPembayaranUrl) {
            throw new Error('Kedua file wajib diunggah');
        }

        var tMode = Date.now();
        var mode = getUploadMode_();
        if (mode === 'default') {
            var check = validatePaymentPdfNpm_(buktiPembayaranUrl, npm);
            Logger.log('submitUploadPembayaran: mode=%s validasi NPM PDF %dms valid=%s reason=%s',
                mode, Date.now() - tMode, check.valid, check.reason);
            if (!check.valid) {
                trashFileFromUrl_(buktiPembayaranUrl);
                return { status: 'error', message: 'Maaf, Gunakan bukti pembayaran dari portal mahasiswa' };
            }
        } else {
            Logger.log('submitUploadPembayaran: mode=%s (cek NPM dilewati, %dms)', mode, Date.now() - tMode);
        }

        var payload = {
            timestamp: new Date(),
            npm: student.npm || npm,
            namalengkap: student.namalengkap || '',
            totalSks: student.totalSks || '',
            email: student.email || '',
            buktiPendaftaranUrl: buktiPendaftaranUrl,
            buktiPembayaranUrl: buktiPembayaranUrl
        };

        var tSave = Date.now();
        saveUploadPembayaranToSheet_(payload);
        Logger.log('submitUploadPembayaran: simpan ke sheet %dms', Date.now() - tSave);

        var emailSent = false;
        var emailError = '';
        try {
            sendUploadPembayaranConfirmationEmail_(payload);
            emailSent = true;
        } catch (e) {
            Logger.log('Email failure in submitUploadPembayaran: ' + e.message);
            emailError = e.message;
        }
        Logger.log('submitUploadPembayaran: total %dms (client→server transfer tidak termasuk)', Date.now() - tSubmit);

        if (emailSent) {
            return { status: 'success', message: 'Data pembayaran berhasil disimpan dan email konfirmasi telah dikirim' };
        }
        return {
            status: 'partial_success',
            message: 'Data pembayaran berhasil disimpan, namun email konfirmasi gagal dikirim',
            details: emailError
        };
    } catch (error) {
        Logger.log('Error submitUploadPembayaran: ' + error.message);
        throw new Error('Gagal menyimpan data pembayaran: ' + error.message);
    }
}

function saveUploadPembayaranToSheet_(payload) {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    if (hasPembayaranByNpm_(payload.npm, ss)) {
        throw new Error('Maaf, pengisian form hanya satu kali saja');
    }
    var headers = [
        'Timestamp',
        'NPM',
        'Nama Lengkap',
        'Total SKS',
        'Bukti Pendaftaran',
        'Bukti Pembayaran'
    ];
    var rowData = [
        payload.timestamp || new Date(),
        payload.npm || '',
        payload.namalengkap || '',
        payload.totalSks || '',
        payload.buktiPendaftaranUrl || '',
        payload.buktiPembayaranUrl || ''
    ];
    var sheet = ss.getSheetByName('Pembayaran') || ss.insertSheet('Pembayaran');
    if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.appendRow(rowData);
    mirrorPembayaranRowToInput_(ss, headers, rowData);
}

function hasPembayaranByNpm_(npm, ss) {
    var npmClean = normalizeNpm_(npm);
    if (!npmClean) return false;
    var spreadsheet = ss || SpreadsheetApp.openById(getSpreadsheetId());
    var pembayaranSheet = spreadsheet.getSheetByName('Pembayaran');
    if (!pembayaranSheet || pembayaranSheet.getLastRow() <= 1) return false;
    var npmValues = pembayaranSheet.getRange(2, 2, pembayaranSheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < npmValues.length; i++) {
        if (normalizeNpm_(npmValues[i][0]) === npmClean) return true;
    }
    return false;
}

function normalizeNpm_(value) {
    var str = String(value || '').trim();
    if (!str) return '';
    str = str.replace(/^'+/, '');
    str = str.replace(/\.0+$/, '');
    str = str.replace(/\D/g, '');
    return str;
}

function normalizeMkName_(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function mirrorPembayaranRowToInput_(ss, headers, rowData) {
    // 1. Dapatkan daftar Matakuliah dari sheet Kirim
    var npm = normalizeNpm_(rowData[1]);
    var kirimSheet = ss.getSheetByName('Kirim');
    var matakuliahList = [];

    if (kirimSheet && kirimSheet.getLastRow() > 1) {
        var kData = kirimSheet.getRange(2, 1, kirimSheet.getLastRow() - 1, Math.max(kirimSheet.getLastColumn(), 37)).getValues();
        for (var i = 0; i < kData.length; i++) {
            if (normalizeNpm_(kData[i][1]) === npm) {
                // Kolom J-AK (indeks 9-36) berisi MK yang sudah di-ACC
                for (var j = 9; j <= 36; j++) {
                    var mk = String(kData[i][j] || '').trim();
                    if (mk) {
                        matakuliahList.push(mk);
                    }
                }
                break;
            }
        }
    }
    var matakuliahStr = matakuliahList.join('\n');

    // 2. Hitung Biaya (Total SKS * Rp. 75.000)
    var totalSks = parseFloat(rowData[3]) || 0;
    var biaya = totalSks * 75000;

    // 3. Persiapkan headers dan rowData untuk Input
    var inputHeaders = headers.slice();
    inputHeaders.push('Matakuliah');
    inputHeaders.push('Biaya');

    var inputRowData = rowData.slice();
    inputRowData.push(matakuliahStr);
    inputRowData.push(biaya);

    var inputSheet = ss.getSheetByName('Input') || ss.insertSheet('Input');

    // Cek dan buat headers jika belum ada
    if (inputSheet.getLastRow() === 0) {
        inputSheet.getRange(1, 1, 1, inputHeaders.length).setValues([inputHeaders]).setFontWeight('bold');
    } else {
        // Pastikan header "Matakuliah" dan "Biaya" ada di samping kolom terakhir data pembayaran
        var existingHeaders = inputSheet.getRange(1, 1, 1, inputSheet.getLastColumn()).getValues()[0];
        if (existingHeaders.indexOf('Matakuliah') === -1) {
            inputSheet.getRange(1, headers.length + 1).setValue('Matakuliah').setFontWeight('bold');
            inputSheet.getRange(1, headers.length + 2).setValue('Biaya').setFontWeight('bold');
        }
    }

    inputSheet.appendRow(inputRowData);

    var newRow = inputSheet.getLastRow();

    // Format text wrap untuk Matakuliah dan mata uang untuk Biaya
    inputSheet.getRange(newRow, headers.length + 1).setWrap(true);
    inputSheet.getRange(newRow, headers.length + 2).setNumberFormat('"Rp" #,##0');

    // 4. Salin rumus manual jika ada (di sebelah kanan kolom Biaya)
    var lastCol = inputSheet.getLastColumn();
    if (newRow <= 2 || lastCol <= inputHeaders.length) return;

    var formulaWidth = lastCol - inputHeaders.length;
    var srcRange = inputSheet.getRange(newRow - 1, inputHeaders.length + 1, 1, formulaWidth);
    var srcR1C1 = srcRange.getFormulasR1C1()[0];
    var hasFormula = srcR1C1.some(function (f) { return String(f || '').trim() !== ''; });
    if (!hasFormula) return;

    inputSheet.getRange(newRow, inputHeaders.length + 1, 1, formulaWidth).setFormulasR1C1([srcR1C1]);
}

function sendUploadPembayaranConfirmationEmail_(payload) {
    if (!payload.email) throw new Error('Email mahasiswa tidak ditemukan');
    var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
    var tanggal = Utilities.formatDate(payload.timestamp || new Date(), tz, 'dd MMMM yyyy HH:mm:ss');
    var emailBody = '' +
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">' +
        '<h2 style="text-align: center;">Konfirmasi Unggah Bukti Pembayaran</h2>' +
        '<p style="text-align: center;">Remedial Semester Ganjil 2026-2027 - Fakultas Kedokteran dan Ilmu Kesehatan UMSU</p>' +
        '<hr style="border: 1px solid #eee;" />' +
        '<p>Assalamu\'alaikum, ' + (payload.namalengkap || '') + ',</p>' +
        '<p>Terima kasih, data unggah Anda telah kami terima. Berikut detail data Anda:</p>' +
        '<table style="width: 100%; border-collapse: collapse;">' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Timestamp</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + tanggal + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>NPM</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (payload.npm || '') + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Nama Lengkap</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (payload.namalengkap || '') + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total SKS</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (payload.totalSks || '') + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Bukti Pendaftaran</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="' + (payload.buktiPendaftaranUrl || '') + '" target="_blank" rel="noopener noreferrer">' + (payload.buktiPendaftaranUrl || '') + '</a></td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Bukti Pembayaran</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="' + (payload.buktiPembayaranUrl || '') + '" target="_blank" rel="noopener noreferrer">' + (payload.buktiPembayaranUrl || '') + '</a></td></tr>' +
        '</table>' +
        '<hr style="border: 1px solid #eee; margin-top: 20px;" />' +
        '<p style="text-align: center; font-size: 14px; color: #666;">Silakan simpan email ini sebagai konfirmasi unggah bukti pembayaran.</p>' +
        '</div>';
    MailApp.sendEmail({
        to: payload.email,
        subject: 'Konfirmasi unggah bukti pembayaran',
        htmlBody: emailBody
    });
}

/**
 * Helper internal: cek apakah NPM sudah ada di sheet Pendaftaran, dan apakah
 * NPM tersebut ada di sheet Izin (artinya diizinkan admin untuk isi kedua kali).
 * Dipakai bersama oleh checkPendaftaranStatusByNpm() (cek dini di field NPM)
 * dan submitFormData() (cek akhir saat submit), agar logikanya konsisten
 * di satu tempat dan tidak berbeda pendapat antara dua titik tersebut.
 */
function _resolvePendaftaranIzinStatus_(npm) {
    var npmClean = normalizeNpm_(npm);
    var result = { npmClean: npmClean, alreadyRegistered: false, inIzin: false, remainingQuota: 0, blocked: false, message: '' };
    if (!npmClean) return result;

    result.alreadyRegistered = checkNPMExists(npmClean);

    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var izinSheet = ss.getSheetByName('Izin');
        if (izinSheet && izinSheet.getLastRow() > 1) {
            ensureIzinQuotaColumn_(izinSheet);
            var headers = izinSheet.getRange(1, 1, 1, izinSheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase() });
            var idx = headers.indexOf('npm');
            if (idx === -1) idx = 1;
            var izinData = izinSheet.getRange(2, idx + 1, izinSheet.getLastRow() - 1, 1).getValues();
            var foundRowIdx = -1;
            for (var i = 0; i < izinData.length; i++) {
                if (normalizeNpm_(izinData[i][0]) === npmClean) {
                    foundRowIdx = i + 2;
                    break;
                }
            }
            result.inIzin = foundRowIdx !== -1;
            if (result.inIzin) {
                result.remainingQuota = parseIzinQuota_(izinSheet.getRange(foundRowIdx, IZIN_QUOTA_COLUMN).getValue());
            }
        }
    } catch (e) {
        Logger.log('Error checking Izin in _resolvePendaftaranIzinStatus_: ' + e.message);
    }

    if (result.alreadyRegistered && (!result.inIzin || result.remainingQuota <= 0)) {
        result.blocked = true;
        result.message = 'Anda sudah terdaftar, Pendaftaran hanya satu kali saja.';
    }

    return result;
}

/**
 * Cek dini status NPM saat mahasiswa mengetik di field NPM (dipanggil dari index.html).
 * Tujuannya supaya mahasiswa yang sudah terdaftar (dan tidak ada izin tambahan dari admin)
 * langsung diberitahu sejak awal, sebelum mengisi seluruh form dan upload file.
 * Pengecekan akhir di submitFormData() TETAP berjalan sebagai jaring pengaman terakhir,
 * fungsi ini hanya untuk pengalaman pengguna (early warning), bukan pengganti.
 */
function checkPendaftaranStatusByNpm(npm) {
    try {
        var availability = checkFormAvailability();
        if (!availability.isAvailable) {
            return { status: 'closed', message: availability.message };
        }
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) {
            return { status: 'ok' };
        }
        var pendaftaranStatus = _resolvePendaftaranIzinStatus_(npmClean);
        if (pendaftaranStatus.blocked) {
            return { status: 'already_registered', message: pendaftaranStatus.message };
        }
        return { status: 'ok' };
    } catch (error) {
        Logger.log('Error checkPendaftaranStatusByNpm: ' + error.message);
        // Gagal cek dini bukan alasan untuk memblokir; submitFormData tetap jadi pengaman akhir.
        return { status: 'ok' };
    }
}

/**
 * Submit data formulir pendaftaran
 * (dipanggil dari index.html)
 */
function submitFormData(formData) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
        var availability = checkFormAvailability();
        if (!availability.isAvailable) {
            return { status: 'error', message: availability.message };
        }

        var npm = formData.custID || formData.npm;
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) {
            return { status: 'error', message: 'NPM tidak valid' };
        }

        // Cek status Pendaftaran + Izin lewat helper bersama (dipakai juga oleh
        // checkPendaftaranStatusByNpm untuk pengecekan dini di field NPM), agar
        // logikanya konsisten di satu tempat.
        var pendaftaranStatus = _resolvePendaftaranIzinStatus_(npmClean);
        var alreadyRegistered = pendaftaranStatus.alreadyRegistered;
        var inIzin = pendaftaranStatus.inIzin;
        var updatedRow = null;

        if (pendaftaranStatus.blocked) {
            return { status: 'error', message: pendaftaranStatus.message };
        }

        if (alreadyRegistered && inIzin) {
            updatedRow = updateStudentInPendaftaran(formData);
            var quotaResult = incrementIzinUsed(npmClean);
            if (quotaResult.status !== 'success') {
                throw new Error(quotaResult.message || 'Gagal memperbarui kuota izin');
            }
            // Agregasi mata kuliah lama + baru untuk email
            if (updatedRow) {
                formData.mataKuliah = extractCoursesFromRow_(updatedRow);
            }
        } else {
            saveToSpreadsheet(formData);
        }

        var emailSent = false;
        var emailError = '';
        try {
            sendConfirmationEmail(formData);
            emailSent = true;
        } catch (e) {
            Logger.log('Email failure in submitFormData: ' + e.message);
            emailError = e.message;
        }

        if (emailSent) {
            return { status: 'success', message: 'Data berhasil disimpan dan email konfirmasi telah dikirim' };
        } else {
            return {
                status: 'partial_success',
                message: 'Data berhasil disimpan, namun gagal mengirim email konfirmasi. Silakan hubungi admin atau cek email Anda nanti.',
                details: emailError
            };
        }
    } catch (error) {
        Logger.log('Error submitting form data: ' + error.message);
        throw new Error('Gagal menyimpan data: ' + error.message);
    } finally {
        try {
            lock.releaseLock();
        } catch (e) { }
    }
}

/**
 * Update mata kuliah yang dipilih (untuk tambah MK via modal)
 * (dipanggil dari index.html)
 */
function updateMataKuliah(npm, semester, newMataKuliah) {
    try {
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) throw new Error('NPM tidak valid');
        newMataKuliah = Array.isArray(newMataKuliah) ? newMataKuliah : [];
        var ss = SpreadsheetApp.openById(getSpreadsheetId());

        var izinSet = new Set();
        try {
            var izinSheet = ss.getSheetByName('Izin');
            if (izinSheet && izinSheet.getLastRow() > 1) {
                var hIzin = izinSheet.getRange(1, 1, 1, izinSheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase() });
                var idxNI = hIzin.indexOf('npm');
                if (idxNI < 0) idxNI = 1;
                var dIzin = izinSheet.getRange(2, idxNI + 1, izinSheet.getLastRow() - 1, 1).getValues();
                dIzin.forEach(function (r) { izinSet.add(String(r[0] || '').trim()); });
            }
        } catch (e) { Logger.log('Error reading Izin sheet: ' + e.message); }

        var sheet = ss.getSheetByName('Pendaftaran');
        if (!sheet) throw new Error("Sheet 'Pendaftaran' tidak ditemukan");
        if (sheet.getLastRow() <= 1) throw new Error('Data pendaftaran kosong');
        var lastCol = sheet.getLastColumn();
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
        var idxNpm = headers.indexOf('npm');
        if (idxNpm < 0) idxNpm = 1;

        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
        var rowIndex = -1;
        for (var i = 0; i < data.length; i++) {
            if (normalizeNpm_(data[i][idxNpm]) === npmClean) { rowIndex = i + 2; break; }
        }
        if (rowIndex === -1) throw new Error('Row tidak ditemukan untuk NPM ' + npmClean);
        var row = data[rowIndex - 2];

        // Mapping semester ke kolom sheet
        // sem1: J-P  = 1-based col 10-16, 0-based idx 9-15 (7 slot)
        // sem3: Q-W  = 1-based col 17-23, 0-based idx 16-22 (7 slot)
        // sem5: X-AD = 1-based col 24-30, 0-based idx 23-29 (7 slot)
        // sem7: AE-AK = 1-based col 31-37, 0-based idx 30-36 (7 slot)
        var startCol, numCols;
        if (semester == 1) { startCol = 10; numCols = 7; }
        else if (semester == 3) { startCol = 17; numCols = 7; }
        else if (semester == 5) { startCol = 24; numCols = 7; }
        else if (semester == 7) { startCol = 31; numCols = 7; }
        else throw new Error('Semester tidak valid: ' + semester);

        // Update cell-cell yang masih kosong dengan MK baru
        var currentValues = row.slice(startCol - 1, startCol - 1 + numCols);
        var added = 0;
        for (var j = 0; j < numCols && added < newMataKuliah.length; j++) {
            var cell = String(currentValues[j] || '').trim();
            if (cell === '') { currentValues[j] = newMataKuliah[added]; added++; }
        }
        sheet.getRange(rowIndex, startCol, 1, numCols).setValues([currentValues]);
        SpreadsheetApp.flush();

        // Ambil ulang data HANYA untuk baris mahasiswa ini agar lebih akurat dan cepat
        var updatedRow = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

        var idxAngkatan = headers.indexOf('angkatan');
        var formData = {
            custID: updatedRow[idxNpm],
            namalengkap: updatedRow[2],
            email: updatedRow[3],
            hp: updatedRow[4],
            angkatan: (idxAngkatan >= 0) ? updatedRow[idxAngkatan] : '',
            semester: semester
        };

        // Kumpulkan SEMUA mata kuliah yang ada di baris ini (lama + baru) ke dalam satu array utuh
        // Timpa formData.mataKuliah dengan array utuh tersebut agar getMataKuliahList() bisa merakit email dengan benar
        formData.mataKuliah = extractCoursesFromRow_(updatedRow);

        sendConfirmationEmail(formData);
        try {
            var supaRow = buildPendaftaranSupabaseRow_(headers, updatedRow);
            if (supaRow) syncToSupabase_('pendaftaran', supaRow, 'npm');
        } catch (syncErr) {
            Logger.log('updateMataKuliah sync warning: ' + syncErr.message);
        }
        return { status: 'success', message: 'Mata kuliah berhasil diperbarui dan email konfirmasi dikirim' };
    } catch (error) {
        Logger.log('Error in updateMataKuliah: ' + error.message);
        throw new Error('Failed to update mata kuliah: ' + error.message);
    }
}

/**
 * Konsumsi kuota izin perbaikan setelah mahasiswa submit
 * (dipanggil dari index.html)
 */
function incrementIzinUsed(npm) {
    try {
        npm = (npm && typeof npm === 'object' && !Array.isArray(npm)) ? normalizeNpm_(npm.npm) : normalizeNpm_(npm);
        if (!npm) throw new Error('NPM kosong');
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var izinSheet = ss.getSheetByName('Izin');
        if (!izinSheet || izinSheet.getLastRow() <= 1) throw new Error('Sheet Izin kosong atau tidak ditemukan');
        ensureIzinQuotaColumn_(izinSheet);
        var rowIdx = findRowIndexByNpm_(izinSheet, npm);
        if (rowIdx === -1) throw new Error('NPM tidak ditemukan di Izin');
        var quotaCell = izinSheet.getRange(rowIdx, IZIN_QUOTA_COLUMN);
        var remaining = parseIzinQuota_(quotaCell.getValue());
        if (remaining <= 0) throw new Error('Anda sudah terdaftar, Pendaftaran hanya satu kali saja.');
        remaining -= 1;
        quotaCell.setValue(remaining);
        try {
            syncToSupabase_('izin', { npm: npm, quota_af: remaining }, 'npm');
        } catch (syncErr) {
            Logger.log('incrementIzinUsed sync warning: ' + syncErr.message);
        }
        return { status: 'success', npm: npm, remaining: remaining };
    } catch (e) {
        Logger.log('incrementIzinUsed error: ' + e.message);
        return { status: 'error', npm: String(npm || ''), message: String(e && e.message ? e.message : e) };
    }
}

// ============================================================
// FUNGSI INTERNAL HELPER (dipakai oleh fungsi di atas)
// ============================================================

/**
 * Cek apakah NPM sudah ada di sheet Pendaftaran
 */
function checkNPMExists(npm) {
    try {
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) return false;
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var sheet = ss.getSheetByName('Pendaftaran');
        if (!sheet || sheet.getLastRow() <= 1) return false;
        var lastCol = sheet.getLastColumn();
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
        var idxNpm = headers.indexOf('npm');
        if (idxNpm < 0) idxNpm = 1;
        var npmValues = sheet.getRange(2, idxNpm + 1, sheet.getLastRow() - 1, 1).getValues();
        return npmValues.some(function (row) { return normalizeNpm_(row[0]) === npmClean; });
    } catch (error) {
        Logger.log('Error checking NPM existence: ' + error.message);
        return false;
    }
}

/**
 * Pastikan kolom dengan header tertentu berformat teks ("@")
 */
function ensureTextFormatForHeader(sheet, headerName) {
    if (!sheet) return;
    try {
        var lastCol = sheet.getLastColumn();
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
        var idx = headers.indexOf(String(headerName || '').trim().toLowerCase());
        if (idx >= 0) {
            var col = idx + 1;
            var maxRows = Math.max(sheet.getMaxRows() - 1, 1);
            sheet.getRange(2, col, maxRows, 1).setNumberFormat('@');
        }
    } catch (e) {
        Logger.log('ensureTextFormatForHeader error: ' + e);
    }
}

/**
 * Mendapatkan ID spreadsheet yang digunakan untuk pendaftaran
 */
function getRegistrationSpreadsheetIds() {
    return [
        getSpreadsheetId()
    ];
}

/**
 * Simpan data pendaftaran ke spreadsheet
 */
function saveToSpreadsheet(formData) {
    try {
        var spreadsheetIds = getRegistrationSpreadsheetIds().filter(function (id) {
            return String(id || '').trim() !== '';
        });
        if (spreadsheetIds.length === 0) {
            throw new Error('Tidak ada Spreadsheet ID yang dikonfigurasi');
        }
        var angkatanVal = String(formData.angkatan || '').trim();
        // Kolom G: Semester yang tampil di sheet (Lainnya = 'Lainnya', lainnya = nomor semester)
        var semesterDisplay = (angkatanVal === 'Lainnya') ? 'Lainnya' : (formData.semester || '');
        var baseRowData = [
            formData.custID || formData.npm || '',
            formData.namalengkap || '',
            formData.email || '',
            formData.hp || '',
            angkatanVal,
            semesterDisplay,
            formData.pasfotoUrl || 'Tidak ada',
            formData.krsUrl || 'Tidak ada'
        ];
        spreadsheetIds.forEach(function (spreadsheetId) {
            var ss = SpreadsheetApp.openById(spreadsheetId);
            var sheet = ss.getSheetByName('Pendaftaran') || ss.insertSheet('Pendaftaran');
            if (sheet.getLastRow() === 0) {
                var headerRow = ['Timestamp', 'NPM', 'Nama Lengkap', 'Email', 'No. HP/WA', 'Angkatan', 'Semester', 'Pasfoto URL', 'KRS URL'];
                for (var h1 = 1; h1 <= 7; h1++) headerRow.push('MK Sem1 ' + h1);
                for (var h3 = 1; h3 <= 7; h3++) headerRow.push('MK Sem3 ' + h3);
                for (var h5 = 1; h5 <= 7; h5++) headerRow.push('MK Sem5 ' + h5);
                for (var h7 = 1; h7 <= 7; h7++) headerRow.push('MK Sem7 ' + h7);
                // Tulis header via setValues (lebih cepat dari appendRow untuk 1 baris pertama)
                sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
            }
            // Bangun rowData lengkap sekali sebelum menulis (1 appendRow saja)
            var rowData = [new Date()].concat(baseRowData);
            for (var i1 = 1; i1 <= 7; i1++) rowData.push(formData['mkSem1' + i1] || '');
            for (var i3 = 1; i3 <= 7; i3++) rowData.push(formData['mkSem3' + i3] || '');
            for (var i5 = 1; i5 <= 7; i5++) rowData.push(formData['mkSem5' + i5] || '');
            for (var i7 = 1; i7 <= 7; i7++) rowData.push(formData['mkSem7' + i7] || '');
            sheet.appendRow(rowData);  // ← hanya 1x API write
            ensureTextFormatForHeader(sheet, 'No. HP/WA');
            try {
                var headersRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
                var paddedRow = rowData.slice();
                while (paddedRow.length < headersRow.length) paddedRow.push('');
                var supaRow = buildPendaftaranSupabaseRow_(headersRow, paddedRow);
                if (supaRow) syncToSupabase_('pendaftaran', supaRow, 'npm');
            } catch (syncErr) {
                Logger.log('saveToSpreadsheet sync warning: ' + syncErr.message);
            }
        });
        return true;
    } catch (error) {
        Logger.log('Error saving to spreadsheet: ' + error.message);
        throw new Error('Gagal menyimpan ke spreadsheet: ' + error.message);
    }
}

/**
 * Update data mahasiswa yang sudah terdaftar (untuk revisi)
 */
function updateStudentInPendaftaran(formData) {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var sheet = ss.getSheetByName('Pendaftaran');
        var npm = formData.custID || formData.npm;
        var npmClean = normalizeNpm_(npm);

        var data = sheet.getDataRange().getValues();
        var headers = data[0].map(function (h) { return String(h).trim().toLowerCase() });
        var idxNpm = headers.indexOf('npm');
        if (idxNpm < 0) idxNpm = 1;

        var rowIdx = -1;
        for (var i = 1; i < data.length; i++) {
            if (normalizeNpm_(data[i][idxNpm]) === npmClean) {
                rowIdx = i;
                break;
            }
        }
        if (rowIdx === -1) throw new Error("NPM not found for update");

        var row = data[rowIdx];

        row[0] = new Date();
        row[2] = formData.namalengkap || row[2];
        row[3] = formData.email || row[3];
        row[4] = formData.hp || row[4];
        row[5] = formData.angkatan || row[5];
        // Kolom G: Semester display — Lainnya jika angkatan Lainnya
        var angkatanUpd = String(formData.angkatan || row[5] || '').trim();
        row[6] = (angkatanUpd === 'Lainnya') ? 'Lainnya' : (formData.semester || row[6]);
        row[7] = formData.pasfotoUrl || row[7];
        row[8] = formData.krsUrl || row[8];

        var semConfig = [
            { sem: 1, startIdx: 9, maxCols: 7 }, // J-P (index 9-15)
            { sem: 3, startIdx: 16, maxCols: 7 }, // Q-W (index 16-22)
            { sem: 5, startIdx: 23, maxCols: 7 }, // X-AD (index 23-29)
            { sem: 7, startIdx: 30, maxCols: 7 }  // AE-AK (index 30-36)
        ];

        semConfig.forEach(function (cfg) {
            var newCoursesForThisSem = [];

            // Kumpulkan semua MK baru yang dikirim form untuk semester ini
            for (var k = 1; k <= cfg.maxCols; k++) {
                var valFromForm = formData['mkSem' + cfg.sem + k];
                if (valFromForm && String(valFromForm).trim() !== '') {
                    newCoursesForThisSem.push(String(valFromForm).trim());
                }
            }

            if (newCoursesForThisSem.length > 0) {
                var mkToInsertIndex = 0;

                // Cari slot kosong di baris ini untuk memasukkan MK baru
                for (var colIdx = cfg.startIdx; colIdx < cfg.startIdx + cfg.maxCols; colIdx++) {
                    if (mkToInsertIndex >= newCoursesForThisSem.length) break; // Semua MK baru sudah masuk

                    var existingVal = String(row[colIdx] || '').trim();
                    if (existingVal === '') {
                        row[colIdx] = newCoursesForThisSem[mkToInsertIndex];
                        mkToInsertIndex++;
                    }
                }
            }
        });

        sheet.getRange(rowIdx + 1, 1, 1, row.length).setValues([row]);
        ensureTextFormatForHeader(sheet, 'No. HP/WA');
        try {
            var supaRow = buildPendaftaranSupabaseRow_(headers, row);
            if (supaRow) syncToSupabase_('pendaftaran', supaRow, 'npm');
        } catch (syncErr) {
            Logger.log('updateStudentInPendaftaran sync warning: ' + syncErr.message);
        }
        return row;

    } catch (e) {
        Logger.log("Error in updateStudentInPendaftaran: " + e.message);
        throw new Error('Gagal mengupdate data: ' + e.message);
    }
}

/**
 * Helper untuk mengekstrak daftar mata kuliah dari array baris Pendaftaran
 */
function extractCoursesFromRow_(row) {
    var courses = [];
    var semConfig = [
        { startIdx: 9, slots: 7 }, // Sem 1
        { startIdx: 16, slots: 7 }, // Sem 3
        { startIdx: 23, slots: 7 }, // Sem 5
        { startIdx: 30, slots: 7 }  // Sem 7
    ];
    semConfig.forEach(function (cfg) {
        for (var k = 0; k < cfg.slots; k++) {
            var val = String(row[cfg.startIdx + k] || '').trim();
            if (val !== '') {
                courses.push(val);
            }
        }
    });
    return courses;
}

/**
 * Buat daftar mata kuliah sebagai HTML untuk email konfirmasi
 */
function getMataKuliahList(formData) {
    var matkuls = [];

    // Prioritas utama: Ambil dari formData.mataKuliah (sudah berisi seluruh list dari updateStudentInPendaftaran)
    if (formData.mataKuliah && Array.isArray(formData.mataKuliah) && formData.mataKuliah.length > 0) {
        matkuls.push('<strong>Daftar Mata Kuliah :</strong>');
        formData.mataKuliah.forEach(function (mk) {
            matkuls.push('- ' + mk);
        });
    } else {
        // Jika belum ada (Pendaftaran Baru), baca per semester
        [1, 3, 5, 7].forEach(function (semester) {
            var hasAny = false;
            var maxOptions = 7;
            for (var i = 1; i <= maxOptions; i++) {
                var mk = formData['mkSem' + semester + i];
                if (mk) {
                    if (!hasAny) { matkuls.push('<strong>Semester ' + semester + '</strong>'); hasAny = true; }
                    matkuls.push('- ' + mk);
                }
            }
        });
    }

    return matkuls.length ? matkuls.join('<br>') : 'Tidak ada mata kuliah yang dipilih';
}

/**
 * Kirim email konfirmasi pendaftaran ke mahasiswa
 */
function sendConfirmationEmail(formData) {
    try {
        var mataKuliahList = getMataKuliahList(formData);
        var emailBody = '' +
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">' +
            '<h2 style="text-align: center;">Konfirmasi Pendaftaran Remedial</h2>' +
            '<p style="text-align: center;">Semester Ganjil 2026-2027 - Fakultas Kedokteran dan Ilmu Kesehatan UMSU</p>' +
            '<hr style="border: 1px solid #eee;" />' +
            '<p>Assalamu\'alaikum, ' + (formData.namalengkap || '') + ',</p>' +
            '<p>Terima kasih telah mendaftar remedial. Berikut adalah detail pendaftaran Anda</p>' +
            '<table style="width: 100%; border-collapse: collapse;">' +
            '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>NPM</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (formData.custID || formData.npm || '') + '</td></tr>' +
            '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Nama</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (formData.namalengkap || '') + '</td></tr>' +
            '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (formData.email || '') + '</td></tr>' +
            '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>No. HP/WA</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (formData.hp || '') + '</td></tr>' +
            '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Angkatan</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + (formData.angkatan || '') + '</td></tr>' +
            '</table>' +
            '<h3 style="margin-top: 20px;">Mata Kuliah yang Didaftarkan</h3>' +
            '<div style="padding: 10px; background-color: #f9f9f9; border-radius: 5px;">' +
            mataKuliahList +
            '</div>' +
            '<hr style="border: 1px solid #eee; margin-top: 20px;" />' +
            '<p style="text-align: center; font-size: 14px; color: #666;">Silakan simpan email ini sebagai konfirmasi pendaftaran.</p>' +
            '<p style="text-align: center; font-size: 14px; color: #666;">Email ini bukan sebagai bukti pendaftaran yang telah disetujui/ACC Prodi.</p>' +
            '<p style="text-align: center; font-size: 14px; color: #666;">Untuk informasi lebih lanjut, silakan hubungi Admin Prodi FKIK UMSU.</p>' +
            '</div>';
        MailApp.sendEmail({
            to: formData.email,
            subject: 'Konfirmasi Pendaftaran Remedial Semester Ganjil - Fakultas Kedokteran dan Ilmu Kesehatan UMSU',
            htmlBody: emailBody
        });
        return true;
    } catch (error) {
        Logger.log('Error sending email: ' + error.message);
        throw new Error('Gagal mengirim email konfirmasi: ' + error.message);
    }
}

var IZIN_QUOTA_COLUMN = 32; // AF
var IZIN_QUOTA_HEADER = 'Kuota Izin';

/**
 * Parse kuota izin tersisa dari kolom AF sheet Izin
 */
function parseIzinQuota_(val) {
    try {
        var str = String(val || '').trim();
        if (!str) return 0;
        var lone = parseInt(str, 10);
        if (!isNaN(lone)) return Math.max(0, lone);
    } catch (e) { }
    return 0;
}

/**
 * Pastikan kolom AF ada di sheet Izin untuk kuota revisi tambahan
 */
function ensureIzinQuotaColumn_(sheet) {
    if (!sheet) return;
    var lastCol = sheet.getLastColumn();
    if (lastCol < IZIN_QUOTA_COLUMN) {
        sheet.insertColumnsAfter(lastCol, IZIN_QUOTA_COLUMN - lastCol);
    }
    var header = String(sheet.getRange(1, IZIN_QUOTA_COLUMN).getValue() || '').trim();
    if (!header) sheet.getRange(1, IZIN_QUOTA_COLUMN).setValue(IZIN_QUOTA_HEADER);
}

/**
 * Cari indeks baris berdasarkan NPM di sheet
 */
function findRowIndexByNpm_(sheet, npm) {
    try {
        var lastRow = sheet.getLastRow();
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) return -1;
        if (lastRow <= 1) return -1;
        var lastCol = sheet.getLastColumn();
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
        var idxNpm = headers.indexOf('npm');
        if (idxNpm < 0) idxNpm = 1;
        var values = sheet.getRange(2, idxNpm + 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < values.length; i++) {
            if (normalizeNpm_(values[i][0]) === npmClean) return i + 2;
        }
    } catch (e) {
        Logger.log('findRowIndexByNpm_ error: ' + e);
    }
    return -1;
}

// ============================================================
// ADMIN VALIDATION SYSTEM
// Sheet: 2025, 2024, 2023 → Sheet Kirim & Sheet Alasan
// ============================================================

var ADMIN_SHEETS = ['2026', '2025', '2024', '2023'];
var MK_SHEET_NAME = 'MK';
var KIRIM_SHEET_NAME = 'Kirim';
var ALASAN_SHEET_NAME = 'Alasan';
var ADMIN_UI_MODE = 'formula'; // 'formula' | 'script' — kini formula-based (full auto)

// ── Konstanta untuk layout formula ───────────────────────────────
var ADMIN_LIST_ROWS = 100;   // jumlah baris maksimum daftar mahasiswa per blok MK
var MONITOR_ROWS = 600;      // jumlah baris maksimum tabel monitor
var MONITOR_MAX = 600;       // batas baris data yang dipindai formula monitor (>= data nyata)
var DATA_MAX = 1500;         // batas maksimum baris data yang dipindai formula

/**
 * Konversi nomor kolom (1-based) menjadi huruf kolom (mis. 1→A, 27→AA)
 */
function _colLetter_(n) {
    var letters = '';
    while (n > 0) {
        var rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
}

/**
 * Rentang kolom slot MK per sheet admin (sama di Pendaftaran & Kirim):
 *   2026 → J:P (7 slot), 2025 → Q:W (7 slot), 2024 → X:AD (7 slot), 2023 → AE:AK (7 slot)
 */
function _mkSlotCols_(adminSheetName) {
    if (adminSheetName === '2026') return { start: 10, end: 16 };
    if (adminSheetName === '2025') return { start: 17, end: 23 };
    if (adminSheetName === '2024') return { start: 24, end: 30 };
    if (adminSheetName === '2023') return { start: 31, end: 37 };
    return null;
}

/**
 * Pastikan sheet Kirim punya header (disalin dari Pendaftaran) jika masih kosong.
 */
function ensureKirimHeaders_(ss) {
    var pendSheet = ss.getSheetByName('Pendaftaran');
    var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
    if (!kirimSheet) kirimSheet = ss.insertSheet(KIRIM_SHEET_NAME);
    if (kirimSheet.getLastRow() === 0 && pendSheet && pendSheet.getLastRow() > 0) {
        var headers = pendSheet.getRange(1, 1, 1, pendSheet.getLastColumn()).getValues()[0];
        kirimSheet.appendRow(headers);
        kirimSheet.getRange(1, 1, 1, headers.length).setBackground('#003087').setFontColor('#ffffff').setFontWeight('bold');
    }
}

/**
 * Menu Kustom untuk Admin (versi full-auto berbasis formula)
 */
function onOpen(e) {
    try {
        var ui = SpreadsheetApp.getUi();
        ui.createMenu('⚙️ Menu Admin')
            .addItem('1. Setup Otomatis (Formula + Trigger)', 'setupAutoAdmin')
            .addItem('2. Pasang Trigger WA', 'menuSetupWaAutomationTriggers')
            .addItem('3. Pasang Trigger Auto Admin', 'menuSetupAdminEditTrigger')
            .addSeparator()
            .addItem('4. Repair Formula Monitor', 'menuRefreshMonitor')
            .addItem('5. Setup Highlight ACC Pendaftaran', 'menuSetupPendaftaranAccHighlight')
            .addToUi();
    } catch (err) {
        Logger.log('onOpen error: ' + err.message);
    }
}

function menuRefreshMonitor() {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        setupMonitorFormulas_(ss);
        SpreadsheetApp.flush();
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert('Formula Monitor berhasil dipasang ulang. Monitor kini otomatis update.');
    } catch (err) {
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert('Gagal repair monitor: ' + err.message);
    }
}

function menuSetupWaAutomationTriggers() {
    try {
        var res = setupWaAutomationTriggers();
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert(String((res && res.message) ? res.message : 'Selesai'));
    } catch (err) {
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert('Gagal membuat trigger WA: ' + err.message);
    }
}

function menuSetupAdminEditTrigger() {
    try {
        var res = setupAdminEditTrigger();
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert(String(res || 'Selesai'));
    } catch (err) {
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert('Gagal membuat trigger Admin: ' + err.message);
    }
}

// Mapping: MK sheet column → Pendaftaran column index (0-based) dan max slot
var MK_COL_MAP = [
    { mkSheetCol: 4, semLabel: 'Sem1', startIdx: 9, slots: 7 },  // D → J:P
    { mkSheetCol: 5, semLabel: 'Sem3', startIdx: 16, slots: 7 },  // E → Q:W
    { mkSheetCol: 6, semLabel: 'Sem5', startIdx: 23, slots: 7 },  // F → X:AD
    { mkSheetCol: 7, semLabel: 'Sem7', startIdx: 30, slots: 7 }   // G → AE:AK
];

// Dropdown options yang tersedia per sheet admin
var ADMIN_MK_SCOPE = {
    '2026': [4],
    '2025': [5],
    '2024': [6],
    '2023': [7]
};

/**
 * Setup satu kali: buat struktur header, dropdown, dan validasi
 * Jalankan manual dari editor GAS: setupAdminSheets()
 */
function setupAdminSheets() {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var mkSheet = ss.getSheetByName(MK_SHEET_NAME);
    if (!mkSheet) {
        Logger.log('Error: Sheet MK tidak ditemukan.');
        return;
    }

    ensureKirimHeaders_(ss);

    // Setup sheet Alasan
    var alasanSheet = ss.getSheetByName(ALASAN_SHEET_NAME);
    if (!alasanSheet) alasanSheet = ss.insertSheet(ALASAN_SHEET_NAME);
    if (alasanSheet.getLastRow() === 0) {
        alasanSheet.appendRow(['Timestamp', 'NPM', 'Nama Lengkap', 'Angkatan', 'Mata Kuliah', 'Sheet Admin', 'Alasan']);
        alasanSheet.getRange('A1:G1').setBackground('#8B0000').setFontColor('#ffffff').setFontWeight('bold');
    }

    ADMIN_SHEETS.forEach(function (sheetName) {
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.insertSheet(sheetName);
        setupAdminFormulaBlocks_(sheet);
        Logger.log('Setup sheet ' + sheetName + ' selesai (formula-based).');
    });

    Logger.log('setupAdminSheets selesai.');
}

/**
 * Bangun blok blok MK di sheet admin dengan FORMULA (full auto):
 *   Kolom A → NPM (FILTER dari Pendaftaran berdasarkan MK di dropdown)
 *   Kolom B → Nama Lengkap (VLOOKUP)
 *   Kolom C → Angkatan (VLOOKUP)
 *   Kolom D → Status ACC/Tidak ACC/-- (baca dari Kirim & Alasan)
 *   Kolom E → Keputusan (dropdown yang diisi admin → diproses onEdit)
 *   Kolom F → Alasan / Catatan
 * Rumus TIDAK boleh ditimpa oleh script lain (hanya kolom E/F yang diedit admin).
 */
function setupAdminFormulaBlocks_(sheet) {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var name = String(sheet.getName() || '').trim();
    var blocks = getAdminBlockStartCols_(name);
    var mkSlots = _mkSlotCols_(name);
    if (!mkSlots) return;

    var mkSheet = ss.getSheetByName(MK_SHEET_NAME);
    var mkNames = mkSheet ? getMkListForAdminSheet_(mkSheet, name) : [];
    var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['-- Pilih MK --'].concat(mkNames), true)
        .setAllowInvalid(false)
        .build();
    var statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['--', 'ACC', 'Tidak ACC'], true)
        .setAllowInvalid(false)
        .build();

    var maxRows = 3 + ADMIN_LIST_ROWS;
    var maxCol = blocks[blocks.length - 1] + 5;
    if (sheet.getMaxColumns() < maxCol) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), maxCol - sheet.getMaxColumns());
    }
    if (sheet.getMaxRows() < maxRows) {
        sheet.insertRowsAfter(sheet.getMaxRows(), maxRows - sheet.getMaxRows());
    }

    var cStart = _colLetter_(mkSlots.start);
    var cEnd = _colLetter_(mkSlots.end);
    var slotCount = mkSlots.end - mkSlots.start + 1;
    var pendMkRange = 'Pendaftaran!$' + cStart + '$2:$' + cEnd + '$' + DATA_MAX;
    var kirimMkRange = 'Kirim!$' + cStart + '$2:$' + cEnd + '$' + DATA_MAX;
    var kirimNpmRange = 'Kirim!$B$2:$B$' + DATA_MAX;
    var alasanNpmRange = 'Alasan!$B$2:$B$' + DATA_MAX;
    var alasanMkRange = 'Alasan!$E$2:$E$' + DATA_MAX;
    var npmSrc = 'Pendaftaran!$B$2:$B$' + DATA_MAX;

    blocks.forEach(function (s) {
        var mkCell = '$' + _colLetter_(s + 1) + '$1';
        var npmCol = _colLetter_(s);
        var rangeTop = '$' + npmCol + '$4:$' + npmCol + '$' + maxRows;

        // Pertahankan pilihan MK yang sudah ada di dropdown
        var prevMk = String(sheet.getRange(1, s + 1).getValue() || '').trim();

        // Kosongkan area daftar mahasiswa lama (baris 4 ke bawah)
        sheet.getRange(4, s, ADMIN_LIST_ROWS, 6).clearContent().clearFormat().clearDataValidations();

        // Baris 1: label + dropdown MK
        sheet.getRange(1, s).setValue('Pilih Mata Kuliah:').setFontWeight('bold');
        sheet.getRange(1, s + 1).setDataValidation(rule);
        if (prevMk && mkNames.indexOf(prevMk) !== -1) sheet.getRange(1, s + 1).setValue(prevMk);
        else sheet.getRange(1, s + 1).setValue('-- Pilih MK --');

        // Baris 2: petunjuk
        sheet.getRange(2, s, 1, 6).merge()
            .setValue('Daftar mahasiswa terisi otomatis. Pilih ACC / Tidak ACC di kolom Keputusan, sistem akan otomatis memproses.')
            .setFontSize(8).setFontColor('#666666');

        // Baris 3: header
        sheet.getRange(3, s, 1, 6).setValues([
            ['NPM', 'Nama Lengkap', 'Angkatan', 'Status', 'Keputusan', 'Alasan / Catatan']
        ]).setBackground('#003087').setFontColor('#ffffff').setFontWeight('bold');

        sheet.setColumnWidth(s, 110);
        sheet.setColumnWidth(s + 1, 200);
        sheet.setColumnWidth(s + 2, 80);
        sheet.setColumnWidth(s + 3, 100);
        sheet.setColumnWidth(s + 4, 110);
        sheet.setColumnWidth(s + 5, 180);

        // A4: daftar NPM otomatis (spill) untuk MK di dropdown
        var a4 = '=IFERROR(FILTER(' + npmSrc + ',MMULT(N(' + pendMkRange +
            '=' + mkCell + '),SEQUENCE(' + slotCount + ',1,1,0))>0,' + npmSrc + '<>""),"")';
        sheet.getRange(4, s).setFormula(a4);

        // B4: Nama (spill)
        var b4 = '=ARRAYFORMULA(IF(' + rangeTop + '="","",IFERROR(VLOOKUP(' + rangeTop +
            ',Pendaftaran!$B$2:$C$' + DATA_MAX + ',2,0),"")))';
        sheet.getRange(4, s + 1).setFormula(b4);

        // C4: Angkatan (spill)
        var c4 = '=ARRAYFORMULA(IF(' + rangeTop + '="","",IFERROR(VLOOKUP(' + rangeTop +
            ',Pendaftaran!$B$2:$F$' + DATA_MAX + ',5,0),"")))';
        sheet.getRange(4, s + 2).setFormula(c4);

        // D4..: Status per baris (baca dari Kirim & Alasan)
        var dForms = [];
        for (var r = 4; r <= maxRows; r++) {
            var npmCell = '$' + npmCol + r;
            dForms.push(['=IF(' + npmCell + '="","",IF(SUMPRODUCT((' + alasanNpmRange + '=' + npmCell +
                ')*(' + alasanMkRange + '=' + mkCell + '))>0,"Tidak ACC",IF(SUMPRODUCT((' +
                kirimNpmRange + '=' + npmCell + ')*(' + kirimMkRange + '=' + mkCell +
                '))>0,"ACC","--")))']);
        }
        sheet.getRange(4, s + 3, ADMIN_LIST_ROWS, 1).setFormulas(dForms);

        // E4..: dropdown Keputusan (diisi admin, diproses onEdit)
        sheet.getRange(4, s + 4, ADMIN_LIST_ROWS, 1).clearDataValidations().setDataValidation(statusRule);
        sheet.getRange(4, s + 5, ADMIN_LIST_ROWS, 1).clearContent();
    });
}

/**
 * Bangun sheet Monitor dengan FORMULA (selalu update, tanpa klik):
 *   Ringkasan (baris 1-5) + tabel detail (baris 8 ke bawah)
 */
function setupMonitorFormulas_(ss) {
    var monitor = ss.getSheetByName('Monitor');
    if (!monitor) monitor = ss.insertSheet('Monitor');
    monitor.clear();

    // Persempit rentang scan Pendaftaran agar recalc ringan (baris data nyata ±500;
    // sesuaikan MONITOR_MAX jika bertambah). Sheet lain (Kirim/WA/Alasan/Pembayaran)
    // tetap dipindai penuh ke DATA_MAX karena 1 NPM bisa punya banyak baris MK.
    var PMAX = MONITOR_MAX;

    var P = 'Pendaftaran!$B$2:$B$' + PMAX;
    var KBA = 'Kirim!$BO$2:$BO$' + DATA_MAX;

    // ── Ringkasan ──────────────────────────────────────────────────
    monitor.getRange('A1:D1').merge().setValue('LAPORAN MONITORING')
        .setFontWeight('bold').setFontSize(14).setBackground('#f3f4f6');

    var labels = [
        'Total Mahasiswa Mendaftar',
        'Total Mahasiswa ACC Final',
        'Total Upload Pembayaran',
        'Belum Upload Pembayaran (dari yg ACC)'
    ];
    for (var i = 0; i < labels.length; i++) {
        var r = i + 2;
        monitor.getRange(r, 1, 1, 3).merge().setValue(labels[i]).setFontWeight('bold');
        monitor.getRange(r, 4).setValue(':').setFontWeight('bold').setHorizontalAlignment('center');
    }
    monitor.getRange('E2').setFormula('=COUNTA(' + P + ')');
    monitor.getRange('E3').setFormula('=COUNTIF(' + KBA + ',"ACC")');
    monitor.getRange('E4').setFormula('=COUNTA(Pembayaran!$B$2:$B$' + DATA_MAX + ')');
    monitor.getRange('E5').setFormula('=MAX(0,$E$3-$E$4)');
    monitor.getRange('A2:E5').setFontWeight('bold').setHorizontalAlignment('left');

    // ── Header tabel (baris 7) ─────────────────────────────────────
    var headers = ['No', 'NPM', 'Nama Lengkap', 'Sudah Daftar?', 'MK Dipilih', 'MK Disetujui',
        'MK Ditolak', 'Semua Diputuskan?', 'Status BA', 'Link ACC Siap?', 'WA Status',
        'Pembayaran Masuk?', 'Keterangan'];
    monitor.getRange(7, 1, 1, headers.length).setValues([headers])
        .setBackground('#003087').setFontColor('#ffffff').setFontWeight('bold');

    // ── Formula baris detail (baris 8 ke bawah) ────────────────────
    var start = 8;
    var end = start + MONITOR_ROWS - 1;
    var formulas = [];
    for (var r = start; r <= end; r++) {
        var b = '$B' + r, e = '$E' + r, f = '$F' + r, g = '$G' + r, h = '$H' + r,
            iI = '$I' + r, l = '$L' + r;
        var pendRanges = 'Pendaftaran!$B$2:$C$' + PMAX;
        formulas.push([
            '=IF(' + b + '="","",ROW()-7)',
            '=IFERROR(INDEX(' + P + ',SMALL(IF(' + P + '<>"",ROW(' + P + ')-1),ROW()-7)),"")',
            '=IF(' + b + '="","",IFERROR(VLOOKUP(' + b + ',' + pendRanges + ',2,0),""))',
            '=IF(' + b + '="","","Ya")',
            '=IF(' + b + '="","",SUMPRODUCT(--(OFFSET(Pendaftaran!$J$1,MATCH(' + b + ',' + P + ',0),0,1,28)<>"")))',
            '=IF(' + b + '="","",SUMPRODUCT((Kirim!$B$2:$B$' + DATA_MAX + '=' + b + ')*(Kirim!$J$2:$AK$' + DATA_MAX + '<>"")))',
            '=IF(' + b + '="","",COUNTIF(Alasan!$B$2:$B$' + DATA_MAX + ',' + b + '))',
            '=IF(' + b + '="","",IF(AND(' + e + '>0,' + e + '=' + f + '+' + g + '),"Ya","Belum"))',
            '=IF(' + b + '="","",IFERROR(INDEX(' + KBA + ',MATCH(' + b + ',Kirim!$B$2:$B$' + DATA_MAX + ',0)),""))',
            '=IF(' + b + '="","",IF(SUMPRODUCT((Kirim!$B$2:$B$' + DATA_MAX + '=' + b + ')*(Kirim!$BP$2:$BQ$' + DATA_MAX + '<>""))>0,"Ya","Belum"))',
            '=IF(' + b + '="","",IFERROR(INDEX(WA!$P$2:$P$' + DATA_MAX + ',MATCH(' + b + ',WA!$D$2:$D$' + DATA_MAX + ',0)),"-"))',
            '=IF(' + b + '="","",IF(COUNTIF(Pembayaran!$B$2:$B$' + DATA_MAX + ',' + b + ')>0,"SUDAH","BELUM"))',
            '=IF(' + b + '="","",IF(' + l + '="SUDAH","Selesai",IF(UPPER(' + iI + ')="ACC","Menunggu upload pembayaran",IF(' + h + '="Ya","Keputusan selesai, BA belum tersetting ACC","Proses validasi Admin"))))'
        ]);
    }
    monitor.getRange(start, 1, MONITOR_ROWS, headers.length).setFormulas(formulas);
    monitor.setColumnWidth(1, 40);
    monitor.setColumnWidth(2, 110);
    monitor.setColumnWidth(3, 180);
    monitor.setColumnWidth(13, 250);
    monitor.getRange(start, 4, MONITOR_ROWS, 9).setHorizontalAlignment('center');
    monitor.setFrozenRows(7);
}

/**
 * Cat ulang seluruh baris data di Pendaftaran berdasarkan status ACC di Kirim BO.
 * Dipakai dari menu Setup — idempoten, aman dijalankan ulang.
 * Juga membersihkan sisa eksperimen lama (kolom bantu AL + rule conditional formatting).
 */
function syncPendaftaranAccHighlight_() {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var pendSheet = ss.getSheetByName('Pendaftaran');
        var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
        if (!pendSheet) return;
        var maxRow = DATA_MAX;

        // Bersihkan sisa pendekatan lama: kolom bantu AL (38) + rule CF lintas-sheet
        pendSheet.showColumns(38);
        pendSheet.getRange(2, 38, maxRow - 1, 1).clearContent();
        var rules = pendSheet.getConditionalFormatRules().filter(function (r) {
            var fmt = '';
            try { fmt = String(r.getCriteria().getCriteriaValues()[0] || ''); } catch (e) { fmt = ''; }
            return fmt.indexOf('Kirim!$B$2:$BO$') === -1 && fmt.indexOf('$AL2="ACC"') === -1;
        });
        pendSheet.setConditionalFormatRules(rules);

        // Reset semua baris data (A..AK) ke warna putih
        var pLast = Math.min(pendSheet.getLastRow(), maxRow);
        if (pLast < 2) return;
        pendSheet.getRange(2, 1, pLast - 1, 37).setBackground('#FFFFFF');

        if (!kirimSheet || kirimSheet.getLastRow() <= 1 || kirimSheet.getLastColumn() < KIRIM_STATUS_COL) return;
        var kLast = Math.min(kirimSheet.getLastRow(), maxRow);
        var kB = kirimSheet.getRange(2, 2, kLast - 1, 1).getValues();
        var kAcc = kirimSheet.getRange(2, KIRIM_STATUS_COL, kLast - 1, 1).getValues();
        var accSet = {};
        for (var ki = 0; ki < kLast - 1; ki++) {
            if (String(kAcc[ki][0] || '').trim().toUpperCase() === 'ACC') {
                var n = normalizeNpm_(kB[ki][0]);
                if (n) accSet[n] = true;
            }
        }
        var pB = pendSheet.getRange(2, 2, pLast - 1, 1).getValues();
        var runs = [];
        var runStart = -1;
        for (var r = 0; r < pLast - 1; r++) {
            var isAcc = !!accSet[normalizeNpm_(pB[r][0])];
            if (isAcc && runStart === -1) runStart = r;
            if (!isAcc && runStart !== -1) { runs.push([runStart, r - 1]); runStart = -1; }
        }
        if (runStart !== -1) runs.push([runStart, pLast - 2]);
        for (var j = 0; j < runs.length; j++) {
            pendSheet.getRange(runs[j][0] + 2, 1, runs[j][1] - runs[j][0] + 1, 37).setBackground('#D9EAD3');
        }
        SpreadsheetApp.flush();
    } catch (err) {
        Logger.log('syncPendaftaranAccHighlight_ error: ' + err.message);
    }
}

/**
 * Cat baris mahasiswa tertentu di Pendaftaran sesuai status ACC.
 * Dipanggil dari checkAndSetACC_ / handleIzinSheetEdit_ agar baris langsung berubah.
 * accStatus: 'ACC' → hijau, '' → putih, undefined → baca sendiri dari Kirim BO.
 */
function paintPendaftaranRowByNpm_(ss, npm, accStatus) {
    try {
        var pendSheet = ss.getSheetByName('Pendaftaran');
        if (!pendSheet) return;
        var npmClean = normalizeNpm_(npm);
        if (!npmClean) return;
        var maxRow = DATA_MAX;
        var pLast = Math.min(pendSheet.getLastRow(), maxRow);
        if (pLast < 2) return;

        var acc = '';
        if (accStatus === undefined) {
            var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
            if (kirimSheet && kirimSheet.getLastRow() > 1 && kirimSheet.getLastColumn() >= KIRIM_STATUS_COL) {
                var kLast = Math.min(kirimSheet.getLastRow(), maxRow);
                var kB = kirimSheet.getRange(2, 2, kLast - 1, 1).getValues();
                var kAcc = kirimSheet.getRange(2, KIRIM_STATUS_COL, kLast - 1, 1).getValues();
                for (var ki = 0; ki < kLast - 1; ki++) {
                    if (normalizeNpm_(kB[ki][0]) === npmClean) {
                        acc = String(kAcc[ki][0] || '').trim().toUpperCase();
                        break;
                    }
                }
            }
        } else {
            acc = String(accStatus || '').trim().toUpperCase();
        }

        var color = (acc === 'ACC') ? '#D9EAD3' : '#FFFFFF';
        var pB = pendSheet.getRange(2, 2, pLast - 1, 1).getValues();
        var runs = [];
        var runStart = -1;
        for (var r = 0; r < pLast - 1; r++) {
            var isMatch = (normalizeNpm_(pB[r][0]) === npmClean);
            if (isMatch && runStart === -1) runStart = r;
            if (!isMatch && runStart !== -1) { runs.push([runStart, r - 1]); runStart = -1; }
        }
        if (runStart !== -1) runs.push([runStart, pLast - 2]);
        for (var j = 0; j < runs.length; j++) {
            pendSheet.getRange(runs[j][0] + 2, 1, runs[j][1] - runs[j][0] + 1, 37).setBackground(color);
        }
    } catch (err) {
        Logger.log('paintPendaftaranRowByNpm_ error: ' + err.message);
    }
}

function menuSetupPendaftaranAccHighlight() {
    try {
        syncPendaftaranAccHighlight_();
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert('Highlight ACC di Pendaftaran sudah disinkronkan.');
    } catch (err) {
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert('Gagal: ' + err.message);
    }
}

/**
 * SETUP SATU KALI — mengganti seluruh Menu Admin lama:
 *   1) Bangun blok formula di sheet 2026/2025/2024/2023
 *   2) Bangun sheet Monitor berbasis formula
 *   3) Pasang highlight ACC di Pendaftaran (baris hijau)
 *   4) Pasang trigger WA (1 menit) + trigger auto admin (onEdit)
 */
function setupAutoAdmin() {
    try {
        if (SpreadsheetApp.getUi) {
            var resp = SpreadsheetApp.getUi().alert(
                'Setup Ulang (Repair)',
                'Ini akan memasang ulang semua formula (sheet admin, Monitor, highlight Pendaftaran) dan trigger.\n\n' +
                'Catatan: area daftar di sheet admin (termasuk kolom E/F yang belum sempat diproses) akan dibersihkan ulang. ' +
                'Keputusan yang sudah diproses TIDAK hilang.\n\n' +
                'Lanjutkan?',
                SpreadsheetApp.getUi().ButtonSet.YES_NO
            );
            if (resp !== SpreadsheetApp.getUi().Button.YES) {
                return 'Setup dibatalkan.';
            }
        }

        var ss = SpreadsheetApp.openById(getSpreadsheetId());

        // Pastikan semua sheet yang dirujuk formula ada
        ['Pendaftaran', 'MK', KIRIM_SHEET_NAME, ALASAN_SHEET_NAME, 'WA', 'Pembayaran', 'DM'].forEach(function (n) {
            if (!ss.getSheetByName(n)) ss.insertSheet(n);
        });

        setupAdminSheets();
        setupMonitorFormulas_(ss);
        syncPendaftaranAccHighlight_();
        SpreadsheetApp.flush();

        var wa = setupWaAutomationTriggers();
        var admin = setupAdminEditTrigger();

        var msg = 'Setup Otomatis selesai!\n' +
            '- Sheet 2026/2025/2024/2023 kini berbasis formula (daftar MK auto-update)\n' +
            '- Monitor berbasis formula (selalu update)\n' +
            '- Highlight ACC di Pendaftaran (baris hijau)\n' +
            '- ' + ((wa && wa.message) || 'Trigger WA') + '\n' +
            '- ' + admin;
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert(msg);
        Logger.log('setupAutoAdmin: ' + msg);
        return msg;
    } catch (err) {
        var errMsg = 'setupAutoAdmin error: ' + err.message;
        Logger.log(errMsg);
        if (SpreadsheetApp.getUi) SpreadsheetApp.getUi().alert('Setup gagal: ' + err.message);
        return errMsg;
    }
}

/**
 * Ambil daftar nama MK untuk dropdown di sheet admin tertentu
 */
function getMkListForAdminSheet_(mkSheet, adminSheetName) {
    var scope = ADMIN_MK_SCOPE[adminSheetName] || [4];
    var names = [];
    var lastRow = mkSheet.getLastRow();
    if (lastRow < 2) return names;

    scope.forEach(function (colNum) {
        var vals = mkSheet.getRange(2, colNum, lastRow - 1, 1).getValues();
        vals.forEach(function (r) {
            var v = String(r[0] || '').trim();
            if (v && names.indexOf(v) === -1) names.push(v);
        });
    });
    return names;
}

/**
 * Cari info kolom di Pendaftaran berdasarkan nama MK.
 * Hasil mapping di-cache 30 menit agar tidak re-read sheet MK setiap onEdit.
 */
function getMkColumnInfo_(mkName) {
    try {
        var mkNameKey = normalizeMkName_(mkName);
        var cacheKey = 'mkColInfoMap_v3';
        var cache = CacheService.getScriptCache();

        // Coba ambil dari cache dulu
        var cached = cache.get(cacheKey);
        var mkMap = {};
        if (cached) {
            try { mkMap = JSON.parse(cached); } catch (e) { mkMap = {}; }
        }

        // Jika ada di cache, langsung return
        if (mkMap[mkNameKey]) return mkMap[mkNameKey];

        // Tidak ada di cache → baca dari sheet (seminim mungkin API call)
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var mkSheet = ss.getSheetByName(MK_SHEET_NAME);
        var lastRow = mkSheet.getLastRow();
        if (lastRow < 2) return null;

        // Baca kolom D, E, F, G sekaligus dalam 1 API call (bukan 4x getRange)
        var allVals = mkSheet.getRange(2, 4, lastRow - 1, 4).getValues(); // cols D,E,F,G

        // Baca kolom A (Nama MK) dan B (SKS) untuk mencari nilai SKS
        var sksVals = mkSheet.getRange(2, 1, lastRow - 1, 2).getValues(); // cols A,B
        var sksMap = {};
        sksVals.forEach(function (r) {
            var mk = String(r[0] || '').trim();
            if (mk) sksMap[mk] = String(r[1] || '').trim();
        });

        MK_COL_MAP.forEach(function (cfg, colOffset) {
            for (var i = 0; i < allVals.length; i++) {
                var v = String(allVals[i][colOffset] || '').trim();
                if (!v) continue;

                // Cari nilai SKS di kolom B (indeks 1) untuk nama MK ini
                var sks = sksMap[v] || '';
                var inValidSlot = i < cfg.slots;

                mkMap[normalizeMkName_(v)] = {
                    pendIdx: inValidSlot ? (cfg.startIdx + i) : null,
                    pendCol: inValidSlot ? (cfg.startIdx + i + 1) : null,
                    sksCol: inValidSlot ? (cfg.startIdx + i + 29) : null, // Kolom AL (38) berjarak 28 kolom dari J (10)
                    sks: sks,
                    semLabel: cfg.semLabel,
                    slotPos: i + 1,
                    inValidSlot: inValidSlot
                };
            }
        });

        // Simpan ke cache selama 30 menit
        try { cache.put(cacheKey, JSON.stringify(mkMap), 1800); } catch (e) { }

        return mkMap[mkNameKey] || null;
    } catch (e) {
        Logger.log('getMkColumnInfo_ error: ' + e.message);
        return null;
    }
}

/**
 * Hapus cache mapping MK — panggil setiap kali isi sheet MK diubah
 */
function clearMkColumnInfoCache() {
    try {
        var cache = CacheService.getScriptCache();
        cache.remove('mkColInfoMap_v1');
        cache.remove('mkColInfoMap_v3');
        cache.removeAll(['mkList_sem1_v1', 'mkList_sem3_v1', 'mkList_sem5_v1', 'mkList_sem7_v1']);
        Logger.log('MK column info and lists cache cleared.');
    } catch (e) { Logger.log('clearMkColumnInfoCache error: ' + e.message); }
}

/**
 * SIMPLE TRIGGER sebagai fallback
 */
function onEdit(e) {
    // Dinonaktifkan karena alur admin sekarang menggunakan Menu Admin murni
    // untuk menghindari masalah trigger yang sering tidak berjalan
}

/**
 * Trigger onEdit — dipanggil oleh onEdit() di atas, atau bisa juga
 * dipasang sebagai installable trigger via setupAdminEditTrigger().
 */
function onEditAdminSheet(e) {
    return onEditAdminRealtime_(e);
}

/*
=========================================
ADMIN REALTIME AUTOMATION (TANPA MENU)
=========================================
*/

function onEditAdminRealtime_(e) {
    // Guard: jika dipanggil tanpa event object (mis. dari Run editor), hentikan
    if (!e || !e.source) {
        Logger.log('onEditAdminSheet: Tidak ada event object. Jalankan setupAdminEditTrigger() dari editor GAS untuk memasang trigger yang benar.');
        return;
    }
    try {
        var lock = LockService.getDocumentLock();
        if (!lock.tryLock(5000)) return;

        // FIX: gunakan e.range.getSheet() bukan e.source.getActiveSheet()
        // getActiveSheet() bisa mengembalikan sheet yang salah saat trigger berjalan asinkron
        var sheet = e.range.getSheet();
        var name = String(sheet.getName() || '').trim();
        if (name === KIRIM_SHEET_NAME) {
            handleKirimSheetEdit_(e);
            return;
        }

        // --- TAMBAHAN: Penanganan untuk Sheet Izin ---
        if (name === 'Izin') {
            handleIzinSheetEdit_(e);
            return;
        }
        // ---------------------------------------------

        if (ADMIN_SHEETS.indexOf(name) === -1) return;

        var row = e.range.getRow();
        var col = e.range.getColumn();
        var range = e.range;
        if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
        if (row < 4) return; // MK dropdown & header diurus otomatis oleh formula

        var blockStartCols = getAdminBlockStartCols_(name);
        for (var i = 0; i < blockStartCols.length; i++) {
            var startCol = blockStartCols[i];
            // Hanya kolom E (Keputusan) yang diproses; kolom A-D adalah formula.
            if (col === (startCol + 4)) {
                var newStatus = String(range.getValue() || '').trim();
                handleStatusChangeRealtime_(sheet, row, newStatus, startCol);
                return;
            }
        }
    } catch (err) {
        Logger.log('onEditAdminRealtime_ error: ' + err.message);
    } finally {
        try { LockService.getDocumentLock().releaseLock(); } catch (e2) { }
    }
}

/**
 * Setup installable onEdit trigger untuk onEditAdminSheet.
 * JALANKAN SATU KALI dari editor GAS (klik Run → setupAdminEditTrigger).
 * Setelah itu, perubahan di sheet Admin, Kirim, dan Izin akan otomatis diproses.
 */
function setupAdminEditTrigger() {
    try {
        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        var triggers = ScriptApp.getProjectTriggers();

        // Hapus trigger lama agar tidak duplikat
        for (var i = 0; i < triggers.length; i++) {
            var fn = triggers[i].getHandlerFunction();
            if (fn === 'onEditAdminSheet' || fn === 'onEditAdminRealtime_') {
                ScriptApp.deleteTrigger(triggers[i]);
                Logger.log('setupAdminEditTrigger: trigger lama dihapus');
            }
        }

        // Buat installable onEdit trigger baru
        ScriptApp.newTrigger('onEditAdminRealtime_')
            .forSpreadsheet(ss)
            .onEdit()
            .create();

        Logger.log('setupAdminEditTrigger: Trigger onEditAdminRealtime_ berhasil dipasang!');
        return 'Trigger Auto Admin berhasil dipasang! Sekarang pilih MK dan keputusan ACC/Tidak ACC akan berjalan otomatis.';
    } catch (err) {
        Logger.log('setupAdminEditTrigger error: ' + err.message);
        return 'Error: ' + err.message;
    }
}

/**
 * Diagnostik: tampilkan semua MK di sheet MK (kolom D/E/F/G) vs Pendaftaran.
 * Jalankan dari editor GAS untuk cek konsistensi nama MK.
 */
function testMkSheet() {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var mkSheet = ss.getSheetByName('MK');
    if (!mkSheet) { Logger.log('STOP: Sheet MK tidak ditemukan'); return; }
    var lastRow = mkSheet.getLastRow();
    if (lastRow < 2) { Logger.log('STOP: Sheet MK kosong'); return; }

    var mkVals = mkSheet.getRange(2, 4, lastRow - 1, 4).getValues();
    var mkFromSheet = { D: [], E: [], F: [], G: [] };
    mkVals.forEach(function (row) {
        var d = String(row[0] || '').trim(); if (d) mkFromSheet.D.push(d);
        var e = String(row[1] || '').trim(); if (e) mkFromSheet.E.push(e);
        var f = String(row[2] || '').trim(); if (f) mkFromSheet.F.push(f);
        var g = String(row[3] || '').trim(); if (g) mkFromSheet.G.push(g);
    });

    Logger.log('=== MK di Sheet MK ===');
    Logger.log('Kolom D/Sem1/2026 (' + mkFromSheet.D.length + ' MK): ' + JSON.stringify(mkFromSheet.D));
    Logger.log('Kolom E/Sem3/2025 (' + mkFromSheet.E.length + ' MK): ' + JSON.stringify(mkFromSheet.E));
    Logger.log('Kolom F/Sem5/2024 (' + mkFromSheet.F.length + ' MK): ' + JSON.stringify(mkFromSheet.F));
    Logger.log('Kolom G/Sem7/2023 (' + mkFromSheet.G.length + ' MK): ' + JSON.stringify(mkFromSheet.G));

    var pendSheet = ss.getSheetByName('Pendaftaran');
    if (!pendSheet || pendSheet.getLastRow() <= 1) { Logger.log('Pendaftaran kosong'); return; }
    var pData = pendSheet.getRange(2, 1, pendSheet.getLastRow() - 1, pendSheet.getLastColumn()).getValues();
    var mkFromPend = {};
    pData.forEach(function (row) {
        for (var i = 9; i <= 36; i++) {
            var v = String(row[i] || '').trim();
            if (v) mkFromPend[v] = (mkFromPend[v] || 0) + 1;
        }
    });

    var allMkSheet = mkFromSheet.D.concat(mkFromSheet.E, mkFromSheet.F, mkFromSheet.G);
    var mkSheetSet = {};
    allMkSheet.forEach(function (m) { mkSheetSet[m] = true; });

    Logger.log('=== CROSS-REF: MK di Pendaftaran vs Sheet MK ===');
    Object.keys(mkFromPend).sort().forEach(function (mk) {
        var tag = mkSheetSet[mk] ? 'ADA di MK sheet' : '!!! TIDAK ADA di MK sheet';
        Logger.log('  [' + tag + '] ' + mk + ' (n=' + mkFromPend[mk] + ')');
    });
    Logger.log('=== MK di Sheet MK yang BELUM ada mahasiswanya ===');
    allMkSheet.forEach(function (mk) {
        if (!mkFromPend[mk]) Logger.log('  [KOSONG] ' + mk);
    });
}

/**
 * Handle perubahan di Sheet Izin

 * Jika NPM dimasukkan ke Sheet Izin, hapus status "ACC" di kolom BA Sheet Kirim
 */
function handleIzinSheetEdit_(e) {
    try {
        // FIX: gunakan e.range.getSheet() untuk konsistensi
        var range = e.range;
        var rowStart = range.getRow();
        var colStart = range.getColumn();
        var numRows = range.getNumRows();
        var numCols = range.getNumColumns();

        // Cek apakah rentang yang di-edit mencakup kolom B (kolom ke-2) dan bukan hanya baris header (baris 1)
        var colEnd = colStart + numCols - 1;
        if (colStart <= 2 && colEnd >= 2 && (rowStart + numRows - 1) > 1) {

            var ss = e.source;
            var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
            if (!kirimSheet || kirimSheet.getLastRow() <= 1) return;

            // Dapatkan semua data NPM yang diinput/di-paste di sheet Izin
            // Karena rentang bisa lebih dari satu baris, kita ambil values-nya
            var values = range.getValues();

            // Kumpulkan semua NPM yang diinput (bersihkan formatnya)
            var npmToReset = [];
            for (var r = 0; r < values.length; r++) {
                var actualRow = rowStart + r;
                if (actualRow === 1) continue; // Lewati header

                // Indeks kolom NPM di dalam array values: (2 - colStart)
                var npmIndex = 2 - colStart;
                var npmInput = String(values[r][npmIndex] || '').trim();

                if (npmInput) {
                    var npmClean = normalizeNpm_(npmInput);
                    if (npmClean) npmToReset.push(npmClean);
                }
            }

            if (npmToReset.length === 0) return;

            // Baca data sheet Kirim sekaligus untuk pencarian cepat
            var kLastRow = kirimSheet.getLastRow();
            var kData = kirimSheet.getRange(2, 1, kLastRow - 1, 2).getValues();
            var kCols = kirimSheet.getLastColumn();

            if (kCols >= KIRIM_STATUS_COL) {
                var isChanged = false;
                for (var i = 0; i < kData.length; i++) {
                    var kNpm = normalizeNpm_(kData[i][1]);
                    // Jika NPM di sheet Kirim ada di dalam daftar NPM yang di-paste di Izin
                    if (npmToReset.indexOf(kNpm) !== -1) {
                        var rowIdx = i + 2;
                        var accCell = kirimSheet.getRange(rowIdx, KIRIM_STATUS_COL);
                        if (String(accCell.getValue()).trim().toUpperCase() === 'ACC') {
                            accCell.setValue('');
                            isChanged = true;
                            Logger.log('handleIzinSheetEdit_: Status ACC dihapus untuk NPM ' + kNpm + ' karena masuk Sheet Izin');
                        }
                    }
                }
                if (isChanged) SpreadsheetApp.flush();
            }

            // Sinkronkan warna baris di Pendaftaran → putih (ACC dihapus via Sheet Izin)
            for (var p = 0; p < npmToReset.length; p++) {
                paintPendaftaranRowByNpm_(ss, npmToReset[p], '');
            }
        }
    } catch (err) {
        Logger.log('handleIzinSheetEdit_ error: ' + err.message);
    }
}

function getAdminBlockStartCols_(sheetName) {
    var baseCols = [1, 7, 13, 19, 25, 31, 37];
    // 2023-2026 sama-sama memakai 7 blok: B, H, N, T, Z, AF, AL
    return baseCols.slice(0, 7);
}

function handleStatusChangeRealtime_(sheet, row, newStatus, startCol) {
    try {
        startCol = startCol || 1;
        var status = String(newStatus || '').trim();
        var mkName = String(sheet.getRange(1, startCol + 1).getValue() || '').trim();

        // Reset selalu di akhir; jika input tidak valid, reset lalu berhenti
        if (!mkName || mkName === '-- Pilih MK --') { resetDecisionCell_(sheet, row, startCol); return; }

        var rowData = sheet.getRange(row, startCol, 1, 6).getValues()[0];
        var npm = String(rowData[0] || '').trim();
        var nama = String(rowData[1] || '').trim();
        var angkatan = String(rowData[2] || '').trim();
        var alasan = String(rowData[5] || '').trim();
        if (!npm) { resetDecisionCell_(sheet, row, startCol); return; }

        var mkInfo = getMkColumnInfo_(mkName);
        if (!mkInfo || !mkInfo.pendCol || !mkInfo.sksCol) { resetDecisionCell_(sheet, row, startCol); return; }

        var ss = SpreadsheetApp.openById(getSpreadsheetId());
        if (status === 'ACC' || status === 'Setuju') {
            upsertKirimRow_(ss, npm, nama, angkatan, mkName, mkInfo);
            removeAlasanRow_(ss, npm, mkName); // hapus penolakan lama jika ada
        } else if (status === 'Tidak ACC' || status === 'Tidak Setuju') {
            removeFromKirim_(ss, npm, mkInfo);
            addAlasanRow_(ss, npm, nama, angkatan, mkName, sheet.getName(), alasan);
        } else {
            // Status kembali ke '--' / kosong → batalkan keputusan sebelumnya
            removeFromKirim_(ss, npm, mkInfo);
            removeAlasanRow_(ss, npm, mkName);
        }

        checkAndSetACC_(ss, npm);
        SpreadsheetApp.flush();
        resetDecisionCell_(sheet, row, startCol);
    } catch (err) {
        Logger.log('handleStatusChangeRealtime_ error: ' + err.message);
    }
}

/**
 * Reset sel Keputusan (kolom E) kembali ke '--' setelah diproses.
 * Hasil keputusan tetap terlihat di kolom Status (formula).
 */
function resetDecisionCell_(sheet, row, startCol) {
    try {
        sheet.getRange(row, startCol + 4).setValue('--');
    } catch (e) {
        Logger.log('resetDecisionCell_ error: ' + e.message);
    }
}

/**
 * Tambah atau update baris mahasiswa di sheet Kirim
 */
function upsertKirimRow_(ss, npm, nama, angkatan, mkName, mkInfo) {
    try {
        var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
        if (!kirimSheet) kirimSheet = ss.insertSheet(KIRIM_SHEET_NAME);

        // Pastikan sheet Kirim punya header (sama dengan Pendaftaran)
        if (kirimSheet.getLastRow() === 0) {
            var pendSheet = ss.getSheetByName('Pendaftaran');
            if (pendSheet && pendSheet.getLastRow() > 0) {
                var headers = pendSheet.getRange(1, 1, 1, pendSheet.getLastColumn()).getValues()[0];
                kirimSheet.appendRow(headers);
                kirimSheet.getRange(1, 1, 1, headers.length).setBackground('#003087').setFontColor('#ffffff').setFontWeight('bold');
            }
        }

        // Cari baris NPM yang ada di Pendaftaran untuk data dasar
        var pendSheet = ss.getSheetByName('Pendaftaran');
        var pendLastRow = pendSheet.getLastRow();
        var pendLastCol = pendSheet.getLastColumn();
        var pendData = pendSheet.getRange(2, 1, pendLastRow - 1, pendLastCol).getValues();
        var pendRow = null;
        for (var i = 0; i < pendData.length; i++) {
            if (String(pendData[i][1] || '').trim() === npm) { pendRow = pendData[i]; break; }
        }
        if (!pendRow) return;

        // Cari NPM di Kirim
        var kirimLastRow = kirimSheet.getLastRow();
        var kirimLastCol = kirimSheet.getLastColumn();
        var kirimRowIdx = -1;

        if (kirimLastRow > 1) {
            var kirimData = kirimSheet.getRange(2, 1, kirimLastRow - 1, 2).getValues();
            for (var k = 0; k < kirimData.length; k++) {
                if (String(kirimData[k][1] || '').trim() === npm) { kirimRowIdx = k + 2; break; }
            }
        }

        if (kirimRowIdx === -1) {
            // Buat baris baru: copy data dasar dari Pendaftaran, MK kolom kosong semua
            var newRow = pendRow.slice(0, pendLastCol);
            // Kosongkan semua kolom MK (J-AK = idx 9-36)
            for (var c = 9; c <= 36; c++) {
                if (c < newRow.length) newRow[c] = '';
                else newRow.push('');
            }
            // Kosongkan kolom AL-BM (idx 37-64) agar tidak menimpa rumus atau nilai SKS lama
            for (var c = 37; c <= 64; c++) {
                if (c < newRow.length) newRow[c] = '';
                else newRow.push('');
            }
            // Perbarui timestamp
            newRow[0] = new Date();
            kirimSheet.appendRow(newRow);
            kirimRowIdx = kirimSheet.getLastRow();

            // Jika ini baris baru dan ada rumus di atasnya, salin rumusnya ke bawah (mulai kolom BN / idx 65 ke kanan)
            if (kirimRowIdx > 2) {
                var lastCol = kirimSheet.getLastColumn();
                // Hanya menyalin jika sheet cukup lebar (mulai kolom BN = 66)
                if (lastCol >= 66) {
                    var formulaRange = kirimSheet.getRange(kirimRowIdx - 1, 66, 1, lastCol - 65);
                    var formulas = formulaRange.getFormulasR1C1()[0];
                    var hasFormula = formulas.some(function (f) { return String(f || '').trim() !== ''; });
                    if (hasFormula) {
                        kirimSheet.getRange(kirimRowIdx, 66, 1, formulas.length).setFormulasR1C1([formulas]);
                    }
                }
            }
        }

        // Isi kolom MK yang disetujui (kolom J-AK)
        kirimSheet.getRange(kirimRowIdx, mkInfo.pendCol).setValue(mkName);

        // Isi nilai SKS secara statis di kolom pasangannya (kolom AL-BM)
        if (mkInfo.sksCol && mkInfo.sks) {
            kirimSheet.getRange(kirimRowIdx, mkInfo.sksCol).setValue(mkInfo.sks);
        }

        // Hitung ulang Total SKS di kolom BN (kolom 66)
        var sksValues = kirimSheet.getRange(kirimRowIdx, 38, 1, 28).getValues()[0]; // AL(38) sampai BM(65)
        var totalSks = 0;
        for (var s = 0; s < sksValues.length; s++) {
            var val = parseFloat(sksValues[s]);
            if (!isNaN(val)) {
                totalSks += val;
            }
        }
        kirimSheet.getRange(kirimRowIdx, 66).setValue(totalSks > 0 ? totalSks : '');

        // flush() dipindah ke handleStatusChangeRealtime_ agar tidak dipanggil berulang
    } catch (err) {
        Logger.log('upsertKirimRow_ error: ' + err.message);
    }
}

/**
 * Hapus/kosongkan kolom MK tertentu dari sheet Kirim
 * Jika semua MK (idx 9-36) kosong → hapus baris
 */
function removeFromKirim_(ss, npm, mkInfo) {
    try {
        var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
        if (!kirimSheet || kirimSheet.getLastRow() <= 1) return;

        var lastRow = kirimSheet.getLastRow();
        var lastCol = kirimSheet.getLastColumn();
        var kirimData = kirimSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

        var rowIdx = -1;
        for (var i = 0; i < kirimData.length; i++) {
            if (String(kirimData[i][1] || '').trim() === npm) { rowIdx = i; break; }
        }
        if (rowIdx === -1) return;

        // Kosongkan kolom MK yang bersangkutan
        kirimSheet.getRange(rowIdx + 2, mkInfo.pendCol).setValue('');

        // Kosongkan juga nilai SKS pasangannya di kolom AL-BM
        if (mkInfo.sksCol) {
            kirimSheet.getRange(rowIdx + 2, mkInfo.sksCol).setValue('');
        }

        // Cek apakah semua kolom MK (J-AK = col 10-37) kosong
        var rowVals = kirimSheet.getRange(rowIdx + 2, 1, 1, lastCol).getValues()[0];
        var hasAnyMk = false;
        for (var c = 9; c <= 36 && c < rowVals.length; c++) {
            if (String(rowVals[c] || '').trim() !== '') { hasAnyMk = true; break; }
        }

        if (!hasAnyMk) {
            kirimSheet.deleteRow(rowIdx + 2);
            Logger.log('removeFromKirim_: Baris NPM ' + npm + ' dihapus (semua MK kosong)');
        } else {
            // Hitung ulang Total SKS di kolom BN (kolom 66)
            var sksValues = kirimSheet.getRange(rowIdx + 2, 38, 1, 28).getValues()[0]; // AL(38) sampai BM(65)
            var totalSks = 0;
            for (var s = 0; s < sksValues.length; s++) {
                var val = parseFloat(sksValues[s]);
                if (!isNaN(val)) {
                    totalSks += val;
                }
            }
            kirimSheet.getRange(rowIdx + 2, 66).setValue(totalSks > 0 ? totalSks : '');

            Logger.log('removeFromKirim_: Kolom ' + mkInfo.pendCol + ' dikosongkan untuk NPM ' + npm);
        }
        // flush() dipindah ke handleStatusChangeRealtime_
    } catch (err) {
        Logger.log('removeFromKirim_ error: ' + err.message);
    }
}

/**
 * Tambah entri pennolakan ke sheet Alasan
 * Kolom Alasan sengaja dikosongkan agar admin isi manual
 */
function addAlasanRow_(ss, npm, nama, angkatan, mkName, adminSheetName, alasanText) {
    try {
        var alasanSheet = ss.getSheetByName(ALASAN_SHEET_NAME);
        if (!alasanSheet) alasanSheet = ss.insertSheet(ALASAN_SHEET_NAME);
        if (alasanSheet.getLastRow() === 0) {
            alasanSheet.appendRow(['Timestamp', 'NPM', 'Nama Lengkap', 'Angkatan', 'Mata Kuliah', 'Sheet Admin', 'Alasan']);
            alasanSheet.getRange('A1:G1').setBackground('#8B0000').setFontColor('#ffffff').setFontWeight('bold');
        }

        // Cek jika sudah ada entri yang sama (NPM + MK)
        var lastRow = alasanSheet.getLastRow();
        if (lastRow > 1) {
            var existing = alasanSheet.getRange(2, 2, lastRow - 1, 4).getValues();
            var mkKey = normalizeMkName_(mkName);
            for (var i = 0; i < existing.length; i++) {
                if (String(existing[i][0] || '').trim() === npm &&
                    normalizeMkName_(existing[i][3]) === mkKey) {
                    // Update alasan jika ada, lalu return
                    if (alasanText) alasanSheet.getRange(i + 2, 7).setValue(alasanText).setBackground(null).clearNote();
                    return;
                }
            }
        }

        alasanSheet.appendRow([new Date(), npm, nama, angkatan, mkName, adminSheetName, alasanText || '']);
        // Beri highlight kuning di kolom Alasan agar admin tahu perlu diisi jika kosong
        var newRow = alasanSheet.getLastRow();
        if (!alasanText) {
            alasanSheet.getRange(newRow, 7).setBackground('#FFFDE7').setNote('Isi alasan penolakan di sini');
        } else {
            alasanSheet.getRange(newRow, 7).setBackground(null).clearNote();
        }
        // flush() dipindah ke handleStatusChangeRealtime_
        Logger.log('addAlasanRow_: NPM ' + npm + ' MK ' + mkName + ' ditolak');
    } catch (err) {
        Logger.log('addAlasanRow_ error: ' + err.message);
    }
}

// ============================================================
// STATUS KIRIM: Kolom BA (col 53) = "ACC" jika semua MK selesai diputuskan
// ============================================================

/**
 * Hapus baris NPM + MK dari sheet Alasan jika ada
 * Dipanggil saat admin membatalkan penolakan (mengganti ke ACC / --)
 */
function removeAlasanRow_(ss, npm, mkName) {
    try {
        var alasanSheet = ss.getSheetByName(ALASAN_SHEET_NAME);
        if (!alasanSheet || alasanSheet.getLastRow() <= 1) return;

        var lastRow = alasanSheet.getLastRow();
        var existing = alasanSheet.getRange(2, 2, lastRow - 1, 4).getValues();
        var mkKey = normalizeMkName_(mkName);
        var npmClean = normalizeNpm_(npm);

        // Cari baris dari bawah ke atas agar index tidak bergeser saat di-delete
        for (var i = existing.length - 1; i >= 0; i--) {
            if (normalizeNpm_(existing[i][0]) === npmClean &&
                normalizeMkName_(existing[i][3]) === mkKey) {
                alasanSheet.deleteRow(i + 2);
                Logger.log('removeAlasanRow_: NPM ' + npm + ' MK ' + mkName + ' dihapus dari Alasan');
            }
        }
    } catch (err) {
        Logger.log('removeAlasanRow_ error: ' + err.message);
    }
}

var KIRIM_STATUS_COL = 67; // Kolom BO (1-based)
var WA_LINK_START_COL = 68; // Kolom BP — link PDF ACC (BP/BQ/BR)
var WA_SHEET_NAME = 'WA';
var WA_HEADERS = [
    'queue_id',
    'source_sheet',
    'source_row',
    'npm',
    'nama',
    'no_wa_raw',
    'no_wa_normalized',
    'email',
    'total_sks',
    'status_kirim_src',
    'link_pdf_1',
    'link_pdf_2',
    'link_pdf_3',
    'pesan_final',
    'provider',
    'send_status',
    'send_attempt',
    'provider_message_id',
    'last_error',
    'created_at',
    'sent_at',
    'updated_at'
];

function handleKirimSheetEdit_(e) {
    try {
        var range = e.range;
        var sheet = range.getSheet();
        if (sheet.getName() !== KIRIM_SHEET_NAME) return;
        var rowStart = range.getRow();
        var colStart = range.getColumn();
        var rowEnd = rowStart + range.getNumRows() - 1;
        var colEnd = colStart + range.getNumColumns() - 1;
        if (rowEnd < 2) return;

        // PENTING: Trigger harus jalan baik saat admin mengedit kolom BA (KIRIM_STATUS_COL) 
        // MAUPUN saat admin mengedit kolom BC/BD (tempat link PDF ACC berada) 
        // karena syarat kirim WA adalah ACC + link tidak kosong.
        var isEditingStatus = (colStart <= KIRIM_STATUS_COL && colEnd >= KIRIM_STATUS_COL);
        var isEditingLinks = (colStart <= WA_LINK_START_COL + 1 && colEnd >= WA_LINK_START_COL); // BC atau BD

        if (!isEditingStatus && !isEditingLinks) return;

        var ss = e.source;
        for (var r = Math.max(2, rowStart); r <= rowEnd; r++) {
            syncWaQueueForKirimRowByIndex_(ss, r);
        }
    } catch (err) {
        Logger.log('handleKirimSheetEdit_ error: ' + err.message);
    }
}

function ensureWaSheet_(ss) {
    var sheet = ss.getSheetByName(WA_SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(WA_SHEET_NAME);
    var needsHeader = sheet.getLastRow() === 0;
    if (!needsHeader) {
        var currentHeaders = sheet.getRange(1, 1, 1, WA_HEADERS.length).getValues()[0];
        for (var i = 0; i < WA_HEADERS.length; i++) {
            if (String(currentHeaders[i] || '').trim() !== WA_HEADERS[i]) {
                needsHeader = true;
                break;
            }
        }
    }
    if (needsHeader) {
        sheet.getRange(1, 1, 1, WA_HEADERS.length).setValues([WA_HEADERS]).setFontWeight('bold');
    }
    return sheet;
}

function normalizeWaNumber_(value) {
    var n = String(value || '').trim();
    if (!n) return '';
    n = n.replace(/^'+/, '');
    n = n.replace(/\.0+$/, '');
    n = n.replace(/\D/g, '');
    if (!n) return '';
    if (n.indexOf('62') === 0) return n;
    if (n.indexOf('0') === 0) return '62' + n.substring(1);
    if (n.indexOf('8') === 0) return '62' + n;
    return n;
}

function parseHyperlinkFormula_(formula) {
    var f = String(formula || '').trim();
    if (!f) return '';
    var m = f.match(/=HYPERLINK\("([^"]+)"/i);
    return m ? String(m[1] || '').trim() : '';
}

function extractPdfLinksFromKirimRow_(kirimSheet, rowIdx) {
    var result = ['', '', ''];
    var range = kirimSheet.getRange(rowIdx, WA_LINK_START_COL, 1, 3);
    var richVals = range.getRichTextValues()[0];
    var formulas = range.getFormulas()[0];
    var displays = range.getDisplayValues()[0];
    for (var i = 0; i < 3; i++) {
        var link = '';
        var rich = richVals[i];
        if (rich && typeof rich.getLinkUrl === 'function') {
            link = String(rich.getLinkUrl() || '').trim();
        }
        if (!link) link = parseHyperlinkFormula_(formulas[i]);
        if (!link) {
            var v = String(displays[i] || '').trim();
            if (/^https?:\/\//i.test(v)) link = v;
        }
        result[i] = link;
    }
    return result;
}

function resolveKirimIdentityIndices_(headersLower) {
    return _resolveIndices(headersLower, {
        npm: ['npm'],
        nama: ['nama lengkap', 'nama'],
        email: ['email'],
        hp: ['no. hp/wa', 'no. hpwa', 'hp', 'no. hp', 'no wa', 'no whatsapp', 'whatsapp'],
        totalSks: ['total sks', 'totalsks']
    }, {
        npm: 1,
        nama: 2,
        email: 3,
        hp: 4,
        totalSks: 65
    });
}

function buildWaMessageText_(payload) {
    var lines = [];
    lines.push("Assalamu'alaikum " + (payload.nama || 'Mahasiswa') + " - " + (payload.npm || '-') + ", Berikut kami lampirkan bukti pendaftaran remedial yang disetujui sesuai dengan persyaratan.");

    // Ambil isi dari link1 (BC) dan link2 (BD)
    var link1 = String(payload.link1 || '').trim();
    var link2 = String(payload.link2 || '').trim();

    // Gunakan link1 (BC), jika kosong gunakan link2 (BD) sebagai backup
    var finalLink = link1 !== '' ? link1 : link2;

    if (finalLink !== '') {
        lines.push('Bukti Pendaftaran: ' + finalLink);
    } else {
        lines.push('Bukti Pendaftaran: (link tidak tersedia)');
    }

    lines.push('Silahkan melakukan pembayaran sesuai dengan jumlah sks yang disetujui. Jika ada kendala konfirmasi ke admin :');
    lines.push('Arwinda : Blok Semester 1');
    lines.push('Devi : Blok Semester 5 dan 7 (Senior)');
    lines.push('Nabila : Blok Semester 3');
    lines.push(''); // Baris kosong sebelum penutup
    lines.push('Pesan singkat ini tidak perlu dibalas.');
    lines.push('Terimakasih');

    return lines.join('\n');
}

function buildQueueId_(npm, sourceRow) {
    return String(npm || '') + '-' + String(sourceRow || '') + '-WA';
}

function mapWaRowsBySourceRow_(waRows) {
    var map = {};
    for (var i = 0; i < waRows.length; i++) {
        var sourceSheet = String(waRows[i][1] || '').trim();
        var sourceRow = parseInt(waRows[i][2], 10);
        if (sourceSheet === KIRIM_SHEET_NAME && !isNaN(sourceRow) && sourceRow > 0) {
            map[sourceRow] = i + 2;
        }
    }
    return map;
}

function syncWaQueueForKirimRowByIndex_(ss, rowIdx) {
    try {
        var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
        if (!kirimSheet || rowIdx <= 1 || rowIdx > kirimSheet.getLastRow()) return;
        var lastCol = Math.max(kirimSheet.getLastColumn(), WA_LINK_START_COL + 2);
        var headers = kirimSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var headersLower = headers.map(function (h) { return String(h).trim().toLowerCase(); });
        var idx = resolveKirimIdentityIndices_(headersLower);
        var row = kirimSheet.getRange(rowIdx, 1, 1, lastCol).getValues()[0];
        var acc = String(row[KIRIM_STATUS_COL - 1] || '').trim().toUpperCase();
        var npm = normalizeNpm_(row[idx.npm]);
        if (!npm) return;
        var nama = String(row[idx.nama] || '').trim();
        var email = String(row[idx.email] || '').trim();
        var waRaw = String(row[idx.hp] || '').trim();
        var waNorm = normalizeWaNumber_(waRaw);
        var totalSks = String(row[idx.totalSks] || '').trim();

        // Baca nilai dari kolom BP (index 67) dan BQ (index 68) dari Sheet Kirim
        // Indeks array dimulai dari 0, jadi BP=67, BQ=68, BR=69
        var valBC = String(row[WA_LINK_START_COL - 1] || '').trim();
        var valBD = String(row[WA_LINK_START_COL] || '').trim();

        var links = extractPdfLinksFromKirimRow_(kirimSheet, rowIdx);
        var payload = {
            npm: npm,
            nama: nama,
            totalSks: totalSks,
            link1: valBC, // link1 akan dipetakan ke Kolom K (index 10 di upsert)
            link2: valBD, // link2 akan dipetakan ke Kolom L (index 11 di upsert)
            link3: ''     // Kolom M (index 12 di upsert) dibatalkan/dikosongkan
        };
        var message = buildWaMessageText_(payload);
        var queueId = buildQueueId_(npm, rowIdx);
        var waSheet = ensureWaSheet_(ss);
        var waRows = waSheet.getLastRow() > 1 ? waSheet.getRange(2, 1, waSheet.getLastRow() - 1, WA_HEADERS.length).getValues() : [];
        var rowMap = mapWaRowsBySourceRow_(waRows);
        var waRowIdx = rowMap[rowIdx] || -1;
        var now = new Date();

        // Kondisi OPSI A: Jika ACC, tetapi kolom BC DAN BD kosong, JANGAN dipindahkan ke Sheet WA
        if (acc === 'ACC') {
            if (!valBC && !valBD) {
                return; // Berhenti di sini, tidak ada data yang di-push ke Sheet WA
            }

            var sendStatus = 'ANTRI';
            var sendAttempt = 0;
            var providerMessageId = '';
            var lastError = '';
            var createdAt = now;
            var sentAt = '';
            if (waRowIdx !== -1) {
                var existing = waSheet.getRange(waRowIdx, 1, 1, WA_HEADERS.length).getValues()[0];
                sendStatus = String(existing[15] || '').trim() || 'ANTRI';
                sendAttempt = parseInt(existing[16], 10);
                if (isNaN(sendAttempt)) sendAttempt = 0;
                providerMessageId = String(existing[17] || '').trim();
                lastError = String(existing[18] || '').trim();
                createdAt = existing[19] || now;
                sentAt = existing[20] || '';
                if (sendStatus === 'BATAL' || sendStatus === 'SKIP') sendStatus = 'ANTRI';
            }
            var statusByData = sendStatus;
            if (!waNorm) statusByData = 'SKIP';
            var upsert = [
                queueId, KIRIM_SHEET_NAME, rowIdx, npm, nama, waRaw, waNorm, email, totalSks, acc,
                valBC, valBD, links[2], message, 'META_CLOUD_API', statusByData, sendAttempt,
                providerMessageId, lastError, createdAt, sentAt, now
            ];
            if (waRowIdx === -1) {
                waSheet.appendRow(upsert);
            } else {
                waSheet.getRange(waRowIdx, 1, 1, WA_HEADERS.length).setValues([upsert]);
            }
            return;
        }
        if (waRowIdx === -1) return;
        var prev = waSheet.getRange(waRowIdx, 1, 1, WA_HEADERS.length).getValues()[0];
        var prevStatus = String(prev[15] || '').trim().toUpperCase();
        if (prevStatus === 'TERKIRIM') {
            waSheet.getRange(waRowIdx, 10).setValue(acc || '');
            waSheet.getRange(waRowIdx, 22).setValue(now);
            return;
        }
        waSheet.getRange(waRowIdx, 10).setValue(acc || '');
        waSheet.getRange(waRowIdx, 16).setValue('BATAL');
        waSheet.getRange(waRowIdx, 22).setValue(now);
    } catch (err) {
        Logger.log('syncWaQueueForKirimRowByIndex_ error: ' + err.message);
    }
}

function buildWaQueueFromKirimACC() {
    var ss = SpreadsheetApp.openById(getSpreadsheetId());
    var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
    if (!kirimSheet || kirimSheet.getLastRow() <= 1) return { scanned: 0, synced: 0 };
    var lastRow = kirimSheet.getLastRow();
    var synced = 0;
    for (var r = 2; r <= lastRow; r++) {
        syncWaQueueForKirimRowByIndex_(ss, r);
        synced++;
    }
    return { scanned: lastRow - 1, synced: synced };
}


/**
 * Cek apakah semua slot MK mahasiswa di Pendaftaran sudah ada keputusan
 * (ada di Sheet Kirim = Setuju, ATAU ada di Sheet Alasan = Tidak Setuju).
 * Jika ya → tulis "ACC" di kolom BN Sheet Kirim.
 * Jika belum semua → kosongkan kolom BN (jaga konsistensi jika ada pembatalan).
 */
function checkAndSetACC_(ss, npm) {
    try {
        if (!npm) return;
        var npmClean = normalizeNpm_(npm);

        // ── 1. Baca baris mahasiswa dari Pendaftaran ─────────────────────────
        var pendSheet = ss.getSheetByName('Pendaftaran');
        if (!pendSheet || pendSheet.getLastRow() <= 1) return;

        var pLastRow = pendSheet.getLastRow();
        var pLastCol = Math.max(pendSheet.getLastColumn(), 37); // minimal sampai kolom AK (idx 36)
        var pData = pendSheet.getRange(2, 1, pLastRow - 1, pLastCol).getValues();

        var pendRow = null;
        for (var pi = 0; pi < pData.length; pi++) {
            if (normalizeNpm_(pData[pi][1]) === npmClean) { pendRow = pData[pi]; break; }
        }
        if (!pendRow) return;

        // Kumpulkan semua MK yang dipilih mahasiswa (slot idx 9-36)
        var pickedMKs = {}; // { mkName: true }
        for (var si = 9; si <= 36; si++) {
            var v = String(pendRow[si] || '').trim();
            if (v) pickedMKs[v] = true;
        }
        if (Object.keys(pickedMKs).length === 0) return; // tidak ada MK dipilih

        // ── 2. Baca Sheet Kirim: kumpulkan MK yang sudah disetujui ───────────
        var kirimSheet = ss.getSheetByName(KIRIM_SHEET_NAME);
        var approvedMKs = {}; // { mkName: true }
        var kirimRowIdx = -1;

        if (kirimSheet && kirimSheet.getLastRow() > 1) {
            var kLastRow = kirimSheet.getLastRow();
            var kLastCol = Math.max(kirimSheet.getLastColumn(), 37);
            var kData = kirimSheet.getRange(2, 1, kLastRow - 1, kLastCol).getValues();
            for (var ki = 0; ki < kData.length; ki++) {
                if (normalizeNpm_(kData[ki][1]) === npmClean) {
                    kirimRowIdx = ki + 2; // 1-based row number in sheet
                    for (var ksi = 9; ksi <= 36; ksi++) {
                        var kv = String(kData[ki][ksi] || '').trim();
                        if (kv) approvedMKs[kv] = true;
                    }
                    break;
                }
            }
        }

        // ── 3. Baca Sheet Alasan: kumpulkan MK yang sudah ditolak ────────────
        var alasanSheet = ss.getSheetByName(ALASAN_SHEET_NAME);
        var rejectedMKs = {}; // { mkName: true }

        if (alasanSheet && alasanSheet.getLastRow() > 1) {
            var aLastRow = alasanSheet.getLastRow();
            var aData = alasanSheet.getRange(2, 2, aLastRow - 1, 4).getValues();
            for (var ai = 0; ai < aData.length; ai++) {
                var aNpm = normalizeNpm_(aData[ai][0]);
                var aMk = String(aData[ai][3] || '').trim();
                if (aNpm === npmClean && aMk) rejectedMKs[aMk] = true;
            }
        }

        // ── 4. Cek apakah semua MK sudah ada keputusan ───────────────────────
        var allDecided = true;
        var pickedList = Object.keys(pickedMKs);

        for (var di = 0; di < pickedList.length; di++) {
            var mk = pickedList[di];
            // Pakai normalisasi agar pencocokan string lebih aman
            var mkNorm = normalizeMkName_(mk);

            var isApproved = false;
            var isRejected = false;

            // Cek di array approved
            Object.keys(approvedMKs).forEach(function (aMk) {
                if (normalizeMkName_(aMk) === mkNorm) isApproved = true;
            });

            // Cek di array rejected
            Object.keys(rejectedMKs).forEach(function (rMk) {
                if (normalizeMkName_(rMk) === mkNorm) isRejected = true;
            });

            if (!isApproved && !isRejected) {
                allDecided = false;
                break;
            }
        }

        // ── 5. Update kolom BO di Sheet Kirim ────────────────────────────────
        if (!kirimSheet || kirimRowIdx === -1) return;

        // Pastikan baris cukup kolom (extend jika perlu)
        var kCols = kirimSheet.getLastColumn();
        if (kCols < KIRIM_STATUS_COL) {
            kirimSheet.getRange(1, KIRIM_STATUS_COL).setValue('Status Kirim');
        }

        var accCell = kirimSheet.getRange(kirimRowIdx, KIRIM_STATUS_COL);
        if (allDecided) {
            accCell.setValue('ACC').setBackground('#D9EAD3').setFontWeight('bold');
            Logger.log('checkAndSetACC_: NPM ' + npm + ' → ACC ✓');
            syncWaQueueForKirimRowByIndex_(ss, kirimRowIdx);
        } else {
            // Jika ada keputusan dibatalkan kembali ke "--", reset ACC
            accCell.setValue('').setBackground(null).setFontWeight('normal');
            Logger.log('checkAndSetACC_: NPM ' + npm + ' → belum semua diputuskan');
            syncWaQueueForKirimRowByIndex_(ss, kirimRowIdx);
        }
        // Sinkronkan warna baris di Pendaftaran sesuai status ACC terbaru
        paintPendaftaranRowByNpm_(ss, npmClean, allDecided ? 'ACC' : '');
    } catch (err) {
        Logger.log('checkAndSetACC_ error: ' + err.message);
    }
}

