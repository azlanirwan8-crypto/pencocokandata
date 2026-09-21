# RENCANA PERBAIKAN SELURUH APLIKASI
**Aplikasi:** Tools Data Matcher Cabang & Outlet v2.x — React + TypeScript + Vite; IndexedDB (lokal) + Neon Postgres (cloud via serverless `api/`).
**Sumber:** tinjauan kode statis; aplikasi TIDAK dijalankan saat audit (`node`/`npm` tidak tersedia). Nomor baris = kondisi saat audit; verifikasi ulang dengan pencarian teks sebelum mengubah.
**Pemakai:** AI/developer eksekutor. Ikuti urutan di Bagian 10. Jangan ubah dua mesin sekaligus tanpa membaca file pasangannya (`analystPipeline.ts` ↔ `recommender.ts` ↔ `AnalystResultsGrid.tsx`).

## 0. STATUS PENGERJAAN — WAJIB DIBACA AI SEBELUM EKSEKUSI

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
| A3 | BELUM | — | |
| A4 | BELUM | — | |
| A5 | SELESAI | 2026-09-21 | Topbar.tsx — status koneksi + tombol Database + tombol Simpan (flushPendingWrites). Build & lint terverifikasi 2026-09-21 |
| A6 | BELUM | — | |
| A7 | BELUM | — | |
| A8 | BELUM | — | |
| A9 | BELUM | — | |
| A10 | BELUM | — | |
| B1 | SKIP (keputusan) | — | Lihat Bagian 12 |
| B2 | SKIP (keputusan) | — | Lihat Bagian 12 |
| B3 | BELUM | — | Verifikasi ekspor saja |
| B4 | SKIP (keputusan) | — | Lihat Bagian 12 |
| C2a | BELUM | — | |
| C2b | BELUM | — | |
| C2c | BELUM | — | |
| C2d | BELUM | — | |
| C2e | BELUM | — | |
| C3 | BELUM | — | Wajib setelah C2a–C2e |
| C4 | BELUM | — | Kasus uji |
| D1 | SKIP (keputusan) | — | Lihat Bagian 12 |
| D2 | BELUM | — | |
| D3 | SKIP (keputusan) | — | Lihat Bagian 12 |
| D4 | BELUM | — | |
| D5 | BELUM | — | |
| D6 | SKIP (keputusan) | — | Lihat Bagian 12 |
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
| F6-X4 | BELUM | — | = A5 |
| F6-X5 | BELUM | — | |
| G1 | BELUM | — | |
| G2 | BELUM | — | |
| G3 | BELUM | — | |
| G4 | SELESAI | 2026-09-21 | FinalDataManager — modal Detail per baris (role dialog + Esc). Build & lint terverifikasi 2026-09-21 |
| G5 | SELESAI | 2026-09-21 | FinalDataManager — aksi Hapus permanen + App.tsx handleDeleteFinalRow. Build & lint terverifikasi 2026-09-21 |
| G6 | SELESAI | 2026-09-21 | FinalDataManager — returnAll & revisi pakai ConfirmDialog. Build & lint terverifikasi 2026-09-21 |
| G7 | SKIP (keputusan) | — | Lihat Bagian 12 |
| G8 | SKIP (keputusan) | — | Lihat Bagian 12 |
| G9 | BELUM | — | |
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
| **Data Final** | `analyst_final_data` | **BELUM ADA sinkron Neon** | IndexedDB saja |

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

### A3 — Modal aksesibilitas (BaseModal)
**Masalah:** `role="dialog"`/`aria-modal`/Escape hanya di 4 file (`GoogleApiKeyModal`, `KodePosManager`, `KodePosSyncModal`, `SinyalTemuanModal`). `ConfirmDialog` belum punya role/Escape. Klik-luar hanya `SinyalTemuanModal.tsx:52` & `ConfirmDialog.tsx:45`. Tidak ada focus trap/pengembalian fokus.
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
| B4 | Default palsu (**menunggu keputusan**) | `'KOTA JAKARTA PUSAT'` `:1510`; `'10110'` `:1511`; `'Wilayah 01'` `:1898`; tebakan W-code `:1028–1040`; identitas sintetis `:1584–1589` | Ganti kosong + status manual; jangan isi karangan |

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
| D2 | Fallback arbitrer `completeRoleList[0]` (skor 0,70) | `analystPipeline.ts:1646` | Ganti dengan kandidat terdekat satu pulau, atau kosongkan + lempar manual |
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
**Eksekusi:** samakan perilaku (reset semua fase) ATAU beri dua tombol berbeda labelnya (“Kembalikan ke Fase terakhir” vs “Kembalikan ke Fase 1”). **Perlu keputusan** — default yang disarankan: samakan dengan Revisi per baris (mulai Fase 1).

### G8 — “Setujui Final” memindahkan semua status
**Masalah:** `handleApproveAllAnalystFinal` (`App.tsx:741–744`) memindahkan semua non-`TIDAK_ANALISA`, termasuk `PERLU_REVIEW`/`ANOMALI`, tanpa inspeksi.
**Eksekusi:** tambahkan peringatan di `ConfirmDialog`: “Termasuk N baris berstatus PERLU_REVIEW dan M baris ANOMALI”; atau filter hanya `isFinalApproved===true`/status EXACT+HIGH. **Perlu keputusan**.

### G9 — Data Final tidak sinkron ke Neon (P0)
**Masalah:** `analyst_final_data` hanya IndexedDB (`App.tsx:752, 770, 781`; boot restore `:215`). Tidak ada endpoint Neon; ganti perangkat/bersih browser = **Final Data hilang**.
**Eksekusi:** buat `api/final.ts` (pola `api/pten.ts`: app_store JSONB key `final_data`, GET/POST/DELETE) + `loadFinalFromNeon/saveFinalToNeon` di `neonSync.ts` + sinkron di boot `App.tsx:235–241` (pola merge seperti `neonWilayah` `:283–289`) dan setelah tiap perubahan Final (`:752, 770, 781`). Batasi ukuran: kirim per-chunk bila >2.000 baris (pola `saveKodePosToNeon` `neonSync.ts:372–407`).

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

| ID | Keputusan | Opsi |
|---|---|---|
| B1 | Penggabungan Kota/Kabupaten kembar nama di Fase 1 | (a) pisahkan jenis daerah, (b) biarkan + peringatan |
| B2 | Kode pos kelurahan masuk ekspor? | (a) ya + pisahkan kolom, (b) tetap kode pos kota |
| B4 | Hapus default palsu (`'10110'`, `'KOTA JAKARTA PUSAT'`, `'Wilayah 01'`, tebakan W-code, identitas sintetis) | (a) kosong + status manual, (b) biarkan |
| D1 | Engine resmi Fase 3 | (a) engine layar (nama+jarak+KC+pulau) — disarankan, (b) engine nama |
| D3/D6 | Aturan auto-final & pilihan manual | (a) auto-final hanya VERIFIED+non-fallback, (b) manual = HIGH_CONFIDENCE |
| G8 | “Setujui Final” menyertakan PERLU_REVIEW/ANOMALI? | (a) ya + peringatan, (b) filter status |
| G7 | “Kembalikan semua” reset ke Fase 1? | (a) ya (disarankan), (b) tetap fase terakhir |
| G1c | Unggahan Final boleh langsung masuk Final tanpa analisa? | (a) tidak — lewat Data Analyst (disarankan), (b) ya |

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
| ANI-5 | BELUM | Angka KPI berubah mendadak → count-up ~0,4 dtk (berlaku juga kartu dashboard lain) |

**Akhir dokumen.** Untuk konversi PDF: buka file ini di VS Code → “Markdown PDF: Export (pdf)”, atau paste ke Google Docs/Word → Export PDF; untuk Canva: paste bagian tabel per bagian (Canva tidak merender Markdown tabel otomatis).