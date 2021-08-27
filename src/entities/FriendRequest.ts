import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";

@ObjectType()
@Entity()
export class FriendRequest extends BaseEntity {

    @Field(()=>String)
    @Column()
    status: "accepted" | "in-progress";

    @Field()
    @PrimaryColumn()
    sender: number;

    @Field()
    @PrimaryColumn()
    receiver: number;

}