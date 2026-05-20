import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const ExpoDetails = () => {
  const [expos, setExpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);
  const [formData, setFormData] = useState({ id: '', expoName: '', startDate: '', endDate: '', remarks: '', status: 'upcoming' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadExpos();
  }, []);

  const loadExpos = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('expos.php');
      if (res.status === 'success') setExpos(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Show spinner only if loading lasts more than 500ms to avoid flicker
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setShowSpinner(true), 500);
    } else {
      setShowSpinner(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetchApi('expos.php', {
        method,
        body: JSON.stringify(formData)
      });
      if (res.status === 'success') {
        alert(`Expo ${isEditing ? 'Updated' : 'Added'} Successfully!`);
        setFormData({ id: '', expoName: '', startDate: '', endDate: '', remarks: '', status: 'upcoming' });
        setIsEditing(false);
        loadExpos();
      } else {
        alert(res.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (expo) => {
    setFormData({
      id: expo.id,
      expoName: expo.expo_name,
      startDate: expo.start_date,
      endDate: expo.end_date || '',
      remarks: expo.remarks || '',
      status: expo.status
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this Expo?')) {
      try {
        const res = await fetchApi(`expos.php?id=${id}`, { method: 'DELETE' });
        if (res.status === 'success') {
          alert('Expo Deleted');
          loadExpos();
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
          <i className="ph-fill ph-calendar-plus text-crm-primary mr-2"></i> {isEditing ? 'Edit Expo' : 'Add New Expo'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-normal text-crm-primary">Expo Name *</label>
            <input type="text" name="expoName" required value={formData.expoName} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Start Date *</label>
            <input type="date" name="startDate" required value={formData.startDate} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">End Date</label>
            <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Status</label>
            <select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1">
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-normal text-crm-primary">Remarks</label>
            <input type="text" name="remarks" value={formData.remarks} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div className="lg:col-span-3 flex justify-end gap-3 mt-2">
            {isEditing && (
              <button 
                type="button" 
                onClick={() => {setIsEditing(false); setFormData({ id: '', expoName: '', startDate: '', endDate: '', remarks: '', status: 'upcoming' });}} 
                className="px-6 py-2 text-crm-primary font-normal hover:bg-crm-primaryLighter rounded-lg"
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn-running-border text-white px-8 py-2 rounded-lg font-normal shadow-md">
              {isEditing ? 'Update Expo' : 'Save Expo'}
            </button>
          </div>
        </form>
      </div>

        {showSpinner ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-12 h-12 border-4 border-crm-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-crm-textDark min-w-[600px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-4 py-3 text-crm-primary font-normal">Expo Name</th>
                  <th className="px-4 py-3 text-crm-primary font-normal">Start Date</th>
                  <th className="px-4 py-3 text-crm-primary font-normal">End Date</th>
                  <th className="px-4 py-3 text-crm-primary font-normal">Status</th>
                  <th className="px-4 py-3 text-crm-primary font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expos.map(expo => (
                  <tr key={expo.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter transition-colors">
                    <td className="px-4 py-3 font-normal">{expo.expo_name}</td>
                    <td className="px-4 py-3 text-sm">{expo.start_date}</td>
                    <td className="px-4 py-3 text-sm">{expo.end_date || '-'}</td>
                    <td className="px-4 py-3 capitalize text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-normal ${
                        expo.status === 'upcoming' ? 'bg-amber-100 text-amber-800' : 
                        expo.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
                        'bg-crm-primaryLighter text-crm-primary'
                      }`}>{expo.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(expo)} className="text-crm-primary hover:text-crm-primaryDark mr-3"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                      <button onClick={() => handleDelete(expo.id)} className="text-red-600 hover:text-red-800"><i className="ph-bold ph-trash text-lg"></i></button>
                    </td>
                  </tr>
                ))}
                {expos.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400">No expos found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

    </div>
  );
};

export default ExpoDetails;
