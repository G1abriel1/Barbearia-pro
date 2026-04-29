const mongoose = require("mongoose");

const ServiceTypeSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },

  preco: {
    type: Number,
    required: true
  },

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true
  }
});

module.exports = mongoose.model("ServiceType", ServiceTypeSchema);