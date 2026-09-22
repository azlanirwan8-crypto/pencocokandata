import type { PTENRecord } from '../components/PTENData/PTENManager';
import { cleanDati } from './normalizer';

export interface PtenValidationResult {
  kotaPten: string;
  kodePosPten: string;
  statusPten: 'SAME' | 'DIFFERENT' | 'NOT_FOUND';
  statusDescription: string;
}

/**
 * Builds an O(1) fast lookup index of PTEN records by 5-digit Kode Pos
 * with multi-source fallback from Master Cabang
 */
export function buildPtenIndex(
  ptenList: PTENRecord[] = [],
  masterRows: any[] = []
): Map<string, PTENRecord> {
  const map = new Map<string, PTENRecord>();
  
  // 1. Load PTEN master list
  for (const p of ptenList) {
    const cleanKp = String(p.kodePosPten || '').replace(/\D/g, '').trim();
    if (cleanKp) {
      map.set(cleanKp, p);
    }
  }

  // 2. Multi-source fallback from Master rows
  if (masterRows && masterRows.length > 0) {
    for (const m of masterRows) {
      const cleanKp = String(m['KODE POS'] || '').replace(/\D/g, '').trim();
      const kota = String(m['Kota/Dati II'] || m['Dati II'] || m.Kota || '').trim().toUpperCase();
      if (cleanKp && cleanKp.length === 5 && !map.has(cleanKp) && kota) {
        map.set(cleanKp, {
          kodePosPten: cleanKp,
          kotaPten: kota,
          kotaPtenMax15: kota.length > 15 ? kota.substring(0, 15) : kota,
          status: 'AKTIF',
        });
      }
    }
  }

  return map;
}

/**
 * Validates a target row's postal code and city against the PTEN database
 */
export function validatePtenForTarget(
  targetKodePos: string,
  targetDati2: string,
  ptenIndex: Map<string, PTENRecord>
): PtenValidationResult {
  const kp = String(targetKodePos || '').replace(/\D/g, '').trim();
  if (!kp || !ptenIndex.has(kp)) {
    return {
      kotaPten: '-',
      kodePosPten: kp || '-',
      statusPten: 'NOT_FOUND',
      statusDescription: 'Kode Pos belum terdaftar di Master PTEN',
    };
  }

  const pten = ptenIndex.get(kp)!;
  const cleanTargetCity = cleanDati(targetDati2 || '');
  const cleanPtenCity = cleanDati(pten.kotaPten || '');
  const cleanPtenMax15 = cleanDati(pten.kotaPtenMax15 || '');

  // Compare cities considering 15-character truncation and prefix/contains
  const isCityMatch =
    !cleanTargetCity ||
    !cleanPtenCity ||
    cleanTargetCity === cleanPtenCity ||
    (cleanPtenMax15 && cleanTargetCity.startsWith(cleanPtenMax15)) ||
    (cleanPtenMax15 && cleanPtenMax15.startsWith(cleanTargetCity.slice(0, 15))) ||
    cleanTargetCity.slice(0, 15) === cleanPtenCity.slice(0, 15) ||
    cleanTargetCity.includes(cleanPtenCity) ||
    cleanPtenCity.includes(cleanTargetCity);

  return {
    kotaPten: pten.kotaPten || pten.kotaPtenMax15 || '-',
    kodePosPten: pten.kodePosPten || kp,
    statusPten: isCityMatch ? 'SAME' : 'DIFFERENT',
    statusDescription: isCityMatch
      ? 'Kode Pos & Kota Sesuai Master PTEN'
      : `Beda Kota (Target: ${targetDati2 || '-'} vs PTEN: ${pten.kotaPten})`,
  };
}
