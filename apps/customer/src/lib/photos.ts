import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

// A profile photo on its way up, as the staff app sends venue photos (its lib/photos.ts): made a
// JPEG no longer than 1024 on its long side (plenty for a round photo of 76), then sent straight to
// storage with the upload the API handed out.
const LONG_SIDE = 1024;
const QUALITY = 0.82;

export const preparePhoto = async (asset: { uri: string; width: number; height: number }) => {
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
  return { uri: resized.uri, blob: await (await fetch(resized.uri)).blob() };
};

export const putPhoto = (target: { url: string; headers: Record<string, string> }, blob: Blob) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target.url);
    for (const [name, value] of Object.entries(target.headers)) {
      request.setRequestHeader(name, value);
    }
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(blob);
  });
