// How much text a QR code can hold. qrcode.react (the editor) and segno (the
// PDF) both fail above QR_BYTE_CAPACITY, so content is checked first; the backend
// mirrors this in services/qr_service.py.
import { QR_BYTE_CAPACITY } from "./units";
import { utf8ByteLength } from "./text";

export type QrLevel = keyof typeof QR_BYTE_CAPACITY;

export const qrFits = (content: string, level: QrLevel) => utf8ByteLength(content) <= QR_BYTE_CAPACITY[level];

export const qrTooLongMessage = (level: QrLevel) =>
  `Too much text for a QR code: at most ${QR_BYTE_CAPACITY[level]} characters at error correction ${level} (accented and non-Latin characters count as 2-3).`;
