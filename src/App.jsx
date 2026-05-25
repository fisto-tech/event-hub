import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RegistrationForm from './components/RegistrationForm';
import CustomerReport from './components/CustomerReport';
import FollowupManagement from './components/FollowupManagement';
import EmployeeRegistration from './components/EmployeeRegistration';
import { isPrivilegedRole } from './utils/roles';
import ToastHost from './components/common/ToastHost';
import Profile from './components/Profile';
import MasterExpoHub from './components/master/MasterExpoHub';
import MasterPageShell from './components/master/MasterPageShell';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem('isLoggedIn'));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const handleLoginSuccess = (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    sessionStorage.setItem('isLoggedIn', '1');
    sessionStorage.setItem('user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('user');
  };

  const handleProfileUpdate = (updatedUser) => {
    setCurrentUser(prev => ({ ...prev, ...updatedUser }));
    sessionStorage.setItem('user', JSON.stringify({ ...currentUser, ...updatedUser }));
  };

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!isLoggedIn || !currentUser) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  const userRole = currentUser.role || 'employee';
  const userName = currentUser.name || currentUser.username || 'User';
  const userInitials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const handleTabChange = (tabId, subTab = '') => {
    setActiveTab(tabId);
    // Only close sidebar for leaf items — dropdowns are handled inside Sidebar itself
    // so we don't close here unconditionally anymore
    if (subTab) {
      setActiveSubTab(subTab);
      return;
    }
    if (tabId === 'master-data') {
      setActiveSubTab('master-expo');
    } else if (tabId === 'registration') {
      setActiveSubTab('customer-registration');
    } else if (tabId === 'follow-up') {
      setActiveSubTab('follow-up-missed');
    } else if (tabId === 'date-wise-analyse') {
      setActiveSubTab('today-analyse');
    } else {
      setActiveSubTab('');
    }
  };

  useEffect(() => {
    if (activeTab === 'master-data' && !isPrivilegedRole(userRole)) {
      setActiveTab('dashboard');
      setActiveSubTab('');
    }
  }, [activeTab, userRole]);

  const getPageTitle = () => {
    if (activeTab === 'master-data') {
      if (activeSubTab === 'employee-registration') return 'Employee Registration';
      return 'Master Data';
    }
    return activeTab.replace(/-/g, ' ');
  };

  const renderContent = () => {
    if (activeTab === 'profile') {
      return <Profile user={currentUser} onProfileUpdate={handleProfileUpdate} />;
    }
    if (activeTab === 'dashboard') {
      return <Dashboard />;
    }

    if (activeTab === 'master-data') {
      if (
        activeSubTab === 'master-expo' ||
        activeSubTab === 'sources' ||
        activeSubTab === 'expo-details' ||
        activeSubTab === 'enquiry-details' ||
        activeSubTab === 'industry-types' ||
        activeSubTab === 'whatsapp-template'
      ) {
        return <MasterExpoHub activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />;
      }
      switch (activeSubTab) {
        case 'employee-registration':
          return (
            <MasterPageShell
              title="Employee Registration"
              subtitle="Add and manage staff accounts"
              icon="ph-user-plus"
            >
              <EmployeeRegistration />
            </MasterPageShell>
          );
        default:
          return <MasterExpoHub activeSubTab="sources" setActiveSubTab={setActiveSubTab} />;
      }
    }

    switch (activeSubTab) {
      case 'customer-registration':
        return <RegistrationForm currentUser={currentUser} />;
      case 'customer-report':
        return <CustomerReport currentUser={currentUser} />;
      case 'follow-up-missed':
        return <FollowupManagement key="missed" defaultFilter="missed" currentUser={currentUser} />;
      case 'follow-up-upcoming':
        return <FollowupManagement key="upcoming" defaultFilter="upcoming" currentUser={currentUser} />;
      case 'follow-up-completed':
        return <FollowupManagement key="completed" defaultFilter="completed" currentUser={currentUser} />;
      case 'today-analyse':
        return <FollowupManagement key="today" defaultFilter="today" currentUser={currentUser} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <i className="ph ph-wrench text-6xl mb-4 text-slate-600" />
            <h2 className="text-xl font-medium text-slate-300">Select a menu item</h2>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-white font-sans text-crm-textDark overflow-hidden relative">
      {/* Overlay — covers mobile + tablet (below lg = 1024px) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        userRole={userRole}
      />

      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3 lg:gap-6">
            {/* Hamburger — visible on mobile + tablet (below lg) */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-crm-primary hover:bg-crm-primaryLighter transition-colors"
            >
              <i className="ph-bold ph-list text-2xl" />
            </button>
            <h2 className="text-lg lg:text-xl font-medium capitalize text-crm-primary">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-normal text-crm-textDark">{userName}</p>
              <p className="text-xs text-crm-primary font-normal capitalize">
                {userRole === 'super_admin' ? 'Super Admin' : userRole}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTabChange('profile')}
              className="h-10 w-10 rounded-full bg-crm-primaryLighter text-crm-primary flex items-center justify-center font-semibold shadow-sm border border-crm-primary/20 hover:bg-crm-primary hover:text-white transition-all cursor-pointer"
              title="View Profile"
            >
              {userInitials}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 xl:p-8 bg-gray-50 tab-content">
          {renderContent()}
        </main>
      </div>
      <ToastHost />
    </div>
  );
};

export default App;