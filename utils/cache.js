const { CACHE_TTL_MS } = require("../config/constants");
const cache = new Map();

exports.getFromCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

exports.setCache = (key, data) => cache.set(key, { t: Date.now(), data });
