(() => {
  const $ = (s) => document.querySelector(s);
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const defaults = { username: 'username', photo: '', textBase: 5, audioBase: 10, charPrice: 0.1, secondPrice: 0.5, charLimit: 200, secondLimit: 30 };
  let saved = { ...defaults };
  try { Object.assign(saved, JSON.parse(localStorage.getItem('streampix-account') || '{}')); } catch {}
  let photo = typeof saved.photo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(saved.photo) ? saved.photo : '';
  saved.photo = photo;
  const icon = (name) => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  const main = $('#mainContent');
  main.insertAdjacentHTML('beforeend', `
    <section class="workspace-view" id="incentivesView" hidden aria-labelledby="incentivesTitle">
      <div class="page-context">Workspace / Incentivos</div>
      <div class="home-heading"><div><h1 id="incentivesTitle" tabindex="-1">Incentivos</h1><p>Histórico de mensagens e contribuições.</p></div><span class="demo-label">Dados de demonstração</span></div>
      <form id="incentiveFilters" class="filter-bar">
        <label class="field search-field">Usuário<input id="donorSearch" type="search" placeholder="Buscar nome de usuário" autocomplete="off"></label>
        <label class="field">Período<select id="donorPeriod"><option value="7">Últimos 7 dias</option><option value="14">Últimos 14 dias</option><option value="30" selected>Últimos 30 dias</option><option value="60">Últimos 60 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="custom">Personalizado</option></select></label>
        <label class="field">Data de início<input id="donorStart" type="date" required></label>
        <label class="field">Data de fim<input id="donorEnd" type="date" required></label>
        <button class="action-button" type="submit">${icon('filter_alt')}Filtrar</button>
      </form>
      <p id="filterError" class="form-message" role="alert"></p>
      <div class="results-summary" aria-live="polite"><span id="donorCount"></span><span id="donorTotal"></span></div>
      <div class="table-scroll"><table class="incentives-table"><thead><tr><th>Usuário / mensagem</th><th>Data</th><th>Tipo</th><th>Status</th><th>Valor</th></tr></thead><tbody id="donorRows"></tbody></table></div>
      <div class="results-pagination"><span id="donorPage" aria-live="polite"></span><div><button id="donorPrev" class="icon-button" aria-label="Página anterior" title="Página anterior">${icon('chevron_left')}</button><button id="donorNext" class="icon-button" aria-label="Próxima página" title="Próxima página">${icon('chevron_right')}</button></div></div>
    </section>
    <section class="workspace-view" id="accountView" hidden aria-labelledby="accountTitle">
      <div class="page-context">Workspace / Conta</div>
      <div class="home-heading"><div><h1 id="accountTitle" tabindex="-1">Minha conta</h1><p>Perfil e valores dos incentivos.</p></div><span class="demo-label">Preferências salvas neste navegador</span></div>
      <form id="accountForm">
        <section class="account-section"><div><h2>Perfil</h2><p>Identidade do criador</p></div><div class="account-fields">
          <div class="photo-editor"><span class="user-avatar" id="photoPreview">${icon('person')}</span><label class="action-button photo-upload">${icon('upload')}Alterar foto<input id="profilePhoto" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Alterar foto de perfil"></label><button class="icon-button" id="removePhoto" type="button" title="Remover foto" aria-label="Remover foto">${icon('delete')}</button></div>
          <span class="field-note">PNG, JPEG ou WebP · até 2 MB</span>
          <label class="field">Nome de usuário<input name="username" required maxlength="32" minlength="3" pattern="[A-Za-z0-9_]{3,32}" autocomplete="username" title="Use de 3 a 32 letras, números ou sublinhados."></label>
        </div></section>
        <section class="account-section"><div><h2>Mensagens de texto</h2><p>Preço base e caracteres adicionais</p></div><div class="account-fields price-fields">
          <label class="field">Preço base (R$)<input name="textBase" type="number" min="0.01" max="100000" step="0.01" required></label>
          <label class="field">Limite padrão de caracteres<input name="charLimit" type="number" min="1" max="10000" step="1" required></label>
          <label class="field">Por caractere extra (R$)<input name="charPrice" type="number" min="0" max="1000" step="0.01" required></label>
          <output class="price-preview" id="textPreview"></output>
        </div></section>
        <section class="account-section"><div><h2>Mensagens de áudio</h2><p>Preço base e segundos adicionais</p></div><div class="account-fields price-fields">
          <label class="field">Preço base (R$)<input name="audioBase" type="number" min="0.01" max="100000" step="0.01" required></label>
          <label class="field">Limite padrão em segundos<input name="secondLimit" type="number" min="1" max="3600" step="1" required></label>
          <label class="field">Por segundo extra (R$)<input name="secondPrice" type="number" min="0" max="1000" step="0.01" required></label>
          <output class="price-preview" id="audioPreview"></output>
        </div></section>
        <div class="account-save"><p id="accountMessage" class="form-message" role="status"></p><button class="action-button" id="cancelAccount" type="button">Descartar alterações</button><button class="action-button primary" type="submit">${icon('check')}Salvar alterações</button></div>
      </form>
    </section>`);

  function showPhoto(target, source) {
    target.replaceChildren();
    if (source) { const img = new Image(); img.src = source; img.alt = ''; target.append(img); }
    else target.innerHTML = icon('person');
  }
  function syncProfile() {
    $('.username').textContent = saved.username;
    $('#homeTitle span').textContent = saved.username;
    $('.account-popover-head strong').textContent = saved.username;
    $('.profile-card h3').textContent = saved.username;
    $('.user-menu').setAttribute('aria-label', `Conta de ${saved.username}`);
    document.querySelectorAll('.header .user-avatar, .profile-avatar').forEach(el => showPhoto(el, saved.photo));
  }
  const form = $('#accountForm');
  function preview() {
    const v = (name) => Number(form.elements[name].value);
    $('#textPreview').textContent = `${v('charLimit') + 10} caracteres: ${money.format(v('textBase') + 10 * v('charPrice'))} (10 extras)`;
    $('#audioPreview').textContent = `${v('secondLimit') + 5} segundos: ${money.format(v('audioBase') + 5 * v('secondPrice'))} (5 extras)`;
  }
  function restore() {
    Object.keys(defaults).filter(k => k !== 'photo').forEach(k => { form.elements[k].value = saved[k]; });
    photo = saved.photo; showPhoto($('#photoPreview'), photo); preview();
    $('#accountMessage').textContent = '';
  }
  form.addEventListener('input', preview);
  let uploadVersion = 0;
  $('#profilePhoto').addEventListener('change', async (event) => {
    const file = event.target.files[0]; const version = ++uploadVersion;
    if (!file) return;
    const message = $('#accountMessage');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { message.textContent = 'Escolha PNG, JPEG ou WebP de até 2 MB.'; event.target.value = ''; return; }
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const img = new Image(); img.src = data; await img.decode();
      if (version !== uploadVersion) return;
      photo = data; showPhoto($('#photoPreview'), photo); message.textContent = 'Foto selecionada. Salve para confirmar.';
    } catch { message.textContent = 'Não foi possível abrir esta imagem.'; }
    event.target.value = '';
  });
  $('#removePhoto').addEventListener('click', () => { uploadVersion++; photo = ''; showPhoto($('#photoPreview'), ''); });
  $('#cancelAccount').addEventListener('click', () => { uploadVersion++; restore(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = { photo };
    Object.keys(defaults).filter(k => k !== 'photo').forEach(k => { next[k] = k === 'username' ? form.elements[k].value.trim() : Number(form.elements[k].value); });
    try { localStorage.setItem('streampix-account', JSON.stringify(next)); saved = next; syncProfile(); $('#accountMessage').textContent = 'Alterações salvas neste navegador.'; }
    catch { $('#accountMessage').textContent = 'Não foi possível salvar. Tente uma foto menor ou libere o armazenamento do navegador.'; }
  });

  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const names = ['ana_live', 'pedro.gg', 'mariana', 'lucas_play', 'bia', 'rafael', 'carol_stream', 'gui'];
  const donations = Array.from({ length: 180 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - Math.floor(i * 2.05), 20 - i % 12, i % 60);
    return { name: names[i % names.length], date: dateKey(date), time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), amount: 5 + (i * 17 % 196), audio: i % 3 === 0, queued: i < 6, message: ['Ótima live! Valeu pelo conteúdo.', 'Bora para a próxima partida!', 'Acompanhando daqui. Sucesso!', 'Essa transmissão está demais.'][i % 4] };
  });
  let page = 1, filtered = [];
  function render() {
    const pages = Math.max(1, Math.ceil(filtered.length / 12));
    $('#donorCount').textContent = `${filtered.length} incentivos no período`;
    $('#donorTotal').textContent = `Total: ${money.format(filtered.reduce((sum, row) => sum + row.amount, 0))}`;
    $('#donorRows').innerHTML = filtered.slice((page - 1) * 12, page * 12).map(row => `<tr><td><span class="donor-name">${row.name}</span><small>${row.message}</small></td><td>${row.date.split('-').reverse().join('/')}<small>${row.time}</small></td><td><span class="donor-type">${icon(row.audio ? 'mic' : 'chat_bubble')}${row.audio ? 'Áudio' : 'Texto'}</span></td><td><span class="donor-status ${row.queued ? 'queued' : ''}">${row.queued ? 'Na fila' : 'Exibido'}</span></td><td>${money.format(row.amount)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-results">Nenhum incentivo encontrado para esta busca e período.</td></tr>';
    $('#donorPage').textContent = `Página ${page} de ${pages}`;
    $('#donorPrev').disabled = page === 1; $('#donorNext').disabled = page >= pages;
  }
  function filter() {
    const start = $('#donorStart').value, end = $('#donorEnd').value;
    if (!start || !end || start > end) { $('#filterError').textContent = 'Informe um período válido: o início deve ser anterior ou igual ao fim.'; return; }
    $('#filterError').textContent = '';
    const query = $('#donorSearch').value.trim().toLocaleLowerCase('pt-BR');
    filtered = donations.filter(row => row.date >= start && row.date <= end && row.name.toLocaleLowerCase('pt-BR').includes(query)); page = 1; render();
  }
  function preset() {
    if ($('#donorPeriod').value === 'custom') { $('#donorStart').focus(); return; }
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - Number($('#donorPeriod').value) + 1);
    $('#donorStart').value = dateKey(start); $('#donorEnd').value = dateKey(today); filter();
  }
  $('#donorPeriod').addEventListener('change', preset);
  ['#donorStart', '#donorEnd'].forEach(selector => $(selector).addEventListener('input', () => { $('#donorPeriod').value = 'custom'; }));
  $('#donorSearch').addEventListener('input', filter);
  $('#incentiveFilters').addEventListener('submit', event => { event.preventDefault(); filter(); });
  $('#donorPrev').addEventListener('click', () => { page--; render(); });
  $('#donorNext').addEventListener('click', () => { page++; render(); });

  const widgetView = document.createElement('section');
  widgetView.id = 'widgetsView'; widgetView.className = 'workspace-view'; widgetView.hidden = true; main.append(widgetView);
  const routes = { home: $('.home-view'), incentives: $('#incentivesView'), account: $('#accountView'), widgets: widgetView };
  const links = [['Home', 'home'], ['Donates', 'incentives'], ['Profile', 'account'], ['Widgets', 'widgets']];
  links.forEach(([label, route]) => { $(`.sidebar-link[aria-label="${label}"]`).href = `#${route}`; });
  $('.brand').href = '#home';
  const profileButton = $('[data-popup="profileDialog"]');
  profileButton.addEventListener('click', event => { event.stopImmediatePropagation(); if ($('#accountPopover').matches(':popover-open')) $('#accountPopover').hidePopover(); location.hash = 'account'; navigate(); }, true);
  $('.sidebar-link[aria-label="Settings"]').addEventListener('click', event => { event.preventDefault(); $('#settingsDialog').showModal(); });
  function navigate() {
    const route = location.hash.slice(1) in routes ? location.hash.slice(1) : 'home';
    Object.entries(routes).forEach(([key, el]) => { el.hidden = key !== route; });
    links.forEach(([label, key]) => { const link = $(`.sidebar-link[aria-label="${label}"]`); link.classList.toggle('active', key === route); if (key === route) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    document.title = `${route === 'home' ? 'Home' : route === 'account' ? 'Conta' : route === 'widgets' ? 'Widgets' : 'Incentivos'} · StreamPix`;
  }
  window.addEventListener('hashchange', navigate);
  restore(); syncProfile(); preset(); navigate();
})();
