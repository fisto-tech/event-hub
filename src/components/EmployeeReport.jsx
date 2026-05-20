import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const EmployeeReport = () => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    if (filteredEmployees.length === 0) {
      alert("No data available to export");
      return;
    }

    // CSV Headers
    const headers = ["Employee ID", "Full Name", "Email", "Phone", "Department", "Role", "Registered On"];
    
    // Map rows
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-crm-textDark min-w-[800px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-crm-primary font-normal">Employee ID</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Full Name</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Email</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Phone</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Department</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Role</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Registered On</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => (
              <tr key={emp.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter transition-colors">
                <td className="px-4 py-3 font-normal text-sm">{emp.employee_id || '-'}</td>
                <td className="px-4 py-3 font-normal text-sm">{emp.name}</td>
                <td className="px-4 py-3 text-sm">{emp.email}</td>
                <td className="px-4 py-3 text-sm">{emp.phone || '-'}</td>
                <td className="px-4 py-3 text-sm">{emp.department || '-'}</td>
                <td className="px-4 py-3 capitalize text-sm font-normal text-crm-primary">{emp.role}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{emp.created_at}</td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">No employees found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeReport;
