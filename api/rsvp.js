import postgres from 'postgres';
import { z } from 'zod';
import crypto from 'node:crypto';

let _sql;
function getSql() {
  if (_sql) return _sql;
  const conn =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;
  if (!conn) {
    throw new Error('No DATABASE_URL set. Add a Postgres database in Railway.');
  }
  _sql = postgres(conn);
  return _sql;
}

const COOKIE_NAME = 'birthday_rsvp';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      attending BOOLEAN NOT NULL,
      parent_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      child_name TEXT,
      attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
      total_people INT NOT NULL DEFAULT 0,
      total_jumpers INT NOT NULL DEFAULT 0,
      notes TEXT,
      message_to_rayyan TEXT
    )
  `;
  await sql`ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS edit_token TEXT`;
  await sql`ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`;
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;
  schemaReady = true;
}

function parseCookies(header) {
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function readEditToken(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

function setEditCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );
}

function clearEditCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  );
}

function bad(res, status, message) {
  res.status(status).json({ error: message });
}

// --- Validation -------------------------------------------------------------

// Allow nullable free-text fields that may arrive as string, null, or omitted.
// `coerce` is intentionally not used — we want the shape enforced, not guessed.
const nullableText = (max) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((v) => (v == null || v === '' ? null : v));

const AttendeeSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    isJumper: z.boolean(),
  })
  .strict();

const RsvpSchema = z
  .object({
    attending: z.boolean(),
    parentName: z.string().trim().min(1, 'Parent name is required.').max(200),
    contact: nullableText(200),
    childName: nullableText(200),
    attendees: z.array(AttendeeSchema).max(20).optional().default([]),
    notes: nullableText(2000),
    messageToRayyan: nullableText(2000),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.attending) {
      if (!data.contact || !data.contact.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Phone or email is required.',
          path: ['contact'],
        });
      }
      if (!data.childName || !data.childName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Child's name is required.",
          path: ['childName'],
        });
      }
      if (!data.attendees || data.attendees.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one attendee is required.',
          path: ['attendees'],
        });
      }
    }
  });

function firstIssueMessage(error) {
  const issue = error && error.issues && error.issues[0];
  return (issue && issue.message) || 'Invalid request.';
}

// --- Helpers ----------------------------------------------------------------

function toClientRsvp(row) {
  if (!row) return null;
  return {
    id: row.id,
    attending: !!row.attending,
    parentName: row.parent_name || '',
    contact: row.contact || '',
    childName: row.child_name || '',
    attendees: Array.isArray(row.attendees) ? row.attendees : [],
    notes: row.notes || '',
    messageToRayyan: row.message_to_rayyan || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadByToken(sql, token) {
  if (!token) return null;
  const rows = await sql`
    SELECT id, created_at, updated_at, attending, parent_name, contact,
           child_name, attendees, notes, message_to_rayyan
    FROM rsvps WHERE edit_token = ${token} LIMIT 1
  `;
  return rows[0] || null;
}

async function getNotificationEmail(sql) {
  try {
    const rows = await sql`SELECT value FROM app_settings WHERE key = 'notification_email' LIMIT 1`;
    const v = rows[0] && rows[0].value;
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

async function notifyHost(sql, rsvp, mode) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const email = await getNotificationEmail(sql);
  if (!email) return;

  const attending = rsvp.attending ? 'Yes' : 'No';
  const attendeesList =
    Array.isArray(rsvp.attendees) && rsvp.attendees.length
      ? rsvp.attendees
          .map((a) => `${a.name}${a.isJumper ? ' (child)' : ' (adult)'}`)
          .join(', ')
      : '—';

  const subject =
    mode === 'updated'
      ? `Updated RSVP — ${rsvp.parentName} (${attending})`
      : `New RSVP — ${rsvp.parentName} (${attending})`;

  const text = [
    `Parent: ${rsvp.parentName}`,
    `Contact: ${rsvp.contact || '—'}`,
    `Attending: ${attending}`,
    `Child: ${rsvp.childName || '—'}`,
    `Attendees: ${attendeesList}`,
    `Notes: ${rsvp.notes || '—'}`,
    `Message to Rayyan: ${rsvp.messageToRayyan || '—'}`,
  ].join('\n');

  const esc = (s) =>
    String(s == null ? '' : s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
      <h2 style="color:#0055BF;margin:0 0 8px">${esc(subject)}</h2>
      <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
        <tr><td><b>Parent</b></td><td>${esc(rsvp.parentName)}</td></tr>
        <tr><td><b>Contact</b></td><td>${esc(rsvp.contact) || '—'}</td></tr>
        <tr><td><b>Attending</b></td><td>${attending}</td></tr>
        <tr><td><b>Child</b></td><td>${esc(rsvp.childName) || '—'}</td></tr>
        <tr><td><b>Attendees</b></td><td>${esc(attendeesList)}</td></tr>
        <tr><td><b>Notes</b></td><td>${esc(rsvp.notes) || '—'}</td></tr>
        <tr><td><b>Message</b></td><td>${esc(rsvp.messageToRayyan) || '—'}</td></tr>
      </table>
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Rayyan's Party RSVP <onboarding@resend.dev>",
        to: [email],
        subject,
        text,
        html,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('Resend non-OK:', r.status, errText);
    }
  } catch (err) {
    console.error('Resend request failed:', err);
  }
}

// --- Handler ----------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      await ensureSchema();
      const sql = getSql();
      const token = readEditToken(req);
      if (!token) return res.status(200).json({ rsvp: null });
      const row = await loadByToken(sql, token);
      if (!row) {
        clearEditCookie(res);
        return res.status(200).json({ rsvp: null });
      }
      return res.status(200).json({ rsvp: toClientRsvp(row) });
    } catch (err) {
      console.error('RSVP lookup failed:', err);
      return res.status(200).json({ rsvp: null });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return bad(res, 405, 'Method not allowed.');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return bad(res, 400, 'Invalid JSON body.');
    }
  }

  const parsed = RsvpSchema.safeParse(body);
  if (!parsed.success) {
    return bad(res, 400, firstIssueMessage(parsed.error));
  }
  const input = parsed.data;

  const attending = input.attending;
  const attendees = (input.attendees || []).map((a) => ({
    name: a.name.trim(),
    isJumper: a.isJumper,
  }));
  const totalPeople = attendees.length;
  const totalJumpers = attendees.filter((a) => a.isJumper).length;

  const parentName = input.parentName.trim();
  const contact = input.contact ? input.contact.trim() : '';
  const childName = input.childName ? input.childName.trim() : null;
  const notes = input.notes ? input.notes.trim() : null;
  const messageToRayyan = input.messageToRayyan ? input.messageToRayyan.trim() : null;
  const attendeesJson = JSON.stringify(attendees);

  try {
    await ensureSchema();
    const sql = getSql();

    const existingToken = readEditToken(req);
    const existingRow = await loadByToken(sql, existingToken);

    let mode;
    let savedRow;

    if (existingRow) {
      const rows = await sql`
        UPDATE rsvps SET
          attending = ${attending},
          parent_name = ${parentName},
          contact = ${contact},
          child_name = ${childName},
          attendees = ${attendeesJson}::jsonb,
          total_people = ${totalPeople},
          total_jumpers = ${totalJumpers},
          notes = ${notes},
          message_to_rayyan = ${messageToRayyan},
          updated_at = NOW()
        WHERE id = ${existingRow.id}
        RETURNING id, created_at, updated_at, attending, parent_name, contact,
                  child_name, attendees, notes, message_to_rayyan
      `;
      savedRow = rows[0];
      mode = 'updated';
      setEditCookie(res, existingToken);
    } else {
      const newToken = crypto.randomBytes(24).toString('hex');
      const rows = await sql`
        INSERT INTO rsvps
          (attending, parent_name, contact, child_name, attendees,
           total_people, total_jumpers, notes, message_to_rayyan, edit_token)
        VALUES
          (${attending}, ${parentName}, ${contact}, ${childName},
           ${attendeesJson}::jsonb, ${totalPeople}, ${totalJumpers},
           ${notes}, ${messageToRayyan}, ${newToken})
        RETURNING id, created_at, updated_at, attending, parent_name, contact,
                  child_name, attendees, notes, message_to_rayyan
      `;
      savedRow = rows[0];
      mode = 'created';
      setEditCookie(res, newToken);
    }

    const clientRsvp = toClientRsvp(savedRow);

    notifyHost(sql, clientRsvp, mode).catch((err) =>
      console.error('notify failed:', err)
    );

    return res.status(200).json({ success: true, mode, rsvp: clientRsvp });
  } catch (err) {
    console.error('RSVP write failed:', err);
    return bad(res, 500, 'Could not save RSVP. Please try again or text the host.');
  }
}
