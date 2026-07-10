// Predefined form templates — pick one to instantly generate a new form
// with a sensible field set instead of building from scratch. Field `id`s
// are assigned fresh at creation time (see routes/forms.js), so templates
// only need to declare everything else.
const TEMPLATES = [
  {
    key: "blank",
    name: "Blank Form",
    description: "Start from scratch and add your own fields.",
    category: "General",
    fields: [],
  },
  {
    key: "customer-feedback",
    name: "Customer Feedback",
    description: "Collect ratings and open-ended feedback after a purchase or service.",
    category: "Feedback",
    fields: [
      { type: "text", label: "Name", placeholder: "Your full name", required: true },
      { type: "email", label: "Email", placeholder: "you@example.com", required: true },
      { type: "rating", label: "Overall Experience", required: true },
      { type: "rating", label: "Rate Our Service", required: true },
      { type: "rating", label: "Rate Product Quality", required: true },
      { type: "yesno", label: "Would you recommend us?", required: true },
      { type: "longtext", label: "What did you like most?", required: false },
      { type: "longtext", label: "What can we improve?", required: false },
      { type: "longtext", label: "Additional Comments", required: false },
    ],
  },
  {
    key: "nps-survey",
    name: "NPS / Satisfaction Survey",
    description: "A quick single-question style survey to track satisfaction over time.",
    category: "Feedback",
    fields: [
      { type: "rating", label: "How likely are you to recommend us to a friend or colleague?", required: true },
      { type: "longtext", label: "What's the main reason for your score?", required: false },
      { type: "email", label: "Email (optional, for follow-up)", required: false },
    ],
  },
  {
    key: "contact-lead",
    name: "Contact Us / Lead Capture",
    description: "Capture inbound leads from your website or a shared link.",
    category: "Sales",
    fields: [
      { type: "text", label: "Full Name", placeholder: "Your name", required: true },
      { type: "email", label: "Email", placeholder: "you@example.com", required: true },
      { type: "phone", label: "Phone Number", placeholder: "10-digit mobile", required: false },
      { type: "text", label: "Company", placeholder: "", required: false },
      { type: "dropdown", label: "Interested Product", options: ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"], required: false },
      { type: "longtext", label: "Message", placeholder: "Tell us what you need", required: false },
    ],
  },
  {
    key: "event-registration",
    name: "Event Registration",
    description: "Register attendees for a webinar, workshop, or in-person event.",
    category: "Marketing",
    fields: [
      { type: "text", label: "Attendee Name", required: true },
      { type: "email", label: "Email", required: true },
      { type: "phone", label: "Phone Number", required: false },
      { type: "date", label: "Preferred Date", required: true },
      { type: "yesno", label: "Bringing a guest?", required: false },
      { type: "checkbox", label: "Sessions of Interest", options: ["Product Demo", "Networking", "Workshop", "Q&A Panel"], required: false },
    ],
  },
  {
    key: "job-application",
    name: "Job Application",
    description: "Collect candidate details and resumes for open roles.",
    category: "HR",
    fields: [
      { type: "text", label: "Full Name", required: true },
      { type: "email", label: "Email", required: true },
      { type: "phone", label: "Phone Number", required: true },
      { type: "dropdown", label: "Position Applied For", options: ["Sales Executive", "Support Agent", "Software Engineer", "Marketing Associate"], required: true },
      { type: "number", label: "Years of Experience", required: false },
      { type: "file", label: "Resume", required: true },
      { type: "longtext", label: "Cover Letter", required: false },
    ],
  },
  {
    key: "order-form",
    name: "Product Order Form",
    description: "Take simple product orders with delivery details.",
    category: "Sales",
    fields: [
      { type: "text", label: "Customer Name", required: true },
      { type: "phone", label: "Phone Number", required: true },
      { type: "dropdown", label: "Product", options: ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"], required: true },
      { type: "number", label: "Quantity", required: true },
      { type: "longtext", label: "Delivery Address", required: true },
      { type: "date", label: "Preferred Delivery Date", required: false },
    ],
  },
  {
    key: "appointment-booking",
    name: "Appointment Booking",
    description: "Let customers request a meeting or demo slot.",
    category: "Services",
    fields: [
      { type: "text", label: "Name", required: true },
      { type: "phone", label: "Phone Number", required: true },
      { type: "email", label: "Email", required: false },
      { type: "date", label: "Preferred Date", required: true },
      { type: "time", label: "Preferred Time", required: true },
      { type: "longtext", label: "Reason for Visit", required: false },
    ],
  },
];

function listTemplates() {
  return TEMPLATES.map(({ key, name, description, category, fields }) => ({
    key,
    name,
    description,
    category,
    fieldCount: fields.length,
  }));
}

function getTemplate(key) {
  return TEMPLATES.find((t) => t.key === key);
}

module.exports = { listTemplates, getTemplate };
