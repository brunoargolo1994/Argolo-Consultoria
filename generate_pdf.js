const fs = require('fs');
const path = require('path');

// Helper to escape PDF text strings
function escapePdfText(text) {
  // Replace characters not in ISO-8859-1 or normalize
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, (match) => {
      // Keep basic accents if possible or ASCII fallback
      return '';
    })
    .replace(/[^\x20-\x7E]/g, '');

  return normalized.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class SimplePdfBuilder {
  constructor() {
    this.objects = [];
    this.pages = [];
  }

  addObject(content) {
    const objNum = this.objects.length + 1;
    this.objects.push({ num: objNum, content });
    return objNum;
  }

  buildStream(operations) {
    const streamContent = operations.join('\n');
    const length = Buffer.byteLength(streamContent, 'utf-8');
    return `<< /Length ${length} >>\nstream\n${streamContent}\nendstream`;
  }

  createPage(operations) {
    const streamContent = operations.join('\n');
    const length = Buffer.byteLength(streamContent, 'utf-8');
    
    // Content object
    const contentObjNum = this.addObject(`<< /Length ${length} >>\nstream\n${streamContent}\nendstream`);
    
    // Page object placeholder
    const pageObjNum = this.addObject(null); // will update later
    this.pages.push({ pageObjNum, contentObjNum });
    return pageObjNum;
  }

  generate() {
    // 1. Font objects (Helvetica, Helvetica-Bold, Helvetica-Oblique)
    const f1Obj = this.addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
    const f2Obj = this.addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
    const f3Obj = this.addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>`);

    // 2. Update page objects
    const pageRefs = [];
    for (const page of this.pages) {
      pageRefs.push(`${page.pageObjNum} 0 R`);
    }

    const pagesObjNum = this.addObject(null); // placeholder for Pages root

    for (const page of this.pages) {
      const pageContent = `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${f1Obj} 0 R /F2 ${f2Obj} 0 R /F3 ${f3Obj} 0 R >> >> /Contents ${page.contentObjNum} 0 R >>`;
      this.objects[page.pageObjNum - 1].content = pageContent;
    }

    // 3. Update Pages root
    this.objects[pagesObjNum - 1].content = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${this.pages.length} >>`;

    // 4. Catalog object
    const catalogObj = this.addObject(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

    // 5. Serialize PDF and calculate offsets
    let pdf = '%PDF-1.4\n';
    const offsets = [];

    for (const obj of this.objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf-8'));
      pdf += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
    pdf += `xref\n0 ${this.objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (const offset of offsets) {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogObj} 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, 'utf-8');
  }
}

// Generate the official portfolio PDF
function buildPortfolio() {
  const builder = new SimplePdfBuilder();

  // Helper drawing functions
  function rect(ops, x, y, w, h, fillR, fillG, fillB) {
    ops.push(`${fillR} ${fillG} ${fillB} rg`);
    ops.push(`${x} ${y} ${w} ${h} re f`);
  }

  function strokeRect(ops, x, y, w, h, strR, strG, strB, lineWidth = 1) {
    ops.push(`${strR} ${strG} ${strB} RG`);
    ops.push(`${lineWidth} w`);
    ops.push(`${x} ${y} ${w} ${h} re S`);
  }

  function text(ops, str, font, size, x, y, r = 1, g = 1, b = 1) {
    ops.push(`BT`);
    ops.push(`/${font} ${size} Tf`);
    ops.push(`${r} ${g} ${b} rg`);
    ops.push(`${x} ${y} Td`);
    ops.push(`(${escapePdfText(str)}) Tj`);
    ops.push(`ET`);
  }

  function line(ops, x1, y1, x2, y2, r, g, b, width = 1) {
    ops.push(`${r} ${g} ${b} RG`);
    ops.push(`${width} w`);
    ops.push(`${x1} ${y1} m`);
    ops.push(`${x2} ${y2} l S`);
  }

  // ==========================================
  // PAGE 1: COVER & OVERVIEW
  // ==========================================
  const p1 = [];
  // Background navy
  rect(p1, 0, 0, 595.28, 841.89, 0.02, 0.04, 0.09);

  // Cyan top accent banner
  rect(p1, 0, 835, 595.28, 7, 0, 0.82, 1);

  // Top header area
  rect(p1, 40, 740, 515, 65, 0.05, 0.1, 0.22);
  strokeRect(p1, 40, 740, 515, 65, 0, 0.82, 1, 1.2);
  text(p1, 'ARGOLO CONSULTORIA E TECNOLOGIA', 'F2', 18, 60, 775, 1, 1, 1);
  text(p1, 'PORTFOLIO DE SERVICOS & SOLUCOES CORPORATIVAS', 'F2', 10, 60, 755, 0, 0.82, 1);

  // Main Hero Box
  rect(p1, 40, 570, 515, 145, 0.04, 0.08, 0.18);
  strokeRect(p1, 40, 570, 515, 145, 0.2, 0.3, 0.5, 0.8);
  text(p1, 'INOVACAO COMERCIAL & DESCOMPLICANDO O MEI', 'F2', 12, 60, 685, 0, 0.82, 1);
  text(p1, 'Sistemas Desenvolvidos com as Mais Avancadas IAs', 'F2', 16, 60, 660, 1, 1, 1);
  text(p1, 'Na Argolo, transformamos operacoes comerciais com sistemas de PDV', 'F1', 11, 60, 630, 0.8, 0.85, 0.9);
  text(p1, 'ultrarrapidos, lojas online de alta conversao, ERPs integrados e uma', 'F1', 11, 60, 612, 0.8, 0.85, 0.9);
  text(p1, 'assessoria completa para o MEI, da abertura as obrigacoes fiscais.', 'F1', 11, 60, 594, 0.8, 0.85, 0.9);

  // Section 1 Box: PDV
  rect(p1, 40, 390, 515, 160, 0.04, 0.08, 0.18);
  strokeRect(p1, 40, 390, 515, 160, 0, 0.82, 1, 1);
  rect(p1, 55, 515, 30, 24, 0, 0.82, 1);
  text(p1, '01', 'F2', 12, 62, 522, 0.02, 0.04, 0.09);
  text(p1, 'SISTEMA PDV - FRENTE DE CAIXA INTELIGENTE (COM IA)', 'F2', 13, 95, 523, 1, 1, 1);
  text(p1, 'Engenharia com IA avancada para operacao rapida sem travamentos no balcao.', 'F3', 10, 60, 498, 0, 0.82, 1);
  text(p1, '- Emissao ultrarrapida de Cupom Fiscal Eletronico (NFC-e / SAT) e recibos.', 'F1', 10, 60, 476, 0.85, 0.9, 0.95);
  text(p1, '- Gestao completa de turnos, suprimento, sangria e fechamento seguro de caixa.', 'F1', 10, 60, 458, 0.85, 0.9, 0.95);
  text(p1, '- Integracao direta com maquininhas de cartao, TEF, leitores de codigo de barras e Pix.', 'F1', 10, 60, 440, 0.85, 0.9, 0.95);
  text(p1, '- Sincronizacao automatica com estoque e retaguarda em tempo real.', 'F1', 10, 60, 422, 0.85, 0.9, 0.95);
  text(p1, 'Beneficio: Fim das filas, rapidez no atendimento e controle rigoroso de cada venda.', 'F2', 10, 60, 404, 0.9, 0.9, 0.95);

  // Section 2 Box: VENDAS ONLINE
  rect(p1, 40, 210, 515, 160, 0.04, 0.08, 0.18);
  strokeRect(p1, 40, 210, 515, 160, 0, 0.82, 1, 1);
  rect(p1, 55, 335, 30, 24, 0, 0.82, 1);
  text(p1, '02', 'F2', 12, 62, 342, 0.02, 0.04, 0.09);
  text(p1, 'SITES PARA VENDAS ONLINE & E-COMMERCE (COM IA)', 'F2', 13, 95, 343, 1, 1, 1);
  text(p1, 'Lojas virtuais arquitetadas com IA para maxima velocidade e conversao.', 'F3', 10, 60, 318, 0, 0.82, 1);
  text(p1, '- Design 100% responsivo projetado especificamente para navegacao em celulares.', 'F1', 10, 60, 296, 0.85, 0.9, 0.95);
  text(p1, '- Meios de pagamento integrados: Pix com baixa automatica, cartao em ate 12x e boleto.', 'F1', 10, 60, 278, 0.85, 0.9, 0.95);
  text(p1, '- Calculo de frete em tempo real com Correios e principais transportadoras do Brasil.', 'F1', 10, 60, 260, 0.85, 0.9, 0.95);
  text(p1, '- Painel administrativo intuitivo para cadastro de produtos, cupons e estoque.', 'F1', 10, 60, 242, 0.85, 0.9, 0.95);
  text(p1, 'Beneficio: Seu comercio vendendo 24 horas por dia com seguranca e sem intermediarios.', 'F2', 10, 60, 224, 0.9, 0.9, 0.95);

  // Footer page 1
  line(p1, 40, 60, 555, 60, 0.2, 0.3, 0.4);
  text(p1, 'Argolo Consultoria e Tecnologia | WhatsApp: (11) 96639-8871', 'F1', 9, 40, 42, 0.6, 0.7, 0.8);
  text(p1, 'Pagina 1 de 2', 'F2', 9, 500, 42, 0, 0.82, 1);

  builder.createPage(p1);

  // ==========================================
  // PAGE 2: ERP, CONSULTORIA MEI & CONTATOS
  // ==========================================
  const p2 = [];
  // Background navy
  rect(p2, 0, 0, 595.28, 841.89, 0.02, 0.04, 0.09);

  // Cyan top accent banner
  rect(p2, 0, 835, 595.28, 7, 0, 0.82, 1);

  // Page 2 header
  text(p2, 'ARGOLO CONSULTORIA E TECNOLOGIA', 'F2', 12, 40, 810, 0, 0.82, 1);
  text(p2, 'SOLUCOES DE GESTAO INTEGRADA E ASSESSORIA MEI', 'F1', 10, 40, 794, 0.7, 0.75, 0.85);
  line(p2, 40, 785, 555, 785, 0.2, 0.3, 0.4);

  // Section 3 Box: ERP
  rect(p2, 40, 605, 515, 165, 0.04, 0.08, 0.18);
  strokeRect(p2, 40, 605, 515, 165, 0, 0.82, 1, 1);
  rect(p2, 55, 735, 30, 24, 0, 0.82, 1);
  text(p2, '03', 'F2', 12, 62, 742, 0.02, 0.04, 0.09);
  text(p2, 'SISTEMAS ERP DE GESTAO EMPRESARIAL (COM IA)', 'F2', 13, 95, 743, 1, 1, 1);
  text(p2, 'Automatize financas e estoques com a precisao da Inteligencia Artificial.', 'F3', 10, 60, 718, 0, 0.82, 1);
  text(p2, '- Modulo Financeiro: contas a pagar, contas a receber, conciliacao e fluxo de caixa.', 'F1', 10, 60, 696, 0.85, 0.9, 0.95);
  text(p2, '- Controle inteligente de estoque com alertas de reposicao e inventario automatico.', 'F1', 10, 60, 678, 0.85, 0.9, 0.95);
  text(p2, '- Emissao automatizada e simplificada de Nota Fiscal Eletronica (NF-e mercantil).', 'F1', 10, 60, 660, 0.85, 0.9, 0.95);
  text(p2, '- Demonstrativos de Resultados (DRE), relatorios de vendas e margem de lucro.', 'F1', 10, 60, 642, 0.85, 0.9, 0.95);
  text(p2, 'Beneficio: Visao 360 do negocio, eliminando planilhas manuais e erros de calculo.', 'F2', 10, 60, 624, 0.9, 0.9, 0.95);

  // Section 4 Box: CONSULTORIA COMPLETA PARA MEI
  rect(p2, 40, 420, 515, 165, 0.04, 0.08, 0.18);
  strokeRect(p2, 40, 420, 515, 165, 0, 0.82, 1, 1);
  rect(p2, 55, 550, 30, 24, 0, 0.82, 1);
  text(p2, '04', 'F2', 12, 62, 557, 0.02, 0.04, 0.09);
  text(p2, 'CONSULTORIA COMPLETA PARA MEI (FORMALIZACAO A ROTINA)', 'F2', 13, 95, 558, 1, 1, 1);
  text(p2, 'Zero burocracia, zero dor de cabeca e zero multas com a Receita Federal.', 'F3', 10, 60, 533, 0, 0.82, 1);
  text(p2, '- Abertura e formalizacao do CNPJ MEI com enquadramento correto de CNAEs.', 'F1', 10, 60, 511, 0.85, 0.9, 0.95);
  text(p2, '- Emissao mensal/diaria de Notas Fiscais de Servico (NFS-e) e Comercio (NF-e).', 'F1', 10, 60, 493, 0.85, 0.9, 0.95);
  text(p2, '- Geracao, controle e envio mensal da guia DAS, evitando juros e perda do CNPJ.', 'F1', 10, 60, 475, 0.85, 0.9, 0.95);
  text(p2, '- Declaracao Anual de Faturamento (DASN-SIMEI) e parcelamento de pendencias.', 'F1', 10, 40 + 20, 457, 0.85, 0.9, 0.95);
  text(p2, 'Beneficio: Voce foca em atender seus clientes enquanto cuidamos de tudo perante o Fisco.', 'F2', 10, 60, 439, 0.9, 0.9, 0.95);

  // Section 5 Box: DIFERENCIAIS
  rect(p2, 40, 270, 515, 130, 0.05, 0.1, 0.22);
  strokeRect(p2, 40, 270, 515, 130, 0.2, 0.3, 0.5, 0.8);
  text(p2, 'POR QUE ESCOLHER A ARGOLO CONSULTORIA E TECNOLOGIA?', 'F2', 11, 60, 375, 0, 0.82, 1);
  text(p2, '1. Desenvolvimento com as IAs mais avancadas: codigos mais limpos, estaveis e rapidos.', 'F1', 9.5, 60, 355, 0.9, 0.9, 0.95);
  text(p2, '2. Ecossistema Comercial Integrado: PDV + Loja Online + ERP sincronizados.', 'F1', 9.5, 60, 338, 0.9, 0.9, 0.95);
  text(p2, '3. Atendimento Agil e Humano no WhatsApp: contato direto sem intermediarios.', 'F1', 9.5, 60, 321, 0.9, 0.9, 0.95);
  text(p2, '4. Valores Transparentes e Justos: planos acessiveis para o micro e pequeno comerciante.', 'F1', 9.5, 60, 304, 0.9, 0.9, 0.95);
  text(p2, '5. Suporte Continuo: do primeiro dia da abertura do MEI a migracao quando crescer.', 'F1', 9.5, 60, 287, 0.9, 0.9, 0.95);

  // Contact Box
  rect(p2, 40, 85, 515, 165, 0.04, 0.08, 0.18);
  strokeRect(p2, 40, 85, 515, 165, 0, 0.82, 1, 1.2);
  text(p2, 'CANAIS DIRETOS PARA ATENDIMENTO E CONTRATACAO', 'F2', 12, 60, 225, 0, 0.82, 1);
  text(p2, 'Fale conosco agora mesmo para um diagnostico gratuito do seu negocio:', 'F1', 10, 60, 205, 0.85, 0.9, 0.95);
  text(p2, 'WHATSAPP OFICIAL:  (11) 96639-8871', 'F2', 11, 60, 180, 0.2, 0.95, 0.5);
  text(p2, 'E-MAIL COMERCIAL:   contato@argoloconsultotec.com.br', 'F2', 11, 60, 160, 0, 0.82, 1);
  text(p2, 'INSTAGRAM OFICIAL:  @consultoriaargolo', 'F2', 11, 60, 140, 1, 0.4, 0.7);
  text(p2, 'ATENDIMENTO:        Segunda a Sexta, das 08h as 18h | Todo o Brasil (Remoto e Presencial)', 'F1', 9.5, 60, 115, 0.7, 0.75, 0.85);
  text(p2, 'Argolo Consultoria e Tecnologia - CNPJ e operacao regularizada', 'F3', 8.5, 60, 98, 0.5, 0.55, 0.65);

  // Footer page 2
  line(p2, 40, 60, 555, 60, 0.2, 0.3, 0.4);
  text(p2, 'Argolo Consultoria e Tecnologia | Todos os direitos reservados', 'F1', 9, 40, 42, 0.6, 0.7, 0.8);
  text(p2, 'Pagina 2 de 2', 'F2', 9, 500, 42, 0, 0.82, 1);

  builder.createPage(p2);

  // Write file
  const pdfBuffer = builder.generate();
  const outputPath = path.join(__dirname, 'downloads', 'Portfolio_Servicos_Argolo.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`[OK] PDF gerado com sucesso em: ${outputPath} (${pdfBuffer.length} bytes)`);
}

buildPortfolio();
