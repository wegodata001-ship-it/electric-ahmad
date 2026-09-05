export function buildVerificationId(
  documentNumber: string,
  publicId: string
): string {
  const short = publicId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `${documentNumber}-SIG-${short || "OK"}`;
}
