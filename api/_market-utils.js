const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";

const ALLOWED_SYMBOLS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "XAU/USD",
  "BTC/USD",
  "ETH/USD",
  "US500",
  "WTI"
];

const ALLOWED_INTERVALS = ["1min", "5min", "15min", "30min", "1h", "4h", "1day"];

const MARKET_CACHE_MIN_MS = 15000;
const MARKET_CACHE_MAX_MS = 60000;
const MARKET_CACHE_DEFAULT_MS = 30000;
const marketResponseCache = new Map();
const marketPendingRequests = new Map();

const MARKET_ERROR_MESSAGES = {
  API_KEY_MISSING: "El servicio de mercado no esta configurado. Contacta a soporte.",
  PROVIDER_UNSUPPORTED: "El proveedor de datos de mercado no esta disponible.",
  SYMBOL_NOT_ALLOWED: "Este simbolo no esta disponible para operar en este momento.",
  INTERVAL_NOT_ALLOWED: "Esta temporalidad no esta disponible para este simbolo.",
  RATE_LIMIT: "El proveedor de mercado recibio demasiadas solicitudes. Intenta de nuevo en unos minutos.",
  NETWORK_ERROR: "No pudimos conectar con el proveedor de mercado. Revisa la conexion e intenta de nuevo.",
  SYMBOL_UNAVAILABLE: "No hay datos disponibles para este simbolo en este momento.",
  INTERVAL_UNAVAILABLE: "No hay datos disponibles para esta temporalidad.",
  MARKET_CLOSED: "El mercado parece estar cerrado o sin cotizacion reciente.",
  EMPTY_RESPONSE: "El proveedor no devolvio datos de mercado para esta consulta.",
  PROVIDER_ERROR: "No pudimos cargar datos de mercado en este momento."
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function marketError(code, developerMessage, details = {}) {
  return {
    error: "Market data error.",
    code,
    provider: "twelvedata",
    userMessage: MARKET_ERROR_MESSAGES[code] || MARKET_ERROR_MESSAGES.PROVIDER_ERROR,
    developerMessage,
    details
  };
}

function logMarketError(context, payload) {
  console.error("[market-data]", context, JSON.stringify(payload));
}

function marketCacheTtlMs() {
  const configured = Number(process.env.MARKET_DATA_CACHE_MS || MARKET_CACHE_DEFAULT_MS);
  if (!Number.isFinite(configured)) return MARKET_CACHE_DEFAULT_MS;
  return Math.min(MARKET_CACHE_MAX_MS, Math.max(MARKET_CACHE_MIN_MS, configured));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function marketCacheKey(endpoint, params) {
  const safeParams = Array.from(params.entries())
    .filter(([key]) => key !== "apikey")
    .sort(([a], [b]) => a.localeCompare(b));
  return endpoint + "?" + new URLSearchParams(safeParams).toString();
}

function cachedMarketResponse(cacheKey) {
  const entry = marketResponseCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    marketResponseCache.delete(cacheKey);
    return null;
  }

  return {
    ok: true,
    statusCode: entry.statusCode,
    payload: cloneJson(entry.payload),
    cache: {
      hit: true,
      key: cacheKey,
      expiresAt: entry.expiresAt
    }
  };
}

function storeMarketResponse(cacheKey, result) {
  if (!result.ok) return;
  marketResponseCache.set(cacheKey, {
    statusCode: result.statusCode,
    payload: cloneJson(result.payload),
    expiresAt: Date.now() + marketCacheTtlMs()
  });
}

function getQuery(req) {
  if (req.query) return req.query;
  const url = new URL(req.url || "/", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

function safeParam(value, fallback = "") {
  return String(value || fallback).trim();
}

function assertGet(req, res) {
  if (!req.method || req.method === "GET") return true;
  sendJson(res, 405, { error: "Method not allowed." });
  return false;
}

function getProvider() {
  return safeParam(process.env.MARKET_DATA_PROVIDER, "twelvedata").toLowerCase();
}

function validateProvider(res) {
  const provider = getProvider();
  if (provider === "twelvedata") return true;
  const payload = marketError("PROVIDER_UNSUPPORTED", "Unsupported market data provider.", { provider });
  logMarketError("validateProvider", payload);
  sendJson(res, 400, payload);
  return false;
}

function getApiKey(res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (apiKey) return apiKey;
  const payload = marketError("API_KEY_MISSING", "TWELVE_DATA_API_KEY is not configured.");
  logMarketError("getApiKey", payload);
  sendJson(res, 500, payload);
  return null;
}

function validateSymbol(symbol, res) {
  if (ALLOWED_SYMBOLS.includes(symbol)) return true;
  const payload = marketError("SYMBOL_NOT_ALLOWED", "Symbol is not in ALLOWED_SYMBOLS.", {
    symbol,
    allowedSymbols: ALLOWED_SYMBOLS
  });
  logMarketError("validateSymbol", payload);
  sendJson(res, 400, payload);
  return false;
}

function validateInterval(interval, res) {
  if (ALLOWED_INTERVALS.includes(interval)) return true;
  const payload = marketError("INTERVAL_NOT_ALLOWED", "Interval is not in ALLOWED_INTERVALS.", {
    interval,
    allowedIntervals: ALLOWED_INTERVALS
  });
  logMarketError("validateInterval", payload);
  sendJson(res, 400, payload);
  return false;
}

function classifyProviderError(data = {}, statusCode = 502) {
  const message = String(data.message || data.detail || data.error || data.status || "").toLowerCase();
  const code = String(data.code || "").toLowerCase();

  if (statusCode === 429 || message.includes("too many") || message.includes("rate limit") || message.includes("api credits") || message.includes("quota") || message.includes("run out") || code === "429") {
    return "RATE_LIMIT";
  }
  if (message.includes("symbol") || message.includes("instrument")) return "SYMBOL_UNAVAILABLE";
  if (message.includes("interval") || message.includes("timeframe")) return "INTERVAL_UNAVAILABLE";
  if (message.includes("market closed") || message.includes("market is closed") || message.includes("exchange closed")) return "MARKET_CLOSED";
  return "PROVIDER_ERROR";
}

async function fetchTwelveData(endpoint, params) {
  const url = `${TWELVE_DATA_BASE_URL}/${endpoint}?${params.toString()}`;
  let response;
  let data;

  try {
    response = await fetch(url);
    data = await response.json();
  } catch (error) {
    const payload = marketError("NETWORK_ERROR", error.message || "Fetch to Twelve Data failed.", { endpoint });
    logMarketError("callTwelveData.network", payload);
    return { ok: false, statusCode: 503, payload };
  }

  if (!response.ok || data.status === "error" || data.code || data.message === "error") {
    const message = data.message || data.detail || "Twelve Data request failed.";
    const code = classifyProviderError(data, response.status);
    const payload = marketError(code, message, {
      endpoint,
      httpStatus: response.status,
      providerCode: data.code || null,
      providerStatus: data.status || null
    });
    logMarketError("callTwelveData.provider", payload);
    return {
      ok: false,
      statusCode: code === "RATE_LIMIT" ? 429 : response.ok ? 502 : response.status,
      payload
    };
  }

  return { ok: true, statusCode: 200, payload: data };
}

async function callTwelveData(endpoint, params) {
  const cacheKey = marketCacheKey(endpoint, params);
  const cached = cachedMarketResponse(cacheKey);
  if (cached) return cached;

  if (marketPendingRequests.has(cacheKey)) {
    const result = await marketPendingRequests.get(cacheKey);
    return {
      ...result,
      payload: cloneJson(result.payload),
      cache: {
        ...(result.cache || {}),
        deduped: true,
        key: cacheKey
      }
    };
  }

  const request = fetchTwelveData(endpoint, params)
    .then((result) => {
      storeMarketResponse(cacheKey, result);
      return {
        ...result,
        payload: cloneJson(result.payload),
        cache: {
          hit: false,
          key: cacheKey,
          ttlMs: result.ok ? marketCacheTtlMs() : 0
        }
      };
    })
    .finally(() => {
      marketPendingRequests.delete(cacheKey);
    });

  marketPendingRequests.set(cacheKey, request);
  return request;
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unixSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 9999999999 ? Math.floor(value / 1000) : Math.floor(value);
  }

  const parsed = Date.parse(String(value || "").replace(" ", "T"));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function normalizeTwelveDataCandles(data) {
  if (!data || data.status === "error") {
    const message = data?.message || "Twelve Data returned an error response.";
    throw new Error(message);
  }

  if (!Array.isArray(data.values)) return [];

  return data.values
    .map((item) => {
      const candle = {
        time: unixSeconds(item.datetime || item.timestamp),
        open: cleanNumber(item.open),
        high: cleanNumber(item.high),
        low: cleanNumber(item.low),
        close: cleanNumber(item.close)
      };

      return Object.values(candle).every((value) => value !== null) ? candle : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function cleanHistory(data, symbol, interval) {
  const values = normalizeTwelveDataCandles(data);
  if (!values.length) {
    throw Object.assign(new Error("Twelve Data returned an empty values array."), {
      marketCode: "EMPTY_RESPONSE",
      details: { symbol, interval }
    });
  }

  return {
    provider: "twelvedata",
    symbol,
    interval,
    values
  };
}

function cleanQuote(data, symbol) {
  return {
    provider: "twelvedata",
    symbol,
    price: cleanNumber(data.close || data.price),
    open: cleanNumber(data.open),
    high: cleanNumber(data.high),
    low: cleanNumber(data.low),
    previousClose: cleanNumber(data.previous_close),
    change: cleanNumber(data.change),
    percentChange: cleanNumber(data.percent_change),
    timestamp: data.datetime || data.timestamp || null
  };
}

module.exports = {
  ALLOWED_INTERVALS,
  ALLOWED_SYMBOLS,
  assertGet,
  callTwelveData,
  cleanHistory,
  cleanQuote,
  getApiKey,
  getQuery,
  logMarketError,
  marketError,
  normalizeTwelveDataCandles,
  safeParam,
  sendJson,
  validateInterval,
  validateProvider,
  validateSymbol
};
