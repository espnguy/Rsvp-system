export default function BrickHeader({ color, items, images }) {
  if (images) {
    return (
      <div aria-hidden="true">
        <div className="w-full" style={{ backgroundColor: color, height: 10 }} />
        <div
          className="w-full flex items-end justify-around px-3"
          style={{ backgroundColor: '#fffde7', height: 90 }}
        >
          {images.map((src, i) => (
            <img key={i} src={src} alt="" style={{ height: 82, width: 'auto' }} />
          ))}
        </div>
        <div className="w-full" style={{ backgroundColor: color, height: 6 }} />
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
