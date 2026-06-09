const {
  assertGet,
  callTwelveData,
  cleanHistory,
  getApiKey,
  getQuery,
  safeParam,
  sendJson,
  validateInterval,
  validateProvider,
  validateSymbol
} = require("../_market-utils");

module.exports = async function historyHandler(req, res) {
  if (!assertGet(req, res)) return;
  if (!validateProvider(res)) return;

  const query = getQuery(req);
  const symbol = safeParam(query.symbol, "EUR/USD");
  const interval = safeParam(query.interval, "1min");
  const outputsize = safeParam(query.outputsize, "200");

  if (!validateSymbol(symbol, res)) return;
  if (!validateInterval(interval, res)) return;

  const apiKey = getApiKey(res);
  if (!apiKey) return;

  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize,
    apikey: apiKey
  });

  const result = await callTwelveData("time_series", params);
  if (!result.ok) {
    sendJson(res, result.statusCode, result.payload);
    return;
  }

  sendJson(res, 200, cleanHistory(result.payload, symbol, interval));
};
