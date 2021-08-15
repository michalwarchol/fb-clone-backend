import {
  registerEnumType,
  InputType,
  Field,
  Int,
  Mutation,
  UseMiddleware,
  Arg,
  Ctx,
  Query,
  Resolver,
} from "type-graphql";
import { getConnection } from "typeorm";
import { Post } from "../entities/Post";
import { Reaction } from "../entities/Reaction";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

enum ReactionType {
  LIKE = "like",
  LOVE = "love",
  CARE = "care",
  HAHA = "haha",
  WOW = "wow",
  SAD = "sad",
  ANGRY = "angry",
}

registerEnumType(ReactionType, {
  name: "ReactionType",
  description: "Reactions, that a user can have on a post",
});

@InputType()
class ReactionInput {
  @Field(() => ReactionType)
  reaction: ReactionType;

  @Field(() => Int)
  postId: number;

  @Field(() => Int)
  value: number;
}

@Resolver(Reaction)
export class ReactionResolver {
  @Query(() => [Reaction])
  async reactions() {
    return Reaction.find({});
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async react(
    @Arg("variables", () => ReactionInput) variables: ReactionInput,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    const { value, postId, reaction } = variables;
    const userId = req.session.userId;
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;

    const isInDb = await Reaction.findOne({
      postId,
      userId: req.session.userId,
    });
    if (isInDb && isInDb.reaction == reaction) {
      await Reaction.delete({ postId, userId: req.session.userId });
      await getConnection()
        .createQueryBuilder()
        .update(Post)
        .set({ [reaction]: () => '"' + reaction + '"' + "-" + realValue })
        .where({ _id: postId })
        .execute();

      return true;
    }
    if (isInDb && isInDb.reaction != reaction) {
      await getConnection()
        .createQueryBuilder()
        .update(Reaction)
        .set({ reaction: reaction })
        .where({ userId, postId })
        .execute();

      await getConnection()
        .createQueryBuilder()
        .update(Post)
        .set({
          [reaction]: () => '"' + reaction + '"' + "+" + realValue,
          [isInDb.reaction]: () => '"' + isInDb.reaction + '"' + "-" + realValue,
        })
        .where({ _id: postId })
        .execute();

      return true;
    }

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Reaction)
      .values({
        userId,
        postId,
        reaction: reaction,
        value: realValue,
      })
      .execute();

    await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ [reaction]: () => '"' + reaction + '"' + "+" + realValue })
      .where({ _id: postId })
      .execute();

    return true;
  }

  @Query(() => Reaction, { nullable: true })
  @UseMiddleware(isAuth)
  async reaction(
    @Arg("postId", () => Int) postId: number,
    @Ctx() { req }: MyContext
  ): Promise<Reaction | undefined> {
    const reaction = await Reaction.findOne({
      postId,
      userId: req.session.userId,
    });
    return reaction;
  }
}
