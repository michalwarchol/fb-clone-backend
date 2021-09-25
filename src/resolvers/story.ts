import { FileUpload, GraphQLUpload } from "graphql-upload";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";
import { v4 } from "uuid";
import { Story } from "../entities/Story";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@InputType()
class StoryInput {

  @Field({nullable: true})
  text?: string;

  @Field({nullable: true})
  font?: string;

  @Field({nullable: true})
  gradient?: string;

  @Field({nullable: true})
  time?: number;
}

@Resolver(Story)
export class StoryResolver {

  @FieldResolver()
  creator(@Root() story: Story, @Ctx(){userLoader}: MyContext){
    return userLoader.load(story.userId);
  }

  @Query(() => [Story])
  async getStories() {
    return Story.find({});
  }

  @Query(()=>[Story])
  @UseMiddleware(isAuth)
  async getRecentStories(
    @Ctx() {req}: MyContext
  ): Promise<Story[]>{

    let replacements: any = ["accepted", req.session.userId];
    let now = new Date();
    let threeDaysAgo = now.setDate(now.getDate()-3);
    replacements.push(new Date(threeDaysAgo));


    const stories = await getConnection().query(
      `
        SELECT s.*
        FROM story s
        WHERE EXISTS (
          SELECT 1 FROM friend_request
          WHERE ((friend_request.sender = s."userId" AND friend_request.receiver = $2) 
          OR (friend_request.sender = $2 AND friend_request.receiver = s."userId"))
          AND friend_request.status = $1
        )
        AND s."createdAt" > $3
        ORDER BY s."userId" ASC, s."createdAt" ASC; 
      `, replacements
    )
    return stories;
  }

  @Mutation(() => Story)
  @UseMiddleware(isAuth)
  async createStory(
    @Ctx() { req, s3 }: MyContext,
    @Arg("input", () => StoryInput) input: StoryInput,
    @Arg("image", () => GraphQLUpload, { nullable: true }) image?: FileUpload
  ) {
    let imageId = undefined;
    if (image) {
      imageId = v4();
      await s3
        .upload({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: imageId,
          Body: image.createReadStream(),
        })
        .promise();
    }

    return Story.create({
        ...input,
        userId: req.session.userId,
        imageId
    }).save();
  }
}
