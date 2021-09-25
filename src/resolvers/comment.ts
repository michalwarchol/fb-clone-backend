import { Arg, Ctx, Field, FieldResolver, Int, Mutation, ObjectType, Query, Resolver, Root, UseMiddleware } from "type-graphql";
import { getConnection } from "typeorm";
import { Comment } from "../entities/Comment";
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

  @FieldResolver()
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

    const replacements: any[] = [postId, reaLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const comments = await getConnection().query(
      `
      select c.*
    from comment c
    where c."postId" = $1 ${cursor ? ` and c."createdAt" < $3` : ``}
    order by c."createdAt" DESC
    limit $2
    `, replacements)

    return {
      comments: comments.slice(0, realLimit),
      hasMore: comments.length === reaLimitPlusOne,
    };
  }

  @Query(()=>Int)
  async commentCount(
    @Arg("postId", ()=>Int) postId: number
  ): Promise<number>{
    const result = await getConnection().query(
      `
        select count(_id)
        from comment
        where "postId" = $1;
      `, [postId]
    )

    const count = parseInt(result[0].count);

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
