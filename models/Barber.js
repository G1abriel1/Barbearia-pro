const mongoose = require("mongoose");

const BarberSchema = new mongoose.Schema({

nome: {
type: String,
required: true
},

comissao: {
type: Number,
required: true
},

ativo: {
type: Boolean,
default: true
}

})

module.exports = mongoose.model("Barber", BarberSchema);