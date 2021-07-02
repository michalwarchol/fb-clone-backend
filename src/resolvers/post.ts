import { Post } from "../entities/Post";
import { MyContext } from "src/types";
import { Arg, Ctx, Int, Mutation, Query, Resolver } from "type-graphql";

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  posts(@Ctx() { em }: MyContext): Promise<Post[]> {
    return em.find(Post, {});
  }

  @Query(() => Post, { nullable: true })
  post(
    @Arg("id", () => Int) id: number,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    return em.findOne(Post, { _id: id });
  }

  @Mutation(() => Post)
  async createPost(
    @Arg("name") name: string,
    @Ctx() { em }: MyContext
  ): Promise<Post> {
    const post = em.create(Post, {name});
    await em.persistAndFlush(post);
    return post;
  }

  @Mutation(() => Post, {nullable: true})
  async updatePost(
    @Arg("id") id: number,
    @Arg("name", () => String, {nullable: true}) name: string,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    const post = await em.findOne(Post, {_id: id});
    if(!post){
      return null;
    }
    
    if(typeof name !== 'undefined'){
      post.name=name;
      await em.persistAndFlush(post);
    }
    return post;
  }

  @Mutation(()=>Boolean)
  async deletePost(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<boolean> {
    try{
      await em.nativeDelete(Post, {_id: id})
      return true;
    } catch {
      return false;
    }
  }
}
