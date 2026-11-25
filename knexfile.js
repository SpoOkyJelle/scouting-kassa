import 'dotenv/config'

// Knex configuration. The app uses PostgreSQL in every environment; the only
// difference is where the connection string comes from. Migrations live in
// ./migrations and are plain ESM files (export up/down).
const shared = {
  client: 'pg',
  pool: { min: 2, max: 10 },
  migrations: { directory: './migrations', loadExtensions: ['.js'] },
}

const config = {
  development: {
    ...shared,
    connection:
      process.env.DATABASE_URL ||
      'postgres://kassa:kassa@localhost:5432/kassa',
  },
  production: {
    ...shared,
    connection: process.env.DATABASE_URL,
  },
}

export default config
