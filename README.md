# Tools Data Matcher Cabang & Outlet (v2.0)

Otomasi Pencocokan, Validasi PTEN, dan Pengayaan Data Operasional Cabang Berbasis Excel dengan Arsitektur Anti-Stopper / Chunk Stream.

## 🚀 Fitur Utama

- **Strict Row Integrity ($N_{\text{in}} = N_{\text{out}}$)**: Kolom `No` terkunci permanen sehingga urutan baris hasil unduhan sama persis 100% dengan berkas yang diunggah tanpa ada baris yang tergeser atau hilang.
- **In-Memory Hash Indexing ($O(1)$ Latency)**: Saat data master cabang (15 kolom) diunggah, sistem otomatis membangun hash table berbasis KODE POS untuk pencarian instan.
- **Cascade Matching Engine**:
  - **Level 1**: Pencocokan 1-to-1 berbasis KODE POS 5-digit.
  - **Level 2 Tie-Breaker**: Resolusi otomatis multi-cabang dengan evaluasi bertingkat (Kecamatan $\rightarrow$ Kelurahan $\rightarrow$ Dati II).
- **Validasi Silang PTEN**: Membandingkan `KODE POS` vs `KODE POS PTEN` (`MATCH` / `DIFFERENT`).
- **Pengayaan 7 Atribut Cabang**: Mengisi otomatis kolom `Sandi`, `Cabang`, `Branch Code`, `Kode Cabang`, `Nama Outlet`, `Status Outlet`, dan `ALAMAT`.
- **Anti-Stopper Chunk Streaming**: Pemrosesan baris berbasis *chunk stream* non-blocking (1.000 - 2.500 baris/batch) agar browser tetap responsif dengan visual progress bar (0% - 100%).
- **Filter Wilayah & Status**: Filter dinamis berdasarkan Wilayah/Region dan status pencocokan (*All, Matched Only, Unmatched Only, PTEN Discrepancy Only*).
- **Ekspor Excel Terstandarisasi**: Unduh berkas dengan penamaan terstandarisasi `Hasil_Matching_[Wilayah]_[Timestamp].xlsx` dan validasi assertion baris otomatis.
- **Pusat Monitoring (Dashboard)**:
  - 4 Metrik KPI Utama (*Total Data Diproses, Matching Rate, Unmatched Records, PTEN Discrepancy*)
  - Widget Distribusi Wilayah (*Bar Chart*)
  - Radar Anomali / Top 10 Unmatched Area
  - Audit Log & Riwayat Batch dengan fitur unduh ulang.

---

## 🛠️ Panduan Menjalankan Aplikasi

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Jalankan Server Development
```bash
npm run dev
```
Buka browser di `http://localhost:5173/`.

### 3. Build Produksi
```bash
npm run build
```

---

## 📑 Kamus Data (Data Dictionary)

### Data Master Cabang (15 Kolom)
1. `Wilayah`
2. `Sandi`
3. `Cabang`
4. `Branch Code`
5. `Kode Cabang`
6. `Nama Outlet`
7. `Status Outlet`
8. `ALAMAT`
9. `KODE POS` (Primary Key Level 1)
10. `Kelurahan` (Tie-Breaker Level 2)
11. `Kecamatan` (Tie-Breaker Level 2)
12. `Dati II` (Tie-Breaker Level 2)
13. `Kode Dati II`
14. `Provinsi`
15. `Telp`

### Data Target Operasional (19 Kolom)
1. `No` (Kunci Urutan Permanen)
2. `Wilayah`
3. `Sandi` *(Auto-populate dari Master)*
4. `Cabang` *(Auto-populate dari Master)*
5. `Branch Code` *(Auto-populate dari Master)*
6. `Kode Cabang` *(Auto-populate dari Master)*
7. `Nama Outlet` *(Auto-populate dari Master)*
8. `Status Outlet` *(Auto-populate dari Master)*
9. `ALAMAT` *(Auto-populate dari Master)*
10. `KODE POS` (Acuan Matching Level 1)
11. `Kelurahan` (Resolusi Multi-Cabang)
12. `Kecamatan` (Resolusi Multi-Cabang)
13. `Dati II`
14. `Kode Dati II`
15. `Provinsi`
16. `KOTA PTEN`
17. `KODE POS PTEN`
18. `CEK KODE POS + PTEN` (Nilai otomatis: MATCH atau DIFFERENT)
19. `SUMBER DATA`

---

## 📦 Lisensi & Hak Cipta
Aplikasi Tools Data Matcher Cabang & Outlet v2.0 Architecture.
