import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
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

@Resolver()
export class PostResolver {
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;

    const replacements: any[] = [reaLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
    select p.*,
    json_build_object(
      '_id', u._id,
      'username', u.username,
      'email', u.email,
      'avatarId', u."avatarId",
      'bannerId', u."bannerId",
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
      ) creator
    from post p
    inner join public.user u on u._id = p."creatorId"
    ${cursor ? `where p."createdAt" < $2` : ""}
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

  @Query(()=>PaginatedPosts)
  async getPostsByCreatorId(
    @Arg("creatorId", ()=>Int) creatorId: number,
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts>{

    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;

    const replacements: any[] = [creatorId, reaLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
        select p.*,
        json_build_object(
          '_id', u._id,
          'username', u.username,
          'email', u.email,
          'avatarId', u."avatarId",
          'bannerId', u."bannerId",
          'createdAt', u."createdAt",
          'updatedAt', u."updatedAt"
        ) creator
        from post p
        inner join public.user u on u._id = p."creatorId"
        where p."creatorId" = $1 ${cursor ? `and p."createdAt" < $3` : ""}
        order by "createdAt" DESC
        limit $2
      `,  replacements
    )

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === reaLimitPlusOne,
    };
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
