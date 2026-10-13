import { beforeAll, expect, it } from 'vitest';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { verifyToken, authFailure } from './index';
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let keys: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  pair = await generateKeyPair('ES256');
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'ES256' }],
  });
});
const sign = (
  issuer = 'https://identity.test',
  audience = 'authenticated',
  expiry = '2m',
) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'test' })
    .setSubject('alice')
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiry)
    .sign(pair.privateKey);
it('accepts a correctly signed token for the expected identity provider', async () => {
  expect(
    await verifyToken(
      await sign(),
      'https://identity.test',
      'authenticated',
      keys,
    ),
  ).toBe('alice');
});
it('rejects an expired token', async () => {
  await expect(
    verifyToken(
      await sign(undefined, undefined, '-1m'),
      'https://identity.test',
      'authenticated',
      keys,
    ),
  ).rejects.toThrow();
});
it('rejects another issuer or audience', async () => {
  for (const token of [
    await sign('https://other.test'),
    await sign(undefined, 'other'),
  ])
    await expect(
      verifyToken(token, 'https://identity.test', 'authenticated', keys),
    ).rejects.toThrow();
});
it('rejects a modified signature and unsigned token', async () => {
  const token = await sign();
  const parts = token.split('.');
  const signature = Buffer.from(parts[2], 'base64url');
  signature[0] ^= 255;
  parts[2] = signature.toString('base64url');
  for (const value of [parts.join('.'), 'eyJhbGciOiJub25lIn0.e30.'])
    await expect(
      verifyToken(value, 'https://identity.test', 'authenticated', keys),
    ).rejects.toThrow();
});

it('distinguishes invalid JWTs from an unavailable identity provider without relaxing authorization', () => {
  expect(authFailure({ code: 'ERR_JWT_EXPIRED' }).status).toBe(401);
  expect(
    authFailure({ code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' }).status,
  ).toBe(401);
  expect(authFailure({ code: 'ERR_JWKS_TIMEOUT' }).status).toBe(503);
  expect(authFailure(new TypeError('fetch failed')).status).toBe(503);
});
