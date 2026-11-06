import test from 'node:test'
import assert from 'node:assert/strict'
import { getSafeAuthRedirect } from '../src/lib/authRedirect.ts'

test('rejects attacker-controlled destinations after authentication', () => {
  for (const destination of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'https://attacker.example/phish',
    '//attacker.example/phish',
    '/\\attacker.example/phish',
    '/x/..//attacker.example/phish',
    '/x/%2e%2e//attacker.example/phish',
    ' /home',
    '/home\nnext',
    '%2f%2fattacker.example',
  ]) {
    assert.equal(getSafeAuthRedirect(destination), '/', destination)
  }
})

test('keeps ordinary internal destinations and defaults to the home page', () => {
  assert.equal(getSafeAuthRedirect('/board?tab=latest#post'), '/board?tab=latest#post')
  assert.equal(getSafeAuthRedirect('/'), '/')
  assert.equal(getSafeAuthRedirect(null), '/')
})
