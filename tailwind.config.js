/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B0B0B', 900: '#070707', 800: '#111111', 700: '#171717', 600: '#1E1E1E', 500: '#272727', 400: '#333333' },
        blood: { DEFAULT: '#E63946', 600: '#C62B37', 700: '#8E1B24', 900: '#3A0B10' },
        gold: { DEFAULT: '#F4C430', 300: '#FFE08A', 600: '#D9A914', 700: '#A67C00' },
        cream: '#F8F6EF',
        smoke: '#A0A0A0',
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        script: ['"Kaushan Script"', 'cursive'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(244,196,48,.35), 0 8px 30px -8px rgba(244,196,48,.45)',
        red: '0 0 0 1px rgba(230,57,70,.35), 0 10px 40px -10px rgba(230,57,70,.55)',
        card: '0 1px 0 rgba(255,255,255,.04) inset, 0 20px 40px -20px rgba(0,0,0,.8)',
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        flicker: { '0%,19%,21%,23%,25%,54%,56%,100%': { opacity: 1 }, '20%,24%,55%': { opacity: 0.55 } },
        slideUp: { '0%': { transform: 'translateY(16px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
      animation: {
        floaty: 'floaty 4s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        pop: 'pop .45s cubic-bezier(.2,.9,.3,1.3) both',
        shake: 'shake .4s ease-in-out',
        marquee: 'marquee 40s linear infinite',
        flicker: 'flicker 4s linear infinite',
        slideUp: 'slideUp .4s ease-out both',
      },
    },
  },
  // hover styles only on devices that can hover (no sticky pale buttons after a tap on phones)
  future: { hoverOnlyWhenSupported: true },
  plugins: [],
};
