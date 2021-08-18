import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";
import { Post } from "./Post";

@ObjectType()
@Entity()
export class Comment extends BaseEntity {

  @Field(()=>Int)
  @PrimaryGeneratedColumn()
  _id: number;

  @Field()
  @Column()
  text!: string;

  @Field()
  @PrimaryColumn()
  creatorId!: number;

  @Field()
  @ManyToOne(() => User, (user) => user.comments)
  creator!: User;

  @Field()
  @PrimaryColumn()
  postId!: number;


  @ManyToOne(() => Post, (post) => post.comments)
  post!: Post;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}
