import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware
} from "type-graphql";
import { LessThan, FindOptionsWhere } from "typeorm";
import { Comment } from "../entities/Comment";
import { User } from "../entities/User";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@ObjectType()
class PaginatedComments {
  @Field(() => [Comment])
    comments: Comment[];

  @Field()
    hasMore: boolean;
}

@Resolver(Comment)
export class CommentResolver {

  @FieldResolver(()=>User)
  creator(@Root() comment: Comment, @Ctx(){userLoader}: MyContext){
    return userLoader.load(comment.creatorId);
  }

  @Query(() => PaginatedComments)
  async getPostComments(
    @Arg("postId", () => Int) postId: number,
    @Arg("limit", ()=>Int) limit: number,
    @Arg("cursor", ()=>String, {nullable: true}) cursor: string | null
  ): Promise<PaginatedComments> {
    
    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;

    const where: FindOptionsWhere<Comment> = { postId };

    if (cursor) {
      where.createdAt = LessThan(new Date(parseInt(cursor)));
    }

    const comments = await Comment.find({
      where,
      take: reaLimitPlusOne,
      order: {createdAt: "DESC"}
    });

    return {
      comments: comments.slice(0, realLimit),
      hasMore: comments.length === reaLimitPlusOne,
    };
  }

  @Query(()=>Int)
  async commentCount(
    @Arg("postId", ()=>Int) postId: number
  ): Promise<number> {
    const count = await Comment.count({ where: { postId }});

    return count;
  }


  @Mutation(() => Comment)
  @UseMiddleware(isAuth)
  async createComment(
    @Arg("text", () => String) text: string,
    @Arg("postId", () => Int) postId: number,
    @Ctx() {req}: MyContext
  ): Promise<Comment> {
    return Comment.create({
      text,
      postId,
      creatorId: req.session.userId
    }).save();
  }
}
