import React from 'react';
import { useDocumentList } from '@/features/documents/useDocumentList';
import styles from './Quiz.module.css';
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
    return <div className={styles.loadingState}>Loading lectures...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No lectures available. Please upload some documents first.</p>
      </div>
    );
  }

  return (
    <div className={styles.lectureList}>
      {documents.map(doc => {
        if (!doc.id) return null; // skip optimistic docs
        const isSelected = selectedIds.includes(doc.id);
        
        return (
          <div 
            key={doc.id} 
            className={`${styles.lectureCard} ${isSelected ? styles.selected : ''}`}
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
            <div className={styles.checkbox}>
              {isSelected && <div className={styles.checkmark} />}
            </div>
            <div className={`${styles.lectureInfo} min-w-0`}>
              <h3 className={`${styles.lectureTitle} truncate block w-full overflow-hidden text-ellipsis`} dir="auto" title={doc.filename}>{doc.filename}</h3>
              <p className={styles.lectureMeta}>
                Uploaded {formatDateOnly(doc.upload_date)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
