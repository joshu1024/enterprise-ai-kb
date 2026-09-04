import prisma from "../config/prisma.js";
import { parseDocument, recursiveChunk } from "./document.service.js";
import { generateEmbedding } from "./embedding.service.js";
import fs from "fs"
interface IngestOptions {
  filePath: string;
  mimeType: string;
  title: string;
  organizationId: string;
  uploadedById: string;
}

export const ingestDocument=async({filePath,mimeType,title,organizationId,uploadedById}:IngestOptions)=>{
    const document = await prisma.document.create({
        data:{
            title,
            fileType:mimeType,
            status:"processing",
            organizationId,
            uploadedById,
        }
    });

    try {
        const rawText = await parseDocument(filePath,mimeType);
        const chunks =  recursiveChunk(rawText);
        console.log(`Parsed ${chunks.length} chunks from ${title}`);

        for (let chunk of chunks){
            const embedding = await generateEmbedding(chunk.text);
            const vectorString = `[${embedding.join(",")}]`;

            await prisma.$executeRaw`
            INSERT INTO "DocumentChunk" 
            ("id","documentId","text","chunkIndex","embedding","createdAt")
            VALUES(
                gen_random_uuid(),
                ${document.id},
                ${chunk.text},
                ${chunk.chunkIndex},
                ${vectorString}::vector,
                NOW()
            )
            `
        }
            await prisma.document.update({
                where:{id:document.id},
                data:{
                    status:"ready",
                    chunkCount:chunks.length
                }
            });
            if(fs.existsSync(filePath)){
                fs.unlinkSync(filePath)
            }
            return{documentId:document.id, chunkCount:chunks.length}
    } catch (error) {
        await prisma.document.update({
            where:{id:document.id},
            data:{status:"failed"}
        });
        if(fs.existsSync(filePath)){
            fs.unlinkSync(filePath);
        }
        throw error;
    }
}