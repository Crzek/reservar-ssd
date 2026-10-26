import { messageFor } from '../lib/errorMessages';

type ErrorBannerProps = { code?: string | null; onClose?: () => void };

export const ErrorBanner = ({ code, onClose }: ErrorBannerProps) => {
  if (!code) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{messageFor(code)}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="font-semibold text-red-700 hover:text-red-900">
          ×
        </button>
      )}
    </div>
  );
};
