import "dotenv-safe/config";
import "reflect-metadata";
import { COOKIE_NAME, __prod__ } from "./constants";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import { MyContext } from "./types";
import cors from "cors";
import {createConnection} from "typeorm"
import {S3} from "aws-sdk"
import { User } from "./entities/User";
import { Post } from "./entities/Post";
import { Reaction } from "./entities/Reaction";
import {Comment }from "./entities/Comment";
import { ReactionResolver } from "./resolvers/reaction";
import { CommentResolver } from "./resolvers/comment";
import { graphqlUploadExpress } from "graphql-upload";
import { FriendRequest } from "./entities/FriendRequest";
import { FriendRequestResolver } from "./resolvers/friendRequest";
import { Story } from "./entities/Story";
import { StoryResolver } from "./resolvers/story";
import { NotificationResolver } from "./resolvers/notification";
import { Notification } from "./entities/Notification";
import { createUserLoader } from "./utils/createUserLoader";
import path from "path";

const main = async () => {

  const conn = await createConnection({
    type: "postgres",
    url: process.env.DATABASE_URL,
    logging: true,
    //synchronize: true,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, User, Reaction, Comment, FriendRequest, Story, Notification]
  })
  await conn.runMigrations()

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);

  app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
  }))

  app.set("trust proxy", 1);

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: "lax", // csrf
        secure: __prod__, // cookie only works in https
        domain: __prod__ ? ".clone-book.com" : undefined
      },
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET,
      resave: false,
    })
  );

  const s3 = new S3({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET,
    region: process.env.AWS_REGION
  })

  app.use(graphqlUploadExpress({ maxFileSize: 100000 * 20, maxFiles: 10 }));

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver, ReactionResolver, CommentResolver, FriendRequestResolver, StoryResolver, NotificationResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res, redis, s3, userLoader: createUserLoader() }),
    uploads: false
  });

  apolloServer.applyMiddleware({
    app,
    cors: false
  });

  app.listen(parseInt(process.env.PORT), () => {
    console.log("Server started at localhost:4000");
  });
};

main().catch((err) => {
  console.log(err.message);
});
