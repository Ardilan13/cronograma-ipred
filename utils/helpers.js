exports.isNumStr = (v) => typeof v === "string" && /^[0-9]+$/.test(v);
exports.cacheKey = (params) =>
  `${params.programa}-${params.sede}-${params.recurso}`;
