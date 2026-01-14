/**
 * @param {any} libZip
 * @param {any} zipWriter
 * @param {string} fileName
 * @param {Blob} fileBlob
 */
export async function addBinaryBlob(libZip, zipWriter, fileName, fileBlob) {
  let blobReader = new libZip.BlobReader(fileBlob);
  let opts = {
    level: 9,
  };
  await zipWriter.add(fileName, blobReader, opts);
}

/**
 * @param {any} libZip
 * @param {any} zipWriter
 * @param {string} fileName
 * @param {string} s
 */
export async function addTextFile(libZip, zipWriter, fileName, s) {
  let utf8 = new TextEncoder().encode(s);
  return await addBinaryBlob(libZip, zipWriter, fileName, new Blob([utf8]));
}
