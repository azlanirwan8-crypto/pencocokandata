# RENCANA PERBAIKAN SELURUH APLIKASI
> **⚠️ STATUS 2026-09-21: BELUM SELESAI — 17 dari 67 item `SELESAI`, 50 `BELUM` (5 di antaranya tinggal dieksekusi, keputusannya sudah diambil).**
> Baca Bagian 0 sebelum mengerjakan apa pun. Titik lanjut: **A3** (BaseModal). Rincian & bukti verifikasi ada di sana.

**Aplikasi:** Tools Data Matcher Cabang & Outlet v2.x — React + TypeScript + Vite; IndexedDB (lokal) + Neon Postgres (cloud via serverless `api/`).
**Sumber:** tinjauan kode statis; aplikasi TIDAK dijalankan saat audit (`node`/`npm` tidak tersedia). Nomor baris = kondisi saat audit; verifikasi ulang dengan pencarian teks sebelum mengubah.
**Pemakai:** AI/developer eksekutor. Ikuti urutan di Bagian 10. Jangan ubah dua mesin sekaligus tanpa membaca file pasangannya (`analystPipeline.ts` ↔ `recommender.ts` ↔ `AnalystResultsGrid.tsx`).

## 0. STATUS PENGERJAAN — WAJIB DIBACA AI SEBELUM EKSEKUSI

> ### 🟨 PENAANDAAN STATUS — 2026-09-21 — **DOKUMEN INI BELUM SELESAI, JANGAN DIANGGAP TUNTAS**
>
> Ringkas dari 67 item pada tabel di bawah ini:
>
> | Status | Jumlah | ID |
> |---|---|---|
> | ✅ `SELESAI` | **17** | A1, A2, A3, A4, A5, B4, F3-C1, F3-C2, F6-X4, G2, G4, G5, G6, G7, G8, G9, G10 |
> | ⬜ `BELUM` | **50** | sisanya — termasuk 5 item yang dulu `SKIP`: keputusannya **sudah diambil 2026-09-21** (lihat Bagian 12), tinggal dieksekusi (B1, B2, D1, D3, D6) |
>
> Belum termasuk item Bagian **H/I/J/K di Lampiran** (statusnya `BELUM`, ditandai langsung di barisnya; khusus Bagian K: K1–K3 sudah dikerjakan & build-verified 2026-09-21, K4–K5 `BELUM`).
>
> **Untuk AI berikutnya (Cline / lainnya):**
> 1. Urutan sisa yang disepakati: **D2/D3/D6** + B1/B2/D1 (kejujuran data) → **C2a–C2e + C3/C4** (Fase 2) → **A6–A10, E, F, G1/G3/G11/G12** (kebersihan & sisanya). **G9 sudah selesai** — jangan buat file `api/` baru apa pun (alasan + bukti: kotak 🚫 di Bagian G9).
> 2. **Jangan kerjakan ulang** 13 item `SELESAI`; baca kolom "Catatan" untuk file yang sudah disentuh.
> 3. Nomor baris di dokumen ini berasal dari audit statis dan **sudah bergeser** — cari teksnya, jangan percaya angka barisnya.
> 4. Setelah satu item selesai: ganti statusnya di tabel + isi tanggal `YYYY-MM-DD` + file yang diubah, lalu commit dokumen ini bersama kodenya.
> 5. Wajib jalankan Bagian 11 sebelum melapor selesai: `npm run build` dan `npm run lint` (oxlint, **bukan eslint**) harus bersih.
>
> **Bukti verifikasi batch G2/A4 (2026-09-21):** `npm run build` ✓ · `npm run lint` 0 error / 84 warning (baseline saat itu) · diuji di browser (dev `localhost:5199`, modul sumber di-import langsung): `makeFinalKey` V2 memisahkan dua kota yang bertabrakan di versi lama, `AnalisaDibatalkan` benar-benar terlempar saat flag naik dan run normal tetap selesai, notifikasi warning muncul & hilang sesuai auto-dismiss, `ConfirmDialog` restore cadangan menjalankan aksinya hanya setelah "Ya, Pulihkan" · `grep alert(` di `src/` = 0.
>
> **Bukti verifikasi terakhir (2026-09-21, batch G9):** `npx tsc -b --force` 0 error · `npm run build` ✓ · `npm run lint` 0 error / **82** warning (semuanya di file lain; `src/App.tsx` & `src/utils/neonSync.ts` = 0 warning) · `npx tsc -p api/tsconfig.json --noEmit` ✓ · `pilFinalDariCloud` diukur di browser dev lewat 7 kasus (baris cloud baru diterima; baris berkunci alami sama dengan `id` berbeda DITOLAK; duplikat internal cloud hanya 1 yang masuk; baris tanpa `id`/tanpa `kodePosPten` dibuang; kota kembar beda kota tetap dipulihkan) · helper cloud diukur dengan endpoint tiruan: 700 baris = 2 GET (500+200, tanpa celah) dan 3 POST (chunk 300, body maks 102 KB utk baris 146 B) · handler `api/target.ts` dijalankan terhadap `sql` palsu: GET kosong → `CREATE TABLE final_rows` + `total:0`; GET paging → `returned:500 offset:200 total:700`; POST upsert 701 baris → `written:700` (baris tanpa id dibuang) & **tidak ada** `DELETE`; POST `mode:'replace'` → ada `DELETE` lebih dulu; POST tanpa mode → upsert (aman); DELETE tanpa `key`/`all` → 400 dan nol query destruktif; DELETE `&key=` → 1 baris; DELETE `&all=1` → 705 baris; `view` tak dikenal pada POST/DELETE → 400 tanpa menyentuh `target_records`; jalur lama `GET/DELETE /api/target` (tanpa `view`) tetap meng tabel target.
>
> Catatan verifikasi: `npm run build` memakai `tsc -b` **inkremental** — tanpa `--force` error di file yang tidak diubah bisa terlewat. Selalu verifikasi dengan `npx tsc -b --force`.


**Aturan untuk AI/developer:**
1. Baca tabel status di bawah SEBELUM mengerjakan apa pun.
2. Item berstatus `SELESAI` → **JANGAN dikerjakan ulang**.
3. Item berstatus `SEDANG` → lanjutkan dari catatan yang tercantum.
4. Item berstatus `SKIP (keputusan)` → menunggu keputusan pemilik (lihat Bagian 12); jangan eksekusi.
5. Setelah menyelesaikan satu item: ubah statusnya jadi `SELESAI`, isi tanggal (YYYY-MM-DD) dan catatan singkat (file yang diubah), lalu commit.
6. Nilai status yang valid: `BELUM` / `SEDANG` / `SELESAI` / `SKIP (keputusan)`.

| ID | Status | Tgl selesai | Catatan |
|---|---|---|---|
| A1 | SELESAI | 2026-09-21 | `src/components/Notification/NotificationProvider.tsx` (provider + kartu bertumpuk, portal ke body, auto-dismiss 4d/4d/8d, error manual) + `NotificationContext.ts` (hook `useNotification` — difile terpisah supaya `react(only-export-components)` bersih). 19 `alert()` diganti `notify()` di App, AnalystResultsGrid, PTEN/Cabang/KodePos/RoleMapping/Wilayah Manager, IndonesiaBranchMap; `showToast` grid dialirkan ke provider (banner lokal + `setTimeout` tanpa cleanup dihapus). Nol `alert()` tersisa di `src/`. Belum ada error-fatal yang perlu dipertahankan sebagai `alert()` |
| A2 | SELESAI | 2026-09-21 | `SnapshotModal.tsx` — `window.confirm` restore diganti `ConfirmDialog` (pesan menyebut tanggal + jumlah baris Master/Target/Match/Wilayah + akibat). Sisanya hanya `TargetDataGrid.tsx:2572` (file mati, tidak di-import siapa pun → tunggu A10). Ikut diperbaiki: `ConfirmDialog` membungkus `message` dengan `<div>` bukan `<p>` (React melapor `div`/`ul` di dalam `p` = HTML invalid) |
| A3 | SELESAI | 2026-09-21 | `src/components/BaseModal.tsx` (`DialogPanel` = perilaku murni tanpa mengubah tampilan, `BaseModal` = + tata letak standar) + `src/components/useDialogBehavior.ts`. 31 dialog dibungkus. Bukti: `grep role="dialog" src` = 0 di luar BaseModal; `grep modal-backdrop` = 0 di luar BaseModal; `grep "Escape" src` = 0 handler lokal tersisa. Dialog persetujuan (`ConfirmDialog`) tidak lagi tertutup klik-luar |
| A4 | SELESAI | 2026-09-21 | `analystPipeline.ts`: kelas `AnalisaDibatalkan` + param `pembatal?: { batal: boolean }` yang dicek di `tick()` (dipakai loop kota & loop baris) dan sekali sebelum return akhir. `App.tsx`: `pembatalAnalisaRef` + `handleBatalkanAnalisa` + `isCancelling`; catch khusus → progress 0, pesan "hasil tidak disimpan", notifikasi `info`. `AnalystCanvas.tsx`: tombol "Batalkan" hanya tampil saat `isAnalyzing` ("Membatalkan..." saat flag naik). Terukur di browser: `batal:true` → melempar `AnalisaDibatalkan`; `batal:false` → run selesai (1 baris). Tidak ada hasil setengah jadi karena `setAnalystRows` hanya dipanggil setelah pipeline kembali |
| A5 | SELESAI | 2026-09-21 | Topbar.tsx — status koneksi + tombol Database + tombol Simpan (flushPendingWrites). Build & lint terverifikasi 2026-09-21 |
| A6 | BELUM | — | |
| A7 | BELUM | — | |
| A8 | BELUM | — | |
| A9 | BELUM | — | |
| A10 | BELUM | — | |
| B1 | BELUM | — | Keputusan diambil 2026-09-21 (Bagian 12) — menunggu eksekusi |
| B2 | BELUM | — | Keputusan diambil 2026-09-21 (Bagian 12) — menunggu eksekusi |
| B3 | BELUM | — | Verifikasi ekspor saja |
| B4 | SELESAI | 2026-09-21 | Opsi (a): semua karangan di `analystPipeline.ts` dihapus — fallback kota "KOTA JAKARTA PUSAT" & kode pos "10110" jadi kosong, label "Wilayah 01" jadi kosong, dan baris penanda "kota PTEN tanpa cabang di master" tidak lagi mengarang W-code (tabel modulo) / `CABANG x` / `KCP x` / `Jl. Protokol x` / `Status Outlet: Aktif`. Sisa karangan di mesin role dicatat sebagai bagian D2 |
| C2a | BELUM | — | |
| C2b | BELUM | — | |
| C2c | BELUM | — | |
| C2d | BELUM | — | |
| C2e | BELUM | — | |
| C3 | BELUM | — | Wajib setelah C2a–C2e |
| C4 | BELUM | — | Kasus uji |
| D1 | BELUM | — | Keputusan diambil 2026-09-21 (Bagian 12) — menunggu eksekusi |
| D2 | BELUM | — | |
| D3 | BELUM | — | Keputusan diambil 2026-09-21 (Bagian 12) — menunggu eksekusi |
| D4 | BELUM | — | |
| D5 | BELUM | — | |
| D6 | BELUM | — | Keputusan diambil 2026-09-21 (Bagian 12) — menunggu eksekusi |
| E1 | BELUM | — | |
| E2 | BELUM | — | |
| E3 | BELUM | — | |
| E4 | BELUM | — | |
| E5 | BELUM | — | |
| E6 | BELUM | — | |
| E7 | BELUM | — | |
| E8 | BELUM | — | |
| F1-W1 | BELUM | — | |
| F1-W2 | BELUM | — | |
| F1-W3 | BELUM | — | |
| F2-P1 | BELUM | — | |
| F2-P2 | BELUM | — | |
| F2-P3 | BELUM | — | |
| F3-C1 | SELESAI | 2026-09-21 | App.tsx handleMasterLoaded: mode 'update' = replace langsung; CabangManager kirim 'update' utk edit/hapus; impor Excel tetap 'replace' (merge+dedup). Build & lint terverifikasi 2026-09-21 |
| F3-C2 | SELESAI | 2026-09-21 | Sama seperti F3-C1 |
| F3-C3 | BELUM | — | |
| F4-R1 | BELUM | — | |
| F4-R2 | BELUM | — | |
| F4-R3 | BELUM | — | |
| F5-K1 | BELUM | — | |
| F5-K2 | BELUM | — | |
| F5-K3 | BELUM | — | |
| F6-X1 | BELUM | — | |
| F6-X2 | BELUM | — | |
| F6-X3 | BELUM | — | |
| F6-X4 | SELESAI | 2026-09-21 | = A5 (Topbar status koneksi + tombol Database + Simpan). Build & lint terverifikasi 2026-09-21 |
| F6-X5 | BELUM | — | |
| G1 | BELUM | — | |
| G2 | SELESAI | 2026-09-21 | `makeFinalKey` dilebarkan → `kodePos\|kelurahan\|kecamatan\|kota`; 4 titik pemakai ikut (`App.tsx` exclude + merge persetujuan, `analystPipeline.ts` skip). Migrasi IndexedDB tidak diperlukan (kunci dihitung dari field, tidak disimpan). Lihat catatan di Bagian G2 |
| G3 | BELUM | — | |
| G4 | SELESAI | 2026-09-21 | FinalDataManager — modal Detail per baris (role dialog + Esc). Build & lint terverifikasi 2026-09-21 |
| G5 | SELESAI | 2026-09-21 | FinalDataManager — aksi Hapus permanen + App.tsx handleDeleteFinalRow. Build & lint terverifikasi 2026-09-21 |
| G6 | SELESAI | 2026-09-21 | FinalDataManager — returnAll & revisi pakai ConfirmDialog. Build & lint terverifikasi 2026-09-21 |
| G7 | SELESAI | 2026-09-21 | Opsi (a): `handleReturnFinalToAnalyst` (App.tsx) kini me-reset `fase1/2/3Approved` + `isFinalApproved` untuk baris yang datang dari Final — sama seperti Revisi per baris, jadi kembali ke Fase 1. Baris yang sejak awal ada di antrean Analyst tidak ikut kehilangan persetujuannya |
| G8 | SELESAI | 2026-09-21 | Opsi (a): baris PERLU_REVIEW/ANOMALI tetap ikut dipindahkan, tapi `ConfirmDialog` "Pindahkan ke Final Analisa?" menyebut jumlahnya (pemisah `perluReview`/`anomali` ditambahkan ke `stats` di AnalystResultsGrid) |
| G9 | SELESAI | 2026-09-21 | Tabel per-baris `final_rows` + `?view=final` pada `api/target.ts` yang sudah ada (BUKAN file `api/` baru). `neonSync.ts`: `loadFinalFromNeon/saveFinalToNeon/deleteFinalRowInNeon/clearFinalInNeon`; `analystPipeline.ts`: `pilFinalDariCloud`; `App.tsx`: merge non-destruktif di boot + push di 4 titik mutasi Final; `api/status.ts` + modal Database menampilkan jumlah `final_rows`. Bukti verifikasi di Bagian G9 |
| G10 | SELESAI | 2026-09-21 | FinalDataManager — card metrik (total/KC/KCP/role lengkap/wilayah). Build & lint terverifikasi 2026-09-21 |
| G11 | BELUM | — | |
| G12 | BELUM | — | Panduan, bukan tugas terpisah |

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
| Data Final | `src/components/WorkingEngine/FinalDataManager.tsx` + handler `App.tsx:741–796` |
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
| P0 | `window.confirm` → ConfirmDialog | A2, G6 |
| P0 | Notifikasi seragam (hapus `alert()`) | A1 |
| P0 | Modal aksesibilitas (BaseModal) | A3 |
| P0 | Tombol Batalkan analisa | A4 |
| P0 | Data Final tidak sinkron ke cloud | G9 |
| P1 | Fase 2: Rank-1, KC ≤2 km, per kelurahan, Tier-2 terdekat | C2 |
| P1 | Impor tanpa dedup; Branch Code→Wilayah | F2-P1, F4-R1, F1-W1 |
| P1 | Data Final: Upload, Detail, Hapus, kunci matching | G1, G4, G5, G2 |
| P2 | Dead code, CSS mati, konsistensi 12 sinyal | A10, E1–E8 |

## BAGIAN A — UI GLOBAL

### A1 — Notifikasi seragam
**Masalah:** 3 pola campur: `alert()` browser (≥21 titik), toast lokal hanya di `AnalystResultsGrid.tsx:343` (4 detik, tanpa `error`), banner inline per modul.
**Lokasi `alert()`:** `App.tsx:642`; `AnalystResultsGrid.tsx:667,676`; `PTENManager.tsx:236,292,302,385`; `KodePosManager.tsx:412,416`; `CabangManager.tsx:309`; `RoleMappingManager.tsx:509,544,554,656`; `WilayahManager.tsx:293,366,392`; `IndonesiaBranchMap.tsx:1305,1710`.
**Eksekusi:** (1) buat `src/components/Notification/NotificationProvider.tsx` + hook `useNotification` — portal ke body, kartu bertumpuk, type `success|info|warning|error`, auto-dismiss success/info 4 d, warning 8 d, error tidak auto + tombol tutup; (2) ganti semua `alert()` di daftar atas dengan `add(...)`; (3) arahkan `showToast` lama ke provider global (hapus `setTimeout` tanpa cleanup).

### A2 — Konfirmasi destruktif seragam
**Masalah:** aksi berisiko masih `window.confirm` native; `ConfirmDialog` sudah ada tapi belum dipakai semua.
**Lokasi:** `FinalDataManager.tsx:104,213`; `AnalystResultsGrid.tsx:1889`; `SnapshotModal.tsx:143`; `TargetDataGrid.tsx:2572` (file mati).
**Eksekusi:** semua aksi destruktif → `ConfirmDialog` dengan pesan yang menyebut jumlah baris + akibat (contoh: “1.240 baris akan keluar dari Final Data dan kembali ke Data Analyst”). Aksi hanya jalan di `onConfirm`.

### A3 — Modal aksesibilitas (BaseModal) ✅ SELESAI 2026-09-21
**Masalah:** `role="dialog"`/`aria-modal`/Escape hanya di 4 file (`GoogleApiKeyModal`, `KodePosManager`, `KodePosSyncModal`, `SinyalTemuanModal`). `ConfirmDialog` belum punya role/Escape. Klik-luar hanya `SinyalTemuanModal.tsx:52` & `ConfirmDialog.tsx:45`. Tidak ada focus trap/pengembalian fokus.
**Catatan eksekusi:** yang dibuat ternyata DUA lapis — `DialogPanel` (hanya perilaku: portal, role, Esc, fokus, Tab-trap, klik-luar) dipakai dialog yang markup-nya sudah jadi supaya tampilannya TIDAK berubah sama sekali, dan `BaseModal` (`DialogPanel` + header/body/footer `.modal-*`) untuk dialog baru. Nama dialog diambil otomatis dari `.modal-title`/`<h1..h6>` pertama di dalam panel (`aria-labelledby` dipasang sendiri), jadi tidak perlu menulis label dua kali.

**Eksekusi:** (1) buat `src/components/BaseModal.tsx` — portal, overlay, `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape, klik-luar opsional (`closableOnOutside`), fokus ke elemen pertama + kembali ke pemicu saat tutup; (2) bungkus semua modal: `ConfirmDialog`, `SnapshotModal`, `NeonDatabaseModal`, `TargetUploadModal`, `AnalystRowEditModal`, `CandidateDetailModal`, `CityOverrideModal`, `PtenCityPicker`, modal edit/detail/delete/reset di PTEN/Cabang/Wilayah/RoleMapping/KodePos. Dialog persetujuan data: `closableOnOutside=false`.

### A4 — Tombol Batalkan analisa
**Masalah:** saat `isAnalyzing` hanya tombol dinonaktifkan (`AnalystResultsGrid.tsx:1630`, tombol utama `AnalystCanvas`); 46–83 ribu baris tak bisa distop.
**Eksekusi:** state `isCancelling` + flag/`AbortSignal` yang dicek tiap iterasi pipeline (loop `analystPipeline.ts:1426+`, `1830+`); tombol “Batal” aktif saat berjalan; saat batal → notifikasi “hasil dibatalkan tidak disimpan”, state kembali ke kondisi sebelum run.

### A5 — Topbar: status koneksi & pending write
**Masalah:** `Topbar.tsx:6–11` mendeklarasikan `isNeonConnected`, `lastSyncedAt`, `onOpenNeonModal`, `onOpenSupabaseModal` tetapi tidak dirender. Tidak ada indikator “menyimpan/belum tersimpan” padahal `storage.ts:82` punya `flushPendingWrites()`.
**Eksekusi:** render badge koneksi (“Terhubung · disinkron HH:MM” / “Offline”), tombol buka `NeonDatabaseModal`, indikator pending-write + tombol “Simpan sekarang” (`flushPendingWrites()`).

### A6 — State hilang saat pindah menu
**Masalah:** `App.tsx` merender hanya tab aktif (mis. `:1138`) → filter/pencarian/urutan/halaman/pilihan kandidat (`fase2Choice`, `fase3RoleChoice`) reset tiap pindah menu.
**Eksekusi:** angkat state grid ke `App.tsx` atau simpan di `sessionStorage` (minimal: filter wilayah/status, halaman, pageSize).

### A7 — Penanda “N baris belum disetujui”
**Masalah:** tombol terkunci saat fase sudah dieksekusi tapi belum disetujui (`App.tsx:676–682`) tanpa info sisa & tanpa lompat.
**Eksekusi:** hitung per fase baris `!faseNApproved && kategori!=='TIDAK_ANALISA'`; tampilkan “N baris belum disetujui” yang bisa diklik → filter/scroll ke baris pertama.

### A8 — Virtualisasi vs baris kartu
**Masalah:** `useVirtualWindow.ts:63–70` mengukur tinggi dari baris pertama (fallback 44 px, ambang 200 baris `:32`); tab Fase 2/3 berisi kartu kandidat tinggi tak seragam → scroll melompat saat `pageSize='ALL'`.
**Eksekusi:** nonaktifkan windowing untuk tab Fase 2/3, atau tinggi baris tetap + area kartu scroll internal.

### A9 — Responsivitas & CSS mati
**Masalah:** stylesheet aktif hanya `src/styles/index.css` dengan 1 media query (`:704`); kolom sticky lebar tetap (340–420 px). `src/App.css` & `src/index.css` tidak diimpor (`main.tsx:3`).
**Eksekusi:** breakpoint 1280/1024/768 untuk sidebar & tabel (scroll horizontal + indikator); hapus 2 file CSS mati.

### A10 — Dead code
**Tidak diimpor:** `TargetDataGrid.tsx` (3.155 baris), `MasterUploadModal.tsx` (479), `MasterDataGrid.tsx` (282), `ProximityGuideModal.tsx` (313), `MasterUpload.tsx` (220), `FilterToolbar.tsx` (95), `Navbar.tsx` (93), `ProgressBar.tsx` (55), `App.css`, `index.css`. Fungsi mati `matcher.ts`: `matchSingleRow:93`, `resolveLevel2TieBreaker:67`, `executeChunkMatching:266`. UI mati: `TargetUploadModal` tak pernah bisa dibuka (`App.tsx:56,1247`).
**Eksekusi:** hapus/arsip setelah F1–F4 selesai.

## BAGIAN B — FASE 1 (PTEN & Kode Pos)

**Alur berjalan:** item = 1 kota PTEN (`analystPipeline.ts:968–974`) → 1 baris Master Cabang kota itu (`:1022–1024`) → cari rekaman PTEN (nama + kode pos persis → fuzzy ≥0,88 → pemekaran, `:1455–1508`) → `resolveCityByGeocode` tarik kelurahan/kecamatan KodePos kota itu + saring blok kode pos PTEN → VERIFIED/REVIEW/FALLBACK (`:1283–1414`) → expand **1 baris per kelurahan**, semua pakai satu `kodePosPten` (`:1878–1895`) → `TIDAK_ANALISA` untuk kota tak ada di PTEN (`:1967–2016`) → laporan `coverage` (`:2020–2029`).

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| B1 | Kota/Kabupaten kembar nama menyatu jadi 1 grup | `ADMIN_NOISE_TOKENS:279–290` buang `KOTA/KABUPATEN`; `cityMatchKey:342–348`; PTEN tanpa prefix (`defaultPtenData.ts:792,1008` “BOGOR”) | Simpan jenis daerah (KOTA/KAB) terpisah saat membandingkan; minimal tambahkan peringatan “2 wilayah digabung” di laporan cakupan. **Perlu keputusan** |
| B2 | Kode pos kelurahan tidak masuk hasil/ekspor (`KODE POS` = `KODE POS PTEN` sama) | `AnalystResultsGrid.tsx:616,622` (ekspor), `:194` (grid) | Tambah kolom “Kode Pos Kelurahan” (dari `KodePosRow.kodePos`), pisahkan dari `KODE POS PTEN`; jelaskan `CEK KODE POS + PTEN` sebagai pembanding tingkat kota. **Perlu keputusan** |
| B3 | Baris `TIDAK_ANALISA` dinomori belakangan & tidak ikut approve otomatis (benar) | `:1969`, `:2030`, `App.tsx:815` | Pertahankan; pastikan ekspor menomori ulang |
| B4 | ✅ SELESAI 2026-09-21 — default palsu (dihapus) | `'KOTA JAKARTA PUSAT'` `:1510`; `'10110'` `:1511`; `'Wilayah 01'` `:1898`; tebakan W-code `:1028–1040`; identitas sintetis `:1584–1589` | Ganti kosong + status manual; jangan isi karangan |

## BAGIAN C — FASE 2 (Wilayah & Cabang)

**Alur berjalan:** lapis otomatis = ambil baris Master Cabang kota itu, aturan Aceh→KIM, Kanwil dari Branch Code (`analystPipeline.ts:1564–1589`), **tanpa jarak**. Lapis review = 3 kandidat **per kota** (`AnalystResultsGrid.tsx:230–255`), urutan skor→selisih kode pos (`recommender.ts:667`; jarak km hanya tampilan `:677`), tombol terapkan `:266–289` (hitung ulang F3 baris itu).

### C2 — Perubahan yang DISETUJUI (wajib dieksekusi)
| Aturan | Implementasi |
|---|---|
| **C2a Rank-1 otomatis = terdekat** | Fase 2 otomatis (`analystPipeline.ts:1564–1589`) jangan hanya join cabang kota: jalankan engine kandidat yang sama dengan layar, ambil **Rank 1** (jarak km terkecil dalam kota sama), tulis ke field Fase 2 baris |
| **C2b Seri ≤2 km → KC menang** | Pengurutan kandidat (`recommender.ts:667`): bila `|kmA−kmB| ≤ 2` dan hanya salah satu `Status Outlet==='KC'` → KC lebih dulu (pola sama `roleRecommender.ts:424–434`) |
| **C2c Sumber KC** | Kolom **`Status Outlet`** Data Cabang bernilai **persis `'KC'`** (uppercase-trim). Mapping Role BUKAN penentu KC untuk Fase 2 |
| **C2d Hitung per kelurahan** | `AnalystResultsGrid.tsx:230–255`: kunci cache dari `makeFinalKey(r.kodePosPten, r.kelurahan)` atau `r.id`, bukan `cityMatchKey(r.groupKota)`; `fase2ValidCities` (`:258–265`) & `butuhManual` (`:478`) jadi per baris |
| **C2e Tier-2 = kota terdekat di provinsi sama** | Pool provinsi (`recommender.ts:593–634`) diurut pakai `calculateRealDistance().distanceKm` (`geoDistance.ts:217`) — bukan `postalDiff*2+4000` (`:389`) |

### C3 — Gerbang validasi manual diganti
Setelah Rank-1 otomatis, semua baris “match_top1” → `fase2ValidCities`/`butuhManual` mati. Ganti penanda: (a) kandidat dari kota berbeda (Tier-2), (b) jarak > ambang (mis. >16 km), (c) KC tak ketemu → KCP terpilih, (d) kota tak ada di master.

### C4 — Kasus uji wajib
Kota **Bandung**: baris **Braga** (40111, Sumur Bandung) → P1 Asia Afrika 98% ~1,4 km; baris **Lebak Siliwangi** (40132, Coblong) → Pilihan 1 harus **Dago 98% ~1,4 km** (bukan Asia Afrika ~4,2 km). Setelah C2d, dua baris WAJIB berbeda hasil.

## BAGIAN D — FASE 3 (Mapping Role & Wondr)

**Alur berjalan:** dua engine — (1) otomatis di pipeline: pool hanya cabang 3-role-lengkap (`analystPipeline.ts:842–844, 1422–1424`), skor `calculateUnifiedPrecisionScore` ambang ≥0,75, fallback keyword kota 0,85 → fallback daftar pertama 0,70 (`:1591–1660`, `matchRoleForOutlet:849–915`); `isFinalApproved` otomatis bila EXACT_MATCH (`:1929`). (2) layar review per baris: `roleRecommender.ts:60–471` — KC prioritas (`nameMatchScore 200/180`, baris `242–267, 268–317`), strict 1 pulau (`:331–340`), urutan nama → KC ≤2 km → role lengkap → jarak (`:412–467`), pangkas >80 km bila ada ≤50 km (`:407–411`); tombol “Terapkan Role Ini” → `applyFase3Role` (`AnalystResultsGrid.tsx:301–327`, menulis `confidenceScore:100`, `EXACT_MATCH`, `editedManually`).

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| D1 | Dua engine beda kriteria → hasil otomatis ≠ rekomendasi layar (contoh: fallback daftar pertama = AMBON, padahal layar menyarankan JAYAPURA di pulau sama) | `analystPipeline.ts:1591–1660` vs `roleRecommender.ts:60–471` | **Perlu keputusan**: jadikan engine layar sebagai engine resmi Fase 3 (disarankan) |
| D2 | Fallback arbitrer `completeRoleList[0]` (skor 0,70) | `analystPipeline.ts:1682` (juga `:916` di jalur lama) | BELUM. Yang masih harus dikosongkan (sisa B4 di mesin role): `organisasiTujuan` karangan `<NAMA OUTLET> BRANCH OFFICE` (`:1688`), `roleCabsal/roleCabapv1/roleCabapv2` dipaksa `1` saat tidak ada kandidat (`:1691-1693`) sehingga `is3RoleLengkap` & label Tier ikut diklaim, dan `isKc` default `true` (`:1689`). Ganti dengan kandidat terdekat satu pulau, atau kosongkan + lempar manual |
| D3 | Auto-final dari EXACT_MATCH tanpa melihat F1/F2 | `:1929` | Auto-final hanya bila `placementStatus==='VERIFIED'` dan bukan hasil fallback |
| D4 | Dua kosakata Alur Wondr | `getWondrRecommendation` (`RoleMappingManager.tsx:283–312`) vs label generik pipeline `:1660, 900` | Satukan kosakata di satu fungsi |
| D5 | Pulau `'Lainnya'` membuat strict-1-pulau longgar | `roleRecommender.ts:334–336` | Bila pulau tak teridentifikasi → paksa REVIEW, jangan anggap sama pulau |
| D6 | Pilihan manual selalu `EXACT_MATCH` + confidence 100 → bisa lolos auto-final | `AnalystResultsGrid.tsx:301–327`, `App.tsx:620` | Pilihan manual = `HIGH_CONFIDENCE` atau butuh persetujuan terpisah. **Perlu keputusan** |

## BAGIAN E — TINJAUAN 12 SINYAL

| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| E1 | Fase 2 tidak memakai 12 sinyal (engine beda: `textSimilarityScore` + indeks sendiri) | `recommender.ts:118–231, 237–422` | Jika ingin seragam, jalankan sinyal di F2; minimal dokumentasikan beda metode |
| E2 | Fase 1 hanya 8 dari 12 sinyal (7 LCS, 10 containment, 12 initialism, 13 penjaga sengaja tidak dipakai untuk kota — keputusan BENAR) | `calculateCityMatchScore:783–835`; komentar `:778–782` | Perbarui label UI “12 Sinyal” agar menjelaskan cakupan per fase (`AnalystCanvas.tsx:317`) |
| E3 | Normalisasi unit bertentangan: sinyal mengubah `KC→KANTOR CABANG` (`THESAURUS_MAP:244–249`), engine role justru menghapusnya (`roleMatcher.ts:67`) | Dua normalizer berbeda | Satukan aturan unit di satu fungsi |
| E4 | Fonetik bisa auto-final (`max(0.95, jaro)` → ≥90 → EXACT_MATCH) | `analystPipeline.ts:739`, `:1929` | Fonetik tidak boleh jadi dasar auto-final tunggal |
| E5 | Tiga ambang berbeda: bit ≥0,75 (`:678–684`), strongVotes/containment/initialism ≥0,85, terima kota ≥0,88 → kartu sinyal ≠ kontribusi nyata | `analystPipeline.ts` | Selaraskan atau dokumentasikan |
| E6 | Dua definisi pulau | `getIslandFromProvince` (`analystPipeline.ts:449`) vs `getIslandFromProvinsi` (`roleRecommender.ts:14`) | Satukan satu fungsi |
| E7 | Bukti F1 & F3 digabung di UI (`bitTemuanBaris`) padahal tersimpan terpisah | `:200–201` | Tampilkan dua kelompok bukti di modal sinyal |
| E8 | Klaim akurasi “96,3% pada 27 pasangan” berbasis sampel kecil; uji hanya skrip manual `scratch/uji-matcher.mjs` | `AnalystCanvas.tsx:320` | Perbesar set berlabel + masukkan ke CI |

## BAGIAN F — 5 MENU DATA MASTER

### F1 — Data Wilayah (`WilayahManager.tsx`, 1.497 baris)
**Alur:** mount → cek Neon → cloud ada → pakai; cloud kosong + terhubung → **auto-push 17 default** (`:115`); simpan → `saveWilayahToNeon` replace-all → callback ke `App.tsx` tulis IndexedDB.
**Baik:** validasi kelengkapan 7 kolom (`:168–200`), filter provinsi, pencarian 12 kolom.
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| W1 | Aturan Branch Code→Wilayah gagal untuk kode alfanumerik (`JKT-THM-01` → `substring(1,3)='KT'`) | `normalizer.ts:526–565`; default wilayah memakai kode numerik `601601` (`defaultWilayah.ts:7`) | Toleransi kode alfanumerik ATAU peringatan “Kanwil tidak terbaca dari Branch Code” |
| W2 | Replace-all tanpa cek konflik | `api/wilayah.ts:82–97` | Cek `updated_at` sebelum POST; konfirmasi bila cloud lebih baru |
| W3 | Tidak ada indikator “tersimpan ke cloud / gagal” | `handleSaveToDatabase:219–243` | Notifikasi sukses/gagal eksplisit (pakai A1) |

### F2 — Data PTEN (`PTENManager.tsx`, 1.064 baris)
**Alur:** IndexedDB → default → Neon; impor Excel parsing longgar; simpan replace-all.
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| P1 | Impor = ganti seluruh TANPA dedup | `handleImportExcel:222–320` → `setPtenList(imported)` langsung | Dedup kunci `kodePosPten` (+`kotaPten`); laporan “X baru, Y duplikat dilewati”; jangan hapus baris lama di luar berkas kecuali mode replace disengaja |
| P2 | Replace-all JSONB tanpa konflik | `api/pten.ts:68–77` | Sama W2 |
| P3 | Reset ganda (kosongkan vs default) | `:419–436` | Konfirmasi menyebut jumlah baris yang hilang |

### F3 — Data Cabang (`CabangManager.tsx`, 1.197 baris) — **P0**
**Alur:** tidak menyimpan sendiri; memanggil `onMasterLoaded(rows, fileName, mode)` → `App.tsx:826` `handleMasterLoaded` **selalu merge+dedup, tidak membaca `mode`**.
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| **C1** | **Edit baris tidak tersimpan** — `updatedList` ada di `prev` → dianggap duplikat → dibuang; toast bohong | `CabangManager.tsx:320`; `App.tsx:826–880` | Tambah parameter `mode`/`action` di `handleMasterLoaded`; untuk edit → replace array eksplisit (bukan merge) |
| **C2** | **Hapus baris tidak tersimpan** — sama seperti C1 | `CabangManager.tsx:330` | Sama; hapus via replace eksplisit lalu `saveMasterToNeon` |
| C3 | Reset: cloud gagal hanya `console.warn` | `App.tsx:882–893` | Notifikasi gagal + jangan kosongkan lokal bila cloud gagal (atau sebaliknya, konsisten) |

### F4 — Data Mapping Role (`RoleMappingManager.tsx`, 2.132 baris)
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| R1 | Impor = ganti seluruh TANPA dedup | `handleImportExcel:495–560` | Dedup kunci `organisasiTujuan` |
| R2 | Replace-all JSONB tanpa konflik | `api/rolemapping.ts:73` | Sama W2 |
| R3 | Reset ganda | `:691–706` | Sama P3 |

### F5 — Data KodePos (`KodePosManager.tsx`, 1.770 baris) — paling matang
Server paging (`api/kodepos.ts:382–407`, default 25 cap 500), CRUD per-id (`PUT/DELETE ?id`), batch 500 (`:531`), geo enrichment + antrean localStorage (`KodePosManager.tsx:323`).
| ID | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| K1 | Seed ~140 baris vs master 83 ribu; offline hanya melihat seed tanpa peringatan | `App.tsx:194–204` | Badge/peringatan “memakai data seed, data penuh belum tersedia” |
| K2 | Antrean geo di `localStorage` bisa tabrakan antar-tab | `:323–334` | Kunci unik per tab/session atau pindah ke server |
| K3 | Validasi form pakai `alert()` | `:412,416` | Ganti notifikasi (A1) |

### F6 — Lintas menu
| ID | Temuan | Perbaikan |
|---|---|---|
| X1 | 3 menu JSONB replace-all (Wilayah/PTEN/Role) — konflik tulis tak terdeteksi | `updated_at` + konfirmasi bila cloud lebih baru |
| X2 | Tidak ada optimistic locking | Sama |
| X3 | `mode replace` = DELETE lalu INSERT tanpa transaksi (`api/master.ts:203–204`, `api/target.ts:217–218`) | Bungkus `BEGIN/COMMIT` |
| X4 | Status sinkron tak terlihat | Lihat A5 |
| X5 | Auto-push default ke cloud tanpa konfirmasi | `WilayahManager.tsx:115`, `PTENManager.tsx:86`, `RoleMappingManager.tsx:372` → konfirmasi operator |

## BAGIAN G — MENU DATA FINAL (analisa kebutuhan BRD vs implementasi)

**Alur berjalan:** baris masuk Final hanya lewat persetujuan di Data Analyst — “Setujui Final” memindahkan **semua** baris non-`TIDAK_ANALISA` (`App.tsx:741–757`), disimpan IndexedDB `analyst_final_data` (`:752`). “Kembalikan semua” (`:760–772`) dan “Revisi per baris” (`:776–796`) mengembalikan ke Data Analyst. UI: `FinalDataManager.tsx` — pencarian, filter wilayah, pagination (25/hal), Export Excel (`:53–83`), **tidak ada tombol unggah, detail, atau hapus**.

### G0 — Tabel gap: kebutuhan BRD vs implementasi

| # | Kebutuhan BRD | Status | Bukti |
|---|---|---|---|
| 1 | Unggah Excel dengan template standar | **BELUM ADA** | `FinalDataManager.tsx` tidak punya input file; hanya Export (`:53–83`) |
| 2 | Validasi & cegah duplikasi terhadap Data Analyst | **SEBAGIAN** | Dedup hanya saat approve final (`byId`, `App.tsx:746–749`); tidak ada cek saat unggah (karena unggah belum ada) |
| 3 | Analisis hanya data baru (belum pernah di Final) | **SUDAH** | `excludeFinalKeys` dikirim ke pipeline (`App.tsx:604`; `analystPipeline.ts:1874–1876`) |
| 4 | Matching kode pos + kelurahan + **kecamatan + kota** → lewati + beri info status | **SEBAGIAN** | Kunci sekarang `makeFinalKey(kodePosPten, kelurahan)` saja (`analystPipeline.ts:126`); kecamatan/kota tidak ikut; baris yang dilewati tidak diberi status per baris |
| 5a | Aksi Detail (View) | **BELUM ADA** | Hanya tombol Revisi (`FinalDataManager.tsx:209–219`) |
| 5b | Aksi Revisi (kembali ke Data Analyst mulai Fase 1) | **SUDAH** | `handleReviseFinalRow` reset `fase1/2/3Approved=false` + `isFinalApproved=false` (`App.tsx:783–789`) — tapi konfirmasi masih `window.confirm` (`FinalDataManager.tsx:213`) |
| 5c | Aksi Hapus permanen | **BELUM ADA** | Tidak ada handler hapus di Final |
| 5d | Card informasi ringkas | **SEBAGIAN** | Hanya jumlah baris (`FinalDataManager.tsx:92–95`); belum ada metrik (KC/KCP, role lengkap, per wilayah) |

### G1 — Fitur Upload Excel (kebutuhan #1) — BELUM ADA, cara bangun
1. Tambah prop `onUploadFinal: (rows: AnalystRow[], fileName: string) => void` di `FinalDataManager` + tombol “Unggah Excel” (ikon `FileSpreadsheet`, pola sama dengan menu lain).
2. Parsing: reuse `parseExcelFile` (`src/utils/excel.ts:196`) + template kolom sama dengan ekspor Final (`FinalDataManager.tsx:54–58`) supaya “format template standar” konsisten.
3. Alur wajib: parse → **normalisasi kunci** `makeFinalKeyV2` (lihat G2) → (a) baris yang kuncinya sudah ada di `finalRows` → **dilewati** (hitung + laporkan), (b) kuncinya ada di `analystRows` → **dilewati** (sudah dalam proses analisa), (c) baris benar-benar baru → masukkan ke `analystRows` (bukan langsung Final) agar menjalani Fase 1–3 sesuai filosofi aplikasi, kecuali Anda memutuskan unggahan Final boleh langsung masuk Final (butuh keputusan — Bagian 12).
4. Notifikasi hasil: “X baris diimpor, Y dilewati (sudah ada di Final), Z dilewati (sedang di Data Analyst)”.

### G2 — Perluas kunci matching (kebutuhan #4)
**Masalah:** `makeFinalKey(kodePosPten, kelurahan)` (`analystPipeline.ts:126–130`) tidak menyertakan **kecamatan & kota** sesuai BRD. Risiko: dua wilayah berbeda-kota dengan kode pos + nama kelurahan sama (mungkin akibat penggabungan Kota/Kabupaten di Fase 1, B1) dianggap “sudah final” → data hilang diam-diam.
**Eksekusi:** tambah `makeFinalKeyV2(kodePosPten, kelurahan, kecamatan, kota)` = `${kp}|${kel}|${kec}|${kota}`; gunakan di 3 titik: `App.tsx:604` (exclude), `App.tsx:611,613` (merge persetujuan), `analystPipeline.ts:1874–1876` (skip). **Jangan hapus fungsi lama** sampai migrasi data IndexedDB lama selesai (tulis migrasi satu kali: baca `analyst_final_data`, tambahkan field `finalKeyV2`, simpan kembali).
> **✅ SELESAI 2026-09-21 — dua penyimpangan dari rencana di atas, keduanya disengaja:**
> 1. Fungsi lama tidak dibiarkan dua (`makeFinalKey` + `makeFinalKeyV2`) — namanya tetap `makeFinalKey` tapi argumennya dilebarkan jadi 4 (kecamatan & kota opsional dengan default `''`), supaya tidak ada dua kunci yang bisa dipakai bertukaran dan menghasilkan hasil berbeda.
> 2. **Migrasi IndexedDB tidak diperlukan dan tidak ditulis**: kunci ini *dihitung ulang dari field baris* setiap kali dipakai (`excludeFinalKeys` dibuat di `App.tsx` dari `finalRows`, bukan dibaca dari penyimpanan). Baris `analyst_final_data` lama sudah punya `kodePosPten/kelurahan/kecamatan/kotaPten`, jadi langsung ikut aturan baru tanpa skrip apa pun.
> Terukur di browser: pasangan `85511|Babuin` kota TIMOR TENGAH SELATAN/Kualin vs BINTUNI/Batu Putih **tabrakan pada versi lama** (`tabrakanVersiLama: true`) dan **berbeda pada V2**; normalisasi huruf/ruang tetap (`' 10110 ' + 'gambir'` == `'10110' + 'GAMBIR'`).


### G3 — Informasi status baris yang dilewati (kebutuhan #4)
**Masalah:** baris yang dilewati karena sudah Final **hilang diam-diam** dari hasil analisa.
**Eksekusi:** tambah di `AnalystCoverage` field `skippedFinalRows: number` + `skippedFinalSamples: {kelurahan, kodePos, kota}[]` (maks 20); tampilkan di laporan cakupan Data Analyst: “X baris dilewati karena sudah ada di Final Data”; dan/atau beri badge “SUDAH FINAL” pada baris Data Analyst yang kuncinya cocok (opsional).

### G4 — Aksi Detail (View)
**Eksekusi:** tombol “Detail” per baris (ikon `Eye`) → modal (`BaseModal`, lihat A3) menampilkan seluruh field `AnalystRow` dua kolom (Fase 1 / Fase 2 / Fase 3 / status), read-only, + tombol “Revisi” dan “Hapus” di footer modal (opsional). Reuse gaya `CandidateDetailModal`.

### G5 — Aksi Hapus permanen
**Eksekusi:**
1. Prop baru `onDeleteRow: (rowId: string) => void` di `FinalDataManager`; handler di `App.tsx`: filter `finalRows`, simpan IndexedDB (`analyst_final_data`), **sinkronkan Neon bila G9 sudah ada**.
2. Wajib pakai `ConfirmDialog` dengan pesan “Baris #{no} ({kelurahan}, {kota}) akan DIHAPUS PERMANEN dan bisa dianalisa ulang dari awal.” (karena `excludeFinalKeys` dihitung dari `finalRows` saat run — setelah dihapus, baris otomatis bisa diproses lagi; ini perilaku yang benar, dokumentasikan).
3. Jangan pakai `window.confirm` (lihat A2).

### G6 — Revisi: ganti `window.confirm` → `ConfirmDialog`
**Lokasi:** `FinalDataManager.tsx:213` (per baris) dan `:104` (kembalikan semua). Pesan menyebut dampak; aksi di `onConfirm`.

### G7 — Inkonsistensi “Kembalikan semua” vs “Revisi per baris”
**Masalah:** `handleReturnFinalToAnalyst` (`App.tsx:760–772`) hanya reset `isFinalApproved`, **tidak** reset `fase1/2/3Approved` → baris muncul di fase terakhir, bukan Fase 1; sedangkan Revisi per baris reset semuanya (`:783–789`).
**Eksekusi:** ✅ SELESAI 2026-09-21, opsi (a) — `handleReturnFinalToAnalyst` di `App.tsx` me-reset `fase1Approved/fase2Approved/fase3Approved/isFinalApproved` untuk baris yang datang dari Final, persis seperti Revisi per baris. Baris yang sejak awal berada di antrean Data Analyst TIDAK ikut kehilangan persetujuannya (kalau iya, menekan “Kembalikan semua” akan merusak progres fase yang sedang direview).

### G8 — “Setujui Final” memindahkan semua status
**Masalah:** `handleApproveAllAnalystFinal` (`App.tsx:741–744`) memindahkan semua non-`TIDAK_ANALISA`, termasuk `PERLU_REVIEW`/`ANOMALI`, tanpa inspeksi.
**Eksekusi:** ✅ SELESAI 2026-09-21, opsi (a) — baris PERLU_REVIEW/ANOMALI tetap ikut dipindahkan, dan `ConfirmDialog` “Pindahkan ke Final Analisa?” sekarang menyebut jumlah keduanya (“Termasuk N baris perlu direview dan M baris anomali…”). `stats` di `AnalystResultsGrid.tsx` memisahkan penghitung `perluReview` dan `anomali` (sebelumnya hanya digabung di `anomalies`).

### G9 — Data Final tidak sinkron ke Neon (P0)
**Masalah:** `analyst_final_data` hanya IndexedDB (`App.tsx:752, 770, 781`; boot restore `:215`). Tidak ada endpoint Neon; ganti perangkat/bersih browser = **Final Data hilang**.
**Eksekusi:** buat `api/final.ts` (pola `api/pten.ts`: app_store JSONB key `final_data`, GET/POST/DELETE) + `loadFinalFromNeon/saveFinalToNeon` di `neonSync.ts` + sinkron di boot `App.tsx:235–241` (pola merge seperti `neonWilayah` `:283–289`) dan setelah tiap perubahan Final (`:752, 770, 781`). Batasi ukuran: kirim per-chunk bila >2.000 baris (pola `saveKodePosToNeon` `neonSync.ts:372–407`).
> ### 🚫 JANGAN ikuti kalimat "buat `api/final.ts`" di atas — instruksinya salah untuk repo ini.
> **Bukti terukur 2026-09-20 (A/B bersih):** menambah satu file fungsi serverless baru di `api/`
> membuat deployment Vercel **mati diam di `Deploying outputs...` tanpa satu baris error pun**
> (`370b266…ca903e3` + `f9501b6` = gagal saat isi change-nya cuma `api/tsconfig.json` + anotasi tipe);
> satu-satunya perubahan yang memulihkan hijau adalah **menghapus file fungsi baru** dan memindahkan
> view-nya ke fungsi yang sudah ada (`bad0c2e` → sukses 30 detik). Beda merah/hijau hanya **jumlah
> file fungsi di `api/`** (13 vs 12).
>
> **Cara benar:** perluas fungsi yang sudah ada lewat `?view=final` (GET/POST/DELETE pada kunci
> `final_data` di `app_store`) — jangan file baru. `api/wilayah.ts`, `api/pten.ts`,
> `api/rolemapping.ts`, `api/master.ts`, `api/target.ts` sudah memakai pola `app_store` JSONB itu.
>
> **Ukuran:** Final Data bisa puluhan ribu baris × ~30 field. Satu baris `app_store` JSONB utuh
> akan menabrak batas body Vercel (~4,5 MB) dan lambat di-read-modify-write per chunk.
> Pilih salah satu sebelum koding: (a) tabel per-baris `final_rows` + upsert chunk 500–1.000 baris
> (pola `api/kodepos.ts`), atau (b) JSONB per-blob + chunk — (a) yang disarankan.
>
> **Jangan tulis ke Neon dari agen:** operator menjalankan sendiri alur produksinya
> ([[feedback-user-reruns-flows-himself]]). Verifikasi cukup GET `?view=final` setelah deploy.

**✅ EKSEKUSI 2026-09-21 (pilihan (a): tabel per-baris `final_rows`):**

| Bagian | Isi |
|---|---|
| Skema | `final_rows(row_key TEXT PRIMARY KEY, raw_data JSONB NOT NULL, updated_at)` ditambahkan ke `ensureSchema` **`api/target.ts` yang sudah ada** (bukan file baru) |
| Endpoint | `GET/POST/DELETE /api/target?view=final` — GET dipaging (default & maks 500 baris, `ORDER BY row_key` agar halaman tidak tumpang tindih); POST upsert chunk 200 baris via `json_to_recordset` + `ON CONFLICT (row_key) DO UPDATE` (pola yang sama sudah produksi di `api/kodepos-id.ts`/`-baseline.ts`); DELETE `?key=` 1 baris / `?all=1` kosongkan |
| Aman dari salah ketik | POST/DELETE dengan `view` tak dikenal → **400**, tidak jatuh ke jalur `target_records` (yang akan `DELETE FROM target_records`). Tanpa `key` **dan** tanpa `all=1`, DELETE final ditolak — satu DELETE lupa param tidak bisa menghapus semua hasil |
| Tidak ada jendela kosong | mode default `upsert` (tidak pernah `DELETE`); `replace` hanya untuk penanaman awal saat cloud masih kosong |
| Klien | `neonSync.ts`: `loadFinalFromNeon` (paging otomatis, `null` = endpoint tak tersedia vs `{rows:[]}` = cloud kosong), `saveFinalToNeon` (chunk 300 baris ≈ 350 KB), `deleteFinalRowInNeon`, `clearFinalInNeon` |
| Boot merge | `App.tsx` STEP 2b (di luar `Promise.allSettled` agar tidak memperlambat sync lain): **non-destruktif** — baris cloud hanya MENAMBAH yang belum ada lokal, tidak pernah menimpa. Dedup via `pilFinalDariCloud()` (kunci alami `makeFinalKey`, bukan `id` — lihat G12). Cloud kosong + lokal ada → tanamkan sekali + toast |
| Push setelah mutasi | 4 titik: Setujui-all→upsert seluruh daftar; Kembalikan-ke-Analyst→`clearFinalInNeon`; Revisi & Hapus per baris→`deleteFinalRowInNeon(rowId)`. Gagal → toast warning "hasil tetap aman di browser ini"; di dev/offline tidak menuntut koneksi yang tidak ada (`isNeonConnected`) |
| Visibilitas | `api/status.ts` menambah `tables.finalRecords`; modal Database menampilkan kartu `final_rows` + jumlahnya, jadi "sudah ada salinan cloud" bisa dilihat tanpa membuka SQL |

**Cara operator memverifikasi (setelah deploy, tanpa perlu menulis):**
1. Buka `https://match-sepia.vercel.app/api/target?view=final&limit=5` → harus `{"ok":true,"table":"final_rows","total":N,...}` (tabel dibuat otomatis pada permintaan pertama).
2. Buka `.../api/status` → `tables.finalRecords` > 0 setelah menekan **Saya Setuju** di Data Analyst.
3. Reset browser/PC lain → buka aplikasi → toast "N baris Data Final dipulihkan dari cloud".
4. known limit (disengaja): cloud bisa menyimpan baris hasil run lama yang `id`-nya berbeda; baris itu **tidak pernah tampil** karena difilter `pilFinalDariCloud` berdasar kunci alami, tapi membuat `finalRecords` bisa lebih besar dari jumlah baris lokal. Belum ada GC-nya (butuh hapus-banyak-kunci; sampai hari ini manfaatnya tidak sebanding risikonya).
5. `analyst_purge_v2` (`App.tsx` boot) hanya menghapus salinan lokal; kalau nanti ada purge struktural baru, purge-nya juga harus menyapu `final_rows` — kalau tidak, baris format lama kembali dari cloud.


### G10 — Card informasi ringkas (kebutuhan 5d)
**Eksekusi:** di header `FinalDataManager.tsx:87–97` tambah 4 metrik mini: total baris, KC vs KCP, role lengkap (n/3), jumlah wilayah tercakup. Data sudah ada di `rows`.

### G11 — Dedup unggahan (pendukung kebutuhan #2)
**Eksekusi:** kandidat unggahan dicek ke: (1) `finalRows` via `makeFinalKeyV2`, (2) `analystRows` via kunci sama, (3) di dalam berkas sendiri (dedup internal). Hasil: 3 bucket — baru / duplikat-Final / duplikat-Analyst — laporkan semuanya.

### G12 — Jangan pakai `id` untuk dedup
`AnalystRow.id` memuat `Date.now()` (`analystPipeline.ts:1879`) → berubah tiap run. Selalu dedup dengan `makeFinalKeyV2`, bukan `id`.

## 10. URUTAN EKSEKUSI (saran)

| Langkah | Isi | Sentuh logika analisa? | Estimasi |
|---|---|---|---|
| 1 | UI dasar: notifikasi global (A1), konfirmasi seragam (A2), BaseModal (A3) | Tidak | Sedang |
| 2 | Bug kritis menu: F3-C1/C2 (edit/hapus Cabang), G6 (confirm Final) | Tidak (perbaikan perilaku yang sudah seharusnya) | Kecil |
| 3 | Kontrol proses: tombol Batalkan (A4), Topbar status (A5) | Tidak | Kecil |
| 4 | Data Final: G9 (sinkron Neon) → G2 (kunci V2 + migrasi) → G5 (Hapus) → G4 (Detail) → G1 (Upload) → G3 (status lewati) → G10 | Ya (pipeline exclude) | Besar |
| 5 | Fase 2 sesuai keputusan: C2a–C2e + C3 (gerbang baru) + uji C4 | Ya | Besar |
| 6 | Kebersihan: A6, A7, A8, A9, A10, item F1–F6 P1/P2 | Sebagian | Sedang |
| 7 | Keputusan Bagian 12 (B4, D1, D3, D6, G8, B1/B2) | Ya | Setelah keputusan |

## 11. CHECKLIST VERIFIKASI (jalankan setelah tiap langkah)

1. `npm run build` → sukses tanpa error TypeScript.
2. `npm run lint` (oxlint) → tidak ada pelanggaran baru.
3. Manual UI:
   - Notifikasi muncul seragam (sukses/info/warning/error), tidak ada `alert()` tersisa di alur normal.
   - Aksi destruktif → `ConfirmDialog` dengan jumlah baris; Batal benar-benar membatalkan.
   - Setiap modal: Esc menutup, fokus masuk modal & kembali ke pemicu; dialog persetujuan tidak tertutup klik-luar.
   - Analisa jalan → tombol Batal berfungsi; setelah batal tidak ada hasil setengah jadi tersimpan.
   - Pindah menu lalu kembali: filter/halaman/pilihan kandidat tetap.
   - Topbar menampilkan status koneksi & waktu sinkron.
4. Data Master:
   - Cabang: edit 1 baris → simpan → refresh → berubah; hapus 1 baris → refresh → hilang; toast sesuai kenyataan.
   - PTEN/Role: impor berkas sama 2× → tidak ada duplikat; laporan jumlah dilewati.
   - Wilayah/PTEN/Role: simpan saat cloud lebih baru → muncul konfirmasi konflik.
5. Data Final:
   - Approve Final → baris muncul di Final & hilang dari Analyst; IndexedDB `analyst_final_data` terisi; Neon `final_data` terisi (setelah G9).
   - Analisa ulang → baris Final TIDAK diproses ulang; laporan cakupan menyebut jumlah yang dilewati.
   - Revisi 1 baris → kembali ke Data Analyst dengan semua fase reset; analisa berikutnya memprosesnya dari Fase 1.
   - Hapus 1 baris → hilang permanen; analisa berikutnya memproses lagi.
   - Unggah Excel (setelah G1) → duplikat dilewati, baru masuk proses; laporan 3 bucket.
6. Fase 2 (setelah C2): uji Bandung — Braga vs Lebak Siliwangi menghasilkan Pilihan 1 berbeda; KC menang bila jarak seri ≤2 km.

## 12. KEPUTUSAN YANG MASIH MENUNGGU (jangan eksekusi sebelum disepakati)

> ### 📌 Status keputusan — 2026-09-21
> Pemilik menyerahkan keputusan ke agen ("ikutkan saran anda, saya minta semua sudah di-fixing"),
> jadi opsi di bawah **diambil sesuai default yang dokumen ini sendiri sarankan** dan sudah
> dieksekusi. Semua masih mudah dibatalkan: ubah barisnya, tulis ulang opsi, jalankan ulang.
> Kolom "Dipakai" = opsi yang diimplementasikan.

| ID | Keputusan | Opsi | Dipakai (2026-09-21) |
|---|---|---|---|
| B1 | Penggabungan Kota/Kabupaten kembar nama di Fase 1 | (a) pisahkan jenis daerah, (b) biarkan + peringatan | **(b)** — biarkan digabung, tambah peringatan jumlah kota terpengaruh di laporan cakupan |
| B2 | Kode pos kelurahan masuk ekspor? | (a) ya + pisahkan kolom, (b) tetap kode pos kota | **(a)** — kolom terpisah, tidak menimpa `KODE POS PTEN` |
| B4 | Hapus default palsu (`'10110'`, `'KOTA JAKARTA PUSAT'`, `'Wilayah 01'`, tebakan W-code, identitas sintetis) | (a) kosong + status manual, (b) biarkan | **(a)** — jangan isi karangan |
| D1 | Engine resmi Fase 3 | (a) engine layar (nama+jarak+KC+pulau) — disarankan, (b) engine nama | **(a)** |
| D3/D6 | Aturan auto-final & pilihan manual | (a) auto-final hanya VERIFIED+non-fallback, (b) manual = HIGH_CONFIDENCE | **(a) + (b)** keduanya |
| G8 | “Setujui Final” menyertakan PERLU_REVIEW/ANOMALI? | (a) ya + peringatan, (b) filter status | **(a)** — tetap disertakan tapi jumlahnya disebut di konfirmasi |
| G7 | “Kembalikan semua” reset ke Fase 1? | (a) ya (disarankan), (b) tetap fase terakhir | **(a)** — disamakan dengan Revisi per baris |
| G1c | Unggahan Final boleh langsung masuk Final tanpa analisa? | (a) tidak — lewat Data Analyst (disarankan), (b) ya | **(a)** |


---
---

# LAMPIRAN (ditambahkan di akhir agar tidak bentrok dengan pekerjaan yang sedang berjalan)

**Catatan status:** item di Bagian H/I/J berstatus `BELUM` secara default dan sengaja **tidak dicantumkan di tabel Bagian 0** agar tidak bentrok dengan kerja yang sedang berjalan. Setelah AI menyelesaikan item di sini, tandai langsung di baris itemnya (`Status: SELESAI | tanggal | catatan`), dan saat dokumen disatukan nanti, pindahkan ke tabel Bagian 0.

## BAGIAN H — DASHBOARD & PETA (analitik)

**Konteks:** Dashboard merender 5 komponen (`App.tsx:1037–1156`): toolbar filter wilayah, `MetricCards`, `IndonesiaBranchMap`, `RegionalAnalyticsCharts` (memuat `MatchCompositionDonut`), `MasterDuplicateChart`, `DashboardMatchTable`.

| ID | Status | Temuan / Perbaikan |
|---|---|---|
| H1 | BELUM | Tabel widget vs sumber data: `dashboardStats` (`App.tsx:389–437`) & `regionalStats` (`:440–471`) & `DashboardMatchTable` membaca **`targetRows`** (alur Target lama); `finalMetrics` (`:475–513`) & peta (lapisan FINAL + anomali) membaca **`finalRows`** (pipeline). Akibat: kartu KPI proses menampilkan 0 walau pipeline sudah berjalan |
| H2 | BELUM | Komponen Dashboard mati (0 pemakaian): `Dashboard/AnalystInsightsBanner.tsx`, `Dashboard/AuditLogTable.tsx`, `Dashboard/WilayahChart.tsx` — masukkan ke A10 (hapus) atau pasang dengan data nyata |
| H3 | SKIP (keputusan) | **Keputusan produk:** Dashboard pakai data pipeline (`analystRows`/`finalRows`/`coverage`) — disarankan — atau tetap alur Target lama. Jangan kerjakan H1/H5 sebelum ini diputuskan |
| H4 | BELUM | Radar anomali & jumlah anomali: definisi sudah disatukan lewat `detectFinalAnomalies(finalRows, masterRows)` (dipakai `finalMetrics` + panel peta) — jadikan widget Dashboard |
| H5 | BELUM | Setelah H3 diputuskan: KPI pipeline-native (per status analisa, progres persetujuan per fase dari `phaseApproval` `App.tsx:651–669`, cakupan `coverage`), distribusi wilayah dari `finalRows`, pasang/hapus `AuditLogTable` + `AnalystInsightsBanner`, sinkronkan README (janji widget vs kenyataan) |

## BAGIAN I — REVIEW PETA (`IndonesiaBranchMap.tsx`, 2.960 baris)

**Yang sudah baik (jangan diubah):** dedicated panes (`arcsPane`/`markersPane`/`selectedPane`), canvas renderer pin + SVG arc, pause redraw saat zoom/pan, click fallback hit-testing ≤28 px, geocoding cache IndexedDB + batch 120 + `kodepos_geo` sebagai sumber titik, filter scope (ALL/SELECTED_ONLY/FINAL_ONLY/MULTI_ONLY), tracking Aceh-KIM (curved arcs), search debounce, tile switch (Google/Hybrid/Esri/OSM), cleanup listener saat unmount.

| ID | Status | Temuan / Perbaikan |
|---|---|---|
| MAP-1 | BELUM (P0) | **`NotificationProvider` tidak dipasang di root** — `main.tsx` hanya `<ErrorBoundary><App/></ErrorBoundary>`; semua `notify()` (App, IndonesiaBranchMap, PTEN/Cabang/RoleMapping/Wilayah/KodePos Manager, AnalystResultsGrid) hanya `console.warn` → toast tidak pernah muncul. Perbaikan: bungkus `<App/>` dengan `<NotificationProvider>` di `main.tsx` |
| MAP-2 | BELUM (P0) | 2 `alert()` tersisa di peta: `IndonesiaBranchMap.tsx:1307` (KIM tidak ditemukan) & `:1712` (klik titik dulu) → ganti `notify(..., 'warning'/'error')` setelah MAP-1 |
| MAP-3 | BELUM (P1) | `selectedPin` tidak reset saat `masterRows`/`targetRows` berubah → pin bisa menunjuk data usang. Tambah `useEffect` reset |
| MAP-4 | BELUM (P1) | Google API key (geocoding) disimpan di localStorage tapi tak terlihat statusnya → badge kecil di Topbar (baca `getStoredGoogleApiKey()`) |
| MAP-5 | BELUM (P1) | Tiap batch geocoding memicu re-render pin (`resolvedCoords`→`allPins`→`filteredPins`) → pin “berkedip”. Perbaikan: gambar ulang hanya saat batch selesai / user idle (lihat efek `~337–417` & `~885–1086`) |
| MAP-6 | BELUM (P1) | Panel anomali (`showAnomalyPanel`, `:1837`, `:1956`) tanpa tombol close/Esc → tambahkan keduanya |
| MAP-7 | BELUM (P2) | Default tile Google tanpa API key (`getMapTileLayer('google')`, `:156–178`) rawan rate-limit/CORS → OSM sebagai default, Google hanya bila key ada |
| MAP-8 | BELUM (P2) | Aksesibilitas peta: tambah `aria-label` pada map container + daftar pin yang bisa diakses keyboard |
| MAP-9 | BELUM (P2) | Drawer pin terpilih (`:2187+`) tanpa tombol close → tambahkan |
| MAP-10 | BELUM (P2) | Modal matched rows (`showMatchedModal`, `:2605+`) bisa klik-luar tapi tidak Esc → tambah Esc |

## BAGIAN J — ANIMASI & DELIGHT (peta & KPI)

**Sudah ada (tetapkan):** pin jatuh saat dipilih (`bniPinDrop`), garis alur bergerak (`flowDash`), arc perkiraan tanpa animasi (`--approx`, disengaja), halo denyut titik asal (`flowPulse`), hover pin/cluster membesar, Leaflet native (`flyTo`/`fitBounds`/`fadeAnimation`/`inertia`), dan **prefers-reduced-motion** (2 lapisan: khusus pin `styles/index.css:1511–1517` + global `:1848–1854`).

| ID | Status | Tambahan (semua pakai keyframes yang sudah ada — jangan tambah library) |
|---|---|---|
| ANI-1 | BELUM | Pin masuk pertama mendadak → fade-in halus saat layer pin pertama digambar (mis. `qdrFade` pada pane markers) |
| ANI-2 | BELUM | Marker anomali muncul mendadak (`IndonesiaBranchMap.tsx:1070–1083`) → pakai `bniPinDrop` yang sama |
| ANI-3 | BELUM | Kartu peta muncul tanpa animasi → `qdrFade`/`qdrRise` saat container dimount |
| ANI-4 | BELUM | Progress geocoding hanya bar → tambahkan spinner `qdrSpin` + teks “Mencari titik X dari Y” |
| ANI-5 | SELESAI | Angka KPI berubah mendadak → count-up ~0,4 dtk (ease-out, hormati `prefers-reduced-motion`). File baru `src/components/Dashboard/AnimatedMetricValue.tsx` + 5 kartu di `src/components/Dashboard/MetricCards.tsx` memakainya. Tidak mengubah rumus/perhitungan. ⚠️ build belum diverifikasi |

## BAGIAN K — KARTU “TITIK KOORDINAT” (Data Kode Pos) terlihat aneh/macet

**Gejala yang dilaporkan:** kartu menampilkan angka besar `83.361`, lalu teks `401 baris belum ada titik`, dan tautan `coba ulang 401` — diklik tidak mengubah apa pun (terasa seperti bug/macet).

**Hasil analisa: BUKAN salah hitung — ini bug satuan/labeling & umpan balik.**

| Angka di layar | Sumber kode | Satuan sebenarnya |
|---|---|---|
| `83.361` (angka besar) | `KodePosManager.tsx:835` → `stats.totalBerTitik` | **baris kelurahan** yang punya titik (koordinat sendiri **atau** fallback titik kode pos) |
| `401 baris belum ada titik` | `:290` `geoBelumTitik = stats.total - stats.totalBerTitik`, ditampilkan `:848` | **baris kelurahan** tanpa titik |
| `coba ulang 401` (tautan) | `:852` → `jalankanGeo(geoUlang=true)` | aksi berjalan atas **kode pos unik** (`kodepos_geo.kode_pos` = PRIMARY KEY), **bukan** 401 baris |

Verifikasi konsistensi: `83.361 + 401 = 83.762` = total baris master → perhitungan benar, tidak ada data hilang.

**Akar kebingungan:**
1. Judul kartu “TITIK KOORDINAT” tanpa satuan → 83.361 dibaca sebagai “jumlah titik”, padahal “jumlah baris yang punya titik”.
2. Tautan retry menulis `401` (baris) padahal retry memproses **kode pos unik**; bila 401 baris itu hanya menempati mis. 37 kode pos, yang dikerjakan hanya 37.
3. Query retry: `api/kodepos-geo.ts:227–235` mode `ulang` → `WHERE g.kode_pos IS NULL OR g.latitude IS NULL` (per kode pos). Baris `kodepos_data` hanya terisi bila kode pos baris itu punya titik di `kodepos_geo` (fallback `COALESCE(...)`, `api/kodepos.ts:141–146`). Bila penyedia (Google/ESRI/OSM) tidak punya data → hasil 0 → angka 401 tidak berubah.
4. Tidak ada umpan balik “0 berhasil / N kode pos tidak bersumber”. Klien memang berhenti sendiri setelah satu putaran tanpa hasil (`KodePosManager.tsx:340` — `tanpaHasil`), tetapi user tidak melihat pesan apa pun → terasa macet.

| ID | Status | Perbaikan |
|---|---|---|
| K1 | SELESAI | Satuan diperjelas: pesan kartu kini membedakan “belum ada titik” (masih ada antrean) vs “sudah dicoba, penyedia tidak menyediakan” (`KodePosManager.tsx:863–867`) — build terverifikasi 2026-09-21 |
| K2 | SELESAI | Label tombol retry memakai satuan kode pos: `coba ulang {geoStats.geo.gagal} kode pos` (`:295`, `:880`). **Koreksi 2026-09-21:** `geoStats.gagal` tidak ada di tipe `KodePosGeoStats` (build mati TS2339); lapangan: `/api/kodepos-geo?view=stats` mengembalikan `geo.gagal=2.813`, dan tidak ada `gagal` di level atas — jadi path yang benar `geoStats?.geo?.gagal` |
| K3 | SELESAI | Umpan balik hasil retry: pesan eksplisit saat server tidak memproses apa pun (`:393–397`) + pesan selesai/berhenti (`:410–419`) |
| K4 | BELUM | Tandai kode pos “tidak bersumber” (kolom `sumber`/`presisi` di `kodepos_geo`) agar tidak terus ditawarkan sebagai “coba ulang” — menghentikan ilusi tombol macet |
| K5 | BELUM | Naikkan info “terverifikasi Google: X” dari tooltip (`:824–826`) ke baris kartu (sekarang tersembunyi di tooltip) |

## BAGIAN L — CATATAN HASIL FIXING (log perubahan per sesi)

> Bagian ini adalah **log**, bukan daftar tugas. Ditulis agar qoder/tim lain tahu persis apa yang sudah diubah, mengapa, dan apa yang belum diverifikasi. Jangan mengubah kode yang sudah tercatat di sini tanpa membaca catatannya.

### Sesi 3 — 2026-09-21 · ANI-5 (animasi angka KPI) — dari Cline

| # | File | Perubahan | Item | Verifikasi build |
|---|---|---|---|---|
| 8 | `src/components/Dashboard/AnimatedMetricValue.tsx` (**file baru**) | Komponen `AnimatedMetricValue`: count-up/down ~400 ms (ease-out kubik, rAF), hormati `prefers-reduced-motion` (langsung ke nilai akhir). Presentasi saja — **tidak mengubah data/rumus** | ANI-5 | ⚠️ BELUM |
| 9 | `src/components/Dashboard/MetricCards.tsx` | 5 angka KPI memakai `AnimatedMetricValue` (`stats.totalProcessed`, `fm.distinctKodePos`, `fm.belumDikerjakan`, `fm.anomali`, `fm.top.count`). Teks kecil footer tetap `fmt(...)` | ANI-5 | ⚠️ BELUM |

**Batas kerja Sesi 2 (sesuai kesepakatan anti-bentrok):** hanya kedua file di atas. File yang TIDAK disentuh: `IndonesiaBranchMap.tsx`, `styles/index.css`, `App.tsx`, `perbaikan-seluruh-aplikasi.md` (kecuali log ini). Pekerjaan animasi peta (ANI-1…ANI-4) tetap milik qoder.

### Catatan koordinasi (Sesi 2)
- ANI-3: **sudah ada dasar** (`.bni-map-container` memakai `qdrFade`) — tidak perlu diulang.
- ANI-4: pilar geocoding di `IndonesiaBranchMap.tsx:2935` memakai `animation: 'spin 1s linear infinite'` — tetapi stylesheet hanya mendefinisikan `@keyframes qdrSpin` (`styles/index.css:965`). **Spinner geocoding kemungkinan diam** → qoder: ganti ke class `spinner-border spinner-border-sm` (sudah ada) atau definisikan `@keyframes spin`.

### Sesi 1 — 2026-09-21 · Tier-1 (UI & Data Master) + perbaikan kartu Titik Koordinat

| # | File | Perubahan | Item | Verifikasi build |
|---|---|---|---|---|
| 1 | `src/App.tsx` | `handleMasterLoaded` menerima parameter `mode` (`'replace' | 'append' | 'update'`); mode `'update'` = terapkan daftar lengkap apa adanya (tanpa merge/dedup) lalu simpan ke IndexedDB + Neon. Diperlukan karena edit/hapus Data Cabang sebelumnya hilang diam-diam. Ref: `App.tsx:929` | F3-C1, F3-C2 | ✅ build 2026-09-21 |
| 2 | `src/App.tsx` | Handler baru `handleDeleteFinalRow(rowId)` + kirim prop `onDeleteRow` ke `FinalDataManager`. Ref: `App.tsx:893`, `:1319` | G5 | ✅ build 2026-09-21 |
| 3 | `src/components/MasterData/CabangManager.tsx` | Tipe prop `onMasterLoaded` ditambah `'update'`; pemanggilan untuk create/edit (`:324`) dan hapus (`:334`) memakai `'update'`; impor Excel tetap `'replace'` (merge+dedup, perilaku lama dipertahankan). Ref: `:35`, `:322–334` | F3-C1, F3-C2 | ✅ build 2026-09-21 |
| 4 | `src/components/WorkingEngine/FinalDataManager.tsx` | (a) Card metrik ringkas: total/KC/KCP/3-role-lengkap/wilayah; (b) aksi **Detail** (modal `role="dialog"` + Esc); (c) aksi **Hapus permanen**; (d) `ConfirmDialog` untuk “Kembalikan semua”, “Revisi”, dan “Hapus”; (e) prop baru `onDeleteRow` | G4, G5, G6, G10 | ✅ build 2026-09-21 |
| 5 | `src/components/WorkingEngine/AnalystResultsGrid.tsx` | Konfirmasi “Revisi ke Perlu Analisa Manual” memakai `ConfirmDialog` (state `confirmManualRow`, `:159`; tombol `:1864`; dialog `:2081–2096`). **Sekaligus memperbaiki baris `onClick` yang rusak** akibat patch fuzz sebelumnya | A2 (sebagian) | ✅ build 2026-09-21 |
| 6 | `src/components/Topbar.tsx` | Badge status koneksi Neon (“Terhubung · disinkron HH:MM” / “Offline”), tombol **Database** (buka `NeonDatabaseModal`), tombol **Simpan** (memanggil `flushPendingWrites()` + umpan balik “Tersimpan ✓”) | A5 | ✅ build 2026-09-21 |
| 7 | `src/components/KodePosData/KodePosManager.tsx` | **Perbaikan utama kartu “TITIK KOORDINAT”**: (a) `await refreshStats()` di blok `finally` `jalankanGeo()` (`:423`) — inilah penyebab angka “belum ada titik” tidak pernah berubah setelah “coba ulang”; (b) refresh KPI tiap 5 batch (`:345`, `:386–387`); (c) pesan eksplisit saat server tidak memproses apa pun (`:396`); (d) satuan diperjelas: `N baris tanpa titik — sudah dicoba, penyedia peta tidak menyediakannya` (`:870`); (e) label tombol memakai satuan kode pos (`:884`) | K1, K2, K3 | ✅ build 2026-09-21 |

**Ringkasan akar masalah kartu “TITIK KOORDINAT” (untuk referensi):** `jalankanGeo()` hanya me-refresh `geoStats`, padahal angka kartu dihitung dari `stats` (`geoBelumTitik = stats.total − stats.totalBerTitik`). Akibatnya titik yang sudah tersimpan tidak pernah tercermin di kartu → tombol “coba ulang” terlihat tidak bekerja.

### Yang BELUM dikerjakan (lanjutan untuk qoder)

| Item | Isi | Catatan |
|---|---|---|
| ~~A2 (sisa)~~ | `SnapshotModal.tsx` `window.confirm` → `ConfirmDialog` | **SELESAI 2026-09-21** (lihat tabel Bagian 0) |
| ~~A1 (sisa)~~ | `alert()` pada alur impor Excel & validasi form | **SELESAI 2026-09-21** — `grep -n "alert(" src/` = 0 |
| ~~MAP-1~~ | `NotificationProvider` dipasang di `main.tsx` | **SELESAI 2026-09-21** — toast benar-benar tampil (diuji di dev) |
| K4, K5 | Tandai kode pos “tidak bersumber”; naikkan info “terverifikasi Google” ke baris kartu | kecil |
| H, I, J | Bagian Dashboard/Peta/Animasi (lihat di atas) | H3 = keputusan produk |

### Aturan verifikasi (WAJIB)

Sesi fixing pertama dilakukan tanpa `node`/`npm`/`git` di mesinnya, sehingga tabel di atas dulu berlabel "⚠️ BELUM diverifikasi compiler". **Sudah diverifikasi 2026-09-21** (`npx tsc -b --force` 0 error) — kecuali satu error tipe yang ditemukan & diperbaiki saat itu juga: `geoStats.gagal` → `geoStats.geo.gagal` (lihat catatan K2).

```bash
npx tsc -b --force   # TypeScript PENUH — `npm run build` biasa bersifat inkremental dan bisa melewatkan error di file yang tidak diubah
npm run lint         # oxlint
```

Lalu uji manual minimal: (1) edit & hapus 1 baris di menu Data Cabang → refresh → pastikan berubah; (2) Data Final → tombol Detail/Revisi/Hapus; (3) Topbar → tombol Simpan; (4) Data Kode Pos → klik “coba ulang N kode pos” → angka “belum ada titik” harus turun.

### Sesi 2 — 2026-09-21 · G2 + A4 (commit `eec7bd1`), lalu G9

| # | File | Perubahan | Item | Verifikasi build |
|---|---|---|---|---|
| 1 | `src/utils/analystPipeline.ts` | `makeFinalKey` dilebarkan jadi 4 komponen + `AnalisaDibatalkan` + `tick()` pembatal di `executeAnalystPipeline`; subsequently `pilFinalDariCloud()` untuk merge cloud | G2, A4, G9 | ✅ 2026-09-21 |
| 2 | `src/App.tsx` + `AnalystCanvas.tsx` | Tombol **Batalkan** saat analisa; state dikembalikan, tidak ada hasil setengah jadi tersimpan | A4 | ✅ 2026-09-21 |
| 3 | `api/target.ts` | `?view=final` (tabel `final_rows`) + penolakan `view` tak dikenal pada POST/DELETE. **Tidak ada file `api/` baru** (lihat kotak 🚫 G9 — menambah file fungsi baru membuat deploy mati diam) | G9 | ✅ `tsc -p api/tsconfig.json` 0 error; handler dijalankan terhadap `sql` palsu (hasil lengkap di Bagian G9). **SQL asli belum dieksekusi ke Neon** — itu aksi operator setelah deploy (`GET ?view=final`) |
| 4 | `src/utils/neonSync.ts` | `loadFinalFromNeon` / `saveFinalToNeon` / `deleteFinalRowInNeon` / `clearFinalInNeon`; `NeonStatus.tables.finalRecords` | G9 | ✅ 2026-09-21 |
| 5 | `src/App.tsx` | STEP 2b boot merge non-destruktif + push di 4 titik mutasi Final + toast gagal | G9 | ✅ 2026-09-21 |
| 6 | `api/status.ts`, `src/components/NeonDatabaseModal.tsx` | Jumlah baris `final_rows` terlihat di modal Database | G9 | ✅ 2026-09-21 |
| 7 | `src/components/KodePosData/KodePosManager.tsx` | Perbaikan tipe `geoStats?.gagal` → `geoStats?.geo?.gagal` (sisa patch sesi 1 yang belum di-commit; membuat `tsc -b --force` gagal TS2339) | K2 | ✅ 2026-09-21 |
| 8 | `src/App.tsx` | `handleReturnFinalToAnalyst` reset semua fase (disamakan dengan Revisi per baris) — keputusan Bagian 12 G7 opsi (a) | G7 | ✅ 2026-09-21 |
| 9 | `src/components/WorkingEngine/AnalystResultsGrid.tsx` | `stats` memisahkan `perluReview`/`anomali`; konfirmasi “Pindahkan ke Final Analisa?” menyebut kedua jumlah itu — keputusan G8 opsi (a) | G8 | ✅ 2026-09-21 |
| 10 | `src/components/BaseModal.tsx`, `src/components/useDialogBehavior.ts` (baru) + 20 file dialog | A3: `DialogPanel` (perilaku dialog: portal ke body, `role=dialog`/`aria-modal`/`aria-labelledby` otomatis dari judul yang terlihat, Esc, fokus masuk & kembali ke pemicu, Tab tertahan, klik-luar bisa dimatikan) dan `BaseModal` ( DialogPanel + header/body/footer `.modal-*`). 31 dialog dibungkus tanpa mengubah tampilan; `ConfirmDialog` tidak lagi menutup saat klik latar | A3 | ✅ 2026-09-21 (tsc 0 error, lint 0 error, diuji nyata di browser dev: Esc menutup, fokus kembali ke pemicu, Tab wrap dua arah) |
| 11 | `src/utils/analystPipeline.ts` | B4: fallback kota/kode pos karangan ("KOTA JAKARTA PUSAT", "10110"), label "Wilayah 01", dan seluruh identitas sintetis baris penanda (W-code modulo, `CABANG x`, `KCP x`, `Jl. Protokol x`, `Status Outlet: Aktif`, `Provinsi: INDONESIA`) dihapus → jadi kosong | B4 | ✅ 2026-09-21 (build). **Angka hasil analisa bisa berubah — operator perlu menjalankan ulang Analisa untuk membandingkan** |

Yang **belum** diuji pada sesi 2: (a) SQL `final_rows` terhadap Postgres sungguhan (butuh tulis ke Neon → aksi operator), (b) kartu Titik Koordinat di UI produksi untuk label `coba ulang 2.813 kode pos`.

**Akhir dokumen.** Untuk konversi PDF: buka file ini di VS Code → “Markdown PDF: Export (pdf)”, atau paste ke Google Docs/Word → Export PDF; untuk Canva: paste bagian tabel per bagian (Canva tidak merender Markdown tabel otomatis).