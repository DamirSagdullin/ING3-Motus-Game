const express = require("express");
const redis = require("redis");
const app = express();
const helmet = require("helmet");
const axios = require("axios");

app.use(helmet());
app.use(express.json());
const port = process.env.PORT || 3000;

const redisClient = redis.createClient({
  socket: {
    host: "redis",
    port: 6379,
  },
  password: process.env.REDIS_PASSWORD,
});
(async () => {
  await redisClient.connect();
})();

const getUserStats = async () => {
  try {
    const userKeys = await redisClient.keys("stats:*");
    const user_ids = [...new Set(userKeys.map((key) => key.split(":")[1]))];
    const userStats = [];

    for (let user_id of user_ids) {
      const keys = await redisClient.keys(`stats:${user_id}:*`);

      let totalGuessedWords = 0;
      let totalTries = 0;
      const nickname = keys[0].split(":")[4];

      for (let key of keys) {
        let score = await redisClient.hGet(key, "score");
        if (score == 1) {
          let tryCount = await redisClient.hGet(key, "tries");
          totalTries += Number(tryCount);
          totalGuessedWords += 1;
        }
      }

      let averageTries = totalTries / totalGuessedWords;
      averageTries = averageTries.toFixed(1);

      if (averageTries > 0) {
        userStats.push({ user_id, totalGuessedWords, averageTries, nickname });
      }
    }

    return userStats;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

app.post("/score", async (req, res) => {
  try {
    const { user_id, score, word } = req.body;
    const date = new Date().toDateString();
    const response = await axios.get(`http://motus-users:3000/nickname/${user_id}`);
    const nickname = response.data.nickname;
    const currentScore = await redisClient.hGet(`stats:${user_id}:${date}:${word}:${nickname}`, "score");
    if (currentScore == 1) {
      return res.status(400).json({ message: "This word was already guessed today!" });
    } else {
      await redisClient.hIncrBy(`stats:${user_id}:${date}:${word}:${nickname}`, "tries", 1);
      await redisClient.hSet(`stats:${user_id}:${date}:${word}:${nickname}`, "score", score);
      return res.status(200).json({ message: "Score set successfully" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error setting score" });
  }
});

app.get("/score/:user_id", async (req, res) => {
  const { user_id } = req.params;

  const keys = await redisClient.keys(`stats:${user_id}:*`, (err, keys) => {
    if (err) {
      return res.status(500).json({ message: "Error getting keys:" });
    }
  });

  let totalGuessedWords = 0;
  let totalTries = 0;
  let averageTries = 0;
  try {
    for (let key of keys) {
      let score = await redisClient.hGet(key, "score");
      if (score == 1) {
        let tryCount = await redisClient.hGet(key, "tries");
        totalTries += Number(tryCount);
        totalGuessedWords += 1;
      }
    }

    averageTries = totalTries / totalGuessedWords;
    averageTries.toFixed(1);
    return res.status(200).json({ user_id, totalGuessedWords, averageTries });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error getting tries" });
  }
});

app.post("/reset-score", async (req, res) => {
  try {
    const user_id = req.body.user_id;

    const keys = await redisClient.keys(`stats:${user_id}:*`);
    for (let key of keys) {
      await redisClient.del(key);
    }
    return res.status(200).json({ message: "Score reset successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error resetting score" });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const userStats = await getUserStats();

    const leaderboardByTotal = [...userStats].sort((a, b) => b.totalGuessedWords - a.totalGuessedWords);
    const leaderboardByAverage = [...userStats].sort((a, b) => a.averageTries - b.averageTries);

    return res.status(200).json({ leaderboardByTotal, leaderboardByAverage });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error getting leaderboard" });
  }
});

app.listen(port, () => {
  console.log(`motus-score app listening on port ${port}`);
});
