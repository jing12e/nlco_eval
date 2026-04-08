/* =========================================================
   NLCO Benchmark Evaluation
   Modes:
   - model:    choose problems + models -> charts + table (by model, MEAN over selected problems)
   - problem:  choose problems + models -> charts + table (by problem, MEAN over selected models) [tall charts]
   - taxonomy: choose models + taxonomy (+ size) -> charts + table (by taxonomy category, MEAN over ALL problems)

   Fixes requested:
   - Remove best/worst selector; aggregation is ALWAYS mean
   - Pattern distribution excludes pattern key "OK"
   - Provide a pattern numeric list (table) with concrete values (pct)
   ========================================================= */

/* ---------------------------
   Utilities
   --------------------------- */
async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.json();
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : NaN;
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function mean(values) {
  const vs = values.filter(v => Number.isFinite(v));
  if (!vs.length) return NaN;
  return vs.reduce((a,b)=>a+b,0) / vs.length;
}

/* ---------------------------
   Model display name map
   --------------------------- */
const MODEL_NAME_MAP = {
  "qwen3-14b__no_reasoning": "Qwen3-14B",
  "ministral-14b-2512__no_reasoning": "Ministral-3-14B",
  "nemotron-3-nano-30b-a3b__no_reasoning": "Nemotron3-Nano-30B",
  "llama-4-maverick-17b-128e-instruct-maas__no_reasoning": "Llama-4-Maverick-Instruct",
  "qwen3-235b-a22b-instruct-2507-maas__no_reasoning": "Qwen3-235B-Instruct",
  "deepseek-chat__no_reasoning": "DeepSeek-V3.2",
  "mimo-v2-flash__no_reasoning": "MiMo-V2-Flash",

  "qwen3-14b": "Qwen3-14B (reasoning)",
  "nemotron-3-nano-30b-a3b": "Nemotron3-Nano-30B (reasoning)",
  "qwq-32b": "QwQ-32B (reasoning)",
  "deepseek-reasoner": "DeepSeek-V3.2 (reasoning)",

  "grok-4.1-fast": "Grok-4.1-Fast (reasoning)",
  "claude-sonnet-4-5": "Claude-Sonnet-4.5 (reasoning)",
  "o4-mini": "OpenAI o4-mini (reasoning)",
  "gpt-5.1": "OpenAI GPT-5.1 (reasoning)",
  "gemini-3-flash-preview": "Gemini-3-Flash (reasoning)",
};
function modelDisplayName(id) { return MODEL_NAME_MAP[id] || id; }

/* ---------------------------
   Taxonomy maps (taxonomy mode only)
   --------------------------- */
const PROBLEM_GROUP = new Map([
  ["TSP","GRAPH"], ["PCTSP","GRAPH"], ["OP","GRAPH"], ["CVRP","GRAPH"], ["TSPTW","GRAPH"],
  ["PDP","GRAPH"], ["MLP","GRAPH"], ["QSPP","GRAPH"], ["STP","GRAPH"], ["SFP","GRAPH"], ["KMST","GRAPH"],
  ["BPP","PACK"], ["CSP","PACK"], ["2SP","PACK"], ["JSP","PACK"], ["FSP","PACK"], ["OSP","PACK"],
  ["RCPSP","PACK"], ["PMS","PACK"], ["SMTWT","PACK"],
  ["MDS","COUNT"], ["SCP","COUNT"], ["SP","COUNT"], ["SPP","COUNT"], ["HSP","COUNT"], ["MkC","COUNT"],
  ["GAP","COUNT"], ["UFLP","COUNT"], ["CFLP","COUNT"], ["PMED","COUNT"], ["PCENTER","COUNT"],
  ["MIS","COUNT"], ["MVC","COUNT"], ["MCP","COUNT"], ["KP","COUNT"], ["MDP","COUNT"], ["QKP","COUNT"], ["MAXCUT","COUNT"],
  ["AP3","COMP"], ["QAP","COMP"], ["GCP","COMP"], ["CMP","COMP"], ["LOP","COMP"],
]);

const PROBLEM_VARSORT = new Map([
  ["TSP","Graph"], ["PCTSP","Graph"], ["OP","Graph"], ["CVRP","Graph"], ["TSPTW","Graph"], ["PDP","Graph"],
  ["MLP","Graph"], ["QSPP","Graph"], ["STP","Graph"], ["SFP","Graph"], ["KMST","Graph"],
  ["BPP","Int"], ["CSP","Int"], ["2SP","Int"], ["JSP","Int"], ["FSP","Int"], ["OSP","Int"], ["RCPSP","Int"], ["PMS","Int"], ["SMTWT","Int"],
  ["MDS","Set"], ["SCP","Set"], ["SP","Set"], ["SPP","Set"], ["HSP","Set"], ["MkC","Set"],
  ["GAP","Int"], ["UFLP","Int"], ["CFLP","Int"], ["PMED","Int"], ["PCENTER","Int"],
  ["MIS","Int"], ["MVC","Int"], ["MCP","Int"], ["KP","Int"], ["MDP","Int"], ["QKP","Int"], ["MAXCUT","Int"],
  ["AP3","Int"], ["QAP","Int"], ["GCP","Int"], ["CMP","Int"], ["LOP","Int"],
]);

const PROBLEM_OBJECTIVE = new Map([
  ["TSP","linear"], ["PCTSP","linear"], ["OP","linear"], ["CVRP","linear"], ["TSPTW","linear"], ["PDP","linear"], ["MLP","linear"],
  ["QSPP","quadratic"],
  ["STP","linear"], ["SFP","linear"], ["KMST","linear"],
  ["BPP","linear"], ["CSP","linear"],
  ["2SP","bottleneck"], ["JSP","bottleneck"], ["FSP","bottleneck"], ["OSP","bottleneck"], ["RCPSP","bottleneck"], ["PMS","bottleneck"],
  ["SMTWT","linear"],
  ["MDS","linear"], ["SCP","linear"], ["SP","linear"], ["SPP","linear"], ["HSP","linear"], ["MkC","linear"],
  ["GAP","linear"], ["UFLP","linear"], ["CFLP","linear"], ["PMED","linear"],
  ["PCENTER","bottleneck"],
  ["MIS","linear"], ["MVC","linear"], ["MCP","linear"], ["KP","linear"],
  ["MDP","quadratic"], ["QKP","quadratic"], ["MAXCUT","quadratic"],
  ["AP3","linear"], ["QAP","quadratic"], ["GCP","linear"], ["CMP","bottleneck"], ["LOP","linear"],
]);

function taxonomyKey(problem, taxonomy) {
  if (taxonomy === "group") return PROBLEM_GROUP.get(problem) || "—";
  if (taxonomy === "var_sort") return PROBLEM_VARSORT.get(problem) || "—";
  if (taxonomy === "objective") return PROBLEM_OBJECTIVE.get(problem) || "—";
  return "—";
}

/* ---------------------------
   DOM
   --------------------------- */
const $ = (id) => document.getElementById(id);

const el = {
  banner: $("statusBanner"),

  tabEval: $("tabEval"),
  btnReload: $("btnReload"),
  evSummaryChips: $("evSummaryChips"),
  evDataStats: $("evDataStats"),

  // Eval
  evSize: $("evSize"),
  evMode: $("evMode"),

  evProblemsBlock: $("evProblemsBlock"),
  evProblems: $("evProblems"),
  evProblemsSelectAll: $("evProblemsSelectAll"),
  evProblemsClear: $("evProblemsClear"),

  evModels: $("evModels"),
  evModelsSelectAll: $("evModelsSelectAll"),
  evModelsClear: $("evModelsClear"),

  evTaxonomyBlock: $("evTaxonomyBlock"),
  evTaxonomy: $("evTaxonomy"),

  evMetric: $("evMetric"),
  evResultsMeta: $("evResultsMeta"),

  evSvgBlock: $("evSvgBlock"),
  evSvgDivider: $("evSvgDivider"),

  evChartsBlock: $("evChartsBlock"),
  evMetricChartTitle: $("evMetricChartTitle"),
  evMetricCanvas: $("evMetricCanvas"),
  evPatternCanvas: $("evPatternCanvas"),
  evPatternLegend: $("evPatternLegend"), // optional (can exist)
  evPatternList: $("evPatternList"),     // NEW: numeric table container

  evTableWrap: $("evTableWrap"),
  evDebug: $("evDebug"),
};

/* ---------------------------
   Banner
   --------------------------- */
function showBanner(msg, kind = "warn") {
  el.banner.style.display = "block";
  el.banner.textContent = msg;
  el.banner.style.borderColor = kind === "danger" ? "#fecaca" : "#fed7aa";
  el.banner.style.background = kind === "danger" ? "#fef2f2" : "#fff7ed";
  el.banner.style.color = kind === "danger" ? "#991b1b" : "#7c2d12";
}
function hideBanner() {
  el.banner.style.display = "none";
  el.banner.textContent = "";
}

/* ---------------------------
   Tabs
   --------------------------- */
const state = {
  evalRows: [],

  // Eval state
  evSize: "S",
  evMode: "model",       // model | problem | taxonomy
  evProblems: [],        // model/problem modes
  evModels: [],          // all modes (taxonomy keeps)
  evTaxonomy: "group",   // taxonomy mode only
  evMetric: "acc",
};

/* =========================================================
   Evaluation: normalize + selectors
   ========================================================= */
function normalizeEvalRows(rawRows) {
  return (rawRows || []).map(r => ({
    problem: r.problem,
    model: r.model,
    size: String(r.size),
    AFR: num(r.AFR),
    ALOG: num(r.ALOG),
    acc: num(r["acc."]),
    tok: num(r["tok."]),
    pattern_counts: r.pattern_dist_counts || {},
    pattern_pct: r.pattern_dist_pct || {},
  })).filter(x => x.problem && x.model && x.size);
}

function getProblemsForSize(size) {
  const rows = state.evalRows.filter(r => r.size === String(size));
  return Array.from(new Set(rows.map(r => r.problem))).sort();
}
function getModelsForSize(size) {
  const rows = state.evalRows.filter(r => r.size === String(size));
  return Array.from(new Set(rows.map(r => r.model))).sort();
}

function renderDataStats() {
  const rows = state.evalRows.filter(r => r.size === String(state.evSize));
  const problems = new Set(rows.map(r => r.problem)).size;
  const models = new Set(rows.map(r => r.model)).size;

  el.evDataStats.innerHTML = [
    ["Problems", problems],
    ["Models", models],
  ].map(([label, value]) => `
    <div class="statCard">
      <div class="statCard__label">${esc(label)}</div>
      <div class="statCard__value">${esc(value)}</div>
    </div>
  `).join("");
}

function renderSummaryChips(selRows) {
  const chips = [];
  chips.push(["Size", state.evSize]);
  chips.push(["Mode", state.evMode]);
  if (state.evMode === "taxonomy") {
    chips.push(["Taxonomy", state.evTaxonomy]);
  } else {
    chips.push(["Problems", state.evProblems.length]);
  }
  chips.push(["Models", state.evModels.length]);

  el.evSummaryChips.innerHTML = chips.map(([label, value]) => `
    <span class="summaryChip"><b>${esc(label)}</b><span>${esc(value)}</span></span>
  `).join("");
}

function syncMultiSelect(selectEl, values) {
  for (const opt of selectEl.options) opt.selected = values.includes(opt.value);
}

function renderEvalSelectors() {
  const probs = getProblemsForSize(state.evSize);
  const models = getModelsForSize(state.evSize);

  // problems (not used in taxonomy mode)
  el.evProblems.innerHTML = probs.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  state.evProblems = (state.evProblems || []).filter(p => probs.includes(p));
  if (state.evProblems.length === 0 && probs.length) {
    state.evProblems = probs.slice(0, Math.min(10, probs.length));
  }
  for (const opt of el.evProblems.options) opt.selected = state.evProblems.includes(opt.value);

  // models
  el.evModels.innerHTML = models.map(m => `<option value="${esc(m)}">${esc(modelDisplayName(m))}</option>`).join("");
  state.evModels = (state.evModels || []).filter(m => models.includes(m));
  if (state.evModels.length === 0 && models.length) {
    state.evModels = models.slice(0, Math.min(10, models.length));
  }
  for (const opt of el.evModels.options) opt.selected = state.evModels.includes(opt.value);

  // blocks visibility
  const isTax = state.evMode === "taxonomy";
  el.evProblemsBlock.style.display = isTax ? "none" : "block";
  el.evTaxonomyBlock.style.display = isTax ? "block" : "none";

  // svg only taxonomy
  el.evSvgBlock.style.display = isTax ? "block" : "none";
  el.evSvgDivider.style.display = isTax ? "block" : "none";

  // charts in all three modes (你现在要每个 mode 都有图)
  // 如果你想 mode1 不要 pattern 图/只要 metric 图也可以再改
  el.evChartsBlock.style.display = "block";

  // tall charts only in problem mode
  const tall = state.evMode === "problem";
  el.evMetricCanvas.classList.toggle("canvasChart--tall", tall);
  el.evPatternCanvas.classList.toggle("canvasChart--tall", tall);

  renderDataStats();
  renderSummaryChips();
}

/* ---------------------------
   Metric helpers
   --------------------------- */
function metricBetterHigh(metric) {
  return (metric === "acc" || metric === "AFR");
}
function metricLabel(metric) {
  if (metric === "acc") return "Accuracy (acc.)";
  if (metric === "AFR") return "Feasible rate (AFR)";
  if (metric === "ALOG") return "ALOG";
  if (metric === "tok") return "tok.";
  return metric;
}
function formatMetric(key, v) {
  if (!Number.isFinite(v)) return "—";
  if (key === "acc") return (v * 100).toFixed(2) + "%";
  if (key === "AFR") return v.toFixed(2) + "%";
  if (key === "ALOG") return v.toFixed(4);
  if (key === "tok") return v.toFixed(1);
  return String(v);
}

/* =========================================================
   Pattern helpers (exclude OK)
   ========================================================= */
function collectPatternKeys(rows) {
  const set = new Set();
  for (const r of rows) {
    const pct = r.pattern_pct || {};
    const cnt = r.pattern_counts || {};
    Object.keys(pct).forEach(k => set.add(k));
    Object.keys(cnt).forEach(k => set.add(k));
  }
  set.delete("OK"); // exclude OK
  return Array.from(set).sort();
}

function pctMapOfRow(r) {
  let pct = r.pattern_pct || {};
  const cnt = r.pattern_counts || {};

  // fallback counts->pct
  if (Object.keys(pct).length === 0 && Object.keys(cnt).length > 0) {
    const total = Object.values(cnt).reduce((a,b)=>a + Number(b || 0), 0) || 0;
    pct = {};
    for (const k of Object.keys(cnt)) {
      pct[k] = total > 0 ? (Number(cnt[k]||0) / total * 100.0) : 0;
    }
  }

  // remove OK
  if (pct && typeof pct === "object") {
    const out = {};
    for (const [k,v] of Object.entries(pct)) {
      if (k === "OK") continue;
      out[k] = Number(v ?? 0);
    }
    return out;
  }
  return {};
}

/* =========================================================
   Selection rows
   ========================================================= */
function selectionRowsFor(size, problems, models) {
  const rows = state.evalRows.filter(r => r.size === String(size));
  const probSet = new Set(problems || []);
  const modelSet = new Set(models || []);
  return rows.filter(r => probSet.has(r.problem) && modelSet.has(r.model));
}

function selectionRowsForTaxonomy(size, models) {
  // taxonomy mode uses ALL problems for that size + selected models
  const rows = state.evalRows.filter(r => r.size === String(size));
  const modelSet = new Set(models || []);
  return rows.filter(r => modelSet.has(r.model));
}

/* =========================================================
   Canvas drawing
   ========================================================= */
function prepareCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

const palette = [
  "#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#db2777", "#64748b", "#84cc16", "#0ea5e9",
];

function drawAxes(ctx, x0, y0, x1, y1) {
  ctx.strokeStyle = "#e5e7ef";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();
}

function drawText(ctx, text, x, y, align="left", color="#0f172a", font="14px system-ui") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

/* =========================================================
   Aggregation core (mean only)
   - returns:
     { items: [{label, metricValue, patternPctMap}], keys }
   ========================================================= */

/**
 * Aggregate patterns across a list of rows:
 * - mean of pct per pattern key (after OK removed)
 */
function meanPatternPct(rows, keys) {
  if (!rows.length) return Object.fromEntries(keys.map(k => [k, 0]));
  const sums = Object.fromEntries(keys.map(k => [k, 0]));
  let c = 0;
  for (const r of rows) {
    const pm = pctMapOfRow(r);
    keys.forEach(k => { sums[k] += Number(pm[k] ?? 0); });
    c += 1;
  }
  const out = {};
  keys.forEach(k => out[k] = c ? (sums[k] / c) : 0);
  return out;
}

/**
 * Mode1: label=model, aggregate across problems (mean over selected problems)
 * Steps:
 * - per (model,problem): take the metric (single row) and pattern pct (single row)
 * - per model: mean across its problems
 */
function aggregateByModel(selRows, metricKey) {
  const keys = collectPatternKeys(selRows);

  // group (model -> problem -> rows)
  const byModelProb = new Map();
  for (const r of selRows) {
    const k = `${r.model}||${r.problem}`;
    if (!byModelProb.has(k)) byModelProb.set(k, []);
    byModelProb.get(k).push(r);
  }

  // per model, collect per-problem aggregated metric/pattern then mean across problems
  const modelSet = new Set(selRows.map(r => r.model));
  const items = Array.from(modelSet).map(model => {
    const probs = Array.from(new Set(selRows.filter(r => r.model === model).map(r => r.problem)));
    const probMetricVals = [];
    const probPatternMaps = [];

    for (const p of probs) {
      const list = byModelProb.get(`${model}||${p}`) || [];
      // normally list has length 1
      probMetricVals.push(mean(list.map(x => x[metricKey])));

      // pattern: mean across possible duplicates
      probPatternMaps.push(meanPatternPct(list, keys));
    }

    const metricValue = mean(probMetricVals);

    // mean pattern across problems
    const sums = Object.fromEntries(keys.map(k => [k, 0]));
    let c = 0;
    for (const pm of probPatternMaps) {
      keys.forEach(k => { sums[k] += Number(pm[k] ?? 0); });
      c += 1;
    }
    const patternPctMap = {};
    keys.forEach(k => patternPctMap[k] = c ? sums[k] / c : 0);

    return {
      label: modelDisplayName(model),
      rawId: model,
      metricValue,
      patternPctMap,
      count: probs.length,
    };
  });

  // sort by metric
  const highBetter = metricBetterHigh(metricKey);
  items.sort((a,b) => {
    const va=a.metricValue, vb=b.metricValue;
    if (!Number.isFinite(va) && !Number.isFinite(vb)) return a.label.localeCompare(b.label);
    if (!Number.isFinite(va)) return 1;
    if (!Number.isFinite(vb)) return -1;
    return highBetter ? (vb-va) : (va-vb);
  });

  return { items, keys };
}

/**
 * Mode2: label=problem, aggregate across models (mean over selected models)
 */
function aggregateByProblem(selRows, metricKey) {
  const keys = collectPatternKeys(selRows);

  const byProb = new Map();
  for (const r of selRows) {
    if (!byProb.has(r.problem)) byProb.set(r.problem, []);
    byProb.get(r.problem).push(r);
  }

  const items = Array.from(byProb.entries()).map(([problem, list]) => {
    const metricValue = mean(list.map(x => x[metricKey]));
    const patternPctMap = meanPatternPct(list, keys);
    return { label: problem, rawId: problem, metricValue, patternPctMap, count: list.length };
  });

  const highBetter = metricBetterHigh(metricKey);
  items.sort((a,b) => {
    const va=a.metricValue, vb=b.metricValue;
    if (!Number.isFinite(va) && !Number.isFinite(vb)) return a.label.localeCompare(b.label);
    if (!Number.isFinite(va)) return 1;
    if (!Number.isFinite(vb)) return -1;
    return highBetter ? (vb-va) : (va-vb);
  });

  return { items, keys };
}

/**
 * Mode3: label=taxonomy category, aggregate across problems + models (mean)
 * Pipeline:
 * - category -> rows
 * - metric mean over all rows in category
 * - pattern mean over all rows in category
 */
function aggregateByTaxonomy(selRows, metricKey, taxonomy) {
  const keys = collectPatternKeys(selRows);

  const byCat = new Map();
  for (const r of selRows) {
    const cat = taxonomyKey(r.problem, taxonomy);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(r);
  }

  const items = Array.from(byCat.entries()).map(([cat, list]) => {
    const metricValue = mean(list.map(x => x[metricKey]));
    const patternPctMap = meanPatternPct(list, keys);
    return { label: cat, rawId: cat, metricValue, patternPctMap, count: list.length };
  });

  const highBetter = metricBetterHigh(metricKey);
  items.sort((a,b) => {
    const va=a.metricValue, vb=b.metricValue;
    if (!Number.isFinite(va) && !Number.isFinite(vb)) return a.label.localeCompare(b.label);
    if (!Number.isFinite(va)) return 1;
    if (!Number.isFinite(vb)) return -1;
    return highBetter ? (vb-va) : (va-vb);
  });

  return { items, keys };
}

/* =========================================================
   Charts rendering (horizontal bars)
   ========================================================= */
function renderMetricChart(items, metricKey, opts = {}) {
  const { ctx, w, h } = prepareCanvas(el.evMetricCanvas);
  ctx.clearRect(0, 0, w, h);

  const title = opts.title || `${metricLabel(metricKey)}`;
  el.evMetricChartTitle.textContent = title;

  if (!items.length) {
    drawText(ctx, "No data.", 10, 20, "left", "#5b6478");
    return;
  }

  const vals = items.map(x => x.metricValue).filter(v => Number.isFinite(v));
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals) : 1;
  const span = (maxV - minV) || 1;

  const padL = opts.padL ?? 160;
  const padR = 70, padT = 18, padB = 26;
  const x0=padL, y0=padT, x1=w-padR, y1=h-padB;
  drawAxes(ctx, x0,y0,x1,y1);

  const band = (y1-y0) / items.length;

  items.forEach((it, i) => {
    const yMid = y0 + band*i + band*0.5;
    drawText(ctx, it.label, x0-8, yMid, "right", "#0f172a", "12px system-ui");

    if (!Number.isFinite(it.metricValue)) {
      drawText(ctx, "—", x1-4, yMid, "right", "#5b6478");
      return;
    }
    const ratio = clamp((it.metricValue - minV)/span, 0, 1);
    const barW = (x1-x0)*ratio;

    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(x0, yMid-band*0.28, barW, band*0.56);

    drawText(
      ctx,
      formatMetric(metricKey, it.metricValue),
      x1 + padR / 2,
      yMid,
      "center",
      "#5b6478",
      "12px system-ui"
     );
  });
}

function renderPatternStacked(items, keys, opts = {}) {
  const { ctx, w, h } = prepareCanvas(el.evPatternCanvas);
  ctx.clearRect(0, 0, w, h);

  if (!items.length) {
    drawText(ctx, "No data.", 10, 20, "left", "#5b6478");
    renderPatternLegendValues([], [], "");
    return;
  }

  if (!keys.length) {
    drawText(ctx, "No pattern distribution.", 10, 20, "left", "#5b6478");
    renderPatternLegendValues([], [], "");
    return;
  }

  const padL = opts.padL ?? 160;
  const padR = 18, padT = 18, padB = 18;
  const x0=padL, y0=padT, x1=w-padR, y1=h-padB;
  drawAxes(ctx, x0,y0,x1,y1);

  const band = (y1-y0) / items.length;

  items.forEach((it, i) => {
    const yMid = y0 + band*i + band*0.5;
    drawText(ctx, it.label, x0-8, yMid, "right", "#0f172a", "12px system-ui");

    let x = x0;
    keys.forEach((k, j) => {
      const p = Number(it.patternPctMap[k] ?? 0);
      const segW = (x1-x0) * clamp(p/50.0, 0, 1);
      if (segW > 0.2) {
        ctx.fillStyle = palette[j % palette.length];
        ctx.fillRect(x, yMid-band*0.28, segW, band*0.56);
      }
      x += segW;
    });
  });

  // render numeric list under pattern chart
  renderPatternLegendValues(items, keys, opts.rowLabel || "label");
}

/* =========================================================
   Pattern legend list with numeric values
   - shows a table:
     row label | pattern1% | pattern2% | ...
   ========================================================= */
function renderPatternLegendValues(items, keys, rowLabelName) {
  if (!el.evPatternList) return;

  if (!items.length || !keys.length) {
    el.evPatternList.innerHTML = `<div class="muted small">No pattern data.</div>`;
    return;
  }

  // limit columns if too many patterns (still show all, but wide scroll)
  const th = [
    `<th>${esc(rowLabelName)}</th>`,
    ...keys.map((k, i) => `<th><span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="width:10px;height:10px;border-radius:3px;background:${palette[i % palette.length]};display:inline-block;"></span>
        ${esc(k)}
      </span></th>`)
  ].join("");

  const body = items.map(it => {
    const tds = [
      `<td class="tdWrap"><b>${esc(it.label)}</b></td>`,
      ...keys.map(k => {
        const v = Number(it.patternPctMap[k] ?? 0);
        return `<td>${Number.isFinite(v) ? v.toFixed(2) + "%" : "—"}</td>`;
      })
    ].join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  el.evPatternList.innerHTML = `
    <div class="muted small" style="margin:6px 0 8px;">Pattern distribution </div>
    <div class="tableWrap" style="max-height:260px;">
      <table class="table" aria-label="Pattern distribution values">
        <thead><tr>${th}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

/* =========================================================
   Result table rendering (consistent with charts)
   - Mode1: one row per model
   - Mode2: one row per problem
   - Mode3: one row per taxonomy category
   ========================================================= */
function renderResultsTable(items, metricKey, modeLabel) {
  if (!items.length) {
    el.evTableWrap.innerHTML = `<div class="muted">No data.</div>`;
    return;
  }

  const headers = [modeLabel, metricLabel(metricKey), "AFR", "ALOG", "tok."];
  const th = headers.map(h => `<th>${esc(h)}</th>`).join("");

  // For the extra metrics (AFR/ALOG/tok), we don't have them in items yet.
  // We'll recompute them from the underlying selection rows using a closure set on state.lastSelRows + aggregator type.
  // To keep everything consistent, we store last aggregation "detail map" in state at renderEvaluation().
  const detailMap = state._detailMap || new Map();

  const body = items.map(it => {
    const det = detailMap.get(it.rawId) || {};
    return `<tr>
      <td class="tdWrap"><b>${esc(it.label)}</b></td>
      <td>${Number.isFinite(it.metricValue) ? formatMetric(metricKey, it.metricValue) : "—"}</td>
      <td>${Number.isFinite(det.AFR) ? det.AFR.toFixed(2) + "%" : "—"}</td>
      <td>${Number.isFinite(det.ALOG) ? det.ALOG.toFixed(4) : "—"}</td>
      <td>${Number.isFinite(det.tok) ? det.tok.toFixed(1) : "—"}</td>
    </tr>`;
  }).join("");

  el.evTableWrap.innerHTML = `
    <table class="table" aria-label="Evaluation results (aggregated)">
      <thead><tr>${th}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

/* =========================================================
   Build detail map for extra metrics (AFR/ALOG/tok) with mean
   - For each aggregated item rawId, compute mean of AFR/ALOG/tok from the contributing rows
   ========================================================= */
function buildDetailMap_Model(selRows) {
  const map = new Map(); // rawId(model) -> {AFR,ALOG,tok}
  const byModelProb = new Map();
  for (const r of selRows) {
    const k = `${r.model}||${r.problem}`;
    if (!byModelProb.has(k)) byModelProb.set(k, []);
    byModelProb.get(k).push(r);
  }

  const modelSet = new Set(selRows.map(r => r.model));
  for (const model of modelSet) {
    const probs = Array.from(new Set(selRows.filter(r => r.model === model).map(r => r.problem)));
    const afrVals = [];
    const alogVals = [];
    const tokVals = [];
    for (const p of probs) {
      const list = byModelProb.get(`${model}||${p}`) || [];
      afrVals.push(mean(list.map(x => x.AFR)));
      alogVals.push(mean(list.map(x => x.ALOG)));
      tokVals.push(mean(list.map(x => x.tok)));
    }
    map.set(model, { AFR: mean(afrVals), ALOG: mean(alogVals), tok: mean(tokVals) });
  }
  return map;
}

function buildDetailMap_Problem(selRows) {
  const map = new Map(); // problem -> {AFR,ALOG,tok}
  const byProb = new Map();
  for (const r of selRows) {
    if (!byProb.has(r.problem)) byProb.set(r.problem, []);
    byProb.get(r.problem).push(r);
  }
  for (const [p, list] of byProb.entries()) {
    map.set(p, { AFR: mean(list.map(x => x.AFR)), ALOG: mean(list.map(x => x.ALOG)), tok: mean(list.map(x => x.tok)) });
  }
  return map;
}

function buildDetailMap_Taxonomy(selRows, taxonomy) {
  const map = new Map(); // cat -> {AFR,ALOG,tok}
  const byCat = new Map();
  for (const r of selRows) {
    const cat = taxonomyKey(r.problem, taxonomy);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(r);
  }
  for (const [cat, list] of byCat.entries()) {
    map.set(cat, { AFR: mean(list.map(x => x.AFR)), ALOG: mean(list.map(x => x.ALOG)), tok: mean(list.map(x => x.tok)) });
  }
  return map;
}

/* =========================================================
   Evaluation main render
   ========================================================= */
function renderEvaluation() {
  let selRows = [];
  if (state.evMode === "taxonomy") {
    selRows = selectionRowsForTaxonomy(state.evSize, state.evModels);
  } else {
    selRows = selectionRowsFor(state.evSize, state.evProblems, state.evModels);
  }


  const metricKey = state.evMetric;

  // handle empty selections
  if (!selRows.length) {
    el.evResultsMeta.textContent = `No data for current selection.`;
    renderSummaryChips(selRows);
    el.evTableWrap.innerHTML = `<div class="muted">No data.</div>`;
    if (el.evPatternList) el.evPatternList.innerHTML = `<div class="muted small">No pattern data.</div>`;
    const { ctx: mctx, w: mw, h: mh } = prepareCanvas(el.evMetricCanvas);
    mctx.clearRect(0,0,mw,mh);
    drawText(mctx, "No data.", 10, 20, "left", "#5b6478");
    const { ctx: pctx, w: pw, h: ph } = prepareCanvas(el.evPatternCanvas);
    pctx.clearRect(0,0,pw,ph);
    drawText(pctx, "No data.", 10, 20, "left", "#5b6478");
    return;
  }

  // mode-specific aggregation
  if (state.evMode === "model") {
    // by model, mean across problems
    const { items, keys } = aggregateByModel(selRows, metricKey);
    state._detailMap = buildDetailMap_Model(selRows);

    el.evResultsMeta.textContent =
      `Size=${state.evSize} · Problems=${state.evProblems.length} · Models=${state.evModels.length}`;
    renderSummaryChips(selRows);

    renderMetricChart(items, metricKey, { title: `${metricLabel(metricKey)} by model (mean)`, padL: 220 });
    renderPatternStacked(items, keys, { padL: 220, rowLabel: "model" });
    renderResultsTable(items, metricKey, "model");
    return;
  }

  if (state.evMode === "problem") {
    // by problem, mean across models
    const { items, keys } = aggregateByProblem(selRows, metricKey);
    state._detailMap = buildDetailMap_Problem(selRows);

    el.evResultsMeta.textContent =
      `Size=${state.evSize} · Problems=${state.evProblems.length} · Models=${state.evModels.length}`;
    renderSummaryChips(selRows);

    // problem names are short => small left pad
    renderMetricChart(items, metricKey, { title: `${metricLabel(metricKey)} across problems (mean)`, padL: 120 });
    renderPatternStacked(items, keys, { padL: 120, rowLabel: "problem" });
    renderResultsTable(items, metricKey, "problem");
    return;
  }

  // taxonomy
  const tax = state.evTaxonomy;
  const { items, keys } = aggregateByTaxonomy(selRows, metricKey, tax);
  state._detailMap = buildDetailMap_Taxonomy(selRows, tax);

  el.evResultsMeta.textContent =
    `Size=${state.evSize} · Models=${state.evModels.length} · Taxonomy=${tax}`;
  renderSummaryChips(selRows);

  renderMetricChart(items, metricKey, { title: `${metricLabel(metricKey)} by ${tax} (mean)`, padL: 130 });
  renderPatternStacked(items, keys, { padL: 130, rowLabel: "category" });
  renderResultsTable(items, metricKey, "category");
}

/* =========================================================
   Initialization (load data + render)
   ========================================================= */
async function loadAll() {
  hideBanner();
  const evalSummary = await fetchJson("./data/eval_summary.json");
  state.evalRows = normalizeEvalRows(evalSummary.rows || []);
}

function renderAll() {
  renderEvalSelectors();
  renderEvaluation();
}

function attachEvents() {
  // Reload
  el.btnReload.addEventListener("click", async () => {
    try { await bootstrap(); }
    catch (e) { showBanner(String(e?.message || e), "danger"); }
  });

  // Eval controls
  el.evSize.addEventListener("change", () => {
    state.evSize = el.evSize.value;
    renderEvalSelectors();
    renderEvaluation();
  });

  el.evMode.addEventListener("change", () => {
    state.evMode = el.evMode.value;
    renderEvalSelectors();
    renderEvaluation();
  });

  el.evProblems.addEventListener("change", () => {
    state.evProblems = Array.from(el.evProblems.selectedOptions).map(o => o.value);
    renderEvaluation();
  });
  el.evProblemsSelectAll.addEventListener("click", () => {
    state.evProblems = getProblemsForSize(state.evSize);
    syncMultiSelect(el.evProblems, state.evProblems);
    renderEvaluation();
  });
  el.evProblemsClear.addEventListener("click", () => {
    state.evProblems = [];
    syncMultiSelect(el.evProblems, state.evProblems);
    renderEvaluation();
  });

  el.evModels.addEventListener("change", () => {
    state.evModels = Array.from(el.evModels.selectedOptions).map(o => o.value);
    renderEvaluation();
  });
  el.evModelsSelectAll.addEventListener("click", () => {
    state.evModels = getModelsForSize(state.evSize);
    syncMultiSelect(el.evModels, state.evModels);
    renderEvaluation();
  });
  el.evModelsClear.addEventListener("click", () => {
    state.evModels = [];
    syncMultiSelect(el.evModels, state.evModels);
    renderEvaluation();
  });

  el.evTaxonomy.addEventListener("change", () => {
    state.evTaxonomy = el.evTaxonomy.value;
    renderEvaluation();
  });

  el.evMetric.addEventListener("change", () => {
    state.evMetric = el.evMetric.value;
    renderEvaluation();
  });

  // Re-render canvas on resize
  window.addEventListener("resize", () => {
    renderEvaluation();
  });
}

async function bootstrap() {
  try {
    await loadAll();

    // init from DOM
    state.evSize = el.evSize.value || "S";
    state.evMode = el.evMode.value || "model";
    state.evTaxonomy = el.evTaxonomy?.value || "group";
    state.evMetric = el.evMetric.value || "acc";

    renderAll();
  } catch (e) {
    showBanner(String(e?.message || e), "danger");
  }
}

attachEvents();
bootstrap();
