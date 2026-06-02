import React from 'react';

export const DetailField = ({ label, value, colSpan = 1, children }) => (
  <div className={colSpan === 2 ? 'sm:col-span-2' : ''}>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
    {children ?? <p className="text-sm font-medium text-gray-800 break-words">{value ?? '-'}</p>}
  </div>
);

export const EditField = ({ label, required, colSpan = 1, children }) => (
  <div className={colSpan === 2 ? 'sm:col-span-2' : ''}>
    <label className="block text-xs font-semibold text-crm-primary mb-1.5">
      {label}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputClass =
  'w-full px-3 py-2.5 rounded-lg crm-input text-sm transition-all focus:ring-2 focus:ring-crm-primary/10';

export const reportInputClass = inputClass;

const ReportModalShell = ({
  title,
  icon = 'ph-eye',
  onClose,
  children,
  footer,
  maxWidth = 'max-w-2xl',
  variant = 'view',
}) => (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
    role="presentation"
  >
    <div
      className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`shrink-0 px-6 py-4 flex items-center justify-between border-b ${
          variant === 'edit' ? 'bg-crm-primary/5 border-crm-primary/15' : 'bg-crm-primaryLighter border-crm-primary/10'
        }`}
      >
        <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
          <i className={`ph-fill ${icon}`} />
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <i className="ph-bold ph-x text-lg" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">{children}</div>
      {footer && (
        <div className="shrink-0 px-6 py-4 bg-gray-50/90 border-t border-gray-100 flex justify-end gap-3">
          {footer}
        </div>
      )}
    </div>
  </div>
);

export default ReportModalShell;
