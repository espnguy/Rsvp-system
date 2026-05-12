export default function BrickHeader({ color, items, images }) {
  if (images) {
    return (
      <div
        aria-hidden="true"
        className="w-full flex items-end justify-around px-3"
        style={{ backgroundColor: color, height: 104 }}
      >
        {images.map((img, i) => {
          const src = typeof img === 'string' ? img : img.src;
          const height = typeof img === 'string' ? 84 : img.height;
          return <img key={i} src={src} alt="" style={{ height, width: 'auto' }} />;
        })}
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
