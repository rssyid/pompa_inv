export async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(element);
    };
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca file gambar."));
    };
    element.src = objectUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) return file;
  const cleanName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], cleanName, { type: "image/jpeg" });
}
