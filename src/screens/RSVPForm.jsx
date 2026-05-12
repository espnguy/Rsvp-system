import { useMemo, useState } from 'react';
import BrickHeader from '../components/BrickHeader.jsx';
import BrickButton from '../components/BrickButton.jsx';
import Input from '../components/Input.jsx';
import AttendeeRow from '../components/AttendeeRow.jsx';
import JumperToggle from '../components/JumperToggle.jsx';

export default function RSVPForm({ onBack, onSuccess, initialData }) {
  const initial = initialData && initialData.attending ? initialData : null;
  const firstAttendee = initial && initial.attendees && initial.attendees[0];
  const restAttendees =
    initial && Array.isArray(initial.attendees) ? initial.attendees.slice(1) : [];

  const [parentName, setParentName] = useState(initial ? initial.parentName : '');
  const [contact, setContact] = useState(initial ? initial.contact : '');
  const [childName, setChildName] = useState(
    initial ? (firstAttendee ? firstAttendee.name : initial.childName || '') : ''
  );
  const [childIsJumper, setChildIsJumper] = useState(
    firstAttendee ? !!firstAttendee.isJumper : true
  );
  const [extras, setExtras] = useState(
    restAttendees.map((a) => ({ name: a.name || '', isJumper: !!a.isJumper }))
  );
  const [notes, setNotes] = useState(initial ? initial.notes || '' : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = !!initial;

  const addExtra = () => {
    setExtras((rows) => [...rows, { name: '', isJumper: true }]);
  };

  const updateExtra = (idx, next) => {
    setExtras((rows) => rows.map((r, i) => (i === idx ? next : r)));
  };

  const removeExtra = (idx) => {
    setExtras((rows) => rows.filter((_, i) => i !== idx));
  };

  const attendees = useMemo(() => {
    const trimmedChild = childName.trim();
    const main = trimmedChild
      ? [{ name: trimmedChild, isJumper: childIsJumper }]
      : [];
    const rest = extras
      .map((e) => ({ name: e.name.trim(), isJumper: !!e.isJumper }))
      .filter((e) => e.name.length > 0);
    return [...main, ...rest];
  }, [childName, childIsJumper, extras]);

  const validate = () => {
    if (!parentName.trim()) return 'Please enter your name.';
    if (!contact.trim()) return 'Please enter a phone number or email.';
    if (!childName.trim()) return "Please enter the invited child's name.";
    for (const e of extras) {
      if (!e.name.trim()) return 'Each added guest needs a name (or remove the row).';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const payload = {
      attending: true,
      parentName: parentName.trim(),
      contact: contact.trim(),
      childName: childName.trim(),
      attendees,
      notes: notes.trim() || null,
      messageToRayyan: null,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      onSuccess(payload, data.rsvp || null);
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <BrickHeader color="#FFC107" items={['🐦', '⭐', '🐦', '⭐', '🐦']} />

      <form onSubmit={handleSubmit} className="flex-1 px-5 pt-5 pb-10 space-y-4" noValidate>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="tappable text-sm font-semibold text-lego-blue -ml-2 px-2"
          >
            ← Back
          </button>
          <h2 className="display text-xl text-lego-blue">
            {isEditing ? 'Edit your RSVP' : "You're coming! 🎉"}
          </h2>
          <span className="w-12" aria-hidden="true" />
        </div>

        <div className="card space-y-4">
          <Input
            label="Your name"
            value={parentName}
            onChange={setParentName}
            placeholder="Parent or guardian name"
            required
            autoComplete="name"
            name="parentName"
          />
          <Input
            label="Phone or email"
            value={contact}
            onChange={setContact}
            placeholder="617-555-0142 or you@example.com"
            required
            autoComplete="email"
            inputMode="email"
            name="contact"
          />
        </div>

        <section className="space-y-3">
          <h3 className="display text-lg text-lego-blue">Who's coming?</h3>

          <div className="card space-y-3">
            <Input
              label="Invited child's name"
              value={childName}
              onChange={setChildName}
              placeholder="e.g. Max"
              required
              autoComplete="off"
              name="childName"
            />
            <div>
              <span className="brick-label">Jumper?</span>
              <JumperToggle
                value={childIsJumper}
                onChange={setChildIsJumper}
                ariaLabel="Invited child jumper status"
              />
            </div>
          </div>

          {extras.map((a, i) => (
            <AttendeeRow
              key={i}
              index={i + 1}
              attendee={a}
              onChange={(next) => updateExtra(i, next)}
              onRemove={() => removeExtra(i)}
              removable
              nameLabel="Additional guest name"
              placeholder="e.g. Emma (sister)"
            />
          ))}

          <button
            type="button"
            onClick={addExtra}
            className="tappable w-full py-3 px-4 rounded-lg border-2 border-dashed border-lego-blue text-lego-blue font-semibold"
          >
            + Add another person
          </button>
        </section>

        <Input
          label="Notes (optional)"
          as="textarea"
          value={notes}
          onChange={setNotes}
          placeholder="Allergies, might be late, etc."
          name="notes"
        />

        {error && (
          <div
            role="alert"
            className="rounded-lg border-2 border-lego-red bg-red-50 text-lego-red px-3 py-2 text-sm font-semibold"
          >
            {error}
          </div>
        )}

        <BrickButton color="red" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Sending…
            </>
          ) : isEditing ? (
            <>Save changes →</>
          ) : (
            <>Send RSVP →</>
          )}
        </BrickButton>
      </form>
    </div>
  );
}
