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
      return res.send({
        success: true,
        mesage: "No file received by the server"
      }); 
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