import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export type AssetKind = 'logo' | 'signature' | 'image';

export interface Asset {
  id: string;
  kind: AssetKind;
  mime_type: string;
  size_bytes: number;
  created_at: string | null;
}

// Mirrors the backend rules (PNG/JPG, <= 2 MB) so users get instant feedback;
// the server re-checks the actual file contents.
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Only PNG and JPG images are supported.';
  if (file.size > MAX_ASSET_BYTES) return 'Image is larger than 2 MB.';
  return null;
}

export async function uploadAsset(file: File, kind: AssetKind): Promise<Asset> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  // Let the browser set the multipart boundary
  const res = await apiClient.post<Asset>('/assets', form, { headers: { 'Content-Type': undefined } });
  return res.data;
}

// <img> can't send the auth header, so the file is fetched with it and shown via
// an object URL. Assets never change, so it's cached for the session.
export function useAssetUrl(assetId: string | null | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: ['asset-file', assetId],
    enabled: Boolean(assetId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<Blob>(`/assets/${assetId}`, { responseType: 'blob' });
      return URL.createObjectURL(res.data);
    },
  });
  return data;
}
