const THUMB_PX = 320;
const UPLOAD_PX = 1024;

/** The thread keeps a thumbnail (a full photo would blow the localStorage quota); the upload is bigger. */
export interface Photo {
  thumb: string;
  full: string;
}

function scaled(img: HTMLImageElement, px: number): string {
  const scale = Math.min(1, px / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export async function photoOf(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { thumb: scaled(img, THUMB_PX), full: scaled(img, UPLOAD_PX) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
