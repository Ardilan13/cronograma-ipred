const chromium = require("@sparticuz/chromium");

async function getBrowser() {
  const puppeteer = process.env.RENDER
    ? require("puppeteer-core")
    : require("puppeteer");
  const isLocal = !process.env.RENDER;

  if (isLocal) {
    return puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  return puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: "new", // <-- cambio aquí
    ignoreHTTPSErrors: true,
  });
}

async function newOptimizedPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const blocked = ["image", "stylesheet", "font", "media"];
    blocked.includes(req.resourceType()) ? req.abort() : req.continue();
  });

  return { browser, page };
}

module.exports = { newOptimizedPage };
