import "dotenv-safe/config";
import {MikroORM} from "@mikro-orm/core";
import { __prod__ } from "./constants";
import mikroORMConfig from "./mikro-orm.config";
import express from "express";
import {ApolloServer} from "apollo-server-express"
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";

const main = async () => {
    const orm = await MikroORM.init(mikroORMConfig);
    await orm.getMigrator().up();

    const app = express();

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver],
            validate: false,
        })
    });

    apolloServer.applyMiddleware({app});

    app.listen(3000, ()=>{
        console.log("Server started at localhost:3000");
    })
}


main().catch(err=>{
    console.log(err);
});