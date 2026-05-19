import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const RegistrationForm = () => {
  const [expos, setExpos] = useState([]);
  const [formData, setFormData] = useState({
    expoId: '',
    manualExpoName: '',
    visitDate: new Date().toISOString().split('T')[0],
    companyName: '',
    industryType: '',
    website: '',
    location: '',
    city: '',
    customerName: '',
    designation: '',
    phone1: '',
    phone2: '',
    email: '',
    enquiryType: 'Hot Lead',
    referenceSource: '',
    nextFollowUpDate: '',
    remarks: '',
    whatsappMessage: 'Hello {customer_name}, Thank you for visiting us at our stall! We appreciate your interest in our products. Our team will contact you shortly to discuss further.'
  });

  useEffect(() => {
    const loadExpos = async () => {
      try {
        const result = await fetchApi('expos.php');
        if (result.status === 'success') {
          setExpos(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch expos', error);
      }
    };
    loadExpos();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await fetchApi('customers.php', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (result.status === 'success') {
        alert('Customer Saved Successfully!');
        // Reset form
        setFormData(prev => ({
          ...prev,
          companyName: '', industryType: '', website: '', location: '', city: '',
          customerName: '', designation: '', phone1: '', phone2: '', email: '',
          referenceSource: '', nextFollowUpDate: '', remarks: ''
        }));
      } else {
        alert(result.message || 'Error saving customer');
      }
    } catch (error) {
      console.error('Error submitting form', error);
      alert('Failed to connect to the server.');
    }
  };

  const SectionHeader = ({ title, icon }) => (
    <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center gap-2">
      <i className={`ph-fill ${icon} text-crm-primary text-2xl`}></i>
      <h3 className="text-lg font-black text-crm-primary tracking-tight">{title}</h3>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      
      {/* SECTION 1: Company Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader title="1. Company Details" icon="ph-buildings" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Expo Name</label>
            <select name="expoId" value={formData.expoId} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input">
              <option value="">-- Select Expo --</option>
              {expos.map(expo => (
                <option key={expo.id} value={expo.id}>{expo.expo_name}</option>
              ))}
              <option value="other">Other (Manual Entry)</option>
            </select>
          </div>

          {formData.expoId === 'other' && (
            <div className="space-y-1">
              <label className="block text-sm font-bold text-crm-primary">Manual Expo Name</label>
              <input type="text" name="manualExpoName" value={formData.manualExpoName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Enter Expo Name" />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Visit Date *</label>
            <input type="date" name="visitDate" required value={formData.visitDate} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Company Name *</label>
            <input type="text" name="companyName" required value={formData.companyName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Acme Corp" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Industry Type</label>
            <input type="text" name="industryType" value={formData.industryType} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="E.g. Manufacturing" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Website</label>
            <input type="url" name="website" value={formData.website} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="https://example.com" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">City</label>
            <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="City" />
          </div>

          <div className="space-y-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-bold text-crm-primary">Full Address/Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Street address, building, etc." />
          </div>
        </div>
      </div>

      {/* SECTION 2: Customer Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader title="2. Point of Contact Details" icon="ph-user-circle" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Customer Name *</label>
            <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Full Name" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Designation</label>
            <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Director, Manager, etc." />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Email Address</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="email@company.com" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Primary Phone / WhatsApp *</label>
            <div className="flex">
              <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-600">
                <i className="ph-fill ph-whatsapp-logo text-gray-600 text-xl"></i>
              </span>
              <input type="tel" name="phone1" required value={formData.phone1} onChange={handleChange} className="flex-1 w-full px-4 py-3 rounded-r-lg outline-none crm-input" placeholder="+1234567890" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Secondary Phone</label>
            <input type="tel" name="phone2" value={formData.phone2} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Alternate Number" />
          </div>
        </div>
      </div>

      {/* SECTION 3: Enquiry Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader title="3. Enquiry & Follow-up Details" icon="ph-target" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Enquiry Type</label>
            <select name="enquiryType" value={formData.enquiryType} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none font-medium crm-input">
              <option value="Hot Lead">🔥 Hot Lead (Immediate Need)</option>
              <option value="Warm Lead">⭐ Warm Lead (Interested)</option>
              <option value="Cold Lead">Cold Lead (Just Browsing)</option>
              <option value="Partner">🤝 Partnership/Vendor</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-crm-primary">Next Follow-up Date</label>
            <input type="date" name="nextFollowUpDate" value={formData.nextFollowUpDate} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-bold text-crm-primary">Reference Source</label>
            <input type="text" name="referenceSource" value={formData.referenceSource} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="How did they find us?" />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-bold text-crm-primary">Remarks / Requirements</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="3" className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Enter detailed customer requirements..."></textarea>
          </div>

          {/* WhatsApp Message Box */}
          <div className="space-y-2 md:col-span-2 bg-gray-50 p-5 rounded-xl border border-gray-200 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <i className="ph-fill ph-whatsapp-logo text-crm-primary text-2xl"></i>
              <h4 className="font-bold text-crm-primary">WhatsApp Instant Message Template</h4>
            </div>
            <textarea name="whatsappMessage" value={formData.whatsappMessage} onChange={handleChange} rows="3" className="w-full px-4 py-3 rounded-lg outline-none font-medium crm-input"></textarea>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">This message is auto-selected from Master Templates.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <button type="button" className="px-6 py-3 text-crm-primary font-bold hover:bg-crm-primaryLighter rounded-lg transition-colors uppercase tracking-wider text-sm">Cancel</button>
        <button type="submit" className="btn-running-border text-white px-8 py-3 rounded-lg font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 uppercase tracking-wider text-sm">
          <i className="ph-bold ph-floppy-disk text-lg"></i> Save Registration
        </button>
      </div>
    </form>
  );
};

export default RegistrationForm;
