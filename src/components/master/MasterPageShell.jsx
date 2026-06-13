import React from 'react';

const MasterPageShell = ({ title, subtitle, icon, children }) => (
  <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pt-8 lg:pt-10 space-y-6 min-h-screen">
    <div className="flex items-start gap-4">
      <div className="h-12 w-12 rounded-xl bg-[#00b5e2]/10 flex items-center justify-center shrink-0">
        <i className={`ph-fill ${icon} text-2xl text-[#00b5e2]`} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[#1e293b]">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

export default MasterPageShell;
