import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateServiceTime, formatElapsedTime, formatRemainingTime } from '../src/lib/serviceTime.ts'

test('counts elapsed time in tenths from 08:00 Korea time', () => {
  const start = new Date('2024-01-01T08:00:00+09:00')
  const result = calculateServiceTime('2024-01-01', 18, new Date(start.getTime() + 187 * 86_400_000 + 1234))
  assert.equal(formatElapsedTime(result.elapsedMs), '187일 00:00:01.2')
  assert.equal(result.remainingDays, result.totalDays - 187)
})

test('reaches 100 percent at discharge day 08:00 and stops', () => {
  const before = calculateServiceTime('2024-01-01', 18, new Date('2025-07-01T07:59:59.900+09:00'))
  const at = calculateServiceTime('2024-01-01', 18, new Date('2025-07-01T08:00:00+09:00'))
  const after = calculateServiceTime('2024-01-01', 18, new Date('2025-07-02T08:00:00+09:00'))
  assert.equal(before.remainingMs, 100)
  assert.equal(at.remainingMs, 0)
  assert.equal(at.elapsedMs, at.totalMs)
  assert.equal(after.elapsedMs, at.totalMs)
  assert.equal(after.percent, 100)
})

test('remaining time counts down in tenths and reaches zero at discharge', () => {
  const justBefore = calculateServiceTime('2024-01-01', 18, new Date('2025-07-01T07:59:59.999+09:00'))
  const at = calculateServiceTime('2024-01-01', 18, new Date('2025-07-01T08:00:00+09:00'))
  const after = calculateServiceTime('2024-01-01', 18, new Date('2025-07-01T08:00:01+09:00'))
  assert.equal(formatRemainingTime(justBefore.remainingMs), '0일 00:00:00.1')
  assert.equal(formatRemainingTime(at.remainingMs), '0일 00:00:00.0')
  assert.equal(formatRemainingTime(after.remainingMs), '0일 00:00:00.0')
})
