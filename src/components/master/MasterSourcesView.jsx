import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../utils/api';

const MasterSourcesView = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchApi('master_data.php?type=source');
      if (res && res.status === 'success') {
        setItems(res.data || []);
      } else {
        setError((res && res.message) || 'Failed to load sources.');
      }
    } catch (e) {
      setError(`Could not connect to server. ${e.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (d) => {
    if (!d) return 'From registrations';
    try {
      return `Added ${new Date(d).toLocaleDateString()}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-crm-primaryLighter flex items-center justify-center shrink-0">
          <i className="ph-fill ph-link text-2xl text-crm-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-crm-textDark">Sources</h2>
          <p className="text-sm text-crm-textMuted mt-0.5">
            View and manage custom sources entered by users
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-crm-textDark">All Sources</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="p-2 text-gray-400 hover:text-crm-primary rounded-lg hover:bg-gray-50"
              title="Refresh"
            >
              <i className="ph-bold ph-arrows-clockwise" />
            </button>
            <span className="h-7 min-w-[1.75rem] px-2 flex items-center justify-center rounded-full bg-crm-primary text-white text-xs font-semibold">
              {items.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <i className="ph ph-spinner animate-spin text-3xl" />
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="relative border border-gray-100 rounded-xl p-4 hover:border-crm-primary/30 hover:shadow-sm transition-all"
              >
                <div className="absolute top-3 right-3 h-9 w-9 rounded-full bg-crm-primaryLighter text-crm-primary flex items-center justify-center font-bold text-sm">
                  {(item.name || '?')[0].toUpperCase()}
                </div>
                <p className="font-semibold text-crm-textDark pr-10">{item.name}</p>
                <p className="text-xs text-gray-500 mt-2">{formatDate(item.created_at)}</p>
              </div>
            ))}
            {items.length === 0 && (
              <p className="col-span-full text-center text-gray-400 py-8">
                No sources yet. They appear when customers register with Expo set to None and a reference source.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 rounded-xl bg-crm-primaryLighter/50 border border-crm-primary/15 px-4 py-3 text-sm text-crm-primary">
        <i className="ph-fill ph-info text-lg shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold">Note:</span> These sources are automatically created when users enter a
          reference source during customer registration with Expo set to None (general). Deletion is not allowed to
          maintain data integrity.
        </p>
      </div>
    </div>
  );
};

export default MasterSourcesView;
