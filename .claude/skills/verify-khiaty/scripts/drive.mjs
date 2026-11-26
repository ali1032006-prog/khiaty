#!/usr/bin/env node
// Drive the running verification instance through the real UI with your installed Google Chrome.
// Usage: scripts/drive.sh <journey> [--headed]   (the wrapper sets APP_URL, DEMO_PASSWORD, EVIDENCE_DIR)
// Every step saves <n>-<step>.png and <n>-<step>.aria.txt under $EVIDENCE_DIR/<journey>-<time>/.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.DEMO_PASSWORD ?? "verify-demo-password";
const [journeyName, ...flags] = process.argv.slice(2);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(process.env.EVIDENCE_DIR ?? ".verify-evidence", `${journeyName}-${stamp}`);

let step = 0;
async function proof(page, name) {
  step += 1;
  const base = join(outDir, `${String(step).padStart(2, "0")}-${name}`);
  await page.screenshot({ path: `${base}.png`, fullPage: true });
  writeFileSync(`${base}.aria.txt`, `${page.url()}\n\n${await page.locator("body").ariaSnapshot()}`);
  console.log(`proof ${base}.png`);
}

async function login(page, email) {
  await page.goto(`${APP}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function logout(page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(`${APP}/login`);
}

const TITLE = `Verify: shorten a linen shirt ${stamp.slice(11, 19)}`;

const journeys = {
  // Feature: auth.md. Customer and tailor each land on their own home page.
  async "sign-in"(page) {
    await login(page, "customer1@demo.test");
    await page.getByRole("heading", { name: "My requests" }).waitFor();
    await proof(page, "customer-home");
    await logout(page);
    await login(page, "tailor1@demo.test");
    await page.getByRole("heading", { name: "Open requests" }).waitFor();
    await proof(page, "tailor-home");
    await logout(page);
    await page.goto(`${APP}/customer`);
    await page.waitForURL(`${APP}/login`);
    await proof(page, "signed-out-redirect");
  },

  // Feature: post-request.md. Customer posts a request; it shows on its page and on My requests.
  async "post-request"(page) {
    await login(page, "customer1@demo.test");
    await page.getByRole("link", { name: "New request" }).click();
    await page.getByLabel("Title").fill(TITLE);
    await page.getByLabel("Description").fill("Take 4 cm off the sleeves and the hem. Pick-up any weekday.");
    await page.getByLabel("Budget (USD)").fill("35");
    await proof(page, "form-filled");
    await page.getByRole("button", { name: "Post request" }).click();
    await page.waitForURL(/\/requests\/[^/]+$/);
    await page.getByRole("heading", { name: TITLE }).waitFor();
    await proof(page, "request-page");
    await page.goto(`${APP}/customer`);
    await page.getByRole("link", { name: new RegExp(TITLE) }).waitFor();
    await proof(page, "my-requests-list");
  },

  // Feature: bid-and-accept.md. Customer posts, tailor bids blind, customer accepts the bid.
  async "bid-and-accept"(page) {
    await journeys["post-request"](page);
    await logout(page);
    await login(page, "tailor1@demo.test");
    await page.getByRole("link", { name: new RegExp(TITLE) }).click();
    await page.getByLabel("Price (USD)").fill("30");
    await page.getByLabel("Timeline (days)").fill("4");
    await page.getByLabel("Note to customer").fill("Can do both by Friday.");
    await page.getByRole("button", { name: "Submit bid" }).click();
    await page.getByRole("heading", { name: "Your bid" }).waitFor();
    await proof(page, "tailor-bid-placed");
    await logout(page);
    await login(page, "customer1@demo.test");
    await page.getByRole("link", { name: new RegExp(TITLE) }).click();
    await page.getByRole("button", { name: "Accept" }).first().click();
    await page.waitForURL(/\/orders\/[^/]+$/);
    await proof(page, "order-created");
  },
};

if (!journeys[journeyName]) {
  console.error(`Usage: node drive.mjs <${Object.keys(journeys).join("|")}> [--headed]`);
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: !flags.includes("--headed") });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await journeys[journeyName](page);
  console.log(`PASS ${journeyName} evidence=${outDir}`);
} catch (e) {
  await proof(page, "failure").catch(() => {});
  console.error(`FAIL ${journeyName}: ${e.message.split("\n")[0]} evidence=${outDir}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
