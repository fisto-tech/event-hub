import React, { useEffect, useState } from 'react';
import logo from "../assets/logo.png";
import { isPrivilegedRole } from '../utils/roles';

const Sidebar = ({ activeTab, setActiveTab, activeSubTab, setActiveSubTab, onLogout, isOpen, setIsOpen, userRole }) => {
  const [openAccordion, setOpenAccordion] = useState('');

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ph-squares-four' },
    { 
      id: 'master-data', 
      label: 'Master Data', 
      icon: 'ph-database',
      adminOnly: true,
      subItems: [
        { id: 'master-expo', label: 'Expo', icon: 'ph-storefront' },
        { id: 'employee-registration', label: 'Employee Registration', icon: 'ph-user-plus' },
        // { id: 'master-allocation', label: 'Allocation', icon: 'ph-arrows-left-right' },
      ]
    },
    { 
      id: 'registration', 
      label: 'Registration', 
      icon: 'ph-user-plus',
      subItems: [
        { id: 'customer-registration', label: 'Customer Registration', icon: 'ph-user-plus' },
        { id: 'customer-report', label: 'Customer Data', icon: 'ph-chart-bar' }
      ]
    },
    { 
      id: 'follow-up', 
      label: 'Customer Followup', 
      icon: 'ph-phone-call',
      subItems: [
        { id: 'follow-up-followup', label: 'Follow up', icon: 'ph-phone-call' },
        { id: 'follow-up-reports', label: 'Followup Reports', icon: 'ph-chart-bar' }
      ]
    },
    { 
      id: 'date-wise-analyse', 
      label: 'Date wise analyse', 
      icon: 'ph-calendar-blank'
    },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (item.adminOnly && !isPrivilegedRole(userRole)) return false;
    return true;
  });

  // Keep the sidebar accordion in sync with the active section (especially after refresh / URL navigation).
  useEffect(() => {
    const shouldOpen = ['master-data', 'registration', 'follow-up'].includes(activeTab);
    setOpenAccordion(shouldOpen ? activeTab : '');
  }, [activeTab]);

  // lg = 1024px — both mobile AND tablet behave the same (hidden by default)
  const isMobileOrTablet = () => window.innerWidth < 1024;

  const handleParentClick = (e, item) => {
    e.stopPropagation();

    if (item.subItems) {
      const opening = openAccordion !== item.id;

      // Mobile/tablet: only toggle accordion — do NOT touch activeTab/activeSubTab
      // (those changes cause the parent layout to call setIsOpen(false))
      setOpenAccordion(opening ? item.id : '');

      // Desktop only: also navigate and auto-select first sub-item
      if (!isMobileOrTablet()) {
        // Important: use the same navigation entry-point so tab + subtab are applied together
        // (prevents accidental redirects due to async state updates).
        setActiveTab(item.id, opening ? item.subItems[0].id : '');
      }
    } else {
      setActiveTab(item.id);
      if (isMobileOrTablet()) setIsOpen(false);
    }
  };

  const handleSubItemClick = (e, item, sub) => {
    e.stopPropagation();
    // Important: navigate using the parent's handler so activeTab + activeSubTab stay in sync.
    setActiveTab(item.id, sub.id);
    // Close sidebar only after the user has chosen a sub-item
    if (isMobileOrTablet()) setIsOpen(false);
  };

  return (
    <aside
      className={`
        fixed lg:relative inset-y-0 left-0 w-80
        bg-crm-primaryDark text-crm-sidebarText
        flex flex-col shrink-0 h-full  z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-center bg-crm-primaryDark border-b border-white/10 shrink-0 w-full relative">
        <h1 className="text-white font-semibold tracking-wider">
          <img src={logo} className="h-10 w-auto" style={{ filter: 'brightness(0) invert(1)' }} alt="Logo" />
        </h1>
        {/* Close button visible on mobile + tablet */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute right-4 text-white/80 hover:text-white p-1 rounded-lg"
        >
          <i className="ph-bold ph-x text-xl"></i>
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ul className="space-y-1">
          {menuItems.map(item => {
            const isAccordionOpen = openAccordion === item.id;
            const isActive = activeTab === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={(e) => handleParentClick(e, item)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3
                    text-md font-semibold rounded-lg transition-all text-left sidebar-item
                    ${isActive
                      ? 'bg-white/10 text-white shadow-inner border-l-4 border-crm-primaryLight'
                      : 'text-crm-sidebarText hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <i className={`ph ${item.icon} text-xl shrink-0`}></i>
                    <span>{item.label}</span>
                  </div>
                  {item.subItems && (
                    <i
                      className={`ph-bold ${isAccordionOpen ? 'ph-caret-up' : 'ph-caret-down'} text-sm shrink-0`}
                      style={{ transition: 'transform 0.2s ease' }}
                    ></i>
                  )}
                </button>

                {/* Sub-items with smooth expand/collapse */}
                {item.subItems && (
                  <div
                    style={{
                      maxHeight: isAccordionOpen ? `${item.subItems.length * 52}px` : '0px',
                      overflow: 'hidden',
                      transition: 'max-height 0.25s ease-in-out',
                    }}
                  >
                    <ul className="mt-1 mb-2 space-y-1 pl-4 pr-2">
                      {item.subItems.map(sub => {
                        const isSubActive =
                          activeSubTab === sub.id ||
                          (sub.id === 'master-expo' &&
                            ['sources', 'expo-details', 'enquiry-details', 'industry-types', 'whatsapp-template'].includes(activeSubTab));

                        return (
                          <li key={sub.id}>
                            <button
                              onClick={(e) => handleSubItemClick(e, item, sub)}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2
                                text-sm font-semibold rounded-lg transition-all text-left
                                ${isSubActive
                                  ? 'bg-white/20 text-white'
                                  : 'text-crm-sidebarText hover:bg-white/10 hover:text-white'
                                }
                              `}
                            >
                              <i className={`ph ${sub.icon} text-lg shrink-0`}></i>
                              <span>{sub.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Logout */}
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
