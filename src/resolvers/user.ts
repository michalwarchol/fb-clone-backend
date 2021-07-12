import { User } from "../entities/User";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Resolver,
} from "type-graphql";
import bcrypt from "bcrypt";
import { EntityManager } from "@mikro-orm/postgresql";

@InputType()
class Credentials {
  @Field()
  username: string;

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
  @Mutation(() => UserResponse)
  async register(
    @Arg("credentials") credentials: Credentials,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
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
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning(["_id", "username", "created_at as createdAt", "updated_at as updatedAt", "password"]);
      user = result[0];
    } catch (err) {
      console.log(err)
      if (err.detail.includes("already exists")) {
        //duplicate user error
        return {
          errors: [{ field: "username", message: "username already taken" }],
        };
      }
    }
    req.session.userId = user._id;
    return {user};
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("credentials") credentials: Credentials,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: credentials.username });
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
    const valid = await bcrypt.compare(credentials.password, user.password);
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
}
