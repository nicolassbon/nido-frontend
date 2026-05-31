const PHOTO_VALIDATION = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  invalidTypeMessage: 'Usá una imagen JPG, PNG o WebP.',
  fileTooLargeMessage: 'La imagen no puede superar los 5 MB.',
} as const;

export const MAX_PHOTO_BYTES = PHOTO_VALIDATION.maxBytes;
export const ALLOWED_PHOTO_TYPES = new Set<string>(PHOTO_VALIDATION.allowedTypes);

export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    return PHOTO_VALIDATION.invalidTypeMessage;
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return PHOTO_VALIDATION.fileTooLargeMessage;
  }

  return null;
}
