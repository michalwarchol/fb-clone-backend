import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

@ObjectType()
@Entity()
export class Post extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  _id!: number;

  @Field()
  @Column()
  creatorId: number;

  @Field()
  @ManyToOne(() => User, (user) => user.posts)
  creator: User;

  @Field()
  @Column()
  text!: string;

  @Field()
  @Column({ nullable: true, default: null })
  feeling!: string;

  @Field()
  @Column({ nullable: true, default: null })
  activity!: string;

  @Field()
  @Column({ type: "int", default: 0 })
  like!: number;

  @Field()
  @Column({ type: "int", default: 0 })
  love!: number;

  @Field()
  @Column({ type: "int", default: 0 })
  care!: number;

  @Field()
  @Column({ type: "int", default: 0 })
  haha!: number;

  @Field()
  @Column({ type: "int", default: 0 })
  wow!: number;

  @Field()
  @Column({ type: "int", default: 0 })
  sad!: number;

  @Field()
  @Column({ type: "int", default: 0 })
  angry!: number;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}
