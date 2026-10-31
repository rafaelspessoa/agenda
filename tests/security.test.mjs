import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, localDate, loginRolesForProfile, normalizeUsername, shiftDate, verifyPassword } from '../api/_security.js';

test('password hashes verify without retaining the raw password', async () => {
  const password = 'A-very-strong-test-password-2026';
  const encoded = await hashPassword(password);

  assert.notEqual(encoded, password);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('wrong-password', encoded), false);
});

test('usernames normalize consistently', () => {
  assert.equal(normalizeUsername('  Comprador.01  '), 'comprador.01');
  assert.equal(normalizeUsername('ＡＮＡ'), 'ana');
});

test('date windows use the configured Sao Paulo timezone', () => {
  assert.equal(localDate(new Date('2026-01-01T02:30:00.000Z')), '2025-12-31');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
});

test('commercial login accepts buyers, admin and managers but reception remains isolated', () => {
  assert.deepEqual(loginRolesForProfile('buyer'), ['buyer', 'admin', 'purchase_manager', 'category_manager']);
  assert.deepEqual(loginRolesForProfile('reception'), ['reception']);
  assert.deepEqual(loginRolesForProfile('admin'), []);
});