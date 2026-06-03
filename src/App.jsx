import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RegistrationForm from './components/RegistrationForm';
import CustomerReport from './components/CustomerReport';
import DateWiseAnalysis from './components/DateWiseAnalysis';
import FollowupReport from './components/FollowupReport';
import CustomerFollowup from './components/CustomerFollowup';
import EmployeeRegistration from './components/EmployeeRegistration';
import { isPrivilegedRole } from './utils/roles';
import ToastHost from './components/common/ToastHost';
import Profile from './components/Profile';
import MasterExpoHub from './components/master/MasterExpoHub';
import MasterPageShell from './components/master/MasterPageShell';
import { useLocation, useNavigate } from 'react-router-dom';

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('user');
    // Force a full reload to avoid a blank white flash during React state teardown
    window.location.reload();
  };

  const handleProfileUpdate = (updatedUser) => {
    setCurrentUser(prev => {
      const merged = { ...prev, ...updatedUser };
      // Protect critical fields in case the backend profile response omits them
      if (!merged.id && prev?.id) merged.id = prev.id;
      if (!merged.role && prev?.role) merged.role = prev.role;
      if (!merged.username && prev?.username) merged.username = prev.username;
      
      sessionStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
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

  const getPathFromState = (tabId, subTabId) => {
    if (tabId === 'dashboard') return '/dashboard';
    if (tabId === 'profile') return '/profile';

    if (tabId === 'registration') {
      if (subTabId === 'customer-report') return '/registration/customer-report';
      return '/registration/customer-registration';
    }

    if (tabId === 'follow-up') {
      if (subTabId === 'follow-up-reports') return '/follow-up/reports';
      return '/follow-up/followup';
    }

    if (tabId === 'date-wise-analyse') {
      return '/date-wise-analyse/today';
    }

    if (tabId === 'master-data') {
      if (subTabId === 'employee-registration') return '/master-data/employee-registration';

      // Expo (master-expo + internal tabs)
      const expoTab =
        subTabId === 'sources' ||
        subTabId === 'expo-details' ||
        subTabId === 'enquiry-details' ||
        subTabId === 'industry-types' ||
        subTabId === 'whatsapp-template'
          ? subTabId
          : 'sources';

      return `/master-data/expo/${expoTab}`;
    }

    return '/dashboard';
  };

  const getStateFromPath = (pathname) => {
    const clean = String(pathname || '/').split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const root = parts[0] || 'dashboard';

    if (root === 'dashboard') return { tab: 'dashboard', subTab: '' };
    if (root === 'profile') return { tab: 'profile', subTab: '' };

    if (root === 'registration') {
      const leaf = parts[1] || 'customer-registration';
      return {
        tab: 'registration',
        subTab: leaf === 'customer-report' ? 'customer-report' : 'customer-registration',
      };
    }

    if (root === 'follow-up') {
      const leaf = parts[1] || 'followup';
      return {
        tab: 'follow-up',
        subTab:
          leaf === 'reports'
            ? 'follow-up-reports'
            : 'follow-up-followup',
      };
    }

    if (root === 'date-wise-analyse') {
      return { tab: 'date-wise-analyse', subTab: 'today-analyse' };
    }

    if (root === 'master-data') {
      if (parts[1] === 'employee-registration') {
        return { tab: 'master-data', subTab: 'employee-registration' };
      }
      if (parts[1] === 'expo') {
        const expoLeaf = parts[2] || 'sources';
        const allowed = ['sources', 'expo-details', 'enquiry-details', 'industry-types', 'whatsapp-template'];
        return { tab: 'master-data', subTab: allowed.includes(expoLeaf) ? expoLeaf : 'sources' };
      }
      return { tab: 'master-data', subTab: 'master-expo' };
    }

    // Unknown route => keep behaviour (Dashboard)
    return { tab: 'dashboard', subTab: '' };
  };

  const handleTabChange = (tabId, subTab = '') => {
    setActiveTab(tabId);
    // Only close sidebar for leaf items — dropdowns are handled inside Sidebar itself
    // so we don't close here unconditionally anymore
    if (subTab) {
      setActiveSubTab(subTab);
      navigate(getPathFromState(tabId, subTab));
      return;
    }
    if (tabId === 'master-data') {
      setActiveSubTab('master-expo');
      navigate(getPathFromState(tabId, 'master-expo'));
    } else if (tabId === 'registration') {
      setActiveSubTab('customer-registration');
      navigate(getPathFromState(tabId, 'customer-registration'));
    } else if (tabId === 'follow-up') {
      setActiveSubTab('follow-up-followup');
      navigate(getPathFromState(tabId, 'follow-up-followup'));
    } else if (tabId === 'date-wise-analyse') {
      setActiveSubTab('today-analyse');
      navigate(getPathFromState(tabId, 'today-analyse'));
    } else {
      setActiveSubTab('');
      navigate(getPathFromState(tabId, ''));
    }
  };

  useEffect(() => {
    if (activeTab === 'master-data' && !isPrivilegedRole(userRole)) {
      setActiveTab('dashboard');
      setActiveSubTab('');
      navigate('/dashboard', { replace: true });
    }
  }, [activeTab, userRole]);

  // Sync URL -> state (supports refresh + back/forward) without changing functionality.
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    const next = getStateFromPath(location.pathname);

    // Prevent non-admins from landing on master-data routes via URL.
    if (next.tab === 'master-data' && !isPrivilegedRole(userRole)) {
      if (location.pathname !== '/dashboard') navigate('/dashboard', { replace: true });
      if (activeTab !== 'dashboard') setActiveTab('dashboard');
      if (activeSubTab !== '') setActiveSubTab('');
      return;
    }

    if (activeTab !== next.tab) setActiveTab(next.tab);
    if (activeSubTab !== next.subTab) setActiveSubTab(next.subTab);
  }, [location.pathname, isLoggedIn, currentUser, userRole]);

  const handleSubTabChange = (subTabId) => {
    setActiveSubTab(subTabId);
    navigate(getPathFromState(activeTab, subTabId));
  };

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
      return <Dashboard currentUser={currentUser} />;
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
        return <MasterExpoHub activeSubTab={activeSubTab} setActiveSubTab={handleSubTabChange} currentUser={currentUser} />;
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
          return <MasterExpoHub activeSubTab="sources" setActiveSubTab={handleSubTabChange} currentUser={currentUser} />;
      }
    }

    switch (activeSubTab) {
      case 'customer-registration':
        return <RegistrationForm currentUser={currentUser} />;
      case 'customer-report':
        return <CustomerReport currentUser={currentUser} />;
      case 'follow-up-followup':
        return <CustomerFollowup currentUser={currentUser} />;
      case 'follow-up-reports':
        return <FollowupReport currentUser={currentUser} />;
      case 'today-analyse':
        return <DateWiseAnalysis currentUser={currentUser} />;
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
    <div className="flex h-screen h-[100dvh] bg-white font-sans text-crm-textDark overflow-hidden relative">
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
        setActiveSubTab={handleSubTabChange}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        userRole={userRole}
      />

      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6 shrink-0 shadow-sm">
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
