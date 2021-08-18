import { Arg, Ctx, Int, Mutation, Query, Resolver, UseMiddleware } from "type-graphql";
import { getConnection } from "typeorm";
import { Comment } from "../entities/Comment";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@Resolver(Comment)
export class CommentResolver {
  @Query(() => [Comment])
  async getPostComments(
    @Arg("postId", () => Int) postId: number
  ): Promise<Comment[]> {
    //return Comment.find({ where: { postId } });
    const comments = getConnection().query(
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
    limit 10
    `, [postId])

    return comments;
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
