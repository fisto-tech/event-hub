import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const ExpoDetails = () => {
  const [expos, setExpos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);
  const [formData, setFormData] = useState({ 
    id: '', expoName: '', dates: [], remarks: '', status: 'upcoming',
    templateId: '', templateTitle: '', messageContent: ''
  });
  const [currentDateInput, setCurrentDateInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [viewingExpo, setViewingExpo] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('expos.php');
      if (res.status === 'success') setExpos(res.data);

      const tempRes = await fetchApi('whatsapp_templates.php');
      if (tempRes.status === 'success') setTemplates(tempRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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

  const addDate = () => {
    if (currentDateInput && !formData.dates.includes(currentDateInput)) {
      setFormData(prev => ({ ...prev, dates: [...prev.dates, currentDateInput] }));
      setCurrentDateInput('');
    }
  };

  const removeDate = (dateToRemove) => {
    setFormData(prev => ({ ...prev, dates: prev.dates.filter(d => d !== dateToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.dates.length === 0) {
      alert("Please select at least one date.");
      return;
    }
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        startDate: formData.dates.join(', '),
        endDate: ''
      };
      const res = await fetchApi('expos.php', {
        method,
        body: JSON.stringify(payload)
      });
      if (res.status === 'success') {
        if (formData.templateTitle && formData.messageContent) {
           await fetchApi('whatsapp_templates.php', {
             method: formData.templateId ? 'PUT' : 'POST', 
             body: JSON.stringify({
               id: formData.templateId,
               expoName: formData.expoName,
               industryType: '',
               templateTitle: formData.templateTitle,
               messageContent: formData.messageContent
             })
           });
        }
        alert(`Expo ${isEditing ? 'Updated' : 'Added'} Successfully!`);
        resetForm();
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (expo) => {
    const expoTemplate = templates.find(t => t.expo_name === expo.expo_name);
    setFormData({
      id: expo.id,
      expoName: expo.expo_name,
      dates: expo.start_date ? expo.start_date.split(',').map(d => d.trim()).filter(d => d) : [],
      remarks: expo.remarks || '',
      status: expo.status,
      templateId: expoTemplate ? expoTemplate.id : '',
      templateTitle: expoTemplate ? expoTemplate.template_title : '',
      messageContent: expoTemplate ? expoTemplate.message_content : ''
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this Expo?')) {
      try {
        const res = await fetchApi(`expos.php?id=${id}`, { method: 'DELETE' });
        if (res.status === 'success') {
          alert('Expo Deleted');
          loadData();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const resetForm = () => {
    setFormData({ 
      id: '', expoName: '', dates: [], remarks: '', status: 'upcoming',
      templateId: '', templateTitle: '', messageContent: ''
    });
    setCurrentDateInput('');
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* View Modal */}
      {viewingExpo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingExpo(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-calendar-star"></i> Expo Details
              </h3>
              <button onClick={() => setViewingExpo(null)} className="text-gray-400 hover:text-gray-600">
                <i className="ph-bold ph-x text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Expo Name</p>
                <p className="text-gray-800 font-medium">{viewingExpo.expo_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Status</p>
                <p className="capitalize mt-1">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    viewingExpo.status === 'upcoming' ? 'bg-amber-100 text-amber-800' : 
                    viewingExpo.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
                    'bg-crm-primaryLighter text-crm-primary'
                  }`}>{viewingExpo.status}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Dates</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewingExpo.start_date ? viewingExpo.start_date.split(',').map((d, i) => (
                    <span key={i} className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md text-sm text-gray-700">{d.trim()}</span>
                  )) : <span className="text-gray-500">-</span>}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Remarks</p>
                <p className="text-gray-800">{viewingExpo.remarks || '-'}</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setViewingExpo(null)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-crm-primary mb-4">
          <i className="ph-fill ph-calendar-plus text-crm-primary mr-2"></i> {isEditing ? 'Edit Expo' : 'Add New Expo'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-normal text-crm-primary">Expo Name *</label>
            <input type="text" name="expoName" required value={formData.expoName} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-normal text-crm-primary">Select Dates *</label>
            <div className="flex gap-2 mt-1">
              <input 
                type="date" 
                value={currentDateInput} 
                onChange={(e) => setCurrentDateInput(e.target.value)} 
                className="flex-1 px-4 py-2 rounded-lg outline-none crm-input max-w-xs" 
              />
              <button 
                type="button" 
                onClick={addDate}
                className="bg-crm-primaryLighter text-crm-primary px-4 py-2 rounded-lg font-medium hover:bg-crm-primary hover:text-white transition-colors"
              >
                Add
              </button>
            </div>
            {formData.dates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.dates.map((date, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-sm rounded-full text-gray-700 border border-gray-200">
                    {date}
                    <button type="button" onClick={() => removeDate(date)} className="text-gray-400 hover:text-red-500">
                      <i className="ph-bold ph-x text-xs"></i>
                    </button>
                  </span>
                ))}
              </div>
            )}
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

          <div className="lg:col-span-3 border-t border-gray-100 mt-2 pt-4">
            <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <i className="ph-fill ph-whatsapp-logo text-emerald-500"></i> WhatsApp Template Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-normal text-crm-primary">Template Title</label>
                <input type="text" name="templateTitle" value={formData.templateTitle} onChange={handleChange} placeholder="e.g., Expo Welcome" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-normal text-crm-primary">Message Content</label>
                <p className="text-xs text-gray-500 mb-1">Use {'{customer_name}'}, {'{company_name}'} as placeholders</p>
                <textarea name="messageContent" value={formData.messageContent} onChange={handleChange} rows="2" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1"></textarea>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 flex justify-end gap-3 mt-4">
            {isEditing && (
              <button 
                type="button" 
                onClick={resetForm} 
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
                <th className="px-4 py-3 text-crm-primary font-normal">Dates</th>
                <th className="px-4 py-3 text-crm-primary font-normal">Status</th>
                <th className="px-4 py-3 text-crm-primary font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expos.map(expo => (
                <tr key={expo.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter transition-colors">
                  <td className="px-4 py-3 font-normal">{expo.expo_name}</td>
                  <td className="px-4 py-3 text-sm">
                    {expo.start_date ? expo.start_date.split(',').map((d, i) => (
                      <span key={i} className="inline-block bg-white border border-gray-200 px-2 py-0.5 rounded text-xs mr-1 mb-1 shadow-sm">{d.trim()}</span>
                    )) : '-'}
                  </td>
                  <td className="px-4 py-3 capitalize text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-normal ${
                      expo.status === 'upcoming' ? 'bg-amber-100 text-amber-800' : 
                      expo.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
                      'bg-crm-primaryLighter text-crm-primary'
                    }`}>{expo.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setViewingExpo(expo)} className="text-blue-600 hover:text-blue-800 mr-3" title="View"><i className="ph-bold ph-eye text-lg"></i></button>
                    <button onClick={() => handleEdit(expo)} className="text-crm-primary hover:text-crm-primaryDark mr-3" title="Edit"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                    <button onClick={() => handleDelete(expo.id)} className="text-red-600 hover:text-red-800" title="Delete"><i className="ph-bold ph-trash text-lg"></i></button>
                  </td>
                </tr>
              ))}
              {expos.length === 0 && (
                <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">No expos found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExpoDetails;
