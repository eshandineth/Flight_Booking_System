import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: User) => void;
  subtitle?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  subtitle,
}: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const signedInUser =
        mode === 'login'
          ? await login(email, password)
          : await register(name, email, password);
      onSuccess?.(signedInUser);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(type: 'customer' | 'admin') {
    setMode('login');
    setError('');
    if (type === 'customer') {
      setEmail('customer@skybooker.com');
      setPassword('CustomerPassword123!');
    } else {
      setEmail('admin@skybooker.com');
      setPassword('AdminPassword123!');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="auth-modal-title">
              {mode === 'login' ? 'Welcome Back' : 'Create Customer Account'}
            </h2>
            <p className="muted-text">
              {subtitle ||
                (mode === 'login'
                  ? 'Sign in to book flights or manage reservations'
                  : 'Register as a customer to book seats in seconds')}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Register
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-stack">
          {mode === 'register' && (
            <label className="field">
              <span>Full Name</span>
              <div className="input-icon">
                <UserIcon size={16} />
                <input
                  type="text"
                  required
                  minLength={2}
                  placeholder="Amaya Perera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </label>
          )}

          <label className="field">
            <span>Email Address</span>
            <div className="input-icon">
              <Mail size={16} />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="input-icon">
              <Lock size={16} />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>

          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={submitting}
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>

        <div className="demo-box">
          <span className="demo-label">Quick Demo Logins:</span>
          <div className="demo-actions">
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => fillDemo('customer')}
            >
              Fill Customer
            </button>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => fillDemo('admin')}
            >
              Fill Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

