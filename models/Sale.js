const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    barber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
    },
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    paymentMethod: {
      type: String,
      enum: ["PIX", "DINHEIRO", "DEBITO", "CREDITO"],
      required: true,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    criadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    observacoes: {
      type: String,
      default: "",
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", SaleSchema);