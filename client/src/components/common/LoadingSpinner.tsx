export default function LoadingSpinner({ text = 'טוען...' }: { text?: string }) {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}
