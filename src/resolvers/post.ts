import { Post } from "../entities/Post";
import { Arg, Int, Mutation, Query, Resolver } from "type-graphql";

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  posts(): Promise<Post[]> {
    return Post.find();
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne({ _id: id });
  }

  @Mutation(() => Post)
  async createPost(@Arg("name") name: string): Promise<Post> {
    return Post.create({ name }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("name", () => String, { nullable: true }) name: string
  ): Promise<Post | null> {
    const post = await Post.findOne({ _id: id });
    if (!post) {
      return null;
    }

    if (typeof name !== "undefined") {
      await Post.update({_id: id}, {name: name})
    }
    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    try {
      await Post.delete({ _id: id });
      return true;
    } catch {
      return false;
    }
  }
}
