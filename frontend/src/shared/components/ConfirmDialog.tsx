import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-300 text-sm mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              isDestructive 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                : 'bg-gold text-black hover:bg-gold/90 shadow-lg shadow-gold/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
