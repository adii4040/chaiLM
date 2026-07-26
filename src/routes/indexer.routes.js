import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { handleIndexDocument } from "../controllers/indexer.controller.js";

const router = Router();

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${crypto.randomUUID()}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB Limit
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") return cb(null, true);
        cb(new Error("Only PDF files are allowed"));
    },
});

// Route definition
router.post("/", upload.single("file"), handleIndexDocument);

export default router;