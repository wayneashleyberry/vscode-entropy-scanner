import { TextEncoder } from "util";

export function shannon(data: string, iterator: Array<string>): number {
  const len: number = new TextEncoder().encode(data).length;

  let entropy: number = 0.0;

  iterator.forEach((x) => {
    const count: number = data.split(x).length - 1;
    const px: number = count / len;
    if (px > 0) {
      entropy += -px * Math.log2(px);
    }
  });

  return entropy;
}
