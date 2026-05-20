import React, { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../utils/api';

// OCR Backend Server URL (runs on port 4000)
const OCR_SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000'
  : 'https://www.fist-o.com/ocr-server';

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
    priority: 'medium',
    nextFollowUpDate: '',
    remarks: '',
    image: '',
    whatsappMessage: 'Hello {customer_name}, Thank you for visiting us at our stall! We appreciate your interest in our products. Our team will contact you shortly to discuss further.'
  });

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

  // Camera stream mounting hook to prevent race-conditions of blank video elements
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive, modalTab, capturedImage]);

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

    const loadTemplates = async () => {
      try {
        const result = await fetchApi('whatsapp_templates.php');
        if (result.status === 'success') {
          setWhatsappTemplates(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch templates', error);
      }
    };

    loadExpos();
    loadTemplates();
  }, []);

  // Dynamically update template based on chosen Expo
  useEffect(() => {
    if (whatsappTemplates.length === 0) return;

    let selectedExpoName = '';
    if (formData.expoId === 'other') {
      selectedExpoName = formData.manualExpoName;
    } else if (formData.expoId) {
      const selectedExpo = expos.find(e => String(e.id) === String(formData.expoId));
      if (selectedExpo) {
        selectedExpoName = selectedExpo.expo_name;
      }
    }

    // 1. Search for matching template by expo name
    let matchedTemplate = null;
    if (selectedExpoName) {
      matchedTemplate = whatsappTemplates.find(t => 
        t.expo_name && t.expo_name.toLowerCase().trim() === selectedExpoName.toLowerCase().trim()
      );
    }

    // 2. If no matched template, find a default/common template (empty or no expo name set)
    if (!matchedTemplate) {
      matchedTemplate = whatsappTemplates.find(t => !t.expo_name);
    }

    // 3. Set message content
    if (matchedTemplate) {
      setFormData(prev => ({ ...prev, whatsappMessage: matchedTemplate.message_content }));
    } else {
      setFormData(prev => ({
        ...prev,
        whatsappMessage: 'Hello {customer_name}, Thank you for visiting us at our stall! We appreciate your interest in our products. Our team will contact you shortly to discuss further.'
      }));
    }
  }, [formData.expoId, formData.manualExpoName, expos, whatsappTemplates]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await fetchApi('customers.php', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (result.status === 'success') {
        alert('Customer Saved Successfully!');
        resetMainForm();
      } else {
        alert(result.message || 'Error saving customer');
      }
    } catch (error) {
      console.error('Error submitting form', error);
      alert('Failed to connect to the server.');
    }
  };

  const resetMainForm = () => {
    setFormData(prev => ({
      ...prev,
      companyName: '', industryType: '', website: '', location: '', city: '',
      customerName: '', designation: '', phone1: '', phone2: '', email: '',
      referenceSource: '', nextFollowUpDate: '', remarks: '', priority: 'medium', image: ''
    }));
  };

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

  const SectionHeader = ({ title, icon }) => (
    <div className="bg-crm-primaryLighter border-b border-crm-primary/10 px-6 py-4 flex items-center gap-2">
      <i className={`ph-fill ${icon} text-crm-primary text-2xl`}></i>
      <h3 className="text-lg font-semibold text-crm-primary tracking-tight">{title}</h3>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Dynamic Upper Tool Bar with Scanning CTA */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex-wrap gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Fast Input Assistant</h4>
          <p className="text-xs text-gray-400 font-medium">Use our intelligent OCR engine to capture cards or type manually below.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setShowScanModal(true); resetScanModalState(); }}
            className="flex items-center gap-2 bg-gradient-to-r from-crm-primary to-crm-primaryDark hover:from-crm-primaryDark hover:to-crm-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <i className="ph-bold ph-scan text-lg"></i>
            Scan Visiting Card
          </button>
          {formData.image && (
            <button
              type="button"
              onClick={resetMainForm}
              className="flex items-center gap-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
            >
              <i className="ph-bold ph-trash"></i>
              Reset Form Data
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SECTION 1: Company Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <SectionHeader title="1. Company Details" icon="ph-buildings" />
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Expo Name</label>
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
                <label className="block text-sm font-normal text-crm-primary">Manual Expo Name</label>
                <input type="text" name="manualExpoName" value={formData.manualExpoName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Enter Expo Name" />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Visit Date *</label>
              <input type="date" name="visitDate" required value={formData.visitDate} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Company Name *</label>
              <input type="text" name="companyName" required value={formData.companyName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Acme Corp" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Industry Type</label>
              <input type="text" name="industryType" value={formData.industryType} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="E.g. Manufacturing" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Website</label>
              <input type="text" name="website" value={formData.website} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="https://example.com" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">City</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="City" />
            </div>

            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-normal text-crm-primary">Full Address / Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Street address, building, etc." />
            </div>
          </div>
        </div>

        {/* SECTION 2: Customer Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <SectionHeader title="2. Point of Contact Details" icon="ph-user-circle" />
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Customer Name *</label>
              <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Full Name" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Designation</label>
              <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Director, Manager, etc." />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="email@company.com" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Primary Phone / WhatsApp *</label>
              <div className="flex">
                <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-600">
                  <i className="ph-fill ph-whatsapp-logo text-gray-600 text-xl"></i>
                </span>
                <input type="tel" name="phone1" required value={formData.phone1} onChange={handleChange} className="flex-1 w-full px-4 py-3 rounded-r-lg outline-none crm-input" placeholder="+1234567890" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Secondary Phone</label>
              <input type="tel" name="phone2" value={formData.phone2} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Alternate Number" />
            </div>
          </div>
        </div>

        {/* SECTION 3: Enquiry Details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <SectionHeader title="3. Enquiry & Follow-up Details" icon="ph-target" />
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Enquiry Type</label>
              <select name="enquiryType" value={formData.enquiryType} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none font-medium crm-input">
                <option value="Hot Lead">🔥 Hot Lead (Immediate Need)</option>
                <option value="Warm Lead">⭐ Warm Lead (Interested)</option>
                <option value="Cold Lead">Cold Lead (Just Browsing)</option>
                <option value="Partner">🤝 Partnership/Vendor</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Priority Level</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none font-medium crm-input">
                <option value="high">🔴 High Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="low">🟢 Low Priority</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Next Follow-up Date</label>
              <input type="date" name="nextFollowUpDate" value={formData.nextFollowUpDate} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-normal text-crm-primary">Reference Source</label>
              <input type="text" name="referenceSource" value={formData.referenceSource} onChange={handleChange} className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="How did they find us?" />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-normal text-crm-primary">Remarks / Requirements</label>
              <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="3" className="w-full px-4 py-3 rounded-lg outline-none crm-input" placeholder="Enter detailed customer requirements..."></textarea>
            </div>

            {/* WhatsApp Message Box */}
            <div className="space-y-2 md:col-span-2 bg-gray-50 p-5 rounded-xl border border-gray-200 mt-2">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <i className="ph-fill ph-whatsapp-logo text-crm-primary text-2xl"></i>
                  <h4 className="font-semibold text-crm-primary">WhatsApp Instant Message Template</h4>
                </div>
                {formData.phone1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanPhone = formData.phone1.replace(/[^0-9]/g, '');
                      
                      // Find selected Expo Name
                      let selectedExpoName = '';
                      if (formData.expoId === 'other') {
                        selectedExpoName = formData.manualExpoName;
                      } else if (formData.expoId) {
                        const selectedExpo = expos.find(e => String(e.id) === String(formData.expoId));
                        if (selectedExpo) {
                          selectedExpoName = selectedExpo.expo_name;
                        }
                      }

                      const resolvedMsg = formData.whatsappMessage
                        .replace(/{customer_name}/g, formData.customerName || 'Customer')
                        .replace(/{company_name}/g, formData.companyName || 'your company')
                        .replace(/{expo_name}/g, selectedExpoName || 'our expo');

                      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(resolvedMsg)}`, '_blank');
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <i className="ph-bold ph-whatsapp-logo text-base"></i>
                    Send WhatsApp Message
                  </button>
                )}
              </div>
              <textarea name="whatsappMessage" value={formData.whatsappMessage} onChange={handleChange} rows="3" className="w-full px-4 py-3 rounded-lg outline-none font-medium crm-input"></textarea>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This message is auto-selected from Master Templates.</p>
            </div>
          </div>
        </div>

        {/* SECTION 4: Upload Image / Visit Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <SectionHeader title="4. Visit Card / Image Upload" icon="ph-image" />
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-crm-primary">Select Photo / Snapped Image</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange} 
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-crm-primaryLighter file:text-crm-primary hover:file:bg-crm-primary/20 transition-all cursor-pointer" 
              />
              <p className="text-xs text-gray-500 font-medium">Capture visiting card directly using your device camera or upload an image file.</p>
            </div>

            <div className="flex justify-center border-2 border-dashed border-gray-200 rounded-xl p-4 h-48 bg-gray-50 relative overflow-hidden">
              {formData.image ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 animate-in zoom-in-95 duration-200">
                  <img src={formData.image} alt="Visiting Card Preview" className="max-h-36 object-contain rounded border border-gray-200" />
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all text-xs font-semibold px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <i className="ph ph-image text-5xl mb-2 text-gray-300"></i>
                  <span className="text-xs font-semibold uppercase tracking-wider">No Image Selected</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button type="button" onClick={resetMainForm} className="px-6 py-3 text-crm-primary font-semibold hover:bg-crm-primaryLighter rounded-lg transition-colors uppercase tracking-wider text-sm">Cancel</button>
          <button type="submit" className="btn-running-border text-white px-8 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 uppercase tracking-wider text-sm">
            <i className="ph-bold ph-floppy-disk text-lg"></i> Save Registration
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
                    className={`flex-1 py-3 text-center font-semibold text-sm transition-all border-b-2 flex justify-center items-center gap-2 ${
                      modalTab === 'upload' 
                        ? 'border-crm-primary text-crm-primary bg-crm-primaryLighter/20' 
                        : 'border-transparent text-gray-500 hover:text-crm-primary hover:bg-gray-50'
                    }`}
                  >
                    📁 Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModalTab('camera'); startCamera(); }}
                    className={`flex-1 py-3 text-center font-semibold text-sm transition-all border-b-2 flex justify-center items-center gap-2 ${
                      modalTab === 'camera' 
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
                    className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDragOver ? 'border-crm-primary bg-crm-primaryLighter/30 scale-98' : 'border-gray-300 hover:border-crm-primary bg-gray-50'
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
