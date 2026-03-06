function abrir(pagina) {
  if (pagina === "vendas") carregarVendas();
  if (pagina === "relatorio") carregarRelatorio();
  if (pagina === "barbeiros") carregarRelatorioBarbeiros();
  if (pagina === "admin") carregarAdmin();
}

function formatarData(data) {
  return new Date(data).toLocaleString("pt-BR");
}

function abrirCalendario(id) {
  const campo = document.getElementById(id);
  if (!campo) return;

  try {
    campo.focus();
    if (typeof campo.showPicker === "function") {
      campo.showPicker();
    } else {
      campo.click();
    }
  } catch (e) {
    campo.click();
  }
}

/* =========================
   VENDAS
========================= */

async function carregarVendas() {
  const resBarbers = await fetch("/barbers");
  const barbers = await resBarbers.json();

  const resServices = await fetch("/services");
  const services = await resServices.json();

  const resProducts = await fetch("/products");
  const products = await resProducts.json();

  let html = `
    <div class="card">
      <h2>Registrar Venda</h2>

      <label>Barbeiro</label>
      <select id="barber">
  `;

  barbers.forEach((b) => {
    html += `<option value="${b._id}">${b.nome}</option>`;
  });

  html += `
      </select>

      <label>Serviço</label>
      <select id="service">
  `;

  services.forEach((s) => {
    html += `<option value="${s._id}">${s.nome} - R$ ${s.preco}</option>`;
  });

  html += `
      </select>

      <label>Produto (opcional)</label>
      <select id="product">
        <option value="">Nenhum</option>
  `;

  products.forEach((p) => {
    html += `<option value="${p._id}">${p.nome} - R$ ${p.preco}</option>`;
  });

  html += `
      </select>

      <label>Forma de pagamento</label>
      <select id="pagamento">
        <option value="PIX">PIX</option>
        <option value="DINHEIRO">DINHEIRO</option>
        <option value="CARTAO">CARTÃO</option>
      </select>

      <button onclick="salvarVenda()">Salvar Venda</button>
    </div>
  `;

  document.getElementById("conteudo").innerHTML = html;
}

async function salvarVenda() {
  const barber = document.getElementById("barber").value;
  const service = document.getElementById("service").value;
  const product = document.getElementById("product").value;
  const paymentMethod = document.getElementById("pagamento").value;

  const body = {
    barber,
    service,
    paymentMethod,
  };

  if (product) {
    body.product = product;
  }

  const res = await fetch("/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    alert(data.error || "Erro ao registrar venda");
    return;
  }

  alert("Venda registrada com sucesso");
  carregarVendas();
}

/* =========================
   RELATÓRIO DE VENDAS
========================= */

async function carregarRelatorio() {
  const resBarbers = await fetch("/barbers");
  const barbers = await resBarbers.json();

  const hoje = new Date().toISOString().slice(0, 10);

  let html = `
    <div class="card destaque">
      <h2>Relatório de Vendas</h2>

      <label>Data inicial</label>
      <div class="campo-data">
        <input type="date" id="filtroDataInicio" value="${hoje}" onkeydown="return false">
        <button type="button" onclick="abrirCalendario('filtroDataInicio')">📅</button>
      </div>

      <label>Data final</label>
      <div class="campo-data">
        <input type="date" id="filtroDataFim" value="${hoje}" onkeydown="return false">
        <button type="button" onclick="abrirCalendario('filtroDataFim')">📅</button>
      </div>

      <label>Barbeiro</label>
      <select id="filtroBarber">
        <option value="">Todos os barbeiros</option>
  `;

  barbers.forEach((b) => {
    html += `<option value="${b._id}">${b.nome}</option>`;
  });

  html += `
      </select>

      <button onclick="buscarRelatorioVendas()">Buscar Relatório</button>
    </div>

    <div id="resultadoRelatorio"></div>
  `;

  document.getElementById("conteudo").innerHTML = html;

  await buscarRelatorioVendas();
}

async function buscarRelatorioVendas() {
  const startDate = document.getElementById("filtroDataInicio").value;
  const endDate = document.getElementById("filtroDataFim").value;
  const barber = document.getElementById("filtroBarber").value;

  let url = "/relatorio";
  const params = [];

  if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
  if (barber) params.push(`barber=${encodeURIComponent(barber)}`);

  if (params.length > 0) {
    url += "?" + params.join("&");
  }

  const res = await fetch(url);
  const dados = await res.json();

  let html = `
    <div class="card destaque">
      <h2>Resultado do Relatório</h2>
      <p><strong>Total:</strong> R$ ${dados.total || 0}</p>
    </div>
  `;

  if (!dados.vendas || dados.vendas.length === 0) {
    html += `
      <div class="card">
        <p>Nenhuma venda encontrada nesse filtro.</p>
      </div>
    `;
  } else {
    dados.vendas.forEach((v) => {
      html += `
        <div class="card">
          <h3>${v.barbeiro}</h3>
          <p><strong>Serviço:</strong> ${v.servico}</p>
          <p><strong>Produto:</strong> ${v.produto || "Nenhum"}</p>
          <p><strong>Valor:</strong> R$ ${v.valor}</p>
          <p><strong>Pagamento:</strong> ${v.pagamento}</p>
          <p><strong>Data e hora:</strong> ${formatarData(v.data)}</p>
          <button class="btn-excluir" onclick="apagarVenda('${v.id}')">Apagar</button>
        </div>
      `;
    });
  }

  document.getElementById("resultadoRelatorio").innerHTML = html;
}

async function apagarVenda(id) {
  const password = prompt("Digite a senha para apagar esta venda:");

  if (!password) return;

  const res = await fetch(`/sales/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao apagar venda");
    return;
  }

  alert("Venda apagada com sucesso");
  buscarRelatorioVendas();
}

/* =========================
   RELATÓRIO DOS BARBEIROS
========================= */

async function carregarRelatorioBarbeiros() {
  const resBarbers = await fetch("/barbers");
  const barbers = await resBarbers.json();

  const hoje = new Date().toISOString().slice(0, 10);

  let html = `
    <div class="card destaque">
      <h2>Relatório dos Barbeiros</h2>

      <label>Data inicial</label>
      <div class="campo-data">
        <input type="date" id="filtroDataInicioBarbeiros" value="${hoje}" onkeydown="return false">
        <button type="button" onclick="abrirCalendario('filtroDataInicioBarbeiros')">📅</button>
      </div>

      <label>Data final</label>
      <div class="campo-data">
        <input type="date" id="filtroDataFimBarbeiros" value="${hoje}" onkeydown="return false">
        <button type="button" onclick="abrirCalendario('filtroDataFimBarbeiros')">📅</button>
      </div>

      <label>Barbeiro</label>
      <select id="filtroBarbeiroRelatorio">
        <option value="">Todos os barbeiros</option>
  `;

  barbers.forEach((b) => {
    html += `<option value="${b._id}">${b.nome}</option>`;
  });

  html += `
      </select>

      <button onclick="buscarRelatorioBarbeiros()">Buscar Relatório</button>
      <button onclick="gerarPdfRelatorioBarbeiros()">Gerar PDF</button>
    </div>

    <div id="resultadoRelatorioBarbeiros"></div>
  `;

  document.getElementById("conteudo").innerHTML = html;

  await buscarRelatorioBarbeiros();
}
async function buscarRelatorioBarbeiros() {
  const startDate = document.getElementById("filtroDataInicioBarbeiros").value;
  const endDate = document.getElementById("filtroDataFimBarbeiros").value;
  const barber = document.getElementById("filtroBarbeiroRelatorio").value;

  let url = "/relatorio-barbeiros";
  const params = [];

  if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
  if (barber) params.push(`barber=${encodeURIComponent(barber)}`);

  if (params.length > 0) {
    url += "?" + params.join("&");
  }

  const res = await fetch(url);
  const dados = await res.json();

  let html = `
    <div class="card destaque">
      <h2>Resultado do Relatório dos Barbeiros</h2>
    </div>
  `;

  if (!dados || dados.length === 0) {
    html += `
      <div class="card">
        <p>Nenhum registro encontrado.</p>
      </div>
    `;
  } else {
    dados.forEach((b) => {
      html += `
        <div class="card">
          <h3>${b.barbeiro}</h3>
          <p><strong>Serviços:</strong> ${b.servicos}</p>
          <p><strong>Faturamento:</strong> R$ ${b.faturamento}</p>
          <p><strong>Comissão:</strong> R$ ${b.comissao}</p>
          <p><strong>Produtos vendidos:</strong> ${b.produtos}</p>
        </div>
      `;
    });
  }

  document.getElementById("resultadoRelatorioBarbeiros").innerHTML = html;
}

function gerarPdfRelatorioBarbeiros() {
  const conteudo = document.getElementById("resultadoRelatorioBarbeiros").innerHTML;

  if (!conteudo || conteudo.trim() === "") {
    alert("Primeiro gere o relatório antes de exportar para PDF.");
    return;
  }

  const janela = window.open("", "_blank");

  janela.document.write(`
    <html>
      <head>
        <title>Relatório dos Barbeiros</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #000;
            background: #fff;
          }

          h1 {
            text-align: center;
            margin-bottom: 20px;
          }

          .card {
            border: 1px solid #ccc;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 15px;
          }

          .card h3 {
            margin-top: 0;
          }

          button {
            display: none;
          }
        </style>
      </head>
      <body>
        <h1>Relatório dos Barbeiros</h1>
        ${conteudo}
      </body>
    </html>
  `);

  janela.document.close();
  janela.focus();
  janela.print();
}



/* =========================
   DASHBOARD
========================= */

async function dashboard() {
  const hoje = new Date().toISOString().slice(0, 10);

  const res = await fetch(`/daily-report?date=${hoje}`);
  const dados = await res.json();

  let html = `
    <div class="grid">
      <div class="card destaque">
        <h2>Faturamento do Dia</h2>
        <p>R$ ${dados.total}</p>
      </div>

      <div class="card">
        <h2>Vendas</h2>
        <p>${dados.quantidadeVendas}</p>
      </div>

      <div class="card">
        <h2>Serviços</h2>
        <p>${dados.totalServicos}</p>
      </div>

      <div class="card">
        <h2>Produtos</h2>
        <p>${dados.totalProdutos}</p>
      </div>

      <div class="card">
        <h2>PIX</h2>
        <p>R$ ${dados.pix}</p>
      </div>

      <div class="card">
        <h2>Dinheiro</h2>
        <p>R$ ${dados.dinheiro}</p>
      </div>

      <div class="card">
        <h2>Cartão</h2>
        <p>R$ ${dados.cartao}</p>
      </div>
    </div>
  `;

  document.getElementById("conteudo").innerHTML = html;
}

/* =========================
   RANKING
========================= */

async function ranking() {
  const hoje = new Date().toISOString().slice(0, 10);

  const res = await fetch(`/ranking?date=${hoje}`);
  const dados = await res.json();

  let html = `
    <div class="card destaque">
      <h2>Ranking do Dia</h2>
      <p>Data: ${hoje}</p>
    </div>
  `;

  if (!dados.length) {
    html += `<div class="card"><p>Nenhum dado encontrado.</p></div>`;
  }

  dados.forEach((item, index) => {
    html += `
      <div class="card">
        <h3>${index + 1}º ${item.nome}</h3>
        <p><strong>Total:</strong> R$ ${item.total}</p>
      </div>
    `;
  });

  document.getElementById("conteudo").innerHTML = html;
}

/* =========================
   ADMINISTRADOR
========================= */

async function carregarAdmin() {
  const resBarbers = await fetch("/barbers");
  const barbers = await resBarbers.json();

  const resServices = await fetch("/services");
  const services = await resServices.json();

  const resProducts = await fetch("/products");
  const products = await resProducts.json();

  let html = `
    <div class="card destaque">
      <h2>Administrador</h2>
      <button onclick="cadastrarBarbeiro()">Adicionar Barbeiro</button>
      <button onclick="cadastrarServico()">Adicionar Serviço</button>
      <button onclick="cadastrarProduto()">Adicionar Produto</button>
    </div>

    <div class="card">
      <h3>Barbeiros</h3>
  `;

  barbers.forEach((b) => {
    html += `
      <div class="linha-admin">
        <span>${b.nome} - Comissão ${b.comissao}%</span>
        <button class="btn-excluir" onclick="deletarBarbeiro('${b._id}')">Excluir</button>
      </div>
    `;
  });

  html += `</div><div class="card"><h3>Serviços</h3>`;

  services.forEach((s) => {
    html += `
      <div class="linha-admin">
        <span>${s.nome} - R$ ${s.preco}</span>
        <button class="btn-excluir" onclick="deletarServico('${s._id}')">Excluir</button>
      </div>
    `;
  });

  html += `</div><div class="card"><h3>Produtos</h3>`;

  products.forEach((p) => {
    html += `
      <div class="linha-admin">
        <span>${p.nome} - R$ ${p.preco}</span>
        <button class="btn-excluir" onclick="deletarProduto('${p._id}')">Excluir</button>
      </div>
    `;
  });

  html += `</div>`;

  document.getElementById("conteudo").innerHTML = html;
}

/* =========================
   CADASTROS
========================= */

async function cadastrarBarbeiro() {
  const nome = prompt("Nome do barbeiro");
  const comissao = prompt("Comissão (%)");

  if (!nome || !comissao) return;

  await fetch("/barbers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      comissao,
    }),
  });

  alert("Barbeiro cadastrado com sucesso");
  carregarAdmin();
}

async function cadastrarServico() {
  const nome = prompt("Nome do serviço");
  const preco = prompt("Preço do serviço");

  if (!nome || !preco) return;

  await fetch("/services", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      preco,
    }),
  });

  alert("Serviço cadastrado com sucesso");
  carregarAdmin();
}

async function cadastrarProduto() {
  const nome = prompt("Nome do produto");
  const preco = prompt("Preço do produto");

  if (!nome || !preco) return;

  await fetch("/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      preco,
    }),
  });

  alert("Produto cadastrado com sucesso");
  carregarAdmin();
}

/* =========================
   EXCLUSÕES
========================= */

async function deletarBarbeiro(id) {
  await fetch(`/barbers/${id}`, { method: "DELETE" });
  carregarAdmin();
}

async function deletarServico(id) {
  await fetch(`/services/${id}`, { method: "DELETE" });
  carregarAdmin();
}

async function deletarProduto(id) {
  await fetch(`/products/${id}`, { method: "DELETE" });
  carregarAdmin();
}