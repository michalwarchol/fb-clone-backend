import { Migration } from '@mikro-orm/migrations';

export class Migration20210628201929 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "post" ("_id" serial primary key, "created_at" timestamptz(0) not null, "updated_at" timestamptz(0) not null, "name" text not null);');
  }

}
