// Initial multi-tenant schema (PostgreSQL). Defines the central auth tables
// (accounts, users, memberships, sessions) and the tenant-scoped POS tables,
// each carrying an account_id. See docs/MULTI_TENANT_DESIGN.md.

export async function up(knex) {
  // ── Central / auth tables ──────────────────────────────────────────────
  await knex.schema.createTable('accounts', (t) => {
    t.bigIncrements('id').primary()
    t.text('name').notNullable()
    t.text('slug').unique()
    t.text('status').notNullable().defaultTo('active')
    t.text('plan').notNullable().defaultTo('free')
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id').primary()
    t.text('email').notNullable().unique() // stored lowercased by the app
    t.text('password_hash').notNullable()
    t.text('name')
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('memberships', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.bigInteger('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE')
    t.text('role').notNullable().defaultTo('cashier') // owner | admin | cashier
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    t.unique(['user_id', 'account_id'])
  })

  await knex.schema.createTable('sessions', (t) => {
    t.text('token').primary()
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.bigInteger('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE')
    t.text('role').notNullable()
    t.timestamp('expires_at', { useTz: true }).notNullable()
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  // Helper: adds the standard account_id column + index to a tenant table.
  const accountRef = (t) => {
    t.bigInteger('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE')
    t.index(['account_id'])
  }

  // ── Tenant tables ──────────────────────────────────────────────────────
  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id').primary()
    accountRef(t)
    t.text('name').notNullable()
    t.decimal('price', 10, 2).notNullable()
    t.decimal('cost_price', 10, 2)
    t.text('category').notNullable().defaultTo('overig')
    t.boolean('available').notNullable().defaultTo(true)
    t.integer('sort_order').notNullable().defaultTo(0)
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('receipts', (t) => {
    t.bigIncrements('id').primary()
    accountRef(t)
    t.text('name')
    t.text('note')
    t.boolean('paid').notNullable().defaultTo(false)
    t.decimal('discount_pct', 6, 2).notNullable().defaultTo(0)
    t.decimal('donation', 10, 2).notNullable().defaultTo(0)
    t.decimal('promo_discount', 10, 2).notNullable().defaultTo(0)
    t.jsonb('promo_lines').notNullable().defaultTo('[]')
    t.text('payment_method')
    t.jsonb('payments').notNullable().defaultTo('[]')
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('receipt_items', (t) => {
    t.bigIncrements('id').primary()
    accountRef(t)
    t.bigInteger('receipt_id').notNullable().references('id').inTable('receipts').onDelete('CASCADE')
    t.bigInteger('product_id')
    t.text('product_name').notNullable()
    t.decimal('product_price', 10, 2).notNullable()
    t.integer('quantity').notNullable().defaultTo(1)
    t.index(['receipt_id'])
  })

  await knex.schema.createTable('inkoop', (t) => {
    t.bigIncrements('id').primary()
    accountRef(t)
    t.text('description').notNullable()
    t.decimal('amount', 10, 2).notNullable()
    t.date('date').notNullable()
    t.text('note')
    t.text('submitted_by')
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('donaties', (t) => {
    t.bigIncrements('id').primary()
    accountRef(t)
    t.text('name')
    t.decimal('amount', 10, 2).notNullable()
    t.date('date').notNullable()
    t.text('note')
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('kas', (t) => {
    t.bigIncrements('id').primary()
    accountRef(t)
    t.date('datum').notNullable()
    t.decimal('begin_bedrag', 10, 2).notNullable().defaultTo(0)
    t.decimal('eind_bedrag', 10, 2)
    t.text('note')
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    t.unique(['account_id', 'datum'])
  })

  await knex.schema.createTable('kas_correcties', (t) => {
    t.bigIncrements('id').primary()
    accountRef(t)
    t.bigInteger('kas_id').notNullable().references('id').inTable('kas').onDelete('CASCADE')
    t.text('type').notNullable().defaultTo('contant')
    t.decimal('amount', 10, 2).notNullable()
    t.text('description').notNullable().defaultTo('')
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    t.index(['kas_id'])
  })

  // Per-account settings blob (categories, promotions, payment, logo, pins…).
  await knex.schema.createTable('settings', (t) => {
    t.bigInteger('account_id').primary().references('id').inTable('accounts').onDelete('CASCADE')
    t.jsonb('data').notNullable().defaultTo('{}')
  })
}

export async function down(knex) {
  // Drop in reverse dependency order.
  for (const table of [
    'settings', 'kas_correcties', 'kas', 'donaties', 'inkoop',
    'receipt_items', 'receipts', 'products',
    'sessions', 'memberships', 'users', 'accounts',
  ]) {
    await knex.schema.dropTableIfExists(table)
  }
}
