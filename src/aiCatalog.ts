import { AgentTemplate, LlmProviderConfig, NeuralKnowledgeItem } from './types';

export const DEFAULT_LLM_PROVIDER_CONFIGS: LlmProviderConfig[] = [
  {
    id: 'llm-gemini-default',
    name: 'Gemini Operacional',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    apiKeyMasked: 'Configurar GEMINI_API_KEY',
    temperature: 0.35,
    maxTokens: 1200,
    isDefault: true,
    isActive: true,
    createdAt: '2026-05-26T12:00:00.000Z',
    updatedAt: '2026-05-26T12:00:00.000Z'
  }
];

const safetyRules = [
  'Nao diagnosticar, prescrever ou prometer resultado clinico',
  'Escalonar urgencias, sinais de alerta e reclamacoes sensiveis para humano',
  'Validar identidade antes de tratar dados sensiveis',
  'Registrar consentimento antes de contato ativo'
];

export const DEFAULT_AGENT_TEMPLATES: AgentTemplate[] = [
  ['triagem-whatsapp', 'Triagem WhatsApp 24h', 'saude_e_beleza', 'whatsapp', 'Receber novos contatos, entender necessidade e qualificar prioridade.', ['validar telefone', 'classificar urgencia', 'abrir lead']],
  ['confirmacao-agenda', 'Confirmacao de Agenda', 'saude_e_beleza', 'whatsapp', 'Confirmar consultas, remarcar horarios e reduzir faltas.', ['confirmar consulta', 'remarcar', 'avisar recepcao']],
  ['reativacao-pacientes', 'Reativacao de Pacientes', 'saude', 'whatsapp', 'Encontrar pacientes sem retorno e oferecer agenda disponivel.', ['segmentar lista', 'enviar convite', 'criar tarefa']],
  ['pos-consulta', 'Pos-consulta Humanizado', 'saude', 'whatsapp', 'Enviar orientacoes gerais, coletar satisfacao e identificar duvidas.', ['enviar cuidado geral', 'coletar NPS', 'escalonar duvida clinica']],
  ['preparo-exames', 'Preparo de Exames', 'saude', 'whatsapp', 'Enviar preparo, documentos necessarios e lembretes para exames.', ['buscar protocolo', 'enviar checklist', 'confirmar recebimento']],
  ['orcamento-estetico', 'Orcamento Estetico', 'beleza', 'whatsapp', 'Qualificar interesse em procedimentos esteticos e acionar consultora.', ['coletar objetivo', 'sugerir avaliacao', 'abrir oportunidade']],
  ['avaliacao-fotos', 'Avaliacao por Fotos', 'beleza', 'whatsapp', 'Receber fotos com consentimento e direcionar para avaliacao humana.', ['pedir consentimento', 'validar midia', 'encaminhar especialista']],
  ['recuperacao-faltosos', 'Recuperacao de Faltosos', 'saude_e_beleza', 'whatsapp', 'Contactar faltosos, entender motivo e remarcar atendimento.', ['listar faltosos', 'propor horarios', 'registrar motivo']],
  ['convenios-tiss', 'Convenios e TISS', 'saude', 'whatsapp', 'Orientar sobre convenio, guia, autorizacao e documentos necessarios.', ['validar convenio', 'solicitar carteirinha', 'criar tarefa financeira']],
  ['financeiro-cobranca', 'Cobranca Gentil', 'saude_e_beleza', 'whatsapp', 'Lembrar pagamentos pendentes com tom acolhedor e objetivo.', ['consultar pendencia', 'enviar link', 'avisar financeiro']],
  ['checkin-recepcao', 'Check-in Recepcao', 'saude_e_beleza', 'whatsapp', 'Preparar chegada do paciente com dados basicos e documentos.', ['confirmar dados', 'solicitar documentos', 'avisar chegada']],
  ['lgpd-consentimento', 'Consentimento LGPD', 'saude_e_beleza', 'site', 'Explicar consentimentos e registrar aceite para tratamento de dados.', ['explicar finalidade', 'registrar aceite', 'encaminhar duvida']],
  ['captacao-instagram', 'Captacao Instagram', 'beleza', 'instagram', 'Converter conversas sociais em avaliacoes agendadas.', ['qualificar interesse', 'responder FAQ', 'criar lead']],
  ['lead-site', 'Lead do Site', 'saude_e_beleza', 'site', 'Atender visitantes do site e direcionar para consulta ou avaliacao.', ['responder servicos', 'capturar contato', 'sugerir agenda']],
  ['retorno-exames', 'Retorno de Exames', 'saude', 'whatsapp', 'Lembrar pacientes de retorno para analise de exames.', ['identificar exame', 'propor retorno', 'avisar recepcao']],
  ['programa-indicacao', 'Indique e Ganhe', 'beleza', 'whatsapp', 'Conduzir indicacoes e acompanhar recompensa.', ['registrar indicado', 'avisar marketing', 'acompanhar conversao']],
  ['nutricao-followup', 'Follow-up Nutricao', 'saude', 'whatsapp', 'Acompanhar aderencia geral e lembrar retorno nutricional.', ['coletar feedback', 'registrar alerta', 'sugerir retorno']],
  ['odontologia-preventivo', 'Preventivo Odonto', 'saude', 'whatsapp', 'Reativar limpezas e revisoes odontologicas periodicas.', ['filtrar pacientes', 'enviar lembrete', 'agendar revisao']],
  ['dermato-pele', 'Dermato Pele Segura', 'saude_e_beleza', 'whatsapp', 'Triar demandas dermatologicas e priorizar sinais de alerta.', ['coletar queixa', 'identificar alerta', 'encaminhar medico']],
  ['botox-pre-pos', 'Pre e Pos Botox', 'beleza', 'whatsapp', 'Enviar orientacoes gerais de pre e pos procedimento estetico.', ['enviar checklist', 'coletar duvidas', 'escalonar intercorrencia']],
  ['depilacao-laser', 'Depilacao Laser', 'beleza', 'whatsapp', 'Qualificar interesse, orientar preparo geral e agendar avaliacao.', ['explicar preparo geral', 'criar pacote', 'agendar sessao']],
  ['laser-pos', 'Pos-procedimento Laser', 'beleza', 'whatsapp', 'Acompanhar recuperacao geral e sinais de alerta apos laser.', ['coletar sintomas', 'enviar cuidados gerais', 'acionar humano']],
  ['pediatria-familia', 'Pediatria Familia', 'saude', 'whatsapp', 'Atender responsaveis, organizar documentos e orientar fluxo da consulta.', ['validar responsavel', 'solicitar documentos', 'priorizar alerta']],
  ['psicologia-acolhimento', 'Acolhimento Psicologia', 'saude', 'whatsapp', 'Acolher demanda inicial e direcionar para agenda apropriada.', ['coletar disponibilidade', 'explicar sigilo', 'encaminhar crise']],
  ['fisioterapia-plano', 'Plano Fisioterapia', 'saude', 'whatsapp', 'Acompanhar sessoes, faltas e renovacao de plano terapeutico.', ['lembrar sessao', 'registrar dor geral', 'avisar fisioterapeuta']],
  ['spa-experiencia', 'Experiencia SPA', 'beleza', 'whatsapp', 'Montar jornada de atendimento, pacotes e aniversariantes.', ['sugerir pacote', 'registrar preferencia', 'confirmar presenca']],
  ['avaliacao-capilar', 'Avaliacao Capilar', 'beleza', 'whatsapp', 'Qualificar queixas capilares e agendar avaliacao.', ['coletar historico geral', 'pedir fotos consentidas', 'agendar avaliacao']],
  ['cirurgia-plastica-funil', 'Funil Cirurgia Plastica', 'saude_e_beleza', 'whatsapp', 'Qualificar candidatos e encaminhar para consultora medica.', ['coletar objetivo', 'explicar fluxo', 'encaminhar humano']],
  ['ouvidoria-clinica', 'Ouvidoria Inteligente', 'saude_e_beleza', 'whatsapp', 'Receber elogios, reclamacoes e riscos de reputacao.', ['classificar sentimento', 'abrir chamado', 'notificar gestor']],
  ['gestor-autonomo', 'Gestor Autonomo da Clinica', 'saude_e_beleza', 'site', 'Monitorar agenda, mensagens, financeiro e oportunidades de automacao.', ['analisar indicadores', 'criar tarefas', 'sugerir campanhas']]
].map(([id, name, segment, channel, objective, autonomousActions]) => ({
  id: `template-${id}`,
  name,
  segment,
  channel,
  objective,
  tone: 'Acolhedor, claro, seguro e profissional',
  escalationTo: 'Equipe humana',
  workingHours: '24/7 com escalonamento humano em horario comercial',
  rules: safetyRules,
  knowledgeBase: ['Agenda', 'Servicos', 'Precos', 'Protocolos internos', 'Politicas LGPD'],
  autonomousActions
} as AgentTemplate));

export const DEFAULT_NEURAL_KNOWLEDGE: NeuralKnowledgeItem[] = [
  {
    id: 'neural-boas-praticas',
    title: 'Boas praticas para agentes de saude e beleza',
    category: 'Governanca',
    content: 'Agentes devem acolher, orientar fluxos administrativos, registrar consentimento, evitar diagnostico e acionar humano em situacoes clinicas ou sensiveis.',
    sourceType: 'manual',
    targetAgentIds: [],
    tags: ['lgpd', 'seguranca', 'atendimento'],
    status: 'indexed',
    createdAt: '2026-05-26T12:00:00.000Z',
    updatedAt: '2026-05-26T12:00:00.000Z'
  }
];
