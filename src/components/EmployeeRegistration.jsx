import React, { useState, useEffect, useRef } from 'react';
import { formatDateTime } from '../utils/dateUtils';
import { fetchApi } from '../utils/api';
import LoadingSpinner from './common/LoadingSpinner';
import { showToast } from '../utils/toast';
import { confirmDelete } from '../utils/confirm';
import {
  loadCustomDepartments,
  saveCustomDepartment,
  removeCustomDepartment,
  mergeDepartmentOptions,
} from '../utils/departments';
import ReportModalShell, { EditField, reportInputClass } from './common/ReportModalShell';
import CityAutocomplete from './common/CityAutocomplete';
import PhoneInput from './common/PhoneInput';
import { validateStoredPhone, normalizePhoneForSubmit, parseStoredPhone, digitsOnly } from '../utils/phoneUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import empImage from '../assets/employee-registration-image.webp';

const EmployeeRegistration = ({ currentUser }) => {
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    id: '',
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    city: '',
    department: '',
    role: 'employee',
    username: '',
    password: '',
    status: 'active',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [view, setView] = useState('register');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    setDepartmentOptions(mergeDepartmentOptions(employees, loadCustomDepartments()));
  }, [employees]);

  const loadEmployees = async () => {
    setListLoading(true);
    setLoadError('');
    try {
      const res = await fetchApi('users.php');
      if (res.status === 'success' && Array.isArray(res.data)) {
        setEmployees(res.data);
      } else {
        setEmployees([]);
        setLoadError(res.message || 'Could not load employees from server.');
      }
    } catch (e) {
      console.error(e);
      setEmployees([]);
      setLoadError(e.message || 'Could not connect to the API.');
    } finally {
      setListLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [searchTerm, searchField]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (true) {
      const phoneErr = validateStoredPhone(formData.phone, { required: true });
      if (phoneErr) {
        setSubmitError(phoneErr);
        showToast(phoneErr, 'error');
        return;
      }
      // Employee phone must be exactly 10 digits (national number)
      const parsed = parseStoredPhone(formData.phone);
      const nat = digitsOnly(parsed.national, 15);
      if (nat && nat.length !== 10) {
        const msg = 'Phone number must be exactly 10 digits';
        setSubmitError(msg);
        showToast(msg, 'error');
        return;
      }
    }
    setLoading(true);
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const payload = { ...formData, phone: normalizePhoneForSubmit(formData.phone) };
      const res = await fetchApi('users.php', {
        method,
        body: JSON.stringify(payload),
        ...(isEditing ? { headers: { 'X-HTTP-Method-Override': 'PUT' } } : {}),
      });
      if (res.status === 'success') {
        showToast(`Employee ${isEditing ? 'updated' : 'registered'} successfully!`);
        resetForm();
        loadEmployees();
      } else {
        setSubmitError(res.message || 'Registration failed.');
      }
    } catch (e) {
      console.error(e);
      setSubmitError(e.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      employeeId: '',
      name: '',
      email: '',
      phone: '',
      city: '',
      department: '',
      role: 'employee',
      username: '',
      password: '',
      status: 'active',
    });
    setIsEditing(false);
  };

  const handleEdit = (emp) => {
    setFormData({
      id: emp.id,
      employeeId: emp.employee_id || '',
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      city: emp.city || '',
      department: emp.department || '',
      role: emp.role,
      username: emp.username,
      password: '',
      status: emp.status,
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!confirmDelete(`employee "${name}"`)) return;
    try {
      const res = await fetchApi(`users.php?id=${id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        showToast('Employee deleted successfully!');
        loadEmployees();
      } else {
        showToast(res.message || 'Delete failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const roleLabel = (role) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Admin';
    return 'Employee';
  };

  const handleAddDepartment = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      showToast('Enter a department name', 'error');
      return;
    }
    const before = loadCustomDepartments();
    const added = saveCustomDepartment(trimmed);
    const isNew = added.length > before.length || !before.some((d) => d.toLowerCase() === trimmed.toLowerCase());
    setDepartmentOptions(mergeDepartmentOptions(employees, added));
    setFormData((prev) => ({ ...prev, department: trimmed }));
    setNewDeptName('');
    showToast(isNew ? 'Department added to list' : 'Department already exists', isNew ? 'success' : 'info');
  };

  const handleRemoveDepartment = (deptName) => {
    const updated = removeCustomDepartment(deptName);
    setDepartmentOptions(mergeDepartmentOptions(employees, updated));

    setFormData((prev) =>
      String(prev.department || '').trim().toLowerCase() === String(deptName || '').trim().toLowerCase()
        ? { ...prev, department: '' }
        : prev
    );
    setEditingEmployee((prev) =>
      prev && String(prev.department || '').trim().toLowerCase() === String(deptName || '').trim().toLowerCase()
        ? { ...prev, department: '' }
        : prev
    );

    showToast('Department removed from dropdown', 'success');
  };

  const openEditEmployeeModal = (emp) => {
    setEditingEmployee({
      id: emp.id,
      employeeId: emp.employee_id || '',
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      city: emp.city || '',
      department: emp.department || '',
      role: emp.role,
      username: emp.username,
      password: '',
      status: emp.status || 'active',
    });
  };

  const handleReportEditSubmit = async (e) => {
    e.preventDefault();
    if (true) {
      const phoneErr = validateStoredPhone(editingEmployee.phone, { required: true });
      if (phoneErr) {
        showToast(phoneErr, 'error');
        return;
      }
      const parsed = parseStoredPhone(editingEmployee.phone);
      const nat = digitsOnly(parsed.national, 15);
      if (nat && nat.length !== 10) {
        showToast('Phone number must be exactly 10 digits', 'error');
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetchApi('users.php', {
        method: 'PUT',
        body: JSON.stringify({
          ...editingEmployee,
          phone: normalizePhoneForSubmit(editingEmployee.phone),
        }),
        headers: { 'X-HTTP-Method-Override': 'PUT' },
      });
      if (res.status === 'success') {
        showToast('Employee updated successfully!');
        setEditingEmployee(null);
        loadEmployees();
      } else {
        showToast(res.message || 'Update failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Could not reach the server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = selectedIds.length > 0 ? filteredEmployees.filter(emp => selectedIds.includes(emp.id)) : filteredEmployees;
    if (dataToExport.length === 0) {
      alert("No data available to export");
      return;
    }
    const headers = ["S.No", "Employee ID", "Full Name", "Email", "Phone", "Department", "Role", "Registered On", "Status"];
    const rows = dataToExport.map((emp, i) => [
      i + 1,
      emp.employee_id || '-',
      `"${(emp.name || '').replace(/"/g, '""')}"`,
      emp.email || '-',
      emp.phone ? `="${emp.phone}"` : '-',
      `"${(emp.department || '').replace(/"/g, '""')}"`,
      emp.role,
      emp.created_at || '-',
      emp.status || 'active'
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
    setIsExportDropdownOpen(false);
  };

  const handleExportPDF = () => {
    const dataToExport = selectedIds.length > 0 ? filteredEmployees.filter(emp => selectedIds.includes(emp.id)) : filteredEmployees;
    if (dataToExport.length === 0) {
      alert("No data available to export");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text('Employee Report', 14, 18);
      doc.setFontSize(10);
      doc.text(
        `Generated on: ${formatDateTime(new Date().toISOString().split('T')[0])}`,
        14,
        24
      );

      const headers = ["S.No", "Employee ID", "Full Name", "Email", "Phone", "Department", "Role", "Registered On", "Status"];
      const rows = dataToExport.map((emp, i) => [
        i + 1,
        emp.employee_id || '-',
        String(emp.name || ''),
        emp.email || '-',
        emp.phone || '-',
        String(emp.department || ''),
        emp.role,
        emp.created_at || '-',
        emp.status || 'active'
      ]);

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [153, 0, 51] }, // CRM primary crimson
        styles: { fontSize: 8, font: 'helvetica' },
      });

      doc.save(`employee_report_${new Date().toISOString().slice(0, 10)}.pdf`);
      setIsExportDropdownOpen(false);
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast(err?.message || 'PDF export failed', 'error');
    }
  };

  const filteredEmployees = employees.filter(
    (emp) => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      if (searchField === 'name') return emp.name?.toLowerCase().includes(term);
      if (searchField === 'employee_id') return emp.employee_id?.toLowerCase().includes(term);
      if (searchField === 'department') return emp.department?.toLowerCase().includes(term);
      if (searchField === 'email') return emp.email?.toLowerCase().includes(term);
      if (searchField === 'phone') return emp.phone?.toLowerCase().includes(term);
      return (
        emp.name?.toLowerCase().includes(term) ||
        emp.employee_id?.toLowerCase().includes(term) ||
        emp.department?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.phone?.toLowerCase().includes(term)
      );
    }
  );

  return (
    <div className="">
      {view === 'register' ? (
        <div className="relative bg-white h-[calc(100vh-64px)] w-full p-4 lg:px-8 lg:py-6 overflow-hidden flex flex-col flex-1">
          {/* Decorative Circles */}
          <div className="absolute top-10 right-[35%] w-24 h-24 bg-amber-100/60 rounded-full blur-xl pointer-events-none" />
          <div className="absolute top-20 right-[5%] w-32 h-32 bg-cyan-100/60 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-20 left-[15%] w-20 h-20 bg-amber-100/60 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-32 left-[40%] w-40 h-40 bg-cyan-100/40 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-cyan-100/50 rounded-full blur-2xl pointer-events-none" />
          
          {/* Header Row */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-[26px] font-bold text-[#1e293b]">Create New Employee</h2>
              <p className="text-[15px] text-slate-500 mt-0.5">Add and manage staff accounts</p>
            </div>
            <button
              type="button"
              onClick={() => setView('report')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#00b5e2] text-white text-sm font-semibold hover:bg-[#00a0c9] transition-colors shadow-sm"
            >
              <i className="ph-fill ph-pencil-simple text-lg" /> View & Edit
            </button>
          </div>

          {/* Form */}
          <div className="relative z-10 flex-1 flex flex-col">
            {loadError && (
              <div className="mb-4 flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-3 rounded-lg text-sm border border-amber-200 max-w-4xl">
                <i className="ph-fill ph-warning-circle shrink-0" />
                <span>{loadError}</span>
              </div>
            )}
            {submitError && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 max-w-4xl">
                <i className="ph-fill ph-warning-circle shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="w-full flex flex-col flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 w-full xl:w-[85%] 2xl:w-[75%]">
                
                {/* Row 1 */}
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">
                    Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="employeeId" required value={formData.employeeId} onChange={handleChange} placeholder="e.g. EMP02" className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="John Doe" className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">
                    Email Address
                  </label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@domain.com" className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px]" />
                </div>
                
                {/* Row 2 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-[#1e293b]">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <button type="button" onClick={() => setShowDeptModal(true)} className="text-[13px] text-[#00b5e2] font-semibold flex items-center gap-1 hover:underline">
                      <i className="ph-bold ph-plus" /> Add
                    </button>
                  </div>
                  <select name="department" required value={formData.department} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700">
                    <option value="">Select department</option>
                    {departmentOptions.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <PhoneInput name="phone" value={formData.phone} onChange={(phone) => setFormData(prev => ({ ...prev, phone }))} required inputClassName="flex-1 px-4 py-2.5 rounded-r-md border border-gray-200 border-l-0 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 text-[14px]" selectClassName="w-[4.5rem] shrink-0 px-2 py-2.5 rounded-l-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 bg-white text-[14px] text-gray-700" maxLength={10} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select name="role" required value={formData.role} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700">
                    <option value="employee">Employee / Staff</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                {/* Row 3 */}
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="username" required value={formData.username} onChange={handleChange} placeholder="username123" autoComplete="new-username" className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px]" />
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">
                    Password {isEditing ? '(blank to keep)' : <span className="text-red-500">*</span>}
                  </label>
                  <input type={showPassword ? "text" : "password"} name="password" required={!isEditing} value={formData.password} onChange={handleChange} placeholder="••••••••" autoComplete="new-password" className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px]" />
                  <i className={`ph ${showPassword ? 'ph-eye-slash' : 'ph-eye'} absolute right-3 top-[38px] text-gray-400 cursor-pointer text-lg hover:text-[#00b5e2] transition-colors`} onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide password' : 'Show password'} />
                </div>
                
                {/* Preserved City Field - Invisible on screenshot but functionality required */}
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b] mb-2">City</label>
                  <CityAutocomplete name="city" value={formData.city} onChange={(city) => setFormData((prev) => ({ ...prev, city }))} placeholder="Type to search city…" className="w-full" inputClassName="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px]" />
                </div>
                
                {isEditing && (
                  <div>
                    <label className="block text-sm font-semibold text-[#1e293b] mb-2">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8 mb-4 w-full md:w-[66%] lg:w-[40%] justify-center md:justify-start lg:pl-10">
                <button type="submit" disabled={loading} className="px-10 py-2.5 rounded-md bg-[#00b5e2] hover:bg-[#00a0c9] text-white text-[15px] font-medium shadow-md transition-all disabled:opacity-60 flex-1 max-w-[160px] text-center">
                  {loading ? 'Saving...' : 'Register'}
                </button>
                <button type="button" onClick={resetForm} className="px-10 py-2.5 rounded-md border border-[#00b5e2] text-[#00b5e2] hover:bg-[#00b5e2]/5 text-[15px] font-medium transition-all bg-white flex-1 max-w-[160px] text-center">
                  Cancel
                </button>
              </div>
            </form>
          </div>
          
          {/* Illustration image on the bottom right */}
          <div className="fixed w-[20%] bottom-0 right-0 z-0 pointer-events-none hidden lg:block">
            <img src={empImage} alt="Illustration" className="w-[450px] object-contain" />
          </div>
        </div>
      ) : (
        <div className="p-2 lg:px-4 lg:py-2 bg-[#f8fafc] h-[calc(100vh-64px)] flex flex-col gap-2">
          <div className="flex justify-between items-center shrink-0 mt-1 mb-1 px-2">
            <button
              type="button"
              onClick={() => setView('register')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
            >
              <i className="ph-bold ph-arrow-left" />
              Back to Registration
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-end gap-4 shrink-0 mb-3">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#1e293b] flex items-center gap-3">
                  <div className="bg-[#00b5e2]/10 text-[#00b5e2] rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                    <i className="ph-fill ph-users-three text-xl" />
                  </div>
                  Employee Report
                </h3>
                <p className="text-sm text-gray-500 mt-1 ml-[52px]">View all registered staff accounts</p>
              </div>
              <div className="flex flex-1 max-w-lg gap-2">
                <select
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="px-3 py-2 rounded-lg outline-none border border-gray-200 focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 w-36 shrink-0 text-sm"
                >
                  <option value="all">All Fields</option>
                  <option value="name">Name</option>
                  <option value="employee_id">Employee ID</option>
                  <option value="department">Department</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
                <div className="relative flex-1">
                  <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg outline-none border border-gray-200 focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20"
                  />
                </div>
                {['admin', 'super_admin', 'superadmin'].includes(currentUser?.role?.toLowerCase()) && (
                  <div className="relative shrink-0" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                      className="h-full bg-[#00b5e2] hover:bg-[#00a0c9] text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95"
                    >
                      <i className="ph-bold ph-download-simple"></i> Export
                      <i className={`ph-bold ph-caret-down transition-transform duration-300 ${isExportDropdownOpen ? 'rotate-180' : ''}`}></i>
                    </button>

                    {isExportDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-30 overflow-hidden divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          type="button"
                          onClick={handleExportCSV}
                          className="w-full px-5 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-emerald-50/30 flex items-center gap-3 transition-colors group"
                        >
                          <i className="ph-fill ph-file-xls text-emerald-600 text-xl group-hover:scale-110 transition-transform"></i>
                          Export to Excel (.csv)
                        </button>
                        <button
                          type="button"
                          onClick={handleExportPDF}
                          className="w-full px-5 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-red-50/30 flex items-center gap-3 transition-colors group"
                        >
                          <i className="ph-fill ph-file-pdf text-red-600 text-xl group-hover:scale-110 transition-transform"></i>
                          Export to PDF (.pdf)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
            {listLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner label="Loading employees..." />
              </div>
            ) : (
              <div className="report-table-wrap flex-1 flex flex-col min-h-0">
                <div className="report-table-scroll flex-1 overflow-auto custom-scrollbar relative">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-[#00b5e2] text-white">
                        {['admin', 'super_admin', 'superadmin'].includes(currentUser?.role?.toLowerCase()) && (
                          <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 w-10 text-center">
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
                              title="Select All"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20 w-14 text-center">S.No</th>
                        <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20">Employee ID</th>
                        <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20">Name</th>
                        <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20">Email / Phone</th>
                        <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20">Department</th>
                        <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20">Role</th>
                        <th className="px-4 py-3.5 font-semibold text-[13px] border-r border-white/20">Status</th>
                        <th className="px-4 py-3.5 font-semibold text-[13px] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredEmployees.map((emp, i) => (
                        <tr key={emp.id} className="border-b border-gray-200 hover:bg-crm-primaryLighter/40 transition-colors duration-150">
                          {['admin', 'super_admin', 'superadmin'].includes(currentUser?.role?.toLowerCase()) && (
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
                          <td className="px-4 py-3 text-sm text-gray-500 border-r border-gray-300 text-center">{i + 1}</td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-600 border-r border-gray-300">{emp.employee_id || '-'}</td>
                          <td className="px-4 py-3 font-medium text-sm border-r border-gray-300">{emp.name}</td>
                          <td className="px-4 py-3 text-sm border-r border-gray-300">
                            {emp.email}
                            <br />
                            <span className="text-gray-500 text-xs">{emp.phone || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm border-r border-gray-100">{emp.department || '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-[#00b5e2] border-r border-gray-100">{roleLabel(emp.role)}</td>
                          <td className="px-4 py-3 text-sm border-r border-gray-100">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                                }`}
                            >
                              {emp.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">

                            <button
                              type="button"
                              onClick={() => openEditEmployeeModal(emp)}
                              className="text-crm-primary hover:text-crm-primaryDark p-1.5 rounded-lg hover:bg-crm-primaryLighter ml-1"
                              title="Edit"
                            >
                              <i className="ph-bold ph-pencil-simple text-lg" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(emp.id, emp.name)}
                              className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 ml-1"
                              title="Delete"
                            >
                              <i className="ph-bold ph-trash text-lg" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-gray-400 border-t border-gray-300">
                            No employees found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeptModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ marginTop: 0 }}
          onClick={() => setShowDeptModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#00b5e2] flex items-center gap-2">
                <i className="ph-fill ph-buildings" /> Manage Departments
              </h3>
              <button type="button" onClick={() => setShowDeptModal(false)} className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <i className="ph-bold ph-x text-lg" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm font-semibold text-[#1e293b]">Department name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDepartment())}
                  placeholder="e.g. Logistics"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 text-[14px]"
                />
                <button
                  type="button"
                  onClick={handleAddDepartment}
                  className="shrink-0 h-[42px] w-[42px] rounded-lg bg-[#00b5e2] text-white flex items-center justify-center hover:bg-[#00a0c9] shadow-sm transition-colors"
                  title="Add department"
                >
                  <i className="ph-bold ph-plus text-xl" />
                </button>
              </div>
              {departmentOptions.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">Available departments</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {departmentOptions.map((d) => (
                      <span key={d} className="text-[13px] px-3 py-1.5 rounded-full bg-[#00b5e2]/10 text-[#00b5e2] font-medium border border-[#00b5e2]/20">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {loadCustomDepartments().length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">Custom departments (click to remove)</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {loadCustomDepartments().map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleRemoveDepartment(d)}
                        className="text-[13px] px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 font-medium inline-flex items-center gap-1.5 transition-colors group"
                        title="Remove from dropdown"
                      >
                        <i className="ph-bold ph-x text-red-400 group-hover:text-red-600" />
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end border-t border-gray-100">
              <button type="button" onClick={() => setShowDeptModal(false)} className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingEmployee && (
        <ReportModalShell
          title="Employee Details"
          icon="ph-user-circle"
          onClose={() => setViewingEmployee(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-white text-sm font-medium text-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  openEditEmployeeModal(viewingEmployee);
                  setViewingEmployee(null);
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
                <label className="block text-sm font-normal text-crm-primary">Employee ID</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.employee_id || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Status</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.status || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed capitalize"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">
                  Full Name
                </label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.name || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Email</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.email || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Phone</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.phone || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">City</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.city || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Department</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.department || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Role</label>
                <input
                  type="text"
                  disabled
                  value={roleLabel(viewingEmployee.role)}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Username</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.username || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Registered On</label>
                <input
                  type="text"
                  disabled
                  value={viewingEmployee.created_at || ''}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </ReportModalShell>
      )}

      {editingEmployee && (
        <ReportModalShell
          title="Edit Employee"
          icon="ph-pencil-simple"
          variant="edit"
          maxWidth="max-w-3xl"
          onClose={() => setEditingEmployee(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="employee-report-edit-form"
                disabled={loading}
                className="px-5 py-2.5 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-medium disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          }
        >
          <form id="employee-report-edit-form" onSubmit={handleReportEditSubmit}>
            <div className="report-modal-grid">
              <EditField label="Employee ID">
                <input
                  type="text"
                  value={editingEmployee.employeeId}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, employeeId: e.target.value })}
                  className={reportInputClass}
                />
              </EditField>
              <EditField label="Full Name" required>
                <input
                  type="text"
                  required
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className={reportInputClass}
                />
              </EditField>
              <EditField label="Email" required colSpan={2}>
                <input
                  type="email"
                  required
                  value={editingEmployee.email}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  className={reportInputClass}
                />
              </EditField>
              <EditField label="Phone" colSpan={2}>
                <PhoneInput
                  value={editingEmployee.phone}
                  onChange={(phone) => setEditingEmployee((prev) => ({ ...prev, phone }))}
                  inputClassName={`flex-1 ${reportInputClass}`}
                  selectClassName={`w-[7.5rem] shrink-0 ${reportInputClass} text-sm`}
                />
              </EditField>
              <EditField label="City">
                <CityAutocomplete
                  value={editingEmployee.city}
                  onChange={(city) => setEditingEmployee((prev) => ({ ...prev, city }))}
                  placeholder="Type to search city…"
                  inputClassName={reportInputClass}
                />
              </EditField>
              <EditField label="Department">
                <select
                  value={editingEmployee.department}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                  className={reportInputClass}
                >
                  <option value="">Select department</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </EditField>
              <EditField label="Role">
                <select
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  className={reportInputClass}
                >
                  <option value="employee">Employee / Staff</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </EditField>
              <EditField label="Username" required>
                <input
                  type="text"
                  required
                  value={editingEmployee.username}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, username: e.target.value })}
                  className={reportInputClass}
                />
              </EditField>
              <EditField label="Status">
                <select
                  value={editingEmployee.status}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value })}
                  className={reportInputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </EditField>
              <EditField label="Password (leave blank to keep)" colSpan={2}>
                <input
                  type="password"
                  value={editingEmployee.password}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, password: e.target.value })}
                  className={reportInputClass}
                  placeholder="••••••••"
                />
              </EditField>
            </div>
          </form>
        </ReportModalShell>
      )}
    </div>
  );
};

export default EmployeeRegistration;
