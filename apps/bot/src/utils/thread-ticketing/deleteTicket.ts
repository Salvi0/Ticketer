import type { BaseInteraction, Command, Component } from '@ticketer/djs-framework';
import { ChannelType, Colors, PermissionFlagsBits, inlineCode } from 'discord.js';
import { database, eq, ticketThreadsCategories, ticketsThreads } from '@ticketer/database';
import { translate } from '@/i18n';

export async function deleteTicket(
	this: BaseInteraction.Interaction,
	{ interaction }: Command.Context | Component.Context,
) {
	const { channel, guild, guildLocale, locale, member, user } = interaction;
	const translations = translate(locale).tickets.threads.categories.buttons;
	const guildSuccessTranslations =
		translate(guildLocale).tickets.threads.categories.buttons.delete.execute.success.logs;

	if (channel?.type !== ChannelType.PrivateThread && channel?.type !== ChannelType.PublicThread) {
		return interaction.editReply({
			embeds: [
				this.userEmbedError(user, translations._errorIfNotTicketChannel.title()).setDescription(
					translations._errorIfNotTicketChannel.description(),
				),
			],
		});
	}

	if (!channel.manageable) {
		return interaction.editReply({
			embeds: [
				this.userEmbedError(user, translations.lock.execute.errors.notManageable.title()).setDescription(
					translations.lock.execute.errors.notManageable.description(),
				),
			],
		});
	}

	const [row] = await database
		.select({
			authorId: ticketsThreads.authorId,
			logsChannelId: ticketThreadsCategories.logsChannelId,
			managers: ticketThreadsCategories.managers,
		})
		.from(ticketsThreads)
		.where(eq(ticketsThreads.threadId, channel.id))
		.innerJoin(ticketThreadsCategories, eq(ticketsThreads.categoryId, ticketThreadsCategories.id));

	if (row?.authorId !== user.id && !row?.managers.some((id) => member.roles.resolve(id))) {
		return interaction.editReply({
			embeds: [
				this.userEmbedError(user, translations._errorIfNotTicketAuthorOrManager.title()).setDescription(
					translations._errorIfNotTicketAuthorOrManager.description(),
				),
			],
		});
	}

	const embed = this.userEmbed(user)
		.setColor(Colors.Red)
		.setTitle(translations.delete.execute.success.user.title())
		.setDescription(translations.delete.execute.success.user.description());

	await interaction.editReply({ embeds: [embed] });
	await channel.delete();

	if (row.logsChannelId) {
		const me = await guild.members.fetchMe();
		const logsChannel = await guild.channels.fetch(row.logsChannelId);

		if (!logsChannel?.isTextBased()) return;
		if (!logsChannel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
			return;

		void logsChannel.send({
			embeds: [
				embed.setTitle(guildSuccessTranslations.title()).setDescription(
					guildSuccessTranslations.description({
						member: user.toString(),
						threadId: inlineCode(channel.id),
						title: channel.name,
					}),
				),
			],
		});
	}
}
