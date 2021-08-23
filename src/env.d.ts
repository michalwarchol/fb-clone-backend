declare namespace NodeJS {
    export interface ProcessEnv {
      POSTGRESQL_PASSWORD: string;
      AWS_ID: string;
      AWS_SECRET: string;
      AWS_BUCKET_NAME: string;
      AWS_REGION: string;
    }
  }