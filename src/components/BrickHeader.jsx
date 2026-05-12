export default function BrickHeader({ color, items }) {
  const icons = items || ['🐦', '⭐', '🍪', '⭐', '🐦'];
  return (
    <div
      className="w-full flex items-center justify-around px-6"
      style={{ backgroundColor: color, height: 56 }}
      aria-hidden="true"
    >
      {icons.map((icon, i) => (
        <span key={i} className="text-2xl leading-none">{icon}</span>
      ))}
    </div>
  );
}
