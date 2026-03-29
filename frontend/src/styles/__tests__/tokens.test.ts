import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('tokens.css', () => {
  it('defines motion duration tokens', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    expect(css).toContain('--motion-duration-fast')
    expect(css).toContain('--motion-duration-base')
    expect(css).toContain('--motion-duration-slow')
  })
})
