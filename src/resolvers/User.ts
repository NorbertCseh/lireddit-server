import { User } from "../entities/User";
import { MyContext } from "../types";
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from "type-graphql";
import argon2 from 'argon2'
import { EntityManager } from "@mikro-orm/postgresql";

//InputTypes for arguments
@InputType()
class UsernamePasswordInput {
    @Field()
    username: string

    @Field()
    password: string
}

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
    async register(
        @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
        @Ctx() { em }: MyContext
    ): Promise<UserResponse> {
        if (options.username.length <= 2) {
            return {
                errors: [{
                    field: 'username',
                    message: 'Username must be greater than 2'
                }]
            }
        }

        if (options.password.length <= 3) {
            return {
                errors: [{
                    field: 'password',
                    message: 'Password must be greater than 3'
                }]
            }
        }

        const hashedPassword = await argon2.hash(options.password)
        let user
        try {
            //If it fails user.id will be null and we cannot send back null as id coz the schema settings
            const result = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
                username: options.username,
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
        @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {

        const user = await em.findOne(User, { username: options.username })
        if (!user) {
            return {
                errors: [{
                    field: 'username',
                    message: 'That username does not exists.'
                }]
            }
        }
        const valid = await argon2.verify(user.password, options.password,)
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

}