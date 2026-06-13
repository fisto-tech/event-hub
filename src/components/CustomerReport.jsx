import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchApi, resolvePublicUrl } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isPrivilegedRole } from '../utils/roles';
import LoadingSpinner from './common/LoadingSpinner';
import { confirmDelete } from '../utils/confirm';
import { showToast } from '../utils/toast';
import ReportModalShell, { EditField, reportInputClass } from './common/ReportModalShell';
import CityAutocomplete from './common/CityAutocomplete';
import { formatDateTime } from '../utils/dateUtils';
import ExcelImportModal from './ExcelImportModal';
import { loadRegistrationBootstrap } from '../utils/registrationDataCache';

const ENQUIRY_OPTIONS = ['IDC', 'Website', 'Web page', 'Application', 'General Inquiry', 'Unknown'];

const CustomerReport = ({ currentUser, filterSource }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [filterExpo, setFilterExpo] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [expos, setExpos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [showExcelModal, setShowExcelModal] = useState(false);

  const activeEmployeeIds = React.useMemo(() => {
    const ids = new Set();
    customers.forEach(c => {
      const uId = c.created_by || c.registered_by || c.user_id;
      if (uId) ids.add(String(uId));
    });
    return ids;
  }, [customers]);

  // Filter & Sort States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'completed', 'pending'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'company-asc', 'company-desc'

  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // { url: string, title?: string, failed?: boolean }

  // UI Dropdown States
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [searchTerm, searchField, filterExpo, filterEmployee, activeTab, startDate, endDate]);

  useEffect(() => {
    if (currentUser?.id) loadData();

    // Close dropdown on click outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentUser?.id, currentUser?.role]);

  const userRole = currentUser?.role || 'employee';
  const showAllCustomers = isPrivilegedRole(userRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const uid = currentUser?.id ? `&user_id=${currentUser.id}` : '';
      const role = `&role=${encodeURIComponent(userRole)}`;
      const [custRes, expoRes, usersRes, bootstrap] = await Promise.all([
        fetchApi(`customers.php?_${Date.now()}${uid}${role}`),
        fetchApi('expos.php'),
        showAllCustomers ? fetchApi('users.php') : Promise.resolve({ data: [] }),
        loadRegistrationBootstrap()
      ]);
      let serverCustomers = custRes.status === 'success' ? (custRes.data || []) : [];
      if (bootstrap && bootstrap.lookups && bootstrap.lookups.source) {
        setSourceOptions(bootstrap.lookups.source);
      }

      try {
        const { getPendingRecords } = await import('../utils/offlineDB');
        const pending = await getPendingRecords();
        const offlineCustomers = pending
          .filter(r => r.type === 'registration')
          .map(r => ({
            ...r.payload,
            id: r.localId,
            isOffline: true,
            syncStatus: r.syncStatus,
            company_name: r.payload.companyName,
            customer_name: r.payload.customerName,
            phone_1: r.payload.phone1,
            phone_2: r.payload.phone2,
            enquiry_type: r.payload.enquiryType,
            visit_date: r.payload.visitDate,
            created_by: r.payload.createdBy,
            expo_id: r.payload.expoId,
            reference_source: r.payload.referenceSource,
            city: r.payload.city,
            status: 'pending' // UI expects 'pending' or 'completed'
          }));
        serverCustomers = [...offlineCustomers, ...serverCustomers];
      } catch (err) { console.error('Failed to load offline records', err); }

      setCustomers(serverCustomers);
      if (expoRes.status === 'success') setExpos(expoRes.data || []);
      if (usersRes.status === 'success') setEmployees(usersRes.data || []);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load customer report.');
    } finally {
      setLoading(false);
    }
  };

  const registeredByLabel = (cust) => {
    const creatorId = cust.created_by || cust.registered_by || cust.user_id;

    // Check local employees array first if API doesn't return joined names
    let employee = employees.find(e => String(e.id) === String(creatorId));

    // Fallback for employee role where the records belong to the current user
    if (!employee && String(creatorId) === String(currentUser?.id)) {
      employee = currentUser;
    }

    let name = '';
    if (employee) {
      name = employee.name || employee.username || `User #${employee.id}`;
    } else {
      name = cust.registered_by_name || cust.registered_by_username || (creatorId ? `User #${creatorId}` : '—');
    }

    const empId = employee ? (employee.employee_id || '') : (cust.registered_by_employee_id || '');
    return empId ? `${name} (${empId})` : name;
  };

  const expoLabel = (cust) => cust.linked_expo || cust.manual_expo_name || '—';

  const expoOrSourceLabel = (cust) => {
    if (cust.expo_id || cust.linked_expo || cust.manual_expo_name) return expoLabel(cust);
    return cust.reference_source || '';
  };

  const getExpoSelectValue = (cust) => {
    return cust.expo_id ? String(cust.expo_id) : '';
  };

  const patchEditingCustomer = (patch) =>
    setEditingCustomer((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleEditImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      patchEditingCustomer({ image: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleExpoChange = (value) => {
    patchEditingCustomer({ expo_id: value, manual_expo_name: '' });
  };

  const handleDelete = async (id, name) => {
    if (!confirmDelete(`customer "${name}"`)) return;
    try {
      const res = await fetchApi(`customers.php?id=${id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        showToast('Customer deleted successfully!');
        loadData();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchApi('customers.php', {
        method: 'PUT',
        body: JSON.stringify(editingCustomer)
      });
      if (res.status === 'success') {
        showToast('Customer updated successfully!');
        setEditingCustomer(null);
        loadData();
      } else {
        showToast(res.message || 'Failed to update', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const expoAndSourceOptions = React.useMemo(() => {
    const options = new Map();
    customers.forEach(c => {
      const uId = c.created_by || c.registered_by || c.user_id;
      if (!showAllCustomers && String(uId) !== String(currentUser.id)) return;

      if (c.expo_id || c.linked_expo || c.manual_expo_name) {
        const lbl = expoLabel(c);
        if (lbl && lbl !== '—') {
          options.set(`expo_${c.expo_id || lbl}`, { type: 'expo', id: c.expo_id || lbl, label: lbl });
        }
      }
      if (c.reference_source) {
        options.set(`source_${c.reference_source}`, { type: 'source', id: c.reference_source, label: c.reference_source });
      }
    });
    return Array.from(options.values());
  }, [customers, showAllCustomers, currentUser]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Advanced Filtering and Sorting Logic
  const filteredCustomers = customers
    .filter(c => {
      const companyName = c.company_name || '';
      const customerName = c.customer_name || '';
      const phone1 = c.phone_1 || '';

      // Search term filter
      const matchesSearch = (() => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        const comp = companyName.toLowerCase();
        const cust = customerName.toLowerCase();
        const ph1 = phone1.toLowerCase();
        const cty = (c.city || '').toLowerCase();

        if (searchField === 'all') {
          return comp.includes(q) || cust.includes(q) || ph1.includes(q) || cty.includes(q);
        } else if (searchField === 'company') {
          return comp.includes(q);
        } else if (searchField === 'phone') {
          return ph1.includes(q);
        } else if (searchField === 'name') {
          return cust.includes(q);
        } else if (searchField === 'city') {
          return cty.includes(q);
        }
        return true;
      })();

      // Expo / Source filter
      const matchesExpo = (() => {
        if (!filterExpo || filterExpo === 'all') return true;
        if (filterExpo.startsWith('expo_')) {
          const val = filterExpo.replace('expo_', '');
          return String(c.expo_id) === val || expoLabel(c) === val;
        }
        if (filterExpo.startsWith('source_')) {
          return (c.reference_source || '').trim().toLowerCase() === filterExpo.replace('source_', '').trim().toLowerCase();
        }
        return String(c.expo_id) === String(filterExpo);
      })();

      // Employee Filter
      const matchesEmployee = (() => {
        const uId = c.created_by || c.registered_by;
        if (!showAllCustomers) {
          return String(uId) === String(currentUser.id);
        }
        if (filterEmployee === 'all') return true;
        return String(uId) === String(filterEmployee);
      })();

      // Status subtab filter
      const matchesStatus = (() => {
        if (activeTab === 'all') return true;
        if (activeTab === 'completed') return c.status === 'completed';
        return c.status !== 'completed'; // Matches pending/missed/null
      })();

      // Source filter
      const matchesSource = filterSource
        ? (c.reference_source || '').trim().toLowerCase() === filterSource.trim().toLowerCase()
        : true;

      // Date Wise Filter (Start Date & End Date)
      if (!c.visit_date) return matchesSearch && matchesExpo && matchesStatus && matchesSource;
      const visitDate = new Date(c.visit_date);
      let effStartDate = startDate;
      let effEndDate = endDate;
      if (startDate && !endDate) effEndDate = startDate;
      if (endDate && !startDate) effStartDate = endDate;

      const matchesStartDate = effStartDate ? visitDate >= new Date(effStartDate) : true;
      const matchesEndDate = effEndDate ? visitDate <= new Date(effEndDate) : true;

      return matchesSearch && matchesExpo && matchesStatus && matchesStartDate && matchesEndDate && matchesSource && matchesEmployee;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.visit_date || 0) - new Date(a.visit_date || 0);
      } else if (sortBy === 'date-asc') {
        return new Date(a.visit_date || 0) - new Date(b.visit_date || 0);
      } else if (sortBy === 'company-asc') {
        return (a.company_name || '').localeCompare(b.company_name || '');
      } else if (sortBy === 'company-desc') {
        return (b.company_name || '').localeCompare(a.company_name || '');
      }
      return 0;
    });

  // Pagination Logic
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchField, filterExpo, filterEmployee, activeTab, startDate, endDate, sortBy, filterSource]);

  // Exporters
  const handleExportExcel = () => {
    const dataToExport = selectedIds.length > 0 ? filteredCustomers.filter(c => selectedIds.includes(c.id)) : filteredCustomers;
    if (dataToExport.length === 0) {
      alert("No data available to export");
      return;
    }
    const headers = ["S.No", "Date", "Expo Name / Source Name", "Company Name", "Contact Person", "Phone", "Registered By", "City", "Enquiry Type", "Status"];
    const rows = dataToExport.map((c, idx) => [
      idx + 1,
      c.visit_date || '',
      `"${String(expoOrSourceLabel(c) || '').replace(/"/g, '""')}"`,
      `"${(c.company_name || '').replace(/"/g, '""')}"`,
      `"${(c.customer_name || '').replace(/"/g, '""')}"`,
      c.phone_1 ? `="${c.phone_1}"` : '',
      `"${String(registeredByLabel(c) || '').replace(/"/g, '""')}"`,
      `"${String(c.city || '').replace(/"/g, '""')}"`,
      c.enquiry_type || 'Unknown',
      c.status === 'completed' ? 'Completed' : 'Pending'
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customer_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDropdownOpen(false);
  };

  const handleExportPDF = () => {
    const dataToExport = selectedIds.length > 0 ? filteredCustomers.filter(c => selectedIds.includes(c.id)) : filteredCustomers;
    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text('Customer Leads Report', 14, 18);
      doc.setFontSize(10);
      doc.text(
        `Generated on: ${formatDateTime(new Date().toISOString().split('T')[0])} | Filter: ${activeTab.toUpperCase()}`,
        14,
        24
      );

      const headers = [
        'S.No',
        'Date',
        'Expo Name / Source Name',
        'Company',
        'Contact Person',
        'Phone',
        'Registered By',
        'City',
        'Type',
        'Status',
      ];
      const rows = dataToExport.map((c, idx) => [
        idx + 1,
        c.visit_date || '',
        String(expoOrSourceLabel(c) || ''),
        String(c.company_name || ''),
        String(c.customer_name || ''),
        String(c.phone_1 || ''),
        String(registeredByLabel(c) || ''),
        String(c.city || ''),
        String(c.enquiry_type || 'Unknown'),
        c.status === 'completed' ? 'Completed' : 'Pending',
      ]);

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [153, 0, 51] }, // CRM primary crimson
        styles: { fontSize: 8, font: 'helvetica' },
      });

      doc.save(`customer_report_${new Date().toISOString().slice(0, 10)}.pdf`);
      setIsExportDropdownOpen(false);
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast(err?.message || 'PDF export failed', 'error');
    }
  };

  // Word export intentionally removed as requested.

  return (
    <div className="max-w-full mx-auto font-sans animate-in fade-in duration-300 p-2 lg:px-4 lg:py-2 bg-[#f8fafc] h-[calc(100vh-64px)] flex flex-col">

      {document.getElementById('top-nav-filters') ? createPortal(
        <div className="flex items-center gap-2 md:gap-3 w-full justify-start md:justify-center">
          {/* Expo & Source Filter */}
          <div className="relative group flex items-center">
            {/* Mobile: Icon Only */}
            <div className="md:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#00b5e2] shadow-sm hover:bg-[#00b5e2]/10 overflow-hidden transition-colors">
              <i className="ph-bold ph-funnel text-[#00b5e2] text-lg pointer-events-none z-10"></i>
              <select
                value={filterExpo}
                onChange={(e) => setFilterExpo(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-20"
              >
                <option value="all">All Expos & Sources</option>
                {expoAndSourceOptions.map(opt => (
                  <option key={`${opt.type}_${opt.id}`} value={`${opt.type}_${opt.id}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Desktop: Full Dropdown */}
            <div className="hidden md:block relative w-64 group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                <i className="ph-bold ph-funnel text-[#00b5e2] group-hover:text-[#00a0c9] transition-colors"></i>
              </div>
              <select
                value={filterExpo}
                onChange={(e) => setFilterExpo(e.target.value)}
                className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-[#00b5e2] text-[#00a0c9] focus:outline-none focus:ring-2 focus:ring-[#00b5e2]/50 focus:border-[#00b5e2] shadow-sm transition-all cursor-pointer appearance-none hover:bg-[#00b5e2]/5"
              >
                <option value="all">All Expos & Sources</option>
                {expoAndSourceOptions.map(opt => (
                  <option key={`${opt.type}_${opt.id}`} value={`${opt.type}_${opt.id}`}>
                    {opt.label} ({opt.type === 'expo' ? 'Expo' : 'Source'})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none z-10">
                <i className="ph-bold ph-caret-down text-[#00b5e2] text-xs"></i>
              </div>
            </div>
          </div>

          {/* Employee Filter */}
          {showAllCustomers && (
            <div className="relative group flex items-center">
              {/* Mobile: Icon Only */}
              <div className="md:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#00b5e2] shadow-sm hover:bg-[#00b5e2]/10 overflow-hidden transition-colors">
                <i className="ph-bold ph-users text-[#00b5e2] text-lg pointer-events-none z-10"></i>
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-20"
                >
                  <option value="all">All Employees</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name || e.username}
                    </option>
                  ))}
                </select>
              </div>
              {/* Desktop: Full Dropdown */}
              <div className="hidden md:block relative w-48 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                  <i className="ph-bold ph-users text-[#00b5e2] group-hover:text-[#00a0c9] transition-colors"></i>
                </div>
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-[#00b5e2] text-[#00a0c9] focus:outline-none focus:ring-2 focus:ring-[#00b5e2]/50 focus:border-[#00b5e2] shadow-sm transition-all cursor-pointer appearance-none hover:bg-[#00b5e2]/5"
                >
                  <option value="all">All Employees</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name || e.username}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none z-10">
                  <i className="ph-bold ph-caret-down text-[#00b5e2] text-xs"></i>
                </div>
              </div>
            </div>
          )}
        </div>
      , document.getElementById('top-nav-filters')) : null}
      {viewingCustomer && (
        <ReportModalShell
          title="Customer Details"
          icon="ph-user-circle"
          onClose={() => setViewingCustomer(null)}
          maxWidth="max-w-3xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-sm font-medium text-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCustomer({ ...viewingCustomer });
                  setViewingCustomer(null);
                }}
                className="px-5 py-2.5 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-medium"
              >
                Edit
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal text-crm-primary">Visit Date</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.visit_date || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Expo</label>
                <input
                  type="text"
                  disabled
                  value={expoLabel(viewingCustomer)}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Company Name</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.company_name || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Customer Name</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.customer_name || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-crm-primary">Phone 1</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.phone_1 || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Phone 2</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.phone_2 || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Email</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.email || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-crm-primary">City</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.city || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Industry Type</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.industry_type || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-crm-primary">Designation</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.designation || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Website</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.website || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-crm-primary">Enquiry Type</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.enquiry_type || 'Unknown'}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Priority</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.priority ? viewingCustomer.priority.toUpperCase() : 'MEDIUM'}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-crm-primary">Status</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.status === 'completed' ? 'Completed' : 'Pending'}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Reference</label>
                <input
                  type="text"
                  disabled
                  value={viewingCustomer.reference_source || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Location / Address</label>
                <textarea
                  disabled
                  rows={3}
                  value={viewingCustomer.location || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 resize-y bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Remarks</label>
                <textarea
                  disabled
                  rows={3}
                  value={viewingCustomer.remarks || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 resize-y bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Registered By</label>
                <input
                  type="text"
                  disabled
                  value={registeredByLabel(viewingCustomer)}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              {viewingCustomer.image_path && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-normal text-crm-primary">Image</label>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImage({
                        url: resolvePublicUrl(viewingCustomer.image_path),
                        title: 'Image',
                      })
                    }
                    className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-crm-primary"
                  >
                    <i className="ph-bold ph-image" /> View image
                  </button>
                </div>
              )}
            </div>
          </div>
        </ReportModalShell>
      )}

      {previewImage?.url && (
        <ReportModalShell
          title={previewImage.title || 'Image Preview'}
          icon="ph-image"
          onClose={() => setPreviewImage(null)}
          maxWidth="max-w-3xl"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch(previewImage.url);
                    if (!response.ok) throw new Error('Network response was not ok');
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    const filename = previewImage.url.split('/').pop() || `image-${Date.now()}.jpg`;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                  } catch (e) {
                    console.error('Download failed', e);
                    const link = document.createElement('a');
                    link.href = previewImage.url;
                    link.download = `image-${Date.now()}.jpg`;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="px-5 py-2.5 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-medium flex items-center gap-2"
              >
                <i className="ph-bold ph-download-simple" /> Save
              </button>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-sm font-medium text-gray-700"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <img
                src={previewImage.url}
                alt={previewImage.title || 'Image'}
                className="mx-auto max-h-[60vh] w-auto max-w-full rounded-lg object-contain"
                loading="lazy"
                onError={() =>
                  setPreviewImage((prev) => (prev ? { ...prev, failed: true } : prev))
                }
              />
            </div>
            {previewImage.failed && (
              <div className="text-sm text-red-600">
                Image not found / not accessible. Please re-upload the image and save the customer
                again.
              </div>
            )}
            {/* <div className="text-xs text-gray-500 break-all">
              If the image does not load, open it in a new tab:{' '}
              <a
                href={previewImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-crm-primary underline"
              >
                {previewImage.url}
              </a>
            </div> */}
          </div>
        </ReportModalShell>
      )}

      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingCustomer(null)}>
          <form
            onSubmit={handleEditSubmit}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b bg-crm-primary/5 border-crm-primary/15">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-pencil-simple" /> Edit Customer Details
              </h3>
              <button type="button" onClick={() => setEditingCustomer(null)} className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <i className="ph-bold ph-x text-lg" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
              <div className="report-modal-grid">
                <EditField label="Visit Date">
                  <input
                    type="date"
                    value={editingCustomer.visit_date || ''}
                    onChange={(e) => patchEditingCustomer({ visit_date: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Expo">
                  <select
                    value={getExpoSelectValue(editingCustomer)}
                    onChange={(e) => handleExpoChange(e.target.value)}
                    className={reportInputClass}
                  >
                    <option value="">Others (General)</option>
                    {expos.map((expo) => (
                      <option key={expo.id} value={String(expo.id)}>
                        {expo.expo_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Image" colSpan={2}>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                    {(editingCustomer.image || editingCustomer.image_path) && (
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            editingCustomer.image
                              ? editingCustomer.image
                              : resolvePublicUrl(editingCustomer.image_path)
                          }
                          alt="Image"
                          className="h-14 w-auto max-w-[220px] rounded border bg-gray-50 object-contain"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            patchEditingCustomer({ image: '', image_path: null })
                          }
                          className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        >
                          Remove Image
                        </button>
                      </div>
                    )}
                  </div>
                </EditField>
                <EditField label="Company Name" required colSpan={2}>
                  <input
                    type="text"
                    required
                    value={editingCustomer.company_name || ''}
                    onChange={(e) => patchEditingCustomer({ company_name: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Industry Type">
                  <input
                    type="text"
                    value={editingCustomer.industry_type || ''}
                    onChange={(e) => patchEditingCustomer({ industry_type: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Website">
                  <input
                    type="url"
                    value={editingCustomer.website || ''}
                    onChange={(e) => patchEditingCustomer({ website: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Customer Name" required colSpan={2}>
                  <input
                    type="text"
                    required
                    value={editingCustomer.customer_name || ''}
                    onChange={(e) => patchEditingCustomer({ customer_name: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Designation">
                  <input
                    type="text"
                    value={editingCustomer.designation || ''}
                    onChange={(e) => patchEditingCustomer({ designation: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Phone 1" required>
                  <input
                    type="tel"
                    required
                    value={editingCustomer.phone_1 || ''}
                    onChange={(e) => patchEditingCustomer({ phone_1: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Phone 2">
                  <input
                    type="tel"
                    value={editingCustomer.phone_2 || ''}
                    onChange={(e) => patchEditingCustomer({ phone_2: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Email">
                  <input
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={(e) => patchEditingCustomer({ email: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="City">
                  <CityAutocomplete
                    value={editingCustomer.city || ''}
                    onChange={(city) => patchEditingCustomer({ city })}
                    placeholder="Type to search city…"
                    inputClassName={reportInputClass}
                  />
                </EditField>
                <EditField label="Location / Address" colSpan={2}>
                  <input
                    type="text"
                    value={editingCustomer.location || ''}
                    onChange={(e) => patchEditingCustomer({ location: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Priority">
                  <select
                    value={editingCustomer.priority || 'medium'}
                    onChange={(e) => patchEditingCustomer({ priority: e.target.value })}
                    className={reportInputClass}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </EditField>
                <EditField label="Enquiry Type">
                  <select
                    value={editingCustomer.enquiry_type || ''}
                    onChange={(e) => patchEditingCustomer({ enquiry_type: e.target.value })}
                    className={reportInputClass}
                  >
                    <option value="">Select</option>
                    {ENQUIRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    {editingCustomer.enquiry_type &&
                      !ENQUIRY_OPTIONS.includes(editingCustomer.enquiry_type) && (
                        <option value={editingCustomer.enquiry_type}>{editingCustomer.enquiry_type}</option>
                      )}
                  </select>
                </EditField>
                <EditField label="Reference">
                  <input
                    type="text"
                    value={editingCustomer.reference_source || ''}
                    onChange={(e) => patchEditingCustomer({ reference_source: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
                <EditField label="Status">
                  <select
                    value={editingCustomer.status || 'pending'}
                    onChange={(e) => patchEditingCustomer({ status: e.target.value })}
                    className={reportInputClass}
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </EditField>
                <EditField label="Remarks" colSpan={2}>
                  <textarea
                    rows={3}
                    value={editingCustomer.remarks || ''}
                    onChange={(e) => patchEditingCustomer({ remarks: e.target.value })}
                    className={reportInputClass}
                  />
                </EditField>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 bg-gray-50/90 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}


      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-2 flex flex-col flex-1 min-h-0">
        
        {/* Header Section */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-[#00b5e2]/10 text-[#00b5e2] rounded-xl h-12 w-12 flex items-center justify-center shrink-0">
              <i className="ph-bold ph-users text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1e293b]">Customer Reports</h2>
              <p className="text-sm text-slate-500 mt-0.5">Manage and track all customer data</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowExcelModal(true)}
              className="bg-white border border-emerald-500 hover:bg-emerald-50 text-emerald-600 px-5 py-2.5 rounded-md text-[14px] font-medium shadow-sm flex items-center gap-2 transition-all w-full md:w-auto justify-center"
            >
              <i className="ph-bold ph-upload-simple text-lg"></i>
              Import
            </button>

            {['admin', 'super_admin', 'superadmin'].includes(userRole?.toLowerCase()) && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  className="bg-[#00b5e2] hover:bg-[#00a0c9] text-white px-5 py-2.5 rounded-md text-[14px] font-medium shadow-sm flex items-center gap-2 transition-all w-full md:w-auto justify-center"
                >
                  <i className="ph-bold ph-download-simple text-lg"></i>
                  Export
                </button>

                {isExportDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={handleExportExcel}
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
        </div>

        {/* Statistics Row - Single Line Theme */}
        <div className="px-4 py-3 border-b border-gray-100 bg-white overflow-x-auto shrink-0">
          <div className="flex items-center justify-between min-w-[700px] divide-x-[3px] divide-[#00b5e2]">
            
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <span className="text-[28px] font-bold text-blue-700 leading-none mb-2">{filteredCustomers.length}</span>
              <span className="text-[13px] font-bold text-black">Total Customers</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <span className="text-[28px] font-bold text-emerald-600 leading-none mb-2">{filteredCustomers.filter(c => c.status === 'completed').length}</span>
              <span className="text-[13px] font-medium text-black">Completed</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <span className="text-[28px] font-bold text-amber-500 leading-none mb-2">{filteredCustomers.filter(c => c.status !== 'completed').length}</span>
              <span className="text-[13px] font-medium text-black">Pending</span>
            </div>
            
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-4 pb-3 flex flex-wrap gap-3 items-end mt-3 shrink-0">
          <div className="flex-1 min-w-[300px] flex gap-2">
            <div className="w-1/3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">SEARCH FIELD</label>
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 bg-white"
              >
                <option value="all">All fields</option>
                <option value="company">Company</option>
                <option value="phone">Phone</option>
                <option value="name">Name</option>
                <option value="city">City</option>
              </select>
            </div>
            <div className="w-2/3 relative flex items-end">
               <div className="w-full relative">
                <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20"
                />
               </div>
            </div>
          </div>

          <div className="w-full md:w-[320px]">
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

          <div className="w-full md:w-auto flex shrink-0 justify-end">
            <button
              onClick={() => {
                setFilterExpo('all');
                setFilterEmployee('all');
                setSearchField('all');
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setSortBy('date-desc');
              }}
              className="px-4 py-2.5 w-full rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="ph ph-arrow-counter-clockwise"></i>
              Reset All
            </button>
          </div>
        </div>

        {!showAllCustomers && (
          <div className="px-6 pb-2">
            <p className="text-sm text-[#00b5e2] bg-[#00b5e2]/10 border border-[#00b5e2]/20 rounded-lg px-4 py-2 inline-block">
              Showing customers you registered only.
            </p>
          </div>
        )}

        {/* Table Data */}
        {loading ? (
          <div className="p-10 flex justify-center border-t border-gray-100">
            <LoadingSpinner label="Loading Report..." />
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar border-t border-gray-100 relative">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="bg-[#00b5e2] text-white">
                  {['admin', 'super_admin', 'superadmin'].includes(userRole?.toLowerCase()) && (
                    <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(filteredCustomers.map(c => c.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                        className="cursor-pointer rounded border-white/30 text-[#00b5e2] focus:ring-white"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center w-16">S.No</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Date</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Expo / Source</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Company</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Contact Person</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Phone</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Registered By</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Status</th>
                  <th className="px-4 py-3.5 font-semibold text-[13px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((cust, index) => (
                  <tr key={cust.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors bg-white">
                    {['admin', 'super_admin', 'superadmin'].includes(userRole?.toLowerCase()) && (
                      <td className="px-4 py-3 text-[13px] text-center border-r border-gray-100">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(cust.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, cust.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== cust.id));
                            }
                          }}
                          className="cursor-pointer text-[#00b5e2] focus:ring-[#00b5e2] rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-[13px] font-semibold text-gray-800 text-center border-r border-gray-100">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-800 text-center border-r border-gray-100">
                      {cust.visit_date ? formatDateTime(cust.visit_date).split(' ')[0] : '-'}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-100 text-center">
                      {cust.expo_id || cust.linked_expo || cust.manual_expo_name ? (
                        <div className="font-semibold text-[#00b5e2] text-[13px]">
                          {expoLabel(cust)}
                        </div>
                      ) : (
                        <div className="text-purple-600 text-[13px] font-semibold">
                          {cust.reference_source || ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[13px] text-gray-900 border-r border-gray-100 text-center">{cust.company_name}</td>
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-600 border-r border-gray-100 text-center">{cust.customer_name}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-gray-800 border-r border-gray-100 text-center">{cust.phone_1}</td>
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-800 border-r border-gray-100 text-center">{registeredByLabel(cust)}</td>
                    <td className="px-4 py-3 text-[13px] text-center border-r border-gray-100">
                      {cust.isOffline ? (
                        <div className="flex flex-col gap-1 items-center">
                          <span className="px-3 py-1 rounded border border-white/0 font-medium bg-amber-50 text-amber-600 capitalize inline-flex items-center text-[12px]">
                            <i className="ph-bold ph-wifi-slash mr-1"></i>
                            {cust.syncStatus === 'failed' ? 'Sync Failed' : 'Pending Sync'}
                          </span>
                        </div>
                      ) : (
                        <span className={`px-3 py-1 rounded border border-white/0 font-medium capitalize inline-flex items-center text-[12px] ${
                          cust.status === 'completed'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-amber-50 text-amber-500'
                        }`}>
                          <i className={`ph-bold ${cust.status === 'completed' ? 'ph-check-circle' : 'ph-clock'} mr-1`}></i>
                          {cust.status === 'completed' ? 'Completed' : 'Pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center items-center gap-1">
                        {cust.image_path && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: resolvePublicUrl(cust.image_path),
                                title: 'Image',
                              })
                            }
                            className="text-[#00b5e2] hover:bg-[#00b5e2]/10 p-1.5 rounded-full transition-colors inline-flex items-center justify-center"
                            title="View Image"
                          >
                            <i className="ph-bold ph-image text-[16px]"></i>
                          </button>
                        )}
                        <button onClick={() => setEditingCustomer({ ...cust })} className="text-[#00b5e2] hover:bg-[#00b5e2]/10 p-1.5 rounded-full transition-colors inline-flex items-center justify-center" title="Edit">
                          <i className="ph-bold ph-pencil-simple text-[16px]"></i>
                        </button>
                        {showAllCustomers && (
                          <button onClick={() => handleDelete(cust.id, cust.company_name)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors inline-flex items-center justify-center" title="Delete">
                            <i className="ph-bold ph-trash text-[16px]"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <i className="ph ph-magnifying-glass text-3xl text-gray-300"></i>
                        <p className="font-semibold">No customers found matching these filters</p>
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
              Showing {filteredCustomers.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} records
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
            <div className="hidden md:flex items-center gap-2">
              <select className="border border-gray-200 rounded px-2 py-1 text-[13px] font-bold text-gray-600 outline-none">
                <option>{itemsPerPage} per page</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {showExcelModal && (
        <ExcelImportModal
          expos={expos}
          sourceOptions={sourceOptions}
          currentUser={currentUser}
          existingCustomers={customers}
          onClose={() => setShowExcelModal(false)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default CustomerReport;
