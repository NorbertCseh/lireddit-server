import { User } from "../entities/User";
import { MyContext } from "../types";
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from "type-graphql";
import argon2 from 'argon2'
import { EntityManager } from "@mikro-orm/postgresql";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "../utils/UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";

@ObjectType()
class FieldError {
    @Field()
    field: string

    @Field()
    message: string
}

//ObjectType for response
@ObjectType()
class UserResponse {
    //?-> If user found return user, if not found return errors
    @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[]

    @Field(() => User, { nullable: true })
    user?: User
}

@Resolver()
export class UserResolver {

    @Mutation(() => UserResponse)
    async changePassword(
        @Arg('token') token: string,
        @Arg('newPassword') newPassword: string,
        @Ctx() { em, redis }: MyContext
    ): Promise<UserResponse> {
        if (newPassword.length <= 3) {
            return {
                errors: [{
                    field: 'newPassword',
                    message: 'Password must be greater than 3'
                }]
            }
        }
        const key = FORGOT_PASSWORD_PREFIX + token
        const userId = await redis.get(key)
        if (!userId) {
            return {
                errors: [{
                    field: "token",
                    message: "Token Expired"
                }]
            }
        }

        const user = await em.findOne(User, { id: parseInt(userId) })
        if (!user) {
            return {
                errors: [{
                    field: "token",
                    message: "User does not exists"
                }]
            }
        }
        user.password = await argon2.hash(newPassword)
        em.persistAndFlush(user)
        redis.del(key)
        return { user }
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg('email') email: string,
        @Ctx() { em, redis }: MyContext
    ) {
        const user = await em.findOne(User, { email })
        if (!user) {
            //The email is not in the db
            return true
        }
        const token = v4();
        await redis.set(FORGOT_PASSWORD_PREFIX + token, user.id, 'ex', 1000 * 60 * 60 * 24 * 3) // 3 days
        await sendEmail(email, `<a href="http://localhost:3000/change-password/${token}">Reset Password</a>`)
        return true
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
        @Ctx() { em }: MyContext
    ): Promise<UserResponse> {
        const errors = validateRegister(options)

        if (errors) {
            return { errors }
        }

        const hashedPassword = await argon2.hash(options.password)
        let user
        try {
            //If it fails user.id will be null and we cannot send back null as id coz the schema settings
            const result = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
                username: options.username,
                email: options.email,
                password: hashedPassword,
                created_at: new Date(),
                updated_at: new Date()
            }).returning("*");
            user = result[0];
        } catch (error) {
            if (error.code === '23505') {
                //Duplicate username error
                return {
                    errors: [{
                        field: 'username',
                        message: 'Username already taken'
                    }]
                }

            }
            console.error(error);

        }

        return {
            user
        }
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('usernameOrEmail') usernameOrEmail: string,
        @Arg('password') password: string,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const user = await em.findOne(User, usernameOrEmail.includes('@') ? { email: usernameOrEmail }
            : { username: usernameOrEmail });
        if (!user) {
            return {
                errors: [{
                    field: 'usernameOrEmail',
                    message: 'Username or email does not exists.'
                }]
            }
        }
        const valid = await argon2.verify(user.password, password,)
        if (!valid) {
            return {
                errors: [{
                    field: 'password',
                    message: 'Incorrect password.'
                }]
            }
        }

        req.session.userId = user.id

        return {
            user
        }
    }

    @Query(() => User, { nullable: true })
    async me(
        @Ctx() { req, em }: MyContext
    ): Promise<User | null> {
        //You are not logged in
        if (!req.session.userId) {
            return null
        }
        const user = await em.findOne(User, { id: req.session.userId })!
        return user
    }

    @Mutation(() => Boolean)
    logout(
        @Ctx() { req, res }: MyContext
    ) {
        return new Promise((resolve) => req.session.destroy((err) => {
            if (err) {
                console.error(err);
                resolve(false)
                return
            }
            res.clearCookie(COOKIE_NAME)
            resolve(true)
        }))
    }
}