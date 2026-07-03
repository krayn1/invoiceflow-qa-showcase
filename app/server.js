/**
 * InvoiceFlow — mock B2B subscription billing API + static UI server.
 * In-memory "database" only — resets on restart. Built purely as a
 * realistic system-under-test for the Playwright E2E suite in /tests.
 */
const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- In-memory data -------------------------------------------------

const USERS = [{ email: "demo@invoiceflow.test", password: "Demo1234!", name: "Jordan Reyes" }];

const PLANS = [
  { id: "starter", name: "Starter", priceMonthly: 29 },
  { id: "growth", name: "Growth", priceMonthly: 99 },
  { id: "scale", name: "Scale", priceMonthly: 299 },
];

let customers = [
  { id: "cust_1", name: "Northwind Traders", planId: "starter", billingAnchorDay: 1 },
  { id: "cust_2", name: "Contoso Logistics", planId: "growth", billingAnchorDay: 15 },
];

let invoices = [];
let invoiceSeq = 1000;
let sessions = {};

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Parses a "YYYY-MM-DD" string as a LOCAL calendar date (no timezone shift).
// Using `new Date("YYYY-MM-DD")` directly parses as UTC midnight, which can
// silently shift the day of month backward in western timezones — a classic
// off-by-one date bug in its own right, so the test harness avoids it here.
function parseLocalDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ---- Auth -------------------------------------------------------------

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = USERS.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  const token = crypto.randomBytes(16).toString("hex");
  sessions[token] = { email: user.email, name: user.name };
  res.json({ token, name: user.name });
});

function requireAuth(req, res, next) {
  const token = req.headers["x-session-token"];
  if (!token || !sessions[token]) return res.status(401).json({ error: "Not authenticated" });
  req.user = sessions[token];
  next();
}

app.get("/api/session", requireAuth, (req, res) => res.json({ user: req.user }));

// ---- Customers & Plans -------------------------------------------------

app.get("/api/plans", requireAuth, (req, res) => res.json(PLANS));
app.get("/api/customers", requireAuth, (req, res) => res.json(customers));

// ---- Subscription upgrade / proration -----------------------------------
//
// NOTE: this is the mid-cycle upgrade proration calculation. Business rule:
// when a customer upgrades plans partway through their billing cycle, credit
// the unused days of the old plan and charge the remaining days of the new
// plan, prorated against the ACTUAL number of days in the current billing
// month (not a flat assumption).

app.post("/api/customers/:id/upgrade", requireAuth, (req, res) => {
  const { newPlanId, today } = req.body || {};
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const oldPlan = PLANS.find((p) => p.id === customer.planId);
  const newPlan = PLANS.find((p) => p.id === newPlanId);
  if (!newPlan) return res.status(400).json({ error: "Unknown plan" });

  const now = today ? parseLocalDate(today) : new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dayOfMonth = now.getDate();

  // FIXED (was hardcoded to 30 — see BUGS_FOUND.md #1): prorate against the
  // actual number of days in the current billing month so cycles that
  // aren't exactly 30 days (8 of 12 months) bill correctly.
  const totalDaysInCycle = daysInMonth(year, month);
  const daysRemaining = totalDaysInCycle - dayOfMonth + 1;

  const oldPlanDailyRate = oldPlan.priceMonthly / totalDaysInCycle;
  const newPlanDailyRate = newPlan.priceMonthly / totalDaysInCycle;

  const credit = +(oldPlanDailyRate * daysRemaining).toFixed(2);
  const charge = +(newPlanDailyRate * daysRemaining).toFixed(2);
  const proratedAmount = +(charge - credit).toFixed(2);

  customer.planId = newPlanId;

  res.json({
    customerId: customer.id,
    oldPlan: oldPlan.id,
    newPlan: newPlan.id,
    daysRemaining,
    totalDaysInCycle,
    credit,
    charge,
    proratedAmount,
  });
});

// ---- Invoices -----------------------------------------------------------

function computeInvoiceTotals({ lineItems, percentDiscount = 0, flatDiscount = 0, taxRate = 0 }) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0);
  const afterPercent = subtotal - subtotal * (percentDiscount / 100);
  const afterDiscount = Math.max(0, afterPercent - flatDiscount);
  // FIXED (was taxing the pre-discount subtotal — see BUGS_FOUND.md #2):
  // tax is now computed on what the customer actually owes, post-discount.
  const tax = +(afterDiscount * (taxRate / 100)).toFixed(2);
  const total = +(afterDiscount + tax).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), tax, total };
}

app.get("/api/invoices", requireAuth, (req, res) => res.json(invoices));

app.post("/api/invoices", requireAuth, (req, res) => {
  const { customerId, lineItems, percentDiscount, flatDiscount, taxRate } = req.body || {};
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: "At least one line item is required" });
  }

  const totals = computeInvoiceTotals({ lineItems, percentDiscount, flatDiscount, taxRate });
  const invoice = {
    id: `inv_${invoiceSeq++}`,
    customerId,
    customerName: customer.name,
    lineItems,
    percentDiscount: percentDiscount || 0,
    flatDiscount: flatDiscount || 0,
    taxRate: taxRate || 0,
    ...totals,
    status: "draft",
    createdAt: new Date().toISOString(),
    paymentAttempts: 0,
  };
  invoices.push(invoice);
  res.status(201).json(invoice);
});

app.post("/api/invoices/:id/send", requireAuth, (req, res) => {
  const invoice = invoices.find((i) => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  invoice.status = "sent";
  invoice.sentAt = new Date().toISOString();
  res.json(invoice);
});

// ---- Payments & dunning ---------------------------------------------------

const MAX_RETRIES = 3;

app.post("/api/payments/:invoiceId", requireAuth, (req, res) => {
  const invoice = invoices.find((i) => i.id === req.params.invoiceId);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  const { cardNumber } = req.body || {};

  invoice.paymentAttempts += 1;
  const declined = cardNumber === "4000000000000002";

  if (!declined) {
    invoice.status = "paid";
    invoice.paidAt = new Date().toISOString();
    return res.json({ result: "success", invoice });
  }

  if (invoice.paymentAttempts >= MAX_RETRIES) {
    invoice.status = "overdue";
  } else {
    invoice.status = "payment_failed";
  }
  res.status(402).json({ result: "declined", attempts: invoice.paymentAttempts, invoice });
});

app.post("/api/test/reset", (req, res) => {
  invoices = [];
  invoiceSeq = 1000;
  customers = [
    { id: "cust_1", name: "Northwind Traders", planId: "starter", billingAnchorDay: 1 },
    { id: "cust_2", name: "Contoso Logistics", planId: "growth", billingAnchorDay: 15 },
  ];
  sessions = {};
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`InvoiceFlow running at http://localhost:${PORT}`));
}
module.exports = app;
