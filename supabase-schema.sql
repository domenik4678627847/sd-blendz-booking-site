create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  service text not null,
  price text not null,
  duration_minutes integer not null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  booked_at timestamptz not null default timezone('utc', now())
);

create index if not exists bookings_appointment_date_idx
  on public.bookings (appointment_date, start_time);

