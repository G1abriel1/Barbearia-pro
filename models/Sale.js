const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema({

barber:{
type:mongoose.Schema.Types.ObjectId,
ref:"Barber"
},

services:[{
type:mongoose.Schema.Types.ObjectId,
ref:"Service"
}],

products:[{
type:mongoose.Schema.Types.ObjectId,
ref:"Product"
}],

paymentMethod:{
type:String
},

total:{
type:Number
},

date:{
type:Date,
default:Date.now
}

})

module.exports = mongoose.model("Sale", SaleSchema);