const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3000;
const SECRET_KEY = "mysecretkey"; // 🔴 Hardcoded key (Not secure)

app.use(cors());
app.use(bodyParser.json());

// **MySQL Database Connection**
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "kishxre_sql26",
    database: "staff_management",
});

db.connect((err) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
        return;
    }
    console.log("✅ Connected to MySQL Database!");
});

// **Rate Limiting for Login (Prevent Brute Force Attacks)**
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 login attempts per window
    message: "Too many login attempts. Please try again later.",
});

// **JWT Authentication Middleware**
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(403).json({ error: "Access denied" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
}

// **Staff Login Endpoint**
app.post("/api/staff/login", loginLimiter, (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Both email and password are required" });
    }

    db.query("SELECT * FROM staff WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const staff = results[0];

        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ id: staff.id, name: staff.name }, SECRET_KEY, {
            expiresIn: "1h",
        });

        res.json({ 
            message: "Login successful!", 
            token, 
            staff: { id: staff.id, name: staff.name, email: staff.email }
        });
    });
});

// **Submit Leave Request (For Students)**
app.post("/api/student/leave", (req, res) => {
    const { student_id, student_name, leave_reason } = req.body;

    if (!student_id || !student_name || !leave_reason) {
        return res.status(400).json({ error: "All fields are required" });
    }

    db.query(
        "INSERT INTO leave_requests (student_id, student_name, leave_reason, status) VALUES (?, ?, ?, 'pending')",
        [student_id, student_name, leave_reason],
        (err, result) => {
            if (err) return res.status(500).json({ error: "Database error" });

            res.status(201).json({ message: "Leave request submitted!" });
        }
    );
});

// **Get Pending Leave Requests (Protected Route)**
app.get("/api/staff/leave/pending", verifyToken, (req, res) => {
    db.query("SELECT * FROM leave_requests WHERE status = 'pending'", (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        res.json(results);
    });
});

// **Approve/Reject Leave Request (Protected Route)**
app.put("/api/staff/leave/update", verifyToken, (req, res) => {
    const { leave_id, status } = req.body;

    if (!leave_id || !status) {
        return res.status(400).json({ error: "Leave ID and status are required" });
    }

    db.query(
        "UPDATE leave_requests SET status = ? WHERE id = ?",
        [status, leave_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: "Database error" });

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Leave request not found" });
            }

            res.json({ message: `Leave request updated to ${status}!` });
        }
    );
});

// **Get Approved Leave Requests (Protected Route)**
app.get("/api/staff/leave/approved", verifyToken, (req, res) => {
    db.query("SELECT * FROM leave_requests WHERE status = 'approved'", (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        res.json(results);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
