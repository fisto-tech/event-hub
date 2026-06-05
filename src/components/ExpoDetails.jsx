import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import ExpoMultiDatePicker, { normalizeDateString } from './common/ExpoMultiDatePicker';
import LoadingSpinner from './common/LoadingSpinner';
import { showToast } from '../utils/toast';
import { confirmDelete } from '../utils/confirm';
import { loadRegistrationBootstrap } from '../utils/registrationDataCache';

const ExpoDetails = ({ embedded = false }) => {
  const [expos, setExpos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    expoName: '',
    dates: [],
    assignedEmployees: [],
    remarks: '',
    status: 'upcoming',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [viewingExpo, setViewingExpo] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expoRes, userRes] = await Promise.all([
        fetchApi('expos.php'),
        fetchApi('users.php')
      ]);
      if (expoRes.status === 'success') setExpos(expoRes.data || []);
      if (userRes.status === 'success') {
        const activeUsers = (userRes.data || []).filter(u => u.status !== 'inactive' && u.role === 'employee');
        setEmployees(activeUsers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setShowSpinner(true), 400);
    } else {
      setShowSpinner(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.dates.length === 0) {
      showToast('Please select at least one date.', 'error');
      return;
    }
    if (formData.assignedEmployees.length === 0) {
      showToast('Please select at least one assigned employee.', 'error');
      return;
    }
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        startDate: formData.dates.join(', '),
        endDate: '',
      };
      const res = await fetchApi('expos.php', {
        method,
        body: JSON.stringify(payload),
      });
      if (res.status === 'success') {
        showToast(`Expo ${isEditing ? 'updated' : 'saved'} successfully!`);
        resetForm();
        loadData();
        loadRegistrationBootstrap(true).catch(console.error); // Force cache update
      } else {
        showToast(res.message || 'Save failed', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Could not save expo.', 'error');
    }
  };

  const handleEdit = (expo) => {
    setFormData({
      id: expo.id,
      expoName: expo.expo_name,
      dates: expo.start_date
        ? expo.start_date.split(',').map((d) => normalizeDateString(d.trim())).filter(Boolean)
        : [],
      assignedEmployees: expo.assigned_employees
        ? String(expo.assigned_employees).split(',').map(s => s.trim()).filter(Boolean)
        : [],
      remarks: expo.remarks || '',
      status: expo.status,
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!confirmDelete(`expo "${name}"`)) return;
    try {
      const res = await fetchApi(`expos.php?id=${id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        showToast('Expo deleted successfully!');
        loadData();
        loadRegistrationBootstrap(true).catch(console.error); // Force cache update
      } else {
        showToast(res.message || 'Delete failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      expoName: '',
      dates: [],
      assignedEmployees: [],
      remarks: '',
      status: 'upcoming',
    });
    setIsEditing(false);
  };

  return (
    <div className="">
      {embedded && (
        <div className="flex items-start gap-3">
          <i className="ph-fill ph-storefront text-3xl text-crm-primary shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-crm-textDark">Expo Details</h2>
            <p className="text-sm text-crm-textMuted">Manage expo names and event dates</p>
          </div>
        </div>
      )}

      {viewingExpo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingExpo(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-calendar-star" /> Expo Details
              </h3>
              <button type="button" onClick={() => setViewingExpo(null)} className="text-gray-400 hover:text-gray-600">
                <i className="ph-bold ph-x text-lg" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-normal text-crm-primary">
                    Expo Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={viewingExpo.expo_name || ''}
                    className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-normal text-crm-primary mb-2">Dates</label>
                  <div className="w-full px-4 py-2 rounded-lg outline-none crm-input bg-gray-50 text-gray-600 cursor-not-allowed min-h-[42px] flex flex-wrap gap-1.5 items-center">
                    {viewingExpo.start_date
                      ? viewingExpo.start_date.split(',').map((d, i) => (
                        <span key={i} className="bg-gray-200 border border-gray-300 px-2 py-0.5 rounded text-sm text-gray-700">
                          {d.trim()}
                        </span>
                      ))
                      : <span className="text-gray-400">No dates selected</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-normal text-crm-primary mb-2">Assigned Employees</label>
                  <div className="w-full px-4 py-2 rounded-lg outline-none crm-input bg-gray-50 text-gray-600 cursor-not-allowed min-h-[42px] flex flex-wrap gap-1.5 items-center">
                    {viewingExpo.assigned_employees
                      ? viewingExpo.assigned_employees.split(',').map((empId, i) => {
                          const emp = employees.find(e => String(e.id) === String(empId));
                          return (
                            <span key={i} className="bg-gray-200 border border-gray-300 px-2 py-0.5 rounded text-sm text-gray-700">
                              {emp ? emp.name : `User #${empId}`}
                            </span>
                          );
                        })
                      : <span className="text-gray-400">All Employees</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-normal text-crm-primary">Remarks</label>
                  <textarea
                    disabled
                    value={viewingExpo.remarks || ''}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 resize-y bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button type="button" onClick={() => setViewingExpo(null)} className="px-4 py-2 border rounded-lg text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-crm-primary mb-4">
          <i className="ph-fill ph-calendar-plus text-crm-primary mr-2" />
          {isEditing ? 'Edit Expo' : 'Add New Expo'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4 order-2 lg:order-1">
              <div>
                <label className="block text-sm font-normal text-crm-primary">
                  Expo Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="expoName"
                  required
                  value={formData.expoName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-normal text-crm-primary mb-2">
                  Assigned Employees <span className="text-red-600">*</span>
                </label>
                <div 
                  onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer flex justify-between items-center transition-colors hover:border-crm-primary"
                >
                  <span className={`text-sm ${formData.assignedEmployees.length === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                    {formData.assignedEmployees.length === 0 
                      ? 'Select Employees...' 
                      : `${formData.assignedEmployees.length} employee(s) selected`}
                  </span>
                  <i className={`ph-bold ph-caret-${showEmployeeDropdown ? 'up' : 'down'} text-gray-500`} />
                </div>

                {showEmployeeDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowEmployeeDropdown(false)} 
                    />
                    <div className="absolute z-20 w-full mt-1 border border-gray-200 rounded-lg shadow-lg bg-white p-2 max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="flex flex-col gap-1">
                        {employees.map(emp => {
                          const isChecked = formData.assignedEmployees.includes(String(emp.id));
                          return (
                            <label key={emp.id} className="flex items-center gap-3 cursor-pointer hover:bg-crm-primaryLighter/50 p-2 rounded transition-colors">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-crm-primary rounded border-gray-300 focus:ring-crm-primary"
                                checked={isChecked}
                                onChange={(e) => {
                                  setFormData(prev => {
                                    const newAssignments = e.target.checked 
                                      ? [...prev.assignedEmployees, String(emp.id)]
                                      : prev.assignedEmployees.filter(id => id !== String(emp.id));
                                    return { ...prev, assignedEmployees: newAssignments };
                                  });
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-800">{emp.name}</span>
                                <span className="text-xs text-gray-500">{emp.department || 'Employee'}</span>
                              </div>
                            </label>
                          );
                        })}
                        {employees.length === 0 && (
                          <span className="text-sm text-gray-500 p-2">No employees found.</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-normal text-crm-primary">Remarks</label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1 resize-y"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 text-crm-primary rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn-running-border text-white px-8 py-2 rounded-lg font-normal shadow-md">
                  {isEditing ? 'Update Expo' : 'Save Expo'}
                </button>
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-4">
              <div>
                <label className="block text-sm font-normal text-crm-primary mb-2">
                  Select Dates <span className="text-red-600">*</span>
                </label>
                <ExpoMultiDatePicker
                  selectedDates={formData.dates}
                  onChange={(dates) => setFormData((prev) => ({ ...prev, dates }))}
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {showSpinner ? (
        <LoadingSpinner label="Loading expos..." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-crm-textDark min-w-[600px] border border-gray-300">
            <thead>
              <tr className="bg-crm-primary border-b border-crm-primary text-white">
                <th className="px-4 py-3 font-normal border-r border-white/20 w-14">S.No</th>
                <th className="px-4 py-3 font-normal border-r border-white/20">Expo Name</th>
                <th className="px-4 py-3 font-normal border-r border-white/20">Dates</th>
                <th className="px-4 py-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expos.map((expo, index) => (
                <tr key={expo.id} className="border-b border-gray-300 hover:bg-crm-primaryLighter transition-colors">
                  <td className="px-4 py-3 text-sm border-r border-gray-300 text-center">{index + 1}</td>
                  <td className="px-4 py-3 font-normal border-r border-gray-300">{expo.expo_name}</td>
                  <td className="px-4 py-3 text-sm border-r border-gray-300">
                    {expo.start_date
                      ? expo.start_date.split(',').map((d, i) => (
                        <span key={i} className="inline-block bg-white border border-gray-300 px-2 py-0.5 rounded text-xs mr-1 mb-1">
                          {d.trim()}
                        </span>
                      ))
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">

                    <button type="button" onClick={() => handleEdit(expo)} className="text-crm-primary hover:text-crm-primaryDark mr-3" title="Edit">
                      <i className="ph-bold ph-pencil-simple text-lg" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(expo.id, expo.expo_name)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <i className="ph-bold ph-trash text-lg" />
                    </button>
                  </td>
                </tr>
              ))}
              {expos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 border-t border-gray-300">
                    No expos found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExpoDetails;
