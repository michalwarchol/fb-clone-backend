import {
  Arg,
  Ctx,
  Field,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { DataSource, FindManyOptions, In, Brackets } from "typeorm";
import { FriendRequest } from "../entities/FriendRequest";
import { User } from "../entities/User";
import { isAuth } from "../middleware/isAuth";
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

  @Field(() => String)
    friendRole: string;
}

@ObjectType()
class FriendSuggestion {
  @Field(() => User)
    friend: User;

  @Field(() => Int)
    mutual: number;
}

@ObjectType()
class PaginatedRequests {
  @Field(() => [FriendRequestWithFriend])
    friendRequestsWithFriends: FriendRequestWithFriend[];

  @Field(() => Boolean)
    hasMore: boolean;

  @Field(() => Int)
    mutualFriends: number;
}

@Resolver(FriendRequest)
export class FriendRequestResolver {
  async getMutualFriendsCount(dataSource: DataSource, me: number, userId: number): Promise<number> {
    if (me == userId) {
      return 0;
    }

    const mutualFriends = await dataSource
      .getRepository(FriendRequest)
      .createQueryBuilder("request")
      .where(new Brackets((qb) => {
        qb.where("senderId = :me AND status = 'accepted' AND receiverId != :userId")
          .orWhere("receiverId = :me AND status = 'accepted' AND senderId != :userId");
      }))
      .andWhere((qb) => {
        const subquery = qb
          .createQueryBuilder()
          .addFrom("friend_request", "fr")
          .where(new Brackets((qb) => {
            qb.where("fr.receiverId = request.senderId AND fr.senderId = :userId AND fr.receiverId != :me")
              .orWhere("fr.receiverId = request.receiver AND fr.senderId = :userId AND fr.receiverId != :me")
              .orWhere("fr.senderId = request.senderId AND fr.receiverId = :userId AND fr.senderId != :me")
              .orWhere("fr.senderId = request.receiverId AND fr.receiverId = :userId AND fr.senderId != :me");
          }))
          .andWhere("fr.status = 'accepted'")
          .getQuery();

        return `EXISTS (${subquery})`;
      })
      .setParameter("me", me)
      .setParameter("userId", userId)
      .getCount();

    return mutualFriends;
  }

  @Query(() => [FriendRequest])
  async friendRequests(): Promise<FriendRequest[]> {
    return FriendRequest.find({relations: ["sender", "receiver"]});
  }

  @Query(() => PaginatedRequests)
  @UseMiddleware(isAuth)
  async getUserFriendRequests(
    @Ctx() { req, dataSource }: MyContext,
    @Arg("limit", () => Int) limit: number,
    @Arg("userId", () => Int, { nullable: true }) userId?: number,
    @Arg("skip", () => Int, { nullable: true }) skip?: number
  ): Promise<PaginatedRequests> {
    //if userId is not specified, it means that we want to take requests of a logged user
    const id = userId || req.session.userId;
    const realLimit = Math.min(50, limit);
    const reaLimitPlusOne = realLimit + 1;
    const findOptions: FindManyOptions<FriendRequest> = {
      where: [
        { senderId: id, status: "accepted"},
        { receiverId: id, status: "accepted"},
      ],
      order: { createdAt: "DESC" },
      take: reaLimitPlusOne,
    };

    if (skip) {
      findOptions.skip = skip;
    }

    const friendRequests = await FriendRequest.find(findOptions);

    const friendRequestsWithFriend = friendRequests.map((fr) => {
      const { senderId } = fr;
      const friendRole = id === senderId ? "receiver" : "sender";

      return {
        friendRequest: fr,
        friendRole,
      };
    });

    let mutualFriends = 0;
    if (userId) {
      mutualFriends = await this.getMutualFriendsCount(
        dataSource,
        req.session.userId as number,
        userId
      );
    }

    return {
      friendRequestsWithFriends: friendRequestsWithFriend.slice(0, realLimit),
      hasMore: friendRequestsWithFriend.length === reaLimitPlusOne,
      mutualFriends,
    };
  }

  @Query(() => UserRequest)
  @UseMiddleware(isAuth)
  async getFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int) userId: number
  ): Promise<UserRequest> {
    const id = req.session.userId;
    const request = await FriendRequest.findOne({
      where: [
        { senderId: id, receiverId: userId },
        { senderId: userId, receiverId: id },
      ]
    });

    if (!request) {
      return {
        friendRequest: null,
        isSender: false,
      };
    }

    //this user sent me a friend request
    const isSender = request.senderId === userId;

    return {
      friendRequest: request,
      isSender,
    };
  }

  @Query(() => [FriendRequestWithFriend])
  @UseMiddleware(isAuth)
  async getSuggestedFriendTags(
    @Ctx() { req }: MyContext,
    @Arg("searchName", () => String, { nullable: true }) searchName?: string
  ): Promise<FriendRequestWithFriend[]> {
    const userId = req.session.userId;
    const friendRequests = await FriendRequest.find({
      where: [
        { senderId: userId },
        { receiverId: userId },
      ],
      relations: ["receiver", "sender"]
    });

    const friendRequestsWithFriend = await Promise.all(
      friendRequests.map(async (fr) => {
        const { senderId } = fr;
        const friendRole = senderId === userId ? "receiver" : "sender";

        return {
          friendRequest: fr,
          friendRole,
        };
      })
    );

    if (searchName) {
      return friendRequestsWithFriend.filter(
        (f) => (f.friendRequest[f.friendRole as keyof FriendRequest] as User)
          .username.toLowerCase().indexOf(searchName.toLowerCase()) !== -1
      ).slice(0, 20);
    }

    return friendRequestsWithFriend.slice(0, 20);
  }

  @Query(() => [FriendSuggestion])
  @UseMiddleware(isAuth)
  async getSuggestedFriends(
    @Ctx() ctx: MyContext
  ): Promise<FriendSuggestion[]> {
    const { req, dataSource} = ctx;
    const userId = req.session.userId as number;
    const acceptedFriendRequests = await FriendRequest.find({
      where: [
        { senderId: userId, status: "accepted"},
        { receiverId: userId, status: "accepted"},
      ],
      take: 20,
    });

    const friendsIds = acceptedFriendRequests.map((friend) => friend.senderId === userId ? friend.receiverId : friend.senderId);

    const possibleFriends = await dataSource
      .getRepository(FriendRequest)
      .createQueryBuilder()
      .where(
        new Brackets((qb) => {
          qb.where("senderId IN (:...friendsIds) AND status = 'accepted'", { friendsIds })
            .orWhere("receiverId IN (:...friendsIds) AND status = 'accepted'", { friendsIds });
        })
      )
      .andWhere("senderId NOT IN (...:friendsIds) AND receiverId NOT IN (...:friendsIds)", { friendsIds })
      .andWhere("senderId!= :me OR receiverId != :me", { me: userId })
      .getMany();

    const possibleFriendsWithMutualCount = await Promise.all(
      possibleFriends.map(async (possibleFriend) => {
        const friendId = friendsIds.includes(possibleFriend.senderId) ? possibleFriend.receiverId : possibleFriend.senderId;
        const friend = await User.findOne({where: { _id: friendId }}) as User;
        const mutual = await this.getMutualFriendsCount(dataSource, userId, friendId);

        return {
          friend,
          mutual,
        };
      })
    );

    return possibleFriendsWithMutualCount;
  }

  @Query(() => [FriendRequestWithFriend])
  @UseMiddleware(isAuth)
  async getInProgressFriendRequests(
    @Ctx() { req }: MyContext
  ): Promise<FriendRequestWithFriend[]> {
    const userId = req.session.userId;
    const requests = await FriendRequest.find({
      where: { receiverId: userId, status: "in-progress" },
      relations: ["sender", "receiver"],
    });

    return requests.map((request) => ({
      friendRequest: request,
      friendRole: "sender",
    }));
  }

  @Query(() => Int)
  @UseMiddleware(isAuth)
  async friendCount(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int, { nullable: true }) userId?: number
  ): Promise<number> {
    //if userId is not specified, it means that we want to take requests of a logged user
    const id = userId || req.session.userId;

    const count = await FriendRequest.count({
      where: [{
        senderId: id, status: "accepted",
      }, {
        receiverId: id, status: "accepted",
      }]
    });

    return count;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async createFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("receiverId", () => Int) receiverId: number
  ): Promise<boolean> {
    const userId = req.session.userId;
    if (userId == receiverId) {
      //when user tries to send a friend request to himself
      return false;
    }

    await FriendRequest.create({
      senderId: userId,
      receiverId,
      status: "in-progress",
    }).save();

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async acceptFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int) userId: number
  ): Promise<boolean> {
    const id = req.session.userId as number;
    const result = await FriendRequest.update(
      { senderId: In([id, userId]), receiverId: In([id, userId]) },
      { status: "accepted" }
    );

    return result.affected == 1;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async removeFriendRequest(
    @Ctx() { req }: MyContext,
    @Arg("userId", () => Int) userId: number
  ): Promise<boolean> {
    const id = req.session.userId as number;
    const result = await FriendRequest.delete({ senderId: In([id, userId]), receiverId: In([id, userId]) });

    return result.affected == 1;
  }
}
