-- Supabase (Postgres) staging schema for Student Database Management
-- Run this in Supabase SQL editor for your project

-- Admins
create table if not exists admins (
  id bigserial primary key,
  username text unique not null,
  password text not null,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Forms
create table if not exists forms (
  id bigserial primary key,
  form_id text unique not null,
  form_name text not null,
  form_description text,
  form_fields jsonb not null,
  qr_code_data text,
  is_active boolean default true,
  created_by bigint references admins(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_forms_form_id on forms(form_id);
create index if not exists idx_forms_is_active on forms(is_active);

-- Submissions
create table if not exists form_submissions (
  id bigserial primary key,
  submission_id text unique not null,
  form_id text not null,
  admission_number text,
  submission_data jsonb not null,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  submitted_by text check (submitted_by in ('student','admin')) default 'student',
  submitted_by_admin bigint references admins(id) on delete set null,
  reviewed_by bigint references admins(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_submissions_submission_id on form_submissions(submission_id);
create index if not exists idx_submissions_form_id on form_submissions(form_id);
create index if not exists idx_submissions_status on form_submissions(status);
create index if not exists idx_submissions_adm_no on form_submissions(admission_number);
create index if not exists idx_submissions_created_at on form_submissions(created_at);

-- Audit logs
create table if not exists audit_logs (
  id bigserial primary key,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  admin_id bigint references admins(id) on delete set null,
  details jsonb,
  ip_address text,
  created_at timestamptz default now()
);
create index if not exists idx_audit_action on audit_logs(action_type);
create index if not exists idx_audit_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_created on audit_logs(created_at);


