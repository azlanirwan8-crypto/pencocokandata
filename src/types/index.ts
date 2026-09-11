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

export interface WilayahSetting {
  kodeWilayah: string;
  keterangan: string;
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
  'SUMBER DATA'?: string;

  // Visual/Processing flags
  _isMatched?: boolean;
  _matchLevel?: 'level1' | 'level2' | 'none' | 'recommendation';
  _matchedAt?: string;
  _matchedBy?: string;

  // Audit flags for evaluating user-prefilled Excel data against system recommendations
  _excelRowIndex?: number;
  _originalFilledSandi?: string;
  _originalFilledCabang?: string;
  _originalFilledSandiCabang?: string;
  _originalFilledNamaOutlet?: string;
  _hasUserFilledData?: boolean;
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
    matchingMasterRows: MasterRow[];
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
  durationMs: number;
  dataSnapshot: TargetRow[];
}

export interface MatchingStats {
  totalProcessed: number;
  matchedCount: number;
  unmatchedCount: number;
  matchingRate: number; // percentage
  level1Count?: number;
  level2Count?: number;
  recommendationCount?: number;
  ptenSameCount?: number;
  ptenDifferentCount?: number;
  ptenUncheckedCount?: number;
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
