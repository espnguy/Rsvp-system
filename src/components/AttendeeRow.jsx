import Input from './Input.jsx';
import JumperToggle from './JumperToggle.jsx';

export default function AttendeeRow({
  index,
  attendee,
  onChange,
  onRemove,
  removable,
  label,
  nameLabel,
  placeholder,
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Input
            label={nameLabel || `Guest ${index + 1} name`}
            value={attendee.name}
            onChange={(name) => onChange({ ...attendee, name })}
            placeholder={placeholder || 'Name'}
            required
            autoComplete="off"
          />
        </div>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="tappable px-3 mt-7 text-sm font-semibold text-lego-red"
            aria-label={`Remove ${attendee.name || 'guest'}`}
          >
            Remove
          </button>
        )}
      </div>
      <div>
        <span className="brick-label">{label || 'Child or adult?'}</span>
        <JumperToggle
          value={attendee.isJumper}
          onChange={(isJumper) => onChange({ ...attendee, isJumper })}
          ariaLabel={`${attendee.name || `Guest ${index + 1}`} child or adult`}
        />
      </div>
    </div>
  );
}
