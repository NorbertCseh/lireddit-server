import { Post } from "../entities/Post";
import { Arg, Ctx, Int, Mutation, Query, Resolver } from "type-graphql";
import { MyContext } from "src/types";

@Resolver()
export class PostResolver {
    @Query(() => [Post])
    posts(
        //ctx or {em}
        @Ctx() { em }: MyContext
    ): Promise<Post[]> {
        return em.find(Post, {})
    }

    @Query(() => Post, { nullable: true }) //What should graphql sent back it can be null
    post(
        @Arg('id', () => Int) id: number, //number for ts, Int for graphql //"id" is for the schema on graphql
        @Ctx() { em }: MyContext
    ): Promise<Post | null> { // Function only can send back Post or null
        return em.findOne(Post, { id })
    }

    @Mutation(() => Post)
    async createPost(
        @Arg("title") title: string,
        @Ctx() { em }: MyContext
    ): Promise<Post> {
        const post = em.create(Post, { title })
        await em.persistAndFlush(post)
        return post
    }

    @Mutation(() => Post, { nullable: true })
    async updatePost(
        @Arg("id") id: number,
        @Arg("title", () => String, { nullable: true }) title: string,
        @Ctx() { em }: MyContext
    ): Promise<Post | null> {
        const post = await em.findOne(Post, { id })
        if (!post) {
            return null
        }
        if (typeof title !== 'undefined') {
            post.title = title
            await em.persistAndFlush(post)
        }
        return post
    }

    @Mutation(() => Boolean)
    async deletePost(
        @Arg("id") id: number,
        @Ctx() { em }: MyContext
    ): Promise<boolean> {
        await em.nativeDelete(Post, { id })
        return true
    }
}