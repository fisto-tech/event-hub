import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../utils/api';
import { showToast } from '../../utils/toast';
import { confirmDelete } from '../../utils/confirm';
import LoadingSpinner from '../common/LoadingSpinner';

const CONFIG = {
  source: {
    title: 'Sources',
    subtitle: 'Define lead source categories',
    icon: 'ph-link',
    addLabel: 'Add Source',
    placeholder: 'Enter source name...',
    savedMsg: 'Source saved successfully!',
    updatedMsg: 'Source updated successfully!',
    deletedMsg: 'Source deleted successfully!',
  },
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

  const [viewingGroup, setViewingGroup] = useState(null);

  const groupedItems = React.useMemo(() => {
    const groups = {};
    items.forEach(item => {
      const key = item.expo_name || 'General (All Expos)';
      if (!groups[key]) groups[key] = { expoName: key, items: [] };
      groups[key].items.push(item);
    });
    return Object.values(groups).sort((a, b) => a.expoName.localeCompare(b.expoName));
  }, [items]);

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
    <div className="">
      <div className="flex items-start gap-4 mb-6">
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

      {lookupType !== 'source' && (
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
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-300 mt-6">
        <div className="overflow-x-auto">
          {loading ? (
            <LoadingSpinner label="Loading entries..." className="py-8" />
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-crm-primary text-white text-sm">
                  <th className="px-4 py-3 font-medium border border-gray-300 w-16 text-center">S.No</th>
                  <th className="px-4 py-3 font-medium border border-gray-300">Expo Name</th>
                  <th className="px-4 py-3 font-medium border border-gray-300 text-center w-32">Total Items</th>
                  <th className="px-4 py-3 font-medium border border-gray-300 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.map((group, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-300 hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="px-4 py-3 text-center border border-gray-300 text-sm">{index + 1}</td>
                    <td className="px-4 py-3 border border-gray-300 font-medium text-gray-800">
                      {group.expoName}
                    </td>
                    <td className="px-4 py-3 border border-gray-300 text-center text-gray-600">
                      <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                        {new Set(group.items.map(i => (i.name || '').toLowerCase().trim())).size}
                      </span>
                    </td>
                    <td className="px-4 py-3 border border-gray-300 text-center">
                      <button
                        type="button"
                        onClick={() => setViewingGroup(group)}
                        className="text-crm-primary hover:opacity-80 px-3 py-1.5 rounded-lg border border-crm-primary hover:bg-crm-primary hover:text-white transition-colors text-sm font-medium flex items-center justify-center gap-1.5 mx-auto"
                        title="View Details"
                      >
                        <i className="ph-bold ph-eye text-lg" /> View
                      </button>
                    </td>
                  </tr>
                ))}
                {groupedItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm border border-gray-300">
                      No entries yet. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingGroup(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-screen" onClick={e => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className={`ph-fill ${cfg.icon}`} /> {viewingGroup.expoName} - {cfg.title}
              </h3>
              <button type="button" onClick={() => setViewingGroup(null)} className="text-gray-500 hover:text-gray-800">
                <i className="ph-bold ph-x text-lg" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-crm-primary sticky top-0 text-white shadow-sm">
                  <tr>
                    <th className="px-6 py-3 font-medium text-sm w-16 text-center border border-gray-300">S.No</th>
                    <th className="px-6 py-3 font-medium text-sm border border-gray-300">Name</th>
                    <th className="px-6 py-3 font-medium text-sm text-center w-36 border border-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const seen = new Set();
                    const uniqueItems = viewingGroup.items.filter(item => {
                      const lowerName = (item.name || '').toLowerCase().trim();
                      if (seen.has(lowerName)) return false;
                      seen.add(lowerName);
                      return true;
                    });
                    return uniqueItems.map((item, idx) => (
                      <tr key={item.id ? `id-${item.id}` : `n-${item.name}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-3 text-sm text-center text-gray-600 border border-gray-300">{idx + 1}</td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-800 border border-gray-300">{item.name}</td>
                        <td className="px-6 py-3 text-center border border-gray-300">
                          <div className="flex items-center justify-center gap-3">
                            {item.id ? (
                              <>
                                <button
                                  onClick={() => { setViewingGroup(null); handleEdit(item); }}
                                  className="text-crm-primary hover:opacity-80"
                                  title="Edit"
                                >
                                  <i className="ph-bold ph-pencil-simple text-lg" />
                                </button>
                                <button
                                  onClick={() => { setViewingGroup(null); handleDelete(item); }}
                                  className="text-red-500 hover:text-red-700"
                                  title="Delete"
                                >
                                  <i className="ph-bold ph-trash text-lg" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400 italic">User Data</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end shrink-0">
              <button onClick={() => setViewingGroup(null)} className="px-5 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg text-sm font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl bg-crm-primaryLighter/50 border border-crm-primary/15 px-4 py-3 text-sm text-crm-primary mt-6">
        <i className="ph-fill ph-info text-xl shrink-0" />
        <p className="leading-tight">
          <span className="font-semibold">Note:</span> Custom values from customer registration appear automatically. Only admin-added entries can be edited or deleted here.
        </p>
      </div>
    </div>
  );
};

export default MasterScopedLookupView;
