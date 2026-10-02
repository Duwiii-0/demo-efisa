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

-- 2) FSAs (documents/checklist/approvals/history disimpan sebagai JSONB
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
  category_id text not null,
  category_other text not null default '',
  reason_id text not null,
  reason_other text not null default '',
  date_of_sample_submission text not null,
  sample_quantity int not null default 0,
  created_at timestamptz not null default now(),
  approval_status text not null default 'waiting_approval_spr',
  completed_at timestamptz,
  verifier_dm_id text,
  verifier_ft_id text,
  documents jsonb not null default '{"appearance": null, "ppap": []}',
  checklist jsonb not null default '{}',
  approvals jsonb not null default '{}',
  created_by_id text,
  history jsonb not null default '[]'
);
create index if not exists fsas_status_idx on public.fsas (approval_status);
create index if not exists fsas_supplier_idx on public.fsas (supplier_id);
create index if not exists fsas_created_idx on public.fsas (created_at desc);

-- 3) Sessions (pengganti Map in-memory agar aman di Vercel serverless)
create table if not exists public.sessions (
  token text primary key,
  user_id text not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4) Storage bucket untuk upload (appearance + PPAP, maks 10MB/file)
insert into storage.buckets (id, name, public)
values ('efisa-uploads', 'efisa-uploads', false)
on conflict (id) do nothing;

-- Kebijakan RLS: matikan RLS untuk demo agar service_role bisa baca/tulis,
-- frontend TIDAK akses langsung, semua lewat Express /api (auth Bearer).
alter table public.users disable row level security;
alter table public.fsas disable row level security;
alter table public.sessions disable row level security;

-- Kebijakan storage (pakai service_role di backend, jadi tidak butuh policy publik).
-- Jika RLS storage aktif, tambahkan policy ini di Dashboard > Storage > Policies:
-- create policy "service_role full access" on storage.objects
--   for all using (bucket_id = 'efisa-uploads') with check (bucket_id = 'efisa-uploads');
