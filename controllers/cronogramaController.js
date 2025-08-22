const { newOptimizedPage } = require("../utils/browser");
const { DEFAULTS, UIS_URL } = require("../config/constants");
const { isNumStr } = require("../utils/helpers");
const { getFromCache, setCache } = require("../utils/cache");

async function fetchCronograma(params, retries = 1) {
  let attempt = 0;
  let lastErr;

  while (attempt <= retries) {
    let browser, page;
    try {
      const browserData = await newOptimizedPage();
      browser = browserData.browser;
      page = browserData.page;

      page.setDefaultNavigationTimeout(15000);
      page.setDefaultTimeout(15000);

      await page.goto(UIS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

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

      await page.select('[name="Programa"]', params.programa);
      await page.select('[name="Sede"]', params.sede);
      await page.select('[name="recurso"]', params.recurso);

      const btnBuscar = await page.$("#search");
      if (!btnBuscar)
        throw new Error("No se encontró el botón #search en la página.");

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

      await page.close().catch(() => {});
      await browser.close().catch(() => {});

      return data;
    } catch (err) {
      lastErr = err;
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      attempt++;
      if (attempt > retries) break;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastErr || new Error("Fallo desconocido al obtener cronograma");
}

async function getCronograma(req, res) {
  const body = req.body || {};
  const programa = isNumStr(body.programa) ? body.programa : DEFAULTS.programa;
  const sede = isNumStr(body.sede) ? body.sede : DEFAULTS.sede;
  const recurso = isNumStr(body.jornada)
    ? body.jornada
    : isNumStr(body.recurso)
    ? body.recurso
    : DEFAULTS.recurso;

  const params = { programa, sede, recurso };
  const key = `${params.programa}-${params.sede}-${params.recurso}`;

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
      platform: process.env.RENDER ? "vercel" : "other",
    });
  }
}

module.exports = { getCronograma };
