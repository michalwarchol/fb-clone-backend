import { User } from "../entities/User";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import bcrypt from "bcrypt";
import { EntityManager } from "@mikro-orm/postgresql";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { sendEmail } from "../utils/sendEmail";
import {v4} from "uuid";

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
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async loggedUser(@Ctx() { req, em }: MyContext) {
    if (!req.session.userId) {
      return null;
    }
    const user = await em.findOne(User, { _id: req.session.userId });
    return user;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("credentials") credentials: Credentials,
    @Ctx() { em, req }: MyContext
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
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: credentials.username,
          password: hash,
          email: credentials.email,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning([
          "_id",
          "username",
          "created_at as createdAt",
          "updated_at as updatedAt",
          "password",
        ]);
      user = result[0];
    } catch (err) {
      console.log(err);
      if (err.detail.includes("already exists")) {
        //duplicate user error
        return {
          errors: [{ field: "username", message: "username already taken" }],
        };
      }
    }
    req.session.userId = user._id;
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("username") username: string,
    @Arg("password") password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username });
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

    return {
      user,
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
    @Ctx() { em, redis }: MyContext
  ) {
    const user = await em.findOne(User, { email });
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

    await sendEmail(email, `<a href="http://localhost:3000/change-password/${token}">reset password</a>`);

    return true;
  }

  @Mutation(()=>UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() {em, redis, req}: MyContext
  ): Promise<UserResponse>{
    if (newPassword.length < 6) {
      return {
        errors: [
          { field: "newPassword", message: "length must be greater than 5" },
        ],
      };
    }
    const userId = await redis.get(FORGET_PASSWORD_PREFIX+token);
    if(!userId){
      return {
        errors: [
          {
            field: "token",
            message: "token expired"
          }
        ]
      }
    }

    const user = await em.findOne(User, {_id: parseInt(userId)});
    if(!user){
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists"
          }
        ]
      }
    }
    
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    em.persistAndFlush(user);

    await redis.del(FORGET_PASSWORD_PREFIX+token);

    //log in user after change password
    req.session.userId = user._id;

    return {user};
  }
}
