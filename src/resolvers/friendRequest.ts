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
import { Brackets, getConnection } from "typeorm";
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

  @Field(() => User)
  friend: User;
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
  async getMutualFriendsCount(me: number, userId: number): Promise<number> {
    if (me == userId) {
      return 0;
    }

    const mutualFriends = await getConnection().query(
      `
        SELECT COUNT(status)
        FROM friend_request fr
        WHERE ((sender = $1 AND status = $3 AND receiver != $2) OR (receiver = $1 AND status = $3 AND sender != $2))
        AND EXISTS(
          SELECT 1
          FROM friend_request fr2
          WHERE ((fr2.receiver = fr.sender AND fr2.sender = $2 AND fr2.receiver != $1) OR
          (fr2.receiver = fr.receiver AND fr2.sender = $2 AND fr2.receiver != $1) OR
          (fr2.sender = fr.sender AND fr2.receiver = $2 AND fr2.sender != $1) OR
          (fr2.sender = fr.receiver AND fr2.receiver = $2 AND fr2.sender != $1)
          ) 
          AND fr2.status = $3
        )
      `,
      [me, userId, "accepted"]
    );
    return mutualFriends[0].count;
  }

  @Query(() => [FriendRequest])
  async friendRequests(): Promise<FriendRequest[]> {
    return FriendRequest.find({});
  }

  @Query(() => PaginatedRequests)
  @UseMiddleware(isAuth)
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
      .where(
        new Brackets((qb) => {
          qb.where("sender = :userId", { userId: id }).orWhere(
            "receiver = :userId",
            { userId: id }
          );
        })
      )
      .andWhere("status like :progress", { progress: "accepted" })
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

    let mutualFriends = 0;
    if (userId) {
      mutualFriends = await this.getMutualFriendsCount(
        req.session.userId!,
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

  @Query(() => [FriendRequestWithFriend])
  @UseMiddleware(isAuth)
  async getSuggestedFriendTags(
    @Ctx() { req }: MyContext,
    @Arg("searchName", () => String, { nullable: true }) searchName?: string
  ) {
    const friendRequests = await getConnection()
      .getRepository(FriendRequest)
      .createQueryBuilder()
      .where("sender = :me", { me: req.session.userId })
      .orWhere("receiver = :me", { me: req.session.userId })
      .getMany();

    let friendRequestsWithFriend = await Promise.all(
      friendRequests.map(async (fr) => {
        let _id = fr.sender;
        if (_id == req.session.userId) _id = fr.receiver;
        const friend = await User.findOne({ where: { _id } });

        return {
          friendRequest: fr,
          friend: friend as User,
        };
      })
    );

    if (searchName) {
      friendRequestsWithFriend = friendRequestsWithFriend.filter(
        (f) =>
          f.friend.username.toLowerCase().indexOf(searchName.toLowerCase()) !=
          -1
      );
    }
    return friendRequestsWithFriend.slice(0, 20);
  }

  @Query(() => [FriendSuggestion])
  @UseMiddleware(isAuth)
  async getSuggestedFriends(
    @Ctx() ctx: MyContext
  ): Promise<FriendSuggestion[]> {
    let myNextFriendsWithMutualCount: FriendSuggestion[] = [];

    const myFriends = await this.getUserFriendRequests(ctx, 50);

    //get friends of my friends
    if (myFriends.friendRequestsWithFriends.length > 0) {
      let friendsOfMyFriends: FriendRequestWithFriend[] = [];
      for (const friend of myFriends.friendRequestsWithFriends) {
        const possibleFriends = await this.getUserFriendRequests(
          ctx,
          50,
          friend.friend._id
        );
        friendsOfMyFriends = friendsOfMyFriends.concat(
          possibleFriends.friendRequestsWithFriends
        );
      }

      //check if there is no request in-progress
      const realUnknownUsers = await Promise.all(
        friendsOfMyFriends.map(async (user) => {
          const request = await this.getFriendRequest(ctx, user.friend._id);
          if (request.friendRequest) {
            return false;
          } else {
            return true;
          }
        })
      );
      const a = friendsOfMyFriends.filter(
        (_v, index) => realUnknownUsers[index]
      );

      for (const myNextFriend of a) {
        if (
          //filter out my friends from my possible new friends
          myFriends.friendRequestsWithFriends.find(
            (friend) => friend.friend._id == myNextFriend.friend._id
          )
        ) {
          continue;
        }
        //filter out me from my possible new friends
        if (myNextFriend.friend._id == ctx.req.session.userId) {
          continue;
        }

        const mutualFriends = await this.getMutualFriendsCount(
          ctx.req.session.userId!,
          myNextFriend.friend._id
        );

        myNextFriendsWithMutualCount.push({
          friend: myNextFriend.friend,
          mutual: mutualFriends,
        });
      }
    }

    //get completely unknown users
    const unknownUsers = await getConnection()
      .getRepository(User)
      .createQueryBuilder()
      .where("_id != :me", { me: ctx.req.session.userId })
      .limit(20)
      .getMany();

    const realUnknownUsers = await Promise.all(
      unknownUsers.map(async (user) => {
        const request = await this.getFriendRequest(ctx, user._id);
        if (request.friendRequest) {
          return false;
        } else {
          return true;
        }
      })
    );
    const a = unknownUsers.filter((_v, index) => realUnknownUsers[index]);
    const b = a.map((friend) => ({ friend, mutual: 0 }));

    //push only those who are not in the output array
    b.forEach((unknown) => {
      if (
        !myNextFriendsWithMutualCount.find(
          (nextFriend) => nextFriend.friend._id == unknown.friend._id
        )
      ) {
        myNextFriendsWithMutualCount.push(unknown);
      }
    });

    return myNextFriendsWithMutualCount;
  }

  @Query(() => [FriendRequestWithFriend])
  @UseMiddleware(isAuth)
  async getInProgressFriendRequests(
    @Ctx() { req }: MyContext
  ): Promise<FriendRequestWithFriend[]> {
    const requests = await getConnection()
      .getRepository(FriendRequest)
      .createQueryBuilder()
      .where("receiver = :me", { me: req.session.userId })
      .andWhere("status like :progress", { progress: "in-progress" })
      .getMany();

    let friendRequestsWithFriend = await Promise.all(
      requests.map(async (fr) => {
        let _id = fr.sender;
        const friend = await User.findOne({ where: { _id } });

        return {
          friendRequest: fr,
          friend: friend as User,
        };
      })
    );
    return friendRequestsWithFriend;
  }

  @Query(() => Int)
  @UseMiddleware(isAuth)
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
      .where(
        new Brackets((qb) => {
          qb.where("sender = :userId", { userId: id }).orWhere(
            "receiver = :userId",
            { userId: id }
          );
        })
      )
      .andWhere("status like :progress", { progress: "accepted" })
      .getCount();

    return count;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
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
  @UseMiddleware(isAuth)
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
  @UseMiddleware(isAuth)
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
