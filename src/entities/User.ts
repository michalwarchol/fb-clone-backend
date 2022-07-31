import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Comment } from "./Comment";
import { FriendRequest } from "./FriendRequest";
import { Notification } from "./Notification";
import { Post } from "./Post";
import { Reaction } from "./Reaction";
import { Story } from "./Story";

@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
    _id!: number;

  @Field()
  @Column({ unique: true })
    username!: string;

  @Field()
  @Column({ unique: true })
    email!: string;

  @Column()
    password!: string;

  @Field()
  @Column({ nullable: true })
    avatarId!: string;

  @Field()
  @Column({ nullable: true })
    bannerId!: string;

  @OneToMany(() => Post, (post) => post.creator)
    posts: Post[];

  @OneToMany(() => Reaction, (reaction) => reaction.user)
    reactions: Reaction[];

  @OneToMany(() => Comment, (comment) => comment.creator)
    comments: Comment[];

  @OneToMany(() => Story, (story) => story.creator)
    stories: Story[];

  @OneToMany(() => Notification, (notification) => notification.triggerUser)
    triggers: Notification[];

  @OneToMany(() => FriendRequest, (friendRequest) => friendRequest.sender)
    senders: FriendRequest[];
  
  @OneToMany(() => FriendRequest, (friendRequest) => friendRequest.receiver)
    receivers: FriendRequest[];

  @Field(() => String)
  @CreateDateColumn()
    createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
    updatedAt: Date;
}
