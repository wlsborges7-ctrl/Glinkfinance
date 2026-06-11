
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data', 'db.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uid = p => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const num = v => {
  if (Array.isArray(v)) v = v[0];
  const n = Number(String(v ?? 0).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const money = v => Math.round(num(v) * 100) / 100;
const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num(v));
const pct = v => `${(num(v)).toFixed(2).replace('.', ',')}%`;
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const slug = v => String(v || 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_.-]+/g,'-').replace(/-+/g,'-').slice(0,80) || 'arquivo';
const today = () => new Date().toISOString().slice(0,10);
const dateBR = v => !v ? '-' : String(v).slice(0,10).split('-').reverse().join('/');
const monthBR = v => !v ? '-' : String(v).slice(0,7).split('-').reverse().join('/');
const find = (arr, id) => (arr || []).find(x => x.id === id) || null;
const arr = v => Array.isArray(v) ? v : (v === undefined || v === null ? [] : [v]);
const paidStatuses = new Set(['pago','baixado','liquidado']);
const send = (res, status, body, type='text/html; charset=utf-8') => { res.writeHead(status, {'Content-Type': type}); res.end(body); };
const redirect = (res, to) => { res.writeHead(303, { Location: to }); res.end(); };

function normalizeDb(db) {
  db.unidadesNegocio ||= [
    { id:'un-loja-nilopolis', nome:'Loja Nilópolis', descricao:'Atendimento comercial', status:'ativo' },
    { id:'un-sede-nilopolis', nome:'Sede Nilópolis', descricao:'Administrativo e operação', status:'ativo' },
    { id:'un-pop-mirandela', nome:'POP Mirandela', descricao:'Ponto de presença', status:'ativo' }
  ];
  db.filiais ||= [];
  db.credoresDevedores ||= [];
  db.centrosCusto ||= [];
  db.planosContas ||= [];
  db.referencias ||= [];
  db.parcelasTipos ||= [];
  db.formasPagamento ||= [
    { id:'fp-transferencia', nome:'Transferência', status:'ativo' },
    { id:'fp-pix', nome:'Pix', status:'ativo' },
    { id:'fp-boleto', nome:'Boleto', status:'ativo' },
    { id:'fp-cartao', nome:'Cartão', status:'ativo' },
    { id:'fp-dinheiro', nome:'Dinheiro', status:'ativo' }
  ];
  db.bancos ||= [
    { id:'bc-bb', nome:'Banco do Brasil', agencia:'', conta:'', status:'ativo' },
    { id:'bc-itau', nome:'Itaú', agencia:'', conta:'', status:'ativo' },
    { id:'bc-inter', nome:'Banco Inter', agencia:'', conta:'', status:'ativo' },
    { id:'bc-caixa', nome:'Caixa Econômica Federal', agencia:'', conta:'', status:'ativo' }
  ];
  db.reservas ||= [];
  db.emprestimos ||= [];
  db.lancamentos ||= [];
  db.rateios ||= [];
  db.logs ||= [];

  for (const r of db.referencias) {
    r.tetoGasto = r.tetoGasto ?? defaultTetoReferencia(r.nome);
    r.centroCustoId = r.centroCustoId || guessCentro(db, r.nome);
    r.planoContaId = r.planoContaId || guessPlano(db, r.nome);
  }
  for (const l of db.lancamentos) {
    if (l.status === 'liquidado') l.status = 'pago';
    l.unidadeNegocioId ||= db.unidadesNegocio[0]?.id || '';
    l.notaTipo ||= '';
    l.notaNumero ||= '';
    l.anexoNotaUrl ||= '';
    l.anexoNotaNome ||= '';
    l.comprovanteUrl ||= '';
    l.comprovanteNome ||= '';
    l.formaPagamentoId ||= db.formasPagamento[0]?.id || '';
    l.bancoId ||= db.bancos[0]?.id || '';
    l.valorBaixado = l.valorBaixado ?? l.valorRealizado ?? 0;
    l.valorRealizado = l.valorRealizado ?? l.valorBaixado ?? 0;
    l.dataPagamento = l.dataPagamento || l.dataRealizacao || '';
    l.valorMulta ||= 0;
  }
  return db;
}
function defaultTetoReferencia(nome) {
  const n = normalize(nome);
  if (n.includes('salario')) return 10000;
  if (n.includes('combustivel')) return 2000;
  if (n.includes('locacao')) return 3000;
  if (n.includes('energia')) return 2500;
  if (n.includes('honorario')) return 2000;
  return 0;
}
function guessCentro(db, nome) {
  const n = normalize(nome);
  if (n.includes('salario')) return db.centrosCusto?.find(x=>normalize(x.nome).includes('recursos'))?.id || '';
  if (n.includes('combustivel') || n.includes('locacao')) return db.centrosCusto?.find(x=>normalize(x.nome).includes('operacional'))?.id || '';
  if (n.includes('energia')) return db.centrosCusto?.find(x=>normalize(x.nome).includes('infra'))?.id || '';
  return db.centrosCusto?.[0]?.id || '';
}
function guessPlano(db, nome) {
  const n = normalize(nome);
  if (n.includes('salario')) return db.planosContas?.find(x=>normalize(x.nome).includes('colaboradores'))?.id || '';
  if (n.includes('combustivel') || n.includes('locacao')) return db.planosContas?.find(x=>normalize(x.nome).includes('veiculos'))?.id || '';
  return db.planosContas?.[0]?.id || '';
}
function normalize(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

function readDb() { return normalizeDb(JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))); }
function writeDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(normalizeDb(db), null, 2)); }

function addToField(obj, name, value) {
  if (obj[name] === undefined) obj[name] = value;
  else if (Array.isArray(obj[name])) obj[name].push(value);
  else obj[name] = [obj[name], value];
}
function collectReq(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function splitBuffer(buf, sep) {
  const out = [];
  let start = 0;
  let idx;
  while ((idx = buf.indexOf(sep, start)) !== -1) {
    out.push(buf.slice(start, idx));
    start = idx + sep.length;
  }
  out.push(buf.slice(start));
  return out;
}
async function parseBody(req) {
  const ct = req.headers['content-type'] || '';
  const raw = await collectReq(req);
  if (ct.includes('multipart/form-data')) return parseMultipart(raw, ct);
  const params = new URLSearchParams(raw.toString('utf8'));
  const body = {};
  for (const [k,v] of params.entries()) addToField(body, k, v);
  return { fields: body, files: {} };
}
function parseMultipart(raw, contentType) {
  const m = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  if (!m) return { fields:{}, files:{} };
  const boundary = Buffer.from('--' + (m[1] || m[2]));
  const parts = splitBuffer(raw, boundary).slice(1, -1);
  const fields = {}, files = {};
  for (let part of parts) {
    if (part.slice(0,2).toString() === '\r\n') part = part.slice(2);
    if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd < 0) continue;
    const header = part.slice(0, headerEnd).toString('utf8');
    const content = part.slice(headerEnd + 4);
    const nameMatch = header.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const filenameMatch = header.match(/filename="([^"]*)"/i);
    if (filenameMatch && filenameMatch[1]) {
      const original = path.basename(filenameMatch[1]);
      const ext = path.extname(original).toLowerCase() || '.bin';
      const stored = `${Date.now()}-${uid('file')}-${slug(path.basename(original, ext))}${ext}`;
      const full = path.join(UPLOAD_DIR, stored);
      fs.writeFileSync(full, content);
      const file = { originalName: original, filename: stored, url: `/uploads/${stored}`, size: content.length };
      if (files[name] === undefined) files[name] = file;
      else if (Array.isArray(files[name])) files[name].push(file);
      else files[name] = [files[name], file];
    } else {
      addToField(fields, name, content.toString('utf8'));
    }
  }
  return { fields, files };
}
const firstFile = f => Array.isArray(f) ? f[0] : f;

function addMonths(ymd, months) {
  const d = new Date(ymd + 'T12:00:00');
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < originalDay) d.setDate(0);
  return d.toISOString().slice(0,10);
}
function addDays(ymd, days) {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function addMonthsCompetencia(ym, months) {
  const d = new Date((ym || today().slice(0,7)) + '-01T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0,7);
}

function maps(db) {
  const map = list => Object.fromEntries((list || []).map(i => [i.id, i]));
  return {
    unidades: map(db.unidadesNegocio), filiais: map(db.filiais), credores: map(db.credoresDevedores), centros: map(db.centrosCusto),
    planos: map(db.planosContas), referencias: map(db.referencias), parcelas: map(db.parcelasTipos), formas: map(db.formasPagamento), bancos: map(db.bancos)
  };
}
function addLog(db, acao, entidade, entidadeId, dados = {}) {
  db.logs.unshift({ id: uid('log'), createdAt: new Date().toISOString(), acao, entidade, entidadeId, dados });
  db.logs = db.logs.slice(0, 200);
}
function statusLabel(s, tipo='despesa') {
  const rec = tipo === 'receita' ? 'Recebido' : 'Pago';
  return ({ pendente:'Pendente', provisionado:'Provisionado', aprovado:'Aprovado', pago:rec, baixado:'Baixado', liquidado:rec, cancelado:'Cancelado' })[s] || s;
}
function badge(s) { return ({ pendente:'neutral', provisionado:'info', aprovado:'info', pago:'success', baixado:'success', liquidado:'success', vencido:'danger', cancelado:'mutedBadge' })[s] || 'neutral'; }
function tipoLabel(t) { return t === 'receita' ? 'Receita' : 'Despesa'; }
function tipoClass(t) { return t === 'receita' ? 'positive' : 'negative'; }
function isValidLancamento(l) { return l && l.status !== 'cancelado'; }
function realizado(l) { return paidStatuses.has(l.status); }
function isReservaRetirada(db, l) {
  const m = maps(db);
  const ref = normalize(m.referencias[l.referenciaId]?.nome);
  const plano = normalize(m.planos[l.planoContaId]?.nome);
  const desc = normalize(l.descricao);
  return ref.includes('reserva') || ref.includes('retirada') || plano.includes('reserva') || plano.includes('retirada') || desc.includes('reserva') || desc.includes('retirada');
}

function opts(list, selected='', blank=true) {
  const b = blank ? '<option value="">Selecione...</option>' : '';
  return b + (list || []).map(i => `<option value="${esc(i.id)}" ${selected===i.id?'selected':''}>${esc(i.codigo ? `${i.codigo} - ${i.nome}` : i.nome)}</option>`).join('');
}
function nav(active) {
  const links = [
    ['/', 'Dashboard', 'dashboard'], ['/graficos','Gráficos','graficos'], ['/lancamentos','Lançamentos','lancamentos'], ['/reservas','Reservas','reservas'], ['/emprestimos','Empréstimos/Devoluções','emprestimos'], ['/rateios','Rateios','rateios'], ['/relatorios','Relatórios','relatorios'], ['/parametrizacao','Parametrização','parametrizacao']
  ];
  return `<aside class="sidebar"><div class="brand">Glink<span>Finance</span><small>ISP</small></div><nav class="nav">${links.map(([href,label,key])=>`<a class="${active===key?'active':''}" href="${href}">${label}</a>`).join('')}</nav></aside>`;
}
function layout(title, active, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} - GlinkFinance</title><link rel="stylesheet" href="/public/styles.css"></head><body><div class="app">${nav(active)}<main class="main">${body}</main></div><script src="/public/app.js"></script></body></html>`;
}
function header(t,s,a=''){ return `<div class="page-header"><div><h1>${esc(t)}</h1><p>${esc(s)}</p></div><div class="header-actions">${a}</div></div>`; }
function cardMetric(label, value, cls='') { return `<div class="metric"><span>${esc(label)}</span><strong class="${cls}">${value}</strong></div>`; }

function criarRateios(db, lancamento, body = {}) {
  db.rateios = db.rateios.filter(r => r.lancamentoId !== lancamento.id);
  const total = money(lancamento.valorProvisionado);
  const novos = [];
  const comRateio = body.comRateio === 'on' || body.comRateio === 'true' || body.rateioModo === 'manual_percentual' || body.rateioModo === 'manual_valor';
  if (!comRateio) {
    novos.push({ id: uid('rat'), lancamentoId: lancamento.id, filialId: lancamento.filialId, modo:'sem_rateio', percentual:100, valorRateado:total });
    db.rateios.push(...novos); return;
  }
  const modo = body.rateioModo || 'manual_percentual';
  const filiais = arr(body.rateioFilial).filter(Boolean);
  const percentuais = arr(body.rateioPercentual);
  const valores = arr(body.rateioValor);
  const linhas = [];
  filiais.forEach((filialId, i) => {
    if (!find(db.filiais, filialId)) return;
    const perc = num(percentuais[i]);
    const valor = money(valores[i]);
    if (modo === 'manual_percentual' && perc > 0) linhas.push({ filialId, percentual: perc, valorRateado: 0 });
    if (modo === 'manual_valor' && valor > 0) linhas.push({ filialId, percentual: 0, valorRateado: valor });
  });
  if (linhas.length < 2) throw new Error('Com rateio, informe ao menos duas filiais.');
  const duplicadas = new Set();
  for (const l of linhas) { if (duplicadas.has(l.filialId)) throw new Error('Não repita a mesma filial no rateio.'); duplicadas.add(l.filialId); }
  if (modo === 'manual_percentual') {
    const soma = linhas.reduce((s,l)=>s+num(l.percentual),0);
    if (Math.abs(soma - 100) > 0.01) throw new Error('No rateio por percentual, a soma precisa ser 100%.');
    let acumulado = 0;
    linhas.forEach((l, idx) => {
      const valor = idx === linhas.length - 1 ? money(total - acumulado) : money(total * l.percentual / 100);
      acumulado += valor;
      novos.push({ id: uid('rat'), lancamentoId: lancamento.id, filialId:l.filialId, modo:'percentual', percentual:l.percentual, valorRateado:valor });
    });
  } else {
    const soma = linhas.reduce((s,l)=>s+money(l.valorRateado),0);
    if (Math.abs(soma - total) > 0.01) throw new Error(`No rateio por valor, a soma precisa fechar ${brl(total)}.`);
    linhas.forEach(l => novos.push({ id: uid('rat'), lancamentoId: lancamento.id, filialId:l.filialId, modo:'valor', percentual: total ? money(l.valorRateado * 100 / total) : 0, valorRateado:l.valorRateado }));
  }
  db.rateios.push(...novos);
}

function calcularDashboard(db) {
  const validos = db.lancamentos.filter(isValidLancamento);
  const entradas = validos.filter(l => l.tipo === 'receita').reduce((s,l)=>s+num(l.valorProvisionado),0);
  const despesas = validos.filter(l => l.tipo === 'despesa').reduce((s,l)=>s+num(l.valorProvisionado),0);
  const recebido = validos.filter(l => l.tipo === 'receita' && realizado(l)).reduce((s,l)=>s+num(l.valorBaixado || l.valorRealizado || l.valorProvisionado),0);
  const pago = validos.filter(l => l.tipo === 'despesa' && realizado(l)).reduce((s,l)=>s+num(l.valorBaixado || l.valorRealizado || l.valorProvisionado),0);
  const abertoReceita = validos.filter(l => l.tipo === 'receita' && !realizado(l)).reduce((s,l)=>s+num(l.valorProvisionado),0);
  const abertoDespesa = validos.filter(l => l.tipo === 'despesa' && !realizado(l)).reduce((s,l)=>s+num(l.valorProvisionado),0);
  const vencido = validos.filter(l => !realizado(l) && l.vencimento < today()).reduce((s,l)=>s+num(l.valorProvisionado),0);
  const receitasOp = validos.filter(l => l.tipo === 'receita' && !isReservaRetirada(db,l)).reduce((s,l)=>s+num(l.valorProvisionado),0);
  const despesasOp = validos.filter(l => l.tipo === 'despesa' && !isReservaRetirada(db,l)).reduce((s,l)=>s+num(l.valorProvisionado),0);
  const lucroOperacional = receitasOp - despesasOp;
  const margemLucro = receitasOp ? (lucroOperacional / receitasOp) * 100 : 0;
  const m = maps(db), porCentro = {}, porPlano = {}, porReferencia = {}, porFilial = {}, porUnidade = {};
  for (const l of validos) {
    const fator = l.tipo === 'receita' ? 1 : -1;
    const cc = m.centros[l.centroCustoId]?.nome || 'Sem centro'; porCentro[cc] = (porCentro[cc] || 0) + fator * num(l.valorProvisionado);
    const pc = m.planos[l.planoContaId]?.nome || 'Sem plano'; porPlano[pc] = (porPlano[pc] || 0) + fator * num(l.valorProvisionado);
    const ref = m.referencias[l.referenciaId]?.nome || 'Sem referência'; porReferencia[ref] = (porReferencia[ref] || 0) + fator * num(l.valorProvisionado);
    const un = m.unidades[l.unidadeNegocioId]?.nome || 'Sem unidade'; porUnidade[un] = (porUnidade[un] || 0) + fator * num(l.valorProvisionado);
  }
  for (const r of db.rateios) {
    const l = find(db.lancamentos, r.lancamentoId); if (!isValidLancamento(l)) continue;
    const f = m.filiais[r.filialId]?.codigo ? `${m.filiais[r.filialId].codigo} - ${m.filiais[r.filialId].nome}` : (m.filiais[r.filialId]?.nome || 'Sem filial');
    const fator = l.tipo === 'receita' ? 1 : -1;
    porFilial[f] = (porFilial[f] || 0) + fator * num(r.valorRateado);
  }
  const proximos = validos.filter(l => !realizado(l)).sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).slice(0,10);
  const reservasSaldo = db.reservas.reduce((s,r)=>s+(r.tipo === 'entrada' ? num(r.valor) : -num(r.valor)),0);
  const emprestimosAberto = db.emprestimos.filter(e=>e.status !== 'quitado').reduce((s,e)=>s+(num(e.valorOriginal)-num(e.valorDevolvido)),0);
  return { entradas, despesas, saldoPrevisto: entradas - despesas, recebido, pago, saldoRealizado: recebido - pago, abertoReceita, abertoDespesa, vencido, receitasOp, despesasOp, lucroOperacional, margemLucro, porCentro, porPlano, porReferencia, porFilial, porUnidade, proximos, reservasSaldo, emprestimosAberto };
}

function renderDashboard(db) {
  const d = calcularDashboard(db), m = maps(db);
  const prox = d.proximos.slice(0,7).map(l=>`<tr><td><strong>${esc(l.descricao)}</strong><br><small>${esc(m.credores[l.credorDevedorId]?.nome || '-')}</small></td><td>${esc(m.unidades[l.unidadeNegocioId]?.nome || '-')}</td><td><span class="${tipoClass(l.tipo)}">${tipoLabel(l.tipo)}</span></td><td class="nowrap">${dateBR(l.vencimento)}</td><td><span class="badge ${badge(l.status)}">${statusLabel(l.status,l.tipo)}</span></td><td class="right nowrap">${brl(l.valorProvisionado)}</td></tr>`).join('');
  return layout('Dashboard','dashboard', header('Dashboard','Visão executiva do GlinkFinance para ISP, com cards mais compactos e leitura rápida.', '<a class="btn secondary" href="/graficos">Ver gráficos</a><a class="btn" href="/lancamentos/novo">Novo lançamento</a>') +
  `<section class="hero-card">
    <div class="hero-value"><span>Saldo previsto</span><strong class="${d.saldoPrevisto>=0?'positive':'negative'}">${brl(d.saldoPrevisto)}</strong><small class="muted">Receitas provisionadas menos despesas provisionadas.</small></div>
    <div class="hero-list">
      <div class="hero-item"><span>Receitas</span><strong class="positive">${brl(d.entradas)}</strong></div>
      <div class="hero-item"><span>Despesas</span><strong class="negative">${brl(d.despesas)}</strong></div>
      <div class="hero-item"><span>Realizado</span><strong class="${d.saldoRealizado>=0?'positive':'negative'}">${brl(d.saldoRealizado)}</strong></div>
      <div class="hero-item"><span>Vencido</span><strong class="negative">${brl(d.vencido)}</strong></div>
    </div>
  </section>
  <div class="metrics metrics-compact">${cardMetric('Em aberto', brl(d.abertoReceita - d.abertoDespesa), '')}${cardMetric('Recebido', brl(d.recebido), 'positive')}${cardMetric('Pago', brl(d.pago), 'negative')}${cardMetric('Margem operacional', pct(d.margemLucro), d.margemLucro>=0?'positive':'negative')}${cardMetric('Reservas', brl(d.reservasSaldo), 'positive')}${cardMetric('Empréstimos em aberto', brl(d.emprestimosAberto), 'negative')}</div>
  <div class="grid grid-2 dashboard-row"><div class="card"><h3>Próximos lançamentos</h3><div class="table-wrap"><table class="dashboard-table"><thead><tr><th>Lançamento</th><th>Unidade</th><th>Tipo</th><th>Vencimento</th><th>Status</th><th class="right">Valor</th></tr></thead><tbody>${prox || '<tr><td colspan="6">Sem lançamentos pendentes.</td></tr>'}</tbody></table></div></div><div class="card"><h3>Resultado por unidade de negócio</h3><div class="table-wrap"><table class="dashboard-table"><tbody>${tableRows(d.porUnidade)}</tbody></table></div></div></div>`);
}
function tableRows(obj) { return Object.entries(obj).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="right ${v>=0?'positive':'negative'}">${brl(v)}</td></tr>`).join('') || '<tr><td>Sem dados.</td><td></td></tr>'; }

function clamp(n, min=0, max=100) { return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0)); }
function topEntries(obj, limit=8, absolute=true) {
  return Object.entries(obj || {}).sort((a,b)=>absolute ? Math.abs(b[1])-Math.abs(a[1]) : b[1]-a[1]).slice(0, limit);
}
function horizontalChart(title, subtitle, entries, opts={}) {
  const rows = (entries || []).filter(([,v])=>Number.isFinite(num(v)) && Math.abs(num(v)) > 0);
  if (!rows.length) return `<div class="chart-card"><h3>${esc(title)}</h3><p class="chart-subtitle">${esc(subtitle)}</p><div class="chart-empty">Sem dados suficientes para montar o gráfico.</div></div>`;
  const max = Math.max(...rows.map(([,v])=>Math.abs(num(v))), 1);
  return `<div class="chart-card ${opts.wide?'wide':''}"><h3>${esc(title)}</h3><p class="chart-subtitle">${esc(subtitle)}</p>${rows.map(([label,value])=>{ const val=num(value); const width=clamp(Math.abs(val)*100/max); const cls=opts.neutral?'chart-neutral':(val>=0?'chart-positive':'chart-negative'); return `<div class="chart-row"><div class="chart-label" title="${esc(label)}">${esc(label)}</div><div class="chart-track"><div class="chart-fill ${cls}" style="width:${width}%"></div></div><div class="chart-value ${val>=0?'positive':'negative'}">${brl(val)}</div></div>`; }).join('')}</div>`;
}
function receitaDespesaPorCompetencia(db) {
  const grupos = {};
  for (const l of db.lancamentos.filter(isValidLancamento)) {
    const key = l.competencia || 'Sem competência';
    grupos[key] ||= { competencia:key, receita:0, despesa:0, lucro:0 };
    if (l.tipo === 'receita') grupos[key].receita += num(l.valorProvisionado);
    else grupos[key].despesa += num(l.valorProvisionado);
    grupos[key].lucro = grupos[key].receita - grupos[key].despesa;
  }
  return Object.values(grupos).sort((a,b)=>String(a.competencia).localeCompare(String(b.competencia)));
}
function seriesCompetenciaChart(db) {
  const rows = receitaDespesaPorCompetencia(db);
  if (!rows.length) return `<div class="chart-card wide"><h3>Receitas x despesas por competência</h3><p class="chart-subtitle">Comparativo mensal entre valores provisionados.</p><div class="chart-empty">Sem dados suficientes para montar o gráfico.</div></div>`;
  const max = Math.max(...rows.flatMap(r=>[r.receita, r.despesa, Math.abs(r.lucro)]), 1);
  return `<div class="chart-card wide"><h3>Receitas x despesas por competência</h3><p class="chart-subtitle">Comparativo mensal entre receitas, despesas e resultado provisionado.</p><div class="chart-legend"><span><i class="legend-dot dot-receita"></i>Receita</span><span><i class="legend-dot dot-despesa"></i>Despesa</span><span><i class="legend-dot dot-lucro"></i>Lucro/resultado</span></div><div class="chart-series">${rows.map(r=>`<div class="series-block"><div class="series-label">${monthBR(r.competencia)}</div><div class="series-bars"><div class="series-track"><div class="chart-fill chart-positive" style="width:${clamp(r.receita*100/max)}%"></div></div><div class="series-track"><div class="chart-fill chart-negative" style="width:${clamp(r.despesa*100/max)}%"></div></div><div class="series-track"><div class="chart-fill chart-neutral" style="width:${clamp(Math.abs(r.lucro)*100/max)}%"></div></div></div><div class="series-value ${r.lucro>=0?'positive':'negative'}">${brl(r.lucro)}</div></div>`).join('')}</div></div>`;
}
function despesaPorCentro(db) {
  const m = maps(db), out = {};
  for (const l of db.lancamentos.filter(l=>isValidLancamento(l) && l.tipo === 'despesa')) {
    const k = m.centros[l.centroCustoId]?.nome || 'Sem centro';
    out[k] = (out[k] || 0) + num(l.valorProvisionado);
  }
  return out;
}
function statusChart(db) {
  const validos = db.lancamentos.filter(isValidLancamento);
  const out = {};
  for (const l of validos) out[statusLabel(l.status,l.tipo)] = (out[statusLabel(l.status,l.tipo)] || 0) + 1;
  const boxes = Object.entries(out).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="status-box"><span>${esc(k)}</span><strong>${v}</strong></div>`).join('');
  return `<div class="chart-card"><h3>Status dos lançamentos</h3><p class="chart-subtitle">Quantidade de lançamentos por situação.</p><div class="status-grid">${boxes || '<div class="chart-empty">Sem lançamentos.</div>'}</div></div>`;
}
function tetoChart(db) {
  const m = maps(db);
  const rows = db.referencias.map(ref => {
    const gasto = db.lancamentos.filter(l=>isValidLancamento(l) && l.tipo==='despesa' && l.referenciaId===ref.id).reduce((s,l)=>s+num(l.valorProvisionado),0);
    const teto = num(ref.tetoGasto);
    const uso = teto > 0 ? gasto * 100 / teto : 0;
    const b = tetoBadge(teto > 0 ? uso : NaN);
    return { ref, gasto, teto, uso, b };
  }).filter(x=>x.teto > 0 || x.gasto > 0).sort((a,b)=>b.uso-a.uso).slice(0,10);
  if (!rows.length) return `<div class="chart-card wide"><h3>Teto de gasto por referência</h3><p class="chart-subtitle">Uso do limite configurado em parametrização.</p><div class="chart-empty">Sem tetos configurados ou despesas vinculadas.</div></div>`;
  return `<div class="chart-card wide"><h3>Teto de gasto por referência</h3><p class="chart-subtitle">Sinalização: verde até 75%, amarelo até 100% e vermelho acima do teto.</p>${rows.map(x=>{ const cls=x.uso<=75?'chart-positive':(x.uso<=100?'chart-warning':'chart-negative'); return `<div class="progress-line"><div class="progress-meta"><strong>${esc(x.ref.nome)}</strong><small>${esc(m.centros[x.ref.centroCustoId]?.nome || '-')} / ${esc(m.planos[x.ref.planoContaId]?.nome || '-')}</small></div><div class="progress-track"><div class="progress-fill ${cls}" style="width:${clamp(x.uso)}%"></div></div><div class="progress-number">${pct(x.uso)}</div><div><span class="badge ${x.b.cls}">${x.b.label}</span></div></div>`;}).join('')}</div>`;
}
function renderGraficos(db) {
  const d = calcularDashboard(db);
  return layout('Gráficos','graficos', header('Gráficos','Indicadores visuais para apresentação e leitura gerencial do ISP.', '<a class="btn" href="/relatorios">Ver relatórios</a>') +
  `<div class="metrics metrics-compact">${cardMetric('Receitas', brl(d.entradas), 'positive')}${cardMetric('Despesas', brl(d.despesas), 'negative')}${cardMetric('Resultado previsto', brl(d.saldoPrevisto), d.saldoPrevisto>=0?'positive':'negative')}${cardMetric('Margem operacional', pct(d.margemLucro), d.margemLucro>=0?'positive':'negative')}${cardMetric('Reservas', brl(d.reservasSaldo), 'positive')}${cardMetric('Vencido', brl(d.vencido), 'negative')}</div>
  <div class="chart-grid">
    ${seriesCompetenciaChart(db)}
    ${horizontalChart('Despesas por centro de custo','Total provisionado em despesas, por centro.', topEntries(despesaPorCentro(db), 8, false), {neutral:true})}
    ${horizontalChart('Resultado por unidade de negócio','Receitas menos despesas por unidade.', topEntries(d.porUnidade, 8), {})}
    ${horizontalChart('Rateio por filial','Resultado líquido dos rateios por filial.', topEntries(d.porFilial, 8), {})}
    ${statusChart(db)}
    ${tetoChart(db)}
  </div>`);
}

function renderLancamentos(db) {
  const m = maps(db);
  const rows = db.lancamentos.slice().sort((a,b)=>b.vencimento.localeCompare(a.vencimento)).map(l=>`<tr><td><strong>${esc(l.descricao)}</strong><br><small>${esc(m.credores[l.credorDevedorId]?.nome || '-')}</small></td><td><span class="${tipoClass(l.tipo)}">${tipoLabel(l.tipo)}</span></td><td>${esc(m.unidades[l.unidadeNegocioId]?.nome || '-')}<br><small>${esc((m.filiais[l.filialId]?.codigo || '') + ' - ' + (m.filiais[l.filialId]?.nome || '-'))}</small></td><td>${esc(m.centros[l.centroCustoId]?.nome || '-')}<br><small>${esc(m.planos[l.planoContaId]?.nome || '-')} / ${esc(m.referencias[l.referenciaId]?.nome || '-')}</small></td><td>${monthBR(l.competencia)}<br><small>Venc.: ${dateBR(l.vencimento)}</small></td><td>${l.parcelaTotal>1?`${l.parcelaNumero}/${l.parcelaTotal}`:'Única'}</td><td><span class="badge ${badge(l.status)}">${statusLabel(l.status,l.tipo)}</span></td><td class="right">${brl(l.valorProvisionado)}</td><td class="actions">${!realizado(l)&&l.status!=='cancelado'?`<a class="small btn" href="/lancamentos/${l.id}/baixar">Baixar</a>`:''}${l.status!=='cancelado'?`<form method="post" action="/lancamentos/${l.id}/cancelar"><button class="small ghost">Cancelar</button></form>`:''}</td></tr>`).join('');
  return layout('Lançamentos','lancamentos', header('Lançamentos','Consulta dos lançamentos cadastrados. O formulário de novo lançamento fica em tela separada.', '<a class="btn" href="/lancamentos/novo">Novo lançamento</a>') + `<table><thead><tr><th>Descrição</th><th>Tipo</th><th>Unidade/Filial</th><th>Classificação</th><th>Competência</th><th>Parcela</th><th>Status</th><th class="right">Valor</th><th>Ações</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Nenhum lançamento cadastrado.</td></tr>'}</tbody></table>`);
}

function rateioInputs(db) {
  const filialOptions = opts(db.filiais, '', true);
  return `<div class="card rateio-card"><label class="checkline"><input type="checkbox" name="comRateio" id="comRateio"> Com rateio entre filiais</label><div id="rateioBox" class="hidden"><div class="form-grid"><label>Tipo de rateio<select name="rateioModo" id="rateioModo"><option value="manual_percentual">Por percentual</option><option value="manual_valor">Por valor</option></select></label></div><div id="rateioRows"><div class="rateio-row"><select name="rateioFilial">${filialOptions}</select><input name="rateioPercentual" placeholder="%"><input name="rateioValor" placeholder="Valor"><button type="button" class="small ghost remove-rateio">Remover</button></div><div class="rateio-row"><select name="rateioFilial">${filialOptions}</select><input name="rateioPercentual" placeholder="%"><input name="rateioValor" placeholder="Valor"><button type="button" class="small ghost remove-rateio">Remover</button></div></div><button type="button" id="addRateio" class="secondary">Adicionar filial ao rateio</button><p class="hint">No rateio percentual a soma deve ser 100%. No rateio por valor, a soma deve fechar o valor provisionado.</p></div></div>`;
}
function renderNovoLancamento(db, err='') {
  const form = `<form method="post" action="/lancamentos" enctype="multipart/form-data" class="form">
    <div class="card"><h3>Novo lançamento</h3><p class="hint">Campos iniciam em branco. Cadastros auxiliares ficam em Parametrização.</p><div class="form-grid">
      <label>Data de vencimento<input type="date" name="vencimento" required></label>
      <label>Competência<input type="month" name="competencia" required></label>
      <label>Unidade de negócio<select name="unidadeNegocioId" required>${opts(db.unidadesNegocio)}</select></label>
      <label>Filial<select name="filialId" required>${opts(db.filiais)}</select></label>
      <label>Tipo<select name="tipo" required><option value="">Selecione...</option><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label>
      <label>Centro de custo<select name="centroCustoId" required>${opts(db.centrosCusto)}</select></label>
      <label>Plano de contas<select name="planoContaId" required>${opts(db.planosContas)}</select></label>
      <label>Referência<select name="referenciaId" required>${opts(db.referencias)}</select></label>
      <label>Parcela<select name="parcelaTipoId" required>${opts(db.parcelasTipos)}</select></label>
      <label>Valor provisionado<input type="text" name="valorProvisionado" placeholder="0,00" required></label>
      <label>Credor/Devedor<select name="credorDevedorId" required>${opts(db.credoresDevedores)}</select></label>
      <label>Status<select name="status"><option value="provisionado">Provisionado</option><option value="pendente">Pendente</option><option value="pago">Pago/Recebido</option><option value="baixado">Baixado</option></select></label>
      <label>Nota/NF<input name="notaNumero" placeholder="0000"></label>
      <label>Tipo de nota<select name="notaTipo"><option value="">Sem nota</option><option value="NF">Nota Fiscal</option><option value="Nota de Compra">Nota de Compra</option><option value="Recibo">Recibo</option></select></label>
      <label>Anexo PDF da NF/Nota<input type="file" name="anexoNota" accept="application/pdf"></label>
      <label>Forma de pagamento<select name="formaPagamentoId">${opts(db.formasPagamento)}</select></label>
      <label>Banco<select name="bancoId">${opts(db.bancos)}</select></label>
      <label>Data pagamento<input type="date" name="dataPagamento"></label>
      <label>Valor baixado<input type="text" name="valorBaixado" placeholder="0,00"></label>
      <label>Valor multa<input type="text" name="valorMulta" placeholder="0,00"></label>
      <label>Comprovante financeiro<input type="file" name="anexoComprovante" accept="application/pdf,image/*"></label>
    </div><label>Descrição<input name="descricao" required></label><label>Observação<textarea name="observacao"></textarea></label></div>
    <div class="card"><h3>Parcelamento</h3><div class="form-grid"><label>Quantidade de parcelas/meses<input type="number" name="quantidadeParcelas" min="1" value="1"></label><label>Periodicidade<select name="periodicidade"><option value="mensal">Mensal</option><option value="intervalo">Por intervalo de dias</option></select></label><label>Intervalo em dias<input type="number" name="intervaloDias" min="1" placeholder="30"></label><label>Valor informado é<select name="valorModoParcelamento"><option value="por_parcela">Valor de cada parcela</option><option value="total_dividido">Total dividido pelas parcelas</option></select></label></div></div>${rateioInputs(db)}<button>Criar lançamento</button></form>`;
  return layout('Novo lançamento','lancamentos', header('Novo lançamento','Cadastro de receita ou despesa. Esta tela não lista lançamentos já cadastrados.', '<a class="btn ghost" href="/lancamentos">Voltar aos lançamentos</a>') + (err ? `<div class="error">${esc(err)}</div>` : '') + form);
}
function renderBaixarLancamento(db, id, err='') {
  const l = find(db.lancamentos, id); if (!l) return layout('Lançamento não encontrado','lancamentos',header('Lançamento não encontrado',''));
  return layout('Baixar lançamento','lancamentos', header('Baixar lançamento', l.descricao, '<a class="btn ghost" href="/lancamentos">Voltar</a>') + (err?`<div class="error">${esc(err)}</div>`:'') + `<div class="card"><form method="post" action="/lancamentos/${esc(l.id)}/baixar" enctype="multipart/form-data" class="form"><div class="form-grid"><label>Status<select name="status"><option value="pago">Pago/Recebido</option><option value="baixado">Baixado</option></select></label><label>Data pagamento<input type="date" name="dataPagamento" value="${esc(today())}" required></label><label>Valor baixado<input name="valorBaixado" value="${esc(String(l.valorProvisionado).replace('.',','))}" required></label><label>Valor multa<input name="valorMulta" value="0,00"></label><label>Forma de pagamento<select name="formaPagamentoId">${opts(db.formasPagamento, l.formaPagamentoId)}</select></label><label>Banco<select name="bancoId">${opts(db.bancos, l.bancoId)}</select></label><label>Comprovante financeiro<input type="file" name="anexoComprovante" accept="application/pdf,image/*"></label></div><label>Observação da baixa<textarea name="observacaoBaixa"></textarea></label><button>Confirmar baixa</button></form></div>`);
}

function renderRateios(db) {
  const m = maps(db);
  const rows = db.rateios.map(r=>{ const l=find(db.lancamentos,r.lancamentoId); if(!l) return ''; return `<tr><td><strong>${esc(l.descricao)}</strong><br><small>${tipoLabel(l.tipo)} · ${monthBR(l.competencia)}</small></td><td>${esc((m.filiais[r.filialId]?.codigo || '') + ' - ' + (m.filiais[r.filialId]?.nome || '-'))}</td><td>${esc(r.modo)}</td><td class="right">${pct(r.percentual)}</td><td class="right">${brl(r.valorRateado)}</td><td><span class="badge ${badge(l.status)}">${statusLabel(l.status,l.tipo)}</span></td></tr>`; }).join('');
  return layout('Rateios','rateios', header('Rateios','Lançamentos compartilhados entre duas ou mais filiais por percentual ou valor.') + `<table><thead><tr><th>Lançamento</th><th>Filial</th><th>Modo</th><th class="right">Percentual</th><th class="right">Valor</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Sem rateios.</td></tr>'}</tbody></table>`);
}

function renderReservas(db) {
  const saldo = db.reservas.reduce((s,r)=>s+(r.tipo === 'entrada'?num(r.valor):-num(r.valor)),0);
  const rows = db.reservas.slice().sort((a,b)=>b.data.localeCompare(a.data)).map(r=>`<tr><td>${dateBR(r.data)}</td><td><span class="${r.tipo==='entrada'?'positive':'negative'}">${esc(r.tipo)}</span></td><td>${esc(r.descricao)}</td><td>${esc(r.categoria || '-')}</td><td class="right">${brl(r.valor)}</td><td>${esc(r.observacao || '')}</td></tr>`).join('');
  return layout('Reservas','reservas', header('Reservas','Controle apartado de reservas, sem contaminar a margem operacional.', `<strong>Saldo: ${brl(saldo)}</strong>`) + `<div class="card"><form method="post" action="/reservas" class="form"><div class="form-grid"><label>Data<input type="date" name="data" required></label><label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Categoria<input name="categoria" placeholder="Reserva emergência, expansão..."></label><label>Valor<input name="valor" placeholder="0,00" required></label></div><label>Descrição<input name="descricao" required></label><label>Observação<textarea name="observacao"></textarea></label><button>Lançar reserva</button></form></div><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th class="right">Valor</th><th>Observação</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Sem movimentações de reserva.</td></tr>'}</tbody></table>`);
}
function renderEmprestimos(db) {
  const aberto = db.emprestimos.filter(e=>e.status !== 'quitado').reduce((s,e)=>s+(num(e.valorOriginal)-num(e.valorDevolvido)),0);
  const rows = db.emprestimos.slice().sort((a,b)=>b.dataEmprestimo.localeCompare(a.dataEmprestimo)).map(e=>`<tr><td><strong>${esc(e.descricao)}</strong><br><small>${esc(e.parte)}</small></td><td>${dateBR(e.dataEmprestimo)}</td><td>${dateBR(e.dataPrevistaDevolucao)}</td><td class="right">${brl(e.valorOriginal)}</td><td class="right positive">${brl(e.valorDevolvido)}</td><td class="right">${brl(num(e.valorOriginal)-num(e.valorDevolvido))}</td><td><span class="badge ${e.status==='quitado'?'success':'info'}">${esc(e.status)}</span></td><td>${e.status!=='quitado'?`<form method="post" action="/emprestimos/${e.id}/devolver" class="inline-form"><input name="valor" placeholder="Valor" required><button class="small">Devolver</button></form>`:''}</td></tr>`).join('');
  return layout('Empréstimos e devoluções','emprestimos', header('Empréstimos e devoluções','Controle apartado de empréstimos internos, adiantamentos e respectivas devoluções.', `<strong>Em aberto: ${brl(aberto)}</strong>`) + `<div class="card"><form method="post" action="/emprestimos" class="form"><div class="form-grid"><label>Data empréstimo<input type="date" name="dataEmprestimo" required></label><label>Previsão devolução<input type="date" name="dataPrevistaDevolucao"></label><label>Parte envolvida<input name="parte" placeholder="Pessoa/empresa" required></label><label>Valor<input name="valorOriginal" placeholder="0,00" required></label></div><label>Descrição<input name="descricao" required></label><label>Observação<textarea name="observacao"></textarea></label><button>Cadastrar empréstimo</button></form></div><table><thead><tr><th>Descrição</th><th>Data</th><th>Previsão</th><th class="right">Original</th><th class="right">Devolvido</th><th class="right">Saldo</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows || '<tr><td colspan="8">Sem empréstimos cadastrados.</td></tr>'}</tbody></table>`);
}

function tetoBadge(percentual) {
  if (!Number.isFinite(percentual)) return { cls:'neutral', label:'Sem teto' };
  if (percentual <= 75) return { cls:'limit-green', label:'Verde' };
  if (percentual <= 100) return { cls:'limit-yellow', label:'Amarelo' };
  return { cls:'limit-red', label:'Vermelho' };
}
function renderRelatorios(db) {
  const d = calcularDashboard(db), m = maps(db);
  const tetoRows = db.referencias.map(ref => {
    const gasto = db.lancamentos.filter(l=>isValidLancamento(l) && l.tipo==='despesa' && l.referenciaId===ref.id).reduce((s,l)=>s+num(l.valorProvisionado),0);
    const teto = num(ref.tetoGasto);
    const percTeto = teto > 0 ? gasto * 100 / teto : NaN;
    const b = tetoBadge(percTeto);
    return `<tr><td>${esc(m.centros[ref.centroCustoId]?.nome || '-')}</td><td>${esc(m.planos[ref.planoContaId]?.nome || '-')}</td><td><strong>${esc(ref.nome)}</strong></td><td class="right">${teto ? brl(teto) : '-'}</td><td class="right">${brl(gasto)}</td><td class="right">${Number.isFinite(percTeto) ? pct(percTeto) : '-'}</td><td><span class="badge ${b.cls}">${b.label}</span></td></tr>`;
  }).join('');
  const logs = db.logs.slice(0,20).map(l=>`<tr><td>${dateBR(l.createdAt)}</td><td>${esc(l.acao)}</td><td>${esc(l.entidade)}</td><td>${esc(l.entidadeId)}</td></tr>`).join('');
  return layout('Relatórios','relatorios', header('Relatórios analíticos','Margem operacional desconsidera retiradas e reservas. O teto de gasto é avaliado por referência.', '<a class="btn" href="/export/lancamentos.csv">Exportar CSV</a>') + `<div class="metrics">${cardMetric('Receita operacional', brl(d.receitasOp), 'positive')}${cardMetric('Despesa operacional', brl(d.despesasOp), 'negative')}${cardMetric('Lucro operacional', brl(d.lucroOperacional), d.lucroOperacional>=0?'positive':'negative')}${cardMetric('% lucro', pct(d.margemLucro), d.margemLucro>=0?'positive':'negative')}</div><div class="grid grid-2"><div class="card"><h3>Centro de custo</h3><table><tbody>${tableRows(d.porCentro)}</tbody></table></div><div class="card"><h3>Filiais / Rateios</h3><table><tbody>${tableRows(d.porFilial)}</tbody></table></div></div><h2 class="section-title">Teto de gasto por referência</h2><table><thead><tr><th>Centro</th><th>Plano</th><th>Referência</th><th class="right">Teto</th><th class="right">Gasto</th><th class="right">Uso</th><th>Sinalização</th></tr></thead><tbody>${tetoRows}</tbody></table><h2 class="section-title">Logs de auditoria</h2><table><thead><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>ID</th></tr></thead><tbody>${logs || '<tr><td colspan="4">Sem logs.</td></tr>'}</tbody></table>`);
}

function chipList(list) { return (list || []).map(i=>`<span class="chip">${esc(i.codigo ? `${i.codigo} - ${i.nome}` : i.nome)}</span>`).join('') || '<span class="muted">Sem cadastros.</span>'; }
function renderParametrizacao(db) {
  return layout('Parametrização','parametrizacao', header('Parametrização','Cadastros prévios utilizados nos lançamentos financeiros.', '') + `<div class="param-nav"><a href="#unidades">Unidades</a><a href="#filiais">Filiais</a><a href="#credores">Credores/Devedores</a><a href="#classificacoes">Classificações</a><a href="#pagamento">Pagamento/Bancos</a></div><div class="grid grid-2">
  <div class="card" id="unidades"><h3>Unidades de negócio</h3><div class="chips">${chipList(db.unidadesNegocio)}</div><form method="post" action="/parametrizacao/unidades" class="form"><label>Nome<input name="nome" placeholder="Loja Nilópolis" required></label><label>Descrição<input name="descricao"></label><button>Cadastrar unidade</button></form></div>
  <div class="card" id="filiais"><h3>Filiais</h3><div class="chips">${chipList(db.filiais)}</div><form method="post" action="/parametrizacao/filiais" class="form"><div class="form-grid"><label>Código<input name="codigo" required></label><label>Nome<input name="nome" required></label><label>Razão social<input name="razaoSocial"></label><label>CNPJ<input name="cnpj"></label></div><button>Cadastrar filial</button></form></div>
  <div class="card" id="credores"><h3>Credores / Devedores</h3><div class="chips">${chipList(db.credoresDevedores)}</div><form method="post" action="/parametrizacao/credores" class="form"><div class="form-grid"><label>Nome/Razão social<input name="nome" required></label><label>Tipo<select name="tipo"><option value="credor">Credor</option><option value="devedor">Devedor</option></select></label><label>Natureza<select name="natureza"><option value="fornecedor">Fornecedor</option><option value="funcionario">Funcionário</option><option value="prestador">Prestador</option><option value="socio">Sócio</option><option value="cliente_outros">Cliente/Outros</option></select></label><label>CPF/CNPJ<input name="cpfCnpj"></label><label>E-mail<input name="email"></label><label>Contato<input name="contato"></label></div><button>Cadastrar</button></form></div>
  <div class="card" id="pagamento"><h3>Forma de pagamento</h3><div class="chips">${chipList(db.formasPagamento)}</div><form method="post" action="/parametrizacao/formas-pagamento" class="form"><label>Nova forma<input name="nome" placeholder="Transferência" required></label><button>Cadastrar forma</button></form><h3>Bancos</h3><div class="chips">${chipList(db.bancos)}</div><form method="post" action="/parametrizacao/bancos" class="form"><div class="form-grid"><label>Banco<input name="nome" required></label><label>Agência<input name="agencia"></label><label>Conta<input name="conta"></label></div><button>Cadastrar banco</button></form></div>
  <div class="card" id="classificacoes"><h3>Centro de custo</h3><div class="chips">${chipList(db.centrosCusto)}</div><form method="post" action="/parametrizacao/centros" class="form"><label>Novo centro<input name="nome" required></label><button>Cadastrar centro</button></form><h3>Plano de contas</h3><div class="chips">${chipList(db.planosContas)}</div><form method="post" action="/parametrizacao/planos" class="form"><label>Novo plano<input name="nome" required></label><button>Cadastrar plano</button></form></div>
  <div class="card"><h3>Referências com teto de gasto</h3><div class="chips">${chipList(db.referencias)}</div><form method="post" action="/parametrizacao/referencias" class="form"><div class="form-grid"><label>Referência<input name="nome" required></label><label>Centro<select name="centroCustoId">${opts(db.centrosCusto)}</select></label><label>Plano<select name="planoContaId">${opts(db.planosContas)}</select></label><label>Teto de gasto<input name="tetoGasto" placeholder="0,00"></label></div><button>Cadastrar referência</button></form><h3>Parcelas</h3><div class="chips">${chipList(db.parcelasTipos)}</div><form method="post" action="/parametrizacao/parcelas" class="form"><label>Nova parcela<input name="nome" required></label><button>Cadastrar parcela</button></form></div>
  </div>`);
}

function criarLancamentosComParcelas(db, body, files) {
  const required = ['tipo','descricao','credorDevedorId','filialId','unidadeNegocioId','centroCustoId','planoContaId','referenciaId','parcelaTipoId','competencia','vencimento','valorProvisionado'];
  for (const k of required) if (!body[k]) throw new Error(`Campo obrigatório não preenchido: ${k}.`);
  const q = Math.max(1, Math.min(120, parseInt(body.quantidadeParcelas || '1',10) || 1));
  const grupo = uid('grp');
  const totalInput = money(body.valorProvisionado);
  if (totalInput <= 0) throw new Error('O valor provisionado deve ser maior que zero.');
  const nf = firstFile(files.anexoNota);
  const comp = firstFile(files.anexoComprovante);
  const valores = [];
  if (body.valorModoParcelamento === 'total_dividido' && q > 1) {
    let acumulado = 0;
    for (let i=1;i<=q;i++) { const v = i === q ? money(totalInput - acumulado) : money(totalInput / q); acumulado += v; valores.push(v); }
  } else for (let i=1;i<=q;i++) valores.push(totalInput);
  const criados = [];
  for (let i=0;i<q;i++) {
    const vencimento = body.periodicidade === 'intervalo' ? addDays(body.vencimento, i * (parseInt(body.intervaloDias || '30',10)||30)) : addMonths(body.vencimento, i);
    const competencia = addMonthsCompetencia(body.competencia, i);
    const desc = q > 1 ? `${body.descricao} - Parcela ${i+1}/${q}` : body.descricao;
    const status = body.status || 'provisionado';
    const l = {
      id: uid('lan'), grupoParcelamentoId: grupo, tipo: body.tipo, descricao: desc,
      unidadeNegocioId: body.unidadeNegocioId, credorDevedorId: body.credorDevedorId, filialId: body.filialId,
      centroCustoId: body.centroCustoId, planoContaId: body.planoContaId, referenciaId: body.referenciaId, parcelaTipoId: body.parcelaTipoId,
      competencia, vencimento, parcelaNumero:i+1, parcelaTotal:q, valorProvisionado: valores[i], valorBaixado: money(body.valorBaixado), valorRealizado: money(body.valorBaixado), dataPagamento: body.dataPagamento || '', dataRealizacao: body.dataPagamento || '', valorMulta: money(body.valorMulta),
      status, formaPagamentoId: body.formaPagamentoId || '', bancoId: body.bancoId || '', rateioModo: body.comRateio ? (body.rateioModo || 'manual_percentual') : 'sem_rateio',
      notaTipo: body.notaTipo || '', notaNumero: body.notaNumero || '', anexoNotaUrl: nf?.url || '', anexoNotaNome: nf?.originalName || '', comprovanteUrl: comp?.url || '', comprovanteNome: comp?.originalName || '', observacao: body.observacao || '', createdAt: new Date().toISOString()
    };
    if (status === 'pago' || status === 'baixado') {
      if (!l.dataPagamento) l.dataPagamento = today();
      if (!l.valorBaixado) { l.valorBaixado = l.valorProvisionado; l.valorRealizado = l.valorProvisionado; }
    }
    db.lancamentos.push(l);
    try { criarRateios(db, l, body); } catch(e) { for (const c of criados) { db.lancamentos = db.lancamentos.filter(x=>x.id!==c.id); db.rateios = db.rateios.filter(r=>r.lancamentoId!==c.id); } db.lancamentos = db.lancamentos.filter(x=>x.id!==l.id); throw e; }
    criados.push(l);
  }
  addLog(db, 'criar', 'lancamentos', grupo, { quantidade:q, primeiro:criados[0]?.id });
  return criados;
}
function csv(db) {
  const m = maps(db);
  const header = ['tipo','descricao','unidade_negocio','credor_devedor','filial','centro_custo','plano_contas','referencia','competencia','vencimento','parcela','status','valor_provisionado','nota_nf','forma_pagamento','banco','data_pagamento','valor_baixado','valor_multa'];
  const rows = [header.join(';')];
  for (const l of db.lancamentos) rows.push([l.tipo,l.descricao,m.unidades[l.unidadeNegocioId]?.nome||'',m.credores[l.credorDevedorId]?.nome||'',`${m.filiais[l.filialId]?.codigo||''} - ${m.filiais[l.filialId]?.nome||''}`,m.centros[l.centroCustoId]?.nome||'',m.planos[l.planoContaId]?.nome||'',m.referencias[l.referenciaId]?.nome||'',l.competencia,l.vencimento,`${l.parcelaNumero}/${l.parcelaTotal}`,statusLabel(l.status,l.tipo),String(l.valorProvisionado).replace('.',','),l.notaNumero||'',m.formas[l.formaPagamentoId]?.nome||'',m.bancos[l.bancoId]?.nome||'',l.dataPagamento||'',String(l.valorBaixado||0).replace('.',','),String(l.valorMulta||0).replace('.',',')].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';'));
  return rows.join('\n');
}
function staticFile(base, pathname, res) {
  const root = base === 'uploads' ? UPLOAD_DIR : PUBLIC_DIR;
  const prefix = base === 'uploads' ? '/uploads/' : '/public/';
  const file = path.normalize(path.join(root, pathname.replace(prefix,'')));
  if (!file.startsWith(root) || !fs.existsSync(file)) return send(res,404,'Arquivo não encontrado','text/plain');
  const ext = path.extname(file).toLowerCase();
  const type = ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'application/javascript; charset=utf-8' : ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
  send(res,200,fs.readFileSync(file),type);
}

async function handle(req,res) {
  const url = new URL(req.url, `http://${req.headers.host}`); const p=url.pathname;
  if (p.startsWith('/public/')) return staticFile('public', p, res);
  if (p.startsWith('/uploads/')) return staticFile('uploads', p, res);
  const db = readDb();
  try {
    if (req.method==='GET' && p==='/') return send(res,200,renderDashboard(db));
    if (req.method==='GET' && p==='/graficos') return send(res,200,renderGraficos(db));
    if (req.method==='GET' && p==='/lancamentos') return send(res,200,renderLancamentos(db));
    if (req.method==='GET' && p==='/lancamentos/novo') return send(res,200,renderNovoLancamento(db));
    if (req.method==='GET' && p==='/rateios') return send(res,200,renderRateios(db));
    if (req.method==='GET' && p==='/reservas') return send(res,200,renderReservas(db));
    if (req.method==='GET' && p==='/emprestimos') return send(res,200,renderEmprestimos(db));
    if (req.method==='GET' && p==='/relatorios') return send(res,200,renderRelatorios(db));
    if (req.method==='GET' && p==='/parametrizacao') return send(res,200,renderParametrizacao(db));
    if (req.method==='GET' && p==='/api/dashboard') return send(res,200,JSON.stringify(calcularDashboard(db),null,2),'application/json; charset=utf-8');
    if (req.method==='GET' && p==='/api/graficos') return send(res,200,JSON.stringify({dashboard:calcularDashboard(db), competencias:receitaDespesaPorCompetencia(db)},null,2),'application/json; charset=utf-8');
    if (req.method==='GET' && p==='/api/lancamentos') return send(res,200,JSON.stringify(db.lancamentos,null,2),'application/json; charset=utf-8');
    if (req.method==='GET' && p==='/export/lancamentos.csv') { res.writeHead(200, {'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="glinkfinance-lancamentos.csv"'}); return res.end(csv(db)); }
    const baixarGet = p.match(/^\/lancamentos\/([^/]+)\/baixar$/);
    if (req.method==='GET' && baixarGet) return send(res,200,renderBaixarLancamento(db, baixarGet[1]));

    if (req.method==='POST' && p==='/lancamentos') {
      const {fields, files}=await parseBody(req);
      try { criarLancamentosComParcelas(db, fields, files); writeDb(db); return redirect(res,'/lancamentos'); }
      catch(e) { return send(res,400,renderNovoLancamento(db,e.message)); }
    }
    const baixar = p.match(/^\/lancamentos\/([^/]+)\/baixar$/);
    if (req.method==='POST' && baixar) {
      const l=find(db.lancamentos, baixar[1]); if(!l) return send(res,404,'Lançamento não encontrado','text/plain');
      const {fields:b, files}=await parseBody(req);
      l.status=b.status || 'baixado'; l.dataPagamento=b.dataPagamento || today(); l.dataRealizacao=l.dataPagamento; l.valorBaixado=money(b.valorBaixado); l.valorRealizado=l.valorBaixado; l.valorMulta=money(b.valorMulta); l.formaPagamentoId=b.formaPagamentoId || l.formaPagamentoId; l.bancoId=b.bancoId || l.bancoId;
      const comp = firstFile(files.anexoComprovante); if (comp) { l.comprovanteUrl=comp.url; l.comprovanteNome=comp.originalName; }
      if (b.observacaoBaixa) l.observacao = [l.observacao, `Baixa: ${b.observacaoBaixa}`].filter(Boolean).join('\n');
      addLog(db,'baixar','lancamentos',l.id,{valor:l.valorBaixado,status:l.status}); writeDb(db); return redirect(res,'/lancamentos');
    }
    const cancelar = p.match(/^\/lancamentos\/([^/]+)\/cancelar$/);
    if (req.method==='POST' && cancelar) { const l=find(db.lancamentos, cancelar[1]); if(!l) return send(res,404,'Lançamento não encontrado','text/plain'); l.status='cancelado'; addLog(db,'cancelar','lancamentos',l.id,{status:'cancelado'}); writeDb(db); return redirect(res,'/lancamentos'); }

    if (req.method==='POST' && p==='/reservas') { const {fields:b}=await parseBody(req); const r={id:uid('res'), data:b.data, tipo:b.tipo, categoria:b.categoria||'', valor:money(b.valor), descricao:b.descricao, observacao:b.observacao||'', createdAt:new Date().toISOString()}; db.reservas.push(r); addLog(db,'criar','reservas',r.id,r); writeDb(db); return redirect(res,'/reservas'); }
    if (req.method==='POST' && p==='/emprestimos') { const {fields:b}=await parseBody(req); const e={id:uid('emp'), dataEmprestimo:b.dataEmprestimo, dataPrevistaDevolucao:b.dataPrevistaDevolucao||'', parte:b.parte, valorOriginal:money(b.valorOriginal), valorDevolvido:0, descricao:b.descricao, observacao:b.observacao||'', status:'em_aberto', createdAt:new Date().toISOString()}; db.emprestimos.push(e); addLog(db,'criar','emprestimos',e.id,e); writeDb(db); return redirect(res,'/emprestimos'); }
    const devolver = p.match(/^\/emprestimos\/([^/]+)\/devolver$/);
    if (req.method==='POST' && devolver) { const e=find(db.emprestimos, devolver[1]); if(!e) return send(res,404,'Empréstimo não encontrado','text/plain'); const {fields:b}=await parseBody(req); e.valorDevolvido=money(num(e.valorDevolvido)+money(b.valor)); if (e.valorDevolvido >= e.valorOriginal) e.status='quitado'; addLog(db,'devolver','emprestimos',e.id,{valor:b.valor}); writeDb(db); return redirect(res,'/emprestimos'); }

    if (req.method==='POST' && p==='/parametrizacao/unidades') { const {fields:b}=await parseBody(req); const item={id:uid('un'), nome:b.nome, descricao:b.descricao||'', status:'ativo'}; db.unidadesNegocio.push(item); writeDb(db); return redirect(res,'/parametrizacao#unidades'); }
    if (req.method==='POST' && p==='/parametrizacao/filiais') { const {fields:b}=await parseBody(req); const item={id:uid('fil'), codigo:b.codigo, nome:b.nome, razaoSocial:b.razaoSocial||'', cnpj:b.cnpj||'', percentualRateioPadrao:0, status:'ativa'}; db.filiais.push(item); writeDb(db); return redirect(res,'/parametrizacao#filiais'); }
    if (req.method==='POST' && p==='/parametrizacao/credores') { const {fields:b}=await parseBody(req); const item={id:uid('cd'), nome:b.nome, tipo:b.tipo, natureza:b.natureza, cpfCnpj:b.cpfCnpj||'', email:b.email||'', contato:b.contato||'', chavePix:b.chavePix||'', status:'ativo'}; db.credoresDevedores.push(item); writeDb(db); return redirect(res,'/parametrizacao#credores'); }
    if (req.method==='POST' && p==='/parametrizacao/formas-pagamento') { const {fields:b}=await parseBody(req); db.formasPagamento.push({id:uid('fp'), nome:b.nome, status:'ativo'}); writeDb(db); return redirect(res,'/parametrizacao#pagamento'); }
    if (req.method==='POST' && p==='/parametrizacao/bancos') { const {fields:b}=await parseBody(req); db.bancos.push({id:uid('bc'), nome:b.nome, agencia:b.agencia||'', conta:b.conta||'', status:'ativo'}); writeDb(db); return redirect(res,'/parametrizacao#pagamento'); }
    if (req.method==='POST' && p==='/parametrizacao/centros') { const {fields:b}=await parseBody(req); db.centrosCusto.push({id:uid('cc'), nome:b.nome, status:'ativo'}); writeDb(db); return redirect(res,'/parametrizacao#classificacoes'); }
    if (req.method==='POST' && p==='/parametrizacao/planos') { const {fields:b}=await parseBody(req); db.planosContas.push({id:uid('pc'), nome:b.nome, status:'ativo'}); writeDb(db); return redirect(res,'/parametrizacao#classificacoes'); }
    if (req.method==='POST' && p==='/parametrizacao/referencias') { const {fields:b}=await parseBody(req); db.referencias.push({id:uid('ref'), nome:b.nome, centroCustoId:b.centroCustoId||'', planoContaId:b.planoContaId||'', tetoGasto:money(b.tetoGasto), status:'ativo'}); writeDb(db); return redirect(res,'/parametrizacao#classificacoes'); }
    if (req.method==='POST' && p==='/parametrizacao/parcelas') { const {fields:b}=await parseBody(req); db.parcelasTipos.push({id:uid('par'), nome:b.nome, modo:'custom', status:'ativo'}); writeDb(db); return redirect(res,'/parametrizacao#classificacoes'); }

    return send(res,404,layout('404','',header('404','Rota não encontrada')));
  } catch(e) { console.error(e); return send(res,500,`Erro interno: ${esc(e.message)}`,'text/html; charset=utf-8'); }
}

http.createServer(handle).listen(PORT, () => console.log(`GlinkFinance rodando em http://localhost:${PORT}`));
