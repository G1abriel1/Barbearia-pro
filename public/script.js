let token = localStorage.getItem("token") || null;
let usuario = null;
let shops = [];
let shopSelecionada = localStorage.getItem("shopSelecionada") || "";

let vendaAtual = {
  barber: "",
  services: [],
  products: [],
  paymentMethod: "",
  gorjeta: 0
};

// =======================
// GORJETA
// =======================
function atualizarGorjeta() {
  const input = document.getElementById("gorjetaInput");
  const valor = parseFloat(input.value) || 0;

  vendaAtual.gorjeta = valor;
}

// =======================
// VENDAS
// =======================
function calcularTotal() {
  const totalServicos = vendaAtual.services.reduce(
    (acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 1),
    0
  );

  const totalProdutos = vendaAtual.products.reduce(
    (acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 1),
    0
  );

  return totalServicos + totalProdutos;
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
  const productsExpandido = [];

  vendaAtual.services.forEach((s) => {
    for (let i = 0; i < s.quantidade; i++) {
      servicesExpandido.push(s._id);
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
    paymentMethod: vendaAtual.paymentMethod,
    products: productsExpandido,
    gorjeta: vendaAtual.gorjeta || 0
  };

  if (usuario?.papel === "owner") {
    body.shop = shopSelecionada;
  }

  const res = await fetch("/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Venda registrada com sucesso");
  location.reload();
}