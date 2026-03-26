export interface AppEnv {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  API_PORT: string;
}

export function getEnv(): AppEnv {
  return {
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    API_PORT: process.env.API_PORT || '3000'
  };
}
