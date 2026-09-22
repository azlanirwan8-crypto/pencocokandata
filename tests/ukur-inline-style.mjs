// N2/O4 — pengukur gaya inline, bukan uji asersi (tidak ada exit code gagal).
// Pemakaian: node tests/ukur-inline-style.mjs [file...]
// Angka acuan 2026-09-22, AnalystResultsGrid.tsx: 239 blok `style={{}}`,
// 987 deklarasi inline → 947 (-4%) setelah 4 tombol aksi baris pindah ke kelas
// `.btn-aksi-baris` / `.btn-aksi-baris-padat` di src/styles/index.css.
import { readFileSync } from 'node:fs';

const berkas = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['src/components/WorkingEngine/AnalystResultsGrid.tsx'];

/** Isi setiap `style={{ ... }}`, dipisah dengan penyeimbang kurung. */
function blokGaya(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (!s.startsWith('style={{', i)) continue;
    i += 8;
    let d = 1;
    let body = '';
    while (i < s.length && d > 0) {
      const c = s[i];
      if (c === '{') d++;
      else if (c === '}') d--;
      if (d > 0) body += c;
      i++;
    }
    out.push(body);
  }
  return out;
}

const nilaiProp = (blok, prop) =>
  [...blok.matchAll(new RegExp(`(?:^|[,{])\\s*${prop}:\\s*(?:'([^']*)'|"([^"]*)"|\`([^\`]*)\`|[\\w.]+\\s*\\?\\s*'([^']*)'[^,]*)`, 'g'))]
    .map((m) => m.slice(1).find((v) => v !== undefined) || '<dinamis>')
    .filter(Boolean);

for (const f of berkas) {
  const blok = blokGaya(readFileSync(f, 'utf8'));
  const dekl = blok.reduce((n, b) => n + (b.match(/[A-Za-z][A-Za-z0-9]*:/g) || []).length, 0);
  const font = [...new Set(blok.flatMap((b) => nilaiProp(b, 'fontSize')))].sort();
  const pad = [...new Set(blok.flatMap((b) => nilaiProp(b, 'padding')))].sort();
  console.log(
    `${f}\n  blok style={{}}: ${blok.length}   deklarasi inline: ${dekl}\n  fontSize unik (${font.length}): ${font.join(' ')}\n  padding unik (${pad.length}): ${pad.join(' ')}`
  );
}
console.log('\nTarget O4 butir 5: fontSize unik <= 6 dan padding unik <= 8. Target N2: deklarasi inline turun ~40%.');
