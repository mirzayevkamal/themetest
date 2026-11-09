import postcss, { type Rule } from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

// app.scss order: the card rules live in product-card.scss, right after product.scss.
const css = compileString(
  "@import '01-settings/breakpoints';\n@import '04-components/product';\n@import '04-components/product-card';",
  {
    loadPaths: ['app/styles'],
    silenceDeprecations: ['import'],
  }
).css;
const root = postcss.parse(css);

function ruleFor(selector: string): Rule | undefined {
  let found: Rule | undefined;
  root.walkRules(selector, (rule) => {
    found = rule;
  });
  return found;
}

describe('product page stylesheet', () => {
  describe("the engine form's own sections", () => {
    const card = '.product-page .product-form > section[class~=bg-white]:not(.product-info)';
    // Rules listing `card` among their selectors: the phone rule, then the web-desktop one.
    const cardRules = (inMedia: boolean) => {
      let found = '';
      root.walkRules((rule) => {
        const media = rule.parent?.type === 'atrule';
        if (media === inMedia && rule.selectors.some((sel) => sel.endsWith(card))) {
          found += rule.toString();
        }
      });
      return found;
    };

    it('turns them into grocery cards, leaving the ProductInfo card alone', () => {
      expect(cardRules(false)).toContain('rounded-xl bg-white p-3');
      expect(ruleFor('.product-page .product-form')?.toString()).toContain('flex flex-col gap-2');
    });

    it('frames the cards on web desktop, where the page is white', () => {
      expect(cardRules(true)).toContain('rounded-lg border border-neutral-100');
    });

    it("draws the attachment tabs as chips, in the merchant's brand colour when open", () => {
      expect(ruleFor('.product-page .product-form .btn-tab')?.toString()).toContain(
        'rounded-lg border border-neutral-100 bg-white'
      );
      expect(ruleFor('.product-page .product-form .btn-tab.is-opened')?.toString()).toContain(
        'border-brand bg-brand-tint'
      );
    });

    it('drops the padding of a closed attachment panel, so no gap is left under the tabs', () => {
      expect(
        ruleFor('.product-page .product-form .collapse-content.is-closed > div')?.toString()
      ).toContain('p-0');
    });

    it("overrides Salla's stacked gifting tile and countdown with a row", () => {
      expect(
        ruleFor('.product-page .product-form salla-gifting .s-list-tile-item')?.toString()
      ).toMatch(/flex-row[^;]*!important/);
      expect(
        ruleFor(
          '.product-page .product-form salla-count-down .s-count-down-pre-order-container'
        )?.toString()
      ).toMatch(/m-0 flex-row[^;]*!important/);
    });
  });

  it("lays the custom fields flat inside the product card instead of Salla's padded boxes", () => {
    expect(ruleFor('.product-info__metadata .s-metadata-box')?.toString()).toContain(
      'm-0 rounded-none bg-transparent p-0'
    );
    expect(ruleFor('.product-info__metadata .s-metadata-box-header')?.toString()).toContain(
      'text-sm font-bold'
    );
    expect(ruleFor('.product-info__metadata .s-metadata-row')?.toString()).toContain(
      'border-neutral-100'
    );
  });

  it('hides the bought-together skeleton so an empty block cannot push the related row', () => {
    const rule = ruleFor('.product-page salla-bought-together:has(> .s-bought-together-skeleton)');
    expect(rule?.toString()).toContain('display: none');
  });

  it('pins the card notify-me badge to the stepper spot, clipped so its skeleton cannot grow the card', () => {
    const rule = ruleFor('.s-product-card-notify-slot')?.toString();
    expect(rule).toContain('absolute bottom-1 start-1 end-1');
    expect(rule).toContain('h-7.5');
    expect(rule).toContain('overflow-hidden');
  });

  it('drops the bell from the subscribed state, stretches it across the slot and caps it at two lines', () => {
    const slot = '.s-product-card-notify-slot:has(.s-product-availability-subscribed)';
    expect(ruleFor(slot)?.toString()).toContain('h-auto');
    let hosts = '';
    root.walkRules((r) => {
      if (r.selectors.includes(`${slot} salla-product-availability`)) hosts = r.toString();
    });
    expect(hosts).toContain('w-full');
    // the host draws the chip, so a clamped third line cannot show through the padding;
    // a neutral status wash without border or shadow, so it does not read as a button
    const host = ruleFor(
      '.s-product-card-notify:has(> .s-product-availability-subscribed)'
    )?.toString();
    expect(host).toContain('border border-transparent bg-neutral-100 px-0.5 py-2');
    expect(host).not.toContain('shadow');
    expect(
      ruleFor('.s-product-card-notify .s-product-availability-subscribed')?.toString()
    ).toContain('line-clamp-2 bg-transparent p-0');
    expect(
      ruleFor('.s-product-card-notify .s-product-availability-subscribed')?.toString()
    ).toContain('text-green-700');
    expect(
      ruleFor('.s-product-card-notify .s-product-availability-subs-icon')?.toString()
    ).toContain('hidden');
  });

  it("matches the subscribed-state rules against salla-product-availability's own markup", () => {
    // The library's subscribed render (twilight-components salla-product-availability):
    // host .s-product-availability-wrap > div.s-product-availability-subscribed >
    // span.s-product-availability-subs-icon + success text. The card passes its class to the host.
    document.body.innerHTML = `
      <div class="s-product-card-notify-slot">
        <salla-product-availability class="s-product-card-notify s-product-availability-wrap">
          <div class="s-product-availability-subscribed">
            <span class="s-product-availability-subs-icon"><svg></svg></span>
            سنخبرك عند توفر المنتج.
          </div>
        </salla-product-availability>
      </div>`;
    const selectors: string[] = [];
    root.walkRules(/subscribed|subs-icon/, (rule) => selectors.push(...rule.selectors));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(document.querySelector(selector), selector).not.toBeNull();
    }
    document.body.innerHTML = '';
  });

  it('lets taps beside the notify-me badge reach the image link', () => {
    expect(ruleFor('.s-product-card-notify-slot')?.toString()).toContain('pointer-events-none');
    expect(ruleFor('.s-product-card-notify > *')?.toString()).toContain('pointer-events-auto');
  });

  it('colours the notify-me badge like the + tile per accent_style, label and bell included', () => {
    const badge = '.s-product-card-notify .s-button-element';
    const rule = (selector: string) => {
      let found = '';
      root.walkRules((r) => {
        if (r.selectors.includes(selector)) found = r.toString();
      });
      return found;
    };
    expect(ruleFor(`${badge}::before`)?.toString()).toContain('bg-current');
    expect(rule(badge)).toContain('border-brand-tint-hover bg-brand-reverse');
    expect(rule(badge)).toContain('text-brand');
    // salla-button's primary hover would otherwise paint the badge brand-red
    expect(rule(`${badge}:hover`)).toBe(rule(badge));
    expect(rule('.s-product-card-notify-slot--outlined .s-button-element:hover')).toContain(
      'border-brand text-ink'
    );
  });

  it('keeps the equal-height content stretch', () => {
    expect(ruleFor('.s-product-card-equal-height .s-product-card-content')?.toString()).toContain(
      'grow'
    );
  });

  it('outlines the booking/donation + tile with the brand border and an ink icon', () => {
    const rule = ruleFor('.s-product-card-add-button--outlined .s-button-element');
    expect(rule?.toString()).toContain('border-brand text-ink');
  });

  it('paints the dark call-to-action whether SallaButton renders its own button or a host', () => {
    let rule = '';
    root.walkRules((r) => {
      if (r.selectors.includes('.cta-dark .cta-button')) rule = r.toString();
    });
    expect(rule).toContain('.cta-dark .cta-button .s-button-element');
    expect(rule).toContain('.cta-dark .cta-button:hover');
    expect(rule).toContain('bg-ink text-white');
  });

  it("marks the picked and focused option chip in the merchant's brand colour", () => {
    const chip = '.product-info salla-product-options .s-product-options-grid-mode';
    expect(
      ruleFor(`${chip} input:checked + .s-product-options-grid-mode-span`)?.toString()
    ).toContain('border-brand bg-brand-tint');
    expect(
      ruleFor(`${chip} input:focus-visible + .s-product-options-grid-mode-span`)?.toString()
    ).toContain('ring-brand');
  });
});
