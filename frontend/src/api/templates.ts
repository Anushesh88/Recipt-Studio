import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Canvas } from '../schema/templateSchema';
import type { DocumentType, PagePreset } from '../lib/units';

export interface TemplateSummary {
  id: string;
  name: string;
  preset: PagePreset;
  document_type: DocumentType;
  element_count: number;
  created_at: string | null;
  updated_at: string | null;
}

// `canvas` is unvalidated JSON here: callers parse it with canvasSchema before
// putting it in the editor store (Architecture frontend rule 8)
export interface TemplateRecord {
  id: string;
  name: string;
  canvas: unknown;
  schema_version: number;
  created_at: string | null;
  updated_at: string | null;
}

export const templateKeys = {
  all: ['templates'] as const,
  detail: (id: string) => ['templates', id] as const,
};

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: async () => (await apiClient.get<TemplateSummary[]>('/templates')).data,
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => (await apiClient.get<TemplateRecord>(`/templates/${id}`)).data,
  });
}

export async function createTemplate(name: string, canvas: Canvas): Promise<TemplateRecord> {
  return (await apiClient.post<TemplateRecord>('/templates', { name, canvas })).data;
}

export async function updateTemplate(id: string, changes: { name?: string; canvas?: Canvas }): Promise<TemplateRecord> {
  return (await apiClient.put<TemplateRecord>(`/templates/${id}`, changes)).data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete(`/templates/${id}`);
}

export async function fetchTemplate(id: string): Promise<TemplateRecord> {
  return (await apiClient.get<TemplateRecord>(`/templates/${id}`)).data;
}
