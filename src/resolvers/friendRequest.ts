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
import { Brackets, getConnection } from "typeorm";
import { FriendRequest } from "../entities/FriendRequest";
import { User } from "../entities/User";
import { MyContext } from "../types";

@ObjectType()
class UserRequest {
  @Field(() => FriendRequest, { nullable: true })
  friendRequest: FriendRequest | null;

  @Field()
  isSender: boolean;
}

@ObjectType()
class FriendRequestWithFriend {
  @Field(() => FriendRequest)
  friendRequest: FriendRequest;

  @Field(() => User)
  friend: User;
}

@ObjectType()
class PaginatedRequests {
  @Field(() => [FriendRequestWithFriend])
  friendRequestsWithFriends: FriendRequestWithFriend[];

  @Field(() => Boolean)
  hasMore: boolean;
}

@Resolver(FriendRequest)
export class FriendRequestResolver {
  @Query(() => [FriendRequest])
  async friendRequests(): Promise<FriendRequest[]> {
    return FriendRequest.find({});
  }

  @Query(() => PaginatedRequests)
  async getUserFriendRequests(
    @Ctx() { req }: MyContext,
    @Arg("limit", () => Int) limit: number,
    @Arg("userId", () => Int, { nullable: true }) userId?: number,
    @Arg("skip", () => Int, { nullable: true }) skip?: number
  ): Promise<PaginatedRequests> {
    //if userId is not specified, it means that we want to take requests of a logged user
    let id: number = req.session.userId as number;
    if (userId) {
      id = userId;
    }
    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;

    const friendRequests = getConnection()
      .getRepository(FriendRequest)
      .createQueryBuilder()
      .where("status like :status", { status: "accepted" })
      .andWhere("sender = :userId OR receiver = :userId", { userId: id })
      .orderBy('"createdAt"', "DESC");

    if (limit) {
      friendRequests.take(reaLimitPlusOne);
    }

    if (skip) {
      friendRequests.skip(skip);
    }

    const frs = await friendRequests.getMany();

    const friendRequestsWithFriend = await Promise.all(
      frs.map(async (fr) => {
        let _id = fr.sender;
        if (_id == id) _id = fr.receiver;

        const friend = await User.findOne({ where: { _id } });

        return {
          friendRequest: fr,
          friend: friend as User,
        };
      })
    );

    return {
      friendRequestsWithFriends: friendRequestsWithFriend.slice(0, realLimit),
      hasMore: friendRequestsWithFriend.length === reaLimitPlusOne,
    };
  }

  @Query(() => UserRequest)
  async getFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int) userId: number
  ): Promise<UserRequest> {
    const request = await getConnection()
      .getRepository(FriendRequest)
      .createQueryBuilder("request")
      .where(
        new Brackets((qb) => {
          qb.where("request.sender = :me", { me: req.session.userId }).andWhere(
            "request.receiver = :user",
            { user: userId }
          );
        })
      )
      .orWhere(
        new Brackets((qb) => {
          qb.where("request.sender = :user", { user: userId }).andWhere(
            "request.receiver = :me",
            { me: req.session.userId }
          );
        })
      )
      .getOne();

    if (!request) {
      return {
        friendRequest: null,
        isSender: false,
      };
    }

    //this user sent me a friend request
    let isSender = false;
    if (request.sender == userId) {
      isSender = true;
    }

    return {
      friendRequest: request,
      isSender,
    };
  }

  @Query(() => Int)
  async friendCount(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int, { nullable: true }) userId?: number
  ) {
    //if userId is not specified, it means that we want to take requests of a logged user
    let id: number = req.session.userId as number;
    if (userId) {
      id = userId;
    }

    const count = await getConnection()
      .getRepository(FriendRequest)
      .createQueryBuilder()
      .where("status like :status", { status: "accepted" })
      .andWhere("sender = :userId OR receiver = :userId", { userId: id })
      .getCount();

    return count;
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

    return result.affected == 1;
  }
}
