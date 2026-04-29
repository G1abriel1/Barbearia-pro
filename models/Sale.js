const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
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
      ref: "ServiceType",
    },
  ],

  drinks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drink",
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
    required: true,
  },

  total: {
    type: Number,
    required: true,
  },

  gorjeta: {
    type: Number,
    default: 0,
  },

  data: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("Sale", saleSchema);