import React, { useState, useEffect, useRef } from 'react';
import { fetchApi, API_BASE_URL } from '../utils/api';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { isPrivilegedRole } from '../utils/roles';
import LoadingSpinner from './common/LoadingSpinner';
import { confirmDelete } from '../utils/confirm';
import { showToast } from '../utils/toast';
import ReportModalShell, { DetailField, EditField, reportInputClass } from './common/ReportModalShell';

const ENQUIRY_OPTIONS = ['IDC', 'Website', 'Web page', 'Application', 'General Inquiry', 'Unknown'];

const CustomerReport = ({ currentUser, filterSource }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExpo, setFilterExpo] = useState('');
  const [expos, setExpos] = useState([]);

  // Filter & Sort States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'completed', 'pending'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'company-asc', 'company-desc'

  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // UI Dropdown States
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
      const [custRes, expoRes] = await Promise.all([
        fetchApi(`customers.php?_${Date.now()}${uid}${role}`),
        fetchApi('expos.php'),
      ]);
      if (custRes.status === 'success') setCustomers(custRes.data || []);
      if (expoRes.status === 'success') setExpos(expoRes.data || []);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load customer report.');
    } finally {
      setLoading(false);
    }
  };

  const registeredByLabel = (cust) =>
    cust.registered_by_name ||
    cust.registered_by_username ||
    (cust.created_by ? `User #${cust.created_by}` : '—');

  const expoLabel = (cust) => cust.linked_expo || cust.manual_expo_name || '—';

  const getExpoSelectValue = (cust) => {
    return cust.expo_id ? String(cust.expo_id) : '';
  };

  const patchEditingCustomer = (patch) =>
    setEditingCustomer((prev) => (prev ? { ...prev, ...patch } : prev));

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

  // Advanced Filtering and Sorting Logic
  const filteredCustomers = customers
    .filter(c => {
      const companyName = c.company_name || '';
      const customerName = c.customer_name || '';
      const phone1 = c.phone_1 || '';

      // Search term filter
      const matchesSearch = companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone1.includes(searchTerm);

      // Expo filter
      const matchesExpo = filterExpo ? c.expo_id == filterExpo : true;

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
      const matchesStartDate = startDate ? visitDate >= new Date(startDate) : true;
      const matchesEndDate = endDate ? visitDate <= new Date(endDate) : true;

      return matchesSearch && matchesExpo && matchesStatus && matchesStartDate && matchesEndDate && matchesSource;
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

  // Exporters
  const handleExportExcel = () => {
    if (filteredCustomers.length === 0) {
      alert("No data available to export");
      return;
    }
    const headers = ["Date", "Expo", "Company Name", "Contact Person", "Phone", "City", "Enquiry Type", "Status"];
    const rows = filteredCustomers.map(c => [
      c.visit_date,
      c.linked_expo || c.manual_expo_name || '-',
      `"${(c.company_name || '').replace(/"/g, '""')}"`,
      `"${(c.customer_name || '').replace(/"/g, '""')}"`,
      c.phone_1,
      c.city || '-',
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
    if (filteredCustomers.length === 0) {
      alert('No data to export');
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Customer Leads Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Filter: ${activeTab.toUpperCase()}`, 14, 26);

    const headers = ["Date", "Expo", "Company", "Contact Person", "Phone", "City", "Type", "Status"];
    const rows = filteredCustomers.map(c => [
      c.visit_date,
      c.linked_expo || c.manual_expo_name || '-',
      c.company_name,
      c.customer_name,
      c.phone_1,
      c.city || '-',
      c.enquiry_type || 'Unknown',
      c.status === 'completed' ? 'Completed' : 'Pending'
    ]);

    doc.autoTable({
      startY: 32,
      head: [headers],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [153, 0, 51] }, // CRM primary crimson
      styles: { fontSize: 8, font: 'helvetica' }
    });

    doc.save(`customer_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    setIsExportDropdownOpen(false);
  };

  const handleExportWord = () => {
    if (filteredCustomers.length === 0) {
      alert('No data to export');
      return;
    }
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>Customer Leads Report</title>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; font-family: 'Open Sans', sans-serif; text-align: left; }
        th { background-color: #990033; color: white; }
      </style>
      </head>
      <body>
      <h2>Customer Leads Report</h2>
      <p>Generated on: ${new Date().toLocaleDateString()} | Filter: ${activeTab.toUpperCase()}</p>
      <table>
        <tr>
          <th>Date</th>
          <th>Expo</th>
          <th>Company</th>
          <th>Contact Person</th>
          <th>Phone</th>
          <th>City</th>
          <th>Enquiry Type</th>
          <th>Status</th>
        </tr>`;
    const rows = filteredCustomers.map(c => `
        <tr>
          <td>${c.visit_date}</td>
          <td>${c.linked_expo || c.manual_expo_name || '-'}</td>
          <td>${c.company_name}</td>
          <td>${c.customer_name}</td>
          <td>${c.phone_1}</td>
          <td>${c.city || '-'}</td>
          <td>${c.enquiry_type || 'Unknown'}</td>
          <td>${c.status === 'completed' ? 'Completed' : 'Pending'}</td>
        </tr>`).join('');
    const footer = '</table></body></html>';
    const blob = new Blob([header + rows + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `customer_report_${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportDropdownOpen(false);
  };

  return (
    <div className="space-y-6 pb-12 font-sans animate-in fade-in duration-300">

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
                className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-white text-sm font-medium text-gray-700"
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
          <div className="report-modal-grid">
            <DetailField label="Visit Date" value={viewingCustomer.visit_date || '-'} />
            <DetailField label="Expo" value={expoLabel(viewingCustomer)} />
            <DetailField label="Company Name" value={viewingCustomer.company_name} colSpan={2} />
            <DetailField label="Industry Type" value={viewingCustomer.industry_type || '-'} />
            <DetailField label="Website" value={viewingCustomer.website || '-'} />
            <DetailField label="Customer Name" value={viewingCustomer.customer_name} colSpan={2} />
            <DetailField label="Designation" value={viewingCustomer.designation || '-'} />
            <DetailField label="Phone 1" value={viewingCustomer.phone_1 || '-'} />
            <DetailField label="Phone 2" value={viewingCustomer.phone_2 || '-'} />
            <DetailField label="Email" value={viewingCustomer.email || '-'} />
            <DetailField label="City" value={viewingCustomer.city || '-'} />
            <DetailField label="Location / Address" value={viewingCustomer.location || '-'} colSpan={2} />
            <DetailField label="Priority" value={viewingCustomer.priority ? viewingCustomer.priority.toUpperCase() : 'MEDIUM'} />
            <DetailField label="Enquiry Type" value={viewingCustomer.enquiry_type || 'Unknown'} />
            <DetailField label="Reference" value={viewingCustomer.reference_source || '-'} />
            <DetailField label="Status" value={viewingCustomer.status === 'completed' ? 'Completed' : 'Pending'} />
            <DetailField label="Registered By" value={registeredByLabel(viewingCustomer)} colSpan={2} />
            <DetailField label="Remarks" value={viewingCustomer.remarks || '-'} colSpan={2} />
            {viewingCustomer.image_path && (
              <DetailField label="Business Card" colSpan={2}>
                <a
                  href={`${API_BASE_URL.replace('/api', '')}/${viewingCustomer.image_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-crm-primary hover:underline inline-flex items-center gap-1"
                >
                  <i className="ph-bold ph-image" /> View image
                </a>
              </DetailField>
            )}
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
                  <input
                    type="text"
                    value={editingCustomer.city || ''}
                    onChange={(e) => patchEditingCustomer({ city: e.target.value })}
                    className={reportInputClass}
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
            <div className="shrink-0 px-6 py-4 bg-gray-50/90 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-white text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Top Section: Pill Tabs & Premium Interactive Export Menu */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        {/* Completed / Pending Tabs with Dynamic Badges */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200/30 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex items-center gap-2 whitespace-nowrap ${activeTab === 'all'
                ? 'bg-crm-primary text-white shadow-md'
                : 'text-gray-600 hover:text-crm-primary hover:bg-gray-200/50'
              }`}
          >
            <i className="ph-bold ph-list-bullets text-base"></i> All Leads
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {customers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex items-center gap-2 whitespace-nowrap ${activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-600 hover:text-emerald-600 hover:bg-emerald-50/50'
              }`}
          >
            <i className="ph-bold ph-check-circle text-base"></i> Completed
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {customers.filter(c => c.status === 'completed').length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex items-center gap-2 whitespace-nowrap ${activeTab === 'pending'
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50/50'
              }`}
          >
            <i className="ph-bold ph-clock text-base"></i> Pending
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
              {customers.filter(c => c.status !== 'completed').length}
            </span>
          </button>
        </div>

        {/* Premium Interactive Dropdown Export Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
            className="w-full lg:w-auto bg-gradient-to-r from-crm-primary to-crm-primaryDark hover:from-crm-primaryDark hover:to-crm-primary text-white px-6 py-3 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95"
          >
            <i className="ph-bold ph-download-simple text-lg"></i>
            Export Reports
            <i className={`ph-bold ph-caret-down transition-transform duration-300 ${isExportDropdownOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {isExportDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={handleExportExcel}
                className="w-full px-5 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-emerald-50/30 flex items-center gap-3 transition-colors group"
              >
                <i className="ph-fill ph-file-xls text-emerald-600 text-xl group-hover:scale-110 transition-transform"></i>
                Export to Excel (.csv)
              </button>
              <button
                onClick={handleExportPDF}
                className="w-full px-5 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-red-50/30 flex items-center gap-3 transition-colors group"
              >
                <i className="ph-fill ph-file-pdf text-red-600 text-xl group-hover:scale-110 transition-transform"></i>
                Export to PDF (.pdf)
              </button>
              <button
                onClick={handleExportWord}
                className="w-full px-5 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-blue-50/30 flex items-center gap-3 transition-colors group"
              >
                <i className="ph-fill ph-file-doc text-blue-600 text-xl group-hover:scale-110 transition-transform"></i>
                Export to Word (.doc)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters: Search, Expo, Date Range, Sort order */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
        {/* Search */}
        <div className="w-full">
          <label className="block text-sm font-semibold text-crm-primary mb-1.5">Search Customer</label>
          <div className="relative">
            <i className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg"></i>
            <input
              type="text"
              placeholder="Search by name, company, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl outline-none crm-input transition-all focus:ring-2 focus:ring-crm-primary/10 focus:border-crm-primary"
            />
          </div>
        </div>

        {/* Filter by Expo */}
        <div className="w-full">
          <label className="block text-sm font-semibold text-crm-primary mb-1.5">Filter by Expo</label>
          <select
            value={filterExpo}
            onChange={(e) => setFilterExpo(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl outline-none crm-input transition-all focus:ring-2 focus:ring-crm-primary/10 focus:border-crm-primary"
          >
            <option value="">All Expos</option>
            {expos.map(expo => (
              <option key={expo.id} value={expo.id}>{expo.expo_name}</option>
            ))}
          </select>
        </div>

        {/* Date Wise Filters */}
        <div className="w-full grid grid-cols-2 gap-3 lg:col-span-1">
          <div>
            <label className="block text-sm font-semibold text-crm-primary mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl outline-none crm-input text-sm transition-all focus:ring-2 focus:ring-crm-primary/10 focus:border-crm-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-crm-primary mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl outline-none crm-input text-sm transition-all focus:ring-2 focus:ring-crm-primary/10 focus:border-crm-primary"
            />
          </div>
        </div>

        {/* Sorting options */}
        <div className="w-full">
          <label className="block text-sm font-semibold text-crm-primary mb-1.5">Order Options</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl outline-none crm-input transition-all focus:ring-2 focus:ring-crm-primary/10 focus:border-crm-primary"
          >
            <option value="date-desc">Newest Visit First</option>
            <option value="date-asc">Oldest Visit First</option>
            <option value="company-asc">Company Name (A to Z)</option>
            <option value="company-desc">Company Name (Z to A)</option>
          </select>
        </div>
      </div>

      {!showAllCustomers && (
        <p className="text-sm text-crm-primary bg-crm-primaryLighter/60 border border-crm-primary/15 rounded-lg px-4 py-2">
          Showing customers you registered only.
        </p>
      )}

      {loading ? (
        <LoadingSpinner label="Loading customer report..." />
      ) : (
        <div className="report-table-wrap">
          <div className="report-table-scroll rounded-xl border border-gray-300 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse whitespace-nowrap text-crm-textDark min-w-[1000px]">
              <thead>
                <tr className="bg-crm-primary border-b border-crm-primary text-white">
                  <th className="px-4 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20 w-14">S.No</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Date</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Expo</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Company</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Contact Person</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Phone</th>
                  {showAllCustomers && (
                    <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Registered By</th>
                  )}
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">City</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Priority</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Enquiry Type</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider border-r border-white/20">Status</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust, index) => (
                  <tr key={cust.id} className="border-b border-gray-300 hover:bg-crm-primaryLighter/40 transition-colors duration-150">
                    <td className="px-4 py-3.5 text-sm text-gray-600 border-r border-gray-300 text-center">{index + 1}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 border-r border-gray-300">{cust.visit_date}</td>
                    <td className="px-5 py-3.5 font-semibold text-crm-primary text-sm border-r border-gray-300">{expoLabel(cust)}</td>
                    <td className="px-5 py-3.5 font-semibold text-sm text-gray-900 border-r border-gray-300">{cust.company_name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-700 border-r border-gray-300">{cust.customer_name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 font-mono border-r border-gray-300">{cust.phone_1}</td>
                    {showAllCustomers && (
                      <td className="px-5 py-3.5 text-sm text-gray-700 border-r border-gray-300">{registeredByLabel(cust)}</td>
                    )}
                    <td className="px-5 py-3.5 text-sm text-gray-600 border-r border-gray-300">{cust.city || '-'}</td>
                    <td className="px-5 py-3.5 text-sm border-r border-gray-300">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cust.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                          cust.priority === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                        {cust.priority ? cust.priority.toUpperCase() : 'MEDIUM'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm border-r border-gray-300">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cust.enquiry_type === 'IDC' ? 'bg-blue-50 text-blue-700 border-blue-200/50' :
                          cust.enquiry_type === 'Website' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/50' :
                            cust.enquiry_type === 'Application' ? 'bg-purple-50 text-purple-700 border-purple-200/50' :
                              'bg-slate-50 text-slate-700 border-slate-200/50'
                        }`}>
                        {cust.enquiry_type || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm border-r border-gray-300">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cust.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                          : 'bg-amber-50 text-amber-700 border-amber-200/50'
                        }`}>
                        <i className={`ph-bold ${cust.status === 'completed' ? 'ph-check-circle' : 'ph-clock'} mr-1 text-xs`}></i>
                        {cust.status === 'completed' ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-1">
                        {cust.image_path && (
                          <a
                            href={`${API_BASE_URL.replace('/api', '')}/${cust.image_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100"
                            title="View Card"
                          >
                            <i className="ph-bold ph-image text-lg"></i>
                          </a>
                        )}
                        <button onClick={() => setViewingCustomer(cust)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50" title="View"><i className="ph-bold ph-eye text-lg"></i></button>
                        <button onClick={() => setEditingCustomer({ ...cust })} className="text-crm-primary hover:text-crm-primaryDark p-1.5 rounded-lg hover:bg-crm-primaryLighter" title="Edit"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                        <button onClick={() => handleDelete(cust.id, cust.company_name)} className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50" title="Delete"><i className="ph-bold ph-trash text-lg"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={showAllCustomers ? 12 : 11} className="px-5 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <i className="ph-bold ph-tray text-4xl text-gray-300"></i>
                        <p className="font-semibold text-gray-500">No customers found matching these filters</p>
                        <p className="text-xs text-gray-400">Try adjusting your search query, status tabs, or date range.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerReport;
