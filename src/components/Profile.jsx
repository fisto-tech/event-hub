import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import CityAutocomplete from './common/CityAutocomplete';
import PhoneInput from './common/PhoneInput';
import { parseStoredPhone, digitsOnly, normalizePhoneForSubmit } from '../utils/phoneUtils';

const Profile = ({ user, onProfileUpdate }) => {
  const [activeSection, setActiveSection] = useState('view'); // view | edit | password
  const [profileData, setProfileData] = useState(null);
  const [editData, setEditData] = useState({});
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const formatPhoneForDisplay = (val) => {
    const parsed = parseStoredPhone(val);
    const nat = digitsOnly(parsed.national, 15);
    if (!nat) return '—';
    return `+${parsed.dial} ${nat}`;
  };

  useEffect(() => {
    if (user?.id) loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    try {
      const res = await fetchApi(`auth.php?action=profile&user_id=${user.id}`);
      if (res.status === 'success') {
        setProfileData(res.user);
        setEditData({
          id: res.user.id,
          name: res.user.name || '',
          email: res.user.email || '',
          phone: res.user.phone || '',
          city: res.user.city || '',
          department: res.user.department || ''
        });
      }
    } catch (e) {
      console.error('Profile load error:', e);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Employee phone must be exactly 10 digits if provided.
      if (editData.phone) {
        const parsed = parseStoredPhone(editData.phone);
        const nat = digitsOnly(parsed.national, 15);
        if (nat && nat.length !== 10) {
          showMessage('error', 'Phone number must be exactly 10 digits.');
          setLoading(false);
          return;
        }
      }

      const res = await fetchApi('auth.php?action=profile', {
        method: 'POST',
        body: JSON.stringify({
          ...editData,
          phone: normalizePhoneForSubmit(editData.phone),
        })
      });
      if (res.status === 'success') {
        showMessage('success', 'Profile updated successfully!');
        setProfileData(res.user);
        if (onProfileUpdate) onProfileUpdate(res.user);
        setActiveSection('view');
      } else {
        showMessage('error', res.message);
      }
    } catch (e) {
      showMessage('error', 'Failed to update profile.');
    }
    setLoading(false);
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      showMessage('error', 'New password and confirm password do not match.');
      return;
    }
    if (passwordData.new_password.length < 4) {
      showMessage('error', 'New password must be at least 4 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchApi('auth.php?action=change-password', {
        method: 'POST',
        body: JSON.stringify({
          id: user.id,
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      });
      if (res.status === 'success') {
        showMessage('success', 'Password changed successfully!');
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        setActiveSection('view');
      } else {
        showMessage('error', res.message);
      }
    } catch (e) {
      showMessage('error', 'Failed to change password.');
    }
    setLoading(false);
  };

  if (!profileData) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="ph ph-spinner text-4xl text-crm-primary animate-spin"></i>
      </div>
    );
  }

  const initials = (profileData.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Message Banner */}
      {message.text && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium shadow-sm border transition-all ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          <i className={`ph-fill ${message.type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'} text-lg`}></i>
          {message.text}
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-crm-primaryDark to-crm-primary h-28 relative"></div>
        <div className="px-6 pt-12 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="h-24 w-24 rounded-2xl bg-white text-crm-primary flex items-center justify-center text-3xl font-bold shadow-lg border-4 border-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 pt-2 sm:pb-1">
              <h2 className="text-xl font-semibold text-gray-800">{profileData.name}</h2>
              <p className="text-sm text-crm-primary font-medium capitalize">{profileData.role} • {profileData.department || 'No department'}</p>
            </div>
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => setActiveSection('edit')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeSection === 'edit'
                    ? 'bg-crm-primary text-white shadow-md'
                    : 'bg-crm-primaryLighter text-crm-primary hover:bg-crm-primary hover:text-white'
                }`}
              >
                <i className="ph-bold ph-pencil-simple"></i> Edit Profile
              </button>
              <button
                onClick={() => setActiveSection('password')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeSection === 'password'
                    ? 'bg-crm-primary text-white shadow-md'
                    : 'bg-crm-primaryLighter text-crm-primary hover:bg-crm-primary hover:text-white'
                }`}
              >
                <i className="ph-bold ph-lock-key"></i> Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* View Profile */}
      {activeSection === 'view' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-crm-primary mb-5 flex items-center gap-2">
            <i className="ph-fill ph-identification-card"></i> Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: 'Employee ID', value: profileData.employee_id, icon: 'ph-hash' },
              { label: 'Full Name', value: profileData.name, icon: 'ph-user' },
              { label: 'Username', value: profileData.username, icon: 'ph-at' },
              { label: 'Email Address', value: profileData.email, icon: 'ph-envelope' },
                { label: 'Phone Number', value: formatPhoneForDisplay(profileData.phone), icon: 'ph-phone' },
              { label: 'City', value: profileData.city, icon: 'ph-map-pin' },
              { label: 'Department', value: profileData.department, icon: 'ph-buildings' },
              { label: 'Role', value: profileData.role, icon: 'ph-shield-check' },
              { label: 'Status', value: profileData.status, icon: 'ph-pulse' },
              { label: 'Joined', value: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-', icon: 'ph-calendar' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="h-10 w-10 rounded-lg bg-crm-primaryLighter text-crm-primary flex items-center justify-center shrink-0 mt-0.5">
                  <i className={`ph ${item.icon} text-xl`}></i>
                </div>
                <div>
                  <p className="text-lg text-gray-800 font-medium">{item.label}</p>
                  <p className={`text-md font-semibold text-gray-700 ${item.label === 'Email Address' ? '' : 'capitalize'}`}>
                    {item.label === 'Email Address'
                      ? (item.value ? String(item.value).toLowerCase() : '—')
                      : (item.value || '—')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Profile */}
      {activeSection === 'edit' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-crm-primary mb-5 flex items-center gap-2">
            <i className="ph-fill ph-pencil-simple-line"></i> Edit Profile
          </h3>
          <form onSubmit={handleProfileSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-normal text-crm-primary mb-1">Full Name *</label>
              <input type="text" name="name" required value={editData.name} onChange={handleEditChange}
                className="w-full px-4 py-2.5 rounded-lg outline-none crm-input" placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary mb-1">Email Address *</label>
              <input type="email" name="email" required value={editData.email} onChange={handleEditChange}
                className="w-full px-4 py-2.5 rounded-lg outline-none crm-input" placeholder="email@domain.com" />
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary mb-1">Phone Number</label>
              <div className="mt-1">
                <PhoneInput
                  name="phone"
                  value={editData.phone}
                  onChange={(phone) => setEditData((prev) => ({ ...prev, phone }))}
                  inputClassName="flex-1 px-4 py-2.5 rounded-lg outline-none crm-input"
                  selectClassName="w-[7.5rem] shrink-0 px-2 py-2.5 rounded-lg outline-none crm-input text-sm text-center"
                  placeholder="Phone number"
                  showError={false}
                  maxLength={10}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary mb-1">City</label>
              <div className="mt-1">
                <CityAutocomplete
                  name="city"
                  value={editData.city}
                  onChange={(city) => setEditData((prev) => ({ ...prev, city }))}
                  placeholder="Type to search city…"
                  inputClassName="w-full px-4 py-2.5 rounded-lg outline-none crm-input"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-normal text-crm-primary mb-1">Department</label>
              <input type="text" name="department" value={editData.department} onChange={handleEditChange}
                className="w-full px-4 py-2.5 rounded-lg outline-none crm-input" placeholder="e.g. Sales, Marketing" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setActiveSection('view')}
                className="px-6 py-2.5 text-crm-primary font-medium hover:bg-red-500 hover:text-white hover:border-red-500 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="btn-running-border text-white px-8 py-2.5 rounded-lg font-medium shadow-md disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Change Password */}
      {activeSection === 'password' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-crm-primary mb-5 flex items-center gap-2">
            <i className="ph-fill ph-lock-key"></i> Change Password
          </h3>
          <form onSubmit={handlePasswordSave} className="max-w-md space-y-4">
            <div>
              <label className="block text-sm font-normal text-crm-primary mb-1">Current Password *</label>
              <div className="relative">
                <i className="ph-bold ph-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input type="password" name="current_password" required
                  value={passwordData.current_password} onChange={handlePasswordChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg outline-none crm-input" placeholder="Enter current password" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary mb-1">New Password *</label>
              <div className="relative">
                <i className="ph-bold ph-key absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input type="password" name="new_password" required
                  value={passwordData.new_password} onChange={handlePasswordChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg outline-none crm-input" placeholder="Enter new password" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary mb-1">Confirm New Password *</label>
              <div className="relative">
                <i className="ph-bold ph-lock-simple absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input type="password" name="confirm_password" required
                  value={passwordData.confirm_password} onChange={handlePasswordChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg outline-none crm-input" placeholder="Confirm new password" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setActiveSection('view'); setPasswordData({ current_password: '', new_password: '', confirm_password: '' }); }}
                className="px-6 py-2.5 text-crm-primary font-medium hover:bg-red-500 hover:text-white hover:border-red-500 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="btn-running-border text-white px-8 py-2.5 rounded-lg font-medium shadow-md disabled:opacity-50">
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
