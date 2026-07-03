const API = "";

function getToken() { return sessionStorage.getItem("token"); }
function authHeaders() { return { "Content-Type": "application/json", "X-Session-Token": getToken() || "" }; }

async function api(path, options = {}) {
  const res = await fetch(API + path, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { data, status: res.status });
  return data;
}

// ---- Login page ----------------------------------------------------------
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("name", data.name);
      window.location.href = "/dashboard.html";
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ---- Dashboard page --------------------------------------------------------
const customersBody = document.getElementById("customers-body");
if (customersBody) {
  let plans = [];
  let customers = [];

  async function init() {
    if (!getToken()) { window.location.href = "/index.html"; return; }
    document.getElementById("user-name").textContent = sessionStorage.getItem("name") || "";
    plans = await api("/api/plans");
    await refreshCustomers();
    await refreshInvoices();
    populateCustomerSelect();
  }

  function planName(id) { return (plans.find((p) => p.id === id) || {}).name || id; }

  async function refreshCustomers() {
    customers = await api("/api/customers");
    customersBody.innerHTML = "";
    customers.forEach((c) => {
      const tr = document.createElement("tr");
      tr.dataset.testid = `customer-row-${c.id}`;
      const nextPlan = plans[(plans.findIndex((p) => p.id === c.planId) + 1) % plans.length];
      tr.innerHTML = `
        <td>${c.name}</td>
        <td data-testid="customer-plan-${c.id}">${planName(c.planId)}</td>
        <td><button class="secondary" data-testid="upgrade-btn-${c.id}" data-customer="${c.id}" data-newplan="${nextPlan.id}">Upgrade to ${nextPlan.name}</button></td>`;
      customersBody.appendChild(tr);
    });
    customersBody.querySelectorAll("button[data-customer]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await api(`/api/customers/${btn.dataset.customer}/upgrade`, {
          method: "POST",
          body: JSON.stringify({ newPlanId: btn.dataset.newplan }),
        });
        alert(
          `Upgraded to ${res.newPlan}. Prorated amount due today: $${res.proratedAmount} ` +
          `(charge $${res.charge} - credit $${res.credit}, based on ${res.daysRemaining}/${res.totalDaysInCycle} days)`
        );
        await refreshCustomers();
        populateCustomerSelect();
      });
    });
  }

  function populateCustomerSelect() {
    const sel = document.getElementById("customer-select");
    sel.innerHTML = customers.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  async function refreshInvoices() {
    const invoices = await api("/api/invoices");
    const body = document.getElementById("invoices-body");
    body.innerHTML = "";
    invoices.forEach((inv) => {
      const tr = document.createElement("tr");
      tr.dataset.testid = `invoice-row-${inv.id}`;
      tr.innerHTML = `
        <td>${inv.id}</td>
        <td>${inv.customerName}</td>
        <td data-testid="invoice-total-${inv.id}">$${inv.total.toFixed(2)}</td>
        <td><span class="status status-${inv.status}" data-testid="invoice-status-${inv.id}">${inv.status}</span></td>
        <td>
          ${inv.status === "draft" ? `<button class="secondary" data-send="${inv.id}" data-testid="send-btn-${inv.id}">Send</button>` : ""}
          ${inv.status === "sent" || inv.status === "payment_failed" ? `<button data-pay="${inv.id}" data-testid="pay-btn-${inv.id}">Charge card</button>` : ""}
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll("button[data-send]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api(`/api/invoices/${btn.dataset.send}/send`, { method: "POST" });
        await refreshInvoices();
      });
    });
    body.querySelectorAll("button[data-pay]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const cardNumber = prompt("Card number (use 4000000000000002 to simulate a decline)", "4242424242424242");
        if (!cardNumber) return;
        try {
          await api(`/api/payments/${btn.dataset.pay}`, { method: "POST", body: JSON.stringify({ cardNumber }) });
        } catch (_) { /* decline surfaces via refreshed status */ }
        await refreshInvoices();
      });
    });
  }

  // BUG (seeded for the E2E showcase — see tests/e2e/duplicate-invoice.spec.ts):
  // the submit button is never disabled while the request is in flight, so a
  // fast double-click (or a slow network) fires two POST /api/invoices calls
  // and creates two identical invoices for the same order.
  const invoiceForm = document.getElementById("invoice-form");
  invoiceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("invoice-error");
    errorEl.textContent = "";
    const payload = {
      customerId: document.getElementById("customer-select").value,
      lineItems: [{
        description: document.getElementById("li-desc").value,
        qty: Number(document.getElementById("li-qty").value),
        unitPrice: Number(document.getElementById("li-price").value),
      }],
      percentDiscount: Number(document.getElementById("percent-discount").value),
      flatDiscount: Number(document.getElementById("flat-discount").value),
      taxRate: Number(document.getElementById("tax-rate").value),
    };
    try {
      await api("/api/invoices", { method: "POST", body: JSON.stringify(payload) });
      await refreshInvoices();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  init();
}
