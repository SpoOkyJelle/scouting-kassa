// Hardening: persisted sessions must support PIN logins that have no user row,
// so user_id becomes nullable.

export async function up(knex) {
  await knex.schema.alterTable('sessions', (t) => {
    t.bigInteger('user_id').nullable().alter()
  })
}

export async function down(knex) {
  // Remove rows that would violate the NOT NULL before restoring it.
  await knex('sessions').whereNull('user_id').del()
  await knex.schema.alterTable('sessions', (t) => {
    t.bigInteger('user_id').notNullable().alter()
  })
}
