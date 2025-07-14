// based on https://github.com/ai/nanoid/blob/main/index.browser.js

// alphabet has 64 chars so we get 63^<nChars> random numbers
// rough numbers:
// 63 ^ 4 = 15,752,961 == 15.7 million
// 63 ^ 5 = 992,436,543 == 992 million
// 63 ^ 6 = 62,523,502,209 == 62 billion
// 63 ^ 7 = 3,938,980,639,167== 3.9 trillion
// 63 ^ 8 = 248,155,780,267,521 == 248 trillion

const kNanoIDAlphabet =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
const kAlphabetMax = kNanoIDAlphabet.length - 1;

export function nanoid(size = 21) {
  let rv = crypto.getRandomValues(new Uint8Array(size));
  let res = "";
  for (let i = 0; i < rv.length; i++) {
    let byte = rv[i];
    // It is incorrect to use bytes exceeding the alphabet size.
    // The following mask reduces the random byte in the 0-255 value
    // range to the 0-63 value range. Therefore, adding hacks, such
    // as empty string fallback or magic numbers, is unneccessary because
    // the bitmask trims bytes down to the alphabet size
    let idx = byte & kAlphabetMax;
    res += kNanoIDAlphabet[idx];
  }
  return res;
}

/**
 * @param {number} n
 * @returns {string}
 */
export function genRandomID(n) {
  return nanoid(n);
}
