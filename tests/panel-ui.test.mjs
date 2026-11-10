import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";

const fixture = {
  sample: false,
  alive: true,
  paper: true,
  size_usd: 5,
  version: "4.0.0",
  since: "2026-10-17T14:26:00-03:00",
  last_scan_at: "2026-11-07T18:41:48-03:00",
  updated_at: "2026-11-07T18:42:15-03:00",
  summary: { pnl_usd: -181.1899, trades: 1239, wins: 436, pnl_today_usd: -7.1729, trades_today: 20 },
  portfolio: {
    version: "v5.36",
    family: "v5.36",
    family_since: "2026-11-05T17:20:00-03:00",
    version_since: "2026-11-05T17:20:00-03:00",
    pnl_usd: 0,
    trades: 0,
    wins: 0,
    win_rate: 0,
    pnl_today_usd: 0,
    trades_today: 0,
    open_positions: 0,
    max_open: 5,
    equity: [],
    recent: [],
    by_strategy: [{ strategy: "cartera_s300", pnl_usd: 0, trades: 0, wins: 0, win_rate: 0, pnl_today_usd: 0, trades_today: 0, open_positions: 0 }],
  },
  strategies: [
    { name: "lab_s300_1nom24h", rank: 10, wins: 1, status: "activa", trades: 4, pnl_usd: -0.6139, win_rate: 0.25, title: "LAB clon cartera_s300", open_positions: 0 },
    { name: "cartera_s300", rank: 27, wins: 12, status: "activa", trades: 23, pnl_usd: -3.8476, win_rate: 0.52, title: "Cartera principal s300", open_positions: 0 },
  ],
  recent_trades: [],
  open_positions: [],
  loteria: {
    pnl_usd: -31.34,
    open_bets: [{ sym: "SOLO-LOTERIA", pnl_usd: -1, entry_time: "2026-11-07T12:00:00-03:00", status: "open" }],
    closed_bets: [],
    detail: { version: "v4.14", since: "2026-10-20T21:06:42-03:00", real: { realized: -31.34, pnl: -31.34, closed: 184, wins: 17, win_rate: 0.092, open: 1 } },
  },
  noticias_x: { net_usd: -28.89, balance: 71.11, closed: 8, wins: 0, bet: 2, rules: "hype", open: [], trades: [], analyses: [] },
  asl: {
    summary: { open: 0, wins: 5, since: "02/11 14:47", trades: 31, realized: -175.42, unrealized: -21.08 },
    conf: { name: "Confluencia", summary: { open: 0, wins: 0, since: "04/11 17:30", trades: 4, realized: -16.1, unrealized: 0.17 } },
    open: [],
    closed: [],
    others: [],
    updated: "06/11 18:00",
    usd_per_buy: 100,
  },
  cocos: null,
};

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
  });
}

test("rendered panel hides Lotería and still opens the other tabs", async () => {
  const dir = "/tmp/mb-loteria-ui";
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const name of ["index.html", "app.js", "ops.js", "styles.css"]) {
    writeFileSync(`${dir}/${name}`, readFileSync(new URL(`../dashboard/${name}`, import.meta.url)));
  }
  writeFileSync(`${dir}/config.js`, "window.MEMEBOT_CONFIG = {};\n");
  const html = readFileSync(`${dir}/index.html`, "utf8");
  const boot = `<script>
showApp();
render(${JSON.stringify(fixture)});
selectTab("loteria");
const lot = document.getElementById("tab-loteria");
const panel = document.getElementById("panel-loteria");
const visible = [...document.querySelectorAll("#tabs [role=tab]")].filter((el) => !el.hidden).map((el) => el.querySelector(".tab-label").firstChild.textContent.trim());
selectTab("cripto");
const aslShown = document.getElementById("panel-cripto").hidden === false && document.getElementById("panel-principal").hidden === true;
selectTab("noticias");
const newsShown = document.getElementById("panel-noticias").hidden === false && document.getElementById("panel-cripto").hidden === true;
selectTab("principal");
const principalShown = document.getElementById("panel-principal").hidden === false;
selectTab("cocos");
const cocosShown = document.getElementById("panel-cocos").hidden === false && document.getElementById("panel-principal").hidden === true;
const visibleText = document.body.innerText;
const report = {
  lotHidden: lot.hidden,
  lotDisplay: getComputedStyle(lot).display,
  panelHidden: panel.hidden,
  panelEmpty: panel.textContent.trim() === "",
  panelHasLoteriaCard: /Lotería real|SOLO-LOTERIA/.test(panel.textContent),
  visible,
  navPnl: document.getElementById("nav-pnl-loteria").textContent,
  aslShown,
  newsShown,
  principalShown,
  cocosShown,
  noManualGroup: !visibleText.includes("REAL · MANUAL") && !visibleText.includes("carga manual"),
  cocosEmpty: document.getElementById("panel-cocos").textContent.includes("Sin datos de Cocos"),
  hero: document.querySelector("#panel-principal .big-num").textContent.trim(),
};
document.body.insertAdjacentHTML("beforeend", '<pre id="ui-report"></pre>');
document.getElementById("ui-report").textContent = JSON.stringify(report);
</script>`;
  writeFileSync(`${dir}/index.html`, html.replace("</body>", `${boot}\n</body>`));
  const server = spawn("python3", ["-m", "http.server", "8766", "--directory", dir], { stdio: "ignore" });
  try {
    let ready = false;
    for (let i = 0; i < 20; i += 1) {
      const probe = await run("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:8766/index.html"], 2000).catch(() => ({ code: 1, out: "" }));
      if (probe.out.trim() === "200") { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.equal(ready, true, "preview server did not start");
    const dumped = await run("/usr/bin/google-chrome-stable", [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      "--user-data-dir=/tmp/chrome-loteria-ui",
      "--virtual-time-budget=8000",
      "--dump-dom", "http://127.0.0.1:8766/index.html",
    ], 40000);
    assert.equal(dumped.code, 0, dumped.err.slice(-500));
    const match = dumped.out.match(/<pre id="ui-report">([^<]+)<\/pre>/);
    assert.ok(match, "missing ui report");
    const report = JSON.parse(match[1].replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&"));
    assert.equal(report.lotHidden, true);
    assert.equal(report.lotDisplay, "none");
    assert.equal(report.panelHidden, true);
    assert.equal(report.panelEmpty, true);
    assert.equal(report.panelHasLoteriaCard, false);
    assert.deepEqual(report.visible, ["Principal", "Acciones ASL", "Noticias", "Cartera Cocos"]);
    assert.equal(report.navPnl, "—");
    assert.equal(report.aslShown, true);
    assert.equal(report.newsShown, true);
    assert.equal(report.principalShown, true);
    assert.equal(report.cocosShown, true);
    assert.equal(report.noManualGroup, true);
    assert.equal(report.cocosEmpty, true);
    assert.match(report.hero, /^0,00/);
  } finally {
    server.kill("SIGKILL");
  }
});
