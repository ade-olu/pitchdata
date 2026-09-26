// api/db.js
// This file sets up the SQLite database connection using better-sqlite3.
// It exports the database instance for use in other parts of the application.

const Database = require("better-sqlite3");
const path = require("path");

// Define the path to the SQLite database file located in the backend directory
const dbPath = path.join(__dirname, "..", "football.db");

// Create a new instance of the Database class, opening the SQLite database in read-only mode
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

module.exports = db;
