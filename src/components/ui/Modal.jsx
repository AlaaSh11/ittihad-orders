import { useState, useEffect } from 'react';

/**
 * Custom in-app modal replacing native window.alert, window.confirm, and window.prompt.
 * Matches the application's Cairo font and theme styling.
 */
export default function Modal({
  isOpen,
  title = 'تأكيد',
  message,
  type = 'confirm', // 'confirm' | 'prompt' | 'alert'
  defaultValue = '',
  placeholder = '',
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  isDanger = false,
  onConfirm,
  onCancel,
}) {
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (type === 'prompt') {
      onConfirm?.(inputValue);
    } else {
      onConfirm?.();
    }
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-cairo"
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#1a1a2e]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 rounded-full w-7 h-7 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {message && (
            <p className="text-sm font-semibold text-gray-700 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          )}

          {type === 'prompt' && (
            <textarea
              autoFocus
              rows={3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-[#f8f8fc] border-2 border-indigo-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-300 rounded-xl p-3 text-sm font-cairo text-[#1a1a2e] focus:outline-none resize-none"
            />
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {type !== 'alert' && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-sm active:scale-95 ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
