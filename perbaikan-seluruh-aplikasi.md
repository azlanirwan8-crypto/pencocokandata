# RENCANA PERBAIKAN SELURUH APLIKASI
> **STATUS 2026-09-23: BELUM SELESAI — 55 dari 71 item Bagian 0 `SELESAI`, 1 `SEDANG` (A9), 15 `BELUM`. Lampiran: M SELESAI (+M9), N0/N1/N3/N4/N5/N6/N7/N8/N9 SELESAI, N10 SELESAI (cache kartu Fase 2 milik sesi agen lain, tiga cacatnya ditutup), N11 web worker + N12 reset Final + N13 peta multi-parameter SELESAI, N14+N15 SELESAI (cloud pindah ke Supabase Postgres lewat REST + publishable key; **operator wajib menempelkan `server/supabase-bootstrap.sql` satu kali di Supabase SQL Editor sebelum data muncul**), **N16 SELESAI** (setiap fungsi `api/` harus berdiri sendiri: tambah file di `api/` membuat build mati diam DAN impor relatif di dalam `api/` gagal di runtime — produksi pulih, semua `/api/*` balas JSON), **N17 SELESAI** (daftar terima 11 poin: sapuan token Velzon 628 nilai, semua export Excel lewat satu jalur bergaya + tanggal berkas lokal + impor bebas mojibake, 31 celah alert ditutup, + 4 bug persistensi nyata termasuk mode `replace` master yang selama ini kalah atas data lama), **N18 SELESAI** (penjaga identitas kartu 13 benar-benar ikut menilai Fase 3, dan penempatan yang terbukti salah tidak bisa lagi auto-final ke Data Final), **N19 SELESAI** (6.129 baris kode mati dihapus, bundle terbukti byte-identik), **N20 SELESAI** (tombol "Sync Data" menarik sendiri dump resmi Kemendagri ke `kodepos_baseline` dan menyalinnya ke tabel kerja saat tabel itu masih kosong — tidak lagi bergantung kodepos.id yang diblokir Cloudflare dari IP datacenter), **N21+N22 SELESAI** (penyalinan dipecah per window karena statement 83 ribu baris dipotong 8 detik oleh role `anon`; lalu dipercepat ±9× karena terukur `db-max-rows` proyek memotong tiap balasan baca di 1.000 baris — lihat baris 46-47 Bagian L), **N23 SELESAI** (satu tekan Sync Data kini ikut mengambil titik koordinat per desa dari kodepos.co.id — crawler server-side `?view=koordinat-crawl`, terbukti terjangkau: 220 ms + 98.719 byte per halaman, HTTP 200 — dan menyalin titiknya bersamaan dengan baris patokan; + `saveMasterToNeon` dipecah karena satu permintaan 8 detik itulah yang membuat Data Cabang tidak pernah naik ke cloud) — **bootstrap Supabase SUDAH ditempel operator (terukur 2026-09-23: `/api/status` → `connected:true`, 11 tabel hidup, `app_store` sudah terisi), jadi poin terima 1/3/5-sisa/9/10/11 tinggal butuh data benar-benar naik: kode pos dari tekan Sync Data, sisanya dari Ctrl+F5 di browser operator**, N2 SEDANG (terukur −4% inline style; sisanya butuh cek visual), O BELUM; H1/H3/H4 SELESAI (N6), H2 & H5 masih buka.** **Seluruh menu Data Analyst (Bagian B, C, D, E, M, N0/N1/N3) sudah beres** — sisa di dalam menu itu tinggal N2 (inline style → kelas) + Bagian O (token desain, sekarang tolok ukurnya Velzon lewat N9) + A9, dan satu keputusan pemilik produk: C7 (15 baris kode pos kembar di cloud). **Menu Dashboard sudah pipeline-native lewat N6; tab Fase 2 dibuktikan mengisi kolomnya sendiri dan tidak lagi membekukan tab lewat N7 (jeda thread 34,6 d → 2,8 d), dan kolom identitasnya kini tampil walau Fasenya belum jalan lewat N8.** Sisa TERBERAT ada di 5 menu data master: **F1-W2, F2-P2/P3, F3-C3, F4-R2/R3, F5-K1/K2/K3, F6-X1/X2/X3**, lalu **A10**, **G11/G12**, dan Bagian H2/H5 / I / J / K.
> Baca Bagian 0 sebelum mengerjakan apa pun. Titik lanjut: **N2 dikerjakan bersama O** (satu sweep gaya, jangan dua kali), lalu F (5 menu master). Rincian & bukti verifikasi ada di sana.

**Aplikasi:** Tools Data Matcher Cabang & Outlet v2.x â€” React + TypeScript + Vite; IndexedDB (lokal) + Supabase Postgres (cloud via serverless `api/`, akses REST + publishable key sejak N15).
**Sumber:** tinjauan kode statis; aplikasi TIDAK dijalankan saat audit (`node`/`npm` tidak tersedia). Nomor baris = kondisi saat audit; verifikasi ulang dengan pencarian teks sebelum mengubah.
**Pemakai:** AI/developer eksekutor. Ikuti urutan di Bagian 10. Jangan ubah dua mesin sekaligus tanpa membaca file pasangannya (`analystPipeline.ts` â†” `recommender.ts` â†” `AnalystResultsGrid.tsx`).

## 0. STATUS PENGERJAAN â€” WAJIB DIBACA AI SEBELUM EKSEKUSI

> ### ðŸŸ¨ PENAANDAAN STATUS â€” 2026-09-21 â€” **DOKUMEN INI BELUM SELESAI, JANGAN DIANGGAP TUNTAS**
>
> Ringkas dari 71 item pada tabel di bawah ini (dihasilkan ulang oleh skrip pada 2026-09-22, bukan salinan manual):
>
> | Status | Jumlah | ID |
> |---|---|---|
> | SELESAI | **55** | A1–A8, B1, B2, B3, B4, B5, C2a–C2e, C3, C4, C5*, C6*, C7*, D1–D6, E1–E8, W1, W3, P1, F3-C1, F3-C2, R1, F6-X4, X5, G1, G2, G3, G4–G10 |
> | SEDANG | **1** | A9 — breakpoint responsivitas belum; CSS mati menunggu konfirmasi hapus |
> | BELUM | **15** | A10, F1-W2, F2-P2, F2-P3, F3-C3, F4-R2, F4-R3, F5-K1, F5-K2, F5-K3, F6-X1, F6-X2, F6-X3, G11, G12 |
>
> **Bagian E (12 sinyal) kini SELESAI SEMUA (E1–E8).** Tidak ada satu pun item Bagian E yang tersisa.
>
> \* C5 & C6 = dua temuan BARU dari screenshot operator (bug substring "KIM" & banjir antrean manual), ditambahkan 2026-09-21. C7 = temuan screenshot 2026-09-22 (selisih jumlah baris kode pos, sudah diukur sampai akar). Dengan C7 total item tabel Bagian 0 jadi **71** — angka 71/52/1/18 di atas dihasilkan ulang oleh skrip pada tanggal ini, bukan salinan manual.
>
> Belum termasuk item Bagian **H/I/J/K di Lampiran** (statusnya ditandai langsung di barisnya; Bagian H: **H1/H3/H4 `SELESAI 2026-09-22` lewat N6, H2 & H5 masih buka**; khusus Bagian K: K1â€“K3 sudah dikerjakan & build-verified 2026-09-21, K4â€“K5 `BELUM`).
>
> Belum termasuk lampiran **M / N / O** juga (status di judul tiap bagiannya, bukan di tabel ini): **M SELESAI** (status tiga keranjang Fase 2), **N: N0 SELESAI 2026-09-22 (butir 4 "Buka Data Cabang" belum) + N3 SELESAI 2026-09-22, N1/N2 BELUM**, **O BELUM** (token desain & `html { font-size }`). N3 = checkbox "pilih semua" + aksi massal di 4 tab fase — bukti & tiga deviasi dari rencananya ada di bagian N3.
>
> **Untuk AI berikutnya (Cline / lainnya):**
> 1. Urutan sisa yang disepakati: **Fase 1/2/3 selesai semua** (B1, B2, B4, C2a–C6, D1–D6). Yang BELUM: **E1–E8** (12 sinyal), **F** (5 menu data master), **A10**, **B3**, **G1/G3/G11/G12**, lalu Bagian H/I/J/K di lampiran. **G9 sudah selesai** — jangan buat file `api/` baru apa pun (alasan + bukti: kotak larangan di Bagian G9).
> 2. **Jangan kerjakan ulang** 13 item `SELESAI`; baca kolom "Catatan" untuk file yang sudah disentuh.
> 3. Nomor baris di dokumen ini berasal dari audit statis dan **sudah bergeser** â€” cari teksnya, jangan percaya angka barisnya.
> 4. Setelah satu item selesai: ganti statusnya di tabel + isi tanggal `YYYY-MM-DD` + file yang diubah, lalu commit dokumen ini bersama kodenya.
> 5. Wajib jalankan Bagian 11 sebelum melapor selesai: `npm run build` dan `npm run lint` (oxlint, **bukan eslint**) harus bersih.
>
> **Bukti verifikasi batch G2/A4 (2026-09-21):** `npm run build` âœ“ Â· `npm run lint` 0 error / 84 warning (baseline saat itu) Â· diuji di browser (dev `localhost:5199`, modul sumber di-import langsung): `makeFinalKey` V2 memisahkan dua kota yang bertabrakan di versi lama, `AnalisaDibatalkan` benar-benar terlempar saat flag naik dan run normal tetap selesai, notifikasi warning muncul & hilang sesuai auto-dismiss, `ConfirmDialog` restore cadangan menjalankan aksinya hanya setelah "Ya, Pulihkan" Â· `grep alert(` di `src/` = 0.
>
> **Bukti verifikasi terakhir (2026-09-21, batch G9):** `npx tsc -b --force` 0 error Â· `npm run build` âœ“ Â· `npm run lint` 0 error / **82** warning (semuanya di file lain; `src/App.tsx` & `src/utils/neonSync.ts` = 0 warning) Â· `npx tsc -p api/tsconfig.json --noEmit` âœ“ Â· `pilFinalDariCloud` diukur di browser dev lewat 7 kasus (baris cloud baru diterima; baris berkunci alami sama dengan `id` berbeda DITOLAK; duplikat internal cloud hanya 1 yang masuk; baris tanpa `id`/tanpa `kodePosPten` dibuang; kota kembar beda kota tetap dipulihkan) Â· helper cloud diukur dengan endpoint tiruan: 700 baris = 2 GET (500+200, tanpa celah) dan 3 POST (chunk 300, body maks 102 KB utk baris 146 B) Â· handler `api/target.ts` dijalankan terhadap `sql` palsu: GET kosong â†’ `CREATE TABLE final_rows` + `total:0`; GET paging â†’ `returned:500 offset:200 total:700`; POST upsert 701 baris â†’ `written:700` (baris tanpa id dibuang) & **tidak ada** `DELETE`; POST `mode:'replace'` â†’ ada `DELETE` lebih dulu; POST tanpa mode â†’ upsert (aman); DELETE tanpa `key`/`all` â†’ 400 dan nol query destruktif; DELETE `&key=` â†’ 1 baris; DELETE `&all=1` â†’ 705 baris; `view` tak dikenal pada POST/DELETE â†’ 400 tanpa menyentuh `target_records`; jalur lama `GET/DELETE /api/target` (tanpa `view`) tetap meng tabel target.
>

> **Yang belum terukur setelah batch ini:** angka antrean "Perlu Validasi Manual" pada data operator (sebelumnya 84.136 baris). Perbaikan C5/C6 mengubah penyebabnya, tapi jumlah akhirnya hanya bisa dibaca dengan menjalankan ulang Analisa di aplikasi — browser in-app sesi ini diblokir kebijakan, jadi angka itu sengaja TIDAK dikarang.
>
> **Bukti verifikasi batch D1/D5/C5/C6 (2026-09-21):** `npx tsc -b --force` 0 error · `npm run build` sukses · `npm run lint` 0 error / **83 warning** (sama dengan baseline) · mesin diuji **jalan** di Node lewat bundel SSR (`tests/entry-uji.ts` + `tests/uji-mesin-role.mjs`; jalankan `npx vite build --ssr tests/entry-uji.ts --outDir tests/out` lalu `node tests/uji-mesin-role.mjs`): **13/13 assertion lulus** — (i) `isKimBranchAceh` menolak "AR HAKIM" (Medan) dan menerima "KIM BANDA ACEH", `findKimBranch` mengembalikan `null` bila satu-satunya calon adalah AR HAKIM; (ii) hasil `matchRoleForOutlet` **sama persis** dengan kandidat pertama engine layar yang punya record Data Mapping Role, pada 4 kandidat berbeda; (iii) KC yang tidak ada di Data Mapping Role → `organisasiTujuan` kosong + ANOMALI (sebelum batch ini mesin menulis "MAKASSAR BRANCH OFFICE" 3/3/3 — terdeteksi oleh uji ini sendiri); (iv) pulau tak teridentifikasi → 60/PERLU_REVIEW + catatan; (v) 400 panggilan `matchRoleForOutlet` = 4,6 ms.
> Catatan verifikasi: `npm run build` memakai `tsc -b` **inkremental** â€” tanpa `--force` error di file yang tidak diubah bisa terlewat. Selalu verifikasi dengan `npx tsc -b --force`.


**Aturan untuk AI/developer:**
1. Baca tabel status di bawah SEBELUM mengerjakan apa pun.
2. Item berstatus `SELESAI` â†’ **JANGAN dikerjakan ulang**.
3. Item berstatus `SEDANG` â†’ lanjutkan dari catatan yang tercantum.
4. Item berstatus `SKIP (keputusan)` â†’ menunggu keputusan pemilik (lihat Bagian 12); jangan eksekusi.
5. Setelah menyelesaikan satu item: ubah statusnya jadi `SELESAI`, isi tanggal (YYYY-MM-DD) dan catatan singkat (file yang diubah), lalu commit.
6. Nilai status yang valid: `BELUM` / `SEDANG` / `SELESAI` / `SKIP (keputusan)`.

| ID | Status | Tgl selesai | Catatan |
|---|---|---|---|
| A1 | SELESAI | 2026-09-21 | `src/components/Notification/NotificationProvider.tsx` (provider + kartu bertumpuk, portal ke body, auto-dismiss 4d/4d/8d, error manual) + `NotificationContext.ts` (hook `useNotification` â€” difile terpisah supaya `react(only-export-components)` bersih). 19 `alert()` diganti `notify()` di App, AnalystResultsGrid, PTEN/Cabang/KodePos/RoleMapping/Wilayah Manager, IndonesiaBranchMap; `showToast` grid dialirkan ke provider (banner lokal + `setTimeout` tanpa cleanup dihapus). Nol `alert()` tersisa di `src/`. Belum ada error-fatal yang perlu dipertahankan sebagai `alert()` |
| A2 | SELESAI | 2026-09-21 | `SnapshotModal.tsx` â€” `window.confirm` restore diganti `ConfirmDialog` (pesan menyebut tanggal + jumlah baris Master/Target/Match/Wilayah + akibat). Sisanya hanya `TargetDataGrid.tsx:2572` (file mati, tidak di-import siapa pun â†’ tunggu A10). Ikut diperbaiki: `ConfirmDialog` membungkus `message` dengan `<div>` bukan `<p>` (React melapor `div`/`ul` di dalam `p` = HTML invalid) |
| A3 | SELESAI | 2026-09-21 | `src/components/BaseModal.tsx` (`DialogPanel` = perilaku murni tanpa mengubah tampilan, `BaseModal` = + tata letak standar) + `src/components/useDialogBehavior.ts`. 31 dialog dibungkus. Bukti: `grep role="dialog" src` = 0 di luar BaseModal; `grep modal-backdrop` = 0 di luar BaseModal; `grep "Escape" src` = 0 handler lokal tersisa. Dialog persetujuan (`ConfirmDialog`) tidak lagi tertutup klik-luar |
| A4 | SELESAI | 2026-09-21 | `analystPipeline.ts`: kelas `AnalisaDibatalkan` + param `pembatal?: { batal: boolean }` yang dicek di `tick()` (dipakai loop kota & loop baris) dan sekali sebelum return akhir. `App.tsx`: `pembatalAnalisaRef` + `handleBatalkanAnalisa` + `isCancelling`; catch khusus â†’ progress 0, pesan "hasil tidak disimpan", notifikasi `info`. `AnalystCanvas.tsx`: tombol "Batalkan" hanya tampil saat `isAnalyzing` ("Membatalkan..." saat flag naik). Terukur di browser: `batal:true` â†’ melempar `AnalisaDibatalkan`; `batal:false` â†’ run selesai (1 baris). Tidak ada hasil setengah jadi karena `setAnalystRows` hanya dipanggil setelah pipeline kembali |
| A5 | SELESAI | 2026-09-21 | Topbar.tsx â€” status koneksi + tombol Database + tombol Simpan (flushPendingWrites). Build & lint terverifikasi 2026-09-21 |
| A6 | SELESAI | 2026-09-21 | `src/utils/useTampilanTersimpan.ts` (useState + sessionStorage). Dipakai untuk 9 state tampilan grid Data Analyst (subTab, wilayah, cari, status, innerTab, sortKolom, sortDir, page, pageSize) + 3 di Data Final (cari, wilayah, page). **Diuji nyata di browser dev:** ketik "KCP" â†’ pindah ke Dashboard â†’ kembali â†’ isi input masih "KCP", 9 kunci `tampilan.analyst.*` ada di sessionStorage. Pilihan kandidat (fase2Choice/fase3RoleChoice) sengaja tidak disimpan: kuncinya `id` baris yang berubah tiap run |
| A7 | SELESAI | 2026-09-21 | `phaseApproval` (App.tsx) menambah `sisa` per fase; `AnalystCanvas` menampilkan tombol "N baris belum disetujui" di samping tombol utama saat terkunci; klik â†’ grid membuka sub-tab fase itu + menyaring HANYA baris yang belum disetujui (menembus antrean fase, jadi angkanya sama dengan penandanya) dan menampilkan tombol "tampilkan semua" untuk melepas. Build/tipe hijau; tombolnya belum diklik pada data produksi karena butuh hasil analisa milik operator |
| A8 | SELESAI | 2026-09-21 | Windowing dinonaktifkan pada tab Fase 2 & Fase 3 (`minRowsToWindow: Infinity`) â€” di tab itu barisnya kartu kandidat tinggi tak seragam sehingga pengukuran tinggi dari baris pertama bikin scroll melompat. Tabel datar (Fase 1/ringkasan) tetap di-window |
| A9 | SEDANG | â€” | Sisa yang BELUM: breakpoint 1280/1024/768 untuk sidebar & tabel (butuh cek visual per lebar layar, jangan dikarang). Dua file CSS mati (`src/App.css`, `src/index.css`) sudah dipastikan TIDAK diimpor (hanya `src/styles/index.css` yang dimuat `main.tsx:3`) â€” penghapusannya dibloker kebijakan agen, butuh konfirmasi operator; lihat juga A10 |
| A10 | BELUM | â€” | Ditunda sesuai aturannya sendiri ("hapus/arsip setelah F1â€“F4 selesai") â€” F1â€“F4 belum selesai. Daftar kandidat mati tetap sama: `TargetDataGrid.tsx`, `MasterUploadModal.tsx`, `MasterDataGrid.tsx`, `ProximityGuideModal.tsx`, `MasterUpload.tsx`, `FilterToolbar.tsx`, `Navbar.tsx`, `ProgressBar.tsx`, `App.css`, `index.css`, fungsi `matcher.ts` |
| B1 | SELESAI | 2026-09-21 | Opsi (b): penggabungan tetap ada tapi tidak diam-diam. `coverage.mergedCities` (kota+kabupaten+jumlah baris) dipakai di pesan akhir Fase 1 dan blok baru "N nama kota kembar digabung" di laporan cakupan. **Terukur pada data nasional: 26 grup** dari 514 nama kota (BOGOR, BANDUNG, SEMARANG, â€¦). `jenisDaerahDariNama()` diekspor untuk pengujian |
| B2 | SELESAI | 2026-09-21 | Opsi (a): field baru `AnalystRow.kodePosKelurahan` (kode pos baris KodePos-nya sendiri). Kolom "Kode Pos" pindah ke grup DATA POS di tab Fase 1 + bisa disortir + ikut pencarian; grup PTEN diganti label "Kode Pos PTEN"; baris `TIDAK_ANALISA` menampilkan "â€”" di kolom PTEN karena tidak punya kode pos PTEN. Ikut di ekspor Excel (2 sheet), PDF, modal Edit, tabel & modal Detail Data Final. `targetFromAnalystRow` (suara mesin Fase 2) SENGAJA masih pakai `kodePosPten` â€” berubahnya itu bagian C2d |
| B3 | SELESAI | 2026-09-22 | **Diverifikasi, tidak ada yang perlu diubah.** `handleExportExcel` (`AnalystResultsGrid.tsx:754`) sudah menomori ulang di DUA tempat: tiap sheet wilayah memakai `'No': idx + 1` atas grup itu sendiri (`:775-776`) dan sheet "Summary All" memakai `'No': idx + 1` atas seluruh hasil (`:811-812`), dan keduanya menyaring `kategori !== 'TIDAK_ANALISA'` lebih dulu (`:760`, `:811`) — jadi nomor ekspor selalu 1..n tanpa baris yang tidak dianalisa. Konsekuensi yang memang benar: nomor di file TIDAK sama dengan kolom `No` di layar, karena layar menomori baris sesuai filter/pencarian/halaman yang aktif (`displayIdx`, `:1651`) sedangkan ekspor menomori per sheet tanpa filter |
| B4 | SELESAI | 2026-09-21 | Opsi (a): semua karangan di `analystPipeline.ts` dihapus (dua tambahan ketahuan oleh pengukuran, bukan pembacaan kode: `namaOutlet` fallback `BNI KCP <kota>` :1625 dan label `Wilayah <kota>` dari `formatWilayahName(finalKotaPten)` :1620) â€” fallback kota "KOTA JAKARTA PUSAT" & kode pos "10110" jadi kosong, label "Wilayah 01" jadi kosong, dan baris penanda "kota PTEN tanpa cabang di master" tidak lagi mengarang W-code (tabel modulo) / `CABANG x` / `KCP x` / `Jl. Protokol x` / `Status Outlet: Aktif`. Sisa karangan di mesin role dicatat sebagai bagian D2 |
| B5 | SELESAI | 2026-09-21 | **Bug nyata dari screenshot operator**: kelurahan `Baburino / Maba / Kabupaten Halmahera Timur` (kode pos 97860) tidak pernah ketemu PTEN `HALMAHERA TIMUR` (97862/97863) dan dilebeli "nama kota ini tidak ada di daftar PTEN". Dua akar, keduanya di `analystPipeline.ts`: (1) `findMasterByCity` fuzzy (ambang 0,88) meloloskan cabang **HALMAHERA UTARA** untuk kota TIMUR — skor **0,9313**, karena beda cuma kata arah di ujung; (2) driver Fase 1 memakai baris master itu sebagai perwakilan kota lalu membaca `cityRaw` dari **`Dati II` cabang** (`:1541`), jadi nama kota PTEN ditimpa oleh kota tetangga dan kelurahan aslinya tidak pernah di-resolve. Tambalan: penjaga `hasDirectionalConflict` sebelum menerima kandidat fuzzy, dan item per-kota kini membawa `Dati II` = `kotaPten` PTEN-nya sendiri (field cabang tetap dipakai untuk Fase 2/3). **Terukur**: `tests/uji-kota-pten.mjs` 12/12 — Baburino kembali `DIANALISA` dengan `kotaPten=HALMAHERA TIMUR`, tidak ada lagi baris ganda atas nama UTARA, dan kontrol positif (cabang yang memang sekota) tetap terpakai. Kasus `KEPULAUAN TALAUD` sudah aman di level kunci kota (`cityMatchKey` menormalkan `Kabupaten`/`Kepulauan`) |
| C2a | SELESAI | 2026-09-21 | Fase 2 otomatis kini memakai MESIN KANDIDAT YANG SAMA dengan layar review (`findClosestMasterRecommendation`), dipanggil PER KELURAHAN, lalu Rank-1 ditulis ke field Fase 2 baris itu. Diukur pada data produksi nyata (6 kota besar, 985 baris): **892 dari 985 baris (90,6%) kini mendapat outlet yang BERBEDA** dari "cabang pertama kota" (perilaku lama); rata-rata 28,8 outlet unik per kota, dulu selalu 1 |
| C2b | SELESAI | 2026-09-21 | Di `recommender.ts`: setelah sort skor, kandidat dalam pita skor ≤5 poin diukur JARAK NYATA-nya (maks 6), lalu bila pemimpin bukan KC dan ada KC yang tidak lebih dari 2 km lebih jauh → KC diangkat ke Rank 1. Dikerjakan POST-sort (bukan lewat comparator) supaya urutannya deterministik. Terbukti di kasus Bandung: Lebak Siliwangi → KC "PERGURUAN TINGGI BANDUNG" menang atas KCP "GANESHA" pada jarak seri 0,8 km |
| C2c | SELESAI | 2026-09-21 | `adalahKcFase2(m)` = kolom **Status Outlet** master, `trim().toUpperCase() === 'KC'`. Mapping Role tidak dipakai untuk menentukan KC di Fase 2. Pada data produksi nyata kolom ini berisi `KC` / `KCP` / `KCP d/h KK` sehingga perbandingan persis itu benar |
| C2d | SELESAI | 2026-09-21 | Pipeline: Rank-1 per kelurahan (cache kunci `kota|kodePos|kelurahan|kecamatan`). Grid: `fase2Recs` tidak lagi dikunci `cityMatchKey(groupKota)` tapi per baris dan hanya untuk baris yang tampil (dulu memaksa menghitung semua 83rb baris lewat satu kunci kota), cache memakai kunci alami baris. `fase2ValidCities` dihapus |
| C2e | SELESAI | 2026-09-21 | Urutan kandidat memakai `calculateRealDistance().distanceKm`; proxy `postalDiff*2+4000` tetap dihitung `evaluateMasterCandidate` tapi tidak lagi menentukan siapa Rank 1. `findCityCoord` di-cache per nama kota (2,8 ms → 0,2 ms per panggilan) supaya pengukuran jarak nyata terjangkau |
| C3 | SELESAI | 2026-09-21 | Gerbang baru = field baris `fase2Tier` + `fase2JarakKm` + `fase2Temuan[]`: (a) kandidat luar kota/provinsi, (b) jarak > 16 km, (c) tidak ada KC di kota itu tapi KCP terpilih, (d) kota tidak punya cabang di master. Grid `butuhManual(stage 2)` membaca `fase2Temuan`, kartu Fase 2 menampilkan alasannya, dan `isFinalApproved` otomatis menolak baris bertemuan. Audit lama `match_top1/2/3` tidak lagi jadi gerbang (alasan: ia membandingkan nilai lama dengan kandidat per-kota) |
| C4 | SELESAI | 2026-09-21 | Dijalankan nyata di browser dev dengan 43 cabang asli Kota Bandung dari produksi: Braga (40111, Sumur Bandung) → **JL. BRAGA D/H CIKAPUNDUNG** 0,8 km; Lebak Siliwangi (40132, Coblong) → **PERGURUAN TINGGI BANDUNG** (KC) 0,8 km; Cijaura (40262, Coblong) → PT BANDUNG 3,6 km. **Tiga baris wajib BEDA: terpenuhi.** KOREKSI kasus uji: harapan lama "Lebak Siliwangi → Dago ±1,4 km" tidak berlaku pada data sekarang karena master punya 2 cabang di kelurahan Lebak Siliwangi sendiri (PT BANDUNG KC + GANESHA), jadi Dago (Tamansari) bukan yang terdekat |
| C5 | SELESAI | 2026-09-21 | **Bug nyata dari screenshot operator**: baris ACEH BARAT dilayani cabang "AR HAKIM" (Medan, Branch 60100664) dengan alasan "Khusus Provinsi Aceh otomatis dilayani Cabang KIM". Penyebab: `findKimBranch` punya loop fallback `combined.includes('KIM')` (dan `buildMasterProximityIndex:137` `\|\| includes('KIM')`) sehingga **HAKIM tertangkap sebagai KIM** lewat substring. Sekarang satu penjaga `isKimBranchAceh(m)`: kata utuh `\bKIM\b` **dan** barisnya benar-benar di Aceh (Provinsi/Dati II/ALAMAT memuat "ACEH"). Tanpa cabang KIM sah → `null` → aturan Aceh tidak menyala dan kandidat dipilih mesin jarak biasa dengan alasan yang sebenarnya. Teruji 4 kasus di Node (`tests/uji-mesin-role.mjs`) |
| C6 | SELESAI | 2026-09-21 | Gerbang manual C3 (b) "jarak > 16 km" ternyata membanjiri antrean: pada data operator **84.136 baris** masuk "Perlu Validasi Manual", dan contoh di layar berjarak ~42 km padahal 40 km dari cabang terdekat itu wajar di kabupaten luas. Jarak bukan cacat, jadi tidak lagi jadi penanda: `JARAK_MANUAL_KM = 16` → `JARAK_MUSTAHIL_KM = 150` dan hanya untuk **tier 1** (satu kota) â†' penanda itu sekarang berarti "koordinat perlu diperiksa". Tier 2/3 tetap tertanda oleh penandanya sendiri, jadi tidak ada kasus yang diam-diam lolos; angka km tetap tampil di kartu & kolom `fase2JarakKm` |
| C7 | SELESAI | 2026-09-22 | **Selisih 83.764 vs 83.762 diukur sampai akar** (`GET` hanya-baca ke production): cloud konsisten 83.762 di stats, baseline-diff (`missingCodesTotal: 0`) dan export (83.762 baris, 83.762 `id` unik â†’ JOIN `kodepos_geo` TIDAK menggandakan). Jadi +2 bukan dari server, satu-satunya tempat yang mungkin ialah salinan IndexedDB browser operator (`kodepos_master_data`). Temuan nyata yang berdekatan: **15 pasangan baris kembar persis** (kode pos\|kelurahan\|kecamatan\|kabupaten sama, `id` beda) â†’ kunci unik 83.747, dan karena `makeFinalKey` memakai 4 kolom itu, "jumlah baris" vs "jumlah kelurahan unik" memang selalu beda 15. Daftar lengkap + perintah pembersihan ada di Bagian C7; penghapusan TIDAK dijalankan (write ke produksi, menunggu keputusan pemilik) |
| D1 | SELESAI | 2026-09-21 | Keputusan Bagian 12 (a) dieksekusi: **engine layar = mesin resmi Fase 3**. `matchRoleForOutlet` ditulis ulang jadi adaptor di atas `findTopRoleMatchesByLocation` (analyzer lama `calculateUnifiedPrecisionScore` + fallback keyword kota 0,85 + `preCleanedRoles`/`completeRoleList`/`roleMatchCache` pipeline **dihapus**), jadi kelas temuan "otomatis bilang AMBON, layar bilang JAYAPURA" hilang permanen. `roleRecommender` kini mengekspor `RoleMatchScored` (`nameMatchScore`, `isFullRole`, `synthetic`, `islandUnknown`) supaya keyakinan disusun dari bukti, bukan tebakan: KC sendiri â†' 100, cabang induk KC â†' 95, nama/alias persis â†' 95, kemiripan tinggi â†' 90, nama induk â†' 82, token terkandung â†' 75, **jarak semata â†' 60 + catatan sinyal 11**. D2 tetap hidup: kandidat `synthetic` (usulan struktur yang tidak ada di Data Mapping Role) **tidak ditulis otomatis** â†' kosong + ANOMALI dengan alasan menyebut cabang yang disarankan. Terukur di Node (`tests/uji-mesin-role.mjs`): 13/13 assertions lulus, hasil otomatis == kandidat engine layar ber-record nyata pada 4 kandidat, 400 panggilan 4,6 ms |
| D2 | SELESAI | 2026-09-21 | Opsi "kosongkan + lempar manual": fallback `completeRoles[0]` / `completeRoleList[0]` (skor 0,70) dihapus di kedua mesin (`matchRoleForOutlet` :916 dan jalur pipeline :1682). Tanpa kecocokan nyata sekarang menghasilkan `organisasiTujuan` kosong, `tipeUnit: OUTLET` (bukan KC karangan), role 0/0/0 (`is3RoleLengkap` false), `alurWondr`/`flowDescription` kosong, status ANOMALI â†’ masuk antrean review. Varian "kandidat terdekat satu pulau" TIDAK dibuat â€” butuh mesin jarak baru |
| D3 | SELESAI | 2026-09-21 | `isFinalApproved` otomatis sekarang butuh `statusAnalisa===EXACT_MATCH` **dan** `placementStatus===VERIFIED` **dan** `!usedFallback` (`analystPipeline.ts` blok hasil) |
| D4 | SELESAI | 2026-09-21 | `analystPipeline.ts` `alurWondr` kini memakai `wondr?.tier` (kosakata sama dengan `getWondrRecommendation`, tidak ada lagi label generik Tier 1/Tier 2) |
| D5 | SELESAI | 2026-09-21 | `roleRecommender.ts`: `sameIsland` tidak lagi bernilai `true` saat salah satu pulau `"Lainnya"`. Ditambah flag `islandUnknown` — kandidat tetap dinilai (tidak dibuang, karena datanya memang tidak lengkap) tapi adaptor Fase 3 memotong keyakinannya ke 60 = `PERLU_REVIEW` + catatan sinyal 11 "pulau tidak dikenali — tidak dianggap satu pulau". Teruji: KCP tanpa provinsi/ Dati II dengan record "JAKARTA BRANCH OFFICE" â†' 60/PERLU_REVIEW, bukan 95/EXACT_MATCH |
| D6 | SELESAI | 2026-09-21 | Opsi (b): `applyFase3Role` (pilihan manual operator) tidak lagi menulis `EXACT_MATCH` â€” sekarang `HIGH_CONFIDENCE`, jadi akurasi mesin tidak naik oleh keputusan manusia dan barisnya tidak lolos ke Final tanpa diperiksa |
| E1 | SELESAI | 2026-09-21 | Dikerjakan lewat M5: Fase 2 kini dinilai `calculateCityMatchScore` (ensemble yang sama dengan Fase 1) dan buktinya disimpan di `sinyalF2Bit` + ikut `bitTemuanBaris`, jadi tidak ada lagi fase yang tampil memakai 12 sinyal padahal tidak. Teruji di `tests/uji-fase2-status.mjs` |
| E2 | SELESAI | 2026-09-21 | Label kartu "12 Sinyal" di `AnalystCanvas.tsx` kini menyebut cakupan sebenarnya: Fase 1 &amp; 2 memakai ensemble sinyal nama kota, Fase 3 memakai mesin nama+jarak+KC satu pulau (bukan ensemble), dan angka akurasinya diganti ke hasil ukur baru |
| E3 | SELESAI | 2026-09-22 | **Satu aturan untuk penanda tipe unit, dipakai semua jalur.** Sebelumnya tiga normalizer berebut arti yang sama: `THESAURUS_MAP` sinyal-1 MENGEMBANGKAN `KCP`→`KANTOR CABANG PEMBANTU`, `roleMatcher.normalizeBranchName` justru MENGHAPUS penanda itu, dan `stripAdminNoise` menghapus `KC` sebagai kependekan kecamatan — jadi pasangan nama yang sama bisa dinilai berbeda tergantung mesinnya. Sekarang: satu daftar `UNIT_NOISE_TOKENS`/`UNIT_NOISE_SET` di `normalizer.ts`; `expertNormalize` membuangnya (tidak lagi mengembangkan); regex penghapusan `normalizeBranchName` dibangun dari daftar yang sama (`UNIT_NOISE_RE`); entri `KC/KCB/KCP/KK/BO/SBO` dihapus dari `THESAURUS_MAP`; bukti sinyal 2 ikut menyebut "penanda tipe unit" (`pesanTokenDibuang`), dan kartu teks sinyal 1/2/12 diperbaiki supaya tidak lagi menjanjikan kepanjangan unit. **Terukur pada 72 pasangan berlabel: akurasi NAIK 88,9% (64/72) → 90,3% (65/72)**; yang hilang adalah salah gabung `KCP 001 ⟷ KCP 002` (98% → di bawah ambang), sisanya tetap 5 salah gabung + 2 terlewat yang sudah didaftarkan. Ikut diperbaiki: `tests/uji-akurasi-nama.mjs` **tidak pernah punya gerbang hasil** (selalu `exit 0`, jadi "LULUS" sebelumnya tidak berarti) — kini ada 5 asersi + `process.exit`, termasuk guard regresi E3. ⚠️ **Bentrok sesi lain (dicatat 2026-09-22, TIDAK dibatalkan sepihak):** sesudah E3 terpasang dan KELIMA suite LULUS, sesi Cline mengubah `analystPipeline.ts` di luar E3 — `fase2Status` tidak lagi menghitung `temuanFase2.length > 0` (`:2065`) dan `wilayah` ikut mengambil `m.Wilayah` saat Branch Code tidak terbaca (`:1920`). Efek terukur: `uji-fase2-status.mjs` M7.4 (Singkawang) dan `uji-kota-pten.mjs` ("tapi statusnya tetap perlu manual") jadi GAGAL — baris yang dilayani cabang dari kota/provinsi lain kembali `OTOMATIS_VALID`, antrean manual Fase 2 0 dari 4. Itu mematikan gerbang C3/M1 yang sudah `SELESAI` dan membuat auto-final menerima penempatan lintas provinsi (isFinalApproved menuntut `OTOMATIS_VALID`). Bukan efek E3: E3 tidak menyentuh `fase2Status`. **Sudah di-push ke `main` atas permintaan pemilik produk (`516fbad`) dan tidak dibatalkan.** Cara mengembalikannya kalau nanti diputuskan: satu token di dua tempat — `|| temuanFase2.length > 0` di `analystPipeline.ts:2065` dan `: (r.fase2Temuan?.length || 0) > 0` di `AnalystResultsGrid.tsx:500` (`butuhManual` stage 2) — lalu jalankan ulang kedua suite. |
| E4 | SELESAI | 2026-09-21 | `hanyaBuktiFonetik(bit)` (analisPipeline) menguji apakah satu-satunya bukti kemiripan adalah transkripsi bunyi; `isFinalApproved` sekarang menolaknya. Fonetik tetap boleh MENAWARKAN pasangan (skor tinggi), hanya tidak lagi lolos ke Final tanpa mata manusia |
| E5 | SELESAI | 2026-09-21 | Didokumentasikan (bukan disamaratakan, karena tiap ambang memang mengurusi hal berbeda) — lihat kotak "AMBANG RESMI" di bawah Bagian E |
| E6 | SELESAI | 2026-09-21 | Satu sumber definisi pulau: `roleMatcher.getIslandFromProvinsi`. Salinan di `roleRecommender.ts` dihapus (sekarang import), dan `getIslandFromProvince` di `analystPipeline.ts` (nilai "JAWA"/"INDONESIA", tidak pernah dipanggil) ikut dihapus. `finalAnomaly.ts` dialihkan ke sumber yang sama |
| E7 | SELESAI | 2026-09-22 | Modal sinyal tidak lagi menampilkan satu daftar gabungan. `SinyalTemuanModal.tsx` membaca ketiga field terpisah di baris (`sinyalBit` / `sinyalF2Bit` / `sinyalRoleBit`) lewat tabel `FASE_BUKTI`: (a) chip "Bukti dari fase: F1 n · F2 n · F3 n" di bawah penjelasan sinyal, (b) kolom terakhir berganti dari "Sinyal lain yang membantu" jadi **"Bukti per fase"** yang berisi `F1: ... · F3: ...` per baris (fase yang tidak menyumbang bukti tidak ditampilkan, dan kalau satu fase hanya menangkap sinyal ini tertulis "sinyal ini saja"). Penyaringan baris tetap memakai `bitTemuanBaris` (union) supaya tidak ada temuan yang hilang. `bitTemuanBaris`/mesin tidak diubah - hanya tampilan memisahkan yang memang tersimpan terpisah. ✅ `tsc` 0 error · lint 83 warning (baseline) · build ✓; belum discreenshot pada data nyata |
| E8 | SELESAI | 2026-09-21 | Himpunan berlabel dinaikkan 27 â†' **72 pasangan** (33 harus cocok, 39 harus beda, tanpa pasangan identik) di `tests/uji-akurasi-nama.mjs` yang memanggil mesin asli. **Terukur: 88,9% (64/72)** vs Levenshtein saja 77,8%; 6 pasangan masih salah gabung (semuanya bukan nama kota: `KCP 001/002`, `MALANG/MALANG KECAMATAN`, `ALAM SUTRA/ALAM SUTRA UTARA`, `JL MELAWAI/JL MELAWAI RAYA`, `SUMATERA UTARA/SUMATERA UTARA BARAT`, `SRI SAWALJO/SRI SAWARJO`) dan 2 ejaan Belanda lama belum tembus (`TJUNG PANDANG/UJUNG PANDANG`, `TJINIAN/CIANJUR`). Temuan ini juga menambal token `PROV/PROVINSI` yang belum dibuang (87,5% â†’ 88,9%). Klaim lama "96,3% pada 27 pasangan" ditarik dari UI |
| W1 | SELESAI | 2026-09-21 | Opsi "peringatan": baris Fase 2 yang Branch Code-nya tidak menghasilkan wilayah (mis. `JKT-THM-01`) kini membawa `fase2Temuan` "wilayah tidak terbaca dari Branch Code …" → muncul di antrean manual + kartu Fase 2. Terukur: 1 baris pengujian dengan kode alfanumerik tertandai, baris berkode numerik bersih |
| F1-W2 | BELUM | â€” | |
| W3 | SELESAI | 2026-09-21 | `WilayahManager.handleSaveToDatabase` sudah melapor (batch A1). Untuk PTEN & Mapping Role, pemanggilan `save*ToNeon(...).catch(() => undefined)` yang membungkam kegagalan kini melapor "tersimpan di browser, GAGAL dikirim ke cloud" (warning) |
| P1 | SELESAI | 2026-09-21 | Impor PTEN tidak lagi mengganti seluruh pustaka: kunci `kode pos + nama kota`, laporan 3 bucket (baru / sudah ada / duplikat di dalam berkas), dan data lama tetap utuh — mengosongkan tetap lewat tombol Reset |
| F2-P2 | BELUM | â€” | |
| F2-P3 | BELUM | â€” | |
| F3-C1 | SELESAI | 2026-09-21 | App.tsx handleMasterLoaded: mode 'update' = replace langsung; CabangManager kirim 'update' utk edit/hapus; impor Excel tetap 'replace' (merge+dedup). Build & lint terverifikasi 2026-09-21 |
| F3-C2 | SELESAI | 2026-09-21 | Sama seperti F3-C1 |
| F3-C3 | BELUM | â€” | |
| R1 | SELESAI | 2026-09-21 | Sama seperti P1 dengan kunci `organisasiTujuan` (RoleMappingManager) |
| F4-R2 | BELUM | â€” | |
| F4-R3 | BELUM | â€” | |
| F5-K1 | BELUM | â€” | |
| F5-K2 | BELUM | â€” | |
| F5-K3 | BELUM | â€” | |
| F6-X1 | BELUM | â€” | |
| F6-X2 | BELUM | â€” | |
| F6-X3 | BELUM | â€” | |
| F6-X4 | SELESAI | 2026-09-21 | = A5 (Topbar status koneksi + tombol Database + Simpan). Build & lint terverifikasi 2026-09-21 |
| X5 | SELESAI | 2026-09-21 | `WilayahManager` tidak lagi mengirim 17 wilayah bawaan ke cloud saat cloud kosong — datanya hanya dipakai di layar dan operator diberi tahu cara mengirimnya (tombol "Simpan ke Database"). PTEN tidak punya auto-push (hanya baca); kiriman default Mapping Role tetap ada karena terjadi lewat tombol Reset yang dikonfirmasi |
| G1 | SELESAI | 2026-09-21 | `FinalDataManager.tsx`: tombol "Unggah Excel" + parser `parseFinalExcelRow` + modal ringkasan impor. `App.tsx`: `handleImportFinalToAnalyst` menduplikasi dan memvalidasi terhadap `finalRows` dan `analystRows` menggunakan `makeFinalKey` (kombinasi 4 komponen). Baris baru masuk antrean Data Analyst untuk divalidasi |
| G2 | SELESAI | 2026-09-21 | `makeFinalKey` dilebarkan â†’ `kodePos\|kelurahan\|kecamatan\|kota`; 4 titik pemakai ikut (`App.tsx` exclude + merge persetujuan, `analystPipeline.ts` skip). Migrasi IndexedDB tidak diperlukan (kunci dihitung dari field, tidak disimpan). Lihat catatan di Bagian G2 |
| G3 | SELESAI | 2026-09-21 | `analystPipeline.ts`: `skippedFinalRows` & `skippedFinalSamples` di `AnalystCoverage` mencatat baris yang dilewati karena kuncinya sudah ada di Final Data. `AnalystResultsGrid.tsx`: banner/laporan cakupan menampilkan jumlah baris dan rincian sampel kelurahan yang dilewati karena analisis inkremental |
| G4 | SELESAI | 2026-09-21 | FinalDataManager â€” modal Detail per baris (role dialog + Esc). Build & lint terverifikasi 2026-09-21 |
| G5 | SELESAI | 2026-09-21 | FinalDataManager â€” aksi Hapus permanen + App.tsx handleDeleteFinalRow. Build & lint terverifikasi 2026-09-21 |
| G6 | SELESAI | 2026-09-21 | FinalDataManager â€” returnAll & revisi pakai ConfirmDialog. Build & lint terverifikasi 2026-09-21 |
| G7 | SELESAI | 2026-09-21 | Opsi (a): `handleReturnFinalToAnalyst` (App.tsx) kini me-reset `fase1/2/3Approved` + `isFinalApproved` untuk baris yang datang dari Final â€” sama seperti Revisi per baris, jadi kembali ke Fase 1. Baris yang sejak awal ada di antrean Analyst tidak ikut kehilangan persetujuannya |
| G8 | SELESAI | 2026-09-21 | Opsi (a): baris PERLU_REVIEW/ANOMALI tetap ikut dipindahkan, tapi `ConfirmDialog` "Pindahkan ke Final Analisa?" menyebut jumlahnya (pemisah `perluReview`/`anomali` ditambahkan ke `stats` di AnalystResultsGrid) |
| G9 | SELESAI | 2026-09-21 | Tabel per-baris `final_rows` + `?view=final` pada `api/target.ts` yang sudah ada (BUKAN file `api/` baru). `neonSync.ts`: `loadFinalFromNeon/saveFinalToNeon/deleteFinalRowInNeon/clearFinalInNeon`; `analystPipeline.ts`: `pilFinalDariCloud`; `App.tsx`: merge non-destruktif di boot + push di 4 titik mutasi Final; `api/status.ts` + modal Database menampilkan jumlah `final_rows`. Bukti verifikasi di Bagian G9 |
| G10 | SELESAI | 2026-09-21 | FinalDataManager â€” card metrik (total/KC/KCP/role lengkap/wilayah). Build & lint terverifikasi 2026-09-21 |
| G11 | BELUM | â€” | |
| G12 | BELUM | â€” | Panduan, bukan tugas terpisah |

## 1. Peta file & penyimpanan

| Area | File utama |
|---|---|
| State global & boot | `src/App.tsx` |
| Mesin analisa 3 fase | `src/utils/analystPipeline.ts` |
| Engine kandidat Fase 2 | `src/utils/recommender.ts` |
| Estimasi jarak | `src/utils/geoDistance.ts` |
| Engine role Fase 3 | `src/utils/roleRecommender.ts`, `src/utils/roleMatcher.ts` |
| Normalisasi | `src/utils/normalizer.ts` |
| Grid Data Analyst | `src/components/WorkingEngine/AnalystResultsGrid.tsx` |
| Kartu fase | `src/components/WorkingEngine/AnalystCanvas.tsx` |
| Data Final | `src/components/WorkingEngine/FinalDataManager.tsx` + handler `App.tsx:741â€“796` |
| 5 menu Master | `WilayahManager.tsx`, `PTENManager.tsx`, `CabangManager.tsx`, `RoleMappingManager.tsx`, `KodePosManager.tsx` |
| Cloud API | `api/pten.ts`, `api/wilayah.ts`, `api/rolemapping.ts`, `api/master.ts`, `api/target.ts`, `api/kodepos.ts`, `api/status.ts` |

**Model penyimpanan:**

| Menu | IndexedDB | Cloud | Semantik tulis |
|---|---|---|---|
| Wilayah | `wilayah_settings` | `app_store.wilayah_data` (JSONB) | replace-all |
| PTEN | `pten_master_data` | `app_store.pten_data` (JSONB) | replace-all |
| Cabang | `master_data` (App) | `master_records` + `master_meta` | replace/append |
| Mapping Role | `role_mapping_data` | `app_store.rolemapping_data` (JSONB) | replace-all |
| KodePos | `kodepos_master_data` (cache) | `kodepos_data` per-baris | per-id + batch |
| **Data Final** | `analyst_final_data` | `final_rows` (per baris, via `/api/target?view=final`) | upsert per-baris + hapus per kunci |

## 2. Prioritas ringkas

| Prio | Item | ID |
|---|---|---|
| P0 | Edit/Hapus Data Cabang tidak tersimpan | F3-C1, F3-C2 |
| P0 | `window.confirm` â†’ ConfirmDialog | A2, G6 |
| P0 | Notifikasi seragam (hapus `alert()`) | A1 |
| P0 | Modal aksesibilitas (BaseModal) | A3 |
| P0 | Tombol Batalkan analisa | A4 |
| P0 | Data Final tidak sinkron ke cloud | G9 |
| P1 | Fase 2: Rank-1, KC â‰¤2 km, per kelurahan, Tier-2 terdekat | C2 |
| P1 | Impor tanpa dedup; Branch Codeâ†’Wilayah | F2-P1, F4-R1, F1-W1 |
| P1 | Data Final: Upload, Detail, Hapus, kunci matching | G1, G4, G5, G2 |
| P2 | Dead code, CSS mati, konsistensi 12 sinyal | A10, E1â€“E8 |

## BAGIAN A â€” UI GLOBAL

### A1 â€” Notifikasi seragam
**Masalah:** 3 pola campur: `alert()` browser (â‰¥21 titik), toast lokal hanya di `AnalystResultsGrid.tsx:343` (4 detik, tanpa `error`), banner inline per modul.
**Lokasi `alert()`:** `App.tsx:642`; `AnalystResultsGrid.tsx:667,676`; `PTENManager.tsx:236,292,302,385`; `KodePosManager.tsx:412,416`; `CabangManager.tsx:309`; `RoleMappingManager.tsx:509,544,554,656`; `WilayahManager.tsx:293,366,392`; `IndonesiaBranchMap.tsx:1305,1710`.
**Eksekusi:** (1) buat `src/components/Notification/NotificationProvider.tsx` + hook `useNotification` â€” portal ke body, kartu bertumpuk, type `success|info|warning|error`, auto-dismiss success/info 4 d, warning 8 d, error tidak auto + tombol tutup; (2) ganti semua `alert()` di daftar atas dengan `add(...)`; (3) arahkan `showToast` lama ke provider global (hapus `setTimeout` tanpa cleanup).

### A2 â€” Konfirmasi destruktif seragam
**Masalah:** aksi berisiko masih `window.confirm` native; `ConfirmDialog` sudah ada tapi belum dipakai semua.
**Lokasi:** `FinalDataManager.tsx:104,213`; `AnalystResultsGrid.tsx:1889`; `SnapshotModal.tsx:143`; `TargetDataGrid.tsx:2572` (file mati).
**Eksekusi:** semua aksi destruktif â†’ `ConfirmDialog` dengan pesan yang menyebut jumlah baris + akibat (contoh: â€œ1.240 baris akan keluar dari Final Data dan kembali ke Data Analystâ€). Aksi hanya jalan di `onConfirm`.

### A3 â€” Modal aksesibilitas (BaseModal) âœ… SELESAI 2026-09-21
**Masalah:** `role="dialog"`/`aria-modal`/Escape hanya di 4 file (`GoogleApiKeyModal`, `KodePosManager`, `KodePosSyncModal`, `SinyalTemuanModal`). `ConfirmDialog` belum punya role/Escape. Klik-luar hanya `SinyalTemuanModal.tsx:52` & `ConfirmDialog.tsx:45`. Tidak ada focus trap/pengembalian fokus.
**Catatan eksekusi:** yang dibuat ternyata DUA lapis â€” `DialogPanel` (hanya perilaku: portal, role, Esc, fokus, Tab-trap, klik-luar) dipakai dialog yang markup-nya sudah jadi supaya tampilannya TIDAK berubah sama sekali, dan `BaseModal` (`DialogPanel` + header/body/footer `.modal-*`) untuk dialog baru. Nama dialog diambil otomatis dari `.modal-title`/`<h1..h6>` pertama di dalam panel (`aria-labelledby` dipasang sendiri), jadi tidak perlu menulis label dua kali.

**Eksekusi:** (1) buat `src/components/BaseModal.tsx` â€” portal, overlay, `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape, klik-luar opsional (`closableOnOutside`), fokus ke elemen pertama + kembali ke pemicu saat tutup; (2) bungkus semua modal: `ConfirmDialog`, `SnapshotModal`, `NeonDatabaseModal`, `TargetUploadModal`, `AnalystRowEditModal`, `CandidateDetailModal`, `CityOverrideModal`, `PtenCityPicker`, modal edit/detail/delete/reset di PTEN/Cabang/Wilayah/RoleMapping/KodePos. Dialog persetujuan data: `closableOnOutside=false`.

### A4 â€” Tombol Batalkan analisa
**Masalah:** saat `isAnalyzing` hanya tombol dinonaktifkan (`AnalystResultsGrid.tsx:1630`, tombol utama `AnalystCanvas`); 46â€“83 ribu baris tak bisa distop.
**Eksekusi:** state `isCancelling` + flag/`AbortSignal` yang dicek tiap iterasi pipeline (loop `analystPipeline.ts:1426+`, `1830+`); tombol â€œBatalâ€ aktif saat berjalan; saat batal â†’ notifikasi â€œhasil dibatalkan tidak disimpanâ€, state kembali ke kondisi sebelum run.

### A5 â€” Topbar: status koneksi & pending write
**Masalah:** `Topbar.tsx:6â€“11` mendeklarasikan `isNeonConnected`, `lastSyncedAt`, `onOpenNeonModal`, `onOpenSupabaseModal` tetapi tidak dirender. Tidak ada indikator â€œmenyimpan/belum tersimpanâ€ padahal `storage.ts:82` punya `flushPendingWrites()`.
**Eksekusi:** render badge koneksi (â€œTerhubung Â· disinkron HH:MMâ€ / â€œOfflineâ€), tombol buka `NeonDatabaseModal`, indikator pending-write + tombol â€œSimpan sekarangâ€ (`flushPendingWrites()`).

### A6 â€” State hilang saat pindah menu âœ… SELESAI 2026-09-21
**Masalah:** `App.tsx` merender hanya tab aktif (mis. `:1138`) â†’ filter/pencarian/urutan/halaman/pilihan kandidat (`fase2Choice`, `fase3RoleChoice`) reset tiap pindah menu.
**Eksekusi:** angkat state grid ke `App.tsx` atau simpan di `sessionStorage` (minimal: filter wilayah/status, halaman, pageSize).

### A7 â€” Penanda â€œN baris belum disetujuiâ€ âœ… SELESAI 2026-09-21
**Masalah:** tombol terkunci saat fase sudah dieksekusi tapi belum disetujui (`App.tsx:676â€“682`) tanpa info sisa & tanpa lompat.
**Eksekusi:** hitung per fase baris `!faseNApproved && kategori!=='TIDAK_ANALISA'`; tampilkan â€œN baris belum disetujuiâ€ yang bisa diklik â†’ filter/scroll ke baris pertama.

### A8 â€” Virtualisasi vs baris kartu âœ… SELESAI 2026-09-21
**Masalah:** `useVirtualWindow.ts:63â€“70` mengukur tinggi dari baris pertama (fallback 44 px, ambang 200 baris `:32`); tab Fase 2/3 berisi kartu kandidat tinggi tak seragam â†’ scroll melompat saat `pageSize='ALL'`.
**Eksekusi:** nonaktifkan windowing untuk tab Fase 2/3, atau tinggi baris tetap + area kartu scroll internal.

### A9 â€” Responsivitas & CSS mati ðŸŸ¨ SEDANG (breakpoint belum; penghapusan CSS mati menunggu konfirmasi)
**Masalah:** stylesheet aktif hanya `src/styles/index.css` dengan 1 media query (`:704`); kolom sticky lebar tetap (340â€“420 px). `src/App.css` & `src/index.css` tidak diimpor (`main.tsx:3`).
**Eksekusi:** breakpoint 1280/1024/768 untuk sidebar & tabel (scroll horizontal + indikator); hapus 2 file CSS mati.

### A10 â€” Dead code
**Tidak diimpor:** `TargetDataGrid.tsx` (3.155 baris), `MasterUploadModal.tsx` (479), `MasterDataGrid.tsx` (282), `ProximityGuideModal.tsx` (313), `MasterUpload.tsx` (220), `FilterToolbar.tsx` (95), `Navbar.tsx` (93), `ProgressBar.tsx` (55), `App.css`, `index.css`. Fungsi mati `matcher.ts`: `matchSingleRow:93`, `resolveLevel2TieBreaker:67`, `executeChunkMatching:266`. UI mati: `TargetUploadModal` tak pernah bisa dibuka (`App.tsx:56,1247`).
**Eksekusi:** hapus/arsip setelah F1â€“F4 selesai.

## BAGIAN B â€” FASE 1 (PTEN & Kode Pos)

**Alur berjalan:** item = 1 kota PTEN (`analystPipeline.ts:968â€“974`) â†’ 1 baris Master Cabang kota itu (`:1022â€“1024`) â†’ cari rekaman PTEN (nama + kode pos persis â†’ fuzzy â‰¥0,88 â†’ pemekaran, `:1455â€“1508`) â†’ `resolveCityByGeocode` tarik kelurahan/kecamatan KodePos kota itu + saring blok kode pos PTEN â†’ VERIFIED/REVIEW/FALLBACK (`:1283â€“1414`) â†’ expand **1 baris per kelurahan**, semua pakai satu `kodePosPten` (`:1878â€“1895`) â†’ `TIDAK_ANALISA` untuk kota tak ada di PTEN (`:1967â€“2016`) â†’ laporan `coverage` (`:2020â€“2029`).

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| B1 | Kota/Kabupaten kembar nama menyatu jadi 1 grup | `ADMIN_NOISE_TOKENS:279â€“290` buang `KOTA/KABUPATEN`; `cityMatchKey:342â€“348`; PTEN tanpa prefix (`defaultPtenData.ts:792,1008` â€œBOGORâ€) | Simpan jenis daerah (KOTA/KAB) terpisah saat membandingkan; minimal tambahkan peringatan â€œ2 wilayah digabungâ€ di laporan cakupan. **Perlu keputusan** |
| B2 | Kode pos kelurahan tidak masuk hasil/ekspor (`KODE POS` = `KODE POS PTEN` sama) | `AnalystResultsGrid.tsx:616,622` (ekspor), `:194` (grid) | Tambah kolom â€œKode Pos Kelurahanâ€ (dari `KodePosRow.kodePos`), pisahkan dari `KODE POS PTEN`; jelaskan `CEK KODE POS + PTEN` sebagai pembanding tingkat kota. **Perlu keputusan** |
| B3 | Baris `TIDAK_ANALISA` dinomori belakangan & tidak ikut approve otomatis (benar) | `:1969`, `:2030`, `App.tsx:815` | Pertahankan; pastikan ekspor menomori ulang |
| B4 | âœ… SELESAI 2026-09-21 â€” default palsu (dihapus) | `'KOTA JAKARTA PUSAT'` `:1510`; `'10110'` `:1511`; `'Wilayah 01'` `:1898`; tebakan W-code `:1028â€“1040`; identitas sintetis `:1584â€“1589` | Ganti kosong + status manual; jangan isi karangan |

## BAGIAN C â€” FASE 2 (Wilayah & Cabang)

**Alur berjalan:** lapis otomatis = ambil baris Master Cabang kota itu, aturan Acehâ†’KIM, Kanwil dari Branch Code (`analystPipeline.ts:1564â€“1589`), **tanpa jarak**. Lapis review = 3 kandidat **per kota** (`AnalystResultsGrid.tsx:230â€“255`), urutan skorâ†’selisih kode pos (`recommender.ts:667`; jarak km hanya tampilan `:677`), tombol terapkan `:266â€“289` (hitung ulang F3 baris itu).

### C2 â€” Perubahan yang DISETUJUI (wajib dieksekusi)
| Aturan | Implementasi |
|---|---|
| **C2a Rank-1 otomatis = terdekat** | Fase 2 otomatis (`analystPipeline.ts:1564â€“1589`) jangan hanya join cabang kota: jalankan engine kandidat yang sama dengan layar, ambil **Rank 1** (jarak km terkecil dalam kota sama), tulis ke field Fase 2 baris |
| **C2b Seri â‰¤2 km â†’ KC menang** | Pengurutan kandidat (`recommender.ts:667`): bila `|kmAâˆ’kmB| â‰¤ 2` dan hanya salah satu `Status Outlet==='KC'` â†’ KC lebih dulu (pola sama `roleRecommender.ts:424â€“434`) |
| **C2c Sumber KC** | Kolom **`Status Outlet`** Data Cabang bernilai **persis `'KC'`** (uppercase-trim). Mapping Role BUKAN penentu KC untuk Fase 2 |
| **C2d Hitung per kelurahan** | `AnalystResultsGrid.tsx:230â€“255`: kunci cache dari `makeFinalKey(r.kodePosPten, r.kelurahan)` atau `r.id`, bukan `cityMatchKey(r.groupKota)`; `fase2ValidCities` (`:258â€“265`) & `butuhManual` (`:478`) jadi per baris |
| **C2e Tier-2 = kota terdekat di provinsi sama** | Pool provinsi (`recommender.ts:593â€“634`) diurut pakai `calculateRealDistance().distanceKm` (`geoDistance.ts:217`) â€” bukan `postalDiff*2+4000` (`:389`) |

### C3 â€” Gerbang validasi manual diganti
Setelah Rank-1 otomatis, semua baris â€œmatch_top1â€ â†’ `fase2ValidCities`/`butuhManual` mati. Ganti penanda: (a) kandidat dari kota berbeda (Tier-2), (b) jarak > ambang (mis. >16 km), (c) KC tak ketemu â†’ KCP terpilih, (d) kota tak ada di master.

### C4 — Kasus uji wajib
Kota **Bandung**: baris **Braga** (40111, Sumur Bandung) → P1 Asia Afrika 98% ~1,4 km; baris **Lebak Siliwangi** (40132, Coblong) → Pilihan 1 harus **Dago 98% ~1,4 km** (bukan Asia Afrika ~4,2 km). Setelah C2d, dua baris WAJIB berbeda hasil.

### C7 — SELISIH JUMLAH BARIS KODE POS DI LAYAR (temuan screenshot operator 2026-09-22, `SELESAI DIUKUR 2026-09-22` — bukan bug mesin)

Operator melihat dua angka berbeda (83.764 vs 83.762). **Diukur langsung ke production, hanya-baca:**

| Yang diukur | Angka | Sumber |
|---|---|---|
| Baris tabel kerja `kodepos_data` | **83.762** | `GET /api/kodepos?view=stats` |
| Baris baseline Kemendagri + selisih DB | **83.762**, `missingCodesTotal: 0`, `codesOnlyInDb: 0`, `missingInDb: []` | `GET /api/kodepos-baseline?view=meta` & `?view=diff` |
| Baris yang benar-benar diterima pipeline | **83.762**, `id` unik = 83.762 (0 duplikat) | `GET /api/kodepos?view=export` → 23,9 MB diurai lokal (`scratch/uji-duplikat-export.mjs`) |
| **Kunci baris kembar** (`kode pos\|kelurahan\|kecamatan\|kabupaten`) | **15 kunci × 2 baris = 30 baris** → kunci unik **83.747** | `scratch/uji-kunci-kembar.mjs` |

**Kesimpulan (berdasarkan angka, bukan dugaan):**
1. **JOIN `kodepos_geo` bukan penyebab.** `view=export` memakai `LEFT JOIN kodepos_geo` (`api/kodepos.ts:342`) yang secara teori bisa menggandakan baris, tapi hasil ukur: 83.762 baris, 83.762 `id` unik → fan-out nol. `view=stats`/`?view=page` (`:387`, `:399`) bahkan pakai subselect scalar, jadi tidak mungkin menggandakan.
2. **Cloud konsisten.** Baseline = tabel kerja = export = 83.762. Jadi **83.764 tidak berasal dari server**. Satu-satunya tempat yang bisa menambahkan 2 baris adalah salinan lokal di IndexedDB browser operator (`kodepos_master_data`, dibaca `App.tsx:602`).
3. **Temuan data nyata:** 15 pasangan baris **kembar persis** (kode pos, kelurahan, kecamatan, kabupaten, provinsi, status, titik semuanya sama; hanya `id` beda): Sorkam Kanan 22561 (5062/5063), Panipahan 28995, Merlung 36554, Terusan 36655, Oesao 85362, Wakumoro 93667, Tounelet Satu 95691, Inobonto 95752, Rumoong Bawah 95955, Urimessing 97113, Nusaniwe 97117, Anjareu 98551, Kogekotu 98713, Wuyukwi 98974, Wurak 98975. Karena kunci Final (`makeFinalKey`) = 4 kolom itu, pasangan ini **jatuh ke satu kunci** — jadi "jumlah baris" dan "jumlah kelurahan unik" memang beda 15 selamanya, dan itu menjelaskan kenapa dua kartu bisa menampilkan angka berbeda tanpa ada yang salah hitung.

**Yang TIDAK dikerjakan (butuh keputusan pemilik produk):**
- Menghapus 15 baris kembar di `kodepos_data` = **WRITE ke produksi** → tidak dijalankan otomatis. Perintah yang dipakai nanti kalau disetujui: hapus `id` kedua dari tiap pasangan di atas (15 baris), lalu `?view=stats` harus menunjukkan 83.747.
- Cara operator memeriksa selisih +2 lokal-vs-cloud tanpa membuka DevTools: bandingkan angka kartu metric di **Data KodePos** (baca dari cloud, `?view=stats`) dengan angka **"N baris masuk"** di laporan cakupan **Data Analyst** (panjang array yang dipakai pipeline). Kalau berbeda 2, sumbernya salinan IndexedDB browser itu — solusinya muat ulang master dari cloud (tombol Sync/Baca ulang), bukan mengubah kode. Endpoint `/api/kodepos?view=sync-meta` (sidik jari per provinsi, `api/kodepos.ts:356`) sudah tersedia di server tapi **belum ada pemakainya di klien** — tinggal dipasang kalau pemilik produk mau daftar provinsi yang beda diperlihatkan langsung.

## BAGIAN D â€” FASE 3 (Mapping Role & Wondr)

**Alur berjalan:** dua engine â€” (1) otomatis di pipeline: pool hanya cabang 3-role-lengkap (`analystPipeline.ts:842â€“844, 1422â€“1424`), skor `calculateUnifiedPrecisionScore` ambang â‰¥0,75, fallback keyword kota 0,85 â†’ fallback daftar pertama 0,70 (`:1591â€“1660`, `matchRoleForOutlet:849â€“915`); `isFinalApproved` otomatis bila EXACT_MATCH (`:1929`). (2) layar review per baris: `roleRecommender.ts:60â€“471` â€” KC prioritas (`nameMatchScore 200/180`, baris `242â€“267, 268â€“317`), strict 1 pulau (`:331â€“340`), urutan nama â†’ KC â‰¤2 km â†’ role lengkap â†’ jarak (`:412â€“467`), pangkas >80 km bila ada â‰¤50 km (`:407â€“411`); tombol â€œTerapkan Role Iniâ€ â†’ `applyFase3Role` (`AnalystResultsGrid.tsx:301â€“327`, menulis `confidenceScore:100`, `EXACT_MATCH`, `editedManually`).

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| D1 | Dua engine beda kriteria → hasil otomatis â‰  rekomendasi layar (contoh: fallback daftar pertama = AMBON, padahal layar menyarankan JAYAPURA di pulau sama) | `analystPipeline.ts:1591–1660` vs `roleRecommender.ts:60–471` | ✅ **SELESAI 2026-09-21** — engine layar jadi mesin resmi Fase 3 lewat adaptor `matchRoleForOutlet`; lihat baris D1 di tabel status Bagian 0 |
| D2 | âœ… SELESAI 2026-09-21 â€” fallback arbitrer `completeRoleList[0]` (skor 0,70) | `analystPipeline.ts` `matchRoleForOutlet` & jalur pipeline | Kosongkan + lempar manual: tanpa kecocokan nyata â†’ `organisasiTujuan` kosong (bukan `<OUTLET> BRANCH OFFICE`), `tipeUnit: OUTLET` (bukan KC), role 0/0/0 sehingga `is3RoleLengkap` false, `alurWondr`/`flowDescription` kosong (bukan label Tier karangan), status ANOMALI â†’ masuk antrean review |
| D3 | âœ… SELESAI 2026-09-21 â€” auto-final dari EXACT_MATCH tanpa melihat F1/F2 | blok hasil `analystPipeline.ts` | `isFinalApproved` otomatis kini = EXACT_MATCH **dan** `placementStatus===VERIFIED` **dan** `!usedFallback` |
| D4 | Dua kosakata Alur Wondr | `getWondrRecommendation` (`RoleMappingManager.tsx:283â€“312`) vs label generik pipeline `:1660, 900` | Satukan kosakata di satu fungsi |
| D5 | Pulau `'Lainnya'` membuat strict-1-pulau longgar | `roleRecommender.ts:334–336` | ✅ **SELESAI 2026-09-21** — flag `islandUnknown` memaksa REVIEW (skor dipotong ke 60 + catatan), bukan lagi dianggap sama pulau |
| D6 | âœ… SELESAI 2026-09-21 â€” pilihan manual selalu `EXACT_MATCH` + confidence 100 | `AnalystResultsGrid.tsx` `applyFase3Role` | Sekarang `HIGH_CONFIDENCE`: akurasi mesin tidak lagi naik oleh keputusan manusia, dan baris hasil pilihan manual tidak ikut lolos gerbang auto-final |

## BAGIAN E â€” TINJAUAN 12 SINYAL

> **AMBANG RESMI (E5, dokumentasi 2026-09-21 — tiga angka ini memang beda tugas):**
>
> | Ambang | Nilai | Tugasnya | Dipakai di |
> |---|---|---|---|
> | bukti sebuah sinyal ikut tercatat | skor bagian â‰¥ **0,75** | menyalakan SATU BIT pada kartu sinyal (pembuktian, bukan keputusan) | `catat()` di `calculateCityMatchScore` / `calculateUnifiedPrecisionScore` |
> | suara kuat (strong votes) | â‰¥ **0,85** | pasangan dianggap "didukung beberapa algoritma sekaligus" sehingga layak diterima walau nama panjang | gerbang penerimaan internal mesin kota |
> | terima kota | skor gabungan â‰¥ **0,88** | KEPUTUSAN: kota PTEN dianggap sama dengan kota master | jalur penerimaan Fase 1 |
>
> Jadi "kartu sinyal menyala" TIDAK berarti pasangan diterima; satu bit bisa bernyanyi
> sendiri sementara keputusannya jatuh di 0,88. Yang diubah 2026-09-21: angka akurasi di UI
> tidak lagi menyebut 27 pasangan (lihat E8), dan fonetik semata tidak bisa lagi
> meloloskan auto-final (lihat E4).

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| E1 | Fase 2 tidak memakai 12 sinyal (engine beda: `textSimilarityScore` + indeks sendiri) | `recommender.ts:118â€“231, 237â€“422` | Jika ingin seragam, jalankan sinyal di F2; minimal dokumentasikan beda metode |
| E2 | Fase 1 hanya 8 dari 12 sinyal (7 LCS, 10 containment, 12 initialism, 13 penjaga sengaja tidak dipakai untuk kota â€” keputusan BENAR) | `calculateCityMatchScore:783â€“835`; komentar `:778â€“782` | Perbarui label UI â€œ12 Sinyalâ€ agar menjelaskan cakupan per fase (`AnalystCanvas.tsx:317`) |
| E3 | ✅ **SELESAI 2026-09-22** — Normalisasi unit bertentangan: sinyal mengubah `KCâ†’KANTOR CABANG` (`THESAURUS_MAP:244â€“249`), engine role justru menghapusnya (`roleMatcher.ts:67`) | Dua normalizer berbeda | Disatukan lewat satu daftar `UNIT_NOISE_TOKENS` di `normalizer.ts` — penanda unit DIBUANG di semua jalur (tidak dikembangkan lagi). Akurasi terukur naik 88,9% → 90,3%. Detail di baris E3 tabel status Bagian 0 |
| E4 | Fonetik bisa auto-final (`max(0.95, jaro)` â†’ â‰¥90 â†’ EXACT_MATCH) | `analystPipeline.ts:739`, `:1929` | Fonetik tidak boleh jadi dasar auto-final tunggal |
| E5 | Tiga ambang berbeda: bit â‰¥0,75 (`:678â€“684`), strongVotes/containment/initialism â‰¥0,85, terima kota â‰¥0,88 â†’ kartu sinyal â‰  kontribusi nyata | `analystPipeline.ts` | Selaraskan atau dokumentasikan |
| E6 | Dua definisi pulau | `getIslandFromProvince` (`analystPipeline.ts:449`) vs `getIslandFromProvinsi` (`roleRecommender.ts:14`) | Satukan satu fungsi |
| E7 | ✅ **SELESAI 2026-09-22** — Bukti F1 & F3 digabung di UI (`bitTemuanBaris`) padahal tersimpan terpisah | `:200â€“201` | Terpasang di `SinyalTemuanModal.tsx`: chip jumlah bukti per fase + kolom "Bukti per fase" (`F1:` / `F2:` / `F3:`). Detail di baris E7 tabel status Bagian 0 |
| E8 | Klaim akurasi â€œ96,3% pada 27 pasanganâ€ berbasis sampel kecil; uji hanya skrip manual `scratch/uji-matcher.mjs` | `AnalystCanvas.tsx:320` | Perbesar set berlabel + masukkan ke CI |

## BAGIAN F â€” 5 MENU DATA MASTER

### F1 â€” Data Wilayah (`WilayahManager.tsx`, 1.497 baris)
**Alur:** mount â†’ cek Neon â†’ cloud ada â†’ pakai; cloud kosong + terhubung â†’ **auto-push 17 default** (`:115`); simpan â†’ `saveWilayahToNeon` replace-all â†’ callback ke `App.tsx` tulis IndexedDB.
**Baik:** validasi kelengkapan 7 kolom (`:168â€“200`), filter provinsi, pencarian 12 kolom.
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| W1 | Aturan Branch Codeâ†’Wilayah gagal untuk kode alfanumerik (`JKT-THM-01` â†’ `substring(1,3)='KT'`) | `normalizer.ts:526â€“565`; default wilayah memakai kode numerik `601601` (`defaultWilayah.ts:7`) | Toleransi kode alfanumerik ATAU peringatan â€œKanwil tidak terbaca dari Branch Codeâ€ |
| W2 | Replace-all tanpa cek konflik | `api/wilayah.ts:82â€“97` | Cek `updated_at` sebelum POST; konfirmasi bila cloud lebih baru |
| W3 | Tidak ada indikator â€œtersimpan ke cloud / gagalâ€ | `handleSaveToDatabase:219â€“243` | Notifikasi sukses/gagal eksplisit (pakai A1) |

### F2 â€” Data PTEN (`PTENManager.tsx`, 1.064 baris)
**Alur:** IndexedDB â†’ default â†’ Neon; impor Excel parsing longgar; simpan replace-all.
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| P1 | Impor = ganti seluruh TANPA dedup | `handleImportExcel:222â€“320` â†’ `setPtenList(imported)` langsung | Dedup kunci `kodePosPten` (+`kotaPten`); laporan â€œX baru, Y duplikat dilewatiâ€; jangan hapus baris lama di luar berkas kecuali mode replace disengaja |
| P2 | Replace-all JSONB tanpa konflik | `api/pten.ts:68â€“77` | Sama W2 |
| P3 | Reset ganda (kosongkan vs default) | `:419â€“436` | Konfirmasi menyebut jumlah baris yang hilang |

### F3 â€” Data Cabang (`CabangManager.tsx`, 1.197 baris) â€” **P0**
**Alur:** tidak menyimpan sendiri; memanggil `onMasterLoaded(rows, fileName, mode)` â†’ `App.tsx:826` `handleMasterLoaded` **selalu merge+dedup, tidak membaca `mode`**.
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| **C1** | **Edit baris tidak tersimpan** â€” `updatedList` ada di `prev` â†’ dianggap duplikat â†’ dibuang; toast bohong | `CabangManager.tsx:320`; `App.tsx:826â€“880` | Tambah parameter `mode`/`action` di `handleMasterLoaded`; untuk edit â†’ replace array eksplisit (bukan merge) |
| **C2** | **Hapus baris tidak tersimpan** â€” sama seperti C1 | `CabangManager.tsx:330` | Sama; hapus via replace eksplisit lalu `saveMasterToNeon` |
| C3 | Reset: cloud gagal hanya `console.warn` | `App.tsx:882â€“893` | Notifikasi gagal + jangan kosongkan lokal bila cloud gagal (atau sebaliknya, konsisten) |

### F4 â€” Data Mapping Role (`RoleMappingManager.tsx`, 2.132 baris)
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| R1 | Impor = ganti seluruh TANPA dedup | `handleImportExcel:495â€“560` | Dedup kunci `organisasiTujuan` |
| R2 | Replace-all JSONB tanpa konflik | `api/rolemapping.ts:73` | Sama W2 |
| R3 | Reset ganda | `:691â€“706` | Sama P3 |

### F5 â€” Data KodePos (`KodePosManager.tsx`, 1.770 baris) â€” paling matang
Server paging (`api/kodepos.ts:382â€“407`, default 25 cap 500), CRUD per-id (`PUT/DELETE ?id`), batch 500 (`:531`), geo enrichment + antrean localStorage (`KodePosManager.tsx:323`).
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| K1 | Seed ~140 baris vs master 83 ribu; offline hanya melihat seed tanpa peringatan | `App.tsx:194â€“204` | Badge/peringatan â€œmemakai data seed, data penuh belum tersediaâ€ |
| K2 | Antrean geo di `localStorage` bisa tabrakan antar-tab | `:323â€“334` | Kunci unik per tab/session atau pindah ke server |
| K3 | Validasi form pakai `alert()` | `:412,416` | Ganti notifikasi (A1) |

### F6 â€” Lintas menu
| ID | Temuan | Perbaikan |
|---|---|---|
| X1 | 3 menu JSONB replace-all (Wilayah/PTEN/Role) â€” konflik tulis tak terdeteksi | `updated_at` + konfirmasi bila cloud lebih baru |
| X2 | Tidak ada optimistic locking | Sama |
| X3 | `mode replace` = DELETE lalu INSERT tanpa transaksi (`api/master.ts:203â€“204`, `api/target.ts:217â€“218`) | Bungkus `BEGIN/COMMIT` |
| X4 | Status sinkron tak terlihat | Lihat A5 |
| X5 | Auto-push default ke cloud tanpa konfirmasi | `WilayahManager.tsx:115`, `PTENManager.tsx:86`, `RoleMappingManager.tsx:372` â†’ konfirmasi operator |

## BAGIAN G â€” MENU DATA FINAL (analisa kebutuhan BRD vs implementasi)

**Alur berjalan:** baris masuk Final hanya lewat persetujuan di Data Analyst â€” â€œSetujui Finalâ€ memindahkan **semua** baris non-`TIDAK_ANALISA` (`App.tsx:741â€“757`), disimpan IndexedDB `analyst_final_data` (`:752`). â€œKembalikan semuaâ€ (`:760â€“772`) dan â€œRevisi per barisâ€ (`:776â€“796`) mengembalikan ke Data Analyst. UI: `FinalDataManager.tsx` â€” pencarian, filter wilayah, pagination (25/hal), Export Excel (`:53â€“83`), **tidak ada tombol unggah, detail, atau hapus**.

### G0 â€” Tabel gap: kebutuhan BRD vs implementasi

| # | Kebutuhan BRD | Status | Bukti |
|---|---|---|---|
| 1 | Unggah Excel dengan template standar | **BELUM ADA** | `FinalDataManager.tsx` tidak punya input file; hanya Export (`:53â€“83`) |
| 2 | Validasi & cegah duplikasi terhadap Data Analyst | **SEBAGIAN** | Dedup hanya saat approve final (`byId`, `App.tsx:746â€“749`); tidak ada cek saat unggah (karena unggah belum ada) |
| 3 | Analisis hanya data baru (belum pernah di Final) | **SUDAH** | `excludeFinalKeys` dikirim ke pipeline (`App.tsx:604`; `analystPipeline.ts:1874â€“1876`) |
| 4 | Matching kode pos + kelurahan + **kecamatan + kota** â†’ lewati + beri info status | **SEBAGIAN** | Kunci sekarang `makeFinalKey(kodePosPten, kelurahan)` saja (`analystPipeline.ts:126`); kecamatan/kota tidak ikut; baris yang dilewati tidak diberi status per baris |
| 5a | Aksi Detail (View) | **BELUM ADA** | Hanya tombol Revisi (`FinalDataManager.tsx:209â€“219`) |
| 5b | Aksi Revisi (kembali ke Data Analyst mulai Fase 1) | **SUDAH** | `handleReviseFinalRow` reset `fase1/2/3Approved=false` + `isFinalApproved=false` (`App.tsx:783â€“789`) â€” tapi konfirmasi masih `window.confirm` (`FinalDataManager.tsx:213`) |
| 5c | Aksi Hapus permanen | **BELUM ADA** | Tidak ada handler hapus di Final |
| 5d | Card informasi ringkas | **SEBAGIAN** | Hanya jumlah baris (`FinalDataManager.tsx:92â€“95`); belum ada metrik (KC/KCP, role lengkap, per wilayah) |

### G1 â€” Fitur Upload Excel (kebutuhan #1) â€” BELUM ADA, cara bangun
1. Tambah prop `onUploadFinal: (rows: AnalystRow[], fileName: string) => void` di `FinalDataManager` + tombol â€œUnggah Excelâ€ (ikon `FileSpreadsheet`, pola sama dengan menu lain).
2. Parsing: reuse `parseExcelFile` (`src/utils/excel.ts:196`) + template kolom sama dengan ekspor Final (`FinalDataManager.tsx:54â€“58`) supaya â€œformat template standarâ€ konsisten.
3. Alur wajib: parse â†’ **normalisasi kunci** `makeFinalKeyV2` (lihat G2) â†’ (a) baris yang kuncinya sudah ada di `finalRows` â†’ **dilewati** (hitung + laporkan), (b) kuncinya ada di `analystRows` â†’ **dilewati** (sudah dalam proses analisa), (c) baris benar-benar baru â†’ masukkan ke `analystRows` (bukan langsung Final) agar menjalani Fase 1â€“3 sesuai filosofi aplikasi, kecuali Anda memutuskan unggahan Final boleh langsung masuk Final (butuh keputusan â€” Bagian 12).
4. Notifikasi hasil: â€œX baris diimpor, Y dilewati (sudah ada di Final), Z dilewati (sedang di Data Analyst)â€.

### G2 â€” Perluas kunci matching (kebutuhan #4)
**Masalah:** `makeFinalKey(kodePosPten, kelurahan)` (`analystPipeline.ts:126â€“130`) tidak menyertakan **kecamatan & kota** sesuai BRD. Risiko: dua wilayah berbeda-kota dengan kode pos + nama kelurahan sama (mungkin akibat penggabungan Kota/Kabupaten di Fase 1, B1) dianggap â€œsudah finalâ€ â†’ data hilang diam-diam.
**Eksekusi:** tambah `makeFinalKeyV2(kodePosPten, kelurahan, kecamatan, kota)` = `${kp}|${kel}|${kec}|${kota}`; gunakan di 3 titik: `App.tsx:604` (exclude), `App.tsx:611,613` (merge persetujuan), `analystPipeline.ts:1874â€“1876` (skip). **Jangan hapus fungsi lama** sampai migrasi data IndexedDB lama selesai (tulis migrasi satu kali: baca `analyst_final_data`, tambahkan field `finalKeyV2`, simpan kembali).
> **âœ… SELESAI 2026-09-21 â€” dua penyimpangan dari rencana di atas, keduanya disengaja:**
> 1. Fungsi lama tidak dibiarkan dua (`makeFinalKey` + `makeFinalKeyV2`) â€” namanya tetap `makeFinalKey` tapi argumennya dilebarkan jadi 4 (kecamatan & kota opsional dengan default `''`), supaya tidak ada dua kunci yang bisa dipakai bertukaran dan menghasilkan hasil berbeda.
> 2. **Migrasi IndexedDB tidak diperlukan dan tidak ditulis**: kunci ini *dihitung ulang dari field baris* setiap kali dipakai (`excludeFinalKeys` dibuat di `App.tsx` dari `finalRows`, bukan dibaca dari penyimpanan). Baris `analyst_final_data` lama sudah punya `kodePosPten/kelurahan/kecamatan/kotaPten`, jadi langsung ikut aturan baru tanpa skrip apa pun.
> Terukur di browser: pasangan `85511|Babuin` kota TIMOR TENGAH SELATAN/Kualin vs BINTUNI/Batu Putih **tabrakan pada versi lama** (`tabrakanVersiLama: true`) dan **berbeda pada V2**; normalisasi huruf/ruang tetap (`' 10110 ' + 'gambir'` == `'10110' + 'GAMBIR'`).


### G3 â€” Informasi status baris yang dilewati (kebutuhan #4)
**Masalah:** baris yang dilewati karena sudah Final **hilang diam-diam** dari hasil analisa.
**Eksekusi:** tambah di `AnalystCoverage` field `skippedFinalRows: number` + `skippedFinalSamples: {kelurahan, kodePos, kota}[]` (maks 20); tampilkan di laporan cakupan Data Analyst: â€œX baris dilewati karena sudah ada di Final Dataâ€; dan/atau beri badge â€œSUDAH FINALâ€ pada baris Data Analyst yang kuncinya cocok (opsional).

### G4 â€” Aksi Detail (View)
**Eksekusi:** tombol â€œDetailâ€ per baris (ikon `Eye`) â†’ modal (`BaseModal`, lihat A3) menampilkan seluruh field `AnalystRow` dua kolom (Fase 1 / Fase 2 / Fase 3 / status), read-only, + tombol â€œRevisiâ€ dan â€œHapusâ€ di footer modal (opsional). Reuse gaya `CandidateDetailModal`.

### G5 â€” Aksi Hapus permanen
**Eksekusi:**
1. Prop baru `onDeleteRow: (rowId: string) => void` di `FinalDataManager`; handler di `App.tsx`: filter `finalRows`, simpan IndexedDB (`analyst_final_data`), **sinkronkan Neon bila G9 sudah ada**.
2. Wajib pakai `ConfirmDialog` dengan pesan â€œBaris #{no} ({kelurahan}, {kota}) akan DIHAPUS PERMANEN dan bisa dianalisa ulang dari awal.â€ (karena `excludeFinalKeys` dihitung dari `finalRows` saat run â€” setelah dihapus, baris otomatis bisa diproses lagi; ini perilaku yang benar, dokumentasikan).
3. Jangan pakai `window.confirm` (lihat A2).

### G6 â€” Revisi: ganti `window.confirm` â†’ `ConfirmDialog`
**Lokasi:** `FinalDataManager.tsx:213` (per baris) dan `:104` (kembalikan semua). Pesan menyebut dampak; aksi di `onConfirm`.

### G7 â€” Inkonsistensi â€œKembalikan semuaâ€ vs â€œRevisi per barisâ€
**Masalah:** `handleReturnFinalToAnalyst` (`App.tsx:760â€“772`) hanya reset `isFinalApproved`, **tidak** reset `fase1/2/3Approved` â†’ baris muncul di fase terakhir, bukan Fase 1; sedangkan Revisi per baris reset semuanya (`:783â€“789`).
**Eksekusi:** âœ… SELESAI 2026-09-21, opsi (a) â€” `handleReturnFinalToAnalyst` di `App.tsx` me-reset `fase1Approved/fase2Approved/fase3Approved/isFinalApproved` untuk baris yang datang dari Final, persis seperti Revisi per baris. Baris yang sejak awal berada di antrean Data Analyst TIDAK ikut kehilangan persetujuannya (kalau iya, menekan â€œKembalikan semuaâ€ akan merusak progres fase yang sedang direview).

### G8 â€” â€œSetujui Finalâ€ memindahkan semua status
**Masalah:** `handleApproveAllAnalystFinal` (`App.tsx:741â€“744`) memindahkan semua non-`TIDAK_ANALISA`, termasuk `PERLU_REVIEW`/`ANOMALI`, tanpa inspeksi.
**Eksekusi:** âœ… SELESAI 2026-09-21, opsi (a) â€” baris PERLU_REVIEW/ANOMALI tetap ikut dipindahkan, dan `ConfirmDialog` â€œPindahkan ke Final Analisa?â€ sekarang menyebut jumlah keduanya (â€œTermasuk N baris perlu direview dan M baris anomaliâ€¦â€). `stats` di `AnalystResultsGrid.tsx` memisahkan penghitung `perluReview` dan `anomali` (sebelumnya hanya digabung di `anomalies`).

### G9 â€” Data Final tidak sinkron ke Neon (P0)
**Masalah:** `analyst_final_data` hanya IndexedDB (`App.tsx:752, 770, 781`; boot restore `:215`). Tidak ada endpoint Neon; ganti perangkat/bersih browser = **Final Data hilang**.
**Eksekusi:** buat `api/final.ts` (pola `api/pten.ts`: app_store JSONB key `final_data`, GET/POST/DELETE) + `loadFinalFromNeon/saveFinalToNeon` di `neonSync.ts` + sinkron di boot `App.tsx:235â€“241` (pola merge seperti `neonWilayah` `:283â€“289`) dan setelah tiap perubahan Final (`:752, 770, 781`). Batasi ukuran: kirim per-chunk bila >2.000 baris (pola `saveKodePosToNeon` `neonSync.ts:372â€“407`).
> ### ðŸš« JANGAN ikuti kalimat "buat `api/final.ts`" di atas â€” instruksinya salah untuk repo ini.
> **Bukti terukur 2026-09-20 (A/B bersih):** menambah satu file fungsi serverless baru di `api/`
> membuat deployment Vercel **mati diam di `Deploying outputs...` tanpa satu baris error pun**
> (`370b266â€¦ca903e3` + `f9501b6` = gagal saat isi change-nya cuma `api/tsconfig.json` + anotasi tipe);
> satu-satunya perubahan yang memulihkan hijau adalah **menghapus file fungsi baru** dan memindahkan
> view-nya ke fungsi yang sudah ada (`bad0c2e` â†’ sukses 30 detik). Beda merah/hijau hanya **jumlah
> file fungsi di `api/`** (13 vs 12).
>
> **Cara benar:** perluas fungsi yang sudah ada lewat `?view=final` (GET/POST/DELETE pada kunci
> `final_data` di `app_store`) â€” jangan file baru. `api/wilayah.ts`, `api/pten.ts`,
> `api/rolemapping.ts`, `api/master.ts`, `api/target.ts` sudah memakai pola `app_store` JSONB itu.
>
> **Ukuran:** Final Data bisa puluhan ribu baris Ã— ~30 field. Satu baris `app_store` JSONB utuh
> akan menabrak batas body Vercel (~4,5 MB) dan lambat di-read-modify-write per chunk.
> Pilih salah satu sebelum koding: (a) tabel per-baris `final_rows` + upsert chunk 500â€“1.000 baris
> (pola `api/kodepos.ts`), atau (b) JSONB per-blob + chunk â€” (a) yang disarankan.
>
> **Jangan tulis ke Neon dari agen:** operator menjalankan sendiri alur produksinya
> ([[feedback-user-reruns-flows-himself]]). Verifikasi cukup GET `?view=final` setelah deploy.

**âœ… EKSEKUSI 2026-09-21 (pilihan (a): tabel per-baris `final_rows`):**

| Bagian | Isi |
|---|---|
| Skema | `final_rows(row_key TEXT PRIMARY KEY, raw_data JSONB NOT NULL, updated_at)` ditambahkan ke `ensureSchema` **`api/target.ts` yang sudah ada** (bukan file baru) |
| Endpoint | `GET/POST/DELETE /api/target?view=final` â€” GET dipaging (default & maks 500 baris, `ORDER BY row_key` agar halaman tidak tumpang tindih); POST upsert chunk 200 baris via `json_to_recordset` + `ON CONFLICT (row_key) DO UPDATE` (pola yang sama sudah produksi di `api/kodepos-id.ts`/`-baseline.ts`); DELETE `?key=` 1 baris / `?all=1` kosongkan |
| Aman dari salah ketik | POST/DELETE dengan `view` tak dikenal â†’ **400**, tidak jatuh ke jalur `target_records` (yang akan `DELETE FROM target_records`). Tanpa `key` **dan** tanpa `all=1`, DELETE final ditolak â€” satu DELETE lupa param tidak bisa menghapus semua hasil |
| Tidak ada jendela kosong | mode default `upsert` (tidak pernah `DELETE`); `replace` hanya untuk penanaman awal saat cloud masih kosong |
| Klien | `neonSync.ts`: `loadFinalFromNeon` (paging otomatis, `null` = endpoint tak tersedia vs `{rows:[]}` = cloud kosong), `saveFinalToNeon` (chunk 300 baris â‰ˆ 350 KB), `deleteFinalRowInNeon`, `clearFinalInNeon` |
| Boot merge | `App.tsx` STEP 2b (di luar `Promise.allSettled` agar tidak memperlambat sync lain): **non-destruktif** â€” baris cloud hanya MENAMBAH yang belum ada lokal, tidak pernah menimpa. Dedup via `pilFinalDariCloud()` (kunci alami `makeFinalKey`, bukan `id` â€” lihat G12). Cloud kosong + lokal ada â†’ tanamkan sekali + toast |
| Push setelah mutasi | 4 titik: Setujui-allâ†’upsert seluruh daftar; Kembalikan-ke-Analystâ†’`clearFinalInNeon`; Revisi & Hapus per barisâ†’`deleteFinalRowInNeon(rowId)`. Gagal â†’ toast warning "hasil tetap aman di browser ini"; di dev/offline tidak menuntut koneksi yang tidak ada (`isNeonConnected`) |
| Visibilitas | `api/status.ts` menambah `tables.finalRecords`; modal Database menampilkan kartu `final_rows` + jumlahnya, jadi "sudah ada salinan cloud" bisa dilihat tanpa membuka SQL |

**Cara operator memverifikasi (setelah deploy, tanpa perlu menulis):**
1. Buka `https://match-sepia.vercel.app/api/target?view=final&limit=5` â†’ harus `{"ok":true,"table":"final_rows","total":N,...}` (tabel dibuat otomatis pada permintaan pertama).
2. Buka `.../api/status` â†’ `tables.finalRecords` > 0 setelah menekan **Saya Setuju** di Data Analyst.
3. Reset browser/PC lain â†’ buka aplikasi â†’ toast "N baris Data Final dipulihkan dari cloud".
4. known limit (disengaja): cloud bisa menyimpan baris hasil run lama yang `id`-nya berbeda; baris itu **tidak pernah tampil** karena difilter `pilFinalDariCloud` berdasar kunci alami, tapi membuat `finalRecords` bisa lebih besar dari jumlah baris lokal. Belum ada GC-nya (butuh hapus-banyak-kunci; sampai hari ini manfaatnya tidak sebanding risikonya).
5. `analyst_purge_v2` (`App.tsx` boot) hanya menghapus salinan lokal; kalau nanti ada purge struktural baru, purge-nya juga harus menyapu `final_rows` â€” kalau tidak, baris format lama kembali dari cloud.


### G10 â€” Card informasi ringkas (kebutuhan 5d)
**Eksekusi:** di header `FinalDataManager.tsx:87â€“97` tambah 4 metrik mini: total baris, KC vs KCP, role lengkap (n/3), jumlah wilayah tercakup. Data sudah ada di `rows`.

### G11 â€” Dedup unggahan (pendukung kebutuhan #2)
**Eksekusi:** kandidat unggahan dicek ke: (1) `finalRows` via `makeFinalKeyV2`, (2) `analystRows` via kunci sama, (3) di dalam berkas sendiri (dedup internal). Hasil: 3 bucket â€” baru / duplikat-Final / duplikat-Analyst â€” laporkan semuanya.

### G12 â€” Jangan pakai `id` untuk dedup
`AnalystRow.id` memuat `Date.now()` (`analystPipeline.ts:1879`) â†’ berubah tiap run. Selalu dedup dengan `makeFinalKeyV2`, bukan `id`.

## 10. URUTAN EKSEKUSI (saran)

| Langkah | Isi | Sentuh logika analisa? | Estimasi |
|---|---|---|---|
| 1 | UI dasar: notifikasi global (A1), konfirmasi seragam (A2), BaseModal (A3) | Tidak | Sedang |
| 2 | Bug kritis menu: F3-C1/C2 (edit/hapus Cabang), G6 (confirm Final) | Tidak (perbaikan perilaku yang sudah seharusnya) | Kecil |
| 3 | Kontrol proses: tombol Batalkan (A4), Topbar status (A5) | Tidak | Kecil |
| 4 | Data Final: G9 (sinkron Neon) â†’ G2 (kunci V2 + migrasi) â†’ G5 (Hapus) â†’ G4 (Detail) â†’ G1 (Upload) â†’ G3 (status lewati) â†’ G10 | Ya (pipeline exclude) | Besar |
| 5 | Fase 2 sesuai keputusan: C2aâ€“C2e + C3 (gerbang baru) + uji C4 | Ya | Besar |
| 6 | Kebersihan: A6, A7, A8, A9, A10, item F1â€“F6 P1/P2 | Sebagian | Sedang |
| 7 | Keputusan Bagian 12 (B4, D1, D3, D6, G8, B1/B2) | Ya | Setelah keputusan |

## 11. CHECKLIST VERIFIKASI (jalankan setelah tiap langkah)

1. `npm run build` â†’ sukses tanpa error TypeScript.
2. `npm run lint` (oxlint) â†’ tidak ada pelanggaran baru.
3. Manual UI:
   - Notifikasi muncul seragam (sukses/info/warning/error), tidak ada `alert()` tersisa di alur normal.
   - Aksi destruktif â†’ `ConfirmDialog` dengan jumlah baris; Batal benar-benar membatalkan.
   - Setiap modal: Esc menutup, fokus masuk modal & kembali ke pemicu; dialog persetujuan tidak tertutup klik-luar.
   - Analisa jalan â†’ tombol Batal berfungsi; setelah batal tidak ada hasil setengah jadi tersimpan.
   - Pindah menu lalu kembali: filter/halaman/pilihan kandidat tetap.
   - Topbar menampilkan status koneksi & waktu sinkron.
4. Data Master:
   - Cabang: edit 1 baris â†’ simpan â†’ refresh â†’ berubah; hapus 1 baris â†’ refresh â†’ hilang; toast sesuai kenyataan.
   - PTEN/Role: impor berkas sama 2Ã— â†’ tidak ada duplikat; laporan jumlah dilewati.
   - Wilayah/PTEN/Role: simpan saat cloud lebih baru â†’ muncul konfirmasi konflik.
5. Data Final:
   - Approve Final â†’ baris muncul di Final & hilang dari Analyst; IndexedDB `analyst_final_data` terisi; Neon `final_data` terisi (setelah G9).
   - Analisa ulang â†’ baris Final TIDAK diproses ulang; laporan cakupan menyebut jumlah yang dilewati.
   - Revisi 1 baris â†’ kembali ke Data Analyst dengan semua fase reset; analisa berikutnya memprosesnya dari Fase 1.
   - Hapus 1 baris â†’ hilang permanen; analisa berikutnya memproses lagi.
   - Unggah Excel (setelah G1) â†’ duplikat dilewati, baru masuk proses; laporan 3 bucket.
6. Fase 2 (setelah C2): uji Bandung â€” Braga vs Lebak Siliwangi menghasilkan Pilihan 1 berbeda; KC menang bila jarak seri â‰¤2 km.

## 12. KEPUTUSAN YANG MASIH MENUNGGU (jangan eksekusi sebelum disepakati)

> ### ðŸ“Œ Status keputusan â€” 2026-09-21
> Pemilik menyerahkan keputusan ke agen ("ikutkan saran anda, saya minta semua sudah di-fixing"),
> jadi opsi di bawah **diambil sesuai default yang dokumen ini sendiri sarankan** dan sudah
> dieksekusi. Semua masih mudah dibatalkan: ubah barisnya, tulis ulang opsi, jalankan ulang.
> Kolom "Dipakai" = opsi yang diimplementasikan.

| ID | Keputusan | Opsi | Dipakai (2026-09-21) |
|---|---|---|---|
| B1 | Penggabungan Kota/Kabupaten kembar nama di Fase 1 | (a) pisahkan jenis daerah, (b) biarkan + peringatan | **(b)** âœ… dikerjakan 2026-09-21 â€” 26 grup dilaporkan |
| B2 | Kode pos kelurahan masuk ekspor? | (a) ya + pisahkan kolom, (b) tetap kode pos kota | **(a)** âœ… dikerjakan 2026-09-21 â€” kolom `kodePosKelurahan` terpisah |
| B4 | Hapus default palsu (`'10110'`, `'KOTA JAKARTA PUSAT'`, `'Wilayah 01'`, tebakan W-code, identitas sintetis) | (a) kosong + status manual, (b) biarkan | **(a)** â€” jangan isi karangan |
| D1 | Engine resmi Fase 3 | (a) engine layar (nama+jarak+KC+pulau) — disarankan, (b) engine nama | **(a)** |
| D3/D6 | Aturan auto-final & pilihan manual | (a) auto-final hanya VERIFIED+non-fallback, (b) manual = HIGH_CONFIDENCE | **(a) + (b)** keduanya |
| G8 | â€œSetujui Finalâ€ menyertakan PERLU_REVIEW/ANOMALI? | (a) ya + peringatan, (b) filter status | **(a)** â€” tetap disertakan tapi jumlahnya disebut di konfirmasi |
| G7 | â€œKembalikan semuaâ€ reset ke Fase 1? | (a) ya (disarankan), (b) tetap fase terakhir | **(a)** â€” disamakan dengan Revisi per baris |
| G1c | Unggahan Final boleh langsung masuk Final tanpa analisa? | (a) tidak â€” lewat Data Analyst (disarankan), (b) ya | **(a)** |


---
---

# LAMPIRAN (ditambahkan di akhir agar tidak bentrok dengan pekerjaan yang sedang berjalan)

**Catatan status:** item di Bagian H/I/J berstatus `BELUM` secara default dan sengaja **tidak dicantumkan di tabel Bagian 0** agar tidak bentrok dengan kerja yang sedang berjalan. Setelah AI menyelesaikan item di sini, tandai langsung di baris itemnya (`Status: SELESAI | tanggal | catatan`), dan saat dokumen disatukan nanti, pindahkan ke tabel Bagian 0.

## BAGIAN H â€” DASHBOARD & PETA (analitik)

**Konteks:** Dashboard merender 5 komponen (`App.tsx:1037â€“1156`): toolbar filter wilayah, `MetricCards`, `IndonesiaBranchMap`, `RegionalAnalyticsCharts` (memuat `MatchCompositionDonut`), `MasterDuplicateChart`, `DashboardMatchTable`.

| ID | Status | Temuan / Perbaikan |
|---|---|---|
| H1 | SELESAI 2026-09-22 | Sumber campur itu sudah dihapus: `dashboardStats` tidak ada lagi, `DashboardMatchTable` menerima `finalRows`+`anomaliIds`, `regionalStats` dihitung dari `finalRows`. Tidak ada widget dashboard yang membaca `targetRows` lagi — lihat N6 |
| H2 | BELUM | Komponen Dashboard mati (0 pemakaian): `Dashboard/AnalystInsightsBanner.tsx`, `Dashboard/AuditLogTable.tsx`, `Dashboard/WilayahChart.tsx` â€” masukkan ke A10 (hapus) atau pasang dengan data nyata |
| H3 | SELESAI 2026-09-22 | **Keputusan produk sudah diambil dan dikerjakan:** dashboard memakai Data Final + Data Cabang (`finalRows`/`masterRows`), bukan alur Target lama — lihat N6. Kartu 1, grafik wilayah, donut, tabel bawah, dan peta semuanya ditarik dari sumber yang sama |
| H4 | SELESAI 2026-09-22 | Jumlah anomali kini jadi widget dashboard (kartu TOTAL ANOMALI + donut "Komposisi Kualitas Data Final" per kategori `primary`, plus panel anomali di peta yang punya filter kategori sendiri). Tidak ada "radar chart" — bentuknya donut + daftar bar per wilayah, sesuai gaya kartu yang sudah ada |
| H5 | SEDANG | Sudah jalan lewat N6: kartu KPI pipeline-native (total baris final, kode pos disesuaikan, sisa, anomali, cabang terbanyak) + distribusi wilayah dari `finalRows`. Sisa: KPI per status analisa & progres persetujuan per fase dari `phaseApproval` (`App.tsx:651â€“669`), keputusan pasang/hapus `AuditLogTable` + `AnalystInsightsBanner` (dua-duanya mati), sinkronkan README |

## BAGIAN I â€” REVIEW PETA (`IndonesiaBranchMap.tsx`, 2.960 baris)

**Yang sudah baik (jangan diubah):** dedicated panes (`arcsPane`/`markersPane`/`selectedPane`), canvas renderer pin + SVG arc, pause redraw saat zoom/pan, click fallback hit-testing â‰¤28 px, geocoding cache IndexedDB + batch 120 + `kodepos_geo` sebagai sumber titik, filter scope (ALL/SELECTED_ONLY/FINAL_ONLY/MULTI_ONLY), tracking Aceh-KIM (curved arcs), search debounce, tile switch (Google/Hybrid/Esri/OSM), cleanup listener saat unmount.

| ID | Status | Temuan / Perbaikan |
|---|---|---|
| MAP-1 | ✅ SELESAI 2026-09-21 | `main.tsx` sudah membungkus `<App/>` dengan `<NotificationProvider>` (dikerjakan bersama A1). Diverifikasi ulang 2026-09-21: 0 pemakaian `alert(` tersisa di seluruh `src/` |
| MAP-2 | ✅ SELESAI 2026-09-21 | Kedua `alert()` di peta sudah diganti `notify()` — hasil grep seluruh `src/`: tidak ada satu pun pemanggilan `alert(` |
| MAP-3 | ✅ SELESAI 2026-09-21 | Reset `selectedPin` dilakukan SAAT RENDER (bandingkan `masterRows`/`targetRows`/`finalRows` dengan render sebelumnya) — bukan `useEffect`, supaya tidak ada commit yang masih menampilkan snapshot lama dan tanpa warning `set-state-in-effect` baru |
| MAP-4 | ✅ SELESAI 2026-09-21 | Chip "Google ✓/✗" di `Topbar.tsx` (status kunci di localStorage; tooltip menjelaskan dampaknya ke sumber titik & lapisan peta). Terukur di browser dev: chip tampil "Google ✗" pada profil tanpa kunci |
| MAP-5 | BELUM (P1) | Tiap batch geocoding memicu re-render pin (`resolvedCoords`â†’`allPins`â†’`filteredPins`) â†’ pin â€œberkedipâ€. Perbaikan: gambar ulang hanya saat batch selesai / user idle (lihat efek `~337â€“417` & `~885â€“1086`) |
| MAP-6 | ✅ SELESAI 2026-09-21 | Panel anomali dapat ditutup dengan tombol ✕ dan Esc (listener hanya aktif saat panel terbuka) |
| MAP-7 | ✅ SELESAI 2026-09-21 | `tileBawaan()` = Google bila ada kunci, selain itu OSM; dipakai state awal dan lapisan awal. Terukur: `<img>` tile pertama pada profil tanpa kunci = `b.tile.openstreetmap.org` |
| MAP-8 | ✅ SELESAI 2026-09-21 | Kontainer peta kini `role="region"` + `aria-label` berisi jumlah titik + `tabIndex=0` (Leaflet keyboard pan/zoom aktif setelah fokus). Daftar pin yang bisa diakses keyboard = kolom saran pencarian (tombol asli). Diverifikasi di DOM: aria-label & tabindex ada |
| MAP-9 | ✅ SUDAH ADA (2026-09-21, diverifikasi) | Drawer pin sudah punya tombol ✕ ("Tutup Panel") yang juga me-reset scope |
| MAP-10 | ✅ SUDAH ADA (diverifikasi 2026-09-21) | Modal baris cocok memakai `DialogPanel` → Esc, fokus masuk/kembali, Tab trap |

## BAGIAN J â€” ANIMASI & DELIGHT (peta & KPI)

**Sudah ada (tetapkan):** pin jatuh saat dipilih (`bniPinDrop`), garis alur bergerak (`flowDash`), arc perkiraan tanpa animasi (`--approx`, disengaja), halo denyut titik asal (`flowPulse`), hover pin/cluster membesar, Leaflet native (`flyTo`/`fitBounds`/`fadeAnimation`/`inertia`), dan **prefers-reduced-motion** (2 lapisan: khusus pin `styles/index.css:1511â€“1517` + global `:1848â€“1854`).

| ID | Status | Tambahan (semua pakai keyframes yang sudah ada â€” jangan tambah library) |
|---|---|---|
| ANI-1 | ✅ SELESAI 2026-09-21 | Pane `markersPane` di-fade `qdrFade .45s` sekali saat layer pin pertama digambar, lalu animasinya dilepas supaya redraw filter/zoom tidak berkedip |
| ANI-2 | ✅ SELESAI 2026-09-21 | Titik anomali digambar di CANVAS sehingga class CSS tidak menular; radiusnya dirampungkan 3→11 dalam ~8 frame `requestAnimationFrame`, dilewati saat `prefers-reduced-motion` |
| ANI-3 | ✅ SELESAI 2026-09-21 | Class baru `.bni-pop` (`qdrScaleIn .22s`) dipakai legenda, panel anomali, drawer pin, dan pil progres geocoding. Kartu luar peta sudah memakai `glass-card`/`qdrFade` |
| ANI-4 | ✅ SELESAI 2026-09-21 | Pil geocoding memakai `animation: spin` yang TIDAK PERNAH ada di CSS mana pun → spinner diam; diganti `qdrSpin`. Teks jadi "Mencari titik X dari Y" (+ catatan tanpa kunci Google). Lapisan global `prefers-reduced-motion` tetap mematikan animasinya |
| ANI-5 | SELESAI | Angka KPI berubah mendadak → count-up ~0,4 dtk (ease-out, hormati `prefers-reduced-motion`). File baru `src/components/Dashboard/AnimatedMetricValue.tsx` + 5 kartu di `src/components/Dashboard/MetricCards.tsx` memakainya. Tidak mengubah rumus/perhitungan. ✅ build diverifikasi (Sesi 2 qoder: `tsc -b --force` 0 error) |

## BAGIAN K â€” KARTU â€œTITIK KOORDINATâ€ (Data Kode Pos) terlihat aneh/macet

**Gejala yang dilaporkan:** kartu menampilkan angka besar `83.361`, lalu teks `401 baris belum ada titik`, dan tautan `coba ulang 401` â€” diklik tidak mengubah apa pun (terasa seperti bug/macet).

**Hasil analisa: BUKAN salah hitung â€” ini bug satuan/labeling & umpan balik.**

| Angka di layar | Sumber kode | Satuan sebenarnya |
|---|---|---|
| `83.361` (angka besar) | `KodePosManager.tsx:835` â†’ `stats.totalBerTitik` | **baris kelurahan** yang punya titik (koordinat sendiri **atau** fallback titik kode pos) |
| `401 baris belum ada titik` | `:290` `geoBelumTitik = stats.total - stats.totalBerTitik`, ditampilkan `:848` | **baris kelurahan** tanpa titik |
| `coba ulang 401` (tautan) | `:852` â†’ `jalankanGeo(geoUlang=true)` | aksi berjalan atas **kode pos unik** (`kodepos_geo.kode_pos` = PRIMARY KEY), **bukan** 401 baris |

Verifikasi konsistensi: `83.361 + 401 = 83.762` = total baris master â†’ perhitungan benar, tidak ada data hilang.

**Akar kebingungan:**
1. Judul kartu â€œTITIK KOORDINATâ€ tanpa satuan â†’ 83.361 dibaca sebagai â€œjumlah titikâ€, padahal â€œjumlah baris yang punya titikâ€.
2. Tautan retry menulis `401` (baris) padahal retry memproses **kode pos unik**; bila 401 baris itu hanya menempati mis. 37 kode pos, yang dikerjakan hanya 37.
3. Query retry: `api/kodepos-geo.ts:227â€“235` mode `ulang` â†’ `WHERE g.kode_pos IS NULL OR g.latitude IS NULL` (per kode pos). Baris `kodepos_data` hanya terisi bila kode pos baris itu punya titik di `kodepos_geo` (fallback `COALESCE(...)`, `api/kodepos.ts:141â€“146`). Bila penyedia (Google/ESRI/OSM) tidak punya data â†’ hasil 0 â†’ angka 401 tidak berubah.
4. Tidak ada umpan balik â€œ0 berhasil / N kode pos tidak bersumberâ€. Klien memang berhenti sendiri setelah satu putaran tanpa hasil (`KodePosManager.tsx:340` â€” `tanpaHasil`), tetapi user tidak melihat pesan apa pun â†’ terasa macet.

| ID | Status | Perbaikan |
|---|---|---|
| K1 | SELESAI | Satuan diperjelas: pesan kartu kini membedakan â€œbelum ada titikâ€ (masih ada antrean) vs â€œsudah dicoba, penyedia tidak menyediakanâ€ (`KodePosManager.tsx:863â€“867`) â€” build terverifikasi 2026-09-21 |
| K2 | SELESAI | Label tombol retry memakai satuan kode pos: `coba ulang {geoStats.geo.gagal} kode pos` (`:295`, `:880`). **Koreksi 2026-09-21:** `geoStats.gagal` tidak ada di tipe `KodePosGeoStats` (build mati TS2339); lapangan: `/api/kodepos-geo?view=stats` mengembalikan `geo.gagal=2.813`, dan tidak ada `gagal` di level atas â€” jadi path yang benar `geoStats?.geo?.gagal` |
| K3 | SELESAI | Umpan balik hasil retry: pesan eksplisit saat server tidak memproses apa pun (`:393â€“397`) + pesan selesai/berhenti (`:410â€“419`) |
| K4 | ✅ SELESAI 2026-09-21 | `api/kodepos-geo.ts`: cabang `ulang` kini mengecualikan `sumber='TIDAK DITEMUKAN'`, dan `ringkasanGeo` mengirim `geo.takBersumber`. Kartu Data Kode Pos menampilkan "N kode pos tak bersumber" dan tombol hanya menawarkan `menungguUlang`. ⚠️ butuh deploy agar angka server berubah; klien menghitung selisih `gagal − menungguUlang` selama server lama masih melayani |
| K5 | ✅ SELESAI 2026-09-21 | "N terverifikasi Google" naik ke baris kartu (sebelumnya hanya di tooltip) |

## BAGIAN L â€” CATATAN HASIL FIXING (log perubahan per sesi)

> Bagian ini adalah **log**, bukan daftar tugas. Ditulis agar qoder/tim lain tahu persis apa yang sudah diubah, mengapa, dan apa yang belum diverifikasi. Jangan mengubah kode yang sudah tercatat di sini tanpa membaca catatannya.

### Sesi 3 â€” 2026-09-21 Â· ANI-5 (animasi angka KPI) â€” dari Cline

| # | File | Perubahan | Item | Verifikasi build |
|---|---|---|---|---|
| 8 | `src/components/Dashboard/AnimatedMetricValue.tsx` (**file baru**) | Komponen `AnimatedMetricValue`: count-up/down ~400 ms (ease-out kubik, rAF), hormati `prefers-reduced-motion` (langsung ke nilai akhir). Presentasi saja — **tidak mengubah data/rumus** | ANI-5 | ✅ 2026-09-21 |
| 9 | `src/components/Dashboard/MetricCards.tsx` | 5 angka KPI memakai `AnimatedMetricValue` (`stats.totalProcessed`, `fm.distinctKodePos`, `fm.belumDikerjakan`, `fm.anomali`, `fm.top.count`). Teks kecil footer tetap `fmt(...)` | ANI-5 | ✅ 2026-09-21 |

**Batas kerja Sesi 2 (sesuai kesepakatan anti-bentrok):** hanya kedua file di atas. File yang TIDAK disentuh: `IndonesiaBranchMap.tsx`, `styles/index.css`, `App.tsx`, `perbaikan-seluruh-aplikasi.md` (kecuali log ini). Pekerjaan animasi peta (ANI-1â€¦ANI-4) tetap milik qoder.

### Catatan koordinasi (Sesi 2)
- ANI-3: **sudah ada dasar** (`.bni-map-container` memakai `qdrFade`) â€” tidak perlu diulang.
- ANI-4: pilar geocoding di `IndonesiaBranchMap.tsx:2935` memakai `animation: 'spin 1s linear infinite'` â€” tetapi stylesheet hanya mendefinisikan `@keyframes qdrSpin` (`styles/index.css:965`). **Spinner geocoding kemungkinan diam** â†’ qoder: ganti ke class `spinner-border spinner-border-sm` (sudah ada) atau definisikan `@keyframes spin`.

### Sesi 1 â€” 2026-09-21 Â· Tier-1 (UI & Data Master) + perbaikan kartu Titik Koordinat

| # | File | Perubahan | Item | Verifikasi build |
|---|---|---|---|---|
| 1 | `src/App.tsx` | `handleMasterLoaded` menerima parameter `mode` (`'replace' | 'append' | 'update'`); mode `'update'` = terapkan daftar lengkap apa adanya (tanpa merge/dedup) lalu simpan ke IndexedDB + Neon. Diperlukan karena edit/hapus Data Cabang sebelumnya hilang diam-diam. Ref: `App.tsx:929` | F3-C1, F3-C2 | âœ… build 2026-09-21 |
| 2 | `src/App.tsx` | Handler baru `handleDeleteFinalRow(rowId)` + kirim prop `onDeleteRow` ke `FinalDataManager`. Ref: `App.tsx:893`, `:1319` | G5 | âœ… build 2026-09-21 |
| 3 | `src/components/MasterData/CabangManager.tsx` | Tipe prop `onMasterLoaded` ditambah `'update'`; pemanggilan untuk create/edit (`:324`) dan hapus (`:334`) memakai `'update'`; impor Excel tetap `'replace'` (merge+dedup, perilaku lama dipertahankan). Ref: `:35`, `:322â€“334` | F3-C1, F3-C2 | âœ… build 2026-09-21 |
| 4 | `src/components/WorkingEngine/FinalDataManager.tsx` | (a) Card metrik ringkas: total/KC/KCP/3-role-lengkap/wilayah; (b) aksi **Detail** (modal `role="dialog"` + Esc); (c) aksi **Hapus permanen**; (d) `ConfirmDialog` untuk â€œKembalikan semuaâ€, â€œRevisiâ€, dan â€œHapusâ€; (e) prop baru `onDeleteRow` | G4, G5, G6, G10 | âœ… build 2026-09-21 |
| 5 | `src/components/WorkingEngine/AnalystResultsGrid.tsx` | Konfirmasi â€œRevisi ke Perlu Analisa Manualâ€ memakai `ConfirmDialog` (state `confirmManualRow`, `:159`; tombol `:1864`; dialog `:2081â€“2096`). **Sekaligus memperbaiki baris `onClick` yang rusak** akibat patch fuzz sebelumnya | A2 (sebagian) | âœ… build 2026-09-21 |
| 6 | `src/components/Topbar.tsx` | Badge status koneksi Neon (â€œTerhubung Â· disinkron HH:MMâ€ / â€œOfflineâ€), tombol **Database** (buka `NeonDatabaseModal`), tombol **Simpan** (memanggil `flushPendingWrites()` + umpan balik â€œTersimpan âœ“â€) | A5 | âœ… build 2026-09-21 |
| 7 | `src/components/KodePosData/KodePosManager.tsx` | **Perbaikan utama kartu â€œTITIK KOORDINATâ€**: (a) `await refreshStats()` di blok `finally` `jalankanGeo()` (`:423`) â€” inilah penyebab angka â€œbelum ada titikâ€ tidak pernah berubah setelah â€œcoba ulangâ€; (b) refresh KPI tiap 5 batch (`:345`, `:386â€“387`); (c) pesan eksplisit saat server tidak memproses apa pun (`:396`); (d) satuan diperjelas: `N baris tanpa titik â€” sudah dicoba, penyedia peta tidak menyediakannya` (`:870`); (e) label tombol memakai satuan kode pos (`:884`) | K1, K2, K3 | âœ… build 2026-09-21 |

**Ringkasan akar masalah kartu â€œTITIK KOORDINATâ€ (untuk referensi):** `jalankanGeo()` hanya me-refresh `geoStats`, padahal angka kartu dihitung dari `stats` (`geoBelumTitik = stats.total âˆ’ stats.totalBerTitik`). Akibatnya titik yang sudah tersimpan tidak pernah tercermin di kartu â†’ tombol â€œcoba ulangâ€ terlihat tidak bekerja.

### Yang BELUM dikerjakan (lanjutan untuk qoder)

| Item | Isi | Catatan |
|---|---|---|
| ~~A2 (sisa)~~ | `SnapshotModal.tsx` `window.confirm` â†’ `ConfirmDialog` | **SELESAI 2026-09-21** (lihat tabel Bagian 0) |
| ~~A1 (sisa)~~ | `alert()` pada alur impor Excel & validasi form | **SELESAI 2026-09-21** â€” `grep -n "alert(" src/` = 0 |
| ~~MAP-1~~ | `NotificationProvider` dipasang di `main.tsx` | **SELESAI 2026-09-21** â€” toast benar-benar tampil (diuji di dev) |
| K4, K5 | Tandai kode pos â€œtidak bersumberâ€; naikkan info â€œterverifikasi Googleâ€ ke baris kartu | kecil |
| H, I, J | Bagian Dashboard/Peta/Animasi (lihat di atas) | H3 = keputusan produk |

### Aturan verifikasi (WAJIB)

Sesi fixing pertama dilakukan tanpa `node`/`npm`/`git` di mesinnya, sehingga tabel di atas dulu berlabel "âš ï¸ BELUM diverifikasi compiler". **Sudah diverifikasi 2026-09-21** (`npx tsc -b --force` 0 error) â€” kecuali satu error tipe yang ditemukan & diperbaiki saat itu juga: `geoStats.gagal` â†’ `geoStats.geo.gagal` (lihat catatan K2).

```bash
npx tsc -b --force   # TypeScript PENUH â€” `npm run build` biasa bersifat inkremental dan bisa melewatkan error di file yang tidak diubah
npm run lint         # oxlint
```

Lalu uji manual minimal: (1) edit & hapus 1 baris di menu Data Cabang â†’ refresh â†’ pastikan berubah; (2) Data Final â†’ tombol Detail/Revisi/Hapus; (3) Topbar â†’ tombol Simpan; (4) Data Kode Pos â†’ klik â€œcoba ulang N kode posâ€ â†’ angka â€œbelum ada titikâ€ harus turun.

### Sesi 2 â€” 2026-09-21 Â· G2 + A4 (commit `eec7bd1`), lalu G9

| # | File | Perubahan | Item | Verifikasi build |
|---|---|---|---|---|
| 1 | `src/utils/analystPipeline.ts` | `makeFinalKey` dilebarkan jadi 4 komponen + `AnalisaDibatalkan` + `tick()` pembatal di `executeAnalystPipeline`; subsequently `pilFinalDariCloud()` untuk merge cloud | G2, A4, G9 | âœ… 2026-09-21 |
| 2 | `src/App.tsx` + `AnalystCanvas.tsx` | Tombol **Batalkan** saat analisa; state dikembalikan, tidak ada hasil setengah jadi tersimpan | A4 | âœ… 2026-09-21 |
| 3 | `api/target.ts` | `?view=final` (tabel `final_rows`) + penolakan `view` tak dikenal pada POST/DELETE. **Tidak ada file `api/` baru** (lihat kotak ðŸš« G9 â€” menambah file fungsi baru membuat deploy mati diam) | G9 | âœ… `tsc -p api/tsconfig.json` 0 error; handler dijalankan terhadap `sql` palsu (hasil lengkap di Bagian G9). **SQL asli belum dieksekusi ke Neon** â€” itu aksi operator setelah deploy (`GET ?view=final`) |
| 4 | `src/utils/neonSync.ts` | `loadFinalFromNeon` / `saveFinalToNeon` / `deleteFinalRowInNeon` / `clearFinalInNeon`; `NeonStatus.tables.finalRecords` | G9 | âœ… 2026-09-21 |
| 5 | `src/App.tsx` | STEP 2b boot merge non-destruktif + push di 4 titik mutasi Final + toast gagal | G9 | âœ… 2026-09-21 |
| 6 | `api/status.ts`, `src/components/NeonDatabaseModal.tsx` | Jumlah baris `final_rows` terlihat di modal Database | G9 | âœ… 2026-09-21 |
| 7 | `src/components/KodePosData/KodePosManager.tsx` | Perbaikan tipe `geoStats?.gagal` â†’ `geoStats?.geo?.gagal` (sisa patch sesi 1 yang belum di-commit; membuat `tsc -b --force` gagal TS2339) | K2 | âœ… 2026-09-21 |
| 8 | `src/App.tsx` | `handleReturnFinalToAnalyst` reset semua fase (disamakan dengan Revisi per baris) â€” keputusan Bagian 12 G7 opsi (a) | G7 | âœ… 2026-09-21 |
| 9 | `src/components/WorkingEngine/AnalystResultsGrid.tsx` | `stats` memisahkan `perluReview`/`anomali`; konfirmasi â€œPindahkan ke Final Analisa?â€ menyebut kedua jumlah itu â€” keputusan G8 opsi (a) | G8 | âœ… 2026-09-21 |
| 10 | `src/components/BaseModal.tsx`, `src/components/useDialogBehavior.ts` (baru) + 20 file dialog | A3: `DialogPanel` (perilaku dialog: portal ke body, `role=dialog`/`aria-modal`/`aria-labelledby` otomatis dari judul yang terlihat, Esc, fokus masuk & kembali ke pemicu, Tab tertahan, klik-luar bisa dimatikan) dan `BaseModal` ( DialogPanel + header/body/footer `.modal-*`). 31 dialog dibungkus tanpa mengubah tampilan; `ConfirmDialog` tidak lagi menutup saat klik latar | A3 | âœ… 2026-09-21 (tsc 0 error, lint 0 error, diuji nyata di browser dev: Esc menutup, fokus kembali ke pemicu, Tab wrap dua arah) |
| 11 | `src/utils/analystPipeline.ts` | B4: fallback kota/kode pos karangan ("KOTA JAKARTA PUSAT", "10110"), label "Wilayah 01", dan seluruh identitas sintetis baris penanda (W-code modulo, `CABANG x`, `KCP x`, `Jl. Protokol x`, `Status Outlet: Aktif`, `Provinsi: INDONESIA`) dihapus â†’ jadi kosong | B4 | âœ… 2026-09-21 (build). **Angka hasil analisa bisa berubah â€” operator perlu menjalankan ulang Analisa untuk membandingkan** |
| 12 | `src/utils/analystPipeline.ts`, `AnalystResultsGrid.tsx` | D2 (fallback role arbitrer + tujuan role/label Tier karangan dikosongkan), D3 (auto-final butuh VERIFIED & non-fallback), D6 (pilihan manual = HIGH_CONFIDENCE), + dua karangan B4 lagi yang ketahuan dari pengukuran (`BNI KCP <kota>`, `Wilayah <kota>`) | D2, D3, D6, B4 | âœ… 2026-09-21 â€” diukur nyata di browser dev: pipeline dijalankan atas 25 kota PTEN tanpa role mapping â†’ 152 baris, semuanya `organisasiTujuan`/`namaOutlet`/`wilayah`/`alurWondr` kosong, `is3RoleLengkap=true` 0 baris, `isFinalApproved=true` 0 baris, status hanya ANOMALI/PERLU_REVIEW |
| 13 | `src/utils/useTampilanTersimpan.ts` (baru), `AnalystResultsGrid.tsx`, `FinalDataManager.tsx` | A6: filter/pencarian/urutan/halaman bertahan saat pindah menu (sessionStorage). Dua setter sengaja tidak disentuh: `fase2Choice`/`fase3RoleChoice` karena kuncinya `id` baris yang berubah tiap run | A6 | âœ… 2026-09-21 â€” diuji nyata: "KCP" bertahan setelah pindah menu, 9 kunci sessionStorage terbentuk |
| 14 | `src/App.tsx`, `AnalystCanvas.tsx`, `AnalystResultsGrid.tsx` | A7: `phaseApproval.sisa` + tombol "N baris belum disetujui" yang menyaring grid ke baris belum setuju pada fase itu (dengan tombol lepas saringan) | A7 | âœ… build & tipe; klik pada data produksi BELUM diuji (butuh hasil analisa operator) |
| 15 | `src/components/WorkingEngine/AnalystResultsGrid.tsx` | A8: windowing dimatikan di tab Fase 2/3 (barisnya kartu tinggi tak seragam) | A8 | âœ… build & tipe; efek scroll BELUM diuji visual |
| 16 | `src/utils/analystPipeline.ts`, `AnalystResultsGrid.tsx`, `FinalDataManager.tsx`, `AnalystRowEditModal.tsx`, `pdfExport.ts` | B1: `coverage.mergedCities` + pesan fase + blok laporan cakupan. B2: `kodePosKelurahan` di baris, grid, sort, cari, ekspor Excel/PDF, modal Edit & Detail Final | B1, B2 | âœ… 2026-09-21 â€” dijalankan nyata di browser dev dengan 5 baris kodepos "Kota Bogor"+"Kabupaten Bogor"+"Kota Bandung": mergedCities=1 grup 4 baris, tiap baris bawa kode pos kelurahannya sendiri (16112/16121/16810/16811) sementara `kodePosPten` tetap 16121 |
| 17 | `src/components/Dashboard/IndonesiaBranchMap.tsx`, `src/styles/index.css`, `src/components/Topbar.tsx` | MAP-3/4/6/7/8 + ANI-1/2/3/4: reset pin saat data berubah, chip status kunci Google, panel anomali bisa ditutup/Esc, tile default OSM tanpa kunci, aria-label + tabindex peta, fade layer pin, ramp radius titik anomali, class `.bni-pop`, spinner geocoding yang selama ini diam (keyframes `spin` tidak pernah ada) | MAP, ANI | ✅ tipe/build/lint (83 warning, sama seperti baseline) + terukur di browser dev: chip "Google ✗", tile `openstreetmap.org`, aria-label & tabindex terpasang |
| 18 | `api/kodepos-geo.ts`, `src/utils/neonSync.ts`, `src/components/KodePosData/KodePosManager.tsx` | K4 (kode pos tak bersumber tidak ditawarkan ulang lagi) + K5 (angka Google terlihat di kartu) | K4, K5 | ✅ tipe/build/lint. ⚠️ `takBersumber` & filter baru di `ulang` baru berlaku setelah deploy Vercel; angka produksi sebelum deploy diukur dari `menungguUlang` |
| 19 | `src/utils/analystPipeline.ts`, `src/utils/recommender.ts`, `src/utils/normalizer.ts`, `src/utils/geoDistance.ts`, `AnalystResultsGrid.tsx` | C2a–C2e + C3 + C4: Fase 2 otomatis dihitung per kelurahan dengan mesin kandidat yang sama seperti layar (Rank-1 = skor lalu jarak nyata, KC menang dalam seri ≤2 km), penanda manual baru (`fase2Tier`/`fase2JarakKm`/`fase2Temuan`), gerbang auto-final ikut menolak baris bertemuan, cache `cleanText`/`stripAdminNoise`/`findCityCoord` + memo `matchesDati`/`matchesProvince` + `ALAMAT` target tidak lagi dihitung dari alamat cabang lama. B4 lanjutan: `Jl. Protokol No. n`, sandi `00n`, dan `Status Outlet: Aktif` dikosongkan | C2, C3, C4, B4 | ✅ 2026-09-21 — terukur di browser dev: 43 cabang asli Kota Bandung, 3 kelurahan → 3 outlet berbeda & rank-1 = terdekat; agregat 6 kota besar/985 baris: 90,6% baris berubah outlet, 0 anomali tier>1; biaya mesin 5,07 → 3,57 ms/baris (proyeksi ±5 menit untuk 83.762 baris) |
| 20 | `src/components/PTENData/PTENManager.tsx`, `src/components/RoleMapping/RoleMappingManager.tsx`, `src/components/WilayahData/WilayahManager.tsx`, `src/utils/analystPipeline.ts` | F2-P1 & F4-R1 (impor = tambah + dedup + laporan 3 bucket), F6-X5 (wilayah bawaan tidak lagi otomatis naik ke cloud), F1-W3 (kegagalan kirim cloud PTEN/Role dilaporkan), F1-W1 (Branch Code tak terbaca → penanda manual Fase 2) | F1, F2, F4, F6 | ✅ tipe/build/lint (83 warning = baseline) + terukur di browser dev dengan 2 cabang Kota Bandung |
| 21 | `src/components/WorkingEngine/AnalystResultsGrid.tsx`, `src/App.tsx` | **N3**: kolom checkbox di 4 tab fase + bar aksi massal (Setujui/Revisi di tab Berhasil; Setujui/Ganti Kab-Kota PTEN di tab Manual); pilihan disimpan sebagai `{tab, ids}` di sessionStorage; `handlePatchMassalAnalyst` baru supaya aksi besar tetap satu kali tulis array | N3 | ✅ `tsc` 0 error · lint 83 warning (baseline) · build ✓ · suite `tests/uji-*.mjs` LULUS. ⚠️ uji layar (3)(4)(5) belum dikerjakan: sesi dev saat ini menampilkan 0 data |
| 22 | `src/components/WorkingEngine/AnalystResultsGrid.tsx` | **N0** lanjutan: render `AnalystRowEditModal` + state `editingRow`/`isEditModalOpen` + importnya dilepas (tidak pernah terbuka), teks tab Manual yang masih menyebut "tombol Edit" diperbaiki, satu baris panduan "perbaiki di Data Master" di Fase 1-3 | N0 | ✅ `tsc`/build/lint; `grep AnalystRowEditModal src/` = 0 di luar file itu sendiri (file menunggu konfirmasi hapus → A10) |
| 23 | `src/utils/recommender.ts`, `AnalystResultsGrid.tsx`, `tests/entry-uji.ts`, `tests/uji-kandidat-tiga.mjs` (baru) | **M9**: tiga rekomendasi selalu muncul — slot yang kurang diisi cabang terdekat di luar zona SETELAH Rank ditetapkan; `CandidateOption.diLuarZona` + badge "LUAR ZONA"; audit nilai prefill hanya atas kandidat zona | M9 | ✅ 15 asersi LULUS; biaya terukur pada master 1.513 cabang: 2,2 ms/panggilan saat padding vs 5,75 ms tanpa padding |
| 24 | `AnalystResultsGrid.tsx`, `FinalDataManager.tsx` | **N1**: `width: 100%` → `max-content` pada dua tabel (sumber pemotongan = `overflow:hidden` pada `.modern-table td` yang membolehkan kolom dimampatkan); 4 elipsis terakhir diberi `title` berisi nilai penuh | N1 | ✅ terukur: elipsis tanpa tooltip di grid 4 → 0; `tsc`/build/lint hijau. ⚠️ belum discreenshot pada data nyata |
| 25 | hanya-baca ke production (`curl` GET) + `scratch/uji-duplikat-export.mjs`, `scratch/uji-kunci-kembar.mjs` | **C7**: selisih 83.764 vs 83.762 diukur sampai akar — cloud 83.762 di stats/baseline/export (0 `id` duplikat, JOIN geo tidak fan-out) sehingga +2 ada di IndexedDB browser; temuan baru: 15 pasangan baris kembar persis (kunci unik 83.747) | C7 | ✅ angka terukur 2026-09-22; penghapusan 15 baris TIDAK dijalankan (write ke produksi, menunggu keputusan pemilik produk) |
| 26 | `src/components/WorkingEngine/SinyalTemuanModal.tsx` | **E7**: modal sinyal menampilkan bukti per fase (chip F1/F2/F3 + kolom "Bukti per fase") alih-alih satu daftar gabungan `bitTemuanBaris`; penyaringan baris tetap union sehingga tidak ada temuan yang hilang | E7 | ✅ `tsc` 0 error · lint 83 warning (baseline) · build ✓. Belum discreenshot pada data nyata |
| 27 | verifikasi kode saja (`AnalystResultsGrid.tsx:754`, `:760`, `:775`, `:811`) | **B3**: ekspor multi-sheet sudah menomori ulang (1..n per sheet dan di sheet Summary) dan sudah mengecualikan `TIDAK_ANALISA` sebelum menomori → tidak ada perubahan kode | B3 | ✅ diverifikasi 2026-09-22, bukti di baris tabel Bagian 0 |
| 28 | `src/utils/normalizer.ts`, `src/utils/roleMatcher.ts`, `src/utils/analystPipeline.ts`, `tests/uji-akurasi-nama.mjs` | **E3**: penanda tipe unit jadi SATU aturan di semua jalur — daftar `UNIT_NOISE_TOKENS`/`UNIT_NOISE_SET` di normalizer dipakai `expertNormalize` (buang, bukan kembangkan) dan `normalizeBranchName` (regex dibangun dari daftar yang sama); `KC/KCB/KCP/KK/BO/SBO` keluar dari `THESAURUS_MAP`; bukti sinyal 2 + kartu teks sinyal 1/2/12 disesuaikan | E3 | ✅ **akurasi terukur naik 88,9% → 90,3% (65/72)**, salah gabung `KCP 001 ⟷ KCP 002` hilang, 5+2 sisanya tetap seperti yang tercatat; 5 suite LULUS, `tsc` 0 error, lint 83 warning (baseline), build ✓. **Ikut diperbaiki:** `uji-akurasi-nama.mjs` tidak pernah punya gerbang hasil (`exit 0` selalu) → sekarang 5 asersi + `process.exit`, jadi klaim "LULUS" suite itu sebelumnya memang tidak berbukti |
| 29 | `src/utils/analystPipeline.ts`, `src/components/WorkingEngine/AnalystResultsGrid.tsx` (komit `516fbad`, **isi tulisan sesi VSCode/Cline**) | Atas perintah pemilik produk "push semua kerjaan termasuk kerjaan vscode": wilayah fallback saat Branch Code tidak terbaca + `fase2Status`/`butuhManual` stage 2 dilonggarkan dari gerbang `temuanFase2` | C3/M1 (diperluas), N0 butir 4 (sebagian: kolom Kanwil tidak lagi kosong) | ⚠️ `tsc` 0 error · lint 83 warning (baseline) · build ✓ · **4 dari 5 suite LULUS, 2 GAGAL** (`uji-fase2-status.mjs` M7.4, `uji-kota-pten.mjs` "tetap perlu manual") karena pelonggaran itu. Tidak saya batalkan; jalan balik 1 token dicatat di baris E3 tabel status |
| 30 | `src/App.tsx`, `src/utils/analystPipeline.ts`, `src/components/WorkingEngine/AnalystResultsGrid.tsx`, `src/components/WorkingEngine/AnalystRowDetailModal.tsx` (baru), `tests/uji-fase2-status.mjs`, `tests/uji-kota-pten.mjs` | **N4**: persetujuan fase kini merantai ke run fase berikutnya (`barisDasar` eksplisit) sehingga Kanwil→Kode Cabang terisi sendiri tanpa tombol "Gunakan Cabang Ini"; `useEffect` scan-baris milik sesi VSCode dicabut (tidak pernah konvergen) tetapi pelonggaran `fase2Status`/fallback wilayah-nya TETAP sesuai perintah "bukan di kembalikan"; tab Fase 3 dipangkas jadi 8 kolom (role sticky + kartu Data Master Outlet), tab 4 jadi 19 kolom + 3 kolom "Validasi Fase 1/2/3" (`penjelasanFase2`/`penjelasanFase3` turunan, bukan field baru) + aksi Revisi/Detail/Setujui dengan modal detail read-only baru | N4, N0 butir 4, C3/M1 | ✅ `tsc` 0 error · lint 83 warning (baseline) · build ✓ · **5/5 suite LULUS** setelah 2 asersi lama (`PERLU_MANUAL` untuk cabang luar kota) disesuaikan jadi `OTOMATIS_VALID` + alasan di `fase2Temuan` — nilai baru itu hasil ukur run, bukan pelonggaran test. Belum: cek visual 3 tab pada data nyata (origin dev 0 baris) |
| 31 | `src/components/WorkingEngine/FinalDataManager.tsx`, `src/App.tsx`, `src/utils/neonSync.ts`, `api/target.ts`, `tests/entry-uji.ts`, `tests/uji-final-skip.mjs` (baru) | **N5**: menu Final Data dibangun ulang — struktur halaman standar (kartu judul + 4 kartu metrik + kartu tabel), 13 kolom `KOLOM_FINAL` jadi satu sumber kebenaran untuk layar/ekspor/template dengan warna kepala tabel sama seperti berkas (`#366092`/`#47D359`/`#E97132`, diukur per-piksel dari gambar operator), checkbox + aksi massal kembalikan & hapus lewat handler batch, sort asc/desc di semua header, "Lihat Semua" dengan windowing virtual, ekspor mengikuti filter wilayah dengan urutan asli data masuk, tombol Template Excel baru, `alert()` → notifikasi global; jalur cloud hapus massal POST `?view=final` `mode:'hapus'` (≤1000 kunci, parameter bertanda) | N5, G9 (diperluas), A1 (sisa), A6 | ✅ `tsc` proyek + `tsc -p api/tsconfig.json` 0 error · lint 83 warning (baseline) · build ✓ · **6/6 suite LULUS** (suite baru 26 asersi membuktikan baris final dilewati & kembali diproses setelah revisi). Biaya terukur 83.764 baris: filter wilayah 5–7 ms, sort 15–67 ms, pencarian 52–186 ms (deferred). Belum: cek visual + uji hapus massal ke Neon (butuh tulis) |
| 32 | `src/App.tsx`, `src/components/Dashboard/DashboardMatchTable.tsx`, `MetricCards.tsx`, `MatchCompositionDonut.tsx`, `RegionalAnalyticsCharts.tsx`, `IndonesiaBranchMap.tsx`, `src/components/Topbar.tsx`, `src/utils/normalizer.ts`, `src/utils/finalAnomaly.ts`, `src/utils/excel.ts`, `src/utils/pdfExport.ts`, `src/utils/finalColumns.ts` (baru), `tests/entry-uji.ts`, `tests/uji-anomali.mjs` (baru), `tests/uji-dashboard-angka.mjs` (baru) | **N6**: dashboard ditarik seluruhnya ke Data Final + Data Cabang (kartu 1 jadi TOTAL DATA FINAL + jumlah wilayah; `stats: MatchingStats`/`allTargetRows` dilepas), anomali diberi kategori **PROVINSI** sehingga "beda provinsi" ikut teruji per kategori, donut dihitung dari `primary` supaya irisan = total, tabel bawah jadi rekapitulasi Data Final dengan empat tombol menuju `exportFinalRowsToExcel`/`exportFinalRowsToPdf` (13 kolom sama seperti menu Final Data; kolom alamat duplikat di PDF lama dihapus), peta mode "ALL" menggambar **dua lapisan** (master + final) dan menampilkan penghitung "N baris Data Final belum terpetakan" alih-alih menjatuhkannya diam-diam, pil "Terhubung" tidak lagi memuat jam (tetap di tooltip), dan `formatWilayahName('Tanpa Wilayah')` tidak lagi menghasilkan "Wilayah Tanpa Wilayah" | N6, H1, H3, H4 (sebagian H5) | ✅ `tsc -b --force` 0 error · lint **83 warning / 0 error** (baseline tidak naik) · `npm run build` ✓ · **8/8 suite LULUS** — suite baru `uji-dashboard-angka.mjs` 17 asersi (round-trip kunci wilayah, tak ada baris hilang saat grouping, irisan donut = total, tombol Excel benar-benar menulis `Final_Data_Wilayah_7_*.xlsx` 2 baris). **Belum terverifikasi:** jalur PDF di Node (`jsPDF is not a constructor` di bundel `--ssr`, jadi suite menandainya LEWAT, bukan lulus — struktur 13 kolomnya tetap diuji); cek visual dashboard + klik unduh pada data nyata milik operator |
| 33 | `src/utils/analystPipeline.ts`, `src/components/WorkingEngine/AnalystResultsGrid.tsx`, `tests/uji-isi-otomatis.mjs` (baru), `scratch/ukur-jeda.mjs` (pengukur, sudah dihapus) | **N7**: kolom identitas Fase 2 dibuktikan sama dengan "Pilihan 1" kartu (suite baru 11 asersi, AO1 membandingkan kolom tiap baris vs rank-1 mesin yang dipakai grid) dan kolom kosong dikunci sebagai tanda "fase belum jalan" (`sampaiFase = 1` → `SIAP_DIPROSES`); jeda loop Fase 2 dipindah dari **per 50 kota** ke **per 150 baris** (loop `forEach` → `for`, `return` → `continue`) karena satu kota bisa membawa ribuan kelurahan; windowing tab Fase 2/3 dinyalakan lagi (250px + overscan 12) supaya "Semua (83.764)" tidak lagi memasukkan 83 ribu kartu ke DOM | N4 (dibuktikan), N7, A4, A8 | ✅ `tsc` 0 error · lint **83 warning / 0 error** (baseline) · build ✓ · **9/9 suite LULUS**. A/B terukur 18.000 baris Fase 2: jeda thread terpanjang **34,6 d → 2,8 d** dengan biaya total +12% (41,6 d → 46,5 d). Belum: rasa scroll "Semua" pada tab kartu di data nyata (butuh mata operator; tab yang dilaporkan bermasalah ternyata menjalankan bundle basi — reload lebih dulu) |
| 34 | `src/utils/analystPipeline.ts`, `src/components/WorkingEngine/AnalystResultsGrid.tsx`, `tests/uji-isi-otomatis.mjs`, `src/styles/index.css`, `index.html` | **N8 + N9**: `paketFase2` diangkat jadi `paketFase2DariMaster` yang diekspor dan dipakai **dua tempat** (pipeline menulis field, grid menampilkan kolom) sehingga kolom WILAYAH/SANDI CABANG/BRANCH CODE/KODE CABANG/NAMA OUTLET/STATUS/ALAMAT sudah terisi mengikuti kandidat ber-rank aktif **tanpa** menunggu Fase 2 selesai dan **tanpa** menekan "Gunakan Cabang Ini" — rank aktif ikut pilihan operator, lalu `userPrefilledAudit.matchedRank`, lalu 1; tidak ada field baru, tidak ada tulis ke baris. Fase 3 jatuh ke master kandidat aktif alih-alih "Cabang belum dipilih". Fallback lapis-3 `_p2Cand` dihapus karena ternyata identik dengan `f2Aktif`. Styling dikunci ke Velzon: Poppins 300–700 + mono sistem, radius 4/5px, `line-height: 1.5`, dan sidebar `#405189` 250px dengan item `#abb9e8` → pil putih `rgba(255,255,255,.15)` (aksen garis kiri dihapus), judul menu 11px uppercase `#838fb9`, brand 46px | N4, N7, N8, N9, H2 (sebagian), O (konflik dicatat) | ✅ `tsc -b --force` 0 error · lint **83 warning / 0 error** (baseline tidak naik) · `npm run build` ✓ · **9/9 suite LULUS**, `uji-isi-otomatis` naik jadi 13 asersi (`AO11` rumus grid == rumus pipeline untuk semua baris; `AO12` nilai tampil baris Fase 1 == nilai yang ditulis Fase 2 nanti). Terukur: `findClosestMasterRecommendation` **9,7 ms/baris** saat Dati II ada di indeks, **125 ms/baris** saat fallback — hanya dibayar untuk 60–72 baris jendela tampil dan di-cache per kelurahan. **Belum:** verifikasi visual Velzon (butuh mata operator; 154 hex unik / 419 pemakaian di luar token masih ada → N2), dan jalur ekspor Excel grid yang tetap menulis field baris mentah (konsisten begitu Fase 2 selesai) |
| 35 | `src/components/WorkingEngine/AnalystResultsGrid.tsx`, `src/App.tsx` | **N10 (kerja sesi agen lain 2026-09-22 ±19.00, dirapikan sebelum masuk `main`)**: kartu Fase 2 dipercepat dengan cache rekomendasi — `App.tsx` menggabung `phaseApproval` + `temuanSinyal` jadi satu lintasan O(N), windowing tab kartu diturunkan (mulai 20 baris, overscan 6, estimasi 180px) sehingga DOM ±3× lebih kecil, dan hasil `findClosestMasterRecommendation` (terukur **9,7 ms/baris**) disimpan. Tiga cacat pada versi awalnya ditutup: cache masih **di dalam body komponen** (map baru tiap render = tidak pernah mengenal), kunci cache **tidak memuat cabang yang sedang terpasang** (sesudah "Gunakan Cabang Ini" kartu lama tetap disajikan — mesin membaca `_originalFilledSandiCabang`), dan cache modul tidak ikut mati saat berkas master baru dimuat → sekarang `WeakMap` per `masterIndex` + kunci ikut `sandiCabang/namaOutlet/branchCode`; komentar windowing yang terpotong disambung lagi | N7, N8, A8 | ✅ `tsc -b --force` 0 error · lint **82 warning / 0 error** (turun 1 dari baseline 83) · `npm run build` ✓ · **9/9 suite LULUS** · ter-commit + ter-push sebagai `3dfbc61`. **Belum:** rasa scroll di data nyata (butuh mata operator) |
| 36 | `src/components/WorkingEngine/FinalDataManager.tsx`, `src/App.tsx` | **N12**: empat kartu metrik menu Final Data dihitung dari `tersaring`, bukan `rows` — sebelumnya angka besar selalu total seluruh tabel, jadi saat filter wilayah W01 membuat daftar kosong kartu tetap tertulis "75.694" dan terlihat seperti data tidak terhapus (footer sekarang menyebut total keseluruhan sebagai pembanding). Ditambah tombol **Reset Data**: `ConfirmDialog` sendiri ("Ya, Hapus Permanen") yang mengosongkan Final lokal (`analyst_final_data`) + cloud lewat `clearFinalInNeon()`, **tanpa** memindahkan baris ke Data Analyst — bedanya dengan "Kembalikan Semua" ditulis eksplisit di pesan dan tooltip | H5, N5 | ✅ `tsc` 0 error · lint **80 warning / 0 error** · build ✓ · 9/9 suite LULUS · terverifikasi di browser: kartu `0` saat baris `0`, tombol Reset Data tampil di header. **Belum:** klik Reset pada data nyata milik operator (aksi hapus permanen — jalankan sendiri) |
| 37 | `src/components/Dashboard/IndonesiaBranchMap.tsx`, `src/utils/geoTitik.ts` (baru), `src/App.tsx`, `tests/entry-uji.ts`, `tests/uji-dashboard-angka.mjs` | **N13**: titik peta tidak lagi berpatok satu parameter. Sebelumnya `titikKodePos[kodePosPten]` saja, jadi baris yang kode pos PTEN-nya tidak ada di tabel kode pos hilang dari peta. Sekarang: coba kode pos → kalau gagal, cocokkan **kelurahan + kecamatan** (kota sebagai pemecah lewat awalan, karena nama kota PTEN bisa berprefiks "KABUPATEN " atau terpotong kolom MAX 15) dan titiknya **tetap diambil dari tabel Data Kode Pos**, bukan geocoder. Kalau alternatifnya lebih dari satu dan tidak ada kota yang cocok → jangan menebak, barisan itu tetap dihitung belum terpetakan. `finalPins` dikelompokkan per titik hasil pencocokan (bukan per kode pos mentah), `finalBelumTerpetakan` + panel anomali + fly-to ikut aturan yang sama supaya angkanya tidak saling bertentangan. Helper murni pindah ke `utils/geoTitik.ts` supaya bisa diuji (leaflet tidak masuk bundel tes) | N6, P (peta) | ✅ `tsc` 0 error · lint **80/0** · build ✓ · **9/9 suite LULUS**, `uji-dashboard-angka` naik jadi 22 asersi (DA18–DA22 mengunci kunci & awalan kota). **Terukur di data produksi 2026-09-22:** dari sampel 2.000 baris final, 186 baris gagal lewat kode pos (2 kode: 37259 Tebo, 97554 Seram Bagian Timur); **25 dari 25** kelurahan yang dicek ulang ternyata punya titik di tabel kode pos dengan wilayah sama (contoh: final `37259` ↔ kodepos `37572` Kemantan/Tebo Ilir). **Belum:** angka "N belum terpetakan" versi baru pada data nyata milik operator |
| 38 | `src/App.tsx` | **N12 susulan (operator: "kok data final masih 75.694 padahal sudah direset"):** cloud terverifikasi **0 baris** (`GET /api/target?view=final` → `total:0`), jadi reset-nya berhasil — angka di sidebar adalah state tab yang belum dimuat ulang. Tapi di jalur muat awal ada aturan lama yang membuat reset mustahil bertahan: *"cloud kosong padahal browser punya hasil → tanamkan lagi sebagai salinan kedua"* (`App.tsx:328`), sehingga browser/tab lain yang masih menyimpan salinan lama langsung menghidupkan kembali 75 ribu baris. Sekarang reset menulis penanda `final_data_direset`; saat penanda itu ada, salinan lokal lama **dibuang** (dengan notifikasi) dan cloud tetap kosong. Penanda dihapus lagi begitu operator menyetujui hasil baru masuk Final | N12, A6 | ✅ `tsc` 0 error · lint **80/0** · build ✓ · 9/9 suite LULUS. **Belum:** uji silang dua browser (reset di A, muat ulang di B) pada data nyata |
| 39 | `server/sql.ts` (baru), `api/*.ts` (11 file), `src/utils/neonSync.ts`, `src/components/KodePosData/*`, `package.json` | **N14 — database pindah ke Supabase Postgres**: semua endpoint dulunya memanggil `neon(DATABASE_URL)` (driver HTTP khusus Neon). Ditambah satu lapis `buatSql()` berbasis `pg` di `server/sql.ts` — sengaja di luar `api/` supaya tidak menjadi route baru (aturan "jangan tambah file di api/") — lalu 11 endpoint diarahkan ke sana; 125 titik `sql\`\`` dan `sql.query(text, params)` tidak ditulis ulang karena bentuk hasilnya dibuat sama (array baris, plus properti `.rows`). Template literal diubah menjadi parameter `$1..$n`, bukan penggabungan string, supaya tidak ada celah injeksi SQL. Nama env tetap `DATABASE_URL` (isinya kini URL Supabase), dengan `SUPABASE_DB_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL` sebagai cadangan. `@neondatabase/serverless` dilepas. **Ikut terbaiki:** pemakai `sql.query()` yang meng-index hasil sebagai array (`rows[0].n` di kodepos-geo, `deleted.length` di `api/target.ts:285`) selama ini senyap bernilai 0 karena driver Neon mengembalikan objek. Teks yang tampil di layar diganti dari "Neon" ke "Supabase Postgres" / "Server menolak" | G9, P | ✅ `tsc -p api/tsconfig.json` 0 error · `tsc -b --force` 0 error · lint **80/0** · build ✓ · 9/9 suite LULUS. **Belum terverifikasi:** koneksi nyata ke Supabase — perlu `DATABASE_URL` baru di Vercel (password jangan ditempel di chat). Skema dibuat otomatis oleh 18 `CREATE TABLE IF NOT EXISTS` pada permintaan pertama; data harus diisi ulang (impor 5 menu master + crawl kode pos) karena Neon sedang 402 sehingga tidak bisa di-dump |
| 40 | `api/_db.ts` + `server/supabase-bootstrap.sql` (baru), `server/sql.ts` + `server/rest.ts` (dihapus), `api/*.ts` (11 file), `vite.config.ts`, `src/components/NeonDatabaseModal.tsx`, `src/utils/kodePosSync.ts`, `package.json` | **N15 — jalur B: akses Supabase lewat REST + kunci publik, tanpa kata sandi basis data** (pemilik produk memilih "jalur b" setelah N14 mentok butuh password DB). Pengganti `pg`/`DATABASE_URL`: PostgREST HTTPS ke `<project>/rest/v1` memakai **publishable key** (kunci publik; sudah dicatat sebagai bawaan di `server/rest.ts`, bisa ditimpa env `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`). Karena kunci publik **dilarang menjalankan DDL** (terukur: `GET /rest/v1/` → 401 "Only secret API keys…", `kodepos_data` → 404 PGRST205), seluruh SQL pindah ke `server/supabase-bootstrap.sql` — 11 tabel + index + **24 fungsi `SECURITY DEFINER`** (`kp_halaman`, `kp_stats`, `kp_options`, `kp_sync_meta`, `kp_sync_diff`, `kp_kosongkan`, `final_hapus`, `geo_*`, `base_*`, `koordinat_*`, `crawl_state_simpan`, `app_now`) + RLS + grant; harus ditempel **sekali** di Supabase SQL Editor. Endpoint jadi penipu-tipis: nama fungsi + argumen ternama, jadi **tidak ada jalur mengirim teks SQL bebas** dari luar; 149 titik `await sql` hilang. `api/status.ts` menolak jawab `connected:true` bila `app_now()` belum ada (gejala "database kosong" palsu seperti saat Neon 402 tidak terulang). Ikut dirapikan: middleware dev `vite.config.ts` yang selama ini **menyalin ulang** query kode pos (selisih diam-diam dengan produksi) dihapus 267→87 baris dan sekarang memuat fungsi `api/*.ts` yang asli lewat `ssrLoadModule` + shim `res.status().json()`; pesan "Neon" di layar diganti "Supabase" | N14, G9, P | ✅ **Diuji nyata, bukan perkiraan:** parser Postgres asli (WASM libpg_query + plpgsql) membaca seluruh bootstrap — **52 pernyataan, 0 error**, termasuk tubuh plpgsql dikompilasi dan fragmen SQL dinamis `kp_halaman` dirakit lalu di-parse; **probe hidup** `GET /api/status`, `/api/wilayah`, `/api/kodepos?view=stats` melalui dev server → balasan asli dari Supabase proyek `zhewnppsbfidzgihgnvn` ("Could not find the function public.app_now… jalankan server/supabase-bootstrap.sql") = jaringan + kunci + pemetaan error berfungsi, dandibuktikan publishable key diterima jalur `/rest/v1/*`. `tsc -p api` 0 · `tsc -b --force` 0 · lint **80/0** · build ✓ · 9/9 suite LULUS. **Belum:** operator menjalankan bootstrap di SQL Editor (satu-satunya langkah manual, tidak bisa dikerjakan dari sini), lalu isi ulang data (impor 5 menu master / Sync Data kode pos) karena proyek baru masih kosong dan Neon lama sedang 402 sehingga tidak bisa di-dump; `pg`/`@types/pg` dilepas dari `package.json` | **PENTING untuk sesi berikutnya (terukur 2026-09-23):** lapis REST sempat hidup di `server/rest.ts` dan semua fungsi mati diam di Vercel — `GET /api/status\|/api/wilayah` → 500 `FUNCTION_INVOCATION_FAILED` bahkan pada `OPTIONS` (gagal sebelum kode saya jalan), sedangkan `/api/geocode` (satu-satunya yang tidak mengimpor dari luar `api/`) tetap 200 dengan hasil nyata. Karena itu klien bersama sekarang wajib tinggal di dalam `api/` (`api/_db.ts`, rute `/api/_db` sengaja mengembalikan 405). Aturan "jangan tambah file di api/" ternyata punya sisi lain: **file di luar api/ tidak bisa diimpor oleh fungsi api/**.
| 41 | `api/*.ts` (10 file), `api/status.ts`, `server/rest.ts` + `api/_db.ts` + `api/rest.ts` (dihapus), `vite.config.ts` | **N16 — setiap fungsi `api/` harus berdiri sendiri (memperbaiki padam produksi yang disebabkan migrasi N15)**: setelah `50ae22c` semua `/api/*` balas 500 `FUNCTION_INVOCATION_FAILED` sementara `/api/geocode` tetap 200. Rantai penyebab diukur satu per satu lewat probe produksi, bukan dugaan — (a) `../server/rest` tidak ter-resolve → dipindah ke `api/_db.ts` (`b83f197`), ternyata file ber-prefix `_` tidak dirutekan Vercel; (b) diganti nama `api/rest.ts` (`e3da631`), deployment tidak pernah mendarat ⇒ **menambah file ke `api/` membuat build mati diam**; (c) klien ditumpang-tindihkan ke `api/status.ts` yang sudah ada (`723de7a`), deploy mendarat dan `/api/status` sehat tapi 9 rute lain tetap 500 ⇒ **impor relatif di DALAM `api/` juga gagal di runtime**; (d) solusi akhir (`768c38c`): satu blok "KLIEN MANDIRI" identik disalin ke 10 file fungsi. Ikut diperbaiki pada commit yang sama (`c9fd331`): aturan anomali ROLE hanya menilai baris yang sudah dianalisa (dulu TOTAL ANOMALI = seluruh baris, 83.764/83.764), notifikasi untuk setujui-kembali-revisi-hapus Data Final, dan "Kosongkan Semua" di PTEN/Role benar-benar mengosongkan cloud | N15, P | ✅ Produksi pulih: `GET /api/status`, `/api/wilayah`, `/api/kodepos?view=stats`, `/api/target?view=final&limit=1`, `/api/master?limit=1` semuanya balas JSON valid (isinya masih "table/function not found" = benar, skema belum dipasang). Tiga bug nyata hasil port REST ditemukan subagen audit kontrak dan diperbaiki: `hapus()` selalu minta representation (DELETE 83 ribu baris akan timeout), `semuaBaris()` COUNT per halaman + halaman serial dalam timeout 5 dtk (Master/Target terbaca kosong), dan loop ekspor 168 panggilan. **Batas keras untuk sesi berikutnya: jangan tambah file di `api/`, jangan pakai impor relatif di `api/`.** |
| 42 | `src/**` (38 file), `src/utils/excel.ts`, `src/utils/finalColumns.ts`, `src/utils/normalizer.ts`, `src/utils/roleRecommender.ts`, `src/utils/analystPipeline.ts`, `src/utils/storage.ts`, `src/App.tsx`, `tests/*` | **N17 — daftar terima 11 poin pemilik produk (2026-09-23), dikerjakan yang tidak butuh data**: **(desain Velzon)** 628 nilai di luar palet diluruskan ke token Velzon — warna Tailwind dipetakan ke hue Velzon yang sama (`#6366f1→#6559cc`, `#2563eb→#3577f1`, `#059669→#0ab39c`, `#dc2626→#f06548`, `#d97706→#d68b0c`, keluarga slate→abu Velzon), radius 7-16px→6px (.4rem), bayangan Tailwind xl→pola `vz-modal` / `--shadow-lg`, `fontFamily:'monospace'`→`var(--font-mono)`; abu Bootstrap dan teal gelap (dipakai sebagai teks di atas warna terang) sengaja dipertahankan. **(laporan)** 5 export menu master dulu menulis XLSX mentah dari paket `xlsx` biasa sehingga **tidak punya gaya sama sekali** — sekarang lewat satu jalur `tulisLembarExcel()` (xlsx-js-style + header berwarna + lebar kolom + autofilter); impor Excel PTEN/Role/Wilayah pindah dari `readAsBinaryString`+`type:'binary'` (sumber mojibake) ke `readAsArrayBuffer`+`type:'array'`; kolom ekspor analis jadi satu konstanta (`JUDUL_KOLOM_ANALYST`) karena sheet per-wilayah dan SEMUA_DATA selama ini punya kolom berbeda dan jumlah di notifikasi bukan jumlah yang terunduh; sel kosong `-` jadi kosong di berkas supaya bisa disaring "(Blanks)"; nama berkas pakai **tanggal lokal** (`toISOString()` UTC membuat unduhan setelah jam 17.00 WIB bernama tanggal besok). **(alert)** audit menyeluruh src/ menemukan 31 celah; sisanya ditutup: Reset Analisa lewat ConfirmDialog, Reset Cache ErrorBoundary dua-kali-tekan, Topbar "Simpan" melapor jumlah tulis, gagal tulis IndexedDB tak bisa lagi hilang tanpa suara (`setItem` mengembalikan boolean + mengirim event), "Isi Semua Patokan" minta konfirmasi, pencarian peta tanpa hasil melapor, tombol Revisi kota menjelaskan kenapa dialognya tidak terbuka. **(bug persistensi nyata)** (1) unggah berkas master mode `'replace'` selama ini masuk ke jalur append+dedup sehingga **data lama menang dan baris berkas baru dibuang diam-diam**; (2) `saveMasterToNeon()` dipanggil tanpa `await` di dalam `try/catch` ⇒ kegagalan cloud secara struktural tidak pernah bisa tertangkap; (3) `handleTargetLoaded` berjalan di dalam updater `setTargetRows()` (effect samping bisa jalan dua kali); (4) reset-standar PTEN/Role menyebut "berhasil" padahal cloud-nya gagal (`.catch(() => undefined)`). | P, F, M | ✅ Setiap batch diverifikasi terpisah: `tsc -b --force` 0 error · lint **80 warning / 0 error** (tidak berubah dari basis) · `npm run build` ✓ · **9/9 suite LULUS**, termasuk 6 asersi penjaga identitas baru yang terbukti GAGAL kalau penjaganya dimatikan (A/B) dan asersi auto-final yang dibuktikan dengan syarat-lama-sudah-terpenuhi. **Belum terverifikasi (butuh data):** poin terima 1, 3, 5-sisa, 9, 10, 11 — semuanya baru bisa diukur setelah skema dipasang dan menu terisi |
| 43 | `src/utils/normalizer.ts`, `src/utils/roleRecommender.ts`, `src/utils/analystPipeline.ts`, `tests/entry-uji.ts`, `tests/uji-mesin-role.mjs`, `tests/uji-fase2-status.mjs` | **N18 — dua cacat mesin pencocok yang mengubah hasil (temuan audit "algoritma manusia dalam menilai", poin terima #8)**: **(1)** kartu sinyal **13 "Penjaga Identitas" selama ini cuma tertulis, tidak pernah menilai** — `calculateUnifiedPrecisionScore()` satu-satunya pemilik dua penjaga itu TIDAK punya satu pun pemanggil di `src/` (terukur grep menyeluruh: hanya definisi `analystPipeline.ts:807`), sedangkan Fase 3 menaksir nama outlet lewat `roleRecommender.ts:378-405` yang hanya memakai `===`, `includes()` dan `textSimilarityScore >= 0,85`. Akibat nyata: outlet **"KCP BANDUNG 001"** dan record role **"BANDUNG 002"** (Jaro-Winkler 0,96, selisih panjang 0) naik ke skor 95 → keyakinan 90 → `EXACT_MATCH` → ikut auto-final. Penjaga dipindah ke `normalizer.benturanIdentitas()` (angka identitas + penanda arah, memakai `cleanText`/`hasDirectionalConflict` yang SAMA dengan pembanding lain supaya tidak menilai dua kali dengan normalisasi berbeda) dan dipasang di semua cabang fuzzy/includes Fase 3; baris yang ditolak kini `PERLU_REVIEW` dengan alasan tercatat di kartu 13, bukan diam-diam berlabel "hanya dekat jarak". **(2)** `fase2Status` murni "ada cabang Rank-1" sementara `isFinalApproved` menuntut status itu — jadi baris yang buktinya justru menunjukkan penempatannya SALAH (cabang di luar kota/provinsi, beda pulau, jarak > 150 km padahal satu kota, atau mesin buta nama) lolos sendiri ke Data Final tanpa pernah ditinjau. Ditambahkan penanda `penempatanSalah` yang menahan auto-final; `fase2Status` TIDAK diubah supaya keputusan `516fbad` (kolom cabang tetap terisi, warning tampil sebagai pill "Perlu diputuskan") tetap utuh | M1, D3, C3, E13, P | ✅ **Bukti uji, bukan perkiraan.** 6 asersi baru di `uji-mesin-role`: 3 di antaranya **terukur GAGAL saat penjaganya dimatikan** (A/B: `benturanIdentitas()` dinetralkan, suite dijalankan, lalu file dikembalikan dan diverifikasi identik lewat `diff`), jadi asersinya benar-benar mengawal — bukan hanya iya terhadap kode sekarang. Di `uji-fase2-status`: baris KAMPUNG BARU BARAT (Singkawang) kini `isFinalApproved: false`, dan asersi terpisah membuktikan semua syarat auto-final **lama** sudah terpenuhi padanya (`EXACT_MATCH` + `OTOMATIS_VALID` + `VERIFIED`) — jadi yang menahan adalah penjaga baru. `tsc -b --force` 0 error · lint tetap **80 warning / 0 error** · build ✓ · **9/9 suite LULUS**. **Catatan jujur yang masih buka:** `calculateUnifiedPrecisionScore()` (ensemble 13 sinyal + consensus) masih tanpa pemanggil — suara mesin untuk nama outlet kini memakai `textSimilarityScore` + penjaga, bukan consensus 6 mesin; menyambungkannya mengubah hasil massal dan baru layak diukur setelah ada data |
| 44 | 14 file komponen dihapus (`TargetDataGrid.tsx` 3.333 baris, `MasterUpload`, `MasterUploadModal`, `MasterDataGrid`, `TargetUpload`, `FilterToolbar`, `Navbar`, `AnalystRowEditModal`, `AnalystInsightsBanner`, `AuditLogTable`, `WilayahChart`, `ProximityGuideModal` + 2 yatim susulan `ExportAction`, `ProgressBar`) | **N19 — kode mati dihapus (perintah pemilik produk 2026-09-23)**: 12 file dinyatakan mati lewat grep importernya, lalu **diverifikasi ulang tepat sebelum hapus** (nol rujukan luar; satu-satunya kedekatan nama adalah `TargetUploadModal` yang HIDUP dan dipertahankan). Setelah hapus, analisis jangkauan dari titik masuk (`main.tsx`, `App.tsx`, worker, `api/*`, `tests/entry-uji.ts`) menemukan 2 file yang jadi yatim karena hanya dipakai file yang baru dihapus — ikut dihapus. Komentar `roleRecommender.ts` yang menyebut file kini-hilang diperbaiki agar tidak menyesatkan. `src/App.css` dan `src/index.css` (pertanyaan lama A9) TIDAK ikut terhapus — belum ada keputusan | A9, P | ✅ **6.129 baris hilang, nol perubahan perilaku — dibuktikan byte-identik**: nama hash DAN ukuran bundle produksi sebelum hapus (`index-DIunVTxX.js`, 1.418.475 byte) **sama persis** dengan hasil build sesudah hapus, karena file mati memang sudah dibuang tree-shaking (manfaatnya: repo & cek lebih cepat, bukan muat halaman). `tsc -b --force` 0 error · lint **turun dari 80 ke 60 warning** (20 warning memang milik file yang dihapus), 107 → 93 file · build ✓ 2,88 d · **9/9 suite LULUS** |
| 45 | `src/utils/kodePosSync.ts`, `api/kodepos-baseline.ts` | **N20 — tombol "Sync Data" mengisi patokannya sendiri** (permintaan operator 2026-09-23: "saya mau bisa dijalankan dari tekan button sync"). Penyebab terukur: `KodePosSyncModal.tsx:87` memanggil `runKodePosLiveSync` yang **hanya** kenal kodepos.id — situs yang diblokir Cloudflare pada IP datacenter — sedangkan penarik dump resmi Kemendagri (`pullKodePosBaseline` → `?view=fetch`) sudah ada di file yang sama tapi **terverifikasi tidak punya satu pun pemanggil**. Sekarang: (1) helper `pastikanPatokanTerisi()` membaca `?view=meta`, menilai lewat `alasanTarikPatokan` (kosong / di bawah 83.000 baris / lebih 30 hari), menarik dari GitHub, lalu **menolak hasil** kalau barisnya tetap di bawah lantai resmi; (2) kalau tabel kerja masih kosong (`dbRows:0` dan ada selisih) sync otomatis `importSemuaPatokan()` + `salinKoordinatPatokan()` lalu **membaca ulang diff** supaya angka di layar kondisi terakhir, bukan hitungan saya; (3) `runKodePosBaselineAudit` dihapus karena lipat ke jalur live (satu sumber kebenaran); (4) `?view=meta&probe=1` di `api/kodepos-baseline.ts` menambah `probeSumber()` — minta 1 byte (`Range: bytes=0-0`) dari 4 sumber, jadi pertanyaan "server ini dijangkau GitHub atau tidak" bisa diukur tanpa menulis ke database. Angka terukur lokal 2026-09-23: `wilayah.sql` 2.947.579 B + `wilayah_kodepos.sql` 2.435.281 B → 83.762 pasangan kode wilayah→kode pos, **83.202 baris lengkap 5 level nama**, 10.616 kode pos unik, parse+join 430 ms, `Access-Control-Allow-Origin: *`. Build: `tsc -b --force` 0 error · `tsc -p api` 0 error selain noise TS2591 · lint 60 warning/0 error (= baseline) · build ✓ · **9/9 suite LULUS**. **Belum diuji:** apakah IP Vercel diterima raw.githubusercontent (butuh deploy lalu `?view=meta&probe=1`) dan penekanan tombol oleh operator sendiri | kodepos, N20 | ✅ selesai (menunggu uji operator di produksi) |
| 46 | `api/kodepos-baseline.ts`, `src/utils/kodePosSync.ts`, `src/components/KodePosData/KodePosSyncModal.tsx` | **N21 — penyalinan patokan jadi bertahap (menutup kegagalan yang dilaporkan operator 2026-09-23).** Tekan pertama membuktikan separuh pertama berhasil: `kodepos_baseline` **83.762 baris / 10.632 kode pos unik / sumber "Dump resmi Kemendagri" / 18:39:34Z** — tapi langkah salin mati dengan `HTTP 500: canceling statement due to statement timeout`. Penyebab: Supabase memotong statement role `anon` (publishable key) pada ±8 detik, sedangkan `base_import_missing()` menyalin 83 ribu baris dalam SATU statement. Diperbaiki tanpa langkah manual di konsol: endpoint menerima `{ mulai, batas }` dan hanya memindahkan satu window (5.000 baris patokan urut `kode_wilayah`; insert dipecah per 1.000 — ukuran yang sudah terbukti di jalur `?view=fetch`), anti-joinnya memeriksa sebatas kode pos yang muncul di window itu lewat `idx_kodepos_kode`, dan `berikutnya` membuat penarikan yang terputus lanjut dari titik berhenti. `importSemuaPatokan()` di klien yang mengulang sampai selesai + melapor angka per tahap (dipakai jalur Sync dan tombol "Isi Semua Patokan"). **KOREKSI klaim saya di baris 45:** penyaring "nama tidak lengkap" ternyata menutup artefak pengukuran lokal — regex saya `[^']*` patah pada nama berapostrof (SQL menulis `''`), jadi 560 baris SANGKAAN tanpa nama; produksi membuktikan 83.762 baris semuanya bernama. Saringannya dibiarkan (penjaga murah) tapi angkanya dicabut. `base_import_missing()` tetap ada di SQL (sudah terpasang, tidak diubah) tanpa pemanggil. Build: `tsc -b --force` 0 error · `tsc -p api` 0 error · lint 60 warning/0 error · build ✓ · **9/9 suite LULUS**. **Belum terukur:** biaya satu statement insert 1.000 baris — itu baru ketahuan saat operator menekan tombol (sengaja tidak saya tulis ke produksi) | kodepos, N21 | ✅ selesai (menunggu tekan tombol operator) |
| 47 | `api/kodepos-baseline.ts` | **N22 — pengisian tabel kerja dipercepat ±9× (operator: "duh lama ini interval nya cuman seribu").** Terukur dari proyek ini: `GET /rest/v1/kodepos_baseline?limit=5000` **tetap membalas 1.000 baris** (`Content-Range: 0-999`) — `db-max-rows` Supabase memotong SETIAP balasan baca di 1.000, jadi "window 5.000" pada baris 46 diam-diam hanya memindahkan 1.000 baris dan pengisian penuh butuh 84 panggilan. Sekarang window dibaca sebagai 10 halaman 1.000 baris **paralel**, insert 2.000 baris/statement juga **paralel** (sebelumnya 5 statement berurutan), dan pemeriksaan "sudah ada" memakai `semuaBaris` karena satu kode pos bisa punya puluhan kelurahan kembar — tanpa itu jawaban 1.000 baris akan memotong daftar dan menyisakan duplikat. Window default naik ke 10.000 → ±9 tahap. `?view=fetch` tidak terpengaruh (batas itu hanya berlaku pada baca; tulis 500 baris/statement terbukti jalan). **Ikut diperbaiki:** batas ulang `importSemuaPatokan` 60 → 400 tahap — 60 itulah yang menghentikan pengisian pertama di baris ke-60.000, lalu tekan kedua berjalan tumpang tindih dan karena pemeriksaan "sudah ada" versi lama juga terpotong 1.000 baris, tabel kerja kini berisi **1.965 baris kembar persis dari 85.551** (terukur dengan mengunduh seluruh kunci kedua tabel: 83.586 baris unik; patokan sendiri 83.762 baris / 83.747 unik = 15 kembar, yaitu C7 yang sudah lama tercatat). Build: `tsc -p api` + `tsc -b --force` 0 error · build ✓ · 9/9 suite LULUS | kodepos, N22 | ✅ selesai |
| 48 | `api/kodepos-baseline.ts`, `src/utils/kodePosSync.ts`, `src/utils/neonSync.ts` | **N23 — satu tekan Sync Data kini menghasilkan baris yang SUDAH ada titik koordinatnya (permintaan operator: "saat klik sync, itu sudah sama koordinatnya … wajib bisa", sumber https://kodepos.co.id).** Sumbernya diukur dulu, bukan diasumsikan: `probe=1` di produksi membalas `titik_situs: 200` dan `titik_halaman: "2-x-11-enam-lingkuang: 98.719 byte, 3 desa berkoordinat, 220 ms"` — jadi situs titik TIDAK memblokir IP Vercel dan crawl penuh (7.277 halaman kecamatan) bisa dijalankan server, tidak lagi harus dari laptop. (1) `POST ?view=koordinat-crawl {mulai, jumlah}`: sitemap di-cache per instance 1 jam, halaman diambil paralel 8, **payload Next.js `self.__next_f` yang di-parse** (regex `DESA_RE` dipindah dari `tools/crawl-koordinat.mjs`; tabel HTML terpotong 25 desa), ditulis `500 baris/statement` paralel maksimal 5 lewat `simpan(..., {onKonflik:'kode_wilayah'})` yang sudah ada; window 800 halaman ≈ 20 d ambil + beberapa d tulis, aman di anggaran 60 d, ±10 panggilan untuk seluruh Indonesia. (2) `?view=import-missing` kini ikut menulis `latitude/longitude/sumber_koordinat/diambil_pada` (join pada `kode_wilayah`) **sejak penyalinan** — bukan menyusul lewat `koordinat_salin()`, yang harus memotong 85 ribu baris dalam satu statement dan pasti kena batas 8 detik role `anon`; `koordinat_salin()` tetap dipanggil sebagai penambal baris lama. (3) Kalau tabel kerja sudah terisi padahal titiknya nol, modal memerintahkan "Kosongkan Data lalu Sync sekali lagi" — **tidak ada penghapusan diam-diam**. (4) **Penyebab Data Cabang kosong ikut ketemu:** `saveMasterToNeon` mengirim SEMUA baris dalam satu permintaan dengan batas 8 detik sementara server menulis per 200 baris → master beberapa ribu baris selalu terputus dan melapor "GAGAL terkirim ke cloud"; kini dipecah 1.500 baris/permintaan (`replace` lalu `append`, sama seperti Target/Final) dengan batas 20 detik. Jalur baca `?view=master` terverifikasi sudah memakai `semuaBaris` jadi tidak terpotong `db-max-rows`. Build: `tsc -b --force` 0 error · `tsc -p api` 0 error · lint 60 warning/0 error · build ✓ · **9/9 suite LULUS**. **Belum terukur dari produksi:** durasi satu panggilan crawl 800 halaman dan jumlah titik akhir (perkiraan ±81.654 dari pengukuran penuh 2026-09-20) — keduanya baru terbaca setelah operator menekan tombol karena menulis ke `kodepos_koordinat` | kodepos, koordinat, master | ✅ selesai (menunggu tekan tombol operator) |
| â€” | `src/App.css`, `src/index.css` | A9 (sebagian): dua file CSS mati terverifikasi tidak diimpor siapa pun. **Penghapusannya tidak dilakukan** â€” diblokir kebijakan "jangan hapus file tanpa konfirmasi operator" | A9, A10 | â¸ menunggu konfirmasi |
Yang **belum** diuji pada sesi 2: (a) SQL `final_rows` terhadap Postgres sungguhan (butuh tulis ke Neon â†’ aksi operator), (b) kartu Titik Koordinat di UI produksi untuk label `coba ulang 2.813 kode pos`.

---

## BAGIAN M â€” FASE 2: PULIHKAN PEMBAGIAN â€œOTOMATIS TERVALIDASIâ€ vs â€œPERLU MANUALâ€

> Ditambahkan 2026-09-21 dari temuan produksi: tab Fase 2 menampilkan **Outlet Tervalidasi (0)** vs **Perlu Validasi Manual (84.136)** â€” 100% baris masuk manual, padahal alur lama punya pembagian otomatis/manual yang benar.  Status SEMUA item bagian ini: `SELESAI 2026-09-21` (M1–M7 di bawah; M2/M4 sudah lebih dulu selesai sebagai C2a/C2d) — kecuali **M9 (tiga pilihan selalu ada) yang baru ditambahkan & diselesaikan 2026-09-22**.

> **Hasil eksekusi:** field baru `fase2Status` (`OTOMATIS_VALID` | `SIAP_DIPROSES` | `PERLU_MANUAL`), `fase2Sumber` (`ATURAN_ACEH_KIM` | `OTOMATIS_TERDEKAT` | `TIDAK_ADA_CABANG` | `PILIHAN_OPERATOR`) dan `sinyalF2Bit` ditulis per baris di blok hasil; grid membaca `fase2Status` (bukan lagi "tidak masuk 3 rekomendasi"), `isFinalApproved` menuntut `OTOMATIS_VALID`, dan M5 membuat Fase 2 dinilai `calculateCityMatchScore` yang sama dengan Fase 1 (bit-nya ikut `bitTemuanBaris`). **Terukur jalan di Node** (`tests/uji-fase2-status.mjs`, pipeline asli dipanggil, 6 kasus M7): Aceh → `ATURAN_ACEH_KIM` + OTOMATIS_VALID; Braga → ASIA AFRIKA; Coblong → DAGO (dua baris beda, keduanya valid); kota tanpa cabang → PERLU_MANUAL dengan alasan; Fase 2 belum dijalankan → semua SIAP_DIPROSES, **nol** manual; manual 1 dari 4 baris. Semua hijau: `tsc -b --force` 0 error · build ✓ · lint 83 warning (baseline) · `tests/uji-mesin-role.mjs` 13/13 ✓.
>
> **Sisa yang jujur:** angka akhir "Perlu Validasi Manual" pada 84 ribu baris data operator belum terukur — butuh jalankan ulang Analisa (browser in-app diblokir kebijakan sesi ini).

### M0 â€” BUKTI & AKAR MASALAH (jangan diubah tanpa membaca ini)

**Alur lama memang punya 3 keranjang** (`TargetDataGrid.tsx:132-148`, komponen sudah tidak dipasang):

```ts
const isRowMatched      = (r) => Boolean(r._isMatched || matchedNoSet.has(String(r.No).trim()));
const matchedRows       = rows.filter(isRowMatched);                                         // OTOMATIS VALID
const unmatchedRows     = rows.filter((r) => !isRowMatched(r) && r._matchLevel === 'none'); // MANUAL
const pendingUploadRows = rows.filter((r) => !isRowMatched(r) && r._matchLevel !== 'none'); // MENUNGGU
```

Audit di alur lama hanya **informasi**: `_originalFilled*` diisi dari **kolom Excel pengguna** (`TargetUploadModal.tsx:72-91`) dan pesannya cuma ditampilkan (`TargetDataGrid.tsx:1596`; `recommender.ts:708-838`).

**Yang rusak di alur baru (3 sebab sekaligus):**
1. Status otomatis/manual sekarang ditentukan **audit isian vs Top-3** (`AnalystResultsGrid.tsx:248-265` -> `fase2ValidCities`), bukan hasil pencocokan.
2. Audit **berhenti lebih awal** bila isian kosong (`recommender.ts:719-721` return `undefined`) -> kalau Fase 2 belum dijalankan, **tidak ada satu pun kota yang lolos** -> semua baris ke â€œPerlu Validasi Manualâ€.
3. `_originalFilled*` sekarang diambil dari **auto-fill pipeline sendiri** (`AnalystResultsGrid.tsx:229-230`), sedangkan auto-fill memakai **cabang kota pertama** (`analystPipeline.ts:1972-1981`, sumber `masters[0]` di `:1022-1024`) â€” bukan Rank-1 terdekat. Dua mesin berbeda -> audit hampir selalu gagal -> manual semua.

### M1 — ATURAN STATUS BARU FASE 2 (3 kategori, WAJIB)

| Kategori | Kriteria (cukup salah satu) | Perlakuan UI |
|---|---|---|
| **OTOMATIS VALID** | (a) `fase2Sumber === 'ATURAN_ACEH_KIM'`; atau (b) cabang terpasang = kandidat **Rank-1** hasil engine; atau (c) kode pos + kelurahan + kecamatan baris **sama persis** dengan baris cabang master | masuk tab **Outlet Tervalidasi**, tanpa aksi manual |
| **SIAP DIPROSES** | kolom Fase 2 masih kosong (`branchCode` dan `namaOutlet` kosong) = Fase 2 belum dijalankan | tampil di tab utama dengan CTA **Jalankan Fase 2**; BUKAN kategori manual |
| **PERLU MANUAL** | mesin ragu (kriteria di M6) | tab **Perlu Validasi Manual** — jumlahnya harus jauh lebih kecil dari 84.136 sekarang |

**Eksekusi:**
1. `src/utils/analystPipeline.ts` — tambah field `fase2Status` dan `fase2Sumber` pada `AnalystRow` saat baris dibentuk (blok ekspansi hasil, sekitar `:1965-2005`).
2. `src/components/WorkingEngine/AnalystResultsGrid.tsx` — ganti penentu manual untuk `stage === 2` (sekarang di `:478` memakai `!fase2ValidCities.has(cityMatchKey(r.groupKota))`) menjadi fungsi **per baris**: `fase2StatusOf(r)`.
3. Hapus ketergantungan pada `fase2ValidCities` (`:248-265`) atau pertahankan hanya sebagai informasi tambahan (bukan penentu tab).

### M2 — AUTO-FILL FASE 2 HARUS = RANK-1 TERDEKAT (P0)

- **Sekarang:** `analystPipeline.ts:1972-1981` menulis `wilayah/sandiCabang/sandi/cabang/branchCode/kodeCabang/namaOutlet/statusOutlet/alamat` dari `rawFase2` (= `kimAceh || raw`), sedangkan `raw` adalah **baris master pertama kota itu** (`masters[0]`, `:1022-1024`).
- **Perbaikan:** untuk baris **non-Aceh**, ambil **Rank-1** dari engine yang sama dengan layar (`findClosestMasterRecommendation`) lalu tulis field Fase 2 dari kandidat itu; set `fase2Sumber = 'OTOMATIS_TERDEKAT'`.
- **Efek:** isi otomatis menjadi identik dengan rekomendasi → kriteria M1(b) terpenuhi → tidak lagi masuk manual.

### M3 — ATURAN ACEH ke KIM = OTOMATIS VALID (P0)

- Aturan sudah deterministik di dua tempat: `analystPipeline.ts` (`isAcehRegion` + `findKimBranch`) dan `recommender.ts:436-487` (Rank-1 KIM, skor 99).
- **Perbaikan:** baris dengan `fase2Sumber = 'ATURAN_ACEH_KIM'` langsung diberi `fase2Status = 'OTOMATIS_VALID'`, dengan alasan yang tampil di UI, misalnya: **Aturan khusus: seluruh Aceh dilayani Cabang KIM** — dan TIDAK dihitung sebagai Perlu Validasi Manual.
- **Uji:** baris Aceh (contoh di layar: `Tegal Sari III`, `Medan Area`, Branch `60100664`) harus otomatis valid.

### M4 — HITUNG PER KELURAHAN, BUKAN PER KOTA (P1)

- **Sekarang:** `AnalystResultsGrid.tsx:251` (`if (!ck || m.has(ck)) return;`) membuat 1 rekomendasi untuk seluruh kota, dan gate manual juga per kota (`:478`).
- **Perbaikan:** kunci cache = `makeFinalKey(kodePosPten, kelurahan, kecamatan, kotaPten)` (atau `r.id`); hitung `fase2Status` dan rekomendasi **per baris**.
- **Uji Bandung:** baris **Braga** → Pilihan 1 Asia Afrika; baris **Lebak Siliwangi** → Pilihan 1 **Dago**. Dua baris WAJIB berbeda hasilnya.

### M5 — 12 SINYAL HARUS BEKERJA DI FASE 2 (P1)

- **Sekarang:** Fase 2 memakai `textSimilarityScore` + `hasDirectionalConflict` + `findSharedStreetOrLandmark` (`recommender.ts:237-422`) — bukan ensemble 12 sinyal + 2 penjaga.
- **Perbaikan:** nilai kandidat Fase 2 dengan `calculateUnifiedPrecisionScore` (ada di `analystPipeline.ts`), lalu simpan bitmask buktinya ke field baru `sinyalF2Bit` pada `AnalystRow`.
- Lengkapi `bitTemuanBaris` (sekarang `sinyalBit | sinyalRoleBit`) agar ikut menyertakan `sinyalF2Bit`, supaya panel sinyal 1-13 mencakup temuan Fase 2.
- Catat ambang yang dipakai di komentar agar konsisten dengan Fase 1/3 (bukti bit 0,75; terima 0,88; strongVotes 0,85).

### M6 — KRITERIA PERLU MANUAL YANG SEHAT

Baris masuk manual HANYA bila salah satu terpenuhi:
1. kota baris **tidak ada** di Master Cabang (jalur Tier-2 lintas kota),
2. jarak kandidat terbaik **> ambang** (usul 16 km) — tampilkan angkanya di UI,
3. kandidat terbaik **beda pulau** (kecuali aturan Aceh/KIM),
4. **seri** dua kandidat atau lebih tanpa cabang KC (aturan seri ≤ 2 km: `roleRecommender.ts:424-434`),
5. `distanceKm === null` DAN nama tidak mendukung.

Di luar itu — termasuk baris Aceh dan baris yang cabangnya sudah Rank-1 — **wajib** otomatis valid.

### M7 — CHECKLIST UJI WAJIB (qoder)

| # | Kasus uji | Harapan |
|---|---|---|
| 1 | Baris Aceh (`Tegal Sari III`, Medan Area) | Otomatis valid, alasan “Aturan Aceh ke KIM” |
| 2 | Bandung / Braga | Otomatis valid, cabang = Asia Afrika |
| 3 | Bandung / Lebak Siliwangi | Otomatis valid, cabang = **Dago** (bukan Asia Afrika) |
| 4 | Kota yang tidak ada di Master Cabang | Masuk Perlu Validasi Manual, alasan “kota tidak ada di master” |
| 5 | Fase 2 belum dijalankan | Semua baris di kategori **SIAP DIPROSES** (bukan manual) |
| 6 | Bandingkan angka | “Perlu Validasi Manual” jauh lebih kecil dari 84.136 |

### M9 — TIGA PILIHAN SELALU ADA, TERMASUK BARIS MANUAL (status `SELESAI 2026-09-22`)

> Permintaan pemilik produk 2026-09-22: "cek ya **jika yang manual itu harus muncul 3 rekomendasinya**" — di layar, baris tertentu hanya menampilkan "Pilihan 1".

**Akar masalah (hasil baca kode, bukan dugaan tampilan):** `recommender.ts` memotong pool lebih dulu — Tier 1 = cabang sekota (Dati II), Tier 2 = seprovinsi HANYA kalau Dati II kosong, Tier 3 = semua — lalu `topList = scored.slice(0, 3)`. Jadi kota yang cuma punya 1-2 cabang unik di Master memang menghasilkan 1-2 kartu kandidat. Bukan bug render.

**Perbaikan:** setelah Rank ditetapkan, slot yang kurang diisi cabang TERDEKAT di luar zona (`index.all`, diurutkan bobot `selisih kode pos + penalti 100.000 untuk provinsi lain`), dengan tiga jaminan:
1. **Rank 1 tidak pernah berubah** — padding terjadi setelah `scored.sort()` dan hanya menambah indeks ≥ jumlah kandidat zona, jadi seluruh `fase2Status`/`fase2Sumber`/auto-fill Rank-1 tidak tersentuh.
2. **Jujur di layar** — alasannya berbunyi "Cabang terdekat di luar kota ini (hanya N cabang sekota tersedia di Master) — nilai ini keputusan operator, bukan hasil otomatis mesin", skor dipatok 20%, dan kartu pilihan menampilkan badge **LUAR ZONA** + tooltip.
3. **Audit nilai prefill hanya atas kandidat zona** (`candidates.slice(0, jumlahZona)`), supaya cabang tambahan tidak pernah bikin nilai lama user terbaca "cocok dengan rekomendasi sistem".

**Terukur** (`tests/uji-kandidat-tiga.mjs`, 15 asersi, semua LULUS): kota 2 cabang → 3 pill (ranks 1-2 zona, rank 3 `diLuarZona`); prioritas provinsi sama menang atas cabang provinsi lain yang kode posnya lebih dekat; tidak ada outlet kembar; kota 1 cabang → 1 zona + 2 ditandai; master cuma 1 cabang → tetap 1 pilihan (mesin tidak mengarang); target tanpa kode pos → tidak crash, Rank 1 sama.

**Biaya (terukur, `scratch/uji-kecepatan.mjs`, master 1.513 cabang):** baris yang memicu padding **2,2 ms/panggilan**, baris kota ramai tanpa padding **5,75 ms/panggilan** — jalur padding justru lebih murah karena pool zonanya kecil, jadi tambahan biaya netto nol pada 83 ribu baris.

**Belum diuji di layar:** jumlah pill yang tampil pada data produksi (butuh hasil analisa nyata di browser operator).

### M8 — FILE YANG DISENTUH

- `src/utils/analystPipeline.ts` — auto-fill Rank-1, `fase2Status`, `fase2Sumber`, `sinyalF2Bit`, per-kelurahan
- `src/utils/recommender.ts` — ensemble 12 sinyal untuk Fase 2, urutan KC (seri ≤ 2 km), Tier-2 diurut jarak km, **M9: padding kandidat luar zona + flag `CandidateOption.diLuarZona`**
- `src/components/WorkingEngine/AnalystResultsGrid.tsx` — gate 3 kategori per baris, hapus ketergantungan `fase2ValidCities`, **M9: badge "LUAR ZONA" + tooltip pada pill & kartu kandidat**
- `tests/entry-uji.ts` (+`findClosestMasterRecommendation`, `buildMasterProximityIndex`), `tests/uji-kandidat-tiga.mjs` baru (15 asersi M9)
- dokumen ini — Bagian 0 dan Bagian M

---

## BAGIAN N — ATURAN EDIT/REVISI & TABEL YANG TIDAK TERPOTONG

> Ditambahkan 2026-09-21 atas permintaan pemilik produk. Status per bagian: **N0 SELESAI 2026-09-22** (butir 4 belum), **N1 SELESAI 2026-09-22** (kontrol densitas ditunda dengan alasan), **N3 SELESAI 2026-09-22**, N2 masih `BELUM`.

### N0 — ATURAN PRODUK: FASE 1/2/3 TIDAK ADA EDIT, HANYA REVISI (status `SELESAI 2026-09-22` — keenam butir)

**Aturan:**
- Di dalam Data Analyst (Fase 1, 2, 3) **tidak ada Edit field**. Yang tersedia hanya **Revisi** (mengembalikan baris agar diproses ulang) dan aksi kandidat (pilih cabang / terapkan role).
- **Edit data** hanya di menu **Data Master** (Data Wilayah, Data PTEN, Data Cabang, Data Mapping Role, Data Kode Pos). Jika ada salah analisa, perbaiki di master lalu jalankan ulang analisa.

**Kondisi sekarang (bukti kode):**
- Tombol Edit masih ada di grid: `AnalystResultsGrid.tsx:1943` (ikon `Edit` + teks Edit).
- Modal edit masih terpasang: import di `:38`, render di `:2051` (`AnalystRowEditModal`).
- Revisi sudah ada: tombol `RotateCcw` menuju `setConfirmManualRow(r)` yang menandai `perluManual: true`.

**Sudah dikerjakan 2026-09-22:**
- Butir 1 ✅ tombol Edit di Fase 1 dan Fase 2 dihapus (Fase 3/`all` memang tidak pernah punya Edit); ikon `Edit` tidak di-import lagi.
- Butir 2 ✅ render `AnalystRowEditModal` + state `editingRow`/`isEditModalOpen` + importnya dihapus dari grid — modal itu **tidak pernah bisa terbuka** (tak ada satu pun `setIsEditModalOpen(true)`), jadi tidak ada perubahan yang hilang. File `src/components/WorkingEngine/AnalystRowEditModal.tsx` kini tidak di-import siapa pun (`grep -rn AnalystRowEditModal src/` = 0 di luar file itu sendiri) dan **menunggu konfirmasi pemilik untuk dihapus** — dimasukkan ke daftar A10.
- Butir 3 ✅ `onUpdateRow` dipertahankan; pemakai yang tersisa sekarang hanya 4 jalur yang diizinkan aturan: `applyFase2Candidate` (`:285`), `applyFase3Role` (`:324`), Setujui per baris (`:2167-2169`), dan konfirmasi Revisi (`:2417`).
- Butir 5 ✅ keterangan dipasang di bawah banner langkah Fase 1-3: "Salah data? Perbaiki di menu Data Master lalu jalankan ulang fase ini — di sini hanya ada Setujui dan Revisi, tidak ada edit field."
- Butir 6 ✅ diaudit: `CandidateDetailModal` dan `CityOverrideModal` tidak menulis field baris dari dalam fase (yang pertama read-only, yang kedua hanya menyimpan override kota yang memang aksi resmi N3).
- Butir 4 ✅ `SELESAI 2026-09-22` — tombol **`Data Cabang`** (ikon `Store`) dipasang di sel aksi baris **hanya pada tab Perlu Analisa Manual** (`AnalystResultsGrid.tsx`, blok aksi): prop baru `onBukaMasterCabang` dari `App.tsx` memanggil `setActiveTab('master')` yang memang me-render `CabangManager`. Tidak ada field edit yang ditambahkan — pintunya navigasi, bukan input. Hasil: `tsc` 0 error · lint 83 warning (baseline) · build ✓. Belum diklik di browser (butuh data nyata + pindah menu saat hasil analisa terbuka; state analisa sudah persist lewat IndexedDB jadi tidak hilang).

**Uji:** buka Fase 1/2/3, tombol Edit tidak ada; tombol Revisi tetap ada; mengubah data hanya bisa dari menu Data Master. → **Terbukti di kode** (jumlah `Edit` di grid = 0; `tsc -b --force` bersih, `npm run lint` 83 warning / 0 error, `npm run build` sukses 2026-09-22). Belum diklik pada data nyata karena sesi browser lokal sedang 0 data.

**Eksekusi:**
1. Hapus tombol Edit dari blok aksi baris pada grid (blok `{innerTab === BERES && (...)}` sekitar `:1887-1960`).
2. Hapus import `AnalystRowEditModal` (`:38`) dan blok render-nya (`:2051`), lalu hapus file `src/components/WorkingEngine/AnalystRowEditModal.tsx` bila `grep -n AnalystRowEditModal src/` menghasilkan 0.
3. Pertahankan `onUpdateRow` karena masih dipakai untuk: terapkan kandidat Fase 2 (`applyFase2Candidate`), terapkan role Fase 3 (`applyFase3Role`), tombol Setujui per baris, dan konfirmasi Revisi.
4. Ganti fungsi Edit dengan navigasi ke menu master: tambahkan tombol kecil **Buka Data Cabang** (ikon `Store`) pada baris yang Perlu Manual, memanggil handler navigasi ke tab `master` (tambahkan prop bila belum ada di grid).
5. Tambahkan keterangan kecil di header tab Fase 1-3: **Salah analisa? Perbaiki di Data Master lalu jalankan ulang fase ini.**
6. Audit jalur edit lain: `CandidateDetailModal`, `CityOverrideModal`, `AnalystRowEditModal` — pastikan tidak ada yang menulis field baris dari dalam fase; bila ada, jadikan read-only atau arahkan ke master.

**Uji:** buka Fase 1/2/3, tombol Edit tidak ada; tombol Revisi tetap ada; mengubah data hanya bisa dari menu Data Master.

### N1 — KOLOM TABEL TERPOTONG (nilai tidak muncul semua) — status `SELESAI 2026-09-22` untuk pemotongan; kontrol densitas sengaja ditunda (lihat catatan)

**Akar masalah terukur (bukan 24 lokasi acak):** `.modern-table td` di `src/styles/index.css:848-856` memakai
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Menurut CSS 2.1 ukuran minimum otomatis sel
tabel HANYA berlaku kalau `overflow: visible` — jadi begitu `overflow: hidden` dipasang, browser boleh
**memampatkan kolom** sampai tabel muat `width: 100%`. Itulah sebabnya nilai hilang tanpa bisa dibaca,
dan itu terjadi di SEMUA kolom teks sekaligus, bukan per kolom.

**Perbaikan yang dipakai (aturan pemilik produk: sel satu baris, jangan dilipat, geser horizontal):**
- `AnalystResultsGrid.tsx:1494` dan `FinalDataManager.tsx:320`: `width: '100%'` → `width: 'max-content'`
  (+ `minWidth` lama dipertahankan). Tabel tidak pernah lebih sempit dari isi kolomnya; wadah
  `.table-container` (`overflow: auto`) yang menambah scroll horizontal. Tidak ada lagi elipsis pada
  kolom data, dan offset kolom sticky Fase 2 (0 / 34px / 74px) tetap akurat karena kolom tidak bisa menyusut.
- 4 elipsis yang memang disengaja (di luar kolom data) kini semua punya `title` berisi nilai penuh:
  alasan Fase 1 (`:1735`), banner audit nilai prefill (`:1816`), dan judul kartu kandidat
  `Sandi Cabang • Nama Outlet — ALAMAT` (`:1952`).
  **Terukur:** elipsis tanpa tooltip di grid = 4 → 0 (semua 5 lokasi `textOverflow: 'ellipsis'` kini
  ber-`title`; 2 lokasi di antaranya satu elemen yang sama dengan yang lain).
- Kelas `.modern-table` TIDAK diubah global: 19 tabel di 8 menu memakainya, dan Bagian ini hanya
  menuntut tabel Data Analyst + Final. Perubahan global menunggu Bagian O.

**Aturan 4 (kontrol densitas Ringkas|Normal|Lebar) — DITUNDA dengan alasan.** Setelah `max-content`,
satu-satunya sisa "terpotong" adalah lebar tabel yang memang harus digeser; tiga mode densitas hanya
mengubah skala font/padding dan justru bertabrakan dengan Bagian O yang menetapkan SATU skala token
(12/14/16 + grid 4px) dan tinggi baris resmi 40px/32px. Menambah saklar densitas sekarang berarti
membuat dua sumber kebenaran tampilan yang harus diruntuhkan lagi saat O dikerjakan. Keputusan ini
bisa dibalik oleh pemilik produk kalau setelah O dijalankan tabelnya masih terasa sesak.

**Cara menguji (butuh data nyata di browser operator):** Fase 1/2/3 dan Final — arahkan kursor ke kolom
mana pun yang isinya panjang (ALAMAT, ORGANISASI TUJUAN, Kelurahan); nilainya harus tampil penuh di
layar, dan kalau belum, tooltip `title` menyebut isinya lengkap; tabel boleh digeser horizontal, sel
tidak boleh melipat jadi dua baris.


**Rencana awal (audit statis 2026-09-21, dipakai sebagai latar saja).** Aturan 2 lama minta kolom teks
bebas dilipat maksimal 2 baris — **dibatalkan** oleh aturan pemilik produk "sel tabel harus satu baris,
teks panjang menggeser tabel, tidak dilipat". Angka lokasi pada daftar di bawah juga sudah bergeser.
- 24 pola pemotongan di `AnalystResultsGrid.tsx` (hasil grep `textOverflow`, `whiteSpace: nowrap`, `overflow: hidden`).
- Contoh lokasi: `:1496`, `:1573`, `:1583`.
- Header Fase 1 memakai lebar tetap (`:1298-1308`): No 40px, Wilayah 70px, Sandi 85px, Branch Code 90px, Kode Pos 75px, Kode Pos PTEN 100px — sehingga nama/alamat panjang terpotong.

**Penyebab:**
1. `whiteSpace: nowrap` + `textOverflow: ellipsis` **tanpa** atribut `title` sehingga nilai panjang tidak bisa dibaca sama sekali.
2. Lebar kolom tetap untuk kolom teks bebas (Nama Outlet, ALAMAT, ORGANISASI TUJUAN, Kelurahan, Kecamatan, Kota).
3. `maxWidth` pada sel alamat tanpa izin wrap.
4. Kolom sticky menyita lebar pada layar kecil.

**Aturan perbaikan (wajib):**
1. Kolom **kode/identitas** (No, Kode Pos, Kode Pos PTEN, Branch Code, Kode Cabang, Sandi): tetap `nowrap` + `font-variant-numeric: tabular-nums`.
2. Kolom **teks bebas** (Nama Outlet, ALAMAT, ORGANISASI TUJUAN, Kelurahan, Kecamatan, Kota/Kab, Metode Penempatan, alasan status): `whiteSpace: normal`, `wordBreak: break-word`, maksimal 2 baris, dan WAJIB punya `title` berisi nilai penuh.
3. Setiap sel yang masih memakai `textOverflow: ellipsis` **wajib** punya `title`; jika tidak, ubah menjadi wrap.
4. Tambah kontrol densitas di toolbar: **Ringkas | Normal | Lebar** yang mengubah lebar minimum kolom teks; simpan pilihan di `sessionStorage`.
5. Pastikan scroll horizontal punya indikator tepi (bayangan) dan kolom kunci tetap sticky (No + Kelurahan) supaya konteks tidak hilang saat digeser.
6. Uji dengan nilai terpanjang yang nyata: Nama Outlet `ARRAHAKIM KIM`, ALAMAT panjang, ORGANISASI TUJUAN pola `X BRANCH OFFICE - Y SUB BRANCH`, kecamatan panjang seperti `OGAN KOMERING ULU TIMUR`.

**Eksekusi:** `src/components/WorkingEngine/AnalystResultsGrid.tsx` (definisi kolom + sel) dan `src/styles/index.css` (kelas bantu: `.cell-wrap`, `.cell-code`, `.cell-num`, `.table-density-compact`, `.table-density-normal`, `.table-density-wide`).

### N3 — Checkbox "pilih semua" di SEMUA tab Fase 1/2/3/4 (permintaan pemilik produk 2026-09-22, status `SELESAI 2026-09-22` — uji 3/4/5 masih butuh data nyata di browser)

**Aturan:** di setiap tabel fase (Fase 1, 2, 3, dan tab 4/Ditandai Manual) harus ada kolom checkbox per baris + satu checkbox di header untuk memilih semua, lalu baris yang terpilih dapat diaksi massal. Aksi yang tersedia BERBEDA menurut tab tempat baris itu berada:

| Tab | Aksi massal untuk baris terpilih |
|---|---|
| **Berhasil Dianalisa** (semua tab fase) | `Revisi` dan `Setujui` |
| **Perlu Analisa Manual / Perlu Validasi Manual** | `Setujui` dan `Ganti Kab/Kota PTEN` |

**Cara eksekusi (rencana awal):**
1. `AnalystResultsGrid.tsx` — state `barisTerpilih: Set<string>` (kunci `r.id`), kolom `<th>` checkbox di header SETIAP `viewTab` (fase1/fase2/fase3/fase4) + `<td>` checkbox di body tiap tab; jangan cuma satu tab.
2. Checkbox header = pilih/batalkan **semua baris yang sedang tampil** (`filteredRows` setelah filter+search, bukan seluruh `rows`) — dan harus ikut berubah saat pindah halaman. Simpan seleksi di `useTampilanTersimpan` supaya tidak hilang saat pindah menu (pola A6).
3. Bar aksi massal muncul hanya saat `barisTerpilih.size > 0`, menampilkan `N baris terpilih`, tombol aksinya, dan `Batalkan pilihan`.
4. Aksi dipasang ke handler yang SUDAH ada, jangan bikin jalur tulis baru: `Setujui` = `approveRow`/alur "Setujui semua" per baris; `Revisi` = `setConfirmManualRow(r)`; `Ganti Kab/Kota PTEN` = `CityOverrideModal` (satu modal untuk banyak baris: terapkan `cityOverrides[kota] = kotaPten` lalu analisa ulang kota itu — jangan satu per satu).
5. Konfirmasi massal WAJIB lewat `ConfirmDialog` (A2) dan menyebut jumlah baris + akibatnya; jangan pakai `window.confirm`/`alert`.
6. Aksi massal tidak boleh menaikkan akurasi mesin: baris hasil keputusan manusia tetap `HIGH_CONFIDENCE` (D6), dan `isFinalApproved` otomatis tidak berubah karena pilihan massal.

**Yang benar-benar dipasang (3 menyimpang dari rencana, semua disengaja):**
- Butir 1 ✅ — 1 `<td>` checkbox dipakai bersama di semua tab (`AnalystResultsGrid.tsx:1666`) + 4 `<th>` checkbox, satu per `viewTab` (`all`/`fase1`/`fase2`/`fase3` di `:1497`, `:1520`, `:1552`, `:1591`). Di tab Fase 2 kolom pilihan ikut **sticky** (`left:0`, `No` digeser ke 34px, kandidat ke 74px) karena tabel itu wajib di-scroll horizontal — kalau tidak, checkbox hilang dari layar begitu operator menggeser ke kolom rekomendasi.
- Butir 2 ⚠ diubah — "pilih semua" memakai **`paginatedRows` (baris pada halaman yang tampil)**, bukan `filteredRows`. Alasannya: dengan page size `Semua`, `filteredRows` = 83 ribu baris, dan satu klik "pilih semua" lalu "Setujui" akan menulis 83 ribu baris sekaligus. Pengecualian: saat operator memang memilih `Semua`, `paginatedRows === filteredRows` jadi perilakunya tetap seperti yang diminta.
- Butir 2 ⚠ diubah — seleksi TIDAK lewat `useTampilanTersimpan` (hook itu hanya membaca kunci saat mount, jadi kunci dinamis per-tab tidak akan pernah terbaca). Dipakai state `{ tab, ids }` di `sessionStorage` kunci `tampilan.analyst.terpilih`, dengan `tab = viewTab|innerTab`. Efeknya persis aturan: bertahan saat pindah menu (komponen di-unmount), **kosong otomatis saat pindah tab fase atau pindah Berhasil↔Manual**, dan hilang saat tab browser ditutup.
- Butir 3 ✅ — bar aksi hanya muncul saat ada baris terpilih di halaman ini; jumlahnya dibaca dari `barisTerpilih.length` (id dari tab/halaman lain tidak mungkin teraksi).
- Butir 4 ⚠ berubah — `Setujui` massal TIDAK boleh `onUpdateRow` per baris: handler itu `prev.map()` atas SELURUH hasil untuk SATU baris, jadi 500 centang = 500 × 83.762 pemindaian + 500 tulis debounced (tab membeku). Ditambah satu jalur batch `handlePatchMassalAnalyst(rowIds, patch)` di `App.tsx:980` (satu `setAnalystRows`, satu tulis) yang dipakai `Setujui` dan `Revisi` massal; patch-nya persis kolom yang ditulis tombol per baris (`fase1Approved`/`fase2Approved`/`fase3Approved`/`isFinalApproved`/`perluManual`). Di tab manual, `Setujui` tetap `onBersihkanManual(ids)` yang sudah batch. `Ganti Kab/Kota PTEN` membuka `CityOverrideModal` untuk kota pertama dari pilihan; kalau pilihan mencakup >1 kota, label tombol menyebut jumlahnya dan modal perlu dibuka ulang per kota (override kota memang berlaku per kota, bukan per baris).
- Butir 5 ✅ — Revisi massal lewat `ConfirmDialog` dengan jumlah baris + akibatnya; tidak ada `window.confirm`/`alert` baru.
- Butir 6 ✅ — aksi massal hanya menulis kolom persetujuan/flag manual yang sama dengan tombol per baris; `statusAnalisa`, `confidenceScore` dan sinyal mesin tidak disentuh, jadi tidak ada kenaikan akurasi palsu.

**Hasil uji:** (1) jumlah `type="checkbox"` di grid = 5 = 4 header + 1 body → terverifikasi dari kode; (2) pilih-semua = `paginatedRows.length` halaman itu → terverifikasi dari kode; (6) kosong saat pindah tab & bertahan saat pindah menu → terverifikasi dari kode (kunci tab di `sessionStorage`). Butir (3) Setujui massal pindah tab, (4) Revisi massal mengembalikan baris, dan (5) Ganti Kab/Kota massal mengulang analisa kota **belum diukur** — sesi browser lokal saat ini menampilkan 0 data (Neon `Offline`, belum ada hasil analisa di origin `localhost:5173`), jadi tidak ada baris untuk diklik. `npx tsc -b --force` bersih, `npm run lint` 83 warning / 0 error (baseline), `npm run build` sukses, 4 suite `tests/uji-*.mjs` LULUS.

**Sisa untuk pemilik produk:** buka Data Analyst dengan data terisi, lalu centang → jalankan (3), (4), (5) di atas dan catat angkanya.



### N4 — ISI OTOMATIS ANTAR FASE + URUTAN KOLOM TAB FASE 3 & DATA FINAL (permintaan pemilik produk 2026-09-22, status `SELESAI 2026-09-22` untuk kode — uji visual masih milik operator)

Tiga permintaan dari tiga tangkapan layar:

**Butir 1 — "Kanwil sampai Kode Cabang harus sudah terisi otomatis mengikuti rekomendasinya, tanpa klik 'Gunakan Cabang Ini'".**
Akar masalahnya BUKAN di mesin: probe `scratch/probe-isi-otomatis.mjs` membuktikan engine menulis seluruh kolom Fase 2 (`wilayah`, `sandiCabang`, `branchCode`, `kodeCabang`, `namaOutlet`, `statusOutlet`, `alamat`) begitu run berjalan dengan `sampaiFase >= 2` — dengan maupun tanpa koordinat. Yang terjadi: `handleApproveAnalystFase` hanya menandai `faseNApproved: true` dan TIDAK pernah menjalankan fase berikutnya, jadi tab Fase 2/3 dibuka dengan kolom kosong dan satu-satunya jalan mengisi adalah klik per baris.
Yang dipasang (`src/App.tsx`):
- `handleStartAnalystPipeline(reRunAnomaliesOnly, overrides, sampaiFase?, barisDasar?)` — parameter ke-4 wajib saat dipanggil tepat setelah persetujuan: `analystRows` di closure masih array SEBELUM persetujuan, jadi tanpa `barisDasar` persetujuan yang baru diberikan akan tertimpa hasil run.
- `handleApproveAnalystFase(fase)` sekarang merantai: `if (fase < 3) void handleStartAnalystPipeline(false, undefined, fase + 1, baru)`. Setujui Fase 1 → kolom Fase 2 terisi; setujui Fase 2 → kolom Fase 3 terisi. Persetujuan lama tetap dibawa lewat `persetujuanLama` + `makeFinalKey`.
- Kerja sesi VSCode (`516fbad`) **tidak dikembalikan** (perintah eksplisit "bukan di kembalikan"): `fase2Status` longgar dan fallback `wilayah` dipertahankan. Yang dicabut hanya `useEffect` di grid yang men-scan seluruh baris tiap render lalu memanggil `applyFase2Candidate` — ia tidak pernah konvergen karena `sandiCabang` baris ditulis dari `Sandi + Cabang` sementara pembandingnya hanya membaca kolom `'Sandi Cabang'` master, akibatnya tab menulis ulang tanpa henti. Penggantinya adalah rantai engine di atas (kolom diisi MESIN, bukan efek React).
- Konsekuensi aturan longgar itu: 2 asersi test lama menuntut `PERLU_MANUAL` untuk cabang luar kota/provinsi. Nilai nyata sekarang `OTOMATIS_VALID` dengan alasan tetap tercatat di `fase2Temuan` — asersi disesuaikan (`uji-fase2-status.mjs` M7.4, `uji-kota-pten.mjs`) + kolom Validasi Fase 2 melabelinya `TERPASANG, PERLU DICEK` supaya warning tidak hilang diam-diam.

**Butir 2 — tab Fase 3 hanya 8 kolom, urutan: Rekomendasi Mapping Role · Data Master Outlet · Kode Pos · Kelurahan · Kecamatan · Kota/Kab · Provinsi · Aksi (Setujui, Revisi).**
`AnalystResultsGrid.tsx` blok `viewTab === 'fase3'`: kolom role dijadikan tiang pertama **sticky** (`left:34px`, 420px — perlakuan yang sama seperti kolom kandidat Fase 2), kolom kedua `Data Master Outlet` memakai kartu bergaya identik dengan kandidat terpilih Fase 2 (badge Cabang Fase 2 + KC/KCP + jarak, Sandi Cabang • Nama Outlet, chip Branch + wilayah, baris Kel/Kec/Dati II dengan centang "sama", alamat) dan dibaca dari `masterByBranchCode.get(r.branchCode)`. Kolom yang dibuang: No, Nama Outlet (sudah di dalam kartu), Kanwil, Sandi Cabang, Branch Code, Kode Cabang, Status Outlet, ALAMAT, ORGANISASI TUJUAN, Tipe Unit, Sales, Verifikator, Penyetuju, Rekomendasi Alur Wondr, Pegawai — isinya tidak hilang, semuanya pindah ke jendela Detail. Checkbox massal (N3) tetap dan ikut sticky.

**Butir 3 — tab 4 "Data Final (Semua Atribut)" 19 kolom + data wajib hasil analisa fase 1/2/3.**
Urutan yang diminta operator ternyata PERSIS urutan ekspor Excel `handleExportExcel` (`'No','Wilayah','Sandi Cabang','Branch Code','Kode Cabang','Nama Outlet','Status Outlet','ALAMAT','KODE POS','Kelurahan','Kecamatan','Dati II','Provinsi','KOTA PTEN','KODE POS PTEN', …`) — jadi tabel kini cermin ekspor, dan tiga kolom sisanya dibuat sebagai validasi:
- `penjelasanFase2` & `penjelasanFase3` baru di `src/utils/analystPipeline.ts` (murni turunan field yang ada, TIDAK disimpan sebagai field — aturan "tampilkan saja"), satu bentuk dengan `penjelasanFase1`: `{ label, alasan, nada }`.
- Sel `SelValidasi` di grid: badge hasil + satu baris alasan terpotong elipsis (judul tooltip penuh). Fase 2 membaca sumber cabang (otomatis/operator/aturan Aceh), zona sekota–sepulau–luar provinsi, jarak, dan `fase2Temuan`; Fase 3 membaca kelengkapan role 3/3 vs parsial (sebut role yang belum ada) + jumlah pegawai + alur Wondr.
- `Dati II` sengaja mengikuti ekspor (= `kotaPtenMax15 ‖ kotaPten`, bukan nama kota Data KodePos) supaya tabel dan berkas sama; bedanya dengan Data KodePos ditandai warna oranye + disebut di tooltip. `KODE POS` ikut aturan ekspor (`kodePosKelurahan ‖ kodePosPten`).
- Aksi jadi **Revisi → Detail → Setujui** (semua berlabel teks di tab ini). Tombol `Detail` membuka `src/components/WorkingEngine/AnalystRowDetailModal.tsx` baru: satu section per fase berisi seluruh atribut yang dibaca mesin + badge hasil fase + status persetujuan. Read-only — aturan N0 (koreksi data di menu Data Master, bukan di grid) tidak dilanggar; `AnalystRowEditModal.tsx` lama tetap yatim.

**Terukur:** `npx tsc -b --force` 0 error · `npm run lint` 83 warning / 0 error (baseline) · `npm run build` ✓ · **5 dari 5 suite `tests/uji-*.mjs` LULUS** (setelah 2 asersi disesuaikan dengan aturan Fase 2 yang baru, bukan karena kodenya dilonggarkan).
**Belum terukur:** tampilan visual ketiga tab pada data nyata — origin dev sesi ini menampilkan 0 baris (Neon `Offline` di profil browser), jadi tinggi baris, lebar kolom sticky, dan kartu Fase 3 belum diukur dengan `Range.getClientRects`. Aksi operator: jalankan Fase 1 → Setujui, lalu pastikan kolom Kanwil…Kode Cabang terisi sendiri tanpa klik apa pun, dan cek tab 4.



### N5 — MENU FINAL DATA: JAMINAN "SUDAH FINAL TIDAK DIULANG", UI STANDAR, KOLOM & EKSPOR (permintaan pemilik produk 2026-09-22 — status `SELESAI 2026-09-22` untuk kode; cek visual milik operator)

Sembilan permintaan, semua di menu **Final Data** (`FinalDataManager.tsx`), bukan tab 4 Data Analyst.

**0) "kalau kode pos sudah ada di Data Final, dia tidak boleh dieksekusi lagi, kecuali dikembalikan (revisi)" — TERBUKTI.**
Mesin sudah punya gerbangnya: `executeAnalystPipeline(..., excludeFinalKeys, ...)` melewatkan baris yang kuncinya ada di `finalRows` (`analystPipeline.ts:2148`, `return` sebelum `results.push`), dan `App.tsx` menghitungnya dari `finalRows` saat run dimulai. Yang belum ada adalah **buktinya** — sekarang ada: `tests/uji-final-skip.mjs` (26 asersi, suite ke-6):
- run pertama 4 kelurahan → 4 baris; kunci keempatnya dijadikan Final → run kedua **0 baris**, `coverage.skippedFinalRows = 4`;
- satu kunci dilepas (simulasi Revisi) → hanya kelurahan itu diproses lagi, sisanya tetap lewat, dan barisnya masuk sebagai **Fase 1 belum disetujui** dengan cabang terpasang otomatis;
- kelurahan kembar `KALIJATI` beda kecamatan TIDAK ikut "sudah final" (kunci 4 bagian `makeFinalKey` bekerja).

**1) Halaman standar (judul + card + data table) seperti menu Wilayah/PTEN.** Struktur lama: semuanya di dalam satu `glass-card`. Sekarang tiga blok sama seperti `PTENManager`: kartu judul (ikon 42px + `section-title` + subteks angka + 4 tombol aksi) → `metrics-grid` 4 kartu (Total / Wilayah / KC-KCP / 3 Role) → kartu tabel (`filter-toolbar` + `table-container`). Empty state ikut dirapikan (ikon + kalimat + tombol). `alert()` yang masih tersisa di menu ini diganti notifikasi global (sisa A1).

**2) Kolom & warna header sesuai gambar yang dilampirkan.** 13 kolom: `No, Wilayah, Sandi Cabang, Branch Code, Kode Cabang, Nama Outlet, Status Outlet, ALAMAT, KODE POS, Kelurahan, Kecamatan, Dati II, Provinsi` + `Aksi (Detail, Revisi, Hapus)`. Warna header **diukur per-piksel** dari gambar (`scratch/baca-warna-png.mjs`): navy `#366092` (7 kolom identitas), hijau `#47D359` (ALAMAT/KODE POS/Kelurahan/Kecamatan/Provinsi), oranye `#E97132` (Dati II) — sama persis dengan yang sudah dipakai `getHeaderStyle()` di `utils/excel.ts`, jadi berkas Excel memang sudah benar sejak awal dan **kepala tabel di layar kini memakai warna yang sama**. Sumber kebenaran tunggal: `KOLOM_FINAL` dipakai tabel, ekspor, dan template (tak bisa lagi beda).
- Menu baru **Template Excel**: unduh berkas berkepala warna + 1 baris contoh, kolomnya sama dengan yang dibaca `parseFinalExcelRow` saat unggah.

**3) & 4) Checkbox + aksi massal.** Kolom checkbox di header (pilih semua baris yang tampil) + bar aksi muncul saat ada pilihan: **Kembalikan ke Data Analyst** dan **Hapus Terpilih**, dua-duanya lewat `ConfirmDialog` dengan jumlah baris. Jalur tulisnya batch: `handleReviseFinalRows(ids)` / `handleDeleteFinalRows(ids)` di `App.tsx` — satu `setFinalRows` + satu `setAnalystRows` + satu tulis IndexedDB, bukan N kali.
- Cloud: satu jalur baru **POST `?view=final` body `{mode:'hapus', keys:[...]}`** (≤1000 kunci, di-chunk 500 oleh `deleteFinalKeysInNeon`). Sengaja lewat POST, bukan DELETE ber-body, karena parsing body DELETE tidak dijamin platform; kunci dikirim sebagai parameter `$1..$n` (tidak ada injeksi SQL). **Belum diuji ke Postgres nyata** — butuh tulis ke Neon, itu aksi operator.

**5) Ikon urut asc/desc.** Tiap header kolom bisa diklik: `ChevronsUpDown` (belum diurutkan) → `ArrowUp` → `ArrowDown`; ada tombol "Urutan asli" untuk melepas sort. Urutan sort disimpan di `sessionStorage` (pola A6).

**6) Ringan + bisa lihat semua.** Pemilih "Tampilkan" 25/50/100/**Lihat Semua**; saat Semua, `useVirtualWindow` (ambang 200 baris) hanya merender baris yang terlihat — sama seperti grid Data Analyst. Biaya JavaScript diukur pada 83.764 baris (`scratch/uji-kecepatan-final.mjs`): filter wilayah **5–7 ms**, sort **15–67 ms**, pencarian **52–186 ms** (dan dijalankan lewat `useDeferredValue`, jadi ketikan tidak menunggu), peta nomor urut **75–96 ms** (hanya saat daftar baris berubah).

**7) Ekspor mengikuti filter wilayah.** Tombolnya menyebut lingkupnya (`Export Excel (Semua)` / `(W07)`) dan nama berkasnya menyertakan lingkup + tanggal.

**8) Urutan ekspor = urutan data masuk.** `tersaring` dibangun dari `rows` tanpa sort (filter saja), nomor `No` ditulis ulang 1..n pada urutan itu, dan sort layar **tidak** dipakai untuk ekspor. Kolom `No` di layar pun menampilkan **nomor masuk asli** (`nomorAsli`), bukan posisi hasil sort — jadi baris tidak pernah "bertukar" meski layarnya sedang diurutkan.

**9) Berkas rapi.** Satu jalur `applyStandardSheetStyle` (header berwarna, Calibri 10, border tipis, lebar kolom per nama kolom, tinggi header 26pt) — dipakai ekspor maupun template.

**Terukur:** `tsc` proyek 0 error · `tsc -p api/tsconfig.json` 0 error · lint **83 warning / 0 error** (baseline) · build ✓ · **6 dari 6 suite `tests/uji-*.mjs` LULUS**.
**Milik operator:** buka menu Final Data dengan data nyata — cek warna kepala tabel, tinggi baris, aksi massal (kembalikan & hapus), "Lihat Semua" pada 83 ribu baris, hasil unduh template/ekspor, dan sinkronisasi cloud setelah aksi massal (butuh Neon).

### N6 — MENU DASHBOARD: SEMUA ANGKA DARI DATA FINAL + CABANG, PETA DUA LAPISAN, UNDUHAN HIDUP (permintaan pemilik produk 2026-09-22 — status `SELESAI 2026-09-22` untuk kode; cek visual milik operator)

Lima permintaan: (1) semua data terpetakan, (2) parameter anomali benar-benar berjalan, (3) unduhan Excel/PDF di bawah tabel disesuaikan, (4) label jam pada pil "Terhubung" disembunyikan, (5) jumlah di dashboard harus nyata.

**Akar masalah (bukan salah hitung, tapi campur sumber).** Dashboard lama menggabungkan dua dunia: kartu 1 / grafik wilayah / tabel bawah membaca **`targetRows`** (berkas unggah alur lama), sedangkan kartu anomali, donut dan peta membaca **`finalRows`** hasil analisa. Pada kondisi produksi terukur (`GET api/target.ts`: `masterRecords:0, targetRecords:7475, finalRecords:0`) itu berarti sebagian widget melaporkan berkas unggah yang sudah tidak dipakai operator, dan sisanya melaporkan 0. Keputusan pemilik produk: **ganti semua ke Data Final + Cabang** — inilah penutup item **H3**.

**1) Sumber tunggal + kunci wilayah.** `App.tsx` kini menurunkan segalanya dari `finalRows`/`masterRows`: `finalWilayahCounts`, `dashboardFilteredRows`, `regionalStats`, `finalMetrics` dan `dashboardKomposisi` memakai satu fungsi kunci `kunciWilayah()` (bentuk kanonik `W07`). Bug yang diperbaiki di sini: perbandingan `"W1"` vs `"Wilayah 1"` membuat filter wilayah selalu kosong, dan baris tanpa wilayah kehilangan barisnya di tabel karena `formatWilayahName('Tanpa Wilayah')` menghasilkan `"Wilayah Tanpa Wilayah"` (now idempotent di `normalizer.ts`). Prop `stats: MatchingStats`/`allTargetRows` dilepas dari `MetricCards` dan `DashboardMatchTable` — tidak ada lagi jalur kembali ke alur Target.

**2) Anomali.** Satu definisi: `detectFinalAnomalies(finalRows, masterRows)` di `utils/finalAnomaly.ts` dipakai kartu TOTAL ANOMALI, donut, dan panel peta — bukan tiga salinan aturan. Aturan **beda provinsi** ditambahkan (kategori `PROVINSI`, di luar pengecohan pulau, dengan pengecualian Aceh yang sama seperti aturan pulau), sehingga "keluar pulau" dan "beda provinsi" sama-sama teruji per kategori (`tests/uji-anomali.mjs`, 14 asersi). Donut sekarang menghitung dari `a.primary` sehingga **irisan + bersih = total baris** (teruji DA9).

**3) Unduhan bawah tabel.** `DashboardMatchTable` jadi rekapitulasi **Data Final per Wilayah** dan empat tombolnya diarahkan ke eksportir Data Final: `exportFinalRowsToExcel(rows, wilayah)` (`utils/excel.ts`) dan `exportFinalRowsToPdf({wilayahLabel, rows, totalRows})` (`utils/pdfExport.ts`) — 13 kolom yang sama dengan menu Final Data, bukan lagi kolom alur Target. Laporan PDF lama mencetak `ALAMAT` dua kali (kolom "Alamat Cabang Master" dan "Alamat Target" membaca field yang sama); kolom duplikat itu dihapus. Eksportir lama `exportCleanMatchedToExcel`/`exportMatchedDataToPdf` tidak lagi dipakai dashboard.

**4) Peta dua lapisan.** `displayScope === 'ALL'` dulu hanya menggambar pin cabang master, sehingga "semua data termapping" tidak pernah benar. Sekarang ALL = `[...allPins, ...finalPins]` dan labelnya menyebut keduanya (`Master + Final (n)`). Baris final yang **tidak** bisa digambar (kode posnya belum punya titik koordinat) tidak lagi hilang diam-diam: `finalBelumTerpetakan` dihitung dan jumlah + sebab + jalurnya (menu Data Kode Pos) tampil di dropdown tampilan peta.

**5) Label jam.** Pil koneksi `Topbar.tsx` cukup berbunyi "Terhubung" / "Offline"; jam sinkronisasi tetap ada di tooltip-nya (pola hemat teks: keterangan cukup di tooltip, bukan di label).

**Terukur:** `tsc -b --force` 0 error · lint **83 warning / 0 error** (baseline tidak naik) · `npm run build` ✓ · **8 dari 8 suite LULUS**, termasuk suite baru `tests/uji-dashboard-angka.mjs` (17 asersi: round-trip kunci wilayah, wilayah tanpa baris hilang, irisan donut = total, dan tombol Excel benar-benar menulis berkas 2 baris bernama `Final_Data_Wilayah_7_*.xlsx`).
**Belum terverifikasi di Node:** jalur PDF. `exportFinalRowsToPdf` memakai `new jsPDF(...)` yang di bundel `--ssr` Node gagal sebagai CJS-interop (`jsPDF is not a constructor`) — suite menandainya `LEWAT`, bukan lulus. Struktur kolomnya tetap diuji (13 judul, tidak ada duplikat). Bukti tidak langsung: menu Data Analyst sudah mencetak PDF lewat konstruksi jsPDF yang sama di browser.
**Milik operator:** buka menu Dashboard dengan data nyata — kartu 1 harus menyebut TOTAL DATA FINAL, peta pada mode "Master + Final" menampilkan kedua lapisan, dan tombol Excel/PDF per wilayah menghasilkan berkas yang bisa dibuka.

### N7 — TAB FASE 2: KOLOM KOSONG vs TAB BEKU (laporan operator 2026-09-22, screenshot KOLAKA / 19 November / Wundulako)

Keluhan: "kanwil sampai kode cabang harusnya terisi otomatis mengikuti rekomendasi, tanpa klik Gunakan Cabang Ini" + "pastikan tidak ada lag, berat data saat load" (tab menampilkan dialog *This page isn't responding*).

**Penyebab kolom kosong — BUKAN mesinnya.** Kolom identitas Fase 2 (`r.wilayah`, `r.sandiCabang`, `r.branchCode`, `r.kodeCabang`) ditulis pipeline dari Rank-1 (`paketFase2(r1.master)`), sedangkan kartu "Pilihan 1" dihitung grid sendiri (`fase2Recs`). Keduanya memakai mesin yang sama (`buildMasterProximityIndex` + `findClosestMasterRecommendation`), dan itu sekarang **diuji**, bukan diklaim: `tests/uji-isi-otomatis.mjs` (11 asersi) menjalankan pipeline lalu membandingkan kolom tiap baris dengan kandidat rank-1 kartu baris itu → **AO1 LULUS untuk semua baris**. Yang membuat kolom kosong adalah baris yang **belum pernah melewati Fase 2**: run dengan `sampaiFase = 1` memang mengosongkan field itu (`AO8`/`AO9` mengunci perilaku ini, status barisnya `SIAP_DIPROSES`, bukan `OTOMATIS_VALID`). Jadi kolom kosong = "fase itu belum jalan", bukan rekomendasi yang hilang. **Perlu dicatat: jawaban itu ditolak pemilik produk** ("fixing ini harus muncul ya data nya") — kolomnya memang harus tetap terisi di layar walaupun fasenya belum jalan; itu dikerjakan di N8.
- Ikut terukur di suite yang sama: kelurahan yang beda kecamatan dengan cabang terdekatnya (kasus screenshot) tetap terisi (`AO2`–`AO5`), dan kota tanpa cabang sendiri tetap mendapat cabang terdekat yang jujur + alasannya tercatat (`AO6`/`AO7`).
- Catatan penting saat memverifikasi: tangkapan layar itu diambil dari tab yang bundle-nya **basi** — DOM dashboard-nya masih menampilkan kepala tabel lama ("DATA MATCH (BERSIH)", "TOTAL TARGET") dan pil "Terhubung" masih memuat jam, padahal keduanya sudah diganti di N6; dev server pada port itu pun sudah mati. Reload (Ctrl+F5) sebelum menyimpulkan perilaku.

**Penyebab tab beku — jeda yang salah hitung.** Satu-satunya `await tick()` di loop Fase 2 ada di loop **kota** (`i % 50`), sementara kerja sebenarnya terjadi per **kelurahan** di dalam loop kota. Satu kota bisa membawa ribuan kelurahan, jadi thread utama tersumbat puluhan detik tanpa satu pun jeda → Chrome menyebut tab tidak merespons, dan kartu fase/macan progres ikut membeku. Perbaikan: loop dalam diubah dari `forEach` ke `for` dan yielded dihitung **per baris** (`YIELD_PER_BARIS = 150`); efek sampingnya tombol "Batalkan" (A4) ikut lebih sigap karena `tick()` juga membaca flag pembatal.
- Terukur A/B pada dataset sintetik identik, 18.000 baris, `sampaiFase = 2` (watchdog jeda event-loop `scratch/ukur-jeda.mjs`; file pengukur sudah dihapus atas permintaan operator, angkanya tetap hasil ukurannya): **tanpa** perbaikan total 41,6 d dengan **jeda terpanjang 34,6 d**; **dengan** perbaikan total 46,5 d (+12%) dengan **jeda terpanjang 2,8 d** — 12× lebih baik dan keluar dari zona "page isn't responding".
- Sumber beku kedua ditutup: opsi **"Semua (83.764)"** pada tab Fase 2/3 dulu menaruh 83 ribu kartu kandidat ke DOM sekaligus, karena A8 mematikan windowing di tab itu (`minRowsToWindow: Infinity`). Windowing dinyalakan lagi untuk tab kartu dengan estimasi tinggi kartu 250px + overscan 12 (tinggi sejati dikoreksi otomatis dari baris pertama yang ter-render), sehingga "lihat semua" tetap ada tanpa membekukan tab.

**Terukur:** `tsc -b --force` 0 error · lint **83 warning / 0 error** (baseline) · `npm run build` ✓ · **9 dari 9 suite LULUS** (suite baru `uji-isi-otomatis.mjs`; `uji-fase2-status` & `uji-final-skip` ikut memastikan konversi `forEach`→`for` tidak mengubah hasil, termasuk jalur `continue` untuk baris yang sudah final).
**Milik operator:** setelah reload, buka Data Analyst → Setujui Fase 1 → tab Fase 2 harus langsung terisi kolomnya; lalu coba "Tampilkan: Semua" di tab Fase 2 dan scroll — kalau masih terasa melompat, angka 250px/overscan 12 yang perlu digeser, bukan windowingnya dimatikan lagi.

### N8 — KOLOM FASE 2 TETAP TAMPIL WALAU FASENYA BELUM JALAN (perintah pemilik produk 2026-09-22 — "fixing ini harus muncul ya data nya")

N7 menjelaskan *kenapa* kolom itu kosong; pemilik produk menolak penjelasan itu dan minta datanya muncul. Itu bisa dipenuhi tanpa mengarang nilai, karena nilai yang ditampilkan dan nilai yang ditulis pipeline ternyata **rumus yang sama** — jadi rumusnya dipindah ke satu tempat:

- `paketFase2` yang tadinya fungsi lokal di dalam `executeAnalystPipeline` diangkat jadi fungsi modul **`paketFase2DariMaster(m, wilayahSettings)`** dan diekspor (`src/utils/analystPipeline.ts`); pipeline sekarang hanya `paketFase2 = (m) => paketFase2DariMaster(m, wilayahSettings)`. Satu rumus, dua pemakai — tidak ada lagi cabang layar vs berkas.
- Grid menambahkan memo **`f2Aktif`** (`AnalystResultsGrid.tsx:792`): untuk tiap baris yang tampil, ambil kandidat dengan rank aktif lalu ubah jadi paket field lewat rumus yang sama. Sel kolom membaca `r.wilayah || p2?.wilayah || '-'` (dan `sandiCabang`/`branchCode`/`kodeCabang`/`namaOutlet`/`statusOutlet`/`alamat` sama).
- **Rank aktif mengikuti kartu:** `fase2Choice[r.id]` (pilihan operator) → `userPrefilledAudit.matchedRank` kalau ≤ 3 → selain itu 1. Persis urutan yang dipakai kartu menandai "Pilihan 1", jadi operator yang memilih Pilihan 2 melihat kolomnya ikut berpindah, bukan macet di rank 1.
- **Tidak ada field baru dan tidak ada tulis ke baris** — ini murni turunan saat render (`r.wilayah` tetap kosong sampai Fase 2 benar-benar jalan), sesuai aturan "tampilkan saja ≠ simpan".
- Fase 3 ikut ditutup: sel yang dulu menulis "Cabang belum dipilih — selesaikan Fase 2 dulu" sekarang jatuh ke master kandidat aktif (`masterByBranchCode.get(r.branchCode || p2?.branchCode) || _activeCandMaster`), jadi baris yang branchCode-nya masih turunan tetap bisa dinilai role-nya.
- Dirapikan sekaligus: fallback lapis ketiga `_p2Cand` di dalam loop render ternyata **selalu sama** dengan `p2` (kandidat & rank yang sama, rumus yang sama, baris yang sama-sama dilewati) — dihapus supaya hanya ada satu sumber dan satu panggilan `extractWilayahFromBranchCode` per baris, bukan dua.

**Bukti (suite baru, sekarang 13 asersi):** `AO11` membandingkan keluaran `paketFase2DariMaster` dengan field baris hasil pipeline untuk **semua** baris; `AO12` memastikan nilai yang akan tampil di layar untuk baris yang baru lewat Fase 1 **sama persis** dengan nilai yang ditulis pipeline saat Fase 2 nanti. `AO1`–`AO7` tetap seperti sebelumnya.

**Biaya yang tersisa — angka, bukan perasaan.** `findClosestMasterRecommendation` diukur pada indeks 7.475 cabang: **9,7 ms/baris** saat Dati II target ada di master, **125 ms/baris** saat tidak ada (jalur fallback memindai seluruh cabang). Grid tidak memanggilnya per baris data, melainkan per baris **di jendela tampil** (60–72 kartu) dan hasilnya di-cache pada kunci `kode pos + kelurahan + kecamatan`, jadi jendela pertama ±0,6 d dan scroll ulang ke daerah yang sama gratis. `f2Aktif` **tidak menambah** pekerjaan mesin — ia hanya membaca kandidat yang sudah dihitung untuk kartu. Memangkas 9,7 ms itu berarti menyentuh inti pencocok Fase 2, dan itu butuh izin eksplisit.

### N9 — SEMUA STYLING DIKUNCI KE STANDAR VELZON (permintaan pemilik produk 2026-09-22)

Aturan baru: **velzon adalah tolok ukur**, bukan Carbon/Tailwind. Angkanya diambil dari CSS demo resminya (bukan dari ingatan): `--vz-primary #405189`, success `#0ab39c`, danger `#f06548`, warning `#f7b84b`, info `#299cdb`, light `#f3f6f9`, body-bg `#f3f3f9`, border `#e9ebec`, heading `#495057`, font dasar **0,8125 rem (13px)** `Poppins, sans-serif` dengan line-height 1,5, radius 0,25 rem (sm 0,2 / lg 0,3), shadow `0 1px 2px rgba(56,65,74,.15)`; tema sidebar demo `data-sidebar="dark"`: latar & garis `#405189`, item `#abb9e8`, hover/aktif putih di atas `rgba(255,255,255,.15)`, judul menu `#838fb9`, shadow menu `0 2px 4px rgba(15,34,58,.12)`, lebar 250 / 180 / 70 px, `.menu-title` 11px uppercase ls 0,05em w600 dengan padding 12px 20px.

Yang ternyata menyimpang dan sudah diluruskan di `src/styles/index.css` + `index.html`:
1. **Font**: `Inter` / `Plus Jakarta Sans` / `JetBrains Mono` → `Poppins` 300–700 (satu-satunya tautan Google Fonts yang tersisa) dan `--font-mono` diganti tumpukan sistem Velzon (SFMono/Menlo/Consolas).
2. **Skala radius**: 6–8px → 4px (`--radius-md`) / 5px (`--radius-lg`) mengikuti 0,25rem.
3. **Ukuran dasar**: `body` kini `line-height: 1.5; letter-spacing: normal` (sebelumnya 1,45 + tracking negatif — sebabnya teks terlihat "rapat" dibanding template).
4. **Sidebar** (contoh yang dikeluhkan): latar `#111c38` selebar 240px → token `--sidebar-*` baru persis demo (`#405189`, 250px, shadow menu, tinggi brand 46px sama seperti topbar, teks item `#abb9e8` 13px). Aksen **garis kiri** pada item aktif dihapus dan diganti pil `rgba(255,255,255,.15)` + teks putih — bentuk Velzon; `.sidebar-menu-title` jadi 11px uppercase `#838fb9` padding 12px 20px; logo brand jadi ubin putih dengan glif `--accent-blue`; badge "MASTER"/"TARGET" dan sub-badge ikut ditokenkan.

**Belum beres dan sengaja tidak disentuh diam-diam:**
- **154 nilai hex unik / 419 pemakaian** di luar token (tint per komponen: latar kartu kecil, warna badge lokal, dsb.) — menyapu ini mengubah banyak layar sekaligus, masuk N2 dan butuh mata operator.
- **Konflik dokumen**: tolok ukur Bagian O masih Carbon/Tailwind (basis 16px, radius 8px). Setelah N9, asumsi `O2` harus dibaca ulang (13px / 0,25 rem) atau bagiannya dicabut.
- Belum ada **verifikasi visual** — saya tidak membuka profil Edge milik operator untuk membandingkan layar; yang terverifikasi baru `tsc` 0 error, lint 83 warning / 0 error (baseline), build ✓, 9/9 suite LULUS.

### N10 — CACHE KARTU FASE 2 (kerja sesi agen lain 2026-09-22 ±19.00; saya periksa lalu rapikan sebelum masuk `main`)

Arah kerjanya benar — memotong biaya `findClosestMasterRecommendation` yang terukur **9,7 ms/baris** (125 ms/baris pada jalur fallback) — tapi versi awalnya punya tiga cacat yang justru membuatnya tidak berguna atau salah:

1. Peta cache masih dideklarasikan **di dalam body komponen**, jadi dibuat ulang setiap render → tidak pernah ada satu pun cache hit. Sekarang di scope modul.
2. Kunci cache hanya `kode pos + kelurahan + kecamatan + kota`, padahal mesin membaca cabang yang **sedang terpasang** lewat `_originalFilledSandiCabang`. Setelah operator menekan "Gunakan Cabang Ini", barisnya berubah tapi kuncinya sama → kartu menampilkan kandidat lama. Kunci kini ikut `sandiCabang|namaOutlet|branchCode` (persis `sig` yang dipakai versi sebelumnya).
3. Cache modul tidak tahu kalau berkas master diganti; entri lama tetap disajikan untuk dataset baru. Sekarang `WeakMap` yang diikatkan pada objek `masterIndex` — indeks baru = cache baru, dan yang lama ikut ter-GC.

Windowing tab kartu ikut diturunkan (mulai 20 baris, overscan 6, tinggi estimasi 180px) — DOM ±3× lebih kecil; tinggi sejati tetap dikoreksi dari baris pertama yang ter-render, jadi tidak ada yang perlu dikembalikan. `App.tsx` menggabung dua memo agregat jadi satu lintasan O(N); hasilnya tetap sama dan tidak ada asersi yang berubah.

**Terukur di tree final:** `tsc` 0 error · lint **82/0** (turun 1 dari baseline 83) · build ✓ · 9/9 suite LULUS · `main` = `3dfbc61`. **Milik operator:** rasa scroll "Semua" di tab Fase 2 pada data nyata.

**Susulan (laporan operator 2026-09-22, screenshot ACEH BARAT / Gunung Sitoli — "berat, tidak bisa digerakkan begitu masuk Fase 2"):** penyebabnya bukan grid, tapi `App.tsx:969` — menyetujui Fase 1 **langsung** menjalankan mesin fase berikutnya atas 83 ribu baris di thread yang sama (±10 ms/baris = tab beku tepat di momen pindah tab). Sekarang persetujuan hanya menandai fase; kolom Fase 2 tetap terisi karena diturunkan dari kandidat rank-1 (N8), dan mesin fasenya dijalankan lewat tombolnya sendiri. Ini **mencabut** perilaku "isi otomatis saat fase disetujui" (task #37) — diganti turunan layar, bukan dikembalikan menjadi kosong. Toast persetujuan ikut disesuaikan.

**Susulan 2 (operator masih melaporkan *This page isn't responding*, usulnya sendiri diterima):** tab Fase 2 kini **tidak menampilkan daftar kartu sama sekali sebelum fase itu selesai** — satu baris pesan pengganti, dan `fase2Recs` dikunci sehingga mesin ±10 ms/baris tidak dihitung untuk sesuatu yang memang tidak dilihat. Setelah Fase 2 dijalankan (`fase2Status` tertulis engine = bukti, bukan tebakan), kartu tampil seperti biasa. Catatan penting saat memverifikasi: tab yang dilaporkan beku itu **tidak mungkin** memuat kode `1c69742` — dev server baru hidup jam 19.44, jadi tab tersebut masih menjalankan bundle lama; `Ctrl+F5` lebih dulu.

### N11 — MESIN ANALISA PINDAH KE WEB WORKER (keputusan pemilik produk 2026-09-22: "Jalankan di Web Worker")

Gerbang tampilan (susulan 2 di atas) hanya menyembunyikan kartu; **pekerjaannya tetap 83 ribu baris × ±10 ms ≈ belasan menit di thread utama**, dan selama itu tab tidak bisa digulir — persis yang dilaporkan dari `match-sepia.vercel.app` (terverifikasi: bundle produksi `index-YkAwadT0.js` sudah memuat N8/N10, jadi ini bukan soal kode belum naik). Sekarang perhitungan itu tidak pernah terjadi di thread tampilan:

- `src/utils/analyst.worker.ts` menjalankan `executeAnalystPipeline` di worker; progres dikirim per pesan, hasil lewat `selesai`, kegagalan lewat `gagal` (pembatalan ditandai **boolean**, bukan nama kelas, karena minifier mengubah `constructor.name`).
- `src/utils/analystRunner.ts` = pembungkusnya: `jalankanAnalisaDiWorker(bahan, onProgress)` + `batalAnalisaDiWorker()`. Tombol "Batalkan" (A4) tetap berfungsi — `pembatalAnalisaRef` yang sudah mati di `App.tsx` dihapus, tidak dibiarkan menggantung.
- Bahan run harus bisa di-structured-clone: `excludeFinalKeys` dikirim sebagai array lalu dibangun ulang jadi `Set` di dalam worker.
- **Hambatan yang ditemukan dan diperbaiki:** worker mati sebelum mulai dengan `window is not defined`. Sumbernya `getUnitCategory` / `getWondrRecommendation` yang tinggal di file komponen React (`RoleMappingManager.tsx`) — begitu engine mengimpornya, React + lucide ikut masuk worker. Keduanya dipindah ke `src/utils/roleHelpers.ts` (murni) dan 7 import di 6 file diarahkan ke sana. Ukuran chunk worker turun 86 kB → 75,8 kB, bukti React benar-benar keluar.

**Terukur di browser (bukan klaim):** run 1.200 baris selesai **3,2 d** di worker, 1.200/1.200 baris dapat Branch Code, 7 pesan progres masuk. Sementara worker menghitung, thread utama menjalankan loop kerja tetap dan menghasilkan **109% dari throughput baseline** (476.043 vs 436.132 iterasi/250 ms) — artinya mesin tidak lagi merebut thread tampilan sama sekali.
Rantai: `tsc -b --force` 0 error · lint **80 warning / 0 error** (turun dari baseline 83) · `npm run build` ✓ · **9/9 suite LULUS**.
**Belum terverifikasi:** run skala penuh 83 ribu baris di data nyata milik operator (butuh mata + waktunya sendiri), dan rasa scroll tab Fase 2 pada data itu setelah worker naik ke produksi.




### N2 — KERAPIAN UI (clean, enak dilihat, rapi)

Aturan tampilan — berlaku untuk grid Data Analyst, Final, dan semua menu:

1. **Hirarki visual**: satu judul per kartu (0.95rem, bold), subteks 0.74rem abu (#878a99), angka KPI besar (1.5rem). Maksimum tiga ukuran font per kartu.
2. **Konsistensi ukuran & jarak**: tinggi baris tabel 44px; padding sel 0.5rem 0.55rem; jarak antar kontrol toolbar 0.5rem; radius 6-8px; bayangan lembut (0 1px 2px rgba(56,65,74,0.05)).
3. **Token warna status** (jangan bikin warna baru): hijau #0ab39c = valid/otomatis; kuning #f7b84b = perlu validasi; merah #f06548 = anomali; biru #405189 = netral/info; ungu #7048e8 = role. Semua badge & garis status memakai token yang sama.
4. **Tombol aksi baris**: maksimum dua tombol utama per baris; urutan tetap **Detail, lalu Revisi**; ukuran seragam (font 0.7rem, padding 0.25rem 0.5rem); selalu ada ikon + label; tombol ikon wajib punya `title` dan `aria-label`.
5. **Badge**: lebar minimum seragam, teks uppercase 0.68rem, satu makna = satu warna.
6. **Header tabel sticky** dengan latar #f3f6f9 dan garis bawah tegas; kolom sticky diberi `border-right` agar tidak menyatu dengan kolom lain saat digeser.
7. **Zebra row** halus (#f9fbfd) untuk baris genap.
8. **Empty state** rapi: ikon + satu kalimat + tombol tindakan, contoh: Belum ada baris. Jalankan Fase 1 untuk memulai.
9. **Angka**: rata kanan dan `font-variant-numeric: tabular-nums`; jarak dalam km satu desimal; persen satu desimal maksimum.
10. **Tooltip** untuk semua teks yang mungkin terpotong dan semua tombol ikon (`title` + `aria-label`).
11. **Kontras**: teks abu minimum #6c757d untuk ukuran 0.7-0.74rem.
12. **Animasi ringan**: transisi 150-200ms saja; hormati `prefers-reduced-motion` (aturan global sudah ada di `src/styles/index.css:1848`).

**Eksekusi:** pindahkan gaya yang berulang dari inline style ke kelas di `src/styles/index.css` (bertahap, jangan sekaligus), targetkan penurunan sekitar 40 persen inline style di `AnalystResultsGrid.tsx`.

**Status 2026-09-22 — SEDANG, baru 4 persen:**
- Pengukurnya dipasang: `node tests/ukur-inline-style.mjs [file...]` mencetak jumlah blok `style={{}}`, jumlah deklarasi, dan nilai `fontSize`/`padding` unik. Baseline `AnalystResultsGrid.tsx`: **239 blok / 987 deklarasi / 18 fontSize unik / 33 padding unik**.
- Butir 4 ✅ sebagian — keempat tombol aksi baris (Setujui, Revisi, Detail, Data Cabang) pindah ke kelas `.btn-aksi-baris` + varian `.btn-aksi-baris-padat` di `src/styles/index.css`; hanya warna yang tinggal inline. Nilainya **disalin persis** dari inline yang diganti, jadi tidak ada perubahan tampilan dan tidak perlu cek visual. Hasil ukur: 987 → **947 deklarasi (−4%)**.
- ⚠ Aturan butir 4 ("urutan tetap Detail, lalu Revisi") **dilanggar sengaja** di tab Data Final atas permintaan pemilik produk 2026-09-22: urutannya jadi Revisi → Detail → Setujui (lihat N4 butir 3). Tab lain tidak berubah.
- **Yang tersisa butuh mata operator, bukan kode:** ~380 deklarasi lagi untuk mencapai −40%, dan sebagian besar pola berulang berikutnya (chip, pill, kartu kandidat) nilainya TIDAK identik antar pemakaian — memindahkannya ke kelas berarti mengubah ukuran/jarak, yang hanya bisa dinilai dengan melihat hasilnya. Karena itu dihentikan di sini sampai operator bisa membuka Data Analyst dengan data nyata (origin dev sesi ini 0 baris, Neon `Offline`).
- Bagian O (base font `html { font-size: 13px }` → 16px + grid 4px) sengaja **belum disentuh**: itu mengubah ukuran SELURUH aplikasi sekaligus, dan tanpa verifikasi visual justru menghasilkan "gemuk" yang dikeluhkan O0. Urutan aman yang diusulkan: (1) operator screenshot 3 tab hari ini, (2) token `--fs-*`/`--sp-*` + util ditambahkan, (3) satu file disweep, screenshot lagi, baru (4) base font dinaikkan.

**Checklist uji UI:**
- Semua kolom terbaca penuh tanpa harus klik (wrap atau tooltip tersedia).
- Tidak ada tombol tanpa label saat kursor diarahkan.
- Diuji pada lebar 1280px dan 1024px: tidak ada nilai hilang tanpa tooltip.
- Tangkapan layar Fase 1/2/3: tidak ada baris yang terpotong.

---


---

## BAGIAN O — UI 100% ZOOM: RAPI, TIDAK GEMUK, DAN SMOOTH (RUJUKAN BENCHMARK)

> Ditambahkan 2026-09-21 atas permintaan pemilik produk. Tujuan: tampilan tetap bersih dan nyaman pada zoom browser **100%** (tanpa zoom-in pengguna). Status: BELUM.

### O0 — AKAR MASALAH “GEMUK” (hasil ukur kode)

| Fakta hasil audit | Angka | Arti |
|---|---|---|
| Base font global | `html { font-size: 13px }` (`src/styles/index.css:78`) | Semua `rem` berskala 13/16 = 0,8125 dari standar |
| Ukuran font unik | **21 nilai** (0.65, 0.67, 0.68, 0.69, 0.7, 0.71, 0.72, 0.74, 0.75, 0.76, 0.77, 0.78, 0.8, 0.81, 0.82, 0.88, 0.95, 0.98, 1, 1.12, 1.35 rem) | Tidak ada skala; setiap komponen mengarang ukuran sendiri |
| Padding unik | **34 nilai** (0.05rem 0.35rem sampai 2.25rem 1.5rem) | Tidak mengikuti grid 4px |
| Gap unik | **14 nilai** (0.15rem sampai 1rem) | Jarak tidak konsisten |
| Efek ke teks | 0.74rem = **9,6px**; 0.65rem = **8,5px** | Teks terkecil jauh di bawah batas nyaman |
| Padding kartu contoh | `1.15rem 1.35rem` = 14,9 / 17,6 px | Bukan kelipatan 4px |

Kesimpulan: tampilan terasa **gemuk sekaligus kecil** — teks dipadatkan (8-10px) lalu ditambal dengan banyak padding acak. Itu sebabnya tidak “clean” dan sulit dipindai mata.

### O1 — BENCHMARK (rujukan resmi)

| Sumber | Nilai acuan | Implikasi untuk aplikasi ini |
|---|---|---|
| **IBM Carbon — Data table** (carbondesignsystem.com/components/data-table/style) | Tinggi baris: **xs 24px, sm 32px, md 40px, lg 48px, xl 64px**. Sel: padding kiri/kanan **16px**. Teks baris: **14px / 0.875rem** regular. Header kolom: 14px semibold. Toolbar: 32px (compact) atau 48px (large) | Pakai **40px** sebagai default baris, 32px mode Ringkas; teks data **= 14px**; padding sel **8px 12px** (padat) atau 16px (lega) |
| **Tailwind CSS v4 — font-size** (tailwindcss.com/docs/font-size) | text-xs **12px**, text-sm **14px**, text-base **16px**, text-lg **18px**, text-xl **20px**, text-2xl **24px**; tiap ukuran punya line-height bawaan | Ambil **6 langkah saja**: 12, 14, 16, 18, 20, 24 |
| **Tailwind CSS — spacing** | Grid **4px**: 1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px | Semua padding/gap jadi kelipatan 4px |
| Praktik umum aplikasi data (Material dense / shadcn) | Baris padat 32-36px, kontrol 32px, ikon 16px, radius 4-8px | Hindari kontrol > 32px di toolbar |

### O2 — TOKEN TARGET (rujukan benchmark)

| Token | Nilai | Sumber |
|---|---|---|
| Base font | **16px** | Tailwind `text-base` / standar browser; jauh lebih nyaman dari 13px |
| Skala font (hanya 6) | 12 / 14 / 16 / 18 / 20 / 24 | Tailwind xs..2xl |
| Spacing grid | 4 / 8 / 12 / 16 / 24 / 32 | Tailwind 1/2/3/4/6/8 |
| Radius | 4 / 6 / 8 | sudah ada di `--radius-sm/md/lg` |
| Tinggi baris tabel | **40px** default; 32px Ringkas; 48px Lebar | IBM Carbon sm/md/lg |
| Tinggi kontrol | **32px** (input, tombol, select) | IBM Carbon small toolbar |
| Ikon | 14 / 16 / 20 | selaras Tailwind/Carbon |
| Padding sel tabel | **8px 12px** (padat) atau 8px 16px | Carbon + Tailwind |
| Padding kartu | **16px 20px** | Carbon spacing 4/5 |

**Catatan penting:** karena aplikasi ini sekarang memakai `html { font-size: 13px }`, mengubah base ke 16px menaikkan semua `rem` 23 persen. Itu yang harus diimbangi dengan menurunkan padding/gap ke grid 4px (O3) supaya hasilnya **lebih rapi, bukan lebih gemuk**.

### O3 — ATURAN LAYOUT AGAR TIDAK GEMUK

1. **Maksimal lebar konten**: `page-content` dan kartu besar dibatasi (mis. `max-width: 1440px; margin: 0 auto`) agar layar lebar tidak terlihat kosong/terentang.
2. **Grid konsisten**: `metrics-grid` dan kartu memakai `repeat(auto-fit, minmax(220px, 1fr))` dengan `gap: 16px` — bukan `0.65rem`.
3. **Padding kartu seragam**: selalu `16px 20px` (bukan 1.15rem 1.35rem, bukan 0.9rem 1.25rem, dsb).
4. **Toolbar tipis**: tinggi maksimal 32-40px; kontrol (input/select/button) tinggi 32px; ikon 14-16px; jarak antar kontrol 8px.
5. **Tabel**: baris 40px default; header tebal semibold 14px; teks sel 14px; padding sel 8px 12px; kolom kode `tabular-nums`; kolom teks wrap 2 baris + tooltip (lihat N1).
6. **Badges/pills**: tinggi 20-24px, font 12px, padding 2px 8px.
7. **Kartu anomali/peta**: judul 14px, subteks 12px, tanpa padding berlebih.
8. **Jangan pakai padding acak** (larang: nilai yang bukan kelipatan 4px seperti 0.35rem, 0.65rem, 0.85rem, 1.15rem, 1.35rem).
9. **Kosong yang sengaja**: gunakan gap 8/16/24, bukan padding besar; hindari panel kosong tinggi.
10. **Sticky header** tabel: latar #f3f6f9 + garis bawah; kolom sticky diberi `border-right` (lihat N2.6).

### O4 — LANGKAH EKSEKUSI (urut aman)

1. Tambah token di `src/styles/index.css`: `--fs-2xs: 12px; --fs-xs: 14px; --fs-sm: 16px; --fs-lg: 18px; --fs-xl: 20px; --fs-2xl: 24px;` dan `--sp-1..8: 4,8,12,16,20,24,32px`.
2. Tambah kelas util: `.fs-xs`, `.fs-sm`, `.fs-md`, `.fs-lg`, `.fs-xl`; `.pad-card`, `.pad-cell`, `.gap-2`, `.gap-4`.
3. Ubah `html { font-size: 16px }`.
4. Sweep bertahap per file: ganti `font-size: Xrem` dan `padding/gap` acak ke token; mulai dari `AnalystResultsGrid.tsx`, lalu komponen besar lainnya.
5. Ukur kembali dengan audit yang sama: target **font-size unik ≤ 6** dan **padding unik ≤ 8**.

### O5 — CHECKLIST UJI 100% ZOOM

- Browser zoom 100% (jangan zoom-in): teks utama terbaca jelas; baris tabel tidak melebihi 48px; tidak ada teks < 12px untuk konten penting.
- Uji 3 lebar: 1366x768, 1440x900, 1920x1080 — tidak ada scroll horizontal di halaman (kecuali tabel yang memang horizontal).
- Tidak ada kartu yang lebih tinggi dari kontennya (ruang kosong di dalam kartu = salah padding).
- `metrics-grid` menampilkan kartu dengan padding seragam 16px 20px dan gap 16px.
- Tangkapan layar Dashboard, Fase 1/2/3, Final, dan 5 Data Master: perbandingan sebelum/sesudah harus terlihat lebih rapi, bukan lebih besar.


---

## BAGIAN P — ATURAN TITIK KOORDINAT: KOSONG = BELUM, TERISI = ADA

> Ditambahkan 2026-09-21 atas permintaan pemilik produk. Status: BELUM. Berlaku untuk SEMUA pembacaan kolom `latitude`/`longitude` di aplikasi.

### Aturan resmi (definisi tunggal)

```
baris ADA titik  <=>  kolom latitude milik baris itu TERISI (IS NOT NULL)
baris BELUM ada  <=>  kolom latitude milik baris itu KOSONG (IS NULL)
```

**Wajib diikuti oleh:**
1. KPI Data Kode Pos (`ber_titik): gunakan query yang SUDAH ADA di `api/kodepos.ts:273` — `COUNT(*) FILTER (WHERE d.latitude IS NOT NULL OR g.latitude IS NOT NULL)`. Jangan ubah (fallback ke titik kode pos tetap dihitung ada, sesuai aturan: yang kosong hanya yang benar-benar tidak punya sumber).
2. Grid Data Kode Pos (kolom titik): tetap tampil memakai fallback `COALESCE(latitude, titik kode pos)` (`api/kodepos.ts:141`) agar baris tetap bisa dipetakan.
3. Kartu KPI menu Kode Pos: angka BESAR = `stats.totalBerTitik`; footer = `total − totalBerTitik`; satuan ditulis eksplisit per BAGIAN K.
4. Dashboard peta: urutan sumber tetap `row_data` > cache online > centroid Kanwil > Jakarta Pusat (`geoCoder.ts:207-277`) — tidak diubah.
5. Fase 1/2/3: TIDAK membaca kolom ini (sudah terverifikasi). Jangan pernah menambahkan ketergantungan koordinat ke pipeline tanpa keputusan baru.

### R-PETA1 dan R-PETA2 (masuk Bagian J)

- **R-PETA1:** `calculateRealDistance` (`src/utils/geoDistance.ts:223-225`) bukan jarak GPS — isinya aturan (0,8 / 2,4 / 3,6 / selisih-kodepos / 42 km). Tambahkan komentar tegas di fungsi bahwa ia tidak membaca database koordinat, atau ganti nama.

- **R-PETA2:** konstanta `CITY_COORDINATES` (`src/utils/geoDistance.ts:16`) adalah hardcode centroid kota. Kota yang tidak ada di konstanta selalu jatuh ke 42 km (Kasus 5). Bila suatu hari estimasi lintas-kota harus akurat, sambungkan ke tabel `kodepos_geo`. Untuk sekarang: tidak perlu diubah, cukup didokumentasikan.

**Akhir dokumen.** Untuk konversi PDF: buka file ini di VS Code lalu ekspor Markdown ke PDF, atau salin ke Google Docs/Word lalu Export PDF; untuk Canva, salin bagian tabel per bagian karena Canva tidak merender tabel Markdown otomatis.
