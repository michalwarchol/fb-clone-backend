import { S3 } from "aws-sdk";
import {Request, Response} from "express";
import { Session, SessionData } from "express-session";
import {Redis} from "ioredis";
import { createUserLoader } from "./utils/createUserLoader";
import { DataSource } from "typeorm";

export type MyContext = {
    req: Request & { session: Session & Partial<SessionData> & { userId?: number } }
    redis: Redis
    res: Response
    s3: S3
    userLoader: ReturnType<typeof createUserLoader>
    dataSource: DataSource
}