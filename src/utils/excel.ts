import XLSX from 'xlsx-js-style';
import type { TargetRow, WilayahSetting } from '../types';
import { SAMPLE_MASTER_ROWS, SAMPLE_TARGET_ROWS } from './sampleData';
import { formatWilayahName } from './normalizer';
import { loadWilayahFromNeon } from './neonSync';

export const MASTER_COLUMNS_WITH_SANDI_CABANG: string[] = [
  'Wilayah',
  'Sandi Cabang',
  'Branch Code',
  'Kode Cabang',
  'Nama Outlet',
  'Status Outlet',
  'ALAMAT',
  'KODE POS',
  'Kelurahan',
  'Kecamatan',
  'Dati II',
  'Kode Dati II',
  'Provinsi',
  'Telp',
];

export const TARGET_COLUMNS_WITH_SANDI_CABANG: string[] = [
  'No',
  'Wilayah',
  'Sandi Cabang',
  'Branch Code',
  'Kode Cabang',
  'Nama Outlet',
  'Status Outlet',
  'ALAMAT',
  'KODE POS',
  'Kelurahan',
  'Kecamatan',
  'Dati II',
  'Kode Dati II',
  'Provinsi',
];

export const MASTER_COLUMNS_SEPARATE: string[] = [
  'Wilayah',
  'Sandi',
  'Cabang',
  'Branch Code',
  'Kode Cabang',
  'Nama Outlet',
  'Status Outlet',
  'ALAMAT',
  'KODE POS',
  'Kelurahan',
  'Kecamatan',
  'Dati II',
  'Kode Dati II',
  'Provinsi',
  'Telp',
];

export const TARGET_COLUMNS_SEPARATE: string[] = [
  'No',
  'Wilayah',
  'Sandi',
  'Cabang',
  'Branch Code',
  'Kode Cabang',
  'Nama Outlet',
  'Status Outlet',
  'ALAMAT',
  'KODE POS',
  'Kelurahan',
  'Kecamatan',
  'Dati II',
  'Kode Dati II',
  'Provinsi',
];

/**
 * Clean and match column headers flexibly
 */
export function normalizeHeaderName(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Map variations of header names to canonical standard names
 */
export function mapCanonicalHeader(header: string): string {
  const norm = normalizeHeaderName(header);

  // Sandi Cabang combined variations
  if (norm === 'sumber data' || norm === 'sumberdata') return 'SUMBER DATA';
  if (norm === 'no' || norm === 'no.' || norm === 'nomor') return 'No';

  return header.trim();
}

/**
 * Validate Master Excel headers supporting BOTH:
 * - 1-column "Sandi Cabang" (14 columns)
 * - 2-column "Sandi" and "Cabang" (15 columns)
 */
export function validateMasterHeaders(fileHeaders: string[]): { isValid: boolean; missing: string[]; hasSandiCabang: boolean } {
  const canonicalHeaders = new Set(fileHeaders.map(mapCanonicalHeader));
  const missing: string[] = [];

  if (!canonicalHeaders.has('Wilayah')) missing.push('Wilayah');

  const hasCombined = canonicalHeaders.has('Sandi Cabang');
  const hasSeparate = canonicalHeaders.has('Sandi') && canonicalHeaders.has('Cabang');

  if (!hasCombined && !hasSeparate) {
    missing.push('Sandi Cabang (atau Sandi, Cabang)');
  }

  const otherRequired = [
    'Branch Code',
    'Kode Cabang',
    'Nama Outlet',
    'Status Outlet',
    'ALAMAT',
    'KODE POS',
    'Kelurahan',
    'Kecamatan',
    'Dati II',
    'Kode Dati II',
    'Provinsi',
    'Telp',
  ];

  for (const col of otherRequired) {
    if (!canonicalHeaders.has(col)) {
      missing.push(col);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    hasSandiCabang: hasCombined,
  };
}

/**
 * Validate Target Excel headers supporting BOTH:
 * - 1-column "Sandi Cabang" (18 columns)
 * - 2-column "Sandi" and "Cabang" (19 columns)
 */
export function validateTargetHeaders(fileHeaders: string[]): { isValid: boolean; missing: string[]; hasSandiCabang: boolean } {
  const canonicalHeaders = new Set(fileHeaders.map(mapCanonicalHeader));
  const missing: string[] = [];

  if (!canonicalHeaders.has('No')) missing.push('No');
  if (!canonicalHeaders.has('Wilayah')) missing.push('Wilayah');

  const hasCombined = canonicalHeaders.has('Sandi Cabang');
  const hasSeparate = canonicalHeaders.has('Sandi') && canonicalHeaders.has('Cabang');

  if (!hasCombined && !hasSeparate) {
    missing.push('Sandi Cabang (atau Sandi, Cabang)');
  }

  const otherRequired = [
    'Branch Code',
    'Kode Cabang',
    'Nama Outlet',
    'Status Outlet',
    'ALAMAT',
    'KODE POS',
    'Kelurahan',
    'Kecamatan',
    'Dati II',
    'Kode Dati II',
    'Provinsi',
  ];

  for (const col of otherRequired) {
    if (!canonicalHeaders.has(col)) {
      missing.push(col);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    hasSandiCabang: hasCombined,
  };
}

/**
 * Parse an Excel file (.xlsx, .xls, .csv) into array of objects and headers
 * Standardizes headers into canonical column names automatically
 */
export async function parseExcelFile<T>(file: File, wilayahSettings?: WilayahSetting[]): Promise<{ data: T[]; headers: string[] }> {
  // Ambil data wilayah jika tidak di-pass dari luar
  const wSettings = wilayahSettings || await loadWilayahFromNeon() || [];

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          throw new Error('Berkas tidak dapat dibaca (buffer kosong).');
        }

        // Gunakan Uint8Array dan type: 'array' untuk kompatibilitas 100% di semua browser & Vercel
        const dataUint8 = new Uint8Array(buffer);
        const workbook = XLSX.read(dataUint8, { type: 'array', cellText: true, raw: false });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          throw new Error('Lembar kerja kosong atau tidak dapat diakses.');
        }

        // Parse to 2D array first to inspect headers accurately
        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (rawJson.length === 0) {
          resolve({ data: [], headers: [] });
          return;
        }

        const rawHeaders = (rawJson[0] as any[]).map(c => String(c ?? '').trim()).filter(Boolean);
        
        // Parse rows to objects
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        // Map every row keys to canonical names and ensure ALL values are safe strings/primitives
        const standardizedRows = rawRows.map(row => {
          const item: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            const canonicalKey = mapCanonicalHeader(key);
            const val = row[key];
            // Sanitasi: pastikan string tidak null/undefined dan aman untuk operasi .toLowerCase() / .trim()
            item[canonicalKey] = val !== null && val !== undefined ? String(val).trim() : '';
          }

          // Bidirectional sync for Sandi Cabang vs Sandi & Cabang
          if (item['Sandi Cabang']) {
            if (!item.Cabang) item.Cabang = item['Sandi Cabang'];
            if (!item.Sandi) item.Sandi = item['Sandi Cabang'];
          } else if (item.Sandi || item.Cabang) {
            item['Sandi Cabang'] = [item.Sandi, item.Cabang].filter(Boolean).join(' - ');
          }

          // Wilayah Mapping based on 2nd and 3rd digit of Branch Code
          const branchCode = item['Branch Code'] || item['Kode Cabang'] || '';
          if (branchCode && branchCode.length >= 3 && wSettings.length > 0) {
            const digit2and3 = branchCode.substring(1, 3);
            const matchedWilayah = wSettings.find(w => w.kodeWilayah === digit2and3);
            if (matchedWilayah) {
              item['Wilayah'] = matchedWilayah.keterangan;
            }
          }

          return item;
        });

        resolve({
          data: standardizedRows as T[],
          headers: rawHeaders,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(new Error('Gagal membaca berkas melalui FileReader: ' + (err || 'Unknown error')));
    // Gunakan readAsArrayBuffer agar tidak corrupt binary data XLSX di browser
    reader.readAsArrayBuffer(file);
  });
}


/**
 * Download Target results as formatted Excel file
 * Enforces Row Integrity Rule: assert total_downloaded_rows == total_uploaded_rows
 */
/**
 * Format nama/nomor wilayah menjadi kode standar sheet (contoh: 1 -> W01, 2 -> W02, 10 -> W10)
 */
export function formatWilayahCode(rawWilayah: string | number): string {
  const str = String(rawWilayah ?? '').trim();
  if (!str) return 'W01';

  // Jika format sudah W01, W02, w1, dll
  const wMatch = str.match(/^w(\d+)$/i);
  if (wMatch) {
    const num = parseInt(wMatch[1], 10);
    return `W${String(num).padStart(2, '0')}`;
  }

  // Jika cuma angka (contoh "1", "2") atau ada kata "Wilayah 1"
  const numMatch = str.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return `W${String(num).padStart(2, '0')}`;
  }

  // Fallback nama wilayah non-numerik, sanitasi karakter ilegal Excel
  return str.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31) || 'W01';
}

/**
 * Gaya Header Excel Sesuai Warna Asli File Unggahan:
 * - Biru (#366092): Kolom Master Cabang (No, Wilayah, Sandi Cabang, Branch Code, Kode Cabang, Nama Outlet, Status Outlet)
 * - Oranye (#E97132): Kolom Dati II / Kota
 * - Hijau (#47D359): Kolom Alamat & Lokasi Target (ALAMAT, KODE POS, Kelurahan, Kecamatan, Kode Dati II, Provinsi, Telp)
 * - Kuning (#FFFF00): Kolom PTEN & Validasi (KOTA PTEN, KODE POS PTEN, CEK KODE POS + PTEN, SUMBER DATA, CEK DUPLIKAT KODE POS)
 */
export function getHeaderStyle(col: string) {
  const norm = col.trim().toUpperCase();

  // 1. Biru Navy (#366092) untuk Identitas Cabang / Master
  if ([
    'NO',
    'WILAYAH',
    'SANDI CABANG',
    'SANDI',
    'CABANG',
    'BRANCH CODE',
    'KODE CABANG',
    'NAMA OUTLET',
    'STATUS OUTLET',
  ].includes(norm)) {
    return {
      fill: { fgColor: { rgb: '366092' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'B0C4DE' } },
        bottom: { style: 'medium', color: { rgb: '1C3B61' } },
        left: { style: 'thin', color: { rgb: 'B0C4DE' } },
        right: { style: 'thin', color: { rgb: 'B0C4DE' } },
      },
    };
  }

  // 2. Oranye (#E97132) khusus Dati II / Kota
  if (norm === 'DATI II' || norm === 'KOTA') {
    return {
      fill: { fgColor: { rgb: 'E97132' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'F4A460' } },
        bottom: { style: 'medium', color: { rgb: 'A04000' } },
        left: { style: 'thin', color: { rgb: 'F4A460' } },
        right: { style: 'thin', color: { rgb: 'F4A460' } },
      },
    };
  }

  // 3. Hijau Cerah (#47D359) untuk Wilayah Administratif & Alamat Target
  if ([
    'ALAMAT',
    'KODE POS',
    'KELURAHAN',
    'KECAMATAN',
    'KODE DATI II',
    'PROVINSI',
    'TELP',
  ].includes(norm)) {
    return {
      fill: { fgColor: { rgb: '47D359' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '98FB98' } },
        bottom: { style: 'medium', color: { rgb: '2E8B57' } },
        left: { style: 'thin', color: { rgb: '98FB98' } },
        right: { style: 'thin', color: { rgb: '98FB98' } },
      },
    };
  }

  // 4. Kuning (#FFFF00) untuk Kolom PTEN & Verifikasi Integritas
  return {
    fill: { fgColor: { rgb: 'FFFF00' } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'FFE4B5' } },
      bottom: { style: 'medium', color: { rgb: 'B8860B' } },
      left: { style: 'thin', color: { rgb: 'FFE4B5' } },
      right: { style: 'thin', color: { rgb: 'FFE4B5' } },
    },
  };
}

/**
 * Gaya Baris Data Excel Rapi dan Bersih
 */
export function getDataCellStyle(col: string) {
  const norm = col.trim().toUpperCase();
  const isCentered = [
    'NO',
    'WILAYAH',
    'KODE CABANG',
    'STATUS OUTLET',
    'KODE POS',
    'KODE DATI II',
    'KODE POS PTEN',
    'CEK KODE POS + PTEN',
    'SUMBER DATA',
    'CEK DUPLIKAT KODE POS',
  ].includes(norm);

  return {
    font: { name: 'Calibri', sz: 10, color: { rgb: '212529' } },
    alignment: {
      horizontal: isCentered ? 'center' : 'left',
      vertical: 'center',
    },
    border: {
      top: { style: 'thin', color: { rgb: 'E9EBEC' } },
      bottom: { style: 'thin', color: { rgb: 'E9EBEC' } },
      left: { style: 'thin', color: { rgb: 'E9EBEC' } },
      right: { style: 'thin', color: { rgb: 'E9EBEC' } },
    },
  };
}

/**
 * Helper untuk membuat worksheet Excel dari baris TargetRow dengan pewarnaan asli
 */
function createTargetWorksheet(rows: TargetRow[], exportColumns: string[]): XLSX.WorkSheet {
  const exportData = rows.map((r, idx) => {
    const item: Record<string, any> = {};
    for (const col of exportColumns) {
      if (col === 'No') {
        item['No'] = r.No !== undefined && r.No !== '' ? r.No : idx + 1;
      } else {
        item[col] = r[col] ?? '';
      }
    }
    return item;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: exportColumns });

  // Terapkan Styling Header Asli Sesuai Warna Unggahan
  exportColumns.forEach((col, cIdx) => {
    const headerRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
    if (worksheet[headerRef]) {
      worksheet[headerRef].s = getHeaderStyle(col);
    }
  });

  // Terapkan Styling Baris Data (Border & Alignment Rapi)
  const totalRows = rows.length;
  for (let rIdx = 1; rIdx <= totalRows; rIdx++) {
    exportColumns.forEach((col, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = getDataCellStyle(col);
      }
    });
  }

  // Atur Tinggi Header agar Lega & Elegan
  worksheet['!rows'] = [{ hpt: 26 }];

  // Atur Lebar Kolom yang Ideal
  const colWidths = exportColumns.map((col) => {
    const norm = col.trim().toUpperCase();
    if (norm === 'NO') return { wch: 8 };
    if (norm === 'WILAYAH') return { wch: 14 };
    if (norm === 'ALAMAT') return { wch: 45 };
    if (norm === 'CABANG' || norm === 'NAMA OUTLET' || norm === 'SANDI CABANG') return { wch: 28 };
    if (norm === 'KODE POS' || norm === 'KODE POS PTEN') return { wch: 15 };
    if (norm === 'CEK KODE POS + PTEN') return { wch: 22 };
    if (norm === 'SUMBER DATA') return { wch: 18 };
    if (norm === 'CEK DUPLIKAT KODE POS') return { wch: 24 };
    return { wch: Math.max(col.length + 3, 16) };
  });
  worksheet['!cols'] = colWidths;

  return worksheet;
}

/**
 * Download Target results as formatted Excel file
 * 1. Filter Wilayah: nama berkas W01.xlsx (jika 1), nama tab sheet W01
 * 2. Semua Wilayah: nama berkas All wilayah.xlsx, di-group per wilayah menjadi tab sheet W01, W02, dst.
 */
export function exportTargetToExcel(
  rows: TargetRow[],
  wilayahFilterLabel: string,
  totalUploadedRows: number,
  isFiltered: boolean
): { success: boolean; filename: string; rowCount: number; error?: string } {
  // Integrity validation:
  if (!isFiltered && rows.length !== totalUploadedRows) {
    return {
      success: false,
      filename: '',
      rowCount: rows.length,
      error: `Row Integrity Assertion Failed: Total Baris Hasil (${rows.length}) tidak sama dengan Total Baris Unggah (${totalUploadedRows}). Unduhan diblokir demi keamanan data.`,
    };
  }

  // Determine export columns based on whether Sandi Cabang is present
  const usesCombined = rows.length > 0 && rows.some(r => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));
  const exportColumns = usesCombined ? TARGET_COLUMNS_WITH_SANDI_CABANG : TARGET_COLUMNS_SEPARATE;

  const workbook = XLSX.utils.book_new();
  let filename = '';

  if (isFiltered) {
    // =========================================================================
    // 1. JIKA FILTER WILAYAH
    // Nama file excel: W01.xlsx (jika 1)
    // Nama tab sheet: W01
    // =========================================================================
    const sheetName = formatWilayahCode(wilayahFilterLabel);
    const worksheet = createTargetWorksheet(rows, exportColumns);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    filename = `${sheetName}.xlsx`;
  } else {
    // =========================================================================
    // 2. JIKA DOWNLOAD SEMUA WILAYAH
    // Nama file excel: All wilayah.xlsx
    // Sheet 1: Semua Data (Urutan Asli) -> urutan 100% patokan file Excel yang diunggah
    // Sheet berikutnya: Di-group per wilayah (W01, W02, dst.)
    // =========================================================================
    const allWorksheet = createTargetWorksheet(rows, exportColumns);
    XLSX.utils.book_append_sheet(workbook, allWorksheet, 'Semua Data (Urutan Asli)');

    const groups = new Map<string, TargetRow[]>();

    rows.forEach((r) => {
      const code = formatWilayahCode(r.Wilayah || 'W01');
      let arr = groups.get(code);
      if (!arr) {
        arr = [];
        groups.set(code, arr);
      }
      arr.push(r);
    });

    // Urutkan kode sheet wilayah (W01, W02, W03, dst)
    const sortedSheetNames = Array.from(groups.keys()).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
    );

    // Buat sheet terpisah untuk setiap wilayah
    sortedSheetNames.forEach((sheetName) => {
      const groupRows = groups.get(sheetName) || [];
      const worksheet = createTargetWorksheet(groupRows, exportColumns);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    filename = 'All wilayah.xlsx';
  }

  XLSX.writeFile(workbook, filename);

  return {
    success: true,
    filename,
    rowCount: rows.length,
  };
}

/**
 * Download empty or sample Master Template
 */
export function downloadMasterTemplate(withSample = false) {
  const data = withSample ? SAMPLE_MASTER_ROWS : [];
  const worksheet = XLSX.utils.json_to_sheet(data, { header: MASTER_COLUMNS_WITH_SANDI_CABANG });
  
  // Terapkan Gaya Header Asli
  MASTER_COLUMNS_WITH_SANDI_CABANG.forEach((col, cIdx) => {
    const headerRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
    if (worksheet[headerRef]) {
      worksheet[headerRef].s = getHeaderStyle(col);
    }
  });

  if (withSample) {
    for (let rIdx = 1; rIdx <= data.length; rIdx++) {
      MASTER_COLUMNS_WITH_SANDI_CABANG.forEach((col, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = getDataCellStyle(col);
        }
      });
    }
  }

  worksheet['!rows'] = [{ hpt: 26 }];
  worksheet['!cols'] = MASTER_COLUMNS_WITH_SANDI_CABANG.map(col => ({ wch: Math.max(col.length + 3, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master_Cabang');

  const filename = withSample ? 'Template_Master_Cabang_Dengan_Sampel.xlsx' : 'Template_Master_Cabang_Kosong.xlsx';
  XLSX.writeFile(workbook, filename);
}

/**
 * Download empty or sample Target Template
 */
export function downloadTargetTemplate(withSample = false) {
  const data = withSample ? SAMPLE_TARGET_ROWS : [];
  const worksheet = XLSX.utils.json_to_sheet(data, { header: TARGET_COLUMNS_WITH_SANDI_CABANG });

  // Terapkan Gaya Header Asli
  TARGET_COLUMNS_WITH_SANDI_CABANG.forEach((col, cIdx) => {
    const headerRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
    if (worksheet[headerRef]) {
      worksheet[headerRef].s = getHeaderStyle(col);
    }
  });

  if (withSample) {
    for (let rIdx = 1; rIdx <= data.length; rIdx++) {
      TARGET_COLUMNS_WITH_SANDI_CABANG.forEach((col, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = getDataCellStyle(col);
        }
      });
    }
  }

  worksheet['!rows'] = [{ hpt: 26 }];
  worksheet['!cols'] = TARGET_COLUMNS_WITH_SANDI_CABANG.map(col => ({ wch: Math.max(col.length + 3, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data_Target_Dicocokan');

  const filename = withSample ? 'Template_Target_Dengan_Sampel.xlsx' : 'Template_Target_Kosong.xlsx';
  XLSX.writeFile(workbook, filename);
}

/**
 * Clean & professional export of Matched Data rows to Excel
 */
export function exportCleanMatchedToExcel(
  rows: TargetRow[],
  wilayahLabel: string
): { success: boolean; filename: string; rowCount: number; error?: string } {
  try {
    const usesCombined = rows.length > 0 && rows.some(r => r['Sandi Cabang'] && (!r.Sandi || r.Sandi === r['Sandi Cabang']));
    const exportColumns = usesCombined ? TARGET_COLUMNS_WITH_SANDI_CABANG : TARGET_COLUMNS_SEPARATE;

    const workbook = XLSX.utils.book_new();
    const cleanWilayah = formatWilayahName(wilayahLabel).replace(/\s+/g, '_');
    const filename = `Data_Match_${cleanWilayah}.xlsx`;

    const worksheet = createTargetWorksheet(rows, exportColumns);
    const sheetName = cleanWilayah.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    XLSX.writeFile(workbook, filename);
    return {
      success: true,
      filename,
      rowCount: rows.length,
    };
  } catch (err: any) {
    return {
      success: false,
      filename: '',
      rowCount: 0,
      error: err?.message || 'Gagal mengekspor file Excel.',
    };
  }
}
