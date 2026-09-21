// 🎭 Mesin rekomendasi mapping role — DIEKSTRAK UTUH dari flow lama TargetDataGrid,
// parameter & logika tidak diubah (3 cabang role lengkap terdekat, strict 1 pulau,
// KC prioritas, cache 60fps).
import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';
import { getUnitCategory } from '../components/RoleMapping/RoleMappingManager';
import { extractBranchAliases, normalizeIndonesianBranchAliases, normalizeBranchName, getIslandFromProvinsi } from './roleMatcher';
import type { MasterRow, TargetRow } from '../types';
import { calculateRealDistance } from './geoDistance';
import { cleanText, textSimilarityScore } from './normalizer';

// E6: definisi pulau SATU sumber (`roleMatcher.getIslandFromProvinsi`). Dulu file ini
// punya salinannya sendiri, jadi Fase 2 dan Fase 3 bisa menyebut dua kota "beda pulau".

export interface RoleMatchWithDistance {
  rec: RoleMappingRecord;
  distanceKm: number | null;
  formattedDistance: string;
  sameIsland: boolean;
  branchCity: string;
  matchedMaster?: MasterRow | null;
}

// Skor internal engine (nama/distan/isFullRole) ikut diekspos supaya pemanggil
// berat seperti pipeline Fase 3 bisa menakar keyakinan dari bukti, bukan tebakan.
// `synthetic` = usulan struktur (KC itu sendiri / cabang induknya) yang TIDAK ada di
// Data Mapping Role — layar boleh menawarkannya, tapi otomatis tidak boleh menuliskannya
// sebagai peran 3/3/3 yang sebenarnya belum dikonfigurasi operator.
export interface RoleMatchScored extends RoleMatchWithDistance {
  nameMatchScore: number;
  isFullRole: boolean;
  synthetic: boolean;
  /** D5: pulau kandidat atau cabang tidak teridentifikasi — jangan dianggap sama pulau. */
  islandUnknown: boolean;
}

/**
 * Mencari cabang dari data mapping role yang memiliki 3 role lengkap (M=1, C=1, S=1)
 * Dianalisis langsung dari data master yang diunggah user:
 * - Menemukan data cabang di masterRows
 * - Memastikan STRICT 1 pulau (tidak menyeberang pulau)
 */
// High-performance cache for Role Matches to guarantee 60 FPS smooth rendering (0ms per row)
const roleMatchCache = new Map<string, RoleMatchScored[]>();
let lastRoleListCacheRef: RoleMappingRecord[] | null = null;
let lastMasterRowsCacheRef: MasterRow[] | null = null;
let cachedBranchMap: Map<string, MasterRow> | null = null;
let cachedFullRoleList: RoleMappingRecord[] | null = null;
const resolvedMasterCache = new Map<string, MasterRow | null>();

const punya3Role = (r: RoleMappingRecord) => r.qrsCabsal === 1 && r.qrsCabapv1 === 1 && r.qrsCabapv2 === 1;

/** Cari record role NYATA di daftar operator untuk sebuah nama cabang yang sudah dinormalkan. */
function cariRecordRole(list: RoleMappingRecord[], ...namaSudahDinormalkan: string[]): RoleMappingRecord | null {
  for (const rec of list) {
    const n = normalizeIndonesianBranchAliases(normalizeBranchName(rec.organisasiTujuan));
    if (n && namaSudahDinormalkan.includes(n)) return rec;
  }
  return null;
}

/**
 * Helper Cerdas Rekomendasi Mapping Role untuk Tab 2:
 * - Mengutamakan cabang dengan 3 role lengkap (Maker, Checker, Signer)
 * - Menghitung jarak realistis dari kandidat aktif
 * - Mengurutkan dari jarak terdekat ke terjauh
 */
export function findTopRoleMatchesByLocation(
  activeCandidateMaster: MasterRow | undefined,
  targetRowFallback: TargetRow | undefined,
  roleMappingList: RoleMappingRecord[],
  masterRows: MasterRow[],
  count = 3
): RoleMatchScored[] {
  if (!roleMappingList || roleMappingList.length === 0) return [];

  // Reset caches if dataset references changed
  if (lastRoleListCacheRef !== roleMappingList) {
    roleMatchCache.clear();
    // 🎯 PATOKAN: kandidat role HANYA cabang 3 role lengkap (Sales+Verifikator+Penyetuju = 1).
    cachedFullRoleList = roleMappingList.filter(
      (r) => r.qrsCabsal === 1 && r.qrsCabapv1 === 1 && r.qrsCabapv2 === 1
    );
    lastRoleListCacheRef = roleMappingList;
  }

  if (lastMasterRowsCacheRef !== masterRows || lastRoleListCacheRef !== roleMappingList) {
    roleMatchCache.clear();
    resolvedMasterCache.clear();
    cachedBranchMap = new Map<string, MasterRow>();
    for (const m of masterRows) {
      const rawInfo = cleanText(m['Informasi Cabang'] || '').toUpperCase();
      const rawOutlet = cleanText(m['Nama Outlet'] || '').toUpperCase();
      const rawCabang = cleanText(m.Cabang || '').toUpperCase();
      const rawSandi = cleanText(m['Sandi Cabang'] || '').toUpperCase();
      if (rawInfo && !cachedBranchMap.has(rawInfo)) cachedBranchMap.set(rawInfo, m);
      if (rawOutlet && !cachedBranchMap.has(rawOutlet)) cachedBranchMap.set(rawOutlet, m);
      if (rawCabang && !cachedBranchMap.has(rawCabang)) cachedBranchMap.set(rawCabang, m);
      if (rawSandi && !cachedBranchMap.has(rawSandi)) cachedBranchMap.set(rawSandi, m);

      const normInfo = normalizeIndonesianBranchAliases(normalizeBranchName(m['Informasi Cabang'] || ''));
      const normOutlet = normalizeIndonesianBranchAliases(normalizeBranchName(m['Nama Outlet'] || ''));
      const normCabang = normalizeIndonesianBranchAliases(normalizeBranchName(m.Cabang || ''));
      if (normInfo && !cachedBranchMap.has(normInfo)) cachedBranchMap.set(normInfo, m);
      if (normOutlet && !cachedBranchMap.has(normOutlet)) cachedBranchMap.set(normOutlet, m);
      if (normCabang && !cachedBranchMap.has(normCabang)) cachedBranchMap.set(normCabang, m);

      // Daftarkan semua alias d/h (bekas nama / historical alias) ke branchMap
      const aliases = [...extractBranchAliases(rawInfo), ...extractBranchAliases(rawOutlet)];
      for (const a of aliases) {
        const norm = normalizeIndonesianBranchAliases(normalizeBranchName(a));
        if (norm && !cachedBranchMap.has(norm)) cachedBranchMap.set(norm, m);
      }
    }

    // Pre-resolve semua organisasi role sekali saja dalam O(1) Map
    for (const rec of (cachedFullRoleList || roleMappingList)) {
      const orgName = rec.organisasiTujuan;
      const cleanOrg = normalizeIndonesianBranchAliases(normalizeBranchName(orgName));
      const cleanOrgNoSpace = cleanOrg.replace(/\s+/g, '');

      let subPartClean = '';
      let subPartNoSpace = '';
      let parentClean = '';
      if (orgName.toUpperCase().includes(' - ')) {
        const parts = orgName.toUpperCase().split(' - ');
        parentClean = normalizeIndonesianBranchAliases(normalizeBranchName(parts[0] || ''));
        subPartClean = normalizeIndonesianBranchAliases(normalizeBranchName(parts[1] || ''));
        subPartNoSpace = subPartClean.replace(/\s+/g, '');
      }

      if (cachedBranchMap.has(cleanOrg)) {
        resolvedMasterCache.set(orgName, cachedBranchMap.get(cleanOrg)!);
      } else if (cleanOrgNoSpace && cachedBranchMap.has(cleanOrgNoSpace)) {
        resolvedMasterCache.set(orgName, cachedBranchMap.get(cleanOrgNoSpace)!);
      } else if (subPartClean && cachedBranchMap.has(subPartClean)) {
        resolvedMasterCache.set(orgName, cachedBranchMap.get(subPartClean)!);
      } else if (subPartNoSpace && cachedBranchMap.has(subPartNoSpace)) {
        resolvedMasterCache.set(orgName, cachedBranchMap.get(subPartNoSpace)!);
      } else if (parentClean && cachedBranchMap.has(parentClean)) {
        resolvedMasterCache.set(orgName, cachedBranchMap.get(parentClean)!);
      } else {
        // Fallback cerdas dengan boundary check ketat agar tidak salah menyangkut ke kota/daerah lain
        let best: MasterRow | null = null;
        let bestScore = -1;
        const tokens = cleanOrg.split(/\s+/).filter((t) => t.length >= 3);
        const isShortOrg = cleanOrg.length <= 7;
        const wordBoundaryRegex = new RegExp(`\\b${cleanOrg}\\b`, 'i');

        for (let i = 0; i < masterRows.length; i++) {
          const m = masterRows[i];
          const info = normalizeIndonesianBranchAliases(normalizeBranchName(m['Informasi Cabang'] || ''));
          const outlet = normalizeIndonesianBranchAliases(normalizeBranchName(m['Nama Outlet'] || ''));
          const kota = normalizeIndonesianBranchAliases(normalizeBranchName(m['Kota/Dati II'] || m['Dati II'] || m.Kota || ''));

          let score = 0;
          if (info === cleanOrg || outlet === cleanOrg || (subPartClean && (info === subPartClean || outlet === subPartClean))) {
            score = 100;
          } else if (subPartClean && (info.includes(subPartClean) || outlet.includes(subPartClean))) {
            score = 92;
          } else if (isShortOrg ? (wordBoundaryRegex.test(info) || wordBoundaryRegex.test(outlet)) : (info.includes(cleanOrg) || cleanOrg.includes(info))) {
            score = 85;
          } else if (outlet.includes(cleanOrg) || cleanOrg.includes(outlet)) {
            score = isShortOrg ? (wordBoundaryRegex.test(outlet) ? 80 : 0) : 80;
          } else if (kota && (kota === cleanOrg || (!isShortOrg && (kota.includes(cleanOrg) || cleanOrg.includes(kota))))) {
            score = 75;
          } else {
            // Cek token spesifik (contoh 'THAMRIN' dari 'JAKARTA THAMRIN' cocok dengan outlet 'THAMRIN')
            let matched = 0;
            let hasSignificantMatch = false;
            for (const t of tokens) {
              if (['KOTA', 'KABUPATEN', 'PROVINSI', 'CABANG'].includes(t)) continue;
              const tokenRegex = new RegExp(`\\b${t}\\b`, 'i');
              if (tokenRegex.test(info) || tokenRegex.test(outlet)) {
                matched++;
                if (t.length >= 5) hasSignificantMatch = true;
              } else if (tokenRegex.test(kota)) {
                matched++;
              }
            }
            if (matched > 0) {
              score = (matched / tokens.length) * 60;
              if (hasSignificantMatch) score += 20;
            }
          }
          if (score > 0 && String(m['Status Outlet'] || '').toUpperCase() === 'KC') score += 5;
          if (score > bestScore) {
            bestScore = score;
            best = m;
          }
          if (bestScore >= 90) break;
        }
        resolvedMasterCache.set(orgName, bestScore >= 50 ? best : null);
      }
    }

    lastMasterRowsCacheRef = masterRows;
    lastRoleListCacheRef = roleMappingList;
  }

  const fullRoleList = cachedFullRoleList || [];

  const candIdentifier = activeCandidateMaster?.['Sandi Cabang'] || activeCandidateMaster?.Cabang || activeCandidateMaster?.['Nama Outlet'] || String(targetRowFallback?.No || '');
  const candProv = activeCandidateMaster?.Provinsi || activeCandidateMaster?.PROVINSI || targetRowFallback?.Provinsi || targetRowFallback?.PROVINSI || '';
  const candDati = activeCandidateMaster?.['Dati II'] || activeCandidateMaster?.['Kota/Dati II'] || targetRowFallback?.['Dati II'] || '';
  const candAlm = activeCandidateMaster?.ALAMAT || targetRowFallback?.ALAMAT || '';
  const cacheKey = `${candIdentifier}|${candProv}|${candDati}|${candAlm.slice(0, 20)}|${count}`;

  if (roleMatchCache.has(cacheKey)) {
    return roleMatchCache.get(cacheKey)!;
  }

  const candidateIsland = getIslandFromProvinsi(candProv, candDati, candAlm);

  function resolveMaster(orgName: string): MasterRow | null {
    return resolvedMasterCache.get(orgName) || null;
  }

  const candidateRowAsTarget: TargetRow = {
    No: 1,
    Wilayah: activeCandidateMaster?.Wilayah || targetRowFallback?.Wilayah || '',
    'Branch Code': activeCandidateMaster?.['Branch Code'] || '',
    'Kode Cabang': activeCandidateMaster?.['Kode Cabang'] || '',
    'Nama Outlet': activeCandidateMaster?.['Nama Outlet'] || '',
    'Status Outlet': activeCandidateMaster?.['Status Outlet'] || '',
    ALAMAT: activeCandidateMaster?.ALAMAT || targetRowFallback?.ALAMAT || '',
    'KODE POS': activeCandidateMaster?.['KODE POS'] || targetRowFallback?.['KODE POS'] || '',
    Kelurahan: activeCandidateMaster?.Kelurahan || targetRowFallback?.Kelurahan || '',
    Kecamatan: activeCandidateMaster?.Kecamatan || targetRowFallback?.Kecamatan || '',
    'Dati II': candDati,
    'Kode Dati II': activeCandidateMaster?.['Kode Dati II'] || '',
    Provinsi: candProv,
  };

  // Ekstrak token / alias kandidat aktif secara terpisah antara outlet (unit spesifik) dan cabang induk (kota/wilayah)
  const outletRawAliases = extractBranchAliases(activeCandidateMaster?.['Nama Outlet'] || targetRowFallback?.['Nama Outlet'] || '');
  const cabangRawAliases = extractBranchAliases(activeCandidateMaster?.Cabang || targetRowFallback?.Cabang || '');

  const candOutletAliases = outletRawAliases
    .map(a => normalizeIndonesianBranchAliases(normalizeBranchName(a)))
    .filter(Boolean);

  const candCabangAliases = cabangRawAliases
    .map(a => normalizeIndonesianBranchAliases(normalizeBranchName(a)))
    .filter(Boolean);

  const scored: RoleMatchScored[] = [];
  const addedOrgKeys = new Set<string>();

  // ── 0. LOGIKA CERDAS: Prioritaskan Cabang Utama (KC) Kandidat / Cabang Induk Lokal ──
  const isCandidateKc = String(activeCandidateMaster?.['Status Outlet'] || '').trim().toUpperCase() === 'KC';

  if (isCandidateKc && activeCandidateMaster) {
    // KASUS A: Kandidat itu sendiri sudah merupakan KC (Cabang Utama seperti HARMONI)
    const candOutletClean = normalizeIndonesianBranchAliases(normalizeBranchName(activeCandidateMaster['Nama Outlet'] || activeCandidateMaster.Cabang || ''));
    const orgName = `${candOutletClean} BRANCH OFFICE`;
    const nyata = cariRecordRole(fullRoleList, orgName, candOutletClean);
    const distInfo = calculateRealDistance(candidateRowAsTarget, activeCandidateMaster);
    scored.push({
      rec: nyata || {
        organisasiTujuan: orgName,
        qrsCabsal: 1,
        qrsCabapv1: 1,
        qrsCabapv2: 1,
        grandTotal: 3,
      },
      distanceKm: distInfo.distanceKm ?? 0,
      formattedDistance: distInfo.formattedDistance || '0 km (Cabang Utama Ini)',
      sameIsland: true,
      branchCity: candDati || candProv || 'Lokal',
      matchedMaster: activeCandidateMaster,
      nameMatchScore: 200, // Prioritas mutlak nomor 1
      isFullRole: nyata ? punya3Role(nyata) : true,
      synthetic: !nyata,
      islandUnknown: candidateIsland === 'Lainnya',
    });
    addedOrgKeys.add(orgName.toUpperCase());
    addedOrgKeys.add(candOutletClean.toUpperCase());
  } else if (activeCandidateMaster && masterRows && masterRows.length > 0) {
    // KASUS B: Kandidat adalah KCP, cari Cabang Induk (KC) terdekat dari master
    const parentCabangRaw = activeCandidateMaster.Cabang || '';
    const parentClean = normalizeIndonesianBranchAliases(normalizeBranchName(parentCabangRaw));
    let parentMaster: MasterRow | null = null;

    if (parentClean) {
      parentMaster = masterRows.find(m => {
        const isKc = String(m['Status Outlet'] || '').toUpperCase() === 'KC';
        if (!isKc) return false;
        const o = normalizeIndonesianBranchAliases(normalizeBranchName(m['Nama Outlet'] || ''));
        const c = normalizeIndonesianBranchAliases(normalizeBranchName(m.Cabang || ''));
        return o === parentClean || c === parentClean || o.includes(parentClean);
      }) || null;
    }

    // Jika belum ketemu dari nama cabang, cari KC terdekat di Dati II / Wilayah yang sama
    if (!parentMaster && candDati) {
      const candDatiClean = cleanText(candDati).toUpperCase();
      parentMaster = masterRows.find(m => {
        const isKc = String(m['Status Outlet'] || '').toUpperCase() === 'KC';
        if (!isKc) return false;
        const mDati = cleanText(m['Dati II'] || m['Kota/Dati II'] || m.Kota || '').toUpperCase();
        return mDati && (mDati === candDatiClean || mDati.includes(candDatiClean) || candDatiClean.includes(mDati));
      }) || null;
    }

    if (parentMaster) {
      const pOutletClean = normalizeIndonesianBranchAliases(normalizeBranchName(parentMaster['Nama Outlet'] || parentMaster.Cabang || ''));
      const distInfo = calculateRealDistance(candidateRowAsTarget, parentMaster);
      const orgName = `${pOutletClean} BRANCH OFFICE`;
      const nyata = cariRecordRole(fullRoleList, orgName, pOutletClean);
      scored.push({
        rec: nyata || {
          organisasiTujuan: orgName,
          qrsCabsal: 1,
          qrsCabapv1: 1,
          qrsCabapv2: 1,
          grandTotal: 3,
        },
        distanceKm: distInfo.distanceKm,
        formattedDistance: distInfo.formattedDistance || (distInfo.distanceKm !== null ? `~${distInfo.distanceKm} km` : 'jarak dekat'),
        sameIsland: true,
        branchCity: parentMaster['Dati II'] || candDati || '',
        matchedMaster: parentMaster,
        nameMatchScore: 180, // Prioritas tinggi cabang induk
        isFullRole: nyata ? punya3Role(nyata) : true,
        synthetic: !nyata,
        islandUnknown: candidateIsland === 'Lainnya',
      });
      addedOrgKeys.add(orgName.toUpperCase());
      addedOrgKeys.add(pOutletClean.toUpperCase());
    }
  }

  // ── Evaluasi daftar Role Mapping yang tersedia ──
  for (const rec of fullRoleList) {
    const orgClean = normalizeIndonesianBranchAliases(normalizeBranchName(rec.organisasiTujuan));
    if (addedOrgKeys.has(rec.organisasiTujuan.toUpperCase()) || addedOrgKeys.has(orgClean.toUpperCase())) {
      continue;
    }

    const branchMaster = resolveMaster(rec.organisasiTujuan);
    const branchProv = branchMaster?.Provinsi || branchMaster?.PROVINSI || '';
    const branchCity = branchMaster?.['Dati II'] || branchMaster?.['Kota/Dati II'] || branchMaster?.Kota || '';
    const branchAlm = branchMaster?.ALAMAT || '';
    const branchIsland = getIslandFromProvinsi(branchProv, branchCity, branchAlm || rec.organisasiTujuan);

    // D5: pulau yang tidak teridentifikasi TIDAK lagi dianggap "sama pulau".
    // Kandidatnya tetap ikut dinilai (jangan buang data), tapi ditandai supaya
    // otomatis memaksa REVIEW alih-alih lolos sebagai tetangga sekawasan.
    const islandUnknown = candidateIsland === 'Lainnya' || branchIsland === 'Lainnya';
    const sameIsland = islandUnknown ? false : branchIsland === candidateIsland;

    if (!sameIsland && !islandUnknown) {
      continue; // JANGAN nyebrang pulau!
    }

    let distanceKm: number | null = null;
    let formattedDistance = '';
    if (branchMaster) {
      const distInfo = calculateRealDistance(candidateRowAsTarget, branchMaster);
      distanceKm = distInfo.distanceKm;
      formattedDistance = distInfo.formattedDistance;
    }

    // Hitung kesesuaian nama langsung antara organisasi role vs kandidat aktif / alias d/h
    const isFullRole = punya3Role(rec);

    let subPartClean = '';
    let parentClean = '';
    if (rec.organisasiTujuan.toUpperCase().includes(' - ')) {
      const p = rec.organisasiTujuan.toUpperCase().split(' - ');
      parentClean = normalizeIndonesianBranchAliases(normalizeBranchName(p[0] || ''));
      subPartClean = normalizeIndonesianBranchAliases(normalizeBranchName(p[1] || ''));
    }

    let nameMatchScore = 0;

    const subPartNoSpace = subPartClean ? subPartClean.replace(/\s+/g, '') : '';
    const isExactSubPart = subPartClean && (
      candOutletAliases.some(a => a === subPartClean || (subPartNoSpace.length >= 3 && a.replace(/\s+/g, '') === subPartNoSpace)) ||
      candCabangAliases.some(a => a === subPartClean || (subPartNoSpace.length >= 3 && a.replace(/\s+/g, '') === subPartNoSpace))
    );
    const isSpecificSubPart = subPartClean && (
      candOutletAliases.some(a => a.includes(subPartClean) || (subPartNoSpace.length >= 3 && a.replace(/\s+/g, '').includes(subPartNoSpace))) ||
      candCabangAliases.some(a => a.includes(subPartClean) || (subPartNoSpace.length >= 3 && a.replace(/\s+/g, '').includes(subPartNoSpace)))
    );

    if (isExactSubPart) {
      nameMatchScore = 110;
    } else if (isSpecificSubPart) {
      nameMatchScore = 105;
    } else if (candOutletAliases.some(a => a === orgClean)) {
      nameMatchScore = 100;
    } else if (
      subPartClean &&
      (candOutletAliases.some(a => Math.abs(a.length - subPartClean.length) <= 3 && textSimilarityScore(a, subPartClean) >= 0.85) ||
       candCabangAliases.some(a => Math.abs(a.length - subPartClean.length) <= 3 && textSimilarityScore(a, subPartClean) >= 0.85))
    ) {
      nameMatchScore = 98;
    } else if (candOutletAliases.some(a => Math.abs(a.length - orgClean.length) <= 3 && textSimilarityScore(a, orgClean) >= 0.85)) {
      nameMatchScore = 95;
    } else if (candCabangAliases.some(a => a === orgClean || (parentClean && a === parentClean))) {
      nameMatchScore = 85;
    } else if (candOutletAliases.some(a => a.length >= 4 && orgClean.includes(a))) {
      nameMatchScore = 70;
    }

    scored.push({
      rec,
      distanceKm,
      formattedDistance: formattedDistance || (distanceKm !== null ? `~${distanceKm} km` : 'jarak tidak diketahui'),
      sameIsland,
      branchCity: branchCity || rec.organisasiTujuan,
      matchedMaster: branchMaster,
      nameMatchScore,
      isFullRole,
      synthetic: false,
      islandUnknown,
    });
    addedOrgKeys.add(rec.organisasiTujuan.toUpperCase());
    addedOrgKeys.add(orgClean.toUpperCase());
  }

  // Jika sudah ada pilihan cabang lokal (< 50 km), buang cabang luar daerah yang sangat jauh (> 80 km)
  const hasLocalChoice = scored.some(s => s.distanceKm !== null && s.distanceKm <= 50);
  const candidatePool = hasLocalChoice
    ? scored.filter(s => s.distanceKm === null || s.distanceKm <= 80)
    : scored;

  // Prioritas Pengurutan:
  // 1. Kecocokan Nama Spesifik / Cabang Induk Terverifikasi (nameMatchScore)
  // 2. Cabang Utama (KC) vs KCP
  // 3. Jarak fisik terdekat
  // 4. Kelengkapan role (M=1, C=1, S=1)
  candidatePool.sort((a, b) => {
    // Top priority: direct name/alias match
    if (a.nameMatchScore !== b.nameMatchScore) {
      return b.nameMatchScore - a.nameMatchScore;
    }

    const aIsKc = getUnitCategory(a.rec.organisasiTujuan) === 'KC';
    const bIsKc = getUnitCategory(b.rec.organisasiTujuan) === 'KC';

    // Jika kedua kandidat memiliki jarak valid
    if (a.distanceKm !== null && b.distanceKm !== null) {
      const distDiff = a.distanceKm - b.distanceKm;

      if (Math.abs(distDiff) <= 2) {
        if (aIsKc !== bIsKc) {
          return aIsKc ? -1 : 1;
        }
        if (a.isFullRole !== b.isFullRole) {
          return a.isFullRole ? -1 : 1;
        }
        return distDiff;
      }

      if (Math.abs(distDiff) > 2) {
        return distDiff;
      }

      if (aIsKc !== bIsKc) {
        return aIsKc ? -1 : 1;
      }

      if (a.isFullRole !== b.isFullRole) {
        return a.isFullRole ? -1 : 1;
      }
      return distDiff;
    }

    if (a.distanceKm === null && b.distanceKm !== null) return 1;
    if (b.distanceKm === null && a.distanceKm !== null) return -1;

    if (aIsKc !== bIsKc) {
      return aIsKc ? -1 : 1;
    }

    if (a.isFullRole !== b.isFullRole) {
      return a.isFullRole ? -1 : 1;
    }

    return 0;
  });

  const result = candidatePool.slice(0, count);
  roleMatchCache.set(cacheKey, result);
  return result;
}
