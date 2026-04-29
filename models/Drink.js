const mongoose = require("mongoose");

const drinkSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  preco: { type: Number, required: true },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
});

module.exports = mongoose.model("Drink", drinkSchema);