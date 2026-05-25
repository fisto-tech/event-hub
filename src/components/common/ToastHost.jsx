import React, { useEffect, useState } from 'react';
import { subscribeToast } from '../../utils/toast';

const ToastHost = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 2000);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-in slide-in-from-right duration-200 ${
            t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          <i className={`ph-fill ${t.type === 'error' ? 'ph-warning-circle' : 'ph-check-circle'} text-lg`} />
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
