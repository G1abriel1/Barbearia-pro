const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    preco: {
      type: Number,
      required: true,
      default: 0,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", ServiceSchema);