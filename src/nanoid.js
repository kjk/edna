// based on https://github.com/ai/nanoid/blob/main/index.browser.js

// alphabet has 63 chars so we get 63^<nChars> random numbers
// rough numbers:
// 63 ^ 4 = 15,752,961 == 15.7 million
// 63 ^ 5 = 992,436,543 == 992 million
// 63 ^ 6 = 62,523,502,209 == 62 billion
// 63 ^ 7 = 3,938,980,639,167== 3.9 trillion
// 63 ^ 8 = 248,155,780,267,521 == 248 trillion

export function nanoid(size = 21) {
  let res = crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => {
    // It is incorrect to use bytes exceeding the alphabet size.
    // The following mask reduces the random byte in the 0-255 value
    // range to the 0-63 value range. Therefore, adding hacks, such
    // as empty string fallback or magic numbers, is unneccessary because
    // the bitmask trims bytes down to the alphabet size.
    byte &= 63;
    if (byte < 36) {
      // `0-9a-z`
      id += byte.toString(36);
    } else if (byte < 62) {
      // `A-Z`
      id += (byte - 26).toString(36).toUpperCase();
    } else if (byte > 62) {
      id += "-";
    } else {
      id += "_";
    }
    return id;
  }, "");
  return res;
}

/**
 * @param {number} n
 * @returns {string}
 */
export function genRandomID(n) {
  return nanoid(n);
}
