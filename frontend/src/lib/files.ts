/** Reads a small preview attachment as a data URL so it can travel through the JSON API. */
export function readFileAsDataUrl(file: File, maxBytes = 2_500_000): Promise<{ fileName: string; fileData: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`${file.name} is larger than ${Math.round(maxBytes / 1_000_000)} MB. Please choose a smaller preview file.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:')) {
        reject(new Error(`Unable to encode ${file.name}.`));
        return;
      }
      resolve({ fileName: file.name, fileData: result });
    };
    reader.readAsDataURL(file);
  });
}

/** True when a data URL can be shown inline in an <img> tag. */
export function isImageDataUrl(value?: string): boolean {
  return Boolean(value && /^data:image\//.test(value));
}
