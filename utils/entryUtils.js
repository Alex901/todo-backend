const User = require('../models/User');
const Group = require('../models/Group');

const shouldBeRepeatedToday = (task) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  if (task.repeatable) {
    const repeatInterval = task.repeatInterval;
    const repeatDays = task.repeatDays;
    const repeatMonthlyOption = task.repeatMonthlyOption;
    const repeatYearlyOption = task.repeatYearlyOption;

    const today = new Date();
    const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });
    const dayOfMonth = today.getDate();
    const month = today.getMonth() + 1;

    if (repeatInterval === 'daily') {
      return true;
    } else if (repeatInterval === 'weekly' && repeatDays.includes(dayOfWeek)) {
      return true;
    } else if (repeatInterval === 'monthly' && ((repeatMonthlyOption === 'start' && dayOfMonth === 1) || (repeatMonthlyOption === 'end' && dayOfMonth === new Date(today.getFullYear(), month, 0).getDate()))) {
      return true;
    } else if (repeatInterval === 'yearly' && ((repeatYearlyOption === 'start' && month === 1 && dayOfMonth === 1) || (repeatYearlyOption === 'end' && month === 12 && dayOfMonth === 31))) {
      return true;
    }
  }

  return false;
};

const addToTodayList = async (task) => {
    let todayList;

    // console.log('Task owner:', task.inListNew[0].owner);
  
    // Check if the owner is a User or a Group
    const user = await User.findById(task.inListNew[0].owner).populate('myLists');
    const group = await Group.findById(task.owner);

    // console.log('User:', user);
  
    if (user) {
      todayList = user.myLists.find(list => list.listName === 'today');
      console.log('User today list:', todayList);
    } else if (group) {
      // TODO: Handle the case where the owner is a group
      // Find the group's "today" list and update the today list for all members in the group
      console.log('TODO: Handle group owner case');
    } else {
      console.error('Invalid owner');
      return;
    }
  
    if (todayList) {
      if (!task.inListNew.includes(todayList._id.toString())) {
        task.inListNew.push(todayList._id.toString());
      }
    }
    return task;
  };

module.exports = {
  shouldBeRepeatedToday,
  addToTodayList
};