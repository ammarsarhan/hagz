// Object storage for uploaded files (venue photos). Files never pass through the API: the app
// uploads straight to the store with a short-lived signed request, then the API checks what arrived.

export interface UploadTarget {
  url: string;
  method: "PUT";
  // Sent exactly as given; the signature covers them, so the store refuses another type or size.
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObject {
  size: number;
  contentType: string | null;
}

export interface StorageProvider {
  readonly name: string;
  uploadTarget(
    key: string,
    file: { contentType: string; size: number },
    expiresInSeconds: number,
  ): Promise<UploadTarget>;
  // What's stored under `key`, or null when nothing is.
  head(key: string): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
  // Where clients read the file from.
  publicUrl(key: string): string;
}
