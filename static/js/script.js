(function () {
  'use strict';

  var CRIT = ['baixa', 'média', 'alta'];
  var PRIO = ['baixa', 'média', 'alta', 'urgente'];
  var SIT = ['aberta', 'em atendimento', 'aguardando peça', 'concluída'];
  var ST_KEY = { 'aberta': 'aberta', 'em atendimento': 'atendimento', 'aguardando peça': 'peca', 'concluída': 'concluida' };
  var LV_KEY = { 'baixa': 'baixa', 'média': 'media', 'alta': 'alta', 'urgente': 'urgente' };
  var state = { equipment: [], orders: [], example: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function osId(n) { return 'OS-' + String(n).padStart(5, '0'); }
  function fmt(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return esc(v);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  }

  /* Comunicação com o servidor (Flask + SQLite) */
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; });
    }).catch(function () {
      return { ok: false, data: { erro: 'Não foi possível conectar ao servidor.' } };
    });
  }
  function refresh() {
    return api('GET', '/api/dados').then(function (r) {
      if (!r.ok) { toast(r.data.erro || 'Erro ao carregar os dados.', 'error'); return; }
      state.equipment = r.data.equipamentos;
      state.orders = r.data.ordens;
      state.example = r.data.exemplo;
    });
  }

  /* Consultas */
  function eqById(id) { return state.equipment.filter(function (e) { return e.id === id; })[0] || null; }
  function orderById(id) { return state.orders.filter(function (o) { return o.id === id; })[0] || null; }
  function byName(a, b) { return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }); }

  /* Avisos */
  var toastTimer;
  function toast(msg, kind) {
    var box = document.getElementById('toast');
    box.innerHTML = '<div class="toast ' + (kind === 'error' ? 'error' : '') + '">' + esc(msg) + '</div>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.innerHTML = ''; }, 4500);
  }

  /* Componentes */
  function stBadge(s) { return '<span class="badge st-' + ST_KEY[s] + '">' + esc(cap(s)) + '</span>'; }
  function lvBadge(l, prefix) { return '<span class="badge lv-' + LV_KEY[l] + '">' + esc((prefix || '') + (prefix ? l : cap(l))) + '</span>'; }
  function options(list, selected) {
    return list.map(function (v) { return '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(cap(v)) + '</option>'; }).join('');
  }

  /* Telas */
  function viewPainel() {
    var counts = {};
    SIT.forEach(function (s) { counts[s] = 0; });
    state.orders.forEach(function (o) { counts[o.status]++; });
    var recent = state.orders.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 10);
    var n = state.equipment.length;

    var rows = recent.map(function (o) {
      var e = eqById(o.equipment_id) || { code: '—', name: '' };
      var desc = o.failure_description.length > 70 ? o.failure_description.slice(0, 70) + '…' : o.failure_description;
      return '<tr>' +
        '<td data-label="OS"><a class="mono" href="#os-' + o.id + '">' + osId(o.id) + '</a></td>' +
        '<td data-label="Equipamento"><strong class="mono">' + esc(e.code) + '</strong><small>' + esc(e.name) + '</small></td>' +
        '<td data-label="Falha">' + esc(desc) + '</td>' +
        '<td data-label="Prioridade">' + lvBadge(o.priority) + '</td>' +
        '<td data-label="Situação">' + stBadge(o.status) + '</td>' +
        '<td data-label="Técnico">' + esc(o.technician || '—') + '</td>' +
        '<td data-label="Abertura">' + fmt(o.opened_at) + '</td></tr>';
    }).join('');

    var table = recent.length
      ? '<div class="scroll-x"><table class="tbl"><thead><tr><th>OS</th><th>Equipamento</th><th>Falha</th><th>Prioridade</th><th>Situação</th><th>Técnico</th><th>Abertura</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty"><p>Nenhuma ordem de serviço registrada ainda.</p>' +
        (n ? '<a class="btn primary" href="#nova-os">Abrir primeira ordem</a>' : '<a class="btn primary" href="#equipamentos">Cadastrar primeiro equipamento</a>') + '</div>';

    var kp = [['aberta', 'Abertas', 'k-aberta'], ['em atendimento', 'Em atendimento', 'k-atendimento'], ['aguardando peça', 'Aguardando peça', 'k-peca'], ['concluída', 'Concluídas', 'k-concluida']]
      .map(function (k) {
        return '<div class="kpi ' + k[2] + '"><div class="kpi-label"><i class="dot"></i><span>' + k[1] + '</span></div><div class="kpi-value" style="color:var(--ink)">' + counts[k[0]] + '</div></div>';
      }).join('');

    return '<section class="hero"><div class="wrap hero-grid"><div>' +
      '<h1>Gestão e controle da manutenção industrial</h1>' +
      '<div class="hero-actions"><a class="btn primary" href="#nova-os">+ Abrir ordem de serviço</a><a class="btn ghost" href="#equipamentos">Cadastrar equipamento</a></div>' +
      '</div>' +
      '</div></section>' +
      '<div class="wrap page" style="padding-top:0">' +
      '<div class="kpis" role="list" aria-label="Ordens por situação">' + kp + '</div>' +
      (state.example ? '<div class="banner"><span>Você está vendo dados de exemplo para explorar o sistema.</span><button class="btn sm" type="button" data-act="clear">Começar do zero</button></div>' : '') +
      '<section class="panel"><div class="panel-head"><h2>Últimas ordens de serviço</h2><span class="muted">' + n + ' equipamento' + (n === 1 ? '' : 's') + ' cadastrado' + (n === 1 ? '' : 's') + '</span></div>' + table + '</section>' +
      '</div>';
  }

  function viewEquipamentos() {
    var list = state.equipment.slice().sort(byName);
    var rows = list.map(function (e) {
      return '<tr><td data-label="Identificação"><strong class="mono">' + esc(e.code) + '</strong></td>' +
        '<td data-label="Nome">' + esc(e.name) + '</td><td data-label="Setor">' + esc(e.sector) + '</td>' +
        '<td data-label="Criticidade">' + lvBadge(e.criticality) + '</td>' +
        '<td data-label=""><a class="btn sm" href="#historico-' + e.id + '">Histórico</a></td></tr>';
    }).join('');
    var table = list.length
      ? '<div class="scroll-x"><table class="tbl"><thead><tr><th>Identificação</th><th>Nome</th><th>Setor</th><th>Criticidade</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty"><p>Nenhum equipamento cadastrado. Use o formulário para começar.</p></div>';
    return '<div class="wrap page">' +
      '<div class="page-head"><div><h1>Equipamentos</h1><p>Cadastro dos ativos da planta e acesso ao histórico de manutenção de cada um.</p></div></div>' +
      '<div class="split"><section class="panel"><div class="panel-head"><h2>Ativos cadastrados</h2><span class="muted">' + list.length + ' no total</span></div>' + table + '</section>' +
      '<aside class="panel"><h2 style="margin-bottom:14px">Novo equipamento</h2>' +
      '<form data-form="equip" novalidate>' +
      '<div class="field"><label for="eq-code">Identificação (TAG)</label><input type="text" id="eq-code" name="code" placeholder="Ex.: CMP-001" autocomplete="off"></div>' +
      '<div class="field"><label for="eq-name">Nome do equipamento</label><input type="text" id="eq-name" name="name" placeholder="Ex.: Compressor de parafuso" autocomplete="off"></div>' +
      '<div class="field"><label for="eq-sector">Setor</label><input type="text" id="eq-sector" name="sector" placeholder="Ex.: Utilidades" autocomplete="off"></div>' +
      '<div class="field"><label for="eq-crit">Criticidade</label><select id="eq-crit" name="criticality">' + options(CRIT, 'média') + '</select><span class="hint">Impacto da parada do equipamento na produção.</span></div>' +
      '<button class="btn primary" type="submit">Cadastrar equipamento</button></form></aside></div></div>';
  }

  function viewNovaOS() {
    var eqs = state.equipment.slice().sort(byName);
    var body;
    if (!eqs.length) {
      body = '<div class="empty"><p>Cadastre ao menos um equipamento antes de abrir uma ordem de serviço.</p><a class="btn primary" href="#equipamentos">Ir para equipamentos</a></div>';
    } else {
      body = '<form data-form="order" novalidate>' +
        '<div class="field"><label for="os-eq">Equipamento</label><select id="os-eq" name="equipment_id"><option value="">Selecione…</option>' +
        eqs.map(function (e) { return '<option value="' + e.id + '">' + esc(e.code + ' — ' + e.name + ' (' + e.sector + ')') + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="os-desc">Descrição da falha</label><textarea id="os-desc" name="failure_description" placeholder="Descreva o sintoma, quando ocorreu e as condições de operação."></textarea></div>' +
        '<div class="field"><label for="os-prio">Prioridade</label><select id="os-prio" name="priority">' + options(PRIO, 'média') + '</select></div>' +
        '<div class="row"><button class="btn primary" type="submit">Abrir ordem</button><a class="btn" href="#painel">Cancelar</a></div></form>';
    }
    return '<div class="wrap page"><div class="page-head"><div><h1>Nova ordem de serviço</h1><p>Registre a falha identificada para a equipe de manutenção atender.</p></div></div>' +
      '<section class="panel" style="max-width:720px">' + body + '</section></div>';
  }

  function viewOrdem(id) {
    var o = orderById(id);
    if (!o) { toast('Ordem não encontrada.', 'error'); location.hash = '#painel'; return null; }
    var e = eqById(o.equipment_id) || { id: 0, code: '—', name: '', sector: '—' };
    var done = o.status === 'concluída';

    var record = '<div class="note"><h3>Falha informada</h3><p>' + esc(o.failure_description) + '</p></div>' +
      (done
        ? '<div class="note"><h3>Causa da falha</h3><p>' + esc(o.failure_cause) + '</p></div>' +
          '<div class="note"><h3>Serviço realizado</h3><p>' + esc(o.work_performed) + '</p></div>' +
          '<div class="note"><h3>Peças utilizadas</h3><p>' + esc(o.parts_used || 'Nenhuma peça registrada.') + '</p></div>'
        : '<p class="muted">Causa, serviço realizado e peças serão registrados ao concluir a ordem.</p>');

    var complete = (!done && o.started_at)
      ? '<section class="panel"><h2 style="margin-bottom:14px">Concluir ordem</h2><form data-form="update" data-id="' + o.id + '" novalidate>' +
        '<input type="hidden" name="action" value="complete">' +
        '<div class="field"><label for="f-cause">Causa da falha</label><textarea id="f-cause" name="failure_cause"></textarea></div>' +
        '<div class="field"><label for="f-work">Serviço realizado</label><textarea id="f-work" name="work_performed"></textarea></div>' +
        '<div class="field"><label for="f-parts">Peças utilizadas <span class="muted">(opcional)</span></label><textarea id="f-parts" name="parts_used" style="min-height:70px"></textarea></div>' +
        '<button class="btn ok" type="submit">Concluir e registrar histórico</button></form></section>'
      : '';

    var actions = done ? '' :
      '<section class="panel"><h2 style="margin-bottom:14px">Ações</h2>' +
      '<form data-form="update" data-id="' + o.id + '" novalidate>' +
      '<div class="field"><label for="f-tech">Técnico responsável</label><input type="text" id="f-tech" name="technician" value="' + esc(o.technician || '') + '" placeholder="Nome do técnico" autocomplete="off"></div>' +
      '<div class="row"><button class="btn sm" type="submit" name="action" value="assign">Salvar técnico</button>' +
      '<button class="btn sm dark" type="submit" name="action" value="start">' + (o.started_at ? 'Retomar atendimento' : 'Iniciar atendimento') + '</button></div></form>' +
      (o.started_at
        ? '<hr><form data-form="update" data-id="' + o.id + '" novalidate><input type="hidden" name="action" value="status">' +
          '<div class="field"><label for="f-status">Alterar situação</label><select id="f-status" name="status">' + options(['em atendimento', 'aguardando peça', 'aberta'], o.status) + '</select></div>' +
          '<button class="btn sm" type="submit">Atualizar situação</button></form>'
        : '') + '</section>';

    return '<div class="wrap page"><div class="page-head"><div><div class="crumb"><a href="#painel">Painel</a> / Ordem de serviço</div>' +
      '<h1 class="mono" style="font-family:var(--font-display)">' + osId(o.id) + '</h1><p><span class="mono">' + esc(e.code) + '</span> — ' + esc(e.name) + '</p></div>' +
      '<div class="row">' + lvBadge(o.priority, 'Prioridade ') + stBadge(o.status) + '</div></div>' +
      '<div class="split"><div class="stack">' +
      '<section class="panel"><h2 style="margin-bottom:14px">Dados da ordem</h2><dl class="dl">' +
      '<dt>Equipamento</dt><dd>' + esc(e.code) + ' — ' + esc(e.name) + '</dd><dt>Setor</dt><dd>' + esc(e.sector) + '</dd>' +
      '<dt>Técnico responsável</dt><dd>' + esc(o.technician || '—') + '</dd><dt>Aberta em</dt><dd>' + fmt(o.opened_at) + '</dd>' +
      '<dt>Iniciada em</dt><dd>' + fmt(o.started_at) + '</dd><dt>Concluída em</dt><dd>' + fmt(o.completed_at) + '</dd></dl></section>' +
      '<section class="panel"><h2 style="margin-bottom:14px">Registro técnico</h2>' + record + '</section>' + complete + '</div>' +
      '<aside class="stack"><section class="panel"><h2 style="margin-bottom:14px">Andamento</h2><ul class="tl">' +
      '<li class="done"><strong>Ordem aberta</strong><span>' + fmt(o.opened_at) + '</span></li>' +
      '<li class="' + (o.started_at ? 'done' : '') + '"><strong>Atendimento iniciado</strong><span>' + fmt(o.started_at) + '</span></li>' +
      '<li class="' + (o.completed_at ? 'done' : '') + '"><strong>Ordem concluída</strong><span>' + fmt(o.completed_at) + '</span></li></ul></section>' +
      actions + '<a class="btn" href="#historico-' + o.equipment_id + '">Ver histórico do equipamento</a></aside></div></div>';
  }

  function viewHistorico(id) {
    var e = eqById(id);
    if (!e) { toast('Equipamento não encontrado.', 'error'); location.hash = '#equipamentos'; return null; }
    var orders = state.orders.filter(function (o) { return o.equipment_id === id; }).sort(function (a, b) { return b.id - a.id; });
    var rows = orders.map(function (o) {
      var desc = o.failure_description.length > 80 ? o.failure_description.slice(0, 80) + '…' : o.failure_description;
      return '<tr><td data-label="OS"><a class="mono" href="#os-' + o.id + '">' + osId(o.id) + '</a></td>' +
        '<td data-label="Abertura">' + fmt(o.opened_at) + '</td><td data-label="Falha">' + esc(desc) + '</td>' +
        '<td data-label="Causa">' + esc(o.failure_cause || '—') + '</td><td data-label="Serviço">' + esc(o.work_performed || '—') + '</td>' +
        '<td data-label="Peças">' + esc(o.parts_used || '—') + '</td><td data-label="Técnico">' + esc(o.technician || '—') + '</td>' +
        '<td data-label="Situação">' + stBadge(o.status) + '</td></tr>';
    }).join('');
    var body = orders.length
      ? '<div class="scroll-x"><table class="tbl"><thead><tr><th>OS</th><th>Abertura</th><th>Falha</th><th>Causa</th><th>Serviço realizado</th><th>Peças</th><th>Técnico</th><th>Situação</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty"><p>Este equipamento ainda não possui ordens de serviço.</p></div>';
    return '<div class="wrap page"><div class="page-head"><div><div class="crumb"><a href="#equipamentos">Equipamentos</a> / Histórico</div>' +
      '<h1>' + esc(e.code) + ' — ' + esc(e.name) + '</h1><p>Setor ' + esc(e.sector) + ' · Criticidade ' + esc(e.criticality) + '</p></div>' +
      '<a class="btn primary" href="#nova-os">+ Nova ordem</a></div>' +
      '<section class="panel"><div class="panel-head"><h2>Ordens de serviço</h2><span class="muted">' + orders.length + ' registro' + (orders.length === 1 ? '' : 's') + '</span></div>' + body + '</section></div>';
  }

  /* Rotas */
  var app = document.getElementById('app');
  function route() {
    var h = (location.hash || '#painel').slice(1);
    var m, html, nav = 'painel';
    if (h === 'equipamentos') { html = viewEquipamentos(); nav = 'equipamentos'; }
    else if (h === 'nova-os') { html = viewNovaOS(); nav = 'nova-os'; }
    else if ((m = h.match(/^os-(\d+)$/))) { html = viewOrdem(parseInt(m[1], 10)); nav = 'nova-os'; }
    else if ((m = h.match(/^historico-(\d+)$/))) { html = viewHistorico(parseInt(m[1], 10)); nav = 'equipamentos'; }
    else { html = viewPainel(); }
    if (html == null) return;
    app.innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      if (a.getAttribute('data-nav') === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });

  /* Ações: as regras de negócio são validadas no servidor (app.py) e no banco (schema.sql) */
  function createEquipment(fd) {
    return api('POST', '/api/equipamentos', Object.fromEntries(fd)).then(function (r) {
      if (!r.ok) { toast(r.data.erro, 'error'); return; }
      toast('Equipamento cadastrado.');
      return refresh().then(route);
    });
  }

  function createOrder(fd) {
    return api('POST', '/api/ordens', Object.fromEntries(fd)).then(function (r) {
      if (!r.ok) { toast(r.data.erro, 'error'); return; }
      toast('Ordem ' + osId(r.data.id) + ' aberta.');
      return refresh().then(function () { location.hash = '#os-' + r.data.id; });
    });
  }

  function updateOrder(id, action, fd) {
    var body = Object.fromEntries(fd);
    body.action = action;
    return api('POST', '/api/ordens/' + id + '/acao', body).then(function (r) {
      if (!r.ok) { toast(r.data.erro, 'error'); return; }
      toast(r.data.mensagem);
      return refresh().then(route);
    });
  }

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || !form.getAttribute || !form.getAttribute('data-form')) return;
    ev.preventDefault();
    var fd = new FormData(form), kind = form.getAttribute('data-form');
    if (kind === 'equip') createEquipment(fd);
    else if (kind === 'order') createOrder(fd);
    else if (kind === 'update') {
      var action = (ev.submitter && ev.submitter.value) || fd.get('action');
      updateOrder(parseInt(form.getAttribute('data-id'), 10), action, fd);
    }
  });

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (btn && btn.getAttribute('data-act') === 'clear') {
      api('POST', '/api/limpar').then(function (r) {
        if (!r.ok) { toast(r.data.erro, 'error'); return; }
        toast('Sistema limpo. Cadastre o primeiro equipamento.');
        refresh().then(route);
      });
    }
  });

  refresh().then(route);
})();