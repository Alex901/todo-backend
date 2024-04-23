const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    profilePicture: {
      type: String,
      default: '',
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
      enum: ['user', 'donator', 'admin']
    },
    groups: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
      }],
      default: []
    },

    contacts: { //This is dumb, use references instead
      type: [
        {
          contact_id: {
            type: String,
            required: true,
          },
          username: {
            type: String,
            required: true,
          },
          email: {
            type: String,
            required: true,
          },
          role: {
            type: String,
            default: 'user',
            enum: ['user', 'donator', 'admin']
          },
          profilePicture: {
            type: String,
            default: '',
          },
          contactList: {
            type: [String],
            default: [],
          },
        }
      ],
      default: [],
    },
    listNames: {
      type: [{
        name: {
          type: String,
          required: true,
        },
        tags: {
          type: [
            {
              label: {
                type: String,
                required: true,
              },
              color: {
                type: String,
                default: '#FFFFFF', // Default color is white
              },
              textColor: {
                type: String,
                default: '#000000', // Default text color is black
              },
              uses: {
                type: Number,
                default: 0,
              },
            },
          ],
          default: [],
        },
        description: {
          type: String,
          default: '',
        },
      }],
      default: function () {
        const defaultValues = [
          { name: 'all', tags: [], description: '' },
          { name: 'today', tags: [], description: '' },
        ];
        return defaultValues;
      },
    },
    activeList: {
      type: String,
      default: function () {
        return this.listNames[0].name;
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