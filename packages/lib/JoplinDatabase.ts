import { compileQuery, queryBuilder, sql } from './services/database/queryBuilder';
import Resource from './models/Resource';
import shim from './shim';
import Database, { Row } from './database';
import { SqlQuery } from './services/database/types';
import addMigrationFile from './services/database/addMigrationFile';
import sqlStringToLines from './services/database/sqlStringToLines';
import migrations from './services/database/migrations';

const { sprintf } = require('sprintf-js');

const structureQueries = [
	compileQuery(
		queryBuilder.schema
			.createTable('folders')
			.addColumn('id', sql.raw('TEXT'), (column) => column.primaryKey())
			.addColumn('title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('created_time', sql.raw('INT'), (column) => column.notNull())
			.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull()),
	),
	compileQuery(queryBuilder.schema.createIndex('folders_title').on('folders').columns(['title'])),
	compileQuery(queryBuilder.schema.createIndex('folders_updated_time').on('folders').columns(['updated_time'])),
	compileQuery(
		queryBuilder.schema
			.createTable('notes')
			.addColumn('id', sql.raw('TEXT'), (column) => column.primaryKey())
			.addColumn('parent_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('created_time', sql.raw('INT'), (column) => column.notNull())
			.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull())
			.addColumn('is_conflict', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('latitude', sql.raw('NUMERIC'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('longitude', sql.raw('NUMERIC'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('altitude', sql.raw('NUMERIC'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('author', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('source_url', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('is_todo', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('todo_due', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('todo_completed', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('source', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('source_application', sql.raw('TEXT'), (column) =>
				column.notNull().defaultTo(sql.raw('""')),
			)
			.addColumn('application_data', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('order', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
	),
	compileQuery(queryBuilder.schema.createIndex('notes_title').on('notes').columns(['title'])),
	compileQuery(queryBuilder.schema.createIndex('notes_updated_time').on('notes').columns(['updated_time'])),
	compileQuery(queryBuilder.schema.createIndex('notes_is_conflict').on('notes').columns(['is_conflict'])),
	compileQuery(queryBuilder.schema.createIndex('notes_is_todo').on('notes').columns(['is_todo'])),
	compileQuery(queryBuilder.schema.createIndex('notes_order').on('notes').columns(['order'])),
	compileQuery(
		queryBuilder.schema
			.createTable('tags')
			.addColumn('id', sql.raw('TEXT'), (column) => column.primaryKey())
			.addColumn('title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('created_time', sql.raw('INT'), (column) => column.notNull())
			.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull()),
	),
	compileQuery(queryBuilder.schema.createIndex('tags_title').on('tags').columns(['title'])),
	compileQuery(queryBuilder.schema.createIndex('tags_updated_time').on('tags').columns(['updated_time'])),
	compileQuery(
		queryBuilder.schema
			.createTable('note_tags')
			.addColumn('id', sql.raw('TEXT'), (column) => column.primaryKey())
			.addColumn('note_id', sql.raw('TEXT'), (column) => column.notNull())
			.addColumn('tag_id', sql.raw('TEXT'), (column) => column.notNull())
			.addColumn('created_time', sql.raw('INT'), (column) => column.notNull())
			.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull()),
	),
	compileQuery(queryBuilder.schema.createIndex('note_tags_note_id').on('note_tags').columns(['note_id'])),
	compileQuery(queryBuilder.schema.createIndex('note_tags_tag_id').on('note_tags').columns(['tag_id'])),
	compileQuery(
		queryBuilder.schema.createIndex('note_tags_updated_time').on('note_tags').columns(['updated_time']),
	),
	compileQuery(
		queryBuilder.schema
			.createTable('resources')
			.addColumn('id', sql.raw('TEXT'), (column) => column.primaryKey())
			.addColumn('title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('mime', sql.raw('TEXT'), (column) => column.notNull())
			.addColumn('filename', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
			.addColumn('created_time', sql.raw('INT'), (column) => column.notNull())
			.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull()),
	),
	compileQuery(queryBuilder.schema.createIndex('resources_title').on('resources').columns(['title'])),
	compileQuery(
		queryBuilder.schema.createIndex('resources_updated_time').on('resources').columns(['updated_time']),
	),
	compileQuery(
		queryBuilder.schema
			.createTable('settings')
			.addColumn('key', sql.raw('TEXT'), (column) => column.primaryKey())
			.addColumn('value', sql.raw('TEXT'))
			.addColumn('type', sql.raw('INT'), (column) => column.notNull()),
	),
	compileQuery(
		queryBuilder.schema
			.createTable('table_fields')
			.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
			.addColumn('table_name', sql.raw('TEXT'), (column) => column.notNull())
			.addColumn('field_name', sql.raw('TEXT'), (column) => column.notNull())
			.addColumn('field_type', sql.raw('INT'), (column) => column.notNull())
			.addColumn('field_default', sql.raw('TEXT')),
	),
	compileQuery(
		queryBuilder.schema
			.createTable('sync_items')
			.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
			.addColumn('sync_target', sql.raw('INT'), (column) => column.notNull())
			.addColumn('sync_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
			.addColumn('item_type', sql.raw('INT'), (column) => column.notNull())
			.addColumn('item_id', sql.raw('TEXT'), (column) => column.notNull()),
	),
	compileQuery(queryBuilder.schema.createIndex('sync_items_sync_time').on('sync_items').columns(['sync_time'])),
	compileQuery(
		queryBuilder.schema.createIndex('sync_items_sync_target').on('sync_items').columns(['sync_target']),
	),
	compileQuery(queryBuilder.schema.createIndex('sync_items_item_type').on('sync_items').columns(['item_type'])),
	compileQuery(queryBuilder.schema.createIndex('sync_items_item_id').on('sync_items').columns(['item_id'])),
	compileQuery(
		queryBuilder.schema
			.createTable('deleted_items')
			.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
			.addColumn('item_type', sql.raw('INT'), (column) => column.notNull())
			.addColumn('item_id', sql.raw('TEXT'), (column) => column.notNull())
			.addColumn('deleted_time', sql.raw('INT'), (column) => column.notNull()),
	),
	compileQuery(
		queryBuilder.schema
			.createTable('version')
			.addColumn('version', sql.raw('INT'), (column) => column.notNull()),
	),
	compileQuery(queryBuilder.insertInto('version').values([{ 'version': sql.val(1) }])),
];

export interface TableField {
	name: string;
	type: number;
	default?: string | number | boolean | null;
	description?: string;
}

export default class JoplinDatabase extends Database {

	public static TYPE_INT = 1;
	public static TYPE_TEXT = 2;
	public static TYPE_NUMERIC = 3;

	private initialized_ = false;
	private tableFields_: Record<string, TableField[]> = null;
	private version_: number = null;
	private tableFieldNames_: Record<string, string[]> = {};
	private tableDescriptions_: Record<string, Record<string, string>>;
	private sqliteVecAvailable_ = false;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base Database class uses `any` for driver — different drivers (sqlite, better-sqlite3, web) have different shapes
	public constructor(driver: any) {
		super(driver);
	}

	public initialized() {
		return this.initialized_;
	}

	// Returns true if the sqlite-vec extension loaded successfully when the
	// database was opened. False on platforms where the prebuilt is missing or
	// extension loading is otherwise blocked. Callers that need vector search
	// (the AI embeddings index) should gate on this and degrade gracefully
	// rather than throwing.
	public sqliteVecAvailable() {
		return this.sqliteVecAvailable_;
	}

	public async open(options: Record<string, unknown>) {
		await super.open(options);
		await this.tryLoadSqliteVec();
		return this.initialize();
	}

	private async tryLoadSqliteVec() {
		const sqliteVec = shim.sqliteVec();
		if (!sqliteVec) {
			this.sqliteVecAvailable_ = false;
			this.logger().info('sqlite-vec not provided by the host app; vector search disabled');
			return;
		}
		try {
			await this.loadExtension(sqliteVec.getLoadablePath());
			this.sqliteVecAvailable_ = true;
			this.logger().info('sqlite-vec extension loaded');
		} catch (error) {
			this.sqliteVecAvailable_ = false;
			this.logger().warn('sqlite-vec extension failed to load; vector search disabled:', error);
		}
	}

	public tableFieldNames(tableName: string) {
		if (this.tableFieldNames_[tableName]) return this.tableFieldNames_[tableName].slice();

		const tf = this.tableFields(tableName);
		const output = [];
		for (let i = 0; i < tf.length; i++) {
			output.push(tf[i].name);
		}
		this.tableFieldNames_[tableName] = output;

		return output.slice();
	}

	public tableFields(tableName: string, options: { includeDescription?: boolean } = null) {
		if (options === null) options = {};

		if (!this.tableFields_) throw new Error('Fields have not been loaded yet');
		if (!this.tableFields_[tableName]) throw new Error(`Unknown table: ${tableName}`);
		const output = this.tableFields_[tableName].slice();

		if (options.includeDescription) {
			for (let i = 0; i < output.length; i++) {
				output[i].description = this.fieldDescription(tableName, output[i].name);
			}
		}

		return output;
	}

	public async clearForTesting() {
		const tableNames = [
			'notes',
			'folders',
			'resources',
			'tags',
			'note_tags',
			// 'master_keys',
			'item_changes',
			'note_resources',
			// 'settings',
			'deleted_items',
			'sync_items',
			'notes_normalized',
			'revisions',
			'resources_to_download',
			'key_values',
		];

		const queries = [];
		for (const n of tableNames) {
			queries.push(compileQuery(queryBuilder.deleteFrom(n)));
			queries.push(compileQuery(queryBuilder.deleteFrom('sqlite_sequence').where(eb => eb(sql.ref('name'), '=', sql.val(n))))); // Reset autoincremented IDs
		}

		queries.push(compileQuery(
			queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.1.context'))),
		));
		queries.push(compileQuery(
			queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.2.context'))),
		));
		queries.push(compileQuery(
			queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.3.context'))),
		));
		queries.push(compileQuery(
			queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.4.context'))),
		));
		queries.push(compileQuery(
			queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.5.context'))),
		));
		queries.push(compileQuery(
			queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.6.context'))),
		));
		queries.push(compileQuery(
			queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.7.context'))),
		));

		queries.push(compileQuery(
			queryBuilder
				.deleteFrom('settings')
				.where((eb) => eb(sql.ref('key'), '=', sql.val('revisionService.lastProcessedChangeId'))),
		));
		queries.push(compileQuery(
			queryBuilder
				.deleteFrom('settings')
				.where((eb) => eb(sql.ref('key'), '=', sql.val('resourceService.lastProcessedChangeId'))),
		));
		queries.push(compileQuery(
			queryBuilder
				.deleteFrom('settings')
				.where((eb) => eb(sql.ref('key'), '=', sql.val('searchEngine.lastProcessedChangeId'))),
		));

		await this.transactionExecBatch(queries);
	}

	public createDefaultRow(tableName: string) {
		const row: Record<string, unknown> = {};
		const fields = this.tableFields(tableName);
		for (let i = 0; i < fields.length; i++) {
			const f = fields[i];
			row[f.name] = Database.formatValue(f.type, f.default);
		}
		return row;
	}

	public fieldByName(tableName: string, fieldName: string) {
		const fields = this.tableFields(tableName);
		for (const field of fields) {
			if (field.name === fieldName) return field;
		}
		throw new Error(`No such field: ${tableName}: ${fieldName}`);
	}

	public fieldDefaultValue(tableName: string, fieldName: string) {
		return this.fieldByName(tableName, fieldName).default;
	}

	public fieldDescription(tableName: string, fieldName: string) {
		const sp = sprintf;

		if (!this.tableDescriptions_) {
			this.tableDescriptions_ = {
				notes: {
					parent_id: sp('ID of the notebook that contains this note. Change this ID to move the note to a different notebook.'),
					body: sp('The note body, in Markdown. May also contain HTML.'),
					is_conflict: sp('Tells whether the note is a conflict or not.'),
					is_todo: sp('Tells whether this note is a todo or not.'),
					todo_due: sp('When the todo is due. An alarm will be triggered on that date.'),
					todo_completed: sp('Tells whether todo is completed or not. This is a timestamp in milliseconds.'),
					source_url: sp('The full URL where the note comes from.'),
					is_shared: sp('Whether the note is published.'),
				},
				folders: {},
				resources: {},
				tags: {},
				item_changes: {
					type: 'The type of change - either 1 (created), 2 (updated) or 3 (deleted)',
					created_time: 'When the event was generated',
					item_type: 'The item type (see table above for the list of item types)',
					item_id: 'The item ID',
					before_change_item: 'Unused',
					source: 'Unused',
				},
			};

			const baseItems = ['notes', 'folders', 'tags', 'resources'];

			for (let i = 0; i < baseItems.length; i++) {
				const n = baseItems[i];
				const singular = n.substr(0, n.length - 1);
				this.tableDescriptions_[n].title = sp('The %s title.', singular);
				this.tableDescriptions_[n].created_time = sp('When the %s was created.', singular);
				this.tableDescriptions_[n].updated_time = sp('When the %s was last updated.', singular);
				this.tableDescriptions_[n].user_created_time = sp('When the %s was created. It may differ from created_time as it can be manually set by the user.', singular);
				this.tableDescriptions_[n].user_updated_time = sp('When the %s was last updated. It may differ from updated_time as it can be manually set by the user.', singular);
				this.tableDescriptions_[n].share_id = sp('The ID of the Joplin Server/Cloud share containing the %s. Empty if not shared.', singular);
			}
		}

		const d = this.tableDescriptions_[tableName];
		return d && d[fieldName] ? d[fieldName] : '';
	}

	private async countFields(tableName: string): Promise<number> {
		const pragmas = await this.selectAll(`PRAGMA table_info("${tableName}")`);
		if (!pragmas) throw new Error(`No such table: ${tableName}`);
		return pragmas.length;
	}

	public async refreshTableFields(newVersion: number) {
		this.logger().info('Initializing tables...');
		const queries: SqlQuery[] = [];
		queries.push(this.wrapQuery(compileQuery(queryBuilder.deleteFrom('table_fields'))));

		const countFieldsNotesFts = await this.countFields('notes_fts');
		const countFieldsItemsFts = await this.countFields('items_fts');
		if (countFieldsNotesFts !== countFieldsItemsFts) {
			throw new Error(`\`notes_fts\` (${countFieldsNotesFts} fields) must have the same number of fields as \`items_fts\` (${countFieldsItemsFts} fields) for the search engine BM25 algorithm to work`);
		}

		interface TableRow {
			name: string;
		}

		const tableRows: TableRow[] = await this.selectAll(compileQuery(
			queryBuilder
				.selectFrom('sqlite_master')
				.select(['name'])
				.where((eb) => eb(sql.ref('type'), '=', sql.val('table'))),
		));

		for (let i = 0; i < tableRows.length; i++) {
			let pragmas: Row[] = [];
			const tableName = tableRows[i].name;
			try {
				if (tableName === 'android_metadata') continue;
				if (tableName === 'table_fields') continue;
				if (tableName.startsWith('sqlite_')) continue;
				if (tableName.indexOf('notes_fts') === 0) continue;
				if (tableName.indexOf('items_fts') === 0) continue;
				if (tableName === 'notes_spellfix') continue;
				if (tableName === 'search_aux') continue;
				if (tableName.startsWith('note_embeddings_vec')) continue;

				pragmas = await this.selectAll(`PRAGMA table_info("${tableName}")`);

				for (let i = 0; i < pragmas.length; i++) {
					const item = pragmas[i];
					// In SQLite, if the default value is a string it has double quotes around it, so remove them here
					let defaultValue = item.dflt_value;
					if (typeof defaultValue === 'string' && defaultValue.length >= 2 && defaultValue[0] === '"' && defaultValue[defaultValue.length - 1] === '"') {
						defaultValue = defaultValue.substr(1, defaultValue.length - 2);
					}
					const q = Database.insertQuery('table_fields', {
						table_name: tableName,
						field_name: item.name,
						field_type: Database.enumId('fieldType', item.type),
						field_default: defaultValue,
					});
					queries.push(q);
				}
			} catch (error) {
				error.message = `On table: ${tableName}: Pragma: ${JSON.stringify(pragmas)}: ${error.message}`;
				throw error;
			}
		}

		queries.push(compileQuery(queryBuilder.updateTable('version').set({ 'table_fields_version': sql.val(newVersion) })));
		await this.transactionExecBatch(queries);
	}

	public async upgradeDatabase(fromVersion: number) {
		// INSTRUCTIONS TO UPGRADE THE DATABASE:
		//
		// 1. Add the migration to lib/services/database/migrations.
		// 2. Import the migration and add it to the `migrations` array above.

		// IMPORTANT:
		//
		// Whenever adding a new database property, some additional logic might be needed
		// in the synchronizer to handle this property. For example, when adding a property
		// that should have a default value, existing remote items will not have this
		// default value and thus might cause problems. In that case, the default value
		// must be set in the synchronizer too.

		// Note: v16 and v17 don't do anything. They were used to debug an issue.
		const existingDatabaseVersions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];

		for (let i = 0; i < migrations.length; i++) existingDatabaseVersions.push(existingDatabaseVersions[existingDatabaseVersions.length - 1] + 1);

		let currentVersionIndex = existingDatabaseVersions.indexOf(fromVersion);

		// currentVersionIndex < 0 if for the case where an old version of Joplin used with a newer
		// version of the database, so that migration is not run in this case.
		if (currentVersionIndex < 0) {
			throw new Error(
				'Unknown profile version. Most likely this is an old version of Joplin, while the profile was created by a newer version. Please upgrade Joplin at https://joplinapp.org and try again.\n'
				+ `Joplin version: ${shim.appVersion()}\n`
				+ `Profile version: ${fromVersion}\n`
				+ `Expected version: ${existingDatabaseVersions[existingDatabaseVersions.length - 1]}`);
		}

		this.logger().info(`Upgrading database from version ${fromVersion}`);

		if (currentVersionIndex === existingDatabaseVersions.length - 1) return fromVersion;

		let latestVersion = fromVersion;

		while (currentVersionIndex < existingDatabaseVersions.length - 1) {
			const targetVersion = existingDatabaseVersions[currentVersionIndex + 1];
			this.logger().info(`Converting database to version ${targetVersion}`);

			let queries: (SqlQuery|string)[] = [];

			if (targetVersion === 1) {
				queries = [...structureQueries];
			}

			if (targetVersion === 2) {
				const newTableSql = compileQuery(
					queryBuilder.schema
						.createTable('deleted_items')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
						.addColumn('item_type', sql.raw('INT'), (column) => column.notNull())
						.addColumn('item_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('deleted_time', sql.raw('INT'), (column) => column.notNull())
						.addColumn('sync_target', sql.raw('INT'), (column) => column.notNull()),
				);

				queries.push({ sql: compileQuery(queryBuilder.schema.dropTable('deleted_items')).sql });
				queries.push(newTableSql);
				queries.push({ sql: compileQuery(
					queryBuilder.schema.createIndex('deleted_items_sync_target').on('deleted_items').columns(['sync_target']),
				).sql });
			}

			if (targetVersion === 3) {
				queries = this.alterColumnQueries('settings', { key: 'TEXT PRIMARY KEY', value: 'TEXT' });
			}

			if (targetVersion === 4) {
				queries.push(compileQuery(
					queryBuilder.insertInto('settings').values([
						{
							key: sql.val('sync.3.context'),
							value: queryBuilder
								.selectFrom('settings')
								.select(['value'])
								.where((eb) => eb(sql.ref('key'), '=', sql.val('sync.context'))),
						},
					]),
				));
				queries.push(compileQuery(
					queryBuilder.deleteFrom('settings').where((eb) => eb(sql.ref('key'), '=', sql.val('sync.context'))),
				));
			}

			if (targetVersion === 5) {
				const tableNames = ['notes', 'folders', 'tags', 'note_tags', 'resources'];
				for (let i = 0; i < tableNames.length; i++) {
					const n = tableNames[i];
					queries.push(compileQuery(
						queryBuilder.schema
							.alterTable(n)
							.addColumn('user_created_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
					));
					queries.push(compileQuery(
						queryBuilder.schema
							.alterTable(n)
							.addColumn('user_updated_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
					));
					queries.push(compileQuery(queryBuilder.updateTable(n).set({ 'user_created_time': sql.ref('created_time') })));
					queries.push(compileQuery(queryBuilder.updateTable(n).set({ 'user_updated_time': sql.ref('updated_time') })));
					queries.push(compileQuery(queryBuilder.schema.createIndex(`${n}_user_updated_time`).on(n).columns(['user_updated_time'])));
				}
			}

			if (targetVersion === 6) {
				queries.push(compileQuery(
					queryBuilder.schema
						.createTable('alarms')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey().autoIncrement())
						.addColumn('note_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('trigger_time', sql.raw('INT'), (column) => column.notNull()),
				));
				queries.push(compileQuery(queryBuilder.schema.createIndex('alarm_note_id').on('alarms').columns(['note_id'])));
			}

			if (targetVersion === 7) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('resources')
						.addColumn('file_extension', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
			}

			if (targetVersion === 8) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('sync_items')
						.addColumn('sync_disabled', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('"0"'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('sync_items')
						.addColumn('sync_disabled_reason', sql.raw('TEXT'), (column) =>
							column.notNull().defaultTo(sql.raw('""')),
						),
				));
			}

			if (targetVersion === 9) {
				const newTableSql = compileQuery(
					queryBuilder.schema
						.createTable('master_keys')
						.addColumn('id', sql.raw('TEXT'), (column) => column.primaryKey())
						.addColumn('created_time', sql.raw('INT'), (column) => column.notNull())
						.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull())
						.addColumn('source_application', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('encryption_method', sql.raw('INT'), (column) => column.notNull())
						.addColumn('checksum', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('content', sql.raw('TEXT'), (column) => column.notNull()),
				);
				queries.push(newTableSql);
				const tableNames = ['notes', 'folders', 'tags', 'note_tags', 'resources'];
				for (let i = 0; i < tableNames.length; i++) {
					const n = tableNames[i];
					queries.push(compileQuery(
						queryBuilder.schema
							.alterTable(n)
							.addColumn('encryption_cipher_text', sql.raw('TEXT'), (column) =>
								column.notNull().defaultTo(sql.raw('""')),
							),
					));
					queries.push(compileQuery(
						queryBuilder.schema
							.alterTable(n)
							.addColumn('encryption_applied', sql.raw('INT'), (column) =>
								column.notNull().defaultTo(sql.raw('0')),
							),
					));
					queries.push(compileQuery(queryBuilder.schema.createIndex(`${n}_encryption_applied`).on(n).columns(['encryption_applied'])));
				}

				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('sync_items')
						.addColumn('force_sync', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('resources')
						.addColumn('encryption_blob_encrypted', sql.raw('INT'), (column) =>
							column.notNull().defaultTo(sql.raw('0')),
						),
				));
			}

			const upgradeVersion10 = () => {
				const itemChangesTable = compileQuery(
					queryBuilder.schema
						.createTable('item_changes')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey().autoIncrement())
						.addColumn('item_type', sql.raw('INT'), (column) => column.notNull())
						.addColumn('item_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('type', sql.raw('INT'), (column) => column.notNull())
						.addColumn('created_time', sql.raw('INT'), (column) => column.notNull()),
				);

				const noteResourcesTable = compileQuery(
					queryBuilder.schema
						.createTable('note_resources')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
						.addColumn('note_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('resource_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('is_associated', sql.raw('INT'), (column) => column.notNull())
						.addColumn('last_seen_time', sql.raw('INT'), (column) => column.notNull()),
				);

				queries.push(itemChangesTable);
				queries.push(compileQuery(queryBuilder.schema.createIndex('item_changes_item_id').on('item_changes').columns(['item_id'])));
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('item_changes_created_time').on('item_changes').columns(['created_time']),
				));
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('item_changes_item_type').on('item_changes').columns(['item_type']),
				));

				queries.push(noteResourcesTable);
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('note_resources_note_id').on('note_resources').columns(['note_id']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('note_resources_resource_id')
						.on('note_resources')
						.columns(['resource_id']),
				));

				queries.push(compileQuery(
					queryBuilder
						.insertInto('item_changes')
						.columns(['item_type', 'item_id', 'type', 'created_time'])
						.expression(
							queryBuilder
								.selectFrom('notes')
								.select([
									sql.val(1).as('item_type'),
									'id',
									sql.val(1).as('type'),
									sql.val(Date.now()).as('created_time'),
								]),
						),
				));
			};

			if (targetVersion === 10) {
				upgradeVersion10();
			}

			if (targetVersion === 11) {
				// This trick was needed because Electron Builder incorrectly released a dev branch containing v10 as it was
				// still being developed, and the db schema was not final at that time. So this v11 was created to
				// make sure any invalid db schema that was accidentally created was deleted and recreated.
				queries.push(compileQuery(queryBuilder.schema.dropTable('item_changes')).sql);
				queries.push(compileQuery(queryBuilder.schema.dropTable('note_resources')).sql);
				upgradeVersion10();
			}

			if (targetVersion === 12) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('folders')
						.addColumn('parent_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
			}

			if (targetVersion === 13) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('resources')
						.addColumn('fetch_status', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('"2"'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('resources')
						.addColumn('fetch_error', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
				queries.push(compileQuery(
					queryBuilder.updateTable('resources').set({ fetch_status: sql.val(Resource.FETCH_STATUS_DONE) }),
				));
			}

			if (targetVersion === 14) {
				const resourceLocalStates = compileQuery(
					queryBuilder.schema
						.createTable('resource_local_states')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
						.addColumn('resource_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('fetch_status', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('"2"')))
						.addColumn('fetch_error', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				);

				queries.push(resourceLocalStates);

				queries.push(compileQuery(
					queryBuilder
						.insertInto('resource_local_states')
						.expression(
							queryBuilder
								.selectFrom('resources')
								.select([sql.val(null).as('id'), 'id as resource_id', 'fetch_status', 'fetch_error']),
						),
				));

				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('resource_local_states_resource_id')
						.on('resource_local_states')
						.columns(['resource_id']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('resource_local_states_resource_fetch_status')
						.on('resource_local_states')
						.columns(['fetch_status']),
				));

				queries = queries.concat(
					this.alterColumnQueries('resources', {
						id: 'TEXT PRIMARY KEY',
						title: 'TEXT NOT NULL DEFAULT ""',
						mime: 'TEXT NOT NULL',
						filename: 'TEXT NOT NULL DEFAULT ""',
						created_time: 'INT NOT NULL',
						updated_time: 'INT NOT NULL',
						user_created_time: 'INT NOT NULL DEFAULT 0',
						user_updated_time: 'INT NOT NULL DEFAULT 0',
						file_extension: 'TEXT NOT NULL DEFAULT ""',
						encryption_cipher_text: 'TEXT NOT NULL DEFAULT ""',
						encryption_applied: 'INT NOT NULL DEFAULT 0',
						encryption_blob_encrypted: 'INT NOT NULL DEFAULT 0',
					}),
				);
			}

			if (targetVersion === 15) {
				queries.push('CREATE VIRTUAL TABLE notes_fts USING fts4(content="notes", notindexed="id", id, title, body)');
				queries.push(compileQuery(
					queryBuilder
						.insertInto('notes_fts')
						.columns(['docid', 'id', 'title', 'body'])
						.expression(
							queryBuilder
								.selectFrom('notes')
								.select(['rowid', 'id', 'title', 'body'])
								.where((eb) =>
									eb.and([
										eb(sql.ref('is_conflict'), '=', sql.val(0)),
										eb(sql.ref('encryption_applied'), '=', sql.val(0)),
									]),
								),
						),
				));

				// Keep the content tables (notes) and the FTS table (notes_fts) in sync.
				// More info at https://www.sqlite.org/fts3.html#_external_content_fts4_tables_
				queries.push(`
					CREATE TRIGGER notes_fts_before_update BEFORE UPDATE ON notes BEGIN
						DELETE FROM notes_fts WHERE docid=old.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_fts_before_delete BEFORE DELETE ON notes BEGIN
						DELETE FROM notes_fts WHERE docid=old.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_after_update AFTER UPDATE ON notes BEGIN
						INSERT INTO notes_fts(docid, id, title, body) SELECT rowid, id, title, body FROM notes WHERE is_conflict = 0 AND encryption_applied = 0 AND new.rowid = notes.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_after_insert AFTER INSERT ON notes BEGIN
						INSERT INTO notes_fts(docid, id, title, body) SELECT rowid, id, title, body FROM notes WHERE is_conflict = 0 AND encryption_applied = 0 AND new.rowid = notes.rowid;
					END;`);
			}

			if (targetVersion === 18) {
				const notesNormalized = compileQuery(
					queryBuilder.schema
						.createTable('notes_normalized')
						.addColumn('id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				);

				queries.push(notesNormalized);

				queries.push(compileQuery(queryBuilder.schema.createIndex('notes_normalized_id').on('notes_normalized').columns(['id'])));

				queries.push('DROP TRIGGER IF EXISTS notes_fts_before_update');
				queries.push('DROP TRIGGER IF EXISTS notes_fts_before_delete');
				queries.push('DROP TRIGGER IF EXISTS notes_after_update');
				queries.push('DROP TRIGGER IF EXISTS notes_after_insert');
				queries.push(compileQuery(queryBuilder.schema.dropTable('notes_fts').ifExists()).sql);

				queries.push('CREATE VIRTUAL TABLE notes_fts USING fts4(content="notes_normalized", notindexed="id", id, title, body)');

				// Keep the content tables (notes) and the FTS table (notes_fts) in sync.
				// More info at https://www.sqlite.org/fts3.html#_external_content_fts4_tables_
				queries.push(`
					CREATE TRIGGER notes_fts_before_update BEFORE UPDATE ON notes_normalized BEGIN
						DELETE FROM notes_fts WHERE docid=old.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_fts_before_delete BEFORE DELETE ON notes_normalized BEGIN
						DELETE FROM notes_fts WHERE docid=old.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_after_update AFTER UPDATE ON notes_normalized BEGIN
						INSERT INTO notes_fts(docid, id, title, body) SELECT rowid, id, title, body FROM notes_normalized WHERE new.rowid = notes_normalized.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_after_insert AFTER INSERT ON notes_normalized BEGIN
						INSERT INTO notes_fts(docid, id, title, body) SELECT rowid, id, title, body FROM notes_normalized WHERE new.rowid = notes_normalized.rowid;
					END;`);
			}

			if (targetVersion === 19) {
				const newTableSql = compileQuery(
					queryBuilder.schema
						.createTable('revisions')
						.addColumn('id', sql.raw('TEXT'), (column) => column.primaryKey())
						.addColumn('parent_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('item_type', sql.raw('INT'), (column) => column.notNull())
						.addColumn('item_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('item_updated_time', sql.raw('INT'), (column) => column.notNull())
						.addColumn('title_diff', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('body_diff', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('metadata_diff', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('encryption_cipher_text', sql.raw('TEXT'), (column) =>
							column.notNull().defaultTo(sql.raw('""')),
						)
						.addColumn('encryption_applied', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull())
						.addColumn('created_time', sql.raw('INT'), (column) => column.notNull()),
				);
				queries.push(newTableSql);

				queries.push(compileQuery(queryBuilder.schema.createIndex('revisions_parent_id').on('revisions').columns(['parent_id'])));
				queries.push(compileQuery(queryBuilder.schema.createIndex('revisions_item_type').on('revisions').columns(['item_type'])));
				queries.push(compileQuery(queryBuilder.schema.createIndex('revisions_item_id').on('revisions').columns(['item_id'])));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('revisions_item_updated_time')
						.on('revisions')
						.columns(['item_updated_time']),
				));
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('revisions_updated_time').on('revisions').columns(['updated_time']),
				));

				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('item_changes')
						.addColumn('source', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('1'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('item_changes')
						.addColumn('before_change_item', sql.raw('TEXT'), (column) =>
							column.notNull().defaultTo(sql.raw('""')),
						),
				));
			}

			if (targetVersion === 20) {
				const newTableSql = compileQuery(
					queryBuilder.schema
						.createTable('migrations')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
						.addColumn('number', sql.raw('INTEGER'), (column) => column.notNull())
						.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull())
						.addColumn('created_time', sql.raw('INT'), (column) => column.notNull()),
				);
				queries.push(newTableSql);

				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('resources')
						.addColumn('size', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('-1'))),
				));
				queries.push(addMigrationFile(20));
			}

			if (targetVersion === 21) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('sync_items')
						.addColumn('item_location', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('1'))),
				));
			}

			if (targetVersion === 22) {
				const newTableSql = compileQuery(
					queryBuilder.schema
						.createTable('resources_to_download')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
						.addColumn('resource_id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull())
						.addColumn('created_time', sql.raw('INT'), (column) => column.notNull()),
				);
				queries.push(newTableSql);

				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('resources_to_download_resource_id')
						.on('resources_to_download')
						.columns(['resource_id']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('resources_to_download_updated_time')
						.on('resources_to_download')
						.columns(['updated_time']),
				));
			}

			if (targetVersion === 23) {
				const newTableSql = compileQuery(
					queryBuilder.schema
						.createTable('key_values')
						.addColumn('id', sql.raw('INTEGER'), (column) => column.primaryKey())
						.addColumn('key', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('value', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('type', sql.raw('INT'), (column) => column.notNull())
						.addColumn('updated_time', sql.raw('INT'), (column) => column.notNull()),
				);
				queries.push(newTableSql);

				queries.push(compileQuery(queryBuilder.schema.createIndex('key_values_key').unique().on('key_values').columns(['key'])));
			}

			if (targetVersion === 24) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('notes')
						.addColumn('markup_language', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('1'))),
				)); // 1: Markdown, 2: HTML
			}

			if (targetVersion === 25) {
				queries.push(compileQuery(
					queryBuilder.schema.createView('tags_with_note_count').as(
						queryBuilder
							.selectFrom('tags')
							.leftJoin('note_tags as nt', (join) =>
								join.on((eb) => eb(sql.ref('nt.tag_id'), '=', sql.ref('tags.id'))),
							)
							.leftJoin('notes', (join) => join.on((eb) => eb(sql.ref('notes.id'), '=', sql.ref('nt.note_id'))))
							.select([
								sql.ref('tags.id').as('id'),
								sql.ref('tags.title').as('title'),
								sql.ref('tags.created_time').as('created_time'),
								sql.ref('tags.updated_time').as('updated_time'),
								queryBuilder.fn('count', [sql.ref('notes.id')]).as('note_count'),
							])
							.where((eb) => eb(sql.ref('notes.id'), 'is not', sql.val(null)))
							.groupBy(['tags.id']),
					),
				));
			}

			if (targetVersion === 26) {
				const tableNames = ['notes', 'folders', 'tags', 'note_tags', 'resources'];
				for (let i = 0; i < tableNames.length; i++) {
					const n = tableNames[i];
					queries.push(compileQuery(
						queryBuilder.schema
							.alterTable(n)
							.addColumn('is_shared', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
					));
				}
			}

			if (targetVersion === 27) {
				queries.push(addMigrationFile(27));
			}

			if (targetVersion === 28) {
				queries.push(compileQuery(queryBuilder.schema.createIndex('resources_size').on('resources').columns(['size'])));
			}

			if (targetVersion === 29) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('version')
						.addColumn('table_fields_version', sql.raw('INT'), (column) =>
							column.notNull().defaultTo(sql.raw('0')),
						),
				));
			}

			if (targetVersion === 30) {
				// Change the type of the "order" field from INT to NUMERIC
				// Making it a float provides a much bigger range when inserting notes.
				// For example, with an INT, inserting a note C between note A with order 1000 and
				// note B with order 1001 wouldn't be possible without changing the order
				// value of note A or B. But with a float, we can set the order of note C to 1000.5
				queries = queries.concat(
					this.alterColumnQueries('notes', {
						id: 'TEXT PRIMARY KEY',
						parent_id: 'TEXT NOT NULL DEFAULT ""',
						title: 'TEXT NOT NULL DEFAULT ""',
						body: 'TEXT NOT NULL DEFAULT ""',
						created_time: 'INT NOT NULL',
						updated_time: 'INT NOT NULL',
						is_conflict: 'INT NOT NULL DEFAULT 0',
						latitude: 'NUMERIC NOT NULL DEFAULT 0',
						longitude: 'NUMERIC NOT NULL DEFAULT 0',
						altitude: 'NUMERIC NOT NULL DEFAULT 0',
						author: 'TEXT NOT NULL DEFAULT ""',
						source_url: 'TEXT NOT NULL DEFAULT ""',
						is_todo: 'INT NOT NULL DEFAULT 0',
						todo_due: 'INT NOT NULL DEFAULT 0',
						todo_completed: 'INT NOT NULL DEFAULT 0',
						source: 'TEXT NOT NULL DEFAULT ""',
						source_application: 'TEXT NOT NULL DEFAULT ""',
						application_data: 'TEXT NOT NULL DEFAULT ""',
						order: 'NUMERIC NOT NULL DEFAULT 0', // that's the change!
						user_created_time: 'INT NOT NULL DEFAULT 0',
						user_updated_time: 'INT NOT NULL DEFAULT 0',
						encryption_cipher_text: 'TEXT NOT NULL DEFAULT ""',
						encryption_applied: 'INT NOT NULL DEFAULT 0',
						markup_language: 'INT NOT NULL DEFAULT 1',
						is_shared: 'INT NOT NULL DEFAULT 0',
					}),
				);
			}

			if (targetVersion === 31) {
				// This empty version is due to the revert of the hierarchical tag feature
				// We need to keep the version for the users who have upgraded using
				// the pre-release
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('tags')
						.addColumn('parent_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
				// Drop the tag note count view, instead compute note count on the fly
				// queries.push(compileQuery(queryBuilder.schema.dropView('tags_with_note_count')).sql);
				// queries.push(addMigrationFile(31));
			}

			if (targetVersion === 32) {
				// This is the same as version 25 - this is to complete the
				// revert of the hierarchical tag feature.
				queries.push(compileQuery(
					queryBuilder.schema
						.createView('tags_with_note_count')
						.ifNotExists()
						.as(
							queryBuilder
								.selectFrom('tags')
								.leftJoin('note_tags as nt', (join) =>
									join.on((eb) => eb(sql.ref('nt.tag_id'), '=', sql.ref('tags.id'))),
								)
								.leftJoin('notes', (join) =>
									join.on((eb) => eb(sql.ref('notes.id'), '=', sql.ref('nt.note_id'))),
								)
								.select([
									sql.ref('tags.id').as('id'),
									sql.ref('tags.title').as('title'),
									sql.ref('tags.created_time').as('created_time'),
									sql.ref('tags.updated_time').as('updated_time'),
									queryBuilder.fn('count', [sql.ref('notes.id')]).as('note_count'),
								])
								.where((eb) => eb(sql.ref('notes.id'), 'is not', sql.val(null)))
								.groupBy(['tags.id']),
						),
				));
			}

			if (targetVersion === 33) {
				queries.push('DROP TRIGGER notes_fts_before_update');
				queries.push('DROP TRIGGER notes_fts_before_delete');
				queries.push('DROP TRIGGER notes_after_update');
				queries.push('DROP TRIGGER notes_after_insert');

				queries.push(compileQuery(queryBuilder.schema.dropIndex('notes_normalized_id')).sql);
				queries.push(compileQuery(queryBuilder.schema.dropTable('notes_normalized')).sql);
				queries.push(compileQuery(queryBuilder.schema.dropTable('notes_fts')).sql);


				const notesNormalized = compileQuery(
					queryBuilder.schema
						.createTable('notes_normalized')
						.addColumn('id', sql.raw('TEXT'), (column) => column.notNull())
						.addColumn('title', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('body', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('user_created_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('user_updated_time', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('is_todo', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('todo_completed', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('parent_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""')))
						.addColumn('latitude', sql.raw('NUMERIC'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('longitude', sql.raw('NUMERIC'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('altitude', sql.raw('NUMERIC'), (column) => column.notNull().defaultTo(sql.raw('0')))
						.addColumn('source_url', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				);

				queries.push(notesNormalized);

				queries.push(compileQuery(queryBuilder.schema.createIndex('notes_normalized_id').on('notes_normalized').columns(['id'])));

				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('notes_normalized_user_created_time')
						.on('notes_normalized')
						.columns(['user_created_time']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('notes_normalized_user_updated_time')
						.on('notes_normalized')
						.columns(['user_updated_time']),
				));
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('notes_normalized_is_todo').on('notes_normalized').columns(['is_todo']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('notes_normalized_todo_completed')
						.on('notes_normalized')
						.columns(['todo_completed']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('notes_normalized_parent_id')
						.on('notes_normalized')
						.columns(['parent_id']),
				));
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('notes_normalized_latitude').on('notes_normalized').columns(['latitude']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('notes_normalized_longitude')
						.on('notes_normalized')
						.columns(['longitude']),
				));
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('notes_normalized_altitude').on('notes_normalized').columns(['altitude']),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.createIndex('notes_normalized_source_url')
						.on('notes_normalized')
						.columns(['source_url']),
				));

				const tableFields = 'id, title, body, user_created_time, user_updated_time, is_todo, todo_completed, parent_id, latitude, longitude, altitude, source_url';


				const newVirtualTableSql = `
					CREATE VIRTUAL TABLE notes_fts USING fts4(
						content="notes_normalized",
						notindexed="id",
						notindexed="user_created_time",
						notindexed="user_updated_time",
						notindexed="is_todo",
						notindexed="todo_completed",
						notindexed="parent_id",
						notindexed="latitude",
						notindexed="longitude",
						notindexed="altitude",
						notindexed="source_url",
						${tableFields}
					);`
				;

				queries.push(sqlStringToLines(newVirtualTableSql)[0]);

				queries.push(`
					CREATE TRIGGER notes_fts_before_update BEFORE UPDATE ON notes_normalized BEGIN
						DELETE FROM notes_fts WHERE docid=old.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_fts_before_delete BEFORE DELETE ON notes_normalized BEGIN
						DELETE FROM notes_fts WHERE docid=old.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_after_update AFTER UPDATE ON notes_normalized BEGIN
						INSERT INTO notes_fts(docid, ${tableFields}) SELECT rowid, ${tableFields} FROM notes_normalized WHERE new.rowid = notes_normalized.rowid;
					END;`);
				queries.push(`
					CREATE TRIGGER notes_after_insert AFTER INSERT ON notes_normalized BEGIN
						INSERT INTO notes_fts(docid, ${tableFields}) SELECT rowid, ${tableFields} FROM notes_normalized WHERE new.rowid = notes_normalized.rowid;
					END;`);
				queries.push(addMigrationFile(33));
			}

			if (targetVersion === 34) {
				queries.push('CREATE VIRTUAL TABLE search_aux USING fts4aux(notes_fts)');
				queries.push('CREATE VIRTUAL TABLE notes_spellfix USING spellfix1');
			}

			if (targetVersion === 35) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('notes_normalized')
						.addColumn('todo_due', sql.raw('INT'), (column) => column.notNull().defaultTo(sql.raw('0'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema.createIndex('notes_normalized_todo_due').on('notes_normalized').columns(['todo_due']),
				));
				queries.push(addMigrationFile(35));
			}

			if (targetVersion === 36) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('folders')
						.addColumn('share_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('notes')
						.addColumn('share_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('resources')
						.addColumn('share_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
			}

			if (targetVersion === 38) {
				queries.push(compileQuery(queryBuilder.schema.dropView('tags_with_note_count')).sql);
				queries.push(compileQuery(
					queryBuilder.schema.createView('tags_with_note_count').as(
						queryBuilder
							.selectFrom('tags')
							.leftJoin('note_tags as nt', (join) =>
								join.on((eb) => eb(sql.ref('nt.tag_id'), '=', sql.ref('tags.id'))),
							)
							.leftJoin('notes', (join) => join.on((eb) => eb(sql.ref('notes.id'), '=', sql.ref('nt.note_id'))))
							.select([
								sql.ref('tags.id').as('id'),
								sql.ref('tags.title').as('title'),
								sql.ref('tags.created_time').as('created_time'),
								sql.ref('tags.updated_time').as('updated_time'),
								queryBuilder.fn('count', [sql.ref('notes.id')]).as('note_count'),
								queryBuilder
									.fn('sum', [
										queryBuilder
											.case()
											.when(sql.ref('notes.todo_completed'), '>', sql.val(0))
											// eslint-disable-next-line promise/prefer-await-to-then -- Kysely CASE expression, not a Promise
											.then(sql.val(1))
											.else(sql.val(0))
											.end(),
									])
									.as('todo_completed_count'),
							])
							.where((eb) => eb(sql.ref('notes.id'), 'is not', sql.val(null)))
							.groupBy(['tags.id']),
					),
				));
			}

			if (targetVersion === 39) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('notes')
						.addColumn('conflict_original_id', sql.raw('TEXT'), (column) =>
							column.notNull().defaultTo(sql.raw('""')),
						),
				));
			}

			if (targetVersion === 40) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('folders')
						.addColumn('master_key_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('notes')
						.addColumn('master_key_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('resources')
						.addColumn('master_key_id', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
			}

			if (targetVersion === 41) {
				queries.push(compileQuery(
					queryBuilder.schema
						.alterTable('folders')
						.addColumn('icon', sql.raw('TEXT'), (column) => column.notNull().defaultTo(sql.raw('""'))),
				));
			}

			if (targetVersion > 41) {
				const migration = migrations[targetVersion - 42];
				if (!migration) throw new Error(`No such migration: ${targetVersion}`);
				const migrationQueries = migration();
				queries = queries.concat(migrationQueries);
			}

			const updateVersionQuery = compileQuery(queryBuilder.updateTable('version').set({ 'version': sql.val(targetVersion) }));

			queries.push(updateVersionQuery);

			try {
				await this.transactionExecBatch(queries);
			} catch (error) {
				// In some cases listed below, when the upgrade fail it is acceptable (a fallback will be used)
				// and in those cases, even though it fails, we still want to set the version number so that the
				// migration is not repeated on next upgrade.
				let saveVersionAgain = false;

				if (targetVersion === 15 || targetVersion === 18 || targetVersion === 33) {
					this.logger().warn('Could not upgrade to database v15 or v18 or v33 - FTS feature will not be used', error);
					saveVersionAgain = true;
				} else if (targetVersion === 34) {
					// if (!shim.isTestingEnv()) this.logger().warn('Could not upgrade to database v34 - fuzzy search will not be used', error);
					saveVersionAgain = true;
				} else {
					throw error;
				}

				if (saveVersionAgain) {
					this.logger().info('Migration failed with fallback and will not be repeated - saving version number');
					await this.transactionExecBatch([updateVersionQuery]);
				}
			}

			latestVersion = targetVersion;

			currentVersionIndex++;
		}

		return latestVersion;
	}

	public async ftsEnabled() {
		try {
			await this.selectOne(compileQuery(queryBuilder.selectFrom('notes_fts').select([queryBuilder.fn.countAll().as('count(*)')])));
		} catch (error) {
			this.logger().warn('FTS check failed', error);
			return false;
		}

		this.logger().info('FTS check succeeded');

		return true;
	}

	public async fuzzySearchEnabled() {
		try {
			await this.selectOne(compileQuery(queryBuilder.selectFrom('notes_spellfix').select([queryBuilder.fn.countAll().as('count(*)')])));
		} catch (error) {
			this.logger().warn('Fuzzy search check failed', error);
			return false;
		}
		this.logger().info('Fuzzy search check succeeded');
		return true;
	}

	public version() {
		return this.version_;
	}

	public async initialize() {
		this.logger().info('Checking for database schema update...');

		let versionRow = null;
		try {
			// Will throw if the database has not been created yet, but this is handled below
			versionRow = await this.selectOne(compileQuery(queryBuilder.selectFrom('version').selectAll().limit(1)));
		} catch (error) {
			if (error.message && error.message.indexOf('no such table: version') >= 0) {
				// Ignore
			} else {
				this.logger().info(error);
			}
		}

		const version = !versionRow ? 0 : versionRow.version;
		const tableFieldsVersion = !versionRow ? 0 : versionRow.table_fields_version;
		this.version_ = version;
		this.logger().info('Current database version', versionRow);

		const newVersion = await this.upgradeDatabase(version);
		this.version_ = newVersion;

		this.logger().info(`New version: ${newVersion}. Previously recorded version: ${tableFieldsVersion}`);

		if (newVersion !== tableFieldsVersion) await this.refreshTableFields(newVersion);

		this.tableFields_ = {};

		const rows = await this.selectAll(compileQuery(queryBuilder.selectFrom('table_fields').selectAll()));

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (!this.tableFields_[row.table_name]) this.tableFields_[row.table_name] = [];
			this.tableFields_[row.table_name].push({
				name: row.field_name,
				type: row.field_type,
				default: Database.formatValue(row.field_type, row.field_default),
			});
		}
	}
}
