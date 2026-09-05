export type TemplateFieldType = 'text' | 'richtext' | 'media' | 'audio';

export interface Template {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean;
  cardCountPerNote: number;
  frontFormat: string;
  backFormat: string;
  css: string;
  sortOrder: number;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateField {
  id: string;
  templateId: string;
  name: string;
  fieldType: TemplateFieldType;
  isRequired: boolean;
  sortOrder: number;
  placeholder: string;
  createdAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  cardCountPerNote?: number;
  frontFormat: string;
  backFormat: string;
  css?: string;
  fields: CreateFieldInput[];
}

export interface CreateFieldInput {
  name: string;
  fieldType?: TemplateFieldType;
  isRequired?: boolean;
  placeholder?: string;
}
