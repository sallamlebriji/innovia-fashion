export type StorageEnvironment = Record<string, string | undefined>;
export type MediaStore = {
  driver: "local" | "s3";
  put: (key: string, data: Buffer) => Promise<void>;
  read: (key: string) => Promise<Buffer>;
  remove: (key: string) => Promise<void>;
  keys: () => Promise<string[]>;
  close: () => void;
};
export class MediaStorageError extends Error {
  constructor(code: string, message: string);
  code: string;
}
export function validateMediaStorage(env: StorageEnvironment): void;
export function createMediaStore(env?: StorageEnvironment): MediaStore;
export function getMediaStore(env?: StorageEnvironment): MediaStore;
export function closeMediaStorage(): void;
