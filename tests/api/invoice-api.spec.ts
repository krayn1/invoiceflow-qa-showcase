import { test, expect } from "@playwright/test";
import { DEMO_USER } from "../fixtures/base";

test.describe("Invoice & payments API", () => {
  let token: string;

  test.beforeEach(async ({ request, baseURL }) => {
    await request.post(`${baseURL}/api/test/reset`);
    const res = await request.post(`${baseURL}/api/login`, { data: DEMO_USER });
    token = (await res.json()).token;
  });

  test("rejects requests without a valid session token", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/invoices`);
    expect(res.status()).toBe(401);
  });

  test("rejects invoice creation with no line items", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/invoices`, {
      headers: { "X-Session-Token": token },
      data: { customerId: "cust_1", lineItems: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects invoice creation for an unknown customer", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/invoices`, {
      headers: { "X-Session-Token": token },
      data: { customerId: "does_not_exist", lineItems: [{ description: "x", qty: 1, unitPrice: 10 }] },
    });
    expect(res.status()).toBe(404);
  });

  test("a valid test card marks the invoice paid", async ({ request, baseURL }) => {
    const invRes = await request.post(`${baseURL}/api/invoices`, {
      headers: { "X-Session-Token": token },
      data: { customerId: "cust_2", lineItems: [{ description: "Consulting", qty: 2, unitPrice: 50 }], taxRate: 0 },
    });
    const invoice = await invRes.json();
    await request.post(`${baseURL}/api/invoices/${invoice.id}/send`, { headers: { "X-Session-Token": token } });

    const payRes = await request.post(`${baseURL}/api/payments/${invoice.id}`, {
      headers: { "X-Session-Token": token },
      data: { cardNumber: "4242424242424242" },
    });
    expect(payRes.status()).toBe(200);
    expect((await payRes.json()).invoice.status).toBe("paid");
  });

  test("a declined test card retries then lands on overdue after max attempts (dunning)", async ({ request, baseURL }) => {
    const invRes = await request.post(`${baseURL}/api/invoices`, {
      headers: { "X-Session-Token": token },
      data: { customerId: "cust_1", lineItems: [{ description: "Support plan", qty: 1, unitPrice: 100 }], taxRate: 0 },
    });
    const invoice = await invRes.json();
    await request.post(`${baseURL}/api/invoices/${invoice.id}/send`, { headers: { "X-Session-Token": token } });

    let lastBody: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await request.post(`${baseURL}/api/payments/${invoice.id}`, {
        headers: { "X-Session-Token": token },
        data: { cardNumber: "4000000000000002" },
      });
      lastBody = await res.json();
      if (attempt < 3) {
        expect(lastBody.invoice.status).toBe("payment_failed");
      }
    }
    expect(lastBody.invoice.status).toBe("overdue");
    expect(lastBody.attempts).toBe(3);
  });
});
