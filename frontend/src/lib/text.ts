const encoder = new TextEncoder();

// Length in UTF-8 bytes, which is what QR codes and bcrypt count: plain English
// characters are 1 byte, accented and non-Latin ones 2-3
export const utf8ByteLength = (text: string) => encoder.encode(text).length;
