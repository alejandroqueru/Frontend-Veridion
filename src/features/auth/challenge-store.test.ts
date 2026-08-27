import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CHALLENGE_TTL_MS, getChallengeStore, issueChallenge, resetChallengeStore } from './challenge-store';
import { buildChallengeMessage } from './message';

const ADDRESS = `G${'A'.repeat(55)}`;

beforeEach(() => resetChallengeStore());
afterEach(() => resetChallengeStore());

describe('challenge store', () => {
  it('issues a challenge that can be consumed once', async () => {
    const challenge = await issueChallenge(ADDRESS);

    expect(await getChallengeStore().consume(ADDRESS)).toEqual(challenge);
    // Single use: the second attempt finds nothing, so a captured signature
    // cannot be replayed.
    expect(await getChallengeStore().consume(ADDRESS)).toBeNull();
  });

  it('issues a distinct nonce each time', async () => {
    const first = await issueChallenge(ADDRESS);
    const second = await issueChallenge(ADDRESS);
    expect(first.nonce).not.toBe(second.nonce);
  });

  it('supersedes an address’s previous challenge', async () => {
    const first = await issueChallenge(ADDRESS);
    const second = await issueChallenge(ADDRESS);

    // Only the newest is live, so an address can never accumulate challenges.
    expect(await getChallengeStore().consume(ADDRESS)).toEqual(second);
    expect(first.nonce).not.toBe(second.nonce);
  });

  it('refuses an expired challenge', async () => {
    const now = Date.now();
    await issueChallenge(ADDRESS, now - CHALLENGE_TTL_MS - 1);
    expect(await getChallengeStore().consume(ADDRESS)).toBeNull();
  });

  it('keeps challenges separate per address', async () => {
    const challenge = await issueChallenge(ADDRESS);
    expect(await getChallengeStore().consume(`G${'B'.repeat(55)}`)).toBeNull();
    expect(await getChallengeStore().consume(ADDRESS)).toEqual(challenge);
  });

  it('refuses an address that was never issued a challenge', async () => {
    expect(await getChallengeStore().consume(ADDRESS)).toBeNull();
  });
});

describe('challenge message', () => {
  it('binds the address, nonce and window into the signed text', async () => {
    const challenge = await issueChallenge(ADDRESS);
    const message = buildChallengeMessage(challenge);

    expect(message).toContain(`Address: ${ADDRESS}`);
    expect(message).toContain(`Nonce: ${challenge.nonce}`);
    expect(message).toContain(new Date(challenge.expiresAt).toISOString());
  });

  it('is stable for the same challenge', async () => {
    const challenge = await issueChallenge(ADDRESS);
    expect(buildChallengeMessage(challenge)).toBe(buildChallengeMessage(challenge));
  });
});
