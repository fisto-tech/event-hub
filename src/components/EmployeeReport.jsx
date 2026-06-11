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
    link.setAttribute("download", `employee_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-10">

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
                  <input type="text" value={editingEmployee.employee_id || ''} onChange={e => setEditingEmployee({...editingEmployee, employee_id: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Username *</label>
                  <input type="text" required value={editingEmployee.username || ''} onChange={e => setEditingEmployee({...editingEmployee, username: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Full Name *</label>
                  <input type="text" required value={editingEmployee.name || ''} onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Email *</label>
                  <input type="email" required value={editingEmployee.email || ''} onChange={e => setEditingEmployee({...editingEmployee, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Phone</label>
                  <input type="text" value={editingEmployee.phone || ''} onChange={e => setEditingEmployee({...editingEmployee, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Department</label>
                  <input type="text" value={editingEmployee.department || ''} onChange={e => setEditingEmployee({...editingEmployee, department: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Role</label>
                  <select value={editingEmployee.role || 'employee'} onChange={e => setEditingEmployee({...editingEmployee, role: e.target.value})} className="w-full px-3 py-2 rounded-lg border outline-none focus:border-crm-primary">
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">ROLE</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-crm-primary"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
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
                <option value="name">Name</option>
                <option value="id">Employee ID</option>
                <option value="department">Department</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
              <input
                type="text"
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">REGISTRATION DATE</label>
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
          
          {['admin', 'super_admin', 'superadmin'].includes(filterRole?.toLowerCase()) ? (
            <div className="lg:col-span-1 flex gap-2">
              <button
                onClick={handleExportCSV}
                className="w-full bg-black hover:bg-neutral-800 text-white px-3 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <i className="ph-bold ph-download-simple"></i> Export
              </button>
            </div>
          ) : <div className="lg:col-span-1"></div>}
          
        </div>
        
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => {
              setFilterRole('all');
              setSearchField('all');
              setSearchTerm('');
              setStartDate('');
              setEndDate('');
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Table — Expo-style UI */}
      <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-crm-textDark min-w-[800px] border border-gray-300">
          <thead>
            <tr className="bg-crm-primary border-b border-crm-primary text-white">
              {['admin', 'super_admin', 'superadmin'].includes(filterRole?.toLowerCase()) && (
                <th className="px-4 py-3 font-normal border-r border-white/20 w-10 text-center">
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
                    className="cursor-pointer"
                    title="Select All"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-normal border-r border-white/20 w-12 text-center">S.No</th>
              <th className="px-4 py-3 font-normal border-r border-white/20">Employee ID</th>
              <th className="px-4 py-3 font-normal border-r border-white/20">Full Name</th>
              <th className="px-4 py-3 font-normal border-r border-white/20">Email</th>
              <th className="px-4 py-3 font-normal border-r border-white/20">Phone</th>
              <th className="px-4 py-3 font-normal border-r border-white/20">Department</th>
              <th className="px-4 py-3 font-normal border-r border-white/20">Role</th>
              <th className="px-4 py-3 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployees.map((emp, index) => (
              <tr key={emp.id} className="border-b border-gray-300 hover:bg-crm-primaryLighter transition-colors">
                {['admin', 'super_admin', 'superadmin'].includes(filterRole?.toLowerCase()) && (
                  <td className="px-4 py-3 font-medium text-sm border-r border-gray-300 text-center">
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
                      className="cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-sm border-r border-gray-300 text-center text-gray-600">{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                <td className="px-4 py-3 font-normal text-sm border-r border-gray-300">{emp.employee_id || '-'}</td>
                <td className="px-4 py-3 font-medium text-sm border-r border-gray-300">{emp.name}</td>
                <td className="px-4 py-3 text-sm border-r border-gray-300">{emp.email}</td>
                <td className="px-4 py-3 text-sm border-r border-gray-300">{emp.phone || '-'}</td>
                <td className="px-4 py-3 text-sm border-r border-gray-300">{emp.department || '-'}</td>
                <td className="px-4 py-3 capitalize text-sm font-normal border-r border-gray-300">
                  <span className="px-2.5 py-1 rounded-full text-xs bg-crm-primaryLighter text-crm-primary">{emp.role}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditingEmployee(emp)} className="text-crm-primary hover:text-crm-primaryDark p-1.5 rounded-lg hover:bg-crm-primaryLighter ml-1" title="Edit"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                  <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 ml-1" title="Delete"><i className="ph-bold ph-trash text-lg"></i></button>
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400 border-t border-gray-300">No employees found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} entries
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
    </div>
  );
};

export default EmployeeReport;
