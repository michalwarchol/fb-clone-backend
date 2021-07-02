import "dotenv-safe/config";
import "reflect-metadata";
import {MikroORM} from "@mikro-orm/core";
import { __prod__ } from "./constants";
import mikroORMConfig from "./mikro-orm.config";
import express from "express";
import {ApolloServer} from "apollo-server-express"
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";

const main = async () => {
    const orm = await MikroORM.init(mikroORMConfig);
    await orm.getMigrator().up();

    const app = express();

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver],
            validate: false,
        }),
        context: () => ({ em: orm.em })
    });

    apolloServer.applyMiddleware({app});

    app.listen(3000, ()=>{
        console.log("Server started at localhost:3000");
    })
}


main().catch(err=>{
    console.log(err.message);
});