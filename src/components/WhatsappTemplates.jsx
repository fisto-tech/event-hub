import React, { useState, useEffect } from 'react';
import { fetchApi, resolvePublicUrl } from '../utils/api';
import { showToast } from '../utils/toast';
import { confirmDelete } from '../utils/confirm';
import LoadingSpinner from './common/LoadingSpinner';
import { invalidateRegistrationCache } from '../utils/registrationDataCache';

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
    image: '',
    imagePath: null,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [viewingGroup, setViewingGroup] = useState(null);

  const groupedTemplates = React.useMemo(() => {
    const groups = {};
    templates.forEach(item => {
      const key = item.expo_name || 'General (All Expos)';
      if (!groups[key]) groups[key] = { expoName: key, items: [] };
      groups[key].items.push(item);
    });
    return Object.values(groups).sort((a, b) => a.expoName.localeCompare(b.expoName));
  }, [templates]);

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
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'expoName' && !value) {
        next.enquiryType = '';
      }
      return next;
    });
  };

  const filteredEnquiryTypesRaw = formData.expoName
    ? lookups.enquiry_type.filter((item) => {
      const expo = expos.find((e) => e.expo_name === formData.expoName);
      return !item.expo_id || (expo && String(item.expo_id) === String(expo.id));
    })
    : [];

  const filteredEnquiryTypes = Array.from(
    new Map(filteredEnquiryTypesRaw.map((item) => [item.name.toLowerCase().trim(), item])).values()
  );

  const resetForm = () => {
    setFormData({
      id: '',
      expoName: '',
      enquiryType: '',
      templateTitle: '',
      messageContent: '',
      image: '',
      imagePath: null,
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
        invalidateRegistrationCache();
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
      image: '',
      imagePath: template.image_path || null,
    });
    setIsEditing(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id, title) => {
    if (!confirmDelete(`template "${title}"`)) return;
    try {
      const res = await fetchApi(`whatsapp_templates.php?id=${id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        showToast('Template deleted successfully!');
        invalidateRegistrationCache();
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
              disabled={!formData.expoName}
              className={`w-full px-3 py-2.5 rounded-lg crm-input text-sm ${!formData.expoName ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            >
              {!formData.expoName ? (
                <option value="">— First choose expo name —</option>
              ) : (
                <>
                  <option value="">— General (All Enquiry Types) —</option>
                  {filteredEnquiryTypes.map((item, i) => (
                    <option key={`e-${i}`} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </>
              )}
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>Image (Optional)</label>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
            {(formData.image || formData.imagePath) && (
              <div className="flex items-center gap-3 mt-2">
                <img
                  src={
                    formData.image
                      ? formData.image
                      : resolvePublicUrl(formData.imagePath)
                  }
                  alt="Template Image"
                  className="h-16 w-auto max-w-[200px] rounded border border-gray-300 bg-gray-50 object-contain cursor-pointer"
                  onClick={() => setPreviewImage(formData.image ? formData.image : resolvePublicUrl(formData.imagePath))}
                />
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, image: '', imagePath: null }))
                  }
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Remove Image
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          {isEditing && (
            <button type="button" onClick={resetForm} className="px-5 py-2 text-crm-primary rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors">
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
      <div className="overflow-x-auto ">
        <table className="w-full text-left min-w-[600px] border-collapse">
          <thead>
            <tr className="bg-crm-primary text-sm text-white">
              <th className="px-4 py-3 font-medium border border-gray-300 w-16 text-center">S.No</th>
              <th className="px-4 py-3 font-medium border border-gray-300">Expo Name</th>
              <th className="px-4 py-3 font-medium border border-gray-300 text-center w-36">Total Templates</th>
              <th className="px-4 py-3 font-medium border border-gray-300 text-center w-36">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedTemplates.map((group, index) => (
              <tr key={index} className="border-b border-gray-300 hover:bg-gray-50/80 transition-colors">
                <td className="px-4 py-3 text-sm border border-gray-300 text-center">{index + 1}</td>
                <td className="px-4 py-3 border border-gray-300 font-medium text-gray-800">
                  {group.expoName}
                </td>
                <td className="px-4 py-3 border border-gray-300 text-center text-gray-600">
                  <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-xs font-semibold">{group.items.length}</span>
                </td>
                <td className="px-4 py-3 text-center border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setViewingGroup(group)}
                    className="text-crm-primary hover:opacity-80 px-3 py-1.5 rounded-lg border border-crm-primary hover:bg-crm-primary hover:text-white transition-colors text-sm font-medium flex items-center justify-center gap-1.5 mx-auto"
                    title="View Templates"
                  >
                    <i className="ph-bold ph-eye text-lg" /> View
                  </button>
                </td>
              </tr>
            ))}
            {groupedTemplates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 border border-gray-300">
                  No templates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1100] p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-lg p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 bg-black/50 rounded-full p-2"
            >
              <i className="ph-bold ph-x text-xl" />
            </button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded" />
          </div>
        </div>
      )}

      {viewingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4" onClick={() => setViewingGroup(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-screen" onClick={e => e.stopPropagation()}>
            <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
                <i className="ph-fill ph-whatsapp-logo" /> {viewingGroup.expoName} - WhatsApp Templates
              </h3>
              <button type="button" onClick={() => setViewingGroup(null)} className="text-gray-500 hover:text-gray-800">
                <i className="ph-bold ph-x text-lg" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-crm-primary sticky top-0 shadow-sm z-10 text-white">
                  <tr>
                    <th className="px-6 py-3 font-medium text-sm w-14 text-center border border-gray-300">S.No</th>
                    <th className="px-6 py-3 font-medium text-sm border border-gray-300">Enquiry Type</th>
                    <th className="px-6 py-3 font-medium text-sm border border-gray-300">Title</th>
                    <th className="px-6 py-3 font-medium text-sm border border-gray-300">Content</th>
                    <th className="px-6 py-3 font-medium text-sm text-center border border-gray-300">Image</th>
                    <th className="px-6 py-3 font-medium text-sm text-center w-36 border border-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(viewingGroup.items.reduce((acc, item) => {
                    const type = item.enquiry_type || 'General (All)';
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(item);
                    return acc;
                  }, {})).map(([enqType, items], groupIdx) => (
                    <React.Fragment key={enqType}>
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                          {idx === 0 && (
                            <>
                              <td className="px-6 py-3 text-sm text-center text-gray-600 border border-gray-300 align-middle" rowSpan={items.length}>
                                {groupIdx + 1}
                              </td>
                              <td className="px-6 py-3 text-sm font-bold text-crm-primary border border-gray-300 align-middle" rowSpan={items.length}>
                                {enqType}
                              </td>
                            </>
                          )}
                          <td className="px-6 py-3 text-sm font-medium text-gray-800 border border-gray-300">{item.template_title}</td>
                          <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate border border-gray-300" title={item.message_content}>{item.message_content}</td>
                          <td className="px-6 py-3 text-center border border-gray-300">
                            {item.image_path ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(resolvePublicUrl(item.image_path))}
                                className="text-crm-primary hover:opacity-80"
                                title="View Image"
                              >
                                <i className="ph-bold ph-image text-xl" />
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-center border border-gray-300">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => { setViewingGroup(null); handleEdit(item); }}
                                className="text-crm-primary hover:opacity-80"
                                title="Edit"
                              >
                                <i className="ph-bold ph-pencil-simple text-lg" />
                              </button>
                              <button
                                onClick={() => { setViewingGroup(null); handleDelete(item.id, item.template_title); }}
                                className="text-red-500 hover:text-red-700"
                                title="Delete"
                              >
                                <i className="ph-bold ph-trash text-lg" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end shrink-0">
              <button onClick={() => setViewingGroup(null)} className="px-5 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg text-sm font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
