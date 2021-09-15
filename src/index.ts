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

const main = async () => {

  await createConnection({
    type: "postgres",
    database: "fbclone2",
    username: "postgres",
    password: process.env.POSTGRESQL_PASSWORD,
    logging: true,
    synchronize: true,
    entities: [Post, User, Reaction, Comment, FriendRequest, Story]
  })

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis();

  app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
  }))

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
      },
      saveUninitialized: false,
      secret: "qowiueojwojfalksdjoqiwueo",
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
      resolvers: [PostResolver, UserResolver, ReactionResolver, CommentResolver, FriendRequestResolver, StoryResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res, redis, s3 }),
    uploads: false
  });

  apolloServer.applyMiddleware({
    app,
    cors: false
  });

  app.listen(4000, () => {
    console.log("Server started at localhost:4000");
  });
};

main().catch((err) => {
  console.log(err.message);
});
