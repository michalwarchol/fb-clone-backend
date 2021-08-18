
import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Comment } from "./Comment";
import { Post } from "./Post";
import { Reaction } from "./Reaction";

@ObjectType()
@Entity()
export class User extends BaseEntity {

  @Field(()=>Int)
  @PrimaryGeneratedColumn()
  _id!: number;

  @Field()
  @Column({unique: true})
  username!: string;

  @Field()
  @Column({unique: true})
  email!: string;

  @Column()
  password!: string;

  @OneToMany(() => Post, post => post.creator)
  posts: Post[];

  @OneToMany(() => Reaction, reaction=>reaction.user)
  reactions: Reaction[];

  @OneToMany(()=>Comment, comment=>comment.creator)
  comments: Comment[]

  @Field(()=> String)
  @CreateDateColumn()
  createdAt: Date;
  
  @Field(()=> String)
  @UpdateDateColumn()
  updatedAt: Date = new Date();
}