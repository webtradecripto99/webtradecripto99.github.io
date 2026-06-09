(function attachWebTradePhase3(global) {
  "use strict";

  const PHASE_3_MODE = "architecture-only";

  /**
   * @typedef {"buy_market"|"sell_market"|"buy_limit"|"sell_limit"|"buy_stop"|"sell_stop"} TradingOrderType
   * @typedef {"draft"|"pending"|"accepted"|"rejected"|"cancelled"} TradingOrderStatus
   * @typedef {"open"|"partially_closed"|"closed"} PositionStatus
   */

  /**
   * @typedef {Object} StopLoss
   * @property {number|null} price
   * @property {string|null} reason
   */

  /**
   * @typedef {Object} TakeProfit
   * @property {number|null} price
   * @property {string|null} reason
   */

  /**
   * @typedef {Object} TradingOrder
   * @property {string} id
   * @property {string} accountId
   * @property {string} clientId
   * @property {string} symbol
   * @property {TradingOrderType} type
   * @property {number} lots
   * @property {number|null} requestedPrice
   * @property {StopLoss|null} stopLoss
   * @property {TakeProfit|null} takeProfit
   * @property {TradingOrderStatus} status
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} OpenPosition
   * @property {string} id
   * @property {string} orderId
   * @property {string} accountId
   * @property {string} clientId
   * @property {string} symbol
   * @property {"BUY"|"SELL"} side
   * @property {number} lots
   * @property {number} openPrice
   * @property {number|null} currentPrice
   * @property {StopLoss|null} stopLoss
   * @property {TakeProfit|null} takeProfit
   * @property {number|null} floatingPnl
   * @property {PositionStatus} status
   * @property {string} openedAt
   */

  /**
   * @typedef {Object} PendingOrder
   * @property {string} id
   * @property {string} accountId
   * @property {string} clientId
   * @property {string} symbol
   * @property {TradingOrderType} type
   * @property {number} lots
   * @property {number} entryPrice
   * @property {StopLoss|null} stopLoss
   * @property {TakeProfit|null} takeProfit
   * @property {TradingOrderStatus} status
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} TradingHistoryRecord
   * @property {string} id
   * @property {string} accountId
   * @property {string} clientId
   * @property {string} symbol
   * @property {string} eventType
   * @property {string} occurredAt
   * @property {Object} payload
   */

  /**
   * @typedef {Object} AccountRiskSnapshot
   * @property {string} accountId
   * @property {number|null} balance
   * @property {number|null} equity
   * @property {number|null} margin
   * @property {number|null} freeMargin
   * @property {number|null} marginLevel
   */

  function notEnabled() {
    return {
      ok: false,
      mode: PHASE_3_MODE,
      message: "Fase 3 preparada, ejecucion de trading real no activada."
    };
  }

  function emptyList() {
    return [];
  }

  const orderModule = Object.freeze({
    createDraft: notEnabled,
    submit: notEnabled,
    reject: notEnabled,
    cancelPending: notEnabled
  });

  const positionModule = Object.freeze({
    listOpen: emptyList,
    close: notEnabled,
    closePartial: notEnabled
  });

  const riskModule = Object.freeze({
    updateStopLoss: notEnabled,
    updateTakeProfit: notEnabled
  });

  const historyModule = Object.freeze({
    list: emptyList,
    append: notEnabled
  });

  const accountMetricsModule = Object.freeze({
    getBalance: notEnabled,
    getEquity: notEnabled,
    getMargin: notEnabled,
    getFreeMargin: notEnabled,
    getMarginLevel: notEnabled,
    getSnapshot: notEnabled
  });

  global.WebTradePhase3Trading = Object.freeze({
    mode: PHASE_3_MODE,
    orderModule,
    positionModule,
    riskModule,
    historyModule,
    accountMetricsModule
  });
})(window);
