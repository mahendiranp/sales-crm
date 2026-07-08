const { v4: uuid } = require("uuid");
const dayjs = require("dayjs");
const { collection } = require("./store");

const now = () => new Date().toISOString();
const daysAgo = (n) => dayjs().subtract(n, "day").toISOString();
const daysFromNow = (n) => dayjs().add(n, "day").toISOString();

function seed() {
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

  // ---------------- USERS ----------------
  const userSeed = [
    { id: uuid(), name: "Arjun Mehta", email: "arjun@company.com", role: "Owner", phone: "9876500001", avatarColor: "#2F5D50" },
    { id: uuid(), name: "Priya Sharma", email: "priya@company.com", role: "Sales Manager", phone: "9876500002", avatarColor: "#E8A33D" },
    { id: uuid(), name: "Rahul Verma", email: "rahul@company.com", role: "Sales Executive", phone: "9876500003", avatarColor: "#4A7A6D" },
    { id: uuid(), name: "Sneha Iyer", email: "sneha@company.com", role: "Sales Executive", phone: "9876500004", avatarColor: "#C1443C" },
    { id: uuid(), name: "Karthik Raj", email: "karthik@company.com", role: "Sales Executive", phone: "9876500005", avatarColor: "#3E6FA3" },
    { id: uuid(), name: "Divya Nair", email: "divya@company.com", role: "Support Agent", phone: "9876500006", avatarColor: "#8B5FBF" },
  ];
  users.seedIfEmpty(userSeed);
  const [owner, manager, rahul, sneha, karthik, divya] = userSeed;

  // ---------------- TEAMS ----------------
  teams.seedIfEmpty([
    { id: uuid(), name: "Bangalore Sales", region: "Bangalore", managerId: manager.id, memberIds: [rahul.id, sneha.id], createdAt: now() },
    { id: uuid(), name: "Chennai Sales", region: "Chennai", managerId: manager.id, memberIds: [karthik.id], createdAt: now() },
    { id: uuid(), name: "Hyderabad Sales", region: "Hyderabad", managerId: manager.id, memberIds: [divya.id], createdAt: now() },
  ]);

  // ---------------- COMPANIES ----------------
  const companySeed = [
    { id: uuid(), name: "Nova Textiles Pvt Ltd", industry: "Textiles", employees: "51-200", gst: "29ABCDE1234F1Z5", website: "novatextiles.in", accountManager: rahul.id, createdAt: daysAgo(40) },
    { id: uuid(), name: "Bharat Freight Solutions", industry: "Logistics", employees: "200-500", gst: "27ABCDE5678F1Z2", website: "bharatfreight.com", accountManager: sneha.id, createdAt: daysAgo(35) },
    { id: uuid(), name: "GreenLeaf AgriTech", industry: "Agriculture", employees: "11-50", gst: "33ABCDE9012F1Z8", website: "greenleafagritech.com", accountManager: karthik.id, createdAt: daysAgo(20) },
    { id: uuid(), name: "Pinnacle FinServe", industry: "Fintech", employees: "500+", gst: "36ABCDE3456F1Z1", website: "pinnaclefinserve.com", accountManager: rahul.id, createdAt: daysAgo(15) },
  ];
  companies.seedIfEmpty(companySeed);
  const [novaTex, bharatFreight, greenLeaf, pinnacle] = companySeed;

  // ---------------- LEADS ----------------
  const sources = ["Website", "Facebook", "WhatsApp", "Referral", "Cold Call"];
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
    };
  });
  leads.seedIfEmpty(leadSeed);

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
    createdAt: daysAgo(9 + i),
  }));
  contacts.seedIfEmpty(contactSeed);

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
    };
  });
  deals.seedIfEmpty(dealSeed);

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
      });
    }
  });
  activities.seedIfEmpty(activitySeed);

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
  }));
  tasks.seedIfEmpty(taskSeed);

  // ---------------- TEMPLATES ----------------
  templates.seedIfEmpty([
    { id: uuid(), name: "Welcome Message", category: "Welcome", channel: "WhatsApp", body: "Hi {{name}}, thanks for reaching out to us! How can we help you today?" },
    { id: uuid(), name: "Quotation", category: "Quotation", channel: "Email", body: "Dear {{name}}, please find attached our quotation for {{product}}. Valid for 15 days." },
    { id: uuid(), name: "Payment Reminder", category: "Payment Reminder", channel: "WhatsApp", body: "Hi {{name}}, a gentle reminder that your payment of ₹{{amount}} is due on {{date}}." },
    { id: uuid(), name: "Festival Wishes — Diwali", category: "Festival Wishes", channel: "WhatsApp", body: "Wishing you and your family a very Happy Diwali from all of us at {{company}}! 🪔" },
    { id: uuid(), name: "Follow-up", category: "Follow-up", channel: "Email", body: "Hi {{name}}, just checking in on {{product}} — happy to answer any questions." },
  ]);

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
  }));
  whatsapp.seedIfEmpty(waSeed);

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
  }));
  emails.seedIfEmpty(emailSeed);

  // ---------------- LOGIN ACCOUNTS (demo personas) ----------------
  accounts.seedIfEmpty([
    {
      id: uuid(),
      name: "Arjun Mehta",
      email: "admin@pipeline.com",
      password: "admin123",
      company: "Your Company Pvt Ltd",
      authRole: "admin",
      isDemo: true,
      createdAt: now(),
    },
    {
      id: uuid(),
      name: "Priya Sharma",
      email: "manager@pipeline.com",
      password: "manager123",
      company: "Your Company Pvt Ltd",
      authRole: "manager",
      isDemo: true,
      createdAt: now(),
    },
    {
      id: uuid(),
      name: "Divya Nair",
      email: "viewer@pipeline.com",
      password: "viewer123",
      company: "Your Company Pvt Ltd",
      authRole: "viewer",
      isDemo: true,
      createdAt: now(),
    },
  ]);

  console.log("✅ Database seeded successfully.");
}

module.exports = { seed };
