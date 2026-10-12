import Resource from './models/Resource';
import shim from './shim';
import Database, { Row } from './database';
import { StringOrSqlQuery } from './services/database/types';
import addMigrationFile from './services/database/addMigrationFile';
import { db, compile } from './services/database/kysely';
import { addColumn, createTable, createTrigger, dropTrigger, ftsTable, ftsAuxTable, spellfixTable, tableInfo } from './services/database/sqlite';
import migrations from './services/database/migrations';

const { sprintf } = require('sprintf-js');

const initialSchema = () => [
	createTable('folders', {
		id: 'TEXT PRIMARY KEY',
		title: 'TEXT NOT NULL DEFAULT ""',
		created_time: 'INT NOT NULL',
		updated_time: 'INT NOT NULL',
	}),
	db.schema.createIndex('folders_title').on('folders').column('title'),
	db.schema.createIndex('folders_updated_time').on('folders').column('updated_time'),
	createTable('notes', {
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
		order: 'INT NOT NULL DEFAULT 0',
	}),
	db.schema.createIndex('notes_title').on('notes').column('title'),
	db.schema.createIndex('notes_updated_time').on('notes').column('updated_time'),
	db.schema.createIndex('notes_is_conflict').on('notes').column('is_conflict'),
	db.schema.createIndex('notes_is_todo').on('notes').column('is_todo'),
	db.schema.createIndex('notes_order').on('notes').column('order'),
	createTable('tags', {
		id: 'TEXT PRIMARY KEY',
		title: 'TEXT NOT NULL DEFAULT ""',
		created_time: 'INT NOT NULL',
		updated_time: 'INT NOT NULL',
	}),
	db.schema.createIndex('tags_title').on('tags').column('title'),
	db.schema.createIndex('tags_updated_time').on('tags').column('updated_time'),
	createTable('note_tags', {
		id: 'TEXT PRIMARY KEY',
		note_id: 'TEXT NOT NULL',
		tag_id: 'TEXT NOT NULL',
		created_time: 'INT NOT NULL',
		updated_time: 'INT NOT NULL',
	}),
	db.schema.createIndex('note_tags_note_id').on('note_tags').column('note_id'),
	db.schema.createIndex('note_tags_tag_id').on('note_tags').column('tag_id'),
	db.schema.createIndex('note_tags_updated_time').on('note_tags').column('updated_time'),
	createTable('resources', {
		id: 'TEXT PRIMARY KEY',
		title: 'TEXT NOT NULL DEFAULT ""',
		mime: 'TEXT NOT NULL',
		filename: 'TEXT NOT NULL DEFAULT ""',
		created_time: 'INT NOT NULL',
		updated_time: 'INT NOT NULL',
	}),
	db.schema.createIndex('resources_title').on('resources').column('title'),
	db.schema.createIndex('resources_updated_time').on('resources').column('updated_time'),
	createTable('settings', {
		key: 'TEXT PRIMARY KEY',
		value: 'TEXT',
		type: 'INT NOT NULL',
	}),
	createTable('table_fields', {
		id: 'INTEGER PRIMARY KEY',
		table_name: 'TEXT NOT NULL',
		field_name: 'TEXT NOT NULL',
		field_type: 'INT NOT NULL',
		field_default: 'TEXT',
	}),
	createTable('sync_items', {
		id: 'INTEGER PRIMARY KEY',
		sync_target: 'INT NOT NULL',
		sync_time: 'INT NOT NULL DEFAULT 0',
		item_type: 'INT NOT NULL',
		item_id: 'TEXT NOT NULL',
	}),
	db.schema.createIndex('sync_items_sync_time').on('sync_items').column('sync_time'),
	db.schema.createIndex('sync_items_sync_target').on('sync_items').column('sync_target'),
	db.schema.createIndex('sync_items_item_type').on('sync_items').column('item_type'),
	db.schema.createIndex('sync_items_item_id').on('sync_items').column('item_id'),
	createTable('deleted_items', {
		id: 'INTEGER PRIMARY KEY',
		item_type: 'INT NOT NULL',
		item_id: 'TEXT NOT NULL',
		deleted_time: 'INT NOT NULL',
	}),
	createTable('version', {
		version: 'INT NOT NULL',
	}),
	db.insertInto('version').values({ version: 1 }),
];

// Trigger bodies cannot use bound parameters. These fixed historical constants
// are emitted as literals; ordinary data writes retain bound parameters.
function noteFtsTriggers(table: string, fields: string[], excludeEncrypted = false) {
	const remove = db.deleteFrom('notes_fts').whereRef('docid', '=', 'old.rowid');
	let content = db.selectFrom(table).select(['rowid as docid', ...fields]).whereRef('new.rowid', '=', `${table}.rowid`);
	if (excludeEncrypted) {
		content = content.where(eb => eb.and([
			eb('is_conflict', '=', eb.lit(0)),
			eb('encryption_applied', '=', eb.lit(0)),
		]));
	}
	const insert = db.insertInto('notes_fts').columns(['docid', ...fields]).expression(content);
	return [
		createTrigger('notes_fts_before_update', 'before', 'update', table, [remove]),
		createTrigger('notes_fts_before_delete', 'before', 'delete', table, [remove]),
		createTrigger('notes_after_update', 'after', 'update', table, [insert]),
		createTrigger('notes_after_insert', 'after', 'insert', table, [insert]),
	];
}

function tagCountQuery(includeCompleted: boolean) {
	let query = db.selectFrom('tags')
		.leftJoin('note_tags as nt', 'nt.tag_id', 'tags.id')
		.leftJoin('notes', 'notes.id', 'nt.note_id')
		.select(['tags.id as id', 'tags.title as title', 'tags.created_time as created_time', 'tags.updated_time as updated_time'])
		.select(eb => eb.fn.count('notes.id').as('note_count'))
		.where('notes.id', 'is not', null)
		.groupBy('tags.id');
	if (includeCompleted) {
		query = query.select(eb => eb.fn.sum(eb.case()
			// eslint-disable-next-line promise/prefer-await-to-then -- Kysely CASE builder method, not a promise.
			.when('notes.todo_completed', '>', eb.lit(0)).then(eb.lit(1)).else(eb.lit(0)).end()).as('todo_completed_count'));
	}
	return query;
}

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
			queries.push(db.deleteFrom(n));
			queries.push(db.deleteFrom('sqlite_sequence').where('name', '=', n)); // Reset autoincremented IDs
		}

		queries.push(db.deleteFrom('settings').where('key', '=', 'sync.1.context'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'sync.2.context'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'sync.3.context'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'sync.4.context'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'sync.5.context'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'sync.6.context'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'sync.7.context'));

		queries.push(db.deleteFrom('settings').where('key', '=', 'revisionService.lastProcessedChangeId'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'resourceService.lastProcessedChangeId'));
		queries.push(db.deleteFrom('settings').where('key', '=', 'searchEngine.lastProcessedChangeId'));

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
		const pragmas = await this.selectAll(tableInfo(tableName));
		if (!pragmas) throw new Error(`No such table: ${tableName}`);
		return pragmas.length;
	}

	public async refreshTableFields(newVersion: number) {
		this.logger().info('Initializing tables...');
		const queries: StringOrSqlQuery[] = [];
		queries.push(db.deleteFrom('table_fields'));

		const countFieldsNotesFts = await this.countFields('notes_fts');
		const countFieldsItemsFts = await this.countFields('items_fts');
		if (countFieldsNotesFts !== countFieldsItemsFts) {
			throw new Error(`\`notes_fts\` (${countFieldsNotesFts} fields) must have the same number of fields as \`items_fts\` (${countFieldsItemsFts} fields) for the search engine BM25 algorithm to work`);
		}

		interface TableRow {
			name: string;
		}

		const tableRows: TableRow[] = await this.selectAll(db.selectFrom('sqlite_master').select('name').where('type', '=', 'table'));

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

				pragmas = await this.selectAll(tableInfo(tableName));

				for (let i = 0; i < pragmas.length; i++) {
					const item = pragmas[i];
					// In SQLite, if the default value is a string it has double quotes around it, so remove them here
					let defaultValue = item.dflt_value;
					if (typeof defaultValue === 'string' && defaultValue.length >= 2 && defaultValue[0] === '"' && defaultValue[defaultValue.length - 1] === '"') {
						defaultValue = defaultValue.substr(1, defaultValue.length - 2);
					}
					const q = db.insertInto('table_fields').values({
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

		queries.push(db.updateTable('version').set({ table_fields_version: newVersion }));
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

			let queries: StringOrSqlQuery[] = [];

			if (targetVersion === 1) {
				queries = initialSchema();
			}

			if (targetVersion === 2) {
				const newTable = createTable('deleted_items', {
					id: 'INTEGER PRIMARY KEY',
					item_type: 'INT NOT NULL',
					item_id: 'TEXT NOT NULL',
					deleted_time: 'INT NOT NULL',
					sync_target: 'INT NOT NULL',
				});

				queries.push(db.schema.dropTable('deleted_items'));
				queries.push(newTable);
				queries.push(db.schema.createIndex('deleted_items_sync_target').on('deleted_items').column('sync_target'));
			}

			if (targetVersion === 3) {
				queries = this.alterColumnQueries('settings', { key: 'TEXT PRIMARY KEY', value: 'TEXT' });
			}

			if (targetVersion === 4) {
				queries.push(db.insertInto('settings').values({
					key: 'sync.3.context',
					value: db.selectFrom('settings').select('value').where('key', '=', 'sync.context'),
				}));
				queries.push(db.deleteFrom('settings').where('key', '=', 'sync.context'));
			}

			if (targetVersion === 5) {
				const tableNames = ['notes', 'folders', 'tags', 'note_tags', 'resources'];
				for (let i = 0; i < tableNames.length; i++) {
					const n = tableNames[i];
					queries.push(addColumn(n, 'user_created_time', 'INT NOT NULL DEFAULT 0'));
					queries.push(addColumn(n, 'user_updated_time', 'INT NOT NULL DEFAULT 0'));
					queries.push(db.updateTable(n).set(eb => ({ user_created_time: eb.ref('created_time') })));
					queries.push(db.updateTable(n).set(eb => ({ user_updated_time: eb.ref('updated_time') })));
					queries.push(db.schema.createIndex(`${n}_user_updated_time`).on(n).column('user_updated_time'));
				}
			}

			if (targetVersion === 6) {
				queries.push(createTable('alarms', {
					id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
					note_id: 'TEXT NOT NULL',
					trigger_time: 'INT NOT NULL',
				}));
				queries.push(db.schema.createIndex('alarm_note_id').on('alarms').column('note_id'));
			}

			if (targetVersion === 7) {
				queries.push(addColumn('resources', 'file_extension', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion === 8) {
				queries.push(addColumn('sync_items', 'sync_disabled', 'INT NOT NULL DEFAULT "0"'));
				queries.push(addColumn('sync_items', 'sync_disabled_reason', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion === 9) {
				const newTable = createTable('master_keys', {
					id: 'TEXT PRIMARY KEY',
					created_time: 'INT NOT NULL',
					updated_time: 'INT NOT NULL',
					source_application: 'TEXT NOT NULL',
					encryption_method: 'INT NOT NULL',
					checksum: 'TEXT NOT NULL',
					content: 'TEXT NOT NULL',
				});
				queries.push(newTable);
				const tableNames = ['notes', 'folders', 'tags', 'note_tags', 'resources'];
				for (let i = 0; i < tableNames.length; i++) {
					const n = tableNames[i];
					queries.push(addColumn(n, 'encryption_cipher_text', 'TEXT NOT NULL DEFAULT ""'));
					queries.push(addColumn(n, 'encryption_applied', 'INT NOT NULL DEFAULT 0'));
					queries.push(db.schema.createIndex(`${n}_encryption_applied`).on(n).column('encryption_applied'));
				}

				queries.push(addColumn('sync_items', 'force_sync', 'INT NOT NULL DEFAULT 0'));
				queries.push(addColumn('resources', 'encryption_blob_encrypted', 'INT NOT NULL DEFAULT 0'));
			}

			const upgradeVersion10 = () => {
				const itemChangesTable = createTable('item_changes', {
					id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
					item_type: 'INT NOT NULL',
					item_id: 'TEXT NOT NULL',
					type: 'INT NOT NULL',
					created_time: 'INT NOT NULL',
				});

				const noteResourcesTable = createTable('note_resources', {
					id: 'INTEGER PRIMARY KEY',
					note_id: 'TEXT NOT NULL',
					resource_id: 'TEXT NOT NULL',
					is_associated: 'INT NOT NULL',
					last_seen_time: 'INT NOT NULL',
				});

				queries.push(itemChangesTable);
				queries.push(db.schema.createIndex('item_changes_item_id').on('item_changes').column('item_id'));
				queries.push(db.schema.createIndex('item_changes_created_time').on('item_changes').column('created_time'));
				queries.push(db.schema.createIndex('item_changes_item_type').on('item_changes').column('item_type'));

				queries.push(noteResourcesTable);
				queries.push(db.schema.createIndex('note_resources_note_id').on('note_resources').column('note_id'));
				queries.push(db.schema.createIndex('note_resources_resource_id').on('note_resources').column('resource_id'));

				queries.push(db.insertInto('item_changes').columns(['item_type', 'item_id', 'type', 'created_time'])
					.expression(db.selectFrom('notes').select(eb => [eb.lit(1).as('item_type'), 'id', eb.lit(1).as('type'), eb.val(Date.now()).as('created_time')])));
			};

			if (targetVersion === 10) {
				upgradeVersion10();
			}

			if (targetVersion === 11) {
				// This trick was needed because Electron Builder incorrectly released a dev branch containing v10 as it was
				// still being developed, and the db schema was not final at that time. So this v11 was created to
				// make sure any invalid db schema that was accidentally created was deleted and recreated.
				queries.push(db.schema.dropTable('item_changes'));
				queries.push(db.schema.dropTable('note_resources'));
				upgradeVersion10();
			}

			if (targetVersion === 12) {
				queries.push(addColumn('folders', 'parent_id', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion === 13) {
				queries.push(addColumn('resources', 'fetch_status', 'INT NOT NULL DEFAULT "2"'));
				queries.push(addColumn('resources', 'fetch_error', 'TEXT NOT NULL DEFAULT ""'));
				queries.push(db.updateTable('resources').set({ fetch_status: Resource.FETCH_STATUS_DONE }));
			}

			if (targetVersion === 14) {
				const resourceLocalStates = createTable('resource_local_states', {
					id: 'INTEGER PRIMARY KEY',
					resource_id: 'TEXT NOT NULL',
					fetch_status: 'INT NOT NULL DEFAULT "2"',
					fetch_error: 'TEXT NOT NULL DEFAULT ""',
				});

				queries.push(resourceLocalStates);

				queries.push(db.insertInto('resource_local_states').columns(['id', 'resource_id', 'fetch_status', 'fetch_error'])
					.expression(db.selectFrom('resources').select(eb => [eb.lit(null).as('id'), 'id as resource_id', 'fetch_status', 'fetch_error'])));

				queries.push(db.schema.createIndex('resource_local_states_resource_id').on('resource_local_states').column('resource_id'));
				queries.push(db.schema.createIndex('resource_local_states_resource_fetch_status').on('resource_local_states').column('fetch_status'));

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
				queries.push(ftsTable('notes_fts', 'notes', ['id', 'title', 'body'], ['id']));
				queries.push(db.insertInto('notes_fts').columns(['docid', 'id', 'title', 'body'])
					.expression(db.selectFrom('notes').select(['rowid as docid', 'id', 'title', 'body']).where('is_conflict', '=', 0).where('encryption_applied', '=', 0)));

				// Keep the content table and its FTS index in sync.
				// More info at https://www.sqlite.org/fts3.html#_external_content_fts4_tables_
				queries.push(...noteFtsTriggers('notes', ['id', 'title', 'body'], true));
			}

			if (targetVersion === 18) {
				const notesNormalized = createTable('notes_normalized', {
					id: 'TEXT NOT NULL',
					title: 'TEXT NOT NULL DEFAULT ""',
					body: 'TEXT NOT NULL DEFAULT ""',
				});

				queries.push(notesNormalized);

				queries.push(db.schema.createIndex('notes_normalized_id').on('notes_normalized').column('id'));

				queries.push(dropTrigger('notes_fts_before_update'));
				queries.push(dropTrigger('notes_fts_before_delete'));
				queries.push(dropTrigger('notes_after_update'));
				queries.push(dropTrigger('notes_after_insert'));
				queries.push(db.schema.dropTable('notes_fts').ifExists());

				queries.push(ftsTable('notes_fts', 'notes_normalized', ['id', 'title', 'body'], ['id']));

				// Keep the content table and its FTS index in sync.
				// More info at https://www.sqlite.org/fts3.html#_external_content_fts4_tables_
				queries.push(...noteFtsTriggers('notes_normalized', ['id', 'title', 'body']));
			}

			if (targetVersion === 19) {
				const newTable = createTable('revisions', {
					id: 'TEXT PRIMARY KEY',
					parent_id: 'TEXT NOT NULL DEFAULT ""',
					item_type: 'INT NOT NULL',
					item_id: 'TEXT NOT NULL',
					item_updated_time: 'INT NOT NULL',
					title_diff: 'TEXT NOT NULL DEFAULT ""',
					body_diff: 'TEXT NOT NULL DEFAULT ""',
					metadata_diff: 'TEXT NOT NULL DEFAULT ""',
					encryption_cipher_text: 'TEXT NOT NULL DEFAULT ""',
					encryption_applied: 'INT NOT NULL DEFAULT 0',
					updated_time: 'INT NOT NULL',
					created_time: 'INT NOT NULL',
				});
				queries.push(newTable);

				queries.push(db.schema.createIndex('revisions_parent_id').on('revisions').column('parent_id'));
				queries.push(db.schema.createIndex('revisions_item_type').on('revisions').column('item_type'));
				queries.push(db.schema.createIndex('revisions_item_id').on('revisions').column('item_id'));
				queries.push(db.schema.createIndex('revisions_item_updated_time').on('revisions').column('item_updated_time'));
				queries.push(db.schema.createIndex('revisions_updated_time').on('revisions').column('updated_time'));

				queries.push(addColumn('item_changes', 'source', 'INT NOT NULL DEFAULT 1'));
				queries.push(addColumn('item_changes', 'before_change_item', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion === 20) {
				const newTable = createTable('migrations', {
					id: 'INTEGER PRIMARY KEY',
					number: 'INTEGER NOT NULL',
					updated_time: 'INT NOT NULL',
					created_time: 'INT NOT NULL',
				});
				queries.push(newTable);

				queries.push(addColumn('resources', 'size', 'INT NOT NULL DEFAULT -1'));
				queries.push(addMigrationFile(20));
			}

			if (targetVersion === 21) {
				queries.push(addColumn('sync_items', 'item_location', 'INT NOT NULL DEFAULT 1'));
			}

			if (targetVersion === 22) {
				const newTable = createTable('resources_to_download', {
					id: 'INTEGER PRIMARY KEY',
					resource_id: 'TEXT NOT NULL',
					updated_time: 'INT NOT NULL',
					created_time: 'INT NOT NULL',
				});
				queries.push(newTable);

				queries.push(db.schema.createIndex('resources_to_download_resource_id').on('resources_to_download').column('resource_id'));
				queries.push(db.schema.createIndex('resources_to_download_updated_time').on('resources_to_download').column('updated_time'));
			}

			if (targetVersion === 23) {
				const newTable = createTable('key_values', {
					id: 'INTEGER PRIMARY KEY',
					key: 'TEXT NOT NULL',
					value: 'TEXT NOT NULL',
					type: 'INT NOT NULL',
					updated_time: 'INT NOT NULL',
				});
				queries.push(newTable);

				queries.push(db.schema.createIndex('key_values_key').unique().on('key_values').column('key'));
			}

			if (targetVersion === 24) {
				queries.push(addColumn('notes', 'markup_language', 'INT NOT NULL DEFAULT 1')); // 1: Markdown, 2: HTML
			}

			if (targetVersion === 25) {
				queries.push(db.schema.createView('tags_with_note_count').as(tagCountQuery(false)));
			}

			if (targetVersion === 26) {
				const tableNames = ['notes', 'folders', 'tags', 'note_tags', 'resources'];
				for (let i = 0; i < tableNames.length; i++) {
					const n = tableNames[i];
					queries.push(addColumn(n, 'is_shared', 'INT NOT NULL DEFAULT 0'));
				}
			}

			if (targetVersion === 27) {
				queries.push(addMigrationFile(27));
			}

			if (targetVersion === 28) {
				queries.push(db.schema.createIndex('resources_size').on('resources').column('size'));
			}

			if (targetVersion === 29) {
				queries.push(addColumn('version', 'table_fields_version', 'INT NOT NULL DEFAULT 0'));
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
				queries.push(addColumn('tags', 'parent_id', 'TEXT NOT NULL DEFAULT ""'));
				// Drop the tag note count view, instead compute note count on the fly
				// queries.push(db.schema.dropView('tags_with_note_count'));
				// queries.push(addMigrationFile(31));
			}

			if (targetVersion === 32) {
				// This is the same as version 25 - this is to complete the
				// revert of the hierarchical tag feature.
				queries.push(db.schema.createView('tags_with_note_count').ifNotExists().as(tagCountQuery(false)));
			}

			if (targetVersion === 33) {
				queries.push(dropTrigger('notes_fts_before_update', false));
				queries.push(dropTrigger('notes_fts_before_delete', false));
				queries.push(dropTrigger('notes_after_update', false));
				queries.push(dropTrigger('notes_after_insert', false));

				queries.push(db.schema.dropIndex('notes_normalized_id'));
				queries.push(db.schema.dropTable('notes_normalized'));
				queries.push(db.schema.dropTable('notes_fts'));


				const notesNormalized = createTable('notes_normalized', {
					id: 'TEXT NOT NULL',
					title: 'TEXT NOT NULL DEFAULT ""',
					body: 'TEXT NOT NULL DEFAULT ""',
					user_created_time: 'INT NOT NULL DEFAULT 0',
					user_updated_time: 'INT NOT NULL DEFAULT 0',
					is_todo: 'INT NOT NULL DEFAULT 0',
					todo_completed: 'INT NOT NULL DEFAULT 0',
					parent_id: 'TEXT NOT NULL DEFAULT ""',
					latitude: 'NUMERIC NOT NULL DEFAULT 0',
					longitude: 'NUMERIC NOT NULL DEFAULT 0',
					altitude: 'NUMERIC NOT NULL DEFAULT 0',
					source_url: 'TEXT NOT NULL DEFAULT ""',
				});

				queries.push(notesNormalized);

				queries.push(db.schema.createIndex('notes_normalized_id').on('notes_normalized').column('id'));

				queries.push(db.schema.createIndex('notes_normalized_user_created_time').on('notes_normalized').column('user_created_time'));
				queries.push(db.schema.createIndex('notes_normalized_user_updated_time').on('notes_normalized').column('user_updated_time'));
				queries.push(db.schema.createIndex('notes_normalized_is_todo').on('notes_normalized').column('is_todo'));
				queries.push(db.schema.createIndex('notes_normalized_todo_completed').on('notes_normalized').column('todo_completed'));
				queries.push(db.schema.createIndex('notes_normalized_parent_id').on('notes_normalized').column('parent_id'));
				queries.push(db.schema.createIndex('notes_normalized_latitude').on('notes_normalized').column('latitude'));
				queries.push(db.schema.createIndex('notes_normalized_longitude').on('notes_normalized').column('longitude'));
				queries.push(db.schema.createIndex('notes_normalized_altitude').on('notes_normalized').column('altitude'));
				queries.push(db.schema.createIndex('notes_normalized_source_url').on('notes_normalized').column('source_url'));

				const tableFields = ['id', 'title', 'body', 'user_created_time', 'user_updated_time', 'is_todo', 'todo_completed', 'parent_id', 'latitude', 'longitude', 'altitude', 'source_url'];

				const newVirtualTable = ftsTable('notes_fts', 'notes_normalized', tableFields, tableFields.filter(field => field !== 'title' && field !== 'body'));

				queries.push(newVirtualTable);
				queries.push(...noteFtsTriggers('notes_normalized', tableFields));
				queries.push(addMigrationFile(33));
			}

			if (targetVersion === 34) {
				queries.push(ftsAuxTable('search_aux', 'notes_fts'));
				queries.push(spellfixTable('notes_spellfix'));
			}

			if (targetVersion === 35) {
				queries.push(addColumn('notes_normalized', 'todo_due', 'INT NOT NULL DEFAULT 0'));
				queries.push(db.schema.createIndex('notes_normalized_todo_due').on('notes_normalized').column('todo_due'));
				queries.push(addMigrationFile(35));
			}

			if (targetVersion === 36) {
				queries.push(addColumn('folders', 'share_id', 'TEXT NOT NULL DEFAULT ""'));
				queries.push(addColumn('notes', 'share_id', 'TEXT NOT NULL DEFAULT ""'));
				queries.push(addColumn('resources', 'share_id', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion === 38) {
				queries.push(db.schema.dropView('tags_with_note_count'));
				queries.push(db.schema.createView('tags_with_note_count').as(tagCountQuery(true)));
			}

			if (targetVersion === 39) {
				queries.push(addColumn('notes', 'conflict_original_id', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion === 40) {
				queries.push(addColumn('folders', 'master_key_id', 'TEXT NOT NULL DEFAULT ""'));
				queries.push(addColumn('notes', 'master_key_id', 'TEXT NOT NULL DEFAULT ""'));
				queries.push(addColumn('resources', 'master_key_id', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion === 41) {
				queries.push(addColumn('folders', 'icon', 'TEXT NOT NULL DEFAULT ""'));
			}

			if (targetVersion > 41) {
				const migration = migrations[targetVersion - 42];
				if (!migration) throw new Error(`No such migration: ${targetVersion}`);
				const migrationQueries = migration();
				queries = queries.concat(migrationQueries);
			}

			const updateVersionQuery = compile(db.updateTable('version').set({ version: targetVersion }));

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
			await this.selectOne(db.selectFrom('notes_fts').select(eb => eb.fn.countAll().as('count')));
		} catch (error) {
			this.logger().warn('FTS check failed', error);
			return false;
		}

		this.logger().info('FTS check succeeded');

		return true;
	}

	public async fuzzySearchEnabled() {
		try {
			await this.selectOne(db.selectFrom('notes_spellfix').select(eb => eb.fn.countAll().as('count')));
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
			versionRow = await this.selectOne(db.selectFrom('version').selectAll().limit(1));
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

		const rows = await this.selectAll(db.selectFrom('table_fields').selectAll());

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
