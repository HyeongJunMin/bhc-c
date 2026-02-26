/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    username: {
      type: 'varchar(64)',
      notNull: true,
    },
    password_hash: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('users', 'username', {
    unique: true,
    name: 'users_username_unique',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
