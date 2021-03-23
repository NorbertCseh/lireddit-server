import 'reflect-metadata'
require('dotenv').config()
import { MikroORM } from '@mikro-orm/core'
import { __prod__ } from './constants';
import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'


import microConfig from './mikro-orm.config'
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/Post';

const main = async () => {

    const orm = await MikroORM.init(microConfig);
    await orm.getMigrator().up()

    const app = express()

    const apolloServer = new ApolloServer({
        schema: await buildSchema(
            {
                resolvers: [HelloResolver, PostResolver],
                validate: false,
            }
        ),
        //To access it from everywhere the em
        context: () => ({ em: orm.em })
    })

    apolloServer.applyMiddleware({ app });

    app.listen(4000, () => {
        console.log('Server started on localhost:4000');
    })
}


main().catch(err => {
    console.error(err);
})