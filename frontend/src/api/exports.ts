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

// The server-rendered PDF / PNG, fetched with the auth header
async function fetchReceiptFile(receiptId: string, format: ExportFormat, receiptNumber: string): Promise<File> {
  try {
    const res = await apiClient.get<Blob>(`/receipts/${receiptId}/export`, { params: { format }, responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const name = FILENAME.exec(disposition)?.[1] ?? `receipt-${receiptNumber}.${format}`;
    return new File([res.data], name, { type: res.data.type || (format === 'pdf' ? 'application/pdf' : 'image/png') });
  } catch (error) {
    throw new Error(await exportErrorMessage(error));
  }
}

export async function downloadReceipt(receiptId: string, format: ExportFormat, receiptNumber: string): Promise<void> {
  const file = await fetchReceiptFile(receiptId, format, receiptNumber);
  saveBlob(file, file.name);
}

// Whether this browser can hand a PDF to the system share sheet (phones, and
// some desktop browsers): WhatsApp, email, etc.
export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([''], 'receipt.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

// Opens the share sheet with the receipt's PDF; "cancelled" if the user closes it
export async function shareReceipt(receiptId: string, receiptNumber: string): Promise<'shared' | 'cancelled'> {
  const file = await fetchReceiptFile(receiptId, 'pdf', receiptNumber);
  try {
    await navigator.share({ files: [file], title: `Receipt ${receiptNumber}` });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    throw new Error("Couldn't open the share sheet. Download the PDF and share it instead.");
  }
}
