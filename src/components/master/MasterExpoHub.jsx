import React, { useState } from 'react';
import MasterDataTabs from './MasterDataTabs';
import MasterSourcesView from './MasterSourcesView';
import MasterScopedLookupView from './MasterScopedLookupView';
import ExpoDetails from '../ExpoDetails';
import WhatsappTemplates from '../WhatsappTemplates';

const EXPO_TABS = [
  { id: 'sources', label: 'Source/ Expo details', icon: 'ph-link' },
  { id: 'enquiry-details', label: 'Enquiry Types', icon: 'ph-clipboard-text' },
  { id: 'industry-types', label: 'Industry Types', icon: 'ph-buildings' },
  { id: 'whatsapp-template', label: 'WhatsApp Templates', icon: 'ph-whatsapp-logo' },
];

const MasterExpoHub = ({ activeSubTab, setActiveSubTab, currentUser }) => {
  const [sourceTab, setSourceTab] = useState('sources'); // 'sources' or 'expo-details'
  
  const resolved = activeSubTab === 'master-expo' ? 'sources' : activeSubTab;
  const tab = EXPO_TABS.some((t) => t.id === resolved) ? resolved : 'sources';

  const renderPanel = () => {
    switch (tab) {
      case 'sources':
        return (
          <div className="space-y-6">
            <div className="flex bg-gray-100 p-1 rounded-lg w-max mx-auto md:mx-0">
              <button
                onClick={() => setSourceTab('sources')}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                  sourceTab === 'sources' ? 'bg-white text-crm-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sources
              </button>
              <button
                onClick={() => setSourceTab('expo-details')}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                  sourceTab === 'expo-details' ? 'bg-white text-crm-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Expo Details
              </button>
            </div>
            
            {sourceTab === 'sources' ? (
              <MasterSourcesView currentUser={currentUser} />
            ) : (
              <ExpoDetails embedded />
            )}
          </div>
        );
      case 'enquiry-details':
        return <MasterScopedLookupView lookupType="enquiry_type" />;
      case 'industry-types':
        return <MasterScopedLookupView lookupType="industry_type" />;
      case 'whatsapp-template':
        return <WhatsappTemplates embedded />;
      default:
        return (
          <div className="space-y-6">
            <div className="flex bg-gray-100 p-1 rounded-lg w-max mx-auto md:mx-0">
              <button
                onClick={() => setSourceTab('sources')}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                  sourceTab === 'sources' ? 'bg-white text-crm-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sources
              </button>
              <button
                onClick={() => setSourceTab('expo-details')}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                  sourceTab === 'expo-details' ? 'bg-white text-crm-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Expo Details
              </button>
            </div>
            
            {sourceTab === 'sources' ? (
              <MasterSourcesView currentUser={currentUser} />
            ) : (
              <ExpoDetails embedded />
            )}
          </div>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-xl bg-crm-primaryLighter flex items-center justify-center shrink-0">
          <i className="ph-fill ph-gear text-2xl text-crm-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-crm-textDark">Master Data</h1>
          <p className="text-sm text-crm-textMuted mt-0.5">Manage lookup data used across the application</p>
        </div>
      </div>

      <MasterDataTabs tabs={EXPO_TABS} activeId={tab} onChange={setActiveSubTab} />
      {renderPanel()}
    </div>
  );
};

export default MasterExpoHub;
