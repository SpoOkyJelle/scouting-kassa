// Team invitations: an admin invites an email with a role; the invitee accepts
// via a tokenised link, which creates (or reuses) their user and a membership.

export async function up(knex) {
  await knex.schema.createTable('invitations', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE')
    t.text('email').notNullable()                 // stored lowercased
    t.text('role').notNullable().defaultTo('cashier') // admin | cashier (never owner)
    t.text('token').notNullable().unique()
    t.bigInteger('invited_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('accepted_at', { useTz: true })
    t.timestamp('expires_at', { useTz: true }).notNullable()
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    t.index(['account_id'])
    t.unique(['account_id', 'email'])             // one open invite per email per account
  })
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('invitations')
}
