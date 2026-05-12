import { useState } from 'react';
import BrickHeader from '../components/BrickHeader.jsx';
import BrickButton from '../components/BrickButton.jsx';
import Input from '../components/Input.jsx';

export default function Declined({ onBack, onSuccess, done, initialData }) {
  const initial = initialData && !initialData.attending ? initialData : null;
  const [parentName, setParentName] = useState(
    initial ? initial.parentName || '' : ''
  );
  const [contact, setContact] = useState(initial ? initial.contact || '' : '');
  const [message, setMessage] = useState(
    initial ? initial.messageToRayyan || '' : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const isEditing = !!initial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!parentName.trim()) {
      setError('Please enter your name so Rayyan knows who said hi.');
      return;
    }

    const payload = {
      attending: false,
      parentName: parentName.trim(),
      contact: contact.trim() || null,
      childName: null,
      attendees: [],
      notes: null,
      messageToRayyan: message.trim() || null,
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
      onSuccess(data.rsvp || null);
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col">
        <BrickHeader color="#2196F3" items={['⭐', '🐦', '❤️', '🍪', '⭐']} />
        <main className="flex-1 px-5 pt-8 pb-10 space-y-5 text-center">
          <h1 className="display text-3xl text-lego-blue">Thanks for letting us know 💙</h1>
          <p className="text-gray-700">
            Rayyan will miss you! 🐦 We'll pass along your note.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <BrickHeader color="#2196F3" items={['⭐', '🐦', '❤️', '🍪', '⭐']} />

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
            {isEditing ? 'Edit your RSVP' : "We'll miss you!"}
          </h2>
          <span className="w-12" aria-hidden="true" />
        </div>

        <p className="text-gray-700 text-center">
          Even Cookie Monster is sad you can't make it! 🍪 Drop Rayyan a quick note.
        </p>

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
            label="Phone or email (optional)"
            value={contact}
            onChange={setContact}
            placeholder="617-555-0142 or you@example.com"
            autoComplete="email"
            inputMode="email"
            name="contact"
          />
          <Input
            label="Message to Rayyan (optional)"
            as="textarea"
            value={message}
            onChange={setMessage}
            placeholder="Happy birthday! Catch up soon…"
            name="message"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border-2 border-lego-red bg-red-50 text-lego-red px-3 py-2 text-sm font-semibold"
          >
            {error}
          </div>
        )}

        <BrickButton color="blue" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Sending…
            </>
          ) : isEditing ? (
            <>Save changes</>
          ) : (
            <>Send</>
          )}
        </BrickButton>
      </form>
    </div>
  );
}
