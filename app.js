import {errorResponse} from "./helpers/responseHelper";
import setupDb from "./db/setupDb";

const compression = require("compression");
const cors = require("cors");
require("dotenv").config();
const config = require("./config/config");
const {setupAuth} = require("./middlewares/authentication");

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const routes = require("./routes");
const app = express();
app.set('view-engine', 'ejs');
app.use(cors());
// app.use(helmet());
app.use(logger("dev"));
app.use(express.json());
app.use(compression())
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "uploads")));

setupAuth();
setupDb();

app.use("/", routes);

function defaultResponse(req, res) {
    errorResponse("Resource not found", res, 404)
}

app.use(defaultResponse)
const port = config.appPort || 3001;

app.listen(port, () => {
    console.log(`${process.env.APP_NAME} app listening at port :${port}`);
});

// end of the file
