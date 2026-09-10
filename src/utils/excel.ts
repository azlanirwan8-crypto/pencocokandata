import * as XLSX from 'xlsx';
import type { TargetRow } from '../types';
import { SAMPLE_MASTER_ROWS, SAMPLE_TARGET_ROWS } from './sampleData';

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
  'KOTA PTEN',
  'KODE POS PTEN',
  'CEK KODE POS + PTEN',
  'SUMBER DATA',
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
  'KOTA PTEN',
  'KODE POS PTEN',
  'CEK KODE POS + PTEN',
  'SUMBER DATA',
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
  if (
    norm === 'sandi cabang' ||
    norm === 'sandi / cabang' ||
    norm === 'sandi/cabang' ||
    norm === 'sandi_cabang' ||
    norm === 'sandicabang' ||
    norm === 'sandi & cabang'
  ) {
    return 'Sandi Cabang';
  }

  if (norm === 'sandi') return 'Sandi';
  if (norm === 'cabang') return 'Cabang';
  if (norm === 'wilayah') return 'Wilayah';
  if (norm === 'branch code' || norm === 'branchcode' || norm === 'branch_code') return 'Branch Code';
  if (norm === 'kode cabang' || norm === 'kodecabang' || norm === 'kode_cabang') return 'Kode Cabang';
  if (norm === 'nama outlet' || norm === 'namaoutlet' || norm === 'nama_outlet') return 'Nama Outlet';
  if (norm === 'status outlet' || norm === 'statusoutlet' || norm === 'status_outlet') return 'Status Outlet';
  if (norm === 'alamat') return 'ALAMAT';
  if (norm === 'kode pos' || norm === 'kodepos' || norm === 'kode_pos' || norm === 'pos') return 'KODE POS';
  if (norm === 'kelurahan') return 'Kelurahan';
  if (norm === 'kecamatan') return 'Kecamatan';
  if (norm === 'dati ii' || norm === 'dati 2' || norm === 'datii' || norm === 'kabupaten' || norm === 'kota' || norm === 'kabupaten / kota') return 'Dati II';
  if (norm === 'kode dati ii' || norm === 'kode dati 2' || norm === 'kodedatii') return 'Kode Dati II';
  if (norm === 'provinsi' || norm === 'propinsi') return 'Provinsi';
  if (norm === 'telp' || norm === 'telepon' || norm === 'no telp' || norm === 'no. telp' || norm === 'telephone') return 'Telp';
  if (norm === 'kota pten' || norm === 'kotapten') return 'KOTA PTEN';
  if (norm === 'kode pos pten' || norm === 'kodepos pten' || norm === 'kodepospten') return 'KODE POS PTEN';
  if (norm === 'cek kode pos + pten' || norm === 'cek kode pos pten' || norm === 'cek kodepos pten') return 'CEK KODE POS + PTEN';
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
    'KOTA PTEN',
    'KODE POS PTEN',
    'SUMBER DATA',
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
export async function parseExcelFile<T>(file: File): Promise<{ data: T[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary', cellText: true, raw: false });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse to 2D array first to inspect headers accurately
        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (rawJson.length === 0) {
          resolve({ data: [], headers: [] });
          return;
        }

        const rawHeaders = (rawJson[0] as any[]).map(c => String(c || '').trim()).filter(Boolean);
        
        // Parse rows to objects
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        // Map every row keys to canonical names
        const standardizedRows = rawRows.map(row => {
          const item: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            const canonicalKey = mapCanonicalHeader(key);
            item[canonicalKey] = row[key];
          }

          // Bidirectional sync for Sandi Cabang vs Sandi & Cabang
          if (item['Sandi Cabang']) {
            if (!item.Cabang) item.Cabang = item['Sandi Cabang'];
            if (!item.Sandi) item.Sandi = item['Sandi Cabang'];
          } else if (item.Sandi || item.Cabang) {
            item['Sandi Cabang'] = [item.Sandi, item.Cabang].filter(Boolean).join(' - ');
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

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Format timestamp YYYYMMDD_HHMMSS
 */
function getFormattedTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Download Target results as formatted Excel file
 * Enforces Row Integrity Rule: assert total_downloaded_rows == total_uploaded_rows
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

  // Clean data to exact columns in order
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

  // Set friendly column widths
  const colWidths = exportColumns.map((col) => {
    if (col === 'No') return { wch: 6 };
    if (col === 'ALAMAT') return { wch: 40 };
    if (col === 'Cabang' || col === 'Nama Outlet' || col === 'Sandi Cabang') return { wch: 28 };
    if (col === 'KODE POS' || col === 'KODE POS PTEN' || col === 'CEK KODE POS + PTEN') return { wch: 18 };
    return { wch: 18 };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil_Matching');

  // Filename format: Hasil_Matching_[Wilayah]_[Timestamp].xlsx
  const safeWilayah = (wilayahFilterLabel || 'SEMUA')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 30);
  const timestamp = getFormattedTimestamp();
  const filename = `Hasil_Matching_${safeWilayah}_${timestamp}.xlsx`;

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

  worksheet['!cols'] = TARGET_COLUMNS_WITH_SANDI_CABANG.map(col => ({ wch: Math.max(col.length + 3, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data_Target_Dicocokan');

  const filename = withSample ? 'Template_Target_Dengan_Sampel.xlsx' : 'Template_Target_Kosong.xlsx';
  XLSX.writeFile(workbook, filename);
}
