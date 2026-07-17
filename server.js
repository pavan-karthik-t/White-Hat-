const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(rootDir, "data");

const dataFiles = {
  chefs: path.join(dataDir, "chefs.json"),
  masterclasses: path.join(dataDir, "masterclasses.json"),
  overview: path.join(dataDir, "overview.json"),
  testimonials: path.join(dataDir, "testimonials.json"),
  leads: path.join(dataDir, "leads.json")
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

async function readJson(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(payload);
}

function sanitizeFilePath(urlPath) {
  const normalized = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const resolvedPath = path.join(publicDir, normalized);
  if (!resolvedPath.startsWith(publicDir)) {
    return null;
  }
  return resolvedPath;
}

function collectRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function filterChefs(chefs, params) {
  const city = params.get("city")?.trim().toLowerCase() || "";
  const cuisine = params.get("cuisine")?.trim().toLowerCase() || "";
  const availability = params.get("availability")?.trim().toLowerCase() || "";
  const serviceType = params.get("serviceType")?.trim().toLowerCase() || "";

  return chefs.filter((chef) => {
    const matchesCity = !city || chef.city.toLowerCase() === city;
    const matchesCuisine = !cuisine || chef.cuisines.some((item) => item.toLowerCase() === cuisine);
    const matchesAvailability = !availability || chef.availability.toLowerCase().includes(availability);
    const matchesServiceType = !serviceType || chef.serviceTypes.some((item) => item.toLowerCase() === serviceType);
    return matchesCity && matchesCuisine && matchesAvailability && matchesServiceType;
  });
}

function buildChefOptions(chefs) {
  const unique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

  return {
    cities: unique(chefs.map((chef) => chef.city)),
    cuisines: unique(chefs.flatMap((chef) => chef.cuisines)),
    serviceTypes: unique(chefs.flatMap((chef) => chef.serviceTypes))
  };
}

async function handleApi(request, response, requestUrl) {
  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      date: new Date().toISOString()
    });
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/overview") {
    const [overview, chefs] = await Promise.all([
      readJson(dataFiles.overview),
      readJson(dataFiles.chefs)
    ]);

    sendJson(response, 200, {
      ...overview,
      filterOptions: buildChefOptions(chefs)
    });
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/chefs") {
    const chefs = await readJson(dataFiles.chefs);
    const filtered = filterChefs(chefs, requestUrl.searchParams);
    sendJson(response, 200, {
      total: filtered.length,
      chefs: filtered
    });
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/masterclasses") {
    const masterclasses = await readJson(dataFiles.masterclasses);
    sendJson(response, 200, { masterclasses });
    return true;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/testimonials") {
    const testimonials = await readJson(dataFiles.testimonials);
    sendJson(response, 200, { testimonials });
    return true;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/leads") {
    const rawBody = await collectRequestBody(request);
    const body = JSON.parse(rawBody || "{}");

    const requiredFields = ["name", "email", "role", "interest"];
    const missingField = requiredFields.find((field) => !String(body[field] || "").trim());

    if (missingField) {
      sendJson(response, 400, {
        error: `Missing required field: ${missingField}`
      });
      return true;
    }

    const leads = await readJson(dataFiles.leads);
    const nextLead = {
      id: `lead_${Date.now()}`,
      name: String(body.name).trim(),
      email: String(body.email).trim(),
      role: String(body.role).trim(),
      interest: String(body.interest).trim(),
      message: String(body.message || "").trim(),
      createdAt: new Date().toISOString()
    };

    leads.unshift(nextLead);
    await writeJson(dataFiles.leads, leads);

    sendJson(response, 201, {
      message: "Lead captured successfully.",
      lead: nextLead
    });
    return true;
  }

  return false;
}

async function serveStatic(requestUrl, response) {
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = sanitizeFilePath(pathname);

  if (!filePath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fsp.stat(filePath);
    const targetPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const extension = path.extname(targetPath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";

    response.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(targetPath).pipe(response);
  } catch {
    sendText(response, 404, "Not Found");
  }
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const handled = await handleApi(request, response, requestUrl);

      if (!handled) {
        await serveStatic(requestUrl, response);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error";
      const statusCode = message === "Payload too large" ? 413 : 500;
      sendJson(response, statusCode, {
        error: message
      });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`White Hat running at http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer
};
