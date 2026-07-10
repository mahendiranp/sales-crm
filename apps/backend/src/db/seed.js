const { randomUUID: uuid } = require("crypto");
const dayjs = require("dayjs");
const bcrypt = require("bcryptjs");
const { collection } = require("./store");
const { encryptAnswers } = require("../utils/formCrypto");

const now = () => new Date().toISOString();
const daysAgo = (n) => dayjs().subtract(n, "day").toISOString();
const daysFromNow = (n) => dayjs().add(n, "day").toISOString();

// All demo/seed data belongs to one shared tenant — the seeded admin
// account's own id doubles as that tenant's accountId (see
// middleware/auth.js signToken: accountId defaults to account.id).
const DEMO_ACCOUNT_ID = uuid();

async function seed() {
  const users = collection("users");
  const teams = collection("teams");
  const companies = collection("companies");
  const leads = collection("leads");
  const contacts = collection("contacts");
  const deals = collection("deals");
  const activities = collection("activities");
  const tasks = collection("tasks");
  const templates = collection("templates");
  const whatsapp = collection("whatsapp_messages");
  const emails = collection("emails");
  const accounts = collection("accounts");
  const invoices = collection("invoices");
  const expenses = collection("expenses");
  const documents = collection("documents");
  const forms = collection("forms");
  const formResponses = collection("form_responses");

  // ---------------- USERS ----------------
  const userSeed = [
    { id: uuid(), name: "Arjun Mehta", email: "arjun@company.com", role: "Owner", phone: "9876500001", avatarColor: "#2F5D50" },
    { id: uuid(), name: "Priya Sharma", email: "priya@company.com", role: "Sales Manager", phone: "9876500002", avatarColor: "#E8A33D" },
    { id: uuid(), name: "Rahul Verma", email: "rahul@company.com", role: "Sales Executive", phone: "9876500003", avatarColor: "#4A7A6D" },
    { id: uuid(), name: "Sneha Iyer", email: "sneha@company.com", role: "Sales Executive", phone: "9876500004", avatarColor: "#C1443C" },
    { id: uuid(), name: "Karthik Raj", email: "karthik@company.com", role: "Sales Executive", phone: "9876500005", avatarColor: "#3E6FA3" },
    { id: uuid(), name: "Divya Nair", email: "divya@company.com", role: "Support Agent", phone: "9876500006", avatarColor: "#8B5FBF" },
  ].map((u) => ({ ...u, accountId: DEMO_ACCOUNT_ID }));
  await users.seedIfEmpty(userSeed);
  const [owner, manager, rahul, sneha, karthik, divya] = userSeed;

  // ---------------- TEAMS ----------------
  await teams.seedIfEmpty([
    { id: uuid(), name: "Bangalore Sales", region: "Bangalore", managerId: manager.id, memberIds: [rahul.id, sneha.id], createdAt: now() },
    { id: uuid(), name: "Chennai Sales", region: "Chennai", managerId: manager.id, memberIds: [karthik.id], createdAt: now() },
    { id: uuid(), name: "Hyderabad Sales", region: "Hyderabad", managerId: manager.id, memberIds: [divya.id], createdAt: now() },
  ].map((t) => ({ ...t, accountId: DEMO_ACCOUNT_ID })));

  // ---------------- COMPANIES ----------------
  const companySeed = [
    { id: uuid(), name: "Nova Textiles Pvt Ltd", industry: "Textiles", employees: "51-200", gst: "29ABCDE1234F1Z5", website: "novatextiles.in", accountManager: rahul.id, createdAt: daysAgo(40) },
    { id: uuid(), name: "Bharat Freight Solutions", industry: "Logistics", employees: "200-500", gst: "27ABCDE5678F1Z2", website: "bharatfreight.com", accountManager: sneha.id, createdAt: daysAgo(35) },
    { id: uuid(), name: "GreenLeaf AgriTech", industry: "Agriculture", employees: "11-50", gst: "33ABCDE9012F1Z8", website: "greenleafagritech.com", accountManager: karthik.id, createdAt: daysAgo(20) },
    { id: uuid(), name: "Pinnacle FinServe", industry: "Fintech", employees: "500+", gst: "36ABCDE3456F1Z1", website: "pinnaclefinserve.com", accountManager: rahul.id, createdAt: daysAgo(15) },
  ].map((c) => ({ ...c, accountId: DEMO_ACCOUNT_ID }));
  await companies.seedIfEmpty(companySeed);
  const [novaTex, bharatFreight, greenLeaf, pinnacle] = companySeed;

  // ---------------- LEADS ----------------
  const sources = ["Website", "Facebook", "WhatsApp", "Referral", "Cold Call", "Google Ads", "Email Campaign"];
  const products = ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"];
  const leadNames = [
    "Vikram Singh", "Anita Desai", "Ramesh Gupta", "Kavya Reddy", "Suresh Kumar",
    "Meena Pillai", "Arvind Rao", "Pooja Bansal", "Nikhil Joshi", "Deepa Menon",
    "Ajay Chawla", "Ritu Kapoor", "Manoj Tiwari", "Swati Agarwal", "Harish Nambiar",
    "Lakshmi Narayan", "Gaurav Malhotra", "Shalini Pandey", "Rohit Saxena", "Nandini Iyer"
  ];
  const statuses = ["New", "Contacted", "Qualified", "Converted", "Lost"];
  const priorities = ["High", "Medium", "Low"];

  const leadSeed = leadNames.map((name, i) => {
    const status = i < 3 ? "Converted" : statuses[i % statuses.length];
    return {
      id: uuid(),
      name,
      mobile: `98765${String(10000 + i).slice(-5)}`,
      email: `${name.split(" ")[0].toLowerCase()}${i}@example.com`,
      company: i % 3 === 0 ? novaTex.name : i % 3 === 1 ? bharatFreight.name : "",
      source: sources[i % sources.length],
      interestedProduct: products[i % products.length],
      budget: 50000 + (i % 10) * 25000,
      priority: priorities[i % priorities.length],
      status,
      assignedTo: [rahul.id, sneha.id, karthik.id][i % 3],
      createdAt: daysAgo(30 - i),
      updatedAt: daysAgo(30 - i),
      accountId: DEMO_ACCOUNT_ID,
    };
  });
  await leads.seedIfEmpty(leadSeed);

  // ---------------- CONTACTS (converted leads become contacts) ----------------
  const convertedLeads = leadSeed.filter((l) => l.status === "Converted");
  const contactSeed = convertedLeads.map((l, i) => ({
    id: uuid(),
    leadId: l.id,
    name: l.name,
    mobile: l.mobile,
    email: l.email,
    address: `${100 + i}, MG Road, Bangalore, Karnataka 560001`,
    companyId: [novaTex, bharatFreight, greenLeaf][i % 3].id,
    purchaseHistory: [
      { id: uuid(), product: l.interestedProduct, amount: l.budget, date: daysAgo(10 + i) },
    ],
    notes: "Prefers WhatsApp communication. Follow up quarterly for renewals.",
    documents: [{ id: uuid(), name: "Signed_Agreement.pdf", uploadedAt: daysAgo(9 + i) }],
    // birth year is arbitrary — only month/day are used for the reminder
    birthday: dayjs().year(1990).add(i * 3, "day").format("YYYY-MM-DD"),
    contractRenewalDate: daysFromNow(20 + i * 5),
    createdAt: daysAgo(9 + i),
    accountId: DEMO_ACCOUNT_ID,
  }));
  await contacts.seedIfEmpty(contactSeed);

  // ---------------- DEALS ----------------
  const stages = ["New Lead", "Qualified", "Meeting Scheduled", "Quotation Sent", "Negotiation", "Won", "Lost"];
  const dealSeed = leadSeed.slice(0, 16).map((l, i) => {
    const stage = stages[i % stages.length];
    return {
      id: uuid(),
      title: `${l.interestedProduct} — ${l.company || l.name}`,
      leadId: l.id,
      contactName: l.name,
      stage,
      expectedRevenue: l.budget,
      closingDate: daysFromNow((i % 20) + 3),
      probability: stage === "Won" ? 100 : stage === "Lost" ? 0 : [20, 40, 60, 75, 90][i % 5],
      products: [l.interestedProduct],
      notes: "Awaiting budget approval from client's finance team.",
      assignedTo: [rahul.id, sneha.id, karthik.id][i % 3],
      createdAt: daysAgo(25 - i),
      updatedAt: daysAgo(2 + (i % 5)),
      accountId: DEMO_ACCOUNT_ID,
    };
  });
  await deals.seedIfEmpty(dealSeed);

  // ---------------- INVOICES (Finance app) ----------------
  const wonDeals = dealSeed.filter((d) => d.stage === "Won");
  const invoiceStatuses = ["Draft", "Sent", "Paid", "Overdue"];
  const invoiceSeed = wonDeals.map((d, i) => {
    const contact = contactSeed[i % Math.max(contactSeed.length, 1)];
    const amount = d.expectedRevenue;
    const tax = Math.round(amount * 0.18);
    return {
      id: uuid(),
      invoiceNumber: `INV-2026-${String(i + 1).padStart(4, "0")}`,
      dealId: d.id,
      contactId: contact?.id || null,
      companyId: contact?.companyId || null,
      lineItems: [{ description: d.products[0], qty: 1, unitPrice: amount }],
      amount,
      tax,
      total: amount + tax,
      status: invoiceStatuses[i % invoiceStatuses.length],
      issueDate: daysAgo(20 - i),
      dueDate: daysFromNow((i % 15) + 5),
      notes: "",
      createdAt: daysAgo(20 - i),
      updatedAt: daysAgo(20 - i),
      accountId: DEMO_ACCOUNT_ID,
    };
  });
  await invoices.seedIfEmpty(invoiceSeed);

  // ---------------- EXPENSES (Finance app) ----------------
  const expenseCategories = ["Travel", "Client Meals", "Software", "Office Supplies", "Marketing"];
  const expenseStatuses = ["Pending", "Approved", "Rejected"];
  const expenseSeed = [rahul, sneha, karthik, divya].flatMap((u, i) =>
    expenseCategories.slice(0, 2).map((cat, j) => ({
      id: uuid(),
      title: `${cat} — ${u.name.split(" ")[0]}`,
      category: cat,
      amount: 1500 + (i + j) * 850,
      date: daysAgo(3 + i + j),
      submittedBy: u.id,
      status: expenseStatuses[(i + j) % expenseStatuses.length],
      note: "",
      createdAt: daysAgo(3 + i + j),
      updatedAt: daysAgo(3 + i + j),
      accountId: DEMO_ACCOUNT_ID,
    }))
  );
  await expenses.seedIfEmpty(expenseSeed);

  // ---------------- DOCUMENTS (Finance app) ----------------
  const documentSeed = companySeed.map((c, i) => ({
    id: uuid(),
    name: `${c.name.replace(/\s+/g, "_")}_Agreement.pdf`,
    category: "Contract",
    relatedTo: c.name,
    note: "Signed master service agreement.",
    uploadedBy: [rahul, sneha, karthik][i % 3].id,
    uploadedAt: daysAgo(30 - i * 5),
    createdAt: daysAgo(30 - i * 5),
    updatedAt: daysAgo(30 - i * 5),
    accountId: DEMO_ACCOUNT_ID,
  }));
  await documents.seedIfEmpty(documentSeed);

  // ---------------- FORMS ----------------
  const contactFormFields = [
    { id: uuid(), type: "text", label: "Full Name", placeholder: "Your name", helpText: "", required: true, order: 0 },
    { id: uuid(), type: "email", label: "Email", placeholder: "you@example.com", helpText: "", required: true, order: 1 },
    { id: uuid(), type: "phone", label: "Phone Number", placeholder: "10-digit mobile", helpText: "", required: false, order: 2 },
    {
      id: uuid(), type: "dropdown", label: "Interested Product", helpText: "", required: true, order: 3,
      options: ["ERP Suite", "CRM Pro", "Inventory Manager", "HR Toolkit", "Accounting Module"],
    },
    { id: uuid(), type: "longtext", label: "Message", placeholder: "Tell us what you need", helpText: "", required: false, order: 4 },
    { id: uuid(), type: "rating", label: "How did you hear about us?", helpText: "1 = Not likely, 5 = Very likely", required: false, order: 5 },
  ];
  const eventFormFields = [
    { id: uuid(), type: "text", label: "Attendee Name", placeholder: "", helpText: "", required: true, order: 0 },
    { id: uuid(), type: "email", label: "Email", placeholder: "", helpText: "", required: true, order: 1 },
    { id: uuid(), type: "date", label: "Preferred Date", helpText: "", required: true, order: 2 },
    { id: uuid(), type: "yesno", label: "Bringing a guest?", helpText: "", required: false, order: 3 },
    {
      id: uuid(), type: "checkbox", label: "Sessions of Interest", helpText: "Select all that apply", required: false, order: 4,
      options: ["Product Demo", "Networking", "Workshop", "Q&A Panel"],
    },
  ];
  const formSeed = [
    {
      id: uuid(),
      name: "Website Contact Form",
      description: "Captures inbound leads from the website contact page.",
      fields: contactFormFields,
      settings: { submitButtonText: "Submit", confirmationMessage: "Thanks! We'll be in touch shortly." },
      status: "Published",
      createdAt: daysAgo(25),
      updatedAt: daysAgo(2),
    },
    {
      id: uuid(),
      name: "Event Registration",
      description: "Registration form for the quarterly product showcase.",
      fields: eventFormFields,
      settings: { submitButtonText: "Register", confirmationMessage: "You're registered — see you there!" },
      status: "Draft",
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
  ].map((f) => ({ ...f, accountId: DEMO_ACCOUNT_ID }));
  await forms.seedIfEmpty(formSeed);

  const [contactForm] = formSeed;
  const responseNames = ["Vikram Singh", "Anita Desai", "Ramesh Gupta", "Kavya Reddy", "Suresh Kumar", "Meena Pillai"];
  const formResponseSeed = responseNames.map((name, i) => ({
    id: uuid(),
    formId: contactForm.id,
    // Customer-submitted answers are stored encrypted at rest (see utils/formCrypto.js).
    answers: encryptAnswers({
      [contactFormFields[0].id]: name,
      [contactFormFields[1].id]: `${name.split(" ")[0].toLowerCase()}${i}@example.com`,
      [contactFormFields[2].id]: `98765${String(10000 + i).slice(-5)}`,
      [contactFormFields[3].id]: contactFormFields[3].options[i % contactFormFields[3].options.length],
      [contactFormFields[4].id]: "Looking for a quote on bulk licenses.",
      [contactFormFields[5].id]: String(3 + (i % 3)),
    }),
    submittedAt: daysAgo(i),
    // Responses inherit the owning form's tenant, not a submitter's (public
    // form-fillers and WhatsApp repliers are never authenticated).
    accountId: DEMO_ACCOUNT_ID,
  }));
  await formResponses.seedIfEmpty(formResponseSeed);

  // ---------------- ACTIVITIES ----------------
  const activityTypes = ["Phone Call", "WhatsApp Message", "Email", "Meeting", "Site Visit"];
  const activitySeed = [];
  leadSeed.slice(0, 12).forEach((l, i) => {
    for (let j = 0; j < 2; j++) {
      activitySeed.push({
        id: uuid(),
        type: activityTypes[(i + j) % activityTypes.length],
        relatedTo: l.name,
        leadId: l.id,
        performedBy: [rahul.id, sneha.id, karthik.id][i % 3],
        summary: `${activityTypes[(i + j) % activityTypes.length]} with ${l.name} regarding ${l.interestedProduct}`,
        timestamp: daysAgo(j + i),
        accountId: DEMO_ACCOUNT_ID,
      });
    }
  });
  await activities.seedIfEmpty(activitySeed);

  // ---------------- TASKS ----------------
  const taskTitles = [
    "Call customer tomorrow", "Send quotation", "Schedule demo", "Visit customer",
    "Follow up on payment", "Prepare proposal", "Confirm meeting time", "Send festival greetings",
  ];
  const taskSeed = leadSeed.slice(0, 10).map((l, i) => ({
    id: uuid(),
    title: taskTitles[i % taskTitles.length],
    relatedTo: l.name,
    leadId: l.id,
    assignedTo: [rahul.id, sneha.id, karthik.id][i % 3],
    dueDate: i % 4 === 0 ? daysAgo(1) : daysFromNow(i % 6),
    priority: priorities[i % priorities.length],
    status: i % 5 === 0 ? "Completed" : "Pending",
    notifyVia: ["Email", "SMS", "Push"].filter((_, idx) => (i + idx) % 2 === 0),
    createdAt: daysAgo(5 + i),
    accountId: DEMO_ACCOUNT_ID,
  }));
  await tasks.seedIfEmpty(taskSeed);

  // ---------------- TEMPLATES ----------------
  await templates.seedIfEmpty([
    { id: uuid(), name: "Welcome Message", category: "Welcome", channel: "WhatsApp", body: "Hi {{name}}, thanks for reaching out to us! How can we help you today?" },
    { id: uuid(), name: "Quotation", category: "Quotation", channel: "Email", body: "Dear {{name}}, please find attached our quotation for {{product}}. Valid for 15 days." },
    { id: uuid(), name: "Payment Reminder", category: "Payment Reminder", channel: "WhatsApp", body: "Hi {{name}}, a gentle reminder that your payment of ₹{{amount}} is due on {{date}}." },
    { id: uuid(), name: "Festival Wishes — Diwali", category: "Festival Wishes", channel: "WhatsApp", body: "Wishing you and your family a very Happy Diwali from all of us at {{company}}! 🪔" },
    { id: uuid(), name: "Follow-up", category: "Follow-up", channel: "Email", body: "Hi {{name}}, just checking in on {{product}} — happy to answer any questions." },
  ].map((t) => ({ ...t, accountId: DEMO_ACCOUNT_ID })));

  // ---------------- WHATSAPP MESSAGES ----------------
  const waSeed = leadSeed.slice(0, 8).map((l, i) => ({
    id: uuid(),
    leadId: l.id,
    contactName: l.name,
    direction: i % 2 === 0 ? "inbound" : "outbound",
    message: i % 2 === 0 ? "Is this available?" : "Yes, it's available. Would you like a demo tomorrow?",
    aiSuggested: i % 2 !== 0,
    status: ["sent", "delivered", "read"][i % 3],
    timestamp: daysAgo(i),
    accountId: DEMO_ACCOUNT_ID,
  }));
  await whatsapp.seedIfEmpty(waSeed);

  // ---------------- EMAILS ----------------
  const emailSeed = leadSeed.slice(0, 8).map((l, i) => ({
    id: uuid(),
    leadId: l.id,
    to: l.email,
    subject: i % 2 === 0 ? `Quotation for ${l.interestedProduct}` : `Following up — ${l.interestedProduct}`,
    body: "Please find the details attached.",
    opened: i % 3 !== 0,
    clicked: i % 4 === 0,
    sentAt: daysAgo(i + 1),
    accountId: DEMO_ACCOUNT_ID,
  }));
  await emails.seedIfEmpty(emailSeed);

  // ---------------- LOGIN ACCOUNTS (demo personas) ----------------
  // Passwords come from env so they're never hardcoded in source — see
  // .env.example. Falls back to the well-known demo values only when unset,
  // so local dev keeps working out of the box. Hashed with bcrypt before
  // storage — auth.js compares against the hash, never plaintext.
  //
  // All three share the same tenant: the admin's own id IS the tenant id
  // (DEMO_ACCOUNT_ID, generated at module load, matching every business
  // record above); manager/viewer get an explicit accountId pointing at it
  // since their own ids aren't the tenant root.
  const hash = (pw) => bcrypt.hashSync(pw, 12);
  await accounts.seedIfEmpty([
    {
      id: DEMO_ACCOUNT_ID,
      name: "Arjun Mehta",
      email: "admin@pipeline.com",
      password: hash(process.env.DEMO_ADMIN_PASSWORD || "admin123"),
      company: "Your Company Pvt Ltd",
      authRole: "admin",
      // Master admin: the only role that sees the Admin Portal and can
      // toggle company-wide feature flags. A regular signup gets
      // authRole "admin" (full CRM management) but never this flag.
      isMasterAdmin: true,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: uuid(),
      accountId: DEMO_ACCOUNT_ID,
      name: "Priya Sharma",
      email: "manager@pipeline.com",
      password: hash(process.env.DEMO_MANAGER_PASSWORD || "manager123"),
      company: "Your Company Pvt Ltd",
      authRole: "manager",
      isDemo: true,
      createdAt: now(),
    },
    {
      id: uuid(),
      accountId: DEMO_ACCOUNT_ID,
      name: "Divya Nair",
      email: "viewer@pipeline.com",
      password: hash(process.env.DEMO_VIEWER_PASSWORD || "viewer123"),
      company: "Your Company Pvt Ltd",
      authRole: "viewer",
      isDemo: true,
      createdAt: now(),
    },
  ]);

  console.log("✅ Database seeded successfully.");
}

module.exports = { seed };
