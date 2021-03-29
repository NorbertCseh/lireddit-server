import { Field, InputType } from "type-graphql";

//InputTypes for arguments

@InputType()
export class UsernamePasswordInput {
    @Field()
    username: string;

    @Field()
    email: string;

    @Field()
    password: string;
}
