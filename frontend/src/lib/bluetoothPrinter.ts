// Printing to a Bluetooth thermal printer from the browser (Web Bluetooth:
// Chrome and Edge on Android, Windows, Mac and ChromeOS; not iPhones/iPads,
// not Firefox). Only printers with Bluetooth Low Energy show up; most recent
// 58/80 mm printers have it. Bytes come from lib/escpos.ts.

// The few Web Bluetooth types used here (TypeScript doesn't ship them)
interface Characteristic {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}
interface Service {
  getCharacteristics(): Promise<Characteristic[]>;
}
interface Server {
  connected: boolean;
  getPrimaryServices(): Promise<Service[]>;
}
export interface PrinterDevice {
  id: string;
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<Server>; disconnect(): void };
}
interface Bluetooth {
  requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<PrinterDevice>;
  getDevices?(): Promise<PrinterDevice[]>;
}

const bluetooth = (): Bluetooth | undefined => (navigator as unknown as { bluetooth?: Bluetooth }).bluetooth;

export const bluetoothSupported = () => Boolean(bluetooth());

// The data services thermal printers use (makers differ); a device's other
// services can't be opened unless they're listed here
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // most generic printers
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // many 58 mm printers
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip "transparent UART"
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
];

// Small writes: BLE packets carry about 20-500 bytes, and cheap printers
// drop data sent faster than they print
const CHUNK = 180;
const GAP_MS = 12;

export class PrinterError extends Error {}

let device: PrinterDevice | null = null;
let channel: Characteristic | null = null;

async function findChannel(server: Server): Promise<Characteristic> {
  for (const service of await server.getPrimaryServices()) {
    for (const c of await service.getCharacteristics()) {
      if (c.properties.writeWithoutResponse || c.properties.write) return c;
    }
  }
  throw new PrinterError("This device doesn't take print data. Pick the printer itself (often named after its model, like MPT-II or PT-210).");
}

async function open(chosen: PrinterDevice): Promise<Characteristic> {
  if (!chosen.gatt) throw new PrinterError("Couldn't connect to the printer.");
  try {
    const server = await chosen.gatt.connect();
    return await findChannel(server);
  } catch (e) {
    if (e instanceof PrinterError) throw e;
    throw new PrinterError("Couldn't connect. Check the printer is on and close by, and not connected to another phone.");
  }
}

// Asks the browser to show nearby Bluetooth devices; the user picks the printer
export async function choosePrinter(): Promise<PrinterDevice> {
  const bt = bluetooth();
  if (!bt) throw new PrinterError("This browser can't use Bluetooth printers. Use Chrome on Android or a computer.");
  let chosen: PrinterDevice;
  try {
    chosen = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") throw new PrinterError("No printer chosen.");
    throw new PrinterError("Bluetooth is off or not allowed. Turn it on and try again.");
  }
  channel = await open(chosen);
  device = chosen;
  return chosen;
}

export const connectedPrinter = () => (device?.gatt?.connected && channel ? device : null);

export function forgetPrinter() {
  device?.gatt?.disconnect();
  device = null;
  channel = null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends the bytes to the printer chosen this session (reconnecting if it dropped)
export async function sendToPrinter(bytes: Uint8Array, onProgress?: (fraction: number) => void): Promise<void> {
  if (!device) throw new PrinterError("Choose a printer first.");
  if (!device.gatt?.connected || !channel) channel = await open(device);
  const target = channel;
  const fast = target.properties.writeWithoutResponse && typeof target.writeValueWithoutResponse === "function";
  for (let at = 0; at < bytes.length; at += CHUNK) {
    const piece = bytes.slice(at, at + CHUNK);
    try {
      if (fast) await target.writeValueWithoutResponse!(piece);
      else await target.writeValue(piece);
    } catch {
      throw new PrinterError("The printer stopped answering. Check it has paper and is still on, then print again.");
    }
    onProgress?.(Math.min(1, (at + CHUNK) / bytes.length));
    if (fast) await wait(GAP_MS);
  }
}
