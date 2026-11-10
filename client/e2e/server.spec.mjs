import { test, expect } from "@playwright/test";
import { createApp } from "../../ops/server.js";
import { createStore } from "../../ops/store.js";
import { resolve } from "node:path";
import { analyze } from "../src/domain/engine.js";

test("built workspace uses authenticated SQLite API from review through receipt", async ({
  page,
}) => {
  const store = createStore(":memory:");
  const server = createApp({
    store,
    token: "e2e-operator-token",
    staticDir: resolve(import.meta.dirname, "../dist"),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await expect(
      page.getByText("Local API connected", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Workspace settings", exact: true })
      .click();
    await page.getByLabel("Operator API token").fill("e2e-operator-token");
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.getByRole("button", { name: "Decision inbox" }).click();
    await page
      .getByRole("button", { name: /Review / })
      .first()
      .click();
    await page.getByRole("button", { name: "Approve transfer" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(store.read().version).toBe(2);
    await page.getByRole("button", { name: "Transfer orders" }).click();
    await page.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(page.getByText("Received", { exact: true })).toBeVisible();
    expect(store.read().version).toBe(3);
    expect(store.verify().valid).toBe(true);
    expect(store.verify().events).toBe(2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});

test("missing credentials open settings and stale approvals refresh the workspace", async ({
  page,
}) => {
  const store = createStore(":memory:");
  const server = createApp({
    store,
    token: "e2e-operator-token",
    staticDir: resolve(import.meta.dirname, "../dist"),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await expect(
      page.getByText("Local API connected", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Decision inbox" }).click();
    await page
      .getByRole("button", { name: /Review / })
      .first()
      .click();
    await page.getByRole("button", { name: "Approve transfer" }).click();
    await expect(
      page.getByRole("dialog", { name: "Workspace settings", exact: true }),
    ).toBeVisible();
    expect(store.read().version).toBe(1);
    await page.getByLabel("Operator API token").fill("e2e-operator-token");
    await page.getByRole("button", { name: "Close settings" }).click();
    const current = store.read(),
      r = analyze(current).recommendations[0];
    store.commit({
      id: r.id,
      action: "approved",
      expectedVersion: 1,
      requestId: "other-operator",
    });
    await page.getByRole("button", { name: "Approve transfer" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "Workspace updated after another decision",
    );
    expect(store.read().version).toBe(2);
    await page
      .getByRole("button", { name: /Review / })
      .first()
      .click();
    await page.getByRole("button", { name: "Approve transfer" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(store.read().version).toBe(3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});
