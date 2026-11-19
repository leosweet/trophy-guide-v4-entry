// Leonida Legend — GTA VI trophy guide, entry program (Node 22, standard library only).
//
// The guide itself is plain static files in app/ (index.html, style.css, app.js and
// app/data/trophies.json): it opens in desktop Chrome with the network off and loads
// nothing from outside app/. This program hands it in: it copies app/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads (the screenshots, the first load's files and bytes, and the source),
// using the vendored make.fun library. Leave vendor/makefun-frontend.ts untouched:
// the scorer requires dossier.json to be byte for byte what its own copy writes.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.)

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Sanity check before handing anything in: the trophy file must parse and must
// name all 55 official trophies, each with a non-blank guide. Fail loudly here
// rather than shipping a dossier the gate would refuse.
const trophyDoc = JSON.parse(readFileSync(join(here, 'app', 'data', 'trophies.json'), 'utf8'));
const trophyList = trophyDoc.trophies;
if (!Array.isArray(trophyList) || trophyList.length !== 55) {
  throw new Error(`expected 55 trophies in app/data/trophies.json, found ${Array.isArray(trophyList) ? trophyList.length : 'none'}`);
}
const unguided = trophyList.filter((t) => typeof t.guide !== 'string' || !t.guide.trim());
if (unguided.length > 0) {
  throw new Error(`trophies without a guide: ${unguided.map((t) => t.name).join(', ')}`);
}
const unsourced = trophyList.filter((t) => !Array.isArray(t.src) || t.src.length === 0);
if (unsourced.length > 0) {
  throw new Error(`trophies without a cited source: ${unsourced.map((t) => t.name).join(', ')}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes;
// the others refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files and directories in app/ or 48 MiB of app files:
// app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
