const cron = require('node-cron');
const { checkAndUpdateIsToday } = require('./listUtils');

// Schedule the job to run every day at midnight
cron.schedule('0 0 0 * * *', async () => {
    console.log('Running daily checkAndUpdateIsToday job');
    await checkAndUpdateIsToday();
});