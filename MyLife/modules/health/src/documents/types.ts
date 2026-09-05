export type DocumentType =
  | 'lab_result'
  | 'prescription'
  | 'insurance'
  | 'imaging'
  | 'vaccination'
  | 'referral'
  | 'discharge'
  | 'other';

export interface HealthDocument {
  id: string;
  title: string;
  type: DocumentType;
  mime_type: string;
  file_size: number;
  content: Buffer | Uint8Array;
  thumbnail: Buffer | Uint8Array | null;
  notes: string | null;
  document_date: string | null;
  is_starred: number;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInput {
  title: string;
  type: DocumentType;
  mime_type: string;
  content: Buffer | Uint8Array;
  thumbnail?: Buffer | Uint8Array;
  notes?: string;
  document_date?: string;
  tags?: string[];
}

export interface UpdateDocumentInput {
  title?: string;
  type?: DocumentType;
  notes?: string;
  document_date?: string;
  is_starred?: boolean;
  tags?: string[];
}

/** Max document size: 10 MB */
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
