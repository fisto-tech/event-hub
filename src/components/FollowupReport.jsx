import React, { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../utils/api';
import { isPrivilegedRole } from '../utils/roles';
import LoadingSpinner from './common/LoadingSpinner';
import { formatDateTime } from '../utils/dateUtils';
import { FollowupHistoryModal } from './CustomerFollowup';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { showToast } from '../utils/toast';

const FollowupReport = ({ currentUser }) => {
  const [followups, setFollowups] = useState([]);
  const [expos, setExpos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyModal, setHistoryModal] = useState(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState([]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      const exposData = resE.status === 'success' ? (resE.data || []) : [];
      let followupsData = resF.status === 'success' ? (resF.data || []) : [];

      try {
        const { getPendingRecords } = await import('../utils/offlineDB');
        const pending = await getPendingRecords();
        const offlineFollowups = pending
          .filter(r => r.type === 'followup')
          .map(r => {
            const customer = customersData.find(c => String(c.id) === String(r.payload.customer_id));
            return {
              ...r.payload,
              id: r.localId,
              isOffline: true,
              syncStatus: r.syncStatus,
              follow_up_date: r.payload.next_follow_up_date || r.payload.follow_up_date,
              followup_reason: r.payload.followup_reason,
              company_name: customer ? customer.company_name : '—',
              customer_name: customer ? customer.customer_name : '—',
              display_contact_person: r.payload.contact_person,
              display_contact_phone: r.payload.contact_phone,
              phone_1: customer ? customer.phone_1 : '—',
              status: 'pending'
            };
          });
        followupsData = [...offlineFollowups, ...followupsData];
      } catch (err) { console.error('Failed to load offline records', err); }

      // Enrich followups with customer's expo_id and created_by so filters work
      followupsData = followupsData.map(f => {
        const customer = customersData.find(c => String(c.id) === String(f.customer_id));
        const createdBy = f.created_by || (customer ? (customer.created_by || customer.registered_by || customer.user_id) : null);
        let user = usersData.find(u => String(u.id) === String(createdBy));

        if (!user && String(createdBy) === String(currentUser?.id)) {
          user = currentUser;
        }

        const eId = f.expo_id || (customer ? customer.expo_id : null);
        const expoObj = exposData.find(e => String(e.id) === String(eId));

        return {
          ...f,
          expo_id: eId,
          expo_name: f.expo_name || (expoObj ? expoObj.expo_name : null),
          reference_source: f.reference_source || (customer ? customer.reference_source : null),
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
    followupLeadQuotation: filteredData.filter(f => {
      const reason = String(f.followup_reason || 'first followup').toLowerCase().trim();
      return reason !== 'project onboard' && reason !== 'dropped' && reason !== 'droped' && reason !== 'proposal' && reason !== 'appointment';
    }).length,
    proposal: filteredData.filter(f => String(f.followup_reason).toLowerCase().trim() === 'proposal').length,
    projectOnboard: filteredData.filter(f => String(f.followup_reason).toLowerCase().trim() === 'project onboard').length,
    dropped: filteredData.filter(f => ['dropped', 'droped'].includes(String(f.followup_reason).toLowerCase().trim())).length,
    appointment: filteredData.filter(f => String(f.followup_reason).toLowerCase().trim() === 'appointment').length,
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
    setSelectedIds([]);
  }, [filterExpo, filterEmployee, searchField, searchText, startDate, endDate]);

  const getExpoOrSource = (f) => {
    if (f.reference_source && String(f.reference_source).toLowerCase() !== 'none') return `Source: ${f.reference_source}`;
    if (f.expo_name) return `Expo: ${f.expo_name}`;
    return '—';
  };

  const handleExportCSV = () => {
    const dataToExport = selectedIds.length > 0 ? filteredData.filter(f => selectedIds.includes(f.id)) : filteredData;
    if (dataToExport.length === 0) {
      alert("No data available to export");
      return;
    }
    const headers = ["S.No", "Date", "Expo/Source", "Company Name", "Contact Person", "Phone", "Status", "Reason"];
    const rows = dataToExport.map((f, i) => [
      i + 1,
      f.follow_up_date || '',
      `"${getExpoOrSource(f).replace(/"/g, '""')}"`,
      `"${(f.company_name || '').replace(/"/g, '""')}"`,
      `"${(f.display_contact_person || f.customer_name || '').replace(/"/g, '""')}"`,
      f.display_contact_phone || f.phone_1 ? `="${f.display_contact_phone || f.phone_1}"` : '',
      f.status === 'completed' ? 'Completed' : 'Pending',
      f.followup_reason || ''
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `followup_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDropdownOpen(false);
  };

  const handleExportPDF = () => {
    const dataToExport = selectedIds.length > 0 ? filteredData.filter(f => selectedIds.includes(f.id)) : filteredData;
    if (dataToExport.length === 0) {
      alert("No data available to export");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text('Followup Report', 14, 18);
      doc.setFontSize(10);
      doc.text(
        `Generated on: ${formatDateTime(new Date().toISOString().split('T')[0])}`,
        14,
        24
      );

      const headers = ["S.No", "Date", "Expo/Source", "Company Name", "Contact Person", "Phone", "Status", "Reason"];
      const rows = dataToExport.map((f, i) => [
        i + 1,
        f.follow_up_date || '',
        getExpoOrSource(f),
        String(f.company_name || ''),
        String(f.display_contact_person || f.customer_name || ''),
        f.display_contact_phone || f.phone_1 || '',
        f.status === 'completed' ? 'Completed' : 'Pending',
        f.followup_reason || ''
      ]);

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [153, 0, 51] }, // CRM primary crimson
        styles: { fontSize: 8, font: 'helvetica' },
      });

      doc.save(`followup_report_${new Date().toISOString().slice(0, 10)}.pdf`);
      setIsExportDropdownOpen(false);
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast(err?.message || 'PDF export failed', 'error');
    }
  };

  return (
    <div className="pb-10 max-w-full mx-auto fade-in p-4 lg:p-6 bg-[#f8fafc] min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Header Section */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#00b5e2]/10 text-[#00b5e2] rounded-xl h-12 w-12 flex items-center justify-center shrink-0">
              <i className="ph-bold ph-chart-line-up text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1e293b]">Follow Up</h2>
              <p className="text-sm text-slate-500 mt-0.5">Manage all your follow-ups and track progress</p>
            </div>
          </div>
          
          {['admin', 'super_admin', 'superadmin'].includes(userRole?.toLowerCase()) && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="bg-[#00b5e2] hover:bg-[#00a0c9] text-white px-5 py-2.5 rounded-md text-[14px] font-medium shadow-sm flex items-center gap-2 transition-all"
              >
                <i className="ph-bold ph-download-simple text-lg"></i>
                Export Reports
              </button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={handleExportCSV}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <i className="ph-fill ph-file-xls text-emerald-600 text-lg"></i>
                    Export to Excel (.csv)
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <i className="ph-fill ph-file-pdf text-red-600 text-lg"></i>
                    Export to PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Statistics Row */}
        <div className="p-6">
          <div className="border border-gray-200 rounded-xl flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-gray-200">
            <div className="flex-1 p-5 flex items-center justify-center gap-4">
              <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <i className="ph-fill ph-phone-call text-2xl"></i>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-[13px] font-bold text-gray-800 uppercase mt-1">Total Follow-up Taken</div>
              </div>
            </div>
            
            <div className="flex-1 p-5 flex flex-col items-center justify-center border-l-4 border-l-[#00b5e2]/30">
              <div className="text-3xl font-bold text-amber-500">{stats.followupLeadQuotation}</div>
              <div className="text-[13px] font-bold text-gray-800 mt-1">Follow up / Lead / Quotation</div>
            </div>
            
            <div className="flex-1 p-5 flex flex-col items-center justify-center border-l-4 border-l-[#00b5e2]/30">
              <div className="text-3xl font-bold text-red-500">{stats.dropped}</div>
              <div className="text-[13px] font-bold text-gray-800 mt-1">Dropped</div>
            </div>
            
            <div className="flex-1 p-5 flex flex-col items-center justify-center border-l-4 border-l-[#00b5e2]/30">
              <div className="text-3xl font-bold text-purple-500">{stats.proposal}</div>
              <div className="text-[13px] font-bold text-gray-800 mt-1">Proposal</div>
            </div>
            
            <div className="flex-1 p-5 flex flex-col items-center justify-center border-l-4 border-l-[#00b5e2]/30">
              <div className="text-3xl font-bold text-orange-500">{stats.appointment}</div>
              <div className="text-[13px] font-bold text-gray-800 mt-1">Appointment</div>
            </div>
            
            <div className="flex-1 p-5 flex flex-col items-center justify-center border-l-4 border-l-[#00b5e2]/30">
              <div className="text-3xl font-bold text-emerald-600">{stats.projectOnboard}</div>
              <div className="text-[13px] font-bold text-gray-800 mt-1">Project Onboard</div>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 relative">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Search by employee, company, contact or mobile..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">FOLLOW-UP TYPE</label>
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 bg-white"
            >
              <option value="all">All fields</option>
              <option value="company">Company</option>
              <option value="phone">Mobile</option>
              <option value="name">Contact Person</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">DATE RANGE</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2]"
                />
              </div>
              <span className="text-gray-500 text-xs font-bold">TO</span>
              <div className="relative flex-1">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2]"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-1 flex justify-end">
            <button
              onClick={resetAll}
              className="px-4 py-2.5 w-full md:w-auto rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="ph ph-arrow-counter-clockwise"></i>
              Reset All
            </button>
          </div>
        </div>

        {/* Table Data */}
        {loading ? (
          <div className="p-10 flex justify-center border-t border-gray-100">
            <LoadingSpinner label="Loading Report..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#00b5e2] text-white">
                  {['admin', 'super_admin', 'superadmin'].includes(userRole?.toLowerCase()) && (
                    <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(filteredData.map(f => f.id));
                          else setSelectedIds([]);
                        }}
                        className="cursor-pointer rounded border-white/30 text-[#00b5e2] focus:ring-white"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center w-16">S. No</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Details</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Follow-up Date</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Employee</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Company Name</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Contact Person</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Mobile</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] text-center">History</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, i) => {
                    const statusText = row.followup_reason || row.status || '—';
                    const s = String(statusText).toLowerCase().trim();
                    let bg = 'bg-gray-50'; let textC = 'text-gray-600';
                    if (s.includes('allocation')) { bg = 'bg-blue-50'; textC = 'text-blue-500'; }
                    else if (s.includes('onboard')) { bg = 'bg-green-50'; textC = 'text-green-600'; }
                    else if (s.includes('appointment')) { bg = 'bg-orange-50'; textC = 'text-orange-500'; }
                    else if (s.includes('proposal')) { bg = 'bg-cyan-50'; textC = 'text-cyan-500'; }
                    else if (s.includes('dropped') || s.includes('drop')) { bg = 'bg-red-50'; textC = 'text-red-500'; }
                    else if (s.includes('quotation')) { bg = 'bg-purple-50'; textC = 'text-purple-500'; }
                    else if (s.includes('meeting')) { bg = 'bg-amber-50'; textC = 'text-amber-500'; }
                    else if (s.includes('demo')) { bg = 'bg-teal-50'; textC = 'text-teal-500'; }
                    else if (s.includes('first') || s.includes('follow')) { bg = 'bg-blue-50'; textC = 'text-blue-500'; }

                    return (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors bg-white">
                        {['admin', 'super_admin', 'superadmin'].includes(userRole?.toLowerCase()) && (
                          <td className="px-4 py-3 text-[13px] text-center border-r border-gray-100">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(prev => [...prev, row.id]);
                                else setSelectedIds(prev => prev.filter(id => id !== row.id));
                              }}
                              className="cursor-pointer text-[#00b5e2] focus:ring-[#00b5e2] rounded border-gray-300"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-[13px] font-semibold text-gray-800 text-center border-r border-gray-100">
                          {((currentPage - 1) * itemsPerPage) + i + 1}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-center border-r border-gray-100">
                          <span className={`px-3 py-1 rounded border border-white/0 font-medium ${bg} ${textC} capitalize inline-block text-[12px]`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium text-gray-800 text-center border-r border-gray-100">
                          {row.follow_up_date ? formatDateTime(row.follow_up_date).split(' ')[0] : '-'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium text-gray-800 text-center border-r border-gray-100">
                          {row.registered_by_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium text-gray-600 text-center border-r border-gray-100">
                          {row.company_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-medium text-gray-800 text-center border-r border-gray-100">
                          {row.display_contact_person || row.customer_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-gray-800 text-center border-r border-gray-100">
                          {row.display_contact_phone || row.phone_1 || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => openHistory(row)}
                            className="text-[#00b5e2] hover:bg-[#00b5e2]/10 p-1.5 rounded-full transition-colors inline-flex items-center justify-center"
                          >
                            <i className="ph ph-clock-counter-clockwise text-[16px]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <i className="ph ph-magnifying-glass text-3xl text-gray-300"></i>
                        <p>No matching records found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Controls */}
        {!loading && (
          <div className="p-4 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
            <div className="text-[13px] font-bold text-gray-800">
              Showing {filteredData.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} records
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 disabled:opacity-50 flex items-center justify-center transition-colors bg-white"
                >
                  <i className="ph-bold ph-caret-left"></i>
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded flex items-center justify-center text-[13px] font-bold transition-colors ${
                        currentPage === page
                          ? 'bg-[#00b5e2] text-white border border-[#00b5e2]'
                          : 'border border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 disabled:opacity-50 flex items-center justify-center transition-colors bg-white"
                >
                  <i className="ph-bold ph-caret-right"></i>
                </button>
              </div>
            )}
            
            {/* Optional items per page selector could go here if needed, but left empty to match layout flex */}
            <div className="hidden md:flex items-center gap-2">
              <select className="border border-gray-200 rounded px-2 py-1 text-[13px] font-bold text-gray-600 outline-none">
                <option>{itemsPerPage} per page</option>
              </select>
            </div>
          </div>
        )}

      </div>

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
