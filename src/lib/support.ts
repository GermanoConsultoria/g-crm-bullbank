const SUPPORT_WHATSAPP_NUMBER = "5519997012163";
const SUPPORT_WHATSAPP_MESSAGE = "Olá! Preciso de suporte no CRM.";

/**
 * V1: suporte via WhatsApp direto. Futuramente pode passar a apontar
 * para um sistema central de tickets — manter só este ponto para trocar.
 */
export function getSupportUrl(): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`;
}
