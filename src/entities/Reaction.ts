import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Post } from "./Post";
import { User } from "./User";

@ObjectType()
@Entity()
export class Reaction extends BaseEntity {

  @Field(()=>Int)
  @PrimaryGeneratedColumn()
  _id!: number;

  @Field()
  @Column()
  reaction!: string;

  @Field(()=>Int)
  @Column({type: "int"})
  value!: number;

  @Field(()=>Int)
  @PrimaryColumn()
  userId!: number;

  @ManyToOne(() => User, (user) => user.reactions)
  user!: User;

  @Field(()=>Int)
  @PrimaryColumn()
  postId!: number;

  @ManyToOne(() => Post, (post) => post.reactions)
  post!: Post;
}
