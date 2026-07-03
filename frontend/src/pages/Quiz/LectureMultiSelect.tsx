import React from 'react';
import { useDocumentList } from '@/features/documents/hooks/useDocumentList';
import { formatDateOnly } from '@/shared/utils/date';

interface LectureMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function LectureMultiSelect({ selectedIds, onChange }: LectureMultiSelectProps) {
  const { documents, isLoading } = useDocumentList(null);

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center text-white/50 py-12 px-8 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
        Loading lectures...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center text-white/50 py-12 px-8 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
        <p>No lectures available. Please upload some documents first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.map(doc => {
        if (!doc.id) return null; // skip optimistic docs
        const isSelected = selectedIds.includes(doc.id);

        return (
          <div
            key={doc.id}
            className={`flex items-center gap-5 px-6 py-5 rounded-xl cursor-pointer transition-all duration-200 relative z-[1]
              ${isSelected
                ? 'border border-[#B4AB8B] bg-[#b4ab8b]/[0.08]'
                : 'bg-white/[0.02] border border-white/[0.05] hover:bg-[#b4ab8b]/[0.04] hover:border-[#b4ab8b]/20'
              }`}
            onClick={() => toggleSelection(doc.id!)}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSelection(doc.id!);
              }
            }}
          >
            {/* Checkbox */}
            <div className={`w-5 h-5 border-2 rounded shrink-0 flex items-center justify-center transition-all duration-200
              ${isSelected
                ? 'border-[#B4AB8B] bg-[#B4AB8B]'
                : 'border-[#b4ab8b]/30'
              }`}>
              {isSelected && (
                <div
                  className="w-2.5 h-2.5 bg-[#0A0908]"
                  style={{ clipPath: 'polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)' }}
                />
              )}
            </div>

            <div className="flex flex-col gap-1 overflow-hidden min-w-0">
              <h3 className="text-[0.95rem] font-medium text-white m-0 whitespace-nowrap overflow-hidden text-ellipsis truncate block w-full" dir="auto" title={doc.filename}>
                {doc.filename}
              </h3>
              <p className="text-[0.8rem] text-white/50 m-0">
                Uploaded {formatDateOnly(doc.upload_date)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
