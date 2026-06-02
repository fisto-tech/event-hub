import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { isPrivilegedRole } from '../utils/roles';
import LoadingSpinner from './common/LoadingSpinner';
import { showToast } from '../utils/toast';

const FollowupManagement = ({ defaultFilter = 'all', currentUser }) => {
  const [followups, setFollowups] = useState([]);
  const [filter, setFilter] = useState(defaultFilter);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);

  const userRole = currentUser?.role || 'employee';
  const showAll = isPrivilegedRole(userRole);

  const loadData = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      let url = `follow_ups.php?filter=${filter}&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`;
      if (filter === 'date' && selectedDate) {
        url += `&date=${selectedDate}`;
      }
      const res = await fetchApi(url);
      if (res.status === 'success') {
        let data = res.data || [];
        if (!showAll) {
          data = data.filter(f => String(f.created_by || f.registered_by || f.user_id) === String(currentUser.id));
        }
        setFollowups(data);
      }
    } catch (e) {
      console.error('Error fetching follow-ups:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter, selectedDate, currentUser?.id, currentUser?.role]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetchApi('follow_ups.php', {
        method: 'PUT',
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.status === 'success') {
        showToast('Follow-up status updated');
        loadData();
      } else {
        showToast(res.message || 'Update failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {!showAll && (
        <p className="text-sm text-crm-primary bg-crm-primaryLighter/60 border border-crm-primary/15 rounded-lg px-4 py-2">
          Showing follow-ups for customers you registered only.
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-normal text-crm-primary mb-1">Filter Follow-ups</label>
          <div className="flex bg-gray-100 rounded-lg p-1 w-full md:w-max border border-gray-200 overflow-x-auto whitespace-nowrap">
            {['all', 'today', 'upcoming', 'missed'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 md:px-6 py-2 rounded-md font-normal text-sm capitalize transition-all whitespace-nowrap ${
                  filter === f
                    ? 'bg-crm-primary text-white shadow-md'
                    : 'text-gray-500 hover:text-crm-primary hover:bg-crm-primaryLighter'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full md:w-64">
          <label className="block text-sm font-normal text-crm-primary mb-1">Date Wise Analysis</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                if (e.target.value) setFilter('date');
              }}
              className="w-full px-4 py-2 rounded-lg outline-none crm-input"
            />
            {filter === 'date' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate('');
                  setFilter('all');
                }}
                className="bg-crm-primaryLighter text-crm-primary px-3 rounded-lg hover:bg-crm-primary/20 border border-crm-primary/10"
              >
                <i className="ph-bold ph-x" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading follow-ups..." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap text-crm-textDark border border-gray-700">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-700">
                <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700 w-14">S.No</th>
                <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700">Next Follow-up Date</th>
                <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700">Customer Name</th>
                <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700">Company</th>
                <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700">Phone</th>
                {showAll && (
                  <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700">Registered By</th>
                )}
                <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700">Status</th>
                <th className="px-4 py-3 text-crm-primary font-normal border-r border-gray-700">Notes</th>
                <th className="px-4 py-3 text-crm-primary font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {followups.map((f, index) => (
                <tr key={f.id} className="border-b border-gray-700 hover:bg-crm-primaryLighter transition-colors">
                  <td className="px-4 py-3 text-sm border-r border-gray-700 text-center">{index + 1}</td>
                  <td className="px-4 py-3 font-normal text-crm-primary border-r border-gray-700">{f.follow_up_date}</td>
                  <td className="px-4 py-3 font-normal border-r border-gray-700">{f.customer_name}</td>
                  <td className="px-4 py-3 text-gray-700 border-r border-gray-700">{f.company_name}</td>
                  <td className="px-4 py-3 text-sm border-r border-gray-700">{f.phone_1}</td>
                  {showAll && (
                    <td className="px-4 py-3 text-sm border-r border-gray-700">{f.registered_by_name || '—'}</td>
                  )}
                  <td className="px-4 py-3 capitalize text-sm border-r border-gray-700">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-normal ${
                        f.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : f.status === 'missed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate border-r border-gray-700" title={f.notes}>
                    {f.notes || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={f.status}
                      onChange={(e) => handleStatusChange(f.id, e.target.value)}
                      className="px-2 py-1 bg-crm-primary text-white border border-crm-primaryDark rounded text-sm outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="missed">Missed</option>
                    </select>
                  </td>
                </tr>
              ))}
              {followups.length === 0 && (
                <tr>
                  <td colSpan={showAll ? 9 : 8} className="px-4 py-8 text-center text-gray-400 border-t border-gray-700">
                    No follow-ups found for selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FollowupManagement;
