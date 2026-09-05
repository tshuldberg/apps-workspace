/**
 * Length-prefix framing for stream transports (MK-007).
 *
 * TCP delivers a byte stream, not messages: one send can arrive split across
 * several chunks, and several sends can arrive glued together. Every sync
 * message therefore travels as [4-byte big-endian length][payload], and the
 * decoder reassembles arbitrary chunk boundaries back into whole frames.
 *
 * Pure and platform-agnostic: used by the Node test backend and the
 * react-native-tcp-socket backend alike.
 */

/** Frames above this size are protocol violations (matches relay limits). */
export const MAX_FRAME_BYTES = 1024 * 1024; // 1 MiB

const HEADER_BYTES = 4;

/** Wrap a payload in a length-prefixed frame. */
export function encodeFrame(payload: Uint8Array): Uint8Array {
  if (payload.length > MAX_FRAME_BYTES) {
    throw new Error(`Frame of ${payload.length} bytes exceeds the ${MAX_FRAME_BYTES}-byte limit.`);
  }
  const frame = new Uint8Array(HEADER_BYTES + payload.length);
  new DataView(frame.buffer).setUint32(0, payload.length, false);
  frame.set(payload, HEADER_BYTES);
  return frame;
}

/**
 * Incremental frame decoder. Feed it raw stream chunks in arrival order; it
 * emits complete payloads. A frame that declares more than MAX_FRAME_BYTES
 * poisons the stream (throws) -- the connection should be closed.
 */
export class FrameDecoder {
  private buffer = new Uint8Array(0);

  /** Append a chunk and return every complete frame it finishes. */
  push(chunk: Uint8Array): Uint8Array[] {
    const combined = new Uint8Array(this.buffer.length + chunk.length);
    combined.set(this.buffer, 0);
    combined.set(chunk, this.buffer.length);
    this.buffer = combined;

    const frames: Uint8Array[] = [];
    while (this.buffer.length >= HEADER_BYTES) {
      const length = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(0, false);
      if (length > MAX_FRAME_BYTES) {
        this.buffer = new Uint8Array(0);
        throw new Error(`Incoming frame declares ${length} bytes, over the ${MAX_FRAME_BYTES}-byte limit.`);
      }
      if (this.buffer.length < HEADER_BYTES + length) break; // wait for more bytes
      frames.push(this.buffer.slice(HEADER_BYTES, HEADER_BYTES + length));
      this.buffer = this.buffer.slice(HEADER_BYTES + length);
    }
    return frames;
  }

  /** Bytes currently waiting for the rest of a frame. */
  get pendingBytes(): number {
    return this.buffer.length;
  }
}
