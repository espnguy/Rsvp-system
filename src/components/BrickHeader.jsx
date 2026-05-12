export default function BrickHeader({ color, items, images }) {
  if (images) {
    return (
      <div
        aria-hidden="true"
        style={{
          backgroundColor: color,
          paddingTop: 12,
          paddingBottom: 8,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        <div
          className="w-full flex items-end justify-around"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            height: 88,
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          {images.map((src, i) => (
            <img key={i} src={src} alt="" style={{ height: 82, width: 'auto' }} />
          ))}
        </div>
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
