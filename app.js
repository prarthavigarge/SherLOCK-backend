require("@tensorflow/tfjs-node");
require("dotenv").config();
const faceapi = require("@vladmandic/face-api");
const AWS = require("aws-sdk");
const axios = require("axios");
const canvas = require("canvas");
const cors= require("cors");
const multer= require("multer");
const mongoose= require("mongoose");
const express = require("express");
const Criminal = require("./models/criminal.js");

var s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  signatureVersion: "v4",
  region: "ap-south-1",
});

const app = express();

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ limit: '50mb'}));

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

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const storage = multer.memoryStorage();

var upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5,
  },
});

app.get("/", (req, res) => {
  return res.status(200).json({
    message: "Server is up and running",
  });
});

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const faceDetectionOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

app.post("/findCriminal", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      console.log("No file received");
      return res.send({
        success: false,
        mesage: "No file received by the server"
      });
    } else {
      console.log("File received");
      const buffer = req.file.buffer;

      const image = await canvas.loadImage(buffer);
      // detect the faces with landmarks
      const results = await faceapi
        .detectSingleFace(image, faceDetectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      const faceMatcher = new faceapi.FaceMatcher(results);

      const criminals= ["WhatsApp Image 2022-05-27 at 7.19.54 PM.jpeg","WhatsApp Image 2022-05-27 at 7.22.43 PM.jpeg"];

        let flag = true;
        for (let i = 0; i < criminals.length; i++) {
          const key = criminals[i];
          var url = s3.getSignedUrl("getObject", {
            Bucket: "prarthavi-bucket/sherLOCK",
            Key: key,
          });
          const response = await axios.get(url, {
            responseType: "arraybuffer",
          });
          const imgBuffer = Buffer.from(response.data, "utf-8");
          const img2 = await canvas.loadImage(imgBuffer);
          const img2Results = await faceapi
            .detectSingleFace(img2, faceDetectionOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (img2Results) {
            const match = faceMatcher.findBestMatch(img2Results.descriptor);
            if (match.distance < 0.55) {
              flag = false;
              console.log("Match found");
              return res.send({
                match: true,
                image: url,
                criminal: criminals[i],
              });
            }
          }
        }
        if (flag) {
          console.log("No match found");
          return res.send({
            success: true,
            match: false,
            message: "No match found",
          });
        } 
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: err.toString(),
    });
  }
})

const port = process.env.PORT || 3000;


app.listen(port, async () => {

  await faceapi.nets.ssdMobilenetv1.loadFromDisk("weights");
  await faceapi.nets.faceRecognitionNet.loadFromDisk("weights");
  await faceapi.nets.faceLandmark68Net.loadFromDisk("weights");
  console.log("Model Loaded");
  
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