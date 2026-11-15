import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, Clock, Copy, MapPin, RefreshCw, X } from 'lucide-react';
import {
  FormField,
  FormSelect,
  PrimaryButton,
  SecondaryButton,
} from './OwnerPrimitives';
import { manilaTodayIso } from '../../lib/calendarLinks';
import { shiftIsoDate } from '../../lib/ownerInsights';

function formatSlot12h(hhmm) {
  const [hStr, mStr] = String(hhmm || '').split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function describeBookingError(reason, data) {
  switch (reason) {
    case 'too_soon':
      return data?.min_date
        ? `Bookings require advance notice. Earliest available date is ${data.min_date}.`
        : 'Selected date is too soon under current advance booking rules.';
    case 'past_date':
      return 'Please pick today or a future date.';
    case 'closed':
      return 'The salon is closed on that date.';
    case 'outside_hours':
      return 'Selected time falls outside working hours for this service duration.';
    case 'overlap':
      return 'That time slot overlaps with an existing confirmed booking.';
    case 'invalid_service':
      return 'Please select an active service.';
    case 'invalid_name':
      return 'Please enter the client name (2 to 80 characters).';
    case 'invalid_contact':
      return 'Please enter a valid PH mobile number (example: 09171234567).';
    case 'unreachable':
      return 'Could not reach Supabase. Please check your connection and try again.';
    default:
      return 'Could not save the booking. Please review the details and try again.';
  }
}

export function ManualBookingModal({
  open,
  onClose,
  onBooked,
  appointmentActions,
  catalog,
}) {
  const activeServices = useMemo(() => {
    const list = catalog?.services || [];
    const active = list.filter((s) => s.active !== false);
    return active.length > 0 ? active : list;
  }, [catalog]);

  const minAdvanceDays = Number(catalog?.settings?.minAdvanceDays ?? 3);
  const defaultDate = useMemo(
    () => shiftIsoDate(manilaTodayIso(), Math.max(1, minAdvanceDays)),
    [minAdvanceDays]
  );

  const areaChips = useMemo(() => {
    const free = Array.isArray(catalog?.business?.freeTravelAreas)
      ? catalog.business.freeTravelAreas
      : [];
    return ['At Artist Studio', ...free.slice(0, 4)];
  }, [catalog]);

  const [serviceKey, setServiceKey] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdBooking, setCreatedBooking] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServiceKey((prev) => prev || activeServices[0]?.key || '');
    setDate(defaultDate);
    setSelectedTime('');
    setSlots([]);
    setSlotsError('');
    setSubmitError('');
    setCreatedBooking(null);
    setClientName('');
    setClientContact('');
    setLocation('');
    setCopiedRef(false);
  }, [open, activeServices, defaultDate]);

  async function loadOpenSlots(targetDate = date, targetService = serviceKey) {
    if (!appointmentActions?.getAvailableSlots || !targetDate || !targetService) return;
    setLoadingSlots(true);
    setSlotsError('');
    setSelectedTime('');
    const res = await appointmentActions.getAvailableSlots({
      date: targetDate,
      serviceKey: targetService,
    });
    setLoadingSlots(false);
    if (!res.ok) {
      setSlots([]);
      setSlotsError(describeBookingError(res.reason, res.data));
      return;
    }
    const list = Array.isArray(res.data?.slots) ? res.data.slots : [];
    setSlots(list);
    if (list.length === 0) {
      setSlotsError('No open time slots remain on this date for the selected service.');
    } else {
      setSelectedTime(list[0]);
    }
  }

  useEffect(() => {
    if (!open || !date || !serviceKey || createdBooking) return;
    loadOpenSlots(date, serviceKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, serviceKey]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!appointmentActions?.bookAppointment) return;
    setSubmitError('');
    if (!serviceKey) {
      setSubmitError('Please select a service.');
      return;
    }
    if (!date || !selectedTime) {
      setSubmitError('Please choose an available date and time slot.');
      return;
    }
    if (clientName.trim().length < 2) {
      setSubmitError('Please enter the client name (at least 2 characters).');
      return;
    }
    if (!clientContact.trim()) {
      setSubmitError('Please enter a client mobile number.');
      return;
    }

    setSubmitting(true);
    const res = await appointmentActions.bookAppointment({
      serviceKey,
      date,
      time: selectedTime,
      name: clientName.trim(),
      contact: clientContact.trim(),
      location: location.trim() || null,
    });
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(describeBookingError(res.reason, res.data));
      return;
    }

    const svcName =
      activeServices.find((s) => s.key === serviceKey)?.name || serviceKey;
    setCreatedBooking({
      referenceCode: res.data?.reference_code,
      date: res.data?.date || date,
      time: res.data?.time || selectedTime,
      serviceName: svcName,
      clientName: clientName.trim(),
      clientContact: clientContact.trim(),
      location: location.trim() || null,
    });
    if (onBooked) onBooked();
  }

  function handleCopyRef() {
    if (!createdBooking?.referenceCode || !navigator?.clipboard) return;
    navigator.clipboard.writeText(createdBooking.referenceCode);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 1800);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#fdfcfa] rounded-t-2xl sm:rounded-2xl border border-stone-200/80 shadow-xl max-w-xl w-full max-h-[92dvh] flex flex-col overflow-hidden sm:my-auto">
        <div className="px-4 py-3.5 sm:px-6 sm:py-5 border-b border-stone-200/80 bg-[#f8f6f2] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-pink-600 text-white flex items-center justify-center shrink-0">
              <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-stone-900 truncate">New Manual Booking</h2>
              <p className="text-xs text-stone-500 truncate">
                Add a Messenger, call, or walk-in client directly to your calendar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking dialog"
            className="w-9 h-9 rounded-lg border border-stone-200/80 bg-[#fdfcfa] text-stone-500 hover:text-stone-900 hover:bg-stone-100 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {createdBooking ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5 text-center space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs font-medium">
                <Check className="w-3.5 h-3.5" />
                Booking Confirmed
              </span>
              <p className="text-xs text-stone-600 pt-1">Reference Code</p>
              <p className="text-xl sm:text-2xl font-semibold font-mono text-stone-900 tabular-nums">
                {createdBooking.referenceCode}
              </p>
              <p className="text-xs text-stone-600">
                {createdBooking.serviceName} on {createdBooking.date} at{' '}
                {formatSlot12h(createdBooking.time)}
              </p>
            </div>

            <div className="rounded-xl border border-stone-200/80 bg-[#f8f6f2] p-3.5 sm:p-4 text-xs text-stone-700 space-y-1.5">
              <div className="flex justify-between gap-3">
                <span className="text-stone-500 shrink-0">Client</span>
                <span className="font-semibold text-stone-900 truncate">{createdBooking.clientName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-stone-500 shrink-0">Mobile</span>
                <span className="font-semibold text-stone-900 truncate">{createdBooking.clientContact}</span>
              </div>
              {createdBooking.location ? (
                <div className="flex justify-between gap-3">
                  <span className="text-stone-500 shrink-0">Venue</span>
                  <span className="font-semibold text-stone-900 truncate">{createdBooking.location}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 sm:gap-2.5">
              <SecondaryButton onClick={handleCopyRef} className="w-full sm:w-auto">
                {copiedRef ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedRef ? 'Copied Reference' : 'Copy Reference'}
              </SecondaryButton>
              <PrimaryButton onClick={onClose} className="w-full sm:w-auto">Done</PrimaryButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            {submitError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                {submitError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <FormSelect
                label="Service"
                value={serviceKey}
                onChange={setServiceKey}
                options={activeServices.map((s) => ({
                  value: s.key,
                  label: `${s.name} (${s.durationMinutes || 60} mins)`,
                }))}
              />

              <FormField
                label="Appointment Date"
                type="date"
                value={date}
                min={manilaTodayIso()}
                onChange={setDate}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  Available Time Slots
                </label>
                <button
                  type="button"
                  onClick={() => loadOpenSlots(date, serviceKey)}
                  disabled={loadingSlots}
                  className="inline-flex items-center gap-1 text-xs font-medium text-pink-700 hover:text-pink-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSlots ? 'animate-spin' : ''}`} />
                  Refresh slots
                </button>
              </div>

              {loadingSlots ? (
                <div className="rounded-lg border border-stone-200/80 bg-[#f8f6f2] px-4 py-3 text-xs text-stone-500">
                  Checking available times for {date}...
                </div>
              ) : slotsError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  {slotsError}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 max-h-36 overflow-y-auto p-1">
                  {slots.map((slot) => {
                    const active = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`min-h-9 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium tabular-nums whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-pink-600 border-pink-600 text-white'
                            : 'bg-[#fdfcfa] border-stone-200/80 text-stone-700 hover:border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {formatSlot12h(slot)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <FormField
                label="Client Full Name"
                value={clientName}
                onChange={setClientName}
                placeholder="Maria Santos"
              />
              <FormField
                label="Mobile Number"
                value={clientContact}
                onChange={setClientContact}
                placeholder="09171234567"
              />
            </div>

            <div>
              <FormField
                label="Venue or Event Location (Optional)"
                value={location}
                onChange={setLocation}
                placeholder="Venue or studio"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {areaChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setLocation(chip)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                      location === chip
                        ? 'bg-pink-50 border-pink-300 text-pink-700'
                        : 'bg-[#f8f6f2] border-stone-200/80 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            </div>

            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-stone-200/80 bg-[#fdfcfa] flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 shrink-0">
              <SecondaryButton onClick={onClose} disabled={submitting} className="flex-1 sm:flex-none">
                Cancel
              </SecondaryButton>
              <PrimaryButton
                type="submit"
                disabled={submitting || loadingSlots || !selectedTime}
                className="flex-1 sm:flex-none"
              >
                <CalendarPlus className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Create Booking'}
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
