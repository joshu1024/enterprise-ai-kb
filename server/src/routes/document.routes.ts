import express from "express"
import {upload,
  uploadDocument,
  listDocuments,
  deleteDocument,
  getDocumentStatus,} from "../controllers/document.controller.js";
import { protect,adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/upload",protect,adminOnly,upload.single("file"),uploadDocument);
router.get("/",protect,listDocuments);
router.delete("/:id",protect,deleteDocument);
router.get("/:id/status",protect,getDocumentStatus)

export default router;
