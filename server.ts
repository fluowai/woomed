import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Scheduling Suggestion API
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: message }] }],
        systemInstruction: `Você é um assistente de agendamento do Consultio Med. 
        Sua função é sugerir datas e horários disponíveis para consultas baseando-se no contexto fornecido.
        Contexto atual: ${JSON.stringify(context)}`,
      });

      res.json({ text: result.response.text() });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Erro ao processar sua solicitação." });
    }
  });

  // AI Structured Suggestions API
  app.post("/api/suggestions", async (req, res) => {
    try {
      const { doctor, requestedSlot, currentAppointments } = req.body;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Analise a agenda do ${doctor.name} (${doctor.specialty}). 
      O usuário tentou agendar para ${requestedSlot.date} às ${requestedSlot.time}, mas este horário está indisponível ou em conflito.
      Agendamentos atuais do médico: ${JSON.stringify(currentAppointments)}.
      Ele trabalha das ${doctor.workingHours.start} às ${doctor.workingHours.end} nos dias: ${doctor.availableDays.join(", ")}.
      Sugira 3 alternativas próximas (datas e horários) que estejam livres e respeitem o horário de trabalho.
      Retorne APENAS um JSON no formato: [{"date": "YYYY-MM-DD", "time": "HH:MM", "reason": "Motivo da sugestão"}]`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const suggestions = JSON.parse(result.response.text());
      res.json(suggestions);
    } catch (error) {
      console.error("Suggestion Error:", error);
      res.status(500).json({ error: "Falha ao gerar sugestões." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
