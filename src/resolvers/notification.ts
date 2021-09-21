import {
  Arg,
  Ctx,
  Field,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";
import { Notification, NotificationType } from "../entities/Notification";
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
}

@Resolver(Notification)
export class NotificationResolver {
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
    select n.*,
    json_build_object(
      '_id', u._id,
      'username', u.username,
      'email', u.email,
      'avatarId', u."avatarId",
      'bannerId', u."bannerId",
      'createdAt', u."createdAt",
      'updatedAt', u."updatedAt"
    ) "triggerUser"
    from notification n
    inner join public.user u on u._id = n."triggerId"
    where n."receiverId" = $1
    order by n."status" DESC, n."createdAt" DESC
    limit 10
    `,
      [req.session.userId]
    );

    return notifications;
  }

  @Query(()=>Int)
  @UseMiddleware(isAuth)
  async getNewNotificationsCount(
      @Ctx() {req}: MyContext
  ): Promise<number>{
      const count = await getConnection().query(`
        SELECT COUNT(_id)
        FROM notification
        WHERE "receiverId" = $1 AND status = $2;
      `, [req.session.userId, "sent"]);
      return count[0].count;
  }

  @Mutation(() => Notification)
  @UseMiddleware(isAuth)
  async createNotification(
    @Ctx() { req }: MyContext,
    @Arg("input", () => NotificationInput) input: NotificationInput
  ): Promise<Notification> {
    const notification = await Notification.create({
      triggerId: req.session.userId,
      ...input,
    }).save();
    return notification;
  }
}
