const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    listNames: {
      type: [String],
      default: function () {
        // Access the username using this.username
        return [`${this.username}'s list`, 'defaultList', 'dailyList'];
      },
      validate: {
        validator: function (arr) {
          // Define your default strings here
          const defaultValues = ['defaultList', 'dailyList'];
          return arr.every(value => defaultValues.includes(value));
        },
        message: props => `${props.value} is not a valid list name!`
      },
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'Users'
  }
);

// Hash the password before saving it to the database
userSchema.pre('save', async function (next) {
  const user = this;
  if (!user.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt();
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error) {
    return next(error);
  }
});

// Compare the given password with the hashed password in the database
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;