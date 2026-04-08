import { describe, expect, it } from 'vitest'
import {
  extractAssociationKey,
  findConflictingAssociationEntries,
  mergeAssociationListsUnique,
} from '../associationDedup'

describe('extractAssociationKey', () => {
  it('uses leading Latin word lowercased', () => {
    expect(extractAssociationKey('scent (foo)')).toBe('scent')
    expect(extractAssociationKey('Odour（臭味）')).toBe('odour')
    expect(extractAssociationKey('well-known (adj.)')).toBe('well-known')
  })

  it('falls back to full trimmed string when no Latin prefix', () => {
    expect(extractAssociationKey('  纯中文短语  ')).toBe('纯中文短语')
  })
})

describe('findConflictingAssociationEntries', () => {
  it('returns entries with same key but different full string', () => {
    const existing = ['scent (A)', 'odour (B)', 'scent (C)']
    expect(findConflictingAssociationEntries('scent (D)', existing)).toEqual(['scent (A)', 'scent (C)'])
  })

  it('excludes exact trim match', () => {
    const existing = ['scent (x)']
    expect(findConflictingAssociationEntries('scent (x)', existing)).toEqual([])
  })

  it('returns empty when no Latin key overlap for distinct CJK', () => {
    expect(findConflictingAssociationEntries('苹果', ['香蕉'])).toEqual([])
  })
})

describe('mergeAssociationListsUnique', () => {
  it('dedupes by trim and preserves order', () => {
    expect(mergeAssociationListsUnique(['a'], ['b', ' a ', 'c'])).toEqual(['a', 'b', 'c'])
  })
})
