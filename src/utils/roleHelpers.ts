// Helper murni untuk data Mapping Role. Berada di luar modul komponen supaya
// `analystPipeline.ts` (dan Web Worker-nya) tidak ikut menarik React + lucide
// ke dalam worker — di worker `window` tidak ada, dan itu membuat seluruh
// analisa mati sebelum mulai.
import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';

/** Deteksi tipe unit kerja (Cabang Induk vs Sub Branch / KCP). */
export function getUnitCategory(orgName: string): 'KC' | 'KCP' {
  const upper = String(orgName || '').toUpperCase();
  if (upper.includes(' - ') || upper.includes('SUB BRANCH') || upper.includes('KCP')) {
    return 'KCP';
  }
  return 'KC';
}

/** Rekomendasi Alur Wondr Merchant dengan bahasa umum. */
export function getWondrRecommendation(record: RoleMappingRecord) {
  const isKc = getUnitCategory(record.organisasiTujuan) === 'KC';
  const hasFullRoles = record.qrsCabsal === 1 && record.qrsCabapv1 === 1 && record.qrsCabapv2 === 1;

  if (isKc && hasFullRoles) {
    return {
      tier: 'Alur Standar 3 Tahap',
      flow: 'Sales ➔ Verifikator ➔ Penyetuju',
      badgeColor: '#0ab39c',
      badgeBg: 'rgba(10, 179, 156, 0.1)',
      desc: '3 Peran Lengkap: Siap digunakan langsung untuk pendaftaran Wondr Merchant.',
    };
  }
  if (isKc) {
    return {
      tier: 'Cabang Induk (Khusus)',
      flow: 'Sales ➔ Penyetuju Langsung',
      badgeColor: '#405189',
      badgeBg: 'rgba(64, 81, 137, 0.1)',
      desc: 'Cabang Induk dengan pengaturan peran verifikator khusus.',
    };
  }
  return {
    tier: 'Alur Outlet (2 Tahap)',
    flow: 'Sales Outlet ➔ Penyetuju Cabang (Langsung / Review Cabang Induk)',
    badgeColor: '#299cdb',
    badgeBg: 'rgba(41, 156, 219, 0.1)',
    desc: 'Outlet tanpa verifikator: Persetujuan langsung ke Penyetuju atau dialihkan ke Cabang Pembina.',
  };
}
