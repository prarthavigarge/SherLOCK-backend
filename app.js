//Support for tensorflow in node
require("@tensorflow/tfjs-node");
// Accessing Environment Variables
require("dotenv").config();
// Importing packages
const faceapi = require("@vladmandic/face-api");
const AWS = require("aws-sdk");
const axios = require("axios");
const canvas = require("canvas");
const cors= require("cors");
const multer= require("multer");
const mongoose= require("mongoose");
const express = require("express");
const multerS3 = require("multer-s3");

// Importing Entity Model
const Criminal = require("./models/criminal.js");


// Initializing AWS S3
var s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  signatureVersion: "v4",
  region: "ap-south-1",
});

const app = express();

// Setting app limits
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ limit: '50mb'}));


// Setting headers allowed
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

// Allowing cors
app.use(cors());

// Allowing only image mimetypes for upload to AWS
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


// Using memory (temporary) storage to access the file sent to server from frontend
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
    bucket: "prarthavi-bucket/sherLOCK", // My S3 Bucket with sherLOCK folder
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

// Utility function to get all criminals from the database
const getAllCriminals = () =>{
  return Criminal.find({});
}

// Route to check if server is up
app.get("/", (req, res) => {
  return res.status(200).json({
    message: "Server is up and running",
  });
});

// allows changes to the module while the program is running
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Sets the minimum confidence to the single shot detector to treat it as a success
const faceDetectionOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

// Route to match the given photo to the database
app.post("/findCriminal", upload.single("file"), async (req, res) => {
  try {
    // If no file is received, we return an appropriate message
    if (!req.file) {
      console.log("No file received");
      return res.send({
        success: false,
        mesage: "No file received by the server"
      });
    }
    // File is received 
    else {
      console.log("File received");
      // extracting data buffer from the file
      const buffer = req.file.buffer;
      // using the canvas module to construct an image from the buffer
      const image = await canvas.loadImage(buffer);
      // detect the faces with landmarks and descriptor
      // descriptors are compared later on to match faces
      const results = await faceapi
        .detectSingleFace(image, faceDetectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      // Initialize a face matcher 
      // this contains the data and required comparing methods that are defined in the package
      const faceMatcher = new faceapi.FaceMatcher(results);

      // Getting the list of all criminals
      const criminals= await getAllCriminals();
        // flag to check if no match was found
        let flag = true;
        // Iterating through the list of criminals
        for (let i = 0; i < criminals.length; i++) {
          const key = criminals[i].imageKey;
          // Generating a signedUrl of the image object to access it
          var url = s3.getSignedUrl("getObject", {
            Bucket: "prarthavi-bucket/sherLOCK",
            Key: key,
          });
          // Using axios to download the image
          const response = await axios.get(url, {
            responseType: "arraybuffer",
          });
          // extracting the buffer
          const imgBuffer = Buffer.from(response.data, "utf-8");
          // using the canvas module to construct an image from the buffer
          const img2 = await canvas.loadImage(imgBuffer);
          // Detect a face with landmarks and descriptors
          const img2Results = await faceapi
            .detectSingleFace(img2, faceDetectionOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();
          // If a face was detected
          if (img2Results) {
            // We find the best match to the previous uploaded face image
            const match = faceMatcher.findBestMatch(img2Results.descriptor);
            // lesser the distance more perfect the match
            if (match.distance < 0.55) {
              // changing the flag to false since match was found
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
        // returning appropriate response if no match was found
        if (flag) {
          console.log("No match found");
          return res.send({
            success: true,
            match: false,
            message: "No match found",
          });
        } 
    }
  } 
  // error catching block
  catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: err.toString(),
    });
  }
})

// function to iterate through the crimes and determine the danger level of the criminal
const getDangerLevel = (crimes) => {
  let level = 0; // initialized danger is 0
  // we divide the crimes into 3 categories
  let lowLevelCrimes = 0;
  let mediumLevelCrimes = 0;
  let highLevelCrimes = 0;
  // crimes are iterate
  for (let i = 0; i < crimes.length; i++) {
    let crime = crimes[i].toLowerCase();
    // HIGH LEVEL CRIMES
    // These are of the highest danger
    if (crime.includes("rape") || crime.includes("harrasement") || crime.includes("murder") || crime.includes("assault") || crime.includes("violence") || crime.includes("abuse") || crime.includes("kidnapping")) {
      // incrementing
      highLevelCrimes += 1;
    }
    // MEDIUM LEVEL CRIMES
    if(crime.includes("fraud") || crime.includes("scam") || crime.includes("bribery") || crime.includes("burglary") || crime.includes("robbery") || crime.includes("embezzlement") || crime.includes("extortion")) {
      // incrementing
      mediumLevelCrimes += 1;
    }
    // LOW LEVEL CRIMES
    if(crime.includes("theft") || crime.includes("vandalism") || crime.includes("stolen goods") || crime.includes("drugs") || crime.includes("traffic") || crime.includes("trespassing")){
      // incrementing
      lowLevelCrimes += 1;
    }
  }
  // setting the base level of dangers
  // if we encounter a high level crime, we set the base as 90
  if(highLevelCrimes > 0) {
    level = 90;
  } else if(mediumLevelCrimes > 0) {
    // if no high level crimes were detected, we set the base as 40
    level = 40;
    mediumLevelCrimes -= 1;
  } else if(lowLevelCrimes > 0) {
    // if no medium level crimes were detected either, we set the base as 20
    level = 20;
    lowLevelCrimes -= 1;
  }

  // now we go through the quantity of crimes committed
  // if we find that level of danger is < 80 and there are still medium level crimes left, we increment the level by 10
  while(mediumLevelCrimes > 0 && level < 80) {
      level += 10;
      mediumLevelCrimes -= 1;
  }

  // After the medium levels crimes have been iterated
  // if we find that level of danger is < 60 and there are still low level crimes left, we increment the level by 5
  while(lowLevelCrimes > 0 && level < 60) {
      level += 5;
      lowLevelCrimes -= 1;
  }

  // If more than 2 high level crimes are detected, the danger is automatically increased to 100 which is final
  if(highLevelCrimes > 1){
    level = 100;
  }
  return level;
};

// Route to add a criminal to the database
app.post("/uploadCriminal", uploadS3.single("file"), async (req, res) => {
  // basic data require to add the criminal
  const { name, dob, address, crimes } = req.body;
  // checking if the required data has been posted to the request
  if (!name || !dob || !address || !crimes) {
    return res.status(400).json({
      message: "Please provide all the details",
    });
  }
  // passing the list of crimes to get the danger level
  const dangerLevel = getDangerLevel(crimes);
  try {
    // Block of code to upload a single image (file)
    const uploadSingle = uploadS3.single("file");
    uploadSingle(req, res, async (err) => {
      // error was encountered in uploading
      if (err) {
        console.log(err);
        return res.send({
          success: false,
        });
      } 
      // if image was succesfully uploaded we finalize the addition of criminal to database
      else {
        console.log("Image uploaded successfully");
        // we create a criminal object from the schema
        const criminal = new Criminal({
          name,
          dob,
          address,
          crimes,
          dangerLevel,
          imageKey: req.file.key,
        });
        // saving the object to the mongoDB database
        await criminal.save();
        // returning the response of success
        return res.send({
          message: "Criminal Added",
          criminal
        });
      }
    });
  } 
  // error catching block
  catch (err) {
    console.log(err);
    res.status(500).json({
      message: err.toString(),
    });
  }
});

// Setting port
const port = process.env.PORT || 3000;

// making the application listen/run on the port specified
app.listen(port, async () => {
  // await loading of pretrained face recognition models
  await faceapi.nets.ssdMobilenetv1.loadFromDisk("weights");
  await faceapi.nets.faceRecognitionNet.loadFromDisk("weights");
  await faceapi.nets.faceLandmark68Net.loadFromDisk("weights");
  console.log("Model Loaded");
  
  // await connection of mongoose database
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
  // Everything is successful and server is running
  console.log(`Server is running on port ${port}`);
});