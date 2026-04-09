# S&D Blendz Live Booking Setup

This project is now prepared for a real backend, but GitHub Pages alone cannot store shared bookings or send notification emails.

## What changes when we go live

- The public website can still look the same.
- The booking form should be hosted on Netlify so the serverless functions can run.
- Bookings will be stored in Supabase instead of each visitor's browser.
- Resend will email you whenever a new appointment is booked.

## Accounts you need

1. Supabase account
2. Resend account
3. Netlify account

## Environment variables

Copy `.env.example` into Netlify environment variables and fill in the real values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NOTIFY_EMAIL`

## Database setup

Run the SQL in `supabase-schema.sql` inside the Supabase SQL editor.

## Deploy steps

1. Import this GitHub repo into Netlify.
2. Leave the publish directory as `.`.
3. Netlify will use `netlify.toml` automatically.
4. Add the environment variables from above.
5. Deploy the site.

## After deployment

- The booking form will call:
  - `/api/availability`
  - `/api/bookings`
- Expired bookings will stop appearing once their end time has passed.
- New bookings will trigger an email notification to the configured address.
