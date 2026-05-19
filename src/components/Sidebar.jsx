import React from 'react';

const Sidebar = ({ activeTab, setActiveTab, onLogout, isOpen, setIsOpen }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ph-squares-four' },
    { id: 'master-data', label: 'Master Data', icon: 'ph-database' },
    { id: 'registration', label: 'Registration', icon: 'ph-user-plus' },
    { id: 'report', label: 'Reports', icon: 'ph-chart-bar' },
    { id: 'follow-up', label: 'Followups', icon: 'ph-phone-call' },
  ];

  return (
    <aside className={`fixed md:relative inset-y-0 left-0 w-64 bg-crm-primary text-white flex flex-col shrink-0 h-full shadow-2xl z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
      <div className="h-16 flex items-center justify-between px-6 bg-crm-primaryDark border-b border-crm-primaryDark/30 shrink-0">
        <h1 className="text-white text-2xl font-black tracking-wider flex items-center gap-2">
          <i className="ph-fill ph-calendar-star text-white"></i> EventHub
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
          <h3 className="px-4 text-xs font-bold text-red-200 uppercase tracking-wider mb-2">Main Menu</h3>
          <ul className="space-y-1">
            {menuItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all sidebar-item ${
                    activeTab === item.id 
                      ? 'bg-crm-primaryDark text-white shadow-inner font-extrabold border-l-4 border-white' 
                      : 'text-white/80 hover:bg-crm-primaryLight hover:text-white'
                  }`}
                >
                  <i className={`ph ${item.icon} text-xl`}></i>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-4 border-t border-crm-primaryDark/30 shrink-0 bg-crm-primaryDark">
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-crm-primary hover:bg-white hover:text-crm-primary text-white rounded-lg transition-all font-bold text-sm border border-transparent shadow-md hover:shadow-lg"
        >
          <i className="ph-bold ph-sign-out text-lg"></i>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
