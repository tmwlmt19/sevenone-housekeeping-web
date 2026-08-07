import { describe, expect, it } from 'vitest'

import { formatDuration, formatPercent, secondsToMinutes } from './format'

describe('formatDuration', () => {
  it('renders a dash for null', () => {
    expect(formatDuration(null)).toBe('—')
  })
  it('shows seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45s')
  })
  it('rounds to whole minutes', () => {
    expect(formatDuration(1530)).toBe('26m') // 25.5 → 26
  })
  it('splits hours and minutes', () => {
    expect(formatDuration(5400)).toBe('1h 30m')
  })
  it('drops zero minutes on whole hours', () => {
    expect(formatDuration(7200)).toBe('2h')
  })
})

describe('secondsToMinutes', () => {
  it('rounds to one decimal', () => {
    expect(secondsToMinutes(90)).toBe(1.5)
    expect(secondsToMinutes(100)).toBe(1.7)
  })
})

describe('formatPercent', () => {
  it('renders a dash for null', () => {
    expect(formatPercent(null)).toBe('—')
  })
  it('rounds to a whole percent', () => {
    expect(formatPercent(37.5)).toBe('38%')
    expect(formatPercent(66.6667)).toBe('67%')
  })
})
