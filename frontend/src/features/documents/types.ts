export type RAGStage =
  | 'QUEUED'
  | 'UPLOADING'
  | 'PARSING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'COMPLETE'
  | 'FAILED'
  | 'CANCELLED';

export interface DocumentMetadata {
  tags?: string[];
  category?: string;
  [key: string]: any;
}

export interface Document {
  id?: string;        // Optional because optimistic documents don't have a server ID yet
  temp_id?: string;   // Frontend local tracking UUID
  filename: string;
  upload_date: string;
  status: string;
  current_stage: RAGStage;
  progress_pct: number;
  error_message?: string;
  chunks_processed?: number;
  total_chunks?: number;
  tokens_used?: number;
  file_size?: number;
  metadata?: DocumentMetadata;
}

export interface UploadResponse {
  id: string;
  status: string;
  current_stage: RAGStage;
  message?: string;
  error_message?: string;
}
