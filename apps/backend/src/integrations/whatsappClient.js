// Thin wrapper around the Meta WhatsApp Cloud API. When credentials aren't
// configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID unset), calls
// are mocked — logged to the console and recorded in the whatsapp_messages
// collection with status "mock-sent" — so the survey flow is fully testable
// without a real WhatsApp Business account.
const { randomUUID: uuid } = require("crypto");
const { collection } = require("../db/store");

const messages = collection("whatsapp_messages");

const GRAPH_API_VERSION = "v19.0";

function isConfigured() {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function sendMessage(to, body) {
  if (isConfigured()) {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`WhatsApp send failed (${res.status}): ${errText}`);
    }
    await messages.insert({
      id: uuid(),
      leadId: null,
      contactName: to,
      direction: "outbound",
      message: body,
      aiSuggested: false,
      status: "sent",
      timestamp: new Date().toISOString(),
    });
    return { mocked: false };
  }

  // eslint-disable-next-line no-console
  console.log(`[WhatsApp mock] → ${to}: ${body}`);
  await messages.insert({
    id: uuid(),
    leadId: null,
    contactName: to,
    direction: "outbound",
    message: body,
    aiSuggested: false,
    status: "mock-sent",
    timestamp: new Date().toISOString(),
  });
  return { mocked: true };
}

module.exports = { sendMessage, isConfigured };
