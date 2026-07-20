import postgres from 'postgres';
import crypto from 'node:crypto';

let _sql;
let _columnsReady = false;
async function ensureColumns(sql) {
  if (_columnsReady) return;
  try {
    await sql`ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS phone TEXT`;
    await sql`ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS email TEXT`;
    await sql`ALTER TABLE rsvps ALTER COLUMN contact DROP NOT NULL`.catch(() => {});
  } catch { /* table may not exist yet */ }
  _columnsReady = true;
}
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

const ET = 'America/New_York';
const COOKIE_NAME = 'birthday_admin';
const COOKIE_PAYLOAD = 'admin-v1';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function computeToken(password) {
  return crypto
    .createHmac('sha256', password)
    .update(COOKIE_PAYLOAD)
    .digest('hex');
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

function isAuthenticated(req, expected) {
  if (!expected) return false;
  const cookies = parseCookies(req.headers && req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const valid = computeToken(expected);
  if (token.length !== valid.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(valid));
  } catch {
    return false;
  }
}

function safePasswordMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

function setAuthCookie(res, password, secure) {
  const token = computeToken(password);
  const secureAttr = secure ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly${secureAttr}; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  );
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const escapeAttr = escapeHtml;

function fmtDate(d) {
  return new Date(d).toLocaleString('en-US', {
    timeZone: ET,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}


function attendeesHtml(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '<span class="muted">—</span>';
  return rows
    .map((a) => {
      const tag = a.isJumper
        ? '<span class="tag tag-blue">👧 Child</span>'
        : '<span class="tag tag-gray">Adult</span>';
      return `<div class="attendee">${escapeHtml(a.name)} ${tag}</div>`;
    })
    .join('');
}

const STYLES = `
<style>
  :root { --blue:#0055BF; --blue-dark:#003D8A; --green:#237841; --red:#C91A09; --red-dark:#8F1206; --bg:#F5F3EE; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; background: var(--bg); color:#1a1a1a; }
  header { background: var(--blue); color:#fff; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  header h1 { margin:0; font-size:20px; }
  header .sub { opacity:.85; font-size:13px; margin-top:2px; }
  header .head-left { min-width: 0; }
  main { max-width: 1100px; margin: 0 auto; padding: 16px; }
  .totals { display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
  .stat { background:#fff; border-radius:10px; padding:10px 14px; box-shadow:0 1px 0 rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.06); }
  .stat .n { font-size: 22px; font-weight:700; color: var(--blue); }
  .stat .l { font-size: 12px; color:#555; text-transform: uppercase; letter-spacing: .04em; }
  table { width:100%; background:#fff; border-collapse: collapse; border-radius: 10px; overflow: hidden; box-shadow:0 1px 0 rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.06); }
  th, td { text-align:left; padding: 10px 12px; vertical-align: top; border-bottom: 1px solid #eee; font-size: 14px; }
  th { background:#fafaf7; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:#555; }
  tr.no { opacity: .75; }
  tr:last-child td { border-bottom: none; }
  .who { font-weight:600; }
  .muted { color:#888; }
  .small { font-size:12px; }
  .nowrap { white-space: nowrap; }
  .empty { text-align:center; padding: 28px; color:#777; }
  .badge { display:inline-block; padding:2px 8px; border-radius: 9999px; font-size:12px; font-weight:600; }
  .badge-green { background: #e6f4eb; color: var(--green); }
  .badge-gray { background:#eee; color:#555; }
  .tag { display:inline-block; padding:1px 6px; border-radius: 9999px; font-size:11px; font-weight:600; margin-left: 4px; }
  .tag-blue { background: var(--blue); color:#fff; }
  .tag-gray { background:#eee; color:#444; }
  .attendee { padding: 1px 0; }
  .row-actions { display:flex; gap:6px; flex-wrap:wrap; }
  .btn { display:inline-block; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; border: 1px solid transparent; cursor: pointer; text-decoration: none; background: #fff; color: #333; font-family: inherit; }
  .btn-edit { border-color: var(--blue); color: var(--blue); background:#fff; }
  .btn-edit:hover { background: #eef3fb; }
  .btn-delete { border-color: var(--red); color: var(--red); background:#fff; }
  .btn-delete:hover { background: #fbeceb; }
  .btn-primary { background: var(--blue); color:#fff; border-color: var(--blue); padding: 12px 18px; font-size: 15px; width: 100%; }
  .btn-primary:hover { background: var(--blue-dark); border-color: var(--blue-dark); }
  .btn-danger { background: var(--red); color:#fff; border-color: var(--red); padding: 10px 16px; font-size: 14px; }
  .btn-danger:hover { background: var(--red-dark); border-color: var(--red-dark); }
  .btn-link { background: transparent; border: none; color: var(--blue); font-weight: 600; padding: 10px 4px; font-size: 14px; }
  .btn-ghost { background: rgba(255,255,255,.14); color:#fff; border: 1px solid rgba(255,255,255,.35); padding: 6px 12px; font-size: 13px; border-radius: 8px; cursor: pointer; font-family: inherit; }
  .btn-ghost:hover { background: rgba(255,255,255,.22); }
  footer { text-align:center; color:#888; padding: 18px; font-size: 12px; }
  .back-link { color:#fff; text-decoration: underline; opacity:.9; font-size: 13px; }
  .card { background:#fff; border-radius: 10px; padding: 18px; box-shadow:0 1px 0 rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.06); margin-bottom: 14px; }
  label { display:block; font-weight:600; font-size: 13px; margin: 12px 0 6px; color:#2b2b2b; }
  label:first-child { margin-top: 0; }
  input[type=text], input[type=email], input[type=password], input[type=tel], textarea, select { width:100%; padding: 10px 12px; border: 2px solid #d9d5cb; border-radius: 8px; font: inherit; font-size: 16px; background:#fff; }
  input[type=text]:focus, input[type=email]:focus, input[type=password]:focus, input[type=tel]:focus, textarea:focus, select:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(0,85,191,.15); }
  textarea { resize: vertical; min-height: 60px; }
  .attendee-row { display:grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; margin-bottom: 8px; }
  .attendee-row select { width: auto; padding: 8px 10px; font-size: 14px; }
  .attendee-row .remove-btn { background:#fff; border:1px solid #d9d5cb; color: var(--red); padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit; }
  .add-attendee { background:#fff; border: 2px dashed var(--blue); color: var(--blue); padding: 10px; border-radius: 8px; width: 100%; cursor: pointer; font-weight: 600; margin-top: 4px; font-family: inherit; font-size: 14px; }
  .actions { display:flex; gap: 10px; align-items: center; margin-top: 16px; }
  .flash { padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 14px; }
  .flash-success { background:#e6f4eb; color: var(--green); border: 1px solid #c8e2d1; }
  .flash-error { background:#fbeceb; color: var(--red); border: 1px solid #f3c7c3; }
  .login-wrap { max-width: 420px; margin: 0 auto; padding: 24px 16px; }
  .login-title { display: block; font-weight: 700; font-family: 'Fredoka', system-ui, sans-serif; font-size: 22px; color: var(--blue); margin: 4px 0 12px; }
  .login-sub { color:#555; font-size: 14px; margin-bottom: 16px; }
  .tag-red { background: #fbeaea; color: var(--red); }
  .invite-item { display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0ede8; gap:8px; }
  .invite-item:last-child { border-bottom:none; }
  .not-responded-card { background:#fff8f0; border:1px solid #f5c6a0; border-left:4px solid #e67e22; border-radius:10px; padding:14px 18px; margin-bottom:14px; }
  .pill-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .radio-group { display:flex; flex-direction:column; gap:10px; margin:10px 0; }
  .radio-group label { display:flex; align-items:center; gap:10px; font-weight:400; margin:0; cursor:pointer; font-size:14px; }
  .radio-group input[type=radio] { width:auto; accent-color: var(--blue); flex-shrink:0; }
  .radio-count { background:#eee; border-radius:9999px; padding:1px 8px; font-size:12px; font-weight:600; color:#555; }
  .btn-sms { background: var(--green); color:#fff; border-color: var(--green); padding: 10px 16px; font-size: 14px; }
  .btn-sms:hover { background: #1a5e32; border-color: #1a5e32; }
  .sms-result-row td { vertical-align:middle; }
  .result-success { color: var(--green); font-weight:600; }
  .result-fail { color: var(--red); font-weight:600; }
  .invitee-status-yes { color: var(--green); font-weight:600; font-size:12px; }
  .invitee-status-no { color:#888; font-weight:600; font-size:12px; }
  .invitee-status-pending { color:#b06000; font-weight:600; font-size:12px; }
  @media (max-width: 640px) {
    th, td { font-size: 13px; padding: 8px; }
    .stat .n { font-size: 18px; }
    header { padding: 14px 16px; }
    header h1 { font-size: 17px; }
  }
</style>
`;

function loginPage({ error }) {
  const errHtml = error ? `<div class="flash flash-error">${escapeHtml(error)}</div>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Admin sign-in · Rayyan's Party</title>
${STYLES}
</head>
<body>
<header>
  <div class="head-left">
    <h1>Rayyan's Party Admin</h1>
    <div class="sub">Sign in to view RSVPs</div>
  </div>
</header>
<main>
  <div class="login-wrap">
    ${errHtml}
    <form method="post" action="/admin" class="card" autocomplete="off">
      <span class="login-title">Enter admin password</span>
      <div class="login-sub">Match the <code>ADMIN_PASSWORD</code> you set in Vercel.</div>
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus required autocomplete="current-password" />
      <div class="actions">
        <button type="submit" class="btn btn-primary">Sign in</button>
      </div>
    </form>
  </div>
</main>
</body>
</html>`;
}

function listPage({ rows, totals, flash, settings, resendConfigured, inviteList, notResponded, textbeltConfigured }) {
  const flashHtml = flash
    ? `<div class="flash flash-${flash.type}">${escapeHtml(flash.message)}</div>`
    : '';

  const notifEmail = (settings && settings.notification_email) || '';
  const notifStatus = !resendConfigured
    ? '<span class="muted small">⚠️ Set the <code>RESEND_API_KEY</code> env var in Railway to enable email alerts.</span>'
    : notifEmail
      ? `<span class="muted small">Alerts go to <b>${escapeHtml(notifEmail)}</b> when a parent submits or updates an RSVP.</span>`
      : '<span class="muted small">No alerts yet. Enter an email above to start receiving them.</span>';

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="7" class="empty">No RSVPs yet.</td></tr>`
    : rows
        .map(
          (r) => `
        <tr class="${r.attending ? 'yes' : 'no'}">
          <td class="nowrap">${escapeHtml(fmtDate(r.created_at))}</td>
          <td>
            <div class="who">${escapeHtml(r.parent_name)}${r.recognized === false && inviteList.length > 0 ? ' <span class="tag tag-red" title="Not on invite list">🚩 Unknown</span>' : ''}</div>
            ${(r.phone || r.contact) ? `<div class="muted small">📱 ${escapeHtml(r.phone || r.contact)}</div>` : ''}
            ${r.email ? `<div class="muted small">✉️ ${escapeHtml(r.email)}</div>` : ''}
            ${!r.phone && !r.contact && !r.email ? '<span class="muted small">—</span>' : ''}
          </td>
          <td>${
            r.attending
              ? '<span class="badge badge-green">Yes</span>'
              : '<span class="badge badge-gray">No</span>'
          }</td>
          <td>${attendeesHtml(r.attendees)}</td>
          <td>${escapeHtml(r.notes) || '<span class="muted">—</span>'}</td>
          <td>${escapeHtml(r.message_to_rayyan) || '<span class="muted">—</span>'}</td>
          <td>
            <div class="row-actions">
              <a class="btn btn-edit" href="/admin?action=edit&id=${r.id}">Edit</a>
              <form method="post" action="/admin?action=delete&id=${r.id}" style="display:inline" onsubmit="return confirm('Delete this RSVP? This cannot be undone.');">
                <button class="btn btn-delete" type="submit">Delete</button>
              </form>
            </div>
          </td>
        </tr>`
        )
        .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Rayyan's Party RSVPs</title>
${STYLES}
</head>
<body>
<header>
  <div class="head-left">
    <h1>Rayyan's Birthday RSVPs</h1>
    <div class="sub">${rows.length} response${rows.length === 1 ? '' : 's'} · times in Eastern</div>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <a href="/admin?action=add-rsvp" class="btn-ghost" style="text-decoration:none">+ Add RSVP</a>
    <form method="post" action="/admin?action=logout" style="margin:0">
      <button type="submit" class="btn-ghost">Log out</button>
    </form>
  </div>
</header>
<main>
  ${flashHtml}

  <div class="card" style="margin-bottom:14px">
    <b style="font-size:14px">Invite list</b>
    <p class="muted small" style="margin:4px 0 10px">RSVPs from names not on this list are flagged 🚩. Add a phone number to enable text reminders.</p>
    <form method="post" action="/admin?action=add-invite" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <input type="text" name="name" placeholder="Full name, e.g. Sarah Johnson" style="flex:1 1 180px;font-size:14px;padding:8px 10px" required />
      <input type="text" name="phone" placeholder="Phone (optional)" style="flex:1 1 150px;font-size:14px;padding:8px 10px" />
      <button type="submit" class="btn btn-edit" style="white-space:nowrap">Add</button>
    </form>
    ${inviteList.length === 0
      ? '<p class="muted small">No names added yet.</p>'
      : `<table style="margin-top:4px">
          <thead><tr><th>Name</th><th>Phone</th><th>RSVP</th><th></th></tr></thead>
          <tbody>${inviteList.map((inv) => `
            <tr>
              <td style="font-size:14px">${escapeHtml(inv.name)}</td>
              <td style="font-size:14px">${inv.phone ? escapeHtml(inv.phone) : '<span class="muted">—</span>'}</td>
              <td>${
                inv.status === 'yes'
                  ? '<span class="invitee-status-yes">✓ Yes</span>'
                  : inv.status === 'no'
                  ? '<span class="invitee-status-no">✗ No</span>'
                  : '<span class="invitee-status-pending">⏳ Pending</span>'
              }</td>
              <td>
                <form method="post" action="/admin?action=remove-invite" style="margin:0">
                  <input type="hidden" name="name" value="${escapeAttr(inv.name)}" />
                  <button class="btn btn-delete" style="padding:3px 8px;font-size:11px" type="submit">Remove</button>
                </form>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`
    }
  </div>

  <div class="card" style="margin-bottom:14px">
    <form method="post" action="/admin?action=save-settings" style="margin:0">
      <label for="notification_email" style="margin-top:0">Email me when an RSVP is submitted</label>
      <div style="display:flex;gap:8px;align-items:stretch;flex-wrap:wrap">
        <input type="email" id="notification_email" name="notification_email" value="${escapeAttr(notifEmail)}" placeholder="you@example.com" style="flex:1 1 220px;min-width:180px" />
        <button type="submit" class="btn btn-edit" style="padding:10px 14px;font-size:14px">Save</button>
      </div>
      <div style="margin-top:6px">${notifStatus}</div>
    </form>
  </div>

  ${(function() {
    const recipientList = buildSmsRecipientList(inviteList, rows);
    const smsWarning = !textbeltConfigured
      ? '<div class="flash flash-error" style="margin-top:10px">Set the <code>TEXTBELT_API_KEY</code> env var to enable sending.</div>'
      : '';
    const statusLabel = (s) => s === 'yes' ? 'RSVPd yes' : s === 'no' ? 'RSVPd no' : 'Pending';
    const recipientsHtml = recipientList.length === 0
      ? '<p class="muted small" style="margin:0">No one with a phone number yet.</p>'
      : recipientList.map((r) => `
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-weight:normal">
          <input type="checkbox" name="recipients" value="${escapeAttr(r.phone)}" data-status="${r.status}" checked />
          <span style="flex:1">${escapeHtml(r.name)}</span>
          <span class="muted small">${escapeHtml(r.phone)}</span>
          <span class="muted small" style="width:80px;text-align:right">${statusLabel(r.status)}</span>
        </label>`).join('');
    return `
  <div class="card" style="margin-bottom:14px" id="smsCard">
    <b style="font-size:14px">💬 Send Text Reminders</b>
    ${smsWarning}
    <form method="post" action="/admin?action=send-sms" style="margin-top:10px" onsubmit="return confirm('Send texts to the checked recipients?');">
      <label style="margin-top:0">Recipients (${recipientList.length} with phone)</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" class="btn btn-edit" data-select="all">All</button>
        <button type="button" class="btn btn-edit" data-select="none">None</button>
        <button type="button" class="btn btn-edit" data-select="pending">Not responded</button>
        <button type="button" class="btn btn-edit" data-select="yes">RSVPd yes</button>
      </div>
      <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border,#ddd);border-radius:8px;padding:8px;margin-bottom:10px">
        ${recipientsHtml}
      </div>
      <label>Message</label>
      <textarea name="message" rows="3" placeholder="Hi! Just a reminder about Rayyan's birthday party this Saturday…" required></textarea>
      <div class="actions" style="margin-top:10px">
        <button type="submit" class="btn btn-sms" ${!textbeltConfigured ? 'disabled' : ''}>Send texts</button>
        <span class="muted small">Each text costs ~$0.01 via Textbelt. Uncheck anyone who already got it.</span>
      </div>
    </form>
  </div>
  <script>
  (function () {
    var card = document.getElementById('smsCard');
    if (!card) return;
    var boxes = card.querySelectorAll('input[type=checkbox][name=recipients]');
    Array.prototype.forEach.call(card.querySelectorAll('[data-select]'), function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-select');
        Array.prototype.forEach.call(boxes, function (b) {
          if (mode === 'all') b.checked = true;
          else if (mode === 'none') b.checked = false;
          else b.checked = b.getAttribute('data-status') === mode;
        });
      });
    });
  })();
  </script>`;
  })()}

  <div class="totals">
    <div class="stat"><div class="n">${totals.yes}</div><div class="l">Saying yes</div></div>
    <div class="stat"><div class="n">${totals.no}</div><div class="l">Saying no</div></div>
    <div class="stat"><div class="n">${totals.people}</div><div class="l">Total people</div></div>
    <div class="stat"><div class="n">${totals.jumpers}</div><div class="l">Total children</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>When</th>
        <th>From</th>
        <th>Coming?</th>
        <th>Attendees</th>
        <th>Notes</th>
        <th>Msg to Rayyan</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</main>
<footer>Bookmark /admin — refresh to see the latest.</footer>
</body>
</html>`;
}

function editPage({ row, error }) {
  let initialAttendees = Array.isArray(row.attendees) ? row.attendees : [];
  if (initialAttendees.length === 0 && row.child_name) {
    initialAttendees = [{ name: row.child_name, isJumper: true }];
  }
  const attendeesJson = JSON.stringify(initialAttendees);
  const errHtml = error ? `<div class="flash flash-error">${escapeHtml(error)}</div>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Edit RSVP · Rayyan's Party</title>
${STYLES}
</head>
<body>
<header>
  <div class="head-left">
    <h1>Edit RSVP</h1>
    <div class="sub"><a class="back-link" href="/admin">← Back to all RSVPs</a></div>
  </div>
  <form method="post" action="/admin?action=logout" style="margin:0">
    <button type="submit" class="btn-ghost">Log out</button>
  </form>
</header>
<main>
  ${errHtml}
  <form method="post" action="/admin?action=update&id=${row.id}" id="editForm">
    <div class="card">
      <label for="parent_name">Parent / guardian name</label>
      <input type="text" id="parent_name" name="parent_name" value="${escapeAttr(row.parent_name)}" required />

      <label for="phone">Phone number</label>
      <input type="tel" id="phone" name="phone" value="${escapeAttr(row.phone || row.contact || '')}" placeholder="e.g. 5551234567" />

      <label for="email">Email (optional)</label>
      <input type="email" id="email" name="email" value="${escapeAttr(row.email || '')}" placeholder="you@example.com" />

      <label for="attending">Coming?</label>
      <select id="attending" name="attending">
        <option value="true" ${row.attending ? 'selected' : ''}>Yes</option>
        <option value="false" ${!row.attending ? 'selected' : ''}>No</option>
      </select>

    </div>

    <div class="card">
      <label>Attendees</label>
      <div id="attendees"></div>
      <button type="button" class="add-attendee" id="addAttendee">+ Add another person</button>
      <input type="hidden" name="attendees_json" id="attendeesJson" />
    </div>

    <div class="card">
      <label for="notes">Notes</label>
      <textarea id="notes" name="notes" rows="2">${escapeHtml(row.notes)}</textarea>

      <label for="message_to_rayyan">Message to Rayyan</label>
      <textarea id="message_to_rayyan" name="message_to_rayyan" rows="2">${escapeHtml(row.message_to_rayyan)}</textarea>
    </div>

    <div class="actions">
      <button type="submit" class="btn btn-primary" style="width:auto;padding:10px 16px;font-size:14px;">Save changes</button>
      <a class="btn btn-link" href="/admin">Cancel</a>
    </div>
  </form>
</main>

<script>
(function () {
  var initial = ${attendeesJson};
  var container = document.getElementById('attendees');
  var hidden = document.getElementById('attendeesJson');

  function render(list) {
    container.innerHTML = '';
    list.forEach(function (a, i) {
      var row = document.createElement('div');
      row.className = 'attendee-row';

      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Name';
      nameInput.value = a.name || '';
      nameInput.addEventListener('input', function () {
        list[i].name = nameInput.value;
        sync();
      });

      var jumperSelect = document.createElement('select');
      var optJ = document.createElement('option');
      optJ.value = 'true'; optJ.textContent = '👧 Child';
      var optN = document.createElement('option');
      optN.value = 'false'; optN.textContent = 'Adult';
      jumperSelect.appendChild(optJ);
      jumperSelect.appendChild(optN);
      jumperSelect.value = a.isJumper ? 'true' : 'false';
      jumperSelect.addEventListener('change', function () {
        list[i].isJumper = jumperSelect.value === 'true';
        sync();
      });

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', function () {
        list.splice(i, 1);
        render(list);
      });

      row.appendChild(nameInput);
      row.appendChild(jumperSelect);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
    sync();
  }

  function sync() {
    hidden.value = JSON.stringify(list);
  }

  var list = initial.slice();
  render(list);

  document.getElementById('addAttendee').addEventListener('click', function () {
    list.push({ name: '', isJumper: true });
    render(list);
  });

  document.getElementById('editForm').addEventListener('submit', function () {
    sync();
  });
})();
</script>
</body>
</html>`;
}

function buildSmsRecipientList(inviteList, rsvpRows) {
  const enriched = inviteList.map((inv) => {
    const match = rsvpRows.find((r) => namesMatch(r.parent_name, inv.name));
    return { ...inv, status: match ? (match.attending ? 'yes' : 'no') : 'pending' };
  });
  const fromInviteList = enriched
    .filter((i) => i.phone)
    .map((i) => ({ name: i.name, phone: i.phone, status: i.status }));
  const fromRsvpOnly = rsvpRows
    .filter((r) => r.attending && (r.phone || looksLikePhone(r.contact)) && !inviteList.some((inv) => namesMatch(inv.name, r.parent_name)))
    .map((r) => ({ name: r.parent_name, phone: r.phone || r.contact, status: 'yes' }));
  return [...fromInviteList, ...fromRsvpOnly];
}

async function sendSmsViaTextbelt(phone, message, apiKey) {
  const resp = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message, key: apiKey }),
  });
  if (!resp.ok) throw new Error(`Textbelt HTTP ${resp.status}`);
  return await resp.json();
}

function smsResultPage({ results, message }) {
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;
  const rowsHtml = results.length === 0
    ? `<tr><td colspan="3" class="empty">No recipients were selected.</td></tr>`
    : results.map((r) => `
      <tr class="sms-result-row">
        <td>${escapeHtml(r.name)}</td>
        <td class="muted">${escapeHtml(r.phone)}</td>
        <td>${r.success
          ? '<span class="result-success">Sent</span>'
          : `<span class="result-fail">Failed</span> <span class="muted small">${escapeHtml(r.error || '')}</span>`
        }</td>
      </tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SMS Results · Rayyan's Party</title>
${STYLES}
</head>
<body>
<header>
  <div class="head-left">
    <h1>Text Reminder Results</h1>
    <div class="sub"><a class="back-link" href="/admin">← Back to admin</a></div>
  </div>
</header>
<main>
  <div class="card">
    <b style="font-size:14px">Sent to ${results.length} selected recipient${results.length === 1 ? '' : 's'}</b>
    <p class="muted small" style="margin:6px 0 0">Message: "${escapeHtml(message)}"</p>
  </div>
  <div class="totals" style="margin-bottom:14px">
    <div class="stat"><div class="n">${results.length}</div><div class="l">Total sent</div></div>
    <div class="stat"><div class="n" style="color:var(--green)">${succeeded}</div><div class="l">Delivered</div></div>
    ${failed > 0 ? `<div class="stat"><div class="n" style="color:var(--red)">${failed}</div><div class="l">Failed</div></div>` : ''}
  </div>
  <table>
    <thead>
      <tr><th>Name</th><th>Phone</th><th>Result</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div style="margin-top:14px">
    <a class="btn btn-edit" href="/admin">← Back to admin</a>
  </div>
</main>
</body>
</html>`;
}

function createPage({ error }) {
  const errHtml = error ? `<div class="flash flash-error">${escapeHtml(error)}</div>` : '';
  const attendeesJson = JSON.stringify([{ name: '', isJumper: true }]);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Add RSVP · Rayyan's Party</title>
${STYLES}
</head>
<body>
<header>
  <div class="head-left">
    <h1>Add RSVP manually</h1>
    <div class="sub"><a class="back-link" href="/admin">← Back to all RSVPs</a></div>
  </div>
  <form method="post" action="/admin?action=logout" style="margin:0">
    <button type="submit" class="btn-ghost">Log out</button>
  </form>
</header>
<main>
  ${errHtml}
  <form method="post" action="/admin?action=create" id="createForm">
    <div class="card">
      <label for="parent_name">Parent / guardian name</label>
      <input type="text" id="parent_name" name="parent_name" required autofocus />

      <label for="phone">Phone number</label>
      <input type="tel" id="phone" name="phone" placeholder="e.g. 5551234567" />

      <label for="email">Email (optional)</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" />

      <label for="attending">Coming?</label>
      <select id="attending" name="attending">
        <option value="true" selected>Yes</option>
        <option value="false">No</option>
      </select>
    </div>

    <div class="card">
      <label>Attendees</label>
      <div id="attendees"></div>
      <button type="button" class="add-attendee" id="addAttendee">+ Add another person</button>
      <input type="hidden" name="attendees_json" id="attendeesJson" />
    </div>

    <div class="card">
      <label for="notes">Notes</label>
      <textarea id="notes" name="notes" rows="2"></textarea>
    </div>

    <div class="actions">
      <button type="submit" class="btn btn-primary" style="width:auto;padding:10px 16px;font-size:14px;">Add RSVP</button>
      <a class="btn btn-link" href="/admin">Cancel</a>
    </div>
  </form>
</main>

<script>
(function () {
  var initial = ${attendeesJson};
  var container = document.getElementById('attendees');
  var hidden = document.getElementById('attendeesJson');

  function render(list) {
    container.innerHTML = '';
    list.forEach(function (a, i) {
      var row = document.createElement('div');
      row.className = 'attendee-row';

      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Name';
      nameInput.value = a.name || '';
      nameInput.addEventListener('input', function () { list[i].name = nameInput.value; sync(); });

      var jumperSelect = document.createElement('select');
      var optJ = document.createElement('option'); optJ.value = 'true'; optJ.textContent = '👧 Child';
      var optN = document.createElement('option'); optN.value = 'false'; optN.textContent = 'Adult';
      jumperSelect.appendChild(optJ); jumperSelect.appendChild(optN);
      jumperSelect.value = a.isJumper ? 'true' : 'false';
      jumperSelect.addEventListener('change', function () { list[i].isJumper = jumperSelect.value === 'true'; sync(); });

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button'; removeBtn.className = 'remove-btn'; removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', function () { list.splice(i, 1); render(list); });

      row.appendChild(nameInput); row.appendChild(jumperSelect); row.appendChild(removeBtn);
      container.appendChild(row);
    });
    sync();
  }

  function sync() { hidden.value = JSON.stringify(list); }

  var list = initial.slice();
  render(list);

  document.getElementById('addAttendee').addEventListener('click', function () {
    list.push({ name: '', isJumper: true }); render(list);
  });
  document.getElementById('createForm').addEventListener('submit', function () { sync(); });
})();
</script>
</body>
</html>`;
}

function htmlError(res, status, title, detail) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(
    `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
     <body style="font-family:system-ui;padding:40px;max-width:480px;margin:auto;">
       <h1 style="color:#C91A09;margin:0 0 8px;">${escapeHtml(title)}</h1>
       <p>${escapeHtml(detail || '')}</p>
       <p><a href="/admin">← Back to admin</a></p>
     </body>`
  );
}

async function loadAllRows(sql) {
  try {
    const rows = await sql`
      SELECT id, created_at, attending, parent_name, phone, email, contact, child_name,
             attendees, total_people, total_jumpers, notes, message_to_rayyan, recognized
      FROM rsvps
      ORDER BY created_at DESC
    `;
    return rows;
  } catch (err) {
    if (err && /relation .* does not exist/i.test(err.message || '')) return [];
    throw err;
  }
}

async function ensureSettingsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;
}

async function loadSettings(sql) {
  try {
    const rows = await sql`SELECT key, value FROM app_settings`;
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  } catch (err) {
    if (err && /relation .* does not exist/i.test(err.message || '')) return {};
    throw err;
  }
}

async function saveSetting(sql, key, value) {
  await ensureSettingsTable(sql);
  if (value == null || value === '') {
    await sql`DELETE FROM app_settings WHERE key = ${key}`;
  } else {
    await sql`
      INSERT INTO app_settings (key, value)
      VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
}

async function getInviteList(sql) {
  try {
    const rows = await sql`SELECT value FROM app_settings WHERE key = 'invite_list' LIMIT 1`;
    const v = rows[0] && rows[0].value;
    if (!v) return [];
    const parsed = JSON.parse(v);
    // Normalize: old format was array of strings, new format is array of {name, phone}
    return parsed.map((item) => (typeof item === 'string' ? { name: item, phone: null } : item));
  } catch {
    return [];
  }
}

async function saveInviteList(sql, list) {
  await ensureSettingsTable(sql);
  const value = JSON.stringify(list);
  await sql`
    INSERT INTO app_settings (key, value) VALUES ('invite_list', ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

function nameWords(n) {
  return n.toLowerCase().trim().split(/[\s\-]+/).filter((w) => w.length >= 4);
}

function namesMatch(a, b) {
  if (a.toLowerCase().trim() === b.toLowerCase().trim()) return true;
  const aw = nameWords(a);
  const bw = nameWords(b);
  // Require at least 2 words in common so shared surnames alone don't cause false matches
  const shared = aw.filter((w) => bw.includes(w));
  if (shared.length >= 2) return true;
  // Single-word names: the one word must appear in the other
  if (aw.length === 1 && bw.includes(aw[0])) return true;
  if (bw.length === 1 && aw.includes(bw[0])) return true;
  return false;
}

function looksLikePhone(s) {
  if (!s) return false;
  if (s.includes('@')) return false;
  return s.replace(/\D/g, '').length >= 7;
}

function computeNotResponded(inviteList, rsvpRows) {
  return inviteList
    .filter((inv) => !rsvpRows.some((r) => namesMatch(r.parent_name, inv.name)))
    .map((inv) => inv.name);
}

function computeTotals(rows) {
  return rows.reduce(
    (acc, r) => {
      if (r.attending) {
        acc.yes += 1;
        acc.people += r.total_people || 0;
        acc.jumpers += r.total_jumpers || 0;
      } else {
        acc.no += 1;
      }
      return acc;
    },
    { yes: 0, no: 0, people: 0, jumpers: 0 }
  );
}

async function loadOne(sql, id) {
  const rows = await sql`
    SELECT id, created_at, attending, parent_name, phone, email, contact, child_name,
           attendees, total_people, total_jumpers, notes, message_to_rayyan
    FROM rsvps WHERE id = ${id}
  `;
  return rows[0] || null;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    const params = new URLSearchParams(req.body);
    const out = {};
    for (const [k, v] of params.entries()) {
      if (out[k] === undefined) out[k] = v;
      else if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    }
    return out;
  }
  return req.body;
}

function asStringOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function redirect(res, location, flash) {
  let url = location;
  if (flash) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}flash=${encodeURIComponent(flash.type)}:${encodeURIComponent(flash.message)}`;
  }
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', 'no-store');
  res.status(302).end();
}

function parseFlash(flashQuery) {
  if (!flashQuery) return null;
  const parts = String(flashQuery).split(':');
  if (parts.length < 2) return null;
  const type = parts[0];
  const message = parts.slice(1).join(':');
  if (type !== 'success' && type !== 'error') return null;
  return { type, message };
}

function renderLogin(res, status, error) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(loginPage({ error }));
}

export default async function handler(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return htmlError(
      res,
      500,
      'Admin not configured',
      'Set the ADMIN_PASSWORD env var in Vercel.'
    );
  }

  const q = req.query || {};
  const action = q.action || '';
  const authed = isAuthenticated(req, expected);

  // --- LOGOUT ---
  if (action === 'logout') {
    clearAuthCookie(res);
    return redirect(res, '/admin');
  }

  // --- LOGIN (POST /admin with no action, not yet authed) ---
  if (!authed && req.method === 'POST' && !action) {
    const body = parseBody(req);
    const provided = (body && body.password) || '';
    if (safePasswordMatch(provided, expected)) {
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      setAuthCookie(res, expected, isSecure);
      return redirect(res, '/admin');
    }
    return renderLogin(res, 401, 'Wrong password. Try again.');
  }

  // --- NOT AUTHED: show login page ---
  if (!authed) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return htmlError(res, 405, 'Method not allowed');
    }
    return renderLogin(res, 200, null);
  }

  // --- AUTHED BELOW ---

  // Authenticated user submitted the login form (e.g., browser back/forward cache showing stale login page)
  if (req.method === 'POST' && !action) {
    return redirect(res, '/admin');
  }

  let sql;
  try {
    sql = getSql();
    await ensureColumns(sql);
  } catch (err) {
    return htmlError(res, 500, 'Database not configured', err.message);
  }

  const id = q.id ? Number.parseInt(q.id, 10) : null;

  if (req.method === 'POST' && action === 'add-invite') {
    const body = parseBody(req);
    const name = asStringOrNull(body.name);
    const phone = asStringOrNull(body.phone);
    if (!name) return redirect(res, '/admin', { type: 'error', message: 'Name cannot be empty.' });
    try {
      const list = await getInviteList(sql);
      if (!list.some((i) => i.name === name)) {
        list.push({ name, phone });
        await saveInviteList(sql, list);
      }
      return redirect(res, '/admin', { type: 'success', message: `Added "${name}" to invite list.` });
    } catch (err) {
      return htmlError(res, 500, 'Save failed', err.message);
    }
  }

  if (req.method === 'POST' && action === 'remove-invite') {
    const body = parseBody(req);
    const name = asStringOrNull(body.name);
    try {
      const list = await getInviteList(sql);
      await saveInviteList(sql, list.filter((i) => i.name !== name));
      return redirect(res, '/admin', { type: 'success', message: `Removed "${name}" from invite list.` });
    } catch (err) {
      return htmlError(res, 500, 'Save failed', err.message);
    }
  }

  if (req.method === 'POST' && action === 'save-settings') {
    const body = parseBody(req);
    const rawEmail = asStringOrNull(body.notification_email);
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return redirect(res, '/admin', {
        type: 'error',
        message: 'Enter a valid email address.',
      });
    }
    try {
      await saveSetting(sql, 'notification_email', rawEmail);
      return redirect(res, '/admin', {
        type: 'success',
        message: rawEmail
          ? 'Notification email saved.'
          : 'Notification email cleared.',
      });
    } catch (err) {
      console.error('Save settings failed:', err);
      return htmlError(res, 500, 'Save failed', err.message);
    }
  }

  if (req.method === 'POST' && action === 'delete') {
    if (!id || Number.isNaN(id)) return htmlError(res, 400, 'Bad request', 'Missing id.');
    try {
      await sql`DELETE FROM rsvps WHERE id = ${id}`;
      return redirect(res, '/admin', {
        type: 'success',
        message: 'RSVP deleted.',
      });
    } catch (err) {
      console.error('Delete failed:', err);
      return htmlError(res, 500, 'Delete failed', err.message);
    }
  }

  if (req.method === 'POST' && action === 'update') {
    if (!id || Number.isNaN(id)) return htmlError(res, 400, 'Bad request', 'Missing id.');
    const body = parseBody(req);

    const parentName = asStringOrNull(body.parent_name);
    if (!parentName) {
      const row = await loadOne(sql, id);
      if (!row) return htmlError(res, 404, 'RSVP not found');
      const merged = { ...row, parent_name: body.parent_name || '' };
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(400).send(
        editPage({ row: merged, error: 'Parent name is required.' })
      );
    }

    const attending = String(body.attending) === 'true';
    const phone = asStringOrNull(body.phone);
    const email = asStringOrNull(body.email);
    const notes = asStringOrNull(body.notes);
    const messageToRayyan = asStringOrNull(body.message_to_rayyan);

    let attendees = [];
    try {
      const parsed = JSON.parse(body.attendees_json || '[]');
      if (Array.isArray(parsed)) {
        attendees = parsed
          .map((a) => ({
            name: (a && typeof a.name === 'string' ? a.name : '').trim(),
            isJumper: !!(a && a.isJumper),
          }))
          .filter((a) => a.name.length > 0);
      }
    } catch {
      attendees = [];
    }

    const totalPeople = attendees.length;
    const totalJumpers = attendees.filter((a) => a.isJumper).length;
    const derivedChildName = attendees.length > 0 ? attendees[0].name : null;

    try {
      await sql`
        UPDATE rsvps SET
          attending = ${attending},
          parent_name = ${parentName},
          phone = ${phone},
          email = ${email},
          child_name = ${derivedChildName},
          attendees = ${sql.json(attendees)},
          total_people = ${totalPeople},
          total_jumpers = ${totalJumpers},
          notes = ${notes},
          message_to_rayyan = ${messageToRayyan}
        WHERE id = ${id}
      `;
      return redirect(res, '/admin', {
        type: 'success',
        message: 'RSVP updated.',
      });
    } catch (err) {
      console.error('Update failed:', err);
      return htmlError(res, 500, 'Update failed', err.message);
    }
  }

  if (req.method === 'POST' && action === 'send-sms') {
    const body = parseBody(req);
    const message = asStringOrNull(body.message);
    const selectedPhones = body.recipients
      ? (Array.isArray(body.recipients) ? body.recipients : [body.recipients])
      : [];
    const apiKey = process.env.TEXTBELT_API_KEY;

    if (!apiKey) {
      return redirect(res, '/admin', { type: 'error', message: 'TEXTBELT_API_KEY is not configured.' });
    }
    if (!message) {
      return redirect(res, '/admin', { type: 'error', message: 'Message cannot be empty.' });
    }
    if (selectedPhones.length === 0) {
      return redirect(res, '/admin', { type: 'error', message: 'Select at least one recipient.' });
    }

    try {
      const [inviteList, rsvpRows] = await Promise.all([getInviteList(sql), loadAllRows(sql)]);
      const selectedSet = new Set(selectedPhones);
      const targets = buildSmsRecipientList(inviteList, rsvpRows)
        .filter((r) => selectedSet.has(r.phone))
        .map((r) => ({ name: r.name, phone_number: r.phone }));

      const results = [];
      for (const t of targets) {
        try {
          const result = await sendSmsViaTextbelt(t.phone_number, message, apiKey);
          results.push({ name: t.name, phone: t.phone_number, success: result.success, error: result.error });
        } catch (err) {
          results.push({ name: t.name, phone: t.phone_number, success: false, error: err.message });
        }
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(smsResultPage({ results, message }));
    } catch (err) {
      return htmlError(res, 500, 'SMS send failed', err.message);
    }
  }

  if (req.method === 'GET' && action === 'add-rsvp') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(createPage({ error: null }));
  }

  if (req.method === 'POST' && action === 'create') {
    const body = parseBody(req);
    const parentName = asStringOrNull(body.parent_name);
    if (!parentName) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(400).send(createPage({ error: 'Parent name is required.' }));
    }

    const attending = String(body.attending) === 'true';
    const phone = asStringOrNull(body.phone);
    const email = asStringOrNull(body.email);
    const notes = asStringOrNull(body.notes);

    let attendees = [];
    try {
      const parsed = JSON.parse(body.attendees_json || '[]');
      if (Array.isArray(parsed)) {
        attendees = parsed
          .map((a) => ({ name: (a && typeof a.name === 'string' ? a.name : '').trim(), isJumper: !!(a && a.isJumper) }))
          .filter((a) => a.name.length > 0);
      }
    } catch { attendees = []; }

    const totalPeople = attendees.length;
    const totalJumpers = attendees.filter((a) => a.isJumper).length;
    const derivedChildName = attendees.length > 0 ? attendees[0].name : null;

    try {
      const inviteList = await getInviteList(sql);
      const recognized = inviteList.some((item) => {
        const name = typeof item === 'string' ? item : item.name;
        return name && name.toLowerCase().trim() === parentName.toLowerCase().trim();
      });
      const newToken = crypto.randomBytes(24).toString('hex');
      await sql`
        INSERT INTO rsvps
          (attending, parent_name, phone, email, child_name, attendees,
           total_people, total_jumpers, notes, edit_token, recognized)
        VALUES
          (${attending}, ${parentName}, ${phone}, ${email}, ${derivedChildName},
           ${sql.json(attendees)}, ${totalPeople}, ${totalJumpers}, ${notes}, ${newToken}, ${recognized})
      `;
      return redirect(res, '/admin', { type: 'success', message: `Added RSVP for "${parentName}".` });
    } catch (err) {
      console.error('Create RSVP failed:', err);
      return htmlError(res, 500, 'Create failed', err.message);
    }
  }

  if (req.method === 'GET' && action === 'edit') {
    if (!id || Number.isNaN(id)) return htmlError(res, 400, 'Bad request', 'Missing id.');
    try {
      const row = await loadOne(sql, id);
      if (!row) return htmlError(res, 404, 'RSVP not found');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(editPage({ row, error: null }));
    } catch (err) {
      console.error('Load edit failed:', err);
      return htmlError(res, 500, 'Error loading RSVP', err.message);
    }
  }

  // --- LIST (default GET) ---
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return htmlError(res, 405, 'Method not allowed');
  }

  try {
    const [rows, settings, rawInviteList] = await Promise.all([
      loadAllRows(sql),
      loadSettings(sql),
      getInviteList(sql),
    ]);
    const totals = computeTotals(rows);
    const inviteList = rawInviteList.map((inv) => {
      const match = rows.find((r) => namesMatch(r.parent_name, inv.name));
      return { ...inv, status: match ? (match.attending ? 'yes' : 'no') : 'pending' };
    });
    const notResponded = inviteList.filter((i) => i.status === 'pending').map((i) => i.name);
    const flash = parseFlash(q.flash);
    const resendConfigured = !!process.env.RESEND_API_KEY;
    const textbeltConfigured = !!process.env.TEXTBELT_API_KEY;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(200)
      .send(listPage({ rows, totals, flash, settings, resendConfigured, inviteList, notResponded, textbeltConfigured }));
  } catch (err) {
    console.error('Admin query failed:', err);
    return htmlError(res, 500, 'Error loading RSVPs', err.message);
  }
}
