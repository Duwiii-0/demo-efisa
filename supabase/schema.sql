-- EFISA Supabase schema
-- Cara pakai: Supabase Dashboard > SQL Editor > paste seluruh file ini > Run
-- Aman dijalankan ulang (idempotent).

-- 1) Users (akun demo, password hash sha256 email|password ala server/security.js)
create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null,
  job_title text,
  division text,
  password_hash text not null,
  is_demo_login boolean not null default false
);

-- 2) FSAs (documents/approvals/history disimpan sebagai JSONB
--    agar logika validasi di server/fsa.js tidak berubah)
create table if not exists public.fsas (
  id uuid primary key,
  fsa_number text not null unique,
  ppap_level int not null,
  part_number text not null,
  material_description text not null,
  drawing_revision int not null default 0,
  sourcing_volume int,
  supplier_id text not null,
  supplier_other text not null default '',
  category_id text not null,
  category_other text not null default '',
  reason_id text not null,
  reason_other text not null default '',
  date_of_sample_submission text not null,
  sample_quantity int not null default 0,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approval_status text not null default 'waiting_approval_spr',
  completed_at timestamptz,
  verifier_dm_id text,
  verifier_ft_id text,
  documents jsonb not null default '{"productPhoto": null}',
  approvals jsonb not null default '{}',
  created_by_id text,
  history jsonb not null default '[]'
);
create index if not exists fsas_status_idx on public.fsas (approval_status);
create index if not exists fsas_supplier_idx on public.fsas (supplier_id);
create index if not exists fsas_created_idx on public.fsas (created_at desc);

-- 3) Sessions (pengganti Map in-memory agar aman di Vercel serverless)
-- expires_at = 7 hari setelah login. Session kedaluwarsa otomatis ditolak.
create table if not exists public.sessions (
  token text primary key,
  user_id text not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Migrasi untuk DB yang sudah ada sebelum kolom expires_at ditambah:
alter table public.sessions
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days');

-- 4) Materials: master (hijau) vs custom/baru (kuning).
-- Hijau HANYA jika ada di master_materials. custom_materials tetap kuning.
-- material_description boleh '' karena master seed awal hanya berisi part number.
create table if not exists public.master_materials (
  part_number text primary key,
  material_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.custom_materials (
  part_number text primary key,
  material_description text not null default '',
  first_fsa_id uuid references public.fsas (id) on delete set null,
  created_by_id text references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists master_materials_desc_idx on public.master_materials (material_description);
create index if not exists custom_materials_created_idx on public.custom_materials (created_at desc);

-- 5) Storage bucket untuk upload (product photo + PPAP, maks 10MB/file)
insert into storage.buckets (id, name, public)
values ('efisa-uploads', 'efisa-uploads', false)
on conflict (id) do nothing;

-- Migrasi untuk DB yang sudah ada sebelum kolom supplier_other ditambah:
alter table public.fsas
  add column if not exists supplier_other text not null default '';

-- Migrasi nama: documents.appearance -> documents.productPhoto (hanya rename).
update public.fsas
set documents = (documents - 'appearance') || jsonb_build_object('productPhoto', documents -> 'appearance')
where documents ? 'appearance' and not (documents ? 'productPhoto');

-- Migrasi untuk status draft (procurement bisa save draft tanpa validasi):
-- draft menyimpan field yang belum lengkap sebagai NULL / string kosong.
alter table public.fsas alter column ppap_level drop not null;
alter table public.fsas alter column part_number drop not null;
alter table public.fsas alter column material_description drop not null;
alter table public.fsas alter column drawing_revision drop not null;
alter table public.fsas alter column supplier_id drop not null;
alter table public.fsas alter column category_id drop not null;
alter table public.fsas alter column reason_id drop not null;
alter table public.fsas alter column date_of_sample_submission drop not null;
alter table public.fsas alter column sample_quantity drop not null;
-- Migrasi untuk timestamp submit to approval:
alter table public.fsas add column if not exists submitted_at timestamptz;
-- Backfill: FSA non-draft yang belum punya submitted_at dianggap ter-submit saat dibuat.
update public.fsas set submitted_at = created_at where submitted_at is null and approval_status <> 'draft';
-- Kebijakan RLS: matikan RLS untuk demo agar service_role bisa baca/tulis,
-- frontend TIDAK akses langsung, semua lewat Express /api (auth Bearer).
alter table public.users disable row level security;
alter table public.fsas disable row level security;
alter table public.sessions disable row level security;
alter table public.master_materials disable row level security;
alter table public.custom_materials disable row level security;

-- Kebijakan storage (pakai service_role di backend, jadi tidak butuh policy publik).
-- Jika RLS storage aktif, tambahkan policy ini di Dashboard > Storage > Policies:
-- create policy "service_role full access" on storage.objects
--   for all using (bucket_id = 'efisa-uploads') with check (bucket_id = 'efisa-uploads');
