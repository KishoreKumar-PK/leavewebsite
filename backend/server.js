require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "mysecretkey";

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL Database Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root", // Change this if you have a different MySQL user
    password: "kishxre_sql26", // Add your MySQL password if applicable
    database: "user_identification_system",
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
        return;
    }
    console.log("Connected to MySQL Database!");
});

// **User Registration Endpoint**
app.post("/api/register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user into database
        db.query(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            [username, email, hashedPassword],
            (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(400).json({ error: "Username or email already exists" });
                    }
                    return res.status(500).json({ error: "Database error" });
                }
                res.status(201).json({ message: "User registered successfully!" });
            }
        );
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// **User Login Endpoint**
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Both username and password are required" });
    }

    db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        // Generate JWT Token
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
            expiresIn: "1h",
        });

        res.json({ message: "Login successful!", token, user: { id: user.id, username: user.username, email: user.email } });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.get("/", (req, res) => {
    res.send("<h1>Welcome to User Identification System 🚀</h1><p>Use <code>/api/login</code> and <code>/api/register</code> for authentication.</p>");
});
