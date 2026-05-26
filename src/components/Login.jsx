import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import logo from '../assets/logo.png';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetchApi('auth.php?action=login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (res.status === 'success' && res.user) {
        sessionStorage.setItem('isLoggedIn', '1');
        sessionStorage.setItem('user', JSON.stringify(res.user));
        if (remember) {
          localStorage.setItem('rememberUsername', username.trim());
        } else {
          localStorage.removeItem('rememberUsername');
        }
        // Force a page reload to ensure the app mounts with full session context, fixing the blank screen bug
        window.location.reload();
      } else {
        setError(res.message || 'Login failed. Please try again.');
      }
    } catch {
      setError('Unable to connect to server. Please try again later.');
    }
    setLoading(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('rememberUsername');
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-crm-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-crm-primary px-8 py-6 text-center">
          <img src={logo} alt="Event App" className="w-auto h-12 mx-auto mb-3 brightness-0 invert" />
          <h1 className="text-xl font-bold text-white">Event App</h1>
          <p className="text-white/70 text-xs mt-1">Lead Management System</p>
        </div>

        <div className="p-8">
          <h2 className="text-lg font-semibold text-crm-textDark text-center mb-6">Login</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2.5 rounded-lg mb-4 text-sm border border-red-100">
              <i className="ph-fill ph-warning-circle shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-crm-textDark mb-1.5">Username</label>
              <div className="relative">
                <i className="ph-bold ph-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg crm-input"
                  placeholder="Enter username"
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-crm-textDark mb-1.5">Password</label>
              <div className="relative">
                <i className="ph-bold ph-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg crm-input"
                  placeholder="Enter password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-crm-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`ph-bold text-lg ${showPassword ? 'ph-eye-slash' : 'ph-eye'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 text-crm-textMuted cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={loading}
                  className="rounded border-gray-300 text-crm-primary focus:ring-crm-primary"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => alert('Please contact your administrator to reset your password.')}
                className="text-crm-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-running-border text-white font-semibold py-2.5 rounded-lg mt-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ph ph-spinner animate-spin" />
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
