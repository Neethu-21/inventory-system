const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const mongoURL = "mongodb://127.0.0.1:27017";
const client = new MongoClient(mongoURL);

let users, products, bills;

// INIT DB + DEFAULT SUPER ADMIN
async function init() {
    try {
        await client.connect();
        const db = client.db("inventoryDB");

        users = db.collection("users");
        products = db.collection("products");
        bills = db.collection("bills");

        console.log("Database Connected");

        const superAdmin = await users.findOne({ role: "super_admin" });
        if (!superAdmin) {
            const hashed = await bcrypt.hash("admin123", 10);
            await users.insertOne({
                username: "admin",
                password: hashed,
                role: "super_admin"
            });
            console.log("Super Admin Created: admin / admin123");
        }

        app.listen(5000, () =>
            console.log("Server Running → http://localhost:5000")
        );
    } catch (err) {
        console.error("DB error:", err);
    }
}
init();

// AUTH MIDDLEWARE
function auth(req, res, next) {
    try {
        const head = req.headers.authorization;
        if (!head) return res.status(401).json({ message: "No Token" });

        const token = head.split(" ")[1];
        req.user = jwt.verify(token, "secret123");
        next();
    } catch {
        return res.status(401).json({ message: "Invalid Token" });
    }
}

// LOGIN
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await users.findOne({ username });
    if (!user) return res.json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ message: "Wrong password" });

    const token = jwt.sign({ username, role: user.role }, "secret123");
    res.json({ token, role: user.role, message: "Login success" });
});

// CREATE USER (ONLY SUPER ADMIN)
app.post("/api/users", auth, async (req, res) => {
    if (req.user.role !== "super_admin")
        return res.status(403).json({ message: "Access Denied" });

    const { username, password, role } = req.body;
    const exists = await users.findOne({ username });
    if (exists) return res.json({ message: "Username already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await users.insertOne({ username, password: hashed, role });

    res.json({ message: "User created successfully" });
});

// GET PRODUCTS
app.get("/api/products", auth, async (req, res) => {
    res.json(await products.find().toArray());
});

// ADD PRODUCT (ADMIN + SUPER_ADMIN only)
app.post("/api/products", auth, async (req, res) => {
    if (!["admin", "super_admin"].includes(req.user.role))
        return res.status(403).json({ message: "Not Allowed" });

    const { name, category, price, stock, unit } = req.body;

    await products.insertOne({
        name,
        category,
        price: Number(price),
        stock: Number(stock),
        unit
    });

    res.json({ message: "Product added successfully" });
});

// DELETE PRODUCT (ADMIN + SUPER_ADMIN only)
app.delete("/api/products/:id", auth, async (req, res) => {
    try {
        if (!["admin", "super_admin"].includes(req.user.role))
            return res.status(403).json({ message: "Not Allowed" });

        const id = req.params.id.trim();
        if (!ObjectId.isValid(id))
            return res.status(400).json({ message: "Invalid ID" });

        const result = await products.findOneAndDelete({ _id: new ObjectId(id) });

        if (!result.value)
            return res.status(404).json({ message: "Product not found in DB" });

        res.json({ message: "Deleted Successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// BILLING – STOCK AUTO UPDATE (ALL ROLES CAN BILL)
app.post("/api/billing", auth, async (req, res) => {
    const { items } = req.body;
    let total = 0;

    for (const i of items) {
        const p = await products.findOne({ _id: new ObjectId(i.productId) });
        if (!p) return res.json({ message: "Product Not Found" });

        if (p.stock < i.qty)
            return res.json({ message: `Only ${p.stock} left of ${p.name}` });

        total += p.price * i.qty;

        await products.updateOne(
            { _id: p._id },
            { $inc: { stock: -i.qty } }
        );
    }

    await bills.insertOne({
        items,
        total,
        createdAt: new Date(),
        createdBy: req.user.username
    });

    res.json({ message: "Bill Generated", total });
});

// DASHBOARD DATA (for dashboard.html)
app.get("/api/dashboard", auth, async (req, res) => {
    const totalProducts = await products.countDocuments();
    const lowStock = await products.countDocuments({ stock: { $lt: 5 } });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayAgg = await bills.aggregate([
        { $match: { createdAt: { $gte: todayStart, $lt: todayEnd } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
    ]).toArray();

    const todaySales = todayAgg[0]?.total || 0;

    res.json({
        totalProducts,
        lowStock,
        todaySales
    });
});
