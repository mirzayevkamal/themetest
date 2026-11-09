import { resolve } from 'node:path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { compileString } from 'sass';

/** Stylesheets (imported in order, as app.scss does) through the real pipeline (Sass, then
 *  Tailwind with the theme config, which
 *  expands `@apply`), and the declarations each selector ends up with. */
export async function compileWithTailwind(...partials: string[]) {
  const sassCss = compileString(partials.map((p) => `@import '${p}';`).join('\n'), {
    loadPaths: ['app/styles'],
    silenceDeprecations: ['import'],
  }).css;
  const { css } = await postcss([tailwind({ config: resolve('tailwind.config.js') })]).process(
    sassCss,
    { from: undefined }
  );
  const root = postcss.parse(css);

  /** prop → value across every rule that lists `selector` (later rules win, as in the browser). */
  const decls = (selector: string) => {
    const out: Record<string, string> = {};
    root.walkRules((rule) => {
      if (rule.selectors.includes(selector))
        rule.walkDecls((d) => void (out[d.prop] = d.important ? `${d.value} !important` : d.value));
    });
    return out;
  };

  // Real at-rules only: a comment may mention `@apply`.
  let unexpanded = 0;
  root.walkAtRules(/^(apply|tailwind|screen)$/, () => void unexpanded++);

  return { css, decls, unexpanded };
}
