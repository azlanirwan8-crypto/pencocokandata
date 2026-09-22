// Mesin analisa dijalankan DI LUAR thread utama. Alasannya terukur: Fase 2 atas
// 83 ribu baris itu ±10 ms/baris, jadi kalau dihitung di tab, tab-nya membeku
// ber menit-menit ("This page isn't responding") tepat saat operator pindah fase.
// Di worker, perhitungan tetap selama itu tapi UI tetap bisa digulir & diketik.
import { executeAnalystPipeline, AnalisaDibatalkan } from './analystPipeline';

const pembatal = { batal: false };

self.onmessage = (e: MessageEvent) => {
  const p = e.data;
  if (p?.type === 'batal') {
    pembatal.batal = true;
    return;
  }
  pembatal.batal = false;

    let lastMsgTime = 0;

    executeAnalystPipeline(
      p.masterRows,
      p.ptenList,
      p.kodePosList,
      p.wilayahSettings,
      p.roleMappingList,
      (phase: 1 | 2 | 3, pct: number, processed: number, total: number, msg: string) => {
        const now = performance.now();
        // Throttle progress ke max 10 pesan/detik agar UI thread tidak kewalahan, 
        // kecuali saat progress mencapai 100% atau persis selesai.
        if (processed === total || now - lastMsgTime > 100) {
          lastMsgTime = now;
          self.postMessage({ type: 'progress', phase, pct, processed, total, msg });
        }
      },
    p.reRunAnomaliesOnly,
    p.previousRows,
    p.excludeFinalKeys ? new Set<string>(p.excludeFinalKeys) : undefined,
    p.sampaiFase,
    pembatal
  )
    .then(({ rows, coverage }) => {
      self.postMessage({ type: 'selesai', rows, coverage });
    })
    .catch((err: unknown) => {
      self.postMessage({
        type: 'gagal',
        // `constructor.name` bisa berubah oleh minifier, jadi pembatalan ditandai
        // dengan boolean eksplisit, bukan nama kelas.
        dibatalkan: err instanceof AnalisaDibatalkan,
        pesan: err instanceof Error ? err.message : String(err),
      });
    });
};
