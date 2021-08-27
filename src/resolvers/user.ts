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
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { sendEmail } from "../utils/sendEmail";
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

  @Field(()=>String, {nullable: true})
  avatarImage: string|null;

  @Field(()=>String, {nullable: true})
  bannerImage: string|null;
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

  @Query(() => User, { nullable: true })
  async getUserById(
    @Arg("id", () => Int) id: number
  ): Promise<User | undefined> {
    return User.findOne({ _id: id });
  }

  @Mutation(() => String)
  async uploadImage(
    @Ctx() { req, s3 }: MyContext,
    @Arg("image", () => GraphQLUpload, { nullable: true }) image: FileUpload,
    @Arg("avatarOrBanner", () => String) avatarOrBanner: "avatar" | "banner"
  ): Promise<string> {

    const user = await User.findOne({_id: req.session.userId});

    if(avatarOrBanner=="avatar"){
      if(!!user?.avatarId){
        await s3.deleteObject({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: user?.avatarId
        }).promise();
      }
    }else{
      if(!!user?.bannerId){
        await s3.deleteObject({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: user?.bannerId
        }).promise();
      }
    }

    const imageId = v4();
    await s3
      .upload({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: imageId,
        Body: image.createReadStream(),
      })
      .promise();

    await User.update(
      { _id: req.session.userId },
      avatarOrBanner == "avatar" ? { avatarId: imageId } : { bannerId: imageId }
    );

    return imageId;
  }

  @Query(() => FullUser, { nullable: true })
  async loggedUser(@Ctx() { req, s3 }: MyContext) {
    if (!req.session.userId) {
      return null;
    }

    const user = await User.findOne({ _id: req.session.userId });
    let avatarImage = null;
    let bannerImage = null;
    if(!!user?.avatarId){
      avatarImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.avatarId
      })
    }
    if(!!user?.bannerId){
      bannerImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.bannerId
      })
    }

    return {
      user,
      avatarImage,
      bannerImage
    }
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("credentials") credentials: Credentials,
    @Ctx() { req, s3 }: MyContext
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
    let user;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values([
          {
            username: credentials.username,
            password: hash,
            email: credentials.email,
            avatarId: "",
            bannerId: ""
          },
        ])
        .returning([
          "_id",
          "username",
          "email",
          "avatarId",
          "bannerId",
          "created_at as createdAt",
          "updated_at as updatedAt",
          "password",
        ])
        .execute();
      user = result.raw[0];
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
    let avatarImage = null;
    let bannerImage = null;
    if(!!user?.avatarId){
      avatarImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.avatarId
      })
    }
    if(!!user?.bannerId){
      bannerImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.bannerId
      })
    }
    return { loggedUser: {
      user, 
      avatarImage, 
      bannerImage
    } 
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
    let avatarImage = null;
    let bannerImage = null;
    if(!!user?.avatarId){
      avatarImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.avatarId
      })
    }
    if(!!user?.bannerId){
      bannerImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.bannerId
      })
    }

    return {
      loggedUser: {
        user,
        avatarImage,
        bannerImage
      }
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) => {
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return false;
    }

    const token = v4();
    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user._id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    ); //3 days

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );

    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req, s3 }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length < 6) {
      return {
        errors: [
          { field: "newPassword", message: "length must be greater than 5" },
        ],
      };
    }
    const userId = await redis.get(FORGET_PASSWORD_PREFIX + token);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token expired",
          },
        ],
      };
    }

    const user = await User.findOne({ _id: parseInt(userId) });
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }

    const salt = await bcrypt.genSalt(10);
    await User.update(
      { _id: user._id },
      { password: await bcrypt.hash(newPassword, salt) }
    );

    await redis.del(FORGET_PASSWORD_PREFIX + token);

    //log in user after change password
    req.session.userId = user._id;
    let avatarImage = null;
    let bannerImage = null;
    if(!!user?.avatarId){
      avatarImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.avatarId
      })
    }
    if(!!user?.bannerId){
      bannerImage = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: user.bannerId
      })
    }

    return { 
      loggedUser: {
        user,
        avatarImage,
        bannerImage
    } 
  };
  }
}
