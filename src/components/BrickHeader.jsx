export default function BrickHeader({ color, items, images }) {
  if (images) {
    return (
      <div
        className="w-full flex items-end justify-around px-3"
        style={{ backgroundColor: color, height: 96 }}
        aria-hidden="true"
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            style={{ height: 84, width: 'auto', mixBlendMode: 'multiply' }}
          />
        ))}
      </div>
    );
  }
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
