import {
  Arg,
  Ctx,
  Field,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { getConnection } from "typeorm";
import { FriendRequest } from "../entities/FriendRequest";
import { MyContext } from "../types";

@ObjectType()
class UserRequest {
  @Field(() => FriendRequest, { nullable: true })
  friendRequest: FriendRequest | null;

  @Field()
  isSender: boolean;
}

@Resolver(FriendRequest)
export class FriendRequestResolver {
  @Query(() => [FriendRequest])
  async friendRequests(): Promise<FriendRequest[]> {
    return FriendRequest.find({});
  }

  @Query(() => [FriendRequest])
  async getUserFriendRequests(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int, { nullable: true }) userId?: number
  ): Promise<FriendRequest[]> {
    const replacements: any[] = [];

    if (userId) {
      replacements.push(userId);
    } else {
      //if userId is not specified, it means that we want to take requests of a logged user
      replacements.push(req.session.userId);
    }

    const friendRequests = await getConnection().query(
      `   select *
                from friend_request
                where sender = $1 or receiver = $1
            `,
      replacements
    );

    return friendRequests;
  }

  @Query(() => UserRequest)
  async getFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int) userId: number
  ): Promise<UserRequest> {
    const request = await getConnection()
      .getRepository(FriendRequest)
      .createQueryBuilder()
      .where(
        "(sender = :me AND receiver = :user) OR (sender = :user AND receiver = :me)",
        {
          me: req.session.userId,
          user: userId,
        }
      )
      .getOne();

    if (!request) {
      return {
        friendRequest: null,
        isSender: false,
      };
    }

    //has this user sent me a friend request
    let isSender = false;
    if (request.sender == userId) {
      isSender = true;
    }

    return {
      friendRequest: request,
      isSender,
    };
  }

  @Mutation(() => Boolean)
  async createFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("receiverId", () => Int) receiverId: number
  ): Promise<boolean> {
    if (req.session.userId == receiverId) {
      //when user tries to send a friend request to himself
      return false;
    }

    await FriendRequest.create({
      sender: req.session.userId,
      receiver: receiverId,
      status: "in-progress",
    }).save();

    return true;
  }

  @Mutation(() => Boolean)
  async acceptFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int) userId: number
  ): Promise<boolean> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(FriendRequest)
      .set({ status: "accepted" })
      .where(
        "(sender = :me AND receiver = :user) OR (sender = :user AND receiver = :me)",
        {
          me: req.session.userId,
          user: userId,
        }
      )
      .execute();

    return result.affected == 1;
  }

  @Mutation(() => Boolean)
  async removeFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int) userId: number
  ) {
    const result = await getConnection()
      .createQueryBuilder()
      .delete()
      .from(FriendRequest)
      .where(
        "(sender = :me AND receiver = :user) OR (sender = :user AND receiver = :me)",
        {
          me: req.session.userId,
          user: userId,
        }
      )
      .execute();

      return result.affected==1;
  }
}
