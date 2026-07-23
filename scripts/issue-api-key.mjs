#!/usr/bin/env node
// Operator tool: mint a Veridion public-API key.
//
// Usage:
//   VERIDION_API_KEY_SECRET=... node scripts/issue-api-key.mjs "App Name" read:status,read:score
//
// The key format mirrors src/features/developer-api/api-keys.ts exactly
// (vrd_<base64url(claims)>.<base64url(HMAC-SHA256)>). Self-service developer
// registration is a follow-up (see docs/public-api.md "Roadmap"); until then,
// keys are minted here by an operator who holds the signing secret.

import { createHmac, randomUUID } from 'node:crypto';

const VALID_SCOPES = ['read:status', 'read:score'];

const secret = process.env.VERIDION_API_KEY_SECRET;
if (!secret) {
  console.error('Error: set VERIDION_API_KEY_SECRET in the environment.');
  process.exit(1);
}

const appName = process.argv[2];
if (!appName) {
  console.error('Usage: node scripts/issue-api-key.mjs "App Name" [scopes]');
  console.error(`  scopes: comma-separated subset of ${VALID_SCOPES.join(', ')} (default: read:status)`);
  process.exit(1);
}

const scopes = (process.argv[3] ?? 'read:status').split(',').map((s) => s.trim());
const invalid = scopes.filter((s) => !VALID_SCOPES.includes(s));
if (invalid.length > 0) {
  console.error(`Error: unknown scope(s): ${invalid.join(', ')}`);
  process.exit(1);
}

const claims = { v: 1, appId: randomUUID(), appName, scopes, iat: Date.now() };
const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
const signature = createHmac('sha256', secret).update(payload).digest('base64url');
const key = `vrd_${payload}.${signature}`;

console.log('\nApplication registered. Store this key securely — it is shown only once:\n');
console.log(`  appId:  ${claims.appId}`);
console.log(`  scopes: ${scopes.join(', ')}`);
console.log(`\n  ${key}\n`);
