import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { showToast } from '../utils/toast';
import { confirmDelete } from '../utils/confirm';
import LoadingSpinner from './common/LoadingSpinner';

const WhatsappTemplates = ({ embedded = false }) => {
  const [templates, setTemplates] = useState([]);
  const [expos, setExpos] = useState([]);
  const [lookups, setLookups] = useState({ enquiry_type: [] });
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    id: '',
    expoName: '',
    enquiryType: '',
    templateTitle: '',
    messageContent: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tempRes, expoRes, lookupRes] = await Promise.all([
        fetchApi('whatsapp_templates.php'),
        fetchApi('expos.php'),
        fetchApi('master_data.php?type=enquiry_type'),
      ]);
      if (tempRes.status === 'success') setTemplates(tempRes.data || []);
      if (expoRes.status === 'success') setExpos(expoRes.data || []);
      if (lookupRes.status === 'success') {
        setLookups({ enquiry_type: lookupRes.data || [] });
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      id: '',
      expoName: '',
      enquiryType: '',
      templateTitle: '',
      messageContent: '',
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const payload = { ...formData, industryType: '' };
      const res = await fetchApi('whatsapp_templates.php', {
        method,
        body: JSON.stringify(payload),
      });
      if (res.status === 'success') {
        showToast(`Template ${isEditing ? 'updated' : 'saved'} successfully!`);
        resetForm();
        loadData();
      } else {
        showToast(res.message || 'Save failed', 'error');
      }
    } catch {
      showToast('Save failed.', 'error');
    }
  };

  const handleEdit = (template) => {
    setFormData({
      id: template.id,
      expoName: template.expo_name || '',
      enquiryType: template.enquiry_type || '',
      templateTitle: template.template_title,
      messageContent: template.message_content,
    });
    setIsEditing(true);
  };

  const handleDelete = async (id, title) => {
    if (!confirmDelete(`template "${title}"`)) return;
    try {
      const res = await fetchApi(`whatsapp_templates.php?id=${id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        showToast('Template deleted successfully!');
        loadData();
      } else {
        showToast(res.message || 'Delete failed', 'error');
      }
    } catch {
      showToast('Delete failed.', 'error');
    }
  };

  const pageClass = '';

  const formBlock = (
    <div className="bg-white rounded-xl border border-crm-primary/15 shadow-sm overflow-hidden">
      <div className="bg-crm-primaryLighter/80 px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-crm-primary/10">
        <span className="font-bold text-crm-primary text-base" style={{ fontFamily: "'Open Sans', sans-serif" }}>
          {isEditing ? 'Edit WhatsApp Template' : 'Add WhatsApp Template'}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-crm-primary/80" style={{ fontFamily: "'Open Sans', sans-serif" }}>
          Leave expo blank = general (all expos)
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase  text-gray-600 mb-1.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Expo (blank = all expos)
            </label>
            <select
              name="expoName"
              value={formData.expoName}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg crm-input text-sm"
            >
              <option value="">— General (All Expos) —</option>
              {expos.map((expo) => (
                <option key={expo.id} value={expo.expo_name}>
                  {expo.expo_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Enquiry type (blank = all)
            </label>
            <select
              name="enquiryType"
              value={formData.enquiryType}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg crm-input text-sm"
            >
              <option value="">— General (All Enquiry Types) —</option>
              {lookups.enquiry_type.map((item, i) => (
                <option key={`e-${i}`} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>Title</label>
          <input
            type="text"
            name="templateTitle"
            required
            value={formData.templateTitle}
            onChange={handleChange}
            placeholder="Enter template title..."
            className="w-full px-3 py-2.5 rounded-lg crm-input"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>Content</label>
          <textarea
            name="messageContent"
            required
            rows={5}
            value={formData.messageContent}
            onChange={handleChange}
            placeholder="Enter WhatsApp message content..."
            className="w-full px-3 py-2.5 rounded-lg crm-input resize-y leading-relaxed"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {'{customer_name}'}, {'{company_name}'} as placeholders
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          {isEditing && (
            <button type="button" onClick={resetForm} className="px-5 py-2 text-crm-primary hover:bg-crm-primaryLighter rounded-lg">
              Cancel
            </button>
          )}
          <button type="submit" className="btn-running-border text-white px-8 py-2 rounded-lg font-medium">
            {isEditing ? 'Update Template' : 'Save Template'}
          </button>
        </div>
      </form>
    </div>
  );

  const listBlock = loading ? (
    <LoadingSpinner label="Loading templates..." />
  ) : (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-300">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[700px] border-collapse">
          <thead>
            <tr className="bg-crm-primary text-sm text-white">
              <th className="px-4 py-3 font-medium border border-gray-300 w-14">S.No</th>
              <th className="px-4 py-3 font-medium border border-gray-300">Title</th>
              <th className="px-4 py-3 font-medium border border-gray-300">Expo Name</th>
              <th className="px-4 py-3 font-medium border border-gray-300">Enquiry Type</th>
              <th className="px-4 py-3 font-medium border border-gray-300">Content</th>
              <th className="px-4 py-3 font-medium border border-gray-300 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((temp, index) => (
              <tr key={temp.id} className="border-b border-gray-300 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm border border-gray-300 text-center">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-crm-textDark border border-gray-300">{temp.template_title}</td>
                <td className="px-4 py-3 text-sm text-gray-600 border border-gray-300">
                  {temp.expo_name || 'General (All)'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 border border-gray-300">
                  {temp.enquiry_type || 'General (All)'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate border border-gray-300">
                  {temp.message_content}
                </td>
                <td className="px-4 py-3 text-center border border-gray-300">
                  <button type="button" onClick={() => handleEdit(temp)} className="text-crm-primary mr-3 hover:opacity-80" title="Edit">
                  <i className="ph-bold ph-pencil-simple text-lg" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(temp.id, temp.template_title)}
                  className="text-red-600"
                  title="Delete"
                >
                  <i className="ph-bold ph-trash text-lg" />
                </button>
              </td>
            </tr>
          ))}
          {templates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 border border-gray-300">
                  No templates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className={`space-y-6 ${pageClass}`}>
        <div className="flex items-start gap-3">
          <i className="ph-fill ph-whatsapp-logo text-3xl text-crm-primary shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-crm-textDark">WhatsApp Templates</h2>
            {/* <p className="text-sm text-crm-textMuted">WhatsApp message templates</p> */}
          </div>
        </div>
        {formBlock}
        {listBlock}
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto space-y-6 ${pageClass}`}>
      <div className="flex items-start gap-3">
        <i className="ph-fill ph-whatsapp-logo text-3xl text-crm-primary" />
        <div>
          <h1 className="text-2xl font-bold text-crm-textDark">WhatsApp Templates</h1>
          <p className="text-sm text-crm-textMuted">WhatsApp message templates</p>
        </div>
      </div>
      {formBlock}
      {listBlock}
    </div>
  );
};

export default WhatsappTemplates;
