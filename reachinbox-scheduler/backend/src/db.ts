import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { config } from './config';

export const pool: Pool = mysql.createPool({
  uri: config.databaseUrl,
  connectionLimit: 20,
  timezone: 'Z', // store/read everything in UTC
  waitForConnections: true,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

export async function query<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}
export async function exec(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [res] = await pool.query(sql, params);
  return res as ResultSetHeader;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(64) NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar TEXT NULL,
    password_hash VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS senders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INT NOT NULL,
    smtp_user VARCHAR(255) NOT NULL,
    smtp_pass VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_senders_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS slack_connections (
    user_id BIGINT PRIMARY KEY,
    team_name VARCHAR(255) NULL,
    channel VARCHAR(255) NULL,
    webhook_url TEXT NOT NULL,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS batches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    subject VARCHAR(998) NOT NULL,
    hourly_limit INT NOT NULL,
    delay_seconds INT NOT NULL,
    start_at DATETIME(3) NOT NULL,
    total INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS emails (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    to_email VARCHAR(320) NOT NULL,
    subject VARCHAR(998) NOT NULL,
    body MEDIUMTEXT NOT NULL,
    preview VARCHAR(255) NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    hourly_limit INT NOT NULL,
    scheduled_at DATETIME(3) NOT NULL,
    status ENUM('scheduled','sending','sent','failed') NOT NULL DEFAULT 'scheduled',
    claimed_at DATETIME(3) NULL,
    sent_at DATETIME(3) NULL,
    message_id VARCHAR(255) NULL,
    preview_url TEXT NULL,
    error TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_emails_user_status (user_id, status, scheduled_at),
    INDEX idx_emails_status (status, scheduled_at),
    INDEX idx_emails_batch (batch_id, position)
  )`,
];

export async function migrate() {
  for (const stmt of SCHEMA) await pool.query(stmt);
}
