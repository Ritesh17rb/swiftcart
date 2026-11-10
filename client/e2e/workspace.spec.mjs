import { test, expect } from "@playwright/test";
import { createSeed } from "../src/domain/seed.js";
import { inventoryTemplate } from "../src/domain/ingestion.js";

test("operator can review, reserve, receive, and inspect the audit trail", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Browser sandbox", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inventory command center" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Decision inbox" }).click();
  await page
    .getByRole("button", { name: /Review / })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Approve transfer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Transfer orders" }).click();
  await expect(page.getByText("Reserved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Browser sandbox", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Transfer orders" }).click();
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(page.getByText("Received", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Decision ledger" }).click();
  await expect(page.getByText(/Transfer approved/)).toBeVisible();
  await expect(page.getByText(/Transfer received/)).toBeVisible();
  expect(errors).toEqual([]);
});
test("scenario inputs produce a result and copilot cites evidence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Browser sandbox", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Scenario lab" }).click();
  await page.getByRole("button", { name: "Festival spike" }).click();
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByText("SIMULATION COMPLETE")).toBeVisible();
  await page.getByRole("button", { name: "Operations copilot" }).click();
  await page
    .getByRole("textbox", { name: "Ask operations copilot" })
    .fill("What is happening in Bengaluru?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(
    page.getByText("Retrieved evidence", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("E1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Model evaluation" }).click();
  await expect(page.getByText("1,344", { exact: true })).toBeVisible();
});
test("mobile layout stays inside viewport and navigation works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Inventory command center" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Inventory network" }).click();
  await expect(
    page.getByRole("heading", { name: "Every unit. Every location." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("validated inventory intake updates provenance and records an event", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Browser sandbox", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Data intake", exact: true }).click();
  await page
    .getByLabel("Upload inventory CSV")
    .setInputFiles({
      name: "snapshot.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(inventoryTemplate(createSeed())),
    });
  await expect(
    page.getByText("Validation passed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import validated snapshot" }).click();
  await expect(
    page.getByText("IMPORTED INVENTORY DATA", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Decision ledger" }).click();
  await expect(
    page.getByText("Inventory snapshot imported", { exact: true }),
  ).toBeVisible();
});
