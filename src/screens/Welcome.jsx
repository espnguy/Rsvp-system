import BrickHeader from '../components/BrickHeader.jsx';
import BrickButton from '../components/BrickButton.jsx';
import { PARTY } from '../partyDetails.js';

export default function Welcome({ onYes, onNo, existingRsvp, onEdit }) {
  return (
    <div className="min-h-screen flex flex-col">
      <BrickHeader
        color="#F44336"
        images={['/elmo.png', '/cookie-monster.png', '/abby.png', '/big-bird-transparent-6-3618470511.jpg', '/bert-ernie.png']}
      />

      <main className="flex-1 px-5 pt-6 pb-10 space-y-5">
        {existingRsvp && (
          <div className="rounded-xl border-2 border-lego-blue bg-white p-4">
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none" aria-hidden="true">✓</span>
              <div className="flex-1 text-sm">
                <div className="font-semibold text-gray-900">
                  You've already RSVP'd as{' '}
                  <span className={existingRsvp.attending ? 'text-lego-green' : 'text-gray-700'}>
                    {existingRsvp.attending ? 'attending' : 'not attending'}
                  </span>
                  .
                </div>
                <div className="text-gray-600">
                  Changed your mind? Tap Edit, or pick a different answer below to overwrite.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="tappable mt-3 w-full py-2 px-3 rounded-lg border-2 border-lego-blue text-lego-blue font-semibold"
            >
              Edit my RSVP
            </button>
          </div>
        )}

        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-lego-blue mb-2">
            You're invited!
          </p>
<h1
            className="display text-[64px] text-lego-red"
            style={{ WebkitTextStroke: '1px #0D47A1' }}
          >
            RAYYAN
          </h1>
          <p className="display text-lego-blue text-2xl mt-1">
            is turning {PARTY.age}! <span aria-hidden="true">🎂</span>
          </p>
          <p className="mt-1 text-sm text-gray-500 italic">
            Brought to you by the number {PARTY.age}!
          </p>
          <p className="mt-3 text-lg font-semibold text-gray-800">{PARTY.subtitle}</p>
        </header>

        <section className="card space-y-3">
          <Detail
            emoji="📅"
            label="When"
            value={
              <>
                <div>{PARTY.dateLabel}</div>
                <a
                  href={PARTY.calendarUrl}
                  className="inline-block mt-1 text-sm font-semibold text-lego-blue underline"
                >
                  Add to calendar →
                </a>
              </>
            }
          />
          <Detail
            emoji="📍"
            label="Where"
            value={
              <>
                <div className="font-semibold">{PARTY.locationName}</div>
                {PARTY.locationAddress && (
                  <div className="text-sm text-gray-600">{PARTY.locationAddress}</div>
                )}
                {PARTY.locationMapUrl && (
                  <a
                    href={PARTY.locationMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 text-sm font-semibold text-lego-blue underline"
                  >
                    Get directions →
                  </a>
                )}
              </>
            }
          />
          <Detail
            emoji="👋"
            label="Host"
            value={
              <>
                <div>{PARTY.hostName}</div>
                <a
                  href={`tel:${PARTY.hostPhone.replace(/\D/g, '')}`}
                  className="text-sm text-lego-blue underline"
                >
                  {PARTY.hostPhone}
                </a>
              </>
            }
          />
        </section>

        <section className="space-y-3 pt-2">
          <BrickButton color="green" onClick={onYes}>
            Yes, we'll be there! <span aria-hidden="true">🎉</span>
          </BrickButton>
          <BrickButton color="outline" onClick={onNo}>
            Sorry, can't make it
          </BrickButton>
        </section>
      </main>
    </div>
  );
}

function Detail({ emoji, label, value }) {
  return (
    <div className="flex gap-3">
      <div className="text-xl leading-none pt-0.5" aria-hidden="true">
        {emoji}
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="text-gray-900">{value}</div>
      </div>
    </div>
  );
}
