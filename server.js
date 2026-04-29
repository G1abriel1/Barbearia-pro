require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const Service = require("./models/Service");
const Barber = require("./models/Barber");
const ServiceType = require("./models/ServiceType");
const Product = require("./models/Product");
const Drink = require("./models/Drink");
const Sale = require("./models/Sale");
const Shop = require("./models/Shop");

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_barbearia";
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://barbeariacontorno:qwertyuiop@cluster0.wncvsnp.mongodb.net/barbearia?retryWrites=true&w=majority&appName=Cluster0";

const ACESSOS_FIXOS = [
  {
    login: "gabriel",
    senha: "34229233",
    nome: "Gabriel",
    papel: "owner",
    shopNome: null,
  },
  {
    login: "barbearia contorno",
    senha: "7434",
    nome: "Barbearia Contorno",
    papel: "manager",
    shopNome: "barbearia contorno",
  },
  {
    login: "barbearia grao mogol",
    senha: "112233",
    nome: "Barbearia Grao Mogol",
    papel: "manager",
    shopNome: "barbearia grao mogol",
  },
];

function normalizarTexto(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseDataBR(valor) {
  if (!valor) return null;

  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split("/").map(Number);
    return new Date(ano, mes - 1, dia);
  }

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data;
}

function inicioDoDia(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimDoDia(data) {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
}

function obterDatas(req) {
  const hoje = new Date();
  const startDate = parseDataBR(req.query.startDate) || hoje;
  const endDate = parseDataBR(req.query.endDate) || hoje;

  return {
    inicio: inicioDoDia(startDate),
    fim: fimDoDia(endDate),
  };
}

function getUserShopId(req) {
  return req.user?.shop ? String(req.user.shop) : "";
}

function getRequestedShop(req) {
  return (
    req.query?.shop ||
    req.body?.shop ||
    req.user?.shop ||
    null
  );
}

function getFiltroShop(req) {
  const shop = getRequestedShop(req);

  if (!shop) {
    return {};
  }

  return { shop };
}


function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Token não informado." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

function somenteOwner(req, res, next) {
  if (req.user?.papel !== "owner") {
    return res.status(403).json({ error: "Acesso permitido somente ao dono." });
  }
  next();
}

async function buscarShopPorNome(nome) {
  const shops = await Shop.find();
  return (
    shops.find((s) => normalizarTexto(s.nome) === normalizarTexto(nome)) || null
  );
}

function totalItens(lista) {
  if (!Array.isArray(lista)) return 0;
  return lista.length;
}

function montarVendaDetalhada(venda) {
  const barberNome = venda.barber?.nome || venda.barberName || "";

  const servicos = Array.isArray(venda.services)
    ? venda.services.map((s) => s.nome || "").filter(Boolean)
    : [];

  const produtos = Array.isArray(venda.products)
    ? venda.products.map((p) => p.nome || "").filter(Boolean)
    : [];

  const bebidas = Array.isArray(venda.drinks)
    ? venda.drinks.map((d) => d.nome || "").filter(Boolean)
    : [];

  return {
    id: venda._id,
    barbeiro: barberNome,
    servicos,
    produtos,
    bebidas,
    pagamento: venda.paymentMethod || "",
    valor: Number(venda.total || 0),
    gorjeta: Number(venda.gorjeta || 0),
    data: venda.data || venda.createdAt || new Date(),
  };
}

async function gerarRelatorioBarbeiros(req, res) {
  try {
    const { inicio, fim } = obterDatas(req);

    const filtro = {
      ...getFiltroShop(req),
      data: { $gte: inicio, $lte: fim },
    };

    if (req.query.barber && req.query.barber !== "Todos") {
      filtro.barber = req.query.barber;
    }

    const vendas = await Sale.find(filtro)
      .populate("barber")
      .populate("services")
      .populate("products")
      .populate("drinks")
      .sort({ data: 1 });

    let totalPeriodo = 0;
    let comissaoPeriodo = 0;
    let totalGorjetas = 0;
    let produtosVendidos = 0;

    const barbeirosMap = {};
    const diasMap = {};

    vendas.forEach((venda) => {
      const barberId = String(venda.barber?._id || "sem-barbeiro");
      const barberNome =
        venda.barber?.nome || venda.barberName || "Sem barbeiro";

      const dataBase = new Date(venda.data || venda.createdAt || new Date());
      const diaChave = dataBase.toISOString().slice(0, 10);

      const servicos = Array.isArray(venda.services) ? venda.services : [];
      const produtos = Array.isArray(venda.products) ? venda.products : [];

      const gorjetaVenda = Number(venda.gorjeta || 0);
      const comissaoBarbeiro = Number(venda.barber?.comissao || 0);

      const totalServicosVenda = servicos.reduce((acc, servico) => {
        return acc + Number(servico.preco || 0);
      }, 0);

      const valorComissao = totalServicosVenda * (comissaoBarbeiro / 100);

      totalPeriodo += totalServicosVenda;
      totalGorjetas += gorjetaVenda;
      comissaoPeriodo += valorComissao;
      produtosVendidos += produtos.length;

      if (!barbeirosMap[barberId]) {
        barbeirosMap[barberId] = {
          barbeiro: barberNome,
          totalPeriodo: 0,
          comissaoPeriodo: 0,
          gorjetas: 0,
          produtosVendidos: 0,
          servicosDetalhadosMap: {},
        };
      }

      barbeirosMap[barberId].totalPeriodo += totalServicosVenda;
      barbeirosMap[barberId].comissaoPeriodo += valorComissao;
      barbeirosMap[barberId].gorjetas += gorjetaVenda;
      barbeirosMap[barberId].produtosVendidos += produtos.length;

      servicos.forEach((servico) => {
        const chaveServico = servico.nome || "Serviço";
        if (!barbeirosMap[barberId].servicosDetalhadosMap[chaveServico]) {
          barbeirosMap[barberId].servicosDetalhadosMap[chaveServico] = 0;
        }
        barbeirosMap[barberId].servicosDetalhadosMap[chaveServico] += 1;
      });

      if (!diasMap[diaChave]) {
        diasMap[diaChave] = {
          data: diaChave,
          totalDia: 0,
          comissaoDia: 0,
          gorjetas: 0,
          produtosVendidos: 0,
          servicosDetalhadosMap: {},
        };
      }

      diasMap[diaChave].totalDia += totalServicosVenda;
      diasMap[diaChave].comissaoDia += valorComissao;
      diasMap[diaChave].gorjetas += gorjetaVenda;
      diasMap[diaChave].produtosVendidos += produtos.length;

      servicos.forEach((servico) => {
        const chaveServico = servico.nome || "Serviço";
        if (!diasMap[diaChave].servicosDetalhadosMap[chaveServico]) {
          diasMap[diaChave].servicosDetalhadosMap[chaveServico] = 0;
        }
        diasMap[diaChave].servicosDetalhadosMap[chaveServico] += 1;
      });
    });

    const barbeiros = Object.values(barbeirosMap).map((b) => ({
      barbeiro: b.barbeiro,
      totalPeriodo: b.totalPeriodo,
      comissaoPeriodo: b.comissaoPeriodo,
      gorjetas: b.gorjetas,
      produtosVendidos: b.produtosVendidos,
      servicosDetalhados: Object.entries(b.servicosDetalhadosMap).map(
        ([nome, quantidade]) => ({
          nome,
          quantidade,
        })
      ),
    }));

    const dias = Object.values(diasMap).map((d) => ({
      data: d.data,
      totalDia: d.totalDia,
      comissaoDia: d.comissaoDia,
      gorjetas: d.gorjetas,
      produtosVendidos: d.produtosVendidos,
      servicosDetalhados: Object.entries(d.servicosDetalhadosMap).map(
        ([nome, quantidade]) => ({
          nome,
          quantidade,
        })
      ),
    }));

    return res.json({
      sucesso: true,
      totalPeriodo,
      comissaoPeriodo,
      totalGorjetas,
      produtosVendidos,
      barbeiros,
      dias,
    });
  } catch (error) {
    console.error("Erro ao gerar relatório dos barbeiros:", error);
    return res.status(500).json({
      sucesso: false,
      error: "Erro ao gerar relatório dos barbeiros.",
      detalhe: error.message,
    });
  }
}

async function gerarRelatorioVendas(req, res) {
  try {
    const { inicio, fim } = obterDatas(req);

    const filtro = {
      ...getFiltroShop(req),
      data: { $gte: inicio, $lte: fim },
    };

    if (req.query.barber && req.query.barber !== "Todos") {
      filtro.barber = req.query.barber;
    }

    const vendas = await Sale.find(filtro)
      .populate("barber")
      .populate("services")
      .populate("products")
      .populate("drinks")
      .sort({ data: -1, createdAt: -1 });

    const vendasFormatadas = vendas.map(montarVendaDetalhada);

    return res.json({
      sucesso: true,
      vendas: vendasFormatadas,
    });
  } catch (error) {
    console.error("Erro ao gerar relatório de vendas:", error);
    return res.status(500).json({
      sucesso: false,
      error: "Erro ao gerar relatório de vendas.",
      detalhe: error.message,
    });
  }
}

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Banco conectado");

    app.post("/auth/login", async (req, res) => {
      try {
        const { login, senha } = req.body;

        if (!login || !senha) {
          return res.status(400).json({ error: "Informe login e senha." });
        }

        const acesso = ACESSOS_FIXOS.find(
          (item) =>
            normalizarTexto(item.login) === normalizarTexto(login) &&
            String(item.senha) === String(senha)
        );

        if (!acesso) {
          return res.status(401).json({ error: "Login ou senha inválidos." });
        }

        let shop = null;

        if (acesso.shopNome) {
          shop = await buscarShopPorNome(acesso.shopNome);
        }

        const payload = {
          nome: acesso.nome,
          login: acesso.login,
          papel: acesso.papel,
          shop: shop ? String(shop._id) : null,
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

        return res.json({
          token,
          usuario: {
            nome: acesso.nome,
            login: acesso.login,
            papel: acesso.papel,
            shop: shop
              ? {
                  _id: shop._id,
                  id: shop._id,
                  nome: shop.nome,
                }
              : null,
          },
        });
      } catch (error) {
        console.error("Erro no login:", error);
        return res.status(500).json({ error: "Erro ao fazer login." });
      }
    });

    app.get("/shops", auth, async (req, res) => {
      try {
        const shops = await Shop.find().sort({ nome: 1 });
        res.json(shops);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao listar barbearias." });
      }
    });

    app.get("/barbers", auth, async (req, res) => {
      try {
        const filtro = getFiltroShop(req);
        const barbeiros = await Barber.find(filtro).sort({ nome: 1 });
        res.json(barbeiros);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao listar barbeiros." });
      }
    });

    app.post("/barbers", auth, somenteOwner, async (req, res) => {
      try {
        const { nome, comissao, shop } = req.body;

        if (!nome || !shop) {
          return res
            .status(400)
            .json({ error: "Nome e barbearia são obrigatórios." });
        }

        const barbeiro = new Barber({
          nome,
          comissao: Number(comissao || 0),
          shop,
        });

        await barbeiro.save();
        res.json(barbeiro);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao cadastrar barbeiro." });
      }
    });

    app.delete("/barbers/:id", auth, somenteOwner, async (req, res) => {
      try {
        await Barber.findByIdAndDelete(req.params.id);
        res.json({ sucesso: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao apagar barbeiro." });
      }
    });

    app.get("/services", auth, async (req, res) => {
      try {
        const filtro = getFiltroShop(req);
        const servicos = await ServiceType.find(filtro).sort({ nome: 1 });
        res.json(servicos);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao listar serviços." });
      }
    });

    app.post("/services", auth, somenteOwner, async (req, res) => {
      try {
        const { nome, preco, shop } = req.body;

        if (!nome || preco === undefined || !shop) {
          return res
            .status(400)
            .json({ error: "Nome, preço e barbearia são obrigatórios." });
        }

        const servico = new ServiceType({
          nome,
          preco: Number(preco),
          shop,
        });

        await servico.save();
        res.json(servico);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao cadastrar serviço." });
      }
    });

    app.delete("/services/:id", auth, somenteOwner, async (req, res) => {
      try {
        await ServiceType.findByIdAndDelete(req.params.id);
        res.json({ sucesso: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao apagar serviço." });
      }
    });

    app.get("/products", auth, async (req, res) => {
      try {
        const filtro = getFiltroShop(req);
        const produtos = await Product.find(filtro).sort({ nome: 1 });
        res.json(produtos);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao listar produtos." });
      }
    });

    app.post("/products", auth, somenteOwner, async (req, res) => {
      try {
        const { nome, preco, shop } = req.body;

        if (!nome || preco === undefined || !shop) {
          return res
            .status(400)
            .json({ error: "Nome, preço e barbearia são obrigatórios." });
        }

        const produto = new Product({
          nome,
          preco: Number(preco),
          shop,
        });

        await produto.save();
        res.json(produto);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao cadastrar produto." });
      }
    });

    app.delete("/products/:id", auth, somenteOwner, async (req, res) => {
      try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ sucesso: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao apagar produto." });
      }
    });

    app.get("/drinks", auth, async (req, res) => {
      try {
        const filtro = getFiltroShop(req);
        const bebidas = await Drink.find(filtro).sort({ nome: 1 });
        res.json(bebidas);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao listar bebidas." });
      }
    });

    app.post("/drinks", auth, somenteOwner, async (req, res) => {
      try {
        const { nome, preco, shop } = req.body;

        if (!nome || preco === undefined || !shop) {
          return res
            .status(400)
            .json({ error: "Nome, preço e barbearia são obrigatórios." });
        }

        const bebida = new Drink({
          nome,
          preco: Number(preco),
          shop,
        });

        await bebida.save();
        res.json(bebida);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao cadastrar bebida." });
      }
    });

    app.delete("/drinks/:id", auth, somenteOwner, async (req, res) => {
      try {
        await Drink.findByIdAndDelete(req.params.id);
        res.json({ sucesso: true });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao apagar bebida." });
      }
    });

    app.get("/admin-data", auth, somenteOwner, async (req, res) => {
      try {
        const shop = req.query.shop;

        if (!shop) {
          return res.status(400).json({ error: "Selecione uma barbearia." });
        }

        const [barbers, services, products, drinks] = await Promise.all([
          Barber.find({ shop }).sort({ nome: 1 }),
          ServiceType.find({ shop }).sort({ nome: 1 }),
          Product.find({ shop }).sort({ nome: 1 }),
          Drink.find({ shop }).sort({ nome: 1 }),
        ]);

        res.json({ barbers, services, products, drinks });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao carregar dados administrativos." });
      }
    });

    app.post("/sales", auth, async (req, res) => {
      try {
        const {
          barber,
          services = [],
          drinks = [],
          products = [],
          paymentMethod,
          gorjeta,
          shop,
        } = req.body;

        const shopFinal = req.user.papel === "owner" ? shop : req.user.shop;

        if (!barber || !Array.isArray(services) || services.length === 0 || !paymentMethod) {
          return res
            .status(400)
            .json({ error: "Preencha os dados obrigatórios da venda." });
        }

        if (!shopFinal) {
          return res.status(400).json({ error: "Barbearia não informada." });
        }

        const barbeiroDb = await Barber.findOne({ _id: barber, shop: shopFinal });
        if (!barbeiroDb) {
          return res.status(404).json({ error: "Barbeiro não encontrado." });
        }

        const servicosDb = await ServiceType.find({
          _id: { $in: services },
          shop: shopFinal,
        });

        const produtosDb = await Product.find({
          _id: { $in: products },
          shop: shopFinal,
        });

        const bebidasDb = await Drink.find({
          _id: { $in: drinks },
          shop: shopFinal,
        });

        const totalServicos = servicosDb.reduce(
          (acc, item) => acc + Number(item.preco || 0),
          0
        );

        const totalProdutos = produtosDb.reduce(
          (acc, item) => acc + Number(item.preco || 0),
          0
        );

        const totalBebidas = bebidasDb.reduce(
          (acc, item) => acc + Number(item.preco || 0),
          0
        );

        const valorGorjeta = Number(gorjeta || 0);
        const total = totalServicos + totalProdutos + totalBebidas + valorGorjeta;

        const novaVenda = new Sale({
          shop: shopFinal,
          barber,
          services,
          drinks,
          products,
          paymentMethod,
          total,
          gorjeta: valorGorjeta,
          data: new Date(),
        });

        await novaVenda.save();

        return res.json({
          sucesso: true,
          mensagem: "Venda registrada com sucesso.",
          venda: novaVenda,
        });
      } catch (error) {
        console.error("❌ ERRO AO SALVAR VENDA:", error);
        return res.status(500).json({
          sucesso: false,
          error: "Erro ao salvar venda.",
          detalhe: error.message,
        });
      }
    });

    app.delete("/sales/:id", auth, async (req, res) => {
      try {
        const { id } = req.params;
        const filtroShop = getFiltroShop(req);

        const venda = await Sale.findOne({
          _id: id,
          ...filtroShop,
        });

        if (!venda) {
          return res.status(404).json({ error: "Venda não encontrada." });
        }

        await Sale.findByIdAndDelete(id);

        return res.json({
          sucesso: true,
          mensagem: "Venda apagada com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao apagar venda:", error);
        return res.status(500).json({
          sucesso: false,
          error: "Erro ao apagar venda.",
          detalhe: error.message,
        });
      }
    });

    app.get("/sales", auth, async (req, res) => {
      try {
        const filtro = getFiltroShop(req);

        const vendas = await Sale.find(filtro)
          .populate("barber")
          .populate("services")
          .populate("products")
          .populate("drinks")
          .sort({ data: -1, createdAt: -1 });

        const vendasFormatadas = vendas.map((venda) => ({
          _id: venda._id,
          barber: venda.barber,
          barberName: venda.barber?.nome || venda.barberName || "",
          services: venda.services || [],
          products: venda.products || [],
          drinks: venda.drinks || [],
          paymentMethod: venda.paymentMethod || "",
          total: Number(venda.total || 0),
          gorjeta: Number(venda.gorjeta || 0),
          data: venda.data || venda.createdAt || new Date(),
          createdAt: venda.createdAt || venda.data || new Date(),
        }));

        res.json(vendasFormatadas);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao listar vendas." });
      }
    });

    app.get("/relatorio", auth, gerarRelatorioVendas);
    app.get("/relatorios", auth, gerarRelatorioVendas);

    app.get("/relatorio-barbeiros", auth, gerarRelatorioBarbeiros);
    app.get("/relatorios-barbeiros", auth, gerarRelatorioBarbeiros);

    app.get("/daily-report", auth, async (req, res) => {
      try {
        const { inicio, fim } = obterDatas(req);

        const vendas = await Sale.find({
          ...getFiltroShop(req),
          data: { $gte: inicio, $lte: fim },
        });

        let total = 0;
        let totalGorjetas = 0;
        let quantidadeVendas = 0;
        let totalServicos = 0;
        let totalProdutos = 0;
        let totalBebidas = 0;
        let pix = 0;
        let dinheiro = 0;
        let debito = 0;
        let credito = 0;

        vendas.forEach((venda) => {
          const totalVenda = Number(venda.total || 0);
          const gorjetaVenda = Number(venda.gorjeta || 0);

          total += totalVenda;
          totalGorjetas += gorjetaVenda;
          quantidadeVendas += 1;
          totalServicos += totalItens(venda.services);
          totalProdutos += totalItens(venda.products);
          totalBebidas += totalItens(venda.drinks);

          if (venda.paymentMethod === "PIX") pix += totalVenda;
          if (venda.paymentMethod === "DINHEIRO") dinheiro += totalVenda;
          if (venda.paymentMethod === "DEBITO") debito += totalVenda;
          if (venda.paymentMethod === "CREDITO") credito += totalVenda;
        });

        res.json({
          total,
          totalGorjetas,
          quantidadeVendas,
          totalServicos,
          totalProdutos,
          totalBebidas,
          pix,
          dinheiro,
          debito,
          credito,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao gerar dashboard." });
      }
    });

    app.get("/ranking", auth, async (req, res) => {
      try {
        const { inicio, fim } = obterDatas(req);

        const vendas = await Sale.find({
          ...getFiltroShop(req),
          data: { $gte: inicio, $lte: fim },
        }).populate("barber");

        const rankingMap = {};

        vendas.forEach((venda) => {
          const barberId = String(venda.barber?._id || "sem-barbeiro");
          const barberNome = venda.barber?.nome || "Sem barbeiro";

          if (!rankingMap[barberId]) {
            rankingMap[barberId] = {
              nome: barberNome,
              total: 0,
              vendas: 0,
            };
          }

          rankingMap[barberId].total += Number(venda.total || 0);
          rankingMap[barberId].vendas += 1;
        });

        const ranking = Object.values(rankingMap).sort((a, b) => b.total - a.total);
        res.json(ranking);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao gerar ranking." });
      }
    });

    app.post("/servicos", async (req, res) => {
      try {
        const { barbeiroId, servicoId, valor, formaPagamento, gorjeta } = req.body;

        if (!barbeiroId || !servicoId || valor === undefined || !formaPagamento) {
          return res.status(400).json({ erro: "Todos os campos são obrigatórios" });
        }

        const valorNumerico = Number(valor);
        const gorjetaNumerica = Number(gorjeta || 0);
        const valorTotal = valorNumerico + gorjetaNumerica;

        const novoServico = new Service({
          barbeiro: barbeiroId,
          servico: servicoId,
          valor: valorTotal,
          gorjeta: gorjetaNumerica,
          formaPagamento,
          data: new Date(),
        });

        await novoServico.save();

        res.json({
          sucesso: true,
          mensagem: "Venda registrada com sucesso",
          venda: novoServico,
        });
      } catch (err) {
        console.error("❌ ERRO AO SALVAR:", err);
        res.status(500).json({ erro: err.message });
      }
    });

    app.get("/servicos", async (req, res) => {
      try {
        const vendas = await Service.find()
          .populate("barbeiro")
          .populate("servico")
          .sort({ data: -1 });

        res.json(vendas);
      } catch (err) {
        console.error(err);
        res.status(500).json({ erro: err.message });
      }
    });

    app.get("/barbeiros", async (req, res) => {
      try {
        const barbeiros = await Barber.find();
        res.json(barbeiros);
      } catch (err) {
        res.status(500).json({ erro: err.message });
      }
    });

    app.get("/tipos-servico", async (req, res) => {
      try {
        const servicos = await ServiceType.find();
        res.json(servicos);
      } catch (err) {
        res.status(500).json({ erro: err.message });
      }
    });

    app.listen(PORT, () => {
      console.log("🚀 Servidor rodando:");
      console.log(`http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro ao conectar ao MongoDB:", err);
  }
}

start();