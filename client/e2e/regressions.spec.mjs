import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSeed } from "../src/domain/seed.js";
import { inventoryTemplate } from "../src/domain/ingestion.js";

const ready = async (page) => {
  await page.goto("/");
  await expect(
    page.getByText("Browser sandbox", { exact: true }),
  ).toBeVisible();
};

test("navigation survives reload and browser back/forward", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Inventory network", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/inventory-network$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Every unit. Every location." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Scenario lab", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Every unit. Every location." }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "What if things change?" }),
  ).toBeVisible();
});

test("scenario exports the simulated inputs and invalidates when the horizon changes", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Scenario lab", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export simulation" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Festival spike" }).click();
  await page.getByRole("button", { name: "Run simulation" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export simulation" }).click();
  const download = await downloadEvent;
  const data = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(data.kind).toBe("simulation");
  expect(data.options.multiplier).toBe(1.5);
  expect(data.options.horizon).toBe(14);
  await page.getByLabel("Planning horizon").selectOption("7");
  await expect(page.getByText("SIMULATION COMPLETE")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export simulation" }),
  ).toBeDisabled();
});

test("zero-demand imports render finite chart paths and unavailable WAPE", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  const zero = createSeed();
  for (const product of zero.products)
    for (const node of product.nodes) node.history.fill(0);
  await page.getByRole("button", { name: "Data intake", exact: true }).click();
  await page
    .getByLabel("Upload inventory CSV")
    .setInputFiles({
      name: "zero.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(inventoryTemplate(zero)),
    });
  await page.getByRole("button", { name: "Import validated snapshot" }).click();
  await expect(
    page.getByText("IMPORTED INVENTORY DATA", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByLabel("Planning horizon").selectOption("30");
  const chart = page.getByRole("img", {
    name: "Daily demand: 21 historical days and 30 forecast days",
  });
  await expect(chart).toBeVisible();
  expect(await chart.evaluate((el) => el.outerHTML)).not.toMatch(
    /NaN|Infinity/,
  );
  await page
    .getByRole("button", { name: "Model evaluation", exact: true })
    .click();
  await expect(page.getByText("N/A", { exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("malformed saved inventory can be recovered without a blank screen", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "reflow.workspace.v2",
      JSON.stringify({ version: 1, products: [{}], decisions: [], audit: [] }),
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Saved browser data could not be loaded",
  );
  await page.getByRole("button", { name: "Recover workspace" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Reset browser sandbox", exact: true })
    .click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Decision inbox", exact: false })
    .click();
  await page
    .getByRole("button", { name: /Review / })
    .first()
    .click();
  await page.getByRole("button", { name: "Approve transfer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a decision in one tab updates the other tab without reloading", async ({
  page,
  context,
}) => {
  await ready(page);
  const second = await context.newPage();
  await ready(second);
  await second
    .getByRole("button", { name: "Transfer orders", exact: true })
    .click();
  await expect(
    second.getByText("Your first transfer starts with a decision."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Decision inbox", exact: false })
    .click();
  await page
    .getByRole("button", { name: /Review / })
    .first()
    .click();
  await page.getByRole("button", { name: "Approve transfer" }).click();
  await expect(second.getByText("Reserved", { exact: true })).toBeVisible();
  await second.close();
});

test("inventory filters and exports refer to the same visible stock positions", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Inventory network", exact: true })
    .click();
  await page.getByLabel("Location filter").selectOption("blr");
  await page.getByLabel("Search products or locations").fill("linen");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export data", exact: true }).click();
  const download = await downloadEvent;
  const data = await readFile(await download.path(), "utf8");
  expect(data).toContain("Everyday linen shirt");
  expect(data).toContain("Bengaluru");
  expect(data.trim().split("\r\n")).toHaveLength(2);
  await page.getByLabel("Search products or locations").fill("nonexistent");
  await expect(page.getByText("No matching stock positions")).toBeVisible();
});
