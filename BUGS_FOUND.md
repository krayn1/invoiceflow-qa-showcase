# Bugs found by this test suite

This is the QA deliverable a client actually cares about: not "we wrote
some tests," but *here is what those tests caught before it reached a
customer, and here is what it would have cost.*

All three bugs below were real defects in this codebase, caught by the
Playwright suite in `tests/`, and fixed in a follow-up commit. The git
history tells the story directly — the test-adding commit is red against
the app as scaffolded; the fix commit turns it green:

```
e959d68 fix: correct proration math, tax base, and duplicate-invoice race condition
91ef474 test: add Playwright E2E + API regression suite   <- red here
31c5f40 feat: scaffold InvoiceFlow — B2B subscription billing platform
```

---

## Bug #1 — Mid-cycle plan upgrade proration used a hardcoded 30-day month

**Where:** `app/server.js`, `POST /api/customers/:id/upgrade`
**Caught by:** `tests/e2e/proration-billing.spec.ts`

The proration formula divided by a hardcoded `30` instead of the actual
number of days in the billing month. That's correct for exactly 4 months
a year (Apr, Jun, Sep, Nov) and silently wrong for the other 8 — worst in
February.

**Example:** a customer upgrading from a $29/mo plan to a $99/mo plan on
Feb 10 was charged **$49.00** instead of the correct **$47.50** — a $1.50
overcharge on a single transaction. That's not a rounding error, it's a
systematic bias that repeats on every mid-cycle upgrade, every month,
across the entire customer base. At a few hundred upgrades a month, that's
real, recurring, hard-to-notice revenue drift — the kind of bug that
doesn't show up until a customer disputes a charge or an auditor asks why
February billing doesn't reconcile.

## Bug #2 — Tax was calculated on the pre-discount subtotal

**Where:** `app/server.js`, `computeInvoiceTotals`
**Caught by:** `tests/e2e/discount-tax.spec.ts`

Tax should be owed on what the customer actually pays — after discounts —
not on the sticker price before discounts. The engine taxed the
pre-discount subtotal instead.

**Example:** a $1,000 invoice with a 10% + $20 discount should tax the
$880 the customer actually owes ($70.40 tax, $950.40 total). The buggy
version taxed the full $1,000 ($80.00 tax, $960.00 total) — a **$9.60
overcharge**, or 9.6% too much tax, on every discounted invoice. This
isn't just a customer-trust problem; over-collected sales tax is a
compliance and refund liability, and it compounds with every discounted
invoice sent.

## Bug #3 — Duplicate invoices from a fast double-click

**Where:** `app/public/app.js`, invoice creation form
**Caught by:** `tests/e2e/duplicate-invoice.spec.ts`

The "Create invoice" button was never disabled while the request was in
flight and had no re-entrancy guard. An impatient double-click (or a slow
network causing a user to click twice) fired two `POST /api/invoices`
requests and created two identical invoices for the same order.

This is the bug that's invisible in code review and invisible in a unit
test — it only shows up when something actually clicks the button twice
in a browser, which is exactly what an E2E suite is for. Left alone, it
becomes a support ticket ("why was I billed twice?") or a chargeback.

---

## Why this matters for hiring

Unit tests catch logic bugs in isolation. These three didn't need clever
edge cases — they needed someone to actually run the full user flow, in a
real browser, against the real API, the way a customer would. That's the
gap E2E automation closes, and it's the gap a $9.60 tax bug or a duplicate
$500 invoice sits in until someone finds it the hard way.
