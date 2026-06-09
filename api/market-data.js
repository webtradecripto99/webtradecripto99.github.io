const historyHandler = require("./market/history");
const quoteHandler = require("./market/quote");
const symbolsHandler = require("./market/symbols");

module.exports = async function marketDataHandler(req, res) {
  const endpoint = String(req.query?.endpoint || "history").trim();
  if (endpoint === "symbols") return symbolsHandler(req, res);
  if (endpoint === "quote") return quoteHandler(req, res);
  return historyHandler(req, res);
};
