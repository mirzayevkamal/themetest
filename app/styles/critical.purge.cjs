// PostCSS plugin for critical.scss only: drops every rule whose selector names a class, id or
// custom element the server-rendered home never prints, so the inline sheet carries first-paint
// rules alone and app.css covers the rest once it loads.
// Token list: `node scripts/critical-classes.mjs <home url>...` → critical.classes.json.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PSEUDO_FUNCTION = /(?<!\\)::?[\w-]+\((?:[^()]|\([^()]*\))*\)/g;
const PSEUDO = /(?<!\\)::?[\w-]+/g;
const CLASS = /\.((?:\\[0-9a-f]{1,6} ?|\\.|[\w-])+)/gi;
const ID = /#((?:\\[0-9a-f]{1,6} ?|\\.|[\w-])+)/gi;
const CUSTOM_ELEMENT = /(?:^|[\s>+~,])([a-z]+-[\w-]+)/g;
// Tailwind writes some characters as CSS hex escapes (`\2c ` for a comma, `\31 ` for a leading digit).
const unescape = (token) =>
  token.replace(/\\([0-9a-f]{1,6}) ?|\\(.)/gi, (_, hex, ch) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : ch
  );

function createPurge(tokens) {
  const sets = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, new Set(v)]));
  const rendered = (selector) => {
    const plain = selector.replace(PSEUDO_FUNCTION, '').replace(PSEUDO, '');
    for (const [, c] of plain.matchAll(CLASS)) if (!sets.classes.has(unescape(c))) return false;
    for (const [, i] of plain.matchAll(ID)) if (!sets.ids.has(unescape(i))) return false;
    for (const [, t] of plain.matchAll(CUSTOM_ELEMENT)) if (!sets.tags.has(t)) return false;
    return true;
  };
  return (root) => {
    root.walkRules((rule) => {
      if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return;
      const kept = rule.selectors.filter(rendered);
      if (kept.length) rule.selectors = kept;
      else rule.remove();
    });
    let removed;
    do {
      removed = false;
      root.walkAtRules(/^(media|supports)$/, (at) => {
        if (at.nodes?.length === 0) (at.remove(), (removed = true));
      });
    } while (removed);
  };
}

module.exports = (tokens) => ({
  postcssPlugin: 'critical-purge',
  Once(root) {
    if (!/critical\.scss(\?|$)/.test(root.source?.input.file ?? '')) return;
    createPurge(tokens ?? JSON.parse(readFileSync(join(__dirname, 'critical.classes.json'), 'utf8')))(root);
  },
});
module.exports.postcss = true;
