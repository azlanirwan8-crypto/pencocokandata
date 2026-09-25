# Endpoint cloud hanya-baca — pencocokandata

Base: `https://match-sepia.vercel.app` (produksi) atau dev server lokal, yang menjalankan
`api/*.ts` yang sama lewat middleware Vite. Semua endpoint di bawah **hanya-baca**;
menulis terjadi lewat aksi aplikasi, bukan lewat GET.

Diukur ulang 2026-09-25. Angka jumlah baris **tidak tetap** — lihat "Dataset hidup".

| Endpoint | Bentuk | Catatan |
|---|---|---|
| `/api/pten` | `data` = array langsung (terukur 8.936) | `limit` **diabaikan** — `?limit=1` tetap mengembalikan semuanya. Kolom relevan: `kotaPten`, `kotaPtenMax15`, `kodePosPten` |
| `/api/master` | `data.rows` (terukur 1.776) | nama kolom = header Excel asli (`Nama Outlet`, `Kode Cabang`, `Branch Code`, `Dati II`, `Kelurahan`, `Kecamatan`, `Provinsi`) |
| `/api/wilayah` | `data` = array (17) | |
| `/api/rolemapping` | `data` = array (1.767) | hanya 192 record yang 3/3 lengkap — itu ketentuan bisnis, bukan celah data |
| `/api/kodepos-geo?view=points` | `data` = array (10.597) | `{kodePos, lat, lng, sumber, presisi, terverifikasi}`. `sumber` yang sah dipakai kode: `google`, `esri`, `osm`, `desa` — di luar itu dibuang `muatTitikKodePos()`. Kosong ⇒ seluruh garis lengkung peta hilang tanpa pesan |
| `/api/kodepos?view=export&mulai=N&batas=M` | `data` = array; `count`, `total`, `mulai`, `batas`, `berikutnya` di akar | `batas` **dipotong ke 500**: `batas=2` pun mengembalikan 500. Paginasi lewat `berikutnya`/`mulai` |
| `/api/target?view=final&limit=N&offset=M` | `data.rows`; `total`, `returned`, `offset`, `limit` di **akar** | `limit` **dipotong ke 500** (`limit=9999` → `returned:500`, `limit:500`) |

## Tiga jebakan yang sudah menghasilkan kesimpulan salah

1. **`total` ada di AKAR, bukan di `data`.** Membaca `data.total` memberi `undefined`;
   kalau itu dipakai sebagai batas loop, paging berhenti setelah satu halaman dan
   analisa menyimpulkan "0 baris final" dari 30.000 baris.
2. **`limit`/`batas` dipotong diam-diam ke 500.** Tidak ada error, tidak ada peringatan —
   hanya data kurang. Loop harus berhenti pada `rows.length === 0` atau
   `sudahTerambil >= total`, bukan pada `returned < limit`.
3. **Pencarian kode pos lewat endpoint wilayah tidak bisa dipakai untuk membuktikan
   ketiadaan.** Hasil kosong bisa berarti "tidak ada" atau "query-nya salah bentuk".

## Dataset hidup — dan bisa TURUN

Tercatat pada hari yang sama: **83.747 → 40.846 → 29.700 → 30.000** baris `final_rows`,
dan `total` berubah 300 baris dalam hitungan detik antar dua permintaan berturut-turut.
Artinya ada proses penulisan aktif (analisa dijalankan / disetujui) sementara analisa lain
berjalan.

Konsekuensinya:

- Angka dari percakapan atau commit sebelumnya **sudah basi**. Ukur ulang sebelum
  menyimpulkan sesuatu hilang.
- Jangan membandingkan dua pengukuran pada waktu berbeda lalu menyebut salah satunya
  regresi.
- Kalau hasil terlihat "menghilang", cek dulu `total` saat ini sebelum menyalahkan kode.

## Hidrasi dev itu lambat — dan itu bukan bug render

`loadFinalFromNeon()` memaging 500 baris per permintaan secara berurutan; satu halaman
terukur ±3,6 detik. Untuk puluhan ribu baris itu ±10 menit. Selama itu tab terlihat beku:
`evaluate_script`, `take_screenshot`, dan `list_network_requests` timeout berturut-turut
sementara `list_pages` masih merespons.

Sebelum menuduh kode sendiri membuat loop: cek log dev server untuk

```
Supabase API Error (Target): Error: canceling statement due to statement timeout
  status: 500, code: '57014'
```

Itu Postgres yang menyerah, bukan JavaScript. Produksi pada URL yang sama bisa tetap
membalas 200.
