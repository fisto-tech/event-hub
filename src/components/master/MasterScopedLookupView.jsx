import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../utils/api';
import { showToast } from '../../utils/toast';
import { confirmDelete } from '../../utils/confirm';
import LoadingSpinner from '../common/LoadingSpinner';

const CONFIG = {
  enquiry_type: {
    title: 'Enquiry Types',
    subtitle: 'Define enquiry categories',
    icon: 'ph-clipboard-text',
    addLabel: 'Add Enquiry Type',
    placeholder: 'Enter enquiry type name...',
    savedMsg: 'Enquiry type saved successfully!',
    updatedMsg: 'Enquiry type updated successfully!',
    deletedMsg: 'Enquiry type deleted successfully!',
  },
  industry_type: {
    title: 'Industry Types',
    subtitle: 'Define industry categories',
    icon: 'ph-buildings',
    addLabel: 'Add Industry Type',
    placeholder: 'Enter industry type name...',
    savedMsg: 'Industry type saved successfully!',
    updatedMsg: 'Industry type updated successfully!',
    deletedMsg: 'Industry type deleted successfully!',
  },
};

const MasterScopedLookupView = ({ lookupType }) => {
  const cfg = CONFIG[lookupType];
  const [expos, setExpos] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expoId, setExpoId] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const loadExpos = async () => {
    try {
      const res = await fetchApi('expos.php');
      if (res.status === 'success') setExpos(res.data || []);
    } catch {
      /* ignore */
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const query = expoId
        ? `master_data.php?type=${lookupType}&expo_id=${expoId}`
        : `master_data.php?type=${lookupType}`;
      const res = await fetchApi(query);
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
    loadExpos();
  }, []);

  useEffect(() => {
    load();
  }, [lookupType, expoId]);

  const resetForm = () => {
    setNewName('');
    setEditingId(null);
    setExpoId('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      if (editingId) {
        const res = await fetchApi('master_data.php', {
          method: 'PUT',
          body: JSON.stringify({
            id: editingId,
            type: lookupType,
            name: newName.trim(),
            expo_id: expoId || null,
          }),
        });
        if (res.status === 'success') {
          showToast(cfg.updatedMsg);
          resetForm();
          load();
        } else {
          showToast(res.message || 'Update failed', 'error');
        }
      } else {
        const res = await fetchApi('master_data.php', {
          method: 'POST',
          body: JSON.stringify({
            type: lookupType,
            name: newName.trim(),
            expo_id: expoId || null,
          }),
        });
        if (res.status === 'success') {
          showToast(cfg.savedMsg);
          resetForm();
          load();
        } else {
          showToast(res.message || 'Save failed', 'error');
        }
      }
    } catch {
      showToast('Could not save entry.', 'error');
    }
  };

  const handleEdit = (item) => {
    if (!item.id) {
      showToast('Items from customer forms cannot be edited here.', 'error');
      return;
    }
    setEditingId(item.id);
    setNewName(item.name);
    setExpoId(item.expo_id ? String(item.expo_id) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    if (!item.id) {
      showToast('Items from customer forms cannot be deleted here.', 'error');
      return;
    }
    if (!confirmDelete(`"${item.name}"`)) return;
    try {
      const res = await fetchApi(`master_data.php?id=${item.id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        showToast(cfg.deletedMsg);
        if (editingId === item.id) resetForm();
        load();
      } else {
        showToast(res.message || 'Delete failed', 'error');
      }
    } catch {
      showToast('Delete failed.', 'error');
    }
  };

  const savingLabel = expoId
    ? expos.find((e) => String(e.id) === String(expoId))?.expo_name || 'Selected Expo'
    : 'All Expos';

  const scopeLabel = (item) => {
    if (!item.expo_id && !item.expo_name) return 'All Expos';
    return item.expo_name || `Expo #${item.expo_id}`;
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

      <div className="bg-white rounded-xl border border-crm-primary/15 shadow-sm overflow-hidden">
        <div className="bg-crm-primaryLighter/80 px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-crm-primary/10">
          <span className="font-bold text-crm-primary text-base" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            {editingId ? `Edit ${cfg.title.slice(0, -1)}` : cfg.addLabel}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-crm-primary/80" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            Leave expo blank = general (all expos)
          </span>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Expo (blank = all expos)
              </label>
              <select
                value={expoId}
                onChange={(e) => setExpoId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg crm-input text-sm"
              >
                <option value="">— General (All Expos) —</option>
                {expos.map((expo) => (
                  <option key={expo.id} value={expo.id}>
                    {expo.expo_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={cfg.placeholder}
                className="w-full px-3 py-2.5 rounded-lg crm-input text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <p className="text-sm text-gray-500">
              Saving as:{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                {savingLabel}
              </span>
            </p>
            <div className="flex gap-2 self-end sm:self-auto">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn-running-border text-white px-5 py-2.5 rounded-lg font-medium text-sm"
              >
                <i className={`ph-bold ${editingId ? 'ph-floppy-disk' : 'ph-plus'} mr-1`} />
                {editingId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </div>
        </form>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <LoadingSpinner label="Loading entries..." className="py-8" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <li
                  key={item.id ? `id-${item.id}` : `n-${item.name}-${idx}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-gray-50/80"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-crm-textDark truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{scopeLabel(item)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="text-crm-primary hover:text-crm-primaryDark p-2"
                          title="Edit"
                        >
                          <i className="ph-bold ph-pencil-simple" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="text-red-500 hover:text-red-700 p-2"
                          title="Delete"
                        >
                          <i className="ph-bold ph-trash" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 px-2">From forms</span>
                    )}
                  </div>
                </li>
              ))}
              {items.length === 0 && (
                <li className="px-5 py-10 text-center text-gray-400 text-sm">No entries yet. Add one above.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="flex gap-3 rounded-xl bg-crm-primaryLighter/50 border border-crm-primary/15 px-4 py-3 text-sm text-crm-primary">
        <i className="ph-fill ph-info text-lg shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold">Note:</span> Custom values from customer registration appear automatically.
          Only admin-added entries can be edited or deleted here.
        </p>
      </div>
    </div>
  );
};

export default MasterScopedLookupView;
