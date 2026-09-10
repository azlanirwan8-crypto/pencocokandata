// Data Definitions according to BRD v2.0

export interface MasterRow {
  Wilayah: string;
  'Sandi Cabang'?: string;
  Sandi?: string;
  Cabang?: string;
  'Branch Code': string;
  'Kode Cabang': string;
  'Nama Outlet': string;
  'Status Outlet': string;
  ALAMAT: string;
  'KODE POS': string;
  Kelurahan: string;
  Kecamatan: string;
  'Dati II': string;
  'Kode Dati II': string;
  Provinsi: string;
  Telp: string;
  [key: string]: any;
}

export interface TargetRow {
  No: number | string;
  Wilayah: string;
  'Sandi Cabang'?: string;
  Sandi?: string;
  Cabang?: string;
  'Branch Code': string;
  'Kode Cabang': string;
  'Nama Outlet': string;
  'Status Outlet': string;
  ALAMAT: string;
  'KODE POS': string;
  Kelurahan: string;
  Kecamatan: string;
  'Dati II': string;
  'Kode Dati II': string;
  Provinsi: string;
  'KOTA PTEN': string;
  'KODE POS PTEN': string;
  'CEK KODE POS + PTEN': 'MATCH' | 'DIFFERENT' | '';
  'SUMBER DATA': string;

  // Visual/Processing flags
  _isMatched?: boolean;
  _isPtenDiscrepancy?: boolean;
  _matchLevel?: 'level1' | 'level2' | 'none';
  [key: string]: any;
}

export interface MasterHealth {
  totalRows: number;
  uniqueKodePos: number;
  multiOutletCount: number;
  multiOutletItems: {
    kodePos: string;
    count: number;
    kecamatan: string;
    outlets: string[];
  }[];
}

export interface BatchLog {
  id: string;
  timestamp: string;
  fileName: string;
  uploader: string;
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  ptenDiscrepancyCount: number;
  durationMs: number;
  dataSnapshot: TargetRow[];
}

export interface MatchingStats {
  totalProcessed: number;
  matchedCount: number;
  unmatchedCount: number;
  ptenDiscrepancyCount: number;
  matchingRate: number; // percentage
  ptenDiscrepancyRate: number; // percentage
}

export interface WilayahStat {
  wilayah: string;
  total: number;
  matched: number;
  unmatched: number;
  rate: number;
}

export interface UnmatchedArea {
  kecamatan: string;
  kodePos: string;
  count: number;
  wilayah: string;
}
