import { randomUUID } from "crypto";
import { format } from "date-fns";

export interface TissGuideData {
  id: string;
  patientName: string;
  healthPlanNumber: string;
  operatorRegisterAns: string;
  tussCode: string;
  procedure: string;
  cid10?: string;
  doctorCrm: string;
  doctorCbo: string;
  issueDate: string;
  value: number;
}

export interface TissBatchOptions {
  batchId?: string;
  clinicAnsCode: string;
  clinicCnpj: string;
  clinicName: string;
  doctorName: string;
}

/**
 * Gera um lote XML no padrao TISS 4.01.00 (Exemplo Base)
 * Substitui o faturamento manual do Konsist.
 */
export function generateTissBatchXml(
  operatorAns: string,
  guides: TissGuideData[],
  options: TissBatchOptions
): string {
  const batchId = options.batchId || randomUUID().replace(/-/g, "").substring(0, 12);
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const timeStr = format(new Date(), "HH:mm:ss");

  // Calcula o valor total do lote
  const totalValue = guides.reduce((acc, g) => acc + g.value, 0);

  // Cabecalho TISS padrao
  let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
  xml += `<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n`;
  
  // -- 1. Cabecalho
  xml += `  <ans:cabecalho>\n`;
  xml += `    <ans:identificacaoTransacao>\n`;
  xml += `      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>\n`;
  xml += `      <ans:sequencialTransacao>${batchId}</ans:sequencialTransacao>\n`;
  xml += `      <ans:dataRegistroTransacao>${dateStr}</ans:dataRegistroTransacao>\n`;
  xml += `      <ans:horaRegistroTransacao>${timeStr}</ans:horaRegistroTransacao>\n`;
  xml += `    </ans:identificacaoTransacao>\n`;
  xml += `    <ans:origem>\n`;
  xml += `      <ans:identificacaoPrestador>\n`;
  xml += `        <ans:codigoPrestadorNaOperadora>${options.clinicAnsCode}</ans:codigoPrestadorNaOperadora>\n`;
  xml += `      </ans:identificacaoPrestador>\n`;
  xml += `    </ans:origem>\n`;
  xml += `    <ans:destino>\n`;
  xml += `      <ans:registroANS>${operatorAns}</ans:registroANS>\n`;
  xml += `    </ans:destino>\n`;
  xml += `    <ans:VersaoPadrao>4.01.00</ans:VersaoPadrao>\n`;
  xml += `  </ans:cabecalho>\n`;

  // -- 2. Lote de Guias
  xml += `  <ans:prestadorParaOperadora>\n`;
  xml += `    <ans:loteGuias>\n`;
  xml += `      <ans:numeroLote>${batchId}</ans:numeroLote>\n`;
  xml += `      <ans:guiasTISS>\n`;

  // -- 3. Iterando sobre as guias (Exemplo: Guia de Consulta)
  guides.forEach((guide) => {
    xml += `        <ans:guiaConsulta>\n`;
    xml += `          <ans:cabecalhoConsulta>\n`;
    xml += `            <ans:registroANS>${operatorAns}</ans:registroANS>\n`;
    xml += `            <ans:numeroGuiaPrestador>${guide.id.substring(0, 10)}</ans:numeroGuiaPrestador>\n`;
    xml += `          </ans:cabecalhoConsulta>\n`;
    
    // Beneficiario
    xml += `          <ans:dadosBeneficiario>\n`;
    xml += `            <ans:numeroCarteira>${guide.healthPlanNumber}</ans:numeroCarteira>\n`;
    xml += `            <ans:nomeBeneficiario>${guide.patientName}</ans:nomeBeneficiario>\n`;
    xml += `          </ans:dadosBeneficiario>\n`;
    
    // Profissional Executante
    xml += `          <ans:dadosProfissionalExecutante>\n`;
    xml += `            <ans:conselhoProfissional>\n`;
    xml += `              <ans:siglaConselho>CRM</ans:siglaConselho>\n`;
    xml += `              <ans:numeroConselho>${guide.doctorCrm}</ans:numeroConselho>\n`;
    xml += `              <ans:ufConselho>DF</ans:ufConselho>\n`;
    xml += `            </ans:conselhoProfissional>\n`;
    xml += `            <ans:CBOS>${guide.doctorCbo}</ans:CBOS>\n`;
    xml += `            <ans:nomeProfissional>${options.doctorName}</ans:nomeProfissional>\n`;
    xml += `          </ans:dadosProfissionalExecutante>\n`;

    // Atendimento (Consulta)
    xml += `          <ans:dadosAtendimento>\n`;
    xml += `            <ans:dataAtendimento>${guide.issueDate}</ans:dataAtendimento>\n`;
    xml += `            <ans:procedimento>\n`;
    xml += `              <ans:codigoTabela>22</ans:codigoTabela>\n`; // 22 = TUSS
    xml += `              <ans:codigoProcedimento>${guide.tussCode}</ans:codigoProcedimento>\n`;
    xml += `              <ans:descricaoProcedimento>${guide.procedure}</ans:descricaoProcedimento>\n`;
    xml += `            </ans:procedimento>\n`;
    xml += `            <ans:tipoConsulta>1</ans:tipoConsulta>\n`; // 1 = Primeira Consulta
    xml += `          </ans:dadosAtendimento>\n`;
    xml += `        </ans:guiaConsulta>\n`;
  });

  xml += `      </ans:guiasTISS>\n`;
  xml += `    </ans:loteGuias>\n`;
  xml += `  </ans:prestadorParaOperadora>\n`;

  // -- 4. Resumo (Epilogo TISS)
  xml += `  <ans:epilogo>\n`;
  xml += `    <ans:hash>MD5_GERADO_AQUI</ans:hash>\n`;
  xml += `  </ans:epilogo>\n`;
  
  xml += `</ans:mensagemTISS>\n`;

  return xml;
}
