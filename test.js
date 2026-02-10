const express = require("express");
const cors = require("cors");

const app = express();

// Permitir CORS (puedes restringir a tu dominio luego)
app.use(cors());

// Para leer form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/api/cronograma", async (req, res) => {
  try {
    const payload = new URLSearchParams(req.body).toString();

    const response = await fetch(
      "https://ipredtic.uis.edu.co/plataformaticv2/?ajax=CronogramaPublico&action=buscarCronograma",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      },
    );

    const text = await response.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(text);
  } catch (error) {
    console.error("Error proxy:", error);
    res.status(500).json({
      success: false,
      message: "Error consultando cronograma",
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log("Proxy corriendo en puerto", PORT);
});
