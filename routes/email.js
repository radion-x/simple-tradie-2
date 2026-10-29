const express = require("express");
const database = require("../db/pool");
const { createMailgunClient } = require("../services/mailgun");
const { validateLead, captureLead } = require("../services/leadCapture");
const router = express.Router();
const mailer = createMailgunClient({
  apiKey: process.env.MAILGUN_API_KEY || "unconfigured",
  domain: process.env.MAILGUN_DOMAIN,
  region: process.env.MAILGUN_REGION,
});
function leadHandler(source) {
  return async (req, res) => {
    const checked = validateLead(req.body, source);
    if (checked.error) return res.status(400).json({ error: checked.error });
    if (
      source === "download_chat" &&
      (!checked.data.email || !checked.data.conversation)
    )
      return res
        .status(400)
        .json({ error: "Please provide an email address and a conversation." });
    try {
      return res.json(
        await captureLead(checked.data, source, { database, mailer }),
      );
    } catch (error) {
      console.error("Lead save failed", error.code || "database error");
      return res
        .status(503)
        .json({
          error:
            "Your enquiry could not be saved. Please try again or email hello@simplepage.com.au.",
        });
    }
  };
}
router.post("/send-email", leadHandler("contact_form"));
router.post("/chat/callback", leadHandler("chat_booking"));
router.post("/chat/email-transcript", leadHandler("download_chat"));
module.exports = router;
