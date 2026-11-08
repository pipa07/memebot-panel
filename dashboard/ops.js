// Lectura pura del snapshot que publica el bot (get_stats → bot_state.body).
// No inventa trades. La cartera principal es solo lo que portfolio.by_strategy
// marca, y nunca una estrategia lab_*. summary, total_equity y chart "total"
// suman el laboratorio: no entran en el titular.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MemebotOps = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Lotería queda fuera del panel hasta nuevo aviso.
  // Siguen el renderer (renderLoteria / loteriaView en app.js), mapLoteriaPnl
  // y el campo stats.loteria del snapshot. No se borra data ni se toca el bot.
  // Para restaurarla: poné loteria en true. Vuelven el tab, su PnL y el panel,
  // en el mismo lugar del menú. No hace falta otro cambio.
  const FEATURES = { loteria: false };
  const NAV = ["principal", "loteria", "cripto", "noticias"];

  function featureEnabled(name) {
    return FEATURES[name] === true;
  }

  function visibleNav() {
    return NAV.filter((name) => name !== "loteria" || featureEnabled("loteria"));
  }

  function displaySections(view) {
    const safe = view && typeof view === "object" ? view : {};
    return {
      tabs: visibleNav(),
      pnl: {
        principal: safe.principal ? safe.principal.pnl : null,
        loteria: featureEnabled("loteria") ? (safe.loteriaPnl ?? null) : null,
        cripto: safe.aslPnl ?? null,
        noticias: safe.noticiasPnl ?? null,
      },
    };
  }

  const ART = "America/Argentina/Buenos_Aires";
  const artDayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ART,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function num(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function strategyName(row) {
    if (!row || typeof row !== "object") return "";
    const name = row.strategy || row.name || "";
    return typeof name === "string" ? name : "";
  }

  function isLabName(name) {
    return /^lab_/i.test(String(name || ""));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function bookNames(stats) {
    const rows = stats && stats.portfolio && Array.isArray(stats.portfolio.by_strategy)
      ? stats.portfolio.by_strategy
      : [];
    const names = [];
    for (const row of rows) {
      const name = strategyName(row);
      if (!name || isLabName(name) || names.includes(name)) continue;
      names.push(name);
    }
    if (names.length) return names;
    const strategies = asArray(stats && stats.strategies);
    if (strategies.some((row) => strategyName(row) === "cartera_s300")) return ["cartera_s300"];
    return [];
  }

  function sumField(rows, field) {
    if (!rows.length) return null;
    let total = 0;
    let seen = false;
    for (const row of rows) {
      const n = num(row && row[field]);
      if (n == null) continue;
      seen = true;
      total += n;
    }
    return seen ? total : null;
  }

  function artDateKey(iso, now) {
    const date = iso == null ? (now instanceof Date ? now : new Date()) : new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return artDayFmt.format(date);
  }

  function sumPnlOnArtDay(trades, now) {
    const today = artDateKey(null, now instanceof Date ? now : new Date());
    let pnl = 0;
    let count = 0;
    let seen = false;
    for (const trade of asArray(trades)) {
      const iso = trade && (trade.exit_time || trade.closed_at || trade.exit || null);
      if (!iso || artDateKey(iso) !== today) continue;
      const value = num(trade.pnl_usd != null ? trade.pnl_usd : trade.pnl);
      if (value == null) continue;
      seen = true;
      pnl += value;
      count += 1;
    }
    return seen ? { pnl, trades: count } : { pnl: null, trades: 0 };
  }

  function bookRows(stats) {
    const names = bookNames(stats);
    const allowed = new Set(names);
    const rows = asArray(stats && stats.portfolio && stats.portfolio.by_strategy).filter((row) => {
      const name = strategyName(row);
      return name && allowed.has(name) && !isLabName(name);
    });
    return { names, rows };
  }

  function bookEquity(stats) {
    const equity = stats && stats.portfolio && stats.portfolio.equity;
    if (!Array.isArray(equity)) return [];
    return equity.filter((point) => point && point.t != null && num(point.y) != null);
  }

  function bookTrades(stats) {
    const allowed = new Set(bookNames(stats));
    const portfolio = stats && stats.portfolio;
    const explicit = portfolio && Array.isArray(portfolio.recent);
    const source = explicit ? portfolio.recent : asArray(stats && stats.recent_trades);
    return source.filter((trade) => {
      const name = strategyName(trade);
      if (!name || isLabName(name) || !allowed.has(name)) return false;
      return true;
    });
  }

  function bookOpens(stats) {
    const allowed = new Set(bookNames(stats));
    return asArray(stats && stats.open_positions).filter((pos) => {
      if (!pos || typeof pos !== "object") return false;
      const name = strategyName(pos);
      if (isLabName(name) || pos.portfolio === false) return false;
      if (name) return allowed.has(name);
      return pos.portfolio === true && allowed.size > 0;
    });
  }

  function labStrategies(stats) {
    const allowed = new Set(bookNames(stats));
    return asArray(stats && stats.strategies).filter((row) => {
      const name = strategyName(row);
      if (!name || allowed.has(name)) return false;
      return true;
    });
  }

  function ledgers(stats) {
    const names = bookNames(stats);
    return names.map((name) => {
      const row = asArray(stats && stats.strategies).find((item) => strategyName(item) === name);
      if (!row) return null;
      return {
        name,
        pnl: num(row.pnl_usd),
        trades: num(row.trades),
        wins: num(row.wins),
        winRate: num(row.win_rate),
      };
    }).filter(Boolean);
  }

  function mapCocos(stats) {
    const raw = stats && (stats.cocos || (stats.real && typeof stats.real === "object" ? stats.real : null));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { present: false, usd: null, label: "Cartera Cocos", when: "", operations: [] };
    }
    return {
      present: true,
      usd: num(raw.usd != null ? raw.usd : raw.cocos_usd != null ? raw.cocos_usd : raw.balance != null ? raw.balance : raw.balance_usd),
      label: raw.label || raw.name || "Cartera Cocos",
      when: raw.updated_at || raw.at || "",
      operations: Array.isArray(raw.operations) ? raw.operations : [],
    };
  }

function mapAsl(stats) {
  const asl = stats && stats.asl;
  const summary = asl && asl.summary;
  if (!summary || typeof summary !== "object") return { present: false, pnl: null, trades: null };
  const realized = num(summary.realized);
  const unrealized = num(summary.unrealized);
  const pnl = realized == null && unrealized == null ? null : (realized || 0) + (unrealized || 0);
  return { present: true, pnl, trades: num(summary.trades), realized, unrealized };
}

function mapAslPnl(stats) {
  const asl = stats && stats.asl;
  const conf = asl && asl.conf && asl.conf.summary;
  if (conf && typeof conf === "object" && (num(conf.realized) != null || num(conf.unrealized) != null)) {
    return (num(conf.realized) || 0) + (num(conf.unrealized) || 0);
  }
  return mapAsl(stats).pnl;
}

  function mapLoteriaPnl(stats) {
    const lot = stats && stats.loteria;
    if (!lot || typeof lot !== "object") return null;
    const real = lot.detail && lot.detail.real;
    if (real && typeof real === "object") return num(real.realized != null ? real.realized : real.pnl);
    return num(lot.pnl_usd != null ? lot.pnl_usd : lot.pnl);
  }

  function mapNoticiasPnl(stats) {
    const news = stats && stats.noticias_x;
    if (!news || typeof news !== "object") return null;
    return num(news.net_usd);
  }

  function emptyPrincipal() {
    return {
      names: [],
      rows: [],
      pnl: null,
      trades: null,
      wins: null,
      winRate: null,
      pnlToday: null,
      tradesToday: null,
      openPositions: null,
      positions: [],
      recent: [],
      equity: [],
      gross: null,
      maxOpen: null,
      unrealized: null,
      version: null,
      family: null,
      familySince: null,
      versionSince: null,
      versionTrades: null,
      versionPnl: null,
      sizeUsd: null,
      ledgers: [],
    };
  }

  function mapPrincipal(stats, now) {
    const book = bookRows(stats);
    const portfolio = (stats && stats.portfolio) || {};
    const trades = sumField(book.rows, "trades");
    const wins = sumField(book.rows, "wins");
    const pnlTodayField = sumField(book.rows, "pnl_today_usd");
    const tradesTodayField = sumField(book.rows, "trades_today");
    const recent = bookTrades(stats);
    const computedToday = pnlTodayField == null && tradesTodayField == null
      ? sumPnlOnArtDay(recent, now)
      : null;
    return {
      names: book.names,
      rows: book.rows,
      pnl: sumField(book.rows, "pnl_usd"),
      trades,
      wins,
      winRate: trades == null ? null : trades === 0 ? 0 : (wins || 0) / trades,
      pnlToday: pnlTodayField != null ? pnlTodayField : computedToday && computedToday.pnl,
      tradesToday: tradesTodayField != null ? tradesTodayField : computedToday && computedToday.trades,
      openPositions: sumField(book.rows, "open_positions"),
      positions: bookOpens(stats),
      recent,
      equity: bookEquity(stats),
      gross: sumField(book.rows, "gross_usd"),
      maxOpen: num(portfolio.max_open),
      unrealized: sumField(book.rows, "unrealized_usd"),
      version: portfolio.version || null,
      family: portfolio.family || null,
      familySince: portfolio.family_since || null,
      versionSince: portfolio.version_since || null,
      versionTrades: num(portfolio.version_trades),
      versionPnl: num(portfolio.version_pnl_usd),
      sizeUsd: num(stats && stats.size_usd),
      ledgers: ledgers(stats),
    };
  }

  function mapOperations(stats, now) {
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
      return {
        ok: false,
        error: "Sin datos de operaciones.",
        sample: false,
        presentAsReal: false,
        principal: emptyPrincipal(),
        labs: [],
        cocos: mapCocos(null),
        asl: mapAsl(null),
        aslPnl: null,
        loteriaPnl: null,
        noticiasPnl: null,
      };
    }
    if (stats.sample === true) {
      const stripped = blankStats(stats);
      stripped.sample = false;
      const hidden = mapOperations(stripped, now);
      hidden.sample = true;
      hidden.presentAsReal = false;
      hidden.ok = true;
      hidden.error = null;
      return hidden;
    }
    return {
      ok: true,
      error: null,
      sample: false,
      presentAsReal: true,
      principal: mapPrincipal(stats, now),
      labs: labStrategies(stats),
      cocos: mapCocos(stats),
        asl: mapAsl(stats),
        aslPnl: mapAslPnl(stats),
        loteriaPnl: mapLoteriaPnl(stats),
        noticiasPnl: mapNoticiasPnl(stats),
    };
  }

  function blankStats(stats) {
    const src = stats && typeof stats === "object" ? stats : {};
    return {
      alive: src.alive,
      updated_at: src.updated_at || null,
      last_scan_at: src.last_scan_at || null,
      version: src.version || null,
      sample: true,
      note: src.note || "",
      paper: true,
      portfolio: {
        by_strategy: [],
        equity: [],
        recent: [],
        pnl_usd: null,
        trades: 0,
        wins: 0,
        open_positions: 0,
        version: src.portfolio && src.portfolio.version || null,
      },
      strategies: [],
      recent_trades: [],
      open_positions: [],
      summary: null,
      loteria: null,
      noticias_x: null,
      asl: null,
      cripto: null,
      cocos: null,
      real: null,
      chart: [],
      total_equity: [],
    };
  }

function viewForRender(stats, now) {
  return mapOperations(stats, now);
}

  function readStatsResult(response) {
    const status = response && response.status;
    if (!response || response.ok === false) {
      if (status === 401 || status === 403) {
        return { error: "Sin permiso para leer operaciones. No se inventan trades.", stats: null };
      }
      if (status === 404) return { error: "Token incorrecto.", stats: null };
      return { error: `No pude leer el estado (${status == null ? "sin respuesta" : status}).`, stats: null };
    }
    if (response.body == null || typeof response.body !== "object" || Array.isArray(response.body)) {
      return { error: "Token incorrecto o el bot todavía no publicó.", stats: null };
    }
    return { error: null, stats: response.body };
  }

  return {
    ART,
    FEATURES,
    featureEnabled,
    visibleNav,
    displaySections,
    mapLoteriaPnl,
    num,
    escapeHtml,
    isLabName,
    bookNames,
    artDateKey,
    sumPnlOnArtDay,
    bookTrades,
    bookOpens,
    labStrategies,
    mapCocos,
    mapAsl,
    mapOperations,
    blankStats,
    viewForRender,
    readStatsResult,
  };
});
