import React, { useState, useEffect, useRef } from 'react';
import { fetchApi, API_BASE_URL } from '../utils/api';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const CustomerReport = () => {
  const [customers, setCustomers] = useState([]);
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
    loadData();
    
    // Close dropdown on click outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const custRes = await fetchApi('customers.php');
      if (custRes.status === 'success') setCustomers(custRes.data);
      
      const expoRes = await fetchApi('expos.php');
      if (expoRes.status === 'success') setExpos(expoRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      try {
        const res = await fetchApi(`customers.php?id=${id}`, { method: 'DELETE' });
        if (res.status === 'success') {
          alert('Customer deleted');
          loadData();
        } else {
          alert(res.message || 'Failed to delete');
        }
      } catch (e) {
        console.error(e);
      }
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
        alert('Customer updated successfully');
        setEditingCustomer(null);
        loadData();
      } else {
        alert(res.message || 'Failed to update');
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

      // Date Wise Filter (Start Date & End Date)
      if (!c.visit_date) return matchesSearch && matchesExpo && matchesStatus;
      const visitDate = new Date(c.visit_date);
      const matchesStartDate = startDate ? visitDate >= new Date(startDate) : true;
      const matchesEndDate = endDate ? visitDate <= new Date(endDate) : true;

      return matchesSearch && matchesExpo && matchesStatus && matchesStartDate && matchesEndDate;
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
    link.setAttribute("download", `customer_report_${new Date().toISOString().slice(0,10)}.csv`);
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
    
    doc.save(`customer_report_${new Date().toISOString().slice(0,10)}.pdf`);
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
        th, td { border: 1px solid #ddd; padding: 8px; font-family: Arial, sans-serif; text-align: left; }
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
    a.download = `customer_report_${new Date().toISOString().slice(0,10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportDropdownOpen(false);
  };

  return (
    <div className="space-y-6 pb-12 font-sans animate-in fade-in duration-300">
      
      {/* View Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingCustomer(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-user-circle"></i> Customer Details
              </h3>
              <button onClick={() => setViewingCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <i className="ph-bold ph-x text-lg"></i>
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 h-[60vh] overflow-y-auto custom-scrollbar">
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Visit Date</p><p className="font-medium text-gray-800">{viewingCustomer.visit_date || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Expo</p><p className="font-medium text-gray-800">{viewingCustomer.linked_expo || viewingCustomer.manual_expo_name || '-'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500 uppercase font-semibold">Company Name</p><p className="font-medium text-gray-800">{viewingCustomer.company_name}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500 uppercase font-semibold">Customer Name</p><p className="font-medium text-gray-800">{viewingCustomer.customer_name}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Designation</p><p className="font-medium text-gray-800">{viewingCustomer.designation || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Phone 1</p><p className="font-medium text-gray-800">{viewingCustomer.phone_1 || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Phone 2</p><p className="font-medium text-gray-800">{viewingCustomer.phone_2 || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Email</p><p className="font-medium text-gray-800">{viewingCustomer.email || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Website</p><p className="font-medium text-gray-800">{viewingCustomer.website || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">City</p><p className="font-medium text-gray-800">{viewingCustomer.city || '-'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500 uppercase font-semibold">Location / Address</p><p className="font-medium text-gray-800">{viewingCustomer.location || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Priority</p><p className="font-medium text-gray-800">{viewingCustomer.priority ? viewingCustomer.priority.toUpperCase() : 'MEDIUM'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Enquiry Type</p><p className="font-medium text-gray-800">{viewingCustomer.enquiry_type || 'Unknown'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Reference Source</p><p className="font-medium text-gray-800">{viewingCustomer.reference_source || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Status</p><p className="font-medium text-gray-800">{viewingCustomer.status === 'completed' ? 'Completed' : 'Pending'}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500 uppercase font-semibold">Remarks</p><p className="font-medium text-gray-800">{viewingCustomer.remarks || '-'}</p></div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button onClick={() => setViewingCustomer(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingCustomer(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-pencil-simple"></i> Edit Customer Details
              </h3>
              <button onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-gray-600">
                <i className="ph-bold ph-x text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Company Name</label>
                  <input type="text" required value={editingCustomer.company_name || ''} onChange={e => setEditingCustomer({...editingCustomer, company_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Customer Name</label>
                  <input type="text" required value={editingCustomer.customer_name || ''} onChange={e => setEditingCustomer({...editingCustomer, customer_name: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Phone 1</label>
                  <input type="text" required value={editingCustomer.phone_1 || ''} onChange={e => setEditingCustomer({...editingCustomer, phone_1: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">City</label>
                  <input type="text" value={editingCustomer.city || ''} onChange={e => setEditingCustomer({...editingCustomer, city: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Priority</label>
                  <select value={editingCustomer.priority || 'medium'} onChange={e => setEditingCustomer({...editingCustomer, priority: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Status</label>
                  <select value={editingCustomer.status || 'pending'} onChange={e => setEditingCustomer({...editingCustomer, status: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary">
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setEditingCustomer(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Section: Pill Tabs & Premium Interactive Export Menu */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        {/* Completed / Pending Tabs with Dynamic Badges */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200/30 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'all'
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
            className={`px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'completed'
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
            className={`px-4 py-2.5 text-sm font-semibold transition-all rounded-lg flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'pending'
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

      {/* Main Customers Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap text-crm-textDark">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Date</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Expo</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Company</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Contact Person</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Phone</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">City</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Priority</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Enquiry Type</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-4 text-crm-primary font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map(cust => (
              <tr key={cust.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter/40 transition-colors duration-150">
                <td className="px-5 py-3.5 text-sm text-gray-600">{cust.visit_date}</td>
                <td className="px-5 py-3.5 font-semibold text-crm-primary text-sm">{cust.linked_expo || cust.manual_expo_name || '-'}</td>
                <td className="px-5 py-3.5 font-semibold text-sm text-gray-900">{cust.company_name}</td>
                <td className="px-5 py-3.5 text-sm text-gray-700">{cust.customer_name}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600 font-mono">{cust.phone_1}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{cust.city || '-'}</td>
                <td className="px-5 py-3.5 text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    cust.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                    cust.priority === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {cust.priority ? cust.priority.toUpperCase() : 'MEDIUM'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    cust.enquiry_type === 'Hot Lead' ? 'bg-red-50 text-red-700 border-red-200/50' :
                    cust.enquiry_type === 'Warm Lead' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                    'bg-slate-50 text-slate-700 border-slate-200/50'
                  }`}>
                    {cust.enquiry_type || 'Unknown'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    cust.status === 'completed' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                      : 'bg-amber-50 text-amber-700 border-amber-200/50'
                  }`}>
                    <i className={`ph-bold ${cust.status === 'completed' ? 'ph-check-circle' : 'ph-clock'} mr-1 text-xs`}></i>
                    {cust.status === 'completed' ? 'Completed' : 'Pending'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-right whitespace-nowrap">
                  <div className="flex justify-end items-center gap-2">
                    {cust.image_path && (
                      <a 
                        href={`${API_BASE_URL.replace('/api', '')}/${cust.image_path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-gray-700 p-1"
                        title="View Card"
                      >
                        <i className="ph-bold ph-image text-lg"></i>
                      </a>
                    )}
                    <button onClick={() => setViewingCustomer(cust)} className="text-blue-600 hover:text-blue-800 p-1" title="View"><i className="ph-bold ph-eye text-lg"></i></button>
                    <button onClick={() => setEditingCustomer(cust)} className="text-crm-primary hover:text-crm-primaryDark p-1" title="Edit"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                    <button onClick={() => handleDelete(cust.id)} className="text-red-600 hover:text-red-800 p-1" title="Delete"><i className="ph-bold ph-trash text-lg"></i></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan="10" className="px-5 py-12 text-center text-gray-400">
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
  );
};

export default CustomerReport;
