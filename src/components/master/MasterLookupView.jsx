import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../utils/api';

const CONFIG = {
  source: {
    title: 'Sources',
    subtitle: 'View and manage custom sources entered by users',
    icon: 'ph-link',
    placeholder: 'e.g. Cold Call, LinkedIn',
  },
  enquiry_type: {
    title: 'Enquiry Details',
    subtitle: 'Manage enquiry types used in customer registration',
    icon: 'ph-clipboard-text',
    placeholder: 'e.g. IDC, Website',
  },
  industry_type: {
    title: 'Industry Types',
    subtitle: 'Manage industry categories for customers and templates',
    icon: 'ph-buildings',
    placeholder: 'e.g. Manufacturing, IT',
  },
};

const MasterLookupView = ({ lookupType }) => {
  const cfg = CONFIG[lookupType];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchApi(`master_data.php?type=${lookupType}`);
      if (res.status === 'success') {
        setItems(res.data || []);
      } else {
        setError(res.message || 'Failed to load data.');
      }
    } catch {
      setError('Could not connect to server.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [lookupType]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await fetchApi('master_data.php', {
        method: 'POST',
        body: JSON.stringify({ type: lookupType, name: newName.trim() }),
      });
      if (res.status === 'success') {
        setNewName('');
        load();
      } else {
        alert(res.message);
      }
    } catch {
      alert('Failed to add item.');
    }
  };

  const handleDelete = async (item) => {
    if (!item.id) {
      alert('This item was entered via customer forms and cannot be deleted here.');
      return;
    }
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      const res = await fetchApi(`master_data.php?id=${item.id}`, { method: 'DELETE' });
      if (res.status === 'success') load();
      else alert(res.message);
    } catch {
      alert('Delete failed.');
    }
  };

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
          <i className={`ph-fill ${cfg.icon} text-2xl text-crm-primary`} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-crm-textDark">{cfg.title}</h2>
          <p className="text-sm text-crm-textMuted mt-0.5">{cfg.subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 max-w-xl">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={cfg.placeholder}
          className="flex-1 px-4 py-2.5 rounded-lg crm-input"
        />
        <button type="submit" className="btn-running-border text-white px-6 py-2.5 rounded-lg font-medium shrink-0">
          <i className="ph-bold ph-plus mr-1" /> Add
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-crm-textDark">All {cfg.title}</span>
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
                className="relative border border-gray-100 rounded-xl p-4 hover:border-crm-primary/30 hover:shadow-sm transition-all group"
              >
                <div className="absolute top-3 right-3 h-9 w-9 rounded-full bg-crm-primaryLighter text-crm-primary flex items-center justify-center font-bold text-sm">
                  {(item.name || '?')[0].toUpperCase()}
                </div>
                {item.id && lookupType !== 'source' && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-sm"
                    title="Delete"
                  >
                    <i className="ph-bold ph-trash" />
                  </button>
                )}
                <p className="font-semibold text-crm-textDark pr-10">{item.name}</p>
                <p className="text-xs text-gray-500 mt-2">{formatDate(item.created_at)}</p>
              </div>
            ))}
            {items.length === 0 && (
              <p className="col-span-full text-center text-gray-400 py-8">No items yet. Add one above.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterLookupView;
