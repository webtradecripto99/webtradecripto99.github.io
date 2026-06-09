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

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
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
  sendJson(res, 400, {
    error: "Unsupported market data provider.",
    provider
  });
  return false;
}

function getApiKey(res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (apiKey) return apiKey;
  sendJson(res, 500, { error: "Market data API key is not configured." });
  return null;
}

function validateSymbol(symbol, res) {
  if (ALLOWED_SYMBOLS.includes(symbol)) return true;
  sendJson(res, 400, {
    error: "Symbol is not allowed.",
    symbol,
    allowedSymbols: ALLOWED_SYMBOLS
  });
  return false;
}

function validateInterval(interval, res) {
  if (ALLOWED_INTERVALS.includes(interval)) return true;
  sendJson(res, 400, {
    error: "Interval is not allowed.",
    interval,
    allowedIntervals: ALLOWED_INTERVALS
  });
  return false;
}

async function callTwelveData(endpoint, params) {
  const url = `${TWELVE_DATA_BASE_URL}/${endpoint}?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.status === "error" || data.code || data.message === "error") {
    const message = data.message || data.detail || "Twelve Data request failed.";
    return {
      ok: false,
      statusCode: response.ok ? 502 : response.status,
      payload: {
        error: "Market data provider error.",
        provider: "twelvedata",
        message
      }
    };
  }

  return { ok: true, statusCode: 200, payload: data };
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
  return {
    provider: "twelvedata",
    symbol,
    interval,
    values: normalizeTwelveDataCandles(data)
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
  normalizeTwelveDataCandles,
  safeParam,
  sendJson,
  validateInterval,
  validateProvider,
  validateSymbol
};
