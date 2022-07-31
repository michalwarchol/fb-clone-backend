import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Comment } from "./Comment";
import { Reaction } from "./Reaction";
import { User } from "./User";

@ObjectType()
@Entity()
export class Post extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
    _id!: number;

  @OneToMany(() => Reaction, reaction=>reaction.post)
    reactions: Reaction[];

  @OneToMany(()=>Comment, comment=>comment.post)
    comments: Comment[];

  @Field()
  @Column()
    creatorId: number;

  @Field(()=>User)
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
  @Column({nullable: true})
    imageId!: string;

  @Field(()=>[Int])
  @Column({type: "int", array: true})
    tagged: number[];

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
