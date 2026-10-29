const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const Mailgun = require("mailgun.js");

function normalizeAttachments(attachments) {
  if (!attachments) {
    return attachments;
  }

  const items = Array.isArray(attachments) ? attachments : [attachments];
  return items.map((attachment) => {
    if (typeof attachment !== "string") {
      return attachment;
    }

    return {
      data: fs.createReadStream(attachment),
      filename: path.basename(attachment),
    };
  });
}

function createMailgunClient({ apiKey, domain, region = "us" }) {
  const mailgun = new Mailgun(FormData);
  const client = mailgun.client({
    username: "api",
    key: apiKey,
    url:
      region === "eu"
        ? "https://api.eu.mailgun.net"
        : "https://api.mailgun.net",
  });

  async function send(data) {
    const message = {
      ...data,
      attachment: normalizeAttachments(data.attachment),
    };

    if (!message.attachment) {
      delete message.attachment;
    }

    return client.messages.create(domain, message);
  }

  // Preserve the small interface used by the existing route modules while
  // delegating to the maintained Mailgun SDK.
  return {
    messages() {
      return {
        send(data, callback) {
          const request = send(data);

          if (typeof callback === "function") {
            request.then((body) => callback(null, body)).catch(callback);
          }

          return request;
        },
      };
    },
  };
}

module.exports = { createMailgunClient, normalizeAttachments };
