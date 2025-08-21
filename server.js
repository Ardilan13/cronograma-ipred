const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/cronograma", async (req, res) => {
  try {
    const { programa, sede, jornada } = req.body;

    // 1. Lanzar navegador
    const browser = await puppeteer.launch({
      headless: true, // Para debug visual, cámbialo a true en producción
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    // 2. Ir a la página oficial
    await page.goto(
      "https://ipredtic.uis.edu.co/plataformaticv2/?view=cronogramaPublico",
      { waitUntil: "domcontentloaded" }
    );

    // 3. Verificar que el formulario existe
    await page.waitForSelector('[name="Programa"]', { visible: true });

    // 4. Llenar filtros predeterminados
    await page.select('[name="Programa"]', "82");
    await page.select('[name="Sede"]', "10");
    await page.select('[name="recurso"]', "2");

    // 5. Verificar botón "Buscar"
    const btnBuscar = await page.$("#search");
    if (!btnBuscar) {
      await browser.close();
    }

    // 6. Capturar la respuesta REAL de la petición
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("buscarCronograma") && res.status() === 200
      ),
      btnBuscar.click(),
    ]);

    // 7. Obtener la respuesta como texto o JSON
    const contentType = response.headers()["content-type"];
    let data;

    // Forzar que la respuesta siempre sea JSON
    let rawData;
    try {
      rawData = await response.text();
      data = JSON.parse(rawData); // 👈 Forzamos a objeto real
    } catch (e) {
      console.error("❌ Error parseando JSON del cronograma:", e);
      throw new Error("La respuesta de UIS no es un JSON válido");
    }

    await browser.close();

    // 8. Enviar la respuesta cruda al cliente
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error obteniendo cronograma:", error);
    res.status(500).send("Error cargando cronograma: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
