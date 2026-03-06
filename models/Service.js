const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema({

nome: {
type: String,
required: true
},

preco: {
type: Number,
required: true
}

})

module.exports = mongoose.model("Service", ServiceSchema);