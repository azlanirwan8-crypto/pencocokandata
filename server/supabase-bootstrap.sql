-- =============================================================================
--  SUPABASE BOOTSTRAP — aplikasi Pencocokan Data (match-sepia)
--
--  CARA PAKAI: Supabase Dashboard → project zhewnppsbfidzgihgnvn → SQL Editor →
--  New query → tempel SELURUH isi berkas ini → Run. Sekali jalan.
--  Berkas ini idempoten: boleh (dan perlu) dijalankan ulang setiap kali berkas
--  ini berubah — hasilnya selalu sama dengan isi berkas, tanpa menghapus data.
--
--  KENAPA PERLU? Aplikasi bicara ke Supabase lewat PostgREST memakai
--  *publishable key* (kunci publik; sama yang dipakai browser). Kunci itu sengaja
--  tidak diizinkan membuat tabel/fungsi, jadi seluruh DDL dan seluruh SQL yang
--  rumit dikumpulkan di sini sebagai fungsi bernama. Kode di api/ hanya memanggil
--  fungsi berdasarkan nama + argumen ternama — tidak ada jalur mengirim teks SQL
--  bebas dari luar, jadi tidak ada permukaan injeksi SQL.
--
--  KEAMANAN: kebijakan RLS di bagian 2 terbuka, artinya siapa pun yang memegang
--  kunci publik bisa baca-tulis tabel ini. Itu disengaja supaya setara dengan
--  keadaan sebelumnya: semua endpoint /api/* di Vercel juga publik tanpa login.
--  Untuk menguncinya nanti, cukup ganti kebijakan `app_terbuka` per tabel — api/
--  tetap jalan karena fungsi-fungsinya SECURITY DEFINER (jalan sebagai pemilik
--  tabel, bukan sebagai pemanggil).
-- =============================================================================

begin;

-- Peran bawaan Supabase: anon = kunci publik, authenticated = kunci publik + JWT,
-- service_role = kunci rahasia server (tidak dipakai aplikasi ini).
grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. TABEL
-- -----------------------------------------------------------------------------

-- Penyimpanan key-value: setting wilayah, master PTEN, RoleMapping, cadangan master/target.
create table if not exists public.app_store (
  key        varchar(100) primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.master_records (
  id            serial primary key,
  branch_code   text,
  kode_cabang   text,
  nama_outlet   text,
  sandi_cabang  text,
  sandi         text,
  cabang        text,
  wilayah       text,
  status_outlet text,
  alamat        text,
  kode_pos      text,
  kelurahan     text,
  kecamatan     text,
  dati_ii       text,
  kode_dati_ii  text,
  provinsi      text,
  telp          text,
  raw_data      jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_master_wilayah     on public.master_records(wilayah);
create index if not exists idx_master_branch_code on public.master_records(branch_code);
create index if not exists idx_master_kode_pos    on public.master_records(kode_pos);

create table if not exists public.master_meta (
  key         varchar(50) primary key,
  file_name   text,
  total_count int,
  updated_at  timestamptz default now()
);

create table if not exists public.target_records (
  id            serial primary key,
  no_urut       int,
  wilayah       text,
  branch_code   text,
  kode_cabang   text,
  nama_outlet   text,
  sandi_cabang  text,
  sandi         text,
  cabang        text,
  status_outlet text,
  alamat        text,
  kode_pos      text,
  kelurahan     text,
  kecamatan     text,
  dati_ii       text,
  kode_dati_ii  text,
  provinsi      text,
  sumber_data   text,
  is_matched    boolean default false,
  match_level   text,
  matched_at    text,
  matched_by    text,
  raw_data      jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_target_no_urut    on public.target_records(no_urut, id);
create index if not exists idx_target_wilayah    on public.target_records(wilayah);
create index if not exists idx_target_is_matched on public.target_records(is_matched);

create table if not exists public.target_meta (
  key           varchar(50) primary key,
  file_name     text,
  initial_count int,
  matched_done  boolean default false,
  updated_at    timestamptz default now()
);

-- Data Final Analisa: satu baris per kunci (bukan satu blob) — puluhan ribu baris.
create table if not exists public.final_rows (
  row_key    text primary key,
  raw_data   jsonb not null,
  updated_at timestamptz default now()
);

-- Tabel kerja kode pos. Titik per baris ada di kolomnya sendiri.
create table if not exists public.kodepos_data (
  id               serial primary key,
  kode_pos         varchar(10) not null,
  kelurahan        text,
  kecamatan        text,
  kabupaten_kota   text,
  provinsi         text,
  status           varchar(20) default 'AKTIF',
  latitude         double precision,
  longitude        double precision,
  sumber_koordinat text,
  diambil_pada     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists idx_kodepos_kode      on public.kodepos_data(kode_pos);
create index if not exists idx_kodepos_provinsi  on public.kodepos_data(provinsi);
create index if not exists idx_kodepos_kabupaten on public.kodepos_data(kabupaten_kota);
create index if not exists idx_kodepos_lat       on public.kodepos_data(latitude);

-- Cache satu titik per kode pos (hasil geocoding Google/ESRI/OSM).
create table if not exists public.kodepos_geo (
  kode_pos             varchar(10) primary key,
  latitude             double precision,
  longitude            double precision,
  sumber               text,
  presisi              text,
  terverifikasi_google boolean default false,
  alamat               text,
  dicari               text,
  provinsi             text,
  kabupaten_kota       text,
  diambil_pada         timestamptz,
  dibuat_pada          timestamptz default now()
);

-- Patokan nasional (dump Kemendagri / Satu Data / mirror / crawl kodepos.id).
create table if not exists public.kodepos_baseline (
  id             serial primary key,
  kode_wilayah   varchar(13) unique not null,
  kode_pos       varchar(10),
  kelurahan      text,
  kecamatan      text,
  kabupaten_kota text,
  provinsi       text,
  sumber         text,
  versi          int,
  diambil_pada   timestamptz default now()
);
create index if not exists idx_baseline_kode_pos on public.kodepos_baseline(kode_pos);
create index if not exists idx_baseline_versi    on public.kodepos_baseline(versi);

-- Jejak crawl kodepos.id per provinsi, supaya cek "masih baru?" tak perlu unduh ulang.
create table if not exists public.kodepos_crawl_state (
  provinsi     text primary key,
  sumber       text,
  halaman      int not null default 0,
  baris        int not null default 0,
  sampel       text,
  versi        int,
  diambil_pada timestamptz default now()
);

-- Titik per kode wilayah (desa), sumber kodepos.co.id.
create table if not exists public.kodepos_koordinat (
  kode_wilayah varchar(13) primary key,
  kode_pos     varchar(10),
  latitude     double precision not null,
  longitude    double precision not null,
  elevasi      int,
  sumber       text,
  diambil_pada timestamptz default now()
);
create index if not exists idx_koordinat_kode_pos on public.kodepos_koordinat(kode_pos);

-- -----------------------------------------------------------------------------
-- 2. RLS — terbuka untuk peran kunci publik (lihat catatan keamanan di kepala berkas)
-- -----------------------------------------------------------------------------
do $rls$
declare t text;
begin
  foreach t in array array[
    'app_store','master_records','master_meta','target_records','target_meta','final_rows',
    'kodepos_data','kodepos_geo','kodepos_baseline','kodepos_crawl_state','kodepos_koordinat'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_terbuka on public.%I', t);
    execute format(
      'create policy app_terbuka on public.%I for all to anon, authenticated, service_role using (true) with check (true)',
      t);
  end loop;
end
$rls$;

-- -----------------------------------------------------------------------------
-- 3. FUNGSI
--    Satu fungsi = satu pekerjaan yang dulu ditulis sebagai SQL di api/*.ts.
--    SECURITY DEFINER + search_path terkunci: jalan sebagai pemilik tabel, jadi
--    tidak tersendat RLS, dan hanya SQL inilah yang bisa dijalankan dari luar.
-- -----------------------------------------------------------------------------

/** Waktu server — dipakai /api/status untuk memastikan koneksi benar-benar hidup. */
create or replace function public.app_now() returns timestamptz
language sql stable security definer set search_path = public as
$$ select now(); $$;

-- ── TABEL KERJA KODE POS ────────────────────────────────────────────────────

/**
 * Satu halaman tabel kerja + total baris yang cocok filter, dalam satu panggilan.
 * Titik dibaca dari barisnya sendiri, bila kosong dari cache kodepos_geo per kode pos.
 * Nama kolom urutan diambil dari daftar tetap — tidak pernah dari teks permintaan.
 */
create or replace function public.kp_halaman(
  p_search   text,
  p_provinsi text,
  p_kota     text,
  p_status   text,
  p_sort     text,
  p_dir      text,
  p_limit    int,
  p_offset   int
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_pilih text;
  v_urut  text;
  v_rows  jsonb;
  v_total int := 0;
  v_pola  text := '%' || coalesce(btrim(p_search), '') || '%';
  v_ada   boolean := nullif(btrim(coalesce(p_search, '')), '') is not null;
begin
  v_pilih := case p_sort
    when 'kodePos'       then 'kode_pos'
    when 'kelurahan'     then 'kelurahan'
    when 'kecamatan'     then 'kecamatan'
    when 'kabupatenKota' then 'kabupaten_kota'
    when 'provinsi'      then 'provinsi'
    when 'latitude'      then 'latitude'
    when 'longitude'     then 'longitude'
    else null end;

  if v_pilih is null then
    v_urut := 'id asc';
  else
    v_urut := v_pilih
      || case when lower(coalesce(p_dir, 'asc')) = 'desc' then ' desc' else ' asc' end
      || ' nulls last, id asc';
  end if;

  execute $cnt$select count(*)::int
     from kodepos_data d
     where ($1::text is null or d.provinsi = $1)
       and ($2::text is null or d.kabupaten_kota = $2)
       and ($3::text is null or upper(d.status) = upper($3))
       and ($5::boolean is not true
            or d.kode_pos ilike $4 or d.kelurahan ilike $4 or d.kecamatan ilike $4
            or d.kabupaten_kota ilike $4 or d.provinsi ilike $4)$cnt$
    into v_total
    using p_provinsi, p_kota, p_status, v_pola, v_ada;

  execute $pg$
    with x as (
      select d.id, d.kode_pos, d.kelurahan, d.kecamatan, d.kabupaten_kota, d.provinsi, d.status,
             coalesce(d.latitude, g.latitude)   as latitude,
             coalesce(d.longitude, g.longitude) as longitude,
             case when d.latitude is not null then coalesce(nullif(d.sumber_koordinat, ''), 'kodepos.co.id')
                  else g.sumber end            as geo_sumber,
             case when d.latitude is not null then 'titik desa'
                  else g.presisi end           as geo_presisi,
             g.terverifikasi_google
      from kodepos_data d
      left join kodepos_geo g on g.kode_pos = upper(btrim(d.kode_pos))
      where ($1::text is null or d.provinsi = $1)
        and ($2::text is null or d.kabupaten_kota = $2)
        and ($3::text is null or upper(d.status) = upper($3))
        and ($5::boolean is not true
             or d.kode_pos ilike $4 or d.kelurahan ilike $4 or d.kecamatan ilike $4
             or d.kabupaten_kota ilike $4 or d.provinsi ilike $4)
      order by $pg$ || v_urut || $rd$
      limit $6 offset $7)
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'kode_pos', x.kode_pos, 'kelurahan', x.kelurahan, 'kecamatan', x.kecamatan,
        'kabupaten_kota', x.kabupaten_kota, 'provinsi', x.provinsi, 'status', x.status,
        'latitude', x.latitude, 'longitude', x.longitude,
        'geo_sumber', x.geo_sumber, 'geo_presisi', x.geo_presisi,
        'terverifikasi_google', x.terverifikasi_google)), '[]'::jsonb)
    from x$rd$
    into v_rows
    using p_provinsi, p_kota, p_status, v_pola, v_ada,
          greatest(1, coalesce(p_limit, 25)), greatest(0, coalesce(p_offset, 0));

  return jsonb_build_object('rows', coalesce(v_rows, '[]'::jsonb), 'total', coalesce(v_total, 0));
end $$;

/**
 * Seluruh baris yang cocok filter, TANPA paging — dipakai ?view=export.
 * Sengaja satu panggilan: mengulang kp_halaman per 1.000 baris berarti 168
 * round-trip HTTPS untuk 83 ribu baris, dan fungsi serverless kehabisan waktu
 * sebelum halaman terakhir tiba (gejalanya: ekspor kembali ke data contoh).
 */
create or replace function public.kp_semua(
  p_search   text,
  p_provinsi text,
  p_kota     text,
  p_status   text
) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'kode_pos', x.kode_pos, 'kelurahan', x.kelurahan, 'kecamatan', x.kecamatan,
      'kabupaten_kota', x.kabupaten_kota, 'provinsi', x.provinsi, 'status', x.status,
      'latitude', x.latitude, 'longitude', x.longitude,
      'geo_sumber', x.geo_sumber, 'geo_presisi', x.geo_presisi,
      'terverifikasi_google', x.terverifikasi_google)), '[]'::jsonb)
  from (
    select d.id, d.kode_pos, d.kelurahan, d.kecamatan, d.kabupaten_kota, d.provinsi, d.status,
           coalesce(d.latitude, g.latitude)   as latitude,
           coalesce(d.longitude, g.longitude) as longitude,
           case when d.latitude is not null then coalesce(nullif(d.sumber_koordinat, ''), 'kodepos.co.id')
                else g.sumber end            as geo_sumber,
           case when d.latitude is not null then 'titik desa'
                else g.presisi end           as geo_presisi,
           g.terverifikasi_google
    from kodepos_data d
    left join kodepos_geo g on g.kode_pos = upper(btrim(d.kode_pos))
    where (p_provinsi is null or d.provinsi = p_provinsi)
      and (p_kota is null or d.kabupaten_kota = p_kota)
      and (p_status is null or upper(d.status) = upper(p_status))
      and (p_search is null
           or d.kode_pos ilike '%' || btrim(p_search) || '%'
           or d.kelurahan ilike '%' || btrim(p_search) || '%'
           or d.kecamatan ilike '%' || btrim(p_search) || '%'
           or d.kabupaten_kota ilike '%' || btrim(p_search) || '%'
           or d.provinsi ilike '%' || btrim(p_search) || '%')
    order by d.id
  ) x;
$$;

/** KPI kartu ringkas. ber_titik seluas bacaan tabel: titik baris sendiri ATAU cache. */
create or replace function public.kp_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total',       count(*)::int,
    'provinsi',    count(distinct d.provinsi)::int,
    'kota',        count(distinct d.kabupaten_kota)::int,
    'kecamatan',   count(distinct d.kecamatan)::int,
    'kelurahan',   count(distinct d.kelurahan)::int,
    'aktif',       count(*) filter (where upper(d.status) <> 'NON-AKTIF')::int,
    'ber_titik',   count(*) filter (where d.latitude is not null or g.latitude is not null)::int
  )
  from kodepos_data d
  left join kodepos_geo g on g.kode_pos = upper(btrim(d.kode_pos)) and g.latitude is not null;
$$;

/** Isi dropdown provinsi + kota/kab (kota bisa dibatasi satu provinsi). */
create or replace function public.kp_options(p_provinsi text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'provinsi', coalesce((select jsonb_agg(v order by v) from (
        select distinct provinsi as v from kodepos_data where provinsi is not null and provinsi <> '') a), '[]'::jsonb),
    'kota',     coalesce((select jsonb_agg(v order by v) from (
        select distinct kabupaten_kota as v from kodepos_data
        where kabupaten_kota is not null and kabupaten_kota <> ''
          and (p_provinsi is null or provinsi = p_provinsi)) b), '[]'::jsonb)
  );
$$;

/**
 * Sidik jari per provinsi: membandingkan basis data lokal dengan cloud tanpa
 * mengirim puluhan ribu baris. sha256 atas kunci baris yang diurutkan COLLATE "C"
 * (urutan byte) supaya sama dengan urutan di JavaScript.
 */
create or replace function public.kp_sync_meta() returns jsonb
language sql stable security definer set search_path = public as $$
  with k as (
    select coalesce(nullif(upper(btrim(provinsi)), ''), '(TANPA PROVINSI)') as provinsi,
           upper(btrim(kode_pos)) || '|' || upper(btrim(coalesce(kelurahan, ''))) || '|' ||
           upper(btrim(coalesce(kecamatan, ''))) || '|' || upper(btrim(coalesce(kabupaten_kota, ''))) || '|' ||
           upper(btrim(coalesce(provinsi, ''))) as kunci,
           updated_at
    from kodepos_data
  ),
  g as (
    select provinsi, count(*)::int as total,
           encode(sha256(convert_to(string_agg(kunci, e'\n' order by kunci collate "C"), 'UTF8')), 'hex') as fingerprint
    from k group by provinsi
  )
  select jsonb_build_object(
    'provinces',   coalesce((select jsonb_agg(jsonb_build_object(
                     'provinsi', provinsi, 'total', total, 'fingerprint', fingerprint)
                     order by provinsi collate "C") from g), '[]'::jsonb),
    'lastUpdated', (select max(updated_at) from k)
  );
$$;

/**
 * Adu himpunan kunci baris milik browser dengan milik cloud.
 * p_keys  = kunci digabung chr(31) (kontrak yang sama dengan klien).
 * p_prov  = daftar provinsi yang diadu (dibatasi sama seperti cloudCodes).
 */
create or replace function public.kp_sync_diff(p_keys text, p_cap int) returns jsonb
language sql stable security definer set search_path = public as $$
  with loc as (
    select distinct unnest(string_to_array(coalesce(p_keys, ''), chr(31))) as k
  ),
  prov as (
    select distinct split_part(k, '|', 5) as p from loc
  ),
  cloud as (
    select id, kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status,
           upper(btrim(kode_pos)) || '|' || upper(btrim(coalesce(kelurahan, ''))) || '|' ||
           upper(btrim(coalesce(kecamatan, ''))) || '|' || upper(btrim(coalesce(kabupaten_kota, ''))) || '|' ||
           upper(btrim(coalesce(provinsi, ''))) as k,
           coalesce(nullif(upper(btrim(provinsi)), ''), '(TANPA PROVINSI)') as prov
    from kodepos_data
  ),
  kurang_lokal as (
    select c.id, c.kode_pos, c.kelurahan, c.kecamatan, c.kabupaten_kota, c.provinsi, c.status
    from cloud c left join loc l on l.k = c.k
    where l.k is null and c.prov in (select p from prov)
    limit greatest(1, coalesce(p_cap, 500))
  ),
  kurang_cloud as (
    select l.k from loc l left join cloud c on c.k = l.k where c.k is null
  ),
  kode_cloud as (
    select distinct upper(btrim(c.kode_pos)) as kode_pos
    from cloud c where c.prov in (select p from prov)
  )
  select jsonb_build_object(
    'missingInCloud', coalesce((select jsonb_agg(k order by k) from kurang_cloud), '[]'::jsonb),
    'missingInLocal', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'kode_pos', kode_pos, 'kelurahan', kelurahan, 'kecamatan', kecamatan,
        'kabupaten_kota', kabupaten_kota, 'provinsi', provinsi, 'status', status)) from kurang_lokal), '[]'::jsonb),
    'cloudCodes',     coalesce((select jsonb_agg(kode_pos order by kode_pos) from kode_cloud), '[]'::jsonb)
  );
$$;

/** Daftar kode pos unik — bahan audit kelengkapan terhadap sumber eksternal. */
create or replace function public.kp_kode_unik() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
  from (select distinct upper(btrim(kode_pos)) as k from kodepos_data
        where kode_pos is not null and btrim(kode_pos) <> '') x;
$$;

/** Kosongkan + reset nomor urut tabel kerja. Butuh hak TRUNCATE — tidak bisa lewat REST. */
create or replace function public.kp_kosongkan() returns void
language plpgsql security definer set search_path = public as $$
begin
  truncate table public.kodepos_data restart identity;
end $$;

-- ── DATA FINAL ──────────────────────────────────────────────────────────────

/** Hapus banyak baris Data Final; membalas kunci yang benar-benar terhapus. */
create or replace function public.final_hapus(p_keys jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_keys text[]; v jsonb;
begin
  select array_agg(distinct btrim(k)) into v_keys
  from jsonb_array_elements_text(coalesce(p_keys, '[]'::jsonb)) k
  where btrim(k) <> '';

  if v_keys is null or cardinality(v_keys) = 0 then
    return '[]'::jsonb;
  end if;

  with d as (
    delete from final_rows where row_key = any (v_keys) returning row_key
  )
  select coalesce(jsonb_agg(row_key), '[]'::jsonb) into v from d;
  return v;
end $$;

-- ── TITIK KOORDINAT PER KODE POS (kodepos_geo) ──────────────────────────────

/**
 * Daftar kode pos yang perlu dicari titiknya + sisahitungnya.
 * p_mode   'isi' = belum punya titik; 'verifikasi' = punya tapi belum dikonfirmasi Google.
 * p_ulang  ikutkan yang belum PERNAH dicari atau pernah dicari tapi tak pernah ditandai
 *          'TIDAK DITEMUKAN' (yang sudah ditandai memang tidak bersumber, jangan ditawarkan lagi).
 */
create or replace function public.geo_kandidat(
  p_mode text, p_provinsi text, p_limit int, p_ulang boolean
) returns jsonb
language sql stable security definer set search_path = public as $$
  with u as (
    select upper(btrim(kode_pos)) as kode_pos, kecamatan, kabupaten_kota, provinsi, id
    from kodepos_data
    union all
    select upper(btrim(kode_pos)), kecamatan, kabupaten_kota, provinsi, id + 900000000
    from kodepos_baseline
  ),
  k as (
    select distinct on (kode_pos) kode_pos, kecamatan, kabupaten_kota, provinsi
    from u
    where kode_pos ~ '^[0-9]{5}$'
      and (p_provinsi is null or upper(btrim(provinsi)) = upper(btrim(p_provinsi)))
    order by kode_pos, id
  ),
  p as (
    select k.kode_pos, k.kecamatan, k.kabupaten_kota, k.provinsi, g.diambil_pada as dicoba_pada
    from k left join kodepos_geo g on g.kode_pos = k.kode_pos
    where case
      when p_mode = 'verifikasi'
        then g.kode_pos is not null and g.terverifikasi_google is not true and g.latitude is not null
      when coalesce(p_ulang, false)
        then g.kode_pos is null
          or (g.latitude is null and coalesce(upper(btrim(g.sumber)), '') <> 'TIDAK DITEMUKAN')
      else g.kode_pos is null
    end
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
                'kode_pos', kode_pos, 'kecamatan', kecamatan,
                'kabupaten_kota', kabupaten_kota, 'provinsi', provinsi))
              from (select * from p order by dicoba_pada nulls first
                    limit greatest(1, coalesce(p_limit, 40))) h), '[]'::jsonb),
    'sisa', (select count(*)::int from p)
  );
$$;

/** Ringkasan isi kodepos_geo + tiga angka antrean, dalam satu panggilan. */
create or replace function public.geo_stats(p_provinsi text) returns jsonb
language sql stable security definer set search_path = public as $$
  with u as (
    select upper(btrim(kode_pos)) as kode_pos, provinsi from kodepos_data
    union all
    select upper(btrim(kode_pos)), provinsi from kodepos_baseline
  ),
  k as (
    select distinct on (kode_pos) kode_pos, provinsi
    from u
    where kode_pos ~ '^[0-9]{5}$'
      and (p_provinsi is null or upper(btrim(provinsi)) = upper(btrim(p_provinsi)))
    order by kode_pos
  ),
  p as (
    select k.kode_pos, g.latitude, g.sumber, g.terverifikasi_google
    from k left join kodepos_geo g on g.kode_pos = k.kode_pos
  )
  select jsonb_build_object(
    'geo', coalesce((select jsonb_build_object(
      'tercatat',     count(*)::int,
      'punya',        count(*) filter (where latitude is not null)::int,
      'gagal',        count(*) filter (where latitude is null)::int,
      'takBersumber', count(*) filter (where latitude is null and upper(btrim(sumber)) = 'TIDAK DITEMUKAN')::int,
      'google',       count(*) filter (where terverifikasi_google)::int,
      'esri',         count(*) filter (where latitude is not null and sumber = 'esri')::int,
      'osm',          count(*) filter (where latitude is not null and sumber = 'osm')::int,
      'perkiraan',    count(*) filter (where presisi = 'PERKIRAAN WILAYAH')::int
    ) from kodepos_geo), jsonb_build_object(
      'tercatat', 0, 'punya', 0, 'gagal', 0, 'takBersumber', 0,
      'google', 0, 'esri', 0, 'osm', 0, 'perkiraan', 0)),
    'menunggu',        (select count(*)::int from p where latitude is null),
    'menungguUlang',   (select count(*)::int from p
                         where latitude is null and coalesce(upper(btrim(sumber)), '') <> 'TIDAK DITEMUKAN'),
    'perluVerifikasi', (select count(*)::int from p
                         where terverifikasi_google is not true and latitude is not null)
  );
$$;

/**
 * Simpan hasil pencarian satu batch titik.
 * 'TIDAK DITEMUKAN' pada p_rows.x.sumber = baris gagal; latitude/longitude null.
 * terverifikasi_google bersifat menempel: sekali dikonfirmasi Google, tidak lagi jadi false.
 */
create or replace function public.geo_simpan(p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  with u as (
    insert into kodepos_geo
      (kode_pos, latitude, longitude, sumber, presisi, terverifikasi_google, alamat, dicari,
       provinsi, kabupaten_kota, diambil_pada)
    select x.kode_pos, x.latitude, x.longitude, x.sumber, x.presisi,
           coalesce(x.terverifikasi, false), x.alamat, x.dicari, x.provinsi, x.kabupaten_kota, now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      kode_pos text, latitude double precision, longitude double precision, sumber text,
      presisi text, terverifikasi boolean, alamat text, dicari text, provinsi text, kabupaten_kota text)
    where coalesce(x.kode_pos, '') <> ''
    on conflict (kode_pos) do update set
      latitude             = excluded.latitude,
      longitude            = excluded.longitude,
      sumber               = excluded.sumber,
      presisi              = excluded.presisi,
      terverifikasi_google = kodepos_geo.terverifikasi_google or coalesce(excluded.terverifikasi_google, false),
      alamat               = excluded.alamat,
      dicari               = excluded.dicari,
      provinsi             = excluded.provinsi,
      kabupaten_kota       = excluded.kabupaten_kota,
      diambil_pada         = now()
    returning 1
  )
  select count(*)::int into v from u;
  return coalesce(v, 0);
end $$;

/** Titik untuk peta: rata-rata titik desa per kode pos menang atas cache geo. */
create or replace function public.geo_points(p_provinsi text) returns jsonb
language sql stable security definer set search_path = public as $$
  with d as (
    select upper(btrim(kode_pos)) as kode_pos, avg(latitude) as latitude, avg(longitude) as longitude,
           count(*)::int as n, min(provinsi) as provinsi
    from kodepos_data
    where latitude is not null and kode_pos ~ '^[0-9]{5}$'
    group by 1
  ),
  g as (
    select upper(btrim(kode_pos)) as kode_pos, latitude, longitude, sumber, presisi,
           terverifikasi_google, provinsi
    from kodepos_geo where latitude is not null
  ),
  u as (
    select kode_pos, latitude, longitude, 'desa' as sumber, (n::text || ' titik desa') as presisi,
           false as terverifikasi_google, provinsi, 1 as prioritas from d
    union all
    select kode_pos, latitude, longitude, sumber, presisi, terverifikasi_google, provinsi, 2 from g
  )
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  from (
    select distinct on (kode_pos) kode_pos, latitude, longitude, sumber, presisi, terverifikasi_google
    from u
    where p_provinsi is null or upper(btrim(provinsi)) = upper(btrim(p_provinsi))
    order by kode_pos, prioritas
  ) x;
$$;

-- ── PATOKAN NASIONAL (kodepos_baseline) ─────────────────────────────────────

create or replace function public.base_meta() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'versi',         max(versi),
    'diambil_pada',  max(diambil_pada),
    'sumber',        max(sumber),
    'baris',         count(*)::int,
    'kode_pos_unik', count(distinct upper(kode_pos))::int
  ) from kodepos_baseline;
$$;

/** Semua angka aduan patokan vs tabel kerja dalam satu panggilan. */
create or replace function public.base_diff(p_cap int) returns jsonb
language sql stable security definer set search_path = public as $$
  with db as (
    select distinct upper(btrim(kode_pos)) as kode_pos from kodepos_data
    where kode_pos is not null and btrim(kode_pos) <> ''
  ),
  bs as (
    select distinct upper(btrim(kode_pos)) as kode_pos from kodepos_baseline
    where kode_pos is not null and btrim(kode_pos) <> ''
  ),
  b as (
    select kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi
    from kodepos_baseline
    where kode_pos ~ '^[0-9]{5}$'
      and upper(btrim(kode_pos)) not in (select kode_pos from db)
    order by provinsi, kabupaten_kota, kecamatan, kode_pos
    limit greatest(1, coalesce(p_cap, 5000))
  )
  select jsonb_build_object(
    'baris',         (select count(*)::int from kodepos_baseline),
    'kode_pos_unik', (select count(*)::int from bs),
    'sumber',        (select max(sumber) from kodepos_baseline),
    'diambil_pada',  (select max(diambil_pada) from kodepos_baseline),
    'versi',         (select max(versi) from kodepos_baseline),
    'belum',         (select count(*)::int from bs where kode_pos not in (select kode_pos from db)),
    'dbCodes',       (select count(*)::int from db),
    'dbRows',        (select count(*)::int from kodepos_data),
    'hanyaDiDb',     (select count(*)::int from db where kode_pos not in (select kode_pos from bs)),
    'missingInDb',   coalesce((select jsonb_agg(jsonb_build_object(
        'kodePos', b.kode_pos, 'kelurahan', b.kelurahan, 'kecamatan', b.kecamatan,
        'kabupatenKota', b.kabupaten_kota, 'provinsi', b.provinsi,
        'latitude', g.latitude, 'longitude', g.longitude,
        'geoSumber', g.sumber, 'geoPresisi', g.presisi,
        'geoTerverifikasi', coalesce(g.terverifikasi_google, false)))
      from b left join kodepos_geo g on g.kode_pos = upper(btrim(b.kode_pos))), '[]'::jsonb)
  );
$$;

create or replace function public.base_next_versi() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(versi), 0)::int + 1 from kodepos_baseline;
$$;

/**
 * Salin SEMUA baris patokan yang belum ada ke tabel kerja, langsung di database.
 * Jalur browser hanya membawa baris contoh, jadi tidak sanggup mengisi puluhan ribu baris.
 */
create or replace function public.base_import_missing() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_sebelum int; v_sesudah int;
begin
  select count(*) into v_sebelum from kodepos_data;

  insert into kodepos_data (kode_pos, kelurahan, kecamatan, kabupaten_kota, provinsi, status)
  select b.kode_pos, b.kelurahan, b.kecamatan, b.kabupaten_kota, b.provinsi, 'AKTIF'
  from kodepos_baseline b
  where b.kode_pos ~ '^[0-9]{5}$'
    and not exists (
      select 1 from kodepos_data d
      where upper(btrim(d.kode_pos)) = upper(btrim(b.kode_pos))
        and lower(btrim(coalesce(d.kelurahan, ''))) = lower(btrim(coalesce(b.kelurahan, '')))
    )
  on conflict do nothing;

  select count(*) into v_sesudah from kodepos_data;
  return jsonb_build_object('masuk', v_sesudah - v_sebelum, 'totalSetelah', v_sesudah);
end $$;

/** Cakupan titik per kode wilayah vs tabel kerja. */
create or replace function public.koordinat_cakupan() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'patokan_titik',      (select count(*)::int from kodepos_koordinat),
    'terakhir',           (select max(diambil_pada) from kodepos_koordinat),
    'data_total',         (select count(*)::int from kodepos_data),
    'data_titik',         (select count(*)::int from kodepos_data where latitude is not null),
    'kode_pos_titik',     (select count(distinct upper(btrim(kode_pos)))::int from kodepos_data
                             where latitude is not null),
    'di_luar_wilayah',    (select count(*)::int from kodepos_data where latitude is not null
                             and (latitude not between -11 and 41 or longitude not between 89 and 145)),
    'tak_terkenalan',     (select count(*)::int from kodepos_koordinat k where not exists
                             (select 1 from kodepos_baseline b where b.kode_wilayah = k.kode_wilayah)),
    'kode_wilayah_cocok', (select count(*)::int from kodepos_koordinat k
                             join kodepos_baseline b on b.kode_wilayah = k.kode_wilayah),
    'kode_pos_cocok',     (select count(*)::int from kodepos_koordinat k
                             join kodepos_baseline b on b.kode_wilayah = k.kode_wilayah
                             where upper(btrim(k.kode_pos)) = upper(btrim(b.kode_pos)))
  );
$$;

/** Turunkan titik patokan ke baris kodepos_data — satu pernyataan, tanpa lalu-lalang data. */
create or replace function public.koordinat_salin() returns jsonb
language sql security definer set search_path = public as $$
  with src as (
    select distinct on (kunci) kunci, latitude, longitude, sumber, diambil_pada
    from (
      select upper(btrim(coalesce(b.kode_pos, ''))) || '|' ||
             upper(btrim(coalesce(b.kelurahan, ''))) || '|' ||
             upper(btrim(coalesce(b.kecamatan, ''))) || '|' ||
             upper(btrim(coalesce(b.kabupaten_kota, ''))) || '|' ||
             upper(btrim(coalesce(b.provinsi, ''))) as kunci,
             k.latitude, k.longitude, k.sumber, k.diambil_pada, b.kode_wilayah
      from kodepos_koordinat k
      join kodepos_baseline b on b.kode_wilayah = k.kode_wilayah
    ) t
    order by kunci, kode_wilayah
  ),
  upd as (
    update kodepos_data d
    set latitude  = src.latitude,
        longitude = src.longitude,
        sumber_koordinat = src.sumber,
        diambil_pada     = src.diambil_pada
    from src
    where src.kunci = upper(btrim(coalesce(d.kode_pos, ''))) || '|' ||
                      upper(btrim(coalesce(d.kelurahan, ''))) || '|' ||
                      upper(btrim(coalesce(d.kecamatan, ''))) || '|' ||
                      upper(btrim(coalesce(d.kabupaten_kota, ''))) || '|' ||
                      upper(btrim(coalesce(d.provinsi, '')))
      and (d.latitude is distinct from src.latitude or d.longitude is distinct from src.longitude)
    returning 1
  )
  select jsonb_build_object(
    'disalin',    (select count(*)::int from upd),
    'tanpaTitik', (select count(*)::int from kodepos_data where latitude is null)
  );
$$;

/** Jejak crawl kodepos.id per provinsi; p_versi 0 = ambil nomor berikutnya. */
create or replace function public.crawl_state_simpan(
  p_provinsi text, p_sumber text, p_halaman int, p_baris int, p_sampel text, p_versi int
) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  v := coalesce(nullif(p_versi, 0),
                (select coalesce(max(versi), 0)::int + 1 from public.kodepos_crawl_state));
  insert into public.kodepos_crawl_state
    (provinsi, sumber, halaman, baris, sampel, versi, diambil_pada)
  values (p_provinsi, p_sumber, p_halaman, p_baris, p_sampel, v, now())
  on conflict (provinsi) do update set
    sumber       = excluded.sumber,
    halaman      = excluded.halaman,
    baris        = excluded.baris,
    sampel       = excluded.sampel,
    versi        = excluded.versi,
    diambil_pada = now();
  return v;
end $$;

-- -----------------------------------------------------------------------------
-- 4. HAK AKSES
--    Tabel: peran kunci publik perlu SELECT/INSERT/UPDATE/DELETE (RLS sudah terbuka).
--    Fungsi: hanya yang ber-executable yang boleh dipanggil dari luar; daftar nama
--    diambil otomatis dari pg_proc supaya tidak bisa beda sendiri dengan isinya.
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on all tables    in schema public to anon, authenticated, service_role;
grant usage,  select                on all sequences in schema public to anon, authenticated, service_role;

do $hak$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('grant execute on function %s to anon, authenticated, service_role', r.sig);
  end loop;
end
$hak$;

commit;

-- Selesai. Cek cepat di SQL Editor: `select * from public.kp_stats();` harus membalas
-- total 0 pada basis data yang masih kosong — bukan error "does not exist".
