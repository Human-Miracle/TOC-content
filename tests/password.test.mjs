import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, newToken, hashToken, cleanEmail, validEmail } from '../lib/password.mjs';

test('a password verifies against its own hash only', async () => {
  const h = await hashPassword('correct horse battery');
  assert.match(h, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!h.includes('correct horse'));
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('correct horse batterx', h), false);
  assert.equal(await verifyPassword('', h), false);
});

test('the same password hashes differently each time (random salt)', async () => {
  assert.notEqual(await hashPassword('same password 1'), await hashPassword('same password 1'));
});

test('a damaged or foreign hash never verifies', async () => {
  assert.equal(await verifyPassword('x', ''), false);
  assert.equal(await verifyPassword('x', 'plain-text'), false);
  assert.equal(await verifyPassword('x', 'bcrypt$1$2$3$4$5'), false);
});

test('tokens are long, unique and stored only as a hash', () => {
  const a = newToken(), b = newToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 43);
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(a), a);
  assert.equal(hashToken(a), hashToken(a));
});

test('emails are trimmed, lower-cased and checked', () => {
  assert.equal(cleanEmail('  Someone@Example.COM '), 'someone@example.com');
  assert.equal(validEmail('someone@example.com'), true);
  assert.equal(validEmail('not-an-email'), false);
  assert.equal(validEmail('a b@example.com'), false);
});
