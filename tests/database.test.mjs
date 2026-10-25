import assert from 'node:assert/strict';
import test from 'node:test';
import { compileSql, databaseSsl } from '../api/_db.js';

test('Supabase SQL adapter parameterizes template interpolation', () => {
  const untrusted = "'; DROP TABLE app_users; --";
  const query = compileSql(['SELECT * FROM app_users WHERE username = ', ' AND active = ', ''], [untrusted, true]);

  assert.equal(query.text, 'SELECT * FROM app_users WHERE username = $1 AND active = $2');
  assert.deepEqual(query.values, [untrusted, true]);
});

test('Supabase PostgreSQL requires a trusted project CA certificate', () => {
  const previous = process.env.SUPABASE_DB_CA;
  process.env.SUPABASE_DB_CA = '-----BEGIN CERTIFICATE-----\nY2VydA==\n-----END CERTIFICATE-----';

  try {
    assert.deepEqual(databaseSsl(), {
      ca: '-----BEGIN CERTIFICATE-----\nY2VydA==\n-----END CERTIFICATE-----',
      rejectUnauthorized: true
    });
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_DB_CA;
    else process.env.SUPABASE_DB_CA = previous;
  }
});

test('Supabase PostgreSQL loads the local root CA file when no env value is set', () => {
  const previous = process.env.SUPABASE_DB_CA;
  delete process.env.SUPABASE_DB_CA;

  try {
    const ssl = databaseSsl();
    assert.match(ssl.ca, /Supabase Root 2021 CA|BEGIN CERTIFICATE/);
    assert.equal(ssl.rejectUnauthorized, true);
  } finally {
    if (previous !== undefined) process.env.SUPABASE_DB_CA = previous;
  }
});