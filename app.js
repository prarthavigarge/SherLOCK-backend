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
const multerS3 = require("multer-s3");

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

var uploadS3 = multer({
  storage: multerS3({
    s3,
    bucket: "prarthavi-bucket/sherLOCK",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + "." + file.mimetype.split("/")[1]);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 5,
  },
  fileFilter: fileFilter,
});

const getAllCriminals = () =>{
  return Criminal.find({});
}

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

      const criminals= await getAllCriminals();

        let flag = true;
        for (let i = 0; i < criminals.length; i++) {
          const key = criminals[i].imageKey;
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

const getDangerLevel = (crimes) => {
  let level = 0;
  let lowLevelCrimes = 0;
  let mediumLevelCrimes = 0;
  let highLevelCrimes = 0;
  for (let i = 0; i < crimes.length; i++) {
    let crime = crimes[i].toLowerCase();
    if (crime.includes("rape") || crime.includes("harrasement") || crime.includes("murder") || crime.includes("assault") || crime.includes("violence") || crime.includes("abuse") || crime.includes("kidnapping")) {
      highLevelCrimes += 1;
    }
    if(crime.includes("fraud") || crime.includes("scam") || crime.includes("bribery") || crime.includes("theft") || crime.includes("burglary") || crime.includes("robbery") || crime.includes("embezzlement") || crime.includes("extortion")) {
      mediumLevelCrimes += 1;
    }
    if(crime.includes("theft") || crime.includes("vandalism") || crime.includes("stolen goods") || crime.includes("drugs") || crime.includes("traffic") || crime.includes("trespassing")){
      lowLevelCrimes += 1;
    }
  }
  if(highLevelCrimes > 0) {
    level = 90;
  } else if(mediumLevelCrimes > 0) {
    level = 40;
    mediumLevelCrimes -= 1;
  } else if(lowLevelCrimes > 0) {
    level = 20;
    lowLevelCrimes -= 1;
  }

  while(mediumLevelCrimes > 0 && level < 80) {
      level += 10;
      mediumLevelCrimes -= 1;
  }

  while(lowLevelCrimes > 0 && level < 60) {
      level += 5;
      lowLevelCrimes -= 1;
  }

  if(highLevelCrimes > 1){
    level = 100;
  }
  return level;
};

app.post("/uploadCriminal", uploadS3.single("file"), async (req, res) => {
  const { name, dob, address, crimes } = req.body;
  if (!name || !dob || !address || !crimes) {
    return res.status(400).json({
      message: "Please provide all the details",
    });
  }
  const dangerLevel = getDangerLevel(crimes);
  try {
    const uploadSingle = uploadS3.single("file");
    uploadSingle(req, res, async (err) => {
      if (err) {
        console.log(err);
        return res.send({
          success: false,
        });
      } else {
        console.log("Image uploaded successfully");
        const criminal = new Criminal({
          name,
          dob,
          address,
          crimes,
          dangerLevel,
          imageKey: req.file.key,
        });
        await criminal.save();
        return res.send({
          message: "Criminal Added",
          criminal
        });
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: err.toString(),
    });
  }
});

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