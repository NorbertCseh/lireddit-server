import { User } from "../entities/User";
import { MyContext } from "../types";
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver } from "type-graphql";
import argon2 from 'argon2'


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
                    field: 'Username',
                    message: 'Username must be greater than 2'
                }]
            }
        }

        if (options.password.length <= 3) {
            return {
                errors: [{
                    field: 'Password',
                    message: 'Password must be greater than 3'
                }]
            }
        }

        const hashedPassword = await argon2.hash(options.password)
        const user = em.create(User, { username: options.username, password: hashedPassword })
        try {
            //If it fails user.id will be null and we cannot send back null as id coz the schema settings
            await em.persistAndFlush(user)
        } catch (error) {
            if (error.code === '23505') {
                //Duplicate username error
                return {
                    errors: [{
                        field: 'Username',
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
        @Ctx() { em }: MyContext
    ): Promise<UserResponse> {

        const user = await em.findOne(User, { username: options.username })
        if (!user) {
            return {
                errors: [{
                    field: 'Username',
                    message: 'That username does not exists.'
                }]
            }
        }
        const valid = await argon2.verify(user.password, options.password,)
        if (!valid) {
            return {
                errors: [{
                    field: 'Password',
                    message: 'Incorrect password.'
                }]
            }
        }
        return {
            user
        }
    }
}