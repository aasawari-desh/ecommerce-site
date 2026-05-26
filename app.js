const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");

const app = express();
const PORT = 3000;

/* ================= SAFE FOLDER CHECK ================= */

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

/* ================= MIDDLEWARE ================= */

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));


/* ================= AWS CONFIG ================= */

AWS.config.update({
    region: "us-east-1"
});

const s3 = new AWS.S3();


/* ================= HOME PAGE ================= */

app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "public","index.html"));

});

/* ================= MULTER CONFIG ================= */


const storage = multer.diskStorage({

    destination: "uploads/",

    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }

});

const upload = multer({ storage });

/* ================= S3 UPLOAD API ================= */

app.post("/upload", upload.single("bill"), async (req, res) => {

    try {

        if (!req.file) {
            return res.send("No file uploaded");
        }

        const fileContent = fs.readFileSync(req.file.path);

        const params = {

            Bucket: "ecommerce-s3-site",

            Key: `bills/${Date.now()}-${req.file.originalname}`,

            Body: fileContent,

            ContentType: req.file.mimetype

        };

        const data = await s3.upload(params).promise();

        fs.unlinkSync(req.file.path);

        res.send(`
            <h2>Upload Successful 🎉</h2>

            <a href="${data.Location}" target="_blank">
                View File
            </a>
        `);

    } catch (err) {

        console.log("UPLOAD ERROR:", err);

        res.status(500).send(err.message);

    }

});

/* ================= MYSQL (RDS) CONFIG ================= */

const db = mysql.createConnection({
    host: "new-db.c2f0eywyycdf.us-east-1.rds.amazonaws.com",
    user: "admin",
    password: "12345678",
    database: "new-db"
});

// Connect Database
db.connect((err) => {

    if (err) {
        console.log("❌ DB Connection Failed:", err);
    } else {
        console.log("✅ Connected to RDS MySQL");
    }

});


/* ================= HEALTH CHECK FIX (VERY IMPORTANT FOR ALB) ================= */

app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

/* ================= NEWSLETTER API ================= */
// Subscribe Route
app.post('/subscribe', (req, res) => {

    try {

        const email = req.body.email;

        const sql = 'INSERT INTO subscribers (email) VALUES (?)';

        db.query(sql, [email], (err, result) => {

            if (err) {

                console.log('DB ERROR:', err);

                return res.send(`
                    <h2>❌ Email already exists or DB error</h2>
                    <a href="/">Go Back</a>
                `);

            }

            console.log('✅ Subscriber added:', email);

            res.send(`
                <h2>Subscribed Successfully 🎉</h2>
                <a href="/">Go Back</a>
            `);

        });

    } catch (error) {

        console.log('SERVER ERROR:', error);

        res.send('Something went wrong');

    }

});
/* ================= START SERVER ================= */

app.listen(3000, "0.0.0.0", () => {

    console.log("🚀 Server running on http://localhost:" + PORT);

});
