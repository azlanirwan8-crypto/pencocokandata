// Pembungkus worker analisa: App mengirim bahan, worker menghitung, progress &
// hasil masuk lewat pesan. Lihat `analyst.worker.ts` untuk alasannya.
import AnalystWorker from './analyst.worker?worker';
import { AnalisaDibatalkan } from './analystPipeline';
import type { AnalystRow, AnalystCoverage } from './analystPipeline';
import type { MasterRow, WilayahSetting } from '../types';
import type { PTENRecord } from '../components/PTENData/PTENManager';
import type { RoleMappingRecord } from '../components/RoleMapping/RoleMappingManager';
import type { KodePosRow } from './neonSync';

/** Bahan run — semua harus bisa di-structured-clone (Set dikirim sebagai array). */
export interface KirimanAnalisa {
  masterRows: MasterRow[];
  ptenList: PTENRecord[];
  kodePosList: KodePosRow[];
  wilayahSettings: WilayahSetting[];
  roleMappingList: RoleMappingRecord[];
  reRunAnomaliesOnly?: boolean;
  previousRows?: AnalystRow[];
  excludeFinalKeys?: string[];
  sampaiFase?: 1 | 2 | 3;
}

export type ProgresAnalisa = (phase: 1 | 2 | 3, pct: number, processed: number, total: number, msg: string) => void;

let workerAktif: Worker | null = null;

/** Tombol "Batalkan" (A4) — mesin di worker membaca flag ini di sela-sela loop. */
export function batalAnalisaDiWorker() {
  workerAktif?.postMessage({ type: 'batal' });
}

export function jalankanAnalisaDiWorker(bahan: KirimanAnalisa, onProgress: ProgresAnalisa) {
  if (workerAktif) workerAktif.terminate();
  const worker = new AnalystWorker();
  workerAktif = worker;

  return new Promise<{ rows: AnalystRow[]; coverage: AnalystCoverage }>((resolve, reject) => {
    const selesai = () => {
      worker.terminate();
      if (workerAktif === worker) workerAktif = null;
    };
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === 'progress') {
        onProgress(d.phase, d.pct, d.processed, d.total, d.msg);
      } else if (d.type === 'selesai') {
        selesai();
        resolve({ rows: d.rows, coverage: d.coverage });
      } else if (d.type === 'gagal') {
        selesai();
        reject(d.dibatalkan ? new AnalisaDibatalkan() : new Error(d.pesan));
      }
    };
    worker.onerror = (e) => {
      selesai();
      reject(new Error(e.message || 'Worker analisa berhenti'));
    };
    worker.postMessage(bahan);
  });
}
