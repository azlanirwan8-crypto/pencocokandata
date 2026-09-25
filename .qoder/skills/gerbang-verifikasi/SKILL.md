---
name: gerbang-verifikasi
description: Gerbang verifikasi wajib proyek C:\pencocokandata (aplikasi pencocok cabang/kode pos; React 19 + Vite 8 + TS, cloud Supabase, live di match-sepia.vercel.app). Gunakan sebelum melaporkan pekerjaan apa pun selesai di repo ini, dan saat mengubah tabel, saringan/filter kepala tabel, peta, ekspor Excel/PDF, atau pipeline analis: jalankan scripts/gerbang.mjs, jangan menyalin perintahnya dari ingatan. Berisi juga aturan gaya Velzon, aturan satu-baris sel tabel, saringan berjenjang, endpoint cloud hanya-baca beserta jebakannya, dan larangan aksi merusak pada produksi. Dipakai saat user berkata "cek lagi", "pastikan clean", "kok hilang", "push ke main", atau meminta analisa/fix di proyek ini.
---

# Gerbang verifikasi — pencocokandata

## Kenapa skill ini ada

Repo ini dikerjakan beberapa agen AI sekaligus dan aturannya tidak bisa disimpulkan
dari kode saja. Kesalahan yang paling sering terjadi bukan salah logika, tapi
**melaporkan selesai tanpa gerbang yang benar** — memakai perintah yang salah,
menganggap test lulus padahal bundel uji belum dibangun ulang, atau mengembalikan
keputusan sesi lain.

## 1. Gerbang: jalankan, jangan ditiru perintahnya

```bash
node .qoder/skills/gerbang-verifikasi/scripts/gerbang.mjs
```

Cetak satu baris per langkah, `LULUS`/`GAGAL`, lalu daftar **yang tidak diukur**.
Exit 0 = boleh lapor selesai. Flag: `--hanya=tes,tsc,lint,build`, `--oksidise=<n>`,
`--rinci`.

Tanpa skrip, empat hal ini salah terus:

- `npx tsc -b` — **bukan** `tsc --noEmit -p tsconfig.json`. Yang kedua no-op di sini
  karena tsconfig memakai project references, jadi ia terasa lulus padahal tidak
  memeriksa apa pun.
- Bundel uji harus dibangun ulang **sebelum** test: `npx vite build --ssr tests/entry-uji.ts --outDir tests/out`.
  Melewati langkah ini menguji kode lama dan tetap hijau.
- `npx oxlint` dijaga pada **baseline**, bukan nol. Naik satu peringatan = regresi.
  Turun = sah, tapi baseline harus ikut diturunkan.
- Node tidak ada di PATH Git Bash; ia portabel di `C:\tools\node`. Skrip ini sudah
  menyiapkan PATH-nya sendiri.

Test memakai konvensi sendiri: `asa(label, dapat, harus)` dengan kesetaraan
`JSON.stringify`, dan baris penutup `SEMUA LULUS`. `tests/entry-uji.ts` hanya boleh
mengekspor modul `src/utils/*` **bebas-DOM** — komponen React tidak bisa diuji dari sana.

## 2. Aturan gaya: Velzon, dan ia hidup di stylesheet

Design system proyek ini = Velzon (tema terang; token di `src/styles/index.css`).

- Gaya UI baru ditulis sebagai **kelas di `src/styles/index.css`** memakai token
  (`--bg-card`, `--border-subtle`, `--radius-md`, `--shadow-lg`, `--accent-blue*`,
  `--text-*`). Komponen hanya menempelkan kelas — jangan `style={{}}` dengan hex
  karangan sendiri.
- Sebelum memakai sebuah kelas, pastikan ia **benar-benar terdefinisi**. `btn-ghost`
  pernah dipakai empat komponen tanpa pernah dibuat, jadi tombolnya tampil tanpa gaya.
- Jangan andalkan urutan CSS untuk menang — naikkan spesifisitas. `.search-input`
  punya `width:210px` → `250px` saat `:focus` dan didefinisikan di bagian bawah
  berkas, sehingga kelas tunggal kalah.
- Nilai hex yang sudah ada di file (mis. warna grup header `#0ab39c`, `#eef7ff`) bukan
  pelanggaran: cek dulu dengan `git grep -c -- "<warna>" <commit-lama> -- <file>`
  sebelum "membersihkannya".

## 3. Aturan tabel dan saringan

- **Satu sel = satu baris.** `white-space:nowrap` + scroll horizontal. Nilai panjang
  menggeser tabel, tidak dilipat jadi dua baris.
- **Saringan kepala tabel harus berjenjang**: daftar nilai sebuah kolom dipotong oleh
  saringan kolom lain, tapi **pengecualian diri sendiri wajib** — kalau tidak, begitu
  satu nilai dipilih, opsi lain di kolom itu hilang dan popover tidak bisa dipakai
  mengubah pilihan. Primitifnya `dasarDaftarNilai()` di `src/utils/filterSort.ts`;
  semua tabel memakainya lewat `<ThFilter>`.
- Angka turunan (kartu, badge, penghitung) wajib satu sumber dengan tabel di
  sebelahnya, dan mengikuti populasi yang tersaring.
- Kontrol yang sedang disaring: tampilkan jumlah saringan aktif + tombol bersihkan,
  supaya keadaan tidak terlihat hilang begitu saja.

## 4. Cloud: hanya-baca, dan ada jebakan

Selengkapnya di `references/endpoint-cloud.md`. Yang paling sering menjatuhkan analisa:

- `/api/target?view=final` memotong `limit` ke **500** secara diam-diam dan menaruh
  `total` di **akar** respons, bukan di `data`. Membaca `data.total` = hanya 500 baris
  masuk analisa, lalu kesimpulan salah dengan percaya diri.
- Dataset cloud hidup dan bisa **turun** (pernah 83.747 → 40.846 dalam sehari). Angka
  dari percakapan sebelumnya sudah basi; ukur ulang.
- Hidrasi penuh di dev server bisa makan ±10 menit (168 permintaan berurutan). Tab yang
  membeku hampir pasti bukan render loop — cek log dev server untuk `57014
  canceling statement due to statement timeout` lebih dulu.

## 5. Batas yang tidak boleh dilewati

- **Jangan menjalankan — dan jangan menyuruh user menekan — aksi yang menulis/menghapus
  produksi**: Setujui massal, Reset Data, Revisi massal, tanam ulang cloud. User
  menjalankan alur itu sendiri. Boleh: aksi hanya-baca dan perubahan tampilan.
- **Jangan auto-push.** Lapor penyebab dulu; push hanya saat diminta.
- Repo dipakai bersama: `git log --oneline -3` dan `git status --short` **tepat sebelum**
  menulis, stage berkas tertentu (jangan `git add -A`), dan jangan pernah menulis ulang
  riwayat atau mengembalikan keputusan sesi lain.
- Skrip pengukur/probe dibuat **di luar tree kerja** (mis. `$TMPDIR`), dijalankan, lalu
  dihapus. Jangan meninggalkan berkas asing di repo atau di browser user.
- Jangan klaim "sudah sesuai Velzon" / "sudah jalan" tanpa angka terukur, dan sebutkan
  tegas bagian yang tidak bisa diukur.

## 6. Verifikasi visual

Viewport browser in-app bisa sangat sempit (terukur 400×424 px) sehingga wadah peta
menyusut ke lebar 0 dan semuanya tampak rusak. Jangan menyimpulkan layout dari sana —
bukti yang tahan: jumlah elemen di DOM, angka dari endpoint, atau menjalankan fungsi
aslinya di Node atas data nyata. Jangan mengembalikan Promise dari `evaluate_script`
(itu membekukan kanal CDP untuk panggilan berikutnya).

## Resources

- `scripts/gerbang.mjs` — gerbang lengkap; satu-satunya cara yang sah untuk
  memverifikasi sebelum lapor selesai.
- `references/endpoint-cloud.md` — daftar endpoint hanya-baca, bentuk respons, dan
  jebakan paging.
