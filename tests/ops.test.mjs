import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ops = require("../dashboard/ops.js");

const NOW = new Date("2026-11-07T15:00:00Z");

function liveSnapshot() {
  return {
    sample: false,
    alive: true,
    paper: true,
    size_usd: 5,
    version: "4.0.0",
    since: "2026-10-17T14:26:00-03:00",
    summary: {
      pnl_usd: -181.1899,
      trades: 1239,
      wins: 436,
      pnl_today_usd: -7.1729,
      trades_today: 20,
      open_positions: 4,
    },
    portfolio: {
      version: "v5.36",
      family: "v5.36",
      family_since: "2026-11-05T17:20:00-03:00",
      version_since: "2026-11-05T17:20:00-03:00",
      version_trades: 0,
      version_pnl_usd: 0,
      pnl_usd: 0,
      trades: 0,
      wins: 0,
      win_rate: 0,
      pnl_today_usd: 0,
      trades_today: 0,
      open_positions: 0,
      max_open: 5,
      gross_usd: null,
      equity: [],
      recent: [],
      by_strategy: [{
        strategy: "cartera_s300",
        pnl_usd: 0,
        trades: 0,
        wins: 0,
        win_rate: 0,
        pnl_today_usd: 0,
        trades_today: 0,
        open_positions: 0,
        gross_usd: null,
      }],
    },
    strategies: [
      { name: "cartera_s300", pnl_usd: -3.8476, trades: 23, wins: 12, win_rate: 12 / 23, status: "activa", equity: [{ t: "2026-11-03T23:23:13-03:00", y: -3.8476 }] },
      { name: "cartera_tp12", pnl_usd: -10.9925, trades: 17, wins: 4, win_rate: 4 / 17, status: "activa" },
      { name: "lab_s300_1nom24h", pnl_usd: -0.6139, trades: 4, wins: 1, win_rate: 0.25, status: "activa" },
      { name: "lab_s300_tp20_m20", pnl_usd: 0.1481, trades: 17, wins: 6, win_rate: 6 / 17, status: "activa" },
      { name: "solid_trail_p20", pnl_usd: -32.7799, trades: 187, wins: 70, status: "pausada" },
    ],
    recent_trades: [
      { strategy: "lab_s300_1nom24h", sym: "LABTOK", pnl_usd: -0.2, exit_time: "2026-11-07T13:32:52-03:00" },
      { strategy: "cartera_tp12", sym: "OTRA", pnl_usd: -2.49, exit_time: "2026-11-06T18:00:00-03:00" },
    ],
    open_positions: [
      { strategy: "lab_s300_1nom24h", sym: "LABOPEN", portfolio: false, unrealized_usd: -0.4 },
      { strategy: "cartera_tp12", sym: "TPOPEN", portfolio: false, unrealized_usd: -1 },
    ],
    chart: [
      { id: "total", points: [{ t: "2026-11-07T13:58:03-03:00", y: -181.1899 }] },
      { id: "portfolio", points: [{ t: "2026-11-03T15:47:08-03:00", y: -29.4106 }] },
    ],
    total_equity: [{ t: "2026-11-07T13:58:03-03:00", y: -181.1899 }],
    loteria: { detail: { real: { realized: -31.34, pnl: -40 } } },
    noticias_x: { net_usd: -28.89, open: [], trades: [] },
    asl: {
      summary: { realized: -175.42, unrealized: -21.08, trades: 31, wins: 5 },
      conf: { summary: { realized: -16.1, unrealized: 0.17, trades: 4, wins: 0 } },
    },
    cocos: null,
  };
}

test("empty and broken payloads expose no trades", () => {
  for (const input of [null, undefined, [], "x", 0]) {
    const view = ops.mapOperations(input);
    assert.equal(view.ok, false);
    assert.equal(view.presentAsReal, false);
    assert.equal(view.principal.pnl, null);
    assert.deepEqual(view.principal.recent, []);
    assert.deepEqual(view.principal.positions, []);
    assert.deepEqual(view.labs, []);
    assert.equal(view.cocos.usd, null);
  }
  const empty = ops.mapOperations({});
  assert.equal(empty.ok, true);
  assert.equal(empty.principal.pnl, null);
  assert.deepEqual(empty.principal.names, []);
  assert.deepEqual(empty.principal.recent, []);
  assert.equal(empty.loteriaPnl, null);
  assert.equal(empty.aslPnl, null);
});

test("read errors do not invent a book", () => {
  const denied = ops.readStatsResult({ ok: false, status: 403, body: { trades: [{ sym: "Fartcoin", pnl_usd: 10 }] } });
  assert.match(denied.error, /Sin permiso/);
  assert.equal(denied.stats, null);
  const missing = ops.readStatsResult({ ok: false, status: 404, body: null });
  assert.equal(missing.error, "Token incorrecto.");
  assert.equal(missing.stats, null);
  const down = ops.readStatsResult({ ok: false, status: 500, body: null });
  assert.match(down.error, /500/);
  assert.equal(down.stats, null);
  const blank = ops.readStatsResult({ ok: true, status: 200, body: null });
  assert.match(blank.error, /no publicó/);
  assert.equal(blank.stats, null);
});

test("principal is cartera_s300 only and ignores summary, labs and chart totals", () => {
  const view = ops.mapOperations(liveSnapshot(), NOW);
  assert.equal(view.presentAsReal, true);
  assert.deepEqual(view.principal.names, ["cartera_s300"]);
  assert.equal(view.principal.pnl, 0);
  assert.equal(view.principal.trades, 0);
  assert.equal(view.principal.wins, 0);
  assert.equal(view.principal.pnlToday, 0);
  assert.equal(view.principal.tradesToday, 0);
  assert.notEqual(view.principal.pnl, liveSnapshot().summary.pnl_usd);
  assert.notEqual(view.principal.pnlToday, liveSnapshot().summary.pnl_today_usd);
  const labSum = view.labs.reduce((sum, row) => sum + row.pnl_usd, 0);
  assert.notEqual(view.principal.pnl, labSum);
  assert.ok(Math.abs(labSum - (-0.6139 + 0.1481 + -10.9925 + -32.7799)) < 1e-9);
  assert.equal(view.labs.some((row) => row.name === "lab_s300_1nom24h" && row.pnl_usd === -0.6139), true);
  assert.equal(view.labs.some((row) => row.name === "cartera_s300"), false);
  assert.equal(view.labs.some((row) => row.name === "cartera_tp12"), true);
  assert.deepEqual(view.principal.equity, []);
  assert.deepEqual(view.principal.recent, []);
  assert.deepEqual(view.principal.positions, []);
  assert.equal(view.principal.ledgers[0].name, "cartera_s300");
  assert.equal(view.principal.ledgers[0].pnl, -3.8476);
  assert.equal(view.principal.ledgers[0].trades, 23);
  assert.equal(view.loteriaPnl, -31.34);
  assert.equal(view.noticiasPnl, -28.89);
  assert.ok(Math.abs(view.aslPnl - (-16.1 + 0.17)) < 1e-9);
  assert.notEqual(view.principal.pnl, view.aslPnl);
  assert.notEqual(view.principal.pnl, view.loteriaPnl);
  assert.equal(view.cocos.present, false);
  assert.equal(view.cocos.usd, null);
  assert.deepEqual(view.cocos.operations, []);
});

test("a lab listed inside by_strategy is not added to the principal", () => {
  const stats = liveSnapshot();
  stats.portfolio.by_strategy.push({
    strategy: "lab_s300_1nom24h",
    pnl_usd: -0.6139,
    trades: 4,
    wins: 1,
    pnl_today_usd: -0.6139,
    trades_today: 4,
    open_positions: 1,
  });
  stats.portfolio.pnl_usd = -181.1899;
  const view = ops.mapOperations(stats, NOW);
  assert.deepEqual(view.principal.names, ["cartera_s300"]);
  assert.equal(view.principal.pnl, 0);
  assert.equal(view.principal.trades, 0);
  assert.equal(view.principal.pnlToday, 0);
  assert.equal(view.labs.some((row) => row.name === "lab_s300_1nom24h"), true);
});

test("book trades and opens stay inside the cartera boundary", () => {
  const stats = liveSnapshot();
  stats.portfolio.recent = [
    { strategy: "cartera_s300", sym: "REAL", pnl_usd: -0.5, exit_time: "2026-11-07T10:00:00-03:00" },
    { strategy: "lab_s300_1nom24h", sym: "NO", pnl_usd: -9, exit_time: "2026-11-07T10:00:00-03:00" },
  ];
  stats.portfolio.equity = [{ t: "2026-11-07T10:00:00-03:00", y: -0.5 }];
  stats.open_positions.push({ strategy: "cartera_s300", sym: "OPEN", portfolio: true, unrealized_usd: 0.2 });
  const view = ops.mapOperations(stats, NOW);
  assert.deepEqual(view.principal.recent.map((row) => row.sym), ["REAL"]);
  assert.equal(view.principal.equity.length, 1);
  assert.equal(view.principal.equity[0].y, -0.5);
  assert.notEqual(view.principal.equity[0].y, -181.1899);
  assert.deepEqual(view.principal.positions.map((row) => row.sym), ["OPEN"]);
});

test("sample payloads are not presented as real operations", () => {
  const stats = liveSnapshot();
  stats.sample = true;
  stats.note = "mock";
  stats.cocos = { usd: 291922, operations: [{ especie: "GGAL", tipo: "compra" }] };
  stats.recent_trades.push({ strategy: "cartera_s300", sym: "Fartcoin", pnl_usd: -8.62, exit_time: "2026-11-07T10:00:00-03:00" });
  const view = ops.viewForRender(stats, NOW);
  assert.equal(view.sample, true);
  assert.equal(view.presentAsReal, false);
  assert.equal(view.principal.pnl, null);
  assert.deepEqual(view.principal.recent, []);
  assert.deepEqual(view.principal.positions, []);
  assert.deepEqual(view.labs, []);
  assert.equal(view.cocos.usd, null);
  assert.equal(view.loteriaPnl, null);
  assert.equal(view.aslPnl, null);
  assert.equal(view.noticiasPnl, null);
  assert.equal(JSON.stringify(view).includes("Fartcoin"), false);
  assert.equal(JSON.stringify(view).includes("291922"), false);
});

test("cocos balance is only the stored amount", () => {
  const absent = ops.mapCocos({ cocos: null, real: null });
  assert.equal(absent.usd, null);
  const present = ops.mapCocos({ cocos: { usd: 1200.5, updated_at: "2026-11-07T12:00:00Z", operations: [{ especie: "GGAL" }] } });
  assert.equal(present.present, true);
  assert.equal(present.usd, 1200.5);
  assert.equal(present.operations.length, 1);
  const manual = ops.mapCocos({ real: { balance_usd: 0 } });
  assert.equal(manual.usd, 0);
});

test("today follows America/Argentina/Buenos_Aires when the snapshot has no today field", () => {
  const stats = liveSnapshot();
  delete stats.portfolio.by_strategy[0].pnl_today_usd;
  delete stats.portfolio.by_strategy[0].trades_today;
  stats.portfolio.recent = [
    { strategy: "cartera_s300", sym: "AYER", pnl_usd: -2, exit_time: "2026-11-07T02:30:00Z" },
    { strategy: "cartera_s300", sym: "HOY", pnl_usd: -0.4, exit_time: "2026-11-07T04:15:00Z" },
    { strategy: "lab_s300_1nom24h", sym: "LAB", pnl_usd: -8, exit_time: "2026-11-07T12:00:00Z" },
  ];
  assert.equal(ops.artDateKey("2026-11-07T02:30:00Z", NOW), "2026-11-06");
  assert.equal(ops.artDateKey("2026-11-07T04:15:00Z", NOW), "2026-11-07");
  const view = ops.mapOperations(stats, NOW);
  assert.equal(view.principal.pnlToday, -0.4);
  assert.equal(view.principal.tradesToday, 1);
  assert.deepEqual(view.principal.recent.map((row) => row.sym), ["AYER", "HOY"]);
});

test("html from the source is escaped", () => {
  assert.equal(ops.escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(ops.escapeHtml("a&b"), "a&amp;b");
});

test("the dashboard source does not ship sample trades", () => {
  const app = readFileSync(new URL("../dashboard/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../dashboard/index.html", import.meta.url), "utf8");
  const opsSrc = readFileSync(new URL("../dashboard/ops.js", import.meta.url), "utf8");
  const blob = `${app}\n${html}\n${opsSrc}`;
  assert.equal(blob.includes("stats_sample"), false);
  assert.equal(blob.includes("Fartcoin"), false);
  assert.equal(blob.includes("291922"), false);
  assert.equal(blob.includes("MAGA2028"), false);
  assert.equal(app.includes("total_equity"), false);
  assert.match(app, /MemebotOps/);
  assert.match(html, /ops\.js/);
});
