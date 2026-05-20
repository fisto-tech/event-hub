import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const EmployeeRegistration = () => {
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    id: '',
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    role: 'employee',
    username: '',
    password: '',
    status: 'active'
  });
  const [isEditing, setIsEditing] = useState(false);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetchApi('users.php', {
        method,
        body: JSON.stringify(formData)
      });
      if (res.status === 'success') {
        alert(`Employee ${isEditing ? 'Updated' : 'Registered'} Successfully!`);
        resetForm();
        loadEmployees();
      } else {
        alert(res.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      employeeId: '',
      name: '',
      email: '',
      phone: '',
      department: '',
      role: 'employee',
      username: '',
      password: '',
      status: 'active'
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
      department: emp.department || '',
      role: emp.role,
      username: emp.username,
      password: '', // blank password unless modifying
      status: emp.status
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      try {
        const res = await fetchApi(`users.php?id=${id}`, { method: 'DELETE' });
        if (res.status === 'success') {
          alert('Employee Deleted');
          loadEmployees();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-crm-primary mb-4">
          <i className="ph-fill ph-user-plus text-crm-primary mr-2"></i> {isEditing ? 'Edit Employee Details' : 'Register New Employee'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-normal text-crm-primary">Employee ID</label>
            <input type="text" name="employeeId" value={formData.employeeId} onChange={handleChange} placeholder="e.g. EMP02" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Full Name *</label>
            <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="John Doe" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Email Address *</label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="email@domain.com" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Phone Number</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+12345678" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Department</label>
            <input type="text" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Sales, Marketing" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Role</label>
            <select name="role" value={formData.role} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1">
              <option value="employee">Employee / Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Username *</label>
            <input type="text" name="username" required value={formData.username} onChange={handleChange} placeholder="username123" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Password {isEditing ? '(leave blank to keep current)' : '*'}</label>
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
            <button type="button" onClick={resetForm} className="px-6 py-2 text-crm-primary font-normal hover:bg-crm-primaryLighter rounded-lg">Cancel</button>
            <button type="submit" className="btn-running-border text-white px-8 py-2 rounded-lg font-normal shadow-md">
              {isEditing ? 'Update Employee' : 'Register Employee'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-crm-textDark min-w-[800px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-crm-primary font-normal">Employee ID</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Name</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Email / Phone</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Department</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Role</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Status</th>
              <th className="px-4 py-3 text-crm-primary font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter transition-colors">
                <td className="px-4 py-3 font-normal text-sm">{emp.employee_id || '-'}</td>
                <td className="px-4 py-3 font-normal text-sm">{emp.name}</td>
                <td className="px-4 py-3 text-sm">
                  {emp.email}
                  <br/>
                  <span className="text-gray-500 font-normal text-xs">{emp.phone || '-'}</span>
                </td>
                <td className="px-4 py-3 text-sm">{emp.department || '-'}</td>
                <td className="px-4 py-3 capitalize text-sm font-normal text-crm-primary">{emp.role}</td>
                <td className="px-4 py-3 capitalize text-sm">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-normal ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                    {emp.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(emp)} className="text-crm-primary hover:text-crm-primaryDark mr-3"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                  <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800"><i className="ph-bold ph-trash text-lg"></i></button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">No employees registered.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeRegistration;
