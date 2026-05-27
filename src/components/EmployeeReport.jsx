import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const EmployeeReport = () => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

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

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.employee_id && emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
    if (filteredEmployees.length === 0) {
      alert("No data available to export");
      return;
    }
    const headers = ["Employee ID", "Full Name", "Email", "Phone", "Department", "Role", "Registered On"];
    const rows = filteredEmployees.map(emp => [
      emp.employee_id || '-',
      `"${(emp.name || '').replace(/"/g, '""')}"`,
      emp.email,
      emp.phone || '-',
      `"${(emp.department || '').replace(/"/g, '""')}"`,
      emp.role,
      emp.created_at
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
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
              <button onClick={() => setViewingEmployee(null)} className="text-gray-400 hover:text-gray-600">
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
              <button onClick={() => setViewingEmployee(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm">Close</button>
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
              <button onClick={() => setEditingEmployee(null)} className="text-gray-400 hover:text-gray-600">
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
                <button type="button" onClick={() => setEditingEmployee(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search + Export Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-normal text-crm-primary mb-1">Search Employee</label>
          <div className="relative">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Search by name, ID, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg outline-none crm-input"
            />
          </div>
        </div>
        <button onClick={handleExportCSV} className="bg-black hover:bg-neutral-800 text-white px-6 py-2 rounded-lg font-normal shadow-sm flex items-center gap-2 h-10 transition-colors w-full md:w-auto justify-center">
          <i className="ph-bold ph-download-simple"></i> Export Report
        </button>
      </div>

      {/* Table — Expo-style UI */}
      <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-crm-textDark min-w-[800px] border border-gray-300">
          <thead>
            <tr className="bg-crm-primary border-b border-crm-primary text-white">
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
            {filteredEmployees.map((emp, index) => (
              <tr key={emp.id} className="border-b border-gray-300 hover:bg-crm-primaryLighter transition-colors">
                <td className="px-4 py-3 text-sm border-r border-gray-300 text-center text-gray-600">{index + 1}</td>
                <td className="px-4 py-3 font-normal text-sm border-r border-gray-300">{emp.employee_id || '-'}</td>
                <td className="px-4 py-3 font-medium text-sm border-r border-gray-300">{emp.name}</td>
                <td className="px-4 py-3 text-sm border-r border-gray-300">{emp.email}</td>
                <td className="px-4 py-3 text-sm border-r border-gray-300">{emp.phone || '-'}</td>
                <td className="px-4 py-3 text-sm border-r border-gray-300">{emp.department || '-'}</td>
                <td className="px-4 py-3 capitalize text-sm font-normal border-r border-gray-300">
                  <span className="px-2.5 py-1 rounded-full text-xs bg-crm-primaryLighter text-crm-primary">{emp.role}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setViewingEmployee(emp)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50" title="View"><i className="ph-bold ph-eye text-lg"></i></button>
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
    </div>
  );
};

export default EmployeeReport;
