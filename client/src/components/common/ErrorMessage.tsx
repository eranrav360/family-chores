interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="alert alert-error" style={{ margin: '12px 0' }}>
      <span>⚠️ {message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-sm btn-ghost"
          style={{ marginRight: 12, marginTop: 8, display: 'block' }}
        >
          נסה שוב
        </button>
      )}
    </div>
  );
}
