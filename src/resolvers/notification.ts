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
import { In } from "typeorm";
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
    const userId = req.session.userId;
    const notifications = await Notification.find({
      where: { receiverId: userId },
      order: { createdAt: "DESC" },
      take: 10,
    });

    return notifications;
  }

  @Query(() => Int)
  @UseMiddleware(isAuth)
  async getNewNotificationsCount(@Ctx() { req }: MyContext): Promise<number> {
    const userId = req.session.userId;
    const count = Notification.count({
      where: { receiverId: userId, status: "sent" },
    });

    return count;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async createNotification(
    @Ctx() { req }: MyContext,
    @Arg("input", () => NotificationInput) input: NotificationInput
  ): Promise<boolean> {
    const { receiverId, type, postId } = input;
    const userId = req.session.userId;
    if (receiverId === userId) {
      //user will not receive a notification after activities affecting himself
      return false;
    }

    if (postId) {
      const isInDb = await Notification.findOne({where: {type, postId, triggerId: userId}});
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
    await Notification.update({ _id: In(notifications) }, { status: "received" });

    return true;
  }
}
