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
 */
export function buildPtenIndex(ptenList: PTENRecord[] = []): Map<string, PTENRecord> {
  const map = new Map<string, PTENRecord>();
  for (const p of ptenList) {
    const cleanKp = String(p.kodePosPten || '').replace(/\D/g, '').trim();
    if (cleanKp) {
      map.set(cleanKp, p);
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

  // Compare cities
  const isCityMatch =
    !cleanTargetCity ||
    !cleanPtenCity ||
    cleanTargetCity === cleanPtenCity ||
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
