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

const THEMES = {
  dark: { bg: '#0a0a0a', fg: '#e5e5e5', bright: '#fafafa', muted: '#a3a3a3', faint: '#8a8a8a', line: '#262626', strong: '#404040' },
  light: { bg: '#faf9f7', fg: '#2a2a2a', bright: '#0a0a0a', muted: '#595959', faint: '#6b6b6b', line: '#e3e3e3', strong: '#cfcfcf' },
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

const PROFILE = [
  ['OS', 'Ubuntu, macOS, Windows, iOS'],
  ['Uptime', uptime(BIRTH)],
  ['Host', 'Istanbul, Türkiye'],
  ['Kernel', 'Research Assistant, Mol. Bio. & Genetics'],
  ['IDE', 'OpenCode, Conductor, VS Code'],
  ['Edu', 'MSc Biotech., ITU · BSc Bioeng., Marmara'],
  ['Labs', 'MayaLab (ITU), BaysanLab (ITU), GunayLab (IYYU)'],
  null,
  ['Focus.Omics', 'bulk & single-cell transcriptomics'],
  ['Focus.Genomics', 'variants, TEs, interactomes'],
  ['Focus.Organisms', 'yeasts, filamentous fungi, crops'],
  ['Focus.Software', 'reproducible, local-first tools'],
  ['Writing', 'epistemology, method of science'],
];
const CONTACT = [
  ['Web', 'tunabirgun.com'],
  ['Email', 'tunabirgun@gmail.com'],
  ['ORCID', '0009-0009-1827-7933'],
  ['LinkedIn', 'tunabirgun'],
];
const SPOKEN = 'Turkish, English';

// Display label -> dependency names that indicate it. The label order breaks ties in repo counts.
const TOOLS = {
  'Tools.Bio': {
    Snakemake: ['snakemake'], DESeq2: ['deseq2'], 'limma/edgeR': ['limma', 'edger'], Seurat: ['seurat'],
    clusterProfiler: ['clusterprofiler'], STAR: ['star'], samtools: ['samtools'], STRINGdb: ['stringdb'],
    primer3: ['primer3-py'], pyHMMER: ['pyhmmer'],
  },
  'Tools.Data': {
    pandas: ['pandas'], NumPy: ['numpy'], ggplot2: ['ggplot2'], igraph: ['igraph'], 'scikit-learn': ['scikit-learn'],
    PyTorch: ['torch', 'pytorch'], tidyverse: ['dplyr', 'tidyr', 'readr'], Plotly: ['plotly'],
  },
  'Tools.Apps': {
    Tauri: ['tauri', '@tauri-apps/api'], 'Qt/PySide6': ['pyside6'], Svelte: ['svelte'], React: ['react'],
    Vite: ['vite'], FastAPI: ['fastapi'], WebLLM: ['@mlc-ai/web-llm'], 'Transformers.js': ['@huggingface/transformers'],
  },
  'Tools.Infra': {
    'GitHub Actions': ['github-actions'], conda: ['conda'], renv: ['renv'], Docker: ['docker'],
    pytest: ['pytest'], Vitest: ['vitest'], Playwright: ['@playwright/test'],
  },
};
const NOT_CODE = new Set(['HTML', 'CSS', 'SCSS', 'Inno Setup', 'Dockerfile', 'Jupyter Notebook', 'TeX', 'Makefile', 'CMake', 'Batchfile']);

const INFO_COLS = 60;
const PORTRAIT = { size: 10, cw: 6, lh: 11.2 };
const INFO = { size: 13, cw: 7.8, lh: 16 };
const PAD = 28;
const GAP = 32;
const FRAMES = 50;
const TICKS_PER_FRAME = 2; // the site advances one tick per 120 ms; 100 ticks per cycle
const CYCLE_S = 12;
const TYPE = { start: 0.3, stagger: 0.08, dur: 0.5 }; // one-time boot: each info line types in

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

// Frame logic copied from the <ascii-portrait> element on tunabirgun.com.
const SUB = { '@': '%#', '%': '#*', '#': '*+', '*': '+', '+': '*' };
function portraitFrame(lines, tick) {
  const o = (tick * Math.PI) / 50;
  return lines.map((c, a) =>
    [...c].map((l, i) => {
      const u = Math.sin(i * 0.13 + a * 0.19 - o);
      const face = a >= 16 && a <= 30 && i >= 24 && i <= 48;
      const edge = !c[i - 1]?.trim() || !c[i + 1]?.trim();
      if (face || edge || !SUB[l] || u <= 0.3) return l;
      const p = SUB[l];
      return p[u > 0.8 ? p.length - 1 : 0];
    }).join(''),
  );
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const len = (s) => [...s].length;
const fmt = (n) => n.toLocaleString('en-US');

// A line is a list of [text, class] segments.
const kv = (key, value, cols = INFO_COLS, lead = '. ') => {
  const dots = Math.max(2, cols - len(lead) - len(key) - 3 - len(value));
  return [[lead, 'p'], [key, 'k'], [': ', 'p'], ['.'.repeat(dots), 'd'], [' ', 'p'], [value, 'v']];
};
const header = (text) => [[text, 'h'], [' ' + '─'.repeat(INFO_COLS - len(text) - 1), 'd']];
const blank = () => [['.', 'p']];
const fitList = (items, key) => {
  const room = INFO_COLS - len(key) - 9;
  const out = [];
  for (const item of items) if (len([...out, item].join(', ')) <= room) out.push(item);
  return out.join(', ');
};

function infoLines(s) {
  const lines = [header(`@${USER}`)];
  for (const row of PROFILE) lines.push(row ? kv(...row) : blank());
  lines.push(kv('Languages.Code', fitList(s.code, 'Languages.Code')));
  lines.push(kv('Languages.Real', SPOKEN));
  for (const [category, labels] of Object.entries(s.tools)) if (labels.length) lines.push(kv(category, fitList(labels, category)));
  lines.push(blank(), header('- Contact'));
  for (const row of CONTACT) lines.push(kv(...row));
  lines.push(blank(), header('- Open source, open notebook'));
  const half = (INFO_COLS - 3) / 2;
  lines.push([...kv('Repos', fmt(s.repos), Math.floor(half)), [' | ', 'p'], ...kv('Stars', fmt(s.stars), Math.ceil(half), '')]);
  if (s.contributions !== null) {
    lines.push([...kv('Commits', fmt(s.commits), Math.floor(half)), [' | ', 'p'], ...kv('Followers', fmt(s.followers), Math.ceil(half), '')]);
    lines.push(kv('Contributions (last year)', fmt(s.contributions)));
  } else {
    lines.push([...kv('Commits', fmt(s.commits), Math.floor(half)), [' | ', 'p'], ...kv('Followers', fmt(s.followers), Math.ceil(half), '')]);
  }
  const delta = ` ( ${fmt(s.additions)}++, ${fmt(s.deletions)}-- )`;
  const loc = kv('Lines of Code', fmt(s.additions - s.deletions), INFO_COLS - len(delta));
  lines.push([...loc, [delta, 'p']]);
  return lines;
}

function textLine(segments, x, y, cw, cls, style = '') {
  const n = segments.reduce((t, [s]) => t + len(s), 0);
  const body = segments.map(([s, c]) => `<tspan class="${c}">${esc(s)}</tspan>`).join('');
  return `<text class="${cls}"${style && ` style="${style}"`} x="${x}" y="${y.toFixed(1)}" textLength="${(n * cw).toFixed(1)}" lengthAdjust="spacing">${body}</text>`;
}

function card(stats, theme) {
  const t = THEMES[theme];
  const raw = readFileSync(join(ROOT, 'scripts', 'portrait.txt'), 'utf8').split('\n');
  const frames = Array.from({ length: FRAMES }, (_, k) => portraitFrame(raw, k * TICKS_PER_FRAME));
  const rows = raw.map((_, r) => r).filter((r) => raw[r].trim());
  const dynamic = new Set(rows.filter((r) => frames.some((f) => f[r] !== raw[r])));

  const info = infoLines(stats);
  const portraitW = raw[0].length * PORTRAIT.cw;
  const portraitH = rows.length * PORTRAIT.lh;
  const infoH = (info.length + 2) * INFO.lh;
  const height = Math.ceil(PAD * 2 + Math.max(portraitH, infoH));
  const infoX = PAD + portraitW + GAP;
  const width = Math.ceil(infoX + INFO_COLS * INFO.cw + PAD);
  const top = (height - portraitH) / 2;
  const py = (r) => top + (rows.indexOf(r) + 0.8) * PORTRAIT.lh;
  const prow = (line, r) => textLine([[line, 'a']], PAD, py(r), PORTRAIT.cw, 'a');

  const still = rows.filter((r) => !dynamic.has(r)).map((r) => prow(raw[r], r)).join('');
  const original = [...dynamic].map((r) => prow(raw[r], r)).join('');
  const animated = frames
    .map((f, k) => `<g class="fr" style="animation-delay:-${(((FRAMES - k) * CYCLE_S) / FRAMES).toFixed(2)}s">${[...dynamic].map((r) => prow(f[r], r)).join('')}</g>`)
    .join('');

  const infoTop = (height - infoH) / 2;
  const iy = (i) => infoTop + (i + 0.8) * INFO.lh;
  const typed = (i, n) => `animation-duration:${TYPE.dur}s;animation-delay:${(TYPE.start + i * TYPE.stagger).toFixed(2)}s;animation-timing-function:steps(${Math.max(1, n)},end)`;
  const infoSvg = info.map((l, i) => textLine(l, infoX.toFixed(1), iy(i), INFO.cw, 'i ty', typed(i, l.reduce((t, [x]) => t + len(x), 0)))).join('');
  const bootDone = TYPE.start + info.length * TYPE.stagger + TYPE.dur;
  const promptY = iy(info.length + 1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title" xml:space="preserve">
<title id="title">${esc(stats.title)}</title>
<style>
text{font-family:${MONO};white-space:pre;font-variant-ligatures:none}
.a{font-size:${PORTRAIT.size}px;fill:${t.fg}}
.i{font-size:${INFO.size}px}
.h{fill:${t.bright};font-weight:700}.k{fill:${t.bright};font-weight:600}.v{fill:${t.fg}}.p{fill:${t.muted}}.d{fill:${t.faint}}
.fr{opacity:0;animation:fr ${CYCLE_S}s steps(1,end) infinite}.orig{animation:hide 1s infinite}@keyframes hide{from,to{opacity:0}}
@keyframes fr{0%{opacity:1}${(100 / FRAMES).toFixed(3)}%{opacity:0}100%{opacity:0}}
.ty{animation-name:type;animation-fill-mode:both}@keyframes type{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.cur{animation:blink 1.2s steps(1,end) ${bootDone.toFixed(2)}s infinite both}@keyframes blink{0%{opacity:0}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.fr,.orig,.ty,.cur{animation:none}}
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${t.bg}" stroke="${t.line}"/>
<g>${still}</g><g class="orig">${original}</g>${animated}
${infoSvg}
<text class="i ty" style="${typed(info.length + 1, 1)}" x="${infoX.toFixed(1)}" y="${promptY.toFixed(1)}"><tspan class="h">&gt;</tspan></text>
<rect class="cur" x="${(infoX + 2 * INFO.cw).toFixed(1)}" y="${(promptY - INFO.size * 0.85).toFixed(1)}" width="${INFO.cw.toFixed(1)}" height="${INFO.size}" fill="${t.muted}"/>
</svg>
`;
}

const ICONS = {
  globe: '<circle cx="8" cy="8" r="7"/><ellipse cx="8" cy="8" rx="3" ry="7"/><path d="M1 8h14"/>',
  orcid: '<circle cx="8" cy="8" r="7"/><path d="M5.5 6.5v5M5.5 4.3v.1M8 6.5v5h1.5a2.5 2.5 0 0 0 0-5z"/>',
  linkedin: '<rect x="1" y="1" width="14" height="14" rx="2.5"/><path d="M4.5 7v4.5M4.5 4.6v.1M7.5 11.5V7M7.5 9a2 2 0 0 1 4 0v2.5"/>',
  mail: '<rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="m1.5 3.8 6.5 5 6.5-5"/>',
};
const BUTTONS = [
  ['website', 'WEBSITE', 'globe'],
  ['orcid', 'ORCID', 'orcid'],
  ['linkedin', 'LINKEDIN', 'linkedin'],
  ['email', 'EMAIL', 'mail'],
];

function button(label, icon, theme) {
  const t = THEMES[theme];
  const w = 200;
  const h = 44;
  const textW = len(label) * 8.4;
  const groupW = 16 + 12 + textW;
  const x0 = (w - groupW) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" fill="${t.bg}" stroke="${t.strong}"/>
<path d="M6 ${h - 1.5}h${w - 12}" stroke="${t.muted}" stroke-width="2"/>
<g transform="translate(${x0.toFixed(1)} ${(h - 16) / 2 - 1})" fill="none" stroke="${t.bright}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</g>
<text x="${(x0 + 28).toFixed(1)}" y="${h / 2 + 4}" textLength="${textW.toFixed(1)}" lengthAdjust="spacing" style="font-family:${MONO};font-size:14px;fill:${t.bright};letter-spacing:1px">${label}</text>
</svg>
`;
}

const stats = await collect();
mkdirSync(OUT, { recursive: true });
stats.title = `${stats.name} — profile card`;
for (const theme of Object.keys(THEMES)) {
  writeFileSync(join(OUT, `card-${theme}.svg`), card(stats, theme));
  for (const [id, label, icon] of BUTTONS) writeFileSync(join(OUT, `btn-${id}-${theme}.svg`), button(label, icon, theme));
}
console.log(JSON.stringify({ ...stats, title: undefined }, null, 1));
