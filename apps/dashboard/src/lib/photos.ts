import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

// Getting a picked photo to storage (docs/onboarding.md, photos): resized in the app to about 2048 px
// on its long side and saved as JPEG, so a 12 MP shot goes up as a few hundred KB, then PUT straight
// to the signed URL the API hands out. The API only checks what arrived.
const LONG_SIDE = 2048;
const QUALITY = 0.82;
// The preview sent with the confirm, for places too small to load the photo (the Venue tab's 26 pt
// cover): about 64 px, soft JPEG, a couple of KB. The API refuses more than 4 KB.
const PREVIEW_LONG_SIDE = 64;
const PREVIEW_QUALITY = 0.6;

export interface PreparedPhoto {
  uri: string;
  blob: Blob;
  // Base64 JPEG.
  preview: string;
}

export const preparePhoto = async (asset: {
  uri: string;
  width: number;
  height: number;
}): Promise<PreparedPhoto> => {
  const scale = Math.min(1, LONG_SIDE / Math.max(asset.width, asset.height));
  const resized = await manipulateAsync(
    asset.uri,
    scale < 1
      ? [
          {
            resize: {
              width: Math.round(asset.width * scale),
              height: Math.round(asset.height * scale),
            },
          },
        ]
      : [],
    { compress: QUALITY, format: SaveFormat.JPEG },
  );
  // The bytes, to know their exact size before asking for the upload, and to send.
  const blob = await (await fetch(resized.uri)).blob();
  // From the resized copy, which is already decoded small enough to be quick.
  const wide = resized.width >= resized.height;
  const small = await manipulateAsync(
    resized.uri,
    [{ resize: wide ? { width: PREVIEW_LONG_SIDE } : { height: PREVIEW_LONG_SIDE } }],
    { compress: PREVIEW_QUALITY, format: SaveFormat.JPEG, base64: true },
  );
  if (!small.base64) throw new Error("Couldn't make the photo's preview");
  return { uri: resized.uri, blob, preview: small.base64 };
};

// fetch has no upload progress; XMLHttpRequest does, which is what the tile's percentage is.
export const putPhoto = (
  target: { url: string; headers: Record<string, string> },
  blob: Blob,
  onProgress: (fraction: number) => void,
) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target.url);
    for (const [name, value] of Object.entries(target.headers))
      request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(blob);
  });
