let storageFS: FileSystemDirectoryHandle | undefined;

export function getStorageFS(): FileSystemDirectoryHandle | undefined {
  return storageFS;
}

export function setStorageFS(handle: FileSystemDirectoryHandle | undefined) {
  storageFS = handle;
}
