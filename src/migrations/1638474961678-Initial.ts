import {MigrationInterface, QueryRunner} from "typeorm";

export class Initial1638474961678 implements MigrationInterface {
    name = 'Initial1638474961678'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notification" ("_id" SERIAL NOT NULL, "info" character varying NOT NULL, "type" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'sent', "receiverId" integer NOT NULL, "postId" integer, "triggerId" integer, "link" character varying NOT NULL DEFAULT '#', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "triggerUser_id" integer, CONSTRAINT "PK_da29ce67c0b8284ca076602f980" PRIMARY KEY ("_id"))`);
        await queryRunner.query(`CREATE TABLE "reaction" ("_id" SERIAL NOT NULL, "reaction" character varying NOT NULL, "value" integer NOT NULL, "userId" integer NOT NULL, "postId" integer NOT NULL, "user_id" integer, "post_id" integer, CONSTRAINT "PK_9b5611f38650b4c9e45a2e08064" PRIMARY KEY ("_id", "userId", "postId"))`);
        await queryRunner.query(`CREATE TABLE "post" ("_id" SERIAL NOT NULL, "creatorId" integer NOT NULL, "text" character varying NOT NULL, "feeling" character varying, "activity" character varying, "imageId" character varying, "tagged" integer array NOT NULL, "like" integer NOT NULL DEFAULT '0', "love" integer NOT NULL DEFAULT '0', "care" integer NOT NULL DEFAULT '0', "haha" integer NOT NULL DEFAULT '0', "wow" integer NOT NULL DEFAULT '0', "sad" integer NOT NULL DEFAULT '0', "angry" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" integer, CONSTRAINT "PK_e4da8286ae74bb02b3856ec85a8" PRIMARY KEY ("_id"))`);
        await queryRunner.query(`CREATE TABLE "story" ("_id" SERIAL NOT NULL, "userId" integer NOT NULL, "text" character varying, "font" character varying, "gradient" character varying, "time" integer NOT NULL DEFAULT '5000', "imageId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" integer, CONSTRAINT "PK_bb3d3f89146c06f411af400f93f" PRIMARY KEY ("_id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("_id" SERIAL NOT NULL, "username" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "avatarId" character varying, "bannerId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username"), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_457bfa3e35350a716846b03102d" PRIMARY KEY ("_id"))`);
        await queryRunner.query(`CREATE TABLE "comment" ("_id" SERIAL NOT NULL, "text" character varying NOT NULL, "creatorId" integer NOT NULL, "postId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" integer, "post_id" integer, CONSTRAINT "PK_6c275c2e7c3f15cd5024b7e2e91" PRIMARY KEY ("_id", "creatorId", "postId"))`);
        await queryRunner.query(`CREATE TABLE "friend_request" ("status" character varying NOT NULL, "sender" integer NOT NULL, "receiver" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4c9bb67a66c3495b42eacd63a84" PRIMARY KEY ("sender", "receiver"))`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_d834d1fdd81974426dca7a734c2" FOREIGN KEY ("triggerUser_id") REFERENCES "user"("_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reaction" ADD CONSTRAINT "FK_978c984f412d09b43304e41ae9a" FOREIGN KEY ("user_id") REFERENCES "user"("_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reaction" ADD CONSTRAINT "FK_4af0a7b3bc874c64e408aaa9853" FOREIGN KEY ("post_id") REFERENCES "post"("_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_cdb7a69f6107ba4227908d6ed55" FOREIGN KEY ("creator_id") REFERENCES "user"("_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "story" ADD CONSTRAINT "FK_872a9849998b2c79f37d77bde8f" FOREIGN KEY ("creator_id") REFERENCES "user"("_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_f118c3c6758ec9a020fc451082c" FOREIGN KEY ("creator_id") REFERENCES "user"("_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment" ADD CONSTRAINT "FK_8aa21186314ce53c5b61a0e8c93" FOREIGN KEY ("post_id") REFERENCES "post"("_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_8aa21186314ce53c5b61a0e8c93"`);
        await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_f118c3c6758ec9a020fc451082c"`);
        await queryRunner.query(`ALTER TABLE "story" DROP CONSTRAINT "FK_872a9849998b2c79f37d77bde8f"`);
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_cdb7a69f6107ba4227908d6ed55"`);
        await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_4af0a7b3bc874c64e408aaa9853"`);
        await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_978c984f412d09b43304e41ae9a"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_d834d1fdd81974426dca7a734c2"`);
        await queryRunner.query(`DROP TABLE "friend_request"`);
        await queryRunner.query(`DROP TABLE "comment"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "story"`);
        await queryRunner.query(`DROP TABLE "post"`);
        await queryRunner.query(`DROP TABLE "reaction"`);
        await queryRunner.query(`DROP TABLE "notification"`);
    }

}
