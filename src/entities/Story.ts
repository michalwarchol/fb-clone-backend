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
    creator: User;

    @Field({nullable: true})
    @Column({nullable: true, default: null})
    text: string;

    @Field({nullable: true})
    @Column({nullable: true, default: null})
    font: string;

    @Field({nullable: true})
    @Column({nullable: true, default: null})
    gradient: string;

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