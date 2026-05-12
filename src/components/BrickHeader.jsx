export default function BrickHeader({ color }) {
  return (
    <div
      className="w-full flex items-center justify-around px-6"
      style={{ backgroundColor: color, height: 56 }}
      aria-hidden="true"
    >
      {['⭐', '🌟', '⭐', '🌟', '⭐'].map((star, i) => (
        <span key={i} className="text-2xl leading-none">{star}</span>
      ))}
    </div>
  );
}
