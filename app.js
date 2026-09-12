(() => {
  const $ = (selector) => document.querySelector(selector);
  const sidebar = $(".sidebar");
  const toggle = $(".sidebar-toggle");
  const mobile = window.matchMedia("(max-width: 760px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modal = $("#detailModal");
  const accountPopover = $("#accountPopover");
  const number = new Intl.NumberFormat("pt-BR");
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
  const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  function setSidebar(collapsed) {
    sidebar.classList.toggle("collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Abrir menu" : "Fechar menu");
    toggle.title = collapsed ? "Abrir menu" : "Fechar menu";
    toggle.querySelector("span").textContent = collapsed ? "chevron_right" : "chevron_left";
  }
  setSidebar(mobile.matches);
  mobile.addEventListener("change", (event) => setSidebar(event.matches));
  toggle.addEventListener("click", () => setSidebar(!sidebar.classList.contains("collapsed")));

  // Demonstration fixtures, shared by the cards, chart, details and CSV export.
  const metrics = {
    balance: { title: "Saldo", color: "#54c9c1", values: [4070, 4120, 4095, 4210, 4255, 4180, 4260, 4380, 4330, 4290, 4440, 4485, 4410, 4550, 4620, 4580, 4510, 4630, 4585, 4690, 4620, 4775, 4680, 4740, 4810, 4720, 4845, 4790, 4780, 4820] },
    received: { title: "Incentivos recebidos", color: "#8ebacb", values: [104, 104, 106, 107, 107, 109, 110, 110, 111, 114, 114, 114, 115, 116, 116, 118, 118, 119, 120, 120, 121, 122, 122, 122, 124, 125, 125, 126, 127, 128] },
    queue: { title: "Incentivos na fila", color: "#c2a171", values: [12, 15, 13, 10, 11, 15, 16, 12, 8, 13, 17, 15, 19, 16, 15, 11, 14, 13, 19, 21, 17, 15, 13, 14, 18, 20, 16, 14, 18, 17] },
    messages: { title: "Mensagens", color: "#a5adc8", values: [30, 30, 30, 30, 30, 31, 31, 31, 31, 31, 31, 31, 32, 32, 32, 32, 32, 32, 32, 32, 33, 33, 33, 33, 33, 33, 33, 33, 34, 34] }
  };
  const endDate = new Date();
  endDate.setHours(12, 0, 0, 0);
  const dates = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(date.getDate() - 364 + index);
    return date;
  });
  Object.entries(metrics).forEach(([key, metric]) => {
    const beginning = metric.values[0];
    const history = Array.from({ length: 335 }, (_, index) => {
      const progress = index / 335;
      if (key === "queue") return Math.round(11 + Math.sin(index * 0.63) * 5 + Math.cos(index * 0.21) * 3);
      const trend = beginning * (0.18 + progress * 0.82);
      return Math.max(0, Math.round(trend + (key === "balance" ? Math.sin(index * 0.43) * 95 : 0)));
    });
    metric.history = [...history, ...metric.values];
  });
  const format = (key, value) => key === "balance" ? money.format(value) : number.format(value);
  const series = (key, days) => metrics[key].history.slice(-days);
  const percentage = (values) => {
    const first = values[0];
    if (!first) return "\u2014";
    const difference = (values.at(-1) - first) / first * 100;
    return `${difference >= 0 ? "+" : ""}${difference.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  };
  const range = (days) => {
    const start = dates.at(-days);
    const startYear = start.getFullYear() === endDate.getFullYear() ? "" : ` de ${start.getFullYear()}`;
    return `${shortDate.format(start)}${startYear} a ${shortDate.format(endDate)} de ${endDate.getFullYear()}`;
  };
  const periodName = (days) => days === 365 ? "\u00daltimo ano" : `\u00daltimos ${days} dias`;
  function activate(group, current) {
    group.querySelectorAll("button").forEach((button) => {
      const active = button === current;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  document.querySelectorAll("[data-change]").forEach((element) => {
    element.textContent = percentage(metrics[element.dataset.change].values);
  });

  let mainDays = 30;
  let detailDays = 30;
  let detailKey = "balance";
  let detailType = "line";
  let mainChart;
  let detailChart;
  let lastTrigger;

  function chartConfig(key, days, type = "area") {
    const metric = metrics[key];
    const selectedDates = dates.slice(-days);
    return {
      type: type === "bar" ? "bar" : "line",
      data: {
        labels: selectedDates.map((date) => shortDate.formatToParts(date).filter((part) => part.type === "day" || part.type === "month").map((part) => part.value).join(" ")),
        datasets: [{
          label: metric.title,
          data: series(key, days),
          borderColor: metric.color,
          backgroundColor(context) {
            const { ctx, chartArea } = context.chart;
            if (type === "bar") return `${metric.color}a0`;
            if (!chartArea) return "transparent";
            const fill = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            fill.addColorStop(0, `${metric.color}1c`);
            fill.addColorStop(1, `${metric.color}00`);
            return fill;
          },
          borderWidth: type === "bar" ? 0 : 2,
          borderRadius: type === "bar" ? 2 : 0,
          maxBarThickness: 22,
          fill: type === "area",
          tension: 0.18,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: metric.color,
          pointHoverBorderColor: "#17191a",
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onResize(chart, size) {
          chart.options.scales.x.ticks.maxTicksLimit = size.width < 480 ? 3 : 6;
        },
        animation: reducedMotion.matches ? false : { duration: 250 },
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 10, right: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#262b2e", titleColor: "#d5dade", bodyColor: "#f4f6f6",
            borderColor: "#42494d", borderWidth: 1, padding: 12, cornerRadius: 5,
            titleFont: { weight: "400", size: 11 }, bodyFont: { weight: "400", size: 13 },
            displayColors: false,
            callbacks: {
              title: (items) => fullDate.format(selectedDates[items[0].dataIndex]),
              label: (context) => `${metric.title}: ${format(key, context.parsed.y)}`
            }
          }
        },
        scales: {
          x: { border: { display: false }, grid: { display: false }, ticks: { color: "#899197", maxTicksLimit: 6, maxRotation: 0, padding: 12, font: { size: 10 } } },
          y: {
            beginAtZero: type === "bar", grace: "12%", border: { display: false },
            grid: { color: "#ffffff09", drawTicks: false },
            ticks: {
              color: "#899197", maxTicksLimit: 5, padding: 14, precision: 0, font: { size: 10 },
              callback: (value) => key === "balance" ? `R$ ${number.format(value)}` : number.format(value)
            }
          }
        }
      }
    };
  }

  function updateMain() {
    const values = series("balance", mainDays);
    $("#balancePeriod").textContent = periodName(mainDays);
    $("#balanceRange").textContent = range(mainDays);
    $("#balanceStart").textContent = money.format(values[0]);
    const change = values.at(-1) - values[0];
    $("#balanceChange").textContent = `${change >= 0 ? "+" : ""}${money.format(change)}`;
    $("#balanceChange").className = change >= 0 ? "positive" : "negative";
    $("#balanceMax").textContent = money.format(Math.max(...values));
    $("#balanceChart").setAttribute("aria-label", `Saldo: ${periodName(mainDays)}. De ${money.format(values[0])} a ${money.format(values.at(-1))}. Dados de demonstra\u00e7\u00e3o.`);
    mainChart?.destroy();
    if (window.Chart) mainChart = new Chart($("#balanceChart"), chartConfig("balance", mainDays));
  }

  function updateDetail() {
    const values = series(detailKey, detailDays);
    $("#modalTitle").textContent = metrics[detailKey].title;
    $("#modalValue").textContent = format(detailKey, values.at(-1));
    $("#modalGrowth").textContent = percentage(values);
    $("#modalGrowth").className = values.at(-1) >= values[0] ? "positive" : "negative";
    $("#modalRange").textContent = range(detailDays);
    $("#detailStart").textContent = format(detailKey, values[0]);
    $("#detailMin").textContent = format(detailKey, Math.min(...values));
    $("#detailMax").textContent = format(detailKey, Math.max(...values));
    $("#detailChart").setAttribute("aria-label", `${metrics[detailKey].title}: ${periodName(detailDays)}. De ${format(detailKey, values[0])} a ${format(detailKey, values.at(-1))}. Dados de demonstra\u00e7\u00e3o.`);
    detailChart?.destroy();
    if (window.Chart) detailChart = new Chart($("#detailChart"), chartConfig(detailKey, detailDays, detailType));
  }

  document.querySelectorAll("[data-period-controls]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-days]");
      if (!button) return;
      activate(group, button);
      if (group.dataset.periodControls === "main") {
        mainDays = Number(button.dataset.days);
        updateMain();
      } else {
        detailDays = Number(button.dataset.days);
        updateDetail();
      }
    });
  });
  $("[data-type-controls]").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-type]");
    if (!button) return;
    activate(button.parentElement, button);
    detailType = button.dataset.type;
    updateDetail();
  });

  document.querySelectorAll(".card-expand").forEach((button) => {
    button.addEventListener("click", () => {
      lastTrigger = button;
      detailKey = button.dataset.metric;
      detailDays = button.closest(".chart-card") ? mainDays : 30;
      detailType = "line";
      const periods = $('[data-period-controls="detail"]');
      activate(periods, periods.querySelector(`[data-days="${detailDays}"]`));
      activate($("[data-type-controls]"), $('[data-type="line"]'));
      modal.showModal();
      document.body.classList.add("modal-open");
      updateDetail();
      $(".modal-close").focus();
    });
  });
  $(".modal-close").addEventListener("click", () => modal.close());
  modal.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    detailChart?.destroy();
    detailChart = null;
    lastTrigger?.focus();
  });

  const docs = [
    ["legal", "Aceite de termos"], ["usage", "Acessibilidade"], ["regulatory", "Auditoria"], ["usage", "Autenticação"], ["usage", "Backup de dados"],
    ["usage", "Bloqueio de widgets"], ["regulatory", "Boas práticas Pix"], ["legal", "Cancelamento de conta"], ["usage", "Canais conectados"], ["legal", "Compartilhamento de dados"],
    ["regulatory", "Comprovantes"], ["usage", "Configuração inicial"], ["usage", "Controle de acesso"], ["regulatory", "Conciliação financeira"], ["usage", "Dashboard"],
    ["legal", "Dados pessoais"], ["legal", "Direitos do criador"], ["legal", "Direitos do usuário"], ["usage", "Doações recorrentes"], ["usage", "Download de relatórios"],
    ["legal", "Encerramento de serviço"], ["usage", "Equipe e permissões"], ["regulatory", "Estorno operacional"], ["usage", "Eventos ao vivo"], ["usage", "Exportação CSV"],
    ["legal", "Fraude e abuso"], ["usage", "Gatilhos de alerta"], ["usage", "Gráficos"], ["usage", "Histórico de incentivos"], ["legal", "Identidade visual"],
    ["usage", "Importação de dados"], ["regulatory", "Incidentes"], ["usage", "Integração OBS"], ["usage", "Integrações externas"], ["legal", "Isenção de garantia"],
    ["legal", "Jurisdição"], ["legal", "LGPD"], ["usage", "Limites operacionais"], ["usage", "Logs"], ["legal", "Marca StreamPix"],
    ["usage", "Mensagens"], ["regulatory", "Mecanismo de devolução"], ["usage", "Metas de campanha"], ["usage", "Mobile"], ["usage", "Modo discreto"],
    ["legal", "Moderação"], ["regulatory", "Monitoramento"], ["usage", "Notificações"], ["regulatory", "Operações suspeitas"], ["usage", "Organização da sidebar"],
    ["legal", "Pagamento a criadores"], ["regulatory", "Pix"], ["regulatory", "Prazos de análise"], ["legal", "Privacidade"], ["usage", "Perfil"],
    ["usage", "Personalização"], ["regulatory", "Prevenção a golpes"], ["usage", "QR Code"], ["regulatory", "Registro de transações"], ["usage", "Relatórios"],
    ["usage", "Responsividade"], ["legal", "Responsabilidade do criador"], ["legal", "Retenção de dados"], ["regulatory", "Risco operacional"], ["usage", "Saldo"],
    ["usage", "Segurança da conta"], ["regulatory", "Segurança Pix"], ["usage", "Sessões"], ["legal", "Solicitação de dados"], ["usage", "Suporte"],
    ["usage", "Tags e filtros"], ["legal", "Termos de uso"], ["usage", "Tema escuro"], ["usage", "Testes de widget"], ["usage", "Timeline"],
    ["regulatory", "Transparência"], ["usage", "Usuário"], ["usage", "Validação de conta"], ["usage", "Verificação de identidade"], ["usage", "Widgets"],
    ["usage", "Webhooks"], ["legal", "Alteração de políticas"], ["regulatory", "Análise de chargeback"], ["usage", "Atalhos"], ["legal", "Autorização de imagem"],
    ["regulatory", "Cadastro fiscal"], ["usage", "Central de ajuda"], ["legal", "Comunicações oficiais"], ["usage", "Conta principal"], ["regulatory", "Controles internos"],
    ["legal", "Cookies"], ["usage", "Dados de demonstração"], ["regulatory", "Disponibilidade"], ["legal", "Documentos legais"], ["usage", "Experiência do apoiador"],
    ["regulatory", "Governança"], ["usage", "Indicadores"], ["legal", "Propriedade intelectual"], ["regulatory", "Reclamações"], ["usage", "Status do sistema"]
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([category, title], index) => ({ category, title, number: index + 1 }));
  const docLabels = { legal: "Jurídica", regulatory: "Regulamentar", usage: "Uso" };
  let docCategory = "legal";
  let docQuery = "";
  let selectedDoc = null;

  function docDetail(page) {
    const base = {
      legal: "Esta página descreve responsabilidades, direitos, limites de uso e cuidados contratuais dentro do StreamPix.",
      regulatory: "Esta página resume práticas operacionais relacionadas a pagamentos, Pix, segurança, auditoria e registros.",
      usage: "Esta página explica como operar o StreamPix no dia a dia, com foco em clareza, controle e produtividade."
    }[page.category];
    const source = page.category === "regulatory" ? "Referência: materiais públicos do Banco Central sobre Pix e arranjos de pagamento." : page.category === "legal" ? "Referência: LGPD e legislação brasileira publicada em canais oficiais do Governo Federal/Planalto." : "Referência: guia interno de produto StreamPix.";
    return {
      intro: `${base} O tópico "${page.title}" deve ser tratado como documentação operacional para orientar decisões e reduzir ambiguidade.`,
      items: [
        `Defina o objetivo do tópico antes de aplicar qualquer configuração ou procedimento.`,
        `Registre alterações importantes, responsáveis, datas e impacto esperado para consulta futura.`,
        `Revise permissões, dados envolvidos e efeitos na experiência do criador e dos apoiadores.`,
        `Quando houver pagamento, dado pessoal ou risco de fraude, valide a rotina com suporte qualificado.`
      ],
      events: [
        `Mudança de configuração, campanha, widget ou integração relacionada a "${page.title}".`,
        `Divergência entre saldo, relatório, comprovante, mensagem ou histórico exibido na interface.`,
        `Solicitação de apoiador, criador, suporte, auditoria ou autoridade sobre registros do tópico.`,
        `Incidente de segurança, indisponibilidade, suspeita de abuso ou necessidade de bloqueio preventivo.`
      ],
      routine: `Rotina recomendada: revisar "${page.title}" durante implantação, depois em ciclos mensais ou sempre que houver mudança de campanha, conta, integração, widget ou regra operacional.`,
      source
    };
  }

  function renderDocs(preferredTitle) {
    const filtered = docs.filter((page) => page.category === docCategory && page.title.toLocaleLowerCase("pt-BR").includes(docQuery.toLocaleLowerCase("pt-BR")));
    selectedDoc = filtered.find((page) => page.title === preferredTitle) || filtered[0] || null;
    $("#docsCounter").textContent = `${filtered.length} de ${docs.length} páginas`;
    $("[data-doc-index]").innerHTML = filtered.map((page) => `<button class="doc-page-button${page === selectedDoc ? " active" : ""}" type="button" data-title="${page.title}">${String(page.number).padStart(2, "0")} · ${page.title}</button>`).join("") || `<span class="date-range">Nenhuma página encontrada.</span>`;
    if (!selectedDoc) {
      $("[data-doc-panel]").innerHTML = `<h3>Sem resultado</h3><p>Ajuste a busca ou escolha outra categoria.</p>`;
      return;
    }
    const detail = docDetail(selectedDoc);
    $("[data-doc-panel]").innerHTML = `<h3>${selectedDoc.title}</h3><p>${detail.intro}</p><h4>Pontos de atenção</h4><ul>${detail.items.map((item) => `<li>${item}</li>`).join("")}</ul><h4>Acontecimentos possíveis</h4><ul>${detail.events.map((item) => `<li>${item}</li>`).join("")}</ul><h4>Rotina</h4><p>${detail.routine}</p><span class="docs-source">${detail.source}</span>`;
  }

  document.querySelectorAll("[data-popup]").forEach((button) => {
    button.addEventListener("click", () => {
      if (accountPopover?.matches(":popover-open")) accountPopover.hidePopover();
      const dialog = $(`#${button.dataset.popup}`);
      dialog?.showModal();
      dialog?.querySelector(".dialog-close")?.focus();
      if (button.dataset.popup === "docsDialog") renderDocs(selectedDoc?.title);
    });
  });
  document.querySelectorAll(".center-dialog").forEach((dialog) => {
    dialog.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
  });
  $(".docs-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-doc]");
    if (!button) return;
    button.parentElement.querySelectorAll("[data-doc]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    docCategory = button.dataset.doc;
    renderDocs();
  });
  $("[data-doc-index]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-title]");
    if (!button) return;
    renderDocs(button.dataset.title);
  });
  $("#docsSearch")?.addEventListener("input", (event) => {
    docQuery = event.target.value.trim();
    renderDocs();
  });

  $("#exportChart").addEventListener("click", () => {
    const values = series("balance", mainDays);
    const rows = [["Data", "Saldo (BRL)", "Origem"], ...dates.slice(-mainDays).map((date, index) => [
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      values[index].toFixed(2).replace(".", ","), "Demonstracao"
    ])];
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((row) => row.join(";")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `streampix-saldo-${mainDays}dias.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  if (window.Chart) {
    Chart.defaults.font.family = '"Inter", "Segoe UI", sans-serif';
    Chart.defaults.font.weight = "400";
  }
  updateMain();
  document.fonts.ready.then(() => {
    mainChart?.update("none");
    detailChart?.update("none");
  });
})();
