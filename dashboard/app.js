const CFG = window.MEMEBOT_CONFIG || {};
const params = new URLSearchParams(location.search);
const onLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const REMOTE = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey) && !onLocalHost;

const money = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const axisFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const multFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const horaFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const clockFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const artFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const PLAIN = {
  solid_tp15: "Vende todo apenas el token sube 15 %.",
  solid_tp25: "Espera a que suba 25 % y ahí vende todo.",
  solid_tp40: "Aguanta hasta un salto de 40 % y recién ahí vende.",
  solid300_tp25: "Solo mira tokens que ya valen 300 mil dólares, y vende al +25 %.",
  solid_trail: "Cobra la mitad al +12 % y deja correr el resto con un trailing corto.",
  solid_trail_h45: "Igual que el trail de siempre, pero puede quedarse hasta 45 minutos.",
  solid_trail_w25: "Deja más aire: el trailing es más ancho y aguanta 45 minutos.",
  solid_trail_p20: "Vende todo cuando ya ganó 20 % (desde v4.31).",
  solid_trail_guard: "Sale antes si la liquidez o el precio se caen de golpe.",
  solid_trail_filt: "No entra si el token ya se duplicó o la liquidez es flaca.",
  solid_trail_fast: "Corta rápido si el pool o el precio se desarman.",
  solid_tp40run: "Cobra el 70 % al +40 % y deja un resto corriendo.",
  solid_antirug: "Como el trail, pero saltea tokens con holders, LP o un salto raro.",
  solid_runner: "Cobra de a tercios y deja un resto con un trailing que se abre.",
  solid_bundlefilter: "Como el trail, pero no entra si hay una red de insiders, el top 10 está agrupado, o varias wallets salieron del mismo financiador.",
  solid_rc_strict: "Como el trail, y deja afuera lo que RugCheck marca como peligroso.",
  solid_devsell_exit: "Como el trail, y sale de una si el creador o una red insider vende.",
  solid_shield: "Como el trail, y encima filtra insiders, clusters y RugCheck. Sale si el creador vende.",
  solid_shield_runner: "Como el runner, con los filtros de insiders y RugCheck, y sale también si el creador vende.",
  solid_ptp10_be: "Vende la mitad al +10 % y, si vuelve al precio de entrada, cierra el resto sin pérdida; si sigue, trailing 15 %.",
  solid_ptp20_be: "Vende la mitad al +20 % y, si vuelve al precio de entrada, cierra el resto sin pérdida; si sigue, trailing 25 %.",
};
const FRESH = new Set(["solid_antirug", "solid_runner", "solid_bundlefilter", "solid_rc_strict", "solid_devsell_exit", "solid_shield", "solid_shield_runner", "solid_ptp10_be", "solid_ptp20_be"]);
const WD = { Sun: "dom", Mon: "lun", Tue: "mar", Wed: "mié", Thu: "jue", Fri: "vie", Sat: "sáb" };

const TABS = ["principal", "loteria", "noticias", "cripto"];
const state = {
  stats: null,
  json: "",
  tab: TABS.includes(params.get("tab")) ? params.get("tab") : "principal",
  chartMode: "cartera",
  chartChosen: false,
  tradesOpen: false,
  tapeOpen: false,
  pausedOpen: false,
  fineOpen: false,
  lotFilter: "abiertas",
  lotChosen: false,
  dev: params.get("dev") === "1",
};

let timer = 0;
const plots = new WeakMap();
const ro = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const width = Math.floor(entry.contentRect.width);
    const host = entry.target;
    if (width < 40) continue;
    if (host.dataset.w === String(width)) continue;
    if (host.id === "chart-principal") drawPrincipalChart();
    if (host.id === "chart-loteria") drawLoteriaChart();
  }
});

function esc(value) {
  return window.MemebotOps.escapeHtml(value);
}

function firstNum(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toneClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "is-flat";
  return n > 0 ? "is-up" : "is-down";
}

function signedText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const body = money.format(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

function usdHtml(value) {
  if (firstNum(value) == null) return `<span class="is-flat">—</span>`;
  return `<span class="${toneClass(value)}">${esc(signedText(value))}</span>`;
}

function ratioPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${numFmt.format(n * 100)} %`;
}

function pointsPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${numFmt.format(Math.abs(n))} %`;
}

function multText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${multFmt.format(n)}x`;
}

function multClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "is-flat";
  if (n > 1.02) return "is-up";
  if (n < 0.98) return "is-down";
  return "is-flat";
}

function formatWhen(iso, fmt) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return fmt.format(date);
}

function hora(iso) {
  return formatWhen(iso, horaFmt);
}

function clock(iso) {
  return formatWhen(iso, clockFmt);
}

function hace(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "recién";
  if (s < 90) return "hace 1 min";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const days = Math.round(s / 86400);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

function artParts(date) {
  const bag = {};
  for (const part of artFmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = bag.hour || "00";
  if (hour === "24") hour = "00";
  hour = String(hour).padStart(2, "0");
  const month = String(bag.month || "").padStart(2, "0");
  const day = String(bag.day || "").padStart(2, "0");
  return {
    key: `${bag.year}-${month}-${day}T${hour}`,
    year: bag.year,
    month,
    day,
    hour,
    weekday: WD[bag.weekday] || String(bag.weekday || "").replace(".", "").toLowerCase(),
  };
}

function keyToUtc(key) {
  const [day, hour] = String(key).split("T");
  return new Date(`${day}T${hour}:00:00-03:00`);
}

function nextKey(key) {
  return artParts(new Date(keyToUtc(key).getTime() + 3600000)).key;
}

function hourSpanKeys(firstDate, lastDate) {
  const first = artParts(firstDate).key;
  const last = artParts(lastDate).key;
  const span = Math.round((keyToUtc(last) - keyToUtc(first)) / 3600000);
  if (!Number.isFinite(span) || span < 0 || span > 72) return null;
  const keys = [];
  let key = first;
  for (let i = 0; i <= span && i < 90; i += 1) {
    keys.push(key);
    if (key === last) return keys;
    key = nextKey(key);
  }
  return keys;
}

function bucketsFromMap(map, dates, asDelta) {
  if (!map.size) return [];
  const ordered = [...map.keys()].sort();
  const filled = hourSpanKeys(dates.get(ordered[0]), dates.get(ordered[ordered.length - 1]));
  const keys = filled || ordered;
  const out = [];
  let prev = 0;
  let running = 0;
  for (const key of keys) {
    const has = map.has(key);
    let cumulative;
    let delta;
    if (asDelta) {
      delta = has ? map.get(key) : 0;
      running += delta;
      cumulative = running;
    } else {
      cumulative = has ? map.get(key) : prev;
      delta = cumulative - prev;
      prev = cumulative;
    }
    const date = dates.get(key) || keyToUtc(key);
    out.push({ key, cumulative, delta, date, empty: !has, parts: artParts(date) });
  }
  return out;
}

function bucketEquity(points) {
  const rows = [];
  for (const point of points || []) {
    if (!point || point.t == null) continue;
    const date = new Date(point.t);
    if (Number.isNaN(date.getTime())) continue;
    const y = Number(point.y);
    if (!Number.isFinite(y)) continue;
    rows.push({ date, y });
  }
  rows.sort((a, b) => a.date - b.date);
  const map = new Map();
  const dates = new Map();
  for (const row of rows) {
    const key = artParts(row.date).key;
    map.set(key, row.y);
    dates.set(key, row.date);
  }
  return bucketsFromMap(map, dates, false);
}

function bucketTrades(rows) {
  const map = new Map();
  const dates = new Map();
  let approx = false;
  let used = 0;
  for (const row of rows || []) {
    if (!row || typeof row !== "object") continue;
    const pnl = firstNum(row.pnl_usd, row.pnl);
    if (pnl == null) continue;
    let iso = row.exit_time || row.closed_at || row.exit || row.t || null;
    if (!iso && row.entry_time) {
      iso = row.entry_time;
      approx = true;
    }
    if (!iso) continue;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    const key = artParts(date).key;
    map.set(key, (map.get(key) || 0) + pnl);
    if (!dates.has(key) || date > dates.get(key)) dates.set(key, date);
    used += 1;
  }
  return { buckets: bucketsFromMap(map, dates, true), approx, used };
}

function fmtHour(bucket) {
  const p = bucket.parts || artParts(bucket.date);
  return `${p.weekday} ${p.day}/${p.month} ${Number(p.hour)} h`;
}

function extremesText(buckets) {
  const real = (buckets || []).filter((b) => !b.empty && Math.abs(b.delta) >= 0.0005);
  if (!real.length) return "";
  let best = real[0];
  let worst = real[0];
  for (const bucket of real) {
    if (bucket.delta > best.delta) best = bucket;
    if (bucket.delta < worst.delta) worst = bucket;
  }
  if (best === worst) return `Esa hora: ${fmtHour(best)} (${signedText(best.delta)} USD).`;
  return `Mejor hora ${fmtHour(best)} (${signedText(best.delta)}). Peor hora ${fmtHour(worst)} (${signedText(worst.delta)}).`;
}

function opsView(stats) {
  return window.MemebotOps.viewForRender(stats);
}

function principalView(stats) {
  const view = opsView(stats || {});
  const book = view.principal;
  const buckets = bucketEquity(book.equity);
  if (!view.ok) {
    return { buckets: [], note: view.error || "No hay datos de la cartera." };
  }
  if (!buckets.length) {
    return { buckets: [], note: "La cartera todavía no tiene cierres en este período. Las estrategias del laboratorio no se suman acá." };
  }
  const since = book.familySince ? `, desde ${esc(book.family)} (${esc(hora(book.familySince))})` : "";
  const version = book.versionSince && book.version && book.version !== book.family
    ? `; ${esc(book.version)} arranca el ${esc(hora(book.versionSince))}`
    : "";
  return {
    buckets,
    note: `Solo la cartera${since}${version}. Al cierre de cada hora ART; la barra es el neto de esa hora. El laboratorio no entra.`,
  };
}

function loteriaView(stats) {
  const lot = stats && stats.loteria;
  if (!lot || typeof lot !== "object") {
    return { buckets: [], note: "Este envío no trae lotería." };
  }
  const all = Array.isArray(lot.closed_bets) ? lot.closed_bets : [];
  const cur = Array.isArray(lot.versions) ? lot.versions.find((v) => v && v.current) : null;
  const t0 = cur && cur.since ? Date.parse(cur.since) : null;
  const closed = t0 ? all.filter((b) => Date.parse(b.entry_time || b.exit_time || "") >= t0) : all;
  if (t0 && !closed.length) {
    return { buckets: [], note: `${esc(cur.version)} (desde el ${esc(hora(cur.since))}) todavía no cerró apuestas. Las de versiones anteriores están abajo, en "Versiones anteriores".` };
  }
  const built = bucketTrades(closed);
  if (built.buckets.length) {
    return {
      buckets: built.buckets,
      note: built.approx
        ? "PnL realizado por hora ART. En alguna apuesta no había hora de cierre y usé la de entrada. El resultado abierto no tiene historia."
        : "PnL realizado por hora ART, sumando apuestas cerradas. El mark abierto no se puede partir por hora.",
    };
  }
  return {
    buckets: [],
    note: "Sin curva horaria: no hay cierres con hora y PnL. Las abiertas traen múltiplo, no un resultado por hora, y la sombra viene solo en totales.",
  };
}

function confClass(label) {
  if (label === "confiable") return "high";
  if (label === "en prueba") return "mid";
  return "low";
}

function confidenceOf(item) {
  if (item.confidence) return item.confidence;
  const n = Number(item.trades) || 0;
  if (n < 50) return "pocos datos";
  if (n <= 200) return "en prueba";
  return "confiable";
}

function reasonPlain(trade) {
  if (trade.reason_es) return trade.reason_es;
  const text = String(trade.reason || "");
  if (text === "stop") return "Bajó más del límite y cortó la pérdida.";
  if (text === "trailing") return "Venía subiendo y devolvió una parte: se activó el trailing.";
  if (text === "tiempo") return "Se cumplió el tiempo máximo y cerró.";
  if (text === "breakeven") return "Ya había cobrado la mitad y volvió al precio de entrada: cerró el resto sin pérdida.";
  if (text.startsWith("TP ")) return `Llegó al objetivo ${text.slice(3)} y vendió.`;
  if (text.startsWith("liquidez cayó")) return "La liquidez del pool se derrumbó y salió.";
  if (text.startsWith("caída")) return "El precio se cayó fuerte en un minuto y salió.";
  return text || "Cerró.";
}

function orderedStrategies(rows) {
  const copy = (rows || []).map((item) => ({
    ...item,
    status: item.status || "activa",
    confidence: confidenceOf(item),
    plain: item.plain || PLAIN[item.name] || item.title || "",
    fresh: Boolean(item.fresh) || FRESH.has(item.name),
  }));
  const running = copy.filter((item) => item.status !== "pausada");
  const resting = copy.filter((item) => item.status === "pausada");
  const byPnl = (a, b) => (Number(b.pnl_usd) || 0) - (Number(a.pnl_usd) || 0);
  if (running.some((item) => item.rank == null)) running.sort(byPnl);
  else running.sort((a, b) => a.rank - b.rank);
  running.forEach((item, index) => { item.rank = index + 1; });
  resting.sort(byPnl);
  resting.forEach((item) => { item.rank = null; });
  return { running, resting };
}

function safeMint(mint) {
  return typeof mint === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(mint);
}

function extLinks(mint) {
  if (!safeMint(mint)) return "";
  const dex = `https://dexscreener.com/solana/${encodeURIComponent(mint)}`;
  const pump = `https://pump.fun/coin/${encodeURIComponent(mint)}`;
  return `<p class="link-row"><a href="${esc(dex)}" target="_blank" rel="noopener noreferrer">DexScreener</a><a href="${esc(pump)}" target="_blank" rel="noopener noreferrer">pump.fun</a></p>`;
}

function shortMint(mint) {
  if (!mint || mint.length < 12) return esc(mint || "—");
  return `${esc(mint.slice(0, 4))}…${esc(mint.slice(-4))}`;
}

function meter(label, strongHtml, ratio, extra, sub) {
  const width = Math.max(0, Math.min(100, (Number(ratio) || 0) * 100));
  return `<div class="meter ${extra || ""}">
    <div class="meter-top"><span>${esc(label)}</span><strong>${strongHtml}</strong></div>
    <div class="meter-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(width)}" aria-label="${esc(label)}"><div class="meter-fill" style="width:${width.toFixed(1)}%"></div></div>
    ${sub ? `<p class="meter-sub">${sub}</p>` : ""}
  </div>`;
}

function tradeCard(trade) {
  const jup = firstNum(trade.pnl_jup_usd);
  const maxGain = firstNum(trade.max_gain_pct);
  const bits = [
    trade.exit_time ? `${esc(hora(trade.exit_time))} ART` : "",
    maxGain == null ? "" : `máx ${esc(pointsPct(maxGain))}`,
    jup == null ? "" : `Jupiter ${esc(signedText(jup))} USD`,
  ].filter(Boolean);
  const dex = safeMint(trade.mint)
    ? ` · <a href="https://dexscreener.com/solana/${encodeURIComponent(trade.mint)}" target="_blank" rel="noopener noreferrer">DexScreener</a>`
    : "";
  return `<article class="row">
    <header><strong>${esc(trade.sym || "token")}</strong><span class="pnl ${toneClass(trade.pnl_usd)}">${esc(signedText(trade.pnl_usd))} USD</span></header>
    <p class="meta">${esc(trade.strategy || "estrategia")} · ${esc(pointsPct(trade.pnl_pct))}</p>
    <p class="why">${trade.duration_s != null ? esc(motivoLine(trade)) : esc(reasonPlain(trade))}</p>
    <p class="meta">${bits.join(" · ")}${dex}</p>
  </article>`;
}

function positionCard(pos) {
  let live;
  if (pos.pending) live = `<span class="meta">Esperando el precio</span>`;
  else if (firstNum(pos.unrealized_usd) == null) live = `<span class="meta">Sin precio fresco</span>`;
  else live = `<span class="pnl ${toneClass(pos.unrealized_usd)}">${esc(signedText(pos.unrealized_usd))} USD</span>`;
  const tag = pos.portfolio === true
    ? `<span class="pill book">cartera</span>`
    : pos.portfolio === false
      ? `<span class="pill lab">laboratorio</span>`
      : "";
  const detail = pos.pending
    ? "Todavía no compró: espera el próximo precio que vea."
    : pos.half
      ? "Ya cobró una parte. El número es lo que saldría si vende el resto ahora."
      : "Si vendiera ahora, esto es lo que saldría.";
  const mins = firstNum(pos.minutes);
  const when = [
    safeMint(pos.mint) ? "" : "",
    mins == null ? "" : `abierta hace ${esc(numFmt.format(mins))} min`,
    pos.entry_time ? `${esc(hora(pos.entry_time))} ART` : "",
  ].filter(Boolean).join(" · ");
  return `<article class="row">
    <header><strong>${esc(pos.sym || "token")} ${tag}</strong>${live}</header>
    <p class="why">${esc(pos.strategy || "estrategia")}. ${esc(detail)}</p>
    <p class="meta">${when}</p>
    ${extLinks(pos.mint)}
  </article>`;
}

function stratCard(item) {
  const pills = [
    `<span class="pill ${confClass(item.confidence)}">${esc(item.confidence || "pocos datos")}</span>`,
    item.fresh ? `<span class="pill new">nueva</span>` : "",
    item.status === "pausada" ? `<span class="pill">pausada</span>` : "",
    Number(item.open_positions) > 0 ? `<span class="pill lab">${esc(item.open_positions)} abierta${Number(item.open_positions) === 1 ? "" : "s"}</span>` : "",
  ].filter(Boolean).join("");
  const jup = firstNum(item.pnl_jup_usd);
  return `<article class="strat${item.status === "pausada" ? " is-paused" : ""}">
    <span class="strat-rank">${item.rank == null ? "–" : esc(item.rank)}</span>
    <div>
      <h3>${esc(item.name || "estrategia")}</h3>
      <div class="pills">${pills}</div>
    </div>
    <div class="strat-pnl">
      <span class="big ${toneClass(item.pnl_usd)}">${esc(signedText(item.pnl_usd))}</span>
      <span class="sub">${esc(ratioPct(item.win_rate))} · ${esc(item.trades ?? "—")} cierres</span>
    </div>
    <p class="strat-plain">${esc(item.plain || item.title || "")}</p>
    ${jup == null ? "" : `<p class="strat-jup">Jupiter ${esc(signedText(jup))} USD</p>`}
  </article>`;
}

function betCard(bet) {
  const closed = bet.status === "closed" || (bet.pnl_usd != null && bet.status !== "open" && bet.status !== "fill");
  const filling = bet.status === "fill";
  let stateHtml;
  if (closed && firstNum(bet.pnl_usd, bet.pnl) != null) {
    const pnl = firstNum(bet.pnl_usd, bet.pnl);
    stateHtml = `<span class="pnl ${toneClass(pnl)}">${esc(signedText(pnl))} USD</span>`;
  } else if (filling) stateHtml = `<span class="meta">Esperando el precio</span>`;
  else {
    const openPnl = firstNum(bet.pnl_usd);
    stateHtml = `<span class="pnl ${multClass(bet.mult_now)}">${esc(multText(bet.mult_now))}`
      + (openPnl == null ? "" : ` · ${esc(signedText(openPnl))} USD`) + `</span>`;
  }
  const bits = [];
  if (firstNum(bet.max_mult) != null) bits.push(`pico ${esc(multText(bet.max_mult))}`);
  if (bet.stake_back) bits.push("ya vendió parte");
  if (closed && bet.exit_reason) bits.push(`cerró: ${esc(bet.exit_reason)}`);
  if (firstNum(bet.mc_sol) != null) bits.push(`MC ${esc(numFmt.format(bet.mc_sol))} SOL`);
  if (bet.socials != null && bet.socials !== "") bits.push(`${esc(bet.socials)} redes`);
  const when = bet.entry_time ? `${esc(hora(bet.entry_time))} ART` : "";
  const hit = firstNum(bet.max_mult);
  const hitPill = hit != null && hit >= 10 ? `<span class="pill new">10x</span>` : "";
  return `<article class="row">
    <header><strong>${esc(bet.sym || "token")} ${hitPill}</strong>${stateHtml}</header>
    <p class="why">${bits.join(" · ") || "Sin detalle de la apuesta."}</p>
    <p class="meta">${shortMint(bet.mint)}${when ? ` · ${when}` : ""}</p>
    ${extLinks(bet.mint)}
  </article>`;
}

function kpi(label, value, sub, klass) {
  return `<article class="kpi"><span class="lbl">${esc(label)}</span><strong class="${klass || ""}">${value}</strong>${sub ? `<em>${sub}</em>` : ""}</article>`;
}

function sinceLine(stats, book) {
  const size = firstNum(stats.size_usd);
  const sizeTxt = size == null ? "unos dólares de papel" : `${numFmt.format(size)} USD de papel`;
  if (book && book.version && book.version_since) {
    const maxOpen = book.max_open || 5;
    const vt = Number(book.version_trades || 0);
    const verTxt = vt
      ? `${esc(book.version)} (desde el ${esc(hora(book.version_since))}): ${esc(signedText(book.version_pnl_usd))} USD en ${esc(vt)} cierres`
      : `${esc(book.version)} (desde el ${esc(hora(book.version_since))}) todavía sin cierres`;
    const fam = book.family && book.family_since && book.family !== book.version
      ? `Reglas de la cartera desde ${esc(book.family)} (${esc(hora(book.family_since))} ART). `
      : "";
    const gross = firstNum(book.gross_usd);
    const net = book.net_basis
      ? ` Los montos son NETOS: ya descuentan costos reales de Solana (fee del pool, demora al comprar, red).${gross != null ? ` <small>Bruto, sin costos: ${esc(signedText(gross))} USD.</small>` : ""}`
      : "";
    return `${fam}Versión actual ${verTxt}. Tope de ${esc(maxOpen)} abiertas. Cada entrada son ${esc(sizeTxt)}.${net}`;
  }
  if (book && stats.since) {
    const maxOpen = book.max_open || 5;
    const per = book.per_mint || 1;
    const perTxt = Number(per) === 1 ? "Un trade por token" : `${esc(per)} trades por token`;
    return `Desde el ${esc(hora(stats.since))} ART. ${perTxt}, tope de ${esc(maxOpen)} abiertos. Cada entrada son ${esc(sizeTxt)}.`;
  }
  if (stats.since) return `Cuenta desde el ${esc(hora(stats.since))} ART. Cada entrada son ${esc(sizeTxt)}.`;
  return `Cada entrada son ${esc(sizeTxt)}. No hay wallet ni órdenes.`;
}

function finePrint(stats, book, all) {
  const lines = [];
  const jup = firstNum((book || all).pnl_jup_usd);
  if (jup != null) {
    lines.push(`Con la cotización de Jupiter, ${book ? "la cartera" : "el total"} daría ${esc(signedText(jup))} USD. Si Jupiter no contesta, ese número no viene.`);
  }
  if (book && all && all !== book && firstNum(all.pnl_usd) != null) {
    lines.push(`Si cada estrategia operara por separado, la suma daría ${esc(signedText(all.pnl_usd))} USD en ${esc(all.trades ?? "—")} cierres, con ${esc(ratioPct(all.win_rate))} de aciertos. El ranking de abajo es esa comparación, no la cartera.`);
  }
  const v3 = stats.v3;
  if (v3 && v3.trades) {
    lines.push(`v3, desde el ${esc(hora(v3.since))} hasta v4: ${esc(signedText(v3.pnl_usd))} USD en ${esc(v3.trades)} cierres, ${esc(ratioPct(v3.win_rate))} de aciertos.`);
  }
  const old = stats.history_before;
  if (old && old.trades) {
    lines.push(`Todo lo anterior a v4 queda afuera del total: ${esc(signedText(old.pnl_usd))} USD en ${esc(old.trades)} cierres, ${esc(ratioPct(old.win_rate))} de aciertos.`);
  }
  if (!lines.length) return "";
  return `<details class="fine" id="fine"${state.fineOpen ? " open" : ""}><summary>Cómo está armado este número</summary>${lines.map((line) => `<p>${line}</p>`).join("")}</details>`;
}

function versionsHtml(list, kind) {
  const old = (Array.isArray(list) ? list : []).filter((v) => v && !v.current);
  if (!old.length) return "";
  const rows = old.map((v) => {
    const span = `${esc(hora(v.since))}${v.until ? ` → ${esc(hora(v.until))}` : ""}`;
    if (kind === "lot") {
      return `<p><strong>${esc(v.version)}</strong> (${span}): ${esc(signedText(v.pnl))} USD en ${esc(v.n)} apuestas, ${esc(v.wins)} ganadoras de ${esc(v.closed)} cerradas, mejor ${esc(multText(v.best))}.</p>`;
    }
    const r = v.avg_r == null ? "" : `, R medio ${esc(Number(v.avg_r).toFixed(2))}`;
    return `<p><strong>${esc(v.version)}</strong> (${span}): ${esc(signedText(v.pnl_usd))} USD en ${esc(v.trades)} cierres, ${esc(ratioPct(v.win_rate))} de aciertos${r}.</p>`;
  }).join("");
  return `<details class="fine" id="versions-${kind}"><summary>Versiones anteriores</summary>${rows}</details>`;
}

// v4.45: la cartera tiene varias estrategias; el titular es la suma, acá va cada una
function segBtn(mode, label) {
  const on = state.chartMode === mode;
  return `<button type="button" data-chart-mode="${mode}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
}

// v4.37-panel: lotería real desde la última versión + laboratorio + señales + cohetes
function filterBtn(id, label) {
  const on = state.lotFilter === id;
  return `<button type="button" data-lot-filter="${id}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
}

function filteredBets(openBets, closedBets) {
  const decorate = (rows, fallback) => rows.map((bet) => ({ ...bet, status: bet.status || fallback }));
  const byTime = (a, b) => new Date(b.exit_time || b.entry_time || 0) - new Date(a.exit_time || a.entry_time || 0);
  const open = decorate(openBets, "open").sort(byTime);
  const closed = decorate(closedBets, "closed").sort(byTime);
  if (state.lotFilter === "cerradas") return closed;
  if (state.lotFilter === "abiertas") return open;
  return open.concat(closed);
}

function variantsCard(list) {
  const rows = list.map((v) => {
    const ev = firstNum(v.ev);
    const best = v.best_sym ? `${esc(multText(v.best))} ${esc(v.best_sym)}` : "—";
    return `<tr><td>${esc(v.title || v.key)}</td><td class="num">${esc(v.n ?? 0)}</td>
      <td class="num">${esc(v.peak10 ?? 0)} / ${esc(v.peak20 ?? 0)} / ${esc(v.peak50 ?? 0)}</td>
      <td class="num">${best}</td><td class="num ${ev == null ? "" : toneClass(ev)}">${ev == null ? "—" : esc(signedText(ev))}</td></tr>`;
  }).join("");
  return `<section class="shadow-card block" id="lot-variants">
    <p class="shadow-kicker">Variantes</p>
    <h2>Salidas comparadas sobre las mismas señales</h2>
    <p class="hero-sub">Pico real = máximo mientras estuvo abierta o en las 48 h de seguimiento. EV en USD por señal de 1 USD.</p>
    <div class="table-wrap"><table class="table"><thead><tr><th>Variante</th><th class="num">Señales</th>
      <th class="num">10x / 20x / 50x</th><th class="num">Mejor</th><th class="num">EV</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
  </section>`;
}

function shadowCard(shadow) {
  const pnl = firstNum(shadow.pnl);
  const cells = [];
  if (shadow.n != null) cells.push(kpi("Señales", esc(shadow.n), shadow.today != null ? `${esc(shadow.today)} hoy, sin tope` : "sin tope de plata"));
  if (pnl != null) cells.push(kpi("PnL sombra", esc(signedText(pnl)), "USD de papel", toneClass(pnl)));
  if (firstNum(shadow.realized) != null) cells.push(kpi("Realizado", esc(signedText(shadow.realized)), "USD", toneClass(shadow.realized)));
  if (firstNum(shadow.open_mark) != null) cells.push(kpi("Abierto", esc(signedText(shadow.open_mark)), "USD", toneClass(shadow.open_mark)));
  if (shadow.peak10 != null || shadow.hit10 != null) cells.push(kpi("Tocaron 10x", esc(shadow.peak10 ?? "—"), shadow.hit10 == null ? "" : `cobrados ${esc(shadow.hit10)}`));
  if (shadow.best_peak != null || shadow.best_sym) cells.push(kpi("Mejor", esc(multText(shadow.best_peak)), esc(shadow.best_sym || ""), multClass(shadow.best_peak)));
  const extra = [];
  if (shadow.open != null) extra.push(`${esc(shadow.open)} abiertas`);
  if (shadow.closed != null) extra.push(`${esc(shadow.closed)} cerradas`);
  if (shadow.dead != null) extra.push(`${esc(shadow.dead)} se murieron`);
  if (shadow.hit2 != null) extra.push(`${esc(shadow.hit2)} con ≥2x`);
  return `<section class="shadow-card block">
    <p class="shadow-kicker">Sombra</p>
    <h2>Mismos filtros, sin descontar del presupuesto</h2>
    <p class="hero-sub">Sirve para medir. No es una apuesta de la lotería y no gasta el presupuesto de papel.</p>
    ${cells.length ? `<div class="kpi-grid cols-4" style="margin-top:12px">${cells.join("")}</div>` : `<p class="meta">Este envío no detalla la sombra.</p>`}
    ${extra.length ? `<div class="chips">${extra.map((chip) => `<span class="chip">${chip}</span>`).join("")}</div>` : ""}
  </section>`;
}

function telegramFlag(stats) {
  if (!stats || typeof stats !== "object") return null;
  if (typeof stats.telegram === "boolean") return stats.telegram;
  if (stats.notify && typeof stats.notify.telegram === "boolean") return stats.notify.telegram;
  if (stats.alerts && typeof stats.alerts.telegram === "boolean") return stats.alerts.telegram;
  return null;
}

function cocosValue(stats) {
  const raw = stats && (stats.cocos || (stats.real && typeof stats.real === "object" ? stats.real : null));
  if (!raw || typeof raw !== "object") return null;
  return {
    label: raw.label || raw.name || "Cartera Cocos",
    usd: firstNum(raw.usd, raw.cocos_usd, raw.balance, raw.balance_usd),
    when: raw.updated_at || raw.at || "",
  };
}

function bookStrategyNames(book) {
  const rows = book && Array.isArray(book.by_strategy) ? book.by_strategy : [];
  return new Set(rows.map((row) => row && row.strategy).filter(Boolean));
}

function sectionPnl(stats) {
  const view = opsView(stats || {});
  return {
    principal: view.principal.pnl,
    loteria: view.loteriaPnl,
    cripto: view.aslPnl,
    noticias: view.noticiasPnl,
  };
}

function pageHead(title, sub) {
  return `<header class="page-head"><div><h1>${esc(title)}</h1><p>${sub}</p></div><p class="badge-paper">PAPER · sin dinero real</p></header>`;
}

function renderLive(stats) {
  const el = document.getElementById("live");
  el.hidden = false;
  const alive = stats.alive;
  el.className = `live ${alive === true ? "is-on" : alive === false ? "is-off" : "is-unknown"}`;
  const label = alive === true ? "Bot andando" : alive === false ? "Bot parado" : "Bot sin señal";
  const when = stats.last_scan_at || stats.updated_at;
  const rel = when ? hace(when) : "";
  el.title = when ? `${stats.last_scan_at ? "Último escaneo" : "Última actualización"} ${hora(when)} ART${rel ? `, ${rel}` : ""}` : "";
  el.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${label}</span>`;
}

function renderChrome(stats) {
  const pnl = sectionPnl(stats);
  for (const name of ["principal", "loteria", "cripto", "noticias"]) {
    const el = document.getElementById(`nav-pnl-${name}`);
    if (!el) continue;
    const n = pnl[name];
    el.className = `tab-pnl ${n == null ? "muted" : toneClass(n)}`;
    el.textContent = n == null ? "—" : signedText(n);
  }
  const newsTab = document.getElementById("tab-noticias");
  const hasNews = Boolean(stats.noticias_x && typeof stats.noticias_x === "object");
  if (newsTab) newsTab.hidden = !hasNews;
  if (!hasNews && state.tab === "noticias") state.tab = "principal";
  const cocos = opsView(stats || {}).cocos;
  const cocosBox = document.getElementById("side-real");
  const cocosEl = document.getElementById("cocos-line");
  if (cocosBox) cocosBox.hidden = false;
  if (cocosEl) {
    const amount = !cocos.present || cocos.usd == null
      ? `<em>sin saldo en este envío</em>`
      : `<b>${esc(money.format(cocos.usd))}</b>`;
    const when = cocos.present && cocos.when ? `<span class="side-when">${esc(hora(cocos.when))} ART</span>` : "";
    cocosEl.innerHTML = `<span>${esc(cocos.label || "Cartera Cocos")}</span>${amount}${when}`;
  }
  const scan = document.getElementById("scan-line");
  if (scan) {
    scan.textContent = stats.last_scan_at
      ? `Último escaneo ${clock(stats.last_scan_at)} ART`
      : "Último escaneo sin hora";
  }
  const tg = document.getElementById("tg-line");
  if (tg) {
    const flag = telegramFlag(stats);
    tg.hidden = flag == null;
    tg.className = `tg-line${flag === true ? " is-on" : flag === false ? " is-off" : ""}`;
    tg.textContent = flag === true ? "Alertas por Telegram" : flag === false ? "Telegram apagado" : "";
  }
}

function paintPanel(id, label, build) {
  const el = document.getElementById(id);
  try {
    el.innerHTML = build();
  } catch (error) {
    el.innerHTML = `<section class="sec"><p class="kick">${esc(label)}</p><p class="muted">Esta sección no se pudo armar (${esc(error.message || "error")}). El resto del tablero sigue.</p></section>`;
  }
}

function renderFoot(stats) {
  const beat = state.dev ? "snapshot local" : stats.sample ? "ejemplo" : stats.alive === true ? "andando" : stats.alive === false ? "parado" : "sin señal";
  const scan = stats.last_scan_at ? `Último escaneo ${hora(stats.last_scan_at)} ART. ` : "";
  const upd = stats.updated_at ? `Actualización ${hora(stats.updated_at)} ART. ` : "";
  const version = stats.version ? `v${esc(stats.version)}. ` : "";
  document.getElementById("foot").textContent = `${beat[0].toUpperCase()}${beat.slice(1)}. ${scan}${upd}${version}Se refresca solo cada 30 segundos. Hora de Argentina (ART).`;
}

function renderBanner(stats) {
  const banner = document.getElementById("banner");
  if (state.dev) {
    banner.hidden = false;
    banner.textContent = "Estás en un modo local sin operaciones publicadas.";
    return;
  }
  if (stats.sample) {
    banner.hidden = false;
    banner.textContent = "Este envío está marcado como ejemplo. No se muestran esas operaciones como si fueran reales.";
    return;
  }
  banner.hidden = true;
}

function render(stats) {
  const incoming = stats && typeof stats === "object" ? stats : {};
  const sample = incoming.sample === true;
  const shown = sample ? window.MemebotOps.blankStats(incoming) : incoming;
  const json = JSON.stringify(shown);
  const same = json === state.json && state.stats;
  state.stats = shown;
  state.json = json;
  if (!state.chartChosen) state.chartMode = "cartera";
  const count = document.getElementById("tab-loteria-count");
  const openCount = shown.loteria && Array.isArray(shown.loteria.open_bets) ? shown.loteria.open_bets.length : 0;
  count.hidden = openCount <= 0;
  count.textContent = openCount ? String(openCount) : "";
  const ccount = document.getElementById("tab-cripto-count");
  const cOpen = shown.asl && Array.isArray(shown.asl.open) ? (shown.asl.open || []).length : 0;
  ccount.hidden = cOpen <= 0;
  ccount.textContent = cOpen ? String(cOpen) : "";
  const ncount = document.getElementById("tab-noticias-count");
  const nOpen = shown.noticias_x && Array.isArray(shown.noticias_x.open) ? shown.noticias_x.open.length : 0;
  if (ncount) { ncount.hidden = nOpen <= 0; ncount.textContent = nOpen ? String(nOpen) : ""; }
  renderLive(shown);
  renderChrome(shown);
  renderBanner(shown);
  renderFoot(shown);
  const pnl = opsView(shown).principal.pnl;
  document.title = pnl == null ? "Memebot · simulación" : `Memebot · ${signedText(pnl)} USD`;
  if (same) return;
  paintPanel("panel-principal", "Principal", () => renderPrincipal(shown));
  paintPanel("panel-loteria", "Lotería", () => renderLoteria(shown));
  paintPanel("panel-cripto", "Acciones ASL", () => renderAsl(shown));
  paintPanel("panel-noticias", "Noticias", () => renderNoticias(shown));
  applyTab();
  document.querySelectorAll(".chart-host").forEach((host) => {
    if (!host.dataset.obs) {
      host.dataset.obs = "1";
      ro.observe(host);
    }
  });
  requestAnimationFrame(() => {
    if (state.tab === "loteria") drawLoteriaChart();
    else drawPrincipalChart();
  });
}

// v4.29: 📈 CRIPTO (paper, ledger aparte)
const CRIPTO_LABEL = {
  cripto_mateo: "⭐ Estrategia Mateo",
  lab_cripto_asl: "Lab · ASL diario (copia)",
  cripto_ema4h_reg: "Lab · 4h EMA20/50 (ex principal)",
  lab_cripto_4h_35: "Lab · 4h, 35 monedas",
  cripto_analista: "🧠 Analista",
  cripto_ema_reg: "Lab · 1h, 8 viejas",
  lab_cripto_pb_reg: "Lab · pullback 1h, 8 viejas",
};
function tsIso(ts) {
  const n = firstNum(ts);
  return n == null ? null : new Date(n * 1000).toISOString();
}
function pxText(v) {
  const n = firstNum(v);
  if (n == null) return "—";
  return n >= 100 ? numFmt.format(n) : n.toPrecision(4);
}
function wrText(v) {
  const n = firstNum(v);
  return n == null ? "—" : `${Math.round(n * 100)} %`;
}
// ===== Rediseño 27/10 (mockup "Memebot app redesign"): Principal, Lotería y Cripto =====
const STRAT_SHORT = {
  solid_trail_p20: ["p20", "trailing"],
  cartera_tp12: ["tp12", "vende todo en +12 %"],
  cartera_s300: ["s300", "5 USD · veta latencia e impacto Jupiter (v5.36)"],
};
function expOpen(key) { return Boolean(state.exp && state.exp[key]); }
function cell(label, valueHtml, sub, klass) {
  return `<div class="cell"><span class="lbl">${esc(label)}</span><strong class="num-xl ${klass || ""}">${valueHtml}</strong>${sub ? `<em>${sub}</em>` : ""}</div>`;
}
function mini(label, valueHtml, klass) {
  return `<div class="mini"><span class="lbl">${esc(label)}</span><strong class="${klass || ""}">${valueHtml}</strong></div>`;
}
function heroNum(value, unit) {
  const n = firstNum(value);
  return `<p class="big-num ${n == null ? "is-flat" : toneClass(n)}">${n == null ? "—" : esc(signedText(n).replace(/^\+(?=0,00$)/, ""))}<small>${esc(unit)}</small></p>`;
}
function chartSection(id, title, sub, right) {
  return `<section class="sec chart-sec" id="chart-card-${id}">
    <div class="sec-head"><h2>${esc(title)}</h2><p id="${id === "principal" ? "chart-note" : "chart-note-lot"}">${esc(sub)}</p>
      <div class="sec-right"><span class="chart-summary" id="${id === "principal" ? "chart-summary" : "chart-summary-lot"}"></span></div></div>
    <div id="chart-${id}" class="chart-host"></div>
    <p class="legend"><span><i class="swatch eq"></i>Acumulado</span><span><i class="swatch up"></i>Hora en positivo</span><span><i class="swatch down"></i>Hora en negativo</span>${right || ""}</p>
  </section>`;
}
function pctOf(v, total) {
  const a = Number(v) || 0; const b = Number(total) || 0;
  return b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0;
}

// ---------- PRINCIPAL ----------
function stratStrip(book, ledgers) {
  const bys = book && Array.isArray(book.by_strategy) ? book.by_strategy.slice() : [];
  if (!bys.length) return "";
  bys.sort((a, b) => Number(b && b.strategy === "cartera_s300") - Number(a && a.strategy === "cartera_s300"));
  return `<div class="strip">${bys.map((b) => {
    const known = STRAT_SHORT[b.strategy];
    const name = known ? known[0] : b.strategy;
    const desc = known ? known[1] : "";
    const main = b.strategy === "cartera_s300" || b.main === true;
    const p = firstNum(b.pnl_usd) ?? 0;
    const t = firstNum(b.pnl_today_usd) ?? 0;
    const n = Number(b.trades) || 0;
    const sub0 = n ? desc : `${desc}${desc ? " · " : ""}sin cierres aún`;
    const sub = b.cut_paused ? `pausada por límite · ${sub0}` : sub0;
    const led = (ledgers || []).find((row) => row && row.name === b.strategy);
    const hist = led && Number(led.trades) !== n
      ? `<div class="strip-row small"><span class="muted">Historial ${esc(signedText(led.pnl))} · ${esc(led.trades)} cierres, fuera de esta versión</span></div>`
      : "";
    return `<div class="strip-cell${main ? " is-main" : ""}">
      <p class="strip-name"><span class="mono">${esc(name)}</span>${main ? ` <span class="pill book">principal</span>` : ""} <span class="muted">${esc(sub)}</span></p>
      <div class="strip-row"><strong class="num-lg ${toneClass(p)}">${esc(signedText(p))}</strong><span class="muted mono">hoy ${esc(signedText(t))}</span></div>
      <div class="bar"><i style="width:${(n ? (Number(b.win_rate) || 0) * 100 : 0).toFixed(1)}%"></i></div>
      <div class="strip-row small"><span>${esc(n)} cierres · ${esc(ratioPct(b.win_rate))} aciertos</span><span>${esc(b.open_positions ?? 0)} abiertas</span></div>
      ${hist}
    </div>`;
  }).join("")}</div>`;
}
function slotBars(n, max) {
  let s = "";
  for (let i = 0; i < max; i += 1) s += `<i class="${i < n ? "on" : ""}"></i>`;
  return `<div class="slots">${s}</div>`;
}
function openRowsPrincipal(opens) {
  return opens.map((pos) => {
    const u = firstNum(pos.unrealized_usd);
    const tag = pos.portfolio === true
      ? `<span class="pill book">cartera</span>`
      : pos.portfolio === false
        ? `<span class="pill lab">lab</span>`
        : "";
    return `<div class="orow"><div><strong>${esc(pos.sym || "token")}</strong> ${tag}<br><span class="muted small">${esc(pos.strategy || "")}${pos.entry_time ? ` · ${esc(hora(pos.entry_time))}` : ""}</span></div>
      <span class="mono ${pos.pending || u == null ? "muted" : toneClass(u)}">${pos.pending ? "esperando precio" : u == null ? "sin precio" : esc(signedText(u))}</span></div>`;
  }).join("");
}
function reasonTag(t) {
  const r = String(t.reason || "");
  if (r === "stop") return "Stop";
  if (r === "tiempo") return "Tiempo";
  if (r === "trailing") return "Trailing";
  if (r === "breakeven") return "Sin pérdida";
  if (r.startsWith("TP")) return "TP";
  if (r.startsWith("liquidez")) return "Liquidez";
  if (r.startsWith("caída")) return "Caída";
  return "Cierre";
}
function durText(sec) {
  const s = Number(sec);
  if (!Number.isFinite(s)) return "—";
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return r ? `${m} min ${r} s` : `${m} min`;
}
function pxText(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n >= 1 ? n.toFixed(4) : n.toPrecision(4);
}
function sparkline(path) {
  if (!Array.isArray(path) || path.length < 2) return `<p class="muted small">Sin recorrido de precio guardado para esta operación.</p>`;
  const W = 320, H = 90, P = 6;
  const xs = path.map((p) => Number(p[0]) || 0), ys = path.map((p) => Number(p[1]) || 0);
  const xmax = Math.max(1, ...xs), ymin = Math.min(-10, ...ys), ymax = Math.max(20, ...ys);
  const X = (x) => P + (x / xmax) * (W - 2 * P), Y = (y) => P + (ymax - y) / (ymax - ymin) * (H - 2 * P);
  const pts = path.map((p, i) => `${X(xs[i]).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(" ");
  const line = (y, cls, label) => `<line x1="${P}" x2="${W - P}" y1="${Y(y).toFixed(1)}" y2="${Y(y).toFixed(1)}" class="${cls}"/><text x="${W - P}" y="${(Y(y) - 2).toFixed(1)}" class="spk-lbl" text-anchor="end">${label}</text>`;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Recorrido del precio">
    ${line(0, "spk-zero", "compra")}${line(20, "spk-tp", "+20%")}${line(-10, "spk-sl", "−10%")}
    <polyline points="${pts}" class="spk-path"/></svg>`;
}
function motivoLine(t) {
  const mg = firstNum(t.max_gain_pct), mn = firstNum(t.min_gain_pct);
  const parts = [];
  if (mg != null) parts.push(`Llegó a ${pointsPct(mg)}${mn == null ? "" : ` (mín ${pointsPct(mn)})`}`);
  else if (mn != null) parts.push(`Mín ${pointsPct(mn)}`);
  if (firstNum(t.duration_s) != null) parts.push(`duró ${durText(t.duration_s)}`);
  parts.push(`vendió: ${String(t.reason_short || reasonTag(t)).toLowerCase()}`);
  let line = parts.join(", ") + ".";
  if (t.warn) line = `⚠️ Cayó a ${pointsPct(mn != null ? Math.min(mn, t.pnl_pct) : t.pnl_pct)} y el stop no cortó en −10%. ` + line;
  return line;
}
function mcText(v) { v = Number(v); if (!v) return null; return v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? Math.round(v / 1e3) + "k" : String(Math.round(v)); }
function mcLine(a, b) { const x = mcText(a), y = mcText(b); if (!x) return null; return y ? `mc ${x} → mc ${y} (${signedText((b / a - 1) * 100)} %)` : `mc ${x}`; }
function tradeKey(t) { return `${t.strategy}|${t.mint}|${t.entry_time}`; }
function tradeDetail(t) {
  const mg = firstNum(t.max_gain_pct), mn = firstNum(t.min_gain_pct);
  const item = (k, v) => `<div><span class="muted small">${esc(k)}</span><br><strong class="mono">${v}</strong></div>`;
  return `<div class="tdet">
    <div class="tdet-grid">
      ${item("Compra", `${esc(hora(t.entry_time))} · ${mcText(t.entry_mc) ? "mc " + esc(mcText(t.entry_mc)) : esc(pxText(t.entry_price))}`)}
      ${item("Venta", `${esc(hora(t.exit_time))} · ${mcText(t.exit_mc) ? "mc " + esc(mcText(t.exit_mc)) : esc(pxText(t.exit_price))}`)}
      ${mcLine(t.entry_mc, t.exit_mc) ? item("Market cap", esc(mcLine(t.entry_mc, t.exit_mc))) : ""}
      ${item("Duró", esc(durText(t.duration_s)))}
      ${item("Lo más que subió", mg == null ? "—" : esc(pointsPct(mg)))}
      ${item("Lo más que bajó", mn == null ? "—" : esc(pointsPct(mn)))}
      ${item("Final", `${esc(pointsPct(t.pnl_pct))} · ${esc(signedText(t.pnl_usd))} USD`)}
      ${item("Cómo vendió", esc(t.reason_short || reasonTag(t)))}
    </div>
    ${t.warn ? `<p class="warn-line">⚠️ Vendió mucho peor que el stop de −10%.</p>` : ""}
    ${sparkline(t.path)}
    <p class="muted small">${esc(reasonPlain(t))} Los % son desde el precio de compra; "Final" ya incluye costos.</p>
  </div>`;
}
function closesTable(rows) {
  state.openTrades = state.openTrades || new Set();
  const body = rows.map((t) => {
    const mg = firstNum(t.max_gain_pct), mn = firstNum(t.min_gain_pct);
    const key = tradeKey(t), open = state.openTrades.has(key);
    const dex = safeMint(t.mint) ? `<a href="https://dexscreener.com/solana/${encodeURIComponent(t.mint)}" target="_blank" rel="noopener noreferrer">${esc(t.sym || "token")}</a>` : esc(t.sym || "token");
    return `<tr class="trow" data-tkey="${esc(key)}" title="Tocá para ver el detalle"><td class="mono nowrap">${open ? "▾" : "▸"} ${esc(hora(t.exit_time || t.entry_time))}</td><td><strong>${dex}</strong>${t.warn ? " ⚠️" : ""}</td>
      <td class="mono muted hide-sm">${esc(t.strategy || "")}</td>
      <td><span class="tag">${esc(t.reason_short || reasonTag(t))}${t.warn ? " ⚠️" : ""}</span> <span class="muted">${esc(motivoLine(t))}</span></td>
      <td class="num mono hide-sm">${mg == null ? "—" : esc(pointsPct(mg))}<br><span class="muted small">${mn == null ? "—" : esc(pointsPct(mn))}</span></td>
      <td class="num"><span class="mono ${toneClass(t.pnl_usd)}">${esc(signedText(t.pnl_usd))}</span><br><span class="mono muted small">${esc(pointsPct(t.pnl_pct))}</span></td></tr>
      <tr class="tdet-row"${open ? "" : " hidden"}><td colspan="6">${tradeDetail(t)}</td></tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Cuándo</th><th>Token</th><th class="hide-sm">Estrategia</th><th>Motivo</th><th class="num hide-sm">Máx / Mín</th><th class="num">Neto</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
document.addEventListener("click", (event) => {
  const row = event.target.closest && event.target.closest("tr.trow");
  if (!row || event.target.closest("a")) return;
  state.openTrades = state.openTrades || new Set();
  const key = row.dataset.tkey, det = row.nextElementSibling;
  if (!det) return;
  const open = det.hasAttribute("hidden");
  if (open) { det.removeAttribute("hidden"); state.openTrades.add(key); } else { det.setAttribute("hidden", ""); state.openTrades.delete(key); }
  const c = row.firstElementChild; c.textContent = c.textContent.replace(/^[▸▾]/, open ? "▾" : "▸");
});
function labTablePrincipal(stats, bookPnl) {
  const inBook = new Set(opsView(stats).principal.names);
  const ordered = orderedStrategies(window.MemebotOps.labStrategies(stats));
  const row = (s, i) => {
    const jup = firstNum(s.pnl_jup_usd);
    const vs = bookPnl == null ? null : (Number(s.pnl_usd) || 0) - bookPnl;
    return `<tr><td class="mono muted">${i == null ? "–" : esc(i)}</td>
      <td><span class="mono strong">${esc(s.name)}</span> <span class="pill ${confClass(s.confidence)}">${esc(s.confidence)}</span>${s.status === "pausada" ? ' <span class="pill">pausada</span>' : ""}<br><span class="muted small">${esc(s.plain || "")}</span></td>
      <td class="num mono">${esc(s.trades ?? 0)}</td><td class="num mono hide-sm">${esc(ratioPct(s.win_rate))}</td>
      <td class="num"><span class="mono ${toneClass(s.pnl_usd)}">${esc(signedText(s.pnl_usd))}</span>${jup == null ? "" : `<br><span class="muted small mono">Jupiter ${esc(signedText(jup))}</span>`}</td>
      ${inBook.size ? `<td class="num mono hide-sm ${vs == null ? "" : toneClass(vs)}">${vs == null ? "—" : esc(signedText(vs))}</td>` : ""}</tr>`;
  };
  const separated = inBook.size > 0;
  const vsHead = separated ? `<th class="num hide-sm">vs cartera</th>` : "";
  const head = `<thead><tr><th>#</th><th>Estrategia</th><th class="num">Cierres</th><th class="num hide-sm">Aciertos</th><th class="num">Neto</th>${vsHead}</tr></thead>`;
  const intro = separated
    ? `Estrategias de papel que no están en la cartera. Ordenadas por resultado. "vs cartera" es su neto menos el de la cartera. Pausada = no abre trades nuevos.`
    : `Este envío no separa cartera y laboratorio. Acá van todas las estrategias de papel, ordenadas por resultado.`;
  return `<section class="sec">
    <div class="sec-head"><h2 class="kick">Laboratorio</h2><p>${intro}</p></div>
    <div class="table-wrap"><table class="tbl">${head}<tbody>${ordered.running.map((s) => row(s, s.rank)).join("")}</tbody></table></div>
    ${ordered.resting.length ? `<details class="fine" id="paused"${state.pausedOpen ? " open" : ""}><summary>Pausadas (${ordered.resting.length}), no abren trades nuevos</summary><div class="table-wrap"><table class="tbl">${head}<tbody>${ordered.resting.map((s) => row(s, null)).join("")}</tbody></table></div></details>` : ""}
  </section>`;
}
function renderPrincipal(stats) {
  const view = opsView(stats);
  const p = view.principal;
  const isBook = p.names.length > 0;
  const opens = p.positions;
  const bookOpen = opens.length ? opens.length : (Number(p.openPositions) || 0);
  const maxOpen = p.maxOpen == null ? null : p.maxOpen;
  const nBys = Math.max(p.rows.length, 1);
  const slotMax = maxOpen == null ? Math.max(bookOpen, 1) : maxOpen * nBys;
  const gross = p.gross;
  const pnl = p.pnl;
  const costs = gross != null && pnl != null ? pnl - gross : null;
  const unreal = p.unrealized;
  const recent = p.recent;
  const shown = state.tradesOpen ? recent : recent.slice(0, 6);
  const ver = p.version ? ` · ${esc(p.version)}` : (stats.version ? ` · v${esc(stats.version)}` : "");
  const sinceBits = p.familySince
    ? ` · reglas desde ${esc(hora(p.familySince))}`
    : stats.since ? ` · desde ${esc(hora(stats.since))}` : "";
  const sizeTxt = p.sizeUsd == null ? "—" : `${numFmt.format(p.sizeUsd)} USD`;
  const maxTxt = maxOpen == null ? "—" : String(maxOpen);
  const s300Note = p.names.includes("cartera_s300")
    ? `<p>Principal de memes: <span class="mono">cartera_s300</span>${p.sizeUsd == null ? "" : `, ${esc(numFmt.format(p.sizeUsd))} USD por entrada`}. No entra si la latencia no cierra o si el impacto de Jupiter veta la compra (v5.36). Los labs no se suman acá.</p>`
    : "";
  const ledgerNote = (p.ledgers || []).filter((row) => row.trades != null && row.trades !== p.trades).map((row) => (
    `<p>Historial de <span class="mono">${esc(row.name)}</span>: ${esc(signedText(row.pnl))} USD en ${esc(row.trades)} cierres. Queda fuera del total de esta versión.</p>`
  )).join("");
  return `${pageHead("Principal", `Cartera paper${ver}${sinceBits}`)}
    <section class="sec hero-sec">
      <div class="hero-main">
        <p class="kick">${isBook ? "Cartera" : "Sin cartera"} · paper${p.version ? ` · ${esc(p.version)}` : ""}</p>
        ${heroNum(pnl, "USD")}
        <div class="minis">
          ${gross == null ? "" : mini("Bruto, sin costos", esc(signedText(gross)), toneClass(gross))}
          ${costs == null ? "" : mini("Costos Solana", esc(signedText(costs)), toneClass(costs))}
          ${mini("Por entrada", sizeTxt)}
          ${mini("Tope abiertas", `${esc(maxTxt)}${nBys > 1 && maxOpen != null ? ` <small class="muted">por estrategia</small>` : ""}`)}
        </div>
        <details class="fine" id="fine"${state.fineOpen ? " open" : ""}><summary>Reglas y versiones</summary>
          ${s300Note}
          ${ledgerNote}
          <p>${sinceLine(stats, stats.portfolio)}</p>
          ${p.rows.length > 1 ? `<p>La cartera tiene ${esc(p.rows.length)} estrategias. Cada una: máx. ${esc(maxTxt)} abiertas${p.sizeUsd == null ? "" : `, ${esc(numFmt.format(p.sizeUsd))} USD por compra`}, y cada moneda la compra una sola.</p>` : ""}
          ${finePrint(stats, stats.portfolio, stats.summary || {}).replace(/^<details[^>]*><summary>[^<]*<\/summary>/, "").replace(/<\/details>$/, "")}
          ${versionsHtml(stats.portfolio_versions, "port")}
        </details>
      </div>
      <div class="cells c2">
        ${cell("Hoy", esc(signedText(p.pnlToday)), `${esc(p.tradesToday ?? 0)} cierres desde la medianoche`, toneClass(p.pnlToday))}
        ${cell("Aciertos", esc(ratioPct(p.winRate)), `${esc(p.wins ?? 0)} de ${esc(p.trades ?? 0)}`)}
        ${cell("Cierres", esc(p.trades ?? 0), isBook ? "de la cartera" : "sin cartera en este envío")}
        ${cell("Abiertas", esc(bookOpen), bookOpen ? (unreal == null ? "sin precio fresco" : `${esc(signedText(unreal))} USD en juego`) : "nada en juego")}
      </div>
    </section>
    ${stratStrip({ by_strategy: p.rows }, p.ledgers)}
    ${chartSection("principal", "PnL por hora", "Solo la cartera, hora ART. El laboratorio no entra.")}
    <div class="split">
      <section class="sec">
        <div class="sec-head"><h2>Posiciones abiertas</h2><div class="sec-right mono muted">${esc(bookOpen)} / ${esc(slotMax)}</div></div>
        ${slotBars(bookOpen, slotMax)}
        ${opens.length ? `<div class="olist">${openRowsPrincipal(opens)}</div>` : `<div class="empty"><strong>Nada abierto</strong><p>Cuando entre a un token, lo vas a ver acá.</p></div>`}
      </section>
      <section class="sec">
        <div class="sec-head"><h2>Últimos cierres</h2><p>De la cartera, los más nuevos primero. El laboratorio no entra.</p>
          ${recent.length > 6 ? `<div class="sec-right"><button class="link-btn" type="button" data-expand="trades">${state.tradesOpen ? "Ver menos" : `Ver los ${recent.length} cierres`}</button></div>` : ""}</div>
        ${recent.length ? closesTable(shown) : `<div class="empty"><strong>Todavía no cerró ninguna</strong><p>Cuando venda, el cierre aparece acá.</p></div>`}
      </section>
    </div>
    ${labTablePrincipal(stats, isBook ? pnl : null)}`;
}

// ---------- LOTERÍA ----------
const LOGMIN = Math.log10(0.1);
const LOGMAX = Math.log10(10);
function logPos(m, lo, hi) {
  const v = Math.log10(Math.max(Number(m) || 0.0001, 10 ** lo));
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}
function betRangeBar(bet) {
  const now = firstNum(bet.mult_now);
  const peak = firstNum(bet.max_mult);
  const a = logPos(now ?? 1, LOGMIN, LOGMAX);
  const b = logPos(peak ?? now ?? 1, LOGMIN, LOGMAX);
  const one = logPos(1, LOGMIN, LOGMAX);
  const tone = (now ?? 0) >= 1 ? "up" : "down";
  return `<div class="rbar"><i class="one" style="left:${one}%"></i><i class="rng ${tone}" style="left:${Math.min(a, b)}%;width:${Math.max(0.8, Math.abs(b - a))}%"></i><i class="now ${tone}" style="left:${a}%"></i></div>`;
}
function betRow(bet) {
  const closed = bet.status === "closed";
  const pnl = firstNum(bet.pnl_usd);
  const bits = [];
  if (firstNum(bet.max_mult) != null) bits.push(`pico ${esc(multText(bet.max_mult))}`);
  if (bet.stake_back) bits.push("ya vendió parte");
  if (closed && bet.exit_reason) bits.push(`cerró: ${esc(bet.exit_reason)}`);
  if (firstNum(bet.mc_sol) != null) bits.push(`MC ${esc(numFmt.format(bet.mc_sol))} SOL`);
  if (bet.socials != null && bet.socials !== "") bits.push(`${esc(bet.socials)} redes`);
  const name = safeMint(bet.mint) ? `<a href="https://dexscreener.com/solana/${encodeURIComponent(bet.mint)}" target="_blank" rel="noopener noreferrer">${esc(bet.sym || "token")}</a>` : esc(bet.sym || "token");
  return `<div class="brow"><div class="b-tok"><strong>${name}</strong><span class="muted small">${esc(hora(bet.entry_time))}</span></div>
    <div class="b-bar">${betRangeBar(bet)}<span class="muted small">${bits.join(" · ")}</span></div>
    <div class="b-pnl"><span class="mono ${pnl == null ? "muted" : toneClass(pnl)}">${pnl == null ? "—" : esc(signedText(pnl))}</span><span class="mono muted small">${esc(multText(closed ? bet.max_mult : bet.mult_now))}${closed ? " máx" : ""}</span></div></div>`;
}
function runnersChart(rows) {
  if (!rows.length) return `<div class="empty"><strong>Ninguna tocó 3x todavía</strong><p>Cuando una pase 3x aparece acá.</p></div>`;
  const maxPeak = Math.max(100, ...rows.map((r) => Number(r.peak || r.max_mult) || 1));
  const hi = Math.log10(maxPeak);
  const shown = expOpen("runners") ? rows : rows.slice(0, 8);
  const ticks = [1, 10, 100, 1000].filter((t) => t <= maxPeak);
  return `<div class="mult-axis">${ticks.map((t) => `<span style="left:${logPos(t, 0, hi)}%">${t}x</span>`).join("")}</div>
    ${shown.map((r) => {
      const pk = Number(r.peak || r.max_mult) || 1;
      const w = logPos(pk, 0, hi);
      const st = r.status === "closed" ? esc(r.exit_reason || "cerrada") : "abierta";
      return `<div class="mrow"><div class="b-tok"><strong>${esc(r.sym)}</strong><span class="muted small">${esc(hora(r.entry_time))}</span></div>
        <div class="mbar"><i style="width:${Math.max(2, w)}%"></i><span class="mono" style="left:${Math.min(w, 82)}%">${esc(multText(pk))} <em>${st}</em></span></div>
        <span class="mono num ${r.pnl_usd == null ? "muted" : toneClass(r.pnl_usd)}">${r.pnl_usd == null ? "—" : esc(signedText(r.pnl_usd))}</span></div>`;
    }).join("")}`;
}
function funnel(sig, ver) {
  const cols = [["Hoy", sig.today], [`Desde ${ver || "la versión"}`, sig.version], [`Todo${sig.all_since ? ` (desde ${hora(sig.all_since)})` : ""}`, sig.all]].filter((c) => c[1] && c[1].signals != null);
  if (!cols.length) return "";
  const labels = [["Señales", (s) => s.signals, "top"], ["Pasaron el filtro", (s) => s.passed, ""]];
  const rejKeys = [];
  cols.forEach(([, s]) => Object.keys(s.rejected || {}).forEach((k) => { if (!rejKeys.includes(k)) rejKeys.push(k); }));
  const nice = (k) => k.replace(/^sin cupo.*$/, "Sin cupo").replace(/^./, (c) => c.toUpperCase());
  rejKeys.forEach((k) => labels.push([nice(k), (s) => (s.rejected || {})[k] ?? 0, ""]));
  labels.push(["Compradas", (s) => s.bought, "buy"]);
  const head = `<div class="frow fhead"><span></span>${cols.map(([l]) => `<span>${esc(l)}</span>`).join("")}</div>`;
  const body = labels.map(([l, f, k]) => `<div class="frow ${k}"><span class="flbl">${esc(l)}</span>${cols.map(([, s]) => {
    const v = Number(f(s)) || 0;
    return `<span class="fcell"><b class="mono">${esc(v)}</b><i><u style="width:${pctOf(v, s.signals).toFixed(1)}%"></u></i></span>`;
  }).join("")}</div>`).join("");
  return `<section class="sec"><div class="sec-head"><h2>Señales</h2><p>Lanzamientos que pasaron los filtros básicos (dev nuevo, capitalización, redes) y qué pasó con cada uno.</p></div>
    <div class="funnel" style="--cols:${cols.length}">${head}${body}</div>
    <p class="muted small">"Sin cupo" = la señal era buena pero ya estaba el tope por hora/día, de abiertas o de presupuesto. Antes de v4.12 no había filtro de creador, por eso en "Todo" las compradas superan a las que pasaron.</p></section>`;
}
function lotLabSection(lab) {
  if (!lab.length) return "";
  const on = lab.filter((v) => !v.paused).sort((a, b) => (firstNum(b.per_bet) ?? -9) - (firstNum(a.per_bet) ?? -9));
  const off = lab.filter((v) => v.paused);
  const head = `<thead><tr><th>Prueba</th><th class="num">Apuestas</th><th class="num hide-sm">Ganadoras</th><th class="num hide-sm">≥3x / 5x / 10x</th><th class="num">Neto USD</th><th class="num hide-sm">Por apuesta</th><th class="num hide-sm">Mejor</th></tr></thead>`;
  const row = (v) => `<tr><td><span class="mono strong">${esc(v.key)}</span><br><span class="muted small">${esc(v.desc || v.title || "")} · desde ${esc(v.since ? hora(v.since) : "—")}</span></td>
    <td class="num mono">${esc(v.n ?? 0)}</td><td class="num mono hide-sm">${esc(v.wins ?? 0)}</td>
    <td class="num mono hide-sm">${esc(v.x3 ?? 0)} / ${esc(v.x5 ?? 0)} / ${esc(v.x10 ?? 0)}</td>
    <td class="num mono ${toneClass(v.pnl)}">${esc(signedText(v.pnl))}</td>
    <td class="num mono hide-sm ${toneClass(v.per_bet)}">${v.per_bet == null ? "—" : esc(signedText(v.per_bet))}</td>
    <td class="num mono hide-sm">${v.best_sym ? `${esc(multText(v.best))} <span class="muted small">${esc(v.best_sym)}</span>` : "—"}</td></tr>`;
  return `<section class="sec"><div class="sec-head"><h2 class="kick">Laboratorio de lotería</h2><p>Pruebas en papel sobre las mismas señales. No gastan presupuesto. Ordenadas por neto por apuesta.</p></div>
    <div class="table-wrap"><table class="tbl">${head}<tbody>${on.map(row).join("")}</tbody></table></div>
    ${off.length ? `<details class="fine" id="lot-paused"><summary>Pausadas (${off.length}), datos guardados</summary><div class="table-wrap"><table class="tbl">${head}<tbody>${off.map(row).join("")}</tbody></table></div></details>` : ""}</section>`;
}
function renderLoteria(stats) {
  const lot = stats.loteria;
  const det = lot && lot.detail;
  if (!lot || !det || !det.real) {
    return `<section class="sec hero-sec"><div class="hero-main"><p class="kick">Lotería · paper</p>${heroNum(null, "USD")}<p class="muted">Este envío no trae el detalle de la lotería.</p></div></section>
      ${chartSection("loteria", "PnL por hora", "Sin datos de lotería.")}`;
  }
  const r = det.real;
  const t = r.today || {};
  const b = lot.bet || {};
  const openBets = Array.isArray(lot.open_bets) ? lot.open_bets : [];
  const closedBets = Array.isArray(lot.closed_bets) ? lot.closed_bets : [];
  if (!state.lotChosen) state.lotFilter = openBets.length ? "abiertas" : "cerradas";
  const list = filteredBets(openBets, closedBets);
  const listShown = state.lotFilter === "abiertas" || expOpen("bets") ? list : list.slice(0, 12);
  const runners = det.runners || [];
  return `<section class="sec hero-sec">
      <div class="hero-main">
        <p class="kick">Lotería real · ${esc(det.version)} · desde ${esc(hora(det.since))}</p>
        ${heroNum(r.realized, "USD netos")}
        <div class="minis">
          ${mini("Con abiertas a mercado", esc(signedText(r.pnl)), toneClass(r.pnl))}
          ${mini("Ganadoras", `${esc(r.wins ?? 0)} / ${esc(r.closed ?? 0)}`)}
          ${mini("Por apuesta", "1 USD")}
        </div>
        <details class="fine"><summary>Reglas y versiones</summary>
          ${lot.rules ? `<p>Reglas: ${esc(lot.rules)}.</p>` : ""}
          <p>Apuestas de 1 USD de papel buscando soñadoras; no entra en la cartera.${firstNum(lot.budget_used) != null && firstNum(lot.budget) != null ? ` Presupuesto usado ${esc(money.format(lot.budget_used))} de ${esc(money.format(lot.budget))} USD.` : ""}</p>
          ${versionsHtml(lot.versions, "lot")}
        </details>
      </div>
      <div class="cells c3">
        ${cell("Cerradas", esc(r.closed ?? 0), `${esc(r.wins ?? 0)} ganadoras · ${esc(ratioPct(r.win_rate))}`)}
        ${cell("Neto por apuesta", esc(signedText(r.per_bet)), "USD por apuesta de 1", toneClass(r.per_bet))}
        ${cell("Mejor múltiplo", esc(multText(r.best)), esc(r.best_sym || "—"), "is-up")}
        ${cell("Cohetes", `${esc(r.x3 ?? 0)} / ${esc(r.x5 ?? 0)} / ${esc(r.x10 ?? 0)}`, "tocaron ≥3x / ≥5x / ≥10x")}
        ${cell("Abiertas", `${esc(r.open ?? 0)} / ${esc(b.open_max ?? "—")}`, `${esc(signedText(r.open_mark))} USD a mercado`)}
        ${cell("Hoy", esc(signedText(t.net)), `${esc(t.bets ?? 0)} apuestas · ${esc(t.closed ?? 0)} cerradas · ${esc(t.wins ?? 0)} ganadora${t.wins === 1 ? "" : "s"}`, toneClass(t.net))}
      </div>
    </section>
    ${chartSection("loteria", "PnL por hora", `Apuestas reales desde ${det.version} · neto de cada hora ART.`)}
    <div class="split even">
      <section class="sec">
        <div class="sec-head"><h2>Apuestas reales</h2>
          <div class="sec-right seg" role="group" aria-label="Filtrar apuestas">${filterBtn("abiertas", "Abiertas")}${filterBtn("cerradas", "Cerradas")}${filterBtn("todas", "Todas")}</div></div>
        <div class="brow bhead"><span>Token</span><span>Ahora vs pico · 0,1x — 1x — 10x</span><span class="num">Neto</span></div>
        ${listShown.length ? listShown.map(betRow).join("") : `<div class="empty"><strong>${state.lotFilter === "abiertas" ? "Ninguna apuesta abierta." : "No hay apuestas."}</strong></div>`}
        ${list.length > listShown.length || expOpen("bets") ? `<button class="link-btn" type="button" data-expand="bets">${expOpen("bets") ? "Ver menos" : `Ver las ${list.length}`}</button>` : ""}
        <p class="muted small">Sombreado: rango entre ahora y el pico. Línea fina: 1x. Las cerradas muestran el pico.</p>
      </section>
      <section class="sec">
        <div class="sec-head"><h2>Soñadoras ≥3x</h2><p>${esc(runners.length)} tocaron 3x o más en esta versión</p>
          ${runners.length > 8 ? `<div class="sec-right"><button class="link-btn" type="button" data-expand="runners">${expOpen("runners") ? "Ver menos" : `Ver las ${runners.length}`}</button></div>` : ""}</div>
        ${runnersChart(runners)}
      </section>
    </div>
    ${funnel(det.signals || {}, det.version)}
    ${lotLabSection(det.lab || [])}`;
}

// ---------- CRIPTO ----------
function solBar(c) {
  const sol = c.sol_4h;
  if (!sol) return `<div class="statusbar"><span class="dot-s off"></span>SOL 4h: sin dato todavía</div>`;
  const pct = sol.ema200 ? (sol.price / sol.ema200 - 1) * 100 : null;
  return `<div class="statusbar ${sol.above ? "ok" : "bad"}"><span class="dot-s"></span><strong>SOL ${sol.above ? "arriba de su EMA200 · el lab 4h puede comprar" : "abajo de su EMA200 · el lab 4h no compra"}</strong>
    <span class="mono muted">${esc(numFmt.format(sol.price))} vs ${esc(numFmt.format(sol.ema200))}${pct == null ? "" : ` · ${esc(signedText(pct).replace(/,(\d)\d$/, ",$1"))} %`}</span>
    <span class="sb-right muted">${sol.at ? `vela 4h · ${esc(hora(tsIso(sol.at)))} ART` : ""}</span></div>`;
}
function solGauge(c) {
  const sol = c.sol_4h;
  if (!sol || !sol.ema200) return "";
  const lo = Math.min(sol.price, sol.ema200) * 0.9;
  const hi = Math.max(sol.price, sol.ema200) * 1.1;
  const pos = (v) => ((v - lo) / (hi - lo)) * 100;
  const pe = pos(sol.ema200); const pp = pos(sol.price);
  return `<section class="sec"><div class="sec-head"><h2>SOL · vela 4h</h2><p>El lab 4h (ex principal) solo compra con SOL arriba de la EMA200 de 4h. La Estrategia Mateo usa su propia regla diaria (medias 21/30/150/200). Zona roja = bloqueado para el lab 4h.</p></div>
    <div class="gauge"><i class="g-block" style="width:${pe}%"></i><i class="g-ok" style="left:${pe}%;right:0"></i>
      <span class="g-mark ema" style="left:${pe}%"><b>EMA200 ${esc(numFmt.format(sol.ema200))}</b></span>
      <span class="g-mark px ${sol.above ? "is-up" : "is-down"}" style="left:${pp}%"><b>SOL ${esc(numFmt.format(sol.price))}</b></span></div>
    <p class="muted small">Le falta ${sol.above ? "nada: ya está arriba" : `subir ${esc(numFmt.format((sol.ema200 / sol.price - 1) * 100))} % para habilitar compras`}. El bot publica solo el último valor, por eso no hay curva histórica.</p></section>`;
}
function criptoCol(kicker, sub, v, desc, openN, maxOpen, unr) {
  const net = firstNum(v.net_usd) || 0;
  return `<div class="ccol"><p class="kick">${esc(kicker)} <span class="muted">${esc(sub)}</span></p>${heroNum(net, "USD netos")}
    <p class="muted">${desc}</p>
    <div class="cells c3 inner">
      ${cell("Cerradas", esc(v.closed ?? 0), "operaciones")}
      ${cell("Acierto", esc(wrText(v.win_rate)), "de las cerradas")}
      ${cell("Abiertas", `${esc(openN)} / ${esc(maxOpen)}`, openN ? `${esc(signedText(unr))} si vendiera ya` : "ninguna ahora", "")}
    </div></div>`;
}
function zoneBar(lo, hi, stop, entry, now, t1, t2, zlo, zhi) {
  const span = hi - lo || 1;
  const p = (v) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  let h = `<div class="zbar"><i class="z-stop" style="left:0;width:${p(zlo ?? entry ?? lo)}%"></i>`;
  if (zlo != null && zhi != null) h += `<i class="z-zone" style="left:${p(zlo)}%;width:${Math.max(1, p(zhi) - p(zlo))}%"></i>`;
  if (entry != null && now != null) h += `<i class="z-run ${now >= entry ? "up" : "down"}" style="left:${p(Math.min(entry, now))}%;width:${Math.max(0.8, Math.abs(p(now) - p(entry)))}%"></i>`;
  if (t1 != null) h += `<i class="z-t" style="left:${p(t1)}%"></i>`;
  if (t2 != null) h += `<i class="z-t" style="left:calc(${p(t2)}% - 2px)"></i>`;
  return `${h}</div>`;
}
// ===== v4.57 CRIPTO claro: una tarjeta por estrategia =====
const CMETA = {
  cripto_mateo: { name: "⭐ Estrategia Mateo", role: "main", what: "cripto", how: "Compra cuando la moneda viene subiendo (medias 21 y 30 arriba de las de 150 y 200), corrige hasta la media de 21/30 y rebota con vela verde. Antes de comprar pasa un chequeo de noticias y mercado.", sell: "Vende si cae abajo de la media de 30 (stop), si gana 4 veces lo arriesgado (objetivo) o a los 20 días.", bt: "Backtest 2020-26: 205 operaciones, +85 USD (1ª mitad +31, 2ª +54). Dura ~5 días en promedio.", gate: true },
  lab_mateo_acciones: { name: "📊 Mateo en acciones", role: "lab", what: "acciones", how: "Las mismas reglas de Mateo, pero en 18 acciones tokenizadas (NVDA, PLTR, MSFT…). Antes de comprar mira si hay balance en los próximos días o noticias graves.", sell: "Stop bajo la media de 30, objetivo 4 veces lo arriesgado, o a las 20 ruedas.", bt: "Backtest 2016-26: 579 operaciones, +92 USD (+48 / +44). Dura ~12 ruedas.", gate: true },
  lab_cripto_asl_7d: { name: "⚡ Mateo corto · 7 días", role: "lab", what: "cripto", how: "Igual que la Estrategia Mateo, pero como máximo 7 días adentro.", sell: "Stop, objetivo 4R o a los 7 días.", bt: "Backtest: 244 operaciones, +72,5 USD (+34 / +39). Sin chequeo fundamental." },
  lab_cripto_asl_5d: { name: "⚡ Mateo corto · 5 días", role: "lab", what: "cripto", how: "Igual que la Estrategia Mateo, pero como máximo 5 días adentro.", sell: "Stop, objetivo 4R o a los 5 días.", bt: "Backtest: 259 operaciones, +56 USD (+24 / +32)." },
  lab_acciones_10r: { name: "⚡ Acciones corto · 10 ruedas", role: "lab", what: "acciones", how: "Mateo en acciones, pero como máximo 10 ruedas (2 semanas).", sell: "Stop, objetivo 4R o a las 10 ruedas.", bt: "Backtest: 722 operaciones, +58,5 USD (+42 / +16)." },
  lab_cripto_asl: { name: "🧪 Mateo sin chequeo (control)", role: "lab", what: "cripto", how: "Copia exacta de la Estrategia Mateo pero SIN el chequeo fundamental, para medir si el chequeo ayuda o molesta.", sell: "Igual que Mateo.", bt: "Mismo backtest que Mateo." },
  lab_analista_btc: { name: "🧠 Analista solo BTC", role: "lab", what: "cripto", how: "Ideas automáticas del Analista, solo en Bitcoin y solo con mercado sano.", sell: "Vende todo en 4R o a los 10 días.", bt: "Backtest 2020-26: 170 operaciones, +11,8 USD (+6 / +6)." },
  cripto_ema4h_reg: { name: "Cruce de medias 4 h (ex principal)", role: "old", how: "Compra cuando la media de 20 cruza arriba la de 50 en velas de 4 h, con SOL sano.", sell: "Stop 2×ATR que sube, o cuando la media se da vuelta. Dura ~2 días.", bt: "Backtest: +60 USD; si se corta a 24 h deja de ganar." },
  lab_cripto_ethbtc: { name: "ETH o BTC (rotación)", role: "old", how: "Tiene ETH o BTC según cuál viene más fuerte; nada si BTC está débil.", sell: "Cambia cuando cambia la fuerza. Es de largo plazo." },
  cripto_analista: { name: "🧠 Analista (ideas manuales)", role: "old", how: "Compra en papel cuando el precio entra en la zona de una idea cargada.", sell: "Stop y objetivos de la idea." },
};
function fundBox(c, variant) {
  const log = (Array.isArray(c.fund_log) ? c.fund_log : []).filter((f) => f.variant === variant);
  const last = log.slice(-4).reverse();
  if (!last.length) return `<p class="small muted">🛡 Chequeo de noticias: todavía no tuvo que revisar ninguna compra nueva.</p>`;
  return `<div class="small">🛡 <strong>Chequeo de noticias</strong>${last.map((f) => `<div class="fund ${f.ok ? "ok" : "bad"}">${f.ok ? "✅" : "⛔"} <strong>${esc(f.sym)}</strong> ${f.ok ? "aprobada" : `vetada por: ${esc((f.vetos || []).join("; "))}`} <span class="muted">· ${esc(hora(tsIso(f.ts)))}</span></div>`).join("")}</div>`;
}
function posRow(o, fo) {
  const unr = firstNum(o.unrealized_usd);
  const f = (fo || []).find((x) => x.trade_id === o.id);
  const pct = o.price && o.entry_px ? (o.price / o.entry_px - 1) * 100 : null;
  return `<div class="pos"><div class="pos-h"><strong>${esc(o.sym)}</strong><span class="mono ${toneClass(unr)}">${unr == null ? "—" : esc(signedText(unr))} USD${pct == null ? "" : ` (${esc(signedText(pct))} %)`}</span></div>
    <div class="pos-g mono small"><span><em>entró</em>${esc(pxText(o.entry_px))}</span><span><em>ahora</em>${esc(pxText(o.price))}</span><span class="is-down"><em>stop</em>${esc(pxText(o.stop))}</span><span class="is-up"><em>objetivo</em>${o.target ? esc(pxText(o.target)) : "—"}</span></div>
    <div class="small muted">desde ${esc(hora(tsIso(o.entry_ts)))}${f ? ` · noticias hoy: ${f.ok ? "✅ sin alertas" : `⚠️ ${esc((f.vetos || []).join("; "))}`}` : ""}</div></div>`;
}
function stratCard(c, v, opens) {
  const m = CMETA[v.variant] || { name: CRIPTO_LABEL[v.variant] || v.label || v.variant, role: "old", how: v.label || "" };
  const op = opens.filter((o) => o.variant === v.variant);
  const badge = m.role === "main" ? `<span class="tag ok">PRINCIPAL</span>` : `<span class="tag">LAB · prueba</span>`;
  return `<article class="scard ${m.role}"><div class="scard-h"><h3>${esc(m.name)}</h3>${badge}</div>
    <p class="small"><strong>Compra:</strong> ${esc(m.how)}</p>${m.sell ? `<p class="small"><strong>Vende:</strong> ${esc(m.sell)}</p>` : ""}
    <div class="sstats"><div><span class="lbl">Neto</span><strong class="mono ${toneClass(v.net_usd)}">${esc(signedText(v.net_usd || 0))}</strong></div>
      <div><span class="lbl">Cerradas</span><strong class="mono">${esc(v.closed ?? 0)}</strong></div>
      <div><span class="lbl">Acierto</span><strong class="mono">${esc(wrText(v.win_rate))}</strong></div>
      <div><span class="lbl">Abiertas</span><strong class="mono">${esc(op.length)}</strong></div></div>
    ${op.map((o) => posRow(o, c.fund_open)).join("")}
    ${m.gate ? fundBox(c, v.variant) : ""}
    ${m.bt ? `<p class="small muted">📚 ${esc(m.bt)}</p>` : ""}</article>`;
}

// ===== v4.59: todas las variantes de laboratorio cripto con abiertas y cerradas =====
function hrsText(h) { if (h == null || !isFinite(h)) return "—"; return h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1).replace(".", ",")} días`; }
function labSum(cl, since) { const x = cl.filter((t) => (t.exit_ts || 0) >= since); const n = x.reduce((a, t) => a + (Number(t.pnl) || 0), 0); return { n: x.length, net: n }; }
const LAB_NAME = { lab_cripto_asl: "Estrategia Mateo sin chequeo", lab_cripto_asl_7d: "Estrategia Mateo 7 días", lab_cripto_asl_5d: "Estrategia Mateo 5 días", lab_mateo_acciones: "Mateo en acciones", lab_acciones_10r: "Acciones 10 días", lab_cripto_ethbtc: "ETH o BTC (rotación)", lab_cripto_st_rango: "Supertrend + ruptura", lab_cripto_ema20_bb: "EMA20 + Bollinger", lab_cripto_conf4h: "Soporte + MACD (4h)", lab_cripto_conf1d: "Soporte + RSI50 (diario)", lab_cripto_andy200: "Andy EMA200 (diario)", lab_cripto_rot3: "Rotación top 3 semanal", lab_cripto_ema50d: "Tendencia diaria EMA50", cripto_analista: "Analista (ideas manuales)", lab_analista_btc: "Analista solo BTC", cripto_ema4h_reg: "Cruce de medias 4 h", cripto_ema_reg: "Cruce de medias 1 h", lab_cripto_pb_reg: "Pullback 1 h", lab_cripto_4h_35: "Medias 4 h, 35 monedas", lab_cripto_4h_warren60: "Medias 4 h con filtro Analista", lab_cripto_4h_btcreg: "Medias 4 h con BTC sano", lab_cripto_d20: "Ruptura de 20 días", lab_cripto_rebote: "Rebote" };
function labName(v) { return LAB_NAME[v.variant] || (CMETA[v.variant] || {}).name || CRIPTO_LABEL[v.variant] || v.label || v.variant; }
function labToggle(id) { const r = document.getElementById(id); if (r) r.hidden = !r.hidden; }
function renderLabs(c) {
  const vars = Array.isArray(c.variants) ? c.variants : [];
  const opens = Array.isArray(c.open) ? c.open : [];
  const closed = Array.isArray(c.closed_trades) ? c.closed_trades : [];
  const now = Date.now() / 1000;
  const labs = vars.filter((v) => v.variant !== c.main);
  const nOpen = (v) => opens.filter((o) => o.variant === v.variant).length;
  const active = labs.filter((v) => nOpen(v) || v.closed).sort((a, b) => (Number(b.net_usd) || 0) + (Number(b.unrealized_usd) || 0) * 0 - (Number(a.net_usd) || 0));
  const empty = labs.filter((v) => !active.includes(v));
  const detail = (v) => {
    const m = CMETA[v.variant] || {};
    const op = opens.filter((o) => o.variant === v.variant);
    const cl = closed.filter((t) => t.variant === v.variant);
    const w = labSum(cl, now - 7 * 86400), mo = labSum(cl, now - 30 * 86400);
    const per = v.closed ? (Number(v.net_usd) || 0) / v.closed : null;
    const oRows = op.map((o) => {
      const pct = o.price && o.entry_px ? (o.price / o.entry_px - 1) * 100 : null;
      const unr = firstNum(o.unrealized_usd);
      return `<tr><td><strong>${esc(o.sym)}</strong></td><td class="num mono">${esc(pxText(o.entry_px))}</td><td class="num mono">${o.price ? esc(pxText(o.price)) : "sin precio"}</td><td class="num mono is-down">${o.stop ? esc(pxText(o.stop)) : "—"}</td><td class="num mono is-up">${o.target ? esc(pxText(o.target)) : "—"}</td><td class="num mono ${toneClass(unr)}">${unr == null ? "—" : esc(signedText(unr))}${pct == null ? "" : `<br><span class="small">${esc(signedText(pct))} %</span>`}</td><td class="num mono">${esc(hrsText((now - o.entry_ts) / 3600))}</td></tr>`;
    }).join("");
    const cRows = cl.slice(0, 30).map((t) => {
      const pct = t.stake ? (Number(t.pnl) || 0) / t.stake * 100 : null;
      return `<tr><td><strong>${esc(t.sym)}</strong><br><span class="small muted">${esc(hora(tsIso(t.exit_ts)))}</span></td><td class="num mono">${esc(pxText(t.entry_px))}</td><td class="num mono">${esc(pxText(t.exit_px))}</td><td class="num mono ${toneClass(t.pnl)}">${esc(signedText(Number(t.pnl) || 0))}${pct == null ? "" : `<br><span class="small">${esc(signedText(pct))} %</span>`}</td><td class="num mono">${esc(hrsText((t.exit_ts - t.entry_ts) / 3600))}</td><td>${esc(t.reason || "—")}</td></tr>`;
    }).join("");
    return `${m.how ? `<p class="small muted">${esc(m.how)}</p>` : (v.label ? `<p class="small muted">${esc(v.label)}</p>` : "")}
      <p class="small">Por operación <strong class="mono ${toneClass(per)}">${per == null ? "—" : esc(signedText(per))}</strong> · 7 días <strong class="mono ${toneClass(w.net)}">${esc(signedText(w.net))}</strong> (${esc(w.n)} op.) · 30 días <strong class="mono ${toneClass(mo.net)}">${esc(signedText(mo.net))}</strong> (${esc(mo.n)} op.)</p>
      ${op.length ? `<p class="kick">Abiertas</p><div class="table-wrap"><table class="tbl labt labo"><thead><tr><th>Moneda</th><th class="num">Entró</th><th class="num">Ahora</th><th class="num">Stop</th><th class="num">Objetivo</th><th class="num">Resultado</th><th class="num">Hace</th></tr></thead><tbody>${oRows}</tbody></table></div>` : ""}
      ${cl.length ? `<p class="kick">Cerradas</p><div class="table-wrap"><table class="tbl labt labc"><thead><tr><th>Moneda</th><th class="num">Entró</th><th class="num">Salió</th><th class="num">Resultado</th><th class="num">Duró</th><th>Por qué</th></tr></thead><tbody>${cRows}</tbody></table></div>` : ""}`;
  };
  const rows = active.map((v, i) => {
    const id = `labd-${i}`;
    return `<tr class="labrow" onclick="labToggle('${id}')"><td><strong>${esc(labName(v))}</strong> <span class="muted small">▸ ver</span></td><td class="num mono">${esc(nOpen(v))}</td><td class="num mono">${esc(v.closed ?? 0)}</td><td class="num mono ${toneClass(v.net_usd)}">${esc(signedText(v.net_usd || 0))}</td><td class="num mono">${esc(wrText(v.win_rate))}</td></tr>
      <tr id="${id}" class="labdet" hidden><td colspan="5">${detail(v)}</td></tr>`;
  }).join("");
  return `<section class="sec labs"><div class="sec-head"><h2>🧪 Laboratorio · Resumen</h2><p>Solo las pruebas que ya operaron, de la que más ganó a la que menos. Tocá una para ver sus compras.</p></div>
    <div class="table-wrap"><table class="tbl labsum"><thead><tr><th>Estrategia</th><th class="num">Abiertas</th><th class="num">Cerradas</th><th class="num">Neto USD</th><th class="num">Acierto</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="muted">Ninguna operó todavía.</td></tr>`}</tbody></table></div>
    ${empty.length ? `<details class="labempty"><summary>Otras ${empty.length} variantes sin operaciones todavía</summary><p class="small muted">${empty.map((v) => esc(labName(v))).join(" · ")}</p></details>` : ""}</section>`;
}
// ---------- 📰 NOTICIAS X (v4.81) ----------
function renderNoticias(stats) {
  const n = stats.noticias_x;
  if (!n || typeof n !== "object") return `${pageHead("Noticias", "Posts de X, saldo aparte.")}<section class="sec"><p class="kick">Noticias X · paper</p><p class="muted">Este envío todavía no trae la sección de noticias.</p></section>`;
  const t = (ts) => (ts ? hora(new Date(ts * 1000).toISOString()) : "—");
  const post = (o) => `@${esc(o.post_user || "?")}${o.post_url ? ` · <a href="${esc(o.post_url)}" target="_blank" rel="noopener">ver post</a>` : ""}<br><span class="muted small">${esc((o.post_text || "").slice(0, 140))}</span>`;
  const openRows = (n.open || []).map((o) => `<tr><td><strong>${esc((o.sym || "").trim())}</strong><br><span class="muted small">${esc(o.trigger || "")} · edad ${esc(Math.round(o.age_min || 0))} min</span></td><td class="small">${post(o)}</td><td class="mono">${esc(t(o.entry_ts))}${mcText(o.entry_mc) ? `<br><span class="small">mc ${esc(mcText(o.entry_mc))}</span>` : ""}</td><td class="mono">${o.cur_mc ? `mc ${esc(mcText(o.cur_mc) || "")}` : "—"}<br><span class="small muted">25x en mc ${esc(mcText(o.tp_mc) || "—")}</span></td><td class="num mono ${toneClass(o.pct)}">${o.pct != null ? esc((o.pct > 0 ? "+" : "") + o.pct.toFixed(1)) + " %" : "—"}<br><span class="small">${o.pnl_usd != null ? esc(signedText(o.pnl_usd)) + " USD" : ""}</span></td><td class="num mono">${esc(((o.peak || 0) * 100).toFixed(1))} %</td><td class="small">quedan ${esc(o.left_min ?? "—")} min (máx ${esc(n.max_hold_h || 2)} h)${(o.stage || 0) >= 2 ? "<br>ya vendió 50% a 25x" : ""}</td></tr>`).join("");
  const closedRows = (n.trades || []).map((o) => `<tr><td><strong>${esc((o.sym || "").trim())}</strong><br><span class="muted small">${esc(o.trigger || "")}</span></td><td class="small">${post(o)}</td><td class="mono">${esc(t(o.entry_ts))} → ${esc(t(o.exit_ts))}${mcLine(o.entry_mc, o.exit_mc) ? `<br><span class="small">${esc(mcLine(o.entry_mc, o.exit_mc))}</span>` : ""}</td><td>${esc(o.reason || "")}</td><td class="num mono ${toneClass(o.net_usd)}">${esc(signedText(o.net_usd || 0))}</td></tr>`).join("");
  const anRows = (n.analyses || []).map((o) => `<tr><td class="mono">${esc(t(o.ts))}</td><td class="small">@${esc(o.user || "?")}${o.url ? ` · <a href="${esc(o.url)}" target="_blank" rel="noopener">ver post</a>` : ""}<br><span class="muted">${esc(o.text || "")}</span></td><td class="small">${esc(o.decision || "")}</td></tr>`).join("");
  return `${pageHead("Noticias", "Posts de X. Saldo aparte, no entra en la cartera.")}
    <section class="sec explain"><p class="kick">Noticias X · simulado, sin plata real · saldo aparte</p>
      <h2>¿Cómo funciona?</h2>
      <p>Cada ~5 min se leen los posts de cuentas influyentes en X (Elon, Trump, CZ, Vitalik…). Si un post trae un contrato de Solana, compra esa moneda; si habla de un tema o un $TICKER, compra monedas <strong>recién creadas</strong> con ese nombre o sigla. Apuesta ${esc(n.bet)} USD por compra. Reglas: ${esc(n.rules || "")}. No usa plata ni reglas de la cartera principal.</p>
      <div class="sstats"><div><span class="lbl">Saldo</span><strong class="mono">${esc(Number(n.balance).toFixed(2))} USD</strong></div><div><span class="lbl">Neto</span><strong class="mono ${toneClass(n.net_usd)}">${esc(signedText(n.net_usd || 0))}</strong></div><div><span class="lbl">Cerradas (ganadas)</span><strong class="mono">${esc(n.closed)} (${esc(n.wins)})</strong></div><div><span class="lbl">Abiertas</span><strong class="mono">${esc((n.open || []).length)}</strong></div><div><span class="lbl">Último post leído</span><strong class="mono">${esc(n.last_post ? hora(n.last_post) : "—")}</strong></div></div>
    </section>
    <section class="sec"><div class="sec-head"><h2>Abiertas</h2></div>${openRows ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Moneda</th><th>Post que la disparó</th><th>Compra</th><th>Ahora</th><th class="num">% / PnL</th><th class="num">Pico</th><th>Salida</th></tr></thead><tbody>${openRows}</tbody></table></div>` : `<p class="muted">Ninguna abierta.</p>`}</section>
    <section class="sec"><div class="sec-head"><h2>Cerradas</h2></div>${closedRows ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Moneda</th><th>Post</th><th>Hora (ART)</th><th>Salida</th><th class="num">Neto</th></tr></thead><tbody>${closedRows}</tbody></table></div>` : `<p class="muted">Todavía no cerró ninguna.</p>`}</section>
    <section class="sec"><div class="sec-head"><h2>Posteos analizados</h2></div><p class="small muted">Todo lo que el bot leyó y por qué compró o no. Telegram solo avisa compras y ventas.</p>${anRows ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Hora (ART)</th><th>Post</th><th>Decisión</th></tr></thead><tbody>${anRows}</tbody></table></div>` : `<p class="muted">Todavía no hay posteos analizados en este envío.</p>`}</section>`;
}

// ASL acciones 45' v2: cartera simulada (papel)
function renderAsl(stats) {
  const a = stats.asl;
  const old = `<details class="sec"><summary class="muted">Cripto paper (lo de antes)</summary>${renderCripto(stats)}</details>`;
  if (!a || !a.summary) return `${pageHead("Acciones ASL", "Cartera simulada, sin plata real.")}<section class="sec"><p class="kick">Acciones ASL · cartera simulada</p><p class="muted">Todavía no hay datos.</p></section>${old}`;
  const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(1)}%`);
  const usd = (v) => `${v > 0 ? "+" : ""}${Number(v || 0).toFixed(2)}`;
  const col = (v) => (v > 0 ? "color:#16a34a" : v < 0 ? "color:#dc2626" : "");
  const ar = (b) => (b ? "↑" : "↓");
  const s = a.summary;
  const wr = s.trades ? Math.round((100 * s.wins) / s.trades) : null;
  const tot = (s.realized || 0) + (s.unrealized || 0);
const imgBox = (t, kind) => `<div class="aslimg" data-t="${esc(t)}" data-kind="${kind}" style="margin:6px 0"><p class="muted">Cargando gráficos…</p></div>`;
  const opened = (x) => (x.tranches && x.tranches[0] && x.tranches[0].when) ? ` · abierta ${esc(x.tranches[0].when)} ART${evFlag(x.events)}` : "";
  const taHtml = (o) => {
    if (!o) return "";
    const pl = o.plan, al = o.align, ic = { alineado: "🟢", neutral: "🟡", "en contra": "🔴" };
    let h = `<p><b>Pisos</b> <span style="color:#16a34a">${(o.pisos || []).map(esc).join(" · ") || "—"}</span> · <b>Techos</b> <span style="color:#dc2626">${(o.techos || []).map(esc).join(" · ") || "—"}</span></p>`;
    if (pl) h += `<p>🎯 TP1 <b>${esc(pl.tp1)}</b> · TP2 <b>${esc(pl.tp2)}</b> · 🛑 SL <b>${esc(pl.sl)}</b> (bajo ${esc(pl.sl_why)}, -${esc(pl.risk_pct)}%) · R/B <b>${esc(pl.rb)}</b>${pl.warn ? " ⚠️" : ""}</p>`;
    if (al) h += `<p>${ic[al.v] || ""} Diario vs 45': <b>${esc(al.v)}</b> — ${esc(al.why)}</p>`;
    if (o.tend) h += `<p class="muted">${esc(o.tend)}</p>`;
    const pt = [...(o.pat45 || []).map((x) => "45': " + x), ...(o.patd || []).map((x) => "diario: " + x), ...(o.figs || []).map((x) => "figura: " + x)];
    if (pt.length) h += `<p class="muted">📐 ${pt.map(esc).join(" · ")}</p>`;
    if (o.pine) h += `<p><textarea style="display:none">${esc(o.pine)}</textarea><button type="button" onclick="const b=this;navigator.clipboard.writeText(b.previousElementSibling.value).then(()=>{b.textContent='✅ Copiado'},()=>{b.previousElementSibling.style.display='block'})">📋 Copiar Pine</button> <span class="muted">generado ${esc(o.pine_at || "")} ART</span></p>`;
    return h;
  };
  const evHtml = (ev) => (ev && ev.length) ? `<div style="margin:4px 0">${ev.map((e) => `<p style="margin:2px 0">${e.strong ? "⚠️" : "ℹ️"} ${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener">${esc(e.name)}</a>` : esc(e.name)} — ${esc(e.label)}${e.days === 0 ? " (hoy)" : " (en " + e.days + " d)"}</p>`).join("")}</div>` : "";
  const evFlag = (ev) => (ev || []).some((e) => e.strong && e.days <= 2) ? " ⚠️" : "";
  const big = (v) => { v = Number(v); return v >= 1e12 ? (v / 1e12).toFixed(2) + " B" : v >= 1e9 ? (v / 1e9).toFixed(1) + " mil M" : v >= 1e6 ? (v / 1e6).toFixed(0) + " M" : String(v); };
  const fundHtml = (f, px, t) => {
    if (!f) return "";
    const n = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
    const g = (v) => (v == null ? "—" : `<span style="${col(v)}">${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%</span>`);
    const rec = { strong_buy: "compra fuerte", buy: "compra", hold: "mantener", sell: "venta", strong_sell: "venta fuerte", underperform: "por debajo", outperform: "por encima" }[f.rec] || "";
    let ed = "—";
    if (f.earn) { const k = Math.round((new Date(f.earn + "T12:00:00") - new Date()) / 864e5); ed = `${k >= 0 && k <= 7 ? "⚠️ " : ""}${esc(f.earn.slice(8, 10) + "/" + f.earn.slice(5, 7))}${k >= 0 ? ` (en ${k} d)` : ""}`; }
    const okc = !f.cur || f.cur === (String(t || "").endsWith(".BA") ? "ARS" : "USD");
    const up = f.target && px && okc ? ` (${pct((f.target / px - 1) * 100)})` : "";
    return `<p style="margin:4px 0"><b>📊 Fundamental</b> <span class="muted">${esc(f.sector || "")}${f.sector ? " · " : ""}${esc(f.src || "")}</span></p>
      <p style="margin:2px 0">Próximo balance <b>${ed}</b> · P/E ${n(f.pe)} (futuro ${n(f.fpe)}) · Cap. ${f.mcap ? big(f.mcap) : "—"}</p>
      <p style="margin:2px 0">EPS ${n(f.eps, 2)} · crec. EPS ${g(f.epsg)} · crec. ventas ${g(f.revg)} · objetivo analistas ${f.target && okc ? n(f.target, 2) + up : "—"}${f.nan ? ` · ${esc(f.nan)} analistas` : ""}${rec ? ` · ${esc(rec)}` : ""}</p>${(f.chg || []).length ? `<p style="margin:2px 0">🆕 ${(f.chg || []).map((c) => `<b>${esc(c.at)} ART</b> ${esc(c.txt)}`).join(" · ")}</p>` : ""}`;
  };
  const detail = (x) => {
    const i = x.ind || {};
    const pats = (x.patterns || []).map((p) => `<li>${esc(p[0])} ${esc(p[1])}</li>`).join("") || "<li class=\"muted\">Sin patrones</li>";
    const nws = (x.news || []).map((n) => `<li><a href="${esc(n[1])}" target="_blank" rel="noopener">${esc(n[0])}</a></li>`).join("") || "<li class=\"muted\">Sin noticias negativas</li>";
    const er = x.earn ? `${x.earn.days <= 7 ? "⚠️ " : ""}${esc(x.earn.date)} ${esc(x.earn.when)} (${x.earn.days === 0 ? "hoy" : "en " + x.earn.days + " días"})` : "sin fecha próxima";
    const tr = (x.tranches || []).map((p) => `<li>Compra ${esc(p.n)}: ${esc(p.when)} a ${esc(p.px)} → ${pct((x.px / p.px - 1) * 100)}</li>`).join("");
    return `<div style="padding:8px 4px;font-size:.92em">
      ${evHtml(x.events)}${fundHtml(x.fund, x.px, x.t)}${imgBox(x.t, "pos")}<p><b>Compras</b></p><ul>${tr}</ul>${x.tpsl ? `<p>Plan fijo de entrada: TP1 ${esc(x.tpsl.tp1)} · TP2 ${esc(x.tpsl.tp2)} · SL ${esc(x.tpsl.sl)} · R/B ${esc(x.tpsl.rb)} · señal ${esc(x.tpsl.src === "Sole" ? "Estrategia 1" : x.tpsl.src)}${x.tpsl.q < 1 ? " · 50% ya vendido en TP1" : ""}</p>` : ""}${taHtml(x.tech)}
      <p><b>Técnico 45'</b> (vela ${esc(x.bar)} ART)</p>
      <ul><li>SL21 ${pct((x.dist || {}).sl21)} · SMA30 ${pct((x.dist || {}).sma30)} · EMA150 ${pct((x.dist || {}).ema150)} · EMA200 ${pct((x.dist || {}).ema200)}</li>
      <li>Koncorde: manos grandes ${esc(i.koncorde)} ${ar(i.kon_up)} · MACD ${ar(i.macd_up)}</li>
      <li>RSI ${esc(i.rsi)} ${ar(i.rsi_up)} (media ${esc(i.rsima)}) · Estoc ${esc(i.stk)}/${esc(i.std)} · StochRSI ${esc(i.srk)}</li>
      <li>${esc(x.daily || "")}</li></ul>
      <p><b>Patrones</b></p><ul>${pats}</ul>
      <p><b>Fundamental</b></p><ul><li>Balance: ${er}</li></ul><ul>${nws}</ul></div>`;
  };
  const open = (a.open || []).map((x) => `<details class="sec" style="margin:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px">
      <span><b>$${esc(x.t)}</b> · ${esc((x.tranches || []).length)} compra(s)${opened(x)}${x.earn && x.earn.days <= 7 ? " ⚠️" : ""}${(x.news || []).length ? " 📰" : ""}</span>
      <span class="mono" style="${col(x.unr)}">${usd(x.unr)} USD</span></summary>${detail(x)}</details>`).join("");
  const closed = (a.closed || []).map((c) => `<tr><td>${esc(c.close)}</td><td>$${esc(c.t)}</td><td class="hide-sm">${esc(c.why)}</td><td class="num" style="${col(c.pnl)}">${usd(c.pnl)} (${pct(c.pct)})</td></tr>`).join("");
  const others = (a.others || []).map((o) => `<tr><td>$${esc(o.t)}</td><td class="num">${pct(o.sl21)}</td><td>${esc(o.trend || "")}</td><td class="hide-sm">${o.last ? esc(o.last.when + " " + o.last.kind) : "—"}</td></tr>`).join("");
  const mk = a.mkt || {}, mbrk = new Set(mk.brk || []), mrs = mk.rs || {};
  const rsTag = (t) => (mrs[t] == null ? "" : ` <span class="muted">RS ${esc(mrs[t])}</span>`) + (mbrk.has(t) ? ` <span class="star">Ruptura</span>` : "");
  const sm = mk.sem;
  const brakeClass = !sm ? "" : sm.color === "rojo" ? "is-off" : sm.color === "verde" ? "is-on" : "is-warn";
  const brakeWord = !sm ? "" : sm.color === "verde" ? "Verde" : sm.color === "rojo" ? "Rojo" : "Amarillo";
  const brakeAct = !sm ? "" : sm.color === "rojo" ? "sin altas nuevas" : sm.color === "amarillo" ? "mitad de tamaño" : "tamaño lleno";
  const semHtml = sm ? `<p class="brake ${brakeClass}"><span class="dot-s" aria-hidden="true"></span><b>Semáforo ${esc(brakeWord)}, solo freno.</b> ${esc(sm.pct_e200)}% del universo sobre EMA200 · SPY ${sm.spy_sma50 ? "sobre" : "bajo"} SMA50 · ${brakeAct}. <span class="muted">No abre ni cierra posiciones${mk.at ? ` · ${esc(mk.at)} ART` : ""}.</span></p>` : "";
  const labBlocks = [];
  const so = a.sole;
  if (so && so.summary) {
    const ss = so.summary, swr = ss.trades ? Math.round((100 * ss.wins) / ss.trades) + "%" : "—", stot = (ss.realized || 0) + (ss.unrealized || 0);
    const sopen = (so.open || []).map((x) => `<details class="sec" style="margin:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px">
      <span><b>$${esc(x.t)}</b>${rsTag(x.t)} · ${esc((x.tranches || []).length)} compra(s)${opened(x)}</span><span class="mono" style="${col(x.unr)}">${usd(x.unr)} USD</span></summary>${detail(x)}</details>`).join("");
    const scl = (so.closed || []).map((c) => `<tr><td>${esc(c.close)}</td><td>$${esc(c.t)}</td><td class="hide-sm">${esc(c.why)}</td><td class="num" style="${col(c.pnl)}">${usd(c.pnl)} (${pct(c.pct)})</td></tr>`).join("");
    const sb = so.backtest;
    const sbt = sb ? `Prueba ${esc(sb.desde)}–${esc(sb.hasta)}: ${esc(sb.total.n)} operaciones, ${esc(sb.total.win)}% ganadas, ${usd(sb.total.neto)} USD. Ago–sep ${usd(sb["ago-sep"].neto)} · oct ${usd(sb["oct+"].neto)}.` : "";
    labBlocks.push({ pin: true, pnl: stot, html: `<section class="sec is-lab"><div class="sec-head"><h2>Estrategia 1 · lab</h2><div class="sec-right mono" style="${col(stot)}">${usd(stot)} USD</div></div>
      <p class="muted"><span class="pill">sin Telegram</span> Semáforo freno: rojo sin altas, amarillo mitad · rupturas primero · RS ≥ 70 vs SPY/MERVAL · R/B ≥ 1,5, precio ≥ 5, vol ≥ 1 M · sin balance 48 h · máx 2 mineras · vela 45' sobre SL21 · stop duro −5 % + SL21/SMA30 · pullback (≥20% bajo máx 60d, ≥5% bajo EMA200, QQQ bajo SL21) · vende +6% o cerca EMA150/200 · cerradas ${usd(ss.realized)} · aciertos ${swr} · QQQ ${so.qqq_up === false ? "bajo SL21 ✓" : "sobre SL21 (no compra)"}</p>
      ${sopen || `<p class="muted">Nada abierto.</p>`}
      <details><summary class="muted">Cierres (${esc((so.closed || []).length)})</summary>${scl ? `<div class="table-wrap"><table class="tbl"><tbody>${scl}</tbody></table></div>` : `<p class="muted">Todavía nada.</p>`}</details>
      ${sbt ? `<p class="muted">${sbt}</p>` : ""}</section>` });
  }
  const xo = a.tpsl;
  if (xo && xo.summary) {
    const xs = xo.summary, xwr = xs.trades ? Math.round((100 * xs.wins) / xs.trades) + "%" : "—", xtot = (xs.realized || 0) + (xs.unrealized || 0);
    const xopen = (xo.open || []).map((x) => `<details class="sec" style="margin:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px">
      <span><b>$${esc(x.t)}</b>${opened(x)} · TP1 ${esc(x.tpsl.tp1)} · SL ${esc(x.tpsl.sl)}</span><span class="mono" style="${col(x.unr)}">${usd(x.unr)} USD</span></summary>${detail(x)}</details>`).join("");
    const xcl = (xo.closed || []).map((c) => `<tr><td>${esc(c.close)}</td><td>$${esc(c.t)}</td><td class="hide-sm">${esc(c.why)}</td><td class="num" style="${col(c.pnl)}">${usd(c.pnl)}</td></tr>`).join("");
    const b = xo.backtest && xo.backtest.comparacion;
    const xbt = b ? `Prueba desde ${esc(xo.backtest.desde)}: TP/SL ${esc(b.tpsl.trades)} operaciones, ${esc(b.tpsl.win)}% ganadas, ${usd(b.tpsl.neto)} USD · Estrategia 1 ${esc(b.sole.trades)} op, ${esc(b.sole.win)}%, ${usd(b.sole.neto)} USD · Normal ${usd(b.normal.neto)} USD.` : "";
    labBlocks.push({ pin: false, pnl: xtot, html: `<section class="sec is-lab"><div class="sec-head"><h2>Modo TP/SL · lab</h2><div class="sec-right mono" style="${col(xtot)}">${usd(xtot)} USD</div></div>
      <p class="muted"><span class="pill">sin Telegram</span> Entra con las compras normal/Estrategia 1 solo si R/B ≥ 1,5 · vende 50% en TP1, resto en TP2 · SL cierra todo · cerradas ${usd(xs.realized)} · aciertos ${xwr}</p>
      ${xopen || `<p class="muted">Nada abierto.</p>`}
      <details><summary class="muted">Cierres (${esc((xo.closed || []).length)})</summary>${xcl ? `<div class="table-wrap"><table class="tbl"><tbody>${xcl}</tbody></table></div>` : `<p class="muted">Todavía nada.</p>`}</details>
      ${xbt ? `<p class="muted">${xbt}</p>` : ""}</section>` });
  }
  const s3 = a.sole3;
  if (s3 && s3.summary) {
    const zs = s3.summary, zwr = zs.trades ? Math.round((100 * zs.wins) / zs.trades) + "%" : "—", ztot = (zs.realized || 0) + (zs.unrealized || 0);
    const zopen = (s3.open || []).map((x) => `<details class="sec" style="margin:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px">
      <span><b>$${esc(x.t)}</b> · ${esc((x.tr || []).length)} compra(s) · abierta ${esc(((x.tr || [])[0] || {}).when || "—")} ART</span><span class="mono" style="${col(x.unr)}">${usd(x.unr)} USD</span></summary>
      <div style="padding:8px 4px;font-size:.92em">${evHtml(x.events)}${fundHtml(x.fund, x.px, x.t)}<p><b>Compras</b></p><ul>${(x.tr || []).map((p) => `<li>Compra ${esc(p.n)}: ${esc(p.when)} ART a ${esc(p.px)} → ${pct((x.px / p.px - 1) * 100)}</li>`).join("")}</ul>
      <p>Precio ${esc(x.px)} · promedio ${esc(x.avg)} · objetivo TP ${esc(x.tp_px)} · RSI 45' ${esc(x.rsi45 ?? "—")} (vende >70) · ${esc(x.dias)} de 60 días</p>${x.why ? `<p class="muted">Entró por: ${esc(x.why)}</p>` : ""}</div></details>`).join("");
    const zcl = (s3.closed || []).map((c) => `<tr><td>${esc(c.close)}</td><td>$${esc(c.t)}</td><td class="hide-sm">${esc(c.why)}</td><td class="num" style="${col(c.pnl)}">${usd(c.pnl)} (${pct(c.pct)})</td></tr>`).join("");
    const zc = (s3.cands || []).map((c) => `$${esc(c.t)} (${pct(c.dd)}, RSI ${esc(c.rsi)})`).join(" · ");
    const zb = s3.backtest;
    const zbt = zb ? `Prueba diaria ${esc(zb.desde)}–${esc(zb.hasta)}, ${esc(zb.universo)} acciones: 1ª mitad ${esc(zb.h1.n)} op, ${esc(zb.h1.win)}% ganadas, ${pct(zb.h1.avg)} por op (azar ${pct(zb.h1_azar.avg)}) · 2ª mitad ${esc(zb.h2.n)} op, ${esc(zb.h2.win)}%, ${pct(zb.h2.avg)} (azar ${pct(zb.h2_azar.avg)}) · walk-forward ${(zb.wf || []).map((w) => pct(w.test.avg) + " vs " + pct(w.azar.avg)).join(" · ")}. ${esc(zb.nota)}.` : "";
    labBlocks.push({ pin: false, pnl: ztot, html: `<section class="sec is-lab"><div class="sec-head"><h2>Sole v3 · lab</h2><div class="sec-right mono" style="${col(ztot)}">${usd(ztot)} USD</div></div>
      <p class="muted"><span class="pill">sin Telegram</span> Compra en la primera hora NY si al cierre anterior cayó ≥30% desde el máx. de 60 días y RSI diario ≤35 · vende +10% sobre el promedio, RSI 45' >70 o a los 60 días · sin stop · promedia 1 vez (−10%) · cerradas ${usd(zs.realized)} · aciertos ${zwr} · desde ${esc(zs.since)} ART</p>
      ${zopen || `<p class="muted">Nada abierto.</p>`}
      <p class="muted">Candidatas para ${esc(s3.cands_for)}: ${zc || "ninguna"}</p>
      <details><summary class="muted">Cierres (${esc((s3.closed || []).length)})</summary>${zcl ? `<div class="table-wrap"><table class="tbl"><tbody>${zcl}</tbody></table></div>` : `<p class="muted">Todavía nada.</p>`}</details>
      ${zbt ? `<p class="muted">${zbt}</p>` : ""}</section>` });
  }
  const RULES = {
    rbs: "Lab. Rompe máximo 20d con vol ≥ 1,5x, EMA21 > EMA50 > EMA200 y RS ≥ 70 · veto 2d pre-earnings y 10d post-miss · 10 ruedas o stop −5 % · cupo 3/día máx 8 abiertas",
    conf: "Principal paper. 2+ señales: rebote EMA200 con clímax, Episodic Pivot (+4% vol 2x), cruce RSI semanal/SMA14 (5d), volumen seco + ruptura, ruptura + RS · precio ≥ 5 USD, vol ≥ 1 M/día · veto 2d pre-earnings y 10d post-miss · apertura siguiente · 10 ruedas o stop −5 % · cupo 3/día y máx 8 abiertas",
  };
  let mainHtml = "";
  for (const [k, ico] of [["conf", ""], ["rbs", ""]]) {
    const q = a[k];
    if (!q || !q.summary) continue;
    const qs = q.summary, qwr = qs.trades ? Math.round((100 * qs.wins) / qs.trades) + "%" : "—", qtot = (qs.realized || 0) + (qs.unrealized || 0);
    const qopen = (q.open || []).map((x) => `<details class="sec" style="margin:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px">
      <span><b>$${esc(x.t)}</b> · RS ${esc(x.rs)} · abierta ${esc(x.when)} ART · rueda ${esc(x.dias)}/10${x.usd && x.usd !== q.usd ? ` · ${esc(x.usd)} USD` : ""}</span><span class="mono" style="${col(x.unr)}">${usd(x.unr)} USD</span></summary>
      <div style="padding:8px 4px;font-size:.92em"><p>Entrada ${esc(x.px)} · ahora ${esc(x.now)} · stop ${esc((x.px * 0.95).toFixed(2))}</p><p class="muted">Entró por: ${esc(x.why)}</p></div></details>`).join("");
    const qcl = (q.closed || []).map((c) => `<tr><td>${esc(c.close)}</td><td>$${esc(c.t)}</td><td class="hide-sm">${esc(c.why)}</td><td class="num" style="${col(c.pnl)}">${usd(c.pnl)} (${pct(c.pct)})</td></tr>`).join("");
    const qc = (q.cands || []).map((c) => `$${esc(c.t)} (RS ${esc(c.rs)}${k === "conf" ? ": " + esc((c.why || []).join(" + ")) : ""})`).join(" · ");
    const veto = (q.vetoed || []).map((v) => `$${esc(v.t)} (${esc(v.why)})`).join(" · ");
    const br = q.brake || {};
    const head = k === "conf"
      ? `<p class="muted">${RULES[k]} · cupo ${esc(q.maxb)} altas/día y máx. ${esc(q.maxo)} abiertas · ${esc(q.usd)} USD (amarillo = mitad) · semáforo ${esc(br.color || "?")}: ${esc(br.note || "")} · <span class="pill book">Telegram sí</span> · cerradas ${usd(qs.realized)} · aciertos ${qwr} · desde ${esc(qs.since)} ART</p>`
      : `<p class="muted"><span class="pill">sin Telegram</span> ${RULES[k]} · cupo ${esc(q.maxb)}/${esc(q.maxo)} · cerradas ${usd(qs.realized)} · aciertos ${qwr} · desde ${esc(qs.since)} ART</p>`;
    const html = `<section class="sec${k === "conf" ? " is-main" : " is-lab"}"><div class="sec-head"><h2>${ico}${esc(q.name || (k === "conf" ? "Confluencia" : "Ruptura RS"))}${k === "conf" ? " · principal" : " · lab"}</h2><div class="sec-right mono" style="${col(qtot)}">${usd(qtot)} USD</div></div>
      ${k === "conf" ? heroNum(qtot, "USD") : ""}
      ${head}
      ${qopen || `<p class="muted">Nada abierto.</p>`}
      <p class="muted">Señales del cierre ${esc(q.sig_day || "—")} (próxima apertura): ${qc || "ninguna"}</p>
      ${veto ? `<p class="muted">Veto earnings/miss: ${veto}</p>` : ""}
      <details><summary class="muted">Cierres (${esc((q.closed || []).length)})</summary>${qcl ? `<div class="table-wrap"><table class="tbl"><tbody>${qcl}</tbody></table></div>` : `<p class="muted">Todavía nada.</p>`}</details></section>`;
    if (k === "conf") mainHtml = html;
    else labBlocks.push({ pin: false, pnl: qtot, html });
  }
  const cd = a.cands;
  let candHtml = "";
  const star = (list) => (list || []).map((m) => ` <span class="star">★ ${esc(m)}</span>`).join("");
  if (cd && Array.isArray(cd.items)) {
    const itemsSorted = [...cd.items].sort((left, right) => ((right.match || []).length - (left.match || []).length) || (right.score - left.score));
    const rows = itemsSorted.map((x) => `<details class="sec" style="margin:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px">
      <span><b>${esc(x.t)}</b>${rsTag(x.t)}${star(x.match)}${evFlag(x.events)} <span class="muted">${esc(x.name)}</span></span><span class="mono">${esc(x.score)}/8 · ${pct(x.gap)}</span></summary>
      <div style="padding:6px 4px;font-size:.92em"><p>${esc(x.px)} ${esc(x.cur)} · vela 45' ${esc(x.bar)} ART${x.falta ? " · falta: " + esc(x.falta) : ""}</p>${evHtml(x.events)}${fundHtml(x.fund, x.px, x.t)}${imgBox(x.t, "cand")}${taHtml(x)}<ul>${(Array.isArray(x.why) ? x.why : []).map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      <p class="muted">SL21 ${pct(x.d21)} · RSI ${esc(x.rsi)} · Estoc ${esc(x.stoch)} · máx 1 mes ${pct(x.dd)} · EMA200 ${pct(x.e200)}</p></div></details>`).join("");
    const lvl = (L, w) => (L || []).map((p) => `<li>${w} ${esc(p.px)} (${pct(p.dist)}) · ${esc(p.toques)} toques${p.n ? ` · rebotó ${esc(p.rebote)} de ${esc(p.n)} veces, 10 ruedas después ${pct(p.post)} promedio` : ""}</li>`).join("");
    const rv = (cd.review || []).map((x) => `<details class="sec" style="margin:6px 0"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:8px">
      <span>${esc(x.diario)} <b>${esc(x.t)}</b>${star(x.match)}${evFlag(x.events)} <span class="muted">${esc(x.name)}</span></span><span class="mono">RS ${esc(x.rs ?? "—")}${x.diario === "⚠️" ? " · diario en techo" : ""}</span></summary>
      <div style="padding:6px 4px;font-size:.92em"><p>${esc(x.px)} · vela 45' ${esc(x.bar)} ART · subiendo: ${esc((((x.s45 || {}).on) || []).join(", "))} · vol. relativo ${esc((x.s45 || {}).vr)}x · RSI ${esc((x.s45 || {}).rsi)} · Estoc ${esc((x.s45 || {}).stoch)}</p>
      <p>Diario: ${esc((x.diario_why || []).join(" · "))}</p>
      <p>EMA150 ${esc(x.ema150)} (${pct(x.e150)}) · EMA200 ${esc(x.ema200)} (${pct(x.e200)}) · RS vs SPY ${esc(x.rs ?? "—")}${x.ex != null ? ` (exceso ${pct(x.ex)})` : ""}</p>
      <p><b>Pisos y techos (6–12 meses)</b></p><ul>${lvl(x.techos_lv, "🟥 techo") + lvl(x.pisos_lv, "🟩 piso") || "<li>—</li>"}</ul>
      ${(x.patd || []).length + (x.pat_ta || []).length ? `<p><b>Patrones</b></p><ul>${[...(x.patd || []), ...(x.pat_ta || [])].map((p) => `<li>${p}</li>`).join("")}</ul>` : ""}
      ${evHtml(x.events)}${fundHtml(x.fund, x.px, x.t)}</div></details>`).join("");
    const revHtml = `<h3 style="margin-top:14px">Candidatas para revisar</h3><p class="muted">Solo información, sin compras. 45': mayoría de MACD, Koncorde, RSI y estocástico subiendo con volumen relativo ≥ 1 (sin exigir SL21) · precio ≥ 5 USD, volumen ≥ 1 M/día · diario que acompaña · diario en techo va al fondo · máx. 10, ordenadas por RS.</p>${rv || `<p class="muted">Ninguna ahora.</p>`}`;
    candHtml = `<section class="sec"><div class="sec-head"><h2>Posibles compras</h2><div class="sec-right mono muted">${esc(cd.items.length)} de ${esc(cd.universe)} · ${esc(cd.updated)} ART</div></div>
      <p class="muted">Cerca de dar compra pero sin confirmar. La <span class="star">★</span> marca coincidencia con Confluencia, Ruptura RS o Sole v3. No es una compra.</p>${rows || `<p class="muted">Nada cerca ahora.</p>`}${revHtml}</section>`;
  }
  const bt = a.backtest;
  const btTxt = bt ? `Prueba ${esc(bt.desde)}–${esc(bt.hasta)}: ${esc(bt.trades)} operaciones, ${Math.round((100 * bt.wins) / bt.trades)}% ganadas, ${usd(bt.realized)} USD cerradas y ${usd(bt.unrealized)} abiertas.` : "";
  const pa = a.pine_all;
  const pineAllHtml = (pa && pa.parts && pa.parts.length) ? `<section class="sec"><p>${pa.parts.map((p, i) => `<textarea style="display:none">${esc(p)}</textarea><button type="button" onclick="const b=this;navigator.clipboard.writeText(b.previousElementSibling.value).then(()=>{b.textContent='Copiado'},()=>{b.previousElementSibling.style.display='block'})">Copiar Pine (todas${pa.parts.length > 1 ? " · parte " + (i + 1) + "/" + pa.parts.length : ""})</button> `).join("")}<span class="muted">${esc(pa.n)} acciones · cambió ${esc(pa.changed_at)} ART · un solo indicador: pegalo una vez y sirve para todas (dibuja la acción del gráfico)${pa.parts.length > 1 ? " · son " + pa.parts.length + " partes: cada una va en un indicador distinto" : ""}</span></p></section>` : "";
  const normalHtml = `<section class="sec is-lab"><div class="sec-head"><h2>Normal · lab</h2><div class="sec-right mono" style="${col(tot)}">${usd(tot)} USD</div></div>
    <p class="muted"><span class="pill">sin Telegram</span> Cartera simulada de antes, ${esc(a.usd_per_buy)} USD por compra. Cerradas ${usd(s.realized)} · abiertas ${usd(s.unrealized)} · ${esc(s.trades)} cierres · aciertos ${wr == null ? "—" : wr + "%"} · desde ${esc(s.since)} · act. ${esc(a.updated)} ART</p></section>
    <section class="sec"><div class="sec-head"><h2>Posiciones abiertas (Normal)</h2><div class="sec-right mono muted">${esc(s.open)}</div></div>
    ${open || `<div class="empty"><strong>Nada abierto</strong><p>Tocá una posición para ver el detalle.</p></div>`}</section>
    <details class="sec"><summary><b>Historial de cierres (Normal)</b> (${esc((a.closed || []).length)})</summary>${closed ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Cierre</th><th>Acción</th><th class="hide-sm">Motivo</th><th class="num">Neto USD</th></tr></thead><tbody>${closed}</tbody></table></div>` : `<p class="muted">Todavía no cerró nada.</p>`}</details>`;
  if (mainHtml) labBlocks.push({ pin: false, pnl: tot, html: normalHtml });
  labBlocks.sort((left, right) => {
    if (left.pin !== right.pin) return left.pin ? -1 : 1;
    return (Number(right.pnl) || 0) - (Number(left.pnl) || 0);
  });
  const top = mainHtml || normalHtml;
  const head = pageHead("Acciones ASL", mainHtml
    ? "Confluencia es la principal y avisa por Telegram. El semáforo solo frena el tamaño. Estrategia 1 y el resto son labs, sin Telegram."
    : "Este envío no trae Confluencia. Abajo está el paper que sí vino.");
  return `${head}${semHtml}${top}${candHtml}
    <section class="sec"><h2 class="kick">Laboratorio</h2><p>Estrategia 1 va primera: mide en papel y no manda Telegram. El resto está ordenado por resultado de papel.</p></section>
    ${labBlocks.map((block) => block.html).join("")}
    ${pineAllHtml}
    <details class="sec"><summary><b>Resto de las acciones</b> (${esc((a.others || []).length)})</summary><div class="table-wrap"><table class="tbl"><thead><tr><th>Acción</th><th class="num">vs SL21</th><th>Diario</th><th class="hide-sm">Última señal</th></tr></thead><tbody>${others}</tbody></table></div></details>
    ${btTxt ? `<details class="sec"><summary><b>Prueba con datos pasados</b></summary><p class="muted">${btTxt}</p></details>` : ""}${old}`;
}

function renderCripto(stats) {
  const c = stats.cripto;
  if (!c || typeof c !== "object") return `<section class="sec"><p class="kick">Cripto · paper</p>${heroNum(null, "USD")}<p class="muted">Este envío todavía no trae la parte cripto.</p></section>`;
  const vars = Array.isArray(c.variants) ? c.variants : [];
  const opens = Array.isArray(c.open) ? c.open : [];
  const by = (k) => vars.find((v) => v.variant === k);
  const top = ["cripto_mateo", "lab_mateo_acciones", "lab_cripto_asl_7d", "lab_cripto_asl_5d", "lab_acciones_10r", "lab_cripto_asl", "lab_analista_btc"].map(by).filter(Boolean);
  const rest = vars.filter((v) => !top.includes(v));
  const tot = vars.reduce((a, v) => a + (firstNum(v.net_usd) || 0), 0);
  const unr = opens.reduce((a, o) => a + (firstNum(o.unrealized_usd) || 0), 0);
  const nd = c.next_daily_check ? hora(tsIso(c.next_daily_check)) : "21:03";
  const vetos = (Array.isArray(c.fund_log) ? c.fund_log : []).filter((f) => !f.ok);
  const restRows = rest.map((v) => {
    const m = CMETA[v.variant] || {};
    return `<tr><td>${esc(m.name || CRIPTO_LABEL[v.variant] || v.label || v.variant)}<br><span class="muted small">${esc(m.how || v.label || "")}</span></td><td class="num mono">${esc(v.closed ?? 0)}</td><td class="num mono ${toneClass(v.net_usd)}">${esc(signedText(v.net_usd || 0))}</td><td class="num mono">${esc(v.open ?? 0)}</td></tr>`;
  }).join("");
  const KIND = { open: "compra", close: "vende", partial: "target" };
  const recent = (Array.isArray(c.recent) ? c.recent : []).filter((e) => KIND[e.kind]).slice(0, 10);
  const recRows = recent.map((e) => `<div class="mv"><span class="mono muted small">${esc(hora(tsIso(e.ts)))}</span><span><span class="tag ${e.kind === "open" ? "ok" : ""}">${esc(KIND[e.kind])}</span> <strong>${esc(e.sym)}</strong></span>
    <span class="small">${esc((CMETA[e.variant] || {}).name || CRIPTO_LABEL[e.variant] || e.variant)}<br><span class="mono muted">${esc(pxText(e.px))}</span></span>
    <span class="mono num ${e.kind === "close" ? toneClass(e.pnl) : "muted"}">${e.kind === "close" ? esc(signedText(e.pnl)) : "—"}</span></div>`).join("");
  return `<section class="sec explain"><p class="kick">Cripto y acciones · simulado, sin plata real</p>
      <h2>¿Cómo funciona?</h2>
      <p>Una vez por día, a las <strong>21:03 (ART)</strong>, cuando cierra la vela diaria, el bot revisa las monedas y acciones. Si una cumple las reglas técnicas, primero pasa un <strong>chequeo de noticias y mercado</strong> 🛡 (hackeos, deslistados, balances de empresas, caídas fuertes). Si encuentra algo grave, no compra. Después vigila cada minuto el <span class="is-down">stop</span> (salida si sale mal) y el <span class="is-up">objetivo</span> (salida si sale bien).</p>
      <div class="sstats"><div><span class="lbl">Neto todas</span><strong class="mono ${toneClass(tot)}">${esc(signedText(tot))}</strong></div><div><span class="lbl">Abiertas ahora</span><strong class="mono">${esc(opens.length)}</strong></div><div><span class="lbl">Si vendiera ya</span><strong class="mono ${toneClass(unr)}">${esc(signedText(unr))}</strong></div><div><span class="lbl">Próxima revisión</span><strong class="mono">${esc(nd)}</strong></div></div>
      ${vetos.length ? `<p class="small">⛔ Últimos vetos: ${vetos.slice(-3).reverse().map((f) => `<strong>${esc(f.sym)}</strong> (${esc((f.vetos || [])[0] || "")})`).join(" · ")}</p>` : `<p class="small muted">🛡 Sin compras vetadas hasta ahora.</p>`}
    </section>
    <div class="sgrid">${top.map((v) => stratCard(c, v, opens)).join("")}</div>
    ${renderLabs(c)}
    <div class="split">
      <section class="sec"><div class="sec-head"><h2>Otras pruebas (largo plazo o viejas)</h2><p>Siguen corriendo para comparar; no son la apuesta principal.</p></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Estrategia</th><th class="num">Cerradas</th><th class="num">Neto</th><th class="num">Abiertas</th></tr></thead><tbody>${restRows}</tbody></table></div></section>
      <section class="sec"><div class="sec-head"><h2>Últimos movimientos</h2><p>Compras y ventas, hora ART.</p></div>
        ${recent.length ? recRows : `<div class="empty"><strong>Todavía no hubo compras ni ventas.</strong></div>`}
        <p class="muted small">Neto descontando costos (~0,2 % + 0,01 USD por operación). Cada compra es de 15 USD simulados.</p></section>
    </div>`;
}

function applyTab() {
  TABS.forEach((name) => {
    const on = state.tab === name;
    const tab = document.getElementById(`tab-${name}`);
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    document.getElementById(`panel-${name}`).hidden = !on;
  });
}

function selectTab(name) {
  state.tab = TABS.includes(name) ? name : "principal";
  applyTab();
  const host = document.getElementById(state.tab === "loteria" ? "chart-loteria" : "chart-principal");
  if (host) delete host.dataset.w;
  requestAnimationFrame(() => {
    if (state.tab === "loteria") drawLoteriaChart();
    else drawPrincipalChart();
  });
}

function drawPrincipalChart() {
  if (!state.stats) return;
  const host = document.getElementById("chart-principal");
  if (!host || host.clientWidth < 40) return;
  const view = principalView(state.stats);
  const note = document.getElementById("chart-note");
  const summary = document.getElementById("chart-summary");
  if (note) note.textContent = view.note;
  if (summary) summary.textContent = extremesText(view.buckets);
  document.querySelectorAll("[data-chart-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.chartMode === state.chartMode ? "true" : "false");
  });
  const card = document.getElementById("chart-card-principal");
  if (card) card.classList.toggle("has-chart", view.buckets.length > 0);
  drawChart(host, view.buckets, `PnL por hora ART. ${view.note}`);
}

function drawLoteriaChart() {
  if (!state.stats) return;
  const view = loteriaView(state.stats);
  const note = document.getElementById("chart-note-lot");
  const summary = document.getElementById("chart-summary-lot");
  if (note) note.textContent = view.note;
  if (summary) summary.textContent = extremesText(view.buckets);
  const host = document.getElementById("chart-loteria");
  if (!host || host.clientWidth < 40) return;
  const card = document.getElementById("chart-card-loteria");
  if (card) card.classList.toggle("has-chart", view.buckets.length > 0);
  drawChart(host, view.buckets, `PnL de la lotería por hora ART. ${view.note}`);
}

function drawChart(host, buckets, aria) {
  host.dataset.w = String(Math.floor(host.clientWidth));
  if (!buckets.length) {
    host.innerHTML = `<div class="empty"><strong>Sin barras todavía</strong><p>Cuando haya cierres con hora, la curva y las barras aparecen acá.</p></div>`;
    plots.delete(host);
    return;
  }
  const width = Math.max(160, Math.floor(host.clientWidth));
  const wide = width >= 800;
  const lineH = wide ? 200 : 148;
  const padT = 12;
  const labelH = 22;
  const ys = buckets.map((b) => b.cumulative);
  let min = Math.min(0, ...ys);
  let max = Math.max(0, ...ys);
  if (min === max) { min -= 1; max += 1; }
  const padL = Math.max(44, Math.min(72, 12 + String(axisFmt.format(min)).length * 7.2));
  const padR = 8;
  const lineTop = padT;
  const lineUsable = lineH - 10;
  const yOf = (value) => lineTop + (1 - (value - min) / (max - min)) * lineUsable;
  const ds = buckets.map((b) => b.delta);
  let dMin = Math.min(0, ...ds);
  let dMax = Math.max(0, ...ds);
  if (dMin === dMax) { dMin -= 1; dMax += 1; }
  const barH = wide ? 78 : 62;
  const barTop = padT + lineH + 8;
  const usable = barH - 8;
  const yBar = (value) => barTop + ((dMax - value) / (dMax - dMin)) * usable;
  const height = barTop + usable + labelH;
  const innerW = Math.max(10, width - padL - padR);
  const slot = innerW / buckets.length;
  const pts = buckets.map((bucket, index) => ({
    ...bucket,
    x: padL + slot * index + slot / 2,
    y: yOf(bucket.cumulative),
  }));
  const zeroY = yOf(0);
  const barZero = yBar(0);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("");
  const expanded = [];
  for (let i = 0; i < pts.length; i += 1) {
    if (i > 0) {
      const a = pts[i - 1];
      const b = pts[i];
      const cross = (a.cumulative > 0 && b.cumulative < 0) || (a.cumulative < 0 && b.cumulative > 0);
      if (cross && a.cumulative !== b.cumulative) {
        const t = (0 - a.cumulative) / (b.cumulative - a.cumulative);
        expanded.push({ x: a.x + (b.x - a.x) * t, y: zeroY });
      }
    }
    expanded.push(pts[i]);
  }
  let area = `M${pts[0].x.toFixed(2)} ${zeroY.toFixed(2)}`;
  for (const p of expanded) area += `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  area += `L${pts[pts.length - 1].x.toFixed(2)} ${zeroY.toFixed(2)}Z`;
  const ticks = [];
  const seen = new Set();
  for (const value of [max, 0, min]) {
    const key = value.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    ticks.push(value);
  }
  const grid = ticks.map((value) => {
    const y = yOf(value);
    return `<line class="eq-grid" x1="${padL}" y1="${y.toFixed(1)}" x2="${(width - padR).toFixed(1)}" y2="${y.toFixed(1)}"></line><text class="eq-tick" x="${(padL - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end">${esc(axisFmt.format(value))}</text>`;
  }).join("");
  const bars = pts.map((p) => {
    if (p.empty || Math.abs(p.delta) < 0.0005) return "";
    const y1 = yBar(p.delta);
    const top = Math.min(barZero, y1);
    const h = Math.max(Math.abs(y1 - barZero), 1.6);
    const bw = Math.max(1.5, Math.min(16, slot * 0.62));
    const klass = p.delta > 0 ? "bar-up" : "bar-down";
    return `<rect class="${klass}" x="${(p.x - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"></rect>`;
  }).join("");
  const minGap = width < 520 ? 46 : 54;
  const step = Math.max(1, Math.ceil(minGap / slot));
  const chosen = [];
  for (let i = 0; i < pts.length; i += 1) {
    const dayBreak = i === 0 || pts[i].key.slice(0, 10) !== pts[i - 1].key.slice(0, 10);
    if (i === 0 || i === pts.length - 1 || dayBreak || i % step === 0) chosen.push(i);
  }
  const labelsIdx = [];
  for (const index of chosen) {
    if (!labelsIdx.length || (index - labelsIdx[labelsIdx.length - 1]) * slot >= minGap - 6 || index === pts.length - 1) {
      if (labelsIdx.length && index === pts.length - 1 && (index - labelsIdx[labelsIdx.length - 1]) * slot < minGap - 6 && labelsIdx[labelsIdx.length - 1] !== 0) {
        labelsIdx.pop();
      }
      labelsIdx.push(index);
    }
  }
  const labels = labelsIdx.map((index) => {
    const bucket = pts[index];
    const dayBreak = index === 0 || bucket.key.slice(0, 10) !== pts[Math.max(0, index - 1)].key.slice(0, 10);
    const text = dayBreak ? `${bucket.parts.day}/${bucket.parts.month}` : `${Number(bucket.parts.hour)}h`;
    const anchor = index === 0 ? "start" : index === pts.length - 1 ? "end" : "middle";
    const x = index === 0 ? padL : index === pts.length - 1 ? width - padR : bucket.x;
    return `<text class="eq-tick" x="${x.toFixed(1)}" y="${(height - 6).toFixed(1)}" text-anchor="${anchor}">${esc(text)}</text>`;
  }).join("");
  const last = pts[pts.length - 1];
  const dot = last.cumulative > 0.0005 ? "eq-dot-up" : last.cumulative < -0.0005 ? "eq-dot-down" : "eq-dot-flat";
  const table = `<table class="sr-only"><caption>${esc(aria)}</caption><thead><tr><th>Hora ART</th><th>Esa hora</th><th>Acumulado</th></tr></thead><tbody>${
    buckets.map((b) => `<tr><td>${esc(fmtHour(b))}</td><td>${esc(signedText(b.delta))}</td><td>${esc(signedText(b.cumulative))}</td></tr>`).join("")
  }</tbody></table>`;
  host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(aria)}">
      ${grid}
      <line class="eq-zero" x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${(width - padR).toFixed(1)}" y2="${zeroY.toFixed(1)}"></line>
      <path class="eq-area" d="${area}"></path>
      <path class="eq-line" d="${line}"></path>
      <circle class="${dot}" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.5"></circle>
      <line class="eq-zero" x1="${padL}" y1="${barZero.toFixed(1)}" x2="${(width - padR).toFixed(1)}" y2="${barZero.toFixed(1)}"></line>
      ${bars}
      ${labels}
      <line class="eq-cross" data-cross="1" x1="0" y1="${lineTop}" x2="0" y2="${(barTop + usable).toFixed(1)}" visibility="hidden"></line>
    </svg>
    <div class="tip" hidden></div>
    ${table}`;
  plots.set(host, { padL, padR, width, pts });
  bindChart(host);
}

function bindChart(host) {
  if (host.dataset.bound) return;
  host.dataset.bound = "1";
  const move = (event) => showTip(host, event.clientX);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerdown", move);
  host.addEventListener("pointerleave", () => hideTip(host));
}

function showTip(host, clientX) {
  const plot = plots.get(host);
  const tip = host.querySelector(".tip");
  const cross = host.querySelector("[data-cross]");
  if (!plot || !tip || !plot.pts.length) return;
  const rect = host.getBoundingClientRect();
  const scale = plot.width / (rect.width || plot.width);
  const x = (clientX - rect.left) * scale;
  let nearest = plot.pts[0];
  let best = Infinity;
  for (const point of plot.pts) {
    const dist = Math.abs(point.x - x);
    if (dist < best) { best = dist; nearest = point; }
  }
  const tone = toneClass(nearest.delta);
  tip.hidden = false;
  tip.innerHTML = `<strong>${esc(fmtHour(nearest))} ART</strong><span>Esa hora <b class="${tone}">${esc(signedText(nearest.delta))}</b></span><span>Acumulado <b class="${toneClass(nearest.cumulative)}">${esc(signedText(nearest.cumulative))}</b></span>`;
  const tipW = tip.offsetWidth || 160;
  const local = clientX - rect.left;
  const left = Math.max(8, Math.min(local - tipW / 2, rect.width - tipW - 8));
  tip.style.left = `${left}px`;
  tip.style.top = "8px";
  if (cross) {
    const svgX = nearest.x;
    cross.setAttribute("x1", svgX.toFixed(1));
    cross.setAttribute("x2", svgX.toFixed(1));
    cross.setAttribute("visibility", "visible");
  }
}

function hideTip(host) {
  const tip = host.querySelector(".tip");
  const cross = host.querySelector("[data-cross]");
  if (tip) tip.hidden = true;
  if (cross) cross.setAttribute("visibility", "hidden");
}

async function loadStats(token) {
  if (REMOTE) {
    const response = await fetch(`${CFG.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_stats`, {
      method: "POST",
      headers: {
        apikey: CFG.supabaseAnonKey,
        Authorization: `Bearer ${CFG.supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tok: token }),
    });
    const body = await response.json().catch(() => null);
    const result = window.MemebotOps.readStatsResult({ ok: response.ok, status: response.status, body });
    if (result.error) throw new Error(result.error);
    return result.stats;
  }
  const response = await fetch(`/${encodeURIComponent(token)}/stats.json`, { cache: "no-store" });
  const body = await response.json().catch(() => null);
  const result = window.MemebotOps.readStatsResult({ ok: response.ok, status: response.status, body });
  if (result.error) throw new Error(result.error);
  return result.stats;
}

function showGate() {
  document.body.classList.remove("in-app");
  document.getElementById("gate").hidden = false;
  document.getElementById("app").hidden = true;
  document.getElementById("tabs").hidden = true;
  document.getElementById("logout").hidden = true;
  document.getElementById("live").hidden = true;
  const cocosBox = document.getElementById("side-real");
  if (cocosBox) cocosBox.hidden = true;
}

function showApp() {
  document.body.classList.add("in-app");
  document.getElementById("gate").hidden = true;
  document.getElementById("app").hidden = false;
  document.getElementById("tabs").hidden = false;
  document.getElementById("logout").hidden = false;
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.hidden = false;
  toast.textContent = text;
}

function hideToast() {
  document.getElementById("toast").hidden = true;
}

function setStatus(text, bad) {
  const el = document.getElementById("gate-error");
  el.textContent = text || "";
  el.classList.toggle("is-bad", Boolean(bad));
}

async function refresh(token, quiet) {
  try {
    const stats = await loadStats(token);
    window.__aslTok = token;
    if (REMOTE && !state.dev) { try { stats.asl = await loadStats(token + "_asl"); } catch (e) { stats.asl = null; } }
    showApp();
    render(stats);
    setStatus("");
    hideToast();
  } catch (error) {
    const gate = document.getElementById("gate");
    if (!quiet || gate.hidden === false) {
      showGate();
      setStatus(error.message || "No pude cargar el tablero.", true);
    } else if (state.stats) {
      showToast("No pude actualizar. Sigo mostrando lo último que llegó.");
    }
  }
}

function currentToken() {
  return sessionStorage.getItem("memebot_token") || tokenFromHash();
}

function tokenFromHash() {
  const raw = (location.hash || "").replace(/^#/, "");
  return raw ? decodeURIComponent(raw) : "";
}

function start(token) {
  state.dev = false;
  sessionStorage.setItem("memebot_token", token);
  const url = new URL(location.href);
  url.searchParams.delete("dev");
  url.hash = encodeURIComponent(token);
  if (`${location.pathname}${location.search}${location.hash}` !== `${url.pathname}${url.search}${url.hash}`) {
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  setStatus("Cargando…", false);
  refresh(token, false);
  clearInterval(timer);
  timer = setInterval(() => refresh(token, true), 30000);
}

function startDev() {
  state.dev = false;
  clearInterval(timer);
  showGate();
  setStatus("No hay operaciones de ejemplo. Este tablero solo muestra datos reales.", true);
}

document.getElementById("gate").addEventListener("submit", (event) => {
  event.preventDefault();
  const token = document.getElementById("token").value.trim();
  if (!token) return;
  start(token);
});

document.getElementById("dev-link").addEventListener("click", () => {
  startDev();
});

document.getElementById("logout").addEventListener("click", () => {
  clearInterval(timer);
  state.dev = false;
  state.stats = null;
  state.json = "";
  sessionStorage.removeItem("memebot_token");
  history.replaceState(null, "", location.pathname);
  showGate();
  setStatus("");
});

function visibleTabs() {
  return TABS.filter((name) => {
    const tab = document.getElementById(`tab-${name}`);
    return tab && !tab.hidden;
  });
}

document.getElementById("tabs").addEventListener("keydown", (event) => {
  const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
  const vertical = event.key === "ArrowDown" || event.key === "ArrowUp";
  if (!horizontal && !vertical) return;
  event.preventDefault();
  const names = visibleTabs();
  const i = Math.max(0, names.indexOf(state.tab));
  const dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const next = names[(i + dir + names.length) % names.length];
  selectTab(next);
  document.getElementById(`tab-${next}`).focus();
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-tab], [data-chart-mode], [data-expand], [data-lot-filter]");
  if (!target) return;
  if (target.dataset.tab) {
    selectTab(target.dataset.tab);
    return;
  }
  if (target.dataset.chartMode) {
    state.chartMode = target.dataset.chartMode;
    state.chartChosen = true;
    const host = document.getElementById("chart-principal");
    if (host) delete host.dataset.w;
    drawPrincipalChart();
    return;
  }
  if (target.dataset.expand === "lotrecent") {
    state.lotRecentOpen = !state.lotRecentOpen;
    state.json = "";
    if (state.stats) render(state.stats);
    return;
  }
  if (target.dataset.expand === "trades") {
    state.tradesOpen = !state.tradesOpen;
    state.json = "";
    if (state.stats) render(state.stats);
    return;
  }
  if (target.dataset.expand) {
    state.exp = state.exp || {};
    state.exp[target.dataset.expand] = !state.exp[target.dataset.expand];
    state.json = "";
    if (state.stats) render(state.stats);
    return;
  }
  if (target.dataset.lotFilter) {
    state.lotFilter = target.dataset.lotFilter;
    state.lotChosen = true;
    state.json = "";
    if (state.stats) render(state.stats);
  }
});

document.addEventListener("toggle", (event) => {
  const el = event.target;
  if (!(el instanceof HTMLDetailsElement)) return;
  if (el.id === "paused") state.pausedOpen = el.open;
  if (el.id === "fine") state.fineOpen = el.open;
  if (el.id === "tape") state.tapeOpen = el.open;
}, true);

if (onLocalHost) document.getElementById("local-hint").hidden = false;

window.__mb = { bucketEquity, bucketTrades, artParts, render, state, principalView, loteriaView, opsView };

if (state.dev) startDev();
else {
  const initial = currentToken();
  if (initial) {
    document.getElementById("token").value = initial;
    start(initial);
  } else showGate();
}

// Gráficos ASL bajo demanda (se cargan al abrir el detalle)
const __aslImg = {};
document.addEventListener("toggle", async (ev) => {
  const d = ev.target;
  if (!d || d.tagName !== "DETAILS" || !d.open || !window.__aslTok) return;
  const box = d.querySelector(":scope > div .aslimg, :scope > .aslimg, .aslimg");
  if (!box || box.dataset.done) return;
  const kind = box.dataset.kind, t = box.dataset.t;
  try {
    if (!__aslImg[kind]) __aslImg[kind] = loadStats(window.__aslTok + (kind === "pos" ? "_aslimg" : "_aslimgc"));
    const m = await __aslImg[kind];
    const L = (m && m[t]) || [];
    box.dataset.done = "1";
    box.innerHTML = L.length ? L.map((u, i) => `<p class="muted" style="margin:4px 0">${i ? "Diario (120 días)" : "45' (90 velas)"}</p><img src="${u}" alt="${esc(t)}" style="width:100%;max-width:640px;border-radius:6px" loading="lazy">`).join("") : `<p class="muted">Gráfico todavía no generado (se actualiza cada 15–20 min).</p>`;
  } catch (e) { box.innerHTML = `<p class="muted">No pude cargar los gráficos.</p>`; }
}, true);
