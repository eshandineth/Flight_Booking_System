import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { DbPool } from '../db/pool';
import {
  authenticate,
  AuthenticatedRequest,
  signAuthToken,
  UserRole,
} from '../middleware/auth';

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date | string;
}

export function createAuthRouter(pool: DbPool): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const email =
        typeof req.body?.email === 'string'
          ? req.body.email.trim().toLowerCase()
          : '';
      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';

      if (!name || name.length < 2) {
        res.status(400).json({ error: 'Name must be at least 2 characters' });
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Valid email is required' });
        return;
      }
      if (!password || password.length < 6) {
        res
          .status(400)
          .json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const existing = await pool.query<{ id: number }>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'An account with this email already exists' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const role: UserRole = 'CUSTOMER';

      const result = await pool.query<UserRow>(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at`,
        [name, email, passwordHash, role]
      );

      const user = result.rows[0];
      const token = signAuthToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const email =
        typeof req.body?.email === 'string'
          ? req.body.email.trim().toLowerCase()
          : '';
      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const result = await pool.query<UserRow>(
        'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
        [email]
      );

      const user = result.rows[0];
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = signAuthToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to log in' });
    }
  });

  router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  return router;
}

