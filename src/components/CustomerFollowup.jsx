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

const REASON_OPTIONS = ['First Followup', 'Proposal', 'Lead', 'Drop', 'Project Confirmed'];

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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={recording}
          className="h-10 w-10 rounded-lg bg-crm-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center"
          aria-label="Start recording"
          title="Start"
        >
          <i className="ph-bold ph-play text-lg" />
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
        <label
          className="h-10 w-10 rounded-lg border border-gray-200 text-sm font-semibold cursor-pointer hover:bg-gray-50 flex items-center justify-center"
          aria-label="Upload voice note"
          title="Upload"
        >
          <i className="ph-bold ph-upload-simple text-lg" />
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const dataUrl = await toDataUrl(file);
              onChange?.(dataUrl);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {value ? (
        <audio controls className="w-full">
          <source src={value} />
        </audio>
      ) : (
        <p className="text-xs text-gray-500">No voice note added.</p>
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
    <div className="">
      {history.length === 0 ? (
        <div className="text-sm text-gray-500">No history found.</div>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-800">
                  {h.follow_up_date} • {h.followup_reason || '—'}
                </div>
                <div className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  {h.followup_status || h.status || '—'}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Contact: {h.contact_person || '—'} {h.contact_phone ? `(${h.contact_phone})` : ''}
              </div>
              {h.remarks && <div className="text-sm text-gray-700 mt-2">{h.remarks}</div>}
              {h.voice_note_base64 && (
                <div className="mt-2">
                  <audio controls className="w-full">
                    <source src={h.voice_note_base64} />
                  </audio>
                </div>
              )}
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
      if (res.status === 'success') setCards(res.data || []);
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
        setHistoryModal({ customer: card, rows: res.data || [] });
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
                className={`px-6 py-2 rounded-full border text-sm font-semibold transition-colors ${
                  activeReason === t.value
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {cards.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Company: {c.company_name || '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Follow-up Date: <span className="font-semibold text-gray-700">{c.follow_up_date}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
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
    followup_status: 'inprogress',
    followup_reason: defaultReason,
    next_follow_up_date: card.follow_up_date || todayISO(),
    remarks: '',
    contact_person: card.display_contact_person || card.customer_name || '',
    contact_designation: card.display_contact_designation || card.designation || '',
    contact_phone: card.display_contact_phone || card.phone_1 || '',
    contact_email: card.display_contact_email || card.email || '',
    voice_note_base64: '',
  });

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
      let contactIdToUse = selectedContactId ? Number(selectedContactId) : null;
      let finalContact = {
        contact_person: form.contact_person,
        contact_designation: form.contact_designation,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
      };

      // If user wants a new contact, create it first (reusable).
      if (useNewContact) {
        if (!String(form.contact_person || '').trim()) {
          showToast('Contact Person is required', 'error');
          setSubmitting(false);
          return;
        }
        const resContact = await fetchApi('customer_contacts.php', {
          method: 'POST',
          body: JSON.stringify({
            customer_id: Number(card.customer_id),
            person_name: finalContact.contact_person,
            designation: finalContact.contact_designation,
            phone: normalizePhoneForSubmit(finalContact.contact_phone),
            email: finalContact.contact_email,
          }),
        });
        if (resContact.status === 'success') {
          contactIdToUse = Number(resContact.id);
          await loadContacts();
        } else {
          showToast(resContact.message || 'Failed to save contact', 'error');
          setSubmitting(false);
          return;
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

      const res = await fetchApi('follow_ups.php', { method: 'POST', body: JSON.stringify(payload) });
      if (res.status === 'success') {
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
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
          {/* Company info row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-normal text-crm-primary">Event name</label>
              <input disabled value={card.expo_name || card.manual_expo_name || '—'} className="w-full px-4 py-2.5 rounded-lg crm-input mt-1 bg-gray-50 text-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary">
                Company Name <span className="text-crm-primary">*</span>
              </label>
              <input disabled value={card.company_name || ''} className="w-full px-4 py-2.5 rounded-lg crm-input mt-1 bg-gray-50 text-gray-600" />
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

          {/* Existing contact strip */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-800">
                Existing contact details
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseNewContact(false);
                  const base = {
                    person_name: card.customer_name || '',
                    designation: card.designation || '',
                    phone: card.phone_1 || '',
                    email: card.email || '',
                  };
                  applyContact(base);
                }}
                className="px-4 py-1.5 rounded-full bg-crm-primary hover:bg-crm-primaryDark text-white text-xs font-semibold"
              >
                Apply
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-600 grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="flex items-center gap-2">
                <i className="ph-bold ph-user" />
                <span>Contact Person: {card.customer_name || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="ph-bold ph-briefcase" />
                <span>Designation: {card.designation || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="ph-bold ph-phone" />
                <span>Mobile: {card.phone_1 || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="ph-bold ph-envelope" />
                <span>Email: {card.email || '—'}</span>
              </div>
            </div>
          </div>

          {/* Existing contacts picker */}
          <div className="rounded-2xl border border-crm-primary/15 bg-crm-primaryLighter/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-800">
                Existing Contacts <span className="text-crm-primary">*</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const selected = contacts.find((c) => String(c.id) === String(selectedContactId));
                  if (!selected) {
                    showToast('Select a contact first', 'error');
                    return;
                  }
                  setUseNewContact(false);
                  applyContact(selected);
                  showToast('Contact applied', 'success');
                }}
                className="px-4 py-1.5 rounded-full bg-crm-primary hover:bg-crm-primaryDark text-white text-xs font-semibold"
              >
                Apply Selected
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {contactsLoading ? (
                <div className="text-sm text-gray-500">Loading contacts...</div>
              ) : contacts.length === 0 ? (
                <div className="text-sm text-gray-500">No contacts found.</div>
              ) : (
                contacts.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 text-sm text-gray-800">
                    <input
                      type="radio"
                      name="contactPick"
                      checked={String(selectedContactId) === String(c.id)}
                      onChange={() => setSelectedContactId(c.id)}
                    />
                    <span className="font-semibold">
                      {c.person_name} {c.phone ? `(${c.phone})` : ''}
                    </span>
                  </label>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setUseNewContact(true);
                setSelectedContactId(null);
              }}
              className="mt-4 w-full px-4 py-3 rounded-xl bg-crm-primary hover:bg-crm-primaryDark text-white text-sm font-semibold"
            >
              Add New Contact
            </button>
          </div>

          {/* Contact fields */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5">
            <div className="text-sm font-semibold text-gray-800 mb-3">Contact Section</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-normal text-crm-primary">
                  Contact Person <span className="text-crm-primary">*</span>
                </label>
                <input
                  value={form.contact_person}
                  onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Designation</label>
                <input
                  value={form.contact_designation}
                  onChange={(e) => setForm((p) => ({ ...p, contact_designation: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">
                  Mobile No <span className="text-crm-primary">*</span>
                </label>
                <div className="mt-1">
                  <PhoneInput
                    value={form.contact_phone}
                    onChange={(v) => setForm((p) => ({ ...p, contact_phone: v }))}
                    required
                    inputClassName="flex-1 min-w-0 px-4 py-2.5 rounded-lg crm-input"
                    selectClassName="w-[5.5rem] shrink-0 px-3 py-2.5 rounded-lg crm-input text-sm text-center"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-normal text-crm-primary">Email ID</label>
                <input
                  value={form.contact_email}
                  onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg crm-input mt-1"
                />
              </div>
            </div>
            {useNewContact && (
              <p className="text-xs text-gray-600 mt-2">
                This contact will be saved and shown in “Existing Contacts” after submit.
              </p>
            )}
          </div>

          {/* Enquiry & followup details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-normal text-crm-primary">Enquiry Type</label>
              <input disabled value={card.enquiry_type || '—'} className="w-full px-4 py-2.5 rounded-lg crm-input mt-1 bg-gray-50 text-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary">Priority</label>
              <input disabled value={(card.priority || '—').toString()} className="w-full px-4 py-2.5 rounded-lg crm-input mt-1 bg-gray-50 text-gray-600 capitalize" />
            </div>
            <div>
              <label className="block text-sm font-normal text-crm-primary">Reference</label>
              <input disabled value={card.reference_source || card.reference || '—'} className="w-full px-4 py-2.5 rounded-lg crm-input mt-1 bg-gray-50 text-gray-600" />
            </div>
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
