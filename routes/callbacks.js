const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { createMailgunClient } = require("../services/mailgun");
const {
  brandedEmail,
  button,
  note,
  paragraph,
} = require("../services/emailBrand");
const {
  MAGIC_LINK_TTL_MINUTES,
  authenticateAdmin,
  consumeMagicLink,
  destroySession,
  getAllowedAdminEmails,
  getSession,
  issueMagicLink,
  sessionCookie,
} = require("../services/adminAuth");

const mg = createMailgunClient({
  apiKey: process.env.MAILGUN_API_KEY || "unconfigured",
  domain: process.env.MAILGUN_DOMAIN,
  region: process.env.MAILGUN_REGION,
});

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function isRateLimited(key) {
  const now = Date.now();
  const attempts = (loginAttempts.get(key) || []).filter(
    (time) => now - time < LOGIN_WINDOW_MS,
  );
  attempts.push(now);
  loginAttempts.set(key, attempts);
  return attempts.length > MAX_LOGIN_ATTEMPTS;
}

/**
 * Test endpoint to check database schema (no auth for debugging)
 * GET /api/callbacks/test-schema
 */
router.get("/test-schema", authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'callback_requests'
            ORDER BY ordinal_position
        `);

    res.status(200).json({
      success: true,
      columns: result.rows,
    });
  } catch (error) {
    console.error("Schema check error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Request a one-time admin sign-in link.
 * POST /api/admin/magic-link
 */
router.post("/admin/magic-link", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const genericResponse = {
      success: true,
      message: "If that address is authorised, a sign-in link has been sent.",
    };
    if (!email || isRateLimited(`${req.ip}:${email}`))
      return res.status(200).json(genericResponse);

    const allowedEmails = getAllowedAdminEmails();
    if (!allowedEmails.has(email)) return res.status(200).json(genericResponse);

    const token = await issueMagicLink(email);
    const requestOrigin = `${req.protocol}://${req.get("host")}`;
    const siteUrl = (
      process.env.NODE_ENV === "production" && process.env.SITE_URL
        ? process.env.SITE_URL
        : requestOrigin
    ).replace(/\/$/, "");
    const magicLink = `${siteUrl}/api/admin/magic-link?token=${encodeURIComponent(token)}`;
    await mg.messages().send({
      from: `Simple Page <noreply@${process.env.MAILGUN_DOMAIN}>`,
      to: email,
      subject: "Your admin sign-in link | Simple Page",
      text: `Use this one-time link to sign in to the Simple Page admin dashboard:\n\n${magicLink}\n\nThe link expires in ${MAGIC_LINK_TTL_MINUTES} minutes. If you did not request it, you can ignore this email.`,
      html: brandedEmail({
        eyebrow: "Secure admin access",
        title: "Sign in to the lead dashboard",
        intro: "Use this one-time link to access the Simple Page admin area.",
        body:
          button("Sign in to admin", magicLink) +
          note(
            `The link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.`,
          ) +
          paragraph("If you did not request this email, you can ignore it."),
        footer: "Passwordless access for authorised administrators.",
      }),
    });
    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Magic-link request error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Unable to send sign-in link" });
  }
});

router.get("/admin/magic-link", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.redirect("/admin/callbacks.html?auth=invalid");
    const session = await consumeMagicLink(token);
    if (!session) return res.redirect("/admin/callbacks.html?auth=invalid");
    res.setHeader("Set-Cookie", sessionCookie(session.sessionToken));
    return res.redirect("/admin/callbacks.html?auth=success");
  } catch (error) {
    console.error("Magic-link verification error:", error);
    return res.redirect("/admin/callbacks.html?auth=invalid");
  }
});

router.get("/admin/session", async (req, res, next) => {
  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ success: false });
    return res.json({ success: true, email: session.email });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/logout", async (req, res, next) => {
  try {
    await destroySession(req);
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all callback requests with filtering and pagination
 * GET /api/callbacks
 * Query params: status, source, page, limit, startDate, endDate, search
 */
router.get("/callbacks", authenticateAdmin, async (req, res) => {
  try {
    const {
      status,
      source,
      page = 1,
      limit = 50,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNumber = Number(page),
      pageSize = Number(limit);
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      return res.status(400).json({ error: "Invalid page or limit." });
    const offset = (pageNumber - 1) * pageSize;

    // Build dynamic query
    let query = "SELECT * FROM callback_requests WHERE 1=1";
    const params = [];
    let paramCount = 1;

    // Filter by status
    if (status && ["pending", "contacted", "completed"].includes(status)) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Filter by source
    if (
      source &&
      [
        "chatbot",
        "contact_form",
        "footer_form",
        "download_chat",
        "chat_booking",
        "assessment",
      ].includes(source)
    ) {
      query += ` AND source = $${paramCount}`;
      params.push(source);
      paramCount++;
    }

    // Filter by date range
    if (startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate + " 23:59:59");
      paramCount++;
    }

    // Search by name or email
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Count total matching records
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*)");
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get callbacks error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve callbacks",
    });
  }
});

/**
 * Get a single callback request by ID
 * GET /api/callbacks/:id
 */
router.get("/callbacks/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM callback_requests WHERE id = $1",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Callback not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get callback error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve callback",
    });
  }
});

/**
 * Update callback status
 * PATCH /api/callbacks/:id
 */
router.patch("/callbacks/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["pending", "contacted", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Must be: pending, contacted, or completed",
      });
    }

    const result = await pool.query(
      "UPDATE callback_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Callback not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
      message: `Callback status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update callback error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update callback",
    });
  }
});

/**
 * Get callback statistics
 * GET /api/callbacks/stats
 */
router.get("/callbacks-stats", authenticateAdmin, async (req, res) => {
  try {
    const statsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7_days,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30_days
            FROM callback_requests
        `;

    const result = await pool.query(statsQuery);

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve statistics",
    });
  }
});

module.exports = router;
