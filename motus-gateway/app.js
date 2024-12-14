const express = require("express");
const { auth } = require("express-openid-connect");
const helmet = require("helmet");
const apiRoutes = require("./routes/apiRoutes");
const frontRoutes = require("./routes/frontRoutes");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 3000;

const loki_uri = process.env.LOKI || "http://loki:3100";
const { createLogger, transports, format } = require("winston");
const LokiTransport = require("winston-loki");

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

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const auth0_config = {
  authRequired: false,
  auth0Logout: true,
  baseURL: "http://localhost:3000",
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
  secret: process.env.AUTH0_SECRET,
};
app.use(auth(auth0_config));

app.use(async function (req, res, next) {
  try {
    res.locals.user = req.oidc.user;
    if (res.locals.user) {
      try {
        await axios.get(`http://motus-users:3000/nickname/${res.locals.user.sub}`);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          const response = await axios.get("http://motus-game:3000/generateSeed");
          const seed = response.data.seed;
          await axios.post("http://motus-users:3000/user", { user_id: res.locals.user.sub, nickname: res.locals.user.nickname, seed });
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    logger.err({ message: `message="User authentication failed", "url"=${req.url}, "user"=${req.body.user_id || res.locals.user.sub}, error="${error}"`, labels: { origin: "motus-gateway" } });
    console.error(error);
    res.status(500).json("An error occurred on user authentication.");
    return;
  }

  next();
});

app.use("/api", apiRoutes);
app.use("/", frontRoutes);

app.listen(port, () => {
  console.log(`motus-gateway app listening on port ${port}`);
});
