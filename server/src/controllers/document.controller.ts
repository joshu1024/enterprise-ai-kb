import multer from "multer"
import path from "path";
import { AuthRequest } from "../types/index.js";
import { Response } from "express";
import { ingestDocument } from "../services/ingestion.service.js";
import prisma from "../config/prisma.js";

const storage = multer.diskStorage({
    destination:"/uploads/temp",
    filename:(req,file,cb)=>{
        const unique = `${Date.now()} - ${Math.round(Math.random() * 1e9)}`;
        cb(null,unique + path.extname(file.originalname))
    }
});
export const upload = multer({
    storage,
    limits:{fieldSize:10 * 1024 *1024},
    fileFilter:(req,file,cb)=>{
        const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/html",
    ];
    if(allowed.includes(file.mimetype)){
        cb(null,true)
    } else {
        cb(new Error("Only PDF, DOCX, TXT, and HTML files are allowed."))
    }
    }
});
export const uploadDocument =async(req:AuthRequest,res:Response):Promise<void>=>{
   try {
     const file = req.file;
    const {title} = req.body;
    const organizationId = req.user?.organizationId as string;
    const uploadedById = req.user?.id as string;

    if(!file){
        res.status(404).json({error:"file does not exists"});
        return;
    }
    res.status(202).json({
        message:"File uploaded processing ongoing",
        title: title || file?.originalname
    });

    ingestDocument({
        filePath: file.path,
        mimeType:file.mimetype,
        title: title || file?.originalname,
        organizationId,
        uploadedById
    }).catch((err)=>{console.log("Ingestion failed",err);});
   } catch (error) {
     console.error("uploadDocument error:", error);
     res.status(500).json({ error: "Upload failed." });
   }


}
export const listDocuments=async(req:AuthRequest,res:Response):Promise<void>=>{
    try {
        const organizationId = req.user?.organizationId as string;
        const documents = await prisma.document.findMany({
            where:{organizationId},
            select:{
                id:true,
                title: true,
                fileType: true,
                status: true,
                chunkCount: true,
                uploadedById: true,
                createdAt: true,
            },
            orderBy:{createdAt:"desc"}
        });
        res.json(documents);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch documents." });
    }
}
export const deleteDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params as {id:string};
    const organizationId = req.user?.organizationId as string;

    const doc = await prisma.document.findFirst({
      where: { id, organizationId },
    });

    if (!doc) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    await prisma.document.delete({ where: { id } });
    res.json({ message: "Document deleted." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document." });
  }
};
export const getDocumentStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params as {id:string};
    const organizationId = req.user?.organizationId as string;

    const doc = await prisma.document.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        title: true,
        status: true,
        chunkCount: true,
      },
    });

    if (!doc) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch document status." });
  }
};