import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchApi, resolvePublicUrl } from '../utils/api';
import { submitOfflineAware } from '../utils/offlineSync';
import {
  loadRegistrationBootstrap,
  appendLookupToCache,
  getCachedRegistrationData,
} from '../utils/registrationDataCache';
import { showToast } from '../utils/toast';
import CityAutocomplete from './common/CityAutocomplete';
import SourceAutocomplete from './common/SourceAutocomplete';
import PhoneInput from './common/PhoneInput';
import { validateStoredPhone, normalizePhoneForSubmit, parseStoredPhone, digitsOnly } from '../utils/phoneUtils';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import muscutImage from '../assets/muscut-image.webp';

const DEFAULT_WHATSAPP_MESSAGE =
  'Hello {customer_name}, Thank you for visiting us at our stall! We appreciate your interest in our products. Our team will contact you shortly to discuss further.';

const FormField = ({ label, children, isFullWidth, required }) => {
  const labelText = String(label).replace(/\s*\*+\s*$/, '').trim();
  return (
    <div className={`flex flex-col ${isFullWidth ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''}`}>
      <label className="block text-sm font-semibold text-[#1e293b] mb-2">
        {labelText}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <div className="w-full">{children}</div>
    </div>
  );
};

const validateRegistration = (payload, { customEnquiry, customIndustry, showSourceField }) => {
  const missing = [];

  if (!String(payload.visitDate || '').trim()) missing.push('Visit Date');
  if (!String(payload.companyName || '').trim()) missing.push('Company Name');
  if (!String(payload.customerName || '').trim()) missing.push('Customer Name');
  const phone1Err = validateStoredPhone(payload.phone1, { required: true });
  if (phone1Err) {
    missing.push(phone1Err === 'Phone number is required' ? 'Phone / WhatsApp' : phone1Err);
  } else {
    const nat1 = digitsOnly(parseStoredPhone(payload.phone1).national, 15);
    if (nat1 && nat1.length !== 10) missing.push('Phone / WhatsApp must be exactly 10 digits');
  }

  if (String(payload.phone2 || '').trim()) {
    const phone2Err = validateStoredPhone(payload.phone2, { required: true });
    if (phone2Err) {
      missing.push(`Secondary phone: ${phone2Err}`);
    } else {
      const nat2 = digitsOnly(parseStoredPhone(payload.phone2).national, 15);
      if (nat2 && nat2.length !== 10) missing.push('Secondary phone must be exactly 10 digits');
    }
  }

  const enquiry = payload.enquiryType === OTHER_VALUE
    ? customEnquiry
    : payload.enquiryType;
  if (!String(enquiry || '').trim()) missing.push('Enquiry Type');

  if (payload.industryType === OTHER_VALUE && !String(customIndustry || '').trim()) {
    missing.push('Industry Type (custom value)');
  }

  if (!String(payload.priority || '').trim()) {
    missing.push('Priority Level');
  }

  return missing;
};

const SectionHeader = ({ title, icon }) => (
  <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-8 mb-4 border-b border-gray-100 pb-3 flex items-center gap-3">
    <div className="bg-[#00b5e2]/10 p-1.5 rounded-md">
      <i className={`ph-fill ${icon} text-[#00b5e2] text-lg`}></i>
    </div>
    <h3 className="text-[16px] font-bold text-[#1e293b]">{title}</h3>
  </div>
);

// OCR Backend Server URL (runs on port 4000)
const OCR_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'https://ocr-event-app.onrender.com'
  : 'https://ocr-event-app.onrender.com';

const OTHER_VALUE = '__other__';
const DEFAULT_ENQUIRY_TYPES = ['IDC', 'Website', 'Web page', 'Application'];

const filterLookupsForExpo = (items, expoId) => {
  if (!items?.length) return [];
  const eid = expoId ? String(expoId) : null;
  return items.filter((item) => {
    if (!item.expo_id) return true;
    return eid && String(item.expo_id) === eid;
  });
};

const RegistrationForm = ({ currentUser }) => {
  const [expos, setExpos] = useState([]);
  const [lookups, setLookups] = useState({ source: [], enquiry_type: [], industry_type: [] });
  const [customEnquiry, setCustomEnquiry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
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
    enquiryType: '',
    referenceSource: '',
    reference: '',
    priority: '',
    nextFollowUpDate: '',
    remarks: '',
    image: '',
    whatsappMessage: DEFAULT_WHATSAPP_MESSAGE,
  });

  const [formReady, setFormReady] = useState(false);

  // Modal Scanner States (from raw HTML design context)
  const [showScanModal, setShowScanModal] = useState(false);
  const [modalTab, setModalTab] = useState('upload'); // 'upload' or 'camera'
  const [selectedFile, setSelectedFile] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedImage, setCapturedImage] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' or 'user'

  const [cameraActive, setCameraActive] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [rawOcrText, setRawOcrText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [whatsappTemplates, setWhatsappTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('custom');
  const [isDragOver, setIsDragOver] = useState(false);

  const [crop, setCrop] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const [finalCroppedImageUrl, setFinalCroppedImageUrl] = useState('');
  const imgRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const imageInputRef = useRef(null);

  // Camera stream mounting hook to prevent race-conditions of blank video elements
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive, modalTab, capturedImage]);

  useEffect(() => {
    let cancelled = false;
    setFormReady(false);

    loadRegistrationBootstrap()
      .then((data) => {
        if (cancelled) return;
        const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
        const allowedExpos = data.expos.filter(e => {
          if (isAdmin) return true;
          if (!e.assigned_employees) return false; // Strictly require assignment
          const assignedIds = e.assigned_employees.split(',').map(s => s.trim()).filter(Boolean);
          if (assignedIds.length === 0) return false; // Strictly require assignment
          return assignedIds.includes(String(currentUser?.id));
        });
        setExpos(allowedExpos);

        setFormData(prev => {
          let nextExpoId = prev.expoId;

          // Clear if current selection is no longer allowed
          if (nextExpoId && !allowedExpos.find(e => String(e.id) === String(nextExpoId))) {
            nextExpoId = '';
          }

          // Strict requirement: no auto-selection. User must manually select from their allowed list.

          return { ...prev, expoId: nextExpoId };
        });
        setWhatsappTemplates(data.whatsappTemplates);
        setLookups(data.lookups);
      })
      .catch((error) => {
        console.error('Failed to load registration data', error);
      })
      .finally(() => {
        if (!cancelled) setFormReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const matchedTemplates = useMemo(() => {
    if (whatsappTemplates.length === 0) return [];

    let selectedExpoName = '';
    if (formData.expoId) {
      const selectedExpo = expos.find((e) => String(e.id) === String(formData.expoId));
      if (selectedExpo) selectedExpoName = (selectedExpo.expo_name || '').toLowerCase().trim();
    }

    let selectedEnquiryType = formData.enquiryType;
    if (selectedEnquiryType === OTHER_VALUE) {
      selectedEnquiryType = customEnquiry;
    }
    selectedEnquiryType = (selectedEnquiryType || '').toLowerCase().trim();

    const exactMatches = [];
    const expoOnlyMatches = [];
    const enquiryOnlyMatches = [];
    const globalMatches = [];

    for (const t of whatsappTemplates) {
      const tExpo = (t.expo_name || '').toLowerCase().trim();
      const tEnq = (t.enquiry_type || '').toLowerCase().trim();

      const matchExpo = tExpo === selectedExpoName;
      const matchEnq = tEnq === selectedEnquiryType;

      const isGeneralExpo = !tExpo;
      const isGeneralEnq = !tEnq;

      if (matchExpo && matchEnq) exactMatches.push(t);
      else if (matchExpo && isGeneralEnq) expoOnlyMatches.push(t);
      else if (isGeneralExpo && matchEnq) enquiryOnlyMatches.push(t);
      else if (isGeneralExpo && isGeneralEnq) globalMatches.push(t);
    }

    if (exactMatches.length > 0) return exactMatches;
    if (expoOnlyMatches.length > 0) return expoOnlyMatches;
    if (enquiryOnlyMatches.length > 0) return enquiryOnlyMatches;
    if (globalMatches.length > 0) return globalMatches;

    return [];
  }, [formData.expoId, formData.enquiryType, customEnquiry, expos, whatsappTemplates]);

  const activeTemplate = useMemo(() => {
    if (selectedTemplateId === 'custom') return null;
    return matchedTemplates.find(t => String(t.id) === selectedTemplateId) || null;
  }, [selectedTemplateId, matchedTemplates]);

  // Sync WhatsApp template when matches change — skip if user already edited the message
  const whatsappUserEditedRef = useRef(false);

  useEffect(() => {
    if (matchedTemplates.length > 0) {
      if (!whatsappUserEditedRef.current && selectedTemplateId === 'custom') {
        setSelectedTemplateId(String(matchedTemplates[0].id));
      } else if (!matchedTemplates.find(t => String(t.id) === selectedTemplateId) && selectedTemplateId !== 'custom') {
        setSelectedTemplateId(String(matchedTemplates[0].id));
      }
    } else {
      if (!whatsappUserEditedRef.current) setSelectedTemplateId('custom');
    }
  }, [matchedTemplates, selectedTemplateId]);

  useEffect(() => {
    if (whatsappUserEditedRef.current || selectedTemplateId === 'custom') return;
    const msg = activeTemplate?.message_content || DEFAULT_WHATSAPP_MESSAGE;
    setFormData((prev) =>
      prev.whatsappMessage === msg ? prev : { ...prev, whatsappMessage: msg }
    );
  }, [activeTemplate, selectedTemplateId]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'whatsappMessage') {
      whatsappUserEditedRef.current = true;
      setSelectedTemplateId('custom');
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const resolveFieldValue = (selected, custom, fallback = '') => {
    if (selected === OTHER_VALUE) return custom.trim() || fallback;
    return selected || fallback;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      enquiryType: resolveFieldValue(formData.enquiryType, customEnquiry, ''),
      industryType: resolveFieldValue(formData.industryType, customIndustry),
      referenceSource: String(formData.referenceSource || '').trim(),
      reference: String(formData.reference || '').trim(),
    };

    const missing = validateRegistration(payload, {
      customEnquiry,
      customIndustry,
      showSourceField,
    });

    if (missing.length > 0) {
      showToast(`Missing: ${missing.join(', ')}`, 'error');
      return;
    }

    const submitPayload = {
      ...payload,
      phone1: normalizePhoneForSubmit(payload.phone1),
      phone2: payload.phone2 ? normalizePhoneForSubmit(payload.phone2) : '',
      enquiryType: payload.enquiryType || 'IDC',
      createdBy: currentUser?.id || null,
      created_by: currentUser?.id || null,
      user_id: currentUser?.id || null,
      registeredBy: currentUser?.id || null,
      registered_by: currentUser?.id || null,
      image: payload.image && payload.image.length > 6_000_000 ? '' : payload.image,
    };

    try {
      const result = await submitOfflineAware('customers.php', 'POST', submitPayload, 'registration');
      if (result.status === 'success') {
        showToast(result.message || 'Customer saved successfully!', result.isOffline ? 'info' : 'success');
        const expoIdNum =
          submitPayload.expoId
            ? Number(submitPayload.expoId)
            : null;
        if (submitPayload.enquiryType) {
          appendLookupToCache('enquiry_type', submitPayload.enquiryType, expoIdNum);
        }
        if (submitPayload.industryType) {
          appendLookupToCache('industry_type', submitPayload.industryType, expoIdNum);
        }
        if (
          submitPayload.referenceSource &&
          !submitPayload.expoId
        ) {
          appendLookupToCache('source', submitPayload.referenceSource, null);
        }
        const data = await loadRegistrationBootstrap(true);
        if (data?.lookups) setLookups(data.lookups);
        resetMainForm();
      } else {
        showToast(result.message || 'Error saving customer', 'error');
      }
    } catch (error) {
      console.error('Error submitting form', error);
      const msg = error?.message || '';
      showToast(
        msg.includes('non-JSON') || msg.includes('fetch')
          ? 'Could not reach the server. Check API is running.'
          : msg || 'Failed to save customer.',
        'error'
      );
    }
  };

  const resetMainForm = () => {
    whatsappUserEditedRef.current = false;
    setCustomEnquiry('');
    setCustomIndustry('');
    setFormData(prev => ({
      ...prev,
      expoId: prev.expoId,
      companyName: '', industryType: '', website: '', location: '', city: '',
      customerName: '', designation: '', phone1: '', phone2: '', email: '',
      enquiryType: '',
      referenceSource: '', reference: '', nextFollowUpDate: '', remarks: '', priority: '', image: ''
    }));

    // Also clear the underlying <input type="file"> value so the old path/filename
    // doesn't remain selected (and same-file reselect triggers onChange correctly).
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const enquiryOptions = useMemo(
    () => filterLookupsForExpo(lookups.enquiry_type, formData.expoId),
    [lookups.enquiry_type, formData.expoId]
  );
  const industryOptions = useMemo(
    () => filterLookupsForExpo(lookups.industry_type, formData.expoId),
    [lookups.industry_type, formData.expoId]
  );
  const sourceOptions = lookups.source || [];
  const enquiryList = useMemo(
    () =>
      enquiryOptions.length
        ? enquiryOptions
        : DEFAULT_ENQUIRY_TYPES.map((name) => ({ name })),
    [enquiryOptions]
  );
  const showSourceField = !formData.expoId;

  // Heuristic OCR Parser
  const parseCardText = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let companyName = '';
    let customerName = '';
    let designation = '';
    let phone1 = '';
    let phone2 = '';
    let email = '';
    let website = '';
    let city = '';
    let location = '';

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const webRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+)/;
    const phoneRegex = /(\+?[0-9][0-9\s\-\(\)\.]{8,15}[0-9])/g;

    // Email
    const emailMatches = text.match(emailRegex);
    if (emailMatches) {
      email = emailMatches[0];
    }

    // Website
    const textWithoutEmail = text.replace(email || '', '');
    const webMatches = textWithoutEmail.match(webRegex);
    if (webMatches) {
      website = webMatches[0];
      if (!website.startsWith('http') && !website.startsWith('www.')) {
        website = 'www.' + website;
      }
    }

    // Phone Numbers
    const phoneMatches = text.match(phoneRegex) || [];
    const cleanPhones = phoneMatches
      .map(p => p.replace(/[^\d+]/g, ''))
      .filter(p => p.replace(/\+/g, '').length >= 9);

    if (cleanPhones.length > 0) phone1 = cleanPhones[0];
    if (cleanPhones.length > 1) phone2 = cleanPhones[1];

    // Filter used lines (exclude email, website, and phone numbers)
    const infoLines = lines.filter(line => {
      const isEmail = email && line.includes(email);
      const isWeb = website && line.includes(website.replace('www.', ''));
      const hasPhone = phoneMatches.some(p => line.includes(p));
      return !isEmail && !isWeb && !hasPhone;
    });

    let remainingLines = [...infoLines];

    // 1. Identify Designation
    const designationKeywords = [
      'director', 'manager', 'ceo', 'founder', 'president', 'partner', 'executive',
      'engineer', 'proprietor', 'head', 'owner', 'developer', 'consultant', 'officer',
      'representative', 'specialist', 'co-founder', 'advisor'
    ];
    const designationIndex = remainingLines.findIndex(line =>
      designationKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );
    if (designationIndex !== -1) {
      designation = remainingLines[designationIndex];
      remainingLines.splice(designationIndex, 1);
    }

    // 2. Identify Company Name by explicit company keywords
    const companyKeywords = [
      'ltd', 'limited', 'pvt', 'private', 'corp', 'corporation', 'inc', 'co', 'company',
      'solutions', 'technologies', 'services', 'industries', 'group', 'exports', 'global',
      'systems', 'enterprises', 'studio', 'firm', 'agency', 'manufacturing', 'logistics',
      'associates', 'designs', 'networks', 'labs', 'software', 'digital', 'communications',
      'marketing', 'ventures', 'holdings', 'trading', 'commerce', 'international'
    ];
    const companyIndex = remainingLines.findIndex(line =>
      companyKeywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(line);
      })
    );

    if (companyIndex !== -1) {
      companyName = remainingLines[companyIndex];
      remainingLines.splice(companyIndex, 1);
    }

    // 3. Identify Customer Name:
    // Heuristic: If we have a designation, the line immediately above or below it in the original card text is usually the person's name!
    if (designation) {
      const origDesigIndex = infoLines.indexOf(designation);
      if (origDesigIndex !== -1) {
        const aboveLine = infoLines[origDesigIndex - 1];
        if (aboveLine && remainingLines.includes(aboveLine)) {
          customerName = aboveLine;
          remainingLines = remainingLines.filter(l => l !== aboveLine);
        } else {
          const belowLine = infoLines[origDesigIndex + 1];
          if (belowLine && remainingLines.includes(belowLine)) {
            customerName = belowLine;
            remainingLines = remainingLines.filter(l => l !== belowLine);
          }
        }
      }
    }

    // 4. If Customer Name is still not found, search for a line containing 2-4 words, no numbers, no special symbols
    if (!customerName) {
      const nameIndex = remainingLines.findIndex(line => {
        const words = line.split(/\s+/);
        const hasNumbers = /\d/.test(line);
        const hasSpecials = /[$,.:;@#%^*=_\/\\<>\[\]\{\}]/.test(line);
        return words.length >= 2 && words.length <= 4 && !hasNumbers && !hasSpecials;
      });
      if (nameIndex !== -1) {
        customerName = remainingLines[nameIndex];
        remainingLines.splice(nameIndex, 1);
      }
    }

    // 5. If Company Name is still not found:
    // Heuristic: The very first line of a business card (which is at index 0 of infoLines) is almost always the Company Name!
    if (!companyName && infoLines.length > 0) {
      const firstLine = infoLines[0];
      if (remainingLines.includes(firstLine) && firstLine !== customerName && firstLine !== designation) {
        companyName = firstLine;
        remainingLines = remainingLines.filter(l => l !== firstLine);
      }
    }

    // Fallbacks
    if (!companyName && remainingLines.length > 0) {
      companyName = remainingLines[0];
      remainingLines.splice(0, 1);
    }
    if (!customerName && remainingLines.length > 0) {
      customerName = remainingLines[0];
      remainingLines.splice(0, 1);
    }

    // Address
    const addressLines = remainingLines.filter(line =>
      /\d/.test(line) ||
      ['street', 'road', 'floor', 'plot', 'ave', 'avenue', 'area', 'zone', 'city', 'nagar', 'bazar', 'market', 'pin', 'zip', 'india', 'building', 'chowk', 'highway'].some(k => line.toLowerCase().includes(k))
    );

    if (addressLines.length > 0) {
      location = addressLines.join(', ');
      remainingLines = remainingLines.filter(l => !addressLines.includes(l));
    } else if (remainingLines.length > 0) {
      location = remainingLines.join(', ');
    }

    if (location) {
      const cityKeywords = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'ahmedabad', 'chennai', 'kolkata', 'surat', 'pune', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi mumbai', 'allahabad', 'ranchi', 'coimbatore', 'jabalpur', 'gwalior', 'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati', 'chandigarh', 'solapur', 'gurgaon', 'aligarh', 'jalandhar', 'bhubaneswar', 'salem', 'warangal', 'guntur', 'gorakhpur', 'noida', 'jamshedpur', 'cuttack', 'kochi', 'nellore', 'dehradun', 'jamnagar', 'kolhapur', 'ajmer', 'jammu', 'ujjain', 'siliguri', 'jhansi', 'sangli', 'belgaum', 'mangalore', 'tirunelveli', 'gaya', 'jalgaon', 'udaipur', 'tirupur', 'trivandrum', 'thiruvananthapuram', 'cochin'];
      const foundCity = cityKeywords.find(c => location.toLowerCase().includes(c));
      if (foundCity) {
        city = foundCity.charAt(0).toUpperCase() + foundCity.slice(1);
      }
    }

    return { companyName, customerName, designation, phone1, phone2, email, website, location, city };
  };

  // Run OCR via Backend Server (OCR.space + AI parsing for high accuracy)
  const runOcr = async (imageFile) => {
    setIsProcessingOcr(true);
    setOcrProgress(0);
    try {
      // Simulate progress animation while server processes
      const progressInterval = setInterval(() => {
        setOcrProgress(prev => {
          if (prev >= 90) { clearInterval(progressInterval); return 90; }
          return prev + Math.random() * 15;
        });
      }, 400);

      const formData = new FormData();
      formData.append('file', imageFile, imageFile.name || 'card.jpg');

      const response = await fetch(`${OCR_SERVER_URL}/scan`, {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setOcrProgress(100);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'OCR server returned an error');
      }

      // Store raw OCR text
      setRawOcrText(result.rawText || '');

      // Map server response fields to our form field names
      const serverData = result.data || {};
      const phone2 = (serverData.phone_numbers && serverData.phone_numbers.length > 1)
        ? serverData.phone_numbers[1] : '';

      const extractedCompanyName = serverData.company || '';
      const extractedCustomerName = serverData.name || '';
      const extractedDesignation = serverData.job_title || '';
      const extractedPhone1 = serverData.phone_number || '';
      const extractedEmail = serverData.email_address || '';
      const extractedWebsite = serverData.website || '';
      const extractedLocation = serverData.address || '';

      // Auto-extract city if location is present
      let extractedCity = '';
      if (extractedLocation) {
        const cityKeywords = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'ahmedabad', 'chennai', 'kolkata', 'surat', 'pune', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi mumbai', 'allahabad', 'ranchi', 'coimbatore', 'jabalpur', 'gwalior', 'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati', 'chandigarh', 'solapur', 'gurgaon', 'aligarh', 'jalandhar', 'bhubaneswar', 'salem', 'warangal', 'guntur', 'gorakhpur', 'noida', 'jamshedpur', 'cuttack', 'kochi', 'nellore', 'dehradun', 'jamnagar', 'kolhapur', 'ajmer', 'jammu', 'ujjain', 'siliguri', 'jhansi', 'sangli', 'belgaum', 'mangalore', 'tirunelveli', 'gaya', 'jalgaon', 'udaipur', 'tirupur', 'trivandrum', 'thiruvananthapuram', 'cochin'];
        const foundCity = cityKeywords.find(c => extractedLocation.toLowerCase().includes(c));
        if (foundCity) {
          extractedCity = foundCity.charAt(0).toUpperCase() + foundCity.slice(1);
        }
      }

      // 1. Instantly populate the main form state automatically!
      setFormData(prev => ({
        ...prev,
        companyName: extractedCompanyName || prev.companyName,
        customerName: extractedCustomerName || prev.customerName,
        designation: extractedDesignation || prev.designation,
        phone1: extractedPhone1 || prev.phone1,
        phone2: phone2 || prev.phone2,
        email: extractedEmail || prev.email,
        website: extractedWebsite || prev.website,
        location: extractedLocation || prev.location,
        city: extractedCity || prev.city,
        image: capturedImage || prev.image
      }));

      // 2. Set the parsedData state for the read-only summary preview in the modal
      setParsedData({
        companyName: extractedCompanyName,
        customerName: extractedCustomerName,
        designation: extractedDesignation,
        phone1: extractedPhone1,
        phone2: phone2,
        email: extractedEmail,
        website: extractedWebsite,
        location: extractedLocation,
        city: extractedCity
      });

      // ── DEBUG ALERT: Show collected OCR data before form fill ──
      const debugMsg = [
        '📇 OCR DATA COLLECTED (DEBUG)',
        '─────────────────────────────',
        `👤 Name:        ${extractedCustomerName || '(not found)'}`,
        `💼 Designation: ${extractedDesignation || '(not found)'}`,
        `🏢 Company:     ${extractedCompanyName || '(not found)'}`,
        `📱 Phone 1:     ${extractedPhone1 || '(not found)'}`,
        `📱 Phone 2:     ${phone2 || '(not found)'}`,
        `📧 Email:       ${extractedEmail || '(not found)'}`,
        `🌐 Website:     ${extractedWebsite || '(not found)'}`,
        `📍 Address:     ${extractedLocation || '(not found)'}`,
        `🏙️  City:        ${extractedCity || '(not found)'}`,
        '─────────────────────────────',
        `🔍 Method: ${result.metadata?.parsingMethod || 'regex'} | Confidence: ${result.metadata?.confidence || 0}%`,
        '',
        '✅ Is this data correct? Form will fill after you click OK.'
      ].join('\n');

      alert(debugMsg);

      console.log('🤖 OCR Result auto-populated into main registration form:', {
        method: result.metadata?.parsingMethod,
        confidence: result.metadata?.confidence,
        data: serverData
      });

    } catch (e) {
      console.error('OCR Error:', e);
      alert('OCR Processing failed: ' + (e.message || 'Server unreachable. Make sure the OCR server is running on port 4000.'));
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Camera APIs
  const startCamera = async (currentFacing = facingMode) => {
    // 1. Stop any existing camera stream tracks directly without altering cameraActive state
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setCameraActive(true);
    setCapturedImage('');
    setCapturedBlob(null);
    setParsedData(null);

    try {
      const constraints = {
        video: {
          facingMode: currentFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error('Camera Access Error:', e);
      alert('Unable to access camera. Please upload an image instead.');
      setModalTab('upload');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        setCapturedBlob(blob);
        const dataUrl = URL.createObjectURL(blob);
        setCapturedImage(dataUrl);
        setParsedData(null); // Keep null so Scan button shows; OCR will populate this
        stopCamera();
      }, 'image/jpeg', 0.9);
    }
  };

  const retakePhoto = async () => {
    setCapturedBlob(null);
    setCapturedImage('');
    setParsedData(null);
    await startCamera();
  };

  const switchCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    await startCamera(nextFacing);
  };

  const handleUploadScan = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setParsedData(null); // Reset so Scan button shows; OCR will populate this
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setCapturedBlob(null);
    setCapturedImage('');
    setCrop(null);
    setCompletedCrop(null);
    setFinalCroppedImageUrl('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const getCroppedImg = (image, crop) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          return;
        }
        blob.name = 'cropped.jpeg';
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const processCard = async () => {
    try {
      let finalFileOrBlob = selectedFile || capturedBlob;
      let displayUrl = capturedImage;

      if (completedCrop && completedCrop.width && completedCrop.height && imgRef.current) {
        finalFileOrBlob = await getCroppedImg(imgRef.current, completedCrop);
        displayUrl = URL.createObjectURL(finalFileOrBlob);
      } else {
        if (!finalFileOrBlob && capturedImage) {
          const res = await fetch(capturedImage);
          finalFileOrBlob = await res.blob();
        }
      }

      setFinalCroppedImageUrl(displayUrl);

      if (!finalFileOrBlob) {
        alert('Please capture or upload an image first.');
        return;
      }

      await runOcr(finalFileOrBlob);
    } catch (e) {
      console.error('Cropping error', e);
      alert('Error during crop processing.');
    }
  };

  const applyParsedData = async () => {
    if (parsedData) {
      setFormData(prev => ({
        ...prev,
        companyName: parsedData.companyName || prev.companyName,
        customerName: parsedData.customerName || prev.customerName,
        designation: parsedData.designation || prev.designation,
        phone1: parsedData.phone1 || prev.phone1,
        phone2: parsedData.phone2 || prev.phone2,
        email: parsedData.email || prev.email,
        website: parsedData.website || prev.website,
        location: parsedData.location || prev.location,
        city: parsedData.city || prev.city,
        image: finalCroppedImageUrl || capturedImage || prev.image
      }));
      setShowScanModal(false);
      resetScanModalState();
      showToast('Data filled automatically!', 'success');
    }
  };

  const resetScanModalState = () => {
    stopCamera();
    setSelectedFile(null);
    setCapturedBlob(null);
    setCapturedImage('');
    setOcrProgress(0);
    setIsProcessingOcr(false);
    setRawOcrText('');
    setParsedData(null);
    setCrop(null);
    setCompletedCrop(null);
    setFinalCroppedImageUrl('');
  };

  // Copy All extracted details (Raw HTML script feature)
  const copyAllData = () => {
    if (!parsedData) return;
    const text = `NAME: ${parsedData.customerName || ''}
JOB TITLE: ${parsedData.designation || ''}
COMPANY: ${parsedData.companyName || ''}
EMAIL: ${parsedData.email || ''}
PHONE: ${parsedData.phone1 || ''}
WEBSITE: ${parsedData.website || ''}
ADDRESS: ${parsedData.location || ''}`;

    navigator.clipboard.writeText(text).then(() => {
      alert('📋 Extracted data copied to clipboard!');
    });
  };

  // Download vCard (.vcf) (Raw HTML script feature)
  const downloadVCard = () => {
    if (!parsedData) return;
    const name = parsedData.customerName || 'Contact';
    const nameParts = name.split(' ');
    const lastName = nameParts.pop() || '';
    const firstName = nameParts.join(' ') || '';

    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${name}
N:${lastName};${firstName};;;
TITLE:${parsedData.designation || ''}
ORG:${parsedData.companyName || ''}
TEL;TYPE=WORK,VOICE:${parsedData.phone1 || ''}
EMAIL;TYPE=WORK:${parsedData.email || ''}
URL:${parsedData.website || ''}
ADR;TYPE=WORK:;;${parsedData.location || ''};;;;
END:VCARD`;

    const blob = new Blob([vCard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_') || 'contact'}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="relative bg-white min-h-[800px] w-full p-8 lg:p-12 overflow-hidden flex flex-col flex-1">
        {/* Decorative Circles */}
      <div className="absolute top-10 right-[35%] w-24 h-24 bg-amber-100/60 rounded-full blur-xl pointer-events-none" />
      <div className="absolute top-20 right-[5%] w-32 h-32 bg-cyan-100/60 rounded-full blur-xl pointer-events-none" />
      <div className="absolute bottom-40 left-[15%] w-20 h-20 bg-amber-100/60 rounded-full blur-xl pointer-events-none" />
      <div className="absolute bottom-20 left-[40%] w-40 h-40 bg-cyan-100/40 rounded-full blur-xl pointer-events-none" />
      <div className="absolute top-1/2 left-10 w-64 h-64 bg-cyan-100/50 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header Row */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-[26px] font-bold text-[#1e293b]">Create Customer Record</h2>
          <p className="text-[15px] text-slate-500 mt-0.5">Fill in the details below to register a new customer</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setShowScanModal(true); resetScanModalState(); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#00b5e2] text-white text-sm font-semibold hover:bg-[#00a0c9] transition-colors shadow-sm"
          >
            <i className="ph-bold ph-scan text-lg"></i> Scan Card
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 w-full flex flex-col flex-1 pb-16">
        {!formReady && (
          <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
            <i className="ph ph-spinner animate-spin" /> Loading form options…
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 w-full xl:w-[90%] 2xl:w-[85%]">

          <SectionHeader title="Company Information" icon="ph-buildings" />

          <FormField label="Expo Name">
            <select name="expoId" value={formData.expoId} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700">
              <option value="">Other (General)</option>
              {expos.map(expo => (
                <option key={expo.id} value={expo.id}>{expo.expo_name}</option>
              ))}
            </select>
          </FormField>

          {showSourceField && (
            <FormField label="Source Name">
              <SourceAutocomplete
                name="referenceSource"
                value={formData.referenceSource}
                onChange={(val) => setFormData((prev) => ({ ...prev, referenceSource: val }))}
                placeholder="Enter Source name..."
                options={sourceOptions}
                inputClassName="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white"
              />
            </FormField>
          )}

          <FormField label="Visit Date" required>
            <input type="date" name="visitDate" value={formData.visitDate} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>

          <FormField label="Company Name" required>
            <input type="text" name="companyName" placeholder="Enter company name" value={formData.companyName} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>

          <FormField label="Industry Type">
            <select
              name="industryType"
              value={formData.industryType}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700"
            >
              <option value="">— Select —</option>
              {industryOptions.map((item, i) => (
                <option key={`ind-${i}-${item.name}`} value={item.name}>
                  {item.name}
                </option>
              ))}
              <option value={OTHER_VALUE}>Others (custom)</option>
            </select>
            {formData.industryType === OTHER_VALUE && (
              <input
                type="text"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                placeholder="Enter industry type..."
                className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700 mt-2"
              />
            )}
          </FormField>

          <FormField label="Website">
            <input type="text" name="website" placeholder="Enter website" value={formData.website} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>

          <FormField label="City">
            <CityAutocomplete
              name="city"
              value={formData.city}
              onChange={(city) => setFormData((prev) => ({ ...prev, city }))}
              placeholder="Type to search city…"
              inputClassName="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white"
            />
          </FormField>

          <FormField label="Address / Location">
            <input type="text" name="location" placeholder="Enter address / location" value={formData.location} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>


          <SectionHeader title="Contact Information" icon="ph-phone-call" />

          <FormField label="Customer Name" required>
            <input type="text" name="customerName" placeholder="Enter Customer name..." value={formData.customerName} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>

          <FormField label="Phone/WhatsApp" required>
            <PhoneInput
              name="phone1"
              value={formData.phone1}
              onChange={(phone1) => setFormData((prev) => ({ ...prev, phone1 }))}
              required
              inputClassName="flex-1 px-4 py-2.5 rounded-r-md border border-gray-200 border-l-0 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 text-[14px]"
              selectClassName="w-[4.5rem] shrink-0 px-2 py-2.5 rounded-l-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 bg-white text-[14px] text-gray-700"
            />
          </FormField>

          <FormField label="Email Address">
            <input type="email" name="email" placeholder="Enter email address" value={formData.email} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>

          <FormField label="Designation">
            <input type="text" name="designation" placeholder="Enter designation" value={formData.designation} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>

          <FormField label="Secondary Phone">
            <PhoneInput
              name="phone2"
              value={formData.phone2}
              onChange={(phone2) => setFormData((prev) => ({ ...prev, phone2 }))}
              required={false}
              inputClassName="flex-1 px-4 py-2.5 rounded-r-md border border-gray-200 border-l-0 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 text-[14px]"
              selectClassName="w-[4.5rem] shrink-0 px-2 py-2.5 rounded-l-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 bg-white text-[14px] text-gray-700"
            />
          </FormField>


          <SectionHeader title="Follow-up Information" icon="ph-arrows-clockwise" />

          <FormField label="Enquiry Type" required>
            <select name="enquiryType" value={formData.enquiryType} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700">
              <option value="">— Select —</option>
              {Array.from(new Map(enquiryList.map(item => [item.name.toLowerCase().trim(), item])).values()).map((item, i) => (
                <option key={`enq-${i}-${item.name}`} value={item.name}>
                  {item.name}
                </option>
              ))}
              <option value={OTHER_VALUE}>Others (custom)</option>
            </select>
            {formData.enquiryType === OTHER_VALUE && (
              <input
                type="text"
                value={customEnquiry}
                onChange={(e) => setCustomEnquiry(e.target.value)}
                placeholder="Enter enquiry type..."
                className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700 mt-2"
              />
            )}
          </FormField>

          <FormField label="Priority Level" required>
            <select name="priority" value={formData.priority} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700">
              <option value="">— Select —</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </FormField>

          <FormField label="Next Follow-up" required>
            <input type="date" name="nextFollowUpDate" value={formData.nextFollowUpDate} onChange={handleChange} className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700" />
          </FormField>

          <FormField label="Reference">
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder="e.g. Employee Name, Friend, etc."
              className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700"
            />
          </FormField>

          <FormField label="Remarks" isFullWidth>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="2" className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700"></textarea>
          </FormField>

          <FormField label="WhatsApp Template" isFullWidth>
            <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-lg p-4">

              {matchedTemplates.length > 0 && (
                <div className="mb-4">
                  <span className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Choose a Template</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {matchedTemplates.map(t => (
                      <label key={t.id} className={`cursor-pointer border rounded-lg px-3 py-2 flex items-center gap-2 transition-all ${selectedTemplateId === String(t.id) ? 'border-[#00b5e2] bg-[#00b5e2]/10 shadow-sm' : 'border-gray-200 hover:bg-white bg-white'}`}>
                        <input
                          type="radio"
                          name="whatsappTemplateSelect"
                          value={String(t.id)}
                          checked={selectedTemplateId === String(t.id)}
                          onChange={(e) => {
                            whatsappUserEditedRef.current = false;
                            setSelectedTemplateId(e.target.value);
                          }}
                          className="text-[#00b5e2] focus:ring-[#00b5e2] h-4 w-4"
                        />
                        <span className={`text-xs font-medium truncate ${selectedTemplateId === String(t.id) ? 'text-[#00b5e2]' : 'text-gray-700'}`}>
                          {t.template_title || 'Untitled Template'}
                        </span>
                      </label>
                    ))}
                    <label className={`cursor-pointer border rounded-lg px-3 py-2 flex items-center gap-2 transition-all ${selectedTemplateId === 'custom' ? 'border-[#00b5e2] bg-[#00b5e2]/10 shadow-sm' : 'border-gray-200 hover:bg-white bg-white'}`}>
                      <input
                        type="radio"
                        name="whatsappTemplateSelect"
                        value="custom"
                        checked={selectedTemplateId === 'custom'}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        onClick={() => {
                          whatsappUserEditedRef.current = true;
                          setSelectedTemplateId('custom');
                          setFormData(prev => ({ ...prev, whatsappMessage: '' }));
                        }}
                        className="text-[#00b5e2] focus:ring-[#00b5e2] h-4 w-4"
                      />
                      <span className={`text-xs font-medium ${selectedTemplateId === 'custom' ? 'text-[#00b5e2]' : 'text-gray-700'}`}>
                        Custom Message (Unselect)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {activeTemplate?.image_path && (
                <div className="mb-2">
                  <img
                    src={resolvePublicUrl(activeTemplate.image_path)}
                    alt="Template Attachment"
                    className="h-32 w-auto max-w-full rounded-lg border border-gray-200 object-contain bg-white shadow-sm"
                  />
                </div>
              )}
              {activeTemplate?.template_title && (
                <div className="font-bold text-gray-800 text-sm">
                  {activeTemplate.template_title}
                </div>
              )}

              <textarea
                name="whatsappMessage"
                value={formData.whatsappMessage}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-2.5 rounded-md border border-gray-200 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all text-[14px] bg-white text-gray-700"
                placeholder="Message content..."
              ></textarea>

              {formData.phone1 && (
                <button
                  type="button"
                  onClick={async () => {
                    const cleanPhone = formData.phone1.replace(/[^0-9]/g, '');
                    let selectedExpoName = expos.find(e => String(e.id) === String(formData.expoId))?.expo_name || '';
                    let resolvedMsg = formData.whatsappMessage.replace(/{customer_name}/g, formData.customerName || 'Customer').replace(/{company_name}/g, formData.companyName || 'your company').replace(/{expo_name}/g, selectedExpoName || 'our expo');

                    // Add Title if it exists
                    if (activeTemplate?.template_title) {
                      resolvedMsg = `*${activeTemplate.template_title}*\n\n${resolvedMsg}`;
                    }

                    const openWhatsappWeb = () => {
                      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(resolvedMsg)}`, '_blank');
                    };

                    if (activeTemplate?.image_path) {
                      const imageUrl = resolvePublicUrl(activeTemplate.image_path);

                      // ALWAYS append the URL to the text message so the link is shared
                      resolvedMsg += '\n\n' + imageUrl;

                      // Check if mobile device for navigator.share
                      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                      if (isMobile && navigator.canShare) {
                        try {
                          const response = await fetch(imageUrl);
                          const blob = await response.blob();
                          const file = new File([blob], 'template_image.jpg', { type: blob.type });
                          if (navigator.canShare({ files: [file] })) {
                            await navigator.share({
                              files: [file],
                              title: 'Shared Template',
                              text: resolvedMsg
                            });
                            return; // User completed share via native sheet
                          }
                        } catch (e) {
                          console.warn("Native share failed", e);
                        }
                      }

                      // Fallback for Desktop: Copy image to clipboard, then open WhatsApp Web
                      try {
                        const copyImageToClipboard = (url) => new Promise((resolve, reject) => {
                          const img = new Image();
                          img.crossOrigin = "anonymous";
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(img, 0, 0);
                            canvas.toBlob(async (blob) => {
                              if (!blob) return reject("Canvas toBlob failed");
                              try {
                                const item = new window.ClipboardItem({ "image/png": blob });
                                await navigator.clipboard.write([item]);
                                resolve(true);
                              } catch (err) {
                                reject(err);
                              }
                            }, "image/png");
                          };
                          img.onerror = reject;
                          img.src = url;
                        });

                        await copyImageToClipboard(imageUrl);
                        showToast('Image copied! Paste (Ctrl+V) it in WhatsApp Web to attach it.', 'success');
                      } catch (copyErr) {
                        console.warn("Clipboard copy failed", copyErr);
                      }
                      openWhatsappWeb();
                    } else {
                      openWhatsappWeb();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-xs transition-all shadow-sm"
                >
                  <i className="ph-bold ph-whatsapp-logo text-sm"></i> Send WhatsApp
                </button>
              )}
            </div>
          </FormField>

          <SectionHeader title="Image Upload" icon="ph-image" />
          <FormField label="Image" isFullWidth>
            <div className="flex items-center gap-4">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full px-4 py-2 rounded-md border border-gray-200 outline-none file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer text-[14px]"
              />
              {formData.image && (
                <div className="flex-shrink-0 relative">
                  <img src={formData.image} alt="Preview" className="h-16 rounded border" />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, image: '' }));
                      if (imageInputRef.current) imageInputRef.current.value = '';
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </FormField>

        </div>

        <div className="flex flex-col sm:flex-row justify-start items-center gap-4 mt-12 mb-4">
          <button
            type="submit"
            disabled={!formReady}
            className="w-full sm:w-auto px-10 py-2.5 rounded-md bg-[#00b5e2] hover:bg-[#00a0c9] text-white text-[15px] font-medium shadow-md transition-all disabled:opacity-60 text-center min-w-[160px]"
          >
            Register
          </button>
          <button
            type="button"
            onClick={resetMainForm}
            className="w-full sm:w-auto px-10 py-2.5 rounded-md border border-[#00b5e2] text-[#00b5e2] hover:bg-[#00b5e2]/5 text-[15px] font-medium transition-all bg-white text-center min-w-[160px]"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Mascot Illustration */}
      <div className="absolute bottom-0 right-0 z-0 pointer-events-none hidden lg:block">
        <img src={muscutImage} alt="Mascot" className="w-[380px] object-contain" />
      </div>

    </div>

      {/* OCR SCANNING MODAL */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl overflow-hidden my-8 animate-in zoom-in-95 duration-300 flex flex-col max-h-[95vh]">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-crm-primary to-crm-primaryDark px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <i className="ph ph-scan text-2xl animate-pulse"></i>
                <h3 className="text-lg font-semibold tracking-wide"> Visiting Card Scanner</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowScanModal(false); resetScanModalState(); }}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition-colors text-lg"
              >
                <i className="ph-bold ph-x"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Option Tabs (Only show when no image has been selected or snapped yet) */}
              {!capturedImage && (
                <div className="flex border-b border-gray-200 mb-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setModalTab('upload'); stopCamera(); }}
                    className={`flex-1 py-3 text-center font-semibold text-sm transition-all border-b-2 flex justify-center items-center gap-2 ${modalTab === 'upload'
                      ? 'border-crm-primary text-crm-primary bg-crm-primaryLighter/20'
                      : 'border-transparent text-gray-500 hover:text-crm-primary hover:bg-gray-50'
                      }`}
                  >
                    📁 Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModalTab('camera'); startCamera(); }}
                    className={`flex-1 py-3 text-center font-semibold text-sm transition-all border-b-2 flex justify-center items-center gap-2 ${modalTab === 'camera'
                      ? 'border-crm-primary text-crm-primary bg-crm-primaryLighter/20'
                      : 'border-transparent text-gray-500 hover:text-crm-primary hover:bg-gray-50'
                      }`}
                  >
                    📷 Use Camera
                  </button>
                </div>
              )}

              {/* Upload Tab Section (Only show when no image has been uploaded yet) */}
              {!capturedImage && modalTab === 'upload' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setSelectedFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setCapturedImage(reader.result);
                          setParsedData({
                            companyName: '',
                            customerName: '',
                            designation: '',
                            phone1: '',
                            phone2: '',
                            email: '',
                            website: '',
                            location: '',
                            city: ''
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragOver ? 'border-crm-primary bg-crm-primaryLighter/30 scale-98' : 'border-gray-300 hover:border-crm-primary bg-gray-50'
                      }`}
                  >
                    <div className="text-5xl mb-3 text-gray-400">📄</div>
                    <p className="font-semibold text-gray-700 text-sm">Drag & drop your visiting card image here</p>
                    <span className="text-xs text-gray-400 my-2">or</span>
                    <label className="px-5 py-2 bg-crm-primaryLighter hover:bg-crm-primary/20 text-crm-primary rounded-xl text-xs font-semibold transition-all cursor-pointer">
                      Browse Files
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadScan} />
                    </label>
                  </div>
                </div>
              )}

              {/* Camera Tab Section (Only show when no photo has been snapped yet) */}
              {!capturedImage && modalTab === 'camera' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="relative border-2 border-gray-300 rounded-xl overflow-hidden bg-black flex justify-center items-center shadow-inner h-[40vh] md:h-[55vh]">
                    {cameraActive && (
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                    )}
                  </div>

                  <div className="flex justify-center gap-3">
                    {cameraActive && (
                      <>
                        <button
                          type="button"
                          onClick={switchCamera}
                          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-crm-primary rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5"
                        >
                          🔄 Switch Camera
                        </button>
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                        >
                          📸 Snap Card
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isProcessingOcr && (
                <div className="flex flex-col items-center justify-center py-6 space-y-3 bg-crm-primaryLighter/10 rounded-2xl border border-crm-primary/10">
                  <div className="relative h-12 w-12 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-crm-primary/20 border-t-crm-primary rounded-full animate-spin"></div>
                    <i className="ph ph-read-cv-logo text-xl text-crm-primary animate-pulse"></i>
                  </div>
                  <h4 className="font-semibold text-crm-primary text-xs tracking-wider uppercase">Reading Card Details...</h4>
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 overflow-hidden border">
                    <div className="bg-crm-primary h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 tracking-wider">Scanning Image... {ocrProgress}%</span>
                </div>
              )}

              {/* Centered clean preview & action area when image is captured/uploaded */}
              {capturedImage && !isProcessingOcr && (
                <div className="space-y-6 max-w-2xl mx-auto animate-in zoom-in-95 duration-200">

                  {/* Single Clean Card Preview (no duplicate images) */}
                  <div className="border rounded-xl p-4 bg-gray-50 flex items-center justify-center min-h-[220px] relative overflow-auto custom-scrollbar">
                    {parsedData ? (
                      <img
                        src={finalCroppedImageUrl || capturedImage}
                        alt="Scanned Card"
                        className="max-h-[45vh] md:max-h-[55vh] object-contain rounded shadow-sm border mx-auto block"
                      />
                    ) : (
                      <ReactCrop
                        crop={crop}
                        onChange={c => setCrop(c)}
                        onComplete={c => setCompletedCrop(c)}
                        className="max-h-[45vh] md:max-h-[55vh]"
                      >
                        <img
                          ref={imgRef}
                          src={capturedImage}
                          alt="Visiting Card Preview"
                          className="max-h-[45vh] md:max-h-[55vh] object-contain rounded shadow-sm border mx-auto block"
                          onLoad={e => {
                            const initialCrop = {
                              unit: '%',
                              width: 90,
                              height: 90,
                              x: 5,
                              y: 5
                            };
                            setCrop(initialCrop);
                          }}
                        />
                      </ReactCrop>
                    )}
                    {!parsedData && (
                      <button
                        type="button"
                        onClick={removeFile}
                        className="absolute top-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-md transition-all text-xs font-bold"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* Scan trigger button */}
                  {!parsedData && (
                    <button
                      type="button"
                      onClick={processCard}
                      className="w-full py-3 bg-gradient-to-r from-crm-primary to-crm-primaryDark hover:from-crm-primaryDark hover:to-crm-primary text-white rounded-xl font-semibold text-xs shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-1.5 uppercase tracking-wider"
                    >
                      🔍 Read Card
                    </button>
                  )}

                  {/* Read-only extracted details summary (no editable form fields in popup) */}
                  {parsedData && (
                    <div className="bg-crm-primaryLighter/10 p-5 rounded-2xl border border-crm-primary/10 space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 border-b border-crm-primary/10 pb-2.5">
                        <i className="ph-fill ph-check-circle text-2xl text-emerald-500"></i>
                        <h4 className="text-xs font-semibold text-crm-primary uppercase tracking-wider">
                          Extracted Information Successfully Captured
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-gray-700">
                        {parsedData.customerName && (
                          <div className="bg-white p-3 rounded-lg border">
                            <span className="text-[10px] text-gray-400 block uppercase mb-1">👤 Full Name</span>
                            {parsedData.customerName}
                          </div>
                        )}
                        {parsedData.designation && (
                          <div className="bg-white p-3 rounded-lg border">
                            <span className="text-[10px] text-gray-400 block uppercase mb-1">💼 Job Title</span>
                            {parsedData.designation}
                          </div>
                        )}
                        {parsedData.companyName && (
                          <div className="bg-white p-3 rounded-lg border">
                            <span className="text-[10px] text-gray-400 block uppercase mb-1">🏢 Company</span>
                            {parsedData.companyName}
                          </div>
                        )}
                        {parsedData.phone1 && (
                          <div className="bg-white p-3 rounded-lg border">
                            <span className="text-[10px] text-gray-400 block uppercase mb-1">📱 Phone</span>
                            {parsedData.phone1}
                          </div>
                        )}
                        {parsedData.email && (
                          <div className="bg-white p-3 rounded-lg border col-span-1">
                            <span className="text-[10px] text-gray-400 block uppercase mb-1">📧 Email</span>
                            {parsedData.email}
                          </div>
                        )}
                        {parsedData.website && (
                          <div className="bg-white p-3 rounded-lg border">
                            <span className="text-[10px] text-gray-400 block uppercase mb-1">🌐 Website</span>
                            {parsedData.website}
                          </div>
                        )}
                        {parsedData.location && (
                          <div className="bg-white p-3 rounded-lg border md:col-span-2">
                            <span className="text-[10px] text-gray-400 block uppercase mb-1">📍 Address</span>
                            {parsedData.location}
                          </div>
                        )}
                      </div>

                      {/* Clean primary controls */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          type="button"
                          onClick={resetScanModalState}
                          className="w-full sm:w-1/3 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl font-semibold text-xs transition-colors uppercase tracking-wider"
                        >
                          🔄 Retry
                        </button>
                        <button
                          type="button"
                          onClick={applyParsedData}
                          className="w-full sm:flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 uppercase tracking-wider"
                        >
                          <i className="ph-bold ph-check"></i> Fill Form Automatically
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => { setShowScanModal(false); resetScanModalState(); }}
                className="px-5 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Hidden canvas for capturing photo frames */}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </>
  );
};

export default RegistrationForm;
