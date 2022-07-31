import { Post } from "../entities/Post";
import {User} from "../entities/User";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middleware/isAuth";
import { LessThan, FindConditions } from "typeorm";
import { v4 } from "uuid";
import { FileUpload, GraphQLUpload } from "graphql-upload";

@InputType()
class PostInput {
  @Field()
    text: string;

  @Field()
    feeling?: string;

  @Field()
    activity?: string;

  @Field(()=>[Int])
    tagged: number[];
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
    posts: Post[];

  @Field()
    hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {

  @FieldResolver(()=>User)
  creator(@Root() post: Post, @Ctx(){userLoader}: MyContext){
    return userLoader.load(post.creatorId);
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Arg("creatorId", ()=>Int, {nullable: true}) creatorId: number|null,
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;

    const where: FindConditions<Post> = {};

    if(cursor){
      where.createdAt = LessThan(cursor);
    }
    
    if(creatorId){
      where.creatorId = creatorId;
    }

    const posts = await Post.find({
      where,
      order: {createdAt: "DESC"},
      take: realLimitPlusOne,
    });

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  async post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne({ _id: id });
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Ctx() { req, s3 }: MyContext,
    @Arg("input") input: PostInput,
    @Arg("image", () => GraphQLUpload, {nullable: true}) image: FileUpload
  ): Promise<Post> {
    let imageId = null;
    if (image) {
      imageId = v4();
      await s3
        .upload({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: imageId,
          Body: image.createReadStream()
        })
        .promise();
    }

    return Post.create({
      text: input.text,
      activity: input.activity,
      feeling: input.feeling,
      creatorId: req.session.userId,
      imageId: imageId ? imageId: "",
      tagged: input.tagged
    }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("text", () => String, { nullable: true }) text: string
  ): Promise<Post | null> {
    const post = await Post.findOne({ _id: id });
    if (!post) {
      return null;
    }

    if (text) {
      await Post.update({ _id: id }, { text: text });
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

  @Query(()=>String)
  async getImage(
    @Ctx() { s3 }: MyContext,
    @Arg("imageId", ()=>String) imageId: string
  ): Promise<string|null>{
    const image = await s3.getObject({Bucket: process.env.AWS_BUCKET_NAME,
      Key: imageId}).promise();
    if(!image){
      return null;
    }
    //image.Body is a Buffer so I convert it to base64
    return image.Body?.toString("base64") || null;
  }
}
