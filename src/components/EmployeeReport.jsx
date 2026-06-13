import React, { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../utils/api';
import { formatDateTime } from '../utils/dateUtils';

const EmployeeReport = () => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [searchTerm, searchField, filterRole, startDate, endDate]);

  const loadEmployees = async () => {
    try {
      const res = await fetchApi('users.php');
      if (res.status === 'success') {
        setEmployees(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    // Role filter
    if (filterRole !== 'all' && String(emp.role).toLowerCase() !== String(filterRole).toLowerCase()) {
      return false;
    }

    // Date Range Filter
    const parseDate = (dStr) => {
      if (!dStr) return 0;
      let str = String(dStr).trim();
      if (str.includes('-') && str.split('-')[0].length <= 2) {
        const parts = str.split(/[\sT]+/);
        const [day, month, year] = parts[0].split('-');
        str = `${year}-${month}-${day}${parts[1] ? ' ' + parts[1] : ''}`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) str += ' 00:00:00';
      if (!str.includes('T') && !str.includes('Z')) str = str.replace(/-/g, '/');
      const time = new Date(str).getTime();
      return isNaN(time) ? 0 : time;
    };

    let effStartDate = startDate;
    let effEndDate = endDate;
    if (startDate && !endDate) effEndDate = startDate;
    if (endDate && !startDate) effStartDate = endDate;

    if (effStartDate) {
      if (!emp.created_at || parseDate(emp.created_at) < parseDate(effStartDate)) return false;
    }
    if (effEndDate) {
      const endOfDay = parseDate(effEndDate) + 86399999;
      if (!emp.created_at || parseDate(emp.created_at) > endOfDay) return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const name = (emp.name || '').toLowerCase();
      const empId = (emp.employee_id || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const phone = (emp.phone || '').toLowerCase();

      if (searchField === 'all') {
        if (!name.includes(q) && !empId.includes(q) && !dept.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
      } else if (searchField === 'name') {
        if (!name.includes(q)) return false;
      } else if (searchField === 'id') {
        if (!empId.includes(q)) return false;
      } else if (searchField === 'department') {
        if (!dept.includes(q)) return false;
      } else if (searchField === 'email') {
        if (!email.includes(q)) return false;
      } else if (searchField === 'phone') {
        if (!phone.includes(q)) return false;
      }
    }

    return true;
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination Logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchField, filterRole, startDate, endDate]);

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      try {
        const res = await fetchApi(`users.php?id=${id}`, { method: 'DELETE' });
        if (res.status === 'success') {
          alert('Employee deleted');
          loadEmployees();
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
      const payload = {
        ...editingEmployee,
        employeeId: editingEmployee.employee_id,
        status: editingEmployee.status || 'active'
      };
      const res = await fetchApi('users.php', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.status === 'success') {
        alert('Employee updated successfully');
        setEditingEmployee(null);
        loadEmployees();
      } else {
        alert(res.message || 'Failed to update');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = selectedIds.length > 0 ? filteredEmployees.filter(emp => selectedIds.includes(emp.id)) : filteredEmployees;
    if (dataToExport.length === 0) {
      alert("No data available to export");
      return;
    }
    const headers = ["Employee ID", "Full Name", "Email", "Phone", "Department", "Role", "Registered On"];
    const rows = dataToExport.map(emp => [
      emp.employee_id || '-',
      `"${(emp.name || '').replace(/"/g, '""')}"`,
      emp.email,
      emp.phone ? `="${emp.phone}"` : '-',
      `"${(emp.department || '').replace(/"/g, '""')}"`,
      emp.role,
      emp.created_at
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `employee_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-12 max-w-full mx-auto font-sans animate-in fade-in duration-300 p-4 lg:p-6 bg-[#f8fafc] min-h-screen">

      {/* View Modal */}
      {viewingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ marginTop: 0 }} onClick={() => setViewingEmployee(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-user-circle"></i> Employee Details
              </h3>
              <button onClick={() => setViewingEmployee(null)} className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-colors">
                <i className="ph-bold ph-x text-lg"></i>
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Employee ID</p><p className="font-medium text-gray-800">{viewingEmployee.employee_id || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Name</p><p className="font-medium text-gray-800">{viewingEmployee.name}</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-500 uppercase font-semibold">Email</p><p className="font-medium text-gray-800">{viewingEmployee.email}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Phone</p><p className="font-medium text-gray-800">{viewingEmployee.phone || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Department</p><p className="font-medium text-gray-800">{viewingEmployee.department || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Role</p><p className="capitalize font-medium text-gray-800">{viewingEmployee.role}</p></div>
              <div><p className="text-xs text-gray-500 uppercase font-semibold">Registered</p><p className="font-medium text-gray-800 text-sm">{viewingEmployee.created_at}</p></div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setViewingEmployee(null)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-sm font-semibold">Close</button>
              <button
                onClick={() => {
                  setEditingEmployee(viewingEmployee);
                  setViewingEmployee(null);
                }}
                className="px-4 py-2 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-medium"
              >
                <i className="ph-bold ph-pencil-simple mr-1"></i> Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ marginTop: 0 }} onClick={() => setEditingEmployee(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-pencil-simple"></i> Edit Employee
              </h3>
              <button onClick={() => setEditingEmployee(null)} className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-colors">
                <i className="ph-bold ph-x text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Employee ID</label>
                  <input type="text" value={editingEmployee.employee_id || ''} onChange={e => setEditingEmployee({ ...editingEmployee, employee_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Username *</label>
                  <input type="text" required value={editingEmployee.username || ''} onChange={e => setEditingEmployee({ ...editingEmployee, username: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Full Name *</label>
                  <input type="text" required value={editingEmployee.name || ''} onChange={e => setEditingEmployee({ ...editingEmployee, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Email *</label>
                  <input type="email" required value={editingEmployee.email || ''} onChange={e => setEditingEmployee({ ...editingEmployee, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Phone</label>
                  <input type="text" value={editingEmployee.phone || ''} onChange={e => setEditingEmployee({ ...editingEmployee, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Department</label>
                  <input type="text" value={editingEmployee.department || ''} onChange={e => setEditingEmployee({ ...editingEmployee, department: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Role</label>
                  <select value={editingEmployee.role || 'employee'} onChange={e => setEditingEmployee({ ...editingEmployee, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary">
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setEditingEmployee(null)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Report UI */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-4">
        
        {/* Header Section */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#00b5e2]/10 text-[#00b5e2] rounded-xl h-12 w-12 flex items-center justify-center shrink-0">
              <i className="ph-bold ph-identification-card text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1e293b]">Employee Reports</h2>
              <p className="text-sm text-slate-500 mt-0.5">Manage and track staff members</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            {['admin', 'super_admin', 'superadmin'].includes(filterRole?.toLowerCase()) && (
              <button
                onClick={handleExportCSV}
                className="bg-[#00b5e2] hover:bg-[#00a0c9] text-white px-5 py-2.5 rounded-md text-[14px] font-medium shadow-sm flex items-center gap-2 transition-all w-full md:w-auto justify-center"
              >
                <i className="ph-bold ph-download-simple text-lg"></i>
                Export
              </button>
            )}
          </div>
        </div>

        {/* Statistics Row */}
        <div className="p-6">
          <div className="border border-gray-200 rounded-xl flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-gray-200">
            <div className="flex-1 p-5 flex items-center justify-center gap-4">
              <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <i className="ph-fill ph-users-three text-2xl"></i>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-700">{filteredEmployees.length}</div>
                <div className="text-[13px] font-bold text-gray-800 uppercase mt-1">Total Staff</div>
              </div>
            </div>
            
            <div className="flex-1 p-5 flex flex-col items-center justify-center border-l-4 border-l-[#00b5e2]/30">
              <div className="text-3xl font-bold text-emerald-600">{filteredEmployees.filter(e => e.role === 'admin' || e.role === 'super_admin' || e.role === 'superadmin').length}</div>
              <div className="text-[13px] font-bold text-gray-800 mt-1">Admins</div>
            </div>

            <div className="flex-1 p-5 flex flex-col items-center justify-center border-l-4 border-l-[#00b5e2]/30">
              <div className="text-3xl font-bold text-amber-500">{filteredEmployees.filter(e => e.role !== 'admin' && e.role !== 'super_admin' && e.role !== 'superadmin').length}</div>
              <div className="text-[13px] font-bold text-gray-800 mt-1">Employees / Managers</div>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">ROLE</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          <div className="md:col-span-6 flex gap-2">
            <div className="w-1/3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">SEARCH FIELD</label>
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 bg-white"
              >
                <option value="all">All fields</option>
                <option value="name">Name</option>
                <option value="id">Employee ID</option>
                <option value="department">Department</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
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

          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">REGISTRATION DATE</label>
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

          <div className="md:col-span-7 flex justify-end">
            <button
              onClick={() => {
                setFilterRole('all');
                setSearchField('all');
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2.5 w-full md:w-auto rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="ph ph-arrow-counter-clockwise"></i>
              Reset All
            </button>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-[#00b5e2] text-white">
                {['admin', 'super_admin', 'superadmin'].includes(filterRole?.toLowerCase()) && (
                  <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredEmployees.map(emp => emp.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="cursor-pointer rounded border-white/30 text-[#00b5e2] focus:ring-white"
                    />
                  </th>
                )}
                <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center w-16">S.No</th>
                <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Employee ID</th>
                <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Full Name</th>
                <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Email</th>
                <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Phone</th>
                <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Department</th>
                <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 text-center">Role</th>
                <th className="px-4 py-3.5 font-semibold text-[13px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((emp, index) => (
                <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors bg-white">
                  {['admin', 'super_admin', 'superadmin'].includes(filterRole?.toLowerCase()) && (
                    <td className="px-4 py-3 text-[13px] text-center border-r border-gray-100">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, emp.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== emp.id));
                          }
                        }}
                        className="cursor-pointer text-[#00b5e2] focus:ring-[#00b5e2] rounded border-gray-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-[13px] font-semibold text-gray-800 text-center border-r border-gray-100">
                    {((currentPage - 1) * itemsPerPage) + index + 1}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-[#00b5e2] text-center border-r border-gray-100">
                    {emp.employee_id || '-'}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-gray-900 border-r border-gray-100 text-center">
                    {emp.name}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-600 border-r border-gray-100 text-center">
                    {emp.email}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-gray-800 border-r border-gray-100 text-center">
                    {emp.phone || '-'}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-800 border-r border-gray-100 text-center">
                    {emp.department || '-'}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-center border-r border-gray-100">
                    <span className="px-2.5 py-1 rounded bg-[#00b5e2]/10 text-[#00b5e2] font-semibold uppercase text-[11px] tracking-wide inline-block">
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center items-center gap-1">
                      <button onClick={() => setEditingEmployee(emp)} className="text-[#00b5e2] hover:bg-[#00b5e2]/10 p-1.5 rounded-full transition-colors inline-flex items-center justify-center" title="Edit">
                        <i className="ph-bold ph-pencil-simple text-[16px]"></i>
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors inline-flex items-center justify-center" title="Delete">
                        <i className="ph-bold ph-trash text-[16px]"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <i className="ph ph-magnifying-glass text-3xl text-gray-300"></i>
                      <p className="font-semibold">No employees found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="text-[13px] font-bold text-gray-800">
            Showing {filteredEmployees.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} entries
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
      </div>
    </div>
  );
};

export default EmployeeReport;
