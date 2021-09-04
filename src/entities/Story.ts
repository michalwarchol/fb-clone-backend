import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";

@ObjectType()
@Entity()
export class Story extends BaseEntity {
    @Field()
    @PrimaryGeneratedColumn()
    _id!: number;

    @Field()
    @Column()
    userId!: number;

    @Field(()=>User)
    @ManyToOne(()=>User, user=>user.stories)
    user: User;

    @Field()
    @Column()
    text!: string;

    @Field()
    @Column()
    font!: string;

    @Field()
    @Column()
    background: number;

    @Field()
    @Column({default: 5000})
    time: number;

    @Field({nullable: true})
    @Column({nullable: true, default: null})
    imageId: string;

    @Field(()=> String)
    @CreateDateColumn()
    createdAt!: Date;

    @Field(()=> String)
    @UpdateDateColumn()
    updatedAt!: Date;
}