import { type APIApplicationCommandOptionChoice, PermissionFlagsBits, channelMention, userMention } from 'discord.js';
import { type BaseInteraction, Command, Component, DeferReply, DeferUpdate } from '@ticketer/djs-framework';
import { ThreadTicketing, goToPage, messageWithPagination, withPagination } from '@/utils';
import { and, database, desc, eq, ticketThreadsCategories, ticketsThreads } from '@ticketer/database';
import { getTranslations } from '@/i18n';

interface ViewGlobalTicketsOptions {
	state?: ThreadTicketing.TicketState;
	page?: number;
}

async function viewGlobalTickets(
	this: BaseInteraction.Interaction,
	{ interaction }: Command.Context<'chat'> | Component.Context,
	{ state, page = 0 }: ViewGlobalTicketsOptions = {},
) {
	const PAGE_SIZE = 3;

	const { globalAmount, tickets } = await database.transaction(async (tx) => {
		const query = tx
			.select({
				categoryEmoji: ticketThreadsCategories.categoryEmoji,
				categoryTitle: ticketThreadsCategories.categoryTitle,
				state: ticketsThreads.state,
				threadId: ticketsThreads.threadId,
				userId: ticketsThreads.authorId,
			})
			.from(ticketsThreads)
			.where(and(eq(ticketsThreads.guildId, interaction.guildId), state ? eq(ticketsThreads.state, state) : undefined))
			.innerJoin(ticketThreadsCategories, eq(ticketsThreads.categoryId, ticketThreadsCategories.id))
			.orderBy(desc(ticketsThreads.threadId))
			.$dynamic();

		const tickets = await withPagination({
			page,
			pageSize: PAGE_SIZE,
			query,
		});
		const globalAmount = await tx.$count(ticketsThreads, eq(ticketsThreads.guildId, interaction.guildId));

		return { globalAmount, tickets };
	});

	const embeds = tickets.map((ticket) =>
		this.embed.setTitle(ThreadTicketing.titleAndEmoji(ticket.categoryTitle, ticket.categoryEmoji)).setFields(
			{
				name: 'Thread Channel',
				value: channelMention(ticket.threadId),
				inline: true,
			},
			{
				name: 'Ticket Author',
				value: userMention(ticket.userId),
				inline: true,
			},
			{
				name: 'State',
				value: ThreadTicketing.ticketState(ticket.state),
				inline: true,
			},
		),
	);
	const components = messageWithPagination({
		previous: {
			customId: this.customId('ticket_threads_categories_view_global_previous', `${page.toString()}_${state ?? ''}`),
			disabled: page === 0,
		},
		next: {
			customId: this.customId('ticket_threads_categories_view_global_next', `${page.toString()}_${state ?? ''}`),
			disabled: tickets.length < PAGE_SIZE,
		},
	});

	return interaction.editReply({
		components,
		content: `Total amount of tickets in the server: ${globalAmount.toString()}.`,
		embeds,
	});
}

export default class extends Command.Interaction {
	public readonly data = super.SlashBuilder.setName('view-global-tickets')
		.setDescription('View all of the tickets in the server.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageThreads)
		.addStringOption((option) =>
			option
				.setName('state')
				.setDescription("Filter by the tickets' states.")
				.setRequired(false)
				.setChoices(
					...ticketsThreads.state.enumValues.map(
						(state) =>
							({
								name: ThreadTicketing.ticketState(state),
								name_localizations: getTranslations(`tickets.threads.categories.ticketState.${state}`),
								value: state,
							}) satisfies APIApplicationCommandOptionChoice<string>,
					),
				),
		);

	@DeferReply()
	public execute(context: Command.Context<'chat'>) {
		void viewGlobalTickets.call(this, context, {
			state: context.interaction.options.getString('state', false) as ThreadTicketing.TicketState,
		});
	}
}

export class ComponentInteraction extends Component.Interaction {
	public readonly customIds = [
		super.dynamicCustomId('ticket_threads_categories_view_global_previous'),
		super.dynamicCustomId('ticket_threads_categories_view_global_next'),
	];

	@DeferUpdate
	public execute(context: Component.Context) {
		const { success, additionalData, error, page } = goToPage.call(this, context.interaction);

		if (!success) {
			return context.interaction.editReply({
				components: [],
				embeds: [super.userEmbedError(context.interaction.member).setDescription(error)],
			});
		}

		void viewGlobalTickets.call(this, context, {
			state: additionalData.at(0) as ViewGlobalTicketsOptions['state'] | undefined,
			page,
		});
	}
}
