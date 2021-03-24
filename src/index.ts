import 'reflect-metadata'
require('dotenv').config()
import { MikroORM } from '@mikro-orm/core'
import { __prod__ } from './constants';
import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import redis from 'redis';
import session from 'express-session';
import connectRedis from 'connect-redis'



import microConfig from './mikro-orm.config'
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/Post';
import { UserResolver } from './resolvers/User';
import { MyContext } from './types';




const main = async () => {

    const orm = await MikroORM.init(microConfig);
    await orm.getMigrator().up()

    const app = express()

    const RedisStore = connectRedis(session)
    const redisClient = redis.createClient()

    app.use(
        session({
            name: 'qid',
            store: new RedisStore({
                client: redisClient,
                //When customer dose something, refresh the session remaining time
                disableTouch: true,
            }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //10 years
                httpOnly: true, //Cannot access the cookie from browser
                secure: false, //cookie only works in https
                sameSite: 'lax' //csrf google it
            },
            saveUninitialized: false,
            secret: process.env.REDIS_SECRET!,
            resave: false,
        })
    )

    const apolloServer = new ApolloServer({
        schema: await buildSchema(
            {
                resolvers: [HelloResolver, PostResolver, UserResolver],
                validate: false,
            }
        ),
        //To access it from everywhere req,res for the cookie
        context: ({ req, res }): MyContext => ({ em: orm.em, req, res })
    })

    apolloServer.applyMiddleware({ app });

    app.listen(4000, () => {
        console.log('Server started on localhost:4000');
    })
}


main().catch(err => {
    console.error(err);
})