import { test as base, request } from "@playwright/test";
import type { Page } from "@playwright/test";

export const DEMO_USER = { email: "demo@invoiceflow.test", password: "Demo1234!" };

type Fixtures = {
  /** A page that is already authenticated (session token seeded before first navigation)
   *  and pointed at a freshly-reset server, so every test starts from a clean, known state. */
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  authedPage: async ({ page, baseURL }, use) => {
    const api = await request.newContext({ baseURL });
    await api.post("/api/test/reset");
    const loginRes = await api.post("/api/login", { data: DEMO_USER });
    const { token, name } = await loginRes.json();
    await api.dispose();

    await page.addInitScript(
      ([t, n]) => {
        window.sessionStorage.setItem("token", t as string);
        window.sessionStorage.setItem("name", n as string);
      },
      [token, name]
    );

    await use(page);
  },
});

export { expect } from "@playwright/test";
