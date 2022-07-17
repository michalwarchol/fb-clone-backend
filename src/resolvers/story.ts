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
import { Brackets, getConnection } from "typeorm";
import { v4 } from "uuid";
import { FriendRequest } from "../entities/FriendRequest";
import { Story } from "../entities/Story";
import { User } from "../entities/User";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@InputType()
class StoryInput {
  @Field({ nullable: true })
  text?: string;

  @Field({ nullable: true })
  font?: string;

  @Field({ nullable: true })
  gradient?: string;

  @Field({ nullable: true })
  time?: number;
}

@Resolver(Story)
export class StoryResolver {
  @FieldResolver(() => User)
  creator(@Root() story: Story, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(story.userId);
  }

  @Query(() => [Story])
  async getStories() {
    return Story.find({});
  }

  @Query(() => [Story])
  @UseMiddleware(isAuth)
  async getRecentStories(@Ctx() { req }: MyContext): Promise<Story[]> {
    const id = req.session.userId;
    const date = new Date(new Date().setDate(new Date().getDate() - 3));

    const stories = await getConnection()
      .getRepository(Story)
      .createQueryBuilder()
      .where((sq) => {
        const subQuery = sq
          .subQuery()
          .select("1")
          .from(FriendRequest, "fr")
          .where(
            new Brackets((qb) => {
              qb.where(
                new Brackets((qb1) => {
                  qb1
                    .where('fr.sender = "userId"')
                    .andWhere("fr.receiver = :id", { id });
                })
              ).orWhere(
                new Brackets((qb2) => {
                  qb2
                    .where("fr.sender = :id", { id })
                    .andWhere('fr.receiver = "userId"');
                })
              );
            })
          )
          .andWhere("fr.status = :status", { status: "accepted" })
          .getQuery();
        return "EXISTS " + subQuery;
      })
      .andWhere('"createdAt" > :date', { date })
      .orderBy('"userId"', "ASC")
      .addOrderBy('"createdAt"', "ASC")
      .getMany();

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
      imageId,
    }).save();
  }
}
