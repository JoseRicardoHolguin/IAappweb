import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/salud", (req, res) => res.json({ ok: true }));

app.listen(3000, () => console.log("Servidor en http://localhost:3000"));