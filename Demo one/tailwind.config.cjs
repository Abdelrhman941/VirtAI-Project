module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#222831',
        secondary: '#393E46',
        tertiary: '#948979',
        light: '#DFD0B8',
        accent: '#00ADB5',
        muted: '#948979',
        bg: '#222831',
        surface: '#393E46',
      },
      maxWidth: {
        content: '1100px',
      }
    }
  },
  plugins: [],
}
