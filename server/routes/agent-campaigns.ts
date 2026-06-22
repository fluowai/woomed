import { Express } from "express";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { loadData, saveData } from "../data";
import { audit, nowIso, addDays, dayName } from "../helpers";
import { callWhatsmeowBridge } from "../whatsapp-utils";
import { WHATSMEOW_API_URL } from "../config";

interface CampaignAgent {
  id: string;
  name: string;
  type: "reativacao" | "no_show" | "pos_consulta" | "aniversario" | "custom";
  triggerDays: number;
  messageTemplate: string;
  channel: string;
  status: "active" | "paused";
  targetFilter: Record<string, unknown>;
  stats: { sent: number; converted: number };
  createdAt: string;
}

export function registerAgentCampaignRoutes(app: Express) {
  // List campaigns
  app.get("/api/v2/agent-campaigns", requireAuth, async (_req, res) => {
    const data = await loadData();
    const campaigns = (data as any).agentCampaigns || [];
    res.json({ campaigns });
  });

  // Create campaign
  app.post("/api/v2/agent-campaigns", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { name, type, triggerDays, messageTemplate, channel, targetFilter } = req.body || {};
    if (!name || !type) return res.status(400).json({ error: "name e type sao obrigatorios" });

    const campaign: CampaignAgent = {
      id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name, type, triggerDays: Number(triggerDays) || 30,
      messageTemplate: messageTemplate || "",
      channel: channel || "whatsapp",
      status: "active",
      targetFilter: targetFilter || {},
      stats: { sent: 0, converted: 0 },
      createdAt: nowIso(),
    };

    if (!(data as any).agentCampaigns) (data as any).agentCampaigns = [];
    (data as any).agentCampaigns.push(campaign);
    await audit(data, req.user!, "create", "agent_campaign", campaign.id, campaign.name);
    await saveData(data);
    res.json({ campaign });
  });

  // Update campaign
  app.patch("/api/v2/agent-campaigns/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const campaigns: CampaignAgent[] = (data as any).agentCampaigns || [];
    const idx = campaigns.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Campanha nao encontrada" });

    const allowed = ["name", "messageTemplate", "status", "triggerDays", "targetFilter", "channel"];
    for (const field of allowed) {
      if (req.body[field] !== undefined) (campaigns[idx] as any)[field] = req.body[field];
    }
    (data as any).agentCampaigns = campaigns;
    await saveData(data);
    res.json({ campaign: campaigns[idx] });
  });

  // Delete campaign
  app.delete("/api/v2/agent-campaigns/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const campaigns: CampaignAgent[] = (data as any).agentCampaigns || [];
    const idx = campaigns.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Campanha nao encontrada" });
    campaigns.splice(idx, 1);
    (data as any).agentCampaigns = campaigns;
    await saveData(data);
    res.json({ ok: true });
  });

  // Execute campaign - find target patients and send
  app.post("/api/v2/agent-campaigns/:id/execute", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const campaigns: CampaignAgent[] = (data as any).agentCampaigns || [];
    const campaign = campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campanha nao encontrada" });

    const results: { patientName: string; sent: boolean; error?: string }[] = [];
    const conn = data.whatsappConnections?.find(c => c.status === "connected");

    let targets = [...data.patients];

    switch (campaign.type) {
      case "reativacao": {
        const cutoff = addDays(nowIso().slice(0, 10), -campaign.triggerDays);
        const activePatients = new Set(
          data.appointments
            .filter(a => a.date >= cutoff && a.status !== "desmarcado")
            .map(a => a.patientName.toUpperCase())
        );
        targets = targets.filter(p => !activePatients.has(p.fullName.toUpperCase()));
        break;
      }
      case "no_show": {
        const noShowNames = new Set(
          data.appointments
            .filter(a => a.status === "desmarcado" && a.date >= addDays(nowIso().slice(0, 10), -campaign.triggerDays))
            .map(a => a.patientName.toUpperCase())
        );
        targets = targets.filter(p => noShowNames.has(p.fullName.toUpperCase()));
        break;
      }
      case "pos_consulta": {
        const recentPatientNames = new Set(
          data.appointments
            .filter(a => (a.status === "atendido" || a.status === "em_atendimento") &&
              a.date >= addDays(nowIso().slice(0, 10), -campaign.triggerDays))
            .map(a => a.patientName.toUpperCase())
        );
        targets = targets.filter(p => recentPatientNames.has(p.fullName.toUpperCase()));
        break;
      }
    }

    for (const patient of targets.slice(0, 50)) {
      try {
        let message = campaign.messageTemplate
          .replace(/\{\{patientName\}\}/g, patient.fullName);

        if (conn?.id && WHATSMEOW_API_URL) {
          const conversation = data.whatsappConversations?.find(c =>
            c.connectionId === conn.id && c.normalizedPhone === patient.phone?.replace(/\D/g, "")
          );
          if (conversation) {
            await callWhatsmeowBridge("/messages/send", {
              method: "POST",
              body: JSON.stringify({ connectionId: conn.id, to: conversation.jid, text: message }),
            });
            results.push({ patientName: patient.fullName, sent: true });
          } else {
            results.push({ patientName: patient.fullName, sent: false, error: "Conversa nao encontrada" });
          }
        } else {
          results.push({ patientName: patient.fullName, sent: false, error: "WhatsApp nao conectado" });
        }
      } catch (e: any) {
        results.push({ patientName: patient.fullName, sent: false, error: e.message });
      }
    }

    campaign.stats.sent += results.filter(r => r.sent).length;
    (data as any).agentCampaigns = campaigns;
    await audit(data, req.user!, "execute", "agent_campaign", campaign.id, `${results.filter(r => r.sent).length} enviados`);
    await saveData(data);

    res.json({ campaign, results, sent: results.filter(r => r.sent).length, total: targets.length });
  });

  // No-show auto-reminder: find appointments that are near and send reminder
  app.post("/api/v2/agent-campaigns/no-show-prevention", requireAuth, async (_req, res) => {
    const data = await loadData();
    const now = new Date();
    const today = nowIso().slice(0, 10);
    const conn = data.whatsappConnections?.find(c => c.status === "connected");

    // Find appointments for today+1 that are still "agendado" (not confirmed)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const pendingConfirmations = data.appointments.filter(
      a => a.date === tomorrowStr && a.status === "agendado"
    );

    let sent = 0;
    for (const apt of pendingConfirmations) {
      const patient = data.patients.find(p =>
        p.fullName.toUpperCase() === apt.patientName.toUpperCase()
      );
      if (!patient || !conn?.id || !WHATSMEOW_API_URL) continue;

      const doctor = data.doctors.find(d => d.id === apt.doctorId);
      const message = `Ola ${apt.patientName}! 😊 Lembramos da sua consulta amanha${doctor ? ` com ${doctor.name}` : ""} as ${apt.timeStart}. Por favor, confirme sua presenca respondendo "confirmar" ou "remarcar" se precisar alterar.`;

      const conversation = data.whatsappConversations?.find(c =>
        c.connectionId === conn.id && c.normalizedPhone === patient.phone?.replace(/\D/g, "")
      );

      if (conversation) {
        try {
          await callWhatsmeowBridge("/messages/send", {
            method: "POST",
            body: JSON.stringify({ connectionId: conn.id, to: conversation.jid, text: message }),
          });

          const rt = (data as any).__agentRuntime || {};
          if (!rt.executionLogs) rt.executionLogs = [];
          rt.executionLogs.push({
            id: `no-show-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sessionId: `auto-${apt.id}`,
            agentId: "no-show-prevention",
            action: "enviar_lembrete",
            prompt: `Prevencao de falta: ${apt.patientName}`,
            response: message,
            modelUsed: "campaign-system",
            tokensUsed: 0, latencyMs: 0, success: true,
            createdAt: nowIso(),
          });
          (data as any).__agentRuntime = rt;
          sent++;
        } catch (e) {
          console.warn("[NoShow] Send failed:", e);
        }
      }
    }

    await saveData(data);
    res.json({ ok: true, sent, total: pendingConfirmations.length });
  });
}
