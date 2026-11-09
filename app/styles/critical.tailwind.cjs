// Tailwind for critical.scss: the theme's setup, scanning only the home page's first-screen components.
const base = require('../../tailwind.config.js');

const engine = './node_modules/@salla.sa/twilight-theme-engine/tailwind';

module.exports = {
  ...base,
  // Classes the first screen renders that no scanned file spells out: the Twilight plugin's
  // (SallaButton's size, the delivery promise) and utilities the SDK adds at runtime.
  // Found by matching the full sheet's extra rules against the rendered home and product pages.
  safelist: [
    'object-cover',
    's-button-btn',
    's-button-small',
    's-delivery-promise-container',
    's-delivery-promise-title',
    'leading-tight',
    'pb-8',
    'rounded-t-3xl',
    'space-x-1',
    'space-x-2',
    'text-xl',
    'z-10',
    'overflow-x-auto',
  ],
  content: [
    './app/routes/{__root,index}.tsx',
    './app/components/{layout,home,navigation,icons}/**/*.{ts,tsx}',
    './app/components/{BottomNav,SearchBar}.tsx',
    './app/components/product/{ProductCard,AddToCartStepper}.tsx',
    './app/hooks/**/*.{ts,tsx}',
    './app/components/cart/CartBar.tsx',
    `${engine}/components/{layout,home,common}/**/*`,
    // The page's own placeholder blocks.
    `${engine}/routes/home/**/*`,
    // The SDK's server-rendered markup and skeletons: its `s-*` classes come from the Twilight Tailwind plugin,
    // which only emits the ones it finds here (block titles, slider chrome).
    './node_modules/@salla.sa/twilight-components-react/dist/{native,skeletons}/**/*.js',
  ],
};
