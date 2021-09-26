import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";
import { Notification, NotificationType } from "../entities/Notification";
import { User } from "../entities/User";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@InputType()
class NotificationInput {
  @Field(() => String)
  info!: string;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field(() => Int)
  receiverId!: number;

  @Field(() => String, { nullable: true, defaultValue: "#" })
  link: string;

  @Field(() => Int, { nullable: true })
  postId: number;
}

@Resolver(Notification)
export class NotificationResolver {

  @FieldResolver(()=>User)
  triggerUser(@Root() notification: Notification, @Ctx(){userLoader}: MyContext){
    return userLoader.load(notification.triggerId);
  }

  @Query(() => [Notification])
  async getNotifications(): Promise<Notification[]> {
    return Notification.find({});
  }

  @Query(() => [Notification])
  @UseMiddleware(isAuth)
  async getUserNotifications(
    @Ctx() { req }: MyContext
  ): Promise<Notification[]> {
    const notifications = await getConnection().query(
      `
    select n.*
    from notification n
    where n."receiverId" = $1
    order by n."createdAt" DESC
    limit 10
    `,
      [req.session.userId]
    );

    return notifications;
  }

  @Query(() => Int)
  @UseMiddleware(isAuth)
  async getNewNotificationsCount(@Ctx() { req }: MyContext): Promise<number> {
    const count = await getConnection().query(
      `
        SELECT COUNT(_id)
        FROM notification
        WHERE "receiverId" = $1 AND status = $2;
      `,
      [req.session.userId, "sent"]
    );
    return count[0].count;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async createNotification(
    @Ctx() { req }: MyContext,
    @Arg("input", () => NotificationInput) input: NotificationInput
  ): Promise<boolean> {

    if(input.receiverId==req.session.userId){
      //user will not receive a notification after activities affecting himself
      return false;
    }

    if (input.postId) {
      const isInDb = await getConnection()
        .getRepository(Notification)
        .createQueryBuilder()
        .where('type = :type AND "postId" = :postId AND "triggerId" = :triggerId', {
          type: input.type,
          postId: input.postId,
          triggerId: req.session.userId,
        })
        .getOne();
      if (isInDb) {
        return false;
      }
    }
    await Notification.create({
      triggerId: req.session.userId,
      ...input,
    }).save();
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async updateNotificationStatus(
    @Arg("notifications", () => [Int]) notifications: number[]
  ): Promise<boolean> {
    await getConnection()
      .createQueryBuilder()
      .update(Notification)
      .set({ status: "received" })
      .where("_id IN (:...notifications)", { notifications })
      .execute();

    return true;
  }
}
