let token = localStorage.getItem("token") || null;
let usuario = null;
let shops = [];
let shopSelecionada = localStorage.getItem("shopSelecionada") || "";
let vendaAtual = {
  barber: "",
  services: [],
  drinks: [],
  products: [],
  paymentMethod: "",
  gorjeta: 0
};

const ACESSOS_FIXOS = [
  {
    login: "gabriel",
    senha: "34229233",
    papel: "owner",
    shopNome: null
  },
  {
    login: "barbearia contorno",
    senha: "7434",
    papel: "manager",
    shopNome: "barbearia contorno"
  },
  {
    login: "barbearia grao mogol",
    senha: "112233",
    papel: "manager",
    shopNome: "barbearia grao mogol"
  }
];

function normalizarTexto(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function buscarAcessoFixo(login, senha) {
  const loginNormalizado = normalizarTexto(login);
  const senhaNormalizada = String(senha || "").trim();

  return ACESSOS_FIXOS.find(
    (acesso) =>
      normalizarTexto(acesso.login) === loginNormalizado &&
      String(acesso.senha) === senhaNormalizada
  );
}

function encontrarShopPorNome(nome) {
  if (!nome || !Array.isArray(shops)) return null;

  const nomeNormalizado = normalizarTexto(nome);

  return (
    shops.find((s) => normalizarTexto(s.nome) === nomeNormalizado) || null
  );
}

function salvarSessao() {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }

  if (usuario) {
    localStorage.setItem("usuario", JSON.stringify(usuario));
  } else {
    localStorage.removeItem("usuario");
  }

  if (shopSelecionada) {
    localStorage.setItem("shopSelecionada", shopSelecionada);
  } else {
    localStorage.removeItem("shopSelecionada");
  }
}

function limparSessao() {
  token = null;
  usuario = null;
  shops = [];
  shopSelecionada = "";
  limparVenda();

  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  localStorage.removeItem("shopSelecionada");
}

function mostrarLogin() {
  const loginTela = document.getElementById("loginTela");
  const app = document.getElementById("app");

  if (loginTela) loginTela.style.display = "flex";
  if (app) app.style.display = "none";
}

function mostrarApp() {
  const loginTela = document.getElementById("loginTela");
  const app = document.getElementById("app");

  if (loginTela) loginTela.style.display = "none";
  if (app) app.style.display = "block";
}

function atualizarBotoesPermissao() {
  const btnAdmin = document.getElementById("btnAdmin");
  const btnRelatorioBarbeiros = document.getElementById("btnRelatorioBarbeiros");

  if (!usuario) {
    if (btnAdmin) btnAdmin.style.display = "none";
    if (btnRelatorioBarbeiros) btnRelatorioBarbeiros.style.display = "none";
    return;
  }

  if (usuario.papel === "owner") {
    if (btnAdmin) btnAdmin.style.display = "inline-block";
    if (btnRelatorioBarbeiros) btnRelatorioBarbeiros.style.display = "inline-block";
  } else {
    if (btnAdmin) btnAdmin.style.display = "none";
    if (btnRelatorioBarbeiros) btnRelatorioBarbeiros.style.display = "none";
  }
}

function atualizarGorjeta() {
  const input = document.getElementById("gorjetaInput");
  const valor = parseFloat(input?.value) || 0;
  vendaAtual.gorjeta = valor;

  const totalEl = document.querySelector(".total-venda");
  if (totalEl) {
    totalEl.textContent = `R$ ${calcularTotal().toFixed(2)}`;
  }
}

function adicionarBotaoSair() {
  const menu = document.querySelector(".menu");
  if (!menu) return;

  let btnSair = document.getElementById("btnSair");

  if (!btnSair) {
    btnSair = document.createElement("button");
    btnSair.id = "btnSair";
    btnSair.className = "btn-secundario";
    btnSair.textContent = "Sair";
    btnSair.onclick = logout;
    menu.appendChild(btnSair);
  }
}

function removerBotaoSair() {
  const btnSair = document.getElementById("btnSair");
  if (btnSair) btnSair.remove();
}

function setLoadingLogin(ativo) {
  const botao = document.querySelector("#loginTela button");
  const loginInput = document.getElementById("login");
  const senhaInput = document.getElementById("senha");

  if (botao) {
    botao.disabled = ativo;
    botao.textContent = ativo ? "Entrando..." : "Entrar";
  }

  if (loginInput) loginInput.disabled = ativo;
  if (senhaInput) senhaInput.disabled = ativo;
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarMoeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2)}`;
}

function formatarData(data) {
  if (!data) return "-";
  const dt = new Date(data);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("pt-BR");
}

function listaParaTexto(lista, vazio = "Nenhum") {
  if (!Array.isArray(lista) || lista.length === 0) return vazio;

  return lista
    .map((item) => {
      if (typeof item === "string") return escapeHtml(item);
      if (typeof item === "object" && item !== null) {
        return escapeHtml(item.nome || item.name || item.titulo || "");
      }
      return escapeHtml(String(item));
    })
    .filter(Boolean)
    .join(", ");
}

async function parseResponse(res) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      error: "Resposta inválida do servidor.",
      raw: text,
    };
  }
}

async function fetchAuth(url, options = {}) {
  if (!token) {
    mostrarLogin();
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const config = {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    const res = await fetch(url, config);
    const data = await parseResponse(res);

    if (res.status === 401) {
      limparSessao();
      mostrarLogin();
      removerBotaoSair();
      alert("Sua sessão expirou. Faça login novamente.");
      return { error: "Sessão expirada." };
    }

    if (!res.ok && !data.error) {
      return { error: `Erro ${res.status} ao acessar o servidor.` };
    }

    return data;
  } catch (error) {
    console.error("Erro na requisição:", error);
    return { error: "Erro de conexão com o servidor." };
  }
}

function limparVenda() {
  vendaAtual = {
    barber: "",
    services: [],
    drinks: [],
    products: [],
    paymentMethod: "",
    gorjeta: 0,
  };
}

function getShopQuery() {
  if (usuario && usuario.papel === "owner") {
    return shopSelecionada ? `?shop=${encodeURIComponent(shopSelecionada)}` : "";
  }
  return "";
}

function getShopParam(prefix = "&") {
  if (usuario && usuario.papel === "owner") {
    return shopSelecionada ? `${prefix}shop=${encodeURIComponent(shopSelecionada)}` : "";
  }
  return "";
}

function montarSeletorShop() {
  if (!usuario || usuario.papel !== "owner") return "";

  return `
    <div class="card">
      <h3>Selecionar Barbearia</h3>
      <select id="shopSelect" onchange="trocarShop()">
        <option value="">Selecione a barbearia</option>
        ${shops
          .map(
            (s) =>
              `<option value="${s._id}" ${
                shopSelecionada === s._id ? "selected" : ""
              }>${escapeHtml(s.nome)}</option>`
          )
          .join("")}
      </select>
    </div>
  `;
}

async function trocarShop() {
  const select = document.getElementById("shopSelect");
  shopSelecionada = select ? select.value : "";
  salvarSessao();
  limparVenda();

  if (!shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia para continuar.</p></div>
    `;
    return;
  }

  await dashboard();
}

async function carregarShops() {
  const shopsRes = await fetchAuth("/shops");
  shops = Array.isArray(shopsRes) ? shopsRes : [];

  if (usuario?.papel === "manager" && usuario?.shop) {
    shopSelecionada = usuario.shop.id || usuario.shop._id || "";
  }

  salvarSessao();
}

async function login() {
  const loginInput = document.getElementById("login");
  const senhaInput = document.getElementById("senha");

  const loginValue = loginInput?.value?.trim();
  const senhaValue = senhaInput?.value?.trim();

  if (!loginValue || !senhaValue) {
    alert("Preencha usuário e senha.");
    return;
  }

  const acessoFixo = buscarAcessoFixo(loginValue, senhaValue);

  if (!acessoFixo) {
    alert("Login ou senha inválidos.");
    return;
  }

  setLoadingLogin(true);

  try {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login: loginValue,
        senha: senhaValue,
      }),
    });

    const data = await parseResponse(res);

    if (!res.ok || data.error) {
      alert(data.error || "Erro ao entrar no sistema.");
      return;
    }

    token = data.token;
    usuario = data.usuario;

    if (usuario && !usuario.papel) {
      usuario.papel = acessoFixo.papel;
    }

    salvarSessao();
    await carregarShops();

    if (acessoFixo.papel === "owner") {
      if (!shopSelecionada && Array.isArray(shops) && shops.length === 1) {
        shopSelecionada = shops[0]._id;
      }
    } else if (acessoFixo.shopNome) {
      const shopEncontrada = encontrarShopPorNome(acessoFixo.shopNome);
      if (shopEncontrada) {
        shopSelecionada = shopEncontrada._id;
      }
    }

    salvarSessao();

    mostrarApp();
    atualizarBotoesPermissao();
    adicionarBotaoSair();

    await dashboard();
  } catch (error) {
    console.error("Erro no login:", error);
    alert("Erro ao entrar no sistema.");
  } finally {
    setLoadingLogin(false);
  }
}

function logout() {
  limparSessao();
  removerBotaoSair();
  mostrarLogin();
  atualizarBotoesPermissao();

  const conteudo = document.getElementById("conteudo");
  if (conteudo) conteudo.innerHTML = "";

  const loginInput = document.getElementById("login");
  const senhaInput = document.getElementById("senha");

  if (loginInput) loginInput.value = "";
  if (senhaInput) senhaInput.value = "";
}

function abrir(pagina) {
  if (pagina === "vendas") vendas();
  if (pagina === "relatorio") relatorio();
  if (pagina === "relatorioBarbeiros") relatorioBarbeiros();
  if (pagina === "dashboard") dashboard();
  if (pagina === "ranking") ranking();
  if (pagina === "bebidas") relatorioBebidas();
  if (pagina === "admin") admin();
}

/* =========================
   VENDAS
========================= */

async function vendas() {
  if (usuario.papel === "owner" && !shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia para lançar vendas.</p></div>
    `;
    return;
  }

  const query = getShopQuery();

  const barbers = await fetchAuth(`/barbers${query}`);
  const services = await fetchAuth(`/services${query}`);
  const drinks = await fetchAuth(`/drinks${query}`);
  const products = await fetchAuth(`/products${query}`);

  if (
    !Array.isArray(barbers) ||
    !Array.isArray(services) ||
    !Array.isArray(drinks) ||
    !Array.isArray(products)
  ) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Erro ao carregar dados da venda.</p></div>
    `;
    return;
  }

  const html = `
    ${montarSeletorShop()}
    <div class="card">
      <h2>Registrar Venda</h2>

      <div class="vendas-layout">
        <div class="coluna-venda">
          <label>Barbeiro</label>
          <select id="barberSelect" onchange="alterarBarbeiro()">
            <option value="">Selecione o barbeiro</option>
            ${barbers
              .map(
                (b) =>
                  `<option value="${b._id}" ${vendaAtual.barber === b._id ? "selected" : ""}>${escapeHtml(b.nome)}</option>`
              )
              .join("")}
          </select>

          <h3 style="margin-top:20px;">Serviços</h3>
          <select id="serviceSelect" onchange="adicionarServicoSelecionado()">
            <option value="">Selecione o serviço</option>
            ${services
              .map(
                (s) =>
                  `<option value="${s._id}" data-nome="${escapeHtml(
                    s.nome
                  )}" data-preco="${Number(s.preco || 0)}">${escapeHtml(s.nome)} - R$ ${Number(
                    s.preco || 0
                  ).toFixed(2)}</option>`
              )
              .join("")}
          </select>

          <h3 style="margin-top:20px;">Bebidas</h3>
          <select id="drinkSelect" onchange="adicionarBebidaSelecionada()">
            <option value="">Selecione a bebida</option>
            ${drinks
              .map(
                (d) =>
                  `<option value="${d._id}" data-nome="${escapeHtml(
                    d.nome
                  )}" data-preco="${Number(d.preco || 0)}">${escapeHtml(d.nome)} - R$ ${Number(
                    d.preco || 0
                  ).toFixed(2)}</option>`
              )
              .join("")}
          </select>
        </div>

        <div class="coluna-venda">
          <h3>Produtos</h3>
          <select id="productSelect" onchange="adicionarProdutoSelecionado()">
            <option value="">Selecione o produto</option>
            ${products
              .map(
                (p) =>
                  `<option value="${p._id}" data-nome="${escapeHtml(
                    p.nome
                  )}" data-preco="${Number(p.preco || 0)}">${escapeHtml(p.nome)} - R$ ${Number(
                    p.preco || 0
                  ).toFixed(2)}</option>`
              )
              .join("")}
          </select>

          <div style="margin-top: 18px;">
            <label>Gorjeta</label>
            <input
              type="number"
              id="gorjetaInput"
              placeholder="Digite o valor da gorjeta"
              min="0"
              step="0.01"
              value="${Number(vendaAtual.gorjeta || 0).toFixed(2)}"
              oninput="atualizarGorjeta()"
            >
          </div>
        </div>

        <div class="coluna-venda">
          <div class="resumo-venda">
            <div class="resumo-bloco">
              <h4>Forma de pagamento</h4>
              <select id="paymentSelect" onchange="alterarPagamento()">
                <option value="">Selecione a forma de pagamento</option>
                <option value="PIX" ${vendaAtual.paymentMethod === "PIX" ? "selected" : ""}>PIX</option>
                <option value="DINHEIRO" ${vendaAtual.paymentMethod === "DINHEIRO" ? "selected" : ""}>DINHEIRO</option>
                <option value="DEBITO" ${vendaAtual.paymentMethod === "DEBITO" ? "selected" : ""}>DÉBITO</option>
                <option value="CREDITO" ${vendaAtual.paymentMethod === "CREDITO" ? "selected" : ""}>CRÉDITO</option>
              </select>
            </div>

            <div class="resumo-bloco">
              <h4>Serviços selecionados</h4>
              ${
                vendaAtual.services.length === 0
                  ? `<p class="aviso-vazio">Nenhum serviço selecionado.</p>`
                  : vendaAtual.services
                      .map(
                        (s, index) => `
                          <div class="item-resumo">
                            <span>${escapeHtml(s.nome)} ${s.quantidade > 1 ? `(x${s.quantidade})` : ""}</span>
                            <span>
                              R$ ${(Number(s.preco) * Number(s.quantidade || 1)).toFixed(2)}
                              <button type="button" class="btn-secundario" onclick="diminuirServico(${index})">-</button>
                              <button type="button" class="btn-secundario" onclick="aumentarServico(${index})">+</button>
                              <button type="button" class="btn-secundario" onclick="removerServico(${index})">x</button>
                            </span>
                          </div>
                        `
                      )
                      .join("")
              }
            </div>

            <div class="resumo-bloco">
              <h4>Bebidas selecionadas</h4>
              ${
                vendaAtual.drinks.length === 0
                  ? `<p class="aviso-vazio">Nenhuma bebida selecionada.</p>`
                  : vendaAtual.drinks
                      .map(
                        (d, index) => `
                          <div class="item-resumo">
                            <span>${escapeHtml(d.nome)} ${d.quantidade > 1 ? `(x${d.quantidade})` : ""}</span>
                            <span>
                              R$ ${(Number(d.preco) * Number(d.quantidade || 1)).toFixed(2)}
                              <button type="button" class="btn-secundario" onclick="diminuirBebida(${index})">-</button>
                              <button type="button" class="btn-secundario" onclick="aumentarBebida(${index})">+</button>
                              <button type="button" class="btn-secundario" onclick="removerBebida(${index})">x</button>
                            </span>
                          </div>
                        `
                      )
                      .join("")
              }
            </div>

            <div class="resumo-bloco">
              <h4>Produtos selecionados</h4>
              ${
                vendaAtual.products.length === 0
                  ? `<p class="aviso-vazio">Nenhum produto selecionado.</p>`
                  : vendaAtual.products
                      .map(
                        (p, index) => `
                          <div class="item-resumo">
                            <span>${escapeHtml(p.nome)} ${p.quantidade > 1 ? `(x${p.quantidade})` : ""}</span>
                            <span>
                              R$ ${(Number(p.preco) * Number(p.quantidade || 1)).toFixed(2)}
                              <button type="button" class="btn-secundario" onclick="diminuirProduto(${index})">-</button>
                              <button type="button" class="btn-secundario" onclick="aumentarProduto(${index})">+</button>
                              <button type="button" class="btn-secundario" onclick="removerProduto(${index})">x</button>
                            </span>
                          </div>
                        `
                      )
                      .join("")
              }
            </div>

            <div class="resumo-bloco">
              <h4>Total</h4>
              <div class="total-venda">R$ ${calcularTotal().toFixed(2)}</div>
              <p style="margin-top: 10px;"><strong>Gorjeta:</strong> R$ ${Number(vendaAtual.gorjeta || 0).toFixed(2)}</p>
            </div>

            <div class="acoes-venda">
              <button onclick="salvarVenda()">Salvar Venda</button>
              <button class="btn-secundario" onclick="limparVenda(); vendas();">Limpar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("conteudo").innerHTML = html;
}

function alterarBarbeiro() {
  vendaAtual.barber = document.getElementById("barberSelect").value;
}

function alterarPagamento() {
  vendaAtual.paymentMethod = document.getElementById("paymentSelect").value;
}

function adicionarServicoSelecionado() {
  const select = document.getElementById("serviceSelect");
  const option = select.options[select.selectedIndex];

  if (!select.value) return;

  const existente = vendaAtual.services.find((s) => s._id === select.value);

  if (existente) {
    existente.quantidade += 1;
  } else {
    vendaAtual.services.push({
      _id: select.value,
      nome: option.dataset.nome,
      preco: Number(option.dataset.preco || 0),
      quantidade: 1,
    });
  }

  select.value = "";
  vendas();
}

function adicionarBebidaSelecionada() {
  const select = document.getElementById("drinkSelect");
  const option = select.options[select.selectedIndex];

  if (!select.value) return;

  const existente = vendaAtual.drinks.find((d) => d._id === select.value);

  if (existente) {
    existente.quantidade += 1;
  } else {
    vendaAtual.drinks.push({
      _id: select.value,
      nome: option.dataset.nome,
      preco: Number(option.dataset.preco || 0),
      quantidade: 1,
    });
  }

  select.value = "";
  vendas();
}

function adicionarProdutoSelecionado() {
  const select = document.getElementById("productSelect");
  const option = select.options[select.selectedIndex];

  if (!select.value) return;

  const existente = vendaAtual.products.find((p) => p._id === select.value);

  if (existente) {
    existente.quantidade += 1;
  } else {
    vendaAtual.products.push({
      _id: select.value,
      nome: option.dataset.nome,
      preco: Number(option.dataset.preco || 0),
      quantidade: 1,
    });
  }

  select.value = "";
  vendas();
}

function aumentarServico(index) {
  vendaAtual.services[index].quantidade += 1;
  vendas();
}

function diminuirServico(index) {
  if (vendaAtual.services[index].quantidade > 1) {
    vendaAtual.services[index].quantidade -= 1;
  } else {
    vendaAtual.services.splice(index, 1);
  }
  vendas();
}

function removerServico(index) {
  vendaAtual.services.splice(index, 1);
  vendas();
}

function aumentarBebida(index) {
  vendaAtual.drinks[index].quantidade += 1;
  vendas();
}

function diminuirBebida(index) {
  if (vendaAtual.drinks[index].quantidade > 1) {
    vendaAtual.drinks[index].quantidade -= 1;
  } else {
    vendaAtual.drinks.splice(index, 1);
  }
  vendas();
}

function removerBebida(index) {
  vendaAtual.drinks.splice(index, 1);
  vendas();
}

function aumentarProduto(index) {
  vendaAtual.products[index].quantidade += 1;
  vendas();
}

function diminuirProduto(index) {
  if (vendaAtual.products[index].quantidade > 1) {
    vendaAtual.products[index].quantidade -= 1;
  } else {
    vendaAtual.products.splice(index, 1);
  }
  vendas();
}

function removerProduto(index) {
  vendaAtual.products.splice(index, 1);
  vendas();
}

function calcularTotal() {
  const totalServicos = vendaAtual.services.reduce(
    (acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 1),
    0
  );

  const totalBebidas = vendaAtual.drinks.reduce(
    (acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 1),
    0
  );

  const totalProdutos = vendaAtual.products.reduce(
    (acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 1),
    0
  );

  const totalGorjeta = Number(vendaAtual.gorjeta || 0);

  return totalServicos + totalBebidas + totalProdutos + totalGorjeta;
}

async function salvarVenda() {
  if (!vendaAtual.barber) {
    alert("Selecione o barbeiro.");
    return;
  }

  if (vendaAtual.services.length === 0) {
    alert("Selecione pelo menos um serviço.");
    return;
  }

  if (!vendaAtual.paymentMethod) {
    alert("Selecione a forma de pagamento.");
    return;
  }

  const servicesExpandido = [];
  const drinksExpandido = [];
  const productsExpandido = [];

  vendaAtual.services.forEach((s) => {
    for (let i = 0; i < s.quantidade; i++) {
      servicesExpandido.push(s._id);
    }
  });

  vendaAtual.drinks.forEach((d) => {
    for (let i = 0; i < d.quantidade; i++) {
      drinksExpandido.push(d._id);
    }
  });

  vendaAtual.products.forEach((p) => {
    for (let i = 0; i < p.quantidade; i++) {
      productsExpandido.push(p._id);
    }
  });

  const body = {
    barber: vendaAtual.barber,
    services: servicesExpandido,
    drinks: drinksExpandido,
    paymentMethod: vendaAtual.paymentMethod,
    products: productsExpandido,
    gorjeta: vendaAtual.gorjeta || 0,
  };

  if (usuario.papel === "owner") {
    body.shop = shopSelecionada;
  }

  const data = await fetchAuth("/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Venda registrada com sucesso");
  limparVenda();
  await vendas();
}

/* =========================
   RELATÓRIO DE VENDAS
========================= */

async function relatorio() {
  if (usuario.papel === "owner" && !shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia para ver o relatório.</p></div>
    `;
    return;
  }

  const query = getShopQuery();
  const barbers = await fetchAuth(`/barbers${query}`);

  if (!Array.isArray(barbers)) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Erro ao carregar relatório.</p></div>
    `;
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const html = `
    ${montarSeletorShop()}
    <div class="card">
      <h2>Relatório de Vendas</h2>

      <div class="grid">
        <div>
          <label>Data inicial</label>
          <input type="date" id="inicio" value="${hoje}">
        </div>
        <div>
          <label>Data final</label>
          <input type="date" id="fim" value="${hoje}">
        </div>
        <div>
          <label>Barbeiro</label>
          <select id="barbeiroFiltro">
            <option value="">Todos</option>
            ${barbers.map((b) => `<option value="${b._id}">${escapeHtml(b.nome)}</option>`).join("")}
          </select>
        </div>
      </div>

      <button onclick="buscarRelatorio()">Buscar</button>
    </div>

    <div id="resultadoRelatorio"></div>
  `;

  document.getElementById("conteudo").innerHTML = html;
  await buscarRelatorio();
}

async function buscarRelatorio() {
  const inicio = document.getElementById("inicio")?.value;
  const fim = document.getElementById("fim")?.value;
  const barbeiro = document.getElementById("barbeiroFiltro")?.value;

  let url = `/relatorio?startDate=${encodeURIComponent(inicio)}&endDate=${encodeURIComponent(fim)}`;
  if (barbeiro) url += `&barber=${encodeURIComponent(barbeiro)}`;
  url += getShopParam("&");

  const dados = await fetchAuth(url);

  if (dados.error) {
    document.getElementById("resultadoRelatorio").innerHTML = `<div class="card"><p>${dados.error}</p></div>`;
    return;
  }

  const vendas = Array.isArray(dados?.vendas)
    ? dados.vendas
    : Array.isArray(dados)
    ? dados
    : [];

  let html = "";

  if (vendas.length === 0) {
    html += `<div class="card"><p>Nenhuma venda encontrada.</p></div>`;
  } else {
    vendas.forEach((v) => {
      const servicos =
        v.servicos ||
        v.services ||
        v.servicosDetalhados ||
        [];

      const produtos =
        v.produtos ||
        v.products ||
        v.produtosDetalhados ||
        [];

      const bebidas =
        v.bebidas ||
        v.drinks ||
        v.bebidasDetalhadas ||
        v.drinksDetalhados ||
        [];

      const vendaId = v.id || v._id || "";

      html += `
        <div class="card">
          <p><strong>Barbeiro:</strong> ${escapeHtml(v.barbeiro || v.barber || "")}</p>
          <p><strong>Serviços:</strong> ${listaParaTexto(servicos, "Nenhum")}</p><p><strong>Produtos:</strong> ${listaParaTexto(produtos, "Nenhum")}</p>
          <p><strong>Bebidas:</strong> ${listaParaTexto(bebidas, "Nenhuma")}</p>
          <p><strong>Pagamento:</strong> ${escapeHtml(v.pagamento || v.paymentMethod || "")}</p>
          <p><strong>Valor:</strong> ${formatarMoeda(v.valor || v.total || 0)}</p>
          <p><strong>Gorjeta:</strong> ${formatarMoeda(v.gorjeta || 0)}</p>
          <p><strong>Data:</strong> ${formatarData(v.data || v.createdAt)}</p>
          ${
            usuario?.papel === "owner" && vendaId
              ? `<button class="btn-secundario" onclick="apagarVenda('${vendaId}')">Apagar venda</button>`
              : ""
          }
        </div>
      `;
    });
  }

  document.getElementById("resultadoRelatorio").innerHTML = html;
}

async function apagarVenda(id) {
  if (!id) {
    alert("ID da venda não encontrado.");
    return;
  }

  const confirmar = confirm("Tem certeza que deseja apagar esta venda?");
  if (!confirmar) return;

  try {
    const res = await fetch(`/sales/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await res.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      alert(data.error || data.raw || "Erro ao apagar venda.");
      return;
    }

    alert(data.mensagem || data.message || "Venda apagada com sucesso");
    await buscarRelatorio();
  } catch (error) {
    console.error("Erro ao apagar venda:", error);
    alert("Erro de conexão ao apagar venda.");
  }
}

/* =========================
   RELATÓRIO DOS BARBEIROS
========================= */

async function relatorioBarbeiros() {
  if (usuario.papel !== "owner") {
    document.getElementById("conteudo").innerHTML = `
      <div class="card"><p>Somente o dono pode acessar o relatório dos barbeiros.</p></div>
    `;
    return;
  }

  if (!shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia para ver o relatório dos barbeiros.</p></div>
    `;
    return;
  }

  const query = getShopQuery();
  const barbers = await fetchAuth(`/barbers${query}`);
  const hoje = new Date().toISOString().slice(0, 10);

  const html = `
    ${montarSeletorShop()}
    <div class="card">
      <h2>Relatório dos Barbeiros</h2>

      <div class="grid">
        <div>
          <label>Data inicial</label>
          <input type="date" id="inicioBarbeiro" value="${hoje}">
        </div>
        <div>
          <label>Data final</label>
          <input type="date" id="fimBarbeiro" value="${hoje}">
        </div>
        <div>
          <label>Barbeiro</label>
          <select id="barbeiroFiltroRelatorio">
            <option value="">Todos</option>
            ${(barbers || []).map((b) => `<option value="${b._id}">${escapeHtml(b.nome)}</option>`).join("")}
          </select>
        </div>
      </div>

      <button onclick="buscarRelatorioBarbeiros()">Buscar</button>
      <button onclick="gerarPdfRelatorioBarbeiros()">Gerar PDF</button>
    </div>

    <div id="resultadoRelatorioBarbeiros"></div>
  `;

  document.getElementById("conteudo").innerHTML = html;
  await buscarRelatorioBarbeiros();
}

async function buscarRelatorioBarbeiros() {
  const inicio = document.getElementById("inicioBarbeiro")?.value;
  const fim = document.getElementById("fimBarbeiro")?.value;
  const barbeiro = document.getElementById("barbeiroFiltroRelatorio")?.value;

  let url = `/relatorio-barbeiros?startDate=${encodeURIComponent(inicio)}&endDate=${encodeURIComponent(fim)}${getShopParam("&")}`;
  if (barbeiro) url += `&barber=${encodeURIComponent(barbeiro)}`;

  const dados = await fetchAuth(url);

  if (dados.error) {
    document.getElementById("resultadoRelatorioBarbeiros").innerHTML = `<div class="card"><p>${dados.error}</p></div>`;
    return;
  }

  let html = `
    <div class="card">
      <h3>Total do período: ${formatarMoeda(dados.totalPeriodo || 0)}</h3>
      <p><strong>Comissão do período:</strong> ${formatarMoeda(dados.comissaoPeriodo || 0)}</p>
      <p><strong>Gorjetas do período:</strong> ${formatarMoeda(dados.totalGorjetas || 0)}</p>
      <p><strong>Produtos vendidos:</strong> ${Number(dados.produtosVendidos || 0)}</p>
    </div>
  `;

  if (Array.isArray(dados.barbeiros) && dados.barbeiros.length > 0) {
    dados.barbeiros.forEach((b) => {
      html += `
        <div class="card">
          <h3>${escapeHtml(b.barbeiro || "")}</h3>
          <p><strong>Total do período:</strong> ${formatarMoeda(b.totalPeriodo || 0)}</p>
          <p><strong>Comissão:</strong> ${formatarMoeda(b.comissaoPeriodo || 0)}</p>
          <p><strong>Gorjetas:</strong> ${formatarMoeda(b.gorjetas || 0)}</p>
          <p><strong>Produtos vendidos:</strong> ${Number(b.produtosVendidos || 0)}</p>
          <div>
            <strong>Serviços prestados:</strong>
            ${
              Array.isArray(b.servicosDetalhados) && b.servicosDetalhados.length > 0
                ? b.servicosDetalhados
                    .map((s) => `<p>${Number(s.quantidade || 0)} ${escapeHtml(s.nome || "")}</p>`)
                    .join("")
                : "<p>Nenhum serviço.</p>"
            }
          </div>
        </div>
      `;
    });
  }

  html += `<div class="card"><h3>Resumo por dia</h3></div>`;

  if (Array.isArray(dados.dias) && dados.dias.length > 0) {
    dados.dias.forEach((dia) => {
      html += `
        <div class="card">
          <h3>${new Date(`${dia.data}T12:00:00`).toLocaleDateString("pt-BR")}</h3>
          ${
            Array.isArray(dia.servicosDetalhados) && dia.servicosDetalhados.length > 0
              ? dia.servicosDetalhados
                  .map((s) => `<p>${Number(s.quantidade || 0)} ${escapeHtml(s.nome || "")}</p>`)
                  .join("")
              : "<p>Nenhum serviço.</p>"
          }
          <p><strong>Produtos vendidos:</strong> ${Number(dia.produtosVendidos || 0)}</p>
          <p><strong>Total do dia:</strong> ${formatarMoeda(dia.totalDia || 0)}</p>
          <p><strong>Comissão do dia:</strong> ${formatarMoeda(dia.comissaoDia || 0)}</p>
          <p><strong>Gorjetas do dia:</strong> ${formatarMoeda(dia.gorjetas || 0)}</p>
        </div>
      `;
    });
  } else {
    html += `<div class="card"><p>Nenhum registro encontrado.</p></div>`;
  }

  document.getElementById("resultadoRelatorioBarbeiros").innerHTML = html;
}

function gerarPdfRelatorioBarbeiros() {
  const conteudo = document.getElementById("resultadoRelatorioBarbeiros")?.innerHTML;

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
          h1, h2, h3 {
            margin-top: 0;
          }
          .card {
            border: 1px solid #ccc;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 15px;
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
  if (usuario.papel === "owner" && !shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia para ver o dashboard.</p></div>
    `;
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);

  document.getElementById("conteudo").innerHTML = `
    ${montarSeletorShop()}
    <div class="card">
      <h2>Dashboard</h2>
      <div class="grid">
        <div>
          <label>Data inicial</label>
          <input type="date" id="dashboardInicio" value="${hoje}">
        </div>
        <div>
          <label>Data final</label>
          <input type="date" id="dashboardFim" value="${hoje}">
        </div>
      </div>
      <button onclick="buscarDashboard()">Buscar</button>
    </div>
    <div id="resultadoDashboard"></div>
  `;

  await buscarDashboard();
}

async function buscarDashboard() {
  const inicio = document.getElementById("dashboardInicio")?.value;
  const fim = document.getElementById("dashboardFim")?.value;

  const dados = await fetchAuth(
    `/daily-report?startDate=${encodeURIComponent(inicio)}&endDate=${encodeURIComponent(fim)}${getShopParam("&")}`
  );

  if (dados.error) {
    document.getElementById("resultadoDashboard").innerHTML = `<div class="card"><p>${dados.error}</p></div>`;
    return;
  }

  const totalBebidas =
    dados.totalBebidas ??
    dados.bebidasVendidas ??
    dados.totalDrinks ??
    0;

  document.getElementById("resultadoDashboard").innerHTML = `
    <div class="grid">
      <div class="card"><h3>Total</h3><p>${formatarMoeda(dados.total || 0)}</p></div>
      <div class="card"><h3>Gorjetas</h3><p>${formatarMoeda(dados.totalGorjetas || 0)}</p></div>
      <div class="card"><h3>Vendas</h3><p>${dados.quantidadeVendas || 0}</p></div>
      <div class="card"><h3>Serviços</h3><p>${dados.totalServicos || 0}</p></div>
      <div class="card"><h3>Produtos</h3><p>${dados.totalProdutos || 0}</p></div>
      <div class="card"><h3>Bebidas</h3><p>${totalBebidas}</p></div>
      <div class="card"><h3>PIX</h3><p>${formatarMoeda(dados.pix || 0)}</p></div>
      <div class="card"><h3>Dinheiro</h3><p>${formatarMoeda(dados.dinheiro || 0)}</p></div>
      <div class="card"><h3>Débito</h3><p>${formatarMoeda(dados.debito || 0)}</p></div>
      <div class="card"><h3>Crédito</h3><p>${formatarMoeda(dados.credito || 0)}</p></div>
    </div>
  `;
}

/* =========================
   RANKING
========================= */

async function ranking() {
  if (usuario.papel === "owner" && !shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia para ver o ranking.</p></div>
    `;
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);

  document.getElementById("conteudo").innerHTML = `
    ${montarSeletorShop()}
    <div class="card">
      <h2>Ranking</h2>
      <div class="grid">
        <div>
          <label>Data inicial</label>
          <input type="date" id="rankingInicio" value="${hoje}">
        </div>
        <div>
          <label>Data final</label>
          <input type="date" id="rankingFim" value="${hoje}">
        </div>
      </div>
      <button onclick="buscarRanking()">Buscar</button>
    </div>
    <div id="resultadoRanking"></div>
  `;

  await buscarRanking();
}

async function buscarRanking() {
  const inicio = document.getElementById("rankingInicio")?.value;
  const fim = document.getElementById("rankingFim")?.value;

  const dados = await fetchAuth(
    `/ranking?startDate=${encodeURIComponent(inicio)}&endDate=${encodeURIComponent(fim)}${getShopParam("&")}`
  );

  if (!Array.isArray(dados)) {
    document.getElementById("resultadoRanking").innerHTML = `<div class="card"><p>Erro ao carregar ranking.</p></div>`;
    return;
  }

  let html = "";

  if (dados.length === 0) {
    html = `<div class="card"><p>Nenhum dado encontrado.</p></div>`;
  } else {
    dados.forEach((item, index) => {
      html += `
        <div class="card">
          <h3>${index + 1}º ${escapeHtml(item.nome || "")}</h3>
          <p>${formatarMoeda(item.total || 0)}</p>
          <p>${Number(item.vendas || 0)} venda(s)</p>
        </div>
      `;
    });
  }

  document.getElementById("resultadoRanking").innerHTML = html;
}

/* =========================
   ADMINISTRADOR
========================= */

async function admin() {
  if (usuario?.papel !== "owner") {
    document.getElementById("conteudo").innerHTML = `
      <div class="card"><p>Somente o dono pode acessar a área administrativa.</p></div>
    `;
    return;
  }

  if (!shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia para administrar.</p></div>
    `;
    return;
  }

  const data = await fetchAuth(`/admin-data?shop=${encodeURIComponent(shopSelecionada)}`);

  if (data.error) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>${escapeHtml(data.error)}</p></div>
    `;
    return;
  }

  const barbers = Array.isArray(data.barbers) ? data.barbers : [];
  const services = Array.isArray(data.services) ? data.services : [];
  const products = Array.isArray(data.products) ? data.products : [];
  const drinks = Array.isArray(data.drinks) ? data.drinks : [];

  document.getElementById("conteudo").innerHTML = `
    ${montarSeletorShop()}
    <div class="grid">
      <div class="card">
        <h3>Barbeiros</h3>
        <button onclick="cadastrarBarbeiro()">Cadastrar barbeiro</button>
        <div style="margin-top: 14px;">
          ${
            barbers.length
              ? barbers
                  .map(
                    (b) => `
                      <p>
                        ${escapeHtml(b.nome)} - Comissão: ${Number(b.comissao || 0)}%
                        <button class="btn-secundario" onclick="apagarBarbeiro('${b._id}')">Apagar</button>
                      </p>
                    `
                  )
                  .join("")
              : "<p>Nenhum barbeiro cadastrado.</p>"
          }
        </div>
      </div>

      <div class="card">
        <h3>Serviços</h3>
        <button onclick="cadastrarServico()">Cadastrar serviço</button>
        <div style="margin-top: 14px;">
          ${
            services.length
              ? services
                  .map(
                    (s) => `
                      <p>
                        ${escapeHtml(s.nome)} - R$ ${Number(s.preco || 0).toFixed(2)}
                        <button class="btn-secundario" onclick="apagarServico('${s._id}')">Apagar</button>
                      </p>
                    `
                  )
                  .join("")
              : "<p>Nenhum serviço cadastrado.</p>"
          }
        </div>
      </div>

      <div class="card">
        <h3>Produtos</h3>
        <button onclick="cadastrarProduto()">Cadastrar produto</button>
        <div style="margin-top: 14px;">
          ${
            products.length
              ? products
                  .map(
                    (p) => `
                      <p>
                        ${escapeHtml(p.nome)} - R$ ${Number(p.preco || 0).toFixed(2)}
                        <button class="btn-secundario" onclick="apagarProduto('${p._id}')">Apagar</button>
                      </p>
                    `
                  )
                  .join("")
              : "<p>Nenhum produto cadastrado.</p>"
          }
        </div>
      </div>

      <div class="card">
        <h3>Bebidas</h3>
        <button onclick="cadastrarBebida()">Cadastrar bebida</button>
        <div style="margin-top: 14px;">
          ${
            drinks.length
              ? drinks
                  .map(
                    (d) => `
                      <p>
                        ${escapeHtml(d.nome)} - R$ ${Number(d.preco || 0).toFixed(2)}
                        <button class="btn-secundario" onclick="apagarBebida('${d._id}')">Apagar</button>
                      </p>
                    `
                  )
                  .join("")
              : "<p>Nenhuma bebida cadastrada.</p>"
          }
        </div>
      </div>
    </div>
  `;
}

async function cadastrarBarbeiro() {
  const nome = prompt("Nome do barbeiro:");
  const comissao = prompt("Comissão do barbeiro (%):");
  if (!nome || comissao === null || comissao === "") return;

  const data = await fetchAuth("/barbers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      comissao,
      shop: shopSelecionada,
    }),
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Barbeiro cadastrado com sucesso");
  await admin();
}

async function cadastrarServico() {
  const nome = prompt("Nome do serviço:");
  const preco = prompt("Preço do serviço:");
  if (!nome || !preco) return;

  const data = await fetchAuth("/services", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      preco,
      shop: shopSelecionada,
    }),
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Serviço cadastrado com sucesso");
  await admin();
}

async function cadastrarProduto() {
  const nome = prompt("Nome do produto:");
  const preco = prompt("Preço do produto:");
  if (!nome || !preco) return;

  const data = await fetchAuth("/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      preco,
      shop: shopSelecionada,
    }),
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Produto cadastrado com sucesso");
  await admin();
}

async function cadastrarBebida() {
  const nome = prompt("Nome da bebida:");
  const preco = prompt("Preço da bebida:");
  if (!nome || !preco) return;

  const data = await fetchAuth("/drinks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nome,
      preco,
      shop: shopSelecionada,
    }),
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Bebida cadastrada com sucesso");
  await admin();
}

async function apagarBarbeiro(id) {
  const confirmar = confirm("Deseja apagar este barbeiro?");
  if (!confirmar) return;

  const data = await fetchAuth(`/barbers/${id}`, {
    method: "DELETE",
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Barbeiro apagado");
  await admin();
}

async function apagarServico(id) {
  const confirmar = confirm("Deseja apagar este serviço?");
  if (!confirmar) return;

  const data = await fetchAuth(`/services/${id}`, {
    method: "DELETE",
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Serviço apagado");
  await admin();
}

async function apagarProduto(id) {
  const confirmar = confirm("Deseja apagar este produto?");
  if (!confirmar) return;

  const data = await fetchAuth(`/products/${id}`, {
    method: "DELETE",
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Produto apagado");
  await admin();
}

async function apagarBebida(id) {
  const confirmar = confirm("Deseja apagar esta bebida?");
  if (!confirmar) return;

  const data = await fetchAuth(`/drinks/${id}`, {
    method: "DELETE",
  });

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Bebida apagada");
  await admin();
}

/* =========================
   INICIALIZAÇÃO
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  const usuarioSalvo = localStorage.getItem("usuario");

  if (usuarioSalvo) {
    try {
      usuario = JSON.parse(usuarioSalvo);
    } catch {
      usuario = null;
    }
  }

  const loginInput = document.getElementById("login");
  const senhaInput = document.getElementById("senha");

  [loginInput, senhaInput].forEach((campo) => {
    if (!campo) return;

    campo.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        login();
      }
    });
  });

  if (token && usuario) {
    await carregarShops();
    mostrarApp();
    atualizarBotoesPermissao();
    adicionarBotaoSair();
    await dashboard();
  } else {
    mostrarLogin();
    atualizarBotoesPermissao();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => {
        console.log("Service Worker registrado com sucesso");
      })
      .catch((error) => {
        console.log("Erro ao registrar Service Worker:", error);
      });
  });
}


async function relatorioBebidas() {
  if (usuario.papel === "owner" && !shopSelecionada) {
    document.getElementById("conteudo").innerHTML = `
      ${montarSeletorShop()}
      <div class="card"><p>Selecione uma barbearia.</p></div>
    `;
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);

  document.getElementById("conteudo").innerHTML = `
    ${montarSeletorShop()}
    <div class="card">
      <h2>Relatório de Bebidas</h2>

      <div class="grid">
        <div>
          <label>Data inicial</label>
          <input type="date" id="inicioBebidas" value="${hoje}">
        </div>
        <div>
          <label>Data final</label>
          <input type="date" id="fimBebidas" value="${hoje}">
        </div>
      </div>

      <button onclick="buscarRelatorioBebidas()">Buscar</button>
    </div>

    <div id="resultadoBebidas"></div>
  `;

  await buscarRelatorioBebidas();
}

async function buscarRelatorioBebidas() {
  const inicio = document.getElementById("inicioBebidas")?.value;
  const fim = document.getElementById("fimBebidas")?.value;

  let url = `/relatorio?startDate=${encodeURIComponent(inicio)}&endDate=${encodeURIComponent(fim)}`;
  url += getShopParam("&");

  const dados = await fetchAuth(url);

  if (dados.error) {
    document.getElementById("resultadoBebidas").innerHTML =
      `<div class="card"><p>${dados.error}</p></div>`;
    return;
  }

  const vendas = dados.vendas || [];

  let mapaBebidas = {};

  vendas.forEach(v => {
    const bebidas = v.bebidas || [];

    bebidas.forEach(nome => {
      if (!mapaBebidas[nome]) {
        mapaBebidas[nome] = 0;
      }
      mapaBebidas[nome]++;
    });
  });

  let html = "";

  if (Object.keys(mapaBebidas).length === 0) {
    html = `<div class="card"><p>Nenhuma bebida vendida.</p></div>`;
  } else {
    Object.entries(mapaBebidas).forEach(([nome, qtd]) => {
      html += `
        <div class="card">
          <h3>${nome}</h3>
          <p>Quantidade vendida: ${qtd}</p>
        </div>
      `;
    });
  }

  document.getElementById("resultadoBebidas").innerHTML = html;
}