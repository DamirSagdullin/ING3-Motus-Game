const express = require("express");
const axios = require("axios");
const helmet = require("helmet");

const fs = require("fs");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;

const loki_uri = process.env.LOKI || "http://loki:3100";
const { createLogger, transports, format } = require("winston");
const LokiTransport = require("winston-loki");

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

const wordList = fs.readFileSync("./data/liste_francais_utf8.txt", "utf8").split("\r\n");
const maxWordLength = wordList.reduce((a, b) => (a.length > b.length ? a : b), "").length;

const generateSeed = (userSeed) => {
  const seedSource = userSeed !== undefined ? userSeed.toString() : Math.random().toString();
  const hash = crypto.createHash("sha256").update(seedSource).digest("hex");
  return parseInt(hash, 16);
};

const getSeed = async (user_id) => {
  try {
    const response = await axios.get(`http://motus-users:3000/seed/${user_id}`);
    const seed = response.data.seed;
    return seed;
  } catch (error) {
    console.error(error);
    throw new Error("An error occurred while getting the seed.");
  }
};

const setSeed = async (user_id, userSeed) => {
  try {
    const seed = userSeed ? generateSeed(userSeed) : generateSeed();
    await axios.post("http://motus-users:3000/seed", { user_id: user_id, seed });
    return seed;
  } catch (error) {
    console.error(error);
    throw new Error("An error occurred while setting the seed.");
  }
};
const getWord = (seed, wordList) => {
  const index = seed % wordList.length;
  return wordList[index];
};

app.get("/seed/:user_id?", async (req, res) => {
  try {
    const seed = await getSeed(req.params.user_id || res.locals.user.sub);
    res.json({ seed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while getting the seed." });
  }
});

app.post("/seed", async (req, res) => {
  try {
    const userSeed = req.body.userSeed;
    await setSeed(req.body.user_id || res.locals.user.sub, userSeed);
    res.json({ message: "Seed set successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while setting the seed." });
  }
});

app.get("/word/:user_id?", async (req, res) => {
  try {
    const seed = await getSeed(req.params.user_id || res.locals.user.sub);
    const word = getWord(seed, wordList);
    res.json({ word });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while getting the word." });
  }
});

app.post("/guess", async (req, res) => {
  try {
    const guess = req.body.guess;
    if (guess.length >= maxWordLength) {
      return res.status(400).json({ message: "Invalid guess length" });
    }
    if (!wordList.includes(guess)) {
      return res.status(400).json({ message: "Invalid guess: word isn't in the list" });
    }
    const seed = await getSeed(req.body.user_id || res.locals.user.sub);
    const word = getWord(seed, wordList);

    const wordArray = word.split("");
    const guessArray = guess.split("");
    const result = guessArray.map((letter, index) => {
      if (letter === wordArray[index]) {
        var status = "correct";
      } else if (wordArray.includes(letter)) {
        var status = "misplaced";
      } else {
        var status = "wrong";
      }
      return { letter, status };
    });

    const won = guess === word;

    await axios.post("http://motus-score:3000/score", {
      user_id: req.body.user_id || res.locals.user.sub,
      score: won ? 1 : 0,
      word: word,
    });

    if (won) {
      await setSeed(req.body.user_id || res.locals.user.sub);
      logger.info({ message: `message="A user won", "url"=${req.url}, "user"=${req.body.user_id || res.locals.user.sub}`, labels: { origin: "motus_game" } });
      res.json({ won, result, message: "Congratulations, you have won!" });
    } else {
      res.json({ won, result, message: "Sorry, you have lost. Better luck next time!" });
    }
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error setting score";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

app.get("/generateSeed", (req, res) => {
  res.json({ seed: generateSeed() });
});

app.listen(port, () => {
  console.log(`motus-game app listening on port ${port}`);
});
