import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { isPrivilegedRole } from '../utils/roles';
import LoadingSpinner from './common/LoadingSpinner';

const FollowupReport = ({ currentUser }) => {
  const [followups, setFollowups] = useState([]);
  const [expos, setExpos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

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

      const [resF, resE, resU] = await Promise.all([p1, p2, p3]);
      
      if (resF.status === 'success') setFollowups(resF.data || []);
      if (resE.status === 'success') setExpos(resE.data || []);
      if (showAll && resU.status === 'success') setEmployees(resU.data || []);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id, currentUser?.role]);

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
    if (showAll && filterEmployee !== 'all') {
      const uId = f.created_by || f.user_id || f.registered_by;
      if (String(uId) !== String(filterEmployee)) return false;
    }

    // Date Range Filter
    const parseDate = (dStr) => {
      if (!dStr) return 0;
      if (dStr.includes('-') && dStr.split('-')[0].length === 2) {
        const [day, month, year] = dStr.split('-');
        return new Date(`${year}-${month}-${day}`).getTime();
      }
      return new Date(dStr).getTime();
    };

    if (startDate && f.follow_up_date) {
      if (parseDate(f.follow_up_date) < parseDate(startDate)) return false;
    }
    if (endDate && f.follow_up_date) {
      if (parseDate(f.follow_up_date) > parseDate(endDate)) return false;
    }

    // Search text Filter
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
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

  return (
    <div className="space-y-6 pb-10 max-w-[1600px] mx-auto fade-in">
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
                <tr className="bg-[#1eaeb5] text-white">
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">S.No.</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Details</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Followup Date</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Employee</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Company Name</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">City</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">State</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Country</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Website</th>
                  <th className="px-4 py-3 font-semibold text-sm border-r border-white/20">Contact Person</th>
                  <th className="px-4 py-3 font-semibold text-sm">Mobile</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((row, i) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700">{i + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 capitalize">{row.followup_reason || row.status || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.follow_up_date || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.registered_by_name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.company_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.city || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.state || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.country || '—'}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 hover:underline">
                        {row.website ? (
                          <a href={row.website.startsWith('http') ? row.website : `http://${row.website}`} target="_blank" rel="noreferrer">
                            {row.website}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.phone_1 || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowupReport;
