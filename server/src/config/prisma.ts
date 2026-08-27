import pg from "pg"
import {PrismaPg} from "@prisma/adapter-pg"
import {PrismaClient} from "@prisma/client"


const pool = new pg.Pool({
    connectionString:process.env.DATABASE_URL,
    idleTimeoutMillis:30000,
    connectionTimeoutMillis:30000,
    ssl:{rejectUnauthorized:false}
})

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({adapter})

export default prisma;