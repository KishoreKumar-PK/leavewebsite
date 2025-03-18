const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.IO
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:5500"], // Frontend origins
        methods: ["GET", "POST"]
    }
});

const PORT = 4000;

// ✅ Middleware
app.use(cors());
app.use(helmet());
app.use(bodyParser.json());

// ✅ MySQL Database Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "kishxre_sql26",
    database: "student_leave_db"
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed: " + err.message);
        return;
    }
    console.log("Connected to MySQL database ✅");
});

// ✅ Handle Leave Submission
app.post("/submit-leave", (req, res) => {
    console.log("Received data:", req.body);

    let { student_name, student_rollno, department, year, leave_type, from_date, to_date, reason } = req.body;

    if (!student_name || !student_rollno || !department || !year || !leave_type || !from_date || !to_date || !reason) {
        return res.status(400).json({ message: "All fields are required!" });
    }

    student_rollno = student_rollno.toLowerCase(); // Convert to lowercase

    // Insert leave request into the database
    const sql = `INSERT INTO leave_requests (student_name, student_rollno, department, year, leave_type, from_date, to_date, reason) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;  

    const values = [student_name, student_rollno, department, year, leave_type, from_date, to_date, reason];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error inserting data:", err);
            return res.status(500).json({ message: "Failed to submit leave request!" });
        }

        // ✅ Update Leave Count in the Database
        const updateCountSQL = `
            INSERT INTO leave_counts (student_rollno, student_name, casual_leave_count, phone_leave_count, on_duty_leave_count)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                casual_leave_count = casual_leave_count + VALUES(casual_leave_count),
                phone_leave_count = phone_leave_count + VALUES(phone_leave_count),
                on_duty_leave_count = on_duty_leave_count + VALUES(on_duty_leave_count)`;

        const updateValues = [
            student_rollno,
            student_name,
            leave_type === "casual" ? 1 : 0,
            leave_type === "phone" ? 1 : 0,
            leave_type === "on_duty" ? 1 : 0
        ];

        db.query(updateCountSQL, updateValues, (err, result) => {
            if (err) {
                console.error("Error updating leave count:", err);
                return res.status(500).json({ message: "Leave recorded but count update failed!" });
            }

            // ✅ Fetch the latest leave requests and broadcast update to staff dashboard
            db.query("SELECT * FROM leave_requests ORDER BY from_date DESC", (err, updatedRequests) => {
                if (err) {
                    console.error("Error fetching updated leave requests:", err);
                } else {
                    io.emit("leave-updated", updatedRequests); // 🔥 Send real-time update to all staff clients
                }
            });

            res.status(200).json({ message: "Leave request submitted and count updated successfully!" });
        });
    });
});

// ✅ API to Get Leave Requests for Staff Dashboard
app.get("/get-leave-requests", (req, res) => {
    const sql = `SELECT * FROM leave_requests ORDER BY from_date DESC`;

    db.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching leave requests:", err);
            return res.status(500).json({ message: "Failed to fetch leave requests!" });
        }
        res.status(200).json(result);
    });
});

// ✅ API to Get Leave Count for All Students
app.get("/get-leave-count", (req, res) => {
    const sql = `SELECT student_rollno, student_name, casual_leave_count, phone_leave_count, on_duty_leave_count FROM leave_counts`;  

    db.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching leave count:", err);
            return res.status(500).json({ message: "Failed to fetch leave counts!" });
        }
        res.status(200).json(result);
    });
});

// ✅ Default Route
app.get("/", (req, res) => {
    res.send("<h1>Welcome to Student Leave Management API 🚀</h1><p>Use <code>/get-leave-count</code> to get all leave records.</p>");
});

// ✅ Socket.IO Connection Handling
io.on("connection", (socket) => {
    console.log("A user connected to the staff dashboard 🔗");

    socket.on("disconnect", () => {
        console.log("A user disconnected from the staff dashboard ❌");
    });
});

// ✅ Start the Server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} 🚀`);
});
