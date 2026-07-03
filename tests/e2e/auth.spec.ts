import { test, expect } from "../fixtures/base";
import { LoginPage } from "../pages/LoginPage";
import { DEMO_USER } from "../fixtures/base";

test.describe("Authentication", () => {
  test.beforeEach(async ({ request, baseURL }) => {
    await request.post(`${baseURL}/api/test/reset`);
  });

  test("valid credentials sign the user in and land on the dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(DEMO_USER.email, DEMO_USER.password);

    await expect(page).toHaveURL(/dashboard\.html/);
    await expect(page.getByTestId("user-name")).toHaveText("Jordan Reyes");
  });

  test("invalid credentials show an inline error and keep the user on the login page", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(DEMO_USER.email, "wrong-password");

    await expect(login.errorMessage).toHaveText(/invalid email or password/i);
    await expect(page).toHaveURL(/index\.html/);
  });

  test("visiting the dashboard without a session redirects to login", async ({ page }) => {
    await page.goto("/dashboard.html");
    await expect(page).toHaveURL(/index\.html/);
  });
});
