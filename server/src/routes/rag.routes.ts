import express from "express";
import { queryDocuments, getRagStats , evalResponse} from "../controllers/rag.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";
import { aiRateLimiter, checkTokenQuota, validateAiInput } from "../middleware/ai.middleware.js";

const router = express.Router();

router.post("/query",aiRateLimiter,checkTokenQuota,validateAiInput, protect, queryDocuments);
router.get("/stats", protect, adminOnly, getRagStats);
router.post("/eval", protect, adminOnly, evalResponse);
export default router;