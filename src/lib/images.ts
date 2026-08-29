export interface PreparedImage {
  base64: string;
  mimeType: 'image/jpeg';
}

export const MAX_REFERENCE_IMAGES = 5;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function prepareImageFile(file: File, maxDimension = 1_280, quality = 0.82): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('يرجى اختيار ملف صورة فقط.'));
  if (file.size > MAX_IMAGE_BYTES) return Promise.reject(new Error('حجم الصورة أكبر من 12MB.'));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('صيغة الصورة غير مدعومة.'));
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('تعذر تجهيز الصورة داخل المتصفح.'));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve({ base64: canvas.toDataURL('image/jpeg', quality), mimeType: 'image/jpeg' });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
