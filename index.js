// index.js
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS in dev; harmless if serving same-origin map.html
app.use(cors({ origin: "*" }));
app.use(express.json());

// Serve static files (map.html, css, js) from ./public
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Use an absolute path for the JSON file (more reliable on Render)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DATA_FILE = path.join(DATA_DIR, "storage.json");

// Ensure storage.json exists with a default shape
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ messages: [], locations: [] }, null, 2));
}

// Helpers
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    // Ensure both arrays exist even if file was older format
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : []
    };
  } catch {
    return { messages: [], locations: [] };
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Routes

// Serve the map by default at "/"
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "map.html"));
});

// Simple health checks (helpful on Render)
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.head("/", (_req, res) => res.status(200).end());

// Messages (sample)
app.get("/messages", (_req, res) => {
  res.json(readData().messages);
});
app.post("/messages", (req, res) => {
  const data = readData();
  const newMsg = { id: Date.now(), text: String(req.body?.text ?? "") };
  data.messages.push(newMsg);
  writeData(data);
  res.json(newMsg);
});

// Locations
app.post("/location", (req, res) => {
  const { latitude, longitude } = req.body || {};
  // Basic validation
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Invalid latitude/longitude" });
  }

  const data = readData();
  const newLoc = {
    id: Date.now(),
    latitude: lat,
    longitude: lng,
    // Optional metadata for debugging/visualization
    createdAt: new Date().toISOString()
  };

  data.locations.push(newLoc);
  writeData(data);
  res.json({ status: "success", saved: newLoc });
});

app.get("/locations", (_req, res) => {
  res.json(readData().locations);
});

// NEW: most recent location
app.get("/locations/latest", (_req, res) => {
  const list = readData().locations;
  if (list.length === 0) return res.status(204).end();
  res.json(list[list.length - 1]);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
