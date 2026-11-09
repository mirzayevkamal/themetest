/** @type {import('tailwindcss').Config} */
module.exports = {
  important: false,
  content: [
    './app/**/*.{js,ts,jsx,tsx,scss,css}',
    // Monorepo checkout: scan live engine source (matches nothing standalone).
    '../theme-engine/src/**/*.{js,ts,jsx,tsx}',
    // Standalone (registry install): scan the engine's pre-built dist.
    './node_modules/@salla.sa/twilight-theme-engine/dist/**/*.js',
    // SSR'd skeletons and wrapper markup carry `s-*` classes; scan the package that
    // renders them. Twilight web components ship their own CSS since 2.14.538
    // (SallaApp/twilight#2107), so the safelist is no longer compiled here.
    './node_modules/@salla.sa/twilight-components-react/dist/**/*.js',
  ],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    // Mobile stays the default layout. sm+ stay parked so legacy `sm:`/`md:`/`lg:`
    // styles (ours and the engine's) cannot make desktop diverge from mobile.
    // `desktop` matches `$web-desktop-min` (Raed's `md`: mobile shell below 768px) —
    // pair it with `html:not(.mobile-webview)` in CSS so the native app webview
    // never picks up the web desktop layout.
    // xxs/xs stay real: they are intra-mobile refinements below the 480px shell cap.
    screens: {
      xxs: { min: '380px', max: '479px' },
      xs: '480px',
      desktop: '768px',
      sm: '30000px',
      md: '30001px',
      lg: '30002px',
      xl: '30003px',
      '2xl': '30004px',
    },
    container: {
      center: true,
      padding: '10px',
      screens: {
        '2xl': '1280px',
      },
    },
    fontFamily: {
      sans: ['var(--font-main)', '-apple-system', 'BlinkMacSystemFont'],
      primary: 'var(--font-main)',
    },
    extend: {
      transitionTimingFunction: {
        elastic: 'cubic-bezier(0.55, 0, 0.1, 1)',
      },
      gridTemplateColumns: {
        'auto-fill': 'repeat(auto-fill, 290px)',
      },
      colors: {
        dark: '#1D1F1F',
        darker: '#0E0F0F',
        danger: '#AE0A0A',
        primary: 'var(--color-primary)',
        'primary-dark': 'var(--color-primary-dark)',
        brand: {
          DEFAULT: 'var(--brand-primary)',
          deep: 'var(--brand-primary-deep)',
          reverse: 'var(--brand-primary-reverse)',
          tint: 'var(--brand-primary-tint)',
          'tint-hover': 'var(--brand-primary-tint-hover)',
        },
        // Grocery design tokens (fixed Figma palette). Colors that exactly match
        // the default scale (#F5F5F5=neutral-100, #737373=neutral-500,
        // #D4D4D4=neutral-300) intentionally use those utilities instead.
        ink: '#161515', // primary text
        smoke: '#F8F8F8', // page/section background
        hairline: '#E9E9E9', // badge rings, image borders
        discount: {
          DEFAULT: '#FF4300', // sale badges / discount text
          tint: '#FFEDED', // cancelled-order chip wash
        },
        tomato: '#FF2402', // main-links slider icon accent
        grey: 'var(--color-grey)', // #F5F7F9, see 01-settings/global.scss
        'light-grey': 'var(--color-light-grey)', // #EEEEEE, see global.scss
        mint: {
          DEFAULT: '#38AE97',
          dark: '#1B7563',
          light: '#7DFFE4',
          tint: '#E7FFFA',
          'tint-light': '#EDFFFB', // inactive chip borders
        },
        control: {
          DEFAULT: '#FCFCFC', // web-desktop header controls (search, cart, language)
          line: '#F4F4F4', // their border
          text: '#333333', // their label text
        },
        silver: {
          DEFAULT: '#ADADAD', // muted/disabled text, icon fills
          light: '#BBBBBB', // stepper disabled text
          dark: '#666666', // out-of-stock chip text
        },
      },
      spacing: {
        3.75: '15px',
        7.5: '30px',
        10.5: '42px',
        58: '232px',
        62: '248px',
        100: '28rem',
        116: '464px',
        132: '528px',
        200: '800px',
      },
      borderRadius: {
        large: '22px',
        big: '40px',
        tiny: '3px',
        DEFAULT: '.75rem',
      },
      fontSize: {
        'icon-lg': '33px',
        xxs: '10px',
        xxxs: '8px',
        'title-size': '42px',
        '22px': '22px',
      },
      lineHeight: {
        12: '3rem',
        14: '3.5rem',
        16: '4rem',
        18: '4.5rem',
        20: '5rem',
      },
      boxShadow: {
        default: '5px 10px 30px #2B2D340D;',
        top: '0px 0px 10px #0000001A;',
        md: '5px 10px 99px #2B2D340D',
        dropdown: '0 4px 8px rgba(161, 121, 121, 0.07)',
        light: '0px 4px 15px rgba(1, 1, 1, 0.06)',
        huge: '0px 3px 6px #00000029',
        progress: '0 5px 15px rgba(92, 213, 196, 0.4)',
        bar: '0 6px 16px rgba(0, 0, 0, 0.08)', // sticky page/drawer header
        mobile:
          'rgb(0 0 0 / 9%) 0px 2px 1px, rgb(0 0 0 / 9%) 0px 4px 2px, rgb(0 0 0 / 9%) 0px 8px 4px, rgb(0 0 0 / 9%) 0px 16px 18px, rgb(0 0 0 / 9%) -15px 10px 7px, rgb(0 0 0 / 9%) -20px 10px 20px, rgb(0 0 0 / 9%) -20px 10px 20px, rgb(0 0 0 / 9%) -25px 20px 20px',
      },
      width: {
        18: '4.5rem',
        22: '5.5rem',
        74: '18.5rem',
        76: '19rem',
        78: '19.5rem',
      },
      height: {
        15: '3.75rem',
        banner: '200px',
        'lg-banner': '428px',
        'full-banner': '600px',
        500: '500px',
        460: '460px',
      },
      minWidth: {
        '1/4': '25%',
        '1/2': '50%',
        '3/4': '75%',
      },
      maxWidth: {
        '1/4': '25%',
        '1/2': '50%',
        '3/4': '75%',
        drawer: '511px', // Figma web-desktop side panel
      },
      borderWidth: {
        0.5: '0.5px',
      },
      zIndex: {
        1: '1',
        2: '2',
        '-1': '-1',
        60: '60', // drawers, above the z-50 desktop header
      },
      backgroundOpacity: {
        '05': '0.05',
      },
      transitionProperty: {
        height: 'height',
      },
      keyframes: {
        slideUpFromBottom: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0%)', opacity: '1' },
        },
        slideDownFromBottom: {
          '0%': { transform: 'translateY(0%)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        slideUpFromBottom: 'slideUpFromBottom .6s linear',
        slideDownFromBottom: 'slideDownFromBottom .6s linear',
        sheetUp: 'sheetUp .35s cubic-bezier(0.32, 0.72, 0, 1)',
        fadeIn: 'fadeIn .25s ease-out',
      },
    },
  },
  corePlugins: {
    outline: false,
  },
  plugins: [require('@salla.sa/twilight-tailwind-theme'), require('@tailwindcss/forms')],
};
