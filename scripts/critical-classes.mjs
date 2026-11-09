// Records the class names, ids and tags the server renders on the given home pages (SSR HTML, no
// JS) into app/styles/critical.classes.json, merged with what is already there. Delete the file
// first to start over. Some markup only renders with session cookies (the delivery promise needs a
// chosen address): save such a page from the browser and pass the file path too.
//   node scripts/critical-classes.mjs https://preview.salla.design/meed-2027/ar?theme=pr-66&storeId=1422600216 https://teen-zaytoon.salla.design/ar ~/Downloads/home.html
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../app/styles/critical.classes.json', import.meta.url);
const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const sets = Object.fromEntries(['classes', 'ids', 'tags'].map((k) => [k, new Set(previous[k])]));

async function read(source) {
  if (existsSync(source)) return readFileSync(source, 'utf8');
  const response = await fetch(source, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 11) Mobile' } });
  if (!response.ok) throw new Error(`${source}: ${response.status}`);
  return response.text();
}

for (const source of process.argv.slice(2)) {
  const html = (await read(source)).replace(/<script[\s\S]*?<\/script>/g, '');
  for (const [, v] of html.matchAll(/\sclass="([^"]*)"/g)) for (const c of v.split(/\s+/)) c && sets.classes.add(c);
  for (const [, v] of html.matchAll(/\sid="([^"]*)"/g)) sets.ids.add(v);
  for (const [, v] of html.matchAll(/<([a-z][\w-]*)/g)) sets.tags.add(v);
}

const out = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, [...v].sort()]));
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join(', '));
