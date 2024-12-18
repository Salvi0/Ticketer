import '../globals.css';
import { type LayoutProperties, type Locale, type PageProperties, routing } from '@/i18n/routing';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/react';
import { DM_Sans } from 'next/font/google';
import Footer from '@/components/Footer';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import { NextIntlClientProvider } from 'next-intl';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ThemeProvider } from 'next-themes';
import { cn } from '@/lib/utils';
import { mergeMetadata } from '@/lib/mergeMetadata';
import { notFound } from 'next/navigation';

const font = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });

export async function generateMetadata({ params }: PageProperties): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: 'pages.index.metadata' });

	return mergeMetadata({ description: t('description'), locale, title: t('title') });
}

// eslint-disable-next-line unicorn/prevent-abbreviations
export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProperties) {
	const { locale } = await params;

	if (!routing.locales.includes(locale as Locale)) {
		notFound();
	}

	// Enable static rendering.
	// https://next-intl-docs.vercel.app/docs/getting-started/app-router/with-i18n-routing#static-rendering
	// https://github.com/amannn/next-intl/issues/663
	setRequestLocale(locale);

	const messages = await getMessages();

	return (
		<html lang={locale.slice(0, 2)} suppressHydrationWarning>
			<body className={cn('bg-background min-h-screen font-sans antialiased', font.variable)}>
				<NextIntlClientProvider messages={messages}>
					<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
						<div className="flex h-screen flex-col">
							<Navbar className="mb-4" />
							<div className="mx-8 grow sm:mx-16">{children}</div>
							<Footer className="mt-8" />
						</div>
					</ThemeProvider>
				</NextIntlClientProvider>
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
