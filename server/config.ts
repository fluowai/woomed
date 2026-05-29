import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local" });

export const PORT = Number(process.env.PORT || 5173);
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const HAS_GEMINI_KEY = GEMINI_API_KEY.trim() !== "";

export const WHATSMEOW_API_URL = (process.env.WHATSMEOW_API_URL || "").replace(/\/+$/, "");
export const WHATSMEOW_API_TOKEN = process.env.WHATSMEOW_API_TOKEN || "";
export const WHATSMEOW_WEBHOOK_SECRET = process.env.WHATSMEOW_WEBHOOK_SECRET || "";
