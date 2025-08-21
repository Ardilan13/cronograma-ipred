// server.js optimizado para Vercel
"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const chromium = require("@sparticuz/chromium");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL =
  `${process.env.BASE_URL}:${PORT}` || `http://localhost:${PORT}`;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------------------------- Config/constantes ---------------------------- */
const UIS_URL =
  "https://ipredtic.uis.edu.co/plataformaticv2/?view=cronogramaPublico";

const DEFAULTS = {
  programa: "82",
  sede: "10",
  recurso: "2",
};

const isNumStr = (v) => typeof v === "string" && /^[0-9]+$/.test(v);

/* --------------------------- Configuración del navegador para Vercel -------------------------- */
async function getBrowserForVercel() {
  // Configuración específica para Vercel
  const isVercel = process.env.RENDER;
  const isLocal = !isVercel;
  const puppeteer = isLocal ? require("puppeteer") : require("puppeteer-core");

  if (isLocal) {
    // Local development
    return await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  // Para Vercel - configuración optimizada
  return await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process", // Importante para Vercel
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
}

/* ------------------------------- Cache simple ------------------------------ */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

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
  const browser = await getBrowserForVercel();
  const page = await browser.newPage();

  // Viewport más pequeño para Vercel
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });

  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Interceptar y bloquear recursos innecesarios
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const rtype = req.resourceType();
    if (
      rtype === "image" ||
      rtype === "stylesheet" ||
      rtype === "font" ||
      rtype === "media"
    ) {
      return req.abort();
    }
    return req.continue();
  });

  return { browser, page };
}

/* ------------------------------- Core scrape ------------------------------- */
async function fetchCronograma(
  { programa, sede, recurso },
  { retries = 1 } = {} // Menos reintentos en Vercel
) {
  let attempt = 0;
  let lastErr;

  while (attempt <= retries) {
    let browser;
    let page;

    try {
      const browserData = await newOptimizedPage();
      browser = browserData.browser;
      page = browserData.page;

      // Timeouts más cortos para Vercel
      page.setDefaultNavigationTimeout(15000);
      page.setDefaultTimeout(15000);

      await page.goto(UIS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      // Asegurar existencia de selects
      await page.waitForSelector('[name="Programa"]', {
        visible: true,
        timeout: 10000,
      });
      await page.waitForSelector('[name="Sede"]', {
        visible: true,
        timeout: 10000,
      });
      await page.waitForSelector('[name="recurso"]', {
        visible: true,
        timeout: 10000,
      });

      // Seleccionar valores
      await page.select('[name="Programa"]', programa);
      await page.select('[name="Sede"]', sede);
      await page.select('[name="recurso"]', recurso);

      const btnBuscar = await page.$("#search");
      if (!btnBuscar)
        throw new Error("No se encontró el botón #search en la página.");

      // Esperar la respuesta
      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("buscarCronograma") &&
            res.request().method() === "POST" &&
            res.status() === 200,
          { timeout: 15000 }
        ),
        btnBuscar.click(),
      ]);

      const raw = await response.text();
      const data = JSON.parse(raw);

      // Cerrar inmediatamente para liberar recursos
      await page.close().catch(() => {});
      await browser.close().catch(() => {});

      return data;
    } catch (err) {
      lastErr = err;

      // Asegurar que se cierren los recursos
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});

      attempt++;
      if (attempt > retries) break;

      // Backoff más corto
      const delay = 1000 * attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr || new Error("Fallo desconocido al obtener cronograma");
}

/* -------------------------------- Endpoints -------------------------------- */
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
    res.status(500).json({
      success: false,
      message: error.message,
      platform: process.env.VERCEL ? "vercel" : "other",
    });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en ${BASE_URL}`);
});

// No es necesario el graceful shutdown en Vercel serverless
if (!process.env.VERCEL) {
  process.on("SIGINT", () => {
    console.log("\n⏳ Cerrando servidor...");
    server.close(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
}
