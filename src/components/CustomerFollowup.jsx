import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchApi } from '../utils/api';
import LoadingSpinner from './common/LoadingSpinner';
import ReportModalShell, { EditField, reportInputClass } from './common/ReportModalShell';
import { showToast } from '../utils/toast';
import PhoneInput from './common/PhoneInput';
import { normalizePhoneForSubmit, validateStoredPhone } from '../utils/phoneUtils';
import { formatDateTime } from '../utils/dateUtils';

const REASON_TABS = [
  { label: 'Followup', value: 'first followup' },
  { label: 'Appointment', value: 'appointment' },
  { label: 'Project Onboard', value: 'project onboard' },
  { label: 'Dropped', value: 'dropped' },
];

const STATUS_OPTIONS = [
  { label: 'Inprogress', value: 'inprogress' },
  { label: 'Not Interested', value: 'not interested' },
  { label: 'Not Picking / Busy / Others', value: 'not picking' },
  { label: 'Confirmed', value: 'confirmed' },
];

const REASON_OPTIONS = ['None', 'followup', 'droped', 'lead', 'demo shared', 'appointment', 'quotation', 'proposal', 'project onboard'];

const todayISO = () => new Date().toISOString().slice(0, 10);

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const VoiceNoteControl = ({ value, onChange }) => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timer, setTimer] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (recording && !paused) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording, paused]);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const stopTracks = () => {
    try {
      const stream = mediaRecorderRef.current?.stream;
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {
      // ignore
    }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      setTimer(0);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
          const dataUrl = await toDataUrl(file);
          onChange?.(dataUrl);
        } catch (e) {
          console.error(e);
          showToast('Could not process voice note', 'error');
        } finally {
          stopTracks();
          setRecording(false);
          setPaused(false);
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      setPaused(false);
    } catch (e) {
      console.error(e);
      showToast('Microphone permission denied', 'error');
    }
  };

  const pause = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      setPaused(true);
    } else if (rec.state === 'paused') {
      rec.resume();
      setPaused(false);
    }
  };

  const stop = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording' || rec.state === 'paused') {
      rec.stop();
    }
  };

  const clear = () => {
    try {
      if (recording) stop();
    } finally {
      stopTracks();
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setRecording(false);
      setPaused(false);
      setTimer(0);
      onChange?.('');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={start}
          disabled={recording || !!value}
          className="h-10 w-10 rounded-lg bg-crm-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center"
          aria-label="Start recording"
          title="Start"
        >
          <i className="ph-bold ph-microphone text-lg" />
        </button>
        {recording && (
          <>
            <button
              type="button"
              onClick={pause}
              className="h-10 w-10 rounded-lg border border-gray-200 text-sm font-semibold flex items-center justify-center"
              aria-label={paused ? 'Resume recording' : 'Pause recording'}
              title={paused ? 'Resume' : 'Pause'}
            >
              <i className={`ph-bold ${paused ? 'ph-play' : 'ph-pause'} text-lg`} />
            </button>
            <button
              type="button"
              onClick={stop}
              className="h-10 w-10 rounded-lg bg-crm-primaryDark text-white text-sm font-semibold flex items-center justify-center"
              aria-label="Stop recording"
              title="Stop"
            >
              <i className="ph-bold ph-stop text-lg" />
            </button>
            <span className="text-sm font-semibold text-red-500 animate-pulse w-12 text-center">
              {formatTime(timer)}
            </span>
          </>
        )}
        {!!value && !recording && (
          <button
            type="button"
            onClick={clear}
            className="h-10 w-10 rounded-lg border border-crm-primary/20 text-crm-primary text-sm font-semibold hover:bg-crm-primaryLighter/60 flex items-center justify-center"
            aria-label="Delete voice note"
            title="Delete"
          >
            <i className="ph-bold ph-trash text-lg" />
          </button>
        )}
      </div>
      {value && !recording && (
        <audio controls controlsList="nodownload noplaybackrate" className="h-10 flex-1 min-w-[200px]">
          <source src={value} />
        </audio>
      )}
      {!value && !recording && (
        <p className="text-xs text-gray-500 w-full sm:w-auto mt-1 sm:mt-0">Click microphone to record voice note.</p>
      )}
    </div>
  );
};

const CustomContactSelect = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 rounded-lg crm-input bg-white text-left flex items-center justify-between"
      >
        <span className="truncate">{selected ? selected.displayName : 'Select Contact Person'}</span>
        <i className="ph-bold ph-caret-down text-gray-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[999] max-h-60 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${String(o.value) === String(value) ? 'bg-crm-primary/5 text-crm-primary font-bold' : 'text-gray-700'
                }`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.listName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const FollowupHistoryModal = ({ customer, history, onClose }) => (
  <ReportModalShell
    title={`History: ${customer?.company_name || ''}`}
    icon="ph-clock-counter-clockwise"
    onClose={onClose}
    maxWidth="max-w-4xl"
    footer={
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
      >
        Close
      </button>
    }
  >
    <div>
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <i className="ph-bold ph-clock-counter-clockwise text-3xl mb-2" />
          <p className="text-sm">No followup history found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history.map((h) => (
            <div key={h.id} className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              {/* ── Card Header ── */}
              <div className="bg-crm-primary px-5 py-4 flex items-center justify-between">
                <span className="text-white text-base font-bold capitalize flex items-center gap-2">
                  <i className="ph-fill ph-clock-counter-clockwise"></i>
                  {h.followup_status || h.status || 'Unknown'}
                </span>
                <span className="px-3 py-1 rounded bg-white/20 text-white text-xs font-bold tracking-wide">
                  {h.updated_at ? formatDateTime(h.updated_at) : (h.created_at ? formatDateTime(h.created_at) : formatDateTime(h.follow_up_date))}
                </span>
              </div>

              {/* ── Card Body ── */}
              <div className="bg-white px-6 py-5 flex flex-col gap-3">
                {h.followup_status === 'Allocated' ? (
                  <>
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">From Employee: </span>
                      <span className="font-medium text-gray-700">{h.notes?.match(/from\s+(.*?)\s+to/i)?.[1] || 'Unknown'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">To Employee: </span>
                      <span className="font-medium text-gray-700">{h.notes?.match(/to\s+(.*)$/i)?.[1] || 'Unknown'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">Contact Person: </span>
                      <span className="font-medium text-gray-700">{h.contact_person || '—'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">Contact No: </span>
                      <span className="font-medium text-gray-700">{h.contact_phone || '—'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">Next Follow-up: </span>
                      <span className="font-medium text-gray-700">{formatDateTime(h.follow_up_date) || '—'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">Reason: </span>
                      <span className="font-medium text-gray-700 capitalize">{h.followup_reason || '—'}</span>
                    </div>

                    {h.remarks && (
                      <div className="text-sm mt-1">
                        <span className="font-bold text-gray-900">Remarks: </span>
                        <span className="font-medium text-gray-700">{h.remarks}</span>
                      </div>
                    )}

                    {/* Voice note (if any) */}
                    {h.voice_note_base64 && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <audio controls controlsList="nodownload noplaybackrate" className="w-full h-10">
                          <source src={h.voice_note_base64} />
                        </audio>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </ReportModalShell>
);

const CustomerFollowup = ({ currentUser }) => {
  const userRole = currentUser?.role || 'employee';

  const [selectedDate, setSelectedDate] = useState('');
  const [activeReason, setActiveReason] = useState('first followup');
  const [loading, setLoading] = useState(true);
  const [tabData, setTabData] = useState({ 'first followup': [], 'appointment': [], 'project onboard': [], 'dropped': [] });

  const [historyModal, setHistoryModal] = useState(null); // { customer, rows }
  const [formModal, setFormModal] = useState(null); // { customer, card }

  const [expos, setExpos] = useState([]);
  const [sources, setSources] = useState([]);
  const [filterExpoSource, setFilterExpoSource] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [filterEmployee, setFilterEmployee] = useState('all');

  const loadExposAndSources = async () => {
    try {
      const exRes = await fetchApi('expos.php');
      if (exRes.status === 'success') setExpos(exRes.data || []);
      const lkRes = await fetchApi('master_data.php?type=source');
      if (lkRes.status === 'success') {
        setSources(lkRes.data || []);
      }
      if (['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase())) {
        const empRes = await fetchApi('users.php');
        if (empRes.status === 'success') setEmployees(empRes.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadExposAndSources();
  }, []);

  useEffect(() => {
    if (selectedDate && selectedDate > new Date().toISOString().split('T')[0]) {
      if (activeReason === 'project onboard' || activeReason === 'dropped') {
        setActiveReason('first followup');
      }
    }
  }, [selectedDate, activeReason]);

  const loadBoard = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const promises = REASON_TABS.map(t => {
        let url = `follow_ups.php?action=board&date=${selectedDate || 'all'}&reason=${encodeURIComponent(t.value)}&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`;
        return fetchApi(url);
      });

      const results = await Promise.all(promises);
      const newData = { 'first followup': [], 'appointment': [], 'project onboard': [], 'dropped': [] };

      results.forEach((res, index) => {
        const tabValue = REASON_TABS[index].value;
        if (res.status === 'success') {
          let data = res.data || [];
          if (tabValue) {
            data = data.filter(c => {
              const reason = String(c.followup_reason || 'first followup').toLowerCase().trim();
              if (tabValue === 'first followup') {
                return reason !== 'project onboard' && reason !== 'dropped' && reason !== 'droped' && reason !== 'appointment';
              }
              return reason === String(tabValue).toLowerCase().trim();
            });
          }

          if (userRole !== 'super_admin' && userRole !== 'admin') {
            data = data.filter(c => String(c.created_by || c.registered_by) === String(currentUser.id));
          }
          newData[tabValue] = data;
        }
      });

      setTabData(newData);
    } catch (e) {
      console.error(e);
      showToast('Failed to load followups', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [selectedDate, currentUser?.id, currentUser?.role]);

  const filteredTabData = useMemo(() => {
    const result = {};
    for (const [key, list] of Object.entries(tabData)) {
      let filtered = list || [];
      if (filterExpoSource !== 'all') {
        const [type, idOrName] = filterExpoSource.split('::');
        filtered = filtered.filter(c => {
          if (type === 'expo') return String(c.expo_id) === String(idOrName);
          if (type === 'source') return String(c.reference_source) === String(idOrName);
          return true;
        });
      }
      if (filterEmployee !== 'all') {
        filtered = filtered.filter(c => String(c.created_by || c.registered_by) === String(filterEmployee));
      }
      result[key] = filtered;
    }
    return result;
  }, [tabData, filterExpoSource, filterEmployee]);

  const cards = filteredTabData[activeReason] || [];
  const total = cards.length;

  const openHistory = async (card) => {
    try {
      const res = await fetchApi(
        `follow_ups.php?action=history&customer_id=${card.customer_id}&role=${encodeURIComponent(
          userRole
        )}&user_id=${currentUser.id}`
      );
      if (res.status === 'success') {
        let data = res.data || [];
        // The API currently returns all history ignoring customer_id, so we filter locally
        data = data.filter(h => String(h.customer_id) === String(card.customer_id));
        setHistoryModal({ customer: card, rows: data });
      } else {
        showToast(res.message || 'Failed to load history', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load history', 'error');
    }
  };

  const stageBadge = (card) => {
    const label = String(card.followup_reason || '').trim();
    if (!label) return '';
    return label;
  };

  return (
    <div className=" pb-12">
      {/* Top row: Date (left) + Filters + Stage buttons (center-ish) */}
      <div className="bg-white  rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <i className="ph-fill ph-calendar-blank text-gray-400 group-hover:text-crm-primary transition-colors"></i>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm font-medium rounded-full bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-crm-primary/50 focus:border-crm-primary/50 shadow-sm transition-all cursor-pointer hover:bg-gray-50"
              />
            </div>
            {document.getElementById('top-nav-filters') ? createPortal(
              <div className="flex items-center gap-3 w-full justify-center">
                <div className="relative w-64 group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <i className="ph-fill ph-funnel text-gray-400 group-hover:text-crm-primary transition-colors"></i>
                  </div>
                  <select
                    value={filterExpoSource}
                    onChange={(e) => setFilterExpoSource(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-crm-primary/50 focus:border-crm-primary/50 shadow-sm transition-all cursor-pointer appearance-none hover:bg-gray-50"
                  >
                    <option value="all">All Expos & Sources</option>
                    {expos.map(e => <option key={`expo-${e.id}`} value={`expo::${e.id}`}>{e.expo_name}</option>)}
                    {sources.map(s => <option key={`source-${s.id || s.name}`} value={`source::${s.name}`}>{s.name}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <i className="ph-bold ph-caret-down text-gray-400 text-xs"></i>
                  </div>
                </div>

                {['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase()) && (
                  <div className="relative w-56 group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <i className="ph-fill ph-users text-gray-400 group-hover:text-crm-primary transition-colors"></i>
                    </div>
                    <select
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-crm-primary/50 focus:border-crm-primary/50 shadow-sm transition-all cursor-pointer appearance-none hover:bg-gray-50"
                    >
                      <option value="all">All Employees</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name || emp.username}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <i className="ph-bold ph-caret-down text-gray-400 text-xs"></i>
                    </div>
                  </div>
                )}
              </div>,
              document.getElementById('top-nav-filters')
            ) : (
              <>
                <div className="relative w-48 group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <i className="ph-fill ph-funnel text-gray-400 group-hover:text-crm-primary transition-colors"></i>
                  </div>
                  <select
                    value={filterExpoSource}
                    onChange={(e) => setFilterExpoSource(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-crm-primary/50 focus:border-crm-primary/50 shadow-sm transition-all cursor-pointer appearance-none hover:bg-gray-50"
                  >
                    <option value="all">All Expos & Sources</option>
                    {expos.map(e => <option key={`expo-${e.id}`} value={`expo::${e.id}`}>{e.expo_name}</option>)}
                    {sources.map(s => <option key={`source-${s.id || s.name}`} value={`source::${s.name}`}>{s.name}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <i className="ph-bold ph-caret-down text-gray-400 text-xs"></i>
                  </div>
                </div>

                {['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase()) && (
                  <div className="relative w-48 group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <i className="ph-fill ph-users text-gray-400 group-hover:text-crm-primary transition-colors"></i>
                    </div>
                    <select
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 text-sm font-medium rounded-full bg-white border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-crm-primary/50 focus:border-crm-primary/50 shadow-sm transition-all cursor-pointer appearance-none hover:bg-gray-50"
                    >
                      <option value="all">All Employees</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name || emp.username}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <i className="ph-bold ph-caret-down text-gray-400 text-xs"></i>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {REASON_TABS.map((t) => {
              // Hide onboard and dropped for future dates
              if (selectedDate && selectedDate > new Date().toISOString().split('T')[0]) {
                if (t.value === 'project onboard' || t.value === 'dropped') {
                  return null;
                }
              }

              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActiveReason(t.value)}
                  className={`px-6 py-2 rounded-full border text-sm font-semibold transition-colors flex items-center gap-2 ${activeReason === t.value
                    ? 'bg-crm-primary text-white border-crm-primary'
                    : 'bg-white text-gray-800 border-gray-300 hover:bg-crm-primaryLighter/60'
                    }`}
                >
                  <span>{t.label}</span>
                  <span className={`px-2 py-0.5 rounded-md text-xs ${activeReason === t.value ? 'bg-white text-crm-primary' : 'bg-gray-100 text-gray-600'}`}>
                    {filteredTabData[t.value]?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-sm font-semibold text-gray-800 text-center md:text-right">
            Total followups: {total}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading followups..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          {cards.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 relative">
              {stageBadge(c) && (
                <div className="absolute top-4 right-4">
                  <span 
                    className={`px-3 py-1 rounded-full text-white text-xs font-semibold capitalize ${
                      stageBadge(c).toLowerCase() === 'appointment' ? '' : 'bg-crm-primaryDark'
                    }`}
                    style={stageBadge(c).toLowerCase() === 'appointment' ? { backgroundColor: '#db7070' } : {}}
                  >
                    {stageBadge(c)}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2 mt-2">
                <div className="text-sm">
                  <span className="font-bold text-gray-900">Company Name: </span>
                  <span className="font-medium text-gray-700">{c.company_name || '—'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-gray-900">Contact Person: </span>
                  <span className="font-medium text-gray-700">{c.contact_person || c.display_contact_person || c.customer_name || '—'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-gray-900">Status: </span>
                  <span className="font-medium text-gray-700 capitalize">{c.followup_status || c.status || '—'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-gray-900">Last Followup Date: </span>
                  <span className="font-medium text-gray-700">{c.created_at ? formatDateTime(c.created_at) : (c.visit_date ? formatDateTime(c.visit_date) : '—')}</span>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-gray-900">Next Followup Date: </span>
                  <span className="font-medium text-gray-700">{formatDateTime(c.follow_up_date) || '—'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-gray-900">Remarks: </span>
                  <span className="font-medium text-gray-700">{c.last_completed_remarks || c.remarks || c.notes || c.customer_remarks || '—'}</span>
                </div>
                {['admin', 'super_admin', 'superadmin'].includes(userRole.toLowerCase()) && (
                  <div className="text-sm">
                    <span className="font-bold text-gray-900">Employee Name: </span>
                    <span className="font-medium text-gray-700">{c.registered_by_name || '—'}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openHistory(c)}
                  className="text-sm font-bold text-crm-primary hover:text-crm-primaryDark inline-flex items-center gap-2 bg-crm-primary/10 px-4 py-2 rounded-lg"
                >
                  <i className="ph-bold ph-clock-counter-clockwise" />
                  View History
                </button>
                <button
                  type="button"
                  onClick={() => setFormModal({ card: c })}
                  className="px-6 py-2 rounded bg-crm-primary hover:bg-crm-primaryDark text-white text-sm font-semibold shadow"
                >
                  Follow Up
                </button>
              </div>
            </div>
          ))}

          {cards.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-500 lg:col-span-2">
              No followups found.
            </div>
          )}
        </div>
      )}

      {historyModal && (
        <FollowupHistoryModal
          customer={historyModal.customer}
          history={historyModal.rows}
          onClose={() => setHistoryModal(null)}
        />
      )}

      {formModal && (
        <FollowupFormModal
          card={formModal.card}
          currentUser={currentUser}
          onClose={() => setFormModal(null)}
          onSaved={() => {
            setFormModal(null);
            loadBoard();
          }}
        />
      )}
    </div>
  );
};

const FollowupFormModal = ({ card, currentUser, onClose, onSaved }) => {
  const userRole = currentUser?.role || 'employee';
  const [submitting, setSubmitting] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [useNewContact, setUseNewContact] = useState(false);

  const defaultReason = REASON_OPTIONS.includes(String(card.followup_reason || '').toLowerCase())
    ? String(card.followup_reason || '').toLowerCase()
    : 'first followup';

  const [form, setForm] = useState({
    next_follow_up_date: card.follow_up_date || todayISO(),
    followup_reason: defaultReason,
    followup_status: 'inprogress',
    remarks: '',
    voice_note_base64: '',
    contact_person: '',
    contact_designation: '',
    contact_phone: '',
    contact_email: '',
  });

  const [lastManualReason, setLastManualReason] = useState(defaultReason);

  useEffect(() => {
    if (form.followup_status === 'confirmed') {
      setForm((p) => ({ ...p, followup_reason: 'project onboard' }));
    } else if (form.followup_status === 'not interested') {
      setForm((p) => ({ ...p, followup_reason: 'droped' }));
    } else if (form.followup_status === 'not picking') {
      setForm((p) => ({ ...p, followup_reason: 'None' }));
    } else {
      setForm((p) => {
        if (p.followup_reason === 'Project Onboard' || p.followup_reason === 'project onboard' || p.followup_reason === 'Dropped' || p.followup_reason === 'droped') {
          return { ...p, followup_reason: lastManualReason === 'Project Onboard' || lastManualReason === 'project onboard' || lastManualReason === 'Dropped' || lastManualReason === 'droped' ? 'None' : lastManualReason };
        }
        return p;
      });
    }
  }, [form.followup_status, lastManualReason]);

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await fetchApi(`customer_contacts.php?customer_id=${card.customer_id}`);
      if (res.status === 'success') setContacts(res.data || []);
      else setContacts([]);
    } catch (e) {
      console.error(e);
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [card.customer_id]);

  const applyContact = (contact) => {
    if (!contact) return;
    setForm((prev) => ({
      ...prev,
      contact_person: contact.person_name || '',
      contact_designation: contact.designation || '',
      contact_phone: contact.phone || '',
      contact_email: contact.email || '',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    const missing = [];
    if (!String(form.next_follow_up_date || '').trim()) missing.push('Next Followup Date');
    if (!String(form.contact_person || '').trim()) missing.push('Contact Person');
    const phoneErr = validateStoredPhone(form.contact_phone, { required: true });
    if (phoneErr) missing.push(phoneErr === 'Phone number is required' ? 'Mobile No' : phoneErr);
    if (!String(form.followup_status || '').trim()) missing.push('Followup Status');
    if (!String(form.followup_reason || '').trim()) missing.push('Followup Reason');
    if (missing.length > 0) {
      showToast(`Missing: ${missing.join(', ')}`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      let contactIdToUse = (selectedContactId && selectedContactId !== 'main') ? Number(selectedContactId) : null;
      let finalContact = {
        contact_person: form.contact_person,
        contact_designation: form.contact_designation,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
      };

      const contactPersonTrimmed = String(form.contact_person || '').trim();
      const contactPhoneNormalized = normalizePhoneForSubmit(form.contact_phone);

      // Check if the submitted contact details already exist in the list
      const alreadyExists = contacts.some(
        (c) =>
          String(c.person_name || '').trim().toLowerCase() === contactPersonTrimmed.toLowerCase() &&
          normalizePhoneForSubmit(c.phone) === contactPhoneNormalized
      );

      // Also check against the default/main customer contact details in the card
      const isMainCustomer =
        String(card.customer_name || '').trim().toLowerCase() === contactPersonTrimmed.toLowerCase() &&
        normalizePhoneForSubmit(card.phone_1) === contactPhoneNormalized;

      // Automatically add/save entered contact details if they are new/not in existing list
      if (!alreadyExists && !isMainCustomer && contactPersonTrimmed !== '') {
        const resContact = await fetchApi('customer_contacts.php', {
          method: 'POST',
          body: JSON.stringify({
            customer_id: Number(card.customer_id),
            person_name: form.contact_person,
            designation: form.contact_designation,
            phone: contactPhoneNormalized,
            email: form.contact_email,
          }),
        });
        if (resContact.status === 'success') {
          contactIdToUse = Number(resContact.id);
          await loadContacts();
        }
      } else if (contactIdToUse) {
        const selected = contacts.find((c) => String(c.id) === String(contactIdToUse));
        if (selected) {
          finalContact = {
            contact_person: selected.person_name || '',
            contact_designation: selected.designation || '',
            contact_phone: selected.phone || '',
            contact_email: selected.email || '',
          };
          // Keep UI in sync too
          applyContact(selected);
        }
      }

      const payload = {
        customer_id: Number(card.customer_id),
        follow_up_date: (form.followup_status === 'confirmed' || form.followup_reason === 'Project Onboard' || form.followup_reason === 'project onboard') ? '' : form.next_follow_up_date,
        followup_reason: form.followup_reason,
        followup_status: form.followup_status,
        remarks: form.remarks,
        voice_note_base64: form.voice_note_base64,
        contact_id: contactIdToUse,
        contact_person: finalContact.contact_person,
        contact_designation: finalContact.contact_designation,
        contact_phone: normalizePhoneForSubmit(finalContact.contact_phone),
        contact_email: finalContact.contact_email,
        created_by: currentUser?.id || null,
        role: userRole,
      };

      const { submitOfflineAware } = await import('../utils/offlineSync');
      const res = await submitOfflineAware('follow_ups.php', 'POST', payload, 'followup');

      if (res.status === 'success' || (!res.status && Object.keys(res).length === 0)) {
        showToast(res.message || 'Followup saved', res.isOffline ? 'info' : 'success');
        onSaved?.();
      } else {
        showToast(res.message || 'Failed to save followup', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to save followup', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b bg-crm-primary/5 border-crm-primary/15">
          <h3 className="text-lg font-semibold text-crm-primary flex items-center gap-2">
            <i className="ph-fill ph-phone-call" /> Customer Follow-Up
          </h3>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-colors">
            <i className="ph-bold ph-x text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
          {/* Customer Profile Details (Automatically fetched and displayed) */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <i className="ph-fill ph-identification-card text-crm-primary text-xl" />
              <h4 className="text-sm font-semibold text-crm-primary uppercase tracking-wider">
                Customer Profile Details
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Event Name</label>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-bold text-sm truncate shadow-sm">
                  {card.expo_name || card.manual_expo_name || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Visit Date</label>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-bold text-sm shadow-sm">
                  {card.visit_date || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Company Name</label>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-bold text-sm truncate shadow-sm">
                  {card.company_name || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Industry Type</label>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-bold text-sm shadow-sm">
                  {card.industry_type || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Enquiry Type</label>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-bold text-sm shadow-sm">
                  {card.enquiry_type || '—'}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Address / Location</label>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-bold text-sm shadow-sm">
                  {card.location || '—'}
                </div>
              </div>
              <div className="md:col-span-4">
                <label className="block text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Registration Remarks</label>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-bold text-sm shadow-sm">
                  {card.customer_remarks || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Contact Details ───────────────────────────── */}
          <div className="rounded-2xl border border-crm-primary/20 bg-white shadow-sm p-5">

            {/* Section label */}
            <div className="flex items-center gap-2 mb-4">
              <i className="ph-fill ph-address-book text-crm-primary text-lg" />
              <span className="text-sm font-semibold text-gray-800">Contact Details</span>
            </div>

            {/* ── SELECT MODE: dropdown + disabled sibling fields ── */}
            {!useNewContact && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Contact Person Name — IS the dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Person Name <span className="text-red-500">*</span>
                    </label>
                    {contactsLoading ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400">
                        <i className="ph-bold ph-spinner animate-spin text-xs" /> Loading…
                      </div>
                    ) : (
                      <CustomContactSelect
                        value={selectedContactId || ''}
                        onChange={(val) => {
                          setSelectedContactId(val);
                          if (val === 'main') {
                            applyContact({
                              person_name: card.customer_name || '',
                              designation: card.designation || '',
                              phone: card.phone_1 || '',
                              email: card.email || '',
                            });
                          } else if (val) {
                            const found = contacts.find((c) => String(c.id) === String(val));
                            if (found) applyContact(found);
                          } else {
                            setForm((p) => ({
                              ...p,
                              contact_person: '',
                              contact_designation: '',
                              contact_phone: '',
                              contact_email: '',
                            }));
                          }
                        }}
                        options={[
                          { value: '', displayName: 'Select Contact Person', listName: 'Select Contact Person' },
                          ...(card.customer_name || card.phone_1
                            ? [
                              {
                                value: 'main',
                                displayName: card.customer_name || '—',
                                listName: `${card.customer_name || '—'}${card.phone_1 ? ` (${card.phone_1})` : ''}`,
                              },
                            ]
                            : []),
                          ...contacts.map((c) => ({
                            value: String(c.id),
                            displayName: c.person_name || '—',
                            listName: `${c.person_name || '—'}${c.phone ? ` (${c.phone})` : ''}`,
                          })),
                        ]}
                      />
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      value={form.contact_phone}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg crm-input bg-gray-50 text-gray-500 cursor-default"
                      placeholder={selectedContactId ? form.contact_phone || '—' : 'Select Contact Person First'}
                    />
                  </div>

                  {/* Email ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email ID</label>
                    <input
                      value={form.contact_email}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg crm-input bg-gray-50 text-gray-500 cursor-default"
                      placeholder={selectedContactId ? form.contact_email || '—' : 'Select Contact Person First'}
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                    <input
                      value={form.contact_designation}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg crm-input bg-gray-50 text-gray-500 cursor-default"
                      placeholder={selectedContactId ? form.contact_designation || '—' : 'Select Contact Person First'}
                    />
                  </div>
                </div>

                {/* + Add Contact button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setUseNewContact(true);
                      setSelectedContactId('');
                      setForm((p) => ({
                        ...p,
                        contact_person: '',
                        contact_designation: '',
                        contact_phone: '',
                        contact_email: '',
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-crm-primary hover:bg-crm-primaryDark text-white text-sm font-semibold shadow-sm transition-colors"
                  >
                    <i className="ph-bold ph-plus" />
                    Add Contact
                  </button>
                </div>
              </>
            )}

            {/* ── MANUAL ENTRY MODE: all editable inputs ── */}
            {useNewContact && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Contact Person Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Person Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.contact_person}
                      onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg crm-input"
                      placeholder="Enter Contact Person Name"
                      autoFocus
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <PhoneInput
                      value={form.contact_phone}
                      onChange={(v) => setForm((p) => ({ ...p, contact_phone: v }))}
                      required
                      inputClassName="flex-1 min-w-0 px-4 py-2.5 rounded-lg crm-input"
                      selectClassName="w-[3.5rem] shrink-0 px-3 py-2.5 rounded-lg crm-input text-sm text-center"
                    />
                  </div>

                  {/* Email ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email ID</label>
                    <input
                      value={form.contact_email}
                      onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg crm-input"
                      placeholder="Enter Email ID"
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                    <input
                      value={form.contact_designation}
                      onChange={(e) => setForm((p) => ({ ...p, contact_designation: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg crm-input"
                      placeholder="Enter Designation"
                    />
                  </div>
                </div>

                {/* Cancel button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setUseNewContact(false);
                      setSelectedContactId('');
                      setForm((p) => ({
                        ...p,
                        contact_person: '',
                        contact_designation: '',
                        contact_phone: '',
                        contact_email: '',
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Follow up fields */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-semibold text-gray-800 mb-3">Follow Up</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal text-crm-primary">Followup Status</label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {STATUS_OPTIONS.map((opt) => (
                    <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="followup_status"
                        value={opt.value}
                        checked={form.followup_status === opt.value}
                        onChange={(e) => setForm((p) => ({ ...p, followup_status: e.target.value }))}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Followup Reason</label>
                <select
                  value={form.followup_reason}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((p) => {
                      const updates = { followup_reason: val };
                      if (val === 'Project Onboard') {
                        updates.followup_status = 'confirmed';
                      }
                      return { ...p, ...updates };
                    });
                    setLastManualReason(val);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {form.followup_status !== 'confirmed' && form.followup_reason !== 'Project Onboard' && form.followup_reason !== 'project onboard' && (
                <div>
                  <label className="block text-sm font-normal text-crm-primary">Next Followup Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.next_follow_up_date}
                    onChange={(e) => setForm((p) => ({ ...p, next_follow_up_date: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-normal text-crm-primary">Remarks</label>
                <input
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                  placeholder="Remarks"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-normal text-crm-primary mb-2">Voice Note</label>
              <VoiceNoteControl
                value={form.voice_note_base64}
                onChange={(v) => setForm((p) => ({ ...p, voice_note_base64: v }))}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 bg-gray-50/90 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-7 py-2.5 bg-crm-primary text-white rounded-lg hover:bg-crm-primaryDark text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerFollowup;
export { FollowupFormModal, FollowupHistoryModal, STATUS_OPTIONS, REASON_OPTIONS };
