import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (username && password) {
      onLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-crm-primaryDark via-crm-primary to-crm-primaryLight flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-crm-primary/10">
        <div className="bg-crm-primaryDark p-8 text-center border-b border-crm-primaryDark/30">
          <h1 className="text-3xl font-black text-white tracking-widest flex items-center justify-center gap-2">
            <i className="ph-fill ph-calendar-star text-white"></i> Event App
          </h1>
          <p className="text-white/70 font-bold text-xs mt-2 uppercase tracking-widest">Lead Management System</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-crm-primary mb-2">Username</label>
              <div className="relative">
                <i className="ph-bold ph-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg outline-none font-medium transition-all crm-input"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-crm-primary">Password</label>
                <a href="#" className="text-xs font-bold text-crm-primary hover:text-crm-primaryDark transition-colors">Forgot password?</a>
              </div>
              <div className="relative">
                <i className="ph-bold ph-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg outline-none font-medium transition-all crm-input"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center">
              <input type="checkbox" id="remember" className="h-4 w-4 text-crm-primary rounded border-gray-300 focus:ring-crm-primary" />
              <label htmlFor="remember" className="ml-2 text-sm font-bold text-gray-500">Remember me</label>
            </div>

            <button type="submit" className="w-full btn-running-border text-white font-black py-3 rounded-lg transition-all shadow-md mt-6 text-lg uppercase tracking-widest">
             Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
