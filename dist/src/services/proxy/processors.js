"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const uap = require("ua-parser-js");
function isBot(userAgentString) {
  const botPattern = /wget|ahrefsbot|curl|bot|crawler|spider|urllib|bitdiscovery|\+https:\/\/|googlebot/i;
  return botPattern.test(userAgentString);
}
function parseUserAgent(request) {
  var _a, _b;
  if (!request.headers["user-agent"]) {
    return;
  }
  try {
    const userAgent = request.headers["user-agent"];
    const ua = new uap(userAgent);
    const os = ua.getOS();
    const browser = ua.getBrowser();
    let browserName = ((_a = browser.name) == null ? void 0 : _a.toLowerCase()) || "unknown";
    browserName = browserName.replace(/^mobile\s/, "");
    let osName = ((_b = os.name) == null ? void 0 : _b.toLowerCase()) || "unknown";
    if (osName === "mac os") {
      osName = "macos";
    }
    let deviceType = "unknown";
    if (osName === "ios") {
      deviceType = "mobile-ios";
    } else if (osName === "android") {
      deviceType = "mobile-android";
    } else if (["macos", "windows", "linux", "chrome os", "ubuntu"].includes(osName)) {
      deviceType = "desktop";
    } else if (isBot(userAgent)) {
      deviceType = "bot";
    }
    const meta = {
      os: osName,
      browser: browserName,
      device: deviceType
    };
    request.body.payload.meta = meta;
  } catch (error) {
    request.log.error(error);
    const meta = {
      os: "unknown",
      browser: "unknown",
      device: "unknown"
    };
    request.body.payload.meta = meta;
  }
}
exports.parseUserAgent = parseUserAgent;
