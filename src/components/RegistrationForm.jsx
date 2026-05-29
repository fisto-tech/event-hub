import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchApi } from '../utils/api';
import {
  loadRegistrationBootstrap,
  appendLookupToCache,
  getCachedRegistrationData,
} from '../utils/registrationDataCache';
import { showToast } from '../utils/toast';
import CityAutocomplete from './common/CityAutocomplete';
import PhoneInput from './common/PhoneInput';
import { validateStoredPhone, normalizePhoneForSubmit } from '../utils/phoneUtils';

const DEFAULT_WHATSAPP_MESSAGE =
  'Hello {customer_name}, Thank you for visiting us at our stall! We appreciate your interest in our products. Our team will contact you shortly to discuss further.';

const FormField = ({ label, children, isFullWidth, required }) => {
  const labelText = String(label).replace(/\s*\*+\s*$/, '').trim();
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start ${
        isFullWidth ? 'col-span-1 md:col-span-2' : ''
      }`}
    >
      <label className="w-full sm:w-1/3 text-left sm:text-right sm:pr-4 text-sm text-gray-600 sm:pt-2 font-medium mb-1.5 sm:mb-0">
        {labelText}
        {required && <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <div className="w-full sm:w-2/3">{children}</div>
    </div>
  );
};

const validateRegistration = (payload, { customEnquiry, customIndustry, showSourceField }) => {
  const missing = [];

  if (!String(payload.visitDate || '').trim()) missing.push('Visit Date');
  if (!String(payload.companyName || '').trim()) missing.push('Company Name');
  if (!String(payload.customerName || '').trim()) missing.push('Customer Name');
  const phone1Err = validateStoredPhone(payload.phone1, { required: true });
  if (phone1Err) missing.push(phone1Err === 'Phone number is required' ? 'Phone / WhatsApp' : phone1Err);

  if (String(payload.phone2 || '').trim()) {
    const phone2Err = validateStoredPhone(payload.phone2, { required: true });
    if (phone2Err) missing.push(`Secondary phone: ${phone2Err}`);
  }

  const enquiry = payload.enquiryType === OTHER_VALUE
    ? customEnquiry
    : payload.enquiryType;
  if (!String(enquiry || '').trim()) missing.push('Enquiry Type');

  if (payload.industryType === OTHER_VALUE && !String(customIndustry || '').trim()) {
    missing.push('Industry Type (custom value)');
  }

  return missing;
};

const SectionHeader = ({ title }) => (
  <div className="col-span-1 md:col-span-2 mt-4 mb-2">
    <h3 className="text-lg font-medium text-gray-800 border-b border-gray-200 pb-2">{title}</h3>
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
    expoId: localStorage.getItem('defaultExpo') || '',
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
    enquiryType: 'IDC',
    referenceSource: '',
    reference: '',
    priority: 'medium',
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
  const [isDragOver, setIsDragOver] = useState(false);

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
        setExpos(data.expos);
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

  const resolvedWhatsappMessage = useMemo(() => {
    if (whatsappTemplates.length === 0) return DEFAULT_WHATSAPP_MESSAGE;

    let selectedExpoName = '';
    if (formData.expoId) {
      const selectedExpo = expos.find((e) => String(e.id) === String(formData.expoId));
      if (selectedExpo) selectedExpoName = selectedExpo.expo_name;
    }

    let matchedTemplate = null;
    if (selectedExpoName) {
      matchedTemplate = whatsappTemplates.find(
        (t) =>
          t.expo_name &&
          t.expo_name.toLowerCase().trim() === selectedExpoName.toLowerCase().trim()
      );
    }
    if (!matchedTemplate) {
      matchedTemplate = whatsappTemplates.find((t) => !t.expo_name);
    }

    return matchedTemplate?.message_content || DEFAULT_WHATSAPP_MESSAGE;
  }, [formData.expoId, expos, whatsappTemplates]);

  // Sync WhatsApp template when expo changes — skip if user already edited the message
  const whatsappUserEditedRef = useRef(false);

  useEffect(() => {
    if (whatsappUserEditedRef.current) return;
    setFormData((prev) =>
      prev.whatsappMessage === resolvedWhatsappMessage
        ? prev
        : { ...prev, whatsappMessage: resolvedWhatsappMessage }
    );
  }, [resolvedWhatsappMessage]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'whatsappMessage') {
      whatsappUserEditedRef.current = true;
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
      image: payload.image && payload.image.length > 6_000_000 ? '' : payload.image,
    };

    try {
      const result = await fetchApi('customers.php', {
        method: 'POST',
        body: JSON.stringify(submitPayload),
      });
      if (result.status === 'success') {
        showToast('Customer saved successfully!');
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
        const snap = getCachedRegistrationData();
        if (snap?.lookups) setLookups(snap.lookups);
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
      expoId: localStorage.getItem('defaultExpo') || '',
      companyName: '', industryType: '', website: '', location: '', city: '',
      customerName: '', designation: '', phone1: '', phone2: '', email: '',
      enquiryType: 'IDC',
      referenceSource: '', reference: '', nextFollowUpDate: '', remarks: '', priority: 'medium', image: ''
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
    setCapturedImage('');
    setCapturedBlob(null);
  };

  // Convert the current captured/uploaded image to a File and send to OCR backend
  const processCard = async () => {
    if (!capturedImage) return;

    try {
      // If we have a selectedFile (from upload), use it directly
      if (selectedFile) {
        runOcr(selectedFile);
        return;
      }

      // If captured from camera (blob URL or data URL), convert to File
      if (capturedBlob) {
        const file = new File([capturedBlob], 'captured_card.jpg', { type: 'image/jpeg' });
        runOcr(file);
        return;
      }

      // If it's a data URL (from FileReader), convert to blob then File
      if (capturedImage.startsWith('data:')) {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], 'card_image.jpg', { type: blob.type || 'image/jpeg' });
        runOcr(file);
        return;
      }

      // Fallback: try fetch the URL and convert
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'card_image.jpg', { type: blob.type || 'image/jpeg' });
      runOcr(file);
    } catch (e) {
      console.error('Failed to prepare image for OCR:', e);
      alert('Could not process the image. Please try uploading again.');
    }
  };

  const applyParsedData = () => {
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
        image: capturedImage || prev.image
      }));
      setShowScanModal(false);
      resetScanModalState();
      alert('Data filled automatically!');
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
    <div className="space-y-6 pb-20 relative bg-white rounded-xl p-6">

      {/* Top Bar matching Zoho Header style */}
      <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-medium text-gray-800">Create Customer Record</h2>
        </div>
        <button
          type="button"
          onClick={() => { setShowScanModal(true); resetScanModalState(); }}
          className="scan-card-btn flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <i className="ph-bold ph-scan text-base"></i>
          Scan Card
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-0 w-full max-w-5xl mx-auto">
        {!formReady && (
          <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
            <i className="ph ph-spinner animate-spin" /> Loading form options…
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">

          <SectionHeader title="Company Information" />

          <FormField label="Expo Name">
            <select name="expoId" value={formData.expoId} onChange={handleChange} className="w-full px-3 py-1.5 crm-input">
              <option value="">Other (General)</option>
              {expos.map(expo => (
                <option key={expo.id} value={expo.id}>{expo.expo_name}</option>
              ))}
            </select>
          </FormField>

          {showSourceField && (
            <FormField label="Source Name">
              <input
                type="text"
                name="referenceSource"
                value={formData.referenceSource}
                onChange={handleChange}
                placeholder="Enter source name..."
                className="w-full px-3 py-1.5 crm-input"
              />
            </FormField>
          )}

          <FormField label="Visit Date" required>
            <input type="date" name="visitDate" value={formData.visitDate} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>

          <FormField label="Company Name" required>
            <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>

          <FormField label="Industry Type">
            <select
              name="industryType"
              value={formData.industryType}
              onChange={handleChange}
              className="w-full px-3 py-1.5 crm-input"
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
                className="w-full px-3 py-1.5 crm-input mt-2"
              />
            )}
          </FormField>

          <FormField label="Website">
            <input type="text" name="website" value={formData.website} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>

          <FormField label="City">
            <CityAutocomplete
              name="city"
              value={formData.city}
              onChange={(city) => setFormData((prev) => ({ ...prev, city }))}
              placeholder="Type to search city…"
              inputClassName="w-full px-3 py-1.5 crm-input"
            />
          </FormField>

          <FormField label="Address / Location">
            <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>


          <SectionHeader title="Contact Details" />

          <FormField label="Customer Name" required>
            <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>

          <FormField label="Designation">
            <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>

          <FormField label="Email Address">
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>

          <FormField label="Phone / WhatsApp" required>
            <PhoneInput
              name="phone1"
              value={formData.phone1}
              onChange={(phone1) => setFormData((prev) => ({ ...prev, phone1 }))}
              required
              inputClassName="flex-1 px-3 py-1.5 crm-input"
              selectClassName="w-[2.5rem] shrink-0 px-2 py-1.5 crm-input text-sm"
            />
          </FormField>

          <FormField label="Secondary Phone">
            <PhoneInput
              name="phone2"
              value={formData.phone2}
              onChange={(phone2) => setFormData((prev) => ({ ...prev, phone2 }))}
              required={false}
              inputClassName="flex-1 px-3 py-1.5 crm-input"
              selectClassName="w-[3rem] shrink-0 px-2 py-1.5 crm-input text-sm"
            />
          </FormField>


          <SectionHeader title="Enquiry & Follow-up Details" />

          <FormField label="Enquiry Type" required>
            <select name="enquiryType" value={formData.enquiryType} onChange={handleChange} className="w-full px-3 py-1.5 crm-input">
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
                className="w-full px-3 py-1.5 crm-input mt-2"
              />
            )}
          </FormField>

          <FormField label="Priority Level" required>
            <select name="priority" value={formData.priority} onChange={handleChange} className="w-full px-3 py-1.5 crm-input">
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </FormField>

          <FormField label="Next Follow-up" required>
            <input type="date" name="nextFollowUpDate" value={formData.nextFollowUpDate} onChange={handleChange} className="w-full px-3 py-1.5 crm-input" />
          </FormField>

          <FormField label="Reference">
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder="e.g. Employee Name, Friend, etc."
              className="w-full px-3 py-1.5 crm-input"
            />
          </FormField>



          <FormField label="Remarks" isFullWidth>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 crm-input"></textarea>
          </FormField>

          <FormField label="WhatsApp Template" isFullWidth>
            <div className="space-y-2">
              <textarea name="whatsappMessage" value={formData.whatsappMessage} onChange={handleChange} rows="3" className="w-full px-3 py-1.5 crm-input"></textarea>
              {formData.phone1 && (
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = formData.phone1.replace(/[^0-9]/g, '');
                    let selectedExpoName = expos.find(e => String(e.id) === String(formData.expoId))?.expo_name || '';
                    const resolvedMsg = formData.whatsappMessage.replace(/{customer_name}/g, formData.customerName || 'Customer').replace(/{company_name}/g, formData.companyName || 'your company').replace(/{expo_name}/g, selectedExpoName || 'our expo');
                    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(resolvedMsg)}`, '_blank');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs transition-all"
                >
                  <i className="ph-bold ph-whatsapp-logo text-sm"></i> Send WhatsApp
                </button>
              )}
            </div>
          </FormField>

          <SectionHeader title="Image Upload" />
          <FormField label="Visit Card Image" isFullWidth>
            <div className="flex items-center gap-4">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full px-3 py-1.5 border border-gray-300 outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer text-sm"
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

        <div className="flex justify-end items-center gap-3 mt-8 pt-6  border-gray-200">
          <button
            type="button"
            onClick={resetMainForm}
            className="px-5 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formReady}
            className="px-6 py-2 bg-crm-primary text-white rounded font-medium shadow-sm hover:bg-crm-primaryDark transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </form>

      {/* OCR SCANNING MODAL */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl overflow-hidden my-8 animate-in zoom-in-95 duration-300 flex flex-col max-h-[95vh]">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-crm-primary to-crm-primaryDark px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <i className="ph ph-scan text-2xl animate-pulse"></i>
                <h3 className="text-lg font-semibold tracking-wide">📇 Visiting Card Scanner</h3>
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
                  <div className="relative border-2 border-gray-300 rounded-xl overflow-hidden bg-black aspect-video flex justify-center items-center shadow-inner max-h-80">
                    {cameraActive && (
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                    )}
                    {cameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                        <div className="border-2 border-dashed border-emerald-400 w-full max-w-xs aspect-[1.58] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center relative">
                          <span className="text-emerald-400 bg-black/60 px-3 py-1 rounded text-[10px] font-semibold uppercase tracking-wider absolute -top-8">Align Business Card Inside Box</span>
                        </div>
                      </div>
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

              {/* Progress and status message */}
              {isProcessingOcr && (
                <div className="flex flex-col items-center justify-center py-6 space-y-3 bg-crm-primaryLighter/10 rounded-2xl border border-crm-primary/10">
                  <div className="relative h-12 w-12 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-crm-primary/20 border-t-crm-primary rounded-full animate-spin"></div>
                    <i className="ph ph-read-cv-logo text-xl text-crm-primary animate-pulse"></i>
                  </div>
                  <h4 className="font-semibold text-crm-primary text-xs tracking-wider uppercase">Processing image & extracting text...</h4>
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 overflow-hidden border">
                    <div className="bg-crm-primary h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 tracking-wider">Extracting Details... {ocrProgress}%</span>
                </div>
              )}

              {/* Centered clean preview & action area when image is captured/uploaded */}
              {capturedImage && !isProcessingOcr && (
                <div className="space-y-6 max-w-2xl mx-auto animate-in zoom-in-95 duration-200">

                  {/* Single Clean Card Preview (no duplicate images) */}
                  <div className="border rounded-xl p-4 bg-gray-50 flex items-center justify-center min-h-[220px] max-h-72 relative">
                    <img src={capturedImage} alt="Visiting Card Preview" className="max-h-64 object-contain rounded shadow-sm border" />
                    {!parsedData && (
                      <button
                        type="button"
                        onClick={removeFile}
                        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-md transition-all text-xs font-bold"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* OCR trigger button */}
                  {!parsedData && (
                    <button
                      type="button"
                      onClick={processCard}
                      className="w-full py-3 bg-gradient-to-r from-crm-primary to-crm-primaryDark hover:from-crm-primaryDark hover:to-crm-primary text-white rounded-xl font-semibold text-xs shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-1.5 uppercase tracking-wider"
                    >
                      🔍 Scan Business Card
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
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={resetScanModalState}
                          className="w-1/3 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl font-semibold text-xs transition-colors uppercase tracking-wider"
                        >
                          🔄 Retry
                        </button>
                        <button
                          type="button"
                          onClick={applyParsedData}
                          className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 uppercase tracking-wider"
                        >
                          <i className="ph-bold ph-check"></i> Done (Auto-Filled!)
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
    </div>
  );
};

export default RegistrationForm;
