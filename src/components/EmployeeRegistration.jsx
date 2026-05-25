import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import LoadingSpinner from './common/LoadingSpinner';
import { showToast } from '../utils/toast';
import { confirmDelete } from '../utils/confirm';
import {
  loadCustomDepartments,
  saveCustomDepartment,
  mergeDepartmentOptions,
} from '../utils/departments';
import ReportModalShell, { DetailField, EditField, reportInputClass } from './common/ReportModalShell';

const EmployeeRegistration = () => {
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
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setLoading(true);
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetchApi('users.php', {
        method,
        body: JSON.stringify(formData),
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
    setLoading(true);
    try {
      const res = await fetchApi('users.php', {
        method: 'PUT',
        body: JSON.stringify(editingEmployee),
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

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.employee_id && emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
            <i className="ph-fill ph-user-plus text-crm-primary" />
            {isEditing ? 'Edit Employee Details' : 'Register New Employee'}
          </h3>
          <button
            type="button"
            onClick={() => setShowDeptModal(true)}
            className="self-end sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-crm-primary/30 text-crm-primary text-sm font-medium hover:bg-crm-primaryLighter transition-colors"
            title="Add custom departments"
          >
            <i className="ph-bold ph-buildings" />
            Departments
          </button>
        </div>
        {loadError && (
          <div className="mb-4 flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-3 rounded-lg text-sm border border-amber-200">
            <i className="ph-fill ph-warning-circle shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
        {submitError && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
            <i className="ph-fill ph-warning-circle shrink-0" />
            <span>{submitError}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-normal text-crm-primary">Employee ID</label>
            <input type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} placeholder="e.g. EMP02" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">
              Full Name <span className="text-red-600">*</span>
            </label>
            <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="John Doe" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">
              Email Address <span className="text-red-600">*</span>
            </label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="email@domain.com" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Phone Number</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+12345678" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">City</label>
            <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Mumbai" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Department</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1"
            >
              <option value="">Select department</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Role</label>
            <select name="role" value={formData.role} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1">
              <option value="employee">Employee / Staff</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">
              Username <span className="text-red-600">*</span>
            </label>
            <input type="text" name="username" required value={formData.username} onChange={handleChange} placeholder="username123" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">
              Password {isEditing ? '(leave blank to keep current)' : <span className="text-red-600">*</span>}
            </label>
            <input type="password" name="password" required={!isEditing} value={formData.password} onChange={handleChange} placeholder="••••••••" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          {isEditing && (
            <div>
              <label className="block text-sm font-normal text-crm-primary">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}

          <div className="lg:col-span-3 flex justify-end gap-3 mt-2">
            <button type="button" onClick={resetForm} className="px-6 py-2 text-crm-primary font-normal hover:bg-crm-primaryLighter rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-running-border text-white px-8 py-2 rounded-lg font-normal shadow-md disabled:opacity-60">
              {loading ? 'Saving...' : isEditing ? 'Update Employee' : 'Register Employee'}
            </button>
          </div>
        </form>
      </div>

      {/* Employee report (moved from Master Data sidebar) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
              <i className="ph-fill ph-users-three" /> Employee Report
            </h3>
            <p className="text-sm text-gray-500 mt-1">View all registered staff accounts</p>
          </div>
          <div className="relative flex-1 max-w-md">
            <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg outline-none crm-input"
            />
          </div>
        </div>

        {listLoading ? (
          <LoadingSpinner label="Loading employees..." />
        ) : (
          <div className="report-table-wrap mx-6 mb-6">
            <div className="report-table-scroll">
              <table className="w-full text-left border-collapse text-crm-textDark min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide border-r border-gray-200 w-14">S.No</th>
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide border-r border-gray-200">Employee ID</th>
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide border-r border-gray-200">Name</th>
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide border-r border-gray-200">Email / Phone</th>
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide border-r border-gray-200">Department</th>
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide border-r border-gray-200">Role</th>
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide border-r border-gray-200">Status</th>
                    <th className="px-4 py-3 text-crm-primary font-semibold text-xs uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, index) => (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter/50 transition-colors">
                      <td className="px-4 py-3.5 text-sm border-r border-gray-100 text-center text-gray-600">{index + 1}</td>
                      <td className="px-4 py-3.5 font-medium text-sm border-r border-gray-100">{emp.employee_id || '-'}</td>
                      <td className="px-4 py-3.5 font-medium text-sm border-r border-gray-100">{emp.name}</td>
                      <td className="px-4 py-3.5 text-sm border-r border-gray-100">
                        {emp.email}
                        <br />
                        <span className="text-gray-500 text-xs">{emp.phone || '-'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm border-r border-gray-100">{emp.department || '-'}</td>
                      <td className="px-4 py-3.5 text-sm font-medium text-crm-primary border-r border-gray-100">{roleLabel(emp.role)}</td>
                      <td className="px-4 py-3.5 text-sm border-r border-gray-100">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingEmployee(emp)}
                          className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50"
                          title="View"
                        >
                          <i className="ph-bold ph-eye text-lg" />
                        </button>
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
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
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

      {showDeptModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeptModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-buildings" /> Add Department
              </h3>
              <button type="button" onClick={() => setShowDeptModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="ph-bold ph-x text-lg" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm text-crm-primary">Department name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDepartment())}
                  placeholder="e.g. Logistics"
                  className="flex-1 px-4 py-2.5 rounded-lg crm-input"
                />
                <button
                  type="button"
                  onClick={handleAddDepartment}
                  className="shrink-0 h-11 w-11 rounded-lg bg-crm-primary text-white flex items-center justify-center hover:bg-crm-primaryDark shadow-md"
                  title="Add department"
                >
                  <i className="ph-bold ph-plus text-xl" />
                </button>
              </div>
              {departmentOptions.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Available departments</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {departmentOptions.map((d) => (
                      <span key={d} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button type="button" onClick={() => setShowDeptModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm">
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
          <div className="report-modal-grid">
            <DetailField label="Employee ID" value={viewingEmployee.employee_id || '-'} />
            <DetailField label="Full Name" value={viewingEmployee.name} />
            <DetailField label="Email" value={viewingEmployee.email} colSpan={2} />
            <DetailField label="Phone" value={viewingEmployee.phone || '-'} />
            <DetailField label="City" value={viewingEmployee.city || '-'} />
            <DetailField label="Department" value={viewingEmployee.department || '-'} />
            <DetailField label="Role" value={roleLabel(viewingEmployee.role)} />
            <DetailField label="Username" value={viewingEmployee.username} />
            <DetailField label="Status" value={viewingEmployee.status} />
            <DetailField label="Registered On" value={viewingEmployee.created_at || '-'} colSpan={2} />
          </div>
        </ReportModalShell>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingEmployee(null)}>
          <form
            onSubmit={handleReportEditSubmit}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b bg-crm-primary/5 border-crm-primary/15">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-pencil-simple" /> Edit Employee
              </h3>
              <button type="button" onClick={() => setEditingEmployee(null)} className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <i className="ph-bold ph-x text-lg" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
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
            <EditField label="Phone">
              <input
                type="tel"
                value={editingEmployee.phone}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                className={reportInputClass}
              />
            </EditField>
            <EditField label="City">
              <input
                type="text"
                value={editingEmployee.city}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, city: e.target.value })}
                className={reportInputClass}
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
            </div>
            <div className="shrink-0 px-6 py-4 bg-gray-50/90 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-white text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-medium disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EmployeeRegistration;
