import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchApi } from '../utils/api';
import LoadingSpinner from './common/LoadingSpinner';
import { showToast } from '../utils/toast';
import { FollowupHistoryModal, FollowupFormModal } from './CustomerFollowup';
import { formatDateTime } from '../utils/dateUtils';

const TABS = [
  { label: 'Inprogress', value: 'inprogress' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Completed', value: 'completed' },
  { label: 'Missed', value: 'missed' },
];

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const DateWiseAnalysis = ({ currentUser }) => {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState('inprogress');

  const [tabData, setTabData] = useState({ inprogress: [], upcoming: [], completed: [], missed: [] });
  const [loading, setLoading] = useState(true);

  const [historyModal, setHistoryModal] = useState(null); // { customer, rows }
  const [formModal, setFormModal] = useState(null);

  const userRole = currentUser?.role || 'employee';

  const [expos, setExpos] = useState([]);
  const [sources, setSources] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterExpoSource, setFilterExpoSource] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');

  const loadFilters = async () => {
    try {
      const exRes = await fetchApi('expos.php');
      if (exRes.status === 'success') setExpos(exRes.data || []);
      const lkRes = await fetchApi('master_data.php?type=source');
      if (lkRes.status === 'success') setSources(lkRes.data || []);
      if (['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase())) {
        const empRes = await fetchApi('users.php');
        if (empRes.status === 'success') setEmployees(empRes.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadFilters();
  }, [userRole]);

  const loadDataForDate = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const tabs = ['inprogress', 'upcoming', 'completed', 'missed'];
      const newData = { inprogress: [], upcoming: [], completed: [], missed: [] };

      for (const tab of tabs) {
        const res = await fetchApi(`follow_ups.php?action=date_wise_analysis&date=${selectedDate || 'all'}&tab=${tab}&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`);
        let data = res.status === 'success' ? (res.data || []) : [];
        if (userRole !== 'super_admin' && userRole !== 'admin') {
          data = data.filter(c => String(c.created_by || c.registered_by) === String(currentUser.id));
        }
        newData[tab] = data;
      }


      setTabData(newData);
    } catch (e) {
      console.error(e);
      showToast('Failed to load analysis data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataForDate();
  }, [selectedDate, currentUser?.id, currentUser?.role]);

  const filteredTabData = React.useMemo(() => {
    const result = {};
    for (const [key, list] of Object.entries(tabData)) {
      let filtered = list || [];
      if (filterExpoSource !== 'all') {
        const [type, idOrName] = filterExpoSource.split('::');
        filtered = filtered.filter(c => {
          if (type === 'expo') return String(c.expo_id) === String(idOrName);
          if (type === 'source') return String(c.reference_source) === String(idOrName);
          return true;
        });
      }
      if (filterEmployee !== 'all') {
        filtered = filtered.filter(c => String(c.created_by || c.registered_by) === String(filterEmployee));
      }
      result[key] = filtered;
    }
    return result;
  }, [tabData, filterExpoSource, filterEmployee]);

  const cards = filteredTabData[activeTab] || [];

  // Make sure appropriate tab is selected based on date
  useEffect(() => {
    if (!selectedDate) {
      return;
    }
    const today = todayISO();
    if (selectedDate > today) {
      setActiveTab('upcoming');
    } else if (selectedDate < today) {
      setActiveTab('missed'); // Past dates should default to Missed or Completed, let's use missed
    } else {
      setActiveTab('inprogress');
    }
  }, [selectedDate]);

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
    const reason = String(card.followup_reason || '').trim().toLowerCase();
    const st = String(card.followup_status || card.status || '').trim().toLowerCase();

    if (reason === 'appointment' || st === 'appointment') return 'Appointment';
    if (reason === 'dropped' || st === 'dropped' || reason === 'droped') return 'Dropped';

    const label = String(card.followup_reason || '').trim();
    if (!label) return '';
    return label;
  };

  return (
    <div className="pb-12">
      {/* Top row: Date (left) + Filters + Stage buttons (center-ish) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            {document.getElementById('top-nav-filters') ? createPortal(
              <div className="flex items-center gap-2 md:gap-3 w-full justify-center">
                {/* Date Picker inside Portal */}
                <div className="relative group flex items-center">
                  <div className="md:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-blue-500 shadow-sm hover:bg-blue-50 overflow-hidden transition-colors">
                    <i className="ph-bold ph-calendar-blank text-blue-600 text-lg pointer-events-none z-10"></i>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="absolute inset-0 opacity-0 cursor-pointer z-20 hide-date-icon"
                    />
                  </div>
                  <div className="hidden md:block relative w-44 group">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="relative z-0 w-full pl-10 pr-4 py-2 text-sm font-medium rounded-full bg-white border border-blue-500 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-600 shadow-sm transition-all cursor-pointer hover:bg-blue-50 hide-date-icon"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <i className="ph-bold ph-calendar-blank text-blue-500 group-hover:text-blue-600 transition-colors"></i>
                    </div>
                  </div>
                </div>

                {/* Expo & Source Filter */}
                <div className="relative group flex items-center">
                  {/* Mobile: Icon Only */}
                  <div className="md:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-emerald-500 shadow-sm hover:bg-emerald-50 overflow-hidden transition-colors">
                    <i className="ph-bold ph-funnel text-emerald-600 text-lg pointer-events-none"></i>
                    <select
                      value={filterExpoSource}
                      onChange={(e) => setFilterExpoSource(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                    >
                      <option value="all">All Expos & Sources</option>
                      {expos.map(e => <option key={`expo-${e.id}`} value={`expo::${e.id}`}>{e.expo_name}</option>)}
                      {sources.map(s => <option key={`source-${s.id || s.name}`} value={`source::${s.name}`}>{s.name}</option>)}
                    </select>
                  </div>
                  {/* Desktop: Full Dropdown */}
                  <div className="hidden md:block relative w-64 group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <i className="ph-bold ph-funnel text-emerald-500 group-hover:text-emerald-600 transition-colors"></i>
                    </div>
                    <select
                      value={filterExpoSource}
                      onChange={(e) => setFilterExpoSource(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-emerald-500 text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-600 shadow-sm transition-all cursor-pointer appearance-none hover:bg-emerald-50"
                    >
                      <option value="all">All Expos & Sources</option>
                      {expos.map(e => <option key={`expo-${e.id}`} value={`expo::${e.id}`}>{e.expo_name}</option>)}
                      {sources.map(s => <option key={`source-${s.id || s.name}`} value={`source::${s.name}`}>{s.name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none z-10">
                      <i className="ph-bold ph-caret-down text-emerald-500 text-xs"></i>
                    </div>
                  </div>
                </div>

                {/* Employee Filter */}
                {['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase()) && (
                  <div className="relative group flex items-center">
                    {/* Mobile: Icon Only */}
                    <div className="md:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-amber-500 shadow-sm hover:bg-amber-50 overflow-hidden transition-colors">
                      <i className="ph-bold ph-users text-amber-600 text-lg pointer-events-none"></i>
                      <select
                        value={filterEmployee}
                        onChange={(e) => setFilterEmployee(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                      >
                        <option value="all">All Employees</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name || emp.username}</option>
                        ))}
                      </select>
                    </div>
                    {/* Desktop: Full Dropdown */}
                    <div className="hidden md:block relative w-56 group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                        <i className="ph-bold ph-users text-amber-500 group-hover:text-amber-600 transition-colors"></i>
                      </div>
                      <select
                        value={filterEmployee}
                        onChange={(e) => setFilterEmployee(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-amber-500 text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-600 shadow-sm transition-all cursor-pointer appearance-none hover:bg-amber-50"
                      >
                        <option value="all">All Employees</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name || emp.username}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none z-10">
                        <i className="ph-bold ph-caret-down text-amber-500 text-xs"></i>
                      </div>
                    </div>
                  </div>
                )}
              </div>,
              document.getElementById('top-nav-filters')
            ) : (
              <div className="flex items-center gap-2 md:gap-3 w-full flex-wrap">
                <div className="relative group flex items-center">
                  <div className="md:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-blue-500 shadow-sm hover:bg-blue-50 overflow-hidden transition-colors">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="absolute inset-0 opacity-0 cursor-pointer z-20 hide-date-icon"
                    />
                    <i className="ph-bold ph-calendar-blank text-blue-600 text-lg pointer-events-none z-10"></i>
                  </div>
                  <div className="hidden md:block relative w-44 group">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="relative z-0 w-full pl-10 pr-4 py-2 text-sm font-medium rounded-full bg-white border border-blue-500 text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-600 shadow-sm transition-all cursor-pointer hover:bg-blue-50 hide-date-icon"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <i className="ph-bold ph-calendar-blank text-blue-500 group-hover:text-blue-600 transition-colors"></i>
                    </div>
                  </div>
                </div>

                <div className="relative w-40 md:w-48 group flex-1 md:flex-none">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <i className="ph-bold ph-funnel text-emerald-500 group-hover:text-emerald-600 transition-colors"></i>
                  </div>
                  <select
                    value={filterExpoSource}
                    onChange={(e) => setFilterExpoSource(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-emerald-500 text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-600 shadow-sm transition-all cursor-pointer appearance-none hover:bg-emerald-50"
                  >
                    <option value="all">All Expos & Sources</option>
                    {expos.map(e => <option key={`expo-${e.id}`} value={`expo::${e.id}`}>{e.expo_name}</option>)}
                    {sources.map(s => <option key={`source-${s.id || s.name}`} value={`source::${s.name}`}>{s.name}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <i className="ph-bold ph-caret-down text-emerald-500 text-xs"></i>
                  </div>
                </div>

                {['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase()) && (
                  <div className="relative w-36 md:w-48 group flex-1 md:flex-none">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <i className="ph-bold ph-users text-amber-500 group-hover:text-amber-600 transition-colors"></i>
                    </div>
                    <select
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-amber-500 text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-600 shadow-sm transition-all cursor-pointer appearance-none hover:bg-amber-50"
                    >
                      <option value="all">All Employees</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name || emp.username}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <i className="ph-bold ph-caret-down text-amber-500 text-xs"></i>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {TABS.map((t) => {
              if (selectedDate) {
                // Hide inprogress tab if date is not today, hide upcoming if date is not future
                const isFuture = selectedDate > todayISO();
                const isToday = selectedDate === todayISO();

                if (t.value === 'inprogress' && !isToday) return null;
                if (t.value === 'upcoming' && !isFuture) return null;

                // If it is a future date, hide completed and missed as well
                if ((t.value === 'completed' || t.value === 'missed') && isFuture) return null;
              }

              const getActiveTabClass = (val) => {
                switch (val) {
                  case 'inprogress': return 'bg-yellow-500 text-white border-yellow-500 shadow-md shadow-yellow-500/20';
                  case 'completed': return 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20';
                  case 'missed': return 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20';
                  case 'upcoming': return 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20';
                  default: return 'bg-crm-primary text-white border-crm-primary shadow-md shadow-crm-primary/20';
                }
              };

              const getInactiveTabClass = (val) => {
                switch (val) {
                  case 'inprogress': return 'bg-white text-yellow-600 border-yellow-500 hover:bg-yellow-50 hover:border-yellow-600 hover:text-yellow-700';
                  case 'completed': return 'bg-white text-emerald-600 border-emerald-500 hover:bg-emerald-50 hover:border-emerald-600 hover:text-emerald-700';
                  case 'missed': return 'bg-white text-red-600 border-red-500 hover:bg-red-50 hover:border-red-600 hover:text-red-700';
                  case 'upcoming': return 'bg-white text-blue-600 border-blue-500 hover:bg-blue-50 hover:border-blue-600 hover:text-blue-700';
                  default: return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900';
                }
              };

              const getBadgeClass = (val, isActive) => {
                if (isActive) return 'bg-white/20 text-white';
                switch (val) {
                  case 'inprogress': return 'bg-yellow-100 text-yellow-700';
                  case 'completed': return 'bg-emerald-100 text-emerald-700';
                  case 'missed': return 'bg-red-100 text-red-700';
                  case 'upcoming': return 'bg-blue-100 text-blue-700';
                  default: return 'bg-gray-100 text-gray-600';
                }
              };

              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActiveTab(t.value)}
                  className={`px-6 py-2 rounded-full border text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === t.value ? getActiveTabClass(t.value) : getInactiveTabClass(t.value)
                    }`}
                >
                  <span>{t.label}</span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold transition-colors ${getBadgeClass(t.value, activeTab === t.value)}`}>
                    {filteredTabData[t.value]?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-sm font-semibold text-gray-800 text-center md:text-right">
            Total records: {TABS.reduce((sum, t) => {
              if (selectedDate) {
                const isFuture = selectedDate > todayISO();
                const isToday = selectedDate === todayISO();
                if (t.value === 'inprogress' && !isToday) return sum;
                if (t.value === 'upcoming' && !isFuture) return sum;
                if ((t.value === 'completed' || t.value === 'missed') && isFuture) return sum;
              }
              return sum + (filteredTabData[t.value]?.length || 0);
            }, 0)}
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
              <div key={c.id} className={`bg-white rounded-2xl border shadow-sm p-6 relative ${borderColor}`}>
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className="bg-crm-primary/10 text-crm-primary px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap border border-crm-primary/20">
                    {c.expo_name || c.manual_expo_name || c.reference_source || '—'}
                  </span>
                  {stageBadge(c) && (
                    <span
                      className={`px-3 py-1 rounded-full text-white text-xs font-semibold capitalize flex-shrink-0 ${stageBadge(c).toLowerCase() === 'appointment' ? '' : 'bg-crm-primaryDark'
                        }`}
                      style={stageBadge(c).toLowerCase() === 'appointment' ? { backgroundColor: '#db7070' } : {}}
                    >
                      {stageBadge(c)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="text-sm flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                    <span className="text-gray-500 font-normal w-32 shrink-0">Company Name:</span>
                    <span className="font-bold text-gray-900">{c.company_name || '—'}</span>
                  </div>
                  <div className="text-sm flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                    <span className="text-gray-500 font-normal w-32 shrink-0">Contact Person:</span>
                    <span className="font-bold text-gray-900">{c.contact_person || c.display_contact_person || c.customer_name || '—'}</span>
                  </div>
                  <div className="text-sm flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                    <span className="text-gray-500 font-normal w-32 shrink-0">Status:</span>
                    <span className="font-bold text-gray-900 capitalize">{c.followup_status || c.status || '—'}</span>
                  </div>
                  <div className="text-sm flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                    <span className="text-gray-500 font-normal w-32 shrink-0">Last Followup:</span>
                    <span className="font-bold text-gray-900">{c.created_at ? formatDateTime(c.created_at) : (c.visit_date ? formatDateTime(c.visit_date) : '—')}</span>
                  </div>
                  <div className="text-sm flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                    <span className="text-gray-500 font-normal w-32 shrink-0">Next Followup:</span>
                    <span className="font-bold text-gray-900">{formatDateTime(c.follow_up_date) || '—'}</span>
                  </div>
                  <div className="text-sm flex flex-col md:flex-row md:items-start gap-1 md:gap-2 mt-1">
                    <span className="text-gray-500 font-normal w-32 shrink-0">Remarks:</span>
                    <span className="font-bold text-gray-900 whitespace-pre-line">{c.last_completed_remarks || c.remarks || c.notes || c.customer_remarks || '—'}</span>
                  </div>
                  {['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase()) && (
                    <div className="text-sm flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                      <span className="text-gray-500 font-normal w-32 shrink-0">Employee Name:</span>
                      <span className="font-bold text-gray-900">{c.registered_by_name || '—'}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openHistory(c)}
                    className="text-sm font-bold text-crm-primary hover:text-crm-primaryDark inline-flex items-center gap-2 bg-crm-primary/10 px-4 py-2 rounded-lg"
                  >
                    <i className="ph-bold ph-clock-counter-clockwise" />
                    View History
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormModal({ card: c })}
                    className="px-6 py-2 rounded bg-crm-primary hover:bg-crm-primaryDark text-white text-sm font-semibold shadow"
                  >
                    Follow Up
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
          history={historyModal.rows}
          onClose={() => setHistoryModal(null)}
        />
      )}

      {formModal && (
        <FollowupFormModal
          card={formModal.card}
          currentUser={currentUser}
          onClose={() => setFormModal(null)}
          onSaved={() => {
            setFormModal(null);
            loadDataForDate();
          }}
        />
      )}
    </div>
  );
};

export default DateWiseAnalysis;
