import path from 'path';
import fse from 'fs-extra';
import { ApiExtensionType, AppExtensionType, Extension, ExtensionManifest } from '../../types';
import { resolvePackage } from './resolve-package';
import { listFolders } from './list-folders';
import {
	EXTENSION_NAME_REGEX,
	EXTENSION_PKG_KEY,
	HYBRID_EXTENSION_TYPES,
	NESTED_EXTENSION_TYPES,
} from '../../constants';
import { pluralize } from '../pluralize';
import { isIn, isTypeIn } from '../array-helpers';

export async function resolvePackageExtensions(root: string, extensionNames?: string[]): Promise<Extension[]> {
	const extensions: Extension[] = [];

	const local = extensionNames === undefined;

	if (extensionNames === undefined) {
		extensionNames = await listFolders(root);
		extensionNames = extensionNames.filter((name) => EXTENSION_NAME_REGEX.test(name));
	}

	for (const extensionName of extensionNames) {
		const extensionPath = local ? path.join(root, extensionName) : resolvePackage(extensionName, root);
		const extensionManifest: Record<string, any> = await fse.readJSON(path.join(extensionPath, 'package.json'));

		let parsedManifest;

		try {
			parsedManifest = ExtensionManifest.parse(extensionManifest);
		} catch (error) {
			throw new Error(`The extension manifest of "${extensionName}" is not valid.\n${error}`);
		}

		const extensionOptions = parsedManifest[EXTENSION_PKG_KEY];

		if (extensionOptions.type === 'bundle') {
			extensions.push({
				path: extensionPath,
				name: parsedManifest.name,
				description: parsedManifest.description,
				icon: parsedManifest.icon,
				version: parsedManifest.version,
				type: extensionOptions.type,
				entrypoint: {
					app: extensionOptions.path.app,
					api: extensionOptions.path.api,
				},
				entries: extensionOptions.entries,
				host: extensionOptions.host,
				local,
			});
		} else if (isTypeIn(extensionOptions, HYBRID_EXTENSION_TYPES)) {
			extensions.push({
				path: extensionPath,
				name: parsedManifest.name,
				description: parsedManifest.description,
				icon: parsedManifest.icon,
				version: parsedManifest.version,
				type: extensionOptions.type,
				entrypoint: {
					app: extensionOptions.path.app,
					api: extensionOptions.path.api,
				},
				host: extensionOptions.host,
				local,
			});
		} else {
			extensions.push({
				path: extensionPath,
				name: parsedManifest.name,
				description: parsedManifest.description,
				icon: parsedManifest.icon,
				version: parsedManifest.version,
				type: extensionOptions.type,
				entrypoint: extensionOptions.path,
				host: extensionOptions.host,
				local,
			});
		}
	}

	return extensions;
}

export async function getPackageExtensions(root: string): Promise<Extension[]> {
	let pkg: { dependencies?: Record<string, string> };

	try {
		pkg = await fse.readJSON(path.resolve(root, 'package.json'));
	} catch {
		throw new Error('Current folder does not contain a package.json file');
	}

	const extensionNames = Object.keys(pkg.dependencies ?? {}).filter((dep) => EXTENSION_NAME_REGEX.test(dep));

	return resolvePackageExtensions(root, extensionNames);
}

export async function getLocalExtensions(root: string): Promise<Extension[]> {
	const extensions: Extension[] = [];

	for (const extensionType of NESTED_EXTENSION_TYPES) {
		const typeDir = pluralize(extensionType);
		const typePath = path.resolve(root, typeDir);

		try {
			const extensionNames = await listFolders(typePath);

			for (const extensionName of extensionNames) {
				const extensionPath = path.join(typePath, extensionName);

				if (isIn(extensionType, HYBRID_EXTENSION_TYPES)) {
					extensions.push({
						path: extensionPath,
						name: extensionName,
						type: extensionType,
						entrypoint: {
							app: 'app.js',
							api: 'api.js',
						},
						local: true,
					});
				} else {
					extensions.push({
						path: extensionPath,
						name: extensionName,
						type: extensionType as AppExtensionType | ApiExtensionType,
						entrypoint: 'index.js',
						local: true,
					});
				}
			}
		} catch (e) {
			throw new Error(`Extension folder "${typePath}" couldn't be opened`);
		}
	}

	return extensions;
}
