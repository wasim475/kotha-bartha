export default function StudyPlaceholder({ icon, label, description }) {
  const Icon = icon;

  return (
    <div className="study-placeholder">
      <div className="study-placeholder-icon">
        <Icon fontSize="inherit" />
      </div>

      <h1>{label}</h1>
      <p>{description}</p>

      <span className="study-placeholder-tag">Coming soon</span>
    </div>
  );
}
