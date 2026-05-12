import BrickHeader from '../components/BrickHeader.jsx';
import BrickButton from '../components/BrickButton.jsx';
import { PARTY } from '../partyDetails.js';

export default function ThankYou({ data }) {
  const attendees = data?.attendees || [];
  const jumperCount = attendees.filter((a) => a.isJumper).length;

  return (
    <div className="min-h-screen flex flex-col">
      <BrickHeader color="#4CAF50" />

      <main className="flex-1 px-5 pt-6 pb-10 space-y-5">
        <header className="text-center space-y-2">
          <div className="text-5xl" aria-hidden="true">🎉</div>
          <h1 className="display text-3xl text-lego-green">You're in!</h1>
          <p className="text-gray-700">
            Rayyan is going to be so excited to see you at the party!
          </p>
        </header>

        <section className="card space-y-3" aria-labelledby="recap-heading">
          <h2 id="recap-heading" className="display text-lg text-lego-blue">
            Your RSVP
          </h2>
          {data?.parentName && (
            <div className="text-sm">
              <span className="text-gray-500">From </span>
              <span className="font-semibold">{data.parentName}</span>
            </div>
          )}

          <ul className="divide-y divide-gray-100 -mx-2">
            {attendees.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-2 py-2"
              >
                <span className="font-medium text-gray-900">
                  <span className="text-lego-green mr-2" aria-hidden="true">✓</span>
                  {a.name}
                </span>
                <span
                  className={
                    a.isJumper
                      ? 'text-xs font-semibold px-2 py-1 rounded-full bg-lego-blue text-white'
                      : 'text-xs font-semibold px-2 py-1 rounded-full bg-gray-200 text-gray-700'
                  }
                >
                  {a.isJumper ? '🦘 Jumper' : 'Non-jumper'}
                </span>
              </li>
            ))}
          </ul>

          <div className="text-sm text-gray-600 pt-1">
            {attendees.length} total · {jumperCount} jumping
          </div>
        </section>

        {PARTY.waiverUrl && jumperCount > 0 && (
          <section className="warn-card space-y-2" aria-labelledby="waiver-heading">
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none" aria-hidden="true">⚠️</span>
              <div>
                <h2 id="waiver-heading" className="font-bold text-base">
                  Waiver required
                </h2>
                <p className="text-sm leading-snug mt-1">
                  The venue requires a signed waiver before arrival for anyone jumping.
                  Sign it now so there's no hold-up at the door.
                </p>
              </div>
            </div>
          </section>
        )}

        {PARTY.waiverUrl && (
          <BrickButton
            color="red"
            as="a"
            href={PARTY.waiverUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sign the jump waiver →
          </BrickButton>
        )}

        <section className="card text-sm text-gray-700 space-y-1">
          <div className="font-semibold text-gray-900">See you there!</div>
          <div>{PARTY.dateLabel}</div>
          <div>
            <a
              href={PARTY.calendarUrl}
              className="text-sm font-semibold text-lego-blue underline"
            >
              Add to calendar →
            </a>
          </div>
          <div className="pt-1">{PARTY.locationName}</div>
          <div>{PARTY.locationAddress}</div>
          <div>
            <a
              href={PARTY.locationMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-lego-blue underline"
            >
              Get directions →
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
