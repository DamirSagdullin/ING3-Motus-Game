const express = require("express");
const router = express.Router();
const axios = require("axios");
const { requiresAuth } = require("express-openid-connect");
const { createLogger, transports, format } = require("winston");
const LokiTransport = require("winston-loki");
const loki_uri = process.env.LOKI || "http://loki:3100";
const rateLimit = require("express-rate-limit");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

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

const limiter = rateLimit({
  windowMs: 1 * 20 * 1000,
  max: 10,
  message: {
    message: "Too many requests from this IP, please try again later",
  },
  handler: function(req, res, next) {
    logger.warn({ message: `message="Too many requests", "url"=${req.url}, "user"=${req.body.user_id || res.locals.user.sub}"`, labels: { origin: "motus-gateway" } });
    res.status(429).json({
      message: "Too many requests from this IP, please try again later",
    });
  }
});

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Motus API Documentation",
      version: "1.0.0",
    },
  },
  apis: ["./routes/apiRoutes.js"],
};
const swaggersSpecs = swaggerJsdoc(swaggerOptions);
const swaggersUI = {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "API Docs",
  // customfavIcon: "/public/favicon.ico",
};

var nb_leaderbord = 0;
var error_leaderbord = 0;

router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggersSpecs, swaggersUI));

/**
 * @swagger
 * /api/seed/{user_id}:
 *   get:
 *     summary: Get user's seed
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: false
 *         schema:
 *           type: string
 *         description: Will take effect only if the user is an admin.  If not provided, it will take the user_id from the session defined by appSession cookie.
 *     responses:
 *       200:
 *         description: Object with user's seed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 seed:
 *                   type: string
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/seed/:user_id?", requiresAuth(), async (req, res) => {
  try {
    let url = `http://motus-game:3000/seed/${res.locals.user.sub}`;
    if (res.locals.user["test/roles"].includes("admin")) {
      if (req.params.user_id === ",") {
        req.params.user_id = undefined;
      }
      url = `http://motus-game:3000/seed/${req.params.user_id || res.locals.user.sub}`;
    }
    const response = await axios.get(url);
    const seed = response.data.seed;
    res.json({ seed });
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error getting seed";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

/**
 * @swagger
 * /api/seed:
 *   post:
 *     summary: Set user's seed
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: Will take effect only if the user is an admin
 *               seed:
 *                 type: string
 *                 description: if precised, will set the seed based on the given value, otherwise will generate a random seed
 *     responses:
 *       200:
 *         description: Object with success message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 seed:
 *                   type: string
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post("/seed", requiresAuth(), async (req, res) => {
  try {
    const { seed } = req.body;
    const body = {
      seed,
      user_id: res.locals.user["test/roles"].includes("admin") ? req.body.user_id || res.locals.user.sub : res.locals.user.sub,
    };

    const response = await axios.post("http://motus-game:3000/seed", body);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error setting seed";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

/**
 * @swagger
 * /api/word/{user_id}:
 *   get:
 *     summary: Get user's word
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: false
 *         schema:
 *           type: string
 *         description: Will take effect only if the user is an admin.  If not provided, it will take the user_id from the session defined by appSession cookie.
 *     responses:
 *       200:
 *         description: Object with user's word
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 word:
 *                   type: string
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/word/:user_id?", requiresAuth(), async (req, res) => {
  try {
    let url = `http://motus-game:3000/word/${res.locals.user.sub}`;
    if (res.locals.user["test/roles"].includes("admin")) {
      if (req.params.user_id === ",") {
        req.params.user_id = undefined;
      }
      url = `http://motus-game:3000/word/${req.params.user_id || res.locals.user.sub}`;
    }
    const response = await axios.get(url);
    const word = response.data.word;
    res.json({ word });
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error getting word";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

/**
 * @swagger
 * /api/score/{user_id}:
 *   get:
 *     summary: Get user's score
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: false
 *         schema:
 *           type: string
 *         description: Will take effect only if the user is an admin.  If not provided, it will take the user_id from the session defined by appSession cookie.
 *     responses:
 *       200:
 *         description: Object with user's score
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalGuessedWords:
 *                   type: integer
 *                 averageTries:
 *                   type: number
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/score/:user_id?", requiresAuth(), async (req, res) => {
  try {
    let url = `http://motus-score:3000/score/${res.locals.user.sub}`;
    if (res.locals.user["test/roles"].includes("admin")) {
      if (req.params.user_id === ",") {
        req.params.user_id = undefined;
      }
      url = `http://motus-score:3000/score/${req.params.user_id || res.locals.user.sub}`;
    }
    const response = await axios.get(url);
    const { totalGuessedWords, averageTries } = response.data;

    res.json({ totalGuessedWords, averageTries });
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error getting score";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

/**
 * @swagger
 * /api/guess:
 *   post:
 *     summary: Return if won, result array, message and updates the score accordingly
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: Will take effect only if the user is an admin
 *               guess:
 *                 type: string
 *     responses:
 *       200:
 *         description: Object with the result of the guess
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 won:
 *                   type: boolean
 *                 result:
 *                   type: array
 *                   items:
 *                     type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post("/guess", requiresAuth(), limiter, async (req, res) => {
  try {
    const { guess } = req.body;
    const body = {
      guess,
      user_id: res.locals.user["test/roles"].includes("admin") ? req.body.user_id || res.locals.user.sub : res.locals.user.sub,
    };
    const response = await axios.post("http://motus-game:3000/guess", body);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error making guess";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

/**
 * @swagger
 * /api/reset-score:
 *   post:
 *     summary: Reset user's score
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: Will take effect only if the user is an admin
 *     responses:
 *       200:
 *         description: Object with success message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post("/reset-score", requiresAuth(), async (req, res) => {
  try {
    const body = {
      user_id: res.locals.user["test/roles"].includes("admin") ? req.body.user_id || res.locals.user.sub : res.locals.user.sub,
    };
    const response = await axios.post("http://motus-score:3000/reset-score/", body);
    logger.warn({
      message: `message="User reset scores", "url"=${req.url}, "user"=${req.params.user_id || res.locals.user.sub}`,
      labels: { origin: "motus_game" },
    });
    res.json(response.data);
  } catch (error) {
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error resetting score";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

/**
 * @swagger
 * /api/leaderboard:
 *   get:
 *     summary: Retrieve leaderboards
 *     responses:
 *       200:
 *         description: Object with leaderboards
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaderboardByTotal:
 *                   type: array
 *                   items:
 *                     type: object
 *                 leaderboardByAverage:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/leaderboard", async (req, res) => {
  nb_leaderbord++;
  try {
    const response = await axios.get("http://motus-score:3000/leaderboard");
    const { leaderboardByTotal, leaderboardByAverage } = response.data;
    res.json({ leaderboardByTotal, leaderboardByAverage });
  } catch (error) {
    error_leaderbord++;
    console.error(error);
    const errorMessage = error.response && error.response.data && error.response.data.message ? error.response.data.message : "Error getting leaderboard";
    const statusCode = error.response && error.response.status ? error.response.status : 500;
    res.status(statusCode).json({ message: errorMessage });
  }
});

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Retrieve leaderboards metrics
 *     responses:
 *       200:
 *         description: Object with leaderboard metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: string
 *       500:
 *         description: Object with error message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/metrics", async (req, res) => {
  let data = "http_requests_leaderbord_total "+nb_leaderbord+"\nerror_total "+error_leaderbord;
  nb_leaderbord = 0;
  error_leaderbord = 0;
  res.send(data);
});

module.exports = router;
