import '@testing-library/jest-dom'

// JSDOM does not implement scrollTo; keep test output clean.
Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
})

// JSDOM does not implement ResizeObserver (ActivityHeatmap / Dashboard tests).
globalThis.ResizeObserver = class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
