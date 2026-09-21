# RENCANA PERBAIKAN SELURUH APLIKASI
> **âš ï¸ STATUS 2026-09-21: BELUM SELESAI â€” 25 dari 67 item `SELESAI`, 1 `SEDANG` (A9), 41 `BELUM` (D1 masih tinggal dari keputusan yang sudah diambil).**
> Baca Bagian 0 sebelum mengerjakan apa pun. Titik lanjut: **A3** (BaseModal). Rincian & bukti verifikasi ada di sana.

**Aplikasi:** Tools Data Matcher Cabang & Outlet v2.x â€” React + TypeScript + Vite; IndexedDB (lokal) + Neon Postgres (cloud via serverless `api/`).
**Sumber:** tinjauan kode statis; aplikasi TIDAK dijalankan saat audit (`node`/`npm` tidak tersedia). Nomor baris = kondisi saat audit; verifikasi ulang dengan pencarian teks sebelum mengubah.
**Pemakai:** AI/developer eksekutor. Ikuti urutan di Bagian 10. Jangan ubah dua mesin sekaligus tanpa membaca file pasangannya (`analystPipeline.ts` â†” `recommender.ts` â†” `AnalystResultsGrid.tsx`).

## 0. STATUS PENGERJAAN â€” WAJIB DIBACA AI SEBELUM EKSEKUSI

> ### ðŸŸ¨ PENAANDAAN STATUS â€” 2026-09-21 â€” **DOKUMEN INI BELUM SELESAI, JANGAN DIANGGAP TUNTAS**
>
> Ringkas dari 67 item pada tabel di bawah ini:
>
> | Status | Jumlah | ID |
> |---|---|---|
> | âœ… `SELESAI` | **25** | A1, A2, A3, A4, A5, A6, A7, A8, B1, B2, B4,
> | ðŸŸ¨ `SEDANG` | **1** | A9 (responsivitas breakpoint; CSS mati menunggu konfirmasi hapus) |
> | â¬œ `BELUM` | **41** | sisanya â€” termasuk 1 item yang dulu
>
> Belum termasuk item Bagian **H/I/J/K di Lampiran** (statusnya `BELUM`, ditandai langsung di barisnya; khusus Bagian K: K1â€“K3 sudah dikerjakan & build-verified 2026-09-21, K4â€“K5 `BELUM`).
>
> **Untuk AI berikutnya (Cline / lainnya):**
> 1. Urutan sisa yang disepakati: **B1/B2/D1** + C2aâ€“C2e/C3/C4 (Fase 2), lalu A6â€“A10, E, F, G1/G3/G11/G12 â†’ **C2aâ€“C2e + C3/C4** (Fase 2) â†’ **A6â€“A10, E, F, G1/G3/G11/G12** (kebersihan & sisanya). **G9 sudah selesai** â€” jangan buat file `api/` baru apa pun (alasan + bukti: kotak ðŸš« di Bagian G9).
> 2. **Jangan kerjakan ulang** 13 item `SELESAI`; baca kolom "Catatan" untuk file yang sudah disentuh.
> 3. Nomor baris di dokumen ini berasal dari audit statis dan **sudah bergeser** â€” cari teksnya, jangan percaya angka barisnya.
> 4. Setelah satu item selesai: ganti statusnya di tabel + isi tanggal `YYYY-MM-DD` + file yang diubah, lalu commit dokumen ini bersama kodenya.
> 5. Wajib jalankan Bagian 11 sebelum melapor selesai: `npm run build` dan `npm run lint` (oxlint, **bukan eslint**) harus bersih.
>
> **Bukti verifikasi batch G2/A4 (2026-09-21):** `npm run build` âœ“ Â· `npm run lint` 0 error / 84 warning (baseline saat itu) Â· diuji di browser (dev `localhost:5199`, modul sumber di-import langsung): `makeFinalKey` V2 memisahkan dua kota yang bertabrakan di versi lama, `AnalisaDibatalkan` benar-benar terlempar saat flag naik dan run normal tetap selesai, notifikasi warning muncul & hilang sesuai auto-dismiss, `ConfirmDialog` restore cadangan menjalankan aksinya hanya setelah "Ya, Pulihkan" Â· `grep alert(` di `src/` = 0.
>
> **Bukti verifikasi terakhir (2026-09-21, batch G9):** `npx tsc -b --force` 0 error Â· `npm run build` âœ“ Â· `npm run lint` 0 error / **82** warning (semuanya di file lain; `src/App.tsx` & `src/utils/neonSync.ts` = 0 warning) Â· `npx tsc -p api/tsconfig.json --noEmit` âœ“ Â· `pilFinalDariCloud` diukur di browser dev lewat 7 kasus (baris cloud baru diterima; baris berkunci alami sama dengan `id` berbeda DITOLAK; duplikat internal cloud hanya 1 yang masuk; baris tanpa `id`/tanpa `kodePosPten` dibuang; kota kembar beda kota tetap dipulihkan) Â· helper cloud diukur dengan endpoint tiruan: 700 baris = 2 GET (500+200, tanpa celah) dan 3 POST (chunk 300, body maks 102 KB utk baris 146 B) Â· handler `api/target.ts` dijalankan terhadap `sql` palsu: GET kosong â†’ `CREATE TABLE final_rows` + `total:0`; GET paging â†’ `returned:500 offset:200 total:700`; POST upsert 701 baris â†’ `written:700` (baris tanpa id dibuang) & **tidak ada** `DELETE`; POST `mode:'replace'` â†’ ada `DELETE` lebih dulu; POST tanpa mode â†’ upsert (aman); DELETE tanpa `key`/`all` â†’ 400 dan nol query destruktif; DELETE `&key=` â†’ 1 baris; DELETE `&all=1` â†’ 705 baris; `view` tak dikenal pada POST/DELETE â†’ 400 tanpa menyentuh `target_records`; jalur lama `GET/DELETE /api/target` (tanpa `view`) tetap meng tabel target.
>
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
| B3 | BELUM | â€” | Verifikasi ekspor saja |
| B4 | SELESAI | 2026-09-21 | Opsi (a): semua karangan di `analystPipeline.ts` dihapus (dua tambahan ketahuan oleh pengukuran, bukan pembacaan kode: `namaOutlet` fallback `BNI KCP <kota>` :1625 dan label `Wilayah <kota>` dari `formatWilayahName(finalKotaPten)` :1620) â€” fallback kota "KOTA JAKARTA PUSAT" & kode pos "10110" jadi kosong, label "Wilayah 01" jadi kosong, dan baris penanda "kota PTEN tanpa cabang di master" tidak lagi mengarang W-code (tabel modulo) / `CABANG x` / `KCP x` / `Jl. Protokol x` / `Status Outlet: Aktif`. Sisa karangan di mesin role dicatat sebagai bagian D2 |
| C2a | BELUM | â€” | |
| C2b | BELUM | â€” | |
| C2c | BELUM | â€” | |
| C2d | BELUM | â€” | |
| C2e | BELUM | â€” | |
| C3 | BELUM | â€” | Wajib setelah C2aâ€“C2e |
| C4 | BELUM | â€” | Kasus uji |
| D1 | BELUM | â€” | Keputusan diambil 2026-09-21 (Bagian 12) â€” menunggu eksekusi |
| D2 | SELESAI | 2026-09-21 | Opsi "kosongkan + lempar manual": fallback `completeRoles[0]` / `completeRoleList[0]` (skor 0,70) dihapus di kedua mesin (`matchRoleForOutlet` :916 dan jalur pipeline :1682). Tanpa kecocokan nyata sekarang menghasilkan `organisasiTujuan` kosong, `tipeUnit: OUTLET` (bukan KC karangan), role 0/0/0 (`is3RoleLengkap` false), `alurWondr`/`flowDescription` kosong, status ANOMALI â†’ masuk antrean review. Varian "kandidat terdekat satu pulau" TIDAK dibuat â€” butuh mesin jarak baru |
| D3 | SELESAI | 2026-09-21 | `isFinalApproved` otomatis sekarang butuh `statusAnalisa===EXACT_MATCH` **dan** `placementStatus===VERIFIED` **dan** `!usedFallback` (`analystPipeline.ts` blok hasil) |
| D4 | BELUM | â€” | |
| D5 | BELUM | â€” | |
| D6 | SELESAI | 2026-09-21 | Opsi (b): `applyFase3Role` (pilihan manual operator) tidak lagi menulis `EXACT_MATCH` â€” sekarang `HIGH_CONFIDENCE`, jadi akurasi mesin tidak naik oleh keputusan manusia dan barisnya tidak lolos ke Final tanpa diperiksa |
| E1 | BELUM | â€” | |
| E2 | BELUM | â€” | |
| E3 | BELUM | â€” | |
| E4 | BELUM | â€” | |
| E5 | BELUM | â€” | |
| E6 | BELUM | â€” | |
| E7 | BELUM | â€” | |
| E8 | BELUM | â€” | |
| F1-W1 | BELUM | â€” | |
| F1-W2 | BELUM | â€” | |
| F1-W3 | BELUM | â€” | |
| F2-P1 | BELUM | â€” | |
| F2-P2 | BELUM | â€” | |
| F2-P3 | BELUM | â€” | |
| F3-C1 | SELESAI | 2026-09-21 | App.tsx handleMasterLoaded: mode 'update' = replace langsung; CabangManager kirim 'update' utk edit/hapus; impor Excel tetap 'replace' (merge+dedup). Build & lint terverifikasi 2026-09-21 |
| F3-C2 | SELESAI | 2026-09-21 | Sama seperti F3-C1 |
| F3-C3 | BELUM | â€” | |
| F4-R1 | BELUM | â€” | |
| F4-R2 | BELUM | â€” | |
| F4-R3 | BELUM | â€” | |
| F5-K1 | BELUM | â€” | |
| F5-K2 | BELUM | â€” | |
| F5-K3 | BELUM | â€” | |
| F6-X1 | BELUM | â€” | |
| F6-X2 | BELUM | â€” | |
| F6-X3 | BELUM | â€” | |
| F6-X4 | SELESAI | 2026-09-21 | = A5 (Topbar status koneksi + tombol Database + Simpan). Build & lint terverifikasi 2026-09-21 |
| F6-X5 | BELUM | â€” | |
| G1 | BELUM | â€” | |
| G2 | SELESAI | 2026-09-21 | `makeFinalKey` dilebarkan â†’ `kodePos\|kelurahan\|kecamatan\|kota`; 4 titik pemakai ikut (`App.tsx` exclude + merge persetujuan, `analystPipeline.ts` skip). Migrasi IndexedDB tidak diperlukan (kunci dihitung dari field, tidak disimpan). Lihat catatan di Bagian G2 |
| G3 | BELUM | â€” | |
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

### C4 â€” Kasus uji wajib
Kota **Bandung**: baris **Braga** (40111, Sumur Bandung) â†’ P1 Asia Afrika 98% ~1,4 km; baris **Lebak Siliwangi** (40132, Coblong) â†’ Pilihan 1 harus **Dago 98% ~1,4 km** (bukan Asia Afrika ~4,2 km). Setelah C2d, dua baris WAJIB berbeda hasil.

## BAGIAN D â€” FASE 3 (Mapping Role & Wondr)

**Alur berjalan:** dua engine â€” (1) otomatis di pipeline: pool hanya cabang 3-role-lengkap (`analystPipeline.ts:842â€“844, 1422â€“1424`), skor `calculateUnifiedPrecisionScore` ambang â‰¥0,75, fallback keyword kota 0,85 â†’ fallback daftar pertama 0,70 (`:1591â€“1660`, `matchRoleForOutlet:849â€“915`); `isFinalApproved` otomatis bila EXACT_MATCH (`:1929`). (2) layar review per baris: `roleRecommender.ts:60â€“471` â€” KC prioritas (`nameMatchScore 200/180`, baris `242â€“267, 268â€“317`), strict 1 pulau (`:331â€“340`), urutan nama â†’ KC â‰¤2 km â†’ role lengkap â†’ jarak (`:412â€“467`), pangkas >80 km bila ada â‰¤50 km (`:407â€“411`); tombol â€œTerapkan Role Iniâ€ â†’ `applyFase3Role` (`AnalystResultsGrid.tsx:301â€“327`, menulis `confidenceScore:100`, `EXACT_MATCH`, `editedManually`).

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| D1 | Dua engine beda kriteria â†’ hasil otomatis â‰  rekomendasi layar (contoh: fallback daftar pertama = AMBON, padahal layar menyarankan JAYAPURA di pulau sama) | `analystPipeline.ts:1591â€“1660` vs `roleRecommender.ts:60â€“471` | **Perlu keputusan**: jadikan engine layar sebagai engine resmi Fase 3 (disarankan) |
| D2 | âœ… SELESAI 2026-09-21 â€” fallback arbitrer `completeRoleList[0]` (skor 0,70) | `analystPipeline.ts` `matchRoleForOutlet` & jalur pipeline | Kosongkan + lempar manual: tanpa kecocokan nyata â†’ `organisasiTujuan` kosong (bukan `<OUTLET> BRANCH OFFICE`), `tipeUnit: OUTLET` (bukan KC), role 0/0/0 sehingga `is3RoleLengkap` false, `alurWondr`/`flowDescription` kosong (bukan label Tier karangan), status ANOMALI â†’ masuk antrean review |
| D3 | âœ… SELESAI 2026-09-21 â€” auto-final dari EXACT_MATCH tanpa melihat F1/F2 | blok hasil `analystPipeline.ts` | `isFinalApproved` otomatis kini = EXACT_MATCH **dan** `placementStatus===VERIFIED` **dan** `!usedFallback` |
| D4 | Dua kosakata Alur Wondr | `getWondrRecommendation` (`RoleMappingManager.tsx:283â€“312`) vs label generik pipeline `:1660, 900` | Satukan kosakata di satu fungsi |
| D5 | Pulau `'Lainnya'` membuat strict-1-pulau longgar | `roleRecommender.ts:334â€“336` | Bila pulau tak teridentifikasi â†’ paksa REVIEW, jangan anggap sama pulau |
| D6 | âœ… SELESAI 2026-09-21 â€” pilihan manual selalu `EXACT_MATCH` + confidence 100 | `AnalystResultsGrid.tsx` `applyFase3Role` | Sekarang `HIGH_CONFIDENCE`: akurasi mesin tidak lagi naik oleh keputusan manusia, dan baris hasil pilihan manual tidak ikut lolos gerbang auto-final |

## BAGIAN E â€” TINJAUAN 12 SINYAL

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| E1 | Fase 2 tidak memakai 12 sinyal (engine beda: `textSimilarityScore` + indeks sendiri) | `recommender.ts:118â€“231, 237â€“422` | Jika ingin seragam, jalankan sinyal di F2; minimal dokumentasikan beda metode |
| E2 | Fase 1 hanya 8 dari 12 sinyal (7 LCS, 10 containment, 12 initialism, 13 penjaga sengaja tidak dipakai untuk kota â€” keputusan BENAR) | `calculateCityMatchScore:783â€“835`; komentar `:778â€“782` | Perbarui label UI â€œ12 Sinyalâ€ agar menjelaskan cakupan per fase (`AnalystCanvas.tsx:317`) |
| E3 | Normalisasi unit bertentangan: sinyal mengubah `KCâ†’KANTOR CABANG` (`THESAURUS_MAP:244â€“249`), engine role justru menghapusnya (`roleMatcher.ts:67`) | Dua normalizer berbeda | Satukan aturan unit di satu fungsi |
| E4 | Fonetik bisa auto-final (`max(0.95, jaro)` â†’ â‰¥90 â†’ EXACT_MATCH) | `analystPipeline.ts:739`, `:1929` | Fonetik tidak boleh jadi dasar auto-final tunggal |
| E5 | Tiga ambang berbeda: bit â‰¥0,75 (`:678â€“684`), strongVotes/containment/initialism â‰¥0,85, terima kota â‰¥0,88 â†’ kartu sinyal â‰  kontribusi nyata | `analystPipeline.ts` | Selaraskan atau dokumentasikan |
| E6 | Dua definisi pulau | `getIslandFromProvince` (`analystPipeline.ts:449`) vs `getIslandFromProvinsi` (`roleRecommender.ts:14`) | Satukan satu fungsi |
| E7 | Bukti F1 & F3 digabung di UI (`bitTemuanBaris`) padahal tersimpan terpisah | `:200â€“201` | Tampilkan dua kelompok bukti di modal sinyal |
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
| D1 | Engine resmi Fase 3 | (a) engine layar (nama+jarak+KC+pulau) â€” disarankan, (b) engine nama | **(a)** |
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
| H1 | BELUM | Tabel widget vs sumber data: `dashboardStats` (`App.tsx:389â€“437`) & `regionalStats` (`:440â€“471`) & `DashboardMatchTable` membaca **`targetRows`** (alur Target lama); `finalMetrics` (`:475â€“513`) & peta (lapisan FINAL + anomali) membaca **`finalRows`** (pipeline). Akibat: kartu KPI proses menampilkan 0 walau pipeline sudah berjalan |
| H2 | BELUM | Komponen Dashboard mati (0 pemakaian): `Dashboard/AnalystInsightsBanner.tsx`, `Dashboard/AuditLogTable.tsx`, `Dashboard/WilayahChart.tsx` â€” masukkan ke A10 (hapus) atau pasang dengan data nyata |
| H3 | SKIP (keputusan) | **Keputusan produk:** Dashboard pakai data pipeline (`analystRows`/`finalRows`/`coverage`) â€” disarankan â€” atau tetap alur Target lama. Jangan kerjakan H1/H5 sebelum ini diputuskan |
| H4 | BELUM | Radar anomali & jumlah anomali: definisi sudah disatukan lewat `detectFinalAnomalies(finalRows, masterRows)` (dipakai `finalMetrics` + panel peta) â€” jadikan widget Dashboard |
| H5 | BELUM | Setelah H3 diputuskan: KPI pipeline-native (per status analisa, progres persetujuan per fase dari `phaseApproval` `App.tsx:651â€“669`, cakupan `coverage`), distribusi wilayah dari `finalRows`, pasang/hapus `AuditLogTable` + `AnalystInsightsBanner`, sinkronkan README (janji widget vs kenyataan) |

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
| ANI-5 | SELESAI | Angka KPI berubah mendadak â†’ count-up ~0,4 dtk (ease-out, hormati `prefers-reduced-motion`). File baru `src/components/Dashboard/AnimatedMetricValue.tsx` + 5 kartu di `src/components/Dashboard/MetricCards.tsx` memakainya. Tidak mengubah rumus/perhitungan. âš ï¸ build belum diverifikasi |

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
| 8 | `src/components/Dashboard/AnimatedMetricValue.tsx` (**file baru**) | Komponen `AnimatedMetricValue`: count-up/down ~400 ms (ease-out kubik, rAF), hormati `prefers-reduced-motion` (langsung ke nilai akhir). Presentasi saja â€” **tidak mengubah data/rumus** | ANI-5 | âš ï¸ BELUM |
| 9 | `src/components/Dashboard/MetricCards.tsx` | 5 angka KPI memakai `AnimatedMetricValue` (`stats.totalProcessed`, `fm.distinctKodePos`, `fm.belumDikerjakan`, `fm.anomali`, `fm.top.count`). Teks kecil footer tetap `fmt(...)` | ANI-5 | âš ï¸ BELUM |

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
| â€” | `src/App.css`, `src/index.css` | A9 (sebagian): dua file CSS mati terverifikasi tidak diimpor siapa pun. **Penghapusannya tidak dilakukan** â€” diblokir kebijakan "jangan hapus file tanpa konfirmasi operator" | A9, A10 | â¸ menunggu konfirmasi |

Yang **belum** diuji pada sesi 2: (a) SQL `final_rows` terhadap Postgres sungguhan (butuh tulis ke Neon â†’ aksi operator), (b) kartu Titik Koordinat di UI produksi untuk label `coba ulang 2.813 kode pos`.

---

## BAGIAN M â€” FASE 2: PULIHKAN PEMBAGIAN â€œOTOMATIS TERVALIDASIâ€ vs â€œPERLU MANUALâ€

> Ditambahkan 2026-09-21 dari temuan produksi: tab Fase 2 menampilkan **Outlet Tervalidasi (0)** vs **Perlu Validasi Manual (84.136)** â€” 100% baris masuk manual, padahal alur lama punya pembagian otomatis/manual yang benar. Status semua item di bagian ini: `BELUM`.

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

### M8 — FILE YANG DISENTUH

- `src/utils/analystPipeline.ts` — auto-fill Rank-1, `fase2Status`, `fase2Sumber`, `sinyalF2Bit`, per-kelurahan
- `src/utils/recommender.ts` — ensemble 12 sinyal untuk Fase 2, urutan KC (seri ≤ 2 km), Tier-2 diurut jarak km
- `src/components/WorkingEngine/AnalystResultsGrid.tsx` — gate 3 kategori per baris, hapus ketergantungan `fase2ValidCities`
- dokumen ini — Bagian 0 dan Bagian M

---

## BAGIAN N — ATURAN EDIT/REVISI & TABEL YANG TIDAK TERPOTONG

> Ditambahkan 2026-09-21 atas permintaan pemilik produk. Semua item di bagian ini BELUM.

### N0 — ATURAN PRODUK: FASE 1/2/3 TIDAK ADA EDIT, HANYA REVISI

**Aturan:**
- Di dalam Data Analyst (Fase 1, 2, 3) **tidak ada Edit field**. Yang tersedia hanya **Revisi** (mengembalikan baris agar diproses ulang) dan aksi kandidat (pilih cabang / terapkan role).
- **Edit data** hanya di menu **Data Master** (Data Wilayah, Data PTEN, Data Cabang, Data Mapping Role, Data Kode Pos). Jika ada salah analisa, perbaiki di master lalu jalankan ulang analisa.

**Kondisi sekarang (bukti kode):**
- Tombol Edit masih ada di grid: `AnalystResultsGrid.tsx:1943` (ikon `Edit` + teks Edit).
- Modal edit masih terpasang: import di `:38`, render di `:2051` (`AnalystRowEditModal`).
- Revisi sudah ada: tombol `RotateCcw` menuju `setConfirmManualRow(r)` yang menandai `perluManual: true`.

**Eksekusi:**
1. Hapus tombol Edit dari blok aksi baris pada grid (blok `{innerTab === BERES && (...)}` sekitar `:1887-1960`).
2. Hapus import `AnalystRowEditModal` (`:38`) dan blok render-nya (`:2051`), lalu hapus file `src/components/WorkingEngine/AnalystRowEditModal.tsx` bila `grep -n AnalystRowEditModal src/` menghasilkan 0.
3. Pertahankan `onUpdateRow` karena masih dipakai untuk: terapkan kandidat Fase 2 (`applyFase2Candidate`), terapkan role Fase 3 (`applyFase3Role`), tombol Setujui per baris, dan konfirmasi Revisi.
4. Ganti fungsi Edit dengan navigasi ke menu master: tambahkan tombol kecil **Buka Data Cabang** (ikon `Store`) pada baris yang Perlu Manual, memanggil handler navigasi ke tab `master` (tambahkan prop bila belum ada di grid).
5. Tambahkan keterangan kecil di header tab Fase 1-3: **Salah analisa? Perbaiki di Data Master lalu jalankan ulang fase ini.**
6. Audit jalur edit lain: `CandidateDetailModal`, `CityOverrideModal`, `AnalystRowEditModal` — pastikan tidak ada yang menulis field baris dari dalam fase; bila ada, jadikan read-only atau arahkan ke master.

**Uji:** buka Fase 1/2/3, tombol Edit tidak ada; tombol Revisi tetap ada; mengubah data hanya bisa dari menu Data Master.

### N1 — KOLOM TABEL TERPOTONG (nilai tidak muncul semua)

**Bukti kode:**
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

**Checklist uji UI:**
- Semua kolom terbaca penuh tanpa harus klik (wrap atau tooltip tersedia).
- Tidak ada tombol tanpa label saat kursor diarahkan.
- Diuji pada lebar 1280px dan 1024px: tidak ada nilai hilang tanpa tooltip.
- Tangkapan layar Fase 1/2/3: tidak ada baris yang terpotong.

---

**Akhir dokumen.** Untuk konversi PDF: buka file ini di VS Code lalu ekspor Markdown ke PDF, atau salin ke Google Docs/Word lalu Export PDF; untuk Canva, salin bagian tabel per bagian karena Canva tidak merender tabel Markdown otomatis.

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

**Akhir dokumen.** Untuk konversi PDF: buka file ini di VS Code lalu ekspor Markdown ke PDF, atau salin ke Google Docs/Word lalu Export PDF; untuk Canva, salin bagian tabel per bagian karena Canva tidak merender tabel Markdown otomatis.
