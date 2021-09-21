import { Field, Int, ObjectType, registerEnumType } from "type-graphql";
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

export enum NotificationType {
  INFO = "info", //just some info
  REACTION = "reaction", //someone liked you post
  COMMENT = "comment", //someone commented your post
  FRIEND_REQ = "friend_req", //someone sent you a friend request
  FRIEND_ACCEPT = "friend_accpet", //someone accepted your friend request
}

registerEnumType(NotificationType, {
  name: "NotificationType",
  description: "Types of notifications you can get",
});

@ObjectType()
@Entity()
export class Notification extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  _id!: number;

  @Field(() => String)
  @Column()
  info!: string;

  @Field(() => NotificationType)
  @Column()
  type!: NotificationType;

  @Field(() => String)
  @Column({default: "sent"})
  status: "received" | "sent"; //if user have seen the notification it will change to "received"

  @Field(() => Int)
  @Column()
  receiverId!: number;

  @Field(()=>Int)
  @Column({default: null, nullable: true})
  triggerId: number;

  @Field(()=>User)
  @ManyToOne(() => User, (user) => user.triggers)
  triggerUser: User;
  
  @Field(() => String)
  @Column({ default: "#" })
  link!: string;

  @Field(() => String)
  @CreateDateColumn()
  createdAt!: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt!: Date;
}
