const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          // Regular expression for email validation
          var emailRegex = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
          return emailRegex.test(v);
        },
        message: props => `${props.value} is not a valid email!`
      }
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: 'user',
      enum: ['user', 'admin']
      
    },
    listNames: {
      type: [String],
      default: function () {
        const defaultValues = ['default', 'daily', 'all', 'shared'];

        return [...new Set([...defaultValues])];
      },
      validate: {
        validator: function (arr) {
          // Define your default strings here
          const defaultValues = ['default', 'daily', 'all', 'shared'];
          return defaultValues.every(value => arr.includes(value));
        },
        message: props => `${props.value} is not a valid list name!`
      },
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