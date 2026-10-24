import { neon } from '@neondatabase/serverless';

let client;

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nao configurada.');
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}