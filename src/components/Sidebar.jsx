import React, { useState } from 'react';
import logo from "../assets/logo.png"
const Sidebar = ({ activeTab, setActiveTab, activeSubTab, setActiveSubTab, onLogout, isOpen, setIsOpen }) => {
  const [openAccordion, setOpenAccordion] = useState('master-data');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ph-squares-four' },
    { 
      id: 'master-data', 
      label: 'Master Data', 
      icon: 'ph-database',
      subItems: [
        { id: 'expo-details', label: 'Expo Details', icon: 'ph-calendar-star' },
        { id: 'employee-registration', label: 'Employee Registration', icon: 'ph-user-plus' },
        { id: 'employee-report', label: 'Employee Report', icon: 'ph-users-three' }
      ]
    },
    { 
      id: 'registration', 
      label: 'Registration', 
      icon: 'ph-user-plus',
      subItems: [
        { id: 'customer-registration', label: 'Customer Registration', icon: 'ph-user-plus' },
        { id: 'customer-report', label: 'Customer Report', icon: 'ph-chart-bar' }
      ]
    },
    { 
      id: 'follow-up', 
      label: 'Follow up', 
      icon: 'ph-phone-call',
      subItems: [
        { id: 'follow-up-missed', label: 'Missed Followup', icon: 'ph-warning' },
        { id: 'follow-up-upcoming', label: 'Upcoming Followup', icon: 'ph-clock-counter-clockwise' },
        { id: 'follow-up-completed', label: 'Completed Followup', icon: 'ph-check-circle' }
      ]
    },
    { 
      id: 'date-wise-analyse', 
      label: 'Date wise analyse', 
      icon: 'ph-calendar-blank'
    },
  ];

  return (
    <aside className={`fixed md:relative inset-y-0 left-0 w-64 bg-crm-primaryDark text-crm-sidebarText flex flex-col shrink-0 h-full shadow-2xl z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
      <div className="h-16 flex items-center justify-between px-6 bg-crm-primaryDark border-b border-white/10 shrink-0">
        <h1 className="text-white font-semibold tracking-wider  ">
          <img src={logo} className="h-10 w-auto" style={{filter : 'brightness(0) invert(1)'}}/> 
        </h1>
        <button 
          onClick={() => setIsOpen(false)} 
          className="md:hidden text-white/80 hover:text-white p-1 rounded-lg"
        >
          <i className="ph-bold ph-x text-xl"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="mb-6">
          <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Main Menu</h3>
          <ul className="space-y-1">
            {menuItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setOpenAccordion(openAccordion === item.id ? '' : item.id);
                    }
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-lg transition-all text-left sidebar-item ${
                    activeTab === item.id 
                      ? 'bg-white/10 text-white shadow-inner font-semibold border-l-4 border-crm-primaryLight' 
                      : 'text-crm-sidebarText hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <i className={`ph ${item.icon} text-xl shrink-0`}></i>
                    <span>{item.label}</span>
                  </div>
                  {item.subItems && (
                    <i className={`ph-bold ph-caret-${openAccordion === item.id ? 'up' : 'down'} text-sm shrink-0`}></i>
                  )}
                </button>
                {item.subItems && openAccordion === item.id && (
                  <ul className="mt-1 mb-2 space-y-1 pl-11 pr-2">
                    {item.subItems.map(sub => (
                      <li key={sub.id}>
                        <button
                          onClick={() => {
                            setActiveTab(item.id);
                            setActiveSubTab(sub.id);
                            if (window.innerWidth < 768) setIsOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all text-left ${
                            activeSubTab === sub.id 
                              ? 'bg-crm-primary text-white' 
                              : 'text-crm-sidebarText hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <i className={`ph ${sub.icon} text-lg shrink-0`}></i>
                          <span>{sub.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-4 border-t border-white/10 shrink-0 bg-crm-primaryDark">
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-crm-primary hover:bg-white hover:text-crm-primary text-white rounded-lg transition-all font-semibold text-sm border border-transparent shadow-md hover:shadow-lg"
        >
          <i className="ph-bold ph-sign-out text-lg"></i>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
