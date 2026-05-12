# Rayyan's Sesame Street Party RSVP

Mobile-first RSVP web app for Rayyan's Sesame Street-themed 2nd birthday party. Parents scan a QR code, RSVP in under 30 seconds, get an "Add to Calendar" / "Get directions" link on the way out, and the host gets a real-time email alert plus a private dashboard. No app to install, no account to create on the parent side.

## What it does

**For parents (one screen → 30 seconds):**

- Scan QR → land on a single-page React app on their phone.
- "Yes, we'll be there!" or "Sorry, can't make it."
- If yes: name, contact, child's name, jumper / non-jumper toggle, optional additional guests with their own toggles, optional notes.
- If no: just name (contact and message to Rayyan are optional).
- On submit, the app sets an HttpOnly cookie tying the parent to their RSVP. Coming back later (same device / browser) shows a banner: "You've already RSVP'd as attending. Edit my RSVP." Tapping it pre-fills the form so they can change anything — same row gets updated, no duplicates.
- After a yes: confirmation card with their submitted attendees, an "Add to calendar" link, and a "Get directions" link (when location is set).

**For the host (`/admin`):**

- Bookmark `https://YOUR-URL.railway.app/admin`.
- Password sign-in (your `ADMIN_PASSWORD`) sets a 30-day session cookie on that device.
- See running totals (saying yes / saying no / total people / total jumpers), every response newest-first, and per-row **Edit** and **Delete** buttons.
- "Email me when an RSVP is submitted" card lets you set / clear the alert recipient on the fly without redeploying.
- Log out clears the session.

## Tech stack and external services

| Layer | Tech | Why |
| --- | --- | --- |
| Frontend | React 18 + Vite + Tailwind CSS | Fast mobile build, ~50 KB gzipped JS, Sesame Street themed component system |
| Server | Express (Node.js) | Serves the built frontend and API routes from a single persistent process |
| API | `api/rsvp.js`, `api/admin.js` | Two route handlers mounted by the Express server |
| Validation | [Zod](https://zod.dev/) | Strict schema on every public POST — rejects unknown keys, type-checks attendees, enforces length caps |
| Database | Postgres (Railway) | Auto-provisioned; `DATABASE_URL` auto-injected by Railway |
| DB driver | [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless) | HTTP-tunnelled Postgres |
| Email alerts (optional) | [Resend](https://resend.com/) | Sends "New RSVP" / "Updated RSVP" emails to the host |
| Hosting / CI | [Railway](https://railway.app/) | Auto-deploys on push, env-var management |
| Calendar file | Static `text/calendar` file at `/rayyan-birthday.ics` | Served `inline` so iOS Safari pops the native "Add Event" sheet directly |
| Maps | Google Maps universal search URL | One link works on iOS, Android, and desktop |

The only **required** external services are Railway + Postgres. Resend is optional — disable it by leaving `RESEND_API_KEY` unset and the rest of the app works exactly the same.

## Deploy (Railway)

### 1. Create a Railway project

1. Sign in to [railway.app](https://railway.app).
2. **New Project** → **Deploy from GitHub repo** → pick this repository.

### 2. Add a Postgres database

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**.
2. Railway automatically injects `DATABASE_URL` into your app — nothing else needed.

The app creates its `rsvps` and `app_settings` tables on the first request — no SQL to run yourself.

### 3. Set environment variables

In your Railway service **Variables** tab, add:

| Key | Required? | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Yes | Sign-in password for `/admin` |
| `RESEND_API_KEY` | No | Sends email alerts to the host (get from resend.com) |

`DATABASE_URL` is injected automatically by the Railway Postgres plugin.

### 4. Deploy

Railway runs `npm run build` then `npm start` automatically on every push. You'll get a URL like `rayyan-birthday.up.railway.app`.

### 5. View RSVPs

Open `https://YOUR-URL.railway.app/admin`. Enter your `ADMIN_PASSWORD` — the dashboard remembers you on that device for 30 days via an HttpOnly cookie.

### 6. (Optional) Email alerts

1. Sign up at [resend.com](https://resend.com) (free tier). Sign up with the email you want alerts to land in — Resend's shared `onboarding@resend.dev` sender can only deliver to the account owner's email until you verify your own domain.
2. Create an API key in the Resend dashboard.
3. Add `RESEND_API_KEY` to Railway environment variables and redeploy.
4. At `/admin`, enter your email in the **"Email me when an RSVP is submitted"** card and click **Save**.

### 7. Generate the QR code

Point a QR code at the production URL:

```bash
npx qrcode "https://YOUR-URL.railway.app" -o rayyan-rsvp.png
```

Or paste the URL into [qr-code-generator.com](https://www.qr-code-generator.com/) and download the PNG. Print at ~2 inches or larger for reliable scans.

## Run locally

```bash
npm install
npm run dev       # Vite dev server for the frontend (no API)
```

To run the full stack locally, create a `.env` file with `DATABASE_URL` and `ADMIN_PASSWORD` (see `.env.example`), then:

```bash
npm run build
npm start
```

## Project layout

```
api/
  rsvp.js                  GET (cookie-keyed lookup) + POST (Zod-validated upsert)
  admin.js                 /admin dashboard: login, list, edit, delete, logout, settings
server.js                  Express server — mounts API routes, serves built frontend
src/
  App.jsx                  screen router; calls GET /api/rsvp on mount to detect existing RSVP
  main.jsx
  index.css                Tailwind + Sesame Street theme variables + component styles
  partyDetails.js          party info (date, location, host, waiver URL)
  components/
    BrickHeader.jsx        colored banner — emoji or character images
    BrickButton.jsx        chunky CTA button with drop shadow
    Input.jsx              labeled input / textarea
    AttendeeRow.jsx        name + jumper toggle, removable
    JumperToggle.jsx       segmented control
  screens/
    Welcome.jsx            invite + edit-banner + Yes/No CTAs
    RSVPForm.jsx           "yes" form, pre-fills from existingRsvp when editing
    Declined.jsx           "no" form, pre-fills from existingRsvp when editing
    ThankYou.jsx           recap + add-to-calendar + map link
public/
  rayyan-birthday.ics      static iCalendar file linked from the "Add to calendar" links
  elmo-44.png              character images (transparent PNG)
  cookie-monster.png
  abby.png
  bigbird-removebg-preview.png
  bert-ernie.png
railway.toml               tells Railway to run `node server.js` instead of static serving
```

## Database schema

Auto-created on first request — no manual SQL needed:

```sql
CREATE TABLE rsvps (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  attending BOOLEAN NOT NULL,
  parent_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  child_name TEXT,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_people INT NOT NULL DEFAULT 0,
  total_jumpers INT NOT NULL DEFAULT 0,
  notes TEXT,
  message_to_rayyan TEXT,
  edit_token TEXT
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## How the flows are wired

**Parent identity (returning visits / edits)**

- On successful POST to `/api/rsvp`, the server generates a 48-hex-char `edit_token`, stores it on the row, and sets it as `Set-Cookie: birthday_rsvp=…; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1y`.
- On any subsequent visit, the SPA fetches `GET /api/rsvp`. The server returns the matching row or `{ rsvp: null }`.
- If a row is returned, `App.jsx` shows the edit banner on Welcome and pre-fills the form. POST with that cookie present **updates** the existing row instead of inserting — no duplicate RSVPs from the same device.

**Admin auth**

- Login form posts the password to `/admin`. The server compares it with `crypto.timingSafeEqual` over SHA-256 digests.
- On match, the server sets `Set-Cookie: birthday_admin=<HMAC>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=30d`. Rotating `ADMIN_PASSWORD` invalidates every existing admin session automatically.

**Email alerts**

- After a successful insert/update, the server fires `notifyHost(...)` as a background promise (fire-and-forget). The HTTP response goes out immediately.
- If `RESEND_API_KEY` isn't configured, `notifyHost` short-circuits immediately. The admin card shows a warning so the host knows alerts are off.

## Security notes

- **Cookies:** Both `birthday_admin` and `birthday_rsvp` are `HttpOnly`, `Secure`, and `SameSite=Strict`.
- **No PII in cookies:** the admin cookie holds an HMAC; the parent cookie holds an opaque random token.
- **No client-side secrets:** `RESEND_API_KEY` only lives in Railway env vars; the front-end bundle never sees it.
- **Password rotation:** changing `ADMIN_PASSWORD` invalidates all admin sessions automatically.
- **Public POST surface:** `/api/rsvp` is unauthenticated by design, but Zod + length caps + attendees-cap-of-20 bound the input.

## Dependencies

- [`react`](https://react.dev/), [`react-dom`](https://react.dev/) — UI runtime
- [`vite`](https://vitejs.dev/), [`@vitejs/plugin-react`](https://vitejs.dev/) — build / dev server
- [`tailwindcss`](https://tailwindcss.com/), [`postcss`](https://postcss.org/), [`autoprefixer`](https://github.com/postcss/autoprefixer) — styling
- [`express`](https://expressjs.com/) — production server
- [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless) — Postgres driver
- [`zod`](https://zod.dev/) — request validation

External SaaS: **Railway** (hosting), **Postgres** (database), **Resend** (optional email), **Google Maps** (directions link).
