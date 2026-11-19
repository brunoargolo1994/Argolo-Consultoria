const fs = require('fs');
const path = require('path');

// Helper to escape PDF text strings
function escapePdfText(text) {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');

  return normalized.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class AdvancedPdfBuilder {
  constructor() {
    this.objects = [];
    this.pages = [];
    this.xobjects = {};
  }

  addObject(content) {
    const objNum = this.objects.length + 1;
    this.objects.push({ num: objNum, content });
    return objNum;
  }

  addBinaryObject(dictHeader, buffer) {
    const objNum = this.objects.length + 1;
    this.objects.push({ num: objNum, dictHeader, buffer, isBinary: true });
    return objNum;
  }

  createPage(operations) {
    const streamContent = operations.join('\n');
    const length = Buffer.byteLength(streamContent, 'utf-8');
    const contentObjNum = this.addObject(`<< /Length ${length} >>\nstream\n${streamContent}\nendstream`);
    const pageObjNum = this.addObject(null);
    this.pages.push({ pageObjNum, contentObjNum });
    return pageObjNum;
  }

  registerXObject(name, objNum) {
    this.xobjects[name] = objNum;
  }

  generate() {
    // 1. Fonts
    const f1Obj = this.addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
    const f2Obj = this.addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
    const f3Obj = this.addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>`);

    // Build XObject dict string
    let xobjDict = '';
    for (const [name, num] of Object.entries(this.xobjects)) {
      xobjDict += `/${name} ${num} 0 R `;
    }

    const pagesObjNum = this.addObject(null);
    const pageRefs = [];

    for (const page of this.pages) {
      pageRefs.push(`${page.pageObjNum} 0 R`);
      const pageContent = `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${f1Obj} 0 R /F2 ${f2Obj} 0 R /F3 ${f3Obj} 0 R >> /XObject << ${xobjDict}>> >> /Contents ${page.contentObjNum} 0 R >>`;
      this.objects[page.pageObjNum - 1].content = pageContent;
    }

    this.objects[pagesObjNum - 1].content = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${this.pages.length} >>`;
    const catalogObj = this.addObject(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

    // Serialize chunks
    const chunks = [];
    let currentOffset = 0;
    const offsets = [];

    function pushChunk(buf) {
      chunks.push(buf);
      currentOffset += buf.length;
    }

    pushChunk(Buffer.from('%PDF-1.4\n', 'utf-8'));

    for (const obj of this.objects) {
      offsets[obj.num] = currentOffset;
      if (obj.isBinary) {
        const header = Buffer.from(`${obj.num} 0 obj\n${obj.dictHeader}\nstream\n`, 'utf-8');
        const footer = Buffer.from('\nendstream\nendobj\n', 'utf-8');
        pushChunk(header);
        pushChunk(obj.buffer);
        pushChunk(footer);
      } else {
        const textObj = Buffer.from(`${obj.num} 0 obj\n${obj.content}\nendobj\n`, 'utf-8');
        pushChunk(textObj);
      }
    }

    const xrefOffset = currentOffset;
    let xref = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= this.objects.length; i++) {
      xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    pushChunk(Buffer.from(xref, 'utf-8'));

    return Buffer.concat(chunks);
  }
}

function buildPortfolioWithLogo() {
  const builder = new AdvancedPdfBuilder();

  // Load official logo image
  const logoPath = path.join(__dirname, 'img', 'logo.jpg');
  const logoBuffer = fs.readFileSync(logoPath);

  // Register image XObject
  const logoObjNum = builder.addBinaryObject(
    `<< /Type /XObject /Subtype /Image /Width 1024 /Height 571 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBuffer.length} >>`,
    logoBuffer
  );
  builder.registerXObject('CompanyLogo', logoObjNum);

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

  function drawImage(ops, name, x, y, width, height) {
    ops.push(`q`);
    ops.push(`${width} 0 0 ${height} ${x} ${y} cm`);
    ops.push(`/${name} Do`);
    ops.push(`Q`);
  }

  // ==========================================
  // PAGE 1: COVER WITH OFFICIAL LOGO
  // ==========================================
  const p1 = [];
  // Background navy
  rect(p1, 0, 0, 595.28, 841.89, 0.02, 0.04, 0.09);

  // Cyan top accent banner
  rect(p1, 0, 835, 595.28, 7, 0, 0.82, 1);

  // Draw Official Logo on Top Left
  // Logo aspect ratio 1024 / 571 = ~1.79
  const logoW = 160;
  const logoH = Math.round(logoW * (571 / 1024)); // ~89
  drawImage(p1, 'CompanyLogo', 40, 730, logoW, logoH);

  // Top header text on Right side of logo
  rect(p1, 215, 730, 340, logoH, 0.04, 0.08, 0.18);
  strokeRect(p1, 215, 730, 340, logoH, 0, 0.82, 1, 1);
  text(p1, 'ARGOLO CONSULTORIA E TECNOLOGIA', 'F2', 13, 230, 792, 1, 1, 1);
  text(p1, 'SISTEMAS COMERCIAIS & ASSESSORIA TOTAL MEI', 'F2', 9, 230, 775, 0, 0.82, 1);
  text(p1, 'Desenvolvido atraves das Mais Avancadas Inteligencias Artificiais', 'F1', 8.5, 230, 758, 0.8, 0.85, 0.9);
  text(p1, 'CATALOGO OFICIAL DE SOLUCOES 2026', 'F2', 8, 230, 742, 0.2, 0.95, 0.5);

  // Main Hero Overview Box
  rect(p1, 40, 565, 515, 145, 0.04, 0.08, 0.18);
  strokeRect(p1, 40, 565, 515, 145, 0.2, 0.3, 0.5, 0.8);
  text(p1, 'TECNOLOGIA DE PONTA & GESTAO SEM COMPLICACOES', 'F2', 11, 60, 680, 0, 0.82, 1);
  text(p1, 'Acelere Suas Vendas com Softwares Criados com IA', 'F2', 15, 60, 658, 1, 1, 1);
  text(p1, 'A Argolo une engenharia de software de ultima geracao com consultoria', 'F1', 10.5, 60, 632, 0.85, 0.9, 0.95);
  text(p1, 'contabil e fiscal continua. Desenvolvemos sistemas PDV que nao travam,', 'F1', 10.5, 60, 615, 0.85, 0.9, 0.95);
  text(p1, 'e-commerces de alta conversao, ERPs integrados e blindagem total para o MEI.', 'F1', 10.5, 60, 598, 0.85, 0.9, 0.95);
  text(p1, 'Missao: Fazer seu comercio vender mais e eliminar o medo do Fisco.', 'F2', 10, 60, 578, 0.2, 0.95, 0.5);

  // Section 1 Box: PDV
  rect(p1, 40, 385, 515, 160, 0.04, 0.08, 0.18);
  strokeRect(p1, 40, 385, 515, 160, 0, 0.82, 1, 1);
  rect(p1, 55, 510, 30, 24, 0, 0.82, 1);
  text(p1, '01', 'F2', 12, 62, 517, 0.02, 0.04, 0.09);
  text(p1, 'SISTEMA PDV - FRENTE DE CAIXA INTELIGENTE (COM IA)', 'F2', 13, 95, 518, 1, 1, 1);
  text(p1, 'Desenvolvido atraves de Inteligencias Artificiais para maxima estabilidade.', 'F3', 9.5, 60, 494, 0, 0.82, 1);
  text(p1, '- Emissao rapida de Cupom Fiscal Eletronico (NFC-e / SAT) e recibos.', 'F1', 10, 60, 472, 0.85, 0.9, 0.95);
  text(p1, '- Gestao completa de turnos, suprimento, sangria e fechamento seguro de caixa.', 'F1', 10, 60, 454, 0.85, 0.9, 0.95);
  text(p1, '- Integracao direta com maquininhas de cartao, TEF, leitores de codigo de barras e Pix.', 'F1', 10, 60, 436, 0.85, 0.9, 0.95);
  text(p1, '- Sincronizacao automatica com controle de estoque e retaguarda em nuvem.', 'F1', 10, 60, 418, 0.85, 0.9, 0.95);
  text(p1, 'Beneficio: Atendimento sem filas, caixa blindado contra erros e estoque em dia.', 'F2', 9.5, 60, 400, 0.9, 0.9, 0.95);

  // Section 2 Box: VENDAS ONLINE
  rect(p1, 40, 205, 515, 160, 0.04, 0.08, 0.18);
  strokeRect(p1, 40, 205, 515, 160, 0, 0.82, 1, 1);
  rect(p1, 55, 330, 30, 24, 0, 0.82, 1);
  text(p1, '02', 'F2', 12, 62, 337, 0.02, 0.04, 0.09);
  text(p1, 'SITES PARA VENDAS ONLINE & E-COMMERCE (COM IA)', 'F2', 13, 95, 338, 1, 1, 1);
  text(p1, 'Lojas virtuais e catalogos arquitetados com IA para velocidade e conversao.', 'F3', 9.5, 60, 314, 0, 0.82, 1);
  text(p1, '- Lojas 100% responsivas otimizadas para compras rapidas em smartphones.', 'F1', 10, 60, 292, 0.85, 0.9, 0.95);
  text(p1, '- Meios de pagamento integrados: Pix com baixa automatica, cartao em ate 12x e boleto.', 'F1', 10, 60, 274, 0.85, 0.9, 0.95);
  text(p1, '- Calculo automatico de frete integrado (Correios, transportadoras e frete local).', 'F1', 10, 60, 256, 0.85, 0.9, 0.95);
  text(p1, '- Painel simples para gerenciamento de produtos, pedidos, clientes e promocoes.', 'F1', 10, 60, 238, 0.85, 0.9, 0.95);
  text(p1, 'Beneficio: Sua empresa vendendo na internet 24h por dia com total controle e lucro.', 'F2', 9.5, 60, 220, 0.9, 0.9, 0.95);

  // Footer page 1
  line(p1, 40, 60, 555, 60, 0.2, 0.3, 0.4);
  text(p1, 'Argolo Consultoria e Tecnologia | WhatsApp: (11) 96639-8871 | contato@argoloconsultotec.com.br', 'F1', 8.5, 40, 42, 0.6, 0.7, 0.8);
  text(p1, 'Pagina 1 de 2', 'F2', 9, 500, 42, 0, 0.82, 1);

  builder.createPage(p1);

  // ==========================================
  // PAGE 2: ERP, MEI & CANAIS COM MINI LOGO
  // ==========================================
  const p2 = [];
  rect(p2, 0, 0, 595.28, 841.89, 0.02, 0.04, 0.09);
  rect(p2, 0, 835, 595.28, 7, 0, 0.82, 1);

  // Mini logo on page 2
  const miniLogoW = 100;
  const miniLogoH = Math.round(miniLogoW * (571 / 1024)); // ~56
  drawImage(p2, 'CompanyLogo', 40, 770, miniLogoW, miniLogoH);

  text(p2, 'ARGOLO CONSULTORIA E TECNOLOGIA', 'F2', 12, 150, 804, 0, 0.82, 1);
  text(p2, 'SOLUCOES DE GESTAO EMPRESARIAL INTEGRADA E ASSESSORIA MEI', 'F1', 9.5, 150, 788, 0.8, 0.85, 0.9);
  line(p2, 40, 760, 555, 760, 0.2, 0.3, 0.4);

  // Section 3 Box: ERP
  rect(p2, 40, 580, 515, 165, 0.04, 0.08, 0.18);
  strokeRect(p2, 40, 580, 515, 165, 0, 0.82, 1, 1);
  rect(p2, 55, 710, 30, 24, 0, 0.82, 1);
  text(p2, '03', 'F2', 12, 62, 717, 0.02, 0.04, 0.09);
  text(p2, 'SISTEMAS ERP DE GESTAO EMPRESARIAL (COM IA)', 'F2', 13, 95, 718, 1, 1, 1);
  text(p2, 'Automatize processos financeiros e operacionais com a precisao da Inteligencia Artificial.', 'F3', 9.5, 60, 694, 0, 0.82, 1);
  text(p2, '- Modulo Financeiro: fluxo de caixa, contas a pagar, contas a receber e DRE gerencial.', 'F1', 10, 60, 672, 0.85, 0.9, 0.95);
  text(p2, '- Controle inteligente de estoque em tempo real com alertas preditivos de reposicao.', 'F1', 10, 60, 654, 0.85, 0.9, 0.95);
  text(p2, '- Emissao automatizada e simplificada de Nota Fiscal Eletronica (NF-e mercantil).', 'F1', 10, 60, 636, 0.85, 0.9, 0.95);
  text(p2, '- Relatorios de lucratividade, desempenho por vendedor e analise de compras.', 'F1', 10, 60, 618, 0.85, 0.9, 0.95);
  text(p2, 'Beneficio: Decisoes baseadas em dados reais, sem retrabalho manual ou planilhas confusas.', 'F2', 9.5, 60, 600, 0.9, 0.9, 0.95);

  // Section 4 Box: CONSULTORIA COMPLETA PARA MEI
  rect(p2, 40, 395, 515, 165, 0.04, 0.08, 0.18);
  strokeRect(p2, 40, 395, 515, 165, 0, 0.82, 1, 1);
  rect(p2, 55, 525, 30, 24, 0, 0.82, 1);
  text(p2, '04', 'F2', 12, 62, 532, 0.02, 0.04, 0.09);
  text(p2, 'CONSULTORIA COMPLETA PARA MEI (FORMALIZACAO A ROTINA)', 'F2', 13, 95, 533, 1, 1, 1);
  text(p2, 'Zero burocracia, acompanhamento continuo e blindagem contra multas fiscais.', 'F3', 9.5, 60, 509, 0, 0.82, 1);
  text(p2, '- Formalizacao e abertura gratuita do CNPJ MEI com enquadramento de CNAEs correto.', 'F1', 10, 60, 487, 0.85, 0.9, 0.95);
  text(p2, '- Emissao mensal e diaria de Notas Fiscais de Servico (NFS-e) e Comercio (NF-e).', 'F1', 10, 60, 469, 0.85, 0.9, 0.95);
  text(p2, '- Geracao, envio e controle do DAS mensal, evitando cancelamentos de beneficios.', 'F1', 10, 60, 451, 0.85, 0.9, 0.95);
  text(p2, '- Declaracao Anual de Faturamento (DASN-SIMEI) e parcelamento de dividas ativas.', 'F1', 10, 60, 433, 0.85, 0.9, 0.95);
  text(p2, 'Beneficio: Cuidamos de cada documento fiscal para voce focar 100% no seu crescimento.', 'F2', 9.5, 60, 415, 0.9, 0.9, 0.95);

  // Differentials
  rect(p2, 40, 255, 515, 125, 0.05, 0.1, 0.22);
  strokeRect(p2, 40, 255, 515, 125, 0.2, 0.3, 0.5, 0.8);
  text(p2, 'DIFERENCIAIS EXCLUSIVOS DA ARGOLO CONSULTORIA E TECNOLOGIA', 'F2', 11, 60, 355, 0, 0.82, 1);
  text(p2, '1. Softwares Desenvolvidos com as Mais Avancadas IAs: sistemas rapidos, seguros e estaveis.', 'F1', 9.5, 60, 335, 0.9, 0.9, 0.95);
  text(p2, '2. Ecossistema Integrado: PDV + Loja Online + ERP operando em perfeita sincronia.', 'F1', 9.5, 60, 318, 0.9, 0.9, 0.95);
  text(p2, '3. Suporte Humano e Agil no WhatsApp: atendimento direto com nossos especialistas.', 'F1', 9.5, 60, 301, 0.9, 0.9, 0.95);
  text(p2, '4. Valores Acessiveis: planos desenhados para a realidade financeira do microempresario.', 'F1', 9.5, 60, 284, 0.9, 0.9, 0.95);
  text(p2, '5. Assessoria de Ponta a Ponta: da abertura do MEI a transicao para ME.', 'F1', 9.5, 60, 267, 0.9, 0.9, 0.95);

  // Contacts
  rect(p2, 40, 80, 515, 160, 0.04, 0.08, 0.18);
  strokeRect(p2, 40, 80, 515, 160, 0, 0.82, 1, 1.2);
  text(p2, 'CANAIS OFICIAIS PARA ATENDIMENTO E CONTRATACAO', 'F2', 12, 60, 218, 0, 0.82, 1);
  text(p2, 'Entre em contato para um diagnostico gratuito e sem compromisso:', 'F1', 9.5, 60, 198, 0.85, 0.9, 0.95);
  text(p2, 'WHATSAPP OFICIAL:  (11) 96639-8871', 'F2', 11, 60, 175, 0.2, 0.95, 0.5);
  text(p2, 'E-MAIL COMERCIAL:   contato@argoloconsultotec.com.br', 'F2', 11, 60, 155, 0, 0.82, 1);
  text(p2, 'INSTAGRAM OFICIAL:  @consultoriaargolo', 'F2', 11, 60, 135, 1, 0.4, 0.7);
  text(p2, 'ATENDIMENTO:        Segunda a Sexta, das 08h as 18h | Todo o Brasil (Online e Presencial)', 'F1', 9, 60, 112, 0.7, 0.75, 0.85);
  text(p2, 'Argolo Consultoria e Tecnologia - Tecnologia com IA e Assessoria Completa MEI', 'F3', 8.5, 60, 95, 0.5, 0.55, 0.65);

  // Footer page 2
  line(p2, 40, 60, 555, 60, 0.2, 0.3, 0.4);
  text(p2, 'Argolo Consultoria e Tecnologia | Todos os direitos reservados', 'F1', 8.5, 40, 42, 0.6, 0.7, 0.8);
  text(p2, 'Pagina 2 de 2', 'F2', 9, 500, 42, 0, 0.82, 1);

  builder.createPage(p2);

  const pdfBuffer = builder.generate();
  const outputPath = path.join(__dirname, 'downloads', 'Portfolio_Servicos_Argolo.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`[OK] PDF gerado com logo em: ${outputPath} (${pdfBuffer.length} bytes)`);
}

buildPortfolioWithLogo();
