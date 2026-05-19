import React, { useState } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RegistrationForm from './components/RegistrationForm';
import ExpoDetails from './components/ExpoDetails';
import CustomerReport from './components/CustomerReport';
import WhatsappTemplates from './components/WhatsappTemplates';
import FollowupManagement from './components/FollowupManagement';
import EmployeeRegistration from './components/EmployeeRegistration';
import EmployeeReport from './components/EmployeeReport';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem('isLoggedIn'));
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    sessionStorage.setItem('isLoggedIn', '1');
  };
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!isLoggedIn) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setIsSidebarOpen(false); // auto close mobile sidebar
    if (tabId === 'master-data') {
      setActiveSubTab('expo-details');
    } else if (tabId === 'registration') {
      setActiveSubTab('customer-registration');
    } else if (tabId === 'report') {
      setActiveSubTab('customer-report');
    } else if (tabId === 'follow-up') {
      setActiveSubTab('follow-up-daily');
    } else {
      setActiveSubTab('');
    }
  };

  const getSubmenuItems = () => {
    switch (activeTab) {
      case 'master-data':
        return [
          { id: 'expo-details', label: 'Expo Details', icon: 'ph-calendar-star' },
          { id: 'whatsapp-template', label: 'WhatsApp Templates', icon: 'ph-whatsapp-logo' }
        ];
      case 'registration':
        return [
          { id: 'customer-registration', label: 'Customer Registration', icon: 'ph-user-plus' },
          { id: 'employee-registration', label: 'Employee Registration', icon: 'ph-users-three' }
        ];
      case 'report':
        return [
          { id: 'customer-report', label: 'Customer Report', icon: 'ph-chart-bar' },
          { id: 'employee-report', label: 'Employee Report', icon: 'ph-users' }
        ];
      case 'follow-up':
        return [
          { id: 'follow-up-daily', label: 'Date Wise Analyse (Daily)', icon: 'ph-calendar-blank' },
          { id: 'follow-up-upcoming', label: 'Upcoming Followup', icon: 'ph-clock-counter-clockwise' },
          { id: 'follow-up-missed', label: 'Missed Followup', icon: 'ph-warning' }
        ];
      default:
        return [];
    }
  };

  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return <Dashboard />;
    }

    switch (activeSubTab) {
      case 'expo-details':
        return <ExpoDetails />;
      case 'whatsapp-template':
        return <WhatsappTemplates />;
      case 'customer-registration':
        return <RegistrationForm />;
      case 'employee-registration':
        return <EmployeeRegistration />;
      case 'customer-report':
        return <CustomerReport />;
      case 'employee-report':
        return <EmployeeReport />;
      case 'follow-up-daily':
        return <FollowupManagement key="today" defaultFilter="today" />;
      case 'follow-up-upcoming':
        return <FollowupManagement key="upcoming" defaultFilter="upcoming" />;
      case 'follow-up-missed':
        return <FollowupManagement key="missed" defaultFilter="missed" />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <i className="ph ph-wrench text-6xl mb-4 text-slate-600"></i>
            <h2 className="text-xl font-medium text-slate-300">Module under construction</h2>
            <p className="mt-2 text-slate-500">This section will be built soon!</p>
          </div>
        );
    }
  };

  const submenuItems = getSubmenuItems();

  return (
    <div className="flex h-screen bg-white font-sans text-crm-textDark overflow-hidden relative">
      {/* Mobile Sidebar Backdrop overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        onLogout={() => {
    setIsLoggedIn(false);
    sessionStorage.removeItem('isLoggedIn');
  }} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3 md:gap-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg text-crm-primary hover:bg-crm-primaryLighter transition-colors"
            >
              <i className="ph-bold ph-list text-2xl"></i>
            </button>
            
            <h2 className="text-lg md:text-xl font-black capitalize text-crm-primary">
              {activeTab.replace('-', ' ')}
            </h2>
            
            {submenuItems.length > 0 && (
              <div className="hidden md:flex items-center gap-2 border-l border-gray-200 pl-6">
                {submenuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSubTab(item.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-black transition-all flex items-center gap-1.5 ${
                      activeSubTab === item.id 
                        ? 'bg-crm-primary text-white shadow-sm' 
                        : 'text-crm-primary hover:bg-crm-primaryLighter'
                    }`}
                  >
                    <i className={`ph ${item.icon}`}></i>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-crm-textDark">Admin User</p>
              <p className="text-xs text-crm-primary font-bold">Administrator</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-crm-primaryLighter text-crm-primary flex items-center justify-center font-black shadow-sm border border-crm-primary/20">
              A
            </div>
          </div>
        </header>

        {/* Mobile/Tablet Submenu (Visible when header space is narrow) */}
        {submenuItems.length > 0 && (
          <div className="flex md:hidden bg-gray-50 border-b border-gray-200 px-4 py-2 gap-2 overflow-x-auto shrink-0 scrollbar-none">
            {submenuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${
                  activeSubTab === item.id 
                    ? 'bg-crm-primary text-white shadow-sm' 
                    : 'text-crm-primary hover:bg-crm-primaryLighter'
                }`}
              >
                <i className={`ph ${item.icon}`}></i>
                {item.label}
              </button>
            ))}
          </div>
        )}
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-gray-50 tab-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;