# InvoiceFlow — E2E Test Automation Showcase

**A demo B2B subscription-billing platform, built end-to-end (app + test
suite), to show what happens when a QA automation engineer with a
full-stack background is let loose on a billing system before it ships.**

Built by Kray Nguyen — QA automation engineer with a full-stack
development background, currently focused on fintech-adjacent SaaS.

> This is a self-contained demo project, not a production system. The
> billing logic, plans, and pricing are illustrative.

## Why this exists

Billing bugs are the worst kind of bug: they don't crash anything, they
just quietly cost money — either yours (undercharging) or your
customers' trust (overcharging). This project builds a small but
realistic subscription-billing app (think: the invoicing/billing layer
of a B2B SaaS product) and then throws a real Playwright + TypeScript
E2E suite at it.

The suite found **three real bugs** in the app as originally built —
a proration miscalculation, a tax-base error, and a duplicate-invoice
race condition. The full write-up, with dollar-impact framing, is in
[`BUGS_FOUND.md`](./BUGS_FOUND.md). The git history shows the actual
red → green journey: tests added and failing, then the app fixed and
the suite passing.

## What this demonstrates

| Area | Where |
|---|---|
| E2E automation (Playwright + TypeScript) | `tests/e2e/` |
| API-level test automation | `tests/api/` |
| Page Object Model + custom fixtures | `tests/pages/`, `tests/fixtures/` |
| Multi-browser coverage (Chromium, Firefox, WebKit) | `playwright.config.ts` |
| CI/CD — tests run on every push | `.github/workflows/e2e-tests.yml` |
| Full-stack app development (Node/Express + vanilla JS frontend) | `app/` |
| Realistic business logic: proration, discounts/tax, dunning/retries | `app/server.js` |

## Tech stack

- **App under test:** Node.js, Express, vanilla JS/HTML/CSS (in-memory data — no DB setup required)
- **Test automation:** Playwright, TypeScript
- **CI:** GitHub Actions, HTML report published as a build artifact

## Running it locally

```bash
npm install
npx playwright install --with-deps   # one-time browser download

# Terminal 1 — run the app
npm start                             # http://localhost:3000

# Terminal 2 — run the full E2E + API suite
npm run test:e2e
npm run test:report                   # opens the HTML report
```

Demo login: `demo@invoiceflow.test` / `Demo1234!`
Test payment cards: `4242 4242 4242 4242` (succeeds), `4000 0000 0000 0002` (declines, triggers dunning retries)

CI runs the same suite automatically on every push via GitHub Actions
(see the badge/workflow run in the repo's Actions tab) and uploads the
HTML report as a downloadable artifact.

## What a client gets from this kind of work

- A test suite that runs against real user flows in a real browser, not just isolated functions
- A CI pipeline that blocks a broken deploy automatically
- Bug reports with clear reproduction steps and business-impact framing, not just "test failed"
- Page Object Model architecture that stays maintainable as the app grows
- API-level coverage for fast feedback, layered under the UI-level coverage for confidence

## Contact

Open to freelance/contract QA automation, full-stack development, and
backend/API automation work. See [my portfoliohttps://krayn1.github.io/ for more projects and
ways to get in touch.
