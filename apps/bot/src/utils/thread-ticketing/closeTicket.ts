import type { BaseInteraction, Command, Component } from '@ticketer/djs-framework';
import { ChannelType, Colors, PermissionFlagsBits } from 'discord.js';
import { database, eq, ticketThreadsCategories, ticketsThreads } from '@ticketer/database';
import { translate } from '@/i18n';

export async function closeTicket(
	this: BaseInteraction.Interaction,
	{ interaction }: Command.Context | Component.Context,
) {
	const { channel, guild, guildLocale, locale, member, user } = interaction;
	const translations = translate(locale).tickets.threads.categories.buttons;
	const guildSuccessTranslations = translate(guildLocale).tickets.threads.categories.buttons.close.execute.success;

	if (channel?.type !== ChannelType.PrivateThread && channel?.type !== ChannelType.PublicThread) {
		return interaction.editReply({
			embeds: [
				this.userEmbedError(user, translations._errorIfNotTicketChannel.title()).setDescription(
					translations._errorIfNotTicketChannel.description(),
				),
			],
		});
	}

	if (channel.archived) return;

	if (!channel.editable) {
		return interaction.editReply({
			embeds: [
				this.userEmbedError(user, translations.close.execute.errors.notEditable.title()).setDescription(
					translations.close.execute.errors.notEditable.description(),
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
		.setColor(Colors.Yellow)
		.setTitle(translations.close.execute.success.title())
		.setDescription(translations.close.execute.success.user.description());

	await channel.setArchived(true);
	await interaction.editReply({ embeds: [embed] });

	if (row.logsChannelId) {
		const me = await guild.members.fetchMe();
		const logsChannel = await guild.channels.fetch(row.logsChannelId);

		if (!logsChannel?.isTextBased()) return;
		if (!logsChannel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
			return;

		void logsChannel.send({
			embeds: [
				embed.setTitle(guildSuccessTranslations.title()).setDescription(
					guildSuccessTranslations.logs.description({
						thread: channel.toString(),
						member: user.toString(),
					}),
				),
			],
		});
	}
}
