const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { createLogger, transports, format } = require("winston");
const LokiTransport = require("winston-loki");
const loki_uri = process.env.LOKI || "http://loki:3100";

const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

let logger;
const getLogger = () => {
  if (!logger) {
    logger = createLogger({
      transports: [
        new LokiTransport({
          host: loki_uri,
          labels: { app: "motus_logger" },
          json: true,
          format: format.json(),
          replaceTimestamp: true,
          onConnectionError: (err) => console.error(err),
        }),
        new transports.Console({
          format: format.combine(format.simple(), format.colorize()),
        }),
      ],
    });
  }

  return logger;
};
logger = getLogger();
logger.info("Starting app...");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "cdn.jsdelivr.net", "ajax.googleapis.com", "kit.fontawesome.com", "'unsafe-inline'"],
        styleSrc: ["'self'", "cdn.jsdelivr.net", "fonts.googleapis.com", "'unsafe-inline'"],
        connectSrc: ["'self'", "ka-f.fontawesome.com"],
        fontSrc: ["'self'", "ka-f.fontawesome.com", "fonts.gstatic.com"],
      },
    },
  })
);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

app.use((req, res, next) => {
  if (req.headers["x-user-data"]) {
    req.userData = JSON.parse(Buffer.from(req.headers["x-user-data"], "base64").toString());
  }
  next();
});

app.get("/", async (req, res) => {
  try {
    if (!req.cookies.appSession || !req.userData) {
      res.render("index", {
        currentPage: "index",
      });
    } else {
      const seedResponse = await axios.get(`http://motus-game:3000/seed/${req.userData.sub}`);
      const seed = seedResponse.data.seed;

      const wordResponse = await axios.get(`http://motus-game:3000/word/${req.userData.sub}`);
      const word = wordResponse.data.word;

      res.render("index", {
        currentPage: "index",
        word,
        seed,
        userData: req.userData,
      });
    }
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error fetching word or seed";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

app.get("/score", async (req, res) => {
  try {
    const response = await axios.get(`http://motus-score:3000/score/${req.userData.sub}`);
    const { totalGuessedWords, averageTries } = response.data;

    res.render("score", {
      currentPage: "score",
      totalGuessedWords,
      averageTries,
      userData: req.userData,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error fetching score";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const response = await axios.get("http://motus-score:3000/leaderboard");
    const { leaderboardByTotal, leaderboardByAverage } = response.data;
    res.render("leaderboard", {
      currentPage: "leaderboard",
      leaderboardByTotal,
      leaderboardByAverage,
      userData: req.userData,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error fetching leaderboard";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json("Front service is up");
});

app.use((req, res) => {
  if (!req.cookies.appSession || !req.userData) {
    logger.error({ message: `message="URL not found", "url"=${req.url}, "user"=null`, labels: { origin: "motus-front" } });
    res.render("404", {
      currentPage: "404",
    });
  } else {
    logger.error({ message: `message="URL not found", "url"=${req.url}, "user"=${req.userData.sub}`, labels: { origin: "motus-front" } });
    res.render("404", {
      currentPage: "404",
      userData: req.userData,
    });
  }
});

app.listen(port, () => {
  console.log(`motus-front app listening on port ${port}`);
});
