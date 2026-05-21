export default function JumperToggle({ value, onChange, ariaLabel }) {
  return (
    <div
      className="seg"
      role="group"
      aria-label={ariaLabel || 'Child or adult'}
    >
      <button
        type="button"
        className="seg-btn"
        aria-pressed={value === true}
        onClick={() => onChange(true)}
      >
        <span aria-hidden="true">👧</span> Child
      </button>
      <button
        type="button"
        className="seg-btn"
        aria-pressed={value === false}
        onClick={() => onChange(false)}
      >
        Adult
      </button>
    </div>
  );
}
