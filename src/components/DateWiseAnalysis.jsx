import React, { useEffect, useState } from 'react';
import { fetchApi } from '../utils/api';
import LoadingSpinner from './common/LoadingSpinner';
import { showToast } from '../utils/toast';
import { FollowupHistoryModal } from './CustomerFollowup';

const TABS = [
  { label: 'Inprogress', value: 'inprogress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Missed', value: 'missed' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const DateWiseAnalysis = ({ currentUser }) => {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState('inprogress');
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [historyModal, setHistoryModal] = useState(null); // { customer, rows }
  
  const userRole = currentUser?.role || 'employee';

  const loadBoard = async () => {
    if (!currentUser?.id || !selectedDate) return;
    setLoading(true);
    try {
      const url = `follow_ups.php?action=date_wise_analysis&date=${selectedDate}&tab=${activeTab}&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`;
      const res = await fetchApi(url);
      if (res.status === 'success') {
        let data = res.data || [];
        
        // Security filter: employees see only their assigned/registered customers
        if (userRole !== 'super_admin' && userRole !== 'admin') {
          data = data.filter(c => String(c.created_by || c.registered_by) === String(currentUser.id));
        }
        
        setCards(data);
      } else {
        setCards([]);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load analysis data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [selectedDate, activeTab, currentUser?.id, currentUser?.role]);

  // Make sure Inprogress tab is not selected if date is not today
  useEffect(() => {
    if (selectedDate !== todayISO() && activeTab === 'inprogress') {
      setActiveTab('completed');
    }
  }, [selectedDate, activeTab]);

  const openHistory = async (card) => {
    try {
      const res = await fetchApi(
        `follow_ups.php?action=history&customer_id=${card.customer_id}&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`
      );
      if (res.status === 'success') {
        let data = res.data || [];
        // Filter locally just in case
        data = data.filter(h => String(h.customer_id) === String(card.customer_id));
        setHistoryModal({ customer: card, rows: data });
      } else {
        showToast(res.message || 'Failed to load history', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load history', 'error');
    }
  };

  const stageBadge = (card) => {
    const label = String(card.followup_reason || '').trim();
    if (!label) return '';
    return label;
  };

  return (
    <div className="pb-12">
      {/* Top row: Date (left) + Stage buttons (center-ish) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 rounded-full border border-gray-200 crm-input w-52"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {TABS.map((t) => {
              // Hide inprogress tab if date is not today
              if (t.value === 'inprogress' && selectedDate !== todayISO()) return null;
              
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActiveTab(t.value)}
                  className={`px-6 py-2 rounded-full border text-sm font-semibold transition-colors ${
                    activeTab === t.value
                      ? 'bg-crm-primary text-white border-crm-primary'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-crm-primaryLighter/60'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="text-sm font-semibold text-gray-800 text-center md:text-right">
            Total records: {cards.length}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading analysis..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          {cards.map((c) => {
            // Determine border color based on Missed tab logic
            let borderColor = 'border-gray-200';
            if (activeTab === 'missed') {
               if (c.status === 'completed') {
                  borderColor = 'border-emerald-500 border-2';
               } else {
                  borderColor = 'border-red-500 border-2';
               }
            }

            return (
              <div key={c.id} className={`bg-white rounded-2xl border shadow-sm p-6 ${borderColor}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-4">
                    <div>
                      <span className="text-sm font-bold text-gray-800 uppercase tracking-wider block mb-0.5">Company Name</span>
                      <span className="text-sm font-medium text-gray-600 block leading-tight">
                        {c.company_name || '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 border-t border-gray-100 pt-4">
                      <div>
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-wider block mb-0.5">Contact Person</span>
                        <span className="text-sm font-medium text-gray-600 block">
                          {c.display_contact_person || c.customer_name || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-wider block mb-0.5">Status</span>
                        <span className="text-sm font-medium text-gray-600 block capitalize">
                          {c.followup_status || c.status || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-wider block mb-0.5">Next Follow-up</span>
                        <span className="text-sm font-medium text-gray-600 block">
                          {c.follow_up_date || '—'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-wider block mb-0.5">Remarks</span>
                        <span className="text-sm font-medium text-gray-600 block">
                          {c.remarks || c.notes || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {stageBadge(c) && (
                    <span className="px-3 py-1 rounded-full bg-crm-primaryDark text-white text-xs font-semibold capitalize flex-shrink-0">
                      {stageBadge(c)}
                    </span>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openHistory(c)}
                    className="text-sm font-semibold text-crm-primary hover:text-crm-primaryDark inline-flex items-center gap-2"
                  >
                    <i className="ph-bold ph-clock-counter-clockwise" />
                    View History
                  </button>
                </div>
              </div>
            );
          })}
          {!loading && cards.length === 0 && (
            <div className="col-span-1 lg:col-span-2 py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
              No tasks found for the selected criteria.
            </div>
          )}
        </div>
      )}

      {historyModal && (
        <FollowupHistoryModal
          customer={historyModal.customer}
          rows={historyModal.rows}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  );
};

export default DateWiseAnalysis;
