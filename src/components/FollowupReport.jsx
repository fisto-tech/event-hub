import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { isPrivilegedRole } from '../utils/roles';
import LoadingSpinner from './common/LoadingSpinner';
import { formatDateTime } from '../utils/dateUtils';
import { FollowupHistoryModal } from './CustomerFollowup';

const FollowupReport = ({ currentUser }) => {
  const [followups, setFollowups] = useState([]);
  const [expos, setExpos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyModal, setHistoryModal] = useState(null);

  // Filters
  const [filterExpo, setFilterExpo] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [searchField, setSearchField] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const userRole = currentUser?.role || 'employee';
  const showAll = isPrivilegedRole(userRole);

  const loadData = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const p1 = fetchApi(`follow_ups.php?filter=all&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`);
      const p2 = fetchApi('expos.php');
      const p3 = showAll ? fetchApi('users.php') : Promise.resolve({ data: [] });
      const p4 = fetchApi(`customers.php?role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`);

      const [resF, resE, resU, resC] = await Promise.all([p1, p2, p3, p4]);
      
      const usersData = resU.status === 'success' ? (resU.data || []) : [];
      const customersData = resC.status === 'success' ? (resC.data || []) : [];
      let followupsData = resF.status === 'success' ? (resF.data || []) : [];

      // Enrich followups with customer's expo_id and created_by so filters work
      followupsData = followupsData.map(f => {
        const customer = customersData.find(c => String(c.id) === String(f.customer_id));
        const createdBy = f.created_by || (customer ? (customer.created_by || customer.registered_by || customer.user_id) : null);
        let user = usersData.find(u => String(u.id) === String(createdBy));
        
        if (!user && String(createdBy) === String(currentUser?.id)) {
          user = currentUser;
        }
        
        return {
          ...f,
          expo_id: f.expo_id || (customer ? customer.expo_id : null),
          created_by: createdBy,
          registered_by_name: f.registered_by_name || (user ? (user.name || user.username) : '')
        };
      });

      setFollowups(followupsData);
      
      if (resE.status === 'success') setExpos(resE.data || []);
      if (showAll) setEmployees(usersData);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id, currentUser?.role]);

  const openHistory = async (row) => {
    try {
      const res = await fetchApi(`follow_ups.php?action=history&customer_id=${row.customer_id}&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`);
      if (res.status === 'success') {
        setHistoryModal({
          customer: row,
          rows: res.data || []
        });
      } else {
        alert(res.message || 'Error fetching history');
      }
    } catch (e) {
      alert('Network error fetching history');
    }
  };

  const resetAll = () => {
    setFilterExpo('all');
    setFilterEmployee('all');
    setSearchField('all');
    setSearchText('');
    setStartDate('');
    setEndDate('');
  };

  const filteredData = followups.filter(f => {
    // Expo Filter
    if (filterExpo !== 'all') {
      const eId = f.expo_id || f.linked_expo_id;
      if (String(eId) !== String(filterExpo)) return false;
    }
    
    // Employee Filter
    const uId = f.created_by || f.user_id || f.registered_by;
    if (!showAll) {
      if (String(uId) !== String(currentUser.id)) return false;
    } else if (filterEmployee !== 'all') {
      if (String(uId) !== String(filterEmployee)) return false;
    }

    // Date Range Filter
    const parseDate = (dStr) => {
      if (!dStr) return 0;
      let str = String(dStr).trim();
      
      // Handle DD-MM-YYYY or DD-MM-YYYY HH:mm:ss
      if (str.includes('-') && str.split('-')[0].length <= 2) {
        const parts = str.split(/[\\sT]+/);
        const [day, month, year] = parts[0].split('-');
        str = `${year}-${month}-${day}${parts[1] ? ' ' + parts[1] : ''}`;
      }
      
      // If it's strictly YYYY-MM-DD, append time to force local parsing
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(str)) {
        str += ' 00:00:00';
      }
      
      // Replace - with / only for YYYY-MM-DD HH:mm:ss format, not ISO!
      if (!str.includes('T') && !str.includes('Z')) {
          str = str.replace(/-/g, '/');
      }

      const time = new Date(str).getTime();
      return isNaN(time) ? 0 : time;
    };

    let effStartDate = startDate;
    let effEndDate = endDate;
    if (startDate && !endDate) effEndDate = startDate;
    if (endDate && !startDate) effStartDate = endDate;

    if (effStartDate) {
      if (!f.follow_up_date || parseDate(f.follow_up_date) < parseDate(effStartDate)) return false;
    }
    if (effEndDate) {
      // Add 24 hours minus 1 millisecond to include the whole end day
      const endOfDay = parseDate(effEndDate) + 86399999;
      if (!f.follow_up_date || parseDate(f.follow_up_date) > endOfDay) return false;
    }

    // Search text Filter
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const comp = (f.company_name || '').toLowerCase();
      const phone = (f.phone_1 || '').toLowerCase();
      const cust = (f.customer_name || '').toLowerCase();
      const city = (f.city || '').toLowerCase();

      if (searchField === 'all') {
        if (!comp.includes(q) && !phone.includes(q) && !cust.includes(q) && !city.includes(q)) return false;
      } else if (searchField === 'company') {
        if (!comp.includes(q)) return false;
      } else if (searchField === 'phone') {
        if (!phone.includes(q)) return false;
      } else if (searchField === 'name') {
        if (!cust.includes(q)) return false;
      }
    }

    return true;
  });

  // Calculate Statistics dynamically based on filteredData
  const stats = {
    total: filteredData.length,
    inProgress: filteredData.filter(f => ['inprogress', 'pending'].includes(String(f.status).toLowerCase())).length,
    notInterested: filteredData.filter(f => String(f.status).toLowerCase() === 'not interested').length,
    notPicking: filteredData.filter(f => String(f.status).toLowerCase() === 'not picking').length,
    confirmed: filteredData.filter(f => ['confirmed', 'completed'].includes(String(f.status).toLowerCase())).length,
    proposal: filteredData.filter(f => String(f.followup_reason).toLowerCase() === 'proposal').length,
    leadFollowup: filteredData.filter(f => ['lead', 'first followup', 'followup'].includes(String(f.followup_reason).toLowerCase())).length,
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterExpo, filterEmployee, searchField, searchText, startDate, endDate]);

  return (
    <div className=" pb-10 max-w-[1600px] mx-auto fade-in">
      {/* 1. TOP STATISTICS CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 lg:p-8 mx-auto max-w-4xl">
        <h2 className="text-center font-bold text-gray-800 text-lg mb-6">
          Total Followup Taken : <span className="text-red-600 text-2xl ml-1">{stats.total}</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm font-semibold text-gray-600">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span>In Progress</span>
            <span className="text-orange-500 font-bold">{stats.inProgress}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span>Proposal</span>
            <span className="text-blue-500 font-bold">{stats.proposal}</span>
          </div>
          
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span>Not Interested</span>
            <span className="text-red-500 font-bold">{stats.notInterested}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span>Lead / Followup</span>
            <span className="text-purple-600 font-bold">{stats.leadFollowup}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span>Not Picking</span>
            <span className="text-amber-600 font-bold">{stats.notPicking}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <span>Confirmed</span>
            <span className="text-emerald-600 font-bold">{stats.confirmed}</span>
          </div>
        </div>
      </div>

      {/* 2. FILTERS CONTAINER */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">EXPO NAME</label>
            <select
              value={filterExpo}
              onChange={(e) => setFilterExpo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-crm-primary"
            >
              <option value="all">All Expos</option>
              {expos.map(e => <option key={e.id} value={e.id}>{e.expo_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">EMPLOYEE</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              disabled={!showAll}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-crm-primary disabled:bg-gray-100"
            >
              <option value="all">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name || e.username}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">SEARCH</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:border-crm-primary">
              <select 
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="px-3 py-2.5 bg-gray-50 text-sm outline-none border-r border-gray-300 min-w-[110px]"
              >
                <option value="all">All fields</option>
                <option value="company">Company</option>
                <option value="phone">Phone</option>
                <option value="name">Name</option>
              </select>
              <input
                type="text"
                placeholder="Type to search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full px-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">DATE RANGE</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-crm-primary"
              />
              <span className="text-gray-400 text-xs font-bold">TO</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-crm-primary"
              />
            </div>
          </div>
          
        </div>
        
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={resetAll}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* 3. DATA TABLE */}
      <div>
        <h3 className="font-bold text-sm text-gray-800 mb-2">
          Total records : <span className="text-red-500">{filteredData.length}</span>
        </h3>
        
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 flex justify-center">
            <LoadingSpinner label="Loading Report..." />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-crm-primary text-white">
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">S.No.</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Details</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Followup Date</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Employee</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Company Name</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Contact Person</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Mobile</th>
                  <th className="px-4 py-3 font-semibold text-sm text-center">History</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, i) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700">{((currentPage - 1) * itemsPerPage) + i + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 capitalize">{row.followup_reason || row.status || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(row.follow_up_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.registered_by_name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.company_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.phone_1 || '—'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          type="button"
                          onClick={() => openHistory(row)}
                          title="View History"
                          className="text-crm-primary hover:text-crm-primaryDark transition-colors"
                        >
                          <i className="ph-bold ph-clock-counter-clockwise text-lg" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm mt-4">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded flex items-center justify-center text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-crm-primary text-white border-crm-primary'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {historyModal && (
        <FollowupHistoryModal
          customer={historyModal.customer}
          history={historyModal.rows}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  );
};

export default FollowupReport;
