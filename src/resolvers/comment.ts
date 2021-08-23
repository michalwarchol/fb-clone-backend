import { Arg, Ctx, Field, Int, Mutation, ObjectType, Query, Resolver, UseMiddleware } from "type-graphql";
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
  @Query(() => PaginatedComments)
  async getPostComments(
    @Arg("postId", () => Int) postId: number,
    @Arg("limit", ()=>Int) limit: number,
    @Arg("offset", ()=>Int, {nullable: true}) offset: number | null
  ): Promise<PaginatedComments> {
    
    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;

    const replacements: any[] = [postId, reaLimitPlusOne];

    if (offset) {
      replacements.push(offset);
    }

    const comments = await getConnection().query(
      `
      select c.*,
    json_build_object(
      '_id', u._id,
      'username', u.username,
      'email', u.email,
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
      ) creator
    from comment c
    inner join public.user u on u._id = c."creatorId"
    where c."postId" = $1
    order by c."createdAt" DESC
    ${offset ? `offset $3` : ``}
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