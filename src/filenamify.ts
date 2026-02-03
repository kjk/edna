// https://github.com/sindresorhus/filename-reserved-regex/blob/main/index.js
// https://github.com/sindresorhus/filenamify/blob/main/filenamify.js
// https://gist.github.com/barbietunnie/7bc6d48a424446c44ff4

// those are strings are that are not valid names
// "con", "prn" etc. are for windows
const reInvalidFileNames = /^(con|prn|aux|nul|com\d|lpt|\.|\.\.|\d)$/i;

/**
 * escape each char code of the string as its %NNNN hex code
 * @param {string} s
 * @returns {string}
 */
function stringHexEscape(s) {
  let hexArray = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    let hex = c.toString(16).padStart(4, "0");
    let chex = "%" + hex;
    hexArray.push(chex);
  }
  return hexArray.join("");
}

// cc stands for "char code"
const cc0 = "0".charCodeAt(0);
const cc9 = "9".charCodeAt(0);
const cca = "a".charCodeAt(0);
const ccz = "z".charCodeAt(0);
const ccA = "A".charCodeAt(0);
const ccZ = "Z".charCodeAt(0);

// / ? < > \ : * | " <= those are not valid
// I also decided not to include: ; ` '
// % is used for escaping so also needs to be escaped
// in the order of ascii table https://www.cs.cmu.edu/~pattis/15-1XX/common/handouts/ascii.html
const charsNoEscape = " !#$()+,-.=@[]_()~";
/** @type {number[]} */
const ccNoEscape = Array(charsNoEscape.length);
for (let i = 0; i < charsNoEscape.length; i++) {
  ccNoEscape[i] = charsNoEscape.charCodeAt(i);
}

/**
 * return true if a given charCode (0-65536) needs to be escaped
 * when used in a file name
 * We're conservative i.e. we would rather encode more than stricly needed
 * then risk not encoding something we do need
 * @param {number} cc
 * @returns {boolean}
 */
function charCodeNeedsEscaping(cc) {
  if (cc >= cc0 && cc <= cc9) {
    return false;
  }
  if (cc >= cca && cc <= ccz) {
    return false;
  }
  if (cc >= ccA && cc <= ccZ) {
    return false;
  }
  return !ccNoEscape.includes(cc);
}

/**
 * @param {string} s
 * @returns {string}
 */
export function toFileName(s) {
  if (reInvalidFileNames.test(s)) {
    return stringHexEscape(s);
  }
  let n = s.length;
  /** @type {string[]} */
  let res = Array(n);
  for (let i = 0; i < n; i++) {
    let cc = s.charCodeAt(i);
    let s2 = String.fromCharCode(cc);
    if (charCodeNeedsEscaping(cc)) {
      s2 = stringHexEscape(s2);
    }
    res.push(s2);
  }
  s = res.join("");
  return s;
}

/**
 * returns null if s is not a valid encoded file name
 * @param {string} s
 * @returns {string}
 */
export function fromFileName(s) {
  if (!s.includes("%")) {
    // perf: fast path for when no char was encoded
    return s;
  }
  var res = "";
  let n = s.length;
  for (var i = 0; i < n; i++) {
    let c = s.charAt(i);
    if (c !== "%") {
      res += c;
      continue;
    }
    let hex = s.substring(i + 1, i + 5);
    let cc = parseInt(hex, 16);
    res += String.fromCharCode(cc);
    i += 4;
  }
  return res;
}

/**
 * returns true if file name is valid per our encoding
 * i.e. if decode => encode generates the same string
 * @param {string} s
 * @returns {boolean}
 */
export function isValidFileName(s) {
  let s2 = fromFileName(s);
  let s3 = toFileName(s2);
  return s3 == s;
}
