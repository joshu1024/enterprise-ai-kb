import { Request } from "express";


export interface AuthRequest extends Request{
    user?:{
        id:string,
        email:string,
        role:string,
        organizationId:string
    }
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}