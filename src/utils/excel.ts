import * as XLSX from 'xlsx';
import type { MasterRow, TargetRow } from '../types';
import { SAMPLE_MASTER_ROWS, SAMPLE_TARGET_ROWS } from './sampleData';

export const MASTER_COLUMNS: (keyof MasterRow)[] = [
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

export const TARGET_COLUMNS: (keyof TargetRow)[] = [
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
function normalizeHeaderName(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Validate that uploaded headers contain required columns
 */
export function validateHeaders(fileHeaders: string[], expectedColumns: string[]): { isValid: boolean; missing: string[] } {
  const normalizedFileHeaders = fileHeaders.map(normalizeHeaderName);
  const missing: string[] = [];

  for (const expected of expectedColumns) {
    const norm = normalizeHeaderName(expected);
    if (!normalizedFileHeaders.includes(norm)) {
      missing.push(expected);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
  };
}

/**
 * Parse an Excel file (.xlsx, .xls, .csv) into array of objects and headers
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

        const headers = (rawJson[0] as any[]).map(c => String(c || '').trim()).filter(Boolean);
        
        // Parse rows to objects
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        resolve({
          data: rows as T[],
          headers,
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

  // Clean data to exact 19 columns in order
  const exportData = rows.map((r, idx) => {
    const item: Record<string, any> = {};
    for (const col of TARGET_COLUMNS) {
      if (col === 'No') {
        item['No'] = r.No !== undefined && r.No !== '' ? r.No : idx + 1;
      } else {
        item[col] = r[col] ?? '';
      }
    }
    return item;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: TARGET_COLUMNS as string[] });

  // Set friendly column widths
  const colWidths = TARGET_COLUMNS.map((col) => {
    if (col === 'No') return { wch: 6 };
    if (col === 'ALAMAT') return { wch: 40 };
    if (col === 'Cabang' || col === 'Nama Outlet') return { wch: 28 };
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
 * Download empty or sample Master Template (15 Columns)
 */
export function downloadMasterTemplate(withSample = false) {
  const data = withSample ? SAMPLE_MASTER_ROWS : [];
  const worksheet = XLSX.utils.json_to_sheet(data, { header: MASTER_COLUMNS as string[] });
  
  worksheet['!cols'] = MASTER_COLUMNS.map(col => ({ wch: Math.max(col.length + 3, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master_Cabang');

  const filename = withSample ? 'Template_Master_Cabang_Dengan_Sampel.xlsx' : 'Template_Master_Cabang_Kosong.xlsx';
  XLSX.writeFile(workbook, filename);
}

/**
 * Download empty or sample Target Template (19 Columns)
 */
export function downloadTargetTemplate(withSample = false) {
  const data = withSample ? SAMPLE_TARGET_ROWS : [];
  const worksheet = XLSX.utils.json_to_sheet(data, { header: TARGET_COLUMNS as string[] });

  worksheet['!cols'] = TARGET_COLUMNS.map(col => ({ wch: Math.max(col.length + 3, 16) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data_Target_Dicocokan');

  const filename = withSample ? 'Template_Target_Dengan_Sampel.xlsx' : 'Template_Target_Kosong.xlsx';
  XLSX.writeFile(workbook, filename);
}
