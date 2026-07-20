import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
await ctx.route("**/auth/me", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"username":"JOSEG"}' }));
await ctx.route("**/api/boxes**", r => r.fulfill({ status: 200, contentType: "application/json",
  body: JSON.stringify({ ROWSET: { ROW: [{ ID_BOX: 1, DESCRIPCION: "Box uno" }] } }) }));
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("cleancar.auth", JSON.stringify({ username: "JOSEG", token: "T" })));
await page.goto("http://localhost:8080/boxes", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("URL " + page.url());
console.log("H1 '" + (await page.locator("h1").first().textContent()) + "'");
console.log("TIENE_BOTON_NUEVO " + await page.getByRole("button", { name: /Nuevo/ }).count());
console.log("TIENE_JORNADA(home) " + await page.getByText("Jornada de hoy").count());
await page.screenshot({ path: process.argv[2] + "/boxes-nosw.png" });
await browser.close();
