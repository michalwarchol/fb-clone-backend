import { User } from "../entities/User";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import bcrypt from "bcrypt";
import { COOKIE_NAME } from "../constants";
import { v4 } from "uuid";
import { getConnection } from "typeorm";
import { FileUpload, GraphQLUpload } from "graphql-upload";

@InputType()
class Credentials {
  @Field()
    username: string;

  @Field()
    email: string;

  @Field()
    password: string;
}

@ObjectType()
class FieldError {
  @Field()
    field: string;

  @Field()
    message: string;
}

@ObjectType()
class FullUser {
  @Field(() => User, { nullable: true })
    user: User;

  @Field(() => String, { nullable: true })
    avatarImage: string | null;

  @Field(() => String, { nullable: true })
    bannerImage: string | null;
}

@ObjectType()
class SearchedUser {
  @Field(() => Int)
    _id: number;

  @Field(() => String)
    username: string;

  @Field(() => String, { nullable: true })
    avatarImage: string | null;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[];

  @Field(() => FullUser, { nullable: true })
    loggedUser?: FullUser;
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    if (req.session.userId == user._id) {
      return user.email;
    }
    return "";
  }

  @Query(() => [User])
  async getUsers() {
    return User.find({});
  }

  @Query(() => User, { nullable: true })
  async getUserById(
    @Arg("id", () => Int) id: number
  ): Promise<User | undefined> {
    return User.findOne({ _id: id });
  }

  @Query(() => [SearchedUser])
  async searchUsersByUsername(
    @Ctx() { req, s3 }: MyContext,
    @Arg("username", () => String) username: string
  ): Promise<SearchedUser[]> {
    const userId = req.session.userId;

    if (username.length < 1) {
      return [];
    }

    const searchedUsers = await getConnection()
      .getRepository(User)
      .createQueryBuilder()
      .where("LOWER(username) like LOWER(:username) AND _id != :id", {
        username: `%${username}%`,
        id: userId,
      })
      .limit(6)
      .getMany();

    const users = await Promise.all(
      searchedUsers.map(async (user) => {
        const img = user.avatarId
          ? await s3.getObject({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: user.avatarId,
          }).promise()
          : null;
        return {
          _id: user._id,
          username: user.username,
          avatarImage: img?.Body ? img.Body.toString("base64") : null,
        };
      })
    );
    return users;
  }

  @Mutation(() => String)
  async uploadImage(
    @Ctx() { req, s3 }: MyContext,
    @Arg("image", () => GraphQLUpload, { nullable: true }) image: FileUpload,
    @Arg("avatarOrBanner", () => String) avatarOrBanner: "avatar" | "banner"
  ): Promise<string> {
    const userId = req.session.userId;
    const user = await User.findOne({ _id: userId });

    const imageId = avatarOrBanner === "avatar" ? user?.avatarId : user?.bannerId;

    if (imageId) {
      await s3.deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: imageId,
      }).promise();
    }

    const newImageId = v4();
    await s3.upload({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: newImageId,
      Body: image.createReadStream(),
    })
      .promise();

    await User.update(
      { _id: userId },
      avatarOrBanner === "avatar"
        ? { avatarId: newImageId }
        : { bannerId: newImageId }
    );

    return newImageId;
  }

  @Query(() => FullUser, { nullable: true })
  async loggedUser(@Ctx() { req, s3 }: MyContext) {
    const userId = req.session.userId;

    if (!req.session.userId) {
      return null;
    }

    const user = await User.findOne({ _id: userId });

    const avatar = !!user?.avatarId && await s3.getObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: user.avatarId,
    }).promise();

    const banner = !!user?.bannerId && await s3.getObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: user.bannerId,
    }).promise();

    return {
      user,
      avatarImage: avatar ? avatar.Body?.toString("base64") : null,
      bannerImage: banner ? banner.Body?.toString("base64") : null,
    };
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("credentials") credentials: Credentials,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    if (
      /^\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(
        credentials.email
      ) == false
    ) {
      return {
        errors: [{ field: "email", message: "Email is invalid" }],
      };
    }

    if (credentials.username.length < 3) {
      return {
        errors: [
          { field: "username", message: "length must be greater than 2" },
        ],
      };
    }

    if (credentials.password.length < 6) {
      return {
        errors: [
          { field: "password", message: "length must be greater than 5" },
        ],
      };
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(credentials.password, salt);
    let user = new User();
    try {
      user = User.create({
        username: credentials.username,
        password: hash,
        email: credentials.email,
        avatarId: "",
        bannerId: "",
      });
      await User.insert(user);
    } catch (err) {
      if (
        err.detail.includes("already exists") &&
        err.detail.includes("username")
      ) {
        //duplicate user error
        return {
          errors: [{ field: "username", message: "username already taken" }],
        };
      }
      if (
        err.detail.includes("already exists") &&
        err.detail.includes("email")
      ) {
        //duplicate user error
        return {
          errors: [{ field: "email", message: "email already taken" }],
        };
      }
    }
    req.session.userId = user._id;
    console.log(user);
    return {
      loggedUser: {
        user,
        avatarImage: "",
        bannerImage: "",
      },
    };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("username") username: string,
    @Arg("password") password: string,
    @Ctx() { req, s3 }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "that username doesn't exist",
          },
        ],
      };
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password",
          },
        ],
      };
    }

    req.session.userId = user._id;

    const avatarImage = user?.avatarId
      ? s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.avatarId,
      })
      : null;

    const bannerImage = user?.bannerId
      ? s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.bannerId,
      })
      : null;

    return {
      loggedUser: {
        user,
        avatarImage,
        bannerImage,
      },
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) => {
      req.session.destroy((err: Error) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }
}
