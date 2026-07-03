import type { Page, Locator } from "@playwright/test";

export type InvoiceLineItemInput = {
  qty: number;
  unitPrice: number;
  percentDiscount?: number;
  flatDiscount?: number;
  taxRate?: number;
};

export class DashboardPage {
  readonly page: Page;
  readonly customerSelect: Locator;
  readonly lineItemDesc: Locator;
  readonly lineItemQty: Locator;
  readonly lineItemPrice: Locator;
  readonly percentDiscount: Locator;
  readonly flatDiscount: Locator;
  readonly taxRate: Locator;
  readonly createInvoiceSubmit: Locator;
  readonly invoiceError: Locator;
  readonly invoicesBody: Locator;
  readonly customersBody: Locator;

  constructor(page: Page) {
    this.page = page;
    this.customerSelect = page.getByTestId("invoice-customer");
    this.lineItemDesc = page.getByTestId("line-item-desc");
    this.lineItemQty = page.getByTestId("line-item-qty");
    this.lineItemPrice = page.getByTestId("line-item-price");
    this.percentDiscount = page.getByTestId("invoice-percent-discount");
    this.flatDiscount = page.getByTestId("invoice-flat-discount");
    this.taxRate = page.getByTestId("invoice-tax-rate");
    this.createInvoiceSubmit = page.getByTestId("create-invoice-submit");
    this.invoiceError = page.getByTestId("invoice-error");
    this.invoicesBody = page.getByTestId("invoices-body");
    this.customersBody = page.getByTestId("customers-body");
  }

  async goto() {
    await this.page.goto("/dashboard.html");
  }

  async fillInvoiceForm(input: InvoiceLineItemInput) {
    await this.lineItemQty.fill(String(input.qty));
    await this.lineItemPrice.fill(String(input.unitPrice));
    await this.percentDiscount.fill(String(input.percentDiscount ?? 0));
    await this.flatDiscount.fill(String(input.flatDiscount ?? 0));
    await this.taxRate.fill(String(input.taxRate ?? 0));
  }

  async createInvoice(input: InvoiceLineItemInput) {
    await this.fillInvoiceForm(input);
    await this.createInvoiceSubmit.click();
  }

  invoiceRow(invoiceId: string) {
    return this.page.getByTestId(`invoice-row-${invoiceId}`);
  }

  invoiceTotalCell(invoiceId: string) {
    return this.page.getByTestId(`invoice-total-${invoiceId}`);
  }

  upgradeButtonForCustomer(customerId: string) {
    return this.page.getByTestId(`upgrade-btn-${customerId}`);
  }

  customerPlanCell(customerId: string) {
    return this.page.getByTestId(`customer-plan-${customerId}`);
  }
}
