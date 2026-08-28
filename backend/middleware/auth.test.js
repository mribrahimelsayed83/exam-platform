import { describe, it, expect, vi, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

// db/pool opens a real pg connection at module load — the pending2FA
// rejection happens before any DB access, so a stub is enough here and
// keeps this test from needing a real database.
//
// Note: this only actually covers the pending2FA path below, which never
// touches pool.query. auth.js requires db/pool via CJS require(), and that
// call bypasses Vitest's (ESM-based) vi.mock interception entirely in this
// project's setup — confirmed by db/pool.js's real pool.connect() firing
// for real whenever a test tries to exercise a pool.query()-reliant path
// (tried vi.hoisted + a static top-level import instead of the dynamic one
// below; neither changed the outcome). Any future test of the
// student/teacher/assistant approved-status or session-token checks needs
// that CJS/ESM interop sorted out first — mocking it here silently doesn't
// work, and will fail with a real (failed) DB connection attempt instead.
vi.mock('../db/pool', () => ({ default: { query: vi.fn() } }));

process.env.JWT_SECRET = 'a'.repeat(32); // satisfies server.js's own length check, if it ever runs

let authMiddleware;
beforeAll(async () => {
  authMiddleware = (await import('./auth.js')).default;
});

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('authMiddleware — pending 2FA tokens', () => {
  it('rejects a pending-2FA token even though its role/signature are otherwise valid', async () => {
    const tempToken = jwt.sign(
      { id: 1, role: 'teacher', pending2FA: true },
      process.env.JWT_SECRET, { algorithm: 'HS256' }
    );
    const req  = { headers: { authorization: `Bearer ${tempToken}` } };
    const res  = mockRes();
    const next = vi.fn();

    await authMiddleware('teacher')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // Deliberately no "accepts a normal token" counterpart here anymore: a
  // normal (non-pending2FA) token for any real role now also triggers a
  // pool.query() for the single-active-device check, which — per the note
  // above — can't be mocked in this test file as it stands.
});
