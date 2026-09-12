import rateLimiter from "express-rate-limit";
import { AuthRequest } from "../types/index.js";
import { NextFunction,Response } from "express";
import { error } from "node:console";
import prisma from "../config/prisma.js";


export const aiRateLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message:{
        error:"Too mani Ai request please ry again later"
    },
    standardHeaders:true,
    legacyHeaders:false
});

const INJECTION_PATTERNS = [
  /ignore (previous|all|above) instructions/i,
  /you are now/i,
  /pretend (you are|to be)/i,
  /forget (your|all) (instructions|rules|system prompt)/i,
  /jailbreak/i,
];
export const validateAiInput = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const { query, message } = req.body;
  const userText = query || message;

  if (!userText?.trim()) {
    res.status(400).json({ error: "Query is required." });
    return;
  }

  if (userText.length > 2000) {
    res.status(400).json({ error: "Query too long. Max 2000 characters." });
    return;
  }

  const isInjection = INJECTION_PATTERNS.some((p) => p.test(userText));
  if (isInjection) {
    res.status(400).json({ error: "I can't process that request." });
    return;
  }

  next();
};
export const checkTokenQuota = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiTokensUsed: true, aiTokensResetAt: true, role: true },
    });

    if (!user) return next();
    if (user.role === "admin") return next();

    const now = new Date();
    const resetAt = new Date(user.aiTokensResetAt);
    const isNewMonth =
      now.getMonth() !== resetAt.getMonth() ||
      now.getFullYear() !== resetAt.getFullYear();

    if (isNewMonth) {
      await prisma.user.update({
        where: { id: userId },
        data: { aiTokensUsed: 0, aiTokensResetAt: now },
      });
      return next();
    }

    const FREE_TIER_LIMIT = 50000;
    if (user.aiTokensUsed >= FREE_TIER_LIMIT) {
      res.status(429).json({
        error: "Monthly AI quota reached.",
        tokensUsed: user.aiTokensUsed,
        limit: FREE_TIER_LIMIT,
      });
      return;
    }

    next();
  } catch {
    console.error("Quota check failed:", error);

    res.status(503).json({
      error: "Unable to verify AI quota. Please try again later.",
    });

    return;
  }
};
