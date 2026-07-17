const { createRequestHandler } = require("../server");

module.exports = createRequestHandler({ serveStaticFiles: false });
