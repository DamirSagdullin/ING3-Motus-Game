const express = require("express");
const router = express.Router();
const { requiresAuth } = require("express-openid-connect");
const { createProxyMiddleware } = require("http-proxy-middleware");
const ressourcesFrontProxy = createProxyMiddleware({
  target: "http://motus-front:3000",
  changeOrigin: true,
  pathRewrite: {
    "^/front": "",
  },
});
const frontProxy = createProxyMiddleware({
  target: "http://motus-front:3000",
  changeOrigin: true,
  onProxyReq: function (proxyReq, req, res) {
    if (req.oidc.user) {
      const userData = Buffer.from(JSON.stringify(req.oidc.user)).toString("base64");
      proxyReq.setHeader("X-User-Data", userData);
    }
  },
});

router.use("/front", ressourcesFrontProxy);
router.get("/score", requiresAuth(), frontProxy);
router.get("/", frontProxy);
router.use(frontProxy);

module.exports = router;
