"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer"); // solo puppeteer
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL =
  `${process.env.BASE_URL}:${PORT}` || `http://localhost:${PORT}`;

app.use(cors({ origin: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------------------------- Config/constantes ---------------------------- */
const UIS_URL =
  "https://ipredtic.uis.edu.co/plataformaticv2/?view=cronogramaPublico";

const DEFAULTS = { programa: "82", sede: "10", recurso: "2" };
const isNumStr = (v) => typeof v === "string" && /^[0-9]+$/.test(v);

/* --------------------------- Navegador compartido -------------------------- */
let browser;

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;

  browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  return browser;
}

/* ------------------------------- Cache simple ------------------------------ */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(params) {
  return `${params.programa}-${params.sede}-${params.recurso}`;
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { t: Date.now(), data });
}

/* ----------------------------- Utilidades Page ----------------------------- */
async function newOptimizedPage() {
  const br = await getBrowser();
  const page = await br.newPage();

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const rtype = req.resourceType();
    if (["image", "stylesheet", "font", "media"].includes(rtype))
      return req.abort();
    return req.continue();
  });

  return page;
}

/* ------------------------------- Core scrape ------------------------------- */
async function fetchCronograma(
  { programa, sede, recurso },
  { retries = 2 } = {}
) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    const page = await newOptimizedPage();
    try {
      page.setDefaultNavigationTimeout(25000);
      page.setDefaultTimeout(25000);

      await page.goto(UIS_URL, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[name="Programa"]', { visible: true });
      await page.waitForSelector('[name="Sede"]', { visible: true });
      await page.waitForSelector('[name="recurso"]', { visible: true });

      await page.select('[name="Programa"]', programa);
      await page.select('[name="Sede"]', sede);
      await page.select('[name="recurso"]', recurso);

      const btnBuscar = await page.$("#search");
      if (!btnBuscar) throw new Error("No se encontró el botón #search.");

      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("buscarCronograma") &&
            res.request().method() === "POST" &&
            res.status() === 200,
          { timeout: 25000 }
        ),
        btnBuscar.click(),
      ]);

      const raw = await response.text();
      const data = JSON.parse(raw);
      await page.close().catch(() => {});
      return data;
    } catch (err) {
      lastErr = err;
      await page.close().catch(() => {});
      const delay = 500 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
      if (attempt > retries) break;
    }
  }
  throw lastErr || new Error("Fallo desconocido al obtener cronograma");
}

/* ------------------------------- Endpoints -------------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/cronograma", async (req, res) => {
  const body = req.body || {};
  const programa = isNumStr(body.programa) ? body.programa : DEFAULTS.programa;
  const sede = isNumStr(body.sede) ? body.sede : DEFAULTS.sede;
  const recurso = isNumStr(body.jornada)
    ? body.jornada
    : isNumStr(body.recurso)
    ? body.recurso
    : DEFAULTS.recurso;

  const params = { programa, sede, recurso };
  const key = cacheKey(params);

  try {
    const cached = getFromCache(key);
    if (cached)
      return res.json({ success: true, cached: true, params, data: cached });

    const data = await fetchCronograma(params);
    setCache(key, data);
    res.json({ success: true, cached: false, params, data });
  } catch (error) {
    console.error("❌ Error POST /cronograma:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en ${BASE_URL}`);
});

async function gracefulShutdown() {
  console.log("\n⏳ Cerrando servidor...");
  server.close(() => console.log("🛑 HTTP cerrado"));
  if (browser && browser.isConnected()) {
    try {
      await browser.close();
      console.log("🧹 Chromium cerrado");
    } catch {}
  }
  process.exit(0);
}
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
