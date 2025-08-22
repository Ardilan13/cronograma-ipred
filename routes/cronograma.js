const express = require("express");
const router = express.Router();
const { getCronograma } = require("../controllers/cronogramaController");

router.post("/", getCronograma);

module.exports = router;
