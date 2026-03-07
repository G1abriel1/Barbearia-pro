const path = require("path");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");

const app = express();

const Barber = require("./models/Barber");
const Service = require("./models/Service");
const Product = require("./models/Product");
const Sale = require("./models/Sale");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ======================
   CONEXÃO MONGODB
====================== */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => console.log("❌ Erro MongoDB:", err));

/* ======================
   ROTA INICIAL
====================== */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ======================
   STATUS
====================== */

app.get("/status", (req, res) => {
  res.json({
    status: "online",
    message: "Sistema da barbearia funcionando",
    time: new Date(),
  });
});

/* ======================
   BARBEIROS
====================== */

app.get("/barbers", async (req, res) => {
  try {
    const barbers = await Barber.find().sort({ nome: 1 });
    res.json(Array.isArray(barbers) ? barbers : []);
  } catch (err) {
    console.error("Erro em /barbers:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/barbers", async (req, res) => {
  try {
    const { nome, comissao } = req.body;

    if (!nome || comissao === undefined || comissao === null) {
      return res.status(400).json({
        error: "Nome e comissão são obrigatórios",
      });
    }

    const barber = new Barber({
      nome: String(nome).trim(),
      comissao: Number(comissao),
    });

    await barber.save();
    res.json(barber);
  } catch (err) {
    console.error("Erro em POST /barbers:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/barbers/:id", async (req, res) => {
  try {
    await Barber.findByIdAndDelete(req.params.id);
    res.json({ message: "Barbeiro deletado com sucesso" });
  } catch (err) {
    console.error("Erro em DELETE /barbers/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   SERVIÇOS
====================== */

app.get("/services", async (req, res) => {
  try {
    const services = await Service.find().sort({ nome: 1 });
    res.json(Array.isArray(services) ? services : []);
  } catch (err) {
    console.error("Erro em /services:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/services", async (req, res) => {
  try {
    const { nome, preco } = req.body;

    if (!nome || preco === undefined || preco === null) {
      return res.status(400).json({
        error: "Nome e preço são obrigatórios",
      });
    }

    const service = new Service({
      nome: String(nome).trim(),
      preco: Number(preco),
    });

    await service.save();
    res.json(service);
  } catch (err) {
    console.error("Erro em POST /services:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/services/:id", async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: "Serviço deletado com sucesso" });
  } catch (err) {
    console.error("Erro em DELETE /services/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   PRODUTOS
====================== */

app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ nome: 1 });
    res.json(Array.isArray(products) ? products : []);
  } catch (err) {
    console.error("Erro em /products:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/products", async (req, res) => {
  try {
    const { nome, preco } = req.body;

    if (!nome || preco === undefined || preco === null) {
      return res.status(400).json({
        error: "Nome e preço são obrigatórios",
      });
    }

    const product = new Product({
      nome: String(nome).trim(),
      preco: Number(preco),
    });

    await product.save();
    res.json(product);
  } catch (err) {
    console.error("Erro em POST /products:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Produto deletado com sucesso" });
  } catch (err) {
    console.error("Erro em DELETE /products/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   REGISTRAR VENDA
====================== */

app.post("/sales", async (req, res) => {
  try {
    const { barber, service, product, paymentMethod } = req.body;

    if (!barber || !service || !paymentMethod) {
      return res.status(400).json({
        error: "Barbeiro, serviço e forma de pagamento são obrigatórios",
      });
    }

    const barberDoc = await Barber.findById(barber);
    if (!barberDoc) {
      return res.status(404).json({ error: "Barbeiro não encontrado" });
    }

    const serviceDoc = await Service.findById(service);
    if (!serviceDoc) {
      return res.status(404).json({ error: "Serviço não encontrado" });
    }

    let products = [];
    let total = Number(serviceDoc.preco) || 0;

    if (product) {
      const productDoc = await Product.findById(product);
      if (productDoc) {
        products.push(productDoc._id);
        total += Number(productDoc.preco) || 0;
      }
    }

    const sale = new Sale({
      barber,
      services: [service],
      products,
      paymentMethod,
      total,
      date: new Date(),
    });

    await sale.save();

    const savedSale = await Sale.findById(sale._id)
      .populate("barber")
      .populate("services")
      .populate("products");

    res.json(savedSale);
  } catch (err) {
    console.error("Erro em POST /sales:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   LISTAR VENDAS
====================== */

app.get("/sales", async (req, res) => {
  try {
    const { barber, date } = req.query;
    const filtro = {};

    if (barber) {
      filtro.barber = barber;
    }

    if (date) {
      const inicio = new Date(`${date}T00:00:00`);
      const fim = new Date(`${date}T23:59:59.999`);

      filtro.date = {
        $gte: inicio,
        $lte: fim,
      };
    }

    const sales = await Sale.find(filtro)
      .populate("barber")
      .populate("services")
      .populate("products")
      .sort({ date: -1 });

    res.json(Array.isArray(sales) ? sales : []);
  } catch (err) {
    console.error("Erro em GET /sales:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   RELATÓRIO DE VENDAS
====================== */

app.get("/relatorio", async (req, res) => {
  try {
    const { barber, startDate, endDate } = req.query;
    const filtro = {};

    if (barber) {
      filtro.barber = barber;
    }

    if (startDate || endDate) {
      const inicio = startDate
        ? new Date(`${startDate}T00:00:00`)
        : new Date("2000-01-01T00:00:00");

      const fim = endDate
        ? new Date(`${endDate}T23:59:59.999`)
        : new Date();

      filtro.date = {
        $gte: inicio,
        $lte: fim,
      };
    }

    const sales = await Sale.find(filtro)
      .populate("barber")
      .populate("services")
      .populate("products")
      .sort({ date: -1 });

    let total = 0;

    const vendas = (sales || []).map((sale) => {
      const valor = Number(sale.total || 0);
      total += valor;

      return {
        id: sale._id,
        barbeiro: sale.barber?.nome || "Sem barbeiro",
        servico: sale.services?.[0]?.nome || "Sem serviço",
        produto: sale.products?.[0]?.nome || "",
        valor,
        pagamento: sale.paymentMethod || "",
        data: sale.date,
      };
    });

    res.json({
      total,
      vendas,
    });
  } catch (err) {
    console.error("Erro em GET /relatorio:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   RELATÓRIO DOS BARBEIROS
====================== */

app.get("/relatorio-barbeiros", async (req, res) => {
  try {
    const { barber, startDate, endDate } = req.query;
    const filtro = {};

    if (barber) {
      filtro.barber = barber;
    }

    if (startDate || endDate) {
      const inicio = startDate
        ? new Date(`${startDate}T00:00:00`)
        : new Date("2000-01-01T00:00:00");

      const fim = endDate
        ? new Date(`${endDate}T23:59:59.999`)
        : new Date();

      filtro.date = {
        $gte: inicio,
        $lte: fim,
      };
    }

    const sales = await Sale.find(filtro)
      .populate("barber")
      .populate("services")
      .populate("products")
      .sort({ date: -1 });

    const resultado = {};

    (sales || []).forEach((sale) => {
      if (!sale.barber) return;

      const id = sale.barber._id.toString();

      if (!resultado[id]) {
        resultado[id] = {
          barbeiro: sale.barber.nome || "Sem nome",
          servicos: 0,
          faturamento: 0,
          comissao: 0,
          produtos: 0,
        };
      }

      const listaServicos = Array.isArray(sale.services) ? sale.services : [];
      const listaProdutos = Array.isArray(sale.products) ? sale.products : [];

      listaServicos.forEach((service) => {
        const valorServico = Number(service?.preco || 0);

        resultado[id].servicos += 1;
        resultado[id].faturamento += valorServico;
        resultado[id].comissao +=
          valorServico * ((Number(sale.barber.comissao) || 0) / 100);
      });

      resultado[id].produtos += listaProdutos.length;
    });

    res.json(Object.values(resultado));
  } catch (err) {
    console.error("Erro em GET /relatorio-barbeiros:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   DASHBOARD DO DIA
====================== */

app.get("/daily-report", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const inicio = new Date(`${date}T00:00:00`);
    const fim = new Date(`${date}T23:59:59.999`);

    const sales = await Sale.find({
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
    let cartao = 0;

    (sales || []).forEach((sale) => {
      const valor = Number(sale.total || 0);
      const listaServicos = Array.isArray(sale.services) ? sale.services : [];
      const listaProdutos = Array.isArray(sale.products) ? sale.products : [];

      total += valor;
      quantidadeVendas += 1;
      totalServicos += listaServicos.length;
      totalProdutos += listaProdutos.length;

      if (sale.paymentMethod === "PIX") pix += valor;
      if (sale.paymentMethod === "DINHEIRO") dinheiro += valor;
      if (sale.paymentMethod === "CARTAO") cartao += valor;
    });

    res.json({
      total,
      quantidadeVendas,
      totalServicos,
      totalProdutos,
      pix,
      dinheiro,
      cartao,
      data: date,
    });
  } catch (err) {
    console.error("Erro em GET /daily-report:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   RANKING
====================== */

app.get("/ranking", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const inicio = new Date(`${date}T00:00:00`);
    const fim = new Date(`${date}T23:59:59.999`);

    const sales = await Sale.find({
      date: {
        $gte: inicio,
        $lte: fim,
      },
    }).populate("barber");

    const ranking = {};

    (sales || []).forEach((sale) => {
      if (!sale.barber) return;

      const nome = sale.barber.nome || "Sem barbeiro";

      if (!ranking[nome]) {
        ranking[nome] = 0;
      }

      ranking[nome] += Number(sale.total || 0);
    });

    const lista = Object.entries(ranking)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    res.json(lista);
  } catch (err) {
    console.error("Erro em GET /ranking:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   APAGAR VENDA COM SENHA
====================== */

app.delete("/sales/:id", async (req, res) => {
  try {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Senha inválida" });
    }

    const sale = await Sale.findByIdAndDelete(req.params.id);

    if (!sale) {
      return res.status(404).json({ error: "Venda não encontrada" });
    }

    res.json({ message: "Venda apagada com sucesso" });
  } catch (err) {
    console.error("Erro em DELETE /sales/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   SERVIDOR
====================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});