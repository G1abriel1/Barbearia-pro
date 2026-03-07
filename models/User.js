const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    login: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    senhaHash: {
      type: String,
      required: true,
    },
    papel: {
      type: String,
      enum: ["owner", "manager"],
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);