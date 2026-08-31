/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 品牌色：深海军蓝底 + 金色点缀，与展示页视觉统一
        brand: {
          50: '#f6f3ea',
          100: '#e9e2c8',
          200: '#e8c872',
          300: '#d8b56a',
          400: '#d4af37',
          500: '#c9a227',
          600: '#a9861f',
          700: '#8a6e1a',
          800: '#6b5515',
          900: '#4c3c0f',
        },
        navy: {
          50: '#eef1f7',
          100: '#d7deeb',
          200: '#aab8d4',
          300: '#7d90b8',
          400: '#4a5d85',
          500: '#2b3a5c',
          600: '#1a2b4a',
          700: '#141f36',
          800: '#0b1220',
          900: '#020b18',
        },
        // 语义色
        danger: '#dc2626',
        success: '#16a34a',
        warn: '#d97706',
      },
      fontFamily: {
        serif: ['"Source Han Serif SC"', '"思源宋体"', '"Noto Serif SC"', 'serif'],
        sans: ['"PingFang SC"', '"Microsoft YaHei"', '"Noto Sans SC"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(2, 11, 24, 0.08), 0 4px 16px rgba(2, 11, 24, 0.06)',
        gold: '0 0 0 3px rgba(212, 175, 55, 0.15)',
      },
    },
  },
  plugins: [],
}
