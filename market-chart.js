(function attachWebTradeMarketChart(global) {
  function assertLightweightCharts() {
    if (!global.LightweightCharts) {
      throw new Error("Lightweight Charts is not loaded.");
    }
    return global.LightweightCharts;
  }

  function normalizeContainer(container) {
    if (typeof container === "string") return document.querySelector(container);
    return container;
  }

  function cleanCandles(candles) {
    if (!Array.isArray(candles)) return [];
    return candles
      .filter((item) =>
        item &&
        Number.isFinite(Number(item.time)) &&
        Number.isFinite(Number(item.open)) &&
        Number.isFinite(Number(item.high)) &&
        Number.isFinite(Number(item.low)) &&
        Number.isFinite(Number(item.close))
      )
      .map((item) => ({
        time: Number(item.time),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close)
      }))
      .sort((a, b) => a.time - b.time);
  }

  function createCandlestickSeries(chart, LightweightCharts, options) {
    if (typeof chart.addSeries === "function" && LightweightCharts.CandlestickSeries) {
      return chart.addSeries(LightweightCharts.CandlestickSeries, options);
    }
    return chart.addCandlestickSeries(options);
  }

  function createMarketChart(props) {
    const LightweightCharts = assertLightweightCharts();
    const container = normalizeContainer(props.container);
    if (!container) throw new Error("Market chart container was not found.");

    const chart = LightweightCharts.createChart(container, {
      width: container.clientWidth || 640,
      height: container.clientHeight || 420,
      autoSize: true,
      layout: {
        background: { color: "#060d1a" },
        textColor: "#c5d0e8",
        attributionLogo: false
      },
      grid: {
        vertLines: { color: "rgba(99, 179, 237, 0.08)" },
        horzLines: { color: "rgba(99, 179, 237, 0.08)" }
      },
      rightPriceScale: {
        visible: true,
        borderVisible: true,
        borderColor: "#1a2840",
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      timeScale: {
        visible: true,
        borderVisible: true,
        borderColor: "#1a2840",
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: "#63b3ed",
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
          labelBackgroundColor: "#0b1525"
        },
        horzLine: {
          color: "#63b3ed",
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
          labelBackgroundColor: "#0b1525"
        }
      },
      localization: {
        priceFormatter: (price) => Number(price).toFixed(Number(price) > 100 ? 2 : 5)
      }
    });

    const candleSeries = createCandlestickSeries(chart, LightweightCharts, {
      upColor: "#00d4a0",
      downColor: "#f05e5e",
      borderUpColor: "#00d4a0",
      borderDownColor: "#f05e5e",
      wickUpColor: "#83f5d6",
      wickDownColor: "#ff9a9a",
      priceLineColor: "#63b3ed",
      priceLineVisible: true,
      lastValueVisible: true
    });

    candleSeries.setData(cleanCandles(props.candles));
    chart.timeScale().fitContent();

    if (typeof props.onCrosshairMove === "function") {
      chart.subscribeCrosshairMove(props.onCrosshairMove);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      chart.resize(Math.max(1, width), Math.max(1, height));
    });
    resizeObserver.observe(container);

    return {
      chart,
      candleSeries,
      setData(nextCandles) {
        candleSeries.setData(cleanCandles(nextCandles));
        chart.timeScale().fitContent();
      },
      update(candle) {
        const clean = cleanCandles([candle])[0];
        if (clean) candleSeries.update(clean);
      },
      resize() {
        chart.resize(container.clientWidth || 640, container.clientHeight || 420);
      },
      destroy() {
        resizeObserver.disconnect();
        if (typeof props.onCrosshairMove === "function") {
          chart.unsubscribeCrosshairMove(props.onCrosshairMove);
        }
        chart.remove();
      }
    };
  }

  global.WebTradeMarketChart = {
    createMarketChart,
    cleanCandles
  };
})(window);
