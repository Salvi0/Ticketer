import { RowDataPacket } from 'mysql2';
import { MessageEmbed, TextChannel } from 'discord.js';
import {
	channelMention,
	inlineCode,
	SlashCommandBuilder
} from '@discordjs/builders';
import { ChannelType } from 'discord-api-types';
import { version } from '../../../package.json';
import { conn } from '../../utils';
import { Command, Tables } from '../../types';

export const category: Command['category'] = 'Staff';

export const data: Command['data'] = new SlashCommandBuilder()
	.setName('welcome')
	.setDescription('Enables welcome and goodbye messages in a specific channel')
	.addSubcommand((subcommand) =>
		subcommand
			.setName('configure')
			.setDescription(
				'Adds/edits welcome and goodbye messages to a specific channel'
			)
			.addChannelOption((option) =>
				option
					.setName('channel')
					.setDescription('The channel for the messages to be sent in')
					.setRequired(true)
					.addChannelTypes([ChannelType.GuildText, ChannelType.GuildNews])
			)
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName('toggle')
			.setDescription('Enables/disables the welcome and goodbye messages')
	);

export const execute: Command['execute'] = async ({ interaction }) => {
	try {
		if (
			!interaction.memberPermissions?.has(['MANAGE_GUILD', 'MANAGE_CHANNELS'])
		) {
			return interaction.reply({
				content:
					'You need the manage server and channels permission to run this command',
				ephemeral: true
			});
		}

		const [rows] = await conn.execute(
			'SELECT * FROM GuildMemberEvent WHERE GuildID = ?',
			[interaction.guildId]
		);
		const record = (
			rows as RowDataPacket[]
		)[0] as Tables.GuildMemberEvent | null;

		const embed = new MessageEmbed()
			.setColor('DARK_GREEN')
			.setAuthor(
				interaction.user.tag,
				interaction.user.displayAvatarURL({ dynamic: true })
			)
			.setTitle('Welcome/Goodbye Messages Configuration Modified')
			.setTimestamp()
			.setFooter(`Version ${version}`);

		switch (interaction.options.getSubcommand()) {
			case 'configure': {
				const channel = interaction.options.getChannel(
					'channel'
				) as TextChannel;

				if (!record) {
					await conn.execute(
						'INSERT INTO GuildMemberEvent (GuildID, ChannelID) VALUES (?, ?)',
						[interaction.guildId, channel.id]
					);
					embed.setDescription(
						`Successfully created welcome/goodbye messages in ${channelMention(
							channel.id
						)}`
					);

					return interaction.reply({ embeds: [embed] });
				} else {
					await conn.execute(
						'UPDATE GuildMemberEvent SET ChannelID = ? WHERE GuildID = ?',
						[channel.id, interaction.guildId]
					);
					embed.setDescription(
						`Successfully updated from ${channelMention(
							record.ChannelID
						)} to ${channelMention(channel.id)}`
					);

					return interaction.reply({ embeds: [embed] });
				}
			}
			case 'toggle': {
				if (!record) {
					return interaction.reply({
						content:
							'Create the configuration for the welcome/goodbye messages first',
						ephemeral: true
					});
				}

				await conn.execute(
					'UPDATE GuildMemberEvent SET Enabled = ? WHERE GuildID = ?',
					[!record.Enabled, interaction.guildId]
				);
				embed.setDescription(
					`Successfully updated from messages ${inlineCode(
						record.Enabled ? 'on' : 'off'
					)} to ${inlineCode(record.Enabled ? 'off' : 'on')}`
				);

				return interaction.reply({ embeds: [embed] });
			}
			default:
				break;
		}
	} catch (err) {
		console.error(err);
	}
};