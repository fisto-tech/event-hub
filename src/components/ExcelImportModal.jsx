import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { fetchApi } from '../utils/api';
import { showToast } from '../utils/toast';
import SourceAutocomplete from './common/SourceAutocomplete';
import LoadingSpinner from './common/LoadingSpinner';

const REQUIRED_COLUMNS = ['customername', 'companyname', 'primaryphone'];

const normalizeHeader = (header) => {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
};

const mapHeaders = (rawHeaders) => {
  const mapping = {};
  rawHeaders.forEach((raw) => {
    const norm = normalizeHeader(raw);
    if (norm.includes('customer') && norm.includes('name')) mapping[raw] = 'customerName';
    else if (norm.includes('company') && norm.includes('name')) mapping[raw] = 'companyName';
    else if (norm.includes('phone') && (norm.includes('1') || norm.includes('primary') || norm === 'phone')) mapping[raw] = 'phone1';
    else if (norm.includes('phone') && (norm.includes('2') || norm.includes('secondary') || norm.includes('alt'))) mapping[raw] = 'phone2';
    else if (norm.includes('email')) mapping[raw] = 'email';
    else if (norm.includes('designation') || norm.includes('jobtitle') || norm.includes('title')) mapping[raw] = 'designation';
    else if (norm.includes('website')) mapping[raw] = 'website';
    else if (norm.includes('location') || norm.includes('address')) mapping[raw] = 'location';
    else if (norm.includes('city')) mapping[raw] = 'city';
    else if (norm.includes('industry')) mapping[raw] = 'industryType';
    else if (norm.includes('enquiry')) mapping[raw] = 'enquiryType';
    else if (norm.includes('priority')) mapping[raw] = 'priority';
    else if (norm.includes('visit') && norm.includes('date')) mapping[raw] = 'visitDate';
    else if (norm.includes('next') && norm.includes('followup')) mapping[raw] = 'nextFollowUpDate';
    else if (norm.includes('followup') && norm.includes('date')) mapping[raw] = 'nextFollowUpDate';
    else if (norm.includes('remark') || norm.includes('note')) mapping[raw] = 'remarks';
    else if (norm.includes('reference')) mapping[raw] = 'reference';
  });
  return mapping;
};

const ExcelImportModal = ({ expos, sourceOptions, currentUser, onClose, onSuccess, existingCustomers = [] }) => {
  const [expoId, setExpoId] = useState('');
  const [referenceSource, setReferenceSource] = useState('');
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const showSourceField = !expoId;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrors([]);
    }
  };

  const handleImport = async () => {
    if (!expoId && !referenceSource) {
      setErrors(['Please select an Expo or enter a Source.']);
      return;
    }

    if (!file) {
      setErrors(['Please select an Excel file.']);
      return;
    }

    setIsProcessing(true);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (rawData.length === 0) {
          setErrors(['The Excel file is empty.']);
          setIsProcessing(false);
          return;
        }

        const rawHeaders = Object.keys(rawData[0]);
        const mapping = mapHeaders(rawHeaders);
        
        // Validate required columns
        const mappedValues = Object.values(mapping).map(v => v.toLowerCase());
        const missingCols = [];
        
        if (!mappedValues.includes('customername')) missingCols.push('Customer Name');
        if (!mappedValues.includes('companyname')) missingCols.push('Company Name');
        if (!mappedValues.includes('phone1')) missingCols.push('Primary Phone');

        if (missingCols.length > 0) {
          setErrors([`Missing required columns: ${missingCols.join(', ')}. Please check your Excel headers.`]);
          setIsProcessing(false);
          return;
        }

        // Process data
        const customersToImport = rawData.map(row => {
          const customer = {
            expoId: expoId || null,
            manualExpoName: expoId === 'other' ? referenceSource : null,
            referenceSource: !expoId ? referenceSource : '',
            createdBy: currentUser?.id,
            visitDate: new Date().toISOString().split('T')[0],
            nextFollowUpDate: new Date().toISOString().split('T')[0],
            priority: 'medium',
            enquiryType: 'IDC'
          };

          for (const rawHeader of rawHeaders) {
            const mappedKey = mapping[rawHeader];
            if (mappedKey) {
              let val = String(row[rawHeader]).trim();
              if (mappedKey === 'visitDate' || mappedKey === 'nextFollowUpDate') {
                // If it's a date number (Excel serial date), convert it
                if (!isNaN(val) && val > 20000) {
                  const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                  val = date.toISOString().split('T')[0];
                }
              }
              if (val) {
                customer[mappedKey] = val;
              }
            }
          }

          return customer;
        });

        // Validation against existing records
        const existingPhones = new Set();
        const existingCompanies = new Set();
        
        if (existingCustomers && existingCustomers.length > 0) {
          existingCustomers.forEach(c => {
            if (c.phone_1) existingPhones.add(String(c.phone_1).replace(/\D/g, ''));
            if (c.phone_2) existingPhones.add(String(c.phone_2).replace(/\D/g, ''));
            if (c.company_name) existingCompanies.add(String(c.company_name).trim().toLowerCase());
          });
        }

        const duplicateErrors = [];
        customersToImport.forEach((c, index) => {
          const rowNum = index + 2; // +1 for 0-index, +1 for header
          const p1 = c.phone1 ? String(c.phone1).replace(/\D/g, '') : '';
          const p2 = c.phone2 ? String(c.phone2).replace(/\D/g, '') : '';
          const comp = c.companyName ? String(c.companyName).trim().toLowerCase() : '';

          if ((p1 && existingPhones.has(p1)) || (p2 && existingPhones.has(p2))) {
            duplicateErrors.push(`Row ${rowNum}: Phone number already exists in database (${c.phone1 || c.phone2}).`);
          } else if (comp && existingCompanies.has(comp)) {
            duplicateErrors.push(`Row ${rowNum}: Company name already exists in database ("${c.companyName}").`);
          }
        });

        if (duplicateErrors.length > 0) {
          setErrors(['Duplicate data found in database. Import blocked for:', ...duplicateErrors]);
          setIsProcessing(false);
          return;
        }

        // Send to backend
        const response = await fetchApi('import_customers.php', {
          method: 'POST',
          body: JSON.stringify({ customers: customersToImport })
        });

        if (response.status === 'success') {
          showToast(response.message || 'Customers imported successfully!', 'success');
          onSuccess();
          onClose();
        } else {
          setErrors([response.message || 'Import failed.', ...(response.errors || [])]);
        }

      } catch (err) {
        console.error('Excel parse error:', err);
        setErrors(['Error parsing Excel file. Please ensure it is a valid .xlsx file.']);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrors(['Error reading file.']);
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-crm-primary to-crm-primaryDark px-6 py-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <i className="ph-fill ph-file-xls text-2xl"></i> Import from Excel
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <i className="ph-bold ph-x text-xl"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {errors.length > 0 && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((e, idx) => <li key={idx}>{e}</li>)}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Expo <span className="text-red-500">*</span></label>
            <select
              value={expoId}
              onChange={(e) => setExpoId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl bg-gray-50 text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-crm-primary/50 transition-all text-sm"
            >
              <option value="">-- No Expo (Source Required) --</option>
              {expos.map((e) => (
                <option key={e.id} value={e.id}>{e.expo_name}</option>
              ))}
            </select>
          </div>

          {showSourceField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Name <span className="text-red-500">*</span></label>
              <SourceAutocomplete
                options={sourceOptions}
                name="referenceSource"
                value={referenceSource}
                onChange={(val) => setReferenceSource(val)}
                className="w-full px-3 py-2 border rounded-xl bg-gray-50 text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-crm-primary/50 transition-all text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Excel File (.xlsx) <span className="text-red-500">*</span></label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <div 
                className="cursor-pointer flex flex-col items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="ph-duotone ph-upload-simple text-4xl text-crm-primary/60"></i>
                <div className="text-sm text-gray-600 font-medium">
                  {file ? file.name : 'Click to select Excel file'}
                </div>
                {!file && <div className="text-xs text-gray-400">Supported formats: .xlsx</div>}
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs space-y-1 border border-blue-100">
            <p className="font-semibold mb-1">Template Instructions:</p>
            <ul className="list-disc pl-4 space-y-1 text-blue-700/80">
              <li>Required columns: <strong>Customer Name</strong>, <strong>Company Name</strong>, <strong>Primary Phone</strong>.</li>
              <li>Optional columns: Secondary Phone, Email, Designation, Website, Address, City, Industry, Enquiry Type, Visit Date, Next Followup Date, Remarks.</li>
              <li>Columns are auto-matched based on headers (ignoring spaces).</li>
            </ul>
          </div>

        </div>

        <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isProcessing}
            className="px-6 py-2 bg-gradient-to-r from-crm-primary to-crm-primaryDark hover:from-crm-primaryDark hover:to-crm-primary text-white rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 min-w-[120px]"
          >
            {isProcessing ? <LoadingSpinner size="sm" /> : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
