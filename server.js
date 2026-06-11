
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const writeDb = db => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
const uid = p => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const num = v => { const n = Number(String(v ?? 0).replace(/\./g,'').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const money = v => Math.round(num(v) * 100) / 100;
const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num(v));
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const today = () => new Date().toISOString().slice(0,10);
const dateBR = v => !v ? '-' : String(v).slice(0,10).split('-').reverse().join('/');
const monthBR = v => !v ? '-' : String(v).slice(0,7).split('-').reverse().join('/');
const find = (arr, id) => arr.find(x => x.id === id) || null;
const send = (res, status, body, type='text/html; charset=utf-8') => { res.writeHead(status, {'Content-Type': type}); res.end(body); };
const redirect = (res, to) => { res.writeHead(303, { Location: to }); res.end(); };

function parseBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      const params = new URLSearchParams(data);
      const body = {};
      for (const [k,v] of params.entries()) body[k] = v;
      resolve(body);
    });
  });
}

function addMonths(ymd, months) {
  const d = new Date(ymd + 'T12:00:00');
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < originalDay) d.setDate(0);
  return d.toISOString().slice(0,10);
}
function addDays(ymd, days) {
  const d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10);
}
function addMonthsCompetencia(ym, months) {
  const d = new Date(ym + '-01T12:00:00'); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0,7);
}

function maps(db) {
  const map = arr => Object.fromEntries(arr.map(i => [i.id, i]));
  return { filiais: map(db.filiais), credores: map(db.credoresDevedores), centros: map(db.centrosCusto), planos: map(db.planosContas), referencias: map(db.referencias), parcelas: map(db.parcelasTipos) };
}

function addLog(db, acao, entidade, entidadeId, dados = {}) {
  db.logs.unshift({ id: uid('log'), createdAt: new Date().toISOString(), acao, entidade, entidadeId, dados });
  db.logs = db.logs.slice(0, 150);
}

function statusLabel(s, tipo='despesa') {
  return ({ provisionado:'Provisionado', aprovado:'Aprovado', liquidado: tipo === 'receita' ? 'Recebido' : 'Pago', vencido:'Vencido', cancelado:'Cancelado' })[s] || s;
}
function badge(s) { return ({ provisionado:'neutral', aprovado:'info', liquidado:'success', vencido:'danger', cancelado:'mutedBadge' })[s] || 'neutral'; }
function tipoLabel(t) { return t === 'receita' ? 'Receita' : 'Despesa'; }
function tipoClass(t) { return t === 'receita' ? 'positive' : 'negative'; }

function criarRateios(db, lancamento, body = {}) {
  db.rateios = db.rateios.filter(r => r.lancamentoId !== lancamento.id);
  const filiaisAtivas = db.filiais.filter(f => f.status === 'ativa');
  const total = money(lancamento.valorProvisionado);
  const novos = [];

  if (lancamento.rateioModo === 'sem_rateio') {
    novos.push({ id: uid('rat'), lancamentoId: lancamento.id, filialId: lancamento.filialId, modo:'sem_rateio', percentual:100, valorRateado:total });
  }

  if (lancamento.rateioModo === 'padrao_percentual') {
    const soma = filiaisAtivas.reduce((s, f) => s + num(f.percentualRateioPadrao), 0);
    if (Math.abs(soma - 100) > 0.01) throw new Error('O rateio padrão das filiais precisa somar 100%.');
    let acumulado = 0;
    filiaisAtivas.forEach((f, idx) => {
      let valor = idx === filiaisAtivas.length - 1 ? money(total - acumulado) : money(total * num(f.percentualRateioPadrao) / 100);
      acumulado += valor;
      novos.push({ id: uid('rat'), lancamentoId: lancamento.id, filialId: f.id, modo:'percentual', percentual:num(f.percentualRateioPadrao), valorRateado:valor });
    });
  }

  if (lancamento.rateioModo === 'manual_percentual') {
    const soma = filiaisAtivas.reduce((s, f) => s + num(body[`rateio_perc_${f.id}`]), 0);
    if (Math.abs(soma - 100) > 0.01) throw new Error('No rateio manual por percentual, a soma precisa ser 100%.');
    let acumulado = 0;
    filiaisAtivas.forEach((f, idx) => {
      const perc = num(body[`rateio_perc_${f.id}`]);
      let valor = idx === filiaisAtivas.length - 1 ? money(total - acumulado) : money(total * perc / 100);
      acumulado += valor;
      if (perc > 0 || valor > 0) novos.push({ id: uid('rat'), lancamentoId: lancamento.id, filialId:f.id, modo:'percentual', percentual:perc, valorRateado:valor });
    });
  }

  if (lancamento.rateioModo === 'manual_valor') {
    const soma = filiaisAtivas.reduce((s, f) => s + money(body[`rateio_valor_${f.id}`]), 0);
    if (Math.abs(soma - total) > 0.01) throw new Error(`No rateio manual por valor, a soma precisa fechar ${brl(total)}.`);
    filiaisAtivas.forEach(f => {
      const valor = money(body[`rateio_valor_${f.id}`]);
      const perc = total ? money(valor * 100 / total) : 0;
      if (valor > 0) novos.push({ id: uid('rat'), lancamentoId: lancamento.id, filialId:f.id, modo:'valor', percentual:perc, valorRateado:valor });
    });
  }
  db.rateios.push(...novos);
}

function calcularDashboard(db) {
  const validos = db.lancamentos.filter(l => l.status !== 'cancelado');
  const entradas = validos.filter(l => l.tipo === 'receita').reduce((s,l)=>s+num(l.valorProvisionado),0);
  const despesas = validos.filter(l => l.tipo === 'despesa').reduce((s,l)=>s+num(l.valorProvisionado),0);
  const recebido = validos.filter(l => l.tipo === 'receita' && l.status === 'liquidado').reduce((s,l)=>s+num(l.valorRealizado || l.valorProvisionado),0);
  const pago = validos.filter(l => l.tipo === 'despesa' && l.status === 'liquidado').reduce((s,l)=>s+num(l.valorRealizado || l.valorProvisionado),0);
  const abertoReceita = validos.filter(l => l.tipo === 'receita' && l.status !== 'liquidado').reduce((s,l)=>s+num(l.valorProvisionado),0);
  const abertoDespesa = validos.filter(l => l.tipo === 'despesa' && l.status !== 'liquidado').reduce((s,l)=>s+num(l.valorProvisionado),0);
  const vencido = validos.filter(l => l.status !== 'liquidado' && l.vencimento < today()).reduce((s,l)=>s+num(l.valorProvisionado),0);
  const m = maps(db), porCentro = {}, porPlano = {}, porReferencia = {}, porFilial = {};
  for (const l of validos) {
    const fator = l.tipo === 'receita' ? 1 : -1;
    const cc = m.centros[l.centroCustoId]?.nome || 'Sem centro'; porCentro[cc] = (porCentro[cc] || 0) + fator * num(l.valorProvisionado);
    const pc = m.planos[l.planoContaId]?.nome || 'Sem plano'; porPlano[pc] = (porPlano[pc] || 0) + fator * num(l.valorProvisionado);
    const ref = m.referencias[l.referenciaId]?.nome || 'Sem referência'; porReferencia[ref] = (porReferencia[ref] || 0) + fator * num(l.valorProvisionado);
  }
  for (const r of db.rateios) {
    const l = find(db.lancamentos, r.lancamentoId); if (!l || l.status === 'cancelado') continue;
    const f = m.filiais[r.filialId]?.codigoNome || `${m.filiais[r.filialId]?.codigo || ''} - ${m.filiais[r.filialId]?.nome || 'Sem filial'}`;
    const fator = l.tipo === 'receita' ? 1 : -1;
    porFilial[f] = (porFilial[f] || 0) + fator * num(r.valorRateado);
  }
  const proximos = validos.filter(l => l.status !== 'liquidado').sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).slice(0,10);
  return { entradas, despesas, saldoPrevisto: entradas - despesas, recebido, pago, saldoRealizado: recebido - pago, abertoReceita, abertoDespesa, vencido, porCentro, porPlano, porReferencia, porFilial, proximos };
}

function nav(active) {
  const links = [ ['/', 'Dashboard', 'dashboard'], ['/lancamentos','Lançamentos','lancamentos'], ['/rateios','Rateios','rateios'], ['/filiais','Filiais','filiais'], ['/credores-devedores','Credores/Devedores','credores'], ['/classificacoes','Classificações','classificacoes'], ['/relatorios','Relatórios','relatorios'] ];
  return `<aside class="sidebar"><div class="brand">Glink<span>Finance</span></div><nav class="nav">${links.map(([href,label,key])=>`<a class="${active===key?'active':''}" href="${href}">${label}</a>`).join('')}</nav></aside>`;
}
function layout(title, active, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} - GlinkFinance</title><link rel="stylesheet" href="/public/styles.css"></head><body><div class="app">${nav(active)}<main class="main">${body}</main></div></body></html>`;
}
function header(t,s,a=''){ return `<div class="page-header"><div><h1>${esc(t)}</h1><p>${esc(s)}</p></div><div>${a}</div></div>`; }
function opts(list, selected='') { return list.map(i => `<option value="${esc(i.id)}" ${selected===i.id?'selected':''}>${esc(i.codigo ? `${i.codigo} - ${i.nome}` : i.nome)}</option>`).join(''); }
function tableRows(obj) { return Object.entries(obj).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="right ${v>=0?'positive':'negative'}">${brl(v)}</td></tr>`).join(''); }

function renderDashboard(db) {
  const d = calcularDashboard(db), m = maps(db);
  const prox = d.proximos.map(l=>`<tr><td><strong>${esc(l.descricao)}</strong><br><small>${esc(m.credores[l.credorDevedorId]?.nome || '-')}</small></td><td><span class="${tipoClass(l.tipo)}">${tipoLabel(l.tipo)}</span></td><td>${monthBR(l.competencia)}</td><td>${dateBR(l.vencimento)}</td><td><span class="badge ${badge(l.status)}">${statusLabel(l.status,l.tipo)}</span></td><td class="right">${brl(l.valorProvisionado)}</td></tr>`).join('');
  return layout('Dashboard','dashboard', header('Dashboard financeiro','Entradas, despesas, saldo, vencimentos e rateios por filial.') + `
  <div class="grid grid-4">
    <div class="card metric"><span>Receitas provisionadas</span><strong class="positive">${brl(d.entradas)}</strong><small>Competência/vencimento</small></div>
    <div class="card metric"><span>Despesas provisionadas</span><strong class="negative">${brl(d.despesas)}</strong><small>Contas a pagar</small></div>
    <div class="card metric"><span>Saldo previsto</span><strong class="${d.saldoPrevisto>=0?'positive':'negative'}">${brl(d.saldoPrevisto)}</strong><small>Receitas - despesas</small></div>
    <div class="card metric"><span>Vencidos em aberto</span><strong class="negative">${brl(d.vencido)}</strong><small>Não liquidados</small></div>
  </div>
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><h3>Saldo por filial/rateio</h3><table><tbody>${tableRows(d.porFilial) || '<tr><td>Sem dados</td></tr>'}</tbody></table></div>
    <div class="card"><h3>Plano de contas</h3><table><tbody>${tableRows(d.porPlano) || '<tr><td>Sem dados</td></tr>'}</tbody></table></div>
  </div>
  <h2 class="section-title">Próximos lançamentos</h2><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Competência</th><th>Vencimento</th><th>Status</th><th class="right">Valor</th></tr></thead><tbody>${prox || '<tr><td colspan="6">Sem lançamentos em aberto.</td></tr>'}</tbody></table>`);
}

function rateioInputs(db) {
  const percent = db.filiais.map(f=>`<label>${esc(f.codigo)} - ${esc(f.nome)} %<input type="number" step="0.01" name="rateio_perc_${esc(f.id)}" value="${num(f.percentualRateioPadrao).toFixed(2)}"></label>`).join('');
  const values = db.filiais.map(f=>`<label>${esc(f.codigo)} - ${esc(f.nome)} R$<input type="text" name="rateio_valor_${esc(f.id)}" value="0"></label>`).join('');
  return `<div class="card"><h3>Rateio entre filiais</h3><p class="subtle">Use padrão, percentual manual, valor manual ou sem rateio. Para percentual, a soma precisa fechar 100%. Para valor, a soma precisa fechar o valor provisionado.</p><div class="form-grid"><label>Modo de rateio<select name="rateioModo"><option value="padrao_percentual">Padrão por percentual</option><option value="manual_percentual">Manual por percentual</option><option value="manual_valor">Manual por valor</option><option value="sem_rateio">Sem rateio</option></select></label>${percent}</div><h4>Campos para rateio manual por valor</h4><div class="form-grid">${values}</div></div>`;
}

function renderLancamentos(db, err='') {
  const m = maps(db);
  const rows = db.lancamentos.slice().sort((a,b)=>b.vencimento.localeCompare(a.vencimento)).map(l=>`<tr><td><strong>${esc(l.descricao)}</strong><br><small>${esc(m.credores[l.credorDevedorId]?.nome || '-')}</small></td><td><span class="${tipoClass(l.tipo)}">${tipoLabel(l.tipo)}</span></td><td>${esc((m.filiais[l.filialId]?.codigo || '') + ' - ' + (m.filiais[l.filialId]?.nome || '-'))}</td><td>${esc(m.centros[l.centroCustoId]?.nome || '-')}<br><small>${esc(m.planos[l.planoContaId]?.nome || '-')} / ${esc(m.referencias[l.referenciaId]?.nome || '-')}</small></td><td>${monthBR(l.competencia)}<br><small>Venc.: ${dateBR(l.vencimento)}</small></td><td>${l.parcelaTotal>1?`${l.parcelaNumero}/${l.parcelaTotal}`:'Única'}</td><td><span class="badge ${badge(l.status)}">${statusLabel(l.status,l.tipo)}</span></td><td class="right">${brl(l.valorProvisionado)}</td><td class="actions">${l.status!=='liquidado'&&l.status!=='cancelado'?`<form method="post" action="/lancamentos/${l.id}/liquidar"><button class="small">Liquidar</button></form>`:''}${l.status!=='cancelado'?`<form method="post" action="/lancamentos/${l.id}/cancelar"><button class="small ghost">Cancelar</button></form>`:''}</td></tr>`).join('');
  const form = `<form method="post" action="/lancamentos" class="form">
    <div class="card"><h3>Novo lançamento</h3><div class="form-grid">
      <label>Tipo<select name="tipo"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label>
      <label>Credor/Devedor<select name="credorDevedorId">${opts(db.credoresDevedores)}</select></label>
      <label>Filial principal<select name="filialId">${opts(db.filiais)}</select></label>
      <label>Status<select name="status"><option value="provisionado">Provisionado</option><option value="aprovado">Aprovado</option></select></label>
      <label>Data de vencimento<input type="date" name="vencimento" value="2026-06-05" required></label>
      <label>Competência<input type="month" name="competencia" value="2026-05" required></label>
      <label>Centro de custo<select name="centroCustoId">${opts(db.centrosCusto)}</select></label>
      <label>Plano de contas<select name="planoContaId">${opts(db.planosContas)}</select></label>
      <label>Referência<select name="referenciaId">${opts(db.referencias)}</select></label>
      <label>Parcela<select name="parcelaTipoId">${opts(db.parcelasTipos)}</select></label>
      <label>Valor provisionado<input type="text" name="valorProvisionado" value="1000,00" required></label>
      <label>Valor informado é<select name="valorModoParcelamento"><option value="por_parcela">Valor de cada parcela</option><option value="total_dividido">Total dividido pelas parcelas</option></select></label>
    </div><label>Descrição<input name="descricao" value="Salário" required></label><label>Observação<textarea name="observacao"></textarea></label></div>
    <div class="card"><h3>Parcelamento</h3><div class="form-grid">
      <label>Quantidade de parcelas/meses<input type="number" name="quantidadeParcelas" min="1" value="1"></label>
      <label>Periodicidade<select name="periodicidade"><option value="mensal">Mensal</option><option value="intervalo">Por intervalo de dias</option></select></label>
      <label>Intervalo em dias<input type="number" name="intervaloDias" min="1" value="30"></label>
    </div></div>${rateioInputs(db)}<button>Criar lançamento</button></form>`;
  return layout('Lançamentos','lancamentos', header('Lançamentos','Entradas e despesas com vencimento, competência, classificação em três níveis, parcelamento e rateio.') + (err ? `<div class="error">${esc(err)}</div>` : '') + form + `<h2 class="section-title">Lançamentos cadastrados</h2><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Filial</th><th>Classificação</th><th>Competência</th><th>Parcela</th><th>Status</th><th class="right">Valor</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function renderFiliais(db) {
  const rows = db.filiais.map(f=>`<tr><td><strong>${esc(f.codigo)} - ${esc(f.nome)}</strong></td><td>${esc(f.razaoSocial)}</td><td>${esc(f.cnpj)}</td><td class="right">${num(f.percentualRateioPadrao).toFixed(2)}%</td><td><span class="badge success">${esc(f.status)}</span></td></tr>`).join('');
  return layout('Filiais','filiais', header('Filiais','Cadastro prévio das filiais/empresas participantes dos lançamentos e rateios.') + `<div class="card"><form method="post" action="/filiais" class="form"><div class="form-grid"><label>Código<input name="codigo" required></label><label>Nome<input name="nome" required></label><label>Razão social<input name="razaoSocial"></label><label>CNPJ<input name="cnpj"></label><label>Rateio padrão %<input type="number" step="0.01" name="percentualRateioPadrao" value="0"></label></div><button>Cadastrar filial</button></form></div><h2 class="section-title">Filiais cadastradas</h2><table><thead><tr><th>Filial</th><th>Razão social</th><th>CNPJ</th><th class="right">Rateio padrão</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function renderCredores(db) {
  const rows = db.credoresDevedores.map(c=>`<tr><td><strong>${esc(c.nome)}</strong><br><small>${esc(c.email || '-')} / ${esc(c.contato || '-')}</small></td><td>${esc(c.tipo)}</td><td>${esc(c.natureza)}</td><td>${esc(c.cpfCnpj)}</td><td>${esc(c.chavePix || '-')}</td><td><span class="badge success">${esc(c.status)}</span></td></tr>`).join('');
  return layout('Credores/Devedores','credores', header('Credores e devedores','Cadastro obrigatório antes do lançamento financeiro.') + `<div class="card"><form method="post" action="/credores-devedores" class="form"><div class="form-grid"><label>Nome/Razão social<input name="nome" required></label><label>Tipo<select name="tipo"><option value="credor">Credor</option><option value="devedor">Devedor</option></select></label><label>Natureza<select name="natureza"><option value="fornecedor">Fornecedor</option><option value="funcionario">Funcionário</option><option value="prestador">Prestador</option><option value="socio">Sócio</option><option value="cliente_outros">Cliente/Outros</option></select></label><label>CPF/CNPJ<input name="cpfCnpj"></label><label>E-mail<input name="email"></label><label>Contato<input name="contato"></label><label>Chave Pix<input name="chavePix"></label></div><button>Cadastrar credor/devedor</button></form></div><h2 class="section-title">Cadastrados</h2><table><thead><tr><th>Nome</th><th>Tipo</th><th>Natureza</th><th>CPF/CNPJ</th><th>Pix</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function simpleList(list){ return list.map(i=>`<span class="chip">${esc(i.nome)}</span>`).join(''); }
function renderClassificacoes(db) {
  return layout('Classificações','classificacoes', header('Classificações','Nível 1: Centro de custo. Nível 2: Plano de contas. Nível 3: Referência. Parcela também é pré-cadastrada.') + `<div class="grid grid-2">
    <div class="card"><h3>Nível 1 - Centros de custo</h3><div class="chips">${simpleList(db.centrosCusto)}</div><form method="post" action="/classificacoes/centro" class="form"><label>Novo centro<input name="nome"></label><button>Cadastrar</button></form></div>
    <div class="card"><h3>Nível 2 - Planos de contas</h3><div class="chips">${simpleList(db.planosContas)}</div><form method="post" action="/classificacoes/plano" class="form"><label>Novo plano<input name="nome"></label><button>Cadastrar</button></form></div>
    <div class="card"><h3>Nível 3 - Referências</h3><div class="chips">${simpleList(db.referencias)}</div><form method="post" action="/classificacoes/referencia" class="form"><label>Nova referência<input name="nome"></label><button>Cadastrar</button></form></div>
    <div class="card"><h3>Parcelas</h3><div class="chips">${simpleList(db.parcelasTipos)}</div><form method="post" action="/classificacoes/parcela" class="form"><label>Nova parcela<input name="nome"></label><button>Cadastrar</button></form></div>
  </div>`);
}

function renderRateios(db) {
  const m = maps(db);
  const rows = db.rateios.map(r=>{ const l=find(db.lancamentos,r.lancamentoId); if(!l) return ''; return `<tr><td><strong>${esc(l.descricao)}</strong><br><small>${tipoLabel(l.tipo)} · ${monthBR(l.competencia)}</small></td><td>${esc((m.filiais[r.filialId]?.codigo || '') + ' - ' + (m.filiais[r.filialId]?.nome || '-'))}</td><td>${esc(r.modo)}</td><td class="right">${num(r.percentual).toFixed(2)}%</td><td class="right">${brl(r.valorRateado)}</td><td><span class="badge ${badge(l.status)}">${statusLabel(l.status,l.tipo)}</span></td></tr>`; }).join('');
  return layout('Rateios','rateios', header('Rateios','Compartilhamento de lançamentos entre duas ou mais filiais por percentual ou valor.') + `<table><thead><tr><th>Lançamento</th><th>Filial</th><th>Modo</th><th class="right">Percentual</th><th class="right">Valor</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function renderRelatorios(db) {
  const d = calcularDashboard(db);
  const logs = db.logs.slice(0,20).map(l=>`<tr><td>${dateBR(l.createdAt)}</td><td>${esc(l.acao)}</td><td>${esc(l.entidade)}</td><td>${esc(l.entidadeId)}</td></tr>`).join('');
  return layout('Relatórios','relatorios', header('Relatórios','Visões gerenciais e exportações do MVP.', '<a class="btn" href="/export/lancamentos.csv">Exportar CSV</a>') + `<div class="grid grid-3"><div class="card"><h3>Centro de custo</h3><table><tbody>${tableRows(d.porCentro)}</tbody></table></div><div class="card"><h3>Plano de contas</h3><table><tbody>${tableRows(d.porPlano)}</tbody></table></div><div class="card"><h3>Referência</h3><table><tbody>${tableRows(d.porReferencia)}</tbody></table></div></div><h2 class="section-title">Logs de auditoria</h2><table><thead><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>ID</th></tr></thead><tbody>${logs || '<tr><td colspan="4">Sem logs.</td></tr>'}</tbody></table>`);
}

function criarLancamentosComParcelas(db, body) {
  const q = Math.max(1, Math.min(120, parseInt(body.quantidadeParcelas || '1',10) || 1));
  const grupo = q > 1 ? uid('grp') : uid('grp');
  const totalInput = money(body.valorProvisionado);
  const valores = [];
  if (body.valorModoParcelamento === 'total_dividido' && q > 1) {
    let acumulado = 0;
    for (let i=1;i<=q;i++) {
      const v = i === q ? money(totalInput - acumulado) : money(totalInput / q);
      acumulado += v; valores.push(v);
    }
  } else {
    for (let i=1;i<=q;i++) valores.push(totalInput);
  }
  const criados = [];
  for (let i=0;i<q;i++) {
    const vencimento = body.periodicidade === 'intervalo' ? addDays(body.vencimento, i * (parseInt(body.intervaloDias || '30',10)||30)) : addMonths(body.vencimento, i);
    const competencia = body.periodicidade === 'intervalo' ? addMonthsCompetencia(body.competencia, i) : addMonthsCompetencia(body.competencia, i);
    const desc = q > 1 ? `${body.descricao} - Parcela ${i+1}/${q}` : body.descricao;
    const l = { id: uid('lan'), grupoParcelamentoId: grupo, tipo: body.tipo, descricao: desc, credorDevedorId: body.credorDevedorId, filialId: body.filialId, centroCustoId: body.centroCustoId, planoContaId: body.planoContaId, referenciaId: body.referenciaId, parcelaTipoId: body.parcelaTipoId, competencia, vencimento, parcelaNumero:i+1, parcelaTotal:q, valorProvisionado: valores[i], valorRealizado:0, dataRealizacao:'', status: body.status || 'provisionado', rateioModo: body.rateioModo || 'padrao_percentual', observacao: body.observacao || '' };
    db.lancamentos.push(l);
    try { criarRateios(db, l, body); } catch(e) { for (const c of criados) { db.lancamentos = db.lancamentos.filter(x=>x.id!==c.id); db.rateios = db.rateios.filter(r=>r.lancamentoId!==c.id); } db.lancamentos = db.lancamentos.filter(x=>x.id!==l.id); throw e; }
    criados.push(l);
  }
  addLog(db, 'criar', 'lancamentos', grupo, { quantidade:q, primeiro:criados[0]?.id });
  return criados;
}

function csv(db) {
  const m = maps(db);
  const header = ['tipo','descricao','credor_devedor','filial','centro_custo','plano_contas','referencia','competencia','vencimento','parcela','status','valor_provisionado','valor_realizado'];
  const rows = [header.join(';')];
  for (const l of db.lancamentos) rows.push([l.tipo,l.descricao,m.credores[l.credorDevedorId]?.nome||'',`${m.filiais[l.filialId]?.codigo||''} - ${m.filiais[l.filialId]?.nome||''}`,m.centros[l.centroCustoId]?.nome||'',m.planos[l.planoContaId]?.nome||'',m.referencias[l.referenciaId]?.nome||'',l.competencia,l.vencimento,`${l.parcelaNumero}/${l.parcelaTotal}`,statusLabel(l.status,l.tipo),String(l.valorProvisionado).replace('.',','),String(l.valorRealizado||0).replace('.',',')].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';'));
  return rows.join('\n');
}

function staticFile(pathname, res) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname.replace('/public/','')));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file)) return send(res,404,'Arquivo não encontrado','text/plain');
  const ext = path.extname(file); const type = ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
  send(res,200,fs.readFileSync(file),type);
}

async function handle(req,res) {
  const url = new URL(req.url, `http://${req.headers.host}`); const p=url.pathname;
  if (p.startsWith('/public/')) return staticFile(p,res);
  const db = readDb();
  try {
    if (req.method==='GET' && p==='/') return send(res,200,renderDashboard(db));
    if (req.method==='GET' && p==='/lancamentos') return send(res,200,renderLancamentos(db));
    if (req.method==='GET' && p==='/rateios') return send(res,200,renderRateios(db));
    if (req.method==='GET' && p==='/filiais') return send(res,200,renderFiliais(db));
    if (req.method==='GET' && p==='/credores-devedores') return send(res,200,renderCredores(db));
    if (req.method==='GET' && p==='/classificacoes') return send(res,200,renderClassificacoes(db));
    if (req.method==='GET' && p==='/relatorios') return send(res,200,renderRelatorios(db));
    if (req.method==='GET' && p==='/api/dashboard') return send(res,200,JSON.stringify(calcularDashboard(db),null,2),'application/json; charset=utf-8');
    if (req.method==='GET' && p==='/api/lancamentos') return send(res,200,JSON.stringify(db.lancamentos,null,2),'application/json; charset=utf-8');
    if (req.method==='GET' && p==='/export/lancamentos.csv') { res.writeHead(200, {'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="glinkfinance-lancamentos.csv"'}); return res.end(csv(db)); }

    if (req.method==='POST' && p==='/lancamentos') { const b=await parseBody(req); try { criarLancamentosComParcelas(db,b); writeDb(db); return redirect(res,'/lancamentos'); } catch(e) { return send(res,400,renderLancamentos(db,e.message)); } }
    const liquidar = p.match(/^\/lancamentos\/([^/]+)\/liquidar$/); if (req.method==='POST' && liquidar) { const l=find(db.lancamentos, liquidar[1]); if(!l) return send(res,404,'Lançamento não encontrado','text/plain'); l.status='liquidado'; l.dataRealizacao=today(); l.valorRealizado=l.valorProvisionado; addLog(db,'liquidar','lancamentos',l.id,{valor:l.valorRealizado}); writeDb(db); return redirect(res,'/lancamentos'); }
    const cancelar = p.match(/^\/lancamentos\/([^/]+)\/cancelar$/); if (req.method==='POST' && cancelar) { const l=find(db.lancamentos, cancelar[1]); if(!l) return send(res,404,'Lançamento não encontrado','text/plain'); l.status='cancelado'; addLog(db,'cancelar','lancamentos',l.id,{status:'cancelado'}); writeDb(db); return redirect(res,'/lancamentos'); }

    if (req.method==='POST' && p==='/filiais') { const b=await parseBody(req); const f={id:uid('fil'), codigo:b.codigo, nome:b.nome, razaoSocial:b.razaoSocial||'', cnpj:b.cnpj||'', percentualRateioPadrao:num(b.percentualRateioPadrao), status:'ativa'}; db.filiais.push(f); addLog(db,'criar','filiais',f.id,f); writeDb(db); return redirect(res,'/filiais'); }
    if (req.method==='POST' && p==='/credores-devedores') { const b=await parseBody(req); const c={id:uid('cd'), nome:b.nome, tipo:b.tipo, natureza:b.natureza, cpfCnpj:b.cpfCnpj||'', email:b.email||'', contato:b.contato||'', chavePix:b.chavePix||'', status:'ativo'}; db.credoresDevedores.push(c); addLog(db,'criar','credoresDevedores',c.id,c); writeDb(db); return redirect(res,'/credores-devedores'); }
    if (req.method==='POST' && p==='/classificacoes/centro') { const b=await parseBody(req); if(b.nome) db.centrosCusto.push({id:uid('cc'), nome:b.nome, status:'ativo'}); writeDb(db); return redirect(res,'/classificacoes'); }
    if (req.method==='POST' && p==='/classificacoes/plano') { const b=await parseBody(req); if(b.nome) db.planosContas.push({id:uid('pc'), nome:b.nome, status:'ativo'}); writeDb(db); return redirect(res,'/classificacoes'); }
    if (req.method==='POST' && p==='/classificacoes/referencia') { const b=await parseBody(req); if(b.nome) db.referencias.push({id:uid('ref'), nome:b.nome, status:'ativo'}); writeDb(db); return redirect(res,'/classificacoes'); }
    if (req.method==='POST' && p==='/classificacoes/parcela') { const b=await parseBody(req); if(b.nome) db.parcelasTipos.push({id:uid('par'), nome:b.nome, modo:'custom', status:'ativo'}); writeDb(db); return redirect(res,'/classificacoes'); }

    return send(res,404,layout('404','',header('404','Rota não encontrada')));
  } catch(e) { console.error(e); return send(res,500,`Erro interno: ${esc(e.message)}`,'text/html; charset=utf-8'); }
}

http.createServer(handle).listen(PORT, () => console.log(`GlinkFinance rodando em http://localhost:${PORT}`));
