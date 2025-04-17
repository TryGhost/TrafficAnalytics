"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const app = require("./src/app.js");
const port = parseInt(process.env.PORT || "3000", 10);
if (process.env.NODE_ENV !== "production" && require.main === module) {
  const start = async () => {
    try {
      await app.default.listen({ host: "0.0.0.0", port });
      console.log(`Server running on port ${port}`);
    } catch (err) {
      app.default.log.error(err);
      process.exit(1);
    }
  };
  start();
}
exports.default = app.default;
