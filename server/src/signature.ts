import * as blake from "blakejs";

export function createSignature(text: string, filename: string): string {
  return blake.blake2sHex(text + "$$" + filename);
}
