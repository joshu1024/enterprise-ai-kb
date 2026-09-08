import express from "express";
import { queryDocuments, getRagStats } from "../controllers/rag.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/query", protect, queryDocuments);
router.get("/stats", protect, adminOnly, getRagStats);

export default router;