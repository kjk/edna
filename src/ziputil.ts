export async function addBinaryBlob(libZip: any, zipWriter: any, fileName: string, fileBlob: Blob): Promise<void> {
  let blobReader = new libZip.BlobReader(fileBlob);
  let opts = {
    level: 9,
  };
  await zipWriter.add(fileName, blobReader, opts);
}

export async function addTextFile(libZip: any, zipWriter: any, fileName: string, s: string): Promise<void> {
  let utf8 = new TextEncoder().encode(s);
  return await addBinaryBlob(libZip, zipWriter, fileName, new Blob([utf8]));
}
