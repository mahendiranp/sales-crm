// One shared HTML shell for every transactional email, so the welcome/OTP/
// reset/approval emails all look like they come from the same product
// instead of five differently-formatted plain-text-in-HTML-tags messages.
// Deliberately table-based, inline-styled, no external assets or webfonts —
// that's still the most reliable way to render consistently across Gmail/
// Outlook/Apple Mail, none of which fully support modern CSS in email.
const { APP_NAME } = require("./brand");

const COLORS = {
  primary: "#2F5D50",
  primaryDark: "#1F4038",
  ink: "#14172B",
  inkMuted: "#6B7280",
  base: "#F7F8FA",
  border: "#E4E7EC",
};

// `bodyHtml` is the message-specific content (already-safe HTML — callers
// control it, never raw user input). `cta` is optional { label, url }.
// `highlight` is optional large centered text — used for OTP codes.
function emailLayout({ preheader = "", heading, bodyHtml, cta, highlight }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLORS.base};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.base};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
            <tr>
              <td style="padding-bottom:24px;text-align:center;">
                <span style="display:inline-block;width:32px;height:32px;border-radius:8px;background:${COLORS.primary};vertical-align:middle;line-height:32px;color:#fff;font-weight:700;font-size:15px;">${APP_NAME[0]}</span>
                <span style="display:inline-block;vertical-align:middle;margin-left:8px;font-size:18px;font-weight:700;color:${COLORS.ink};">${APP_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid ${COLORS.border};border-radius:12px;padding:32px;">
                ${heading ? `<h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${COLORS.ink};">${heading}</h1>` : ""}
                <div style="font-size:14px;line-height:1.6;color:${COLORS.ink};">${bodyHtml}</div>
                ${
                  highlight
                    ? `<div style="margin:24px 0;text-align:center;">
                         <span style="display:inline-block;background:${COLORS.base};border:1px solid ${COLORS.border};border-radius:10px;padding:14px 28px;font-size:28px;font-weight:700;letter-spacing:6px;color:${COLORS.ink};">${highlight}</span>
                       </div>`
                    : ""
                }
                ${
                  cta
                    ? `<div style="margin-top:24px;">
                         <a href="${cta.url}" style="display:inline-block;background:${COLORS.primary};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${cta.label}</a>
                       </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px;text-align:center;font-size:12px;color:${COLORS.inkMuted};">
                © ${year} ${APP_NAME}. This is an automated message — please don't reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = { emailLayout };
