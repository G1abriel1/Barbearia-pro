require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");
const ADMIN_PASSWORD = "123456";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const Barber = require("./models/Barber");
const Service = require("./models/Service");
const Product = require("./models/Product");
const Sale = require("./models/Sale");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch((err) => console.log("Erro MongoDB:", err));

app.get("/", (req, res) => {
  res.send("Sistema Barbearia funcionando");
});

/* ======================
   BARBEIROS
====================== */

app.get("/barbers", async (req, res) => {
  try {
    const barbers = await Barber.find().sort({ nome: 1 });
    res.json(barbers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/barbers", async (req, res) => {
  try {
    const { nome, comissao } = req.body;

    const barber = new Barber({
      nome,
      comissao: Number(comissao),
    });

    await barber.save();
    res.json(barber);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/barbers/:id", async (req, res) => {
  try {
    await Barber.findByIdAndDelete(req.params.id);
    res.json({ message: "Barbeiro deletado com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   SERVIÇOS
====================== */

app.get("/services", async (req, res) => {
  try {
    const services = await Service.find().sort({ nome: 1 });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/services", async (req, res) => {
  try {
    const { nome, preco } = req.body;

    const service = new Service({
      nome,
      preco: Number(preco),
    });

    await service.save();
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/services/:id", async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: "Serviço deletado com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   PRODUTOS
====================== */

app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ nome: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/products", async (req, res) => {
  try {
    const { nome, preco } = req.body;

    const product = new Product({
      nome,
      preco: Number(preco),
    });

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Produto deletado com sucesso" });
  } catch (err) {
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

    if (barber) filtro.barber = barber;

    if (date) {
      const inicio = new Date(date);
      const fim = new Date(date);
      fim.setHours(23, 59, 59, 999);

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

    res.json(sales);
  } catch (err) {
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
      const inicio = startDate ? new Date(startDate + "T00:00:00") : new Date("2000-01-01T00:00:00");
      const fim = endDate ? new Date(endDate + "T23:59:59.999") : new Date();

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

    const vendas = sales.map((sale) => {
      total += Number(sale.total || 0);

      return {
        id: sale._id,
        barbeiro: sale.barber?.nome || "Sem barbeiro",
        servico: sale.services?.[0]?.nome || "Sem serviço",
        produto: sale.products?.[0]?.nome || "",
        valor: Number(sale.total || 0),
        pagamento: sale.paymentMethod || "",
        data: sale.date,
      };
    });

    res.json({
      total,
      vendas,
      filtroRecebido: { barber, startDate, endDate }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   RELATÓRIO BARBEIROS
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
        ? new Date(startDate + "T00:00:00")
        : new Date("2000-01-01T00:00:00");

      const fim = endDate
        ? new Date(endDate + "T23:59:59.999")
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

    sales.forEach((sale) => {
      if (!sale.barber) return;

      const id = sale.barber._id.toString();

      if (!resultado[id]) {
        resultado[id] = {
          barbeiro: sale.barber.nome,
          servicos: 0,
          faturamento: 0,
          comissao: 0,
          produtos: 0,
        };
      }

      sale.services.forEach((service) => {
        const valorServico = Number(service?.preco || 0);

        resultado[id].servicos += 1;
        resultado[id].faturamento += valorServico;
        resultado[id].comissao +=
          valorServico * ((Number(sale.barber.comissao) || 0) / 100);
      });

      resultado[id].produtos += sale.products.length;
    });

    res.json(Object.values(resultado));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ======================
   DASHBOARD DO DIA
====================== */

app.get("/daily-report", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const inicio = new Date(date);
    const fim = new Date(date);
    fim.setHours(23, 59, 59, 999);

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

    sales.forEach((sale) => {
      const valor = Number(sale.total || 0);

      total += valor;
      quantidadeVendas += 1;
      totalServicos += sale.services.length;
      totalProdutos += sale.products.length;

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
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   RANKING
====================== */

app.get("/ranking", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const inicio = new Date(date);
    const fim = new Date(date);
    fim.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      date: {
        $gte: inicio,
        $lte: fim,
      },
    }).populate("barber");

    const ranking = {};

    sales.forEach((sale) => {
      if (!sale.barber) return;

      const nome = sale.barber.nome;

      if (!ranking[nome]) ranking[nome] = 0;

      ranking[nome] += Number(sale.total || 0);
    });

    const lista = Object.entries(ranking)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/status", (req, res) => {
  res.json({
    status: "online",
    message: "Sistema da barbearia funcionando",
    time: new Date(),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
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
    res.status(500).json({ error: err.message });
  }
});