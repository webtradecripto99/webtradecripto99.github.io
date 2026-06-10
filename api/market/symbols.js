const {
  ALLOWED_INTERVALS,
  ALLOWED_SYMBOLS,
  assertGet,
  sendJson,
  validateProvider
} = require("../_market-utils");

module.exports = async function symbolsHandler(req, res) {
  if (!assertGet(req, res)) return;
  if (!validateProvider(res)) return;

  sendJson(res, 200, {
    provider: "twelvedata",
    symbols: ALLOWED_SYMBOLS,
    intervals: ALLOWED_INTERVALS
  });
};
