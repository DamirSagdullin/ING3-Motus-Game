const express = require("express");
const app = express();
const helmet = require("helmet");
const PostgresConnection = require("./lib/PostgresConnection");
app.use(helmet());
app.use(express.json());
const port = process.env.PORT || 3000;
const pgConnection = new PostgresConnection(process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, process.env.POSTGRES_DB, "postgres", 5432);

(async () => {
  try {
    await pgConnection.connect();
    pgPool = await pgConnection.connectPool();
    pgConnection.closeOnExit();
  } catch (error) {
    console.error(error);
  }
})();

app.get("/seed/:user_id", async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const query = `SELECT seed FROM users WHERE user_id = $1`;
    const result = await pgPool.query(query, [user_id]);
    if (result.rows.length === 0) {
      res.status(404).json("User not found");
    } else {
      res.status(200).json({ seed: result.rows[0].seed });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Error getting seed");
  }
});

app.post("/seed", async (req, res) => {
  try {
    const user_id = req.body.user_id;
    const seed = req.body.seed;
    await pgPool.query(`UPDATE users SET seed = $1 WHERE user_id = $2`, [seed, user_id]);
    res.status(200).json("Seed set successfully");
  } catch (error) {
    console.error(error);
    res.status(500).json("Error setting seed");
  }
});

app.get("/nickname/:user_id", async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const result = await pgPool.query("SELECT nickname FROM users WHERE user_id = $1", [user_id]);
    if (result.rows.length === 0) {
      res.status(404).json("User not found");
    } else {
      res.status(200).json({ nickname: result.rows[0].nickname });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Error getting nickname");
  }
});

app.post("/user", async (req, res) => {
  try {
    const user_id = req.body.user_id;
    const nickname = req.body.nickname;
    const seed = req.body.seed;
    await pgPool.query("INSERT INTO users (user_id, nickname, seed) VALUES ($1, $2, $3)", [user_id, nickname, seed]);
    res.status(200).json("User created successfully");
  } catch (error) {
    console.error(error);
    res.status(500).json("Error creating user");
  }
});

app.get("/health", (req, res) => {
  res.status(200).json("Users service is up");
});

app.listen(port, () => {
  console.log(`motus-users app listening on port ${port}`);
});
