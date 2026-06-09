const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function safeParam(value, fallback = "") {
  return String(value || fallback).trim();
}

module.exports = async function marketDataHandler(req, res) {
  const provider = safeParam(process.env.MARKET_DATA_PROVIDER, "twelvedata").toLowerCase();
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (provider !== "twelvedata") {
    sendJson(res, 400, { error: "Unsupported market data provider." });
    return;
  }

  if (!apiKey) {
    sendJson(res, 500, { error: "Market data API key is not configured." });
    return;
  }

  const symbol = safeParam(req.query?.symbol, "EUR/USD");
  const interval = safeParam(req.query?.interval, "1min");
  const outputsize = safeParam(req.query?.outputsize, "100");
  const endpoint = safeParam(req.query?.endpoint, "time_series");

  const params = new URLSearchParams({
    symbol,
    apikey: apiKey
  });

  if (endpoint === "time_series") {
    params.set("interval", interval);
    params.set("outputsize", outputsize);
  }

  const url = `${TWELVE_DATA_BASE_URL}/${endpoint}?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  sendJson(res, response.ok ? 200 : response.status, data);
};
