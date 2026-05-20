import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const FollowupManagement = ({ defaultFilter = 'all' }) => {
  const [followups, setFollowups] = useState([]);
  const [filter, setFilter] = useState(defaultFilter); // all, today, upcoming, missed
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    loadData();
  }, [filter, selectedDate]);

  const loadData = async () => {
    try {
      let url = `follow_ups.php?filter=${filter}`;
      if (filter === 'date' && selectedDate) {
        url += `&date=${selectedDate}`;
      }
      const res = await fetchApi(url);
      if (res.status === 'success') {
        setFollowups(res.data);
      }
    } catch (e) {
      console.error('Error fetching follow-ups:', e);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetchApi('follow_ups.php', {
        method: 'PUT',
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.status === 'success') {
        alert('Follow-up status updated');
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-normal text-crm-primary mb-1">Filter Follow-ups</label>
          <div className="flex bg-gray-100 rounded-lg p-1 w-full md:w-max border border-gray-200 overflow-x-auto scrollbar-none whitespace-nowrap">
            {['all', 'today', 'upcoming', 'missed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 md:px-6 py-2 rounded-md font-normal text-sm capitalize transition-all whitespace-nowrap ${
                  filter === f 
                    ? 'bg-crm-primary text-white shadow-md font-normal' 
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
              <button onClick={() => { setSelectedDate(''); setFilter('all'); }} className="bg-crm-primaryLighter text-crm-primary px-3 rounded-lg hover:bg-crm-primary/20 border border-crm-primary/10">
                <i className="ph-bold ph-x"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap text-crm-textDark">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-crm-primary font-normal">Follow-up Date</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Customer Name</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Company</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Phone</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Status</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Notes</th>
              <th className="px-4 py-3 text-crm-primary font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {followups.map(f => (
              <tr key={f.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter transition-colors">
                <td className="px-4 py-3 font-normal text-crm-primary">{f.follow_up_date}</td>
                <td className="px-4 py-3 font-normal">{f.customer_name}</td>
                <td className="px-4 py-3 text-gray-700">{f.company_name}</td>
                <td className="px-4 py-3 text-sm">{f.phone_1}</td>
                <td className="px-4 py-3 capitalize text-sm">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-normal ${
                    f.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                    f.status === 'missed' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {f.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={f.notes}>{f.notes || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <select 
                    value={f.status}
                    onChange={(e) => handleStatusChange(f.id, e.target.value)}
                    className="px-2 py-1 bg-crm-primary text-white border border-crm-primaryDark rounded text-sm outline-none focus:ring-2 focus:ring-white"
                  >
                    <option value="pending" className="bg-crm-primary text-white">Pending</option>
                    <option value="completed" className="bg-crm-primary text-white">Completed</option>
                    <option value="missed" className="bg-crm-primary text-white">Missed</option>
                  </select>
                </td>
              </tr>
            ))}
            {followups.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">No follow-ups found for selected criteria.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FollowupManagement;
