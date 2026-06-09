const {
  assertGet,
  callTwelveData,
  cleanQuote,
  getApiKey,
  getQuery,
  safeParam,
  sendJson,
  validateProvider,
  validateSymbol
} = require("../_market-utils");

module.exports = async function quoteHandler(req, res) {
  if (!assertGet(req, res)) return;
  if (!validateProvider(res)) return;

  const query = getQuery(req);
  const symbol = safeParam(query.symbol, "EUR/USD");

  if (!validateSymbol(symbol, res)) return;

  const apiKey = getApiKey(res);
  if (!apiKey) return;

  const params = new URLSearchParams({
    symbol,
    apikey: apiKey
  });

  const result = await callTwelveData("quote", params);
  if (!result.ok) {
    sendJson(res, result.statusCode, result.payload);
    return;
  }

  sendJson(res, 200, cleanQuote(result.payload, symbol));
};
