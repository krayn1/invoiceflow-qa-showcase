import { test, expect } from "../fixtures/base";

/**
 * BUG REGRESSION — mid-cycle upgrade proration
 * ---------------------------------------------------------------
 * Business rule: when a customer upgrades plans mid-cycle, the
 * credit/charge must be prorated against the ACTUAL number of days
 * in the current billing month.
 *
 * Found: the proration engine divided by a hardcoded 30-day month.
 * That's correct for exactly 4 months a year and silently wrong for
 * the other 8 — worst in February, where it under/over-bills by the
 * equivalent of ~2 extra "phantom" days every single cycle.
 * See app/server.js `POST /api/customers/:id/upgrade`.
 */
test.describe("Mid-cycle plan upgrade proration", () => {
  test("prorates against the actual days in a 28-day February, not a flat 30", async ({ authedPage, baseURL }) => {
    // Northwind Traders (cust_1): Starter ($29/mo) -> Growth ($99/mo) on Feb 10, 2026.
    // Feb 2026 has 28 days. Correct: 19 days remain (Feb 10 -> Feb 28 inclusive).
    //   credit = 29/28 * 19 = 19.68, charge = 99/28 * 19 = 67.18, due today = 47.50
    const res = await authedPage.request.post(`${baseURL}/api/customers/cust_1/upgrade`, {
      data: { newPlanId: "growth", today: "2026-02-10" },
    });
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.totalDaysInCycle).toBe(28);
    expect(body.daysRemaining).toBe(19);
    expect(body.proratedAmount).toBeCloseTo(47.5, 2);
  });

  test("prorates correctly in a 30-day month as a control case", async ({ authedPage, baseURL }) => {
    // Contoso Logistics (cust_2): Growth ($99/mo) -> Scale ($299/mo) on Apr 10, 2026 (30 days).
    // 21 days remain. credit = 99/30*21 = 69.30, charge = 299/30*21 = 209.30, due = 140.00
    const res = await authedPage.request.post(`${baseURL}/api/customers/cust_2/upgrade`, {
      data: { newPlanId: "scale", today: "2026-04-10" },
    });
    const body = await res.json();
    expect(body.totalDaysInCycle).toBe(30);
    expect(body.proratedAmount).toBeCloseTo(140, 2);
  });
});
