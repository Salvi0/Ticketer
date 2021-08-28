const connection = require('../db');
const {MessageEmbed} = require('discord.js');

function ifExist(guildId) {
  return new Promise(async (resolve, reject) => {
    try {
      const [rows] = await connection.execute('SELECT * FROM TicketingManagers WHERE GuildID = ?', [guildId]);
      resolve(rows[0] ?? false);
    } catch(err) {
      reject(err);
    }
  });
}
function insert(guildId, roleId) {
  return new Promise(async (resolve, reject) => {
    try {
      await connection.execute('INSERT INTO TicketingManagers (GuildID, RoleID) VALUES (?, ?)', [guildId, roleId]);
      resolve();
    } catch(err) {
      reject(err);
    }
  });
}
function update(guildId, roleId) {
  return new Promise(async (resolve, reject) => {
    try {
      await connection.execute('UPDATE TicketingManagers SET RoleID = ? WHERE GuildID = ?', [roleId, guildId]);
      resolve();
    } catch(err) {
      reject(err);
    }
  });
}

module.exports = {
  name: 'ticket-config',
  data: {
    name: "ticket-config",
    description: "Edit ticketing details",
    category: "ticketing",
    options: [
      {
        name: "managers",
        description: "Specifies the managers of the tickets. They will automatically get added to each ticket",
        type: 1,
        options: [
          {
            name: "role",
            description: "The role that manages tickets",
            type: 8,
            required: true
          }
        ]
      }
    ],
    examples: [
      "ticket-config managers @Mods"
    ]
  },
  async execute(interaction) {
    if (!interaction.member.permissions.has('MANAGE_GUILD')) return interaction.reply({content: 'You need the manage server permission to edit ticketing config'}).catch(console.error);

    try {
      switch (interaction.options.getSubcommand()) {
        case 'managers': {
          const {id} = interaction.options.getRole('role');
          const {guildId} = interaction;
          const exists = await ifExist(guildId);

          if (!exists) await insert(guildId, id);
          else await update(guildId, id);

          interaction.reply({content: `Updated managers to <@&${id}>`});
          break;
        }
        default:
          break;
      }
    } catch(err) {
      console.error(err);
      interaction.reply({content: 'An unknown error occured, please try again later', ephemeral: true}).catch(console.error);
    }
  }
}