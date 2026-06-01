import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchApi } from '../utils/api';
import LoadingSpinner from './common/LoadingSpinner';
import ReportModalShell, { EditField, reportInputClass } from './common/ReportModalShell';
import { showToast } from '../utils/toast';
import PhoneInput from './common/PhoneInput';
import { normalizePhoneForSubmit, validateStoredPhone } from '../utils/phoneUtils';

const REASON_TABS = [
  { label: 'Followup', value: 'first followup' },
  { label: 'Proposal', value: 'proposal' },
  { label: 'Lead', value: 'lead' },
  { label: 'Project Confirm', value: 'project confirmed' },
];

const STATUS_OPTIONS = [
  { label: 'Inprogress', value: 'inprogress' },
  { label: 'Not Interested', value: 'not interested' },
  { label: 'Not Picking', value: 'not picking' },
  { label: 'Confirmed', value: 'confirmed' },
];

const REASON_OPTIONS = ['None', 'Proposal', 'Followup', 'Quotation', 'Lead', 'Dropped', 'Project Onboard'];

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
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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
      onChange?.('');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={start}
          disabled={recording}
          className="h-10 w-10 rounded-lg bg-crm-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center"
          aria-label="Start recording"
          title="Start"
        >
          <i className="ph-bold ph-microphone text-lg" />
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!recording}
          className="h-10 w-10 rounded-lg border border-gray-200 text-sm font-semibold disabled:opacity-60 flex items-center justify-center"
          aria-label={paused ? 'Resume recording' : 'Pause recording'}
          title={paused ? 'Resume' : 'Pause'}
        >
          <i className={`ph-bold ${paused ? 'ph-play' : 'ph-pause'} text-lg`} />
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!recording}
          className="h-10 w-10 rounded-lg bg-crm-primaryDark text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center"
          aria-label="Stop recording"
          title="Stop"
        >
          <i className="ph-bold ph-stop text-lg" />
        </button>
        <button
          type="button"
          onClick={clear}
          className="h-10 w-10 rounded-lg border border-crm-primary/20 text-crm-primary text-sm font-semibold hover:bg-crm-primaryLighter/60 flex items-center justify-center"
          aria-label="Delete voice note"
          title="Delete"
        >
          <i className="ph-bold ph-trash text-lg" />
        </button>
      </div>
      {value ? (
        <audio controls controlsList="nodownload noplaybackrate" className="h-10 flex-1 min-w-[200px]">
          <source src={value} />
        </audio>
      ) : (
        <p className="text-xs text-gray-500 w-full sm:w-auto mt-1 sm:mt-0">No voice note added.</p>
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
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                String(o.value) === String(value) ? 'bg-crm-primary/5 text-crm-primary font-bold' : 'text-gray-700'
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
        className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-white text-sm font-medium text-gray-700"
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
            <div key={h.id} className="rounded-2xl overflow-hidden border border-crm-primary/20 shadow-sm">

              {/* ── Card Header ── */}
              <div className="bg-crm-primary px-5 py-3 flex items-center gap-3">
                <span className="text-white text-sm font-bold capitalize">
                  {h.followup_status || h.status || 'Unknown'}
                </span>
                <span className="px-3 py-0.5 rounded-md bg-red-500 text-white text-xs font-bold tracking-wide">
                  Current Status
                </span>
              </div>

              {/* ── Card Body ── */}
              <div className="bg-white px-5 py-4 space-y-4">

                {/* Title + timestamp */}
                <div>
                  <div className="text-base font-semibold text-black">
                    Followup Reason : <span className="capitalize">{h.followup_reason || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span className="font-semibold text-gray-700">Followup Taken :</span>{' '}
                    {h.created_at
                      ? new Date(h.created_at).toLocaleString()
                      : h.follow_up_date || '—'}
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-0.5">Contact Person</div>
                    <div className="text-sm font-medium text-gray-900">{h.contact_person || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-0.5">Contact No</div>
                    <div className="text-sm font-medium text-gray-900">{h.contact_phone || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-0.5">Next Follow-up</div>
                    <div className="text-sm font-medium text-gray-900">{h.follow_up_date || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-0.5">Reason</div>
                    <div className="text-sm font-medium text-gray-900 capitalize">{h.followup_reason || '—'}</div>
                  </div>
                </div>

                {/* Remarks */}
                {h.remarks && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Remarks</div>
                    <div className="text-sm text-gray-700">{h.remarks}</div>
                  </div>
                )}

                {/* Voice note (if any) */}
                {h.voice_note_base64 && (
                  <div className="mt-2">
                    <audio controls className="w-full">
                      <source src={h.voice_note_base64} />
                    </audio>
                  </div>
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

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [activeReason, setActiveReason] = useState(REASON_TABS[0].value);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);

  const [historyModal, setHistoryModal] = useState(null); // { customer, rows }
  const [formModal, setFormModal] = useState(null); // { customer, card }

  const total = cards.length;

  const loadBoard = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const url = `follow_ups.php?action=board&date=${selectedDate}&reason=${encodeURIComponent(
        activeReason
      )}&role=${encodeURIComponent(userRole)}&user_id=${currentUser.id}`;
      const res = await fetchApi(url);
      if (res.status === 'success') {
        let data = res.data || [];
        
        // The API currently returns all records ignoring query parameters, so we must filter locally
        if (selectedDate) {
          data = data.filter(c => c.follow_up_date === selectedDate);
        }
        if (activeReason) {
          data = data.filter(c => {
            const reason = String(c.followup_reason || 'first followup').toLowerCase().trim();
            return reason === String(activeReason).toLowerCase().trim();
          });
        }
        setCards(data);
      }
      else setCards([]);
    } catch (e) {
      console.error(e);
      showToast('Failed to load followups', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [selectedDate, activeReason, currentUser?.id, currentUser?.role]);

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
      {/* Top row: Date (left) + Stage buttons (center-ish) */}
      <div className="bg-white  rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 rounded-full border border-gray-200 crm-input w-52"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {REASON_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveReason(t.value)}
                className={`px-6 py-2 rounded-full border text-sm font-semibold transition-colors ${activeReason === t.value
                  ? 'bg-crm-primary text-white border-crm-primary'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-crm-primaryLighter/60'
                  }`}
              >
                {t.label}
              </button>
            ))}
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
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Company: {c.company_name || '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Next Follow-up Date: <span className="font-semibold text-gray-700">{c.follow_up_date}</span>
                  </div>
                  <div className="text-xs text-gray-800 mt-1">
                    Contact Person:{' '}
                    <span className="font-semibold text-gray-700">
                      {c.display_contact_person || c.customer_name || '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Remarks:{' '}
                    <span className="font-semibold text-gray-700">
                      {c.remarks || c.notes || '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Status:{' '}
                    <span className="font-semibold text-gray-700">
                      {c.followup_status || c.status || '—'}
                    </span>
                  </div>
                </div>
                {stageBadge(c) && (
                  <span className="px-3 py-1 rounded-full bg-crm-primaryDark text-white text-xs font-semibold capitalize">
                    {stageBadge(c)}
                  </span>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openHistory(c)}
                  className="text-sm font-semibold text-crm-primary hover:text-crm-primaryDark inline-flex items-center gap-2"
                >
                  <i className="ph-bold ph-clock-counter-clockwise" />
                  View History
                </button>
                <button
                  type="button"
                  onClick={() => setFormModal({ card: c })}
                  className="px-6 py-2.5 rounded-xl bg-crm-primary hover:bg-crm-primaryDark text-white text-sm font-semibold shadow"
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

  useEffect(() => {
    if (form.followup_status === 'confirmed') {
      setForm((p) => ({ ...p, followup_reason: 'Project Onboard' }));
    } else if (form.followup_status === 'not interested' || form.followup_status === 'not picking') {
      setForm((p) => ({ ...p, followup_reason: 'None' }));
    }
  }, [form.followup_status]);

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
        follow_up_date: form.next_follow_up_date,
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

      // Use fetch directly: the backend sometimes returns an empty body on
      // successful inserts (PHP output issue) so we can't rely on fetchApi
      // which returns {} for empty responses, causing status check to fail.
      const { API_BASE_URL } = await import('../utils/api');
      const response = await fetch(`${API_BASE_URL}/follow_ups.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let res = {};
      try { res = text ? JSON.parse(text) : {}; } catch { /* ignore parse error */ }

      if (response.ok && (res.status === 'success' || !text || !res.status)) {
        // HTTP 2xx + either explicit success OR empty body (backend inserted but didn't echo)
        showToast('Followup saved');
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
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-gray-500 font-medium">Event Name</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold truncate">
                  {card.expo_name || card.manual_expo_name || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Visit Date</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
                  {card.visit_date || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Company Name</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold truncate">
                  {card.company_name || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Industry Type</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
                  {card.industry_type || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Website</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold truncate">
                  {card.website ? (
                    <a href={card.website.startsWith('http') ? card.website : `https://${card.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      {card.website}
                    </a>
                  ) : '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">City</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
                  {card.city || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Secondary Phone</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
                  {card.phone_2 || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Priority Level</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold capitalize">
                  {card.priority || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Enquiry Type</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
                  {card.enquiry_type || '—'}
                </div>
              </div>
              <div>
                <label className="block text-gray-500 font-medium">Reference</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
                  {card.reference_source || card.reference || '—'}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-gray-500 font-medium">Address / Location</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
                  {card.location || '—'}
                </div>
              </div>
              <div className="md:col-span-4">
                <label className="block text-gray-500 font-medium">Registration Remarks</label>
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-gray-200 text-gray-800 font-semibold">
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
                <label className="block text-sm font-normal text-crm-primary">Next Followup Date</label>
                <input
                  type="date"
                  value={form.next_follow_up_date}
                  onChange={(e) => setForm((p) => ({ ...p, next_follow_up_date: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Followup Reason</label>
                <select
                  value={form.followup_reason}
                  onChange={(e) => setForm((p) => ({ ...p, followup_reason: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
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
            className="px-6 py-2.5 border border-gray-200 rounded-lg hover:bg-white text-sm font-semibold text-gray-700"
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
