const crypto = require("crypto");
const pool = require("../db/pool");

const COOKIE_NAME = "simple_page_tradie_admin_session";
const MAGIC_LINK_TTL_MINUTES = 15;
const SESSION_TTL_HOURS = 8;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function getAllowedAdminEmails() {
  const configured =
    process.env.ADMIN_EMAILS || process.env.RECIPIENT_EMAIL || "";
  return new Set(
    configured
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator === -1
          ? [part, ""]
          : [
              part.slice(0, separator),
              (() => {
                try {
                  return decodeURIComponent(part.slice(separator + 1));
                } catch {
                  return "";
                }
              })(),
            ];
      }),
  );
}

function sessionCookie(token, maxAgeSeconds = SESSION_TTL_HOURS * 60 * 60) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

async function issueMagicLink(email) {
  const token = createToken();
  await pool.query(
    `INSERT INTO admin_magic_links (email, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '${MAGIC_LINK_TTL_MINUTES} minutes')`,
    [email, hashToken(token)],
  );
  return token;
}

async function consumeMagicLink(token) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const link = await client.query(
      `UPDATE admin_magic_links
             SET used_at = NOW()
             WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
             RETURNING email`,
      [hashToken(token)],
    );
    if (!link.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }

    const sessionToken = createToken();
    await client.query(
      `INSERT INTO admin_sessions (email, token_hash, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '${SESSION_TTL_HOURS} hours')`,
      [link.rows[0].email, hashToken(sessionToken)],
    );
    await client.query("COMMIT");
    return { email: link.rows[0].email, sessionToken };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;

  const result = await pool.query(
    `UPDATE admin_sessions
         SET last_seen_at = NOW()
         WHERE token_hash = $1 AND expires_at > NOW()
         RETURNING email, expires_at`,
    [hashToken(token)],
  );
  return result.rows[0] || null;
}

async function destroySession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) {
    await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [
      hashToken(token),
    ]);
  }
}

async function authenticateAdmin(req, res, next) {
  try {
    const session = await getSession(req);
    if (!session)
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    req.admin = session;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  MAGIC_LINK_TTL_MINUTES,
  authenticateAdmin,
  consumeMagicLink,
  destroySession,
  getAllowedAdminEmails,
  getSession,
  issueMagicLink,
  sessionCookie,
};
