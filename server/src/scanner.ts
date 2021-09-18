import * as charset from "./charset";
import * as entropy from "./entropy";

const defaultThreshold = 20;

export function findEntropy(text: string): Array<string> {
  const lines = text.split("\n");

  let results: Array<string> = [];

  lines.forEach((line) => {
    const words = line.split(" ");

    words.forEach((word) => {
      const base64strings = getStringsOfSet(
        word,
        charset.base64,
        defaultThreshold
      );

      base64strings.forEach((bs) => {
        const b64entropy = entropy.shannon(bs, charset.base64);
        if (b64entropy > 4.5) {
          results.push(bs);
        }
      });

      const hexStrings = getStringsOfSet(word, charset.hex, defaultThreshold);

      hexStrings.forEach((hs) => {
        const hexEntropy = entropy.shannon(hs, charset.hex);

        if (hexEntropy > 3) {
          results.push(hs);
        }
      });
    });
  });

  return results;
}

function getStringsOfSet(
  word: string,
  charset: Array<string>,
  threshold: number
): Array<string> {
  let count: number = 0;
  let letters: string = "";
  let found: Array<string> = [];

  word.split("").forEach((char) => {
    if (charset.indexOf(char) >= 0) {
      letters += char;
      count++;
    } else {
      if (count > threshold) {
        found.push(letters);
      }
      letters = "";
      count = 0;
    }
  });

  if (count > threshold) {
    found.push(letters);
  }

  return found;
}
