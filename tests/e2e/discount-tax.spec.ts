import { test, expect } from "../fixtures/base";
import { DashboardPage } from "../pages/DashboardPage";

/**
 * BUG REGRESSION — tax base
 * ---------------------------------------------------------------
 * Business rule: tax is owed on what the customer actually pays,
 * i.e. AFTER percent and flat discounts are applied — not on the
 * pre-discount subtotal.
 *
 * Found: the invoice engine was taxing the pre-discount subtotal,
 * over-collecting tax on every discounted invoice. On a $1,000
 * invoice with a 10% + $20 discount at 8% tax, that's a $9.60
 * overcharge — a real compliance/refund liability at scale, not a
 * rounding error. See app/server.js `computeInvoiceTotals`.
 */
test.describe("Invoice discount + tax calculation", () => {
  test("tax is charged on the post-discount amount, not the pre-discount subtotal", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    // $1000 subtotal, 10% off + $20 flat off => $880 taxable amount.
    // At 8% tax that is $70.40 tax and a $950.40 total — NOT $960.00.
    await dashboard.createInvoice({ qty: 1, unitPrice: 1000, percentDiscount: 10, flatDiscount: 20, taxRate: 8 });

    const row = dashboard.invoicesBody.locator("tr").first();
    await expect(row).toContainText("$950.40");
  });

  test("no discount and no tax simply totals the line items", async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.createInvoice({ qty: 3, unitPrice: 150, percentDiscount: 0, flatDiscount: 0, taxRate: 0 });

    const row = dashboard.invoicesBody.locator("tr").first();
    await expect(row).toContainText("$450.00");
  });
});
