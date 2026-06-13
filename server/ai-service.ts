/**
 * Unified AI Service - Multi-Provider Support
 * Suporta: Gemini, OpenAI (ChatGPT), Groq, Anthropic (Claude), Ollama (Llama local)
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIProvider {
  name: string;
  model: string;
  apiKey?: string;
  endpoint?: string;
}

function buildSystemPrompt(context: any): string {
  const now = new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const doctors = context?.doctors?.map((d: any) => `${d.name} (${d.specialty})`).join(", ") || "Nenhum profissional";
  const totalPatients = context?.patients?.length || 0;
  const todayApts = context?.appointments?.filter((a: any) => a.date === new Date().toISOString().split("T")[0]).length || 0;

  return `Você é um assistente clínico inteligente do Consultio Med.
Data atual: ${now}
Profissionais cadastrados: ${doctors}
Total de pacientes: ${totalPatients}
Agendamentos de hoje: ${todayApts}

Suas responsabilidades:
- Ajudar a equipe clínica com informações sobre agenda, pacientes e atendimentos
- Sugerir horários disponíveis com base na agenda real
- Orientar sobre prontuários, financeiro e operações da clínica
- Responder SEMPRE em português do Brasil, de forma profissional e empática
- Nunca inventar informações de pacientes - só use o contexto fornecido

Contexto detalhado da clínica: ${JSON.stringify({
    doctors: context?.doctors?.slice(0, 5) || [],
    recentAppointments: context?.appointments?.slice(0, 10) || [],
    patientCount: totalPatients
  })}`;
}

// ── Gemini ──────────────────────────────────────────────────────────────────
async function callGemini(messages: ChatMessage[], systemPrompt: string, apiKey: string, model = "gemini-2.0-flash"): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  
  // Build conversation history for Gemini
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const response = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: systemPrompt, temperature: 0.7, maxOutputTokens: 2048 }
  });
  return response.text || "Não consegui gerar uma resposta.";
}

// ── OpenAI / ChatGPT ─────────────────────────────────────────────────────────
async function callOpenAI(messages: ChatMessage[], systemPrompt: string, apiKey: string, model = "gpt-4o-mini", endpoint = "https://api.openai.com/v1"): Promise<string> {
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ],
    temperature: 0.7,
    max_tokens: 2048
  };

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || "Sem resposta do modelo.";
}

// ── Groq ─────────────────────────────────────────────────────────────────────
async function callGroq(messages: ChatMessage[], systemPrompt: string, apiKey: string, model = "llama-3.3-70b-versatile"): Promise<string> {
  return callOpenAI(messages, systemPrompt, apiKey, model, "https://api.groq.com/openai/v1");
}

// ── Anthropic (Claude) ────────────────────────────────────────────────────────
async function callAnthropic(messages: ChatMessage[], systemPrompt: string, apiKey: string, model = "claude-3-5-haiku-20241022"): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content })),
      max_tokens: 2048
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  return data.content?.[0]?.text || "Sem resposta do modelo.";
}

// ── Ollama (Llama local) ─────────────────────────────────────────────────────
async function callOllama(messages: ChatMessage[], systemPrompt: string, model = "llama3", endpoint = "http://localhost:11434"): Promise<string> {
  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      stream: false
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  return data.message?.content || "Sem resposta do modelo local.";
}

// ── Smart fallback responder ─────────────────────────────────────────────────
function smartFallback(message: string, context: any): string {
  const msg = message.toLowerCase();
  const doctors: any[] = context?.doctors || [];
  const appointments: any[] = context?.appointments || [];
  const patients: any[] = context?.patients || [];
  const today = new Date().toISOString().split("T")[0];

  if (msg.includes("horário") || msg.includes("horario") || msg.includes("agenda")) {
    const todayApts = appointments.filter(a => a.date === today);
    if (todayApts.length === 0) return "Não há agendamentos para hoje. A agenda está livre!";
    const list = todayApts.slice(0, 5).map(a => `${a.timeStart} - ${a.patientName} (${a.type})`).join("\n");
    return `📅 Agendamentos de hoje:\n${list}`;
  }

  if (msg.includes("paciente")) {
    return `Você tem ${patients.length} pacientes cadastrados. Para detalhes específicos, acesse o módulo de Pacientes.`;
  }

  if (msg.includes("médico") || msg.includes("medico") || msg.includes("profissional") || msg.includes("doutor")) {
    const list = doctors.map(d => `${d.name} (${d.specialty})`).join(", ");
    return `Profissionais cadastrados: ${list || "Nenhum profissional cadastrado ainda."}`;
  }

  if (msg.includes("financeiro") || msg.includes("pagamento") || msg.includes("receita")) {
    return "Para informações financeiras detalhadas, acesse o módulo Financeiro. Lá você encontra receitas, despesas e contas a pagar.";
  }

  return `Sou o assistente do Consultio Med. Posso te ajudar com:\n• 📅 Agenda e horários disponíveis\n• 👥 Informações de pacientes\n• 💰 Financeiro e pagamentos\n• 🏥 Prontuários e atendimentos\n\nConfigure uma chave de API (Gemini, OpenAI ou Groq) nas configurações de LLMs para ativar as respostas com inteligência artificial completa!`;
}

// ── Main dispatcher ──────────────────────────────────────────────────────────
export async function callAI(
  messages: ChatMessage[],
  context: any,
  provider?: AIProvider
): Promise<string> {
  const systemPrompt = buildSystemPrompt(context);

  // Try configured provider first
  if (provider?.apiKey) {
    try {
      switch (provider.name.toLowerCase()) {
        case "openai":
          return await callOpenAI(messages, systemPrompt, provider.apiKey, provider.model, provider.endpoint);
        case "groq":
          return await callGroq(messages, systemPrompt, provider.apiKey, provider.model);
        case "gemini":
          return await callGemini(messages, systemPrompt, provider.apiKey, provider.model);
        case "anthropic":
          return await callAnthropic(messages, systemPrompt, provider.apiKey, provider.model);
        case "local":
          return await callOllama(messages, systemPrompt, provider.model, provider.endpoint);
      }
    } catch (err: any) {
      console.error(`[AI] Provider ${provider.name} failed:`, err.message);
    }
  }

  // Auto-detect from environment
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      return await callGemini(messages, systemPrompt, geminiKey);
    } catch (err: any) {
      console.error("[AI] Gemini fallback failed:", err.message);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    try {
      return await callOpenAI(messages, systemPrompt, openaiKey);
    } catch (err: any) {
      console.error("[AI] OpenAI fallback failed:", err.message);
    }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try {
      return await callGroq(messages, systemPrompt, groqKey);
    } catch (err: any) {
      console.error("[AI] Groq fallback failed:", err.message);
    }
  }

  // Final fallback: smart keyword-based response
  const lastMessage = messages[messages.length - 1]?.content || "";
  return smartFallback(lastMessage, context);
}
