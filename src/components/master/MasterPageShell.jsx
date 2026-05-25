import React from 'react';

const MasterPageShell = ({ title, subtitle, icon, children }) => (
  <div className="max-w-6xl mx-auto space-y-6">
    <div className="flex items-start gap-4">
      <div className="h-12 w-12 rounded-xl bg-crm-primaryLighter flex items-center justify-center shrink-0">
        <i className={`ph-fill ${icon} text-2xl text-crm-primary`} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-crm-textDark">{title}</h1>
        {subtitle && <p className="text-sm text-crm-textMuted mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

export default MasterPageShell;
