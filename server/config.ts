import dotenv from "dotenv";
import { getSecret, requireSecret } from "./secrets";

dotenv.config();
dotenv.config({ path: ".env.local" });

export const PORT = Number(process.env.PORT || 5173);
export const GEMINI_API_KEY = getSecret("GEMINI_API_KEY") || "";
export const HAS_GEMINI_KEY = GEMINI_API_KEY.trim() !== "";

export let WHATSMEOW_API_URL = (process.env.WHATSMEOW_API_URL || "").replace(/\/+$/, "");
export const WHATSMEOW_API_TOKEN = getSecret("WHATSMEOW_API_TOKEN") || "";
export const WHATSMEOW_WEBHOOK_SECRET = (() => {
  const secret = getSecret("WHATSMEOW_WEBHOOK_SECRET");
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "ERRO CRÍTICO: WHATSMEOW_WEBHOOK_SECRET não configurado em produção. " +
      "Configure para validar webhooks do WhatsApp Bridge e prevenir injeção de mensagens."
    );
  }
  return secret || "";
})();

// ENCRYPTION_MASTER_KEY para criptografar secrets sensíveis
export const ENCRYPTION_MASTER_KEY = (() => {
  const key = getSecret("ENCRYPTION_MASTER_KEY");
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error(
      "ERRO CRÍTICO: ENCRYPTION_MASTER_KEY não configurado em produção. " +
      "Gere com: ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)"
    );
  }
  return key;
})();

export function setWhatsmeowApiUrl(url: string) {
  WHATSMEOW_API_URL = url;
}
