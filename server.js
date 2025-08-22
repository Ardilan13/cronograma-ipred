"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

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
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/cronograma", cronogramaRoutes);

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve frontend
app.get("/", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

// Graceful shutdown (solo si no es serverless)
if (!process.env.VERCEL) {
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
