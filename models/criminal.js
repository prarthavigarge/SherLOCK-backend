const mongoose = require("mongoose");

const criminalSchema = new mongoose.Schema({
    // Name of the criminal
    name: {
        type: String,
        required: true
    },
    // Date of Birth
    dob: {
        type: String,
        required: true
    },
    // Address of the criminal
    address: {
        type: String,
        required: true
    },
    // Key of the image of face of criminal in aws bucket
    imageKey: {
        type: String,
        required: true
    },
    // list of crimes convicted for
    crimes: [{
        type: String,
    }],
    // danger level computed
    dangerLevel: {
        type: Number,
        required: true
    }
})

module.exports = mongoose.model('Criminal', criminalSchema);