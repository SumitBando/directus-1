import { Knex } from 'knex';

export type NewTranslationString = {
	key: string;
	value: string;
	lang: string;
};

export type OldTranslationString = {
	key?: string | null;
	translations?: Record<string, string> | null;
};

function transformStringsNewFormat(oldStrings: OldTranslationString[]): NewTranslationString[] {
	return oldStrings.reduce<NewTranslationString[]>((result, item) => {
		if (!item.key || !item.translations) return result;
		for (const [lang, value] of Object.entries(item.translations)) {
			result.push({ key: item.key, lang, value });
		}
		return result;
	}, []);
}

function transformStringsOldFormat(newStrings: NewTranslationString[]): OldTranslationString[] {
	const keyCache: Record<string, Record<string, string>> = {};
	for (const { key, lang, value } of newStrings) {
		if (!keyCache[key]) keyCache[key] = {};
		keyCache[key][lang] = value;
	}
	return Object.entries(keyCache).map(([key, translations]) => ({ key, translations } as OldTranslationString));
}

export async function up(knex: Knex): Promise<void> {
	const data = await knex.select('translation_strings', 'id').from('directus_settings').first();

	if (data?.translation_strings && data?.id) {
		const newTranslationStrings = transformStringsNewFormat(data.translation_strings);

		await knex('directus_settings')
			.where({ id: data.id })
			.update({
				translation_strings: JSON.stringify(newTranslationStrings),
			});
	}
}

export async function down(knex: Knex): Promise<void> {
	const data = await knex.select('translation_strings', 'id').from('directus_settings').first();

	if (data?.translation_strings && data?.id) {
		const oldTranslationStrings = transformStringsOldFormat(data.translation_strings);

		await knex('directus_settings')
			.where({ id: data.id })
			.update({
				translation_strings: JSON.stringify(oldTranslationStrings),
			});
	}
}
