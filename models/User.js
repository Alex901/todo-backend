const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (v) {
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
        const defaultValues = ['all', 'default', 'today', 'shared'];
        return [...new Set([...defaultValues])];
      },
      validate: {
        validator: function (arr) {
          // Define your default strings here
          const defaultValues = ['all', 'default', 'today', 'shared'];
          return defaultValues.every(value => arr.includes(value));
        },
        message: props => `${props.value} is not a valid list name!`
      },
    },
    activeList: {
      type: String,
      default: function () {
        return this.listNames[0];
      }
    },
    settings: {
 
      todoList: {
        selectedListOption: {
          type: String,
          enum: ['Created', 'Name', 'Deadline', 'Priority', 'Difficulty', 'Time', 'Steps', 'all'],
          default: 'Created',

        },
        urgentOnly: {
          type: Boolean,
          default: false,

        },
        deadlineOnly: {
          type: Boolean,
          default: false,
  
        },
      }
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