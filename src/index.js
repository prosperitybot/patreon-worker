/* eslint-disable no-param-reassign */
/* eslint-disable max-len */
require('dotenv').config();
const fetch = require('node-fetch');
const Sentry = require('@sentry/node');
const { WhitelabelBot, User, setup: setupDatabase } = require('@prosperitybot/database');
const { Op } = require('sequelize');
const { sqlLogger } = require('./utils/loggingUtils');

if (process.env.SENTRY_DSN !== '') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

setupDatabase(sqlLogger);

setInterval(async () => {
  const currentUsers = await User.findAll({ where: { access_levels: { [Op.substring]: 'WHITELABEL' }, premium_source: 'patreon' }, include: [{ model: WhitelabelBot, required: false }] });
  fetch('https://www.patreon.com/api/oauth2/api/campaigns/933696/pledges', {
    headers: {
      Authorization: `Bearer ${process.env.CREATOR_ACCESS_TOKEN}`,
    },
  }).then(async (result) => {
    const data = await result.json();
    const patreonUserIds = data.included.filter((i) => i.type === 'user').map((a) => a.attributes.social_connections.discord.user_id ?? null);
    const noLongerPatron = currentUsers.filter((currentUser) => !patreonUserIds.includes(currentUser.id.toString()));
    const newPatron = patreonUserIds.filter((patreonUser) => !currentUsers.map((currentUser) => currentUser.id.toString()).includes(patreonUser));
    noLongerPatron.forEach(async (user) => {
      user.whitelabelbot.action = 'stop';
      user.access_levels = user.access_levels.splice(user.access_levels.indexOf('WHITELABEL'), 1);
      await user.save();
    });
    newPatron.forEach(async (patronId) => {
      const user = await User.findByPk(patronId);
      if (user.premium_source === null) {
        const accessLevels = user.access_levels;
        accessLevels.push('WHITELABEL');
        user.access_levels = accessLevels;
        user.premium_source = 'patreon';
        await user.save();
      }
    });
  });
}, 60 * 1000);

process.on('SIGINT', () => {
  console.log('Shutting down nicely...');
  process.exit();
});
