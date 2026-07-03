import { test, expect } from "../fixtures/base";
import { DashboardPage } from "../pages/DashboardPage";

/**
 * BUG REGRESSION — duplicate invoice on double submit
 * ---------------------------------------------------------------
 * Found: the "Create invoice" button was never disabled while the
 * request was in flight. An impatient double-click (or a slow
 * network causing a user to click twice) fired two POST /api/invoices
 * calls and billed the customer twice for the same order — the kind
 * of silent duplicate-charge bug that shows up as a support ticket
 * and a chargeback, not a stack trace. See app/public/app.js.
 */
test.describe("Invoice creation — duplicate submission", () => {
  test("rapid double-click on Create invoice produces exactly one invoice", async ({ authedPage, baseURL }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();
    await dashboard.fillInvoiceForm({ qty: 1, unitPrice: 500, taxRate: 0 });

    await Promise.all([dashboard.createInvoiceSubmit.click(), dashboard.createInvoiceSubmit.click()]);

    // Give both potential requests time to land before asserting.
    await authedPage.waitForTimeout(500);

    const res = await authedPage.request.get(`${baseURL}/api/invoices`);
    const invoices = await res.json();
    expect(invoices).toHaveLength(1);
  });
});
