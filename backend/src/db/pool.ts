import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

export interface DbPool {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

export function createPool(connectionString = config.databaseUrl): Pool {
  const isRemote =
    !connectionString.includes('localhost') &&
    !connectionString.includes('127.0.0.1');

  return new Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  });
}

