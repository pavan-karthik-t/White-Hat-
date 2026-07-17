const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createServer } = require("./server");

const leadsPath = path.join(__dirname, "data", "leads.json");

function requestJson(baseUrl, pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

test("GET /api/health returns ok", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await requestJson(baseUrl, "/api/health");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
    assert.ok(payload.date);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/chefs filters by city", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await requestJson(baseUrl, "/api/chefs?city=Chennai");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.total, 1);
    assert.equal(payload.chefs[0].name, "Lakshmi Iyer");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("POST /api/leads persists a lead", async () => {
  const originalLeads = await fs.readFile(leadsPath, "utf8");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await requestJson(baseUrl, "/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Prototype User",
        email: "prototype@example.com",
        role: "Chef",
        interest: "Joining as a chef",
        message: "Testing persistence"
      })
    });

    const payload = await response.json();
    const leads = JSON.parse(await fs.readFile(leadsPath, "utf8"));

    assert.equal(response.status, 201);
    assert.equal(payload.message, "Lead captured successfully.");
    assert.equal(leads[0].email, "prototype@example.com");
  } finally {
    await fs.writeFile(leadsPath, originalLeads, "utf8");
    await new Promise((resolve) => server.close(resolve));
  }
});
