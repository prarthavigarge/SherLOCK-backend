const cors=require("cors");
const mongoose=require("mongoose");
require("dotenv").config();
const express = require("express");
const Criminal = require("./models/criminal.js");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, auth-token"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }
  next();
});

app.use(cors());

app.get("/", (req, res) => {
  return res.status(200).json({
    message: "Server is up and running",
  });
});
const port = process.env.PORT || 3000;

app.listen(port, async () => {
  await mongoose
    .connect(process.env.DBURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      Criminal.init();
      console.log("Database Connected");
    })
    .catch((err) => {
      console.log(`Database error >> ${err.toString()}`);
    });

  mongoose.Promise = global.Promise;
  console.log(`Server is running on port ${port}`);
});