import { describe, it, expect, vi, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

// db/pool opens a real pg connection at module load — the pending2FA
// rejection happens before any DB access, so a stub is enough here and
// keeps this test from needing a real database.
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

  it('accepts a normal token without the pending2FA claim', async () => {
    const token = jwt.sign(
      { id: 1, role: 'teacher', name: 'Test Teacher' },
      process.env.JWT_SECRET, { algorithm: 'HS256' }
    );
    const req  = { headers: { authorization: `Bearer ${token}` } };
    const res  = mockRes();
    const next = vi.fn();

    await authMiddleware('teacher')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('teacher');
  });
});
