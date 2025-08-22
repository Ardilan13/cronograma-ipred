"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const cronogramaRoutes = require("./routes/cronograma");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/cronograma", cronogramaRoutes);

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

// Graceful shutdown (solo si no es serverless)
if (!process.env.RENDER) {
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
