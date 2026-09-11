/**
 * Formats a phone number for WhatsApp wa.me links.
 * Auto-prepends country code 91 if a 10-digit number is provided.
 * 
 * @param {string} rawNumber - The phone number entered in settings or user profile
 * @returns {string} Digits suitable for wa.me URL
 */
export function formatWhatsappNumber(rawNumber) {
  if (!rawNumber) return "";
  let digits = String(rawNumber).replace(/\D/g, "");
  
  // If 10 digits (e.g. 9828786246), default to India (+91)
  if (digits.length === 10) {
    return `91${digits}`;
  }
  // If 11 digits starting with 0 (e.g. 09828786246)
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Generates full https://wa.me/ link with custom message
 */
export function getWhatsappLink(rawNumber, text = "") {
  const formatted = formatWhatsappNumber(rawNumber);
  if (!formatted) return "";
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${formatted}${encodedText}`;
}
