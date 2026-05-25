import React from 'react';

const MasterDataTabs = ({ tabs, activeId, onChange }) => (
  <div className="flex flex-wrap gap-1 p-1.5 bg-gray-100 rounded-xl mb-6">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onChange(tab.id)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
          activeId === tab.id
            ? 'bg-crm-primary text-white shadow-sm'
            : 'text-gray-600 hover:text-crm-primary hover:bg-white'
        }`}
      >
        <i className={`ph ${tab.icon} text-lg`} />
        <span>{tab.label}</span>
      </button>
    ))}
  </div>
);

export default MasterDataTabs;
