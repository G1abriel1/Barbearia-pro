const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema({
  barbeiro: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Barber",
    required: true,
  },
  servico: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceType",
    required: true,
  },
  valor: {
    type: Number,
    required: true,
  },
  gorjeta: {
    type: Number,
    default: 0,
  },
  formaPagamento: {
    type: String,
    required: true,
  },
  data: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Service", ServiceSchema);