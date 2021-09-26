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
import { getConnection } from "typeorm";
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
  tagged: number[]
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
    const reaLimitPlusOne = realLimit + 1;

    const replacements: any[] = [reaLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    if(creatorId){
      replacements.push(creatorId);
    }

    let conditions = "";
    if(cursor && creatorId){
      conditions = `where p."createdAt" < $2 AND p."creatorId" = $3`;
    }else if(cursor && !creatorId){
      conditions = `where p."createdAt" < $2`;
    } else if(!cursor && creatorId){
      conditions = `where p."creatorId" = $2`;
    }


    const posts = await getConnection().query(
      `
    select p.*
    from post p
    ${conditions}
    order by p."createdAt" DESC
    limit $1
    `,
      replacements
    );
    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === reaLimitPlusOne,
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

    if (typeof text !== "undefined") {
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
    const image = s3.getSignedUrl("getObject", {Bucket: process.env.AWS_BUCKET_NAME, Key: imageId});
    if(!image){
      return null;
    }
    return image;
  }
}
