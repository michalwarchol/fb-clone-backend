import { GraphQLUpload, Upload } from "graphql-upload";
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
import { Brackets } from "typeorm";
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
  async getStories(): Promise<Story[]> {
    return Story.find({});
  }

  @Query(() => [Story])
  @UseMiddleware(isAuth)
  async getRecentStories(@Ctx() { req, dataSource }: MyContext): Promise<Story[]> {
    const id = req.session.userId;
    const date = new Date(new Date().setDate(new Date().getDate() - 3));

    const stories = await dataSource
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
                    .where('fr.sender = "userId"') // eslint-disable-line quotes
                    .andWhere("fr.receiver = :id");
                })
              ).orWhere(
                new Brackets((qb2) => {
                  qb2
                    .where("fr.sender = :id")
                    .andWhere('fr.receiver = "userId"'); // eslint-disable-line quotes
                })
              );
            })
          )
          .andWhere("fr.status = :status")
          .getQuery();

        return "EXISTS " + subQuery;
      })
      .andWhere('"createdAt" > :date') // eslint-disable-line quotes
      .orderBy('"userId"', "ASC") // eslint-disable-line quotes
      .addOrderBy('"createdAt"', "ASC") // eslint-disable-line quotes
      .setParameter("date", date)
      .setParameter("id", id)
      .setParameter("status", "accepted")
      .getMany();

    return stories;
  }

  @Mutation(() => Story)
  @UseMiddleware(isAuth)
  async createStory(
    @Ctx() { req, s3 }: MyContext,
    @Arg("input", () => StoryInput) input: StoryInput,
    @Arg("image", () => GraphQLUpload, { nullable: true }) image?: Upload
  ): Promise<Story> {
    const userId = req.session.userId as number;
    const newStory = Story.create({ ...input, userId });
    if (image) {
      newStory.imageId = v4();
      await s3
        .upload({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: newStory.imageId,
          Body: image.file?.createReadStream(),
        })
        .promise();
    }

    return newStory.save();
  }
}
