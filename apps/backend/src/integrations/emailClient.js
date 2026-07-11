// Thin wrapper around nodemailer/SMTP. When credentials aren't configured
// (SMTP_HOST/SMTP_USER/SMTP_PASS unset), calls are mocked — logged to the
// console instead of sent — so password reset and any future transactional
// email works end-to-end locally without a real mail account. Mirrors the
// same pattern as integrations/whatsappClient.js.
const nodemailer = require("nodemailer");

let transporter = null;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (isConfigured()) {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html?.replace(/<[^>]+>/g, ""),
    });
    return { mocked: false };
  }

  // eslint-disable-next-line no-console
  console.log(`[Email mock] → ${to}\nSubject: ${subject}\n${text || html}\n`);
  return { mocked: true };
}

module.exports = { sendMail, isConfigured };
