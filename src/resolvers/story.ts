import { FileUpload, GraphQLUpload } from "graphql-upload";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
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
  @Query(() => [Story])
  async getStories() {
    return Story.find({});
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
