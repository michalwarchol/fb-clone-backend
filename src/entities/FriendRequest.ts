import { Field, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

@ObjectType()
@Entity()
export class FriendRequest extends BaseEntity {
  @Field(() => String)
  @Column()
    status: "accepted" | "in-progress";

  @Field()
  @PrimaryColumn()
    senderId: number;

  @Field(()=>User)
  @ManyToOne(() => User, (user) => user.senders)
  @JoinColumn({name: "senderId", referencedColumnName: "_id"})
    sender: User;

  @Field()
  @PrimaryColumn()
    receiverId: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.receivers)
  @JoinColumn({name: "receiverId", referencedColumnName: "_id"})
    receiver: User;

  @Field(() => String)
  @CreateDateColumn()
    createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
    updatedAt: Date;
}
