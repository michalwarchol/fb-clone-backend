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
    const { postId, reaction } = variables;
    const userId = req.session.userId;

    const isInDb = await Reaction.findOne({
      where: {
        postId,
        userId: req.session.userId,
      }
    });

    if(!isInDb) {
      await Reaction.insert({ userId, postId, reaction, value: 1});
      await Post.update({ _id: postId}, { [reaction]: () => "\"" + reaction + "\"" + "+ 1" });

      return true;
    }

    if(isInDb.reaction == reaction) {
      await Reaction.delete({ postId, userId: req.session.userId });
      await Post.update({ _id: postId}, {[reaction]: () => "\"" + reaction + "\"" + "- 1"});

      return true;
    }

    await Reaction.update({ userId, postId}, { reaction });
    await Post.update({_id: postId}, {
      [reaction]: () => "\"" + reaction + "\"" + "+ 1",
      [isInDb.reaction]: () => "\"" + isInDb.reaction + "\"" + "- 1",
    });
    
    return true;
  }

  @Query(() => Reaction, { nullable: true })
  @UseMiddleware(isAuth)
  async reaction(
    @Arg("postId", () => Int) postId: number,
    @Ctx() { req }: MyContext
  ): Promise<Reaction | null> {
    const reaction = await Reaction.findOne({
      where: {
        postId,
        userId: req.session.userId,
      }
    });
    return reaction;
  }
}
