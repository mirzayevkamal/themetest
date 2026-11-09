// @vitest-environment node
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import purge from '../../app/styles/critical.purge.cjs';

const tokens = { classes: ['card', 'title', 'hover:bg-x', 'w-[12px]', 'pt-[var(--top,0px)]', '2xl:p-1'], ids: ['main'], tags: ['div', 'salla-hook'] };
const run = (css: string, from = 'app/styles/critical.scss') =>
  postcss([purge(tokens)]).process(css, { from }).css;

describe('critical purge', () => {
  it('keeps rules whose classes, ids and custom elements the home renders', () => {
    const css = '.card{a:1}#main .title{b:2}salla-hook .card{c:3}img{d:4}:root{--x:1}';
    expect(run(css)).toBe(css);
  });

  it('drops rules naming classes, ids or custom elements the home never prints', () => {
    expect(run('.other{a:1}.card .other{b:2}#blog-like i{c:3}salla-slider .card{d:4}')).toBe('');
  });

  it('keeps only the rendered selectors of a list', () => {
    expect(run('.card,.other,.title{a:1}')).toBe('.card,.title{a:1}');
  });

  it('ignores pseudo-classes and :not() arguments, and reads escaped utilities', () => {
    const css = '.card:hover::before{a:1}.card:not(.other){b:2}.hover\\:bg-x:hover{c:3}.w-\\[12px\\]{d:4}';
    expect(run(css)).toBe(css);
  });

  it('reads the hex escapes Tailwind emits for commas and leading digits', () => {
    const css = '.pt-\\[var\\(--top\\2c 0px\\)\\]{a:1}.\\32 xl\\:p-1{b:2}.pt-\\[var\\(--top\\2c 1px\\)\\]{c:3}';
    expect(run(css)).toBe('.pt-\\[var\\(--top\\2c 0px\\)\\]{a:1}.\\32 xl\\:p-1{b:2}');
  });

  it('removes media queries left empty and keeps keyframes and font faces', () => {
    const css = '@media (min-width:481px){.other{a:1}}@media print{.card{b:2}}@keyframes spin{from{x:0}to{x:1}}@font-face{font-family:A}';
    expect(run(css)).toBe('@media print{.card{b:2}}@keyframes spin{from{x:0}to{x:1}}@font-face{font-family:A}');
  });

  it('leaves every other stylesheet alone', () => {
    expect(run('.other{a:1}', 'app/styles/app.scss')).toBe('.other{a:1}');
  });
});
