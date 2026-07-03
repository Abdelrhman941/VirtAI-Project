export default function PageLoader({ label = 'Preparing VirtAI services…' }: { label?: string | null }) {
  const safeLabel = label ?? 'Preparing VirtAI services…';
  return (
    <div className="page-loader" role="status" aria-label={safeLabel}>
      <div className="loader" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p className="page-loader-label">{label}</p>
    </div>
  );
}
