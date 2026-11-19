// Leonida Legend — GTA VI trophy guide & tracker (offline, no network at runtime).
// Loads app/data/trophies.json, keeps earned ticks and collectible counters in
// localStorage, and renders the checklist, the roadmap and the missable timeline.
const EARNED_KEY = 'leonida-legend-earned-v4';
const COUNTS_KEY = 'leonida-legend-counts-v4';
const SETTINGS_KEY = 'leonida-legend-settings-v4';

const KIND_LABELS = {
  story: 'Story', side: 'Side quests', collectibles: 'Collectibles', activities: 'Activities',
  crime: 'Crime & robberies', secrets: 'Secrets & stunts', completion: '100% completion', platinum: 'Platinum',
};
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

const params = new URLSearchParams(location.search);
const demoMode = params.get('demo') === '1';
const openId = Number(params.get('open') || 0);
const startTab = params.get('tab') || 'checklist';

// Demo progress (for screenshots): example earned set, kept in memory only, never saved.
const DEMO_EARNED = ['Just Like Paradise', 'Paradise Lost', 'T**s Ass Drug Money', 'Trust', 'Baited My Tackle', 'Stick Fiddler', 'This Was No Boat Accident', 'Positive Mental Attitude', 'You WAiNKer!', 'Whip It Good', 'The Goodtime State', 'In The Beginning…', 'Capital Offense', 'The Truth Is Out There'];

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: progress stays for this visit */ }
}

let earned = new Set(demoMode ? DEMO_EARNED : loadJson(EARNED_KEY, []));
let counts = loadJson(COUNTS_KEY, {});
let settings = Object.assign({ spoilerHide: true }, loadJson(SETTINGS_KEY, {}));
let openGuide = openId || null;

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));
const sources = doc.sources;

const listEl = document.getElementById('trophyList');
const hintEl = document.getElementById('listHint');
const emptyEl = document.getElementById('emptyMsg');
const searchEl = document.getElementById('search');
const kindEl = document.getElementById('kindFilter');
const gradeEl = document.getElementById('gradeFilter');
const sortEl = document.getElementById('sortOrder');
const missableEl = document.getElementById('missableOnly');
const unearnedEl = document.getElementById('unearnedOnly');
const spoilerEl = document.getElementById('spoilerHide');

spoilerEl.checked = settings.spoilerHide;

function saveState() {
  if (demoMode) return;
  saveJson(EARNED_KEY, [...earned]);
  saveJson(COUNTS_KEY, counts);
  saveJson(SETTINGS_KEY, settings);
}

function formatCount(t) {
  const n = counts[t.id] || 0;
  if (t.targetUnit === '$') return `$${n.toLocaleString('en-US')} / $${t.target.toLocaleString('en-US')}`;
  return `${n} / ${t.target} ${t.targetUnit || ''}`.trim();
}

function isSpoilerHidden(t) {
  return settings.spoilerHide && t.kind === 'story' && !earned.has(t.name);
}

function visibleTrophies() {
  const q = searchEl.value.trim().toLowerCase();
  let out = trophies.filter((t) => {
    if (kindEl.value !== 'all' && t.kind !== kindEl.value) return false;
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (missableEl.checked && !t.missable) return false;
    if (unearnedEl.checked && earned.has(t.name)) return false;
    if (q) {
      const hay = `${t.name} ${t.description} ${t.guide} ${KIND_LABELS[t.kind] || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (sortEl.value === 'grade') {
    out = [...out].sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.name.localeCompare(b.name));
  } else if (sortEl.value === 'name') {
    out = [...out].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    out = [...out].sort((a, b) => a.stage - b.stage || a.id - b.id);
  }
  return out;
}

function sourceLinks(t) {
  const wrap = document.createElement('p');
  wrap.className = 'sources';
  wrap.append('Sources: ');
  (t.src || []).forEach((key, i) => {
    const s = sources[key];
    if (!s) return;
    if (i > 0) wrap.append(' · ');
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.name;
    wrap.append(a);
  });
  return wrap;
}

function buildCounter(t) {
  const row = document.createElement('div');
  row.className = 'counter';
  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', `Decrease ${t.name} count`);
  const label = document.createElement('span');
  label.className = 'count';
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', `Increase ${t.name} count`);
  const step = t.targetUnit === '$' ? 10000 : 1;
  const refresh = () => { label.textContent = `Counted: ${formatCount(t)}`; };
  minus.addEventListener('click', () => {
    counts[t.id] = Math.max(0, (counts[t.id] || 0) - step);
    saveState();
    refresh();
  });
  plus.addEventListener('click', () => {
    counts[t.id] = Math.min(t.target, (counts[t.id] || 0) + step);
    saveState();
    refresh();
  });
  refresh();
  row.append(minus, label, plus);
  return row;
}

function renderList() {
  const shown = visibleTrophies();
  listEl.replaceChildren();
  emptyEl.hidden = shown.length > 0;
  hintEl.textContent = `Showing ${shown.length} of ${trophies.length} trophies · ${earned.size} earned · click “Guide” for steps and sources.`;
  for (const t of shown) {
    const li = document.createElement('li');
    li.className = 'trophy' + (earned.has(t.name) ? ' earned' : '') + (t.unconfirmed ? ' unconfirmed' : '');
    li.id = `trophy-${t.id}`;

    const tick = document.createElement('input');
    tick.type = 'checkbox';
    tick.className = 'tick';
    tick.checked = earned.has(t.name);
    tick.setAttribute('aria-label', `Mark ${t.name} earned`);
    tick.addEventListener('change', () => {
      if (tick.checked) earned.add(t.name);
      else earned.delete(t.name);
      saveState();
      renderAll();
    });

    const main = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'name';
    const desc = document.createElement('p');
    desc.className = 'desc';
    if (isSpoilerHidden(t)) {
      name.textContent = '🔒 Hidden story trophy';
      desc.textContent = 'Spoiler hidden until earned — tick it off when you unlock it to reveal the name.';
      desc.classList.add('spoiler-lock');
    } else {
      name.textContent = t.name;
      desc.textContent = t.description;
    }
    main.append(name, desc);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const grade = document.createElement('span');
    grade.className = `badge ${t.grade}`;
    grade.textContent = t.grade;
    meta.append(grade);
    const kind = document.createElement('span');
    kind.className = 'tag';
    kind.textContent = KIND_LABELS[t.kind] || t.kind;
    meta.append(kind);
    const diff = document.createElement('span');
    diff.className = 'tag diff';
    diff.textContent = `Difficulty ${'★'.repeat(t.difficulty)}${'☆'.repeat(5 - t.difficulty)} · ${t.time}`;
    meta.append(diff);
    if (t.missable) {
      const warn = document.createElement('span');
      warn.className = 'tag warn';
      warn.textContent = '⚠ Missable — Chapter 1 only';
      meta.append(warn);
    }
    if (t.unconfirmed) {
      const unc = document.createElement('span');
      unc.className = 'tag unconf';
      unc.textContent = 'Unconfirmed — no guide yet';
      meta.append(unc);
    }
    if (t.target) {
      const tgt = document.createElement('span');
      tgt.className = 'tag';
      tgt.textContent = `Counter: ${formatCount(t)}`;
      meta.append(tgt);
    }

    const side = document.createElement('div');
    side.className = 'side';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'guide-btn';
    btn.textContent = openGuide === t.id ? 'Hide guide ▲' : 'Guide ▼';
    btn.setAttribute('aria-expanded', String(openGuide === t.id));
    btn.addEventListener('click', () => {
      openGuide = openGuide === t.id ? null : t.id;
      renderList();
      if (openGuide) document.getElementById(`trophy-${t.id}`)?.scrollIntoView({ block: 'nearest' });
    });
    side.append(btn);

    li.append(tick, main, side, meta);

    if (openGuide === t.id) {
      const guide = document.createElement('div');
      guide.className = 'guide';
      if (t.unconfirmed) {
        const note = document.createElement('p');
        note.className = 'unconf-note';
        note.textContent = 'No confirmed unlock method yet — the lead below is what the guides report, not a verified method.';
        guide.append(note);
      }
      const body = document.createElement('p');
      body.textContent = t.guide;
      guide.append(body);
      if (t.target) guide.append(buildCounter(t));
      guide.append(sourceLinks(t));
      li.append(guide);
    }
    listEl.append(li);
  }
  renderProgress();
}

function renderProgress() {
  const total = trophies.length;
  const pct = Math.round((earned.size / total) * 100);
  document.getElementById('progressText').textContent = `${earned.size} of ${total} earned · ${pct}%`;
  document.getElementById('miniProgress').textContent = `${earned.size}/${total} · ${pct}%`;
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressBar').setAttribute('aria-valuenow', String(earned.size));
  const chips = document.getElementById('kindChips');
  chips.replaceChildren();
  for (const [kind, label] of Object.entries(KIND_LABELS)) {
    const inKind = trophies.filter((t) => t.kind === kind);
    if (!inKind.length) continue;
    const done = inKind.filter((t) => earned.has(t.name)).length;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.append(`${label}: `);
    const b = document.createElement('b');
    b.textContent = `${done}/${inKind.length}`;
    chip.append(b);
    chips.append(chip);
  }
}

function renderRoadmap() {
  const wrap = document.getElementById('roadmap');
  wrap.replaceChildren();
  for (const stage of doc.roadmap) {
    const card = document.createElement('article');
    card.className = 'stage';
    const h = document.createElement('h2');
    h.textContent = `Stage ${stage.stage} — ${stage.title}`;
    const time = document.createElement('p');
    time.className = 'stage-time';
    time.textContent = stage.time;
    const text = document.createElement('p');
    text.textContent = stage.text;
    const ul = document.createElement('ul');
    ul.className = 'stage-trophies';
    for (const t of trophies.filter((x) => x.stage === stage.stage)) {
      const li = document.createElement('li');
      if (earned.has(t.name)) li.className = 'done';
      if (t.missable) li.classList.add('miss');
      li.textContent = isSpoilerHidden(t) ? '🔒 Hidden story trophy' : `${t.name} (${t.grade})`;
      ul.append(li);
    }
    card.append(h, time, text, ul);
    wrap.append(card);
  }
}

function renderTimeline() {
  const wrap = document.getElementById('timeline');
  wrap.replaceChildren();
  const moments = [
    {
      danger: true,
      when: 'Chapter 1 — the morning after the mission Down to Earth',
      title: 'Positive Mental Attitude — the one missable trophy',
      text: 'Talk to Lucia in the kitchen in the morning; she says she is going to meditate and walks to the balcony. Follow her and choose Accept. That meditation adds +1 to the counter but is not marked as a spot, and it is still unconfirmed whether it counts toward the trophy — do it anyway, because it is gone after Chapter 1. The other 18 spots across 10 locations can all be done later.',
    },
    {
      danger: false,
      when: 'Chapters 1–2',
      title: 'Everything else in the early game is safe',
      text: 'Story trophies, Cal’s fishing questline, Kenton’s treasure dives and the arcade games stay available. Start scanning vehicles and studying animals now — both feed the 100% checklist later.',
    },
    {
      danger: false,
      when: 'Chapters 3–5 and after the story',
      title: 'No other trophy can be missed',
      text: 'Side-character finales (Andy, Billy, Randy, Tyrone, Bret), bank vaults, jewelry robberies, gang operations, collectibles and the UFO easter egg are all still available in free-roam after the credits. Optional missions that disappear do not affect any trophy. Keep a manual save at the start and end of every chapter anyway — there is no mission replay.',
    },
  ];
  for (const m of moments) {
    const card = document.createElement('article');
    card.className = 'moment' + (m.danger ? ' danger' : '');
    const when = document.createElement('p');
    when.className = 'when';
    when.textContent = m.when;
    const h = document.createElement('h2');
    h.textContent = m.title;
    const p = document.createElement('p');
    p.textContent = m.text;
    card.append(when, h, p);
    wrap.append(card);
  }
}

function renderAll() {
  renderList();
  renderRoadmap();
  renderTimeline();
}

function switchTab(tab) {
  for (const b of document.querySelectorAll('.tab')) {
    b.classList.toggle('active', b.dataset.tab === tab);
  }
  for (const v of document.querySelectorAll('.view')) {
    v.hidden = v.id !== `view-${tab}`;
    v.classList.toggle('active', v.id === `view-${tab}`);
  }
}
for (const b of document.querySelectorAll('.tab')) {
  b.addEventListener('click', () => switchTab(b.dataset.tab));
}

for (const el of [searchEl, kindEl, gradeEl, sortEl, missableEl, unearnedEl]) {
  el.addEventListener('input', renderList);
  el.addEventListener('change', renderList);
}
spoilerEl.addEventListener('change', () => {
  settings.spoilerHide = spoilerEl.checked;
  saveState();
  renderList();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = {
    app: 'Leonida Legend — GTA VI trophy tracker',
    exportedAt: new Date().toISOString(),
    earned: [...earned],
    counts,
    settings,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const names = new Set(trophies.map((t) => t.name));
    const imported = (Array.isArray(data.earned) ? data.earned : []).filter((n) => names.has(n));
    earned = new Set(imported);
    if (data.counts && typeof data.counts === 'object') {
      counts = {};
      for (const [id, n] of Object.entries(data.counts)) {
        const t = byId.get(Number(id));
        if (t && Number.isFinite(n)) counts[t.id] = Math.max(0, Math.min(t.target || n, n));
      }
    }
    if (data.settings && typeof data.settings.spoilerHide === 'boolean') {
      settings.spoilerHide = data.settings.spoilerHide;
      spoilerEl.checked = settings.spoilerHide;
    }
    saveState();
    renderAll();
    hintEl.textContent = `Imported ${imported.length} earned trophies from ${file.name}.`;
  } catch {
    hintEl.textContent = `Could not import ${file.name}: not a valid progress file.`;
  }
  e.target.value = '';
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Clear all earned ticks and counters?')) return;
  earned = new Set();
  counts = {};
  saveState();
  renderAll();
});

switchTab(['checklist', 'roadmap', 'missable'].includes(startTab) ? startTab : 'checklist');
renderAll();
// Deep link (?open=<id>): bring the opened trophy's guide into view, centred
// so the sticky controls bar never covers the card.
if (openGuide) document.getElementById(`trophy-${openGuide}`)?.scrollIntoView({ block: 'center' });
