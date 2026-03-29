import '@testing-library/jest-dom'

// JSDOM does not implement scrollTo; keep test output clean.
Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
})
