import {MigrationInterface, QueryRunner} from "typeorm";

export class migration1659207503740 implements MigrationInterface {
  name = "migration1659207503740";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"PK_4c9bb67a66c3495b42eacd63a84\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"PK_ebcfd9074b7c74c3bf6f0f7b91d\" PRIMARY KEY (\"receiver\")");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP COLUMN \"sender\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"PK_ebcfd9074b7c74c3bf6f0f7b91d\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP COLUMN \"receiver\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD \"senderId\" integer NOT NULL");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"PK_9509b72f50f495668bae3c0171c\" PRIMARY KEY (\"senderId\")");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD \"receiverId\" integer NOT NULL");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"PK_9509b72f50f495668bae3c0171c\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"PK_3480812cafecf9155f4658b35ec\" PRIMARY KEY (\"senderId\", \"receiverId\")");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD \"sender_id\" integer");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD \"receiver_id\" integer");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"FK_37d2ace7f95c1dd0ae665a570dd\" FOREIGN KEY (\"sender_id\") REFERENCES \"user\"(\"_id\") ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"FK_6f327bd90aba348e276d42ecf22\" FOREIGN KEY (\"receiver_id\") REFERENCES \"user\"(\"_id\") ON DELETE NO ACTION ON UPDATE NO ACTION");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"FK_6f327bd90aba348e276d42ecf22\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"FK_37d2ace7f95c1dd0ae665a570dd\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP COLUMN \"receiver_id\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP COLUMN \"sender_id\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"PK_3480812cafecf9155f4658b35ec\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"PK_9509b72f50f495668bae3c0171c\" PRIMARY KEY (\"senderId\")");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP COLUMN \"receiverId\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"PK_9509b72f50f495668bae3c0171c\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP COLUMN \"senderId\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD \"receiver\" integer NOT NULL");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"PK_ebcfd9074b7c74c3bf6f0f7b91d\" PRIMARY KEY (\"receiver\")");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD \"sender\" integer NOT NULL");
    await queryRunner.query("ALTER TABLE \"friend_request\" DROP CONSTRAINT \"PK_ebcfd9074b7c74c3bf6f0f7b91d\"");
    await queryRunner.query("ALTER TABLE \"friend_request\" ADD CONSTRAINT \"PK_4c9bb67a66c3495b42eacd63a84\" PRIMARY KEY (\"sender\", \"receiver\")");
  }

}
