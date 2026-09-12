(() => {
  const $ = s => document.querySelector(s);
  const icon = name => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const readAccount = () => { try { return JSON.parse(localStorage.getItem('streampix-account') || '{}'); } catch { return {}; } };
  const accountDefaults = { username: 'username', textBase: 5, audioBase: 10, charPrice: .1, secondPrice: .5, charLimit: 200, secondLimit: 30 };
  let account, step = 0, mode = 'text', method = 'Pix', seconds = 0, audioUrl = '', recorder, stream, recordingTimer, quoteTimer;
  let rates = {}, quoteTime = 0, loadingQuote = false, lastCurrencyInput = 'real', audioPending = false, audioVersion = 0;
  const coins = { USDC: 'usd-coin', Bitcoin: 'bitcoin', Ethereum: 'ethereum', USDT: 'tether', BRL: null };
  const menuButton = document.createElement('button');
  menuButton.className = 'account-action'; menuButton.type = 'button'; menuButton.id = 'openDonate';
  menuButton.innerHTML = `${icon('open_in_new')}Sua Tela de Donates`;
  $('.popover-divider').before(menuButton);
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="donateDialog" class="donate-dialog" aria-labelledby="creatorName">
      <header class="donate-topbar"><span class="brand"><span class="brand-icon"><img src="assets/streampix-icon.png" width="40" height="40" alt=""></span><span class="brand-text">StreamPix</span></span><div><span class="donate-demo">Prévia · sem cobrança</span><button id="closeDonate" class="icon-button" aria-label="Fechar tela de donates" title="Fechar">${icon('close')}</button></div></header>
      <div class="donate-layout"><div class="donate-card">
        <header class="creator-head"><span class="user-avatar" id="creatorPhoto">${icon('person')}</span><h1 id="creatorName"></h1><p>Faça parte da próxima live.</p></header>
        <ol class="donate-steps" aria-label="Etapas do incentivo"><li aria-current="step"><span>1</span>Mensagem</li><li><span>2</span>Pagamento</li><li><span>3</span>Revisão</li></ol>
        <form id="donateForm" novalidate>
          <fieldset class="donate-step" data-step="0"><legend>Envie seu incentivo</legend>
            <label class="field">Seu nome<input id="senderName" maxlength="40" required autocomplete="nickname" placeholder="Como você quer aparecer?"></label>
            <div class="segmented-control donate-modes" aria-label="Formato da mensagem"><button type="button" class="chart-control active" data-mode="text" aria-pressed="true">Texto</button><button type="button" class="chart-control" data-mode="audio" aria-pressed="false">Áudio</button><button type="button" class="chart-control" data-mode="both" aria-pressed="false">Áudio + Texto</button></div>
            <div id="messageFields"><label class="field">Sua mensagem<textarea id="senderMessage" maxlength="10000" placeholder="Deixe uma mensagem para o criador" required></textarea></label><p id="messageCount" class="donate-counter"></p></div>
            <div id="audioFields" hidden><div class="audio-tools"><button type="button" class="action-button" id="recordAudio">${icon('mic')}Gravar</button><label class="action-button photo-upload">${icon('upload')}Enviar áudio<input type="file" id="audioFile" accept="audio/*" aria-label="Enviar mensagem de áudio"></label><audio id="audioPlayer" controls hidden></audio><button type="button" class="icon-button" id="clearAudio" aria-label="Remover áudio" title="Remover áudio">${icon('delete')}</button></div><p class="donate-note" id="audioStatus">Até 10 MB e 5 minutos.</p></div>
            <p class="donate-note" id="minimumNote"></p>
          </fieldset>
          <fieldset class="donate-step" data-step="1" hidden disabled><legend>Escolha como contribuir</legend>
            <div class="payment-methods" aria-label="Forma de pagamento">${[['Pix','qr_code_2'],['StreamPay','account_balance_wallet'],['Cartão de Débito','credit_card'],['Cartão de Crédito','credit_card'],['OpenFinance','account_balance'],['Cripto','currency_bitcoin']].map(([name,symbol])=>`<button type="button" class="payment-choice" data-payment="${name}" aria-pressed="${name==='Pix'}" ${name.startsWith('Cartão')?'disabled':''}>${icon(symbol)}<span>${name}${name.startsWith('Cartão')?'<small>Sem suporte</small>':''}</span></button>`).join('')}</div>
            <label class="field">Valor em reais (R$)<input id="donateAmount" class="donate-amount" type="number" min="0.01" max="100000" step="0.01" required value="10"></label>
            <div class="donate-presets" aria-label="Valores sugeridos">${[10,25,50,100].map(n=>`<button type="button" class="action-button" data-amount="${n}">R$ ${n}</button>`).join('')}</div>
            <div id="pixFields" class="donate-form-grid"><label class="field full">Nome completo<input id="payerName" required maxlength="120" autocomplete="off"></label><label class="field">CPF<input id="payerCpf" inputmode="numeric" pattern="[0-9]{11}" maxlength="11" placeholder="11 dígitos" required autocomplete="off"></label><label class="field">Data de nascimento<input id="payerBirth" type="date" required autocomplete="off"></label><label class="field full">Senha (opcional nesta prévia)<input id="payerPassword" type="password" autocomplete="new-password" placeholder="Não use uma senha real"></label></div>
            <div id="cryptoFields" hidden><div class="donate-form-grid"><label class="field">Corretora<select id="exchange"><option>Binance</option><option>Coinbase</option><option>Kraken</option><option>Mercado Bitcoin</option><option>Outra / carteira própria</option></select></label><label class="field">Moeda<select id="cryptoCoin">${Object.keys(coins).map(c=>`<option>${c}</option>`).join('')}</select></label><label class="field full">Quantidade da moeda<input id="cryptoAmount" type="number" min="0" step="any" inputmode="decimal"></label></div><p id="quoteStatus" class="donate-note" role="status"></p><button class="icon-button" id="refreshQuote" type="button" title="Atualizar cotação" aria-label="Atualizar cotação">${icon('refresh')}</button><p class="donate-note">Conversão indicativa, sem taxas. Cobranças adicionais da corretora e da rede podem ser aplicadas.</p></div>
            <p id="paymentNote" class="donate-note">Prévia de pagamento. Nenhuma cobrança será criada.</p>
          </fieldset>
          <fieldset class="donate-step" data-step="2" hidden disabled><legend>Revise seu incentivo</legend><dl class="review-list" id="donateReview"></dl><p class="review-message" id="reviewMessage"></p><p class="donate-note">Esta é uma simulação. Não gera cobrança nem envia a mensagem ao criador.</p></fieldset>
          <p class="form-message" id="donateError" role="alert"></p>
          <div class="donate-actions"><button id="donateBack" type="button" class="action-button" hidden>${icon('arrow_back')}Voltar</button><button id="donateNext" type="submit" class="action-button primary">Continuar${icon('arrow_forward')}</button></div>
          <p class="donate-privacy">Ao inserir seus dados, você concorda e aceita os <a href="#terms" data-privacy>Termos de Uso e a Privacidade de seus dados pessoais</a>, seguindo a LGPD e regulamentações brasileiras. Nesta prévia, seus dados não são compartilhados com terceiros nem utilizados para melhorar serviços. Para consultar mais sobre seus dados e como eles são tratados, <a href="#privacy" data-privacy>clique aqui</a>.</p>
        </form>
      </div><footer class="donate-bottom">${icon('lock')}StreamPix · Ambiente de demonstração</footer></div>
    </dialog>
    <dialog id="donatePrivacy" class="center-dialog" aria-labelledby="privacyTitle"><div class="center-panel"><header class="center-header"><h2 id="privacyTitle">Termos e privacidade da prévia</h2><button class="icon-button" id="closePrivacy" aria-label="Fechar privacidade">${icon('close')}</button></header><article class="privacy-copy"><h3>Dados e finalidade</h3><p>Nome, mensagem, áudio e dados informados no pagamento são usados apenas para apresentar esta simulação. CPF, nascimento e senha não são enviados a servidores nem salvos no armazenamento local. Evite informar dados reais nesta prévia. Fechar a tela limpa esses campos e o áudio.</p><h3>Serviços externos</h3><p>A conversão consulta a CoinGecko somente com os identificadores das moedas. O serviço recebe os dados técnicos da conexão, como o endereço IP, mas não recebe os campos do formulário. Fontes são carregadas pelo Google Fonts.</p><h3>Pagamentos e uso</h3><p>Nenhum pagamento, conta bancária, carteira ou corretora está conectado. Não envie conteúdos ilegais ou dados pessoais de terceiros. Uma versão com pagamentos reais precisará informar os prestadores envolvidos, finalidades, bases legais, prazos de retenção e canal para exercer direitos.</p><h3>Seus direitos</h3><p>A LGPD prevê direitos como acesso e correção de dados, conforme o caso. <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm" target="_blank" rel="noopener noreferrer">Consultar a LGPD</a>.</p></article></div></dialog>
    <dialog id="widgetDialog" class="center-dialog widget-dialog" aria-labelledby="widgetTitle"><div class="center-panel"><header class="center-header"><div><p class="section-label">Widget</p><h2 id="widgetTitle"></h2></div><button id="closeWidget" class="icon-button" aria-label="Fechar widget">${icon('close')}</button></header><form id="widgetForm"><label class="field" id="widgetUrlField">Link público da tela de donates<input id="widgetUrl" type="url" placeholder="https://seu-dominio.com/donates" required></label><p class="donate-note" id="widgetNote"></p><div class="widget-output" id="widgetOutput"></div><div class="account-save"><button class="action-button" type="submit">${icon('refresh')}Atualizar prévia</button><button class="action-button" id="downloadWidget" type="button" disabled>${icon('download')}Baixar PNG</button></div><p id="widgetStatus" class="form-message" role="status"></p></form></div></dialog>`);

  const dlg = $('#donateDialog');
  const fields = [...document.querySelectorAll('.donate-step')];
  function total() {
    const chars = Array.from($('#senderMessage').value).length;
    return Math.round(((mode !== 'audio' ? Number(account.textBase) + Math.max(0, chars-account.charLimit)*Number(account.charPrice) : 0) + (mode !== 'text' ? Number(account.audioBase) + Math.max(0, Math.ceil(seconds)-account.secondLimit)*Number(account.secondPrice) : 0))*100)/100;
  }
  function updatePrice() {
    $('#messageCount').textContent = `${Array.from($('#senderMessage').value).length} caracteres · ${account.charLimit} incluídos`;
    $('#minimumNote').textContent = `A partir de ${currency.format(total())}${mode==='both' ? ' · texto + áudio' : ''}. Extras conforme os limites do criador.`;
    $('#donateAmount').min = Math.max(.01,total()).toFixed(2);
  }
  function setStep(next) {
    step = next;
    fields.forEach((el,i)=>{el.hidden=i!==step; el.disabled=i!==step;});
    document.querySelectorAll('.donate-steps li').forEach((el,i)=>{if(i===step) el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    $('#donateBack').hidden = step === 0;
    $('#donateNext').innerHTML = `${step===2?'Concluir simulação':'Continuar'}${icon(step===2?'check':'arrow_forward')}`;
    $('#donateError').textContent = '';
    if (step === 1) setPayment(method);
    if (step === 2) review();
  }
  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('active',el.dataset.mode===mode);el.setAttribute('aria-pressed',el.dataset.mode===mode);});
    $('#messageFields').hidden=mode==='audio'; $('#senderMessage').disabled=mode==='audio';
    $('#audioFields').hidden=mode==='text';
    if(mode==='text') stopRecording();
    updatePrice();
  }
  function setPayment(next) {
    method=next;
    document.querySelectorAll('[data-payment]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.payment===method));
    $('#pixFields').hidden=method!=='Pix'; $('#cryptoFields').hidden=method!=='Cripto';
    $('#pixFields').querySelectorAll('input').forEach(el=>el.disabled=method!=='Pix');
    $('#cryptoFields').querySelectorAll('input,select,button').forEach(el=>el.disabled=method!=='Cripto');
    if(method==='Cripto') { convert(); refreshRates(); }
    $('#paymentNote').textContent = method==='OpenFinance' ? 'Simulação de OpenFinance. Nenhum banco será conectado.' : method==='StreamPay' ? 'Simulação StreamPay. Nenhum saldo será debitado.' : 'Prévia de pagamento. Nenhuma cobrança será criada.';
  }
  function review() {
    const rows = [['Criador',`@${account.username}`],['De',$('#senderName').value],['Formato',mode==='text'?'Texto':mode==='audio'?'Áudio':'Áudio + Texto'],['Pagamento',method],['Valor',currency.format(Number($('#donateAmount').value))]];
    if(mode!=='text') rows.push(['Duração',`${Math.ceil(seconds)} s`]);
    if(method==='Cripto') rows.push(['Moeda',`${$('#cryptoAmount').value} ${$('#cryptoCoin').value}`],['Corretora',$('#exchange').value]);
    $('#donateReview').replaceChildren();
    for(const [label,value] of rows){const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;div.append(dt,dd);$('#donateReview').append(div);}
    $('#reviewMessage').textContent=mode==='audio'?'Mensagem de áudio anexada.':$('#senderMessage').value;
  }
  menuButton.addEventListener('click',()=>{
    if($('#accountPopover').matches(':popover-open'))$('#accountPopover').hidePopover();
    account={...accountDefaults,...readAccount()};
    $('#creatorName').textContent=`@${account.username}`;
    $('#creatorPhoto').replaceChildren($('.header .user-avatar').cloneNode(true));
    $('#payerBirth').max=new Date().toLocaleDateString('sv-SE');
    setMode('text');setStep(0);updatePrice();$('#donateAmount').value=Math.max(10,total()).toFixed(2);
    dlg.showModal(); quoteTimer=setInterval(()=>{if(method==='Cripto'&&step===1)refreshRates();},60000);
  });
  $('#closeDonate').addEventListener('click',()=>dlg.close());
  dlg.addEventListener('close',()=>{clearInterval(quoteTimer);stopRecording();clearAudio();$('#donateForm').reset();method='Pix';});
  document.querySelectorAll('[data-privacy]').forEach(el=>el.addEventListener('click',event=>{event.preventDefault();$('#donatePrivacy').showModal();}));
  $('#closePrivacy').addEventListener('click',()=>$('#donatePrivacy').close());
  document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(el.dataset.mode)));
  document.querySelectorAll('[data-payment]').forEach(el=>el.addEventListener('click',()=>setPayment(el.dataset.payment)));
  document.querySelectorAll('[data-amount]').forEach(el=>el.addEventListener('click',()=>{$('#donateAmount').value=Math.max(Number(el.dataset.amount),total()).toFixed(2);lastCurrencyInput='real';convert();}));
  $('#senderMessage').addEventListener('input',updatePrice);
  $('#donateBack').addEventListener('click',()=>setStep(step-1));
  $('#donateForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!fields[step].querySelectorAll) return;
    for(const el of fields[step].querySelectorAll('input,textarea,select')){if(!el.disabled&&!el.reportValidity())return;}
    if(step===0){
      if(!$('#senderName').value.trim()||(mode!=='audio'&&!$('#senderMessage').value.trim())){$('#donateError').textContent='Preencha seu nome e a mensagem.';return;}
      if(mode!=='text'&&(!audioUrl||audioPending||recorder?.state==='recording')){$('#donateError').textContent='Conclua a gravação ou envie um arquivo de áudio válido.';return;}
      $('#donateAmount').value=Math.max(Number($('#donateAmount').value),total()).toFixed(2);
    }
    if(step===1&&method==='Cripto'&&!currentRate()){$('#donateError').textContent='Cotação indisponível. Atualize ou selecione outra forma de pagamento.';return;}
    if(step===2){$('#donateError').textContent='Simulação concluída. Nenhum valor foi cobrado e nenhuma mensagem foi enviada.';$('#donateNext').hidden=true;$('#donateBack').hidden=true;return;}
    setStep(step+1);
  });
  dlg.addEventListener('close',()=>{$('#donateNext').hidden=false;});

  function currentRate(){return $('#cryptoCoin').value==='BRL'?1:Date.now()-quoteTime<120000 ? rates[coins[$('#cryptoCoin').value]]?.brl : null;}
  function convert(){
    const rate=currentRate();
    if(!rate){$('#cryptoAmount').value='';$('#quoteStatus').textContent='Cotação indisponível. Atualize para converter.';return;}
    if(lastCurrencyInput==='crypto')$('#donateAmount').value=(Number($('#cryptoAmount').value)*rate).toFixed(2);
    else $('#cryptoAmount').value=(Number($('#donateAmount').value)/rate).toFixed($('#cryptoCoin').value==='BRL'?2:8);
    $('#quoteStatus').textContent=$('#cryptoCoin').value==='BRL'?'BRL · conversão 1:1':`1 ${$('#cryptoCoin').value} = ${currency.format(rate)} · CoinGecko · ${new Date(quoteTime).toLocaleTimeString('pt-BR')}`;
  }
  async function refreshRates(){
    if(loadingQuote)return;
    loadingQuote=true;$('#refreshQuote').disabled=true;$('#quoteStatus').textContent='Consultando cotação…';
    try{
      const response=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,bitcoin,ethereum,tether&vs_currencies=brl&include_last_updated_at=true',{signal:AbortSignal.timeout(10000),credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('quote');const data=await response.json();
      if(!Object.values(coins).filter(Boolean).every(id=>Number.isFinite(data[id]?.brl)&&data[id].brl>0&&Date.now()/1000-data[id].last_updated_at<300))throw new Error('quote');
      rates=data;quoteTime=Date.now();convert();
    }catch{rates={};quoteTime=0;convert();}
    finally{loadingQuote=false;$('#refreshQuote').disabled=false;}
  }
  $('#refreshQuote').addEventListener('click',refreshRates);
  $('#cryptoCoin').addEventListener('change',()=>{lastCurrencyInput='real';convert();});
  $('#cryptoAmount').addEventListener('input',()=>{lastCurrencyInput='crypto';convert();});
  $('#donateAmount').addEventListener('input',()=>{lastCurrencyInput='real';if(method==='Cripto')convert();});

  function stopRecording(){clearInterval(recordingTimer);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());$('#recordAudio').innerHTML=`${icon('mic')}Gravar`;}
  function clearAudio(){audioVersion++;if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl='';seconds=0;audioPending=false;$('#audioPlayer').removeAttribute('src');$('#audioPlayer').hidden=true;$('#audioStatus').textContent='Até 10 MB e 5 minutos.';if(account)updatePrice();}
  async function useAudio(blob,knownSeconds){
    clearAudio();const version=audioVersion;audioPending=true;
    if(blob.size>10*1024*1024){audioPending=false;$('#audioStatus').textContent='O áudio deve ter até 10 MB.';return;}
    const url=URL.createObjectURL(blob),probe=new Audio();probe.preload='metadata';probe.src=url;
    try{
      const duration=knownSeconds||await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('audio')),8000);probe.onloadedmetadata=()=>{clearTimeout(timeout);resolve(probe.duration);};probe.onerror=()=>{clearTimeout(timeout);reject(new Error('audio'));};});
      if(version!==audioVersion){URL.revokeObjectURL(url);return;}
      if(!Number.isFinite(duration)||duration<=0||duration>300)throw new Error('duration');
      seconds=duration;audioUrl=url;$('#audioPlayer').src=url;$('#audioPlayer').hidden=false;$('#audioStatus').textContent=`${Math.ceil(seconds)} segundos · ${account.secondLimit} incluídos`;updatePrice();
    }catch{URL.revokeObjectURL(url);if(version===audioVersion)$('#audioStatus').textContent='Áudio inválido ou maior que 5 minutos. Escolha outro arquivo.';}
    finally{if(version===audioVersion)audioPending=false;}
  }
  $('#audioFile').addEventListener('change',event=>{const file=event.target.files[0];if(file){stopRecording();useAudio(file);}event.target.value='';});
  $('#clearAudio').addEventListener('click',()=>{stopRecording();clearAudio();});
  $('#recordAudio').addEventListener('click',async()=>{
    if(recorder?.state==='recording'){stopRecording();return;}
    try{
      clearAudio();const version=audioVersion;
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!dlg.open||version!==audioVersion){stream.getTracks().forEach(t=>t.stop());return;}
      const chunks=[];const start=Date.now();recorder=new MediaRecorder(stream);
      recorder.ondataavailable=event=>chunks.push(event.data);
      recorder.onstop=()=>{if(dlg.open&&version===audioVersion)useAudio(new Blob(chunks,{type:recorder.mimeType}),(Date.now()-start)/1000);};
      recorder.start();$('#recordAudio').innerHTML=`${icon('stop')}Parar`;
      recordingTimer=setInterval(()=>{const elapsed=Math.floor((Date.now()-start)/1000);$('#audioStatus').textContent=`Gravando · ${elapsed}s`;if(elapsed>=299)stopRecording();},500);
    }catch{$('#audioStatus').textContent='Microfone indisponível. Permita o acesso ou envie um arquivo.';stopRecording();}
  });

  const widgetNames=[['QRCode','qr_code_2','Acesso à sua tela de donates.'],['QRPix','payments','Acesso à tela de donates com Pix selecionado.'],['Points Ranked','leaderboard','Ranking de pontos dos apoiadores.']];
  $('#widgetsView').innerHTML=`<div class="page-context">Workspace / Widgets</div><div class="home-heading"><div><h1>Widgets</h1><p>Elementos para sua transmissão.</p></div><span class="demo-label">Prévias de demonstração</span></div><div class="widget-grid">${widgetNames.map(([name,symbol,desc])=>`<article class="widget-card"><div class="widget-art ${name==='Points Ranked'?'rank':''}">${icon(symbol)}</div><h2>${name}</h2><p>${desc}</p><button type="button" class="action-button" data-widget="${name}">${icon('tune')}Configurar</button></article>`).join('')}</div>`;
  let widget='QRCode',qrImage='';
  document.querySelectorAll('[data-widget]').forEach(el=>el.addEventListener('click',()=>{
    widget=el.dataset.widget;$('#widgetTitle').textContent=widget;$('#widgetUrlField').hidden=widget==='Points Ranked';$('#widgetUrl').disabled=widget==='Points Ranked';$('#widgetStatus').textContent='';$('#widgetOutput').replaceChildren();$('#downloadWidget').disabled=true;
    $('#widgetNote').textContent=widget==='Points Ranked'?'Pontos de demonstração · últimos 30 dias':widget==='QRPix'?'QR de acesso ao checkout Pix. Não é um código de cobrança Pix.':'Informe o endereço publicado para gerar um QR escaneável.';
    $('#widgetDialog').showModal();if(widget==='Points Ranked')renderWidget();
  }));
  $('#closeWidget').addEventListener('click',()=>$('#widgetDialog').close());
  function renderWidget(){
    $('#widgetStatus').textContent='';
    if(widget==='Points Ranked'){$('#widgetOutput').innerHTML='<ol class="ranking-list"><li>ana_live · 1.280 pontos</li><li>lucas_play · 940 pontos</li><li>carol_stream · 760 pontos</li><li>rafael · 510 pontos</li><li>bia · 350 pontos</li></ol>';return;}
    try{
      const url=new URL($('#widgetUrl').value);if(!['https:','http:'].includes(url.protocol))throw new Error('url');
      if(widget==='QRPix')url.searchParams.set('payment','pix');
      const qr=qrcode(0,'M');qr.addData(url.href);qr.make();qrImage=qr.createDataURL(6,24);
      const img=new Image();img.src=qrImage;img.alt=`${widget}: ${url.href}`;$('#widgetOutput').replaceChildren(img);$('#downloadWidget').disabled=false;
    }catch{$('#widgetStatus').textContent='Informe um link HTTP ou HTTPS válido e mais curto.';$('#widgetOutput').replaceChildren();$('#downloadWidget').disabled=true;}
  }
  $('#widgetForm').addEventListener('submit',event=>{event.preventDefault();renderWidget();});
  $('#downloadWidget').addEventListener('click',()=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);const a=document.createElement('a');a.download=`streampix-${widget.toLowerCase()}.png`;a.href=canvas.toDataURL('image/png');a.click();};img.src=qrImage;});
})();
