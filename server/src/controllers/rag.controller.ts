import { Response } from "express";
import { AuthRequest } from "../types/index.js";
import { streamRagResponse } from "../services/rag.service.js";
import prisma from "../config/prisma.js";

export const queryDocuments =async(req:AuthRequest,res:Response):Promise<void>=>{
    try {
    const{query,messages} = req.body;
    const organizationId = req.user?.organizationId as string;

    if(!query?.trim()){
        res.status(400).json({error:"No query provided"})
    }

    res.setHeader("Content-Type","text/event-stream");
    res.setHeader("Cache-Control","no-cache");
    res.setHeader("Connection","keep-alive");
    res.flushHeaders();

    await streamRagResponse({query,organizationId,res,conversationHistory:messages || []})
    } catch (error) {
        console.error("queryDocuments error:",error)
        res.write(`data:${JSON.stringify({error:"RAG query failed."})}\n\n`);
        res.end()
    }
}
export const getRagStats= async(req:AuthRequest,res:Response):Promise<void>=>{
    try {
        const organizationId = req.user?.organizationId as string;

    const [documentCount,chunkCount,cacheCount,users] = await Promise.all([
        prisma.document.count({where:{organizationId,status:"true"}}),
        prisma.documentChunk.count({where:{document:{organizationId}}}),
        prisma.semanticCache.count({where:{organizationId}}),
        prisma.user.findMany({
            where:{organizationId},
            select:{
                id:true,
                name:true,
                email:true,
                aiTokensUsed:true,
                role:true
            },
            orderBy:{aiTokensUsed:"desc"}
        })
    ]);

    const totalTokensUsed = users.reduce((sum,u)=>sum + u.aiTokensUsed,0);
    const estimatedCost = ((totalTokensUsed / 1000000) * 0.05).toFixed(4);

    res.json({documentCount,chunkCount,cacheCount,estimatedCostUsd:estimatedCost,totalTokensUsed})
    } catch (error) {
        res.status(500).json({error:"Internal server error"})
    }

}