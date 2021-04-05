const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const { STRING, TEXT } = Sequelize;
const bcrypt = require('bcrypt');

const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

const Note = conn.define('note', {
  content: TEXT,
});

User.hasMany(Note);
Note.belongsTo(User);

User.byToken = async (token) => {
  try {
    const validatedUser = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(validatedUser);
    if (user) {
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });

  const hashed = user.password;
  const matches = await bcrypt.compare(password, hashed);
  console.log(matches);

  if (matches && user) {
    return jwt.sign(user.id, process.env.JWT);
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

User.beforeCreate((user, options) => {
  const saltRounds = 10;
  bcrypt.hash(user.password, saltRounds, function (err, hash) {
    user.password = hash;
    user.save();
  });
});

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];

  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  const note = await Note.create({ content: 'blah' });

  try {
    await lucy.addNote(note);
  } catch (err) {
    console.error(err);
  }

  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
  },
};
