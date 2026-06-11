import React from 'react';
import MasterScopedLookupView from './MasterScopedLookupView';

const MasterSourcesView = () => {
  return (
    <div className="w-full">
      <MasterScopedLookupView lookupType="source" />
    </div>
  );
};

export default MasterSourcesView;
