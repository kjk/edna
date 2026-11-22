// ----------------------------
/**
{
  "api":1,
  "name":"Add Slashes",
  "description":"Escapes your text.",
  "author":"Ivan",
  "icon":"quote",
  "tags":"add,slashes,escape"
}
**/

function main(input) {
  //  discuss at: http://locutus.io/php/addslashes/
  // original by: Kevin van Zonneveld (http://kvz.io)
  // improved by: Ates Goral (http://magnetiq.com)
  // improved by: marrtins
  // improved by: Nate
  // improved by: Onno Marsman (https://twitter.com/onnomarsman)
  // improved by: Brett Zamir (http://brett-zamir.me)
  // improved by: Oskar Larsson Högfeldt (http://oskar-lh.name/)
  //    input by: Denny Wardhana
  //   example 1: addslashes("kevin's birthday")
  //   returns 1: "kevin\\'s birthday"

  input.text = (input.text + "")
    .replace(/[\\"']/g, "\\$&")
    .replace(/\u0000/g, "\\0");
}
// ----------------------------
/**
{
  "api":1,
  "name":"Android Strings to iOS Localizables",
  "description":"Converts Android Strings to iOS localizables.",
  "author":"Manuel Kunz (https://github.com/KunzManuel)",
  "icon":"translation",
  "tags":"string,android,ios"
}
**/

function main(input) {
  let lines = input.fullText.split("\n");
  var result = [];
  lines.forEach((element) => {
    var temp = element;
    temp = temp.replace("<string name=", "");
    temp = temp.replace("</string>", '";');
    temp = temp.replace(">", ' = "');
    result.push(temp);
  });

  input.fullText = result.join("\n");
}

// ----------------------------
/**
{
  "api":1,
  "name":"ASCII To Hex",
  "description":"Converts ASCII characters to hexadecimal codes.",
  "author":"aWZHY0yQH81uOYvH",
  "icon":"metamorphose",
  "tags":"ascii,hex,convert"
}
**/

function main(state) {
  let buf = "";
  for (let i = 0; i < state.fullText.length; i++) {
    let code = state.fullText.charCodeAt(i).toString(16);
    if (code.length < 2) buf += "0";
    buf += code;
  }
  state.fullText = buf.toUpperCase();
}
// ----------------------------
/**
{
  "api":1,
  "name":"Base64 Decode",
  "description":"Decodes your text from Base64",
  "author":"See Source",
  "icon":"metamorphose",
  "tags":"base64,btoa,decode"
}
**/

function main(input) {
  input.text = atob(input.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Base64 Encode",
  "description":"Encodes your text to Base64",
  "author":"See Source",
  "icon":"metamorphose",
  "tags":"base64,atob,encode"
}
**/

function main(input) {
  input.text = btoa(input.text);
}
// ----------------------------
/**
{
  "api": 1,
  "name": "Binary to Decimal",
  "description": "Converts binary values to decimal.",
  "author": "Maurice",
  "icon": "metamorphose",
  "tags": "decimal,binary,dec,bin"
}
**/

function main(state) {
  var text = state.text;
  var lines = text.split(/\n/);
  var result = "";

  for (const index in lines) {
    var text = lines[index].trim();
    var decimal = parseInt(text, 2);

    if (isNaN(decimal)) {
      result += text;
    } else {
      result += decimal;
    }

    result += "\n";
  }

  state.text = result.trim();
}

// ----------------------------
/**
{
  "api":1,
  "name":"Camel Case",
  "description":"convertsYourTextToCamelCase",
  "author":"Ivan",
  "icon":"camel",
  "tags":"camel,case,function,lodash"
}
**/

async function main(input) {
  // @ts-ignore
  let lodash = (await import("https://esm.sh/lodash@4.17.21")).default;
  input.text = lodash.camelCase(input.text);
}

// ----------------------------
/**
{
  "api":1,
  "name":"Collapse lines",
  "description":"Removes all linebreaks from your text",
  "author":"Dennis",
  "icon":"collapse",
  "tags":"strip,remove,collapse,join"
}
**/

function main(input) {
  let split = input.text.split(/\r\n|\r|\n/);
  input.postInfo(`${split.length} lines collapsed`);
  input.fullText = split.join();
}

// ----------------------------
/**
{
  "api":1,
  "name":"Count Characters",
  "description":"Get the length of your text",
  "author":"Ivan",
  "icon":"counter",
  "tags":"count,length,size,character"
}
**/

async function main(input) {
  // @ts-ignore
  let lodash = (await import("https://esm.sh/lodash@4.17.21")).default;
  input.postInfo(`${lodash.size(input.text)} characters`);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Count Lines",
  "description":"Get the line count of your text",
  "author":"andipaetzold",
  "icon":"counter",
  "tags":"count,length,size,line"
}
**/

function main(input) {
  input.postInfo(`${input.text.split("\n").length} lines`);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Count Words",
  "description":"Get the word count of your text",
  "author":"Daniel Stone",
  "icon":"counter",
  "tags":"count,length,size,words"
}
**/
function main(input) {
  let words = input.text.trim().match(/\S+/g);
  input.postInfo(`${(words && words.length) || 0} words`);
}
// ----------------------------
/**
{
  "api":2,
  "name":"CSV to JSON",
  "description":"Converts comma-separated tables to JSON.",
  "author":"Ivan",
  "icon":"table",
  "tags":"table,convert",
  "bias": -0.2
}
**/

async function main(state) {
  // @ts-ignore
  let Papa = (await import("https://esm.sh/papaparse@5.4.1")).default;
  try {
    const { data } = Papa.parse(state.text, { header: true });
    state.text = JSON.stringify(data, null, 2);
  } catch (error) {
    state.postError("Invalid CSV");
  }
}

// ----------------------------
/**
{
  "api":1,
  "name":"Date to Timestamp",
  "description":"Converts dates to Unix timestamp.",
  "author":"Noah Halford",
  "icon":"watch",
  "tags":"date,time,calendar,unix,timestamp"
}
**/

function main(input) {
  let parsedDate = Date.parse(input.text);

  if (isNaN(parsedDate)) {
    input.postError("Invalid Date");
  } else {
    input.text = parsedDate / 1000;
  }
}

// ----------------------------
/**
{
  "api":1,
  "name":"Date to UTC",
  "description":"Converts dates and timestamps to UTC dates",
  "author":"Ivan",
  "icon":"watch",
  "tags":"date,time,calendar,unix,timestamp"
}
**/

function main(input) {
  let str = input.text;

  let parsedDate = Date.parse(str);
  let date;

  if (isNaN(parsedDate)) {
    let n = parseInt(str) * 1000;
    date = new Date(n);
  } else {
    date = new Date(parsedDate);
  }

  let out = date.toUTCString();

  if (out === "Invalid Date") {
    input.postError(out);
    return;
  }

  input.text = out;
}

// ----------------------------
/**
{
  "api":1,
  "name":"Deburr",
  "description":"Converts your text to basic latin characters.",
  "author":"Ivan",
  "icon":"colosseum",
  "tags":"burr,special,characters,function,lodash"
}
**/

async function main(input) {
  // @ts-ignore
  let lodash = (await import("https://esm.sh/lodash@4.17.21")).default;
  input.text = lodash.deburr(input.text);
}

// ----------------------------
/**
{
  "api": 1,
  "name": "Decimal to Binary",
  "description": "Converts decimal values to binary.",
  "author": "Maurice",
  "icon": "metamorphose",
  "tags": "decimal,binary,dec,bin"
}
**/

function main(state) {
  var text = state.text;
  var lines = text.split(/\n/);
  var result = "";

  for (const index in lines) {
    var text = lines[index].trim();
    var bin = parseInt(text);

    if (isNaN(bin)) {
      result += text;
    } else {
      result += bin.toString(2).toUpperCase();
    }

    result += "\n";
  }

  state.text = result.trim();
}

// ----------------------------
/**
{
  "api": 1,
  "name": "Decimal to Hex",
  "description": "Converts decimal values to hexadecimal.",
  "author": "Maurice",
  "icon": "metamorphose",
  "tags": "decimal,hexadecimal,dec,hex"
}
**/

function main(state) {
  var text = state.text;
  var lines = text.split(/\n/);
  var result = "";

  for (const index in lines) {
    var text = lines[index].trim();

    if (isNaN(text)) {
      result += text;
    } else {
      result += parseInt(text).toString(16).toUpperCase();
    }

    result += "\n";
  }

  state.text = result.trim();
}

// ----------------------------
/**
{
  "api":1,
  "name":"Downcase",
  "description":"Converts your text to lowercase.",
  "author":"Dan2552",
  "icon":"type",
  "tags":"downcase,lowercase"
}
**/

function main(input) {
  input.text = input.text.toLowerCase();
}

// ----------------------------
/**
{
  "api":1,
  "name":"Eval Javascript",
  "description":"Runs your text as Javascript Code.",
  "author":"Sebastiaan Besselsen",
  "icon":"command",
  "tags":"js,script,run"
}
 **/

function main(input) {
  const script = input.text.replace(/\n\n\/\/ Result:[\s\S]*$/, "");

  let output = "";
  try {
    output = eval(script);
    if (typeof output !== "string") {
      output = JSON.stringify(output, null, 2);
    }
  } catch (e) {
    input.postError(e.toString());
  }

  input.text = script + "\n\n// Result:\n\n" + output;
}

// ----------------------------
/**
{
  "api": 1,
  "name": "Fish PATH Hex Converter",
  "description": "Escapes terminal characters.",
  "author": "Paul Seelman",
  "icon": "broom",
  "tags": "fish_user_paths, fish, hex, ascii, path, var"
}
**/
function convert(string) {
  var chars = string.split("");
  var dict = {
    " ": ":",
    "%": "25",
    "&": "26",
    "+": "2b",
    "-": "2d",
    ".": "2e",
    "*": "2a",
    ":": "3a",
    "@": "40",
    ";": "3b",
  };

  for (var i = chars.length - 1; i >= 0; i--) {
    var char = chars[i];
    var hex = dict[char];

    if (hex !== undefined) {
      var slash_x = "\\x";
      chars[i] = slash_x.concat(hex);
    }
  }

  return chars.join("");
}

function main(input) {
  input.text = convert(input.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Format JSON",
  "description":"Cleans and format JSON documents.",
  "author":"Ivan",
  "icon":"broom",
  "tags":"json,prettify,clean,indent"
}
**/

function main(state) {
  try {
    // I feel like this should have a real parser/formatter
    // but hey, it works so who am I to judge?
    state.text = JSON.stringify(JSON.parse(state.text), null, 2);
  } catch (error) {
    state.postError("Invalid JSON");
  }
}
// ----------------------------
/**
{
  "api":1,
  "name":"Hex to RGB",
  "description":"Convert color in hexadecimal to RGB.",
  "author":"Venkat",
  "icon":"color-wheel",
  "tags":"hex,color,rgb,convert"
}
 **/

function main(input) {
  let R = hexToR(input.text);
  let G = hexToG(input.text);
  let B = hexToB(input.text);

  input.text = R.toString()
    .concat(",")
    .concat(G.toString())
    .concat(",")
    .concat(B.toString());
}

function hexToR(h) {
  return parseInt(cutHex(h).substring(0, 2), 16);
}
function hexToG(h) {
  return parseInt(cutHex(h).substring(2, 4), 16);
}
function hexToB(h) {
  return parseInt(cutHex(h).substring(4, 6), 16);
}
function cutHex(h) {
  return h.charAt(0) == "#" ? h.substring(1, 7) : h;
}
// ----------------------------
/**
{
  "api":1,
  "name":"Hex To ASCII",
  "description":"Converts hexadecimal values into ASCII characters",
  "author":"aWZHY0yQH81uOYvH",
  "icon":"metamorphose",
  "tags":"hex,ascii,convert"
}
**/

function main(state) {
  let input = state.fullText.toUpperCase();
  let buf = "";
  let hexBuf = "";
  for (let i = 0; i < input.length; i++) {
    let c = input.charAt(i);
    if ("0123456789ABCDEF".includes(c)) {
      hexBuf += c;
      if (hexBuf.length >= 2) {
        buf += String.fromCharCode(parseInt(hexBuf, 16));
        hexBuf = "";
      }
    } else if (c != " " && c != "\t" && c != "\n" && c != "\r") {
      state.postError("Text is not hex");
      throw "Not hex";
    }
  }
  state.fullText = buf;
}

// ----------------------------
/**
{
  "api": 1,
  "name": "Hex to Dec",
  "description": "Converts hexadecimal to decimal.",
  "author": "Maurice",
  "icon": "metamorphose",
  "tags": "decimal,hexadecimal,dec,hex"
}
**/

function main(state) {
  var text = state.text;
  var lines = text.split(/\n/);
  var result = "";

  for (const index in lines) {
    var text = lines[index].trim();
    var decimal = parseInt(text, 16);

    if (isNaN(decimal)) {
      result += text;
    } else {
      result += decimal;
    }

    result += "\n";
  }

  state.text = result.trim();
}

// ----------------------------
/**
{
  "api":1,
  "name":"HTML Decode",
  "description":"Decodes HTML entities in your text",
  "author":"See Source",
  "icon":"HTML",
  "tags":"html,decode,web"
}
**/

async function main(input) {
  // @ts-ignore
  let he = await import("https://esm.sh/html-entities@2.5.2");
  input.text = he.decode(input.text);
}

// ----------------------------
/**
{
  "api":1,
  "name":"HTML Encode",
  "description":"Encodes HTML entities in your text",
  "author":"See Source",
  "icon":"HTML",
  "tags":"html,encode,web"
}
**/

async function main(input) {
  // @ts-ignore
  let he = await import("https://esm.sh/html-entities@2.5.2");
  input.text = he.encode(input.text);
}

// ----------------------------
/**
{
  "api":1,
  "name":"HTML Encode all characters",
  "description":"HTML Encodes every character in your text",
  "author":"Ivan",
  "icon":"HTML",
  "tags":"html,encode,web,email",
  "bias":-0.1
}
**/

function main(input) {
  let str = input.text;
  var out = "";
  for (var i = 0; i < str.length; i++) {
    out += `&#${str.charCodeAt(i)};`;
  }
  input.text = out;
}

// ----------------------------
/**
{
  "api":1,
  "name":"iOS Localizables to Android Strings",
  "description":"Converts iOS Localizables to Android Strings",
  "author":"Manuel Kunz (https://github.com/KunzManuel)",
  "icon":"translation",
  "tags":"string,android,ios"
}
**/

function main(input) {
  let lines = input.fullText.split("\n");
  var result = [];
  lines.forEach((element) => {
    if (element !== "") {
      var regex = /"(.*?)"/g;
      var matches = [];
      var match = regex.exec(element);
      while (match != null) {
        matches.push(match[1]);
        match = regex.exec(element);
      }
      result.push(
        '<string name="' + matches[0] + '">' + matches[1] + "</string>",
      );
    }
  });
  input.fullText = result.join("\n");
}

// ----------------------------
/**
{
  "api":1,
  "name":"JSON to CSV",
  "description":"Converts JSON to comma-separated tables.",
  "author":"Ivan",
  "icon":"table",
  "tags":"table,convert",
      "bias": -0.2
}
**/

// Inspired by https://stackoverflow.com/a/31536517/2053038
// Note: it would be good to escape commas, and maybe not just get keys from the first object.

function main(state) {
  try {
    const delimiter = ",";
    const data = JSON.parse(state.text);
    const replacer = (_, value) => (value === null ? "" : value);
    const header = Object.keys(data[0]);
    let csv = data.map((row) =>
      header
        .map((fieldName) => JSON.stringify(row[fieldName], replacer))
        .join(delimiter),
    );
    csv.unshift(header.join(delimiter));
    state.text = csv.join("\r\n");
  } catch (error) {
    state.postError("Invalid JSON.");
  }
}

// ----------------------------
/**
{
  "api":1,
  "name":"JSON to Query String",
  "description":"Converts JSON to URL query string.",
  "author":"Ota Mares <ota@mares.one>",
  "icon":"website",
  "tags":"url,query,params,json,convert,encode"
}
**/

/**
 * Credit goes to https://stackoverflow.com/a/1714899
 */
function convertToQuery(obj, prefix) {
  let queryParts = [];

  for (let param in obj) {
    if (obj.hasOwnProperty(param)) {
      let key = prefix ? prefix + "[]" : param;
      let value = obj[param];

      queryParts.push(
        value !== null && typeof value === "object"
          ? convertToQuery(value, key)
          : key + "=" + value,
      );
    }
  }

  return queryParts.join("&");
}

function main(input) {
  try {
    input.text = convertToQuery(JSON.parse(input.text));
  } catch (error) {
    input.postError("Unable to convert JSON to URL params");
  }
}

// ----------------------------
/**
{
  "api":1,
  "name":"JSON to YAML",
  "description":"Converts JSON to YAML.",
  "author":"Ivan",
  "icon":"metamorphose",
  "tags":"markup,convert"
}
**/

async function main(input) {
  // @ts-ignore
  const yaml = (await import("https://esm.sh/js-yaml@4.1.0")).default;
  try {
    input.text = yaml.safeDump(JSON.parse(input.text));
  } catch (error) {
    input.postError("Invalid JSON");
  }
}
// ----------------------------
/**
{
  "api":1,
  "name":"JWT Decode",
  "description":"Converts JWTs to JSON",
  "author":"Nils Sonemann",
  "icon":"identification",
  "tags":"decode,jwt,token"
}
**/

function main(input) {
  var t = input.text;
  var jwtParts = t.split(".");
  if (jwtParts.length != 3) {
    input.postError("Invalid Token");
    return;
  }

  var header = atob(jwtParts[0]);
  var payload = atob(jwtParts[1]);
  var signature = jwtParts[2];

  try {
    var fullJson = {
      header: JSON.parse(header),
      payload: JSON.parse(payload),
      signature: signature,
    };

    // Prettyprint the JSOM
    input.text = JSON.stringify(fullJson, null, 2);
  } catch (err) {
    input.postError("Error while parsing JSON");
  }
}

// ----------------------------
/**
{
  "api":1,
  "name":"Kebab Case",
  "description":"converts-your-text-to-kebab-case.",
  "author":"Ivan",
  "icon":"kebab",
  "tags":"kebab,case,function,lodash"
}
**/

async function main(input) {
  // @ts-ignore
  let lodash = (await import("https://esm.sh/lodash@4.17.21")).default;
  input.text = lodash.kebabCase(input.text);
}

// ----------------------------
/**
{
  "api":1,
  "name":"Lorem Ipsum",
  "description":"Generates Lorem Ipsum placeholder text.",
  "author":"luisfontes19",
  "icon":"type",
  "tags":"generate,lorem,ipsum,text",
  "bias": -0.1
}
**/

function main(state) {
  const words = [
    "ad",
    "adipisicing",
    "aliqua",
    "aliquip",
    "amet",
    "anim",
    "aute",
    "cillum",
    "commodo",
    "consectetur",
    "consequat",
    "culpa",
    "cupidatat",
    "deserunt",
    "do",
    "dolor",
    "dolore",
    "duis",
    "ea",
    "eiusmod",
    "elit",
    "enim",
    "esse",
    "est",
    "et",
    "eu",
    "ex",
    "excepteur",
    "exercitation",
    "fugiat",
    "id",
    "in",
    "incididunt",
    "ipsum",
    "irure",
    "labore",
    "laboris",
    "laborum",
    "Lorem",
    "magna",
    "minim",
    "mollit",
    "nisi",
    "non",
    "nostrud",
    "nulla",
    "occaecat",
    "officia",
    "pariatur",
    "proident",
    "qui",
    "quis",
    "reprehenderit",
    "sint",
    "sit",
    "sunt",
    "tempor",
    "ullamco",
    "ut",
    "velit",
    "veniam",
    "voluptate",
  ];
  let sentence = "";

  for (let i = 0; i < 100; i++) {
    const pos = Math.floor(Math.random() * (words.length - 1));
    sentence += words[pos] + " ";
  }

  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1).trim() + ".";

  state.text = sentence;
}

// ----------------------------
/**
{
  "api":1,
  "name":"Markdown Quote",
  "description":"Adds > to the start of every line of your text.",
  "author":"Dan2552",
  "icon":"term",
  "tags":"quote,markdown"
}
**/

function main(input) {
  input.text = input.text
    .split("\n")
    .map((line) => "> " + line)
    .join("\n");
}

// ----------------------------
/**
{
  "api":1,
  "name":"MD5 Checksum",
  "description":"Computes the checksum of your text (Hex encoded).",
  "author":"Ivan",
  "icon":"fingerprint",
  "tags":"strip,slashes,remove"
}
**/

async function main(state) {
  // @ts-ignore
  let md5 = (await import("https://esm.sh/js-md5@0.8.3")).default;
  state.text = md5.hex(state.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Minify JSON",
  "description":"Cleans and minifies JSON documents.",
  "author":"riesentoaster",
  "icon":"broom",
  "tags":"html,minify,clean,indent",
  "bias": -0.1
}
**/

function main(input) {
  input.text = JSON.stringify(JSON.parse(input.text));
}
// ----------------------------
/**
{
  "api":1,
  "name":"Natural Sort Lines",
  "description":"Sort lines with smart handling of numbers.",
  "author":"Sebastiaan Besselsen",
  "icon":"sort-numbers",
  "tags":"sort,natural,natsort"
}
 **/

function main(input) {
  let sorted = input.text
    .replace(/\n$/, "")
    .split("\n")
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    )
    .join("\n");

  if (sorted === input.text) {
    sorted = sorted.split("\n").reverse().join("\n");
  }
  input.text = sorted;
}
// ----------------------------
/**
{
  "api":1,
  "name":"PHP Unserialize",
  "description":"Convert PHP serialized data to JSON",
  "author":"Rob Bogie",
  "icon":"elephant",
  "tags":"php,serialize,unserialize,json"
}
**/

function main(state) {
  try {
    const input = state.text;
    const unserialized = unserialize(input);
    const data = unserialized[0];

    if (unserialized[1] != input.length) {
      throw new Error("Invalid serialized string");
    }

    if (data === null || data === undefined) {
      state.text = null;
    } else if (typeof data === "object") {
      state.text = JSON.stringify(data, null, 2);
    } else {
      state.text = data.toString();
    }
  } catch (e) {
    state.postError(e.message);
  }
}

function decodeInt(text, startPos) {
  const lastChar = text.indexOf(";", startPos);
  if (lastChar <= 0) {
    throw new Error("decodeInt: unexpected end of string");
  }
  return [Number.parseInt(text.slice(startPos, lastChar)), lastChar + 1];
}

function decodeBool(text, startPos) {
  const lastChar = text.indexOf(";", startPos);
  if (lastChar != startPos + 1) {
    throw new Error("decodeBool: unexpected data length");
  }
  switch (text.charAt(startPos)) {
    case "0":
      return [false, startPos + 2];
    case "1":
      return [true, startPos + 2];
    default:
      throw new Error("decodeBool: found unexpected data");
  }
}

function decodeFloat(text, startPos) {
  const lastChar = text.indexOf(";", startPos);
  if (lastChar <= 0) {
    throw new Error("decodeFloat: unexpected end of string");
  }
  return [Number.parseFloat(text.slice(startPos, lastChar)), lastChar + 1];
}

function decodeString(text, startPos) {
  const lengthEnd = text.indexOf(":", startPos);
  if (lengthEnd <= 0) {
    throw new Error("decodeString: no string length found");
  }
  const byteLength = Number.parseInt(text.slice(startPos, lengthEnd));

  startPos = lengthEnd + 2;
  let currentStrLength = 0;
  let numBytes = 0;
  while (currentStrLength + startPos < text.length && numBytes < byteLength) {
    const nextPos =
      text.indexOf('";', startPos + currentStrLength + 1) - startPos;
    if (nextPos > currentStrLength) {
      currentStrLength = nextPos;
    } else {
      // No end will be found anymore, exit and do our safety checks as if we reached the end
      break;
    }

    const subStr = text.slice(startPos, startPos + currentStrLength);
    try {
      const encodedStr = encodeURI(subStr);
      numBytes = encodedStr.split(/%..|./).length - 1;
    } catch (e) {
      // encodeURI will fail when an invalid UTF16 character is found, which happens with 4 byte characters (e.g. emoji)
      // We will simply try again on the next position
    }
  }

  if (numBytes != byteLength) {
    throw new Error("Could not decode string: field length mismatch");
  }

  return [
    text.slice(startPos, startPos + currentStrLength),
    startPos + currentStrLength + 2,
  ];
}

function decodeArray(text, startPos) {
  const lengthEnd = text.indexOf(":", startPos);
  if (lengthEnd <= 0) {
    throw new Error("decodeArray: no arraylength found");
  }
  const numItems = Number.parseInt(text.slice(startPos, lengthEnd));
  let data = {};
  startPos = lengthEnd + 2;
  let continuous = true;
  for (let i = 0; i < numItems; i++) {
    const keyData = unserialize(text, startPos);
    const valueData = unserialize(text, keyData[1]);
    startPos = valueData[1];

    if (keyData[0] !== i) {
      continuous = false;
    }

    data[keyData[0]] = valueData[0];
  }

  if (continuous) {
    // Convert non key-value maps to array
    const array = new Array(numItems);
    for (let i = 0; i < numItems; i++) {
      array[i] = data[i];
    }
    data = array;
  }
  return [data, startPos + 1];
}

function decodeObject(text, startPos) {
  const classNameLengthEnd = text.indexOf(":", startPos);
  if (classNameLengthEnd <= 0) {
    throw new Error("decodeObject: no arraylength found");
  }
  const classNameLength = Number.parseInt(
    text.slice(startPos, classNameLengthEnd),
  );
  startPos = classNameLengthEnd + 2;
  if (
    classNameLength !== 8 ||
    text.slice(startPos, startPos + 8) !== "stdClass"
  ) {
    throw new Error("decodeObject: object type not supported");
  }

  startPos += 10;

  return decodeArray(text, startPos);
}

function unserialize(text, startPos = 0) {
  const type = text[startPos];
  switch (type) {
    case "i":
      return decodeInt(text, startPos + 2);
    case "b":
      return decodeBool(text, startPos + 2);
    case "N":
      return [null, startPos + 2];
    case "d":
      return decodeFloat(text, startPos + 2);
    case "s":
      return decodeString(text, startPos + 2);
    case "a":
      return decodeArray(text, startPos + 2);
    case "O":
      return decodeObject(text, startPos + 2);
    default:
      throw new Error("unknown type found: " + type + " at " + startPos);
  }
}
// ----------------------------
/**
{
  "api":1,
  "name":"Query String to JSON",
  "description":"Converts URL query string to JSON.",
  "author":"Ota Mares <ota@mares.one>",
  "icon":"website",
  "tags":"url,query,params,json,convert,decode"
}
**/

function convertToJson(urlParams) {
  return urlParams
    .replace(/\[\d?\]=/gi, "=")
    .split("&")
    .reduce((result, param) => {
      var [key, value] = param.split("=");
      value = decodeURIComponent(value || "");

      if (!result.hasOwnProperty(key)) {
        result[key] = value;

        return result;
      }

      result[key] = [...[].concat(result[key]), value];

      return result;
    }, {});
}

function main(input) {
  try {
    input.text = JSON.stringify(convertToJson(input.text));
  } catch (error) {
    input.postError("Unable to parse given string");
  }
}
// ----------------------------
/**
{
  "api":1,
  "name":"Remove Duplicate Lines",
  "description":"Ensures each line of your text is unique.",
  "author":"andipaetzold",
  "icon":"filtration",
  "tags":"unique,duplicate"
}
**/

function main(input) {
  let lines = input.text.split("\n");
  let out = unique(lines);

  input.text = out.join("\n");

  input.postInfo(`${lines.length - out.length} lines removed`);
}

function unique(array) {
  return [...new Set(array)];
}
// ----------------------------
/**
{
  "api":1,
  "name":"Remove Slashes",
  "description":"Unescapes your text.",
  "author":"Ivan",
  "icon":"quote",
  "tags":"strip,slashes,remove,unescape"
}
**/

function main(input) {
  //       discuss at: http://locutus.io/php/stripslashes/
  //      original by: Kevin van Zonneveld (http://kvz.io)
  //      improved by: Ates Goral (http://magnetiq.com)
  //      improved by: marrtins
  //      improved by: rezna
  //         fixed by: Mick@el
  //      bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
  //      bugfixed by: Brett Zamir (http://brett-zamir.me)
  //         input by: Rick Waldron
  //         input by: Brant Messenger (http://www.brantmessenger.com/)
  // reimplemented by: Brett Zamir (http://brett-zamir.me)
  //        example 1: stripslashes('Kevin\'s code')
  //        returns 1: "Kevin's code"
  //        example 2: stripslashes('Kevin\\\'s code')
  //        returns 2: "Kevin\'s code"

  input.text = (input.text + "").replace(/\\(.?)/g, function (s, n1) {
    switch (n1) {
      case "\\":
        return "\\";
      case "0":
        return "\u0000";
      case "":
        return "";
      default:
        return n1;
    }
  });
}
// ----------------------------
/**
{
  "api":1,
  "name":"Replace Smart Quotes",
  "description":"Replace Smart Quotes with their simpler values.",
  "author":"Thomas Bauer (https://github.com/tbauer428)",
  "icon":"broom",
      "tags":"smart,quotes,quotations,quotation,smart-quotes,smart-quotations"
}
**/

function main(input) {
  input.text = input.text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/“”/g, '"');
}

// ----------------------------
/**
{
  "api":1,
  "name":"Reverse Lines",
  "description":"Flips every line of your text.",
  "author":"@Clarko",
  "icon":"flip",
  "tags":"reverse,order,invert,mirror,flip,upside,down"
}
**/

function main(input) {
  input.text = input.text.split("\n").reverse().join("\n");
}
// ----------------------------
/**
{
  "api":1,
  "name":"Reverse String",
  "description":"!seod ti tahw sseuG",
  "author":"See Source",
  "icon":"flip",
  "tags":"flip,mirror,invert"
}
**/

function main(input) {
  input.text = reverse(input.text);
}

/* 
	Snippet from https://github.com/mathiasbynens/esrever
	
	Copyright Mathias Bynens <https://mathiasbynens.be/>
	
	Permission is hereby granted, free of charge, to any person obtaining
	a copy of this software and associated documentation files (the
	"Software"), to deal in the Software without restriction, including
	without limitation the rights to use, copy, modify, merge, publish,
	distribute, sublicense, and/or sell copies of the Software, and to
	permit persons to whom the Software is furnished to do so, subject to
	the following conditions:
	
	The above copyright notice and this permission notice shall be
	included in all copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
	LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
	OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
	WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

var regexSymbolWithCombiningMarks =
  /([\0-\u02FF\u0370-\u1AAF\u1B00-\u1DBF\u1E00-\u20CF\u2100-\uD7FF\uE000-\uFE1F\uFE30-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])([\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+)/g;
var regexSurrogatePair = /([\uD800-\uDBFF])([\uDC00-\uDFFF])/g;

var reverse = function (string) {
  // Step 1: deal with combining marks and astral symbols (surrogate pairs)
  string = string
    // Swap symbols with their combining marks so the combining marks go first
    .replace(regexSymbolWithCombiningMarks, function ($0, $1, $2) {
      // Reverse the combining marks so they will end up in the same order
      // later on (after another round of reversing)
      return reverse($2) + $1;
    })
    // Swap high and low surrogates so the low surrogates go first
    .replace(regexSurrogatePair, "$2$1");
  // Step 2: reverse the code units in the string
  var result = [];
  var index = string.length;
  while (index--) {
    result.push(string.charAt(index));
  }
  return result.join("");
};
// ----------------------------
/**
{
  "api":1,
  "name":"Rot13",
  "description":"Applies the Rot13 cypher to your text.",
  "author":"Paul Starr",
  "icon":"roman",
  "tags":"spoilers,encryption,plaintext"
}
**/

function main(state) {
  let myText = state.text;
  // adapted from Sophie Alpert's solution: https://stackoverflow.com/questions/617647/where-is-my-implementation-of-rot13-in-javascript-going-wrong
  state.text = myText.replace(/[a-z]/gi, function (c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26,
    );
  });
  return state;
}
// ----------------------------
/**
{
  "api":1,
  "name":"SHA1 Hash",
  "description":"Computes the SHA1 hash of your text (Hex encoded)",
  "icon":"fingerprint",
  "tags":"strip,slashes,remove"
}
**/

async function main(state) {
  // @ts-ignore
  let sha1 = (await import("https://esm.sh/js-sha1@0.7.0")).default;
  state.text = sha1.hex(state.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"SHA256 Hash",
  "description":"Computes the SHA256 hash of your text (Hex encoded)",
  "icon":"fingerprint",
  "tags":"strip,slashes,remove"
}
**/

async function main(state) {
  // @ts-ignore
  let sha256 = (await import("https://esm.sh/js-sha256@0.11.0")).default;
  state.text = sha256.hex(state.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"SHA512 Hash",
  "description":"Computes the SHA512 hash of your text (Hex encoded)",
  "icon":"fingerprint",
  "tags":"strip,slashes,remove"
}
**/

async function main(state) {
  // @ts-ignore
  let sha512 = (await import("https://esm.sh/js-sha512@0.9.0")).default;
  state.text = sha512.hex(state.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Shuffle Lines",
  "description":"Randomize each line of your text.",
  "author":"@Clarko",
  "icon":"dice",
  "tags":"shuffle,random"
}
**/

function main(input) {
  let lines = input.text.split("\n");
  let j = lines.length;

  // Fisher-Yates Shuffle
  while (j) {
    let i = Math.floor(Math.random() * j--);
    let temp = lines[j];
    lines[j] = lines[i];
    lines[i] = temp;
  }

  input.text = lines.join("\n");
}
// ----------------------------
/**
{
  "api":1,
  "name":"Snake Case",
  "description":"converts_your_text_to_snake_case.",
  "author":"Ivan",
  "icon":"snake",
  "tags":"snake,case,function,lodash"
}
**/

async function main(input) {
  // @ts-ignore
  let lodash = (await import("https://esm.sh/lodash@4.17.21")).default;
  input.text = lodash.snakeCase(input.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Sort lines",
  "description":"Sort lines alphabetically.",
  "author":"Sebastiaan Besselsen",
  "icon":"sort-characters",
  "tags":"sort,alphabet"
}
**/

function main(input) {
  let sorted = input.text
    .replace(/\n$/, "")
    .split("\n")
    .sort((a, b) => a.localeCompare(b))
    .join("\n");

  if (sorted === input.text) {
    sorted = sorted.split("\n").reverse().join("\n");
  }
  input.text = sorted;
}
// ----------------------------
/**
{
  "api":1,
  "name":"Sort JSON",
  "description":"Sort JSON",
  "author":"MaDnh",
  "icon":"sort-characters",
  "tags":"json,sort"
}
**/

function main(state) {
  let value = state.text;

  try {
    value = JSON.parse(value);
  } catch (e) {
    state.postError("Invalid JSON");
    return;
  }

  value = sort(value);

  state.text = JSON.stringify(value, null, 2);
}

function sort(obj) {
  if (obj instanceof Array) {
    let out = obj.map((item) => sort(item));
    out.sort((a, b) => {
      let fa = JSON.stringify(a),
        fb = JSON.stringify(b);

      if (fa < fb) {
        return -1;
      }
      if (fa > fb) {
        return 1;
      }
      return 0;
    });
    return out;
  }

  if (!isPlainObject(obj)) {
    return obj;
  }

  const result = {};
  const keys = Object.keys(obj);

  keys.sort();
  keys.forEach((key) => {
    result[key] = sort(obj[key]);
  });

  return result;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
// ----------------------------
/**
{
  "api": 1,
  "name": "Sponge Case",
  "description": "CoNvERtS yoUR Text To A HIghER fOrM Of CoMMUnICAtIOn",
  "author": "Paul Seelman",
  "icon": "pineapple",
  "tags": "bob,sarcasm,no,this,is,patrick"
}
**/
function spongeText(string) {
  const chars = string.split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * Math.floor(2));
    if (j == 0) {
      chars[i] = chars[i].toLowerCase();
    } else {
      chars[i] = chars[i].toUpperCase();
    }
  }

  return chars.join("");
}

function main(input) {
  input.text = spongeText(input.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Start Case",
  "description":"Converts Your Text To Start Case.",
  "author":"Ivan",
  "icon":"type",
  "tags":"start,case,function,lodash"
}
**/

async function main(input) {
  // @ts-ignore
  let lodash = (await import("https://esm.sh/lodash@4.17.21")).default;
  input.text = lodash.startCase(input.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Sum All",
  "description":"Sums up a list of numbers.",
  "author":"Annie Tran",
  "icon":"abacus",
  "tags":"sum,calculator,addition,add"
}
**/

function main(input) {
  if (!input.text) {
    input.postError("");
  } else {
    input.text = calculate(input.text);
  }
}

function looksLikeFraction(s) {
  return /^[\d\.]+\/[\d\.]+$/.test(s);
}

function getFraction(s) {
  const frac = s.split("/");
  return frac[0] / frac[1];
}

function getNumber(s) {
  if (looksLikeFraction(s)) {
    return getFraction(s);
  }
  return isNaN(Number(s)) ? "" : Number(s);
}

function numStringToArray(s) {
  return s
    .replace(/\/\/.*/g, "")
    .split(/[\n\s,;=]/g)
    .map((e) => (getNumber(e) ? getNumber(e) : ""))
    .filter(Boolean);
}

function calculate(s) {
  const comment = "\t// ";
  const numbers = numStringToArray(s);

  var sumOutput = numbers.reduce((a, b) => a + b);

  if (numbers.length > 1) {
    sumOutput += comment + numbers.join(" + ");
  }

  return s
    .split(/[\n,;]/g)
    .map((e) => {
      e = e.trim();
      if (
        e.charAt(0) === "=" ||
        e === "" ||
        e.toString() === Number(e).toString()
      ) {
        return e;
      }
      return `${e}${getNumber(e) && comment + getNumber(e)}`;
    })
    .concat("\n= " + sumOutput)
    .join("\n");
}
// ----------------------------
/**
{
  "api":1,
  "name":"Test Script",
  "description":"Testing script",
  "author":"Ivan",
  "icon":"flask",
  "tags":"test,test,one,two"
}
**/

function main(input) {
  input.postInfo("Hello this is a test!");

  input.fullText = `Hello, World! Let's try some syntax highlighting shall we?

var test: String? = "Toast"

{
    "name": "Boop",
    "type": "software",
    "info": {
        "tags": ["software", "editor"]
    },
    "useful": false,
    "version": 1.2345e-10
}

The MD5 of \`truth\` is 68934a3e9455fa72420237eb05902327
    
SELECT "Hello" FROM table LIMIT 2

/*
 haha you can't see me 👻
*/
    
if(false) return;  // this doesn't work
    
This line was added on Fri, 19 Jun 2020 01:01:30 GMT
    
<div class="hello">World</div>
    

"This is quote-unquote \\"escaped\\" if you will."
`;
}
// ----------------------------
/**
{
  "api":1,
  "name":"Trim",
  "description":"Trims leading and trailing whitespace.",
  "author":"Joshua Nozzi",
  "icon":"scissors",
  "tags":"trim,whitespace,empty,space"
}
**/

function main(state) {
  state.text = state.text.trim();
}
// ----------------------------
/**
{
  "api":1,
  "name":"Upcase",
  "description":"Converts your text to uppercase.",
  "author":"Dan2552",
  "icon":"type",
  "tags":"upcase,uppercase,capital,capitalize,capitalization"
}
**/

function main(input) {
  input.text = input.text.toUpperCase();
}
// ----------------------------
/**
{
  "api":1,
  "name":"URL Decode",
  "description":"Decodes URL entities in your text.",
  "author":"Ivan",
  "icon":"link",
  "tags":"url,decode,convert"
}
**/

function main(input) {
  input.text = decodeURIComponent(input.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Defang",
  "description":"Defangs dangerous URLs and other IOCs",
  "author":"Ross",
  "icon":"link",
  "tags":"defang,url,ioc"
}
**/

function main(input) {
  let url = input.text;
  url = url.replace(/\./g, "[.]");
  url = url.replace(/http/gi, "hXXp");
  url = url.replace(/:\/\//g, "[://]");
  input.text = url;
}
// ----------------------------
/**
{
  "api":1,
  "name":"URL Encode",
  "description":"Encodes URL entities in your text.",
  "author":"Ivan",
  "icon":"link",
  "tags":"url,encode,convert"
}
**/

function main(input) {
  input.text = encodeURIComponent(input.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"URL Entities Decode",
  "description":"URL Decodes all characters in your text.",
  "author":"luisfontes19",
  "icon":"percentage",
  "tags":"url,decode,full",
  "bias": -0.1
}
**/

function fullUrlDecode(str) {
  var codes = str.split("%");
  var decoded = "";

  for (var i = 0; i < codes.length; i++) {
    decoded += String.fromCharCode(parseInt(codes[i], 16));
  }

  return decoded;
}

function main(state) {
  state.text = fullUrlDecode(state.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"URL Entity Encode",
  "description":"URL Encodes all characters in your text.",
  "author":"luisfontes19",
  "icon":"percentage",
  "tags":"url,encode,full",
  "bias": -0.1
}
**/

function fullUrlEncode(str) {
  var encoded = "";

  for (var i = 0; i < str.length; i++) {
    var h = parseInt(str.charCodeAt(i)).toString(16);
    encoded += "%" + h;
  }

  return encoded;
}

function main(state) {
  state.text = fullUrlEncode(state.text);
}
// ----------------------------
/**
{
  "api":1,
  "name":"Refang",
  "description":"Removes defanging from dangerous URLs and other IOCs",
  "author":"Ross",
  "icon":"link",
  "tags":"refang,url,ioc"
}
**/

function main(input) {
  let url = input.text;
  url = url.replace(/\[\.\]/g, ".");
  url = url.replace(/hXXp/gi, "http");
  url = url.replace(/\[:\/\/\]/g, "://");
  input.text = url;
}
// ----------------------------
/**
{
  "api":1,
  "name":"YAML to JSON",
  "description":"Converts YAML to JSON.",
  "author":"Ivan",
  "icon":"metamorphose",
  "tags":"markup,convert"
}
**/

async function main(input) {
  // @ts-ignore
  let yaml = (await import("https://esm.sh/js-yaml@4.1.0")).default;
  try {
    input.text = JSON.stringify(yaml.safeLoad(input.text), null, 2);
  } catch (error) {
    input.postError("Invalid YAML");
  }
}
