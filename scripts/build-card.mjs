import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = process.env.PROFILE_USER || 'tunabirgun';
const OUT = process.env.OUT_DIR || join(ROOT, 'dist');
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USER}-profile-card`,
  ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
};

// GitHub dark (Primer) colours; white is the only accent.
const C = {
  bg: '#0d1117', bar: '#151b23', border: '#3d444d', inset: '#010409', ansiBlack: '#2f3742',
  gray: '#656c76', muted: '#9198a1', fg: '#f0f6fc', white: '#ffffff',
};
const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono','DejaVu Sans Mono',monospace`;

const BIRTH = '2001-12-28';
const TZ = 'Europe/Istanbul';

function uptime(from) {
  const [y0, m0, d0] = from.split('-').map(Number);
  const [y1, m1, d1] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()).split('-').map(Number);
  let [y, m, d] = [y1 - y0, m1 - m0, d1 - d0];
  if (d < 0) { m--; d += new Date(Date.UTC(y1, m1 - 1, 0)).getUTCDate(); }
  if (m < 0) { y--; m += 12; }
  const unit = (n, u) => `${n} ${u}${n === 1 ? '' : 's'}`;
  return `${unit(y, 'year')}, ${unit(m, 'month')}, ${unit(d, 'day')}`;
}

const NEOFETCH = [
  ['OS', 'Ubuntu, macOS, Windows, iOS'],
  ['Uptime', uptime(BIRTH)],
  ['Host', 'Istanbul, Türkiye'],
  ['Kernel', 'Research Assistant, Molecular Biology & Genetics'],
  ['IDE', 'OpenCode, Conductor, VS Code'],
  ['Edu', 'MSc Biotechnology (ITU) · BSc Bioengineering (Marmara)'],
  ['Labs', 'MayaLab (ITU) · BaysanLab (ITU) · GunayLab (IYYU)'],
];
const SPOKEN = ['Turkish', 'English'];
const FOCUS = [
  ['omics', 'bulk & single-cell transcriptomics, genomic variants, TEs, interactomes'],
  ['organisms', 'yeasts, filamentous fungi, crops'],
  ['software', 'reproducible, local-first scientific tools'],
  ['writing', 'epistemology, method of science'],
];
const CONTACT = [
  ['web', 'tunabirgun.com'],
  ['mail', 'tunabirgun@gmail.com'],
  ['orcid', '0009-0009-1827-7933'],
  ['in', 'tunabirgun'],
];

// Display label -> dependency names that indicate it. The label order breaks ties in repo counts.
const TOOLS = {
  bio: {
    Snakemake: ['snakemake'], DESeq2: ['deseq2'], 'limma/edgeR': ['limma', 'edger'], Seurat: ['seurat'],
    clusterProfiler: ['clusterprofiler'], STAR: ['star'], samtools: ['samtools'], STRINGdb: ['stringdb'],
    primer3: ['primer3-py'], pyHMMER: ['pyhmmer'],
  },
  data: {
    pandas: ['pandas'], NumPy: ['numpy'], ggplot2: ['ggplot2'], igraph: ['igraph'], 'scikit-learn': ['scikit-learn'],
    PyTorch: ['torch', 'pytorch'], tidyverse: ['dplyr', 'tidyr', 'readr'], Plotly: ['plotly'],
  },
  apps: {
    Tauri: ['tauri', '@tauri-apps/api'], 'Qt/PySide6': ['pyside6'], Svelte: ['svelte'], React: ['react'],
    Vite: ['vite'], FastAPI: ['fastapi'], WebLLM: ['@mlc-ai/web-llm'], 'Transformers.js': ['@huggingface/transformers'],
  },
  infra: {
    'GitHub Actions': ['github-actions'], conda: ['conda'], renv: ['renv'], Docker: ['docker'],
    pytest: ['pytest'], Vitest: ['vitest'], Playwright: ['@playwright/test'],
  },
};
const NOT_CODE = new Set(['HTML', 'CSS', 'SCSS', 'Inno Setup', 'Dockerfile', 'Jupyter Notebook', 'TeX', 'Makefile', 'CMake', 'Batchfile']);

const COLS = 96;
const CODE_MAX = 6; // languages shown, by byte count
const FONT = { size: 13, cw: 7.8, lh: 19 };
const PAD = { x: 24, top: 18, bottom: 22 };
const BAR = 38;
const TYPE = { start: 0.6, perChar: 0.06, pause: 0.35, stagger: 0.05, gap: 0.4, hold: 10 }; // seconds; the session loops
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(path, accept) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`https://api.github.com/${path}`, { headers: accept ? { ...HEADERS, Accept: accept } : HEADERS });
    if (res.status === 202) { await sleep(5000); continue; }
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return accept?.includes('raw') ? res.text() : res.json();
  }
  throw new Error(`GET ${path}: statistics still being computed`);
}

async function contributionsLastYear() {
  if (!TOKEN) return null;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      query: 'query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{totalContributions}}}}',
      variables: { u: USER },
    }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`GraphQL: ${JSON.stringify(body.errors ?? res.status)}`);
  return body.data.user.contributionsCollection.contributionCalendar.totalContributions;
}

const norm = (s) => s.toLowerCase().replace(/_/g, '-');

function dependencyNames(path, text) {
  const name = path.split('/').pop();
  const out = [];
  if (name === 'package.json') {
    const pkg = JSON.parse(text);
    out.push(...Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
  } else if (name === 'renv.lock') {
    out.push('renv', ...Object.keys(JSON.parse(text).Packages ?? {}));
  } else if (name === 'Cargo.toml') {
    out.push(...[...text.matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map((m) => m[1]));
  } else if (name === 'pyproject.toml' || name === 'setup.cfg') {
    out.push(...[...text.matchAll(/["'\s]([A-Za-z0-9][A-Za-z0-9_.-]*)\s*(?:\[[^\]]*\])?\s*(?:[<>=!~;]|["']|$)/gm)].map((m) => m[1]));
  } else if (/^requirements.*\.txt$/.test(name)) {
    out.push(...text.split('\n').map((l) => l.match(/^\s*([A-Za-z0-9][A-Za-z0-9_.-]*)/)?.[1]).filter(Boolean));
  } else if (/^environment.*\.ya?ml$/.test(name)) {
    out.push('conda');
    for (const m of text.matchAll(/^\s*-\s*([A-Za-z0-9][A-Za-z0-9_.-]*)/gm)) out.push(m[1].replace(/^(bioconductor|r)-/, ''));
  }
  return out.map(norm);
}

const fileMarkers = (path) =>
  [
    [/(^|\/)Snakefile$|\.smk$/, 'snakemake'],
    [/(^|\/)Dockerfile$/, 'docker'],
    [/^\.github\/workflows\/.+\.ya?ml$/, 'github-actions'],
  ].filter(([re]) => re.test(path)).map(([, n]) => n);

const MANIFEST = /(^|\/)(package\.json|pyproject\.toml|setup\.cfg|requirements[^/]*\.txt|environment[^/]*\.ya?ml|renv\.lock|Cargo\.toml)$/;

async function collect() {
  const user = await gh(`users/${USER}`);
  const repos = (await gh(`users/${USER}/repos?type=owner&per_page=100`)).filter((r) => !r.fork && !r.private);
  const languages = {};
  const toolRepos = new Map();
  const totals = { stars: 0, commits: 0, additions: 0, deletions: 0 };

  for (const repo of repos) {
    totals.stars += repo.stargazers_count;
    for (const [lang, bytes] of Object.entries((await gh(`repos/${USER}/${repo.name}/languages`)) ?? {})) {
      languages[lang] = (languages[lang] ?? 0) + bytes;
    }

    const tree = await gh(`repos/${USER}/${repo.name}/git/trees/${repo.default_branch}?recursive=1`);
    const paths = (tree?.tree ?? []).filter((e) => e.type === 'blob' && !/node_modules\//.test(e.path)).map((e) => e.path);
    const names = new Set(paths.flatMap(fileMarkers));
    for (const path of paths.filter((p) => MANIFEST.test(p))) {
      const text = await gh(`repos/${USER}/${repo.name}/contents/${encodeURI(path)}`, 'application/vnd.github.raw+json');
      for (const n of dependencyNames(path, text)) names.add(n);
    }
    for (const n of names) toolRepos.set(n, (toolRepos.get(n) ?? new Set()).add(repo.name));

    const me = ((await gh(`repos/${USER}/${repo.name}/stats/contributors`)) ?? []).find((c) => c.author?.login === USER);
    for (const w of me?.weeks ?? []) {
      totals.additions += w.a;
      totals.deletions += w.d;
      totals.commits += w.c;
    }
  }

  const tools = Object.fromEntries(
    Object.entries(TOOLS).map(([category, labels]) => [
      category,
      Object.entries(labels)
        .map(([label, deps], order) => ({ label, order, n: new Set(deps.flatMap((d) => [...(toolRepos.get(d) ?? [])])).size }))
        .filter((t) => t.n > 0)
        .sort((a, b) => b.n - a.n || a.order - b.order)
        .map((t) => t.label),
    ]),
  );
  const code = Object.entries(languages).filter(([l]) => !NOT_CODE.has(l)).sort((a, b) => b[1] - a[1]).map(([l]) => l);

  return {
    name: user.name ?? USER,
    repos: repos.length,
    followers: user.followers,
    contributions: await contributionsLastYear(),
    code,
    tools,
    ...totals,
  };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const len = (s) => [...s].length;
const fmt = (n) => n.toLocaleString('en-US');
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - len(s)));
const width = (segs) => segs.reduce((t, [s]) => t + len(s), 0);

const PROMPT = [[USER, 'w'], ['@github', 'm'], [':', 'g'], ['~', 'm'], ['$ ', 'w']];
const cmd = (text) => ({ kind: 'cmd', text });
const out = (...segs) => ({ kind: 'out', segs });
const BLANK = { kind: 'blank' };

// Items joined by a grey separator, keeping only as many as fit in `room` columns.
function list(items, sep, room) {
  const kept = [];
  for (const it of items) if (len([...kept, it].join(sep)) <= room) kept.push(it);
  return kept.flatMap((it, i) => (i ? [[sep, 'g'], [it, 'f']] : [[it, 'f']]));
}

function session(s) {
  const K = 11;
  const room = COLS - K;
  const rows = [cmd('neofetch'), out([`@${USER}`, 'w']), out(['─'.repeat(len(USER) + 1), 'g'])];
  for (const [k, v] of NEOFETCH) rows.push(out([pad(k, K), 'm'], [v, 'f']));
  rows.push(out([pad('Code', K), 'm'], ...list(s.code.slice(0, CODE_MAX), ' · ', room)));
  rows.push(out([pad('Spoken', K), 'm'], ...list(SPOKEN, ' · ', room)));
  rows.push({ kind: 'swatch', x: K });

  rows.push(BLANK, cmd('cat focus.txt'));
  for (const [k, v] of FOCUS) rows.push(out([pad(k, K), 'm'], [v, 'f']));

  rows.push(BLANK, cmd('ls ~/tools'));
  for (const [dir, labels] of Object.entries(s.tools)) {
    if (labels.length) rows.push(out([pad(`${dir}/`, 8), 'w'], ...list(labels, '  ', COLS - 8)));
  }

  rows.push(BLANK, cmd('gh stats --public'));
  const stat = [['repos', s.repos], ['stars', s.stars], ['followers', s.followers], ['commits', s.commits]];
  if (s.contributions !== null) stat.push(['contributions/yr', s.contributions]);
  rows.push(out(...stat.flatMap(([k, v], i) => [...(i ? [['  ·  ', 'g']] : []), [`${k} `, 'm'], [fmt(v), 'w']])));
  rows.push(out(['lines of code ', 'm'], [fmt(s.additions - s.deletions), 'w'], ['  (', 'g'], [`+${fmt(s.additions)}`, 'f'], [' / ', 'g'], [`-${fmt(s.deletions)}`, 'm'], [')', 'g']));

  rows.push(BLANK, cmd('cat contact.txt'));
  rows.push(out(...CONTACT.flatMap(([k, v], i) => [...(i ? [[' · ', 'g']] : []), [`${k} `, 'm'], [v, 'f']])));

  rows.push(BLANK, { kind: 'end' });
  return rows;
}

const spans = (segs) => segs.map(([s, c]) => `<tspan class="${c}">${esc(s)}</tspan>`).join('');
const text = (segs, col, y, attrs) =>
  `<text ${attrs} x="${(PAD.x + col * FONT.cw).toFixed(1)}" y="${y.toFixed(1)}" textLength="${(width(segs) * FONT.cw).toFixed(1)}" lengthAdjust="spacing">${spans(segs)}</text>`;
const pct = (t, T) => `${((t / T) * 100).toFixed(3)}%`;
const HIDDEN = 'clip-path:inset(0 100% 0 0)';
const SHOWN = 'clip-path:inset(0 0 0 0)';

// The session replays forever: lines appear, the screen holds, `clear` is typed, and it starts over.
function card(stats) {
  const rows = session(stats);
  const w = Math.ceil(PAD.x * 2 + COLS * FONT.cw);
  const h = Math.ceil(BAR + PAD.top + rows.length * FONT.lh + PAD.bottom);
  const y = (i) => BAR + PAD.top + (i + 0.78) * FONT.lh;
  const promptW = width(PROMPT);
  const items = []; // { svg(attrs) -> string, a, typing?: { n, dur }, startHidden? }
  const cursor = [{ t: 0, row: 0, col: 0 }];
  let t = TYPE.start;

  const typeCommand = (i, cmdText, hidden = false) => {
    const t0 = t + 0.15;
    const n = len(cmdText);
    const dur = n * TYPE.perChar;
    items.push({ make: (a) => text([[cmdText, 'w']], promptW, y(i), a), a: t0, typing: { n, dur }, startHidden: hidden });
    cursor.push({ t: t0, row: i, col: promptW, typing: n }, { t: t0 + dur, row: i, col: promptW + n });
    t = t0 + dur + TYPE.pause;
  };
  const showPrompt = (i) => {
    items.push({ make: (a) => text(PROMPT, 0, y(i), a), a: t });
    cursor.push({ t, row: i, col: promptW });
  };

  rows.forEach((row, i) => {
    if (row.kind === 'cmd') {
      if (i) t += TYPE.gap;
      showPrompt(i);
      typeCommand(i, row.text);
      cursor.push({ t, row: i + 1, col: 0 });
    } else if (row.kind === 'out') {
      items.push({ make: (a) => text(row.segs, 0, y(i), a), a: t });
      t += TYPE.stagger;
      cursor.push({ t, row: i + 1, col: 0 });
    } else if (row.kind === 'swatch') {
      const sw = [C.inset, C.bar, C.ansiBlack, C.border, C.gray, C.muted, C.fg, C.white];
      const top = y(i) - FONT.size * 0.82;
      const cells = sw.map((fill, k) => `<rect x="${(PAD.x + (row.x + k * 3) * FONT.cw).toFixed(1)}" y="${top.toFixed(1)}" width="${(3 * FONT.cw).toFixed(1)}" height="${FONT.size}" fill="${fill}"/>`).join('');
      items.push({ make: (a) => `<g ${a}>${cells}</g>`, a: t });
      t += TYPE.stagger;
      cursor.push({ t, row: i + 1, col: 0 });
    } else if (row.kind === 'end') {
      t += TYPE.gap;
      showPrompt(i);
      t += TYPE.hold;
      typeCommand(i, 'clear', true);
    }
  });
  const T = t;
  const finalRow = rows.length - 1;

  const css = [];
  const body = items.map((it, k) => {
    const name = `k${k}`;
    if (it.typing) {
      css.push(`@keyframes ${name}{0%{opacity:1;${HIDDEN}}${pct(it.a, T)}{opacity:1;${HIDDEN};animation-timing-function:steps(${it.typing.n},start)}${pct(it.a + it.typing.dur, T)}{opacity:1;${SHOWN}}100%{opacity:1;${SHOWN}}}`);
    } else {
      css.push(`@keyframes ${name}{0%{opacity:0}${pct(it.a, T)}{opacity:0;animation-timing-function:steps(1,start)}100%{opacity:1}}`);
    }
    return it.make(`class="an${it.startHidden ? ' rm' : ''}" style="animation-name:${name}"`);
  });

  const stops = new Map();
  for (const c of cursor) stops.set(c.t.toFixed(3), c);
  const curFrames = [...stops.values()].sort((a, b) => a.t - b.t).map((c) =>
    `${pct(c.t, T)}{transform:translate(${(c.col * FONT.cw).toFixed(1)}px,${(c.row * FONT.lh).toFixed(1)}px);animation-timing-function:${c.typing ? `steps(${c.typing},start)` : 'steps(1,end)'}}`);
  css.push(`@keyframes cur{${curFrames.join('')}100%{transform:translate(0px,0px)}}`);

  const title = `@${USER} — ~`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title" xml:space="preserve">
<title id="title">${esc(stats.name)} — terminal profile</title>
<style>
text{font-family:${MONO};font-size:${FONT.size}px;white-space:pre;font-variant-ligatures:none}
.w{fill:${C.white};font-weight:700}.f{fill:${C.fg}}.m{fill:${C.muted}}.g{fill:${C.gray}}
.an{animation-duration:${T.toFixed(2)}s;animation-timing-function:linear;animation-iteration-count:infinite}
.cur{animation:cur ${T.toFixed(2)}s linear infinite}.blink{animation:blink 1.1s steps(1,end) infinite}@keyframes blink{50%{opacity:0}}
${css.join('\n')}
@media (prefers-reduced-motion:reduce){.an,.cur,.blink{animation:none}.rm{opacity:0}}
</style>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
<path d="M0.5 ${BAR}V10.5a10 10 0 0 1 10-10h${w - 21}a10 10 0 0 1 10 10V${BAR}z" fill="${C.bar}"/>
<path d="M0.5 ${BAR}.5h${w - 1}" stroke="${C.border}"/>
${[0, 1, 2].map((k) => `<circle cx="${20 + k * 20}" cy="${BAR / 2}" r="6" fill="${C.border}"/>`).join('')}
<text x="${w / 2}" y="${BAR / 2 + 4}" text-anchor="middle" style="font-size:12px"><tspan class="f">@${USER}</tspan><tspan class="m">${esc(title.slice(len(USER) + 1))}</tspan></text>
${body.join('\n')}
<g class="blink"><rect class="cur" transform="translate(${(promptW * FONT.cw).toFixed(1)} ${(finalRow * FONT.lh).toFixed(1)})" x="${PAD.x}" y="${(y(0) - FONT.size * 0.82).toFixed(1)}" width="${FONT.cw.toFixed(1)}" height="${FONT.size}" fill="${C.fg}"/></g>
</svg>
`;
}

const stats = await collect();
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'card.svg'), card(stats));
console.log(JSON.stringify(stats, null, 1));
