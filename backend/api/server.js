// api/server.js
// This is the entry point for the API server.
// It sets up the Express app, defines routes, and starts listening on a specified port.

const express = require("express");
const cors = require("cors"); // Import the CORS middleware to handle cross-origin requests from the frontend
const leaguesRouter = require("./routes/leagues");
const clubsRouter = require("./routes/clubs");

const app = express();
const PORT = 3001; // Port number for the API server

app.use(cors()); // Enable CORS for all routes to allow requests from the frontend
app.use("/api/leagues", leaguesRouter);
app.use("/api/clubs", clubsRouter);

// Define a simple route to check if the API is running
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "pitchdata API is running" });
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`pitchdata API listening on http://localhost:${PORT}`);
});
