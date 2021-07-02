import { __prod__ } from "./constants";
import { MikroORM } from "@mikro-orm/core";
import path from "path"
import { Post } from "./entities/Post";

export default {
  migrations: {
    path: path.join(__dirname, './migrations'),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
  entities: [Post],
  dbName: "fbclone",
  debug: !__prod__,
  type: "postgresql",
  password: process.env.POSTGRESQL_PASSWORD
} as Parameters<typeof MikroORM.init>[0];
