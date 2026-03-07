const path = require("path");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Barber = require("./models/Barber");
const Service = require("./models/Service");
const Product = require("./models/Product");
const Sale = require("./models/Sale");
const Shop = require("./models/Shop");
const User = require("./models/User");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_padrao_mude_isso";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ======================
   FUNÇÕES AUXILIARES
====================== */

function normalizarLogin(login) {
  return String(login || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function gerarToken(user) {
  return jwt.sign(
    {
      id: user._id,
      login: user.login,
      papel: user.papel,
      shop: user.shop || null,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Token não enviado" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).populate("shop");
    if (!user || !user.ativo) {
      return res.status(401).json({ error: "Usuário inválido" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function somenteOwner(req, res, next) {
  if (req.user?.papel !== "owner") {
    return res.status(403).json({ error: "Acesso permitido apenas ao dono" });
  }
  next();
}

function ownerOuManager(req, res, next) {
  if (!req.user || !["owner", "manager"].includes(req.user.papel)) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  next();
}

function obterShopIdDaRequisicao(req) {
  if (req.user.papel === "owner") {
    return req.query.shop || req.body.shop || null;
  }

  return req.user.shop?._id?.toString() || req.user.shop?.toString() || null;
}

async function validarEntidadeDaUnidade(Model, id, shopId) {
  const item = await Model.findOne({ _id: id, shop: shopId });
  return item;
}

async function criarDadosIniciais() {
  const contorno = await Shop.findOneAndUpdate(
    { nome: "Barbearia Contorno" },
    { nome: "Barbearia Contorno", ativo: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const graoMogol = await Shop.findOneAndUpdate(
    { nome: "Barbearia Grão Mogol" },
    { nome: "Barbearia Grão Mogol", ativo: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  async function garantirUsuario({ nome, login, senha, papel, shop }) {
    const loginNormalizado = normalizarLogin(login);
    const existente = await User.findOne({ login: loginNormalizado });

    if (existente) return existente;

    const senhaHash = await bcrypt.hash(String(senha), 10);

    const user = new User({
      nome,
      login: loginNormalizado,
      senhaHash,
      papel,
      shop: shop || null,
      ativo: true,
    });

    await user.save();
    return user;
  }

  await garantirUsuario({
    nome: "Gabriel",
    login: "gabriel",
    senha: "34229233",
    papel: "owner",
    shop: null,
  });

  await garantirUsuario({
    nome: "Acesso Contorno",
    login: "contorno",
    senha: "7434",
    papel: "manager",
    shop: contorno._id,
  });

  await garantirUsuario({
    nome: "Acesso Grão Mogol",
    login: "grao mogol",
    senha: "112233",
    papel: "manager",
    shop: graoMogol._id,
  });

  console.log("✅ Dados iniciais conferidos");
}

/* ======================
   ROTAS PÚBLICAS
====================== */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/status", (req, res) => {
  res.json({
    status: "online",
    message: "Sistema da barbearia funcionando",
    time: new Date(),
  });
});

app.post("/auth/login", async (req, res) => {
  try {
    const login = normalizarLogin(req.body.login);
    const senha = String(req.body.senha || "");

    if (!login || !senha) {
      return res.status(400).json({ error: "Login e senha são obrigatórios" });
    }

    const user = await User.findOne({ login }).populate("shop");

    if (!user || !user.ativo) {
      return res.status(401).json({ error: "Login ou senha inválidos" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senhaHash);

    if (!senhaValida) {
      return res.status(401).json({ error: "Login ou senha inválidos" });
    }

    const token = gerarToken(user);

    return res.json({
      token,
      usuario: {
        id: user._id,
        nome: user.nome,
        login: user.login,
        papel: user.papel,
        shop: user.shop
          ? {
              id: user.shop._id,
              nome: user.shop.nome,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Erro em /auth/login:", error);
    return res.status(500).json({ error: "Erro ao fazer login" });
  }
});

/* ======================
   ROTAS PROTEGIDAS
====================== */

app.get("/auth/me", auth, async (req, res) => {
  return res.json({
    usuario: {
      id: req.user._id,
      nome: req.user.nome,
      login: req.user.login,
      papel: req.user.papel,
      shop: req.user.shop
        ? {
            id: req.user.shop._id,
            nome: req.user.shop.nome,
          }
        : null,
    },
  });
});

app.get("/shops", auth, async (req, res) => {
  try {
    if (req.user.papel === "owner") {
      const shops = await Shop.find({ ativo: true }).sort({ nome: 1 });
      return res.json(shops);
    }

    if (!req.user.shop) {
      return res.json([]);
    }

    return res.json([req.user.shop]);
  } catch (error) {
    console.error("Erro em /shops:", error);
    return res.status(500).json({ error: "Erro ao buscar barbearias" });
  }
});

/* ======================
   BARBEIROS
====================== */

app.get("/barbers", auth, ownerOuManager, async (req, res) => {
  try {
    const shopId = obterShopIdDaRequisicao(req);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    const barbers = await Barber.find({ shop: shopId, ativo: true }).sort({ nome: 1 });
    return res.json(barbers);
  } catch (error) {
    console.error("Erro em /barbers:", error);
    return res.status(500).json({ error: "Erro ao buscar barbeiros" });
  }
});

app.post("/barbers", auth, somenteOwner, async (req, res) => {
  try {
    const { nome, comissao, shop } = req.body;

    if (!nome || comissao === undefined || !shop) {
      return res.status(400).json({ error: "Nome, comissão e barbearia são obrigatórios" });
    }

    const barber = new Barber({
      nome: String(nome).trim(),
      comissao: Number(comissao),
      shop,
      ativo: true,
    });

    await barber.save();
    return res.json(barber);
  } catch (error) {
    console.error("Erro em POST /barbers:", error);
    return res.status(500).json({ error: "Erro ao cadastrar barbeiro" });
  }
});

app.delete("/barbers/:id", auth, somenteOwner, async (req, res) => {
  try {
    await Barber.findByIdAndUpdate(req.params.id, { ativo: false });
    return res.json({ message: "Barbeiro removido com sucesso" });
  } catch (error) {
    console.error("Erro em DELETE /barbers/:id:", error);
    return res.status(500).json({ error: "Erro ao remover barbeiro" });
  }
});

/* ======================
   SERVIÇOS
====================== */

app.get("/services", auth, ownerOuManager, async (req, res) => {
  try {
    const shopId = obterShopIdDaRequisicao(req);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    const services = await Service.find({ shop: shopId, ativo: true }).sort({ nome: 1 });
    return res.json(services);
  } catch (error) {
    console.error("Erro em /services:", error);
    return res.status(500).json({ error: "Erro ao buscar serviços" });
  }
});

app.post("/services", auth, somenteOwner, async (req, res) => {
  try {
    const { nome, preco, shop } = req.body;

    if (!nome || preco === undefined || !shop) {
      return res.status(400).json({ error: "Nome, preço e barbearia são obrigatórios" });
    }

    const service = new Service({
      nome: String(nome).trim(),
      preco: Number(preco),
      shop,
      ativo: true,
    });

    await service.save();
    return res.json(service);
  } catch (error) {
    console.error("Erro em POST /services:", error);
    return res.status(500).json({ error: "Erro ao cadastrar serviço" });
  }
});

app.delete("/services/:id", auth, somenteOwner, async (req, res) => {
  try {
    await Service.findByIdAndUpdate(req.params.id, { ativo: false });
    return res.json({ message: "Serviço removido com sucesso" });
  } catch (error) {
    console.error("Erro em DELETE /services/:id:", error);
    return res.status(500).json({ error: "Erro ao remover serviço" });
  }
});

/* ======================
   PRODUTOS
====================== */

app.get("/products", auth, ownerOuManager, async (req, res) => {
  try {
    const shopId = obterShopIdDaRequisicao(req);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    const products = await Product.find({ shop: shopId, ativo: true }).sort({ nome: 1 });
    return res.json(products);
  } catch (error) {
    console.error("Erro em /products:", error);
    return res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

app.post("/products", auth, somenteOwner, async (req, res) => {
  try {
    const { nome, preco, shop } = req.body;

    if (!nome || preco === undefined || !shop) {
      return res.status(400).json({ error: "Nome, preço e barbearia são obrigatórios" });
    }

    const product = new Product({
      nome: String(nome).trim(),
      preco: Number(preco),
      shop,
      ativo: true,
    });

    await product.save();
    return res.json(product);
  } catch (error) {
    console.error("Erro em POST /products:", error);
    return res.status(500).json({ error: "Erro ao cadastrar produto" });
  }
});

app.delete("/products/:id", auth, somenteOwner, async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { ativo: false });
    return res.json({ message: "Produto removido com sucesso" });
  } catch (error) {
    console.error("Erro em DELETE /products/:id:", error);
    return res.status(500).json({ error: "Erro ao remover produto" });
  }
});

/* ======================
   VENDAS
====================== */

app.post("/sales", auth, ownerOuManager, async (req, res) => {
  try {
    const { barber, services, products, paymentMethod, observacoes, shop } = req.body;

    const shopId = req.user.papel === "owner" ? shop : (req.user.shop?._id || req.user.shop);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    if (!barber) {
      return res.status(400).json({ error: "Barbeiro é obrigatório" });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: "Selecione pelo menos um serviço" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: "Forma de pagamento é obrigatória" });
    }

    const barberDoc = await validarEntidadeDaUnidade(Barber, barber, shopId);
    if (!barberDoc) {
      return res.status(404).json({ error: "Barbeiro não encontrado nessa unidade" });
    }

    const serviceDocs = await Service.find({
      _id: { $in: services },
      shop: shopId,
      ativo: true,
    });

    if (serviceDocs.length !== services.length) {
      return res.status(400).json({ error: "Um ou mais serviços são inválidos" });
    }

    const listaProdutos = Array.isArray(products) ? products.filter(Boolean) : [];

    const productDocs = await Product.find({
      _id: { $in: listaProdutos },
      shop: shopId,
      ativo: true,
    });

    if (productDocs.length !== listaProdutos.length) {
      return res.status(400).json({ error: "Um ou mais produtos são inválidos" });
    }

    const totalServicos = serviceDocs.reduce((acc, item) => acc + Number(item.preco || 0), 0);
    const totalProdutos = productDocs.reduce((acc, item) => acc + Number(item.preco || 0), 0);
    const total = totalServicos + totalProdutos;

    const sale = new Sale({
      shop: shopId,
      barber,
      services,
      products: listaProdutos,
      paymentMethod,
      total,
      criadoPor: req.user._id,
      observacoes: observacoes || "",
      date: new Date(),
    });

    await sale.save();

    const vendaSalva = await Sale.findById(sale._id)
      .populate("shop")
      .populate("barber")
      .populate("services")
      .populate("products")
      .populate("criadoPor");

    return res.json(vendaSalva);
  } catch (error) {
    console.error("Erro em POST /sales:", error);
    return res.status(500).json({ error: "Erro ao registrar venda" });
  }
});

app.get("/sales", auth, ownerOuManager, async (req, res) => {
  try {
    const { date, startDate, endDate, barber } = req.query;
    const shopId = obterShopIdDaRequisicao(req);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    const filtro = { shop: shopId };

    if (barber) {
      filtro.barber = barber;
    }

    if (date) {
      filtro.date = {
        $gte: new Date(`${date}T00:00:00`),
        $lte: new Date(`${date}T23:59:59.999`),
      };
    }

    if (startDate || endDate) {
      filtro.date = {
        $gte: startDate ? new Date(`${startDate}T00:00:00`) : new Date("2000-01-01T00:00:00"),
        $lte: endDate ? new Date(`${endDate}T23:59:59.999`) : new Date(),
      };
    }

    const sales = await Sale.find(filtro)
      .populate("shop")
      .populate("barber")
      .populate("services")
      .populate("products")
      .populate("criadoPor")
      .sort({ date: -1 });

    return res.json(sales);
  } catch (error) {
    console.error("Erro em GET /sales:", error);
    return res.status(500).json({ error: "Erro ao buscar vendas" });
  }
});

app.delete("/sales/:id", auth, somenteOwner, async (req, res) => {
  try {
    const sale = await Sale.findByIdAndDelete(req.params.id);

    if (!sale) {
      return res.status(404).json({ error: "Venda não encontrada" });
    }

    return res.json({ message: "Venda apagada com sucesso" });
  } catch (error) {
    console.error("Erro em DELETE /sales/:id:", error);
    return res.status(500).json({ error: "Erro ao apagar venda" });
  }
});

/* ======================
   RELATÓRIO DE VENDAS
====================== */

app.get("/relatorio", auth, ownerOuManager, async (req, res) => {
  try {
    const { barber, startDate, endDate } = req.query;
    const shopId = obterShopIdDaRequisicao(req);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    const filtro = { shop: shopId };

    if (barber) {
      filtro.barber = barber;
    }

    filtro.date = {
      $gte: startDate ? new Date(`${startDate}T00:00:00`) : new Date("2000-01-01T00:00:00"),
      $lte: endDate ? new Date(`${endDate}T23:59:59.999`) : new Date(),
    };

    const sales = await Sale.find(filtro)
      .populate("shop")
      .populate("barber")
      .populate("services")
      .populate("products")
      .sort({ date: -1 });

    let total = 0;

    const vendas = sales.map((sale) => {
      total += Number(sale.total || 0);

      return {
        id: sale._id,
        unidade: sale.shop?.nome || "",
        barbeiro: sale.barber?.nome || "Sem barbeiro",
        servicos: Array.isArray(sale.services) ? sale.services.map((s) => s.nome) : [],
        produtos: Array.isArray(sale.products) ? sale.products.map((p) => p.nome) : [],
        valor: Number(sale.total || 0),
        pagamento: sale.paymentMethod || "",
        data: sale.date,
      };
    });

    return res.json({ total, vendas });
  } catch (error) {
    console.error("Erro em GET /relatorio:", error);
    return res.status(500).json({ error: "Erro ao gerar relatório" });
  }
});

/* ======================
   RELATÓRIO DOS BARBEIROS
====================== */

app.get("/relatorio-barbeiros", auth, somenteOwner, async (req, res) => {

  try {

    const { barber, startDate, endDate, shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: "Selecione a barbearia" });
    }

    const filtro = { shop };

    if (barber) {
      filtro.barber = barber;
    }

    filtro.date = {
      $gte: startDate ? new Date(`${startDate}T00:00:00`) : new Date("2000-01-01"),
      $lte: endDate ? new Date(`${endDate}T23:59:59.999`) : new Date(),
    };

    const sales = await Sale.find(filtro)
      .populate("barber")
      .populate("services")
      .populate("products");

    let totalPeriodo = 0;
    let comissaoPeriodo = 0;
    let produtosVendidos = 0;

    const barbeiros = {};
    const dias = {};

    for (const sale of sales) {

      if (!sale.barber) continue;

      const nomeBarbeiro = sale.barber.nome;
      const data = new Date(sale.date).toISOString().slice(0,10);

      if (!barbeiros[nomeBarbeiro]) {
        barbeiros[nomeBarbeiro] = {
          barbeiro: nomeBarbeiro,
          totalPeriodo: 0,
          comissaoPeriodo: 0,
          produtosVendidos: 0,
          servicosDetalhados: {}
        };
      }

      if (!dias[data]) {
        dias[data] = {
          data,
          totalDia: 0,
          comissaoDia: 0,
          produtosVendidos: 0,
          servicosDetalhados: {}
        };
      }

      const services = sale.services || [];
      const products = sale.products || [];

      for (const service of services) {

        const nome = service.nome;
        const preco = Number(service.preco || 0);
        const comissao = preco * (Number(sale.barber.comissao || 0) / 100);

        totalPeriodo += preco;
        comissaoPeriodo += comissao;

        barbeiros[nomeBarbeiro].totalPeriodo += preco;
        barbeiros[nomeBarbeiro].comissaoPeriodo += comissao;

        dias[data].totalDia += preco;
        dias[data].comissaoDia += comissao;

        if (!barbeiros[nomeBarbeiro].servicosDetalhados[nome])
          barbeiros[nomeBarbeiro].servicosDetalhados[nome] = 0;

        barbeiros[nomeBarbeiro].servicosDetalhados[nome]++;

        if (!dias[data].servicosDetalhados[nome])
          dias[data].servicosDetalhados[nome] = 0;

        dias[data].servicosDetalhados[nome]++;
      }

      barbeiros[nomeBarbeiro].produtosVendidos += products.length;
      dias[data].produtosVendidos += products.length;
      produtosVendidos += products.length;

    }

        const barbeirosFormatados = Object.values(barbeiros).map((b) => ({
      ...b,
      servicosDetalhados: Object.entries(b.servicosDetalhados).map(([nome, quantidade]) => ({
        nome,
        quantidade,
      })),
    }));

    const diasFormatados = Object.values(dias).map((d) => ({
      ...d,
      servicosDetalhados: Object.entries(d.servicosDetalhados).map(([nome, quantidade]) => ({
        nome,
        quantidade,
      })),
    }));

    res.json({
      totalPeriodo,
      comissaoPeriodo,
      produtosVendidos,
      barbeiros: barbeirosFormatados,
      dias: diasFormatados
    });

  } catch (error) {

    console.error(error);
    res.status(500).json({ error: "Erro no relatório dos barbeiros" });

  }

});

/* ======================
   DASHBOARD
====================== */

app.get("/daily-report", auth, ownerOuManager, async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const shopId = obterShopIdDaRequisicao(req);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    let inicio;
    let fim;

    if (startDate || endDate) {
      inicio = startDate ? new Date(`${startDate}T00:00:00`) : new Date("2000-01-01T00:00:00");
      fim = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();
    } else {
      const dataBase = date || new Date().toISOString().slice(0, 10);
      inicio = new Date(`${dataBase}T00:00:00`);
      fim = new Date(`${dataBase}T23:59:59.999`);
    }

    const sales = await Sale.find({
      shop: shopId,
      date: {
        $gte: inicio,
        $lte: fim,
      },
    })
      .populate("services")
      .populate("products");

    let total = 0;
    let quantidadeVendas = 0;
    let totalServicos = 0;
    let totalProdutos = 0;
    let pix = 0;
    let dinheiro = 0;
    let debito = 0;
    let credito = 0;

    for (const sale of sales) {
      const valor = Number(sale.total || 0);
      const listaServicos = Array.isArray(sale.services) ? sale.services : [];
      const listaProdutos = Array.isArray(sale.products) ? sale.products : [];

      total += valor;
      quantidadeVendas += 1;
      totalServicos += listaServicos.length;
      totalProdutos += listaProdutos.length;

      if (sale.paymentMethod === "PIX") pix += valor;
      if (sale.paymentMethod === "DINHEIRO") dinheiro += valor;
      if (sale.paymentMethod === "DEBITO") debito += valor;
      if (sale.paymentMethod === "CREDITO") credito += valor;
    }

    return res.json({
      total,
      quantidadeVendas,
      totalServicos,
      totalProdutos,
      pix,
      dinheiro,
      debito,
      credito,
      inicio,
      fim,
    });
  } catch (error) {
    console.error("Erro em GET /daily-report:", error);
    return res.status(500).json({ error: "Erro ao gerar dashboard" });
  }
});

/* ======================
   RANKING
====================== */

app.get("/ranking", auth, ownerOuManager, async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const shopId = obterShopIdDaRequisicao(req);

    if (!shopId) {
      return res.status(400).json({ error: "Barbearia não informada" });
    }

    let inicio;
    let fim;

    if (startDate || endDate) {
      inicio = startDate ? new Date(`${startDate}T00:00:00`) : new Date("2000-01-01T00:00:00");
      fim = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();
    } else {
      const dataBase = date || new Date().toISOString().slice(0, 10);
      inicio = new Date(`${dataBase}T00:00:00`);
      fim = new Date(`${dataBase}T23:59:59.999`);
    }

    const sales = await Sale.find({
      shop: shopId,
      date: {
        $gte: inicio,
        $lte: fim,
      },
    }).populate("barber");

    const ranking = {};

    for (const sale of sales) {
      if (!sale.barber) continue;

      const nome = sale.barber.nome || "Sem barbeiro";

      if (!ranking[nome]) {
        ranking[nome] = 0;
      }

      ranking[nome] += Number(sale.total || 0);
    }

    const lista = Object.entries(ranking)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    return res.json(lista);
  } catch (error) {
    console.error("Erro em GET /ranking:", error);
    return res.status(500).json({ error: "Erro ao gerar ranking" });
  }
});

/* ======================
   INICIAR SERVIDOR
====================== */

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB conectado");

    await criarDadosIniciais();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar servidor:", error);
    process.exit(1);
  }
}

startServer();