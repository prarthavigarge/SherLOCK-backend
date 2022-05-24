const mongoose = require("mongoose");

const criminalSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    dob: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    imageKey: {
        type: String,
        required: true
    },
    crimes: [{
        type: String,
    }],
    dangerLevel: {
        type: Number,
        required: true
    }
})

module.exports = mongoose.model('Criminal', criminalSchema);