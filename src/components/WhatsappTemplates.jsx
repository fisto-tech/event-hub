import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const WhatsappTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [expos, setExpos] = useState([]);
  const [formData, setFormData] = useState({ id: '', expoName: '', industryType: '', templateTitle: '', messageContent: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const tempRes = await fetchApi('whatsapp_templates.php');
      if (tempRes.status === 'success') setTemplates(tempRes.data);
      
      const expoRes = await fetchApi('expos.php');
      if (expoRes.status === 'success') setExpos(expoRes.data);
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
      const res = await fetchApi('whatsapp_templates.php', {
        method,
        body: JSON.stringify(formData)
      });
      if (res.status === 'success') {
        alert(`Template ${isEditing ? 'Updated' : 'Added'} Successfully!`);
        setFormData({ id: '', expoName: '', industryType: '', templateTitle: '', messageContent: '' });
        setIsEditing(false);
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (template) => {
    setFormData({
      id: template.id,
      expoName: template.expo_name || '',
      industryType: template.industry_type || '',
      templateTitle: template.template_title,
      messageContent: template.message_content
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        const res = await fetchApi(`whatsapp_templates.php?id=${id}`, { method: 'DELETE' });
        if (res.status === 'success') {
          alert('Template Deleted');
          loadData();
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
          <i className="ph-fill ph-whatsapp-logo text-crm-primary mr-2"></i> {isEditing ? 'Edit Template' : 'Add New Template'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-normal text-crm-primary">Linked Expo</label>
            <select name="expoName" value={formData.expoName} onChange={handleChange} className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1">
              <option value="">-- Global Template --</option>
              {expos.map(expo => (
                <option key={expo.id} value={expo.expo_name}>{expo.expo_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Industry Type</label>
            <input type="text" name="industryType" value={formData.industryType} onChange={handleChange} placeholder="e.g., Manufacturing" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-normal text-crm-primary">Template Title *</label>
            <input type="text" name="templateTitle" required value={formData.templateTitle} onChange={handleChange} placeholder="e.g., Welcome Message" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1" />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-sm font-normal text-crm-primary">Message Content *</label>
            <p className="text-xs text-gray-500 mb-1">Use {'{customer_name}'}, {'{company_name}'} as placeholders</p>
            <textarea name="messageContent" required value={formData.messageContent} onChange={handleChange} rows="4" className="w-full px-4 py-2 rounded-lg outline-none crm-input mt-1"></textarea>
          </div>
          <div className="lg:col-span-3 flex justify-end gap-3 mt-2">
            {isEditing && (
              <button 
                type="button" 
                onClick={() => {setIsEditing(false); setFormData({ id: '', expoName: '', industryType: '', templateTitle: '', messageContent: '' });}} 
                className="px-6 py-2 text-crm-primary font-normal hover:bg-crm-primaryLighter rounded-lg"
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn-running-border text-white px-8 py-2 rounded-lg font-normal shadow-md">
              {isEditing ? 'Update Template' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-crm-textDark min-w-[600px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-crm-primary font-normal">Title</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Expo / Industry</th>
              <th className="px-4 py-3 text-crm-primary font-normal">Preview</th>
              <th className="px-4 py-3 text-crm-primary font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(temp => (
              <tr key={temp.id} className="border-b border-gray-100 hover:bg-crm-primaryLighter transition-colors">
                <td className="px-4 py-3 font-normal text-crm-primary">{temp.template_title}</td>
                <td className="px-4 py-3 text-sm">
                  {temp.expo_name || 'All Expos'}
                  <br/>
                  <span className="text-gray-500 text-xs font-normal">{temp.industry_type || 'All Industries'}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={temp.message_content}>
                  {temp.message_content}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(temp)} className="text-crm-primary hover:text-crm-primaryDark mr-3"><i className="ph-bold ph-pencil-simple text-lg"></i></button>
                  <button onClick={() => handleDelete(temp.id)} className="text-red-600 hover:text-red-800"><i className="ph-bold ph-trash text-lg"></i></button>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">No templates found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WhatsappTemplates;
