import axios from 'axios';
import { apiClient, apiErrorMessage } from './client';
import { OBJECT_URL_REVOKE_DELAY_MS } from '../lib/units';

export type ExportFormat = 'pdf' | 'png';

const FILENAME = /filename="?([^";]+)"?/;

// Error bodies of blob requests arrive as Blobs; read the JSON detail out of them
async function exportErrorMessage(error: unknown): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const detail = JSON.parse(await error.response.data.text())?.detail;
      if (typeof detail === 'string') return detail;
      if (typeof detail?.message === 'string') return detail.message;
    } catch {
      // not JSON: fall through
    }
  }
  return apiErrorMessage(error, "Couldn't export the receipt. Please try again.");
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the URL
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
}

// Downloads the server-rendered PDF / PNG (the file is fetched with the auth header)
export async function downloadReceipt(receiptId: string, format: ExportFormat, receiptNumber: string): Promise<void> {
  try {
    const res = await apiClient.get<Blob>(`/receipts/${receiptId}/export`, { params: { format }, responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    saveBlob(res.data, FILENAME.exec(disposition)?.[1] ?? `receipt-${receiptNumber}.${format}`);
  } catch (error) {
    throw new Error(await exportErrorMessage(error));
  }
}
